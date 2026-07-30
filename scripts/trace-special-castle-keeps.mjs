#!/usr/bin/env node
/**
 * trace-special-castle-keeps.mjs
 * 特別城(castleType==='special')の天守ヘックス SPECIAL_CASTLE_KEEP_HEX を目視でトレース／検証する道具。
 *
 * 特別城は城ごとに専用の攻城バックドロップを持ち、天守閣の描かれている位置が画像ごとに違う。
 * sengoku.html はその天守ヘックスを中心に城郭（本丸石垣→二の丸城壁→外堀）を組み立てるため、
 * 天守の位置がずれると天守マーカーが絵の天守閣から外れる。
 *
 * 使い方: node scripts/trace-special-castle-keeps.mjs [出力先.html]
 *   sengoku.html から画像パスと現在の SPECIAL_CASTLE_KEEP_HEX を読み取り、
 *   各バックドロップへゲームと同じヘックス幾何を重ねた検証用HTMLを書き出す。
 *   ブラウザで開くと 現在の天守ヘックス（赤マーカー）が絵の天守閣に載っているかを一覧確認でき、
 *   ヘックスをクリックすると (col,row) と貼り付け用の1行が表示される。
 * 依存: なし（出力HTMLがブラウザのCanvasで描画する）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(process.argv[2] || 'special-castle-keeps.html');
const src = fs.readFileSync(path.join(ROOT, 'sengoku.html'), 'utf8');

const block = (re, label) => {
  const m = src.match(re);
  if (!m) throw new Error(`sengoku.html から ${label} を読み取れない（定義名が変わった可能性）`);
  return m[1];
};
// 城名 → 画像キー
const nameToKey = {};
for (const m of block(/const SPECIAL_CASTLE_IMAGE_BY_NAME = \{([\s\S]*?)\n\};/, 'SPECIAL_CASTLE_IMAGE_BY_NAME')
  .matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) {
  nameToKey[JSON.parse('"' + m[1] + '"')] = m[2];
}
// 画像キー → ファイルパス（ASSETS の siege* 定義から拾う）
const keyToFile = {};
for (const m of src.matchAll(/(siege[A-Za-z]+):\s*'(assets\/[^']+)'/g)) keyToFile[m[1]] = m[2];
// 画像キー → 現在の天守ヘックス
const keeps = {};
for (const m of block(/const SPECIAL_CASTLE_KEEP_HEX = \{([\s\S]*?)\n\};/, 'SPECIAL_CASTLE_KEEP_HEX')
  .matchAll(/(siege[A-Za-z]+)\s*:\s*\[(\d+)\s*,\s*(\d+)\]/g)) {
  keeps[m[1]] = [Number(m[2]), Number(m[3])];
}

const rows = [];
const missing = [];
for (const [name, key] of Object.entries(nameToKey)) {
  if (!keyToFile[key]) { missing.push(`${name}(${key}): 画像パス未定義`); continue; }
  if (!keeps[key]) { missing.push(`${name}(${key}): SPECIAL_CASTLE_KEEP_HEX 未登録`); continue; }
  rows.push({ name, key, file: keyToFile[key], keep: keeps[key] });
}

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>特別城 天守ヘックス トレース / Special Castle Keep Hex Trace</title>
<style>
  body{margin:0;background:#05070d;color:#e6edf7;font-family:system-ui,"Noto Sans JP",sans-serif}
  h1{font-size:18px;padding:14px 18px;margin:0;border-bottom:1px solid rgba(148,163,184,.25)}
  .hint{padding:10px 18px;font-size:13px;color:#94a3b8;line-height:1.7}
  .card{padding:18px;border-bottom:1px solid rgba(148,163,184,.15)}
  .cap{font-size:15px;margin:0 0 8px;color:#7dd3fc}
  canvas{width:100%;max-width:1280px;height:auto;display:block;cursor:crosshair}
  code{background:rgba(148,163,184,.15);padding:2px 6px;border-radius:4px}
  .warn{color:#fca5a5;padding:0 18px}
</style></head><body>
<h1>特別城 天守ヘックス トレース / Special Castle Keep Hex Trace</h1>
<p class="hint">赤いマーカー＝sengoku.html の <code>SPECIAL_CASTLE_KEEP_HEX</code> に登録されている天守ヘックス。
絵の天守閣（天守を持たない山城・館は主郭の中心建物）に載っていれば正しい。<br>
ずれていたらヘックスをクリック → 表示された1行を <code>SPECIAL_CASTLE_KEEP_HEX</code> に反映する。<br>
Red marker = the keep hex registered in sengoku.html. Click a hex to get the replacement line.</p>
${missing.length ? `<p class="warn">未処理: ${missing.map(s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join(' / ')}</p>` : ''}
<div id="list"></div>
<script>
// sengoku.html と同じ設計キャンバス／ヘックス幾何（HEX_DESIGN と一致させること）
const W=2560, H=1440;
const D={w:2560,h:2080,size:68,ox:300,oy:250};
const FIT=Math.min(W/D.w, H/D.h);
const HEX={size:D.size*FIT, cols:17, rows:15,
  ox:(W-D.w*FIT)/2 + D.ox*FIT, oy:(H-D.h*FIT)/2 + D.oy*FIT};
const hexCenter=(c,r)=>[HEX.ox+HEX.size*Math.sqrt(3)*(c+0.5*(r&1)), HEX.oy+HEX.size*1.5*r];
const CASTLES=${JSON.stringify(rows, null, 0)};

function hexPath(ctx,x,y,s){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=Math.PI/180*(60*i-90), px=x+s*Math.cos(a), py=y+s*Math.sin(a);
    i?ctx.lineTo(px,py):ctx.moveTo(px,py);
  }
  ctx.closePath();
}
function nearestHex(x,y){
  let best=null,bd=Infinity;
  for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++){
    const [hx,hy]=hexCenter(c,r), d=(hx-x)**2+(hy-y)**2;
    if(d<bd){bd=d;best=[c,r];}
  }
  return best;
}
const list=document.getElementById('list');
for(const cas of CASTLES){
  const card=document.createElement('div'); card.className='card';
  const cap=document.createElement('p'); cap.className='cap';
  cap.textContent=cas.name+' — '+cas.key+' : ['+cas.keep.join(',')+']';
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  card.append(cap,cv); list.append(card);
  const ctx=cv.getContext('2d');
  const img=new Image(); img.src=cas.file;
  const draw=()=>{
    // 本編と同じ cover 配置
    const sc=Math.max(W/img.naturalWidth, H/img.naturalHeight);
    const sw=W/sc, sh=H/sc;
    ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,0,0,W,H);
    ctx.lineWidth=2; ctx.font='20px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++){
      const [x,y]=hexCenter(c,r);
      hexPath(ctx,x,y,HEX.size);
      ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.stroke();
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(x-26,y-12,52,24);
      ctx.fillStyle='#ffe36e'; ctx.fillText(c+','+r,x,y);
    }
    const [kx,ky]=hexCenter(cas.keep[0],cas.keep[1]);
    hexPath(ctx,kx,ky,HEX.size);
    ctx.fillStyle='rgba(255,40,40,0.35)'; ctx.fill();
    ctx.lineWidth=8; ctx.strokeStyle='#ff2b2b'; ctx.stroke();
  };
  img.onload=draw;
  img.onerror=()=>{ ctx.fillStyle='#301018'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fca5a5'; ctx.font='40px sans-serif'; ctx.textAlign='center';
    ctx.fillText('画像が読めない: '+cas.file, W/2, H/2); };
  cv.addEventListener('click', e=>{
    const b=cv.getBoundingClientRect();
    const [c,r]=nearestHex((e.clientX-b.left)*W/b.width,(e.clientY-b.top)*H/b.height);
    cas.keep=[c,r];
    cap.textContent=cas.name+' — '+cas.key+':['+c+','+r+'], ← この1行を SPECIAL_CASTLE_KEEP_HEX に反映';
    if(img.complete&&img.naturalWidth) draw();
  });
}
</script></body></html>
`;
fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${rows.length} castles${missing.length ? `, ${missing.length} skipped` : ''})`);
if (missing.length) { for (const m of missing) console.log('  skipped:', m); process.exitCode = 1; }
