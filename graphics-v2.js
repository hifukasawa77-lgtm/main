'use strict';
// Visual layer: the original 480 x 540 simulation and collision geometry stay intact.
const cosmosArt=new Image();
cosmosArt.src='assets/cosmos-v2.png';
const volcanoArt=new Image();
volcanoArt.src='assets/volcano-v2.png';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const startButton=document.getElementById('startGame');
const pauseButton=document.getElementById('pauseGame');
const sectorNames=['灼熱の火山帯','沈黙の石像群','砂塵のピラミッド','忘れられた遺跡','異星生命の内部','深宇宙宙域','最終防衛要塞'];
const sceneCache=new Map();
let renderScale=1;
function fitGame(){
  const mobile=innerWidth<=520;
  const overhead=mobile?178:214;
  const cssW=Math.floor(Math.max(220,Math.min(innerWidth-(mobile?16:24),(innerHeight-overhead)*W/H,720)));
  document.documentElement.style.setProperty('--game-width',cssW+'px');
  renderScale=(cssW/W)*Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(W*renderScale);canvas.height=Math.round(H*renderScale);
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
}
window.addEventListener('resize',fitGame);
fitGame();

function artCover(alpha=1,drift=0,art=cosmosArt){
  if(!art.complete||!art.naturalWidth)return;
  ctx.save();ctx.globalAlpha=alpha;
  const scale=Math.max(W/art.width,H/art.height)*1.08;
  const w=art.width*scale,h=art.height*scale;
  ctx.drawImage(art,(W-w)/2+drift,(H-h)/2,w,h);ctx.restore();
}
function glow(x,y,r,color,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function fineStars(alpha=1){
  ctx.save();
  for(let i=0;i<stars.length;i++){
    const s=stars[i],twinkle=reducedMotion?0.7:0.6+0.25*Math.sin(frame*.015+i*7);
    ctx.globalAlpha=alpha*twinkle;ctx.fillStyle=i%7===0?'#adcbef':'#e0e7ed';
    ctx.beginPath();ctx.arc(s.x,s.y,s.size*.36,0,Math.PI*2);ctx.fill();
    if(i%23===0){ctx.globalAlpha=alpha*.22;ctx.fillRect(s.x-3,s.y-.3,6,.6);ctx.fillRect(s.x-.3,s.y-3,.6,6);}
  }ctx.restore();
}
function scenery(n){
  if(sceneCache.has(n))return sceneCache.get(n);
  const c=document.createElement('canvas');c.width=960;c.height=540;const g=c.getContext('2d');
  const colors=['#8e482a','#416b87','#9c7541','#5b607c','#593868','#496986','#586575'];
  g.fillStyle=colors[n-1];g.strokeStyle=colors[n-1];
  for(let layer=0;layer<2;layer++){
    g.globalAlpha=.18+layer*.13;
    const base=460+layer*24;
    if(n===1||n===6){
      for(let i=0;i<10;i++){
        const x=i*116+layer*42,h=70+(Math.sin(i*13+layer)*.5+.5)*150;
        g.beginPath();g.moveTo(x-80,base);g.lineTo(x,base-h);g.lineTo(x+32,base-h+22);g.lineTo(x+108,base);g.closePath();g.fill();
        g.strokeStyle=n===1?'#c47a47':'#8094b2';g.lineWidth=1;g.beginPath();g.moveTo(x,base-h);g.lineTo(x+20,base-50);g.stroke();
      }
    }else if(n===5){
      for(let i=0;i<16;i++){const x=i*67;g.lineWidth=10+i%4*6;g.beginPath();g.moveTo(x,540);g.bezierCurveTo(x-95,360,x+90,330,x,160+i%3*35);g.stroke();}
    }else{
      for(let i=0;i<14;i++){
        const x=i*80+layer*24,h=60+(Math.sin(i*27)*.5+.5)*155;
        if(n===3){g.beginPath();g.moveTo(x-64,base);g.lineTo(x+12,base-h);g.lineTo(x+92,base);g.closePath();g.fill();g.fillRect(x+10,base-h+12,2,h-12);}
        else{g.fillRect(x,base-h,25+(i%3)*8,h);g.fillRect(x-8,base-h,48,12);if(n===2){g.fillRect(x+18,base-h+23,16,46);g.clearRect(x+3,base-h+24,15,3);}else if(n===7){g.fillRect(x+32,base-h+35,22,h-35);g.lineWidth=1;g.strokeRect(x+4,base-h+17,15,h-25);}}
      }
    }
  }
  sceneCache.set(n,c);return c;
}
function drawBackdrop(n=stage){
  const st=STAGES[n-1];
  const base=ctx.createLinearGradient(0,0,0,H);base.addColorStop(0,'#040912');base.addColorStop(1,st.bgBot);ctx.fillStyle=base;ctx.fillRect(0,0,W,H);
  const volcanic=n===1&&volcanoArt.complete&&volcanoArt.naturalWidth>0;
  artCover(volcanic?.92:n===6?.72:.26,reducedMotion?0:Math.sin(frame*.001)*12,volcanic?volcanoArt:cosmosArt);
  glow(W*.7,H*.63,330,st.accentColor,n===6?.08:.12);
  fineStars(n===5?.24:.7);
  if(!volcanic){
    const distant=scenery(n),offset=reducedMotion?0:(stageFrame*.16)%960;
    ctx.drawImage(distant,-offset,0);ctx.drawImage(distant,960-offset,0);
  }
  // Faint atmosphere behind the play area keeps enemy silhouettes legible.
  const fog=ctx.createLinearGradient(0,80,0,480);fog.addColorStop(0,'#02071000');fog.addColorStop(.5,'#02071055');fog.addColorStop(1,'#02071000');ctx.fillStyle=fog;ctx.fillRect(0,0,W,H);
  if(!reducedMotion){
    ctx.save();
    for(let i=0;i<22;i++){
      const x=((i*73.71-stageFrame*(.2+i%3*.14))%W+W)%W;
      const y=(i*47.39+Math.sin(frame*.01+i)*8)%H;
      ctx.globalAlpha=.16+(i%4)*.05;ctx.fillStyle=n===1?'#ffc197':n===5?'#d9acdc':'#b3c6dc';ctx.beginPath();ctx.arc(x,y,i%3===0?1.3:.65,0,7);ctx.fill();
    }ctx.restore();
  }
}
function enginePlume(x,y,length,height,alpha=1){
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha;
  const g=ctx.createLinearGradient(x-length,y,x+3,y);g.addColorStop(0,'#6eafff00');g.addColorStop(.6,'#75beff88');g.addColorStop(1,'#e9f7ff');ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(x+3,y-height/2);ctx.quadraticCurveTo(x-length*.5,y-height*.35,x-length,y);ctx.quadraticCurveTo(x-length*.5,y+height*.35,x+3,y+height/2);ctx.closePath();ctx.fill();ctx.restore();
}
function drawPlayerExhaust(){
  const flicker=reducedMotion?0:Math.sin(frame*1.7)*5;
  const alpha=player.invul>0&&player.invul%6<3?.25:1;
  enginePlume(player.x-12,player.y+player.h/2-3,26+flicker,5,alpha);
  enginePlume(player.x-12,player.y+player.h/2+3,23+flicker,5,alpha);
}
function drawV2Particles(){
  ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round';
  for(const p of particles){
    ctx.globalAlpha=Math.min(1,p.life/24);ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(.7,p.size*.4);
    ctx.beginPath();ctx.moveTo(p.x-p.vx*2.5,p.y-p.vy*2.5);ctx.lineTo(p.x,p.y);ctx.stroke();
    ctx.fillStyle=p.life>20?'#fff2d2':p.color;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.5,p.size*.35),0,7);ctx.fill();
  }ctx.restore();
}
function drawV2Bullet(b){
  const c=b.type==='laser'?'#93ffcd':b.type==='mssl'?'#ffc190':b.type==='normal'||b.type==='double'?'#99dfff':'#e0adff';
  ctx.save();ctx.globalCompositeOperation='screen';
  const tail=b.type==='laser'?35:b.type==='mssl'?20:13;
  const g=ctx.createLinearGradient(b.x-tail,0,b.x+b.w,0);g.addColorStop(0,c+'00');g.addColorStop(.7,c+'99');g.addColorStop(1,'#ffffff');
  ctx.fillStyle=g;ctx.fillRect(b.x-tail,b.y,tail+b.w,b.h);ctx.fillStyle='#f7fcff';ctx.fillRect(b.x,b.y+b.h*.3,b.w,Math.max(1,b.h*.4));ctx.restore();
}
function drawV2HUD(st){
  ctx.save();ctx.fillStyle='#07101ee8';ctx.fillRect(0,0,W,39);ctx.fillRect(0,H-42,W,42);
  ctx.strokeStyle='#9ab5cb44';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,39);ctx.lineTo(W,39);ctx.moveTo(0,H-42);ctx.lineTo(W,H-42);ctx.stroke();
  ctx.textAlign='left';ctx.font='8px Arial';ctx.fillStyle='#8ca0b7';ctx.fillText('SCORE / スコア',13,12);ctx.font='bold 17px Consolas,monospace';ctx.fillStyle='#edf4fc';ctx.fillText(String(score).padStart(7,'0'),12,30);
  ctx.textAlign='center';ctx.font='9px Arial';ctx.fillStyle='#9eafc3';ctx.fillText('SECTOR 0'+stage,W/2,13);ctx.font='bold 12px Arial';ctx.fillStyle='#d2deec';ctx.fillText(st.name,W/2,29);
  ctx.textAlign='right';ctx.font='8px Arial';ctx.fillStyle='#8ca0b7';ctx.fillText(invincibleMode?'INVINCIBLE / 無敵':'SHIPS / 残機',W-12,12);ctx.font='14px Arial';ctx.fillStyle='#d1b294';ctx.fillText('◆ '.repeat(Math.max(0,lives)),W-10,30);
  const levels=[speedLevel,missDownLv,missUpLv,laserLv,optionCount,barrierHp];
  for(let i=0;i<6;i++){
    const x=8+i*78,selected=i===puCursor;
    if(selected){ctx.fillStyle='#9cbfd21c';ctx.fillRect(x-3,H-39,75,34);}
    ctx.textAlign='left';ctx.font='bold 8px Arial';ctx.fillStyle=selected?'#f2ddad':'#9fb0c3';ctx.fillText(PU_NAMES[i],x,H-25);
    for(let k=0;k<PU_MAX[i];k++){
      const w=64/PU_MAX[i]-3;ctx.fillStyle=k<levels[i]?PU_COLORS[i]+'aa':'#354252';ctx.fillRect(x+k*(w+3),H-17,w,4);
    }
    if(selected){ctx.fillStyle='#efd6a1';ctx.fillRect(x,H-7,64,1);}
  }ctx.restore();
}

renderTitle=function(){
  ctx.fillStyle='#070e1a';ctx.fillRect(0,0,W,H);artCover(1,reducedMotion?0:Math.sin(frame*.002)*8);fineStars(.5);
  const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#01050b88');shade.addColorStop(.42,'#02091300');shade.addColorStop(.76,'#040b16a8');shade.addColorStop(1,'#040a13fa');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.textAlign='center';ctx.fillStyle='#aec7dc';ctx.font='10px Arial';ctx.fillText('S E V E N   S E C T O R S .   O N E   M I S S I O N .',W/2,40);
  const titleInk=ctx.createLinearGradient(0,58,0,165);titleInk.addColorStop(0,'#ffffff');titleInk.addColorStop(.6,'#d6e4ef');titleInk.addColorStop(1,'#839fb8');
  ctx.fillStyle=titleInk;ctx.font='italic 900 58px Arial';ctx.shadowColor='#000a';ctx.shadowBlur=10;ctx.fillText('GALACTIC',W/2-4,98);ctx.fillText('ASSAULT',W/2-4,151);ctx.shadowBlur=0;
  ctx.font='11px Arial';ctx.fillStyle='#bdccdb';ctx.fillText('ギャラクティック・アサルト',W/2,177);
  const bob=reducedMotion?0:Math.sin(frame*.02)*4;
  enginePlume(157,252+bob,70,10,.65);
  enginePlume(158,278+bob,70,10,.65);
  if(sprites.player){ctx.save();ctx.translate(267,263+bob);ctx.rotate(-.07);ctx.drawImage(sprites.player,-126,-77,252,154);ctx.restore();}
  ctx.strokeStyle='#a0bfda44';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(46,351);ctx.lineTo(150,351);ctx.moveTo(330,351);ctx.lineTo(434,351);ctx.stroke();
  ctx.font='9px Arial';ctx.fillStyle='#bed0df';ctx.fillText('READY FOR SORTIE',W/2,354);
  ctx.font='10px Arial';ctx.fillStyle='#afbece';ctx.fillText('7つの宙域を突破し、最終要塞へ。',W/2,374);
  ctx.font='9px Arial';ctx.fillStyle='#b2c0d1';ctx.fillText('Z / SPACE / B で出撃',W/2,458);
  ctx.fillStyle=invincibleMode?'#efd39b':'#8195ad';ctx.fillText('I : 無敵モード '+(invincibleMode?'ON':'OFF')+(allPowerCheat?'  •  FULL POWER':''),W/2,477);
  if(hiScores.length){ctx.fillStyle='#b8c6d6';ctx.font='9px Consolas,monospace';ctx.fillText(hiScores.slice(0,3).map((h,i)=>(i+1)+'. '+String(h.score).padStart(7,'0')).join('    '),W/2,503);}
  ctx.fillStyle='#6d8299';ctx.font='8px Arial';ctx.fillText('© 2026 FUKASAWA',W/2,527);ctx.restore();
};
renderIntro=function(){
  drawBackdrop(stage);ctx.fillStyle='#02081299';ctx.fillRect(0,0,W,H);
  ctx.save();ctx.textAlign='center';ctx.fillStyle='#a6b9cd';ctx.font='11px Arial';ctx.fillText('APPROACHING / 作戦宙域へ接近',W/2,175);
  ctx.font='bold 72px Arial';ctx.fillStyle='#dfe9f3';ctx.fillText('0'+stage,W/2,254);
  ctx.font='bold 25px Arial';ctx.fillText(STAGES[stage-1].name,W/2,299);
  ctx.font='12px Arial';ctx.fillStyle='#adc1d5';ctx.fillText(sectorNames[stage-1],W/2,328);
  ctx.font='9px Arial';ctx.fillStyle='#b5a28f';ctx.fillText('TARGET / '+STAGES[stage-1].bossName,W/2,373);
  ctx.fillStyle='#536577';ctx.fillRect(150,399,180,2);ctx.fillStyle='#d3e7f8';ctx.fillRect(150,399,180*Math.min(1,stageFrame/180),2);ctx.restore();
};

const originalRender=render;
render=function(){
  startButton.hidden=gameState!=='title';
  pauseButton.textContent=gameState==='paused'?'再開 ▷':'停止 Ⅱ';
  pauseButton.disabled=!['playing','paused'].includes(gameState);
  // Clear device pixels before restoring logical coordinates, including screen-shake edges.
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#050a12';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  originalRender();
};
startButton.addEventListener('click',()=>{
  if(gameState!=='title')return;
  if(!audioInited){initAudio();audioInited=true;}
  stopTitleBGM();gameState='intro';resetStage(1);stageFrame=0;startButton.hidden=true;startButton.blur();
});
pauseButton.addEventListener('click',()=>{togglePause();pauseButton.blur();});
window.addEventListener('blur',()=>{
  for(const key of Object.keys(keys))keys[key]=false;
  if(gameState==='playing')togglePause();
});
loadSprites().then(()=>{
  initGame();
  setupTouch();
  requestAnimationFrame(loop);
});
