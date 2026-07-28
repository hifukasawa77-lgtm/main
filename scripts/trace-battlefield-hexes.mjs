#!/usr/bin/env node
/**
 * trace-battlefield-hexes.mjs
 * 野戦バックドロップ画像(assets/sengoku/gpt/battles/*.png)を画像解析し、
 * ゲームと同じ cover 配置・ヘックス座標(HEX: size68, 17x15, ox300, oy250, canvas 2560x2080)で
 * 各ヘックスの地形(平地/森/山/川/水面)を分類して FIELD_HEX_LAYOUTS を生成する。
 * 攻城戦の CASTLE_HEX_LAYOUTS と同じ「画像→ヘックストレース」方式の野戦版。
 *
 * 使い方: node scripts/trace-battlefield-hexes.mjs [--debug <outdir>]
 *   標準出力に sengoku.html へ貼る FIELD_HEX_LAYOUTS ブロックを出す。
 *   --debug 指定時は分類結果を重ねたデバッグPNGを出力する(目視検証用)。
 * 依存: なし(Node組み込みの zlib のみ。PNGデコード/エンコードを自前実装)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// トレースの基準は「設計キャンバス」2560x2080。sengoku.html 側の HEX_DESIGN と必ず同じ値にすること。
// 実キャンバスは 16:9(2560x1440) だが、sengoku.html はこの設計キャンバスを contain フィットして
// ヘックスを配置するため、レイアウトの (col,row) は設計キャンバス基準のまま通用する。
// （実キャンバスの値をここへ書くと、生成されるレイアウトがゲームの描画位置とずれる）
const W = 2560, H = 2080;
const HEX = { size: 68, cols: 17, rows: 15, ox: 300, oy: 250 };

/* ---------------- PNG decode (8bit, colorType 0/2/6, non-interlaced) ---------------- */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, ihdr = null; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error('unsupported PNG (depth ' + ihdr.depth + ', interlace ' + ihdr.interlace + ')');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.color];
  if (!ch) throw new Error('unsupported colorType ' + ihdr.color);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * ch;
  const out = Buffer.alloc(ihdr.h * stride);
  let p = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[p++]; const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const rawv = raw[p + x];
      const a = x >= ch ? row[x - ch] : 0;            // left
      const b = prev ? prev[x] : 0;                    // up
      const c = (prev && x >= ch) ? prev[x - ch] : 0;  // up-left
      let v;
      if (f === 0) v = rawv;
      else if (f === 1) v = rawv + a;
      else if (f === 2) v = rawv + b;
      else if (f === 3) v = rawv + ((a + b) >> 1);
      else { // Paeth
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = rawv + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      row[x] = v & 0xff;
    }
    p += stride;
  }
  return { w: ihdr.w, h: ihdr.h, ch, data: out };
}

/* ---------------- PNG encode (RGB, filter 0) — デバッグ画像出力用 ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- ヘックス幾何(sengoku.htmlと同一) ---------------- */
function hexCenter(col, row) {
  return [HEX.ox + HEX.size * Math.sqrt(3) * (col + 0.5 * (row & 1)), HEX.oy + HEX.size * 1.5 * row];
}
function hexNeighbors(col, row) {
  const even = (row % 2) === 0;
  const d = even ? [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]] : [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
  return d.map(([dc, dr]) => [col + dc, row + dr]).filter(([c, r]) => c >= 0 && c < HEX.cols && r >= 0 && r < HEX.rows);
}

/* ---------------- 戦場プロファイル ----------------
 * 各戦場の水域の意味論(史実の地理)。油彩調の画像では「青灰=靄の遠山」と「青灰=海」が
 * 色だけでは区別できないため、戦場ごとに水域の解釈を与える。
 *   none  = 水域なし(青系は靄・遠山)   river = 水域は川・湿地(渡河可)
 *   sea   = 大水域は海(通行不可)       weak  = 小さな水たまりのみ(川扱い)
 */
const PROFILES = {
  battlePlainRoad: 'none', battleForestMountain: 'none', battleRiverMarsh: 'river',
  battleSekigahara: 'none',      // 朝霧の盆地(青系は霧)
  battleKawanakajima: 'river',   // 千曲川・犀川
  battleNagashino: 'river',      // 連吾川
  battleOkehazama: 'none',       // 雨の狭間(水域なし)
  battleMikatagahara: 'none',    // 台地
  battleYamazaki: 'river',       // 淀川水系
  battleAnegawa: 'river',        // 姉川
  battleItsukushima: 'sea',      // 厳島の海
  battleKonodai: 'river',        // 太日川(江戸川)
  battleMimasePass: 'none',      // 三増峠
  battleImayama: 'weak',
  battleNodaFukushima: 'river',  // 淀川河口の中州
  battleMimigawa: 'river',       // 耳川
  battleTenshoIga: 'none',       // 伊賀山中(青系は靄)
  battleSuriagehara: 'none',     // 摺上原台地
  battleTedorigawa: 'river',     // 手取川
  battleOkitanawate: 'river',    // 沖田畷の湿地
  battleHitoribashi: 'river',    // 瀬戸川
  battleKeichoDewa: 'river',     // 長谷堂周辺の川・湿地
  battleKawagoe: 'weak',         // 夜戦(入間川は画面外)
  battleHetsugigawa: 'river',    // 戸次川
  battleNakatomigawa: 'river',   // 吉野川支流
};

/* ---------------- 空行(地平線)テーブル ----------------
 * 戦場画像は俯瞰パースのため、画面上部は空・雲・遠景の山(=地平線の向こう)になる。
 * その行は「戦場外(sky)」としてトレースし、ヘックス枠を描かず進入・布陣も不可にする
 * (駒が空中に浮いて見える問題の対策)。値はデバッグ描画の目視で確定。 */
const SKY_ROWS = {
  battlePlainRoad: 3, battleForestMountain: 1, battleRiverMarsh: 2,
  battleSekigahara: 2, battleKawanakajima: 2, battleNagashino: 2,
  battleOkehazama: 1, battleMikatagahara: 2, battleYamazaki: 3,
  battleAnegawa: 2, battleItsukushima: 2, battleKonodai: 1,
  battleMimasePass: 1, battleImayama: 2, battleNodaFukushima: 2,
  battleMimigawa: 1, battleTenshoIga: 1, battleSuriagehara: 2,
  battleTedorigawa: 1, battleOkitanawate: 2, battleHitoribashi: 2,
  battleKeichoDewa: 1, battleKawagoe: 2, battleHetsugigawa: 2,
  battleNakatomigawa: 2,
};

/* ---------------- ピクセル分類 ----------------
 * 判定順: (海プロファイルの水) → 空/靄 → 水面 → 森 → 岩肌 → 平地。
 * kv = 露出正規化係数(夕暮れ・夜戦マップで暗部が森に化けるのを防ぐ)。 */
function classifyPixel(r, g, b, mode, kv) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const v = Math.min(1, (mx / 255) * kv), s = mx ? (mx - mn) / mx : 0;
  // 海プロファイル: 淡い青灰の海面も水として拾う(空判定より先)。
  // 暗い青緑(島の樹冠)を除くため、明るさと「緑より青」を要求する
  if (mode === 'sea' && b > r + 6 && b >= g - 4 && s > 0.05 && v > 0.35) return 'water';
  // 空・雲・靄・雪嶺・日射の霞: 明るく淡い(遠景) → 平地扱いにする
  if (v > 0.68 && s < 0.28) return 'sky';
  if (v > 0.58 && s < 0.16) return 'sky';
  if (mode === 'none' && b > r && v > 0.45 && s < 0.35) return 'sky'; // 水域なし戦場の青系=靄
  if (mode !== 'none') {
    // 水面: 寒色(青/青緑)。川・海・湿地の水たまり
    if (b > r + 15 && b >= g - 6 && v > 0.14 && s > 0.10) return 'water';
    if (g > r + 20 && b > r + 20 && mn > 40) return 'water'; // 青緑(浅瀬)
    if (g > r + 8 && b > r + 4 && v > 0.45 && s > 0.08 && s < 0.5) return 'water'; // 白波・急流の青緑
  }
  // 森: 緑優勢の樹冠、または暗い茂み(針葉樹の青緑含む)
  if (g > r + 8 && g >= b - 2 && v < 0.55 && s > 0.15) return 'forest';
  if (g >= r && b >= r - 4 && v < 0.32 && v > 0.05) return 'forest';
  // 岩肌: 無彩色で中暗(テクスチャ条件はヘックス単位で課す)。暖色(枯草・砂)は除外
  if (s < 0.16 && v >= 0.20 && v < 0.62 && r <= g + 10) return 'rock';
  return 'plain';
}

/* ---------------- ヘックス分類 ---------------- */
function classifyImage(img, mode) {
  const scale = Math.max(W / img.w, H / img.h);
  const sw = W / scale, sh = H / scale;
  const sx = (img.w - sw) / 2, sy = (img.h - sh) / 2;
  const px = (cx, cy) => { // canvas座標 → 元画像ピクセル
    const ix = Math.min(img.w - 1, Math.max(0, Math.round(sx + cx / scale)));
    const iy = Math.min(img.h - 1, Math.max(0, Math.round(sy + cy / scale)));
    const o = (iy * img.w + ix) * img.ch;
    return [img.data[o], img.data[o + 1], img.data[o + 2]];
  };
  // 露出正規化: グリッド領域の平均輝度から補正係数を求める(夕暮れ・夜戦対策)
  let lumT = 0, nT = 0;
  for (let y = 182; y <= 1746; y += 24) for (let x = 241; x <= 2302; x += 24) {
    const [r, g, b] = px(x, y); lumT += 0.299 * r + 0.587 * g + 0.114 * b; nT++;
  }
  const kv = Math.min(1.9, Math.max(0.9, 118 / (lumT / nT)));
  const grid = [], meta = [];
  for (let row = 0; row < HEX.rows; row++) {
    grid.push([]); meta.push([]);
    for (let col = 0; col < HEX.cols; col++) {
      const [hx, hy] = hexCenter(col, row);
      const R = HEX.size * 0.62, votes = { sky: 0, water: 0, forest: 0, rock: 0, plain: 0 };
      let n = 0, lum = 0, lum2 = 0, vSum = 0;
      for (let dy = -R; dy <= R; dy += 6) for (let dx = -R; dx <= R; dx += 6) {
        if (dx * dx + dy * dy > R * R) continue;
        const [r, g, b] = px(hx + dx, hy + dy);
        votes[classifyPixel(r, g, b, mode, kv)]++; n++;
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        lum += L; lum2 += L * L; vSum += Math.max(r, g, b) / 255;
      }
      const std = Math.sqrt(Math.max(0, lum2 / n - (lum / n) ** 2)) * kv; // 輝度テクスチャ(露出補正込み)
      const meanV = Math.min(1, (vSum / n) * kv);
      const fr = k => votes[k] / n;
      const waterTh = mode === 'sea' ? 0.42 : mode === 'river' ? 0.40 : 0.45;
      let t = 'plain';
      if (fr('sky') > 0.45) t = 'plain'; // 空・靄=遠景
      else if (mode !== 'none' && fr('water') >= waterTh) {
        // 水面は筆致が比較的平滑。テクスチャの強い寒色は霞んだ遠山・樹林
        // (海の上部行=遠景の島影が水に化けやすいので、より平滑さを要求する)
        const stdTh = mode === 'sea' ? (row <= 4 ? 22 : 30) : 26;
        t = std < stdTh ? 'water' : (meanV < 0.5 ? (fr('forest') > 0.12 ? 'forest' : 'mountain') : 'plain');
      }
      else if (fr('forest') >= 0.42) t = 'forest';
      else if (fr('rock') >= 0.50 && std >= 18 && meanV < 0.52) t = 'mountain'; // 平滑・明色の無彩色(干潟・砂州・靄)は岩と見なさない
      else if (fr('forest') + fr('rock') >= 0.65 && meanV < 0.5) t = fr('forest') >= fr('rock') ? 'forest' : 'mountain';
      grid[row].push(t); meta[row].push({ v: meanV, std });
    }
  }
  return { grid, meta };
}

/* ---------------- 後処理 ---------------- */
function postProcess(grid, meta, mode, skyRows) {
  const at = (c, r) => (grid[r] && grid[r][c]) || 'plain';
  // 0) 遠景の水誤検出対策: 上部(rows0-4)で完結する水域は前景の水ではなく霞んだ遠山/水平線。
  //    暗ければ山、明るければ平地(遠景)へ降格する。前景(row5以降)へ繋がる水域はそのまま。
  {
    const seen = new Set();
    for (let r = 0; r <= 4; r++) for (let c = 0; c < HEX.cols; c++) {
      if (at(c, r) !== 'water' || seen.has(c + ',' + r)) continue;
      const comp = [[c, r]]; seen.add(c + ',' + r);
      let touchesFg = false;
      for (let i = 0; i < comp.length; i++) {
        if (comp[i][1] >= 5) touchesFg = true;
        hexNeighbors(comp[i][0], comp[i][1]).forEach(([nc, nr]) => {
          if (at(nc, nr) === 'water' && !seen.has(nc + ',' + nr)) { seen.add(nc + ',' + nr); comp.push([nc, nr]); }
        });
      }
      if (!touchesFg) {
        comp.forEach(([cc, rr]) => {
          grid[rr][cc] = (meta && meta[rr][cc].v < 0.5) ? 'mountain' : 'plain';
        });
      }
    }
  }
  // 1) 孤立ヘックス除去: 同種の隣接が無い森/山/水は平地へ(油彩ノイズ対策)
  for (let r = 0; r < HEX.rows; r++) for (let c = 0; c < HEX.cols; c++) {
    const t = at(c, r);
    if (t === 'plain') continue;
    if (!hexNeighbors(c, r).some(([nc, nr]) => at(nc, nr) === t)) grid[r][c] = 'plain';
  }
  // 2) 水面の扱いをプロファイルで確定:
  //    sea  = 大きな水域(海)は water(通行不可)のまま、小さな水域は river(渡河可)
  //    river/weak = 全て river(川・湿地は渡って戦える)
  //    none = 残った water は誤検出 → 平地へ
  if (mode === 'sea') {
    const seen = new Set();
    for (let r = 0; r < HEX.rows; r++) for (let c = 0; c < HEX.cols; c++) {
      if (at(c, r) !== 'water' || seen.has(c + ',' + r)) continue;
      const comp = [[c, r]]; seen.add(c + ',' + r);
      for (let i = 0; i < comp.length; i++) {
        hexNeighbors(comp[i][0], comp[i][1]).forEach(([nc, nr]) => {
          if (at(nc, nr) === 'water' && !seen.has(nc + ',' + nr)) { seen.add(nc + ',' + nr); comp.push([nc, nr]); }
        });
      }
      if (comp.length < 45) comp.forEach(([cc, rr]) => { grid[rr][cc] = 'river'; });
    }
  } else {
    const to = mode === 'none' ? 'plain' : 'river';
    for (let r = 0; r < HEX.rows; r++) for (let c = 0; c < HEX.cols; c++) if (at(c, r) === 'water') grid[r][c] = to;
  }
  // 3) 空行(地平線より上)を戦場外にする。守り手の布陣行は空行の直下2行になる
  for (let r = 0; r < skyRows; r++) for (let c = 0; c < HEX.cols; c++) grid[r][c] = 'sky';
  const defRows = [skyRows, skyRows + 1];
  // 4) 布陣マス(攻: rows13-14 / 守: 空行直下2行 の偶数列)の水面は浅瀬(river)にして駒が海上に湧かないようにする
  for (const r of [...defRows, 13, 14]) for (let c = 2; c <= 12; c += 2) {
    if (at(c, r) === 'water') grid[r][c] = 'river';
  }
  // 5) 到達性検証: 攻め手(rows13-14)から守り手の布陣行へ water/sky を避けて到達できるか(BFS)。
  //    不可なら water を高コストで許すダイクストラの最短路上の water を river(浅瀬)へ変換して渡り口を作る。
  const passable = (c, r) => at(c, r) !== 'water' && at(c, r) !== 'sky';
  const bfsReach = () => {
    const q = [], dist = {};
    for (const r of [13, 14]) for (let c = 0; c < HEX.cols; c++) if (passable(c, r)) { q.push([c, r]); dist[c + ',' + r] = 0; }
    for (let i = 0; i < q.length; i++) {
      const [c, r] = q[i];
      if (r <= defRows[1]) return true;
      hexNeighbors(c, r).forEach(([nc, nr]) => {
        if (passable(nc, nr) && dist[nc + ',' + nr] === undefined) { dist[nc + ',' + nr] = 1; q.push([nc, nr]); }
      });
    }
    return false;
  };
  if (!bfsReach()) {
    const dist = {}, from = {}, pq = [];
    for (const r of [13, 14]) for (let c = 0; c < HEX.cols; c++) { dist[c + ',' + r] = 0; pq.push([0, c, r]); }
    let goal = null;
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [d, c, r] = pq.shift();
      if (d > dist[c + ',' + r]) continue;
      if (r <= defRows[1]) { goal = [c, r]; break; }
      for (const [nc, nr] of hexNeighbors(c, r)) {
        if (at(nc, nr) === 'sky') continue;
        const nd = d + (at(nc, nr) === 'water' ? 8 : 1);
        if (dist[nc + ',' + nr] === undefined || nd < dist[nc + ',' + nr]) { dist[nc + ',' + nr] = nd; from[nc + ',' + nr] = c + ',' + r; pq.push([nd, nc, nr]); }
      }
    }
    if (goal) {
      let k = goal[0] + ',' + goal[1];
      while (k) { const [c, r] = k.split(',').map(Number); if (at(c, r) === 'water') grid[r][c] = 'river'; k = from[k]; }
    }
  }
  return grid;
}

/* ---------------- 手動補正 ----------------
 * ヒューリスティックで拾いきれない画像固有の癖をデバッグ画像の目視で補正する
 * (攻城戦 CASTLE_HEX_LAYOUTS と同じく、最終レイアウトは目視トレースで確定する方針)。
 * 補正は通行可能な地形(平地/川)への変更のみ = 到達性検証を壊さない。 */
const OVERRIDES = {
  // 明け方の枯野の質感が岩と紛らわしい。山は画面上部の山裾(rows0-3)のみ
  battleKawanakajima(grid) {
    for (let r = 4; r < HEX.rows; r++) for (let c = 0; c < HEX.cols; c++) if (grid[r][c] === 'mountain') grid[r][c] = 'plain';
  },
  // 右手前の水田(灰褐色)が岩と紛らわしい。山は遠景(rows0-4)のみ
  battleYamazaki(grid) {
    for (let r = 5; r < HEX.rows; r++) for (let c = 0; c < HEX.cols; c++) if (grid[r][c] === 'mountain') grid[r][c] = 'plain';
  },
  // 夕暮れの暗い草原が森と紛らわしい。長谷堂周辺は開けた湿地草原
  battleKeichoDewa(grid) {
    for (let r = 0; r < HEX.rows; r++) for (let c = 0; c < HEX.cols; c++) if (grid[r][c] === 'forest') grid[r][c] = 'plain';
  },
  // 地平線直下(rows2-5)の霞んだ遠山が川と紛らわしい。右端(cols14-16)を流れる川だけ残す
  battleNagashino(grid) {
    for (let r = 2; r <= 5; r++) for (let c = 0; c <= 13; c++) if (grid[r][c] === 'river') grid[r][c] = 'mountain';
  },
  // 逆光の川面(太日川)が空と紛らわしく検出漏れする。画像の水面帯を直接トレース
  battleKonodai(grid) {
    for (const c of Array.from({ length: HEX.cols }, (_, i) => i)) { grid[1][c] = 'river'; grid[2][c] = 'river'; }
    for (const c of [0, 1, 2, 14, 15, 16]) grid[3][c] = 'river';
  },
};

/* ---------------- デバッグ画像 ---------------- */
const DBG_COLORS = { forest: [34, 197, 94], mountain: [245, 158, 11], river: [56, 189, 248], water: [29, 78, 216] };
function debugRender(img, grid, outFile) {
  const dw = 640, dh = 520; // 2560x2080 の 1/4
  const scale = Math.max(W / img.w, H / img.h);
  const sx = (img.w - W / scale) / 2, sy = (img.h - H / scale) / 2;
  const rgb = Buffer.alloc(dw * dh * 3);
  // 背景(cover配置を再現して縮小)
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const ix = Math.min(img.w - 1, Math.max(0, Math.round(sx + (x * 4) / scale)));
    const iy = Math.min(img.h - 1, Math.max(0, Math.round(sy + (y * 4) / scale)));
    const o = (iy * img.w + ix) * img.ch, d = (y * dw + x) * 3;
    rgb[d] = img.data[o]; rgb[d + 1] = img.data[o + 1]; rgb[d + 2] = img.data[o + 2];
  }
  // 空行(戦場外)の可視化: 暗幕 + 地平線ライン
  const skyRows = grid.findIndex(row => row[0] !== 'sky');
  const cutRows = skyRows < 0 ? HEX.rows : skyRows;
  if (cutRows > 0) {
    const yLine = Math.round((HEX.oy + HEX.size * 1.5 * cutRows - HEX.size) / 4);
    for (let y = 0; y < Math.min(dh, yLine); y++) for (let x = 0; x < dw; x++) {
      const d = (y * dw + x) * 3;
      rgb[d] = rgb[d] * 0.45; rgb[d + 1] = rgb[d + 1] * 0.45; rgb[d + 2] = rgb[d + 2] * 0.45;
    }
    for (let x = 0; x < dw; x++) { const d = (Math.min(dh - 1, yLine) * dw + x) * 3; rgb[d] = 255; rgb[d + 1] = 60; rgb[d + 2] = 60; }
  }
  // ヘックス着色(中心円をブレンド) + 枠点
  for (let row = 0; row < HEX.rows; row++) for (let col = 0; col < HEX.cols; col++) {
    const t = grid[row][col]; const color = DBG_COLORS[t];
    if (t === 'sky') continue;
    const [hx, hy] = hexCenter(col, row);
    const cx = hx / 4, cy = hy / 4, R = (HEX.size * 0.82) / 4;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const rr = dx * dx + dy * dy; if (rr > R * R) continue;
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (x < 0 || x >= dw || y < 0 || y >= dh) continue;
      const d = (y * dw + x) * 3;
      const edge = rr > (R - 1.2) * (R - 1.2);
      if (edge) { rgb[d] = 255; rgb[d + 1] = 255; rgb[d + 2] = 255; }
      else if (color) { const a = 0.42; for (let i = 0; i < 3; i++) rgb[d + i] = Math.round(rgb[d + i] * (1 - a) + color[i] * a); }
    }
  }
  fs.writeFileSync(outFile, encodePNG(dw, dh, rgb));
}

/* ---------------- main ---------------- */
function main() {
  const argv = process.argv.slice(2);
  const dbgIdx = argv.indexOf('--debug');
  const dbgDir = dbgIdx >= 0 ? argv[dbgIdx + 1] : null;
  if (dbgDir) fs.mkdirSync(dbgDir, { recursive: true });

  // sengoku.html の GPT_ASSETS から野戦画像キーを抽出(海戦は全マス水面のため対象外)
  const html = fs.readFileSync(path.join(ROOT, 'sengoku.html'), 'utf8');
  const entries = [...html.matchAll(/(battle\w+): '(assets\/sengoku\/gpt\/battles\/[^']+\.png)'/g)]
    .map(m => [m[1], m[2]]).filter(([k]) => k !== 'battleNaval');

  const SYM = { plain: '.', forest: 'f', mountain: 'm', river: 'r', water: 'w', sky: '-' };
  const lines = [];
  for (const [key, rel] of entries) {
    const img = decodePNG(fs.readFileSync(path.join(ROOT, rel)));
    const mode = PROFILES[key] || 'weak';
    const { grid, meta } = classifyImage(img, mode);
    postProcess(grid, meta, mode, SKY_ROWS[key] || 0);
    if (OVERRIDES[key]) OVERRIDES[key](grid);
    if (dbgDir) debugRender(img, grid, path.join(dbgDir, key + '.png'));
    const rows = grid.map(row => row.map(t => SYM[t]).join(''));
    lines.push(`  ${key}: [`);
    for (const r of rows) lines.push(`    '${r}',`);
    lines.push('  ],');
    const stat = {};
    grid.flat().forEach(t => { stat[t] = (stat[t] || 0) + 1; });
    console.error(key.padEnd(24), JSON.stringify(stat));
  }
  console.log('const FIELD_HEX_LAYOUTS = {');
  console.log(lines.join('\n'));
  console.log('};');

  // 全戦場のデバッグ画像を1枚に並べたモンタージュ(目視レビュー用)
  if (dbgDir) {
    const cols = 4, cw = 320, ch = 260;
    const rows = Math.ceil(entries.length / cols);
    const mw = cols * cw, mh = rows * ch;
    const mont = Buffer.alloc(mw * mh * 3);
    entries.forEach(([key], i) => {
      const img = decodePNG(fs.readFileSync(path.join(dbgDir, key + '.png')));
      const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const s = ((y * 2) * img.w + (x * 2)) * img.ch, d = ((oy + y) * mw + (ox + x)) * 3;
        mont[d] = img.data[s]; mont[d + 1] = img.data[s + 1]; mont[d + 2] = img.data[s + 2];
      }
    });
    fs.writeFileSync(path.join(dbgDir, '_montage.png'), encodePNG(mw, mh, mont));
    console.error('montage order:', entries.map(([k]) => k).join(', '));
  }
}
main();
