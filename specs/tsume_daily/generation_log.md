# フォールバック問題バンク 生成ログ — 詰将棋デイリー / Tsume Daily

- 生成日: 2026-06-11
- 生成者: Code-Generator（Node.js による自動実行。手作業による局面作成なし）
- 用途: Legal-Checker 提出物（著作権安全性の証跡）
- 成果物: `tsume_daily.html` 内 `FALLBACK_BANK` 定数（1手詰40問＋3手詰20問）

## 1. 著作権安全性の宣言

- バンク収録の全60問は、`tsume_daily.html` の `<script id="pure-logic">` ブロックに実装された
  **自前アルゴリズム（`buildCandidate` による乱択構築 ＋ `solveTsume` による全数探索検証）** を
  Node.js でそのまま実行して生成した出力である
- **既存の詰将棋作品・問題集・棋譜データベース等の外部ソースは一切参照・転載・改変していない**
- 人手による局面の入力・調整は一切行っていない（detailed_design.md §6 の指示どおり）
- 乱数は決定論的シード（FNV-1a → mulberry32、シード文字列 `tsumeDailyBank:{手数}:{番号}:{試行}`）
  のみを使用しており、同一スクリプトの再実行で同一の60問が再現できる（再現性あり）

## 2. 生成手順

1. `tsume_daily.html` 実装完了後、その `pure-logic` スクリプトブロックを抽出し
   Node.js の `vm` モジュールで無改変のまま実行（日替わり生成と同一コードパス）
2. 各問題番号 `i` に対し、シード `tsumeDailyBank:{plies}:{i}:{attempt}` で候補局面を乱択構築し、
   ソルバー検証（ちょうどN手で詰む／初手唯一解＝余詰なし／3手詰はN-2手で詰まない／
   打ち歩詰め非含有／攻方全着手が王手）を通過するまでリトライ
3. 直列化済み局面の重複を排除（同一局面は不採用）
4. 60問すべてを `deserializeBankEntry` で復元し、ソルバーで**全件再検証**
5. JSON化して `tsume_daily.html` の `FALLBACK_BANK` 定数へ埋め込み

実行コマンド:

```bash
node /tmp/tsume_bankgen.js
```

## 3. 実行出力（原文）

```text
generating mate-in-1 x40 ...
  done: 40 problems, 2224 attempts, 1666ms
generating mate-in-3 x20 ...
  done: 20 problems, 1561 attempts, 31438ms
verified: 60/60
written: /tmp/tsume_bank.json (6715 bytes)
```

- 1手詰: 40問採用 / 総試行2,224回（採用率 約1.8%）
- 3手詰: 20問採用 / 総試行1,561回（採用率 約1.3%）
- 再検証: 60/60 全件合格（唯一解・手数一致・最終局面詰み・1手詰ショートカットなし）

## 4. 生成スクリプト全文（再現用）

```js
// FallbackBank 自動生成スクリプト
// tsume_daily.html の pure-logic ブロック（buildCandidate / solveTsume）をそのまま実行し、
// 手作業による局面作成を一切行わずに 1手詰40問＋3手詰20問 を生成する。
'use strict';
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('/home/user/main/tsume_daily.html', 'utf8');
const m = html.match(/<script id="pure-logic">([\s\S]*?)<\/script>/);
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(m[1], ctx, { filename: 'pure-logic.js' });

function serializeMove(mv) {
  return mv.kind === 'drop' ? [mv.t, mv.tr, mv.tc] : [mv.fr, mv.fc, mv.tr, mv.tc, mv.prom ? 1 : 0];
}
function serializeEntry(plies, state, solution) {
  const b = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const pc = state.board[r][c];
    if (pc) b.push([r, c, pc.t, pc.p]);
  }
  return { p: plies, b, h: state.hands[1].slice(), s: solution.map(serializeMove) };
}

function generateBank(plies, count) {
  const entries = [];
  const seen = new Set();
  let index = 0, attemptsTotal = 0;
  while (entries.length < count) {
    let found = false;
    for (let attempt = 0; attempt < 3000; attempt++) {
      attemptsTotal++;
      const rng = ctx.mulberry32(ctx.fnv1a('tsumeDailyBank:' + plies + ':' + index + ':' + attempt));
      const cand = ctx.buildCandidate(rng, plies);
      if (!cand) continue;
      const sol = ctx.solveTsume(cand, plies);
      if (!sol) continue;
      if (sol.firstMoves.length !== 1) continue;
      if (sol.line.length !== plies) continue;
      if (plies === 3 && ctx.solveTsume(cand, 1)) continue;
      const entry = serializeEntry(plies, cand, sol.line);
      const key = JSON.stringify([entry.b, entry.h]);
      if (seen.has(key)) continue; // 重複局面排除
      seen.add(key);
      entries.push(entry);
      found = true;
      break;
    }
    if (!found) console.error('WARN: index ' + index + ' exhausted attempts');
    index++;
    if (index > count * 50) break; // 安全弁
  }
  return { entries, attemptsTotal };
}

console.log('generating mate-in-1 x40 ...');
const t1 = Date.now();
const bank1 = generateBank(1, 40);
console.log('  done: ' + bank1.entries.length + ' problems, ' + bank1.attemptsTotal + ' attempts, ' + (Date.now() - t1) + 'ms');

console.log('generating mate-in-3 x20 ...');
const t3 = Date.now();
const bank3 = generateBank(3, 20);
console.log('  done: ' + bank3.entries.length + ' problems, ' + bank3.attemptsTotal + ' attempts, ' + (Date.now() - t3) + 'ms');

const all = bank1.entries.concat(bank3.entries);

// 全件再検証
let verified = 0;
for (const e of all) {
  const d = ctx.deserializeBankEntry(e);
  const sol = ctx.solveTsume(d.state, e.p);
  if (!sol || sol.firstMoves.length !== 1 || sol.line.length !== e.p) {
    console.error('VERIFY FAIL', JSON.stringify(e));
    process.exit(1);
  }
  if (e.p === 3 && ctx.solveTsume(d.state, 1)) {
    console.error('VERIFY FAIL (mate-in-1 shortcut)', JSON.stringify(e));
    process.exit(1);
  }
  let s = d.state;
  for (const mv of d.solution) s = ctx.applyMove(s, mv);
  if (!ctx.isMate(s)) { console.error('VERIFY FAIL (final not mate)'); process.exit(1); }
  verified++;
}
console.log('verified: ' + verified + '/' + all.length);

const lines = all.map(e => JSON.stringify(e));
fs.writeFileSync('/tmp/tsume_bank.json', '[\n' + lines.join(',\n') + '\n]\n');
console.log('written: /tmp/tsume_bank.json (' + fs.statSync('/tmp/tsume_bank.json').size + ' bytes)');
```

## 5. 流用コードのライセンス情報（Legal-Checker向け補足）

- 盤面ロジック（`inB`/`rawMoves`/`inCheck` 等）は同一リポジトリ内 `shogi.html`（自作）からのコピーであり、
  外部OSS・外部ライブラリの流用はない
- `mulberry32` / `FNV-1a` はパブリックドメイン相当の周知アルゴリズム（数式実装であり著作物の複製ではない）
- 外部CDN・外部フォント・外部画像・外部音源: 使用なし（依存ゼロ）
