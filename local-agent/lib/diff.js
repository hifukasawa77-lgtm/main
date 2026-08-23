// 依存パッケージなしの簡易行diff（LCSベース）。edit_file の確認画面表示専用。
// old_string/new_stringは通常「一意に特定できる範囲」の短い抜粋なので、
// O(n*m)のDPで十分実用速度が出る（ファイル全体には使わない）。
function lcsTable(a, b) {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      table[i][j] =
        a[i - 1] === b[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  return table;
}

// 行配列同士のdiffを { type: "same"|"del"|"add", line } の配列で返す。
export function diffLines(oldText, newText) {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const table = lcsTable(a, b);
  const out = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ type: "same", line: a[i - 1] });
      i--;
      j--;
    } else if (table[i][j - 1] >= table[i - 1][j]) {
      // 同数タイの場合はaddを先にバックトラックへ積む → reverse後にdelがaddより前へ来る
      // （git diff等の慣習に合わせ、削除行を追加行より先に表示するため）
      out.push({ type: "add", line: b[j - 1] });
      j--;
    } else {
      out.push({ type: "del", line: a[i - 1] });
      i--;
    }
  }
  while (i > 0) {
    out.push({ type: "del", line: a[i - 1] });
    i--;
  }
  while (j > 0) {
    out.push({ type: "add", line: b[j - 1] });
    j--;
  }
  return out.reverse();
}

// 確認画面用のANSI色付きテキストに整形する。
export function formatDiff(oldText, newText) {
  const rows = diffLines(oldText, newText);
  return rows
    .map((r) => {
      if (r.type === "same") return `  ${r.line}`;
      if (r.type === "del") return `\x1b[31m- ${r.line}\x1b[0m`;
      return `\x1b[32m+ ${r.line}\x1b[0m`;
    })
    .join("\n");
}
