// 推定復元版。寸法・配置は原作の確定値ではない。
(function(K){
 const specs=[
 ['r1s1',8704,1536,[[32,1408],[1490,1408],[2304,1280],[3328,1152],[4352,1024],[5376,896],[6400,768],[7424,640],[8640,640]],'竹林の右進行・高低差'],
 ['r1s2',6912,1792,[[32,320],[768,320],[1792,544],[2816,800],[3840,1056],[4864,1312],[5888,1536],[6848,1536]],'杉林の右下り・崖'],
 ['r1s3',768,4096,null,'墓地の上昇・石の足場'],
 ['r1s4',6656,1024,[[32,832],[1024,832],[1792,704],[2560,704],[3328,832],[4096,704],[4864,704],[5632,832],[6592,832]],'寺院の右進行・高低差'],
 ['r2s1',4096,1536,[[32,1408],[512,1408],[1152,1152],[1792,896],[2432,640],[3072,384],[4032,384]],'火炎山の右上り'],
 ['r2s2',6400,2048,[[32,384],[768,384],[1792,640],[2816,1024],[3840,1280],[4864,1664],[5376,1792],[6336,1792]],'鍾乳洞の右下り・二段の決戦場'],
 ['r2s3',6400,3328,[[32,3072],[768,3072],[1792,2560],[2816,2048],[3840,1536],[4864,1024],[5376,512],[6336,512]],'氷山の右上り'],
 ['r2s4',768,2304,null,'塔の上昇・折り返し'],
 ['r3s1',2048,1024,[[32,832],[384,832],[768,768],[1152,832],[1536,768],[1984,768]],'沼の樹上を右進行'],
 ['r3s2',768,4096,null,'城壁の上昇・折り返し'],
 ['r3s3',9216,1024,[[32,832],[1536,832],[2560,704],[3584,832],[4608,704],[5632,832],[6656,704],[7680,768],[9152,768]],'城郭の右進行・段差'],
 ['r3s4',2048,2048,null,'城内の六層・階段の折り返し（層内の高さは推定）'],
 ['r4s1',3328,4096,[[64,256],[3200,1280],[3200,1408],[128,2560],[128,2688],[2944,3840],[3264,3840]],'黄泉の国の右下・左下・右下の折り返し']
 ];
 K.LEGACY_STAGES=JSON.parse(JSON.stringify(K.STAGES));
 K.RECONSTRUCTION_CATALOG=[];
 for(const [id,width,height,given,topology] of specs){
  const s=K.STAGES[id];let route=given;
  if(!route){
   route=[[64,height-128],[width-96,height-128]];
   const rise=id==='r3s4'?256:128;
   let y=height-128, right=true;
   while(y>256){y=Math.max(256,y-rise);route.push([right?64:width-96,y]);right=!right;}
   // Flat final approach at the right edge, regardless of last stair direction.
   if(route[route.length-1][0]!==width-64)route.push([width-64,256]);
  }
  const end=route[route.length-1],floor=end[1],arenaX=width-256;
  const d={width,height,spawn:{x:route[0][0],y:route[0][1]},solids:[],platforms:[],ramps:[],route:route.map(p=>({x:p[0],y:p[1]})),bossArena:{x:arenaX,y:floor-160,w:256,h:240,floorY:floor,bossSpawn:{x:width-64,y:floor},playerSpawn:{x:arenaX+32,y:floor},trigger:{x:arenaX+18,y:floor-64,w:230,h:64}}};
  d.platforms.push({x:0,y:route[0][1],w:Math.max(96,route[0][0]+32)});
  // Continuous walkable contours give every inferred route a verified accessible path.
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i];
   if(a[1]===b[1])d.platforms.push({x:Math.min(a[0],b[0])-8,y:a[1],w:Math.abs(a[0]-b[0])+16});
   else if(a[0]!==b[0]) d.ramps.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]});
  }
  d.solids.push({x:arenaX,y:floor,w:256,h:32});
  if(id==='r2s2')d.platforms.push({x:width-212,y:floor-40,w:100});
  d.hazards=[];
  if(id==='r3s1')d.hazards.push({x:0,y:900,w:width,h:height-900,kind:'swamp'});
  if(id==='r2s1'||id==='r4s1')d.hazards.push({x:0,y:height-48,w:width,h:48,kind:'lava'});
  if(id==='r2s2')d.hazards.push({x:width-256,y:floor-32,w:256,h:32,kind:'water'});
  if(id!=='r1s1'){
    const cropWidth={r1s2:.23,r1s3:.30,r1s4:.38,r2s1:.32,r2s2:.24,r2s3:.42,r3s1:.6,r3s2:.23,r3s3:.35,r4s1:.25}[id]||.35;
    const key='traversal_'+id;
    K.ASSET_CONFIG.backgrounds[key]={src:K.ASSET_CONFIG.backgrounds[s.bg].src,sourceRect:{x:0,y:0,w:cropWidth,h:.7},mirrorRepeat:true};
    if(id==='r2s4'||id==='r3s4')K.ASSET_CONFIG.backgrounds[key]={src:'terrain_tiles.webp',sourceRect:{x:.75,y:id==='r2s4'?0:.75,w:.25,h:.25},mirrorRepeat:true};
    s.traversalBg=key;
  }
  if(id==='r1s1'){
    for(const p of d.platforms)p.surface='ground';
    for(const r of d.ramps)r.surface='ground';
  }
  d.climbables=[];
  if(['r1s1','r1s2','r3s1'].includes(id)){
    for(let x=224;x<arenaX-160;x+=384){
      let base=null;
      for(let i=1;i<route.length;i++){
        const a=route[i-1],b=route[i];if(x<Math.min(a[0],b[0])||x>Math.max(a[0],b[0])||a[0]===b[0])continue;
        base=a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]);break;
      }
      if(base==null)continue;
      const c={x,bottom:base,top:Math.max(80,base-144),w:20,kind:id==='r1s1'?'bamboo':'cedar'};
      d.climbables.push(c);d.platforms.push({x:x-32,y:c.top,w:64,surface:'canopy'});
    }
  }
  s.geometry=d;s.width=width;s.lockX=arenaX;s.pits=[];s.platforms=[];s.gate=null;s.dark=false;
  s.reconstruction={status:'推定復元',originalDimensionsVerified:false,topology,source:'攻略本の全体図・攻略記事・参考動画。座標と画面数は未確認。'};
  const types=K.LEGACY_STAGES[id].enemies.map(e=>e.type);s.enemies=[];s.pickups=[];
  let n=0;
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   for(let t=192;t<length-64;t+=288){const q=t/length,x=a[0]+(b[0]-a[0])*q,y=a[1]+(b[1]-a[1])*q;if(x>arenaX&&Math.abs(y-floor)<100)continue;
    const type=types[(n++)%types.length];s.enemies.push({type,x,y:y-(type==='bat'||type==='ghostfire'?36:type==='icicle'?80:0)});
    if(n%3===0)s.pickups.push({cat:n%6===0?'heal':'single',id:n%6===0?'heal':'wind',x:x-48,y:y-16});
   }
  }
  s.pickups.unshift({cat:'auto',id:'key',x:route[0][0]+48,y:route[0][1]});
  const gateNode=route[Math.max(1,Math.floor(route.length/2))];s.gate={x:gateNode[0],y:gateNode[1],used:false,wall:{x:gateNode[0]+12,y:gateNode[1]-80,w:32,h:80,backgroundWall:true}};
  K.RECONSTRUCTION_CATALOG.push({id,name:s.name,width,height,viewport:{width:256,height:240},projectScreenSpan:{horizontal:width/256,vertical:height/240},originalScreenCount:null,status:'推定復元：原作の画面数・各座標は未確認',topology,route:d.route});
 }
})(window.KOMA);
