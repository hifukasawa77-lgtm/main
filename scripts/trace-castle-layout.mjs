#!/usr/bin/env node
/**
 * trace-castle-layout.mjs
 * 攻城バックドロップ（城タイプ別4種＋城別35種）の上でヘックスの「侵入可否」を目視トレースする道具。
 *
 * なぜ手動トレースなのか:
 *   これらの背景は写実的な俯瞰CGで、水堀・石垣・曲輪の色差が非常に小さい（実測で
 *   水堀 blue=+1.0 / 石垣 blue=-9.5 / 遠景の水田 blue=-3.0、勾配はいずれも 8〜10 で差が出ない）。
 *   ピクセル色・テクスチャのルールでは水堀と石垣と背景の水田を分離できず、自動分類は
 *   誤検出だらけになる。そのため「絵を見て塗る」形のトレースにしている
 *   （野戦の trace-battlefield_hexes.mjs は油彩調で色差が大きいため自動分類が成立している）。
 *
 * 使い方: node scripts/trace-castle-layout.mjs [出力先.html]
 *   sengoku.html から現在のレイアウト（城タイプ別=CASTLE_HEX_LAYOUTS、
 *   城別=SPECIAL_CASTLE_KEEP_HEX からの生成リング）を読み込んだ編集ページを書き出す。
 *   ブラウザで開き、左のパレットで種別を選んでヘックスをクリックすると塗れる。
 *   右クリック（またはパレットの「侵入出来る」）で消去。
 *   「この城のJSを出力」で sengoku.html へ貼れる1城分のブロックが得られる。
 * 依存: なし（出力HTMLがブラウザのCanvasで描画する）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(process.argv[2] || 'castle-layout-trace.html');
const src = fs.readFileSync(path.join(ROOT, 'sengoku.html'), 'utf8');

// sengoku.html 内のオブジェクトリテラルをそのまま値として取り出す（自リポジトリのファイルのみ対象）
function literal(name, re) {
  const m = src.match(re);
  if (!m) throw new Error(`sengoku.html から ${name} を読み取れない（定義名が変わった可能性）`);
  return new Function('return ' + m[1])();
}
const CASTLE_HEX_LAYOUTS = literal('CASTLE_HEX_LAYOUTS', /const CASTLE_HEX_LAYOUTS = (\{[\s\S]*?\n\});/);
const KEEPS = literal('SPECIAL_CASTLE_KEEP_HEX', /const SPECIAL_CASTLE_KEEP_HEX = (\{[\s\S]*?\n\});/);
const RINGS = literal('SPECIAL_CASTLE_RINGS', /const SPECIAL_CASTLE_RINGS = (\[[\s\S]*?\n\]);/);

const nameByKey = {};
for (const m of src.matchAll(/'([^']+)'\s*:\s*'(siege[A-Za-z]+)'/g)) {
  nameByKey[m[2]] = JSON.parse('"' + m[1] + '"');
}
const fileByKey = {};
for (const m of src.matchAll(/(siege[A-Za-z]+):\s*'(assets\/[^']+)'/g)) fileByKey[m[1]] = m[2];

// 城タイプ別4種＋特別城35種。type は「その城のレイアウトの出どころ」
const castles = [];
for (const [type, key] of [['hirajiro', 'siegeHirajiro'], ['yamajiro', 'siegeYamajiro'],
  ['hirayamajiro', 'siegeHirayamajiro'], ['umajiro', 'siegeUmajiro']]) {
  if (fileByKey[key]) castles.push({ id: type, label: `城タイプ: ${type}`, file: fileByKey[key], layout: CASTLE_HEX_LAYOUTS[type], target: 'CASTLE_HEX_LAYOUTS' });
}
for (const [key, keep] of Object.entries(KEEPS)) {
  if (!fileByKey[key]) continue;
  castles.push({ id: key, label: `${nameByKey[key] || key}`, file: fileByKey[key], keep, target: 'CASTLE_TRACED_LAYOUTS' });
}

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>攻城ヘックス 侵入可否トレース / Castle Hex Passability Trace</title>
<style>
 body{margin:0;background:#05070d;color:#e6edf7;font-family:system-ui,"Noto Sans JP",sans-serif}
 header{position:sticky;top:0;z-index:9;background:rgba(5,7,13,.96);border-bottom:1px solid rgba(148,163,184,.25);padding:12px 18px}
 h1{font-size:17px;margin:0 0 8px}
 .pal{display:flex;flex-wrap:wrap;gap:8px}
 .pal button{background:rgba(148,163,184,.12);color:#e6edf7;border:2px solid transparent;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer}
 .pal button.on{border-color:#67e8f9;background:rgba(103,232,249,.14)}
 .hint{font-size:12px;color:#94a3b8;margin:8px 0 0;line-height:1.6}
 .card{padding:16px 18px;border-bottom:1px solid rgba(148,163,184,.15)}
 .cap{font-size:15px;color:#7dd3fc;margin:0 0 8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
 .cap button{background:rgba(148,163,184,.14);color:#e6edf7;border:1px solid rgba(148,163,184,.35);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer}
 canvas{width:100%;max-width:1280px;height:auto;display:block;cursor:crosshair;touch-action:none}
 pre{white-space:pre-wrap;background:rgba(148,163,184,.1);padding:10px;border-radius:8px;font-size:12px;max-height:230px;overflow:auto}
</style></head><body>
<header>
 <h1>攻城ヘックス 侵入可否トレース / Castle Hex Passability Trace</h1>
 <div class="pal" id="pal"></div>
 <p class="hint">絵の城門・櫓・水堀・空堀・柵・馬出・城壁・石垣・土塁・二ノ丸・三ノ丸・通路を見ながら、
 種別を選んでヘックスをクリックして塗る。右クリックで「侵入出来る」に戻す。<br>
 枠の意味はゲーム内と同じ: <b style="color:#82c6ec">水色二重＝侵入出来ない</b> /
 <b style="color:#e2b260">橙＝破壊すれば侵入出来る</b> / 細白＝侵入出来る。</p>
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

// 侵入可否3分類（sengoku.html の CASTLE_PASSABILITY と同じ定義に保つこと）
const PASS={moat:'blocked',gate:'breakable',palisade:'breakable',wall:'breakable',
  stonewall:'breakable',earthwork:'breakable',yagura:'breakable',drymoat:'open',keep:'open'};
const KINDS=[
 ['',          '侵入出来る（曲輪・通路・馬出）'],
 ['drymoat',   '空堀（侵入出来る・登坂コスト）'],
 ['keep',      '天守'],
 ['moat',      '水堀（侵入出来ない）'],
 ['stonewall', '石垣'],
 ['wall',      '城壁'],
 ['earthwork', '土塁'],
 ['palisade',  '柵'],
 ['gate',      '城門'],
 ['yagura',    '櫓'],
];
const FILL={moat:'rgba(24,72,116,0.35)',drymoat:'rgba(120,96,58,0.30)',stonewall:'rgba(96,92,86,0.5)',
 wall:'rgba(80,86,96,0.5)',earthwork:'rgba(120,96,56,0.4)',gate:'rgba(74,52,30,0.5)',
 palisade:'rgba(120,84,44,0.4)',yagura:'rgba(120,84,44,0.5)',keep:'rgba(226,178,96,0.35)'};
const CASTLES=${JSON.stringify(castles)};
const RINGS=${JSON.stringify(RINGS)};

let cur='moat';
const pal=document.getElementById('pal');
for(const [k,label] of KINDS){
  const b=document.createElement('button'); b.textContent=label; b.dataset.k=k;
  b.onclick=()=>{cur=k;[...pal.children].forEach(x=>x.classList.toggle('on',x.dataset.k===k));};
  pal.append(b);
}
[...pal.children].find(x=>x.dataset.k===cur).classList.add('on');

// 特別城の現在のレイアウト＝天守中心の同心リング（sengoku.html の buildSpecialCastleLayout と同じ）
function ringLayout(keep){
  const [kc,kr]=keep, cells={}; cells[kc+','+kr]='keep';
  for(const ring of RINGS){
    const list=[];
    for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++)
      if(hexDist(c,r,kc,kr)===ring.dist) list.push([c,r]);
    if(!list.length) continue;
    let open=0;
    for(let i=1;i<list.length;i++){const a=list[i],b=list[open];
      if(a[1]>b[1]||(a[1]===b[1]&&Math.abs(a[0]-kc)<Math.abs(b[0]-kc))) open=i;}
    list.forEach(([c,r],i)=>{cells[c+','+r]=(i===open?ring.opening:ring.kind);});
  }
  cells[kc+','+kr]='keep';
  return cells;
}
function fromLayout(layout){
  const cells={};
  for(const kind in layout) for(const [c,r] of layout[kind]) cells[c+','+r]=kind;
  return cells;
}

const list=document.getElementById('list');
for(const cas of CASTLES){
  const cells=cas.layout?fromLayout(cas.layout):ringLayout(cas.keep);
  const card=document.createElement('div'); card.className='card';
  const cap=document.createElement('p'); cap.className='cap';
  const title=document.createElement('span'); title.textContent=cas.label+' — '+cas.id;
  const outBtn=document.createElement('button'); outBtn.textContent='この城のJSを出力';
  const resetBtn=document.createElement('button'); resetBtn.textContent='初期状態へ戻す';
  cap.append(title,outBtn,resetBtn);
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const out=document.createElement('pre'); out.hidden=true;
  card.append(cap,cv,out); list.append(card);
  const ctx=cv.getContext('2d');
  const img=new Image(); img.src=cas.file;
  const hexPath=(x,y)=>{ctx.beginPath();
    for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-90),px=x+HEX.size*Math.cos(a),py=y+HEX.size*Math.sin(a);
      i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
    ctx.closePath();};
  const draw=()=>{
    const sc=Math.max(W/img.naturalWidth,H/img.naturalHeight), sw=W/sc, sh=H/sc;
    ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,0,0,W,H);
    for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++){
      const [x,y]=hexCenter(c,r), kind=cells[c+','+r]||'';
      hexPath(x,y);
      if(FILL[kind]){ctx.fillStyle=FILL[kind];ctx.fill();}
      const pass=PASS[kind]||'open';
      ctx.lineWidth=3;ctx.strokeStyle='rgba(8,12,20,0.34)';ctx.stroke();
      if(pass==='blocked'){ctx.lineWidth=4.5;ctx.strokeStyle='rgba(130,198,236,0.92)';ctx.stroke();}
      else if(pass==='breakable'){ctx.lineWidth=4.5;ctx.strokeStyle='rgba(226,178,96,0.92)';ctx.stroke();}
      else {ctx.lineWidth=1.2;ctx.strokeStyle='rgba(233,240,250,0.34)';ctx.stroke();}
      if(kind==='keep'){ctx.lineWidth=4;ctx.strokeStyle='rgba(242,200,121,0.95)';ctx.stroke();}
    }
  };
  img.onload=draw;
  img.onerror=()=>{ctx.fillStyle='#301018';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fca5a5';
    ctx.font='40px sans-serif';ctx.textAlign='center';ctx.fillText('画像が読めない: '+cas.file,W/2,H/2);};
  const pick=e=>{
    const b=cv.getBoundingClientRect();
    const px=(e.clientX-b.left)*W/b.width, py=(e.clientY-b.top)*H/b.height;
    let best=null,bd=Infinity;
    for(let r=0;r<HEX.rows;r++)for(let c=0;c<HEX.cols;c++){
      const [x,y]=hexCenter(c,r),d=(x-px)**2+(y-py)**2; if(d<bd){bd=d;best=[c,r];}}
    return best;
  };
  cv.addEventListener('click',e=>{const [c,r]=pick(e);
    if(cur) cells[c+','+r]=cur; else delete cells[c+','+r]; draw();});
  cv.addEventListener('contextmenu',e=>{e.preventDefault();const [c,r]=pick(e);
    delete cells[c+','+r]; draw();});
  resetBtn.onclick=()=>{const base=cas.layout?fromLayout(cas.layout):ringLayout(cas.keep);
    for(const k in cells) delete cells[k]; Object.assign(cells,base); draw(); };
  outBtn.onclick=()=>{
    const by={};
    for(const k in cells){const [c,r]=k.split(',').map(Number);(by[cells[k]]||(by[cells[k]]=[])).push([c,r]);}
    for(const k in by) by[k].sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    const order=['keep','gate','yagura','palisade','wall','stonewall','earthwork','drymoat','moat'];
    const lines=['  '+cas.id+': {'];
    for(const k of order){ if(!by[k]) continue;
      lines.push('    '+k+': ['+by[k].map(([c,r])=>'['+c+','+r+']').join(',')+'],'); }
    lines.push('  },');
    out.hidden=false; out.textContent='// '+cas.target+' へ貼る\\n'+lines.join('\\n');
  };
}
</script></body></html>
`;
fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${castles.length} castles: 城タイプ4 + 特別城${castles.length - 4})`);
