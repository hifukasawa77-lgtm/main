// コードで描くドット絵。外部画像は使わない。キャラ・敵・ボス・背景を実行時にスプライトシートとして生成し、
// AssetManager に「画像」として差し込む（assets_config.js の src に実画像を指定すれば、そちらが優先される）。
// 各コマは「形を矩形で描く → 陰影（上辺を明るく・下辺と右辺を暗く）→ 輪郭（1px）」の順で仕上げる。
(function (K) {
  const OUT = '#14101c';

  // ---------- 描画の小道具 ----------
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return { c: c, g: g }; }
  function rc(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function ln(g, col, x0, y0, x1, y1, th) {                       // 太さ th の線（ドットを並べる）
    th = th || 1; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); g.fillStyle = col;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n - th / 2), Math.round(y0 + (y1 - y0) * i / n - th / 2), th, th);
  }
  function ell(g, col, cx, cy, rx, ry) {                          // 塗りつぶし楕円
    g.fillStyle = col;
    for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry || 1)))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  }
  function tri(g, col, x, y, w, h) {                              // 上向きの三角（x,y は底辺の左・底辺の高さ）
    g.fillStyle = col; for (let i = 0; i < h; i++) { const ww = Math.max(1, Math.round(w * (i + 1) / h)); g.fillRect(Math.round(x + (w - ww) / 2), Math.round(y - h + i + 1), ww, 1); }
  }
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

  // 陰影と輪郭。d: ImageData の画素列
  function finish(g, w, h, opt) {
    opt = opt || {};
    const id = g.getImageData(0, 0, w, h), d = id.data, src = new Uint8ClampedArray(d);
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[(y * w + x) * 4 + 3];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (src[i + 3] < 128) continue;
      let k = 0;
      if (!A(x, y - 1)) k = 0.28; else if (!A(x, y + 1) || !A(x + 1, y)) k = -0.28;      // 上は明るく、下と右は暗く
      if (opt.white) k = 0.6;
      for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, k >= 0 ? src[i + c] + (255 - src[i + c]) * k : src[i + c] * (1 + k)));
    }
    const o = hex(opt.outline || OUT);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (src[i + 3] >= 128) continue;
      if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; }
    }
    g.putImageData(id, 0, 0);
  }

  // スプライトシートを作る。rows: [{n:コマ数, draw:(g,f)=>{}, white?:bool}]。1コマは cw×ch、列は最大コマ数
  function sheet(cw, ch, rows) {
    const cols = Math.max.apply(null, rows.map(r => r.n)), out = cv(cw * cols, ch * rows.length);
    rows.forEach((r, ri) => {
      for (let f = 0; f < r.n; f++) {
        const t = cv(cw, ch); r.draw(t.g, f, cw, ch); finish(t.g, cw, ch, { white: r.white, outline: r.outline });
        out.g.drawImage(t.c, f * cw, ri * ch);
      }
    });
    return out.c;
  }

  // ---------- 主人公・焔丸（64×48、足元中央＝x32・y48。右向き） ----------
  const SKIN = '#f0c090', HAIR = '#1c1824', CREAM = '#ece0c4', RED = '#c83030', PANTS = '#34507c', BOOT = '#2a221e', GOLD = '#e0b040', BLADE = '#dcecff';
  function player(g, anim, f, dragon) {
    const cx = 32, crouch = anim === 'crouch' || anim === 'crouchAttack';
    const body = dragon ? '#2fb8a0' : CREAM, sash = dragon ? '#e8c030' : RED, skin = dragon ? '#a8e8d0' : SKIN;
    let bob = anim === 'idle' ? (f ? 1 : 0) : 0, a = -1, b = 1;
    if (anim === 'walk') { const t = [[-3, 3], [0, 0], [3, -3], [0, 0]][f % 4]; a = t[0]; b = t[1]; bob = (f & 1) ? 0 : 1; }
    if (anim === 'hurt') bob = -1;
    const base = crouch ? 18 : 0;                                  // しゃがむと全体が低くなる（当たり判定 28→18）
    const top = 48 - 46 + (crouch ? 28 : 0);                       // 頭の上端（立ち: 2 / しゃがみ: 30）
    // 脚
    if (crouch) { rc(g, PANTS, cx - 8, 42, 7, 4); rc(g, PANTS, cx + 1, 42, 7, 4); rc(g, BOOT, cx - 9, 45, 8, 3); rc(g, BOOT, cx, 45, 9, 3); }
    else if (anim === 'jump') { rc(g, PANTS, cx - 5, 34, 4, 7); rc(g, PANTS, cx + 1, 34, 5, 5); rc(g, BOOT, cx - 6, 40, 6, 3); rc(g, BOOT, cx + 3, 38, 6, 3); }
    else { rc(g, PANTS, cx - 5 + a, 34, 4, 10); rc(g, PANTS, cx + 1 + b, 34, 4, 10); rc(g, BOOT, cx - 6 + a, 43, 6, 4); rc(g, BOOT, cx + 1 + b, 43, 6, 4); }
    // 胴・帯
    const ty = crouch ? 36 : 22 + bob, th = crouch ? 7 : 13;
    rc(g, body, cx - 6, ty, 12, th); rc(g, sash, cx - 6, ty + th - 4, 12, 3); rc(g, '#a02020', cx - 3, ty + th - 1, 2, 3);
    rc(g, body, cx - 8, ty + 1, 3, 5);                              // 背中側の袖
    // 頭
    const hy = (crouch ? 30 : 12) + bob;
    ell(g, skin, cx + 1, hy + 5, 5, 5); rc(g, HAIR, cx - 4, hy - 1, 10, 3); rc(g, HAIR, cx - 5, hy + 1, 3, 6);
    rc(g, RED, cx - 4, hy + 2, 10, 2);                              // 鉢巻
    ln(g, RED, cx - 5, hy + 3, cx - 11, hy + 7 + (anim === 'walk' ? (f & 1) * 2 : 0), 2);   // 鉢巻の尾
    ln(g, HAIR, cx - 5, hy + 1, cx - 9, hy + 10, 2);                // 結んだ髪
    rc(g, '#1c1824', cx + 3, hy + 5, 1, 2);                         // 目
    if (dragon) { rc(g, '#e8f0a0', cx - 3, hy - 4, 2, 4); rc(g, '#e8f0a0', cx + 3, hy - 4, 2, 4); }
    // 腕と刀（七星剣）
    const sx = cx + 5, sy = ty + 3;
    const blade = (x0, y0, x1, y1) => { ln(g, '#8ab0d0', x0, y0 + 1, x1, y1 + 1, 2); ln(g, BLADE, x0, y0, x1, y1, 2); rc(g, GOLD, x0 - 1, y0 - 2, 3, 5); };
    if (anim === 'attack' || anim === 'crouchAttack') {
      const yy = crouch ? 33 : 22;
      if (f === 0) { ln(g, skin, sx, sy, sx - 3, sy - 8, 3); blade(sx - 3, sy - 8, sx - 13, sy - 24); }                         // 振りかぶり
      else if (f === 1) { ln(g, skin, sx, sy + 1, sx + 7, yy + 1, 3); blade(cx + 8, yy, cx + 31, yy); rc(g, 'rgba(255,255,255,.55)', cx + 12, yy - 3, 18, 1); rc(g, 'rgba(255,255,255,.35)', cx + 14, yy + 3, 15, 1); }  // 斬撃
      else { ln(g, skin, sx, sy + 2, sx + 6, sy + 6, 3); blade(sx + 6, sy + 6, sx + 21, sy + 15); }                              // 戻り
    } else if (anim === 'hurt') { ln(g, skin, sx, sy, sx + 3, sy - 6, 3); blade(sx + 3, sy - 6, sx + 5, sy - 18); }
    else { ln(g, skin, sx, sy + 1, sx + 5, sy + 7, 3); blade(sx + 5, sy + 7, sx + 14, sy + 14); }                                // 構え
    if (dragon) { ell(g, 'rgba(120,255,220,.25)', cx, 26, 14, 20); }
  }
  function playerSheet() {
    const anims = [['idle', 2], ['walk', 4], ['jump', 1], ['crouch', 1], ['attack', 3], ['crouchAttack', 3], ['hurt', 1]];
    const rows = anims.map(a => ({ n: a[1], draw: (g, f) => player(g, a[0], f, false) }));
    rows.push({ n: 4, draw: (g, f) => player(g, f % 2 ? 'walk' : 'idle', f, true) });   // 龍変化
    return sheet(64, 48, rows);
  }

  // ---------- 雑魚（24×24 を基本に、種類ごとの特徴） ----------
  function grunt(g, kind, anim, f, cw, ch) {
    const cx = 12, bot = ch;
    let bob = anim === 'idle' ? (f ? 1 : 0) : (f & 1);
    const a = anim === 'walk' ? [[-2, 2], [0, 0], [2, -2], [0, 0]][f % 4] : [-1, 1];
    const P = { plain: { sk: '#e0b890', cl: '#8a6a40', ac: '#d8b860', dk: '#4a3820' }, ember: { sk: '#e05030', cl: '#802010', ac: '#ffb030', dk: '#401008' }, frost: { sk: '#b8dcf0', cl: '#4a78b0', ac: '#ffffff', dk: '#203858' }, ghoul: { sk: '#a8a0c8', cl: '#5a4a80', ac: '#e8e0ff', dk: '#2a2040' }, naga: { sk: '#38a8b0', cl: '#1a6a90', ac: '#a0f0e0', dk: '#103848' }, knight: { sk: '#c8a888', cl: '#6a7088', ac: '#b8c0d8', dk: '#2a2e40' } }[kind];
    const legH = kind === 'knight' ? 11 : 8, torsoH = kind === 'knight' ? 12 : 8, headH = 7;
    const ly = bot - legH, ty = ly - torsoH + bob, hy = ty - headH + 1;
    // 脚
    rc(g, P.dk, cx - 4 + a[0], ly, 3, legH); rc(g, P.dk, cx + 1 + a[1], ly, 3, legH);
    rc(g, '#201810', cx - 5 + a[0], bot - 2, 4, 2); rc(g, '#201810', cx + 1 + a[1], bot - 2, 4, 2);
    // 胴
    rc(g, P.cl, cx - 5, ty, 10, torsoH);
    if (kind === 'knight') { rc(g, P.ac, cx - 5, ty, 10, 3); rc(g, P.dk, cx - 5, ty + 6, 10, 2); rc(g, P.ac, cx - 7, ty, 3, 5); rc(g, P.ac, cx + 4, ty, 3, 5); }
    if (kind === 'ghoul') { rc(g, P.dk, cx - 5, ty + torsoH - 2, 2, 3); rc(g, P.dk, cx + 1, ty + torsoH - 1, 2, 3); }
    // 頭
    ell(g, P.sk, cx + 1, hy + 3, 4, 4);
    // 腕（前へ伸ばす）
    ln(g, P.sk, cx + 4, ty + 2, cx + 9, ty + 4 + (anim === 'walk' ? (f & 1) : 0), 2);
    // 種類ごとの特徴
    if (kind === 'plain') { rc(g, P.ac, cx - 6, hy - 1, 14, 2); tri(g, P.ac, cx - 4, hy, 10, 4); rc(g, '#e8e0d0', cx - 3, ty + 3, 7, 1); }
    if (kind === 'ember') { tri(g, '#101010', cx - 3, hy + 1, 2, 4); tri(g, '#101010', cx + 3, hy + 1, 2, 4); for (let i = 0; i < 3; i++) tri(g, i % 2 ? '#ffe060' : P.ac, cx - 3 + i * 3, hy, 3, 4 + (f & 1)); }
    if (kind === 'frost') { for (let i = 0; i < 4; i++) tri(g, P.ac, cx - 4 + i * 3, hy + 1, 2, 4); rc(g, P.ac, cx - 5, ty + 2, 10, 1); }
    if (kind === 'ghoul') { rc(g, '#ffe040', cx + 3, hy + 2, 2, 1); ln(g, P.sk, cx + 4, ty + 1, cx + 10, ty + 2, 2); }
    if (kind === 'naga') { tri(g, '#ff8060', cx - 1, hy + 1, 4, 5); rc(g, P.ac, cx - 5, ty + 1, 1, torsoH - 2); rc(g, P.ac, cx - 2, ty + 3, 1, 1); rc(g, P.ac, cx + 1, ty + 5, 1, 1); }
    if (kind === 'knight') { rc(g, P.ac, cx - 4, hy - 1, 10, 4); tri(g, '#d8a030', cx - 1, hy, 4, 5); ln(g, '#d8d8e0', cx + 6, ty + 3, cx + 11, ty - 8, 1); }   // 兜・前立・槍
    if (kind !== 'ghoul') rc(g, '#101010', cx + 3, hy + 3, 1, 2);       // 目
  }
  function gruntSheet(kind, cw, ch) {
    return sheet(cw, ch, [{ n: 2, draw: (g, f) => grunt(g, kind, 'idle', f, cw, ch) }, { n: 4, draw: (g, f) => grunt(g, kind, 'walk', f, cw, ch) }]);
  }
  function batSheet() {
    const draw = (g, f, up) => {
      const cx = 12, wy = [4, 7, 10, 7][f % 4], bob = f & 1;
      ell(g, '#5a4a6a', cx, 9 + bob, 3, 4); rc(g, '#ffe040', cx - 2, 8 + bob, 1, 1); rc(g, '#ffe040', cx + 1, 8 + bob, 1, 1);
      tri(g, '#3a2a4a', cx - 3, 5 + bob, 2, 3); tri(g, '#3a2a4a', cx + 2, 5 + bob, 2, 3);
      ln(g, '#3a2e50', cx - 3, 9, cx - 11, wy, 3); ln(g, '#3a2e50', cx + 3, 9, cx + 11, wy, 3);
      ln(g, '#4a3e66', cx - 11, wy, cx - 8, wy + 5, 2); ln(g, '#4a3e66', cx + 11, wy, cx + 8, wy + 5, 2);
    };
    return sheet(24, 16, [{ n: 2, draw: (g, f) => draw(g, f * 2) }, { n: 4, draw: (g, f) => draw(g, f) }]);
  }

  // ---------- ボス（64×64、足元中央＝x32・y64。右向き） ----------
  const B = {
    oni:       { main: '#d04a7a', skin: '#f2d0b0', acc: '#f4ecec', dark: '#4a1830', hair: '#14101c', w: 22, h: 42 },
    monk:      { main: '#7a6a5a', skin: '#c0a080', acc: '#b8b0a0', dark: '#403830', hair: '#302820', w: 28, h: 40 },
    guardian:  { main: '#406080', skin: '#e0884a', acc: '#f0c070', dark: '#203048', hair: '#14101c', w: 28, h: 56 },
    sorcerer:  { main: '#5a3a9a', skin: '#2a2038', acc: '#ffe040', dark: '#2a1a50', hair: '#14101c', w: 20, h: 38 },
    flame:     { main: '#e04820', skin: '#f07030', acc: '#ffe060', dark: '#601808', hair: '#ffb030', w: 38, h: 48 },
    wraith:    { main: '#3a78b8', skin: '#a0d0f0', acc: '#e0f4ff', dark: '#1a3a60', hair: '#8ac0e8', w: 30, h: 44 },
    yuki:      { main: '#cfe8ff', skin: '#f4f8ff', acc: '#7ab8e8', dark: '#4a78a8', hair: '#ffffff', w: 20, h: 42 },
    tengu:     { main: '#a02020', skin: '#d83030', acc: '#f0e0c0', dark: '#3a1010', hair: '#f0e8e0', w: 26, h: 38 },
    swordsman: { main: '#6a6a82', skin: '#e8c8a8', acc: '#d060c0', dark: '#2a2a3a', hair: '#14101c', w: 18, h: 40 },
    samurai:   { main: '#e8e0a0', skin: '#e8c8a8', acc: '#6ae0e8', dark: '#8a8040', hair: '#14101c', w: 22, h: 42 },
    armor:     { main: '#707890', skin: '#ff9040', acc: '#c8d0e8', dark: '#2a2e40', hair: '#14101c', w: 36, h: 52 },
    matron:    { main: '#a03060', skin: '#b8b0a0', acc: '#d070ff', dark: '#401830', hair: '#f0f0f0', w: 24, h: 44 },
    overlord:  { main: '#302040', skin: '#a89ab8', acc: '#d8d0b0', dark: '#140c20', hair: '#14101c', w: 38, h: 56 },
  };
  function boss(g, kind, st, f) {          // st: 'idle'|'attack'|'hurt'
    const P = B[kind], cx = 32, feet = 64, br = st === 'idle' ? (f ? 1 : 0) : 0;
    const ang = st === 'attack' ? [-1.9, -1.1, 0, 0.7][f % 4] : 1.05;           // 腕の向き（ラジアン、下向き＝正）
    const legH = Math.round(P.h * 0.32), torsoH = Math.round(P.h * 0.42), headH = P.h - legH - torsoH;
    const ly = feet - legH, ty = ly - torsoH + br, hy = ty - headH;
    const bw = P.w, armLen = Math.round(P.h * 0.5);
    const sx = cx + Math.round(bw / 2) - 3, sy = ty + 4;
    const hx = sx + Math.cos(ang) * armLen, hy2 = sy + Math.sin(ang) * armLen;
    const weapon = (col, len, th) => ln(g, col, hx, hy2, hx + Math.cos(ang) * len, hy2 + Math.sin(ang) * len, th || 2);
    // 後ろ側の特徴（背景側に先に描く）
    if (kind === 'tengu') { tri(g, '#2a1a1a', cx - 26, ty + 14, 22, 26); tri(g, '#3a2020', cx - 20, ty + 12, 16, 22); }
    if (kind === 'overlord') { for (let i = 0; i < 4; i++) { ell(g, 'rgba(0,0,0,0)', 0, 0, 0, 0); ln(g, P.acc, cx - 22, ty + 10 - i * 4, cx - 8, ty + 12 - i * 3, 2); } ln(g, P.acc, cx - 26, ty, cx - 26, feet - 4, 2); ell(g, P.acc, cx - 26, ty - 4, 6, 5); rc(g, P.dark, cx - 28, ty - 5, 2, 2); rc(g, P.dark, cx - 25, ty - 5, 2, 2); }
    if (kind === 'wraith') { /* 脚の代わりの尾 */ }
    // 脚（または裾・尾）
    if (kind === 'wraith') { tri(g, P.main, cx - bw / 2, feet, bw, legH + 6); }
    else if (kind === 'oni' || kind === 'yuki' || kind === 'matron' || kind === 'sorcerer') { tri(g, P.main, cx - bw / 2 - 3, feet, bw + 6, legH + 4); rc(g, P.dark, cx - bw / 2 - 1, feet - 3, bw + 2, 2); }
    else { rc(g, P.dark, cx - bw / 2 + 1, ly, Math.round(bw * 0.4), legH); rc(g, P.dark, cx + 1, ly, Math.round(bw * 0.4), legH); rc(g, '#201810', cx - bw / 2, feet - 3, Math.round(bw * 0.5), 3); rc(g, '#201810', cx, feet - 3, Math.round(bw * 0.5), 3); }
    // 胴
    rc(g, P.main, cx - bw / 2, ty, bw, torsoH);
    if (kind === 'guardian') { rc(g, P.skin, cx - bw / 2 + 3, ty, bw - 6, torsoH - 6); rc(g, P.acc, cx - bw / 2, ty + torsoH - 8, bw, 3); }
    if (kind === 'armor') { rc(g, P.acc, cx - bw / 2, ty, bw, 4); rc(g, P.dark, cx - bw / 2 + 2, ty + 8, bw - 4, 2); ell(g, P.skin, cx + 4, ty + 14, 6, 5); rc(g, '#101010', cx + 1, ty + 12, 2, 2); rc(g, '#101010', cx + 5, ty + 12, 2, 2); rc(g, '#101010', cx + 2, ty + 16, 5, 1); rc(g, P.acc, cx - bw / 2 - 5, ty - 1, 7, 6); rc(g, P.acc, cx + bw / 2 - 2, ty - 1, 7, 6); }
    if (kind === 'overlord') { rc(g, P.dark, cx - bw / 2 + 4, ty + 4, bw - 8, 2); rc(g, P.acc, cx - 2, ty + 3, 4, torsoH - 6); }
    if (kind === 'samurai') { rc(g, P.dark, cx - bw / 2, ty + 6, bw, 2); rc(g, P.acc, cx - bw / 2 + 2, ty, bw - 4, 3); }
    if (kind === 'monk') { rc(g, P.dark, cx - bw / 2, ty + 5, bw, 3); rc(g, P.acc, cx - 3, ty, 6, torsoH); }
    if (kind === 'flame') { rc(g, P.skin, cx - bw / 2 + 4, ty + 3, bw - 8, torsoH - 6); rc(g, P.acc, cx - 4, ty + 8, 8, 3); }
    if (kind === 'oni') { rc(g, '#f0c0d0', cx - bw / 2 + 2, ty + 3, bw - 4, 2); rc(g, P.dark, cx - bw / 2, ty + torsoH - 5, bw, 3); }
    if (kind === 'matron') { rc(g, P.dark, cx - bw / 2, ty + 6, bw, 2); rc(g, P.acc, cx - 2, ty + 2, 4, 4); }
    // 後ろの腕
    ln(g, P.main, cx - bw / 2 + 2, ty + 4, cx - bw / 2 - 4, ty + 14 + (f & 1), 4);
    // 頭
    const hr = Math.max(6, Math.round(bw * 0.32));
    ell(g, P.skin, cx + 2, hy + hr, hr, hr);
    // 前の腕
    ln(g, P.skin, sx, sy, hx, hy2, 4); ell(g, P.skin, hx, hy2, 3, 3);
    // 種類ごとの顔・武器・飾り
    switch (kind) {
      case 'oni': ell(g, P.hair, cx + 2, hy + hr - 2, hr + 1, hr - 1); rc(g, P.skin, cx + 1, hy + 4, hr, hr + 1); rc(g, P.acc, cx - 1, hy + 2, hr + 4, hr + 3); rc(g, '#e03030', cx + 2, hy + hr, 2, 2); rc(g, '#e03030', cx + 6, hy + hr, 2, 2); rc(g, '#e03030', cx + 1, hy + hr + 4, 8, 1); tri(g, '#f0d070', cx - 1, hy + 4, 3, 7); tri(g, '#f0d070', cx + 7, hy + 4, 3, 7); ln(g, P.hair, cx - 4, hy + 6, cx - 8, hy + 22, 3); weapon('#dcecff', 20, 2); break;
      case 'monk': rc(g, P.hair, cx - 2, hy + 1, hr * 2 + 1, 3); rc(g, '#101010', cx + 4, hy + hr, 2, 2); { const mx = hx + Math.cos(ang) * 8, my = hy2 + Math.sin(ang) * 8; ln(g, '#a0a0a8', hx, hy2, mx, my, 1); ell(g, '#606068', mx, my, 5, 5); for (let i = 0; i < 6; i++) rc(g, '#c0c0c8', mx + Math.cos(i * 1.05) * 6 - 1, my + Math.sin(i * 1.05) * 6 - 1, 2, 2); } break;
      case 'guardian': rc(g, P.hair, cx - 2, hy - 3, hr * 2, 4); ell(g, P.hair, cx + 2, hy - 4, 4, 3); rc(g, '#ffffff', cx + 2, hy + hr - 1, 3, 2); rc(g, '#ffffff', cx + 7, hy + hr - 1, 3, 2); rc(g, '#601010', cx + 2, hy + hr + 4, 8, 2); ln(g, '#8a5a30', hx, hy2, hx + Math.cos(ang) * 30, hy2 + Math.sin(ang) * 30, 5); ell(g, '#6a4220', hx + Math.cos(ang) * 30, hy2 + Math.sin(ang) * 30, 5, 5); break;
      case 'sorcerer': ell(g, P.main, cx + 2, hy + hr - 1, hr + 3, hr + 2); ell(g, P.skin, cx + 3, hy + hr + 1, hr - 2, hr - 2); rc(g, P.acc, cx + 3, hy + hr, 2, 2); rc(g, P.acc, cx + 7, hy + hr, 2, 2); for (let i = 0; i < 3; i++) ell(g, P.acc, cx - 14 + i * 4, ty - 6 - (i & 1) * 4 - br, 2, 2); weapon('#c8a0ff', 14, 2); ell(g, '#ffe080', hx + Math.cos(ang) * 14, hy2 + Math.sin(ang) * 14, 3, 3); break;
      case 'flame': for (let i = 0; i < 5; i++) tri(g, i % 2 ? '#ffe060' : P.hair, cx - 10 + i * 5, hy + 4, 6, 12 + ((i + f) % 2) * 3); rc(g, '#ffffff', cx + 3, hy + hr - 1, 3, 2); rc(g, '#ffffff', cx + 9, hy + hr - 1, 3, 2); rc(g, '#401008', cx + 3, hy + hr + 4, 9, 4); rc(g, '#ffe060', cx + 4, hy + hr + 4, 2, 2); rc(g, '#ffe060', cx + 9, hy + hr + 4, 2, 2); if (st === 'attack') { ell(g, 'rgba(255,200,60,.6)', cx + 22, hy + hr + 6, 8, 5); } break;
      case 'wraith': ell(g, P.hair, cx + 1, hy + hr - 2, hr + 1, hr - 2); rc(g, '#101830', cx + 3, hy + hr, 2, 3); rc(g, '#101830', cx + 8, hy + hr, 2, 3); tri(g, P.acc, cx - 6, hy + 4, 4, 8); tri(g, P.acc, cx + 8, hy + 4, 4, 8); weapon('#6a8aa0', 26, 4); ell(g, '#4a6a80', hx + Math.cos(ang) * 26, hy2 + Math.sin(ang) * 26, 5, 5); break;
      case 'yuki': ell(g, P.hair, cx + 1, hy + hr, hr + 2, hr + 1); ell(g, P.skin, cx + 3, hy + hr + 1, hr - 1, hr - 1); rc(g, '#4a78c8', cx + 4, hy + hr, 2, 2); rc(g, '#4a78c8', cx + 8, hy + hr, 2, 2); ln(g, P.hair, cx - 4, hy + hr, cx - 8, hy + hr + 22, 4); for (let i = 0; i < 3; i++) tri(g, P.acc, cx + 14 + i * 5, hy + 22 - i * 4, 4, 9 + i * 3); weapon('#c0e8ff', 12, 2); break;
      case 'tengu': ell(g, P.skin, cx + 2, hy + hr, hr, hr); tri(g, P.skin, cx + 6, hy + hr + 4, 4, 10); ln(g, P.skin, cx + 8, hy + hr + 2, cx + 18, hy + hr + 4, 4); rc(g, P.hair, cx - 4, hy + 1, hr * 2 + 2, 3); rc(g, '#101010', cx + 4, hy + hr - 1, 3, 2); rc(g, '#403020', cx - 2, hy - 2, 8, 3); weapon(P.acc, 12, 7); break;
      case 'swordsman': ell(g, P.hair, cx + 1, hy + hr - 2, hr + 1, hr); rc(g, P.skin, cx + 3, hy + 3, hr - 1, hr + 2); ln(g, P.hair, cx - 4, hy + 4, cx - 10, hy + 20, 3); rc(g, '#e03060', cx + 4, hy + hr, 2, 2); weapon('#e8e8f8', 26, 2); ell(g, 'rgba(210,96,192,.28)', cx, ty + 8, 16, 22); break;
      case 'samurai': tri(g, P.acc, cx - 2, hy + 3, 3, 8); tri(g, P.acc, cx + 8, hy + 3, 3, 8); ell(g, P.main, cx + 2, hy + hr - 2, hr + 1, hr - 1); rc(g, P.dark, cx - 4, hy + hr - 1, hr * 2 + 2, 3); rc(g, '#101010', cx + 5, hy + hr + 1, 2, 2); weapon(P.acc, 22, 3); break;
      case 'armor': ell(g, P.main, cx + 2, hy + hr - 2, hr + 1, hr); rc(g, P.dark, cx - 3, hy + hr, hr * 2 + 1, 4); rc(g, '#ff4020', cx + 2, hy + hr + 1, 2, 2); rc(g, '#ff4020', cx + 8, hy + hr + 1, 2, 2); ln(g, '#d8d0a0', cx - 5, hy + 3, cx - 11, hy - 6, 3); ln(g, '#d8d0a0', cx + 9, hy + 3, cx + 15, hy - 6, 3); weapon('#d8e0f0', 30, 4); break;
      case 'matron': ell(g, P.hair, cx + 1, hy + hr - 1, hr + 3, hr + 2); ell(g, P.skin, cx + 3, hy + hr + 1, hr - 1, hr - 1); rc(g, '#ff2030', cx + 4, hy + hr, 2, 2); rc(g, '#ff2030', cx + 8, hy + hr, 2, 2); tri(g, '#f0d070', cx, hy + 6, 3, 7); tri(g, '#f0d070', cx + 7, hy + 6, 3, 7); weapon('#806040', 22, 2); ell(g, P.acc, hx + Math.cos(ang) * 22, hy2 + Math.sin(ang) * 22, 4, 4); break;
      case 'overlord': ell(g, P.hair, cx + 1, hy + hr - 1, hr + 1, hr); rc(g, '#ff2030', cx + 3, hy + hr, 3, 2); rc(g, '#ff2030', cx + 9, hy + hr, 3, 2); tri(g, P.acc, cx - 4, hy + 4, 5, 14); tri(g, P.acc, cx + 10, hy + 4, 5, 14); weapon('#6a3ac0', 24, 3); ell(g, 'rgba(120,60,200,.3)', cx, ty + 6, 20, 26); break;
    }
  }
  function bossSheet(kind) {
    return sheet(64, 64, [
      { n: 2, draw: (g, f) => boss(g, kind, 'idle', f) },
      { n: 4, draw: (g, f) => boss(g, kind, 'attack', f) },
      { n: 1, draw: (g) => boss(g, kind, 'idle', 0), white: true },
    ]);
  }

  // ---------- 結界門（48×64） ----------
  function gateSheet() {
    return sheet(48, 64, [{ n: 1, draw: (g) => {
      rc(g, '#5a3a22', 6, 8, 36, 56); rc(g, '#2a1810', 11, 14, 26, 50); rc(g, '#c8a040', 4, 4, 40, 5); rc(g, '#a02828', 8, 9, 32, 3);
      for (let i = 0; i < 3; i++) rc(g, '#7a4a2a', 11 + i * 9, 14, 2, 50);
      ell(g, '#ffe080', 24, 36, 5, 5); ell(g, '#fff6c0', 24, 36, 2, 2);          // 封印の光
      rc(g, '#c8a040', 6, 56, 36, 3);
    } }]);
  }

  // ---------- 背景（横256に継ぎ目なく並ぶ。draw は (g, x) で、x と x±256 に描いて端を回り込ませる） ----------
  function wrap(g, fn) { for (const o of [-256, 0, 256]) fn(o); }
  function sky(g, c0, c1, H) { const gr = g.createLinearGradient(0, 0, 0, H || 240); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, 256, 240); }
  function hash(n) { n = (n ^ 61) ^ (n >> 16); n = n + (n << 3); n = n ^ (n >> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >> 15); return (n >>> 0) / 4294967296; }
  const BG = {
    bamboo(g) {
      sky(g, '#0a1a10', '#1c3c28'); wrap(g, o => { for (let i = 0; i < 12; i++) { const x = o + i * 22 + hash(i) * 8, s = hash(i + 5); const col = s > 0.5 ? '#142e1e' : '#1c4028'; rc(g, col, x, 0, 4, 208); for (let y = 10; y < 208; y += 28 + (i % 3) * 6) rc(g, '#0c2014', x - 1, y, 6, 2); } });
      wrap(g, o => { for (let i = 0; i < 7; i++) { const x = o + i * 40 + 10 + hash(i + 20) * 12; rc(g, '#2a6a3a', x, 40, 5, 168); for (let y = 52; y < 208; y += 34) rc(g, '#184a28', x - 1, y, 7, 3); rc(g, '#3a8a4a', x + 3, 60, 8, 2); rc(g, '#3a8a4a', x - 6, 90, 8, 2); } });
      g.fillStyle = 'rgba(170,220,190,.10)'; g.fillRect(0, 150, 256, 58);
    },
    cedar(g) {
      sky(g, '#0a1620', '#20384a'); wrap(g, o => { tri(g, '#142838', o + 20, 190, 120, 90); tri(g, '#102030', o + 150, 190, 130, 110); });
      wrap(g, o => { for (let i = 0; i < 6; i++) { const x = o + i * 44 + hash(i) * 10; rc(g, '#2a2018', x + 9, 120, 6, 88); for (let k = 0; k < 5; k++) tri(g, k % 2 ? '#1a3a2a' : '#224a34', x - 4 + k * 2, 150 - k * 22, 32 - k * 4, 26); } });
    },
    grave(g) {
      sky(g, '#14101e', '#3a2a50'); ell(g, '#e8e0c8', 190, 54, 20, 20); ell(g, '#14101e', 198, 50, 17, 17);
      wrap(g, o => { for (let i = 0; i < 4; i++) { const x = o + i * 70 + 8; ln(g, '#1a1424', x, 208, x + 4, 120, 4); ln(g, '#1a1424', x + 3, 150, x + 18, 128, 2); ln(g, '#1a1424', x + 3, 138, x - 12, 118, 2); } });
      wrap(g, o => { for (let i = 0; i < 6; i++) { const x = o + i * 44 + 14, h = 24 + hash(i) * 14; rc(g, '#4a4060', x, 208 - h, 16, h); ell(g, '#4a4060', x + 8, 208 - h, 8, 5); rc(g, '#322a46', x + 6, 208 - h + 6, 4, 8); } });
      g.fillStyle = 'rgba(180,150,220,.10)'; g.fillRect(0, 170, 256, 38);
    },
    temple(g) {
      sky(g, '#1a0808', '#401818'); wrap(g, o => { rc(g, '#2a1010', o + 10, 80, 100, 128); tri(g, '#1a0808', o, 80, 120, 40); rc(g, '#401818', o + 24, 110, 72, 98); });
      wrap(g, o => { for (let i = 0; i < 4; i++) { const x = o + i * 64 + 6; rc(g, '#a02828', x, 60, 10, 148); rc(g, '#601818', x, 60, 3, 148); rc(g, '#701818', x - 4, 58, 18, 6); ell(g, '#ffb040', x + 5, 100, 5, 7); rc(g, '#3a1010', x + 4, 90, 2, 4); } });
    },
    volcano(g) {
      sky(g, '#2a0800', '#8a3008'); wrap(g, o => { tri(g, '#3a1008', o + 10, 208, 150, 120); tri(g, '#2a0a04', o + 120, 208, 130, 90); rc(g, '#ff7020', o + 74, 92, 8, 14); rc(g, '#ffb040', o + 76, 88, 4, 8); });
      wrap(g, o => { for (let i = 0; i < 9; i++) { const x = o + i * 30 + hash(i) * 10; rc(g, '#ff9030', x, 120 + hash(i + 9) * 70, 2, 2); } });
      g.fillStyle = 'rgba(255,100,20,.18)'; g.fillRect(0, 170, 256, 38);
    },
    cave(g) {
      sky(g, '#06101a', '#14304a'); wrap(g, o => { for (let i = 0; i < 9; i++) { const x = o + i * 30 + hash(i) * 8, h = 20 + hash(i + 3) * 40; tri(g, '#0c1c2c', x, 0 + h, 12, h); } });
      wrap(g, o => { for (let i = 0; i < 6; i++) { const x = o + i * 46 + 6, h = 18 + hash(i + 7) * 30; tri(g, '#1a3a52', x, 208, 18, h); rc(g, '#4a8ab0', x + 8, 208 - h, 2, 3); } });
      g.fillStyle = 'rgba(80,160,220,.08)'; g.fillRect(0, 120, 256, 88);
    },
    ice(g) {
      sky(g, '#0a1830', '#3a5a8a'); wrap(g, o => { tri(g, '#7aa8d0', o + 10, 208, 120, 110); tri(g, '#e8f4ff', o + 44, 140, 50, 40); tri(g, '#5a88b8', o + 130, 208, 120, 80); tri(g, '#d8ecff', o + 156, 160, 44, 28); });
      wrap(g, o => { for (let i = 0; i < 14; i++) rc(g, '#e8f4ff', o + i * 19 + hash(i) * 8, 20 + hash(i + 4) * 150, 2, 2); });
    },
    tower(g) {
      sky(g, '#101028', '#28285a'); wrap(g, o => { for (let i = 0; i < 4; i++) { const x = o + i * 64 + 6; rc(g, '#1c1c3c', x, 0, 36, 208); for (let y = 12; y < 200; y += 24) { rc(g, '#3a3a6a', x + 4, y, 10, 14); rc(g, '#ffd070', x + 6, y + 3, 6, 8); rc(g, '#3a3a6a', x + 22, y, 10, 14); } rc(g, '#14142c', x - 3, 0, 4, 208); } });
    },
    swamp(g) {
      sky(g, '#0c1a08', '#2e4018'); wrap(g, o => { for (let i = 0; i < 5; i++) { const x = o + i * 52 + 10; ln(g, '#14200c', x, 208, x + 3, 80, 5); ln(g, '#14200c', x + 3, 130, x + 20, 100, 3); ln(g, '#14200c', x + 3, 110, x - 14, 90, 3); } });
      wrap(g, o => { for (let i = 0; i < 4; i++) { rc(g, '#ffe060', o + 30 + i * 60, 150 + hash(i) * 20, 2, 2); rc(g, '#ffe060', o + 36 + i * 60, 150 + hash(i) * 20, 2, 2); } });
      g.fillStyle = 'rgba(140,190,90,.12)'; g.fillRect(0, 150, 256, 58);
    },
    wall(g) {
      sky(g, '#18101a', '#3a2a3a'); for (let y = 0; y < 208; y += 16) for (let x = 0; x < 256; x += 32) { const o = (y / 16) % 2 ? 16 : 0; rc(g, '#4a3a4a', (x + o) % 256, y, 31, 15); rc(g, '#5a4a5a', (x + o) % 256, y, 31, 2); rc(g, '#2a1e2a', (x + o) % 256, y + 14, 31, 2); }
      wrap(g, o => { for (let i = 0; i < 2; i++) { const x = o + i * 128 + 40; rc(g, '#a02828', x, 30, 24, 70); rc(g, '#e0c050', x + 10, 30, 4, 70); tri(g, '#a02828', x, 130, 24, 30); } });
    },
    stone(g) {
      sky(g, '#141414', '#34343a'); for (let y = 0; y < 208; y += 24) for (let x = 0; x < 256; x += 48) { const o = (y / 24) % 2 ? 24 : 0; rc(g, '#4a4a54', (x + o) % 256, y, 47, 23); rc(g, '#62626e', (x + o) % 256, y, 47, 2); rc(g, '#26262e', (x + o) % 256, y + 22, 47, 2); rc(g, '#34343c', ((x + o) % 256) + 10, y + 8, 6, 3); }
    },
    castle(g) {
      sky(g, '#1a0a18', '#402038'); wrap(g, o => { for (let i = 0; i < 4; i++) { const x = o + i * 64; rc(g, '#d8c8a0', x + 4, 40, 56, 150); rc(g, '#7a3a28', x + 4, 40, 56, 6); rc(g, '#7a3a28', x + 4, 184, 56, 6); rc(g, '#a89870', x + 30, 46, 2, 138); for (let k = 0; k < 2; k++) rc(g, '#5a3a28', x + 10 + k * 28, 80, 22, 70); ell(g, '#ffb040', x + 32, 56, 4, 5); } });
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 256, 208);
    },
    under(g) {
      sky(g, '#050008', '#2a0a40'); ell(g, '#8a1020', 70, 60, 30, 30); ell(g, '#5a0a18', 78, 56, 26, 26);
      wrap(g, o => { for (let i = 0; i < 5; i++) { const x = o + i * 52 + 8; for (let k = 0; k < 9; k++) { ln(g, '#b8aa98', x + k * 4, 208, x + k * 4 + 2, 120 - Math.abs(k - 4) * 6, 3); } } });
      wrap(g, o => { for (let i = 0; i < 8; i++) { const x = o + i * 33 + 6, y = 110 + hash(i) * 70; tri(g, '#5ad8ff', x, y + 12, 6, 12); tri(g, '#b0f0ff', x + 1, y + 10, 4, 7); } });
    },
    dojo(g) {
      sky(g, '#1a1a24', '#34343e'); for (let x = 0; x < 256; x += 32) { rc(g, '#4a3a28', x, 0, 4, 208); rc(g, '#2a2018', x + 4, 0, 2, 208); } for (let y = 40; y < 200; y += 40) rc(g, '#3a2e20', 0, y, 256, 3);
      wrap(g, o => { for (let i = 0; i < 3; i++) { rc(g, '#e8dcc0', o + i * 90 + 20, 60, 50, 90); rc(g, '#c8b898', o + i * 90 + 44, 60, 2, 90); } });
    },
    hub(g) { sky(g, '#0a0a18', '#26264a'); for (let i = 0; i < 40; i++) rc(g, '#e8e8ff', hash(i) * 256, hash(i + 90) * 190, 1, 1); wrap(g, o => { ell(g, '#2a2a4a', o + 60, 150, 50, 14); ell(g, '#2a2a4a', o + 190, 120, 40, 10); }); },
    heaven(g) { sky(g, '#3a3a70', '#e8d8b8'); wrap(g, o => { ell(g, '#ffffff', o + 40, 120, 40, 12); ell(g, '#f4ecff', o + 120, 80, 34, 10); ell(g, '#ffffff', o + 200, 140, 44, 13); ell(g, '#fff0c0', o + 80, 170, 50, 14); }); for (let i = 0; i < 4; i++) rc(g, 'rgba(255,240,180,.18)', 30 + i * 60, 0, 20, 208); },
    hell(g) { sky(g, '#1a0000', '#5a1008'); wrap(g, o => { for (let i = 0; i < 6; i++) { const x = o + i * 44, h = 30 + hash(i) * 50; tri(g, '#2a0606', x, 208, 26, h); } for (let i = 0; i < 7; i++) { tri(g, '#ff7020', o + i * 38 + 6, 208, 8, 14 + hash(i + 4) * 14); } }); g.fillStyle = 'rgba(255,60,0,.16)'; g.fillRect(0, 150, 256, 58); },
  };
  const BG_MAP = { stage_r1s1: 'bamboo', stage_r1s2: 'cedar', stage_r1s3: 'grave', stage_r1s4: 'temple', stage_r2s1: 'volcano', stage_r2s2: 'cave', stage_r2s3: 'ice', stage_r2s4: 'tower', stage_r3s1: 'swamp', stage_r3s2: 'wall', stage_r3s3: 'stone', stage_r3s4: 'castle', stage_r4s1: 'under', training: 'dojo', gate_hub: 'hub', gate_heaven: 'heaven', gate_hell: 'hell' };
  function bgImage(name) { const t = cv(256, 240); BG[name](t.g); return t.c; }
  function titleImage() {
    const t = cv(256, 240), g = t.g; sky(g, '#06041a', '#401030', 240);
    ell(g, '#f0e0c0', 188, 70, 26, 26); ell(g, '#401030', 198, 64, 22, 22);
    for (let i = 0; i < 50; i++) rc(g, '#fff0e0', hash(i) * 256, hash(i + 70) * 120, 1, 1);
    tri(g, '#1a0c2c', 0, 200, 150, 80); tri(g, '#120820', 110, 210, 170, 100); tri(g, '#241038', 60, 215, 130, 60);
    ln(g, '#0a0614', 0, 215, 256, 215, 40);
    for (let i = 0; i < 9; i++) { const x = 14 + i * 28; rc(g, '#0a0614', x, 190, 3, 30); tri(g, '#0a0614', x - 6, 196, 15, 20); }
    return t.c;
  }

  // ---------- 取り込み ----------
  K.installPixelArt = function (assets) {
    const put = (key, canvas) => {
      const d = assets.def(key); if (!d || d.src) return;                  // 実画像が指定されていればそちらを優先
      assets.images[key] = canvas; assets.status[key] = 'generated';
    };
    put('player', playerSheet());
    put('enemy_plain', gruntSheet('plain', 24, 24)); put('enemy_ember', gruntSheet('ember', 24, 24)); put('enemy_frost', gruntSheet('frost', 24, 24));
    put('enemy_knight', gruntSheet('knight', 24, 32)); put('enemy_ghoul', gruntSheet('ghoul', 24, 28)); put('enemy_naga', gruntSheet('naga', 24, 24));
    put('enemy_bat', batSheet());
    put('gate', gateSheet());
    const kinds = { r1s1: 'oni', r1s2: 'monk', r1s3: 'guardian', r1s4: 'sorcerer', r2s1: 'flame', r2s2: 'wraith', r2s3: 'yuki', r2s4: 'tengu', r3s1: 'swordsman', r3s2: 'samurai', r3s3: 'armor', r3s4: 'matron', r4s1: 'overlord' };
    for (const id in kinds) put('boss_' + id, bossSheet(kinds[id]));
    for (const key in BG_MAP) put(key, bgImage(BG_MAP[key]));
    put('title', titleImage());
  };
})(window.KOMA);
