#!/usr/bin/env node
/**
 * trace-castle-layout.mjs
 * 攻城バックドロップ（城タイプ別4種＋城別35種）の上でヘックスの「侵入可否」を目視トレースする道具。
 *
 * なぜ手動トレースなのか:
 *   これらの背景は写実的な俯瞰CGで、水堀・石垣・曲輪・遠景の水田の色差が非常に小さい。
 *   手トレース済み4城を正解データとして自動分類を実測したところ、
 *     ・しきい値方式（色＋粗さ）… 水堀の適合率46% / 再現率48%、城ごとの一致率55〜73%
 *       （全マス「侵入出来る」と答えるだけで73%になるので、基準値と同等以下）
 *     ・画像適応の領域成長法 … F1 0.22
 *   実測値は 水堀 blue=+1.0 / 石垣 −9.5 / 遠景の水田 −3.0、粗さはいずれも8〜10で重なる。
 *   油彩調で色差の大きい野戦（trace-battlefield-hexes.mjs）と違い、攻城は目視トレースが要る。
 *
 * 使い方:
 *   node scripts/trace-castle-layout.mjs --serve   … ページを生成し、そのまま開けるURLを表示する
 *     表示されたURL（既定 http://127.0.0.1:8787/castle-layout-trace.html）をブラウザで開く。
 *     --serve を付けない場合はリポジトリ直下に castle-layout-trace.html を出すだけなので、
 *     ファイルをブラウザへドラッグ（file://）して開いてもよい。どちらでも背景画像は表示される
 *   ページ上での操作:
 *     パレットで種別を選び、ヘックスをクリックして塗る。右クリックで「侵入出来る」に戻す
 *     編集内容はブラウザに自動保存されるので、何回かに分けて進めてよい
 *     城ごとに「閉じている・落城可能」を即時判定して表示する（赤＝要修正が出たら直す）
 *   仕上げ:
 *     上部の「全城まとめてJSONを保存」でファイルを落とす
 *     node scripts/apply-castle-layouts.mjs <落としたJSON>   … sengoku.html へ反映
 *     node scripts/verify-castle-layouts.mjs                  … 全39城を機械検査
 * 依存: なし（出力HTMLがブラウザのCanvasで描画する）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// 出力先はフラグ以外の最初の引数。--serve のポート番号を出力先と取り違えないよう除く
const argv = process.argv.slice(2);
const serveAt = argv.indexOf('--serve');
const positional = argv.filter((a, i) => !a.startsWith('--') && !(serveAt >= 0 && i === serveAt + 1 && /^\d+$/.test(a)));
const OUT = path.resolve(positional[0] || path.join(ROOT, 'castle-layout-trace.html'));
const src = fs.readFileSync(path.join(ROOT, 'sengoku.html'), 'utf8');

// sengoku.html 内のオブジェクトリテラルをそのまま値として取り出す（自リポジトリのファイルのみ対象）
function literal(name, re) {
  const m = src.match(re);
  if (!m) throw new Error(`sengoku.html から ${name} を読み取れない（定義名が変わった可能性）`);
  return new Function('return ' + m[1])();
}
const CASTLE_HEX_LAYOUTS = literal('CASTLE_HEX_LAYOUTS', /const CASTLE_HEX_LAYOUTS = (\{[\s\S]*?\n\});/);
const TRACED = literal('CASTLE_TRACED_LAYOUTS', /const CASTLE_TRACED_LAYOUTS = (\{[\s\S]*?\n\});/);
const KEEPS = literal('SPECIAL_CASTLE_KEEP_HEX', /const SPECIAL_CASTLE_KEEP_HEX = (\{[\s\S]*?\n\});/);
const RINGS = literal('SPECIAL_CASTLE_RINGS', /const SPECIAL_CASTLE_RINGS = (\[[\s\S]*?\n\]);/);

const nameByKey = {};
for (const m of src.matchAll(/'([^']+)'\s*:\s*'(siege[A-Za-z]+)'/g)) nameByKey[m[2]] = JSON.parse('"' + m[1] + '"');
const fileByKey = {};
for (const m of src.matchAll(/(siege[A-Za-z]+):\s*'(assets\/[^']+)'/g)) fileByKey[m[1]] = m[2];

// 城タイプ別4種は CASTLE_HEX_LAYOUTS、特別城35種は トレース済み→無ければ生成リング を初期値にする
const castles = [];
for (const [type, key] of [['hirajiro', 'siegeHirajiro'], ['yamajiro', 'siegeYamajiro'],
  ['hirayamajiro', 'siegeHirayamajiro'], ['umajiro', 'siegeUmajiro']]) {
  if (fileByKey[key]) castles.push({ id: key, label: `城タイプ: ${type}`, file: fileByKey[key], layout: CASTLE_HEX_LAYOUTS[type], done: true });
}
for (const [key, keep] of Object.entries(KEEPS)) {
  if (!fileByKey[key]) continue;
  castles.push({ id: key, label: nameByKey[key] || key, file: fileByKey[key], keep, layout: TRACED[key] || null, done: !!TRACED[key] });
}

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>攻城ヘックス 侵入可否トレース / Castle Hex Passability Trace</title>
<style>
 body{margin:0;background:#05070d;color:#e6edf7;font-family:system-ui,"Noto Sans JP",sans-serif}
 header{position:sticky;top:0;z-index:9;background:rgba(5,7,13,.97);border-bottom:1px solid rgba(148,163,184,.25);padding:10px 16px}
 h1{font-size:16px;margin:0 0 8px}
 .row{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
 button{background:rgba(148,163,184,.12);color:#e6edf7;border:2px solid transparent;border-radius:8px;padding:6px 11px;font-size:13px;cursor:pointer}
 button:hover{background:rgba(148,163,184,.2)}
 .pal button.on{border-color:#67e8f9;background:rgba(103,232,249,.16)}
 .act button{border-color:rgba(148,163,184,.3)}
 .hint{font-size:12px;color:#94a3b8;margin:7px 0 0;line-height:1.6}
 .card{padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.15)}
 .cap{font-size:15px;color:#7dd3fc;margin:0 0 7px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
 .chk{font-size:12px;padding:3px 8px;border-radius:6px}
 .ok{background:rgba(74,222,128,.16);color:#86efac}
 .ng{background:rgba(248,113,113,.16);color:#fca5a5}
 .warn{background:rgba(251,191,36,.16);color:#fcd34d}
 canvas{width:100%;max-width:1280px;height:auto;display:block;cursor:crosshair;touch-action:none}
 pre{white-space:pre-wrap;background:rgba(148,163,184,.1);padding:9px;border-radius:8px;font-size:12px;max-height:220px;overflow:auto}
 #prog{font-size:12px;color:#cbd5e1}
</style></head><body>
<header>
 <h1>攻城ヘックス 侵入可否トレース / Castle Hex Passability Trace</h1>
 <div class="row pal" id="pal"></div>
 <div class="row act" style="margin-top:8px">
   <button id="save">全城まとめてJSONを保存</button>
   <button id="clearAll">保存した編集を全部捨てる</button>
   <span id="prog"></span>
 </div>
 <p class="hint">種別を選んでヘックスをクリックして塗る。右クリックで「侵入出来る」に戻す。編集はブラウザに自動保存される。<br>
 枠の意味はゲーム内と同じ: <b style="color:#82c6ec">水色二重＝侵入出来ない</b> /
 <b style="color:#e2b260">橙＝破壊すれば侵入出来る</b> / 細白＝侵入出来る。<br>
 保存したJSONは <code>node scripts/apply-castle-layouts.mjs &lt;JSON&gt;</code> で sengoku.html へ反映し、
 <code>node scripts/verify-castle-layouts.mjs</code> で検査する。</p>
</header>
<div id="list"></div>
<script>
const W=2560,H=1440;
const D={w:2560,h:2080,size:68,ox:300,oy:250};
const FIT=Math.min(W/D.w,H/D.h);
const HEX={size:D.size*FIT,cols:17,rows:15,ox:(W-D.w*FIT)/2+D.ox*FIT,oy:(H-D.h*FIT)/2+D.oy*FIT};
const hexCenter=(c,r)=>[HEX.ox+HEX.size*Math.sqrt(3)*(c+0.5*(r&1)),HEX.oy+HEX.size*1.5*r];
const cube=(c,r)=>{const x=c-((r-(r&1))/2);return [x,-x-r,r];};
const hexDist=(a,b,c,d)=>{const p=cube(a,b),q=cube(c,d);
  return (Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2]))/2;};
function hexNeighbors(col,row){
  const even=(row%2)===0;
  const d=even?[[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]]:[[1,0],[-1,0],[1,-1],[0,-1],[1,1],[0,1]];
  return d.map(([dc,dr])=>[col+dc,row+dr]).filter(([c,r])=>c>=0&&c<HEX.cols&&r>=0&&r<HEX.rows);
}
// 侵入可否3分類（sengoku.html の CASTLE_PASSABILITY と同じ定義に保つこと）
const PASS={moat:'blocked',gate:'breakable',palisade:'breakable',wall:'breakable',
  stonewall:'breakable',earthwork:'breakable',yagura:'breakable',drymoat:'open',keep:'open'};
const KINDS=[
 ['',          '侵入出来る（曲輪・通路・馬出）'],
 ['drymoat',   '空堀'],['keep','天守'],['moat','水堀'],
 ['stonewall','石垣'],['wall','城壁'],['earthwork','土塁'],
 ['palisade','柵'],['gate','城門'],['yagura','櫓'],
];
const FILL={moat:'rgba(24,72,116,0.35)',drymoat:'rgba(120,96,58,0.30)',stonewall:'rgba(96,92,86,0.5)',
 wall:'rgba(80,86,96,0.5)',earthwork:'rgba(120,96,56,0.4)',gate:'rgba(74,52,30,0.5)',
 palisade:'rgba(120,84,44,0.4)',yagura:'rgba(120,84,44,0.5)',keep:'rgba(226,178,96,0.35)'};
const CASTLES=${JSON.stringify(castles)};
const RINGS=${JSON.stringify(RINGS)};
const LS='sengoku-castle-trace-v1';

// ---- 侵入可否の即時判定（sengoku.html の検査と同じ内容）----
function reachable(cells,breakAll){
  const blocked=(c,r)=>{const k=cells[c+','+r]; if(!k) return false;
    const p=PASS[k]||'open'; return breakAll? p==='blocked' : p!=='open';};
  const seen={},q=[];
  for(let c=0;c<HEX.cols;c++)for(const r of [HEX.rows-1,HEX.rows-2]){
    const k=c+','+r; if(!blocked(c,r)&&!seen[k]){seen[k]=1;q.push([c,r]);}}
  for(let i=0;i<q.length;i++)for(const [nc,nr] of hexNeighbors(q[i][0],q[i][1])){
    const k=nc+','+nr; if(seen[k]||blocked(nc,nr))continue; seen[k]=1;q.push([nc,nr]);}
  return seen;
}
// sengoku.html の ensureKeepSealed と同じ補修（天守が開いていれば本丸石垣＋虎口を足す）
function sealed(cells){
  const keeps=Object.keys(cells).filter(k=>cells[k]==='keep');
  if(keeps.length!==1) return null;
  const [kc,kr]=keeps[0].split(',').map(Number);
  const copy={...cells};
  const ring=hexNeighbors(kc,kr).filter(([c,r])=>!copy[c+','+r]);
  if(!ring.length) return copy;
  let open=0;
  for(let i=1;i<ring.length;i++){const a=ring[i],b=ring[open];
    if(a[1]>b[1]||(a[1]===b[1]&&Math.abs(a[0]-kc)<Math.abs(b[0]-kc)))open=i;}
  ring.forEach((cell,i)=>{copy[cell[0]+','+cell[1]]=(i===open?'gate':'stonewall');});
  return copy;
}
// 判定はまず「塗ったそのまま」で行う。素で成立していれば ok。
// 素では天守が開いているが、ゲーム側の自動補修（本丸石垣＋虎口）で閉じるなら注意止まり。
function checkCells(cells){
  const keeps=Object.keys(cells).filter(k=>cells[k]==='keep');
  if(keeps.length!==1) return {level:'ng',msgs:['天守が'+keeps.length+'マス（1マスにする）']};
  const kk=keeps[0], msgs=[];
  const openRaw=!!reachable(cells,false)[kk];
  const canFall=!!reachable(cells,true)[kk];
  if(!canFall) msgs.push('全部壊しても天守へ行けない（落城不能）');
  if(!openRaw && !msgs.length) return {level:'ok',msgs:[]};
  if(openRaw){
    const fixed=sealed(cells);
    if(fixed && !reachable(fixed,false)[kk] && reachable(fixed,true)[kk]){
      msgs.push('本丸が塞がっていない（ゲーム側が石垣＋虎口を自動で足して救済する）');
      return {level:msgs.length>1?'ng':'warn',msgs};
    }
    msgs.push('無傷のまま天守へ行ける（防衛線が開いている）');
  }
  return {level:'ng',msgs};
}
// 特別城の暫定レイアウト＝天守中心の同心リング（sengoku.html の buildSpecialCastleLayout と同じ）
function ringLayout(keep){
  const [kc,kr]=keep,cells={};
  for(const ring of RINGS){
    const list=[];
    for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++)
      if(hexDist(c,r,kc,kr)===ring.dist) list.push([c,r]);
    if(!list.length)continue;
    let open=0;
    for(let i=1;i<list.length;i++){const a=list[i],b=list[open];
      if(a[1]>b[1]||(a[1]===b[1]&&Math.abs(a[0]-kc)<Math.abs(b[0]-kc)))open=i;}
    list.forEach(([c,r],i)=>{cells[c+','+r]=(i===open?ring.opening:ring.kind);});
  }
  cells[kc+','+kr]='keep';
  return cells;
}
function fromLayout(l){const cells={};for(const k in l)for(const [c,r] of l[k])cells[c+','+r]=k;return cells;}
const saved=JSON.parse(localStorage.getItem(LS)||'{}');

let cur='moat';
const pal=document.getElementById('pal');
for(const [k,label] of KINDS){
  const b=document.createElement('button'); b.textContent=label; b.dataset.k=k;
  b.onclick=()=>{cur=k;[...pal.children].forEach(x=>x.classList.toggle('on',x.dataset.k===k));};
  pal.append(b);
}
[...pal.children].find(x=>x.dataset.k===cur).classList.add('on');

const state={};   // id -> cells
const touched={}; // id -> 編集済みか
function persist(){
  const out={};
  for(const id in state) if(touched[id]) out[id]=state[id];
  localStorage.setItem(LS,JSON.stringify(out));
  const n=Object.keys(out).length;
  document.getElementById('prog').textContent='編集済み '+n+' / '+CASTLES.length+' 城';
}

const list=document.getElementById('list');
for(const cas of CASTLES){
  const base=cas.layout?fromLayout(cas.layout):ringLayout(cas.keep);
  const cells=saved[cas.id]?{...saved[cas.id]}:base;
  state[cas.id]=cells; if(saved[cas.id]) touched[cas.id]=true;

  const card=document.createElement('div'); card.className='card';
  const cap=document.createElement('p'); cap.className='cap';
  const title=document.createElement('span'); title.textContent=cas.label+' — '+cas.id;
  const chk=document.createElement('span'); chk.className='chk';
  const outBtn=document.createElement('button'); outBtn.textContent='この城のJSを表示';
  const resetBtn=document.createElement('button'); resetBtn.textContent='初期状態へ戻す';
  cap.append(title,chk,outBtn,resetBtn);
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const out=document.createElement('pre'); out.hidden=true;
  card.append(cap,cv,out); list.append(card);

  const ctx=cv.getContext('2d');
  const img=new Image(); img.src=cas.file;
  const hexPath=(x,y)=>{ctx.beginPath();
    for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-90),px=x+HEX.size*Math.cos(a),py=y+HEX.size*Math.sin(a);
      i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
    ctx.closePath();};
  const refreshCheck=()=>{
    const {level,msgs}=checkCells(cells);
    chk.className='chk '+level;
    chk.textContent = level==='ok' ? '閉じている・落城可能'
      : level==='warn' ? ('注意: '+msgs.join(' / '))
      : ('要修正: '+msgs.join(' / '));
  };
  const draw=()=>{
    if(img.complete&&img.naturalWidth){
      const sc=Math.max(W/img.naturalWidth,H/img.naturalHeight),sw=W/sc,sh=H/sc;
      ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,0,0,W,H);
    }
    for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++){
      const [x,y]=hexCenter(c,r),kind=cells[c+','+r]||'';
      hexPath(x,y);
      if(FILL[kind]){ctx.fillStyle=FILL[kind];ctx.fill();}
      const pass=PASS[kind]||'open';
      ctx.lineWidth=3;ctx.strokeStyle='rgba(8,12,20,0.34)';ctx.stroke();
      if(pass==='blocked'){ctx.lineWidth=4.5;ctx.strokeStyle='rgba(130,198,236,0.92)';ctx.stroke();}
      else if(pass==='breakable'){ctx.lineWidth=4.5;ctx.strokeStyle='rgba(226,178,96,0.92)';ctx.stroke();}
      else {ctx.lineWidth=1.2;ctx.strokeStyle='rgba(233,240,250,0.34)';ctx.stroke();}
      if(kind==='keep'){ctx.lineWidth=4;ctx.strokeStyle='rgba(242,200,121,0.95)';ctx.stroke();}
    }
    refreshCheck();
  };
  img.onload=draw;
  img.onerror=()=>{ctx.fillStyle='#301018';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fca5a5';
    ctx.font='40px sans-serif';ctx.textAlign='center';ctx.fillText('画像が読めない: '+cas.file,W/2,H/2);};
  draw();

  const pick=e=>{
    const b=cv.getBoundingClientRect();
    const px=(e.clientX-b.left)*W/b.width,py=(e.clientY-b.top)*H/b.height;
    let best=null,bd=Infinity;
    for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++){
      const [x,y]=hexCenter(c,r),d=(x-px)**2+(y-py)**2; if(d<bd){bd=d;best=[c,r];}}
    return best;
  };
  const edit=(c,r,kind)=>{
    if(kind) cells[c+','+r]=kind; else delete cells[c+','+r];
    touched[cas.id]=true; persist(); draw();
  };
  cv.addEventListener('click',e=>{const [c,r]=pick(e); edit(c,r,cur);});
  cv.addEventListener('contextmenu',e=>{e.preventDefault();const [c,r]=pick(e); edit(c,r,'');});
  resetBtn.onclick=()=>{for(const k in cells)delete cells[k];Object.assign(cells,base);
    delete touched[cas.id];persist();draw();};
  outBtn.onclick=()=>{out.hidden=!out.hidden; out.textContent=blockFor(cas.id);};
}
persist();

function blockFor(id){
  const cells=state[id],by={};
  for(const k in cells){const [c,r]=k.split(',').map(Number);(by[cells[k]]||(by[cells[k]]=[])).push([c,r]);}
  for(const k in by) by[k].sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const order=['keep','gate','yagura','palisade','wall','stonewall','earthwork','drymoat','moat'];
  const lines=['  '+id+': {'];
  for(const k of order){ if(!by[k])continue;
    lines.push('    '+k+': ['+by[k].map(([c,r])=>'['+c+','+r+']').join(',')+'],'); }
  lines.push('  },');
  return lines.join('\\n');
}
document.getElementById('save').onclick=()=>{
  const out={};
  for(const id in state){
    if(!touched[id])continue;
    const cells=state[id],by={};
    for(const k in cells){const [c,r]=k.split(',').map(Number);(by[cells[k]]||(by[cells[k]]=[])).push([c,r]);}
    for(const k in by) by[k].sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    out[id]=by;
  }
  const blob=new Blob([JSON.stringify(out,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='castle-layouts.json'; a.click();
};
document.getElementById('clearAll').onclick=()=>{
  if(!confirm('保存した編集を全部捨てて初期状態に戻す？'))return;
  localStorage.removeItem(LS); location.reload();
};
</script></body></html>
`;
fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${castles.length} castles: 城タイプ4 + 特別城${castles.length - 4} / うちトレース済み ${castles.filter(c => c.done).length})`);

// --serve: 城の背景画像は file:// だとブラウザにブロックされるため、HTTPで配信する
if (serveAt >= 0) {
  const http = await import('node:http');
  const port = Number(argv[serveAt + 1]) || 8787;
  const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => {
    console.log(`\nブラウザで開く: http://127.0.0.1:${port}/${path.basename(OUT)}`);
    console.log('（終了は Ctrl+C。塗り終えたら「全城まとめてJSONを保存」→ node scripts/apply-castle-layouts.mjs <JSON>）');
  });
} else {
  console.log('このファイルをブラウザで開けば編集できる（file:// で可）。');
  console.log('URLで開きたい場合: node scripts/trace-castle-layout.mjs --serve');
}
