// Generated raster assets. Existing game rules and collision boxes are unchanged.
(function(K) {
  K.BG_FLOOR={training:0.66,stage_r1s1:0.66,stage_r1s2:0.62,stage_r1s3:0.90,stage_r1s4:0.94,stage_r2s1:0.63,stage_r2s2:0.60,stage_r2s3:0.75,stage_r2s4:0.80,stage_r3s1:0.76,stage_r3s2:0.90,stage_r3s3:0.72,stage_r3s4:0.70,stage_r4s1:0.98};
  const C = K.ASSET_CONFIG;
  const originalNames={"auto":{"decoy":"かわり身の術","peacock":"黄金の孔雀","key":"磐若門の鍵","torch":"たいまつ","charm":"御札"},"instant":{"eight":"阿修羅の術","dragon":"竜神変化","spin":"風車斬り","speed":"飛翔脚","mini":"チビ影分身","falcon":"隼丸","twin":"分身の術","after":"影分身","gold":"黄金仏","float":"浮遊仏"},"single":{"fly":"飛翔の術","wind":"風神の術","fire":"護神火の術","bind":"念縛の術","escape":"脱却の術","thunder":"雷神の術","see":"止観の術","halt":"排魔の術","aurora":"極光の術","bomb":"連暴凶術"},"select":{"white":"白玉","red":"赤玉","snow":"雪玉","flame":"火炎弾","thunder":"雷電","rosary":"数珠","light":"光玉","air":"空気弾","psy1":"念動波1","psy2":"念動波2"}};
  for(const cat of ['auto','instant','single']) {const group=K[cat.toUpperCase()];for(const id in originalNames[cat])group[id].name=originalNames[cat][id];}
  K.SELECT.forEach(x=>x.name=originalNames.select[x.id]);
  const bossNames={"r1s1":"磐若","r1s2":"魔僧兵","r1s3":"仁王","r1s4":"妖魔大僧正","r2s1":"火具土","r2s2":"幽鬼","r2s3":"雪女","r2s4":"天狗","r3s1":"武蔵","r3s2":"武士","r3s3":"妖魔大将軍","r3s4":"紅姥","r4s1":"黒翁"}; const stageNames={"r1s1":"竹やぶ","r1s2":"比叡山杉林","r1s3":"墓地","r1s4":"凶王寺院","r2s1":"火炎山","r2s2":"鍾乳洞","r2s3":"氷結山","r2s4":"天狗塔","r3s1":"底なし沼","r3s2":"破軍城城壁","r3s3":"破軍城石垣","r3s4":"破軍城内","r4s1":"黄泉の国"};
  for(const id in bossNames){K.BOSS_DEFS[id].name=bossNames[id];K.STAGES[id].name=stageNames[id];}
  K.STAGE_LIST.forEach(s=>{s.name=stageNames[s.id];s.boss=bossNames[s.id];});

  const enemyNames={"plain":"ドクロ・黒","ember":"ドクロ・赤","frost":"マユラ","knight":"侍","ghoul":"死人返り","skeleton":"ドクロ","naga":"土鬼","bat":"トウロウ鬼","hopper":"せむし男","emberhop":"アラハン","frosthop":"アラハン・青","ghostfire":"餓鬼","icicle":"氷柱","gunner":"やじたろう","turret":"石弓の罠"}; for(const id in enemyNames)K.ENEMY_TYPES[id].name=enemyNames[id];
  const walkSizes = {plain:[24,24], ember:[24,24], frost:[24,24], knight:[24,32], ghoul:[24,28], skeleton:[24,28], naga:[24,24], bat:[24,16], hopper:[24,24], emberhop:[24,24], frosthop:[24,24], ghostfire:[24,24], icicle:[16,24], gunner:[24,28], turret:[24,24]};
  Object.keys(walkSizes).forEach(id => {
    const s=walkSizes[id], key='enemy_'+id;
    C.sprites[key]={src:key+'.webp',frameW:s[0]*4,frameH:s[1]*4,drawW:s[0],drawH:s[1],anims:{idle:{row:0,frames:4,fps:4},walk:{row:1,frames:4,fps:8},fly:{row:1,frames:4,fps:10}}};
    K.ENEMY_TYPES[id].sprite=key;
  });
  C.sprites.player.src='player-size-v2.webp';
  C.sprites.player.frameW=256; C.sprites.player.frameH=192;
  for(const key in C.sprites) if(key.indexOf('boss_')===0) {
    C.sprites[key].src=key+'.webp'; C.sprites[key].frameW=256; C.sprites[key].frameH=256;
    C.sprites[key].drawW=64; C.sprites[key].drawH=64;
  }
  C.sprites.boss_r1s1.src='boss_r1s1-mask.webp';
  C.sprites.gate={src:'gate.webp',frameW:192,frameH:256,drawW:48,drawH:64,anims:{idle:{row:0,frames:1,fps:1}}};
  const groups={auto:Object.keys(K.AUTO),instant:Object.keys(K.INSTANT),single:Object.keys(K.SINGLE),heal:['heal'],select:K.SELECT.map(x=>x.id)};
  const icons=[];
  Object.keys(groups).forEach(cat=>groups[cat].forEach(id=>{
    const key='item_'+cat+'_'+id; icons.push({cat,id,key});
    C.sprites[key]={src:key+'.webp',frameW:64,frameH:64,drawW:16,drawH:16,anims:{idle:{row:0,frames:1,fps:1}}};
  }));
  K.GENERATED_ICONS=icons;
  ['shot_orb','enemy_shot','spark','fire_orb','falcon','spin_arc','solid_shot'].forEach(key=>{
    C.sprites[key]={src:key+'.webp',frameW:64,frameH:64,drawW:16,drawH:16,anims:{idle:{row:0,frames:1,fps:1}}};
  });
  C.sprites.shot_orb.drawW=8; C.sprites.shot_orb.drawH=8;
  C.sprites.enemy_shot.drawW=8; C.sprites.enemy_shot.drawH=8;
  C.sprites.item.src='item_auto_key.webp'; C.sprites.item.frameW=64; C.sprites.item.frameH=64;
  C.sprites.item.drawW=16; C.sprites.item.drawH=16;
  for(const key in C.backgrounds) C.backgrounds[key].src=key+'.webp'; C.backgrounds.training.src='stage_r1s1.webp';
  C.backgrounds.intro_bonji={src:'intro-bonji.png'};
  C.backgrounds.stage_r1s1_bamboo={src:'stage_r1s1_bamboo.webp',renderWidth:624,mirrorRepeat:true};
  K.BG_FLOOR.stage_r1s1_bamboo=1;
  K.STAGES.r1s1.traversalBg='stage_r1s1_bamboo';
  for(const key in C.ui) C.ui[key].src=key+'.webp';
  C.ui.start_hall={src:'start_hall.webp'};
  C.ui.bamboo_column={src:'bamboo_column.webp'}; C.ui.cedar_column={src:'cedar_column.webp'}; C.ui.hazard_tiles={src:'hazard_tiles.webp'};
  C.ui.pause_panel.src='pause-panel-v2.webp';
  C.ui.hud_frame.src='hud-frame-v2.webp';
  C.backgrounds.gate_hell={src:'hell-blue-tile-reference.webp',tileSize:20,sourceRect:{x:0,y:0,w:1,h:1}};
  C.ui.ending={src:'ending.webp'};
  C.ui.terrain_tiles={src:'terrain_tiles.webp'};
  // Character artwork was normalized to small NES-like bodies inside padded cells.
  // Increase the displayed characters around their fixed foot anchor.
  C.sprites.hell_midboss_r1={src:'hell_midboss_r1-2d-hd.webp',frameW:512,frameH:512,drawW:96,drawH:96,anchorX:0.55,anims:{idle:{row:0,frames:4,fps:4},attack:{row:1,frames:4,fps:10},hurt:{row:2,frames:4,fps:8}}};
  C.sprites.hell_midboss_r2={src:'hell_midboss_r2-2d-hd.webp',frameW:512,frameH:512,drawW:108,drawH:108,anchorX:0.75,anims:{idle:{row:0,frames:4,fps:4},attack:{row:1,frames:4,fps:10},hurt:{row:2,frames:4,fps:8}}};
  C.sprites.hell_midboss_r3={src:'hell_midboss_r3-2d-hd.webp',frameW:384,frameH:512,drawW:84,drawH:112,anchorX:0.6,anims:{idle:{row:0,frames:4,fps:4},attack:{row:1,frames:4,fps:10},hurt:{row:2,frames:4,fps:8}}};
  C.sprites.player_swordwheel={src:'player_swordwheel.webp',frameW:256,frameH:192,drawW:96,drawH:72,anims:{attack:{row:0,frames:4,fps:15},crouchAttack:{row:1,frames:4,fps:15}}};
  C.sprites.player_climb={src:'player_climb.webp',frameW:256,frameH:192,drawW:96,drawH:72,anims:{climb:{row:0,frames:4,fps:6}}};
  C.sprites.player.drawW=96; C.sprites.player.drawH=72;
  for(const [key,def] of Object.entries(C.sprites)) {
    if(key.startsWith('enemy_')||key.startsWith('boss_')) {
      def.drawW*=1.5; def.drawH*=1.5;
    }
  }
  const drawTerrainFallback=K.drawTerrain;
  const tileIndex={training:0,r1s1:1,r1s2:2,r1s3:3,r1s4:4,r2s1:5,r2s2:6,r2s3:7,r2s4:8,r3s1:9,r3s2:10,r3s3:11,r3s4:12,r4s1:13,gate_hub:14,gate_heaven:15,gate_hell:3};
  K.drawTerrain=function(ctx,camX,stage,assets,camY) {
    const img=assets && assets.images.terrain_tiles;
    if(!img) {drawTerrainFallback(ctx,camX,stage);return;}
    const cam=Math.round(camX), material=tileIndex[stage.id]??0, cw=img.width/4,ch=img.height/4;
    const tile=(idx,x,y,w,h)=>ctx.drawImage(img,(idx%4)*cw,Math.floor(idx/4)*ch,cw,ch,x,y,w,h);
    if (stage.geometry) {
      const top = Math.round(camY || 0), bottom = top + K.H;
      const rect = (p, height, idx) => {
        const x = Math.round(p.x - cam), y = Math.round(p.y), h = height;
        if (x >= K.W || x + p.w <= 0 || y >= bottom || y + h <= top) return;
        ctx.save(); ctx.beginPath(); ctx.rect(x,y,p.w,h); ctx.clip();
        for (let xx = Math.max(x, Math.floor(cam/16)*16-cam); xx < Math.min(K.W,x+p.w); xx += 16)
          for (let yy = Math.max(y, Math.floor(top/16)*16); yy < Math.min(bottom,y+h); yy += 16) tile(idx,xx,yy,16,16);
        ctx.restore();
      };
      for(const o of stage.geometry.scenery||[]){
        const image=assets.images[o.asset];if(image&&o.x+o.w>cam&&o.x<cam+K.W&&o.y+o.h>top&&o.y<bottom)ctx.drawImage(image,o.x-cam,o.y,o.w,o.h);
      }
      if(stage.gate?.wall?.backgroundWall)rect(stage.gate.wall,stage.gate.wall.h,3);
      for (const p of stage.geometry.solids || []) rect(p,p.h,material);
      for (const p of stage.geometry.platforms || []) rect(p,p.surface==='ground'?stage.geometry.height-p.y:8,material);
      for(const c of stage.geometry.climbables||[]){
        if(c.x+40<cam||c.x-40>cam+K.W||c.top>bottom||c.bottom<top)continue;
        const tree=assets.images[c.kind==='bamboo'?'bamboo_column':'cedar_column'];
        if(tree)ctx.drawImage(tree,c.x-cam-36,c.top-10,72,c.bottom-c.top+10);
      }
      for(const h of stage.geometry.hazards||[]){
        const image=assets.images.hazard_tiles;if(!image||h.y>bottom||h.y+h.h<top)continue;
        const cell={spikes:0,lava:1,swamp:2,water:3}[h.kind]??0;
        ctx.save();ctx.beginPath();ctx.rect(h.x-cam,h.y,h.w,h.h);ctx.clip();
        for(let x=Math.max(h.x,Math.floor(cam/48)*48);x<Math.min(h.x+h.w,cam+K.W);x+=48)
          ctx.drawImage(image,cell*image.width/4,68,image.width/4,564,x-cam,h.y,48,h.h);
        ctx.restore();
      }
      for (const r of stage.geometry.ramps || []) {
        const left=Math.min(r.x1,r.x2),right=Math.max(r.x1,r.x2);
        for (let x=Math.max(left,cam);x<Math.min(right,cam+K.W);x+=4) {
          const y=r.y1+(x-r.x1)*(r.y2-r.y1)/(r.x2-r.x1);
          rect({x,y,w:Math.min(4,right-x)},r.surface==='ground'?Math.max(8,stage.geometry.height-y):8,material);
        }
      }
      return;
    }
    let left=0;
    for(const pit of (stage.pits||[]).concat([[stage.width,stage.width]])) {
      const a=Math.max(0,left-cam), b=Math.min(K.W,pit[0]-cam);
      if(b>a) {ctx.save();ctx.beginPath();ctx.rect(a,K.GROUND,b-a,K.H-K.GROUND);ctx.clip();
        for(let x=Math.floor((a+cam)/16)*16-cam;x<b;x+=16) for(let y=K.GROUND;y<K.H;y+=16)tile(material,x,y,16,16);
        ctx.restore();}
      left=pit[1];
    }
    for(const p of stage.platforms||[]) {
      const x=Math.round(p.x-cam); if(x>K.W||x+p.w<0)continue;
      ctx.save();ctx.beginPath();ctx.rect(x,p.y,p.w,8);ctx.clip();
      for(let xx=0;xx<p.w;xx+=16)tile(0,x+xx,p.y,16,8);
      ctx.restore();
    }
  };
})(window.KOMA);
