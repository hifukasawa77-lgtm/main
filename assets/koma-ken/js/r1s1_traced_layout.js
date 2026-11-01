// Image-traced first stage. Atlas coordinates are provisional, not original world bounds.
(function(K){
 const E={"status":"Image-traced reconstruction, not a verified original collision map","worldOffsetY":160,"width":8704,"height":1536,"originalDimensions":null,"source":"map-research/r1s1-candidate.jpg","openingSource":"map-research/r1s1-opening-fragment.json","ground":[[0,1490,1248],[2190,2835,1248],[2835,2963,1136],[2963,3730,1008],[3987,4119,768],[5493,5694,608],[5694,5823,496],[5823,6334,368],[6841,7358,368],[8379,8704,448]],"bridges":[[1718,1938,1248],[1947,2190,1248],[4119,4380,640],[4440,4520,640],[4580,4645,640],[4720,4800,640],[6334,6428,368],[6500,6560,368],[6650,6710,368],[6780,6841,368]],"foliage":[{"x":7969,"y":189,"w":61,"h":6},{"x":8017,"y":193,"w":28,"h":4},{"x":7308,"y":240,"w":34,"h":3},{"x":8292,"y":243,"w":61,"h":4},{"x":7529,"y":252,"w":77,"h":9},{"x":8145,"y":252,"w":81,"h":11},{"x":6124,"y":256,"w":34,"h":3},{"x":7148,"y":256,"w":34,"h":3},{"x":6848,"y":274,"w":30,"h":4},{"x":7785,"y":284,"w":76,"h":8},{"x":6239,"y":304,"w":47,"h":3},{"x":7263,"y":304,"w":47,"h":3},{"x":7421,"y":313,"w":24,"h":3},{"x":7390,"y":320,"w":62,"h":11},{"x":8144,"y":332,"w":31,"h":3},{"x":7573,"y":348,"w":32,"h":9},{"x":7671,"y":348,"w":62,"h":9},{"x":8237,"y":348,"w":34,"h":3},{"x":4948,"y":463,"w":57,"h":11},{"x":5154,"y":533,"w":42,"h":5},{"x":4973,"y":543,"w":34,"h":3},{"x":5375,"y":543,"w":76,"h":9},{"x":4822,"y":549,"w":31,"h":5},{"x":5425,"y":560,"w":26,"h":3},{"x":4034,"y":565,"w":60,"h":8},{"x":5260,"y":607,"w":63,"h":8},{"x":5213,"y":622,"w":33,"h":12},{"x":5295,"y":624,"w":30,"h":3},{"x":5056,"y":655,"w":63,"h":3},{"x":5435,"y":655,"w":34,"h":3},{"x":3987,"y":673,"w":31,"h":5},{"x":3876,"y":864,"w":76,"h":7},{"x":3680,"y":880,"w":34,"h":3},{"x":3520,"y":896,"w":33,"h":3},{"x":2963,"y":912,"w":31,"h":7},{"x":3633,"y":944,"w":49,"h":3},{"x":2659,"y":1040,"w":29,"h":11},{"x":1318,"y":1042,"w":25,"h":3},{"x":1636,"y":1045,"w":28,"h":6},{"x":1090,"y":1074,"w":29,"h":3},{"x":1566,"y":1088,"w":52,"h":10},{"x":1280,"y":1107,"w":32,"h":5},{"x":2452,"y":1106,"w":30,"h":5},{"x":1632,"y":1120,"w":34,"h":3},{"x":1250,"y":1122,"w":29,"h":3},{"x":1250,"y":1130,"w":29,"h":3},{"x":1582,"y":1137,"w":34,"h":3},{"x":1250,"y":1138,"w":30,"h":3},{"x":2196,"y":1154,"w":29,"h":5},{"x":734,"y":1169,"w":82,"h":3},{"x":1025,"y":1169,"w":47,"h":3},{"x":1502,"y":1169,"w":34,"h":3},{"x":2672,"y":1168,"w":34,"h":3},{"x":449,"y":1185,"w":31,"h":3},{"x":961,"y":1185,"w":31,"h":3},{"x":545,"y":1201,"w":31,"h":3},{"x":1310,"y":1201,"w":34,"h":3},{"x":2480,"y":1200,"w":34,"h":3},{"x":450,"y":1105,"w":63,"h":10},{"x":962,"y":1105,"w":60,"h":9},{"x":1218,"y":1105,"w":73,"h":11},{"x":1457,"y":1041,"w":61,"h":9},{"x":1538,"y":1026,"w":60,"h":5}],"notes":["The atlas contains accumulated registration uncertainty and unseen areas.","Ground contours were read from visible dirt bands; later global placement is provisional.","Bridge gaps and all foliage collision properties are inferred.","Missing routes are connected with explicitly inferred bamboo footholds, never a continuous slope."]};
 const s=K.STAGES.r1s1,offset=E.worldOffsetY;
 const d={width:E.width,height:E.height,spawn:{x:32,y:1248+offset},solids:[],platforms:[],ramps:[],climbables:[],hazards:[],route:[]};
 for(const [l,r,y]of E.ground)d.solids.push({x:l,y:y+offset,w:r-l,h:E.height-y-offset,surface:'ground',evidence:l===0?'opening observed contour':'candidate visible contour'});
 for(const [l,r,y]of E.bridges)d.platforms.push({x:l,y:y+offset,w:r-l,surface:'bridge',evidence:'bridge extents inferred from visible timbers'});
 for(const p of E.foliage){
  const x=p.x+p.w/2,top=p.y+offset;
  const under=E.ground.concat(E.bridges).filter(([l,r,y])=>x>=l-32&&x<=r+32&&y+offset>top).map(q=>q[2]+offset);
  let bottom=under.length?Math.min(...under):Math.min(E.height-40,top+200);
  d.climbables.push({x,top,bottom,w:20,kind:'bamboo',evidence:'visible foliage; climbability inferred'});
  d.platforms.push({x:p.x,y:top,w:p.w,surface:'canopy',evidence:'visible foliage; collision inferred'});
 }
 const addTrunk=(x,top,bottom,w=48)=>{
  d.climbables.push({x,top:top+offset,bottom:bottom+offset,w:20,kind:'bamboo',evidence:'inferred connector'});
  d.platforms.push({x:x-w/2,y:top+offset,w,surface:'canopy',evidence:'inferred connector'});
 };
 // Vertical ledges retain their actual rise; estimated climbing supports replace old slopes.
 for(const [x,top,bottom]of [[2822,1136,1248],[2950,1008,1136],[3974,768,920],[4106,640,768],[5480,608,700],[5681,496,608],[5810,368,496]])addTrunk(x,top,bottom);
 // Added connectors are separate from traced contours and remain visibly bamboo.
 for(const [l,r,yl,yr]of [[3730,3987,1008,768],[4119,4214,768,640],[4380,4440,640,640],[4520,4580,640,640],[4645,4720,640,640],[4800,5493,640,608],[6334,6841,368,368],[7358,8379,368,448]]){
  const steps=Math.max(2,Math.ceil((r-l)/64));for(let i=1;i<steps;i++){
   const x=l+(r-l)*i/steps,top=yl+(yr-yl)*i/steps;
   addTrunk(x,top,Math.min(1248,Math.max(yl,yr)+128),48);
  }
 }
 d.climbables.sort((a,b)=>a.x-b.x);
 const floor=448+offset,arenaX=E.width-256;
 d.bossArena={x:arenaX,y:floor-160,w:256,h:240,floorY:floor,bossSpawn:{x:E.width-64,y:floor},playerSpawn:{x:arenaX+32,y:floor},trigger:{x:arenaX+18,y:floor-64,w:230,h:64}};
 d.scenery=[{asset:'start_hall',x:-16,y:d.spawn.y-152,w:104,h:152}];
 s.geometry=d;s.width=E.width;s.lockX=arenaX;s.pits=[];s.platforms=[];
 s.reconstruction={status:'照合画像から地形を読み取った復元。接合座標・衝突判定・補間は推定',originalDimensionsVerified:false,source:'r1s1-layout-evidence.json'};
 // Enemies and pickups remain estimates, but now stand on reachable visible surfaces.
 s.enemies=[];let n=0;for(const p of d.solids){for(let x=p.x+192;x<p.x+p.w-60;x+=320){if(x>=arenaX)continue;s.enemies.push({type:['plain','hopper','gunner'][n++%3],x,y:p.y});}}
 s.pickups=[{cat:'auto',id:'key',x:110,y:d.spawn.y},{cat:'single',id:'wind',x:500,y:1105+offset},{cat:'heal',id:'heal',x:2520,y:1248+offset},{cat:'heal',id:'heal',x:6060,y:368+offset}];
 s.gate={x:2823,y:1248+offset,used:false,wall:{x:2835,y:1136+offset,w:128,h:112},placementEvidence:"visible cliff gate; atlas coordinates provisional"};
 for(const stage of K.STAGE_LIST)K.STAGES[stage.id].pickups=K.STAGES[stage.id].pickups.filter(p=>p.cat!=='single');
 K.R1S1_LAYOUT_EVIDENCE=E;
 const c=K.RECONSTRUCTION_CATALOG.find(x=>x.id==='r1s1');Object.assign(c,{status:s.reconstruction.status,topology:'平地→竹の穴・橋→二段の崖→竹・橋→二段の崖→竹の足場→御神木',route:[],ground:d.solids,platforms:d.platforms});
})(window.KOMA);
