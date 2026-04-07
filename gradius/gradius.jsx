import { useEffect, useRef } from "react";

const W = 480, H = 540;
const PU_NAMES  = ['SPEED','MSSL↓','MSSL↑','LASER','OPTION','BARRIER'];
const PU_COLORS = ['#00ffff','#ff8800','#ffcc00','#00ff88','#ff44ff','#4488ff'];

// ステージ定義
const STAGES = [
  { id:1, name:'VOLCANO',    bgTop:'#1a0800', bgBot:'#3d1000', groundColor:'#4a2000', accentColor:'#ff4400' },
  { id:2, name:'MOAI',       bgTop:'#001833', bgBot:'#002244', groundColor:'#334466', accentColor:'#88aacc' },
  { id:3, name:'PYRAMID',    bgTop:'#1a1000', bgBot:'#2d1a00', groundColor:'#5c3a00', accentColor:'#aa7700' },
  { id:4, name:'RUINS',      bgTop:'#0a0a1a', bgBot:'#1a1a2d', groundColor:'#2a2a3d', accentColor:'#6666aa' },
  { id:5, name:'ALIEN BODY', bgTop:'#0d001a', bgBot:'#1a0033', groundColor:'#3d0066', accentColor:'#cc00ff' },
  { id:6, name:'COSMOS',     bgTop:'#000008', bgBot:'#000022', groundColor:'#000033', accentColor:'#4488ff' },
  { id:7, name:'FORTRESS',    bgTop:'#050508', bgBot:'#0a0a14', groundColor:'#1a1a2a', accentColor:'#ff4444' },
];

export default function Gradius() {
  const canvasRef = useRef(null);
  const gameRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const keys = { up:false, down:false, left:false, right:false, shot:false };
    let shotPressed = false;
    let player, bullets, enemies, enemyBullets, particles, powerItems, options, terrain;
    let score, lives, gameState, frame, shotCooldown, killCount, selectCursor;
    let puCursor, speedLevel, missDownLv, missUpLv, laserLv, optionCount, barrierHp, waveCharge, waveCharging, waveCooldown;
    let stage, stageFrame, stageClear, stageClearTimer, bossSpawned, bossAlive;
    let stars, scrollX, scrollY, forceScrollActive;
    let rafId;

    // ═══════════════════════════════════════════════════
    // BGM ENGINE (Web Audio API)
    // ═══════════════════════════════════════════════════
    let audioCtx=null, masterGain=null;
    let bgmNodes=[], bgmTimer=null, bgmScheduled=[], bgmStage=0, bgmPlaying=false;
    const LOOK=0.15, TICK=0.05; // look-ahead & scheduler interval

    // ── 音符周波数テーブル ──
    const HZ={
      _:0,
      C2:65.41,D2:73.42,E2:82.41,F2:87.31,G2:98.00,Ab2:103.83,A2:110.00,Bb2:116.54,B2:123.47,
      C3:130.81,Cs3:138.59,D3:146.83,Eb3:155.56,E3:164.81,F3:174.61,Fs3:185.00,G3:196.00,Ab3:207.65,A3:220.00,Bb3:233.08,B3:246.94,
      C4:261.63,Cs4:277.18,D4:293.66,Eb4:311.13,E4:329.63,F4:349.23,Fs4:369.99,G4:392.00,Ab4:415.30,A4:440.00,Bb4:466.16,B4:493.88,
      C5:523.25,Cs5:554.37,D5:587.33,Eb5:622.25,E5:659.25,F5:698.46,Fs5:739.99,G5:783.99,Ab5:830.61,A5:880.00,Bb5:932.33,B5:987.77,
      C6:1046.50,D6:1174.66,E6:1318.51,G6:1567.98,
    };

    // ── 各ステージのBGMデータ ──
    // [周波数, 拍数] の配列。bpm基準で1拍=60/bpm秒
    const BGM_DATA=[
      { // ST1: 火山 ─ 激しく暗いドライブ感 (Aマイナー高速)
        bpm:168, swing:0,
        mel:[ [HZ.A4,1],[HZ.C5,0.5],[HZ.E5,0.5],[HZ.G5,1],[HZ.E5,0.5],[HZ.C5,0.5],
              [HZ.A4,1],[HZ.G4,0.5],[HZ.E4,0.5],[HZ.A4,2],[HZ._,1],
              [HZ.G4,1],[HZ.A4,0.5],[HZ.C5,0.5],[HZ.E5,1],[HZ.G5,0.5],[HZ.E5,0.5],
              [HZ.D5,1],[HZ.C5,1],[HZ.A4,1],[HZ.G4,1],
              [HZ.E5,1],[HZ.G5,0.5],[HZ.A5,0.5],[HZ.G5,1],[HZ.E5,0.5],[HZ.C5,0.5],
              [HZ.A4,1],[HZ.B4,1],[HZ.C5,2],[HZ._,1],
              [HZ.C5,1],[HZ.D5,1],[HZ.E5,2],[HZ.G5,1],[HZ.E5,1],
              [HZ.A4,3],[HZ._,1] ],
        bass:[ [HZ.A2,2],[HZ.A2,2],[HZ.C3,2],[HZ.G2,2],
               [HZ.A2,2],[HZ.E3,2],[HZ.A2,2],[HZ.G2,2],
               [HZ.A2,2],[HZ.A2,2],[HZ.E3,2],[HZ.A2,2],
               [HZ.C3,2],[HZ.G2,2],[HZ.A2,4] ],
        drum:1, melW:'square', bassW:'sawtooth', vol:0.16 },

      { // ST2: モアイ ─ 謎めいた島の古代リズム (Dドリアン)
        bpm:112, swing:0.05,
        mel:[ [HZ.D5,2],[HZ.F5,1],[HZ.G5,1],[HZ.A5,1.5],[HZ._,0.5],[HZ.G5,1],
              [HZ.E5,1.5],[HZ.D5,0.5],[HZ.C5,1],[HZ.D5,1],[HZ.A4,2],
              [HZ.G4,1],[HZ.A4,1],[HZ.C5,2],[HZ.D5,1],[HZ.E5,1],
              [HZ.F5,1],[HZ.E5,1],[HZ.D5,2],[HZ._,2],
              [HZ.A4,1],[HZ.C5,1],[HZ.D5,1],[HZ.F5,1],[HZ.E5,1],[HZ.D5,1],[HZ.C5,1],[HZ.A4,1],
              [HZ.G4,4],[HZ.D5,4] ],
        bass:[ [HZ.D3,4],[HZ.G3,2],[HZ.A3,2],
               [HZ.C4,4],[HZ.D3,4],
               [HZ.G3,4],[HZ.A3,2],[HZ.D3,2],
               [HZ.A3,4],[HZ.D3,4] ],
        drum:2, melW:'triangle', bassW:'sine', vol:0.14 },

      { // ST3: ピラミッド ─ エジプト旋法の呪術的メロディ (フリジアン支配音)
        bpm:126, swing:0,
        mel:[ [HZ.E5,1.5],[HZ.F5,0.5],[HZ.E5,1],[HZ.Cs5,1],[HZ.B4,1],[HZ.A4,1],
              [HZ.Ab4,2],[HZ.A4,1],[HZ.B4,1],[HZ.E4,2],
              [HZ.B4,1],[HZ.Cs5,1],[HZ.E5,2],[HZ.F5,1],[HZ.E5,1],
              [HZ.Cs5,1.5],[HZ.B4,0.5],[HZ.A4,1],[HZ.Ab4,1],[HZ.E4,2],
              [HZ.G5,1],[HZ.Fs5,0.5],[HZ.E5,0.5],[HZ.Cs5,1],[HZ.B4,1],[HZ.A4,2],
              [HZ.Ab4,1],[HZ.B4,1],[HZ.E5,4] ],
        bass:[ [HZ.E3,4],[HZ.Ab3,2],[HZ.E3,2],
               [HZ.B3,4],[HZ.E3,4],
               [HZ.A3,4],[HZ.E3,4],
               [HZ.F3,2],[HZ.E3,6] ],
        drum:3, melW:'sawtooth', bassW:'sine', vol:0.15 },

      { // ST4: 遺跡 ─ 異星の工場地帯、機械的 (不協和Aマイナー)
        bpm:140, swing:0,
        mel:[ [HZ.A4,0.5],[HZ.C5,0.5],[HZ.Eb5,1],[HZ.C5,0.5],[HZ.A4,0.5],[HZ.G4,2],
              [HZ.Eb5,1],[HZ.C5,0.5],[HZ.Bb4,0.5],[HZ.A4,1],[HZ._,1],[HZ.G4,1],[HZ.A4,1],
              [HZ.F5,1],[HZ.Eb5,1],[HZ.C5,0.5],[HZ.Bb4,0.5],[HZ.G4,2],
              [HZ.A4,0.5],[HZ.Eb5,0.5],[HZ.G5,1],[HZ.Eb5,0.5],[HZ.C5,0.5],[HZ.A4,2],
              [HZ.Bb4,1],[HZ.C5,0.5],[HZ.Eb5,0.5],[HZ.F5,1],[HZ.Eb5,0.5],[HZ.C5,0.5],
              [HZ.A4,1],[HZ.G4,1],[HZ.Eb4,2] ],
        bass:[ [HZ.A2,2],[HZ.Eb3,2],[HZ.G2,2],[HZ.A2,2],
               [HZ.G2,2],[HZ.C3,2],[HZ.Eb3,2],[HZ.A2,2],
               [HZ.A2,4],[HZ.Eb3,2],[HZ.G2,2],
               [HZ.Bb2,2],[HZ.A2,6] ],
        drum:1, melW:'sawtooth', bassW:'sawtooth', vol:0.15 },

      { // ST5: 体内 ─ 有機的・うねる・不気味 (クロマチック+5音)
        bpm:96, swing:0.08,
        mel:[ [HZ.G4,2],[HZ.Ab4,1],[HZ.G4,1],[HZ.Eb4,2],[HZ.G4,2],
              [HZ.Bb4,1],[HZ.Ab4,1],[HZ.G4,2],[HZ.Eb4,2],
              [HZ.F4,2],[HZ.G4,1],[HZ.Ab4,1],[HZ.Bb4,2],[HZ.Ab4,2],
              [HZ.G4,3],[HZ._,1],[HZ.Eb4,2],[HZ.F4,2],
              [HZ.G4,1],[HZ.Ab4,0.5],[HZ.Bb4,0.5],[HZ.Ab4,1],[HZ.G4,1],[HZ.Eb4,2],
              [HZ.G4,6],[HZ._,2] ],
        bass:[ [HZ.G2,4],[HZ.Eb3,4],[HZ.Bb2,4],[HZ.G2,4],
               [HZ.Ab2,4],[HZ.G2,4],[HZ.Eb3,4],[HZ.G2,4] ],
        drum:2, melW:'triangle', bassW:'sine', vol:0.13 },

      { // ST6: 宇宙要塞 ─ 壮大・スペースオペラ (Dマイナー叙事詩)
        bpm:132, swing:0,
        mel:[ [HZ.D5,2],[HZ.A5,2],[HZ.G5,1],[HZ.F5,1],[HZ.E5,2],
              [HZ.C5,1],[HZ.D5,1],[HZ.E5,2],[HZ.F5,1],[HZ.G5,1],
              [HZ.A5,2],[HZ.G5,1],[HZ.F5,1],[HZ.E5,2],[HZ.D5,2],
              [HZ.C5,4],[HZ.A4,4],
              [HZ.Bb4,2],[HZ.C5,1],[HZ.D5,1],[HZ.Eb5,2],[HZ.F5,2],
              [HZ.G5,1],[HZ.F5,1],[HZ.E5,2],[HZ.D5,2],[HZ.C5,2],
              [HZ.D5,3],[HZ.A4,1],[HZ.Bb4,1],[HZ.C5,1],[HZ.D5,2],
              [HZ.A4,6],[HZ._,2] ],
        bass:[ [HZ.D3,2],[HZ.A3,2],[HZ.Bb3,2],[HZ.F3,2],
               [HZ.C4,2],[HZ.G3,2],[HZ.A3,4],
               [HZ.D3,2],[HZ.Bb3,2],[HZ.F3,2],[HZ.C4,2],
               [HZ.G3,4],[HZ.D3,4] ],
        drum:4, melW:'square', bassW:'sawtooth', vol:0.16 },

      { // ST7: 要塞 ─ 最終決戦、怒涛のラッシュ (Eマイナー超高速)
        bpm:180, swing:0,
        mel:[ [HZ.E5,0.5],[HZ.G5,0.5],[HZ.B5,1],[HZ.G5,0.5],[HZ.E5,0.5],[HZ.D5,1],[HZ.B4,1],
              [HZ.C5,0.5],[HZ.E5,0.5],[HZ.G5,1],[HZ.E5,0.5],[HZ.C5,0.5],[HZ.B4,2],
              [HZ.D5,0.5],[HZ.Fs5,0.5],[HZ.A5,1],[HZ.Fs5,0.5],[HZ.D5,0.5],[HZ.C5,1],[HZ.B4,1],
              [HZ.E5,0.5],[HZ.B5,0.5],[HZ.G5,1],[HZ.E5,0.5],[HZ.G5,0.5],[HZ.B5,2],
              [HZ.G5,0.5],[HZ.A5,0.5],[HZ.B5,1],[HZ.A5,0.5],[HZ.G5,0.5],[HZ.Fs5,1],[HZ.E5,1],
              [HZ.D5,0.5],[HZ.E5,0.5],[HZ.Fs5,1],[HZ.G5,0.5],[HZ.A5,0.5],[HZ.B5,2],
              [HZ.E6,1],[HZ.B5,0.5],[HZ.G5,0.5],[HZ.Fs5,1],[HZ.E5,1],[HZ.D5,1],[HZ.B4,1],
              [HZ.E5,4] ],
        bass:[ [HZ.E3,2],[HZ.B3,2],[HZ.G3,2],[HZ.E3,2],
               [HZ.A3,2],[HZ.E3,2],[HZ.B2,2],[HZ.E3,2],
               [HZ.D3,2],[HZ.A3,2],[HZ.Fs3,2],[HZ.D3,2],
               [HZ.G3,2],[HZ.E3,6] ],
        drum:1, melW:'square', bassW:'sawtooth', vol:0.17 },
    ];

    function initAudio(){
      if(audioCtx) return;
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      masterGain=audioCtx.createGain(); masterGain.gain.value=0.55;
      masterGain.connect(audioCtx.destination);
    }

    function makeOsc(freq, type, startT, endT, vol, attack=0.01, rel=0.06){
      if(!audioCtx||freq<=0) return null;
      const osc=audioCtx.createOscillator();
      const gain=audioCtx.createGain();
      osc.type=type; osc.frequency.value=freq;
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(vol, startT+attack);
      const sustainEnd=Math.max(startT+attack, endT-rel);
      gain.gain.setValueAtTime(vol, sustainEnd);
      gain.gain.linearRampToValueAtTime(0, endT);
      osc.connect(gain); gain.connect(masterGain);
      osc.start(startT); osc.stop(endT+0.01);
      bgmNodes.push(osc);
      return osc;
    }

    function makeDrum(type, t, vol=0.2){
      if(!audioCtx) return;
      if(type==='kick'){
        const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.15,audioCtx.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);
        const src=audioCtx.createBufferSource(), g=audioCtx.createGain();
        src.buffer=buf; g.gain.setValueAtTime(vol,t); g.gain.linearRampToValueAtTime(0,t+0.12);
        const osc2=audioCtx.createOscillator(); osc2.frequency.setValueAtTime(120,t); osc2.frequency.exponentialRampToValueAtTime(40,t+0.1);
        const g2=audioCtx.createGain(); g2.gain.setValueAtTime(vol*1.5,t); g2.gain.linearRampToValueAtTime(0,t+0.12);
        osc2.connect(g2); g2.connect(masterGain); osc2.start(t); osc2.stop(t+0.15);
        src.connect(g); g.connect(masterGain); src.start(t);
        bgmNodes.push(osc2);
      } else if(type==='snare'){
        const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.12,audioCtx.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2)*0.8;
        const src=audioCtx.createBufferSource(), g=audioCtx.createGain();
        src.buffer=buf; g.gain.setValueAtTime(vol*0.7,t); g.gain.linearRampToValueAtTime(0,t+0.1);
        src.connect(g); g.connect(masterGain); src.start(t);
      } else if(type==='hihat'){
        const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.05,audioCtx.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,4)*0.5;
        const src=audioCtx.createBufferSource(), g=audioCtx.createGain();
        src.buffer=buf; g.gain.setValueAtTime(vol*0.4,t); g.gain.linearRampToValueAtTime(0,t+0.04);
        src.connect(g); g.connect(masterGain); src.start(t);
      }
    }

    function scheduleBGM(bgm, startAudioTime, beatSec){
      // メロディ
      let t=startAudioTime;
      for(const [f,beats] of bgm.mel){
        const dur=beats*beatSec;
        if(f>0) makeOsc(f, bgm.melW, t, t+dur*0.88, 0.28, 0.008, 0.05);
        t+=dur;
      }
      // ベース
      let tb=startAudioTime;
      for(const [f,beats] of bgm.bass){
        const dur=beats*beatSec;
        if(f>0) makeOsc(f, bgm.bassW, tb, tb+dur*0.75, 0.22, 0.01, 0.08);
        tb+=dur;
      }
      // ドラム
      const totalBeats=bgm.mel.reduce((a,[,b])=>a+b,0);
      const drumPatterns={
        1: (i,n,t0,b)=>{ // ロック系
          if(i%n===0||i%n===n*0.5) makeDrum('kick',t0+i*b,0.25);
          if(i%n===n*0.25||i%n===n*0.75) makeDrum('snare',t0+i*b,0.2);
          makeDrum('hihat',t0+i*b,0.15);
        },
        2: (i,n,t0,b)=>{ // スローマーチ
          if(i%n===0||i%n===n*0.5) makeDrum('kick',t0+i*b,0.2);
          if(i%n===n*0.25||i%n===n*0.625) makeDrum('snare',t0+i*b,0.18);
          if(i%2===0) makeDrum('hihat',t0+i*b,0.1);
        },
        3: (i,n,t0,b)=>{ // エジプト風タム
          if(i%n===0||i%n===n*0.375||i%n===n*0.625) makeDrum('kick',t0+i*b,0.22);
          if(i%n===n*0.5) makeDrum('snare',t0+i*b,0.18);
        },
        4: (i,n,t0,b)=>{ // 宇宙的ゆったり
          if(i%n===0||i%n===n*0.5) makeDrum('kick',t0+i*b,0.22);
          if(i%n===n*0.25||i%n===n*0.75) makeDrum('snare',t0+i*b,0.16);
          if(i%2===0) makeDrum('hihat',t0+i*b,0.12);
        },
      };
      const pat=drumPatterns[bgm.drum]||drumPatterns[1];
      const N16=Math.floor(totalBeats*4);
      const beatHalf=beatSec*0.25;
      for(let i=0;i<N16;i++){
        pat(i,N16,startAudioTime,beatHalf);
      }
      return t; // loop end time
    }

    function startBGM(stageNum){
      if(!audioCtx){ initAudio(); }
      if(audioCtx.state==='suspended') audioCtx.resume();
      stopBGM();
      bgmStage=stageNum; bgmPlaying=true;
      const bgm=BGM_DATA[stageNum-1];
      if(!bgm) return;
      const beatSec=60/bgm.bpm;
      let nextLoopAt=audioCtx.currentTime+0.05;

      function scheduleLoop(){
        if(!bgmPlaying) return;
        const now=audioCtx.currentTime;
        while(nextLoopAt < now+LOOK){
          nextLoopAt = scheduleBGM(bgm, nextLoopAt, beatSec);
        }
        bgmTimer=setTimeout(scheduleLoop, TICK*1000);
      }
      scheduleLoop();
    }

    function stopBGM(){
      bgmPlaying=false;
      if(bgmTimer){ clearTimeout(bgmTimer); bgmTimer=null; }
      for(const n of bgmNodes){ try{ n.stop(0); }catch(e){} }
      bgmNodes=[];
    }

    function fadeBGM(toStage){
      if(!masterGain||!audioCtx) return;
      const now=audioCtx.currentTime;
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now+0.4);
      setTimeout(()=>{
        stopBGM();
        masterGain.gain.setValueAtTime(0.55, audioCtx.currentTime);
        startBGM(toStage);
      }, 420);
    }
    // ═══ BGM ENGINE END ══════════════════════════════

    function playerSpeed(){ return 4.5 + speedLevel * 1.2; }

    function initStars(){
      // 3層視差: 遠景・中景・近景
      stars = [
        ...Array.from({length:80},()=>({ x:Math.random()*W, y:Math.random()*H, spd:0.15+Math.random()*0.3, size:1, bright:Math.random()*0.5+0.1, layer:0 })),
        ...Array.from({length:50},()=>({ x:Math.random()*W, y:Math.random()*H, spd:0.5+Math.random()*0.5,  size:1, bright:Math.random()*0.6+0.2, layer:1 })),
        ...Array.from({length:20},()=>({ x:Math.random()*W, y:Math.random()*H, spd:1.2+Math.random()*0.8, size:Math.random()<0.3?2:1, bright:Math.random()*0.4+0.6, layer:2 })),
      ];
    }

    function initGame(){
      stage=1; stageFrame=0; stageClear=false; stageClearTimer=0;
      bossSpawned=false; bossAlive=false; scrollX=0; scrollY=0; forceScrollActive=false;
      player = { x:80, y:H/2, w:32, h:18, invincible:0 };
      bullets=[]; enemies=[]; enemyBullets=[]; particles=[]; powerItems=[]; options=[];
      terrain=[];
      score=0; lives=3; gameState='select'; frame=0; shotCooldown=0; killCount=0;
      puCursor=-1; selectCursor=0;
      speedLevel=1; missDownLv=0; missUpLv=0; laserLv=0; optionCount=0; barrierHp=0; waveCharge=0; waveCharging=false; waveCooldown=0;
      initStars();
    }

    function startStage(stageNum, bossOnly){
      stage=stageNum; stageFrame=0; stageClear=false; stageClearTimer=0;
      bossSpawned=false; bossAlive=false; scrollX=0; scrollY=0; forceScrollActive=false;
      player = { x:80, y:H/2, w:32, h:18, invincible:0 };
      bullets=[]; enemies=[]; enemyBullets=[]; particles=[]; powerItems=[]; options=[];
      terrain=[];
      // ボスラッシュ: 全装備+無敵なし+即ボス出現
      if(bossOnly){
        speedLevel=3; missDownLv=2; missUpLv=2; laserLv=2; optionCount=4; barrierHp=0;
        for(let oi=0;oi<4;oi++) options.push({x:player.x-36*(oi+1),y:player.y,orbit:false,angle:0});
        if(stage===1) scrollX=12000;
      } else {
        speedLevel=1; missDownLv=0; missUpLv=0; laserLv=0; optionCount=0; barrierHp=0;
      }
      waveCharge=0; waveCharging=false; waveCooldown=0;
      killCount=0; puCursor=-1;
      gameState='playing';
      window._bossRush=bossOnly;
      buildTerrain();
      initAudio(); fadeBGM(stageNum);
    }

    // ─────────────────────────────────────────────────
    // TERRAIN (上下の地形)
    // ─────────────────────────────────────────────────
    function buildTerrain(){
      terrain=[];
      // 地形は画面右から伸びていくセグメント列
      for(let x=0;x<W+200;x+=20){
        terrain.push({ x, topH: getTopH(x, scrollX), botH: getBotH(x, scrollX) });
      }
    }

    function getTopH(x, sx){
      const wx = x + sx;
      switch(stage){
        case 1: { // 岩山: グラディウス風ギザギザ
          const peak = 28 + Math.abs(Math.sin(wx*0.022))*55 + Math.abs(Math.sin(wx*0.055))*25 + Math.abs(Math.sin(wx*0.11))*14;
          return Math.floor(peak);
        }
        case 2: // モアイ: 平坦+たまに柱
          return 40 + (Math.floor(wx/120)%3===0 ? 60:10);
        case 3: // ピラミッド内部: 斜め壁
          return 50 + Math.sin(wx*0.02)*15;
        case 4: // 遺跡: 段差
          return 45 + Math.floor(Math.sin(wx*0.025)*2)*25;
        case 5: // 体内: 有機的うねり
          return 55 + Math.sin(wx*0.04)*25 + Math.sin(wx*0.09)*15;
        case 6: // 宇宙: 開けている
          return 30 + Math.sin(wx*0.015)*15;
        case 7: // 要塞: 直線的・機械的
          return 55 + Math.max(0, Math.floor(Math.sin(wx*0.04))*30) + (Math.floor(wx/80)%5===0?25:0);
        default: return 50;
      }
    }
    function getBotH(x, sx){
      const wx = x + sx;
      switch(stage){
        case 1: { const peak2 = 28 + Math.abs(Math.sin(wx*0.022+1.8))*55 + Math.abs(Math.sin(wx*0.055+2.5))*25 + Math.abs(Math.sin(wx*0.11+1.2))*14; return Math.floor(peak2); }
        case 2: return 45 + (Math.floor(wx/120)%4===1 ? 55:12);
        case 3: return 50 + Math.sin(wx*0.02+1)*15;
        case 4: return 48 + Math.floor(Math.sin(wx*0.025+1)*2)*25;
        case 5: return 55 + Math.sin(wx*0.04+2)*25 + Math.sin(wx*0.08+1)*15;
        case 6: return 30 + Math.sin(wx*0.015+1)*15;
        case 7: return 55 + Math.max(0, Math.floor(Math.sin(wx*0.04+1.6))*30) + (Math.floor(wx/80)%5===1?25:0);
        default: return 50;
      }
    }

    // ─────────────────────────────────────────────────
    // POWER-UP
    // ─────────────────────────────────────────────────
    function advancePU(){
      if(puCursor >= 5) puCursor = 0;
      else puCursor = puCursor + 1;
    }

    function activatePU(){
      if(gameState!=='playing' || puCursor<0) return;
      if(puCursor===1 && missDownLv>=3) return;
      if(puCursor===2 && missUpLv>=3) return;
      if(puCursor===3 && laserLv>=4) return;
      if(puCursor===4 && optionCount>=5) return;
      const i = puCursor;
      if(i===0) speedLevel=Math.min(5,speedLevel+1);
      else if(i===1){ if(missDownLv<3) missDownLv++; }
      else if(i===2){ if(missUpLv<3) missUpLv++; if(missUpLv>=3){ puCursor=-1; return; } }
      else if(i===3){ if(laserLv<4) laserLv++; if(laserLv>=4){ puCursor=-1; return; } }
      else if(i===4){
        if(optionCount<5){
          optionCount++;
          if(optionCount<=4){
            // Lv1〜4: 後追いオプションを1個追加
            options.push({x:player.x-36*optionCount, y:player.y, orbit:false, angle:0});
          } else {
            // Lv5: 全オプション(4個)が自機の周りを等間隔で周回
            for(let j=0;j<options.length;j++){
              options[j].orbit=true;
              options[j].angle=(Math.PI*2/4)*j;
            }
          }
        }
        if(optionCount>=5){ puCursor=-1; return; }
      }
      else if(i===5) barrierHp=15;
      puCursor=-1;
    }

    // ─────────────────────────────────────────────────
    // DRAW PLAYER
    // ─────────────────────────────────────────────────
    function drawPlayer(x, y, inv){
      if(inv>0 && Math.floor(inv/4)%2===1) return;
      ctx.save();
      const cx=Math.floor(x), cy=Math.floor(y);
      const ft=frame*0.14;

      // ── エンジン噴射（3連ノズル）─────────────────────
      const nozzleOfs=[-7, 0, 7];
      for(let ni=0;ni<3;ni++){
        const ny=cy+nozzleOfs[ni];
        const flen=16+Math.sin(ft+ni*1.1)*6;
        // 外炎（青白い）
        const fg=ctx.createLinearGradient(cx-20,ny,cx-20-flen,ny);
        fg.addColorStop(0,'rgba(140,200,255,0.9)');
        fg.addColorStop(0.2,'rgba(80,140,255,0.6)');
        fg.addColorStop(0.6,'rgba(40,80,200,0.3)');
        fg.addColorStop(1,'rgba(0,20,160,0)');
        ctx.fillStyle=fg;
        const hw=ni===1?3.5:2.5;
        ctx.beginPath();
        ctx.moveTo(cx-20, ny-hw);
        ctx.lineTo(cx-20-flen*0.7, ny-hw*0.4);
        ctx.lineTo(cx-20-flen, ny);
        ctx.lineTo(cx-20-flen*0.7, ny+hw*0.4);
        ctx.lineTo(cx-20, ny+hw);
        ctx.closePath(); ctx.fill();
        // コア（白熱）
        ctx.shadowColor='#aaddff'; ctx.shadowBlur=ni===1?10:6;
        ctx.fillStyle='rgba(220,240,255,0.95)';
        ctx.beginPath(); ctx.ellipse(cx-20,ny,3,hw*0.4,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
      }

      // ── ノズルブロック（後部エンジンポッド）─────────
      // 上段エンジンポッド
      const podG=ctx.createLinearGradient(cx-22,cy-10,cx-22,cy-6);
      podG.addColorStop(0,'#b8c8d8'); podG.addColorStop(0.5,'#8090a8'); podG.addColorStop(1,'#4a5868');
      ctx.fillStyle=podG;
      ctx.fillRect(cx-22,cy-10,7,5); // 上ポッド
      ctx.fillRect(cx-22,cy+5, 7,5); // 下ポッド
      // ポッドの縁
      ctx.strokeStyle='rgba(180,210,240,0.5)'; ctx.lineWidth=0.6;
      ctx.strokeRect(cx-22,cy-10,7,5);
      ctx.strokeRect(cx-22,cy+5,7,5);
      // ノズル開口（オレンジコア）
      ctx.fillStyle='#ff6600';
      ctx.fillRect(cx-22,cy-9,2,3);
      ctx.fillRect(cx-22,cy+6,2,3);
      // ノズルリンググロー
      ctx.shadowColor='#ff8800'; ctx.shadowBlur=8;
      ctx.fillStyle='rgba(255,160,60,0.7)';
      ctx.fillRect(cx-23,cy-9,2,3);
      ctx.fillRect(cx-23,cy+6,2,3);
      ctx.shadowBlur=0;

      // ── 主翼（前進デルタ・広翼）─────────────────────
      // 翼ベース色（白銀）
      const wBaseG=ctx.createLinearGradient(cx,cy,cx-14,cy-30);
      wBaseG.addColorStop(0,'#c8d8e8'); wBaseG.addColorStop(0.4,'#a0b8cc'); wBaseG.addColorStop(1,'#607888');

      // 上翼
      ctx.fillStyle=wBaseG;
      ctx.beginPath();
      ctx.moveTo(cx+8,  cy-1);   // 翼付根前
      ctx.lineTo(cx+12, cy-8);   // 前縁起点
      ctx.lineTo(cx+4,  cy-16);  // 前縁中間
      ctx.lineTo(cx-6,  cy-28);  // 翼端前
      ctx.lineTo(cx-16, cy-30);  // 翼端後
      ctx.lineTo(cx-20, cy-5);   // 付根後
      ctx.closePath(); ctx.fill();
      // 翼上面グラデ（立体感）
      const wTopG=ctx.createLinearGradient(cx+12,cy-8,cx-16,cy-30);
      wTopG.addColorStop(0,'rgba(255,255,255,0.35)');
      wTopG.addColorStop(0.5,'rgba(180,200,220,0.15)');
      wTopG.addColorStop(1,'rgba(50,80,120,0.4)');
      ctx.fillStyle=wTopG;
      ctx.beginPath();
      ctx.moveTo(cx+8,cy-1); ctx.lineTo(cx+12,cy-8); ctx.lineTo(cx+4,cy-16);
      ctx.lineTo(cx-6,cy-28); ctx.lineTo(cx-16,cy-30); ctx.lineTo(cx-20,cy-5);
      ctx.closePath(); ctx.fill();
      // 翼前縁ライン（青アクセント）
      ctx.shadowColor='#4488ff'; ctx.shadowBlur=8;
      ctx.strokeStyle='rgba(80,160,255,0.9)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx+12,cy-8); ctx.lineTo(cx+4,cy-16); ctx.lineTo(cx-6,cy-28); ctx.stroke();
      ctx.shadowBlur=0;
      // 翼端ライン
      ctx.strokeStyle='rgba(60,120,200,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(cx-6,cy-28); ctx.lineTo(cx-16,cy-30); ctx.stroke();
      // 翼パネルライン（精密感）
      ctx.strokeStyle='rgba(80,100,140,0.4)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(cx+6,cy-4); ctx.lineTo(cx-8,cy-26); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+2,cy-3); ctx.lineTo(cx-13,cy-22); ctx.stroke();
      // 翼面の青ストライプ
      ctx.strokeStyle='rgba(40,100,200,0.55)'; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(cx+4,cy-7); ctx.lineTo(cx-10,cy-24); ctx.stroke();

      // 下翼（対称）
      const wBaseG2=ctx.createLinearGradient(cx,cy,cx-14,cy+30);
      wBaseG2.addColorStop(0,'#c8d8e8'); wBaseG2.addColorStop(0.4,'#a0b8cc'); wBaseG2.addColorStop(1,'#607888');
      ctx.fillStyle=wBaseG2;
      ctx.beginPath();
      ctx.moveTo(cx+8,  cy+1);
      ctx.lineTo(cx+12, cy+8);
      ctx.lineTo(cx+4,  cy+16);
      ctx.lineTo(cx-6,  cy+28);
      ctx.lineTo(cx-16, cy+30);
      ctx.lineTo(cx-20, cy+5);
      ctx.closePath(); ctx.fill();
      const wBotG=ctx.createLinearGradient(cx+12,cy+8,cx-16,cy+30);
      wBotG.addColorStop(0,'rgba(255,255,255,0.35)');
      wBotG.addColorStop(0.5,'rgba(180,200,220,0.15)');
      wBotG.addColorStop(1,'rgba(50,80,120,0.4)');
      ctx.fillStyle=wBotG;
      ctx.beginPath();
      ctx.moveTo(cx+8,cy+1); ctx.lineTo(cx+12,cy+8); ctx.lineTo(cx+4,cy+16);
      ctx.lineTo(cx-6,cy+28); ctx.lineTo(cx-16,cy+30); ctx.lineTo(cx-20,cy+5);
      ctx.closePath(); ctx.fill();
      ctx.shadowColor='#4488ff'; ctx.shadowBlur=8;
      ctx.strokeStyle='rgba(80,160,255,0.9)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx+12,cy+8); ctx.lineTo(cx+4,cy+16); ctx.lineTo(cx-6,cy+28); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(60,120,200,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(cx-6,cy+28); ctx.lineTo(cx-16,cy+30); ctx.stroke();
      ctx.strokeStyle='rgba(80,100,140,0.4)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(cx+6,cy+4); ctx.lineTo(cx-8,cy+26); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+2,cy+3); ctx.lineTo(cx-13,cy+22); ctx.stroke();
      ctx.strokeStyle='rgba(40,100,200,0.55)'; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(cx+4,cy+7); ctx.lineTo(cx-10,cy+24); ctx.stroke();

      // ── 胴体（白銀ボディ・精密モデル）───────────────
      // メインボディ（幅広めの流線型）
      const bdBase=ctx.createLinearGradient(cx+28,cy-8,cx+28,cy+8);
      bdBase.addColorStop(0,'#dde8f0'); bdBase.addColorStop(0.2,'#c0d0e0');
      bdBase.addColorStop(0.5,'#a0b8cc'); bdBase.addColorStop(0.8,'#7890a8'); bdBase.addColorStop(1,'#506070');
      ctx.fillStyle=bdBase;
      ctx.beginPath();
      ctx.moveTo(cx+30, cy);        // 機首
      ctx.lineTo(cx+22, cy-7);      // 上前
      ctx.lineTo(cx+10, cy-9);      // 上中前
      ctx.lineTo(cx+0,  cy-8);      // 上中後
      ctx.lineTo(cx-8,  cy-7);
      ctx.lineTo(cx-20, cy-4);      // 上後
      ctx.lineTo(cx-20, cy+4);
      ctx.lineTo(cx-8,  cy+7);
      ctx.lineTo(cx+0,  cy+8);
      ctx.lineTo(cx+10, cy+9);
      ctx.lineTo(cx+22, cy+7);
      ctx.closePath(); ctx.fill();

      // 上面ハイライト（明るい帯）
      const bdHL=ctx.createLinearGradient(cx+28,cy-9,cx+28,cy-2);
      bdHL.addColorStop(0,'rgba(255,255,255,0.7)');
      bdHL.addColorStop(1,'rgba(200,220,240,0.1)');
      ctx.fillStyle=bdHL;
      ctx.beginPath();
      ctx.moveTo(cx+30,cy); ctx.lineTo(cx+22,cy-7); ctx.lineTo(cx+10,cy-9);
      ctx.lineTo(cx,cy-8); ctx.lineTo(cx-8,cy-7); ctx.lineTo(cx-20,cy-4);
      ctx.lineTo(cx-20,cy-1); ctx.lineTo(cx-8,cy-4); ctx.lineTo(cx,cy-5);
      ctx.lineTo(cx+10,cy-6); ctx.lineTo(cx+22,cy-4);
      ctx.closePath(); ctx.fill();

      // 胴体稜線グロー（上縁）
      ctx.shadowColor='#88aacc'; ctx.shadowBlur=6;
      ctx.strokeStyle='rgba(200,220,255,0.6)'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(cx+30,cy); ctx.lineTo(cx+22,cy-7); ctx.lineTo(cx+10,cy-9);
      ctx.lineTo(cx,cy-8); ctx.lineTo(cx-8,cy-7); ctx.lineTo(cx-20,cy-4);
      ctx.stroke();
      ctx.shadowBlur=0;

      // ── 青アクセントストライプ（胴体側面）────────────
      ctx.fillStyle='#2a6ab8';
      // 上ストライプ
      ctx.beginPath();
      ctx.moveTo(cx+18,cy-6); ctx.lineTo(cx+4,cy-7); ctx.lineTo(cx+4,cy-5); ctx.lineTo(cx+18,cy-4);
      ctx.closePath(); ctx.fill();
      // 下ストライプ
      ctx.beginPath();
      ctx.moveTo(cx+18,cy+6); ctx.lineTo(cx+4,cy+7); ctx.lineTo(cx+4,cy+5); ctx.lineTo(cx+18,cy+4);
      ctx.closePath(); ctx.fill();
      // ストライプグロー
      ctx.shadowColor='#4488ff'; ctx.shadowBlur=5;
      ctx.fillStyle='rgba(80,160,255,0.4)';
      ctx.beginPath(); ctx.moveTo(cx+18,cy-5); ctx.lineTo(cx+4,cy-6); ctx.lineTo(cx+4,cy-5); ctx.lineTo(cx+18,cy-4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx+18,cy+5); ctx.lineTo(cx+4,cy+6); ctx.lineTo(cx+4,cy+5); ctx.lineTo(cx+18,cy+4); ctx.closePath(); ctx.fill();
      ctx.shadowBlur=0;

      // 胴体パネルライン
      ctx.strokeStyle='rgba(100,130,170,0.45)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(cx+2,cy-8); ctx.lineTo(cx+2,cy+8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-8,cy-7); ctx.lineTo(cx-8,cy+7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+12,cy-9); ctx.lineTo(cx+12,cy+9); ctx.stroke();
      // 機体中央ライン
      ctx.strokeStyle='rgba(160,190,220,0.3)'; ctx.lineWidth=0.6;
      ctx.beginPath(); ctx.moveTo(cx-18,cy); ctx.lineTo(cx+28,cy); ctx.stroke();

      // ── コックピットモジュール（前部センター）─────────
      // コックピット台座
      const cpBase=ctx.createLinearGradient(cx+12,cy-6,cx+24,cy+6);
      cpBase.addColorStop(0,'#8090a0'); cpBase.addColorStop(0.5,'#60788a'); cpBase.addColorStop(1,'#3a4a5a');
      ctx.fillStyle=cpBase;
      ctx.beginPath();
      ctx.moveTo(cx+24,cy-3); ctx.lineTo(cx+14,cy-6); ctx.lineTo(cx+10,cy-5);
      ctx.lineTo(cx+10,cy+5); ctx.lineTo(cx+14,cy+6); ctx.lineTo(cx+24,cy+3);
      ctx.closePath(); ctx.fill();
      // キャノピーガラス（菱形・暗青）
      const cpGlass=ctx.createLinearGradient(cx+24,cy-3,cx+12,cy+3);
      cpGlass.addColorStop(0,'rgba(160,200,240,0.8)');
      cpGlass.addColorStop(0.3,'rgba(60,120,200,0.7)');
      cpGlass.addColorStop(0.7,'rgba(20,60,140,0.85)');
      cpGlass.addColorStop(1,'rgba(10,30,80,0.9)');
      ctx.fillStyle=cpGlass;
      ctx.beginPath();
      ctx.moveTo(cx+24,cy-2); ctx.lineTo(cx+15,cy-5); ctx.lineTo(cx+11,cy-4);
      ctx.lineTo(cx+11,cy+4); ctx.lineTo(cx+15,cy+5); ctx.lineTo(cx+24,cy+2);
      ctx.closePath(); ctx.fill();
      // キャノピーフレーム
      ctx.strokeStyle='rgba(120,170,220,0.6)'; ctx.lineWidth=0.8;
      ctx.beginPath();
      ctx.moveTo(cx+24,cy-2); ctx.lineTo(cx+15,cy-5); ctx.lineTo(cx+11,cy-4);
      ctx.lineTo(cx+11,cy+4); ctx.lineTo(cx+15,cy+5); ctx.lineTo(cx+24,cy+2);
      ctx.closePath(); ctx.stroke();
      // ハイライト
      ctx.fillStyle='rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(cx+23,cy-1); ctx.lineTo(cx+16,cy-4); ctx.lineTo(cx+13,cy-3); ctx.lineTo(cx+14,cy-1); ctx.closePath(); ctx.fill();

      // ── 機首スパイク（極細・メタリック）─────────────
      const noseG=ctx.createLinearGradient(cx+28,cy-3,cx+32,cy);
      noseG.addColorStop(0,'#d0e0f0'); noseG.addColorStop(0.4,'#ffffff'); noseG.addColorStop(1,'#8098b0');
      ctx.fillStyle=noseG;
      ctx.beginPath();
      ctx.moveTo(cx+34, cy);
      ctx.lineTo(cx+28, cy-3);
      ctx.lineTo(cx+26, cy-2);
      ctx.lineTo(cx+26, cy+2);
      ctx.lineTo(cx+28, cy+3);
      ctx.closePath(); ctx.fill();
      ctx.shadowColor='#c8e0ff'; ctx.shadowBlur=10;
      ctx.strokeStyle='rgba(200,230,255,0.7)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(cx+34,cy); ctx.lineTo(cx+28,cy-3); ctx.stroke();
      ctx.shadowBlur=0;

      // ── バリア（六角シールド）───────────────────────
      if(barrierHp>0){
        const alpha=0.25+0.5*(barrierHp/15);
        const br=frame*0.025;
        ctx.shadowColor='#44aaff'; ctx.shadowBlur=16;
        ctx.strokeStyle=`rgba(80,180,255,${alpha})`;
        ctx.lineWidth=1.8;
        ctx.beginPath();
        for(let i=0;i<6;i++){
          const a=(Math.PI/3)*i+br;
          i===0?ctx.moveTo(cx+Math.cos(a)*36,cy+Math.sin(a)*24):ctx.lineTo(cx+Math.cos(a)*36,cy+Math.sin(a)*24);
        }
        ctx.closePath(); ctx.stroke();
        ctx.shadowBlur=0;
        ctx.fillStyle=`rgba(40,120,255,0.04)`;
        ctx.beginPath();
        for(let i=0;i<6;i++){
          const a=(Math.PI/3)*i+br;
          i===0?ctx.moveTo(cx+Math.cos(a)*36,cy+Math.sin(a)*24):ctx.lineTo(cx+Math.cos(a)*36,cy+Math.sin(a)*24);
        }
        ctx.closePath(); ctx.fill();
        const fp=(frame*0.04)%(Math.PI*2);
        ctx.fillStyle=`rgba(120,200,255,${alpha*0.9})`;
        for(let i=0;i<6;i++){
          const a=(Math.PI/3)*i+br+fp;
          ctx.beginPath(); ctx.arc(cx+Math.cos(a)*36,cy+Math.sin(a)*24,1.8,0,Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawOption(x, y, inv){
      if(inv>0 && Math.floor(inv/4)%2===1) return;
      ctx.save();
      const t=frame*0.05;
      const ox=Math.floor(x), oy=Math.floor(y);

      // ── 外周スキャンリング ──
      ctx.strokeStyle=`rgba(80,200,255,${0.35+Math.sin(t*2)*0.15})`; ctx.lineWidth=1;
      ctx.shadowColor='#40c0ff'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(ox,oy,14+Math.sin(t*3)*1.5,0,Math.PI*2); ctx.stroke();
      ctx.shadowBlur=0;

      // ── 回転する外装フィン（4枚）──
      ctx.save(); ctx.translate(ox,oy); ctx.rotate(t*0.8);
      ctx.fillStyle='#1a3050';
      ctx.strokeStyle='#4090c0'; ctx.lineWidth=0.8;
      for(let i=0;i<4;i++){
        ctx.save(); ctx.rotate((Math.PI/2)*i);
        ctx.beginPath();
        ctx.moveTo(0,-10);
        ctx.lineTo(3,-14);
        ctx.lineTo(-3,-14);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // ── 六角形フレーム ──
      ctx.save(); ctx.translate(ox,oy); ctx.rotate(-t*0.4);
      ctx.strokeStyle='#2a6090'; ctx.lineWidth=1.5;
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const a=(Math.PI/3)*i - Math.PI/6;
        i===0?ctx.moveTo(Math.cos(a)*10,Math.sin(a)*10):ctx.lineTo(Math.cos(a)*10,Math.sin(a)*10);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();

      // ── コア（六角形内部）──
      const cg=ctx.createRadialGradient(ox,oy,0,ox,oy,7);
      cg.addColorStop(0,'#e8f8ff');
      cg.addColorStop(0.4,'#60d0ff');
      cg.addColorStop(0.8,'#0080c0');
      cg.addColorStop(1,'#003060');
      ctx.fillStyle=cg;
      ctx.shadowColor='#40c0ff'; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(ox,oy,7,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;

      // ── コア中心の十字スキャンライン ──
      ctx.strokeStyle='rgba(200,240,255,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ox-5,oy); ctx.lineTo(ox+5,oy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox,oy-5); ctx.lineTo(ox,oy+5); ctx.stroke();

      // ── ハイライト ──
      ctx.fillStyle='rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(ox-2,oy-2,2.5,1.5,-0.4,0,Math.PI*2); ctx.fill();

      ctx.restore();
    }
    // ─────────────────────────────────────────────────
    // DRAW ENEMIES per stage type
    // ─────────────────────────────────────────────────
    function hpBar(x,y,hp,maxHp,w){
      const r=hp/maxHp;
      // 背景トラック
      ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(x-w/2-1,y-1,w+2,8);
      ctx.fillStyle='#0a0e14';         ctx.fillRect(x-w/2,y,w,6);
      // バー本体（グラデ）
      const col= r>0.6?'#00c8a0': r>0.3?'#e0a020':'#d02020';
      const glw= r>0.6?'#00ffcc': r>0.3?'#ffcc00':'#ff3030';
      const hg=ctx.createLinearGradient(x-w/2,y,x-w/2,y+6);
      hg.addColorStop(0, col+'dd');
      hg.addColorStop(0.5,'#ffffff44');
      hg.addColorStop(1, col+'99');
      ctx.fillStyle=hg; ctx.shadowColor=glw; ctx.shadowBlur=6;
      ctx.fillRect(x-w/2,y,w*r,6);
      ctx.shadowBlur=0;
      // 枠線
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=0.5;
      ctx.strokeRect(x-w/2,y,w,6);
      // セグメントライン（5分割）
      ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=0.5;
      for(let s=1;s<5;s++){
        const sx=x-w/2+w*s/5;
        ctx.beginPath(); ctx.moveTo(sx,y); ctx.lineTo(sx,y+6); ctx.stroke();
      }
    }
    function drawEnemy(e){
      ctx.save();
      const x=Math.floor(e.x), y=Math.floor(e.y);
      const t=frame*0.05;

      switch(e.kind){

      /* ══════════════════════════════════════════════
         STAGE 1: 火山
      ══════════════════════════════════════════════ */
      case 'fireBird':{
        // 炎の猛禽 ─ 溶岩を纏った肉食鳥
        const sz=e.isBoss?1.8:1;
        ctx.save(); ctx.scale(sz,sz); ctx.translate(x/sz-x,y/sz-y);
        const fp=frame*0.22, flap=Math.sin(fp)*16;
        // 炎の尾羽（複数）
        for(let fi=0;fi<3;fi++){
          const fang=[-0.25,0,0.25][fi], flen=22+fi*4;
          const tG=ctx.createLinearGradient(x-6,y,x-6-flen,y);
          tG.addColorStop(0,'rgba(255,180,0,0.9)'); tG.addColorStop(0.5,'rgba(255,60,0,0.6)'); tG.addColorStop(1,'rgba(200,0,0,0)');
          ctx.fillStyle=tG; ctx.shadowColor='#ff3300'; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.moveTo(x-6,y+fang*8);
          ctx.bezierCurveTo(x-14,y+fang*14,x-22,y+fang*16,x-6-flen,y+fang*12);
          ctx.bezierCurveTo(x-20,y+fang*8,x-12,y+fang*4,x-6,y+fang*4);
          ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur=0;
        // 翼（後退翼・鋭い羽）
        const wG=ctx.createLinearGradient(x,y,x-10,y-18+flap);
        wG.addColorStop(0,'#cc2200'); wG.addColorStop(0.4,'#ff5500'); wG.addColorStop(1,'#ff9900');
        ctx.fillStyle=wG;
        ctx.beginPath(); ctx.moveTo(x+6,y-2); ctx.bezierCurveTo(x-4,y-10,x-14,y-18+flap,x-18,y-20+flap);
        ctx.bezierCurveTo(x-10,y-10,x-2,y-4,x+4,y-2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+6,y+2); ctx.bezierCurveTo(x-4,y+10,x-14,y+18-flap,x-18,y+20-flap);
        ctx.bezierCurveTo(x-10,y+10,x-2,y+4,x+4,y+2); ctx.closePath(); ctx.fill();
        // 翼の羽根筋（細い）
        ctx.strokeStyle='rgba(255,200,0,0.5)'; ctx.lineWidth=1;
        for(let ri=0;ri<3;ri++){
          const rt=0.3+ri*0.25;
          ctx.beginPath(); ctx.moveTo(x+2,y-rt*4); ctx.lineTo(x-18*rt,y-20*rt+flap*rt); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x+2,y+rt*4); ctx.lineTo(x-18*rt,y+20*rt-flap*rt); ctx.stroke();
        }
        // 胴体（流線型）
        const bG3=ctx.createRadialGradient(x+2,y-2,2,x,y,12);
        bG3.addColorStop(0,'#ffcc44'); bG3.addColorStop(0.3,'#ff5500'); bG3.addColorStop(0.7,'#cc1100'); bG3.addColorStop(1,'#660000');
        ctx.fillStyle=bG3; ctx.shadowColor='#ff2200'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.ellipse(x,y,13,7,-0.1,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 鉤嘴の頭
        ctx.fillStyle='#cc2200';
        ctx.beginPath(); ctx.ellipse(x+13,y-1,7,5,0,0,Math.PI*2); ctx.fill();
        // 鉤嘴（鋭く曲がる）
        ctx.fillStyle='#ff8800';
        ctx.beginPath(); ctx.moveTo(x+18,y-2); ctx.bezierCurveTo(x+24,y-3,x+26,y+1,x+22,y+4); ctx.lineTo(x+20,y+2); ctx.bezierCurveTo(x+22,y,x+22,-1,x+18,y-2); ctx.closePath(); ctx.fill();
        // 目（爬虫類的・縦長瞳孔）
        ctx.fillStyle='#ff8800'; ctx.shadowColor='#ffcc00'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.ellipse(x+16,y-3,4,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1a0000'; ctx.beginPath(); ctx.ellipse(x+16,y-3,1.5,3.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,200,0.7)'; ctx.beginPath(); ctx.arc(x+15,y-5,1.2,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.restore();
        if(e.isBoss) hpBar(x,y-42,e.hp,30,70);
        break;
      }

      case 'lavaBall':{
        // 溶岩球 ─ 脈動するマグマコア
        const pulse=1+Math.sin(t*1.2+e.seed)*0.12;
        const r=11*pulse;
        // 外層の溶岩
        ctx.shadowColor='#ff4400'; ctx.shadowBlur=14;
        const lG=ctx.createRadialGradient(x,y,r*0.3,x,y,r);
        lG.addColorStop(0,'#ffdd44'); lG.addColorStop(0.4,'#ff6600'); lG.addColorStop(0.8,'#cc1100'); lG.addColorStop(1,'#660000');
        ctx.fillStyle=lG; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // ひびわれ模様
        ctx.strokeStyle='rgba(255,180,0,0.5)'; ctx.lineWidth=1;
        for(let i=0;i<5;i++){
          const a=(Math.PI*2/5)*i+e.seed;
          const x1=x+Math.cos(a)*r*0.3, y1=y+Math.sin(a)*r*0.3;
          const x2=x+Math.cos(a+0.4)*r*0.9, y2=y+Math.sin(a+0.4)*r*0.9;
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        }
        // 中心コア輝き
        const cG=ctx.createRadialGradient(x-2,y-2,1,x,y,r*0.4);
        cG.addColorStop(0,'rgba(255,255,200,0.9)'); cG.addColorStop(1,'rgba(255,200,0,0)');
        ctx.fillStyle=cG; ctx.beginPath(); ctx.arc(x,y,r*0.4,0,Math.PI*2); ctx.fill();
        // しぶき
        ctx.fillStyle='rgba(255,120,0,0.7)'; ctx.shadowColor='#ff4400'; ctx.shadowBlur=4;
        for(let i=0;i<4;i++){
          const a=(Math.PI/2)*i+t*0.5+e.seed;
          ctx.beginPath(); ctx.arc(x+Math.cos(a)*(r+5),y+Math.sin(a)*(r+5),3,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
        break;
      }

      case 'fireDrake':{
        // 小型火竜 ─ 凶暴なドラゴン
        const flap=Math.sin(frame*0.38)*10;
        // 翼（骨格入り膜翼）
        ctx.fillStyle='rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.moveTo(x-2,y-4); ctx.bezierCurveTo(x-8,y-14,x-20,y-22+flap,x-24,y-20+flap); ctx.bezierCurveTo(x-16,y-8,x-8,y-4,x-2,y-4); ctx.closePath(); ctx.fill();
        const dwG=ctx.createLinearGradient(x,y-4,x-22,y-18+flap);
        dwG.addColorStop(0,'#991100'); dwG.addColorStop(0.5,'#cc2200'); dwG.addColorStop(1,'rgba(100,10,0,0.5)');
        ctx.fillStyle=dwG;
        ctx.beginPath(); ctx.moveTo(x-2,y-4); ctx.bezierCurveTo(x-8,y-14,x-20,y-22+flap,x-24,y-20+flap); ctx.bezierCurveTo(x-16,y-8,x-8,y-4,x-2,y-4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(255,80,0,0.6)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-2,y-4); ctx.lineTo(x-24,y-20+flap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-8,y-8); ctx.lineTo(x-18,y-22+flap); ctx.stroke();
        // 尾
        ctx.strokeStyle='#881100'; ctx.lineWidth=6; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x-12,y+3); ctx.bezierCurveTo(x-22,y+8,x-26,y+2,x-24,y-4); ctx.stroke();
        ctx.strokeStyle='#cc2200'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(x-12,y+3); ctx.bezierCurveTo(x-22,y+8,x-26,y+2,x-24,y-4); ctx.stroke();
        // 胴体（鱗付き）
        const dG2=ctx.createRadialGradient(x-4,y-3,2,x-2,y,13);
        dG2.addColorStop(0,'#ff5500'); dG2.addColorStop(0.4,'#cc2200'); dG2.addColorStop(0.8,'#8a1000'); dG2.addColorStop(1,'#440000');
        ctx.fillStyle=dG2; ctx.shadowColor='#ff2200'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.ellipse(x-2,y,14,7,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle='rgba(200,50,0,0.45)'; ctx.lineWidth=1.5;
        for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(x-10+i*6,y+2,4,0,Math.PI); ctx.stroke(); }
        // 首・頭（竜らしい）
        ctx.fillStyle='#aa1500';
        ctx.beginPath(); ctx.ellipse(x+9,y-1,8,6,0,0,Math.PI*2); ctx.fill();
        // 頭の輪郭
        const dhG2=ctx.createRadialGradient(x+10,y-2,2,x+10,y,7);
        dhG2.addColorStop(0,'#ff4400'); dhG2.addColorStop(0.5,'#cc1800'); dhG2.addColorStop(1,'#660800');
        ctx.fillStyle=dhG2;
        ctx.beginPath(); ctx.moveTo(x+6,y+4); ctx.lineTo(x+5,y-4); ctx.bezierCurveTo(x+7,y-8,x+14,y-8,x+18,y-4); ctx.lineTo(x+18,y+2); ctx.bezierCurveTo(x+16,y+5,x+8,y+5,x+6,y+4); ctx.closePath(); ctx.fill();
        // 角（鋭く）
        ctx.fillStyle='#ffaa00'; ctx.shadowColor='#ff6600'; ctx.shadowBlur=4;
        ctx.beginPath(); ctx.moveTo(x+10,y-7); ctx.lineTo(x+12,y-16); ctx.lineTo(x+15,y-7); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 牙
        ctx.fillStyle='#ffeecc';
        ctx.beginPath(); ctx.moveTo(x+8,y+2); ctx.lineTo(x+9,y+8); ctx.lineTo(x+11,y+2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+13,y+1); ctx.lineTo(x+14,y+7); ctx.lineTo(x+16,y+1); ctx.closePath(); ctx.fill();
        // 目（縦長爬虫類）
        ctx.fillStyle='#ff8800'; ctx.shadowColor='#ffcc00'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x+15,y-2,3.5,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1a0000'; ctx.beginPath(); ctx.ellipse(x+15,y-2,1.2,2.8,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        break;
      }

      case 'emberSprite':{
        // 炎の悪霊 ─ 炎を纏った凶暴な火の精
        const ft=t*1.5+e.seed;
        ctx.shadowColor='#ff3300'; ctx.shadowBlur=14;
        // 外炎（大きく不規則）
        ctx.fillStyle='rgba(255,60,0,0.25)';
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.2){
          const fr=12+Math.sin(a*5+ft)*4+Math.cos(a*3+ft*1.3)*3;
          a<0.1?ctx.moveTo(x+Math.cos(a)*fr,y+Math.sin(a)*fr):ctx.lineTo(x+Math.cos(a)*fr,y+Math.sin(a)*fr);
        }
        ctx.closePath(); ctx.fill();
        // 中層炎（激しく揺れる）
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.22){
          const fr=8+Math.sin(a*6+ft*1.4)*3+Math.cos(a*4+ft)*2;
          a<0.1?ctx.moveTo(x+Math.cos(a)*fr,y+Math.sin(a)*fr):ctx.lineTo(x+Math.cos(a)*fr,y+Math.sin(a)*fr);
        }
        ctx.closePath();
        const eG2=ctx.createRadialGradient(x,y,1,x,y,10);
        eG2.addColorStop(0,'#ffffff'); eG2.addColorStop(0.2,'#ffee44'); eG2.addColorStop(0.5,'#ff6600'); eG2.addColorStop(1,'rgba(180,20,0,0)');
        ctx.fillStyle=eG2; ctx.fill();
        // コア（白熱した核）
        const ecG=ctx.createRadialGradient(x-1,y-1,0,x,y,4);
        ecG.addColorStop(0,'rgba(255,255,255,0.95)'); ecG.addColorStop(1,'rgba(255,180,0,0.6)');
        ctx.fillStyle=ecG; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
        // 炎の突起（鋭く伸びる）
        ctx.shadowColor='#ff6600'; ctx.shadowBlur=6;
        for(let i=0;i<6;i++){
          const fa=(Math.PI*2/6)*i+ft*0.6;
          const flen=8+Math.sin(ft*2+i)*3;
          ctx.strokeStyle=`rgba(255,${100+i*20},0,0.7)`; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(fa)*5,y+Math.sin(fa)*5); ctx.lineTo(x+Math.cos(fa)*flen,y+Math.sin(fa)*flen); ctx.stroke();
        }
        ctx.shadowBlur=0;
        break;
      }

      /* ══════════════════════════════════════════════
         STAGE 2: モアイ
      ══════════════════════════════════════════════ */
      case 'moai':{
        // モアイ ─ リアルな石像（イースター島のモアイ）
        // ── 石材の基本色（玄武岩調: 青みがかった暗灰）
        const stoneBase='#4a4e58';
        const stoneMid ='#5e6470';
        const stoneHi  ='#7a8090';
        const stoneSha ='#2e3038';

        // アフ（石積み台座）: 地面に固定された横長プラットフォーム
        const ahuG=ctx.createLinearGradient(x-22,y+18,x+22,y+36);
        ahuG.addColorStop(0,'#3a3830'); ahuG.addColorStop(0.3,'#4e4c42'); ahuG.addColorStop(0.7,'#3a3830'); ahuG.addColorStop(1,'#28261e');
        ctx.fillStyle=ahuG;
        // アフ本体（横長台形）
        ctx.beginPath(); ctx.moveTo(x-28,y+36); ctx.lineTo(x-22,y+18); ctx.lineTo(x+22,y+18); ctx.lineTo(x+28,y+36); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#1c1a14'; ctx.lineWidth=0.8; ctx.stroke();
        // アフの石積みライン
        ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-26,y+22); ctx.lineTo(x+26,y+22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-27,y+28); ctx.lineTo(x+27,y+28); ctx.stroke();
        // アフ上面のエッジハイライト
        ctx.strokeStyle='rgba(120,115,95,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-22,y+18); ctx.lineTo(x+22,y+18); ctx.stroke();
        // 地面との接地面（草）
        ctx.fillStyle='rgba(60,90,30,0.55)';
        ctx.beginPath(); ctx.ellipse(x,y+36,32,4,0,0,Math.PI*2); ctx.fill();

        // 胴体（体幹）: 縦長の直方体、左右に腕のラインが彫られている
        const bodyG=ctx.createLinearGradient(x-12,y+18,x+12,y+18);
        bodyG.addColorStop(0,stoneSha); bodyG.addColorStop(0.25,stoneBase); bodyG.addColorStop(0.55,stoneMid); bodyG.addColorStop(0.75,stoneBase); bodyG.addColorStop(1,stoneSha);
        ctx.fillStyle=bodyG; ctx.fillRect(x-12,y-6,24,26);
        // 胴の上辺ハイライト
        ctx.strokeStyle=stoneHi; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-12,y-6); ctx.lineTo(x+12,y-6); ctx.stroke();
        // 腕のライン（両脇に浅い溝）
        ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-10,y-2); ctx.lineTo(x-10,y+14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+10,y-2); ctx.lineTo(x+10,y+14); ctx.stroke();
        // 腹部の水平ライン（帯状の浮き彫り）
        ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-11,y+10); ctx.lineTo(x+11,y+10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-11,y+16); ctx.lineTo(x+11,y+16); ctx.stroke();
        // 手（腹の前で交差するライン）
        ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x-11,y+12); ctx.bezierCurveTo(x-6,y+10,x+6,y+10,x+11,y+12); ctx.stroke();

        // 首: やや細い
        const neckG=ctx.createLinearGradient(x-10,y-14,x+10,y-14);
        neckG.addColorStop(0,stoneSha); neckG.addColorStop(0.3,stoneBase); neckG.addColorStop(0.7,stoneMid); neckG.addColorStop(1,stoneSha);
        ctx.fillStyle=neckG; ctx.fillRect(x-10,y-14,20,10);

        // 頭部（HEAD）: モアイは縦長の独特なシルエット
        // 頭の輪郭（ベジェで縦長の台形っぽい形）
        const headG2=ctx.createLinearGradient(x-14,y-42,x+14,y-14);
        headG2.addColorStop(0,stoneMid); headG2.addColorStop(0.3,stoneHi); headG2.addColorStop(0.6,stoneBase); headG2.addColorStop(1,stoneSha);
        ctx.fillStyle=headG2;
        ctx.beginPath();
        ctx.moveTo(x-10,y-14);       // 首左
        ctx.lineTo(x-13,y-28);       // 頰左
        ctx.lineTo(x-11,y-40);       // こめかみ左
        ctx.lineTo(x-5, y-44);       // 額左
        ctx.lineTo(x+5, y-44);       // 額右
        ctx.lineTo(x+11,y-40);       // こめかみ右
        ctx.lineTo(x+13,y-28);       // 頰右
        ctx.lineTo(x+10,y-14);       // 首右
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#1e2028'; ctx.lineWidth=0.8; ctx.stroke();

        // 頭頂のプカオ（帽子）: 赤い凝灰岩の円柱帯
        const puG=ctx.createLinearGradient(x-9,y-48,x+9,y-44);
        puG.addColorStop(0,'#3a2820'); puG.addColorStop(0.3,'#5a3828'); puG.addColorStop(0.7,'#4a2e20'); puG.addColorStop(1,'#2a1810');
        ctx.fillStyle=puG;
        ctx.beginPath(); ctx.moveTo(x-9,y-44); ctx.lineTo(x-8,y-50); ctx.lineTo(x+8,y-50); ctx.lineTo(x+9,y-44); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#1e1208'; ctx.lineWidth=0.8; ctx.stroke();
        // プカオの上面
        ctx.fillStyle='#4a3020';
        ctx.fillRect(x-7,y-52,14,4);

        // 眉（張り出した眉骨: モアイの特徴）
        const browG=ctx.createLinearGradient(x-13,y-32,x+13,y-28);
        browG.addColorStop(0,stoneSha); browG.addColorStop(0.15,stoneBase); browG.addColorStop(0.5,stoneMid); browG.addColorStop(0.85,stoneBase); browG.addColorStop(1,stoneSha);
        ctx.fillStyle=browG;
        // 左眉骨
        ctx.beginPath(); ctx.moveTo(x-13,y-30); ctx.lineTo(x-13,y-35); ctx.lineTo(x-1,y-34); ctx.lineTo(x-1,y-30); ctx.closePath(); ctx.fill();
        // 右眉骨
        ctx.beginPath(); ctx.moveTo(x+1,y-30); ctx.lineTo(x+1,y-34); ctx.lineTo(x+13,y-35); ctx.lineTo(x+13,y-30); ctx.closePath(); ctx.fill();
        // 眉間の影
        ctx.fillStyle='rgba(0,0,0,0.35)';
        ctx.fillRect(x-1,y-34,2,8);
        // 眉骨の下影
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-13,y-30); ctx.lineTo(x-1,y-30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+1,y-30); ctx.lineTo(x+13,y-30); ctx.stroke();

        // 目（深い窪み: 楕円の影穴）
        ctx.fillStyle='#0e1218';
        // 左眼窩
        ctx.beginPath(); ctx.ellipse(x-7,y-26,3,2.5,0,0,Math.PI*2); ctx.fill();
        // 右眼窩
        ctx.beginPath(); ctx.ellipse(x+7,y-26,3,2.5,0,0,Math.PI*2); ctx.fill();
        // 目の内部（珊瑚の象嵌を表現）
        ctx.fillStyle='rgba(80,70,60,0.6)';
        ctx.beginPath(); ctx.ellipse(x-7,y-26,2,1.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+7,y-26,2,1.5,0,0,Math.PI*2); ctx.fill();

        // 鼻（幅広く前に出た鼻: モアイの特徴）
        const noseG=ctx.createLinearGradient(x-5,y-22,x+5,y-22);
        noseG.addColorStop(0,stoneSha); noseG.addColorStop(0.4,stoneMid); noseG.addColorStop(1,stoneSha);
        ctx.fillStyle=noseG;
        ctx.beginPath();
        ctx.moveTo(x-5,y-22);
        ctx.lineTo(x-6,y-14);   // 小鼻左
        ctx.lineTo(x-3,y-12);
        ctx.lineTo(x+3,y-12);
        ctx.lineTo(x+6,y-14);   // 小鼻右
        ctx.lineTo(x+5,y-22);
        ctx.closePath(); ctx.fill();
        // 鼻の正面ハイライト
        ctx.strokeStyle=stoneMid; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(x-4,y-22); ctx.lineTo(x-4,y-14); ctx.stroke();

        // 口（薄く水平に閉じた口）
        ctx.fillStyle='#1a1c22';
        ctx.beginPath(); ctx.moveTo(x-8,y-10); ctx.lineTo(x+8,y-10); ctx.lineTo(x+7,y-7); ctx.lineTo(x-7,y-7); ctx.closePath(); ctx.fill();
        // 唇の線
        ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-8,y-10); ctx.lineTo(x+8,y-10); ctx.stroke();
        // 口の上のファロン（ひっくり返した唇の形の出っ張り）
        ctx.fillStyle=stoneBase;
        ctx.beginPath(); ctx.moveTo(x-7,y-12); ctx.quadraticCurveTo(x,y-10,x+7,y-12); ctx.lineTo(x+6,y-10); ctx.lineTo(x-6,y-10); ctx.closePath(); ctx.fill();

        // 亀裂（経年劣化）
        ctx.strokeStyle='rgba(10,12,16,0.5)'; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(x-3,y-44); ctx.lineTo(x-5,y-30); ctx.lineTo(x-4,y-14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+8,y-38); ctx.lineTo(x+7,y-22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-8,y-6); ctx.lineTo(x-6,y+10); ctx.stroke();
        // 苔（緑がかったシミ）
        ctx.fillStyle='rgba(60,80,40,0.3)';
        ctx.beginPath(); ctx.ellipse(x+4,y-36,5,3,0.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x-8,y+4,4,2,0.3,0,Math.PI*2); ctx.fill();

        hpBar(x,y-58,e.hp,16,36);
        break;
      }

      case 'seahorse':{
        // 軍艦鳥（フリゲートバード）── イースター島の大型海鳥
        const ft=t*0.06;
        const wingFlap=Math.sin(ft)*14;
        // 翼（細長い鎌形）
        ctx.fillStyle='#1a1a1a';
        // 左翼
        ctx.beginPath(); ctx.moveTo(x-2,y);
        ctx.bezierCurveTo(x-10,y-4+wingFlap,x-24,y-8+wingFlap,x-30,y-6+wingFlap);
        ctx.bezierCurveTo(x-22,y-2+wingFlap*0.5,x-10,y+2,x-2,y+4); ctx.closePath(); ctx.fill();
        // 右翼
        ctx.beginPath(); ctx.moveTo(x+2,y);
        ctx.bezierCurveTo(x+10,y-4+wingFlap,x+24,y-8+wingFlap,x+30,y-6+wingFlap);
        ctx.bezierCurveTo(x+22,y-2+wingFlap*0.5,x+10,y+2,x+2,y+4); ctx.closePath(); ctx.fill();
        // 翼の光沢
        ctx.strokeStyle='rgba(60,60,60,0.6)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-2,y); ctx.bezierCurveTo(x-14,y-6+wingFlap,x-26,y-7+wingFlap,x-30,y-6+wingFlap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+2,y); ctx.bezierCurveTo(x+14,y-6+wingFlap,x+26,y-7+wingFlap,x+30,y-6+wingFlap); ctx.stroke();
        // 尾（二股に割れた長い尾）
        ctx.strokeStyle='#111'; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x-3,y+6); ctx.bezierCurveTo(x-5,y+10,x-8,y+16,x-10,y+22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+3,y+6); ctx.bezierCurveTo(x+5,y+10,x+8,y+16,x+10,y+22); ctx.stroke();
        // 胴体（流線型）
        const fBodyG=ctx.createRadialGradient(x-2,y-1,1,x,y,9);
        fBodyG.addColorStop(0,'#3a3a3a'); fBodyG.addColorStop(0.5,'#1a1a1a'); fBodyG.addColorStop(1,'#0a0a0a');
        ctx.fillStyle=fBodyG; ctx.beginPath(); ctx.ellipse(x,y,9,5,-0.1,0,Math.PI*2); ctx.fill();
        // 頭・嘴（長く鋭い）
        ctx.fillStyle='#222';
        ctx.beginPath(); ctx.ellipse(x+9,y-1,8,4,-0.15,0,Math.PI*2); ctx.fill();
        // 嘴の先（鉤状に曲がる）
        ctx.strokeStyle='#333'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(x+14,y-2); ctx.bezierCurveTo(x+20,y-2,x+22,y+1,x+20,y+4); ctx.stroke();
        // 喉袋（赤い）
        ctx.fillStyle='rgba(200,30,0,0.8)';
        ctx.beginPath(); ctx.ellipse(x+8,y+3,5,3,0.3,0,Math.PI*2); ctx.fill();
        // 目
        ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(x+11,y-3,2.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(x+11.5,y-3,1.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x+11,y-4,0.7,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'jellyfish':{
        // マンタ（オニイトマキエイ）── イースター島沖の大型エイ
        const mt=t*0.05+e.seed;
        const undulate=Math.sin(mt)*8; // 翼の上下動
        // 体（菱形・暗青灰）
        const mG=ctx.createRadialGradient(x-3,y-3,2,x,y,22);
        mG.addColorStop(0,'#2a4060'); mG.addColorStop(0.4,'#1a2840'); mG.addColorStop(0.8,'#0e1828'); mG.addColorStop(1,'#080e18');
        ctx.fillStyle=mG;
        ctx.beginPath();
        ctx.moveTo(x+22,y);           // 右端
        ctx.bezierCurveTo(x+14,y-8+undulate,x-4,y-14+undulate,x-16,y-12+undulate);
        ctx.bezierCurveTo(x-24,y-8,x-22,y+2,x-16,y+8-undulate);
        ctx.bezierCurveTo(x-4,y+10-undulate,x+14,y+6-undulate,x+22,y);
        ctx.closePath(); ctx.fill();
        // 背面の白い斑点（マンタの特徴）
        ctx.fillStyle='rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.ellipse(x-4,y-4,8,5,0.2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x-12,y-2,4,3,0.1,0,Math.PI*2); ctx.fill();
        // 腹面（白）
        ctx.fillStyle='rgba(200,220,255,0.12)';
        ctx.beginPath(); ctx.ellipse(x,y+2,14,6,0,0,Math.PI*2); ctx.fill();
        // 翼端の光沢ライン
        ctx.strokeStyle='rgba(80,120,180,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-16,y-12+undulate); ctx.bezierCurveTo(x,y-12+undulate,x+12,y-6,x+22,y); ctx.stroke();
        // 頭部の角（角状の頭鰭 cephalic fin）
        ctx.fillStyle='#1a2840';
        ctx.beginPath(); ctx.moveTo(x+16,y-3); ctx.bezierCurveTo(x+20,y-8,x+26,y-12,x+24,y-6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+16,y+2); ctx.bezierCurveTo(x+20,y+6,x+26,y+10,x+24,y+4); ctx.closePath(); ctx.fill();
        // 尾（細く長い鞭状）
        ctx.strokeStyle='#0e1828'; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x-16,y); ctx.bezierCurveTo(x-25,y+4,x-32,y+2,x-36,y+6); ctx.stroke();
        ctx.strokeStyle='#1a2840'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-16,y); ctx.bezierCurveTo(x-25,y+4,x-32,y+2,x-36,y+6); ctx.stroke();
        // 目（小さく前方寄り）
        ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(x+18,y-1,2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(x+18,y-1,1.2,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'stoneGolem':{
        // 石造守護者 ── イースター島の古代石像が動き出した姿
        const sB2='#3c3830', sM2='#524e44', sH2='#6e6858', sT2='#8a8472';
        // アフ（土台・地面固定）
        ctx.fillStyle='#2a2820';
        ctx.beginPath(); ctx.moveTo(x-14,y+22); ctx.lineTo(x-12,y+14); ctx.lineTo(x+12,y+14); ctx.lineTo(x+14,y+22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(x-13,y+18); ctx.lineTo(x+13,y+18); ctx.stroke();
        ctx.fillStyle='rgba(50,75,25,0.5)'; ctx.beginPath(); ctx.ellipse(x,y+22,16,3,0,0,Math.PI*2); ctx.fill();
        // 脚（太い柱状）
        const legG=ctx.createLinearGradient(x-11,y+14,x+11,y+14);
        legG.addColorStop(0,sB2); legG.addColorStop(0.3,sM2); legG.addColorStop(0.7,sH2); legG.addColorStop(1,sB2);
        ctx.fillStyle=legG;
        ctx.fillRect(x-11,y+2,9,14); ctx.fillRect(x+2,y+2,9,14);
        // 脚の境界線
        ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-1,y+4); ctx.lineTo(x+1,y+14); ctx.stroke();
        // 胴（四角い岩塊）
        const bodyG3=ctx.createLinearGradient(x-12,y-10,x+12,y+4);
        bodyG3.addColorStop(0,sB2); bodyG3.addColorStop(0.25,sH2); bodyG3.addColorStop(0.55,sM2); bodyG3.addColorStop(1,sB2);
        ctx.fillStyle=bodyG3; ctx.fillRect(x-12,y-10,24,14);
        // 胴の上辺ハイライト
        ctx.strokeStyle=sT2; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-12,y-10); ctx.lineTo(x+12,y-10); ctx.stroke();
        // 腕（前に突き出した厚い腕）
        ctx.fillStyle=sM2;
        ctx.beginPath(); ctx.moveTo(x-12,y-8); ctx.lineTo(x-20,y-4); ctx.lineTo(x-20,y+4); ctx.lineTo(x-10,y+2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+12,y-8); ctx.lineTo(x+20,y-4); ctx.lineTo(x+20,y+4); ctx.lineTo(x+10,y+2); ctx.closePath(); ctx.fill();
        // 腕のハイライト
        ctx.strokeStyle=sH2; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(x-12,y-8); ctx.lineTo(x-20,y-4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+12,y-8); ctx.lineTo(x+20,y-4); ctx.stroke();
        // 首
        ctx.fillStyle=sM2; ctx.fillRect(x-7,y-18,14,10);
        // 頭（モアイ風の縦長頭部）
        const hG3=ctx.createLinearGradient(x-10,y-32,x+10,y-18);
        hG3.addColorStop(0,sH2); hG3.addColorStop(0.3,sT2); hG3.addColorStop(0.7,sM2); hG3.addColorStop(1,sB2);
        ctx.fillStyle=hG3;
        ctx.beginPath(); ctx.moveTo(x-9,y-18); ctx.lineTo(x-10,y-28); ctx.lineTo(x-6,y-34); ctx.lineTo(x+6,y-34); ctx.lineTo(x+10,y-28); ctx.lineTo(x+9,y-18); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#1c1a14'; ctx.lineWidth=0.7; ctx.stroke();
        // 眉骨
        ctx.fillStyle=sB2;
        ctx.beginPath(); ctx.moveTo(x-10,y-24); ctx.lineTo(x-10,y-28); ctx.lineTo(x-1,y-26); ctx.lineTo(x-1,y-24); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+1,y-24); ctx.lineTo(x+1,y-26); ctx.lineTo(x+10,y-28); ctx.lineTo(x+10,y-24); ctx.closePath(); ctx.fill();
        // 目（赤く光る眼窩）
        ctx.fillStyle='#0a0a0a';
        ctx.beginPath(); ctx.ellipse(x-5,y-22,2.5,2,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+5,y-22,2.5,2,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#dd1100'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x-5,y-22,1.5,1.2,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+5,y-22,1.5,1.2,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 亀裂
        ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(x-3,y-32); ctx.lineTo(x-4,y-18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+6,y-28); ctx.lineTo(x+5,y-6); ctx.stroke();
        // 苔
        ctx.fillStyle='rgba(50,80,20,0.35)';
        ctx.beginPath(); ctx.ellipse(x+7,y-26,5,2,0.4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x-8,y+4,4,2,0.2,0,Math.PI*2); ctx.fill();
        // HPバー
        hpBar(x,y-40,e.hp,8,40);
        break;
      }

      /* ══════════════════════════════════════════════
         STAGE 3: ピラミッド
      ══════════════════════════════════════════════ */
      case 'mummy':{
        // ミイラ ─ 包帯に包まれた古代死者
        const bsz=e.isBoss?1.6:1;
        ctx.save(); ctx.scale(bsz,bsz); ctx.translate(x/bsz-x,y/bsz-y);
        // 影
        ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x,y+14,9,3,0,0,Math.PI*2); ctx.fill();
        // 体（腐敗した包帯）
        const mG=ctx.createLinearGradient(x-8,y-12,x+8,y+12);
        mG.addColorStop(0,'#b8a878'); mG.addColorStop(0.4,'#a09060'); mG.addColorStop(0.8,'#806840'); mG.addColorStop(1,'#604820');
        ctx.fillStyle=mG;
        ctx.fillRect(x-8,y-12,16,26);
        // 腐食跡（暗い染み）
        ctx.fillStyle='rgba(40,20,0,0.45)';
        for(let si=0;si<5;si++){
          ctx.beginPath(); ctx.ellipse(x-5+si*3,y-8+si*4,2,1.5,si*0.4,0,Math.PI*2); ctx.fill();
        }
        // 包帯（剥がれかけ・汚れている）
        ctx.strokeStyle='rgba(180,160,100,0.8)'; ctx.lineWidth=2.5;
        for(let i=0;i<6;i++){
          ctx.beginPath(); ctx.moveTo(x-8,y-10+i*4.5); ctx.lineTo(x+8+(i%2?-2:2),y-10+i*4.5+1.5); ctx.stroke();
        }
        // 解れた包帯（端が垂れる）
        ctx.strokeStyle='rgba(160,140,90,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x+7,y+4); ctx.bezierCurveTo(x+10,y+8,x+12,y+14,x+9,y+20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-6,y-4); ctx.bezierCurveTo(x-11,y-2,x-14,y+4,x-10,y+10); ctx.stroke();
        // 骨が露出した部分（腕）
        ctx.fillStyle='#c8b890';
        ctx.beginPath(); ctx.ellipse(x-12,y+4,4,3,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+12,y+4,4,3,-0.3,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(180,160,100,0.6)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-14,y+6); ctx.lineTo(x-16,y+12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+14,y+6); ctx.lineTo(x+16,y+12); ctx.stroke();
        // 頭（包帯巻き・骨張った）
        ctx.fillStyle='#a89060';
        ctx.beginPath(); ctx.ellipse(x,y-16,9,10,0,0,Math.PI*2); ctx.fill();
        // 頭の包帯（不規則に巻かれた）
        ctx.strokeStyle='rgba(180,160,100,0.75)'; ctx.lineWidth=2.5;
        for(let i=0;i<4;i++){
          ctx.beginPath(); ctx.arc(x,y-16,9-i*1.5,(Math.PI*0.2+i*0.1),(Math.PI*1.0-i*0.1)); ctx.stroke();
        }
        // 目（深く暗い眼窩から発光）
        ctx.fillStyle='rgba(0,0,0,0.9)';
        ctx.beginPath(); ctx.ellipse(x-3,y-18,4,3.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+3,y-18,4,3.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#cc1100'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(x-3,y-18,2.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+3,y-18,2.5,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0; ctx.restore();
        if(e.isBoss) hpBar(x,y-40,e.hp,50,60);
        break;
      }

      case 'tutankhamun':{
        // ═══════════════════════════════════════════════════════════
        // ツタンカーメン ─ 黄金のファラオ（St3ボス）
        // 黄金のデスマスク・王の杖クルック＆フレイル・アンクの呪符
        // ═══════════════════════════════════════════════════════════
        const tsz=e.isBoss?1.5:1;
        ctx.save(); ctx.scale(tsz,tsz); ctx.translate(x/tsz-x, y/tsz-y);
        const tt=frame*0.02;
        const breathG=Math.abs(Math.sin(tt*2.5)); // 呼吸アニメ

        // ── 影 ──
        ctx.fillStyle='rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(x,y+36,20,5,0,0,Math.PI*2); ctx.fill();

        // ── 王笏クルック（左手、前に突き出す） ──
        const crookAngle=e.crookAngle||0;
        ctx.save(); ctx.translate(x-10,y-4);
        ctx.rotate(crookAngle);
        // 柄
        const staffG=ctx.createLinearGradient(-2,-30,2,-30);
        staffG.addColorStop(0,'#8B6914'); staffG.addColorStop(0.5,'#FFD700'); staffG.addColorStop(1,'#8B6914');
        ctx.strokeStyle='#FFD700'; ctx.lineWidth=4; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-26); ctx.stroke();
        // 鉤（クルック先端）
        ctx.strokeStyle='#FFD700'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(0,-26); ctx.bezierCurveTo(0,-34,-8,-38,-12,-34); ctx.stroke();
        // 金の縞模様（黒との交互）
        ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=3;
        for(let si=0;si<4;si++){
          const sy=-8+si*(-4.5);
          ctx.beginPath(); ctx.moveTo(-2,sy); ctx.lineTo(2,sy); ctx.stroke();
        }
        ctx.restore();

        // ── フレイル（右手、斜め上に構える） ──
        ctx.save(); ctx.translate(x+10,y-4);
        ctx.rotate(-0.4+Math.sin(tt*3)*0.08);
        ctx.strokeStyle='#FFD700'; ctx.lineWidth=4; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(4,-22); ctx.stroke();
        // フレイル先端（3連の金玉）
        for(let fi=0;fi<3;fi++){
          const fy=-22-fi*7, fx=4+fi*3;
          ctx.fillStyle='#FFD700'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=6;
          ctx.beginPath(); ctx.arc(fx,fy,4,0,Math.PI*2); ctx.fill();
          // 縞（青・赤交互）
          ctx.strokeStyle= fi%2===0?'#1a4aaa':'#aa1a1a'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(fx,fy,4,0,Math.PI*2); ctx.stroke();
        }
        ctx.shadowBlur=0;
        ctx.restore();

        // ── 胴体（白亜麻ローブ） ──
        const bodyG=ctx.createLinearGradient(x-16,y-8,x+16,y+30);
        bodyG.addColorStop(0,'#f5f0e0'); bodyG.addColorStop(0.4,'#ede5c8'); bodyG.addColorStop(1,'#c8b888');
        ctx.fillStyle=bodyG; ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=6;
        ctx.beginPath();
        ctx.moveTo(x-16,y-4); ctx.lineTo(x-20,y+36); ctx.lineTo(x+20,y+36); ctx.lineTo(x+16,y-4); ctx.closePath();
        ctx.fill(); ctx.shadowBlur=0;
        // ローブの縞装飾（金のライン）
        ctx.strokeStyle='rgba(200,160,0,0.6)'; ctx.lineWidth=1.5;
        for(let ri=0;ri<5;ri++){
          const ry=y+2+ri*7;
          ctx.beginPath(); ctx.moveTo(x-16+ri*0.5,ry); ctx.lineTo(x+16-ri*0.5,ry); ctx.stroke();
        }

        // ── 首飾り（ウシェブティ・ウセカ） ──
        const collarG=ctx.createLinearGradient(x-14,y-8,x+14,y-2);
        collarG.addColorStop(0,'#1a4aaa'); collarG.addColorStop(0.25,'#FFD700'); collarG.addColorStop(0.5,'#cc2200');
        collarG.addColorStop(0.75,'#FFD700'); collarG.addColorStop(1,'#1a4aaa');
        ctx.fillStyle=collarG; ctx.shadowColor='#FFD700'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x,y-6,14,5,0,0,Math.PI*2); ctx.fill();
        // 首飾りの粒
        ctx.shadowColor='#FFD700'; ctx.shadowBlur=4;
        for(let ci=0;ci<8;ci++){
          const ca=(Math.PI/7)*ci-Math.PI/2*0.9;
          const cr=13;
          ctx.fillStyle= ci%2===0?'#FFD700':'#1a4aaa';
          ctx.beginPath(); ctx.arc(x+Math.cos(ca)*cr,y-6+Math.sin(ca)*cr*0.4,2.5,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;

        // ── 顔（黄金のデスマスク） ──
        const faceG=ctx.createRadialGradient(x-4,y-22,3,x,y-18,18);
        faceG.addColorStop(0,'#ffe066'); faceG.addColorStop(0.4,'#FFD700'); faceG.addColorStop(0.8,'#b8960a'); faceG.addColorStop(1,'#7a6408');
        ctx.fillStyle=faceG; ctx.shadowColor='#FFD700'; ctx.shadowBlur=14+breathG*4;
        ctx.beginPath(); ctx.ellipse(x,y-20,14,16,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 顔の輪郭（細い黒線）
        ctx.strokeStyle='rgba(100,80,0,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.ellipse(x,y-20,14,16,0,0,Math.PI*2); ctx.stroke();
        // アイライン（濃い黒・エジプト風）
        ctx.strokeStyle='#0a0600'; ctx.lineWidth=2.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x-10,y-20); ctx.lineTo(x+10,y-20); ctx.stroke();
        // アイラインの跳ね
        ctx.beginPath(); ctx.moveTo(x+8,y-20); ctx.lineTo(x+14,y-23); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-8,y-20); ctx.lineTo(x-14,y-23); ctx.stroke();
        // 目（黄金の中の黒い瞳）
        ctx.fillStyle='#0a0800';
        ctx.beginPath(); ctx.ellipse(x-5,y-20,2.5,2,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+5,y-20,2.5,2,0,0,Math.PI*2); ctx.fill();
        // 目の輝き
        ctx.fillStyle='rgba(255,220,50,0.7)'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=4;
        ctx.beginPath(); ctx.arc(x-5,y-20,1.2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+5,y-20,1.2,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 鼻・口（細い線）
        ctx.strokeStyle='rgba(100,80,0,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x,y-17); ctx.lineTo(x,y-14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-4,y-13); ctx.bezierCurveTo(x-2,y-11,x+2,y-11,x+4,y-13); ctx.stroke();
        // 顎ひげ（神聖な儀礼用ひげ・金）
        ctx.fillStyle='#FFD700'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=4;
        ctx.beginPath(); ctx.moveTo(x-4,y-8); ctx.lineTo(x+4,y-8); ctx.lineTo(x+2,y-3); ctx.lineTo(x-2,y-3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(100,80,0,0.5)'; ctx.lineWidth=1;
        for(let bi=0;bi<3;bi++){ ctx.beginPath(); ctx.moveTo(x-3+bi*2.5,y-7); ctx.lineTo(x-3+bi*2.5,y-4); ctx.stroke(); }
        ctx.shadowBlur=0;

        // ── ネメス王冠（頭巾）── 青と金の縞の布
        // 頭巾本体（後ろへ垂れる）
        const nG=ctx.createLinearGradient(x-14,y-36,x+14,y-36);
        nG.addColorStop(0,'#1a4aaa'); nG.addColorStop(0.2,'#FFD700'); nG.addColorStop(0.4,'#1a4aaa');
        nG.addColorStop(0.6,'#FFD700'); nG.addColorStop(0.8,'#1a4aaa'); nG.addColorStop(1,'#FFD700');
        ctx.fillStyle=nG;
        // 頭巾上部
        ctx.beginPath();
        ctx.moveTo(x-14,y-30); ctx.bezierCurveTo(x-12,y-38,x+12,y-38,x+14,y-30);
        ctx.lineTo(x+14,y-20); ctx.lineTo(x+18,y-4); ctx.lineTo(x+16,y); // 右の垂れ
        ctx.lineTo(x+10,y-16); ctx.lineTo(x-10,y-16); // 前面ライン
        ctx.lineTo(x-16,y); ctx.lineTo(x-18,y-4); ctx.lineTo(x-14,y-20);
        ctx.closePath(); ctx.fill();
        // 縞ライン（黒）
        ctx.strokeStyle='rgba(10,30,80,0.4)'; ctx.lineWidth=1.5;
        for(let ni=0;ni<4;ni++){
          ctx.beginPath(); ctx.moveTo(x-14+ni*3,y-32); ctx.lineTo(x-10+ni*3,y-18); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x+14-ni*3,y-32); ctx.lineTo(x+10-ni*3,y-18); ctx.stroke();
        }
        // 額帯（金の額飾り）
        ctx.fillStyle='#b87820';
        ctx.beginPath(); ctx.rect(x-14,y-32,28,4); ctx.fill();
        ctx.strokeStyle='#FFD700'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-14,y-32); ctx.lineTo(x+14,y-32); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-14,y-28); ctx.lineTo(x+14,y-28); ctx.stroke();

        // コブラ（ウラエウス）── 額の中央
        ctx.fillStyle='#cc2200'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(x,y-32); ctx.bezierCurveTo(x+4,y-38,x+2,y-44,x,y-42);
        ctx.bezierCurveTo(x-2,y-44,x-4,y-38,x,y-32); ctx.closePath(); ctx.fill();
        // コブラの目（金）
        ctx.fillStyle='#FFD700'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=4;
        ctx.beginPath(); ctx.arc(x+1,y-40,1.5,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;

        // ── アンク（呪符） – ゆっくり回転して飛んでくる ──
        const ankh=e.ankh||0;
        if(e.isBoss){
          e.ankh=(ankh+tt*0.3)%1; // 将来use用
        }

        ctx.restore();
        if(e.isBoss){
          hpBar(x,y-55,e.hp,600,60);
          // ボス名
          ctx.fillStyle='#FFD700'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=8;
          ctx.font='bold 11px monospace'; ctx.textAlign='center';
          ctx.fillText('◆ TUTANKHAMUN ◆',x,y-62);
          ctx.textAlign='left'; ctx.shadowBlur=0;
        }
        break;
      }

      case 'bat':{
        // 大型吸血コウモリ ─ 凶暴な翼翼手目
        const flap=Math.sin(frame*0.4)*14;
        // 翼膜（左、血管が透けて見える）
        const bwG=ctx.createLinearGradient(x,y,x-28,y-6+flap);
        bwG.addColorStop(0,'#1a0a22'); bwG.addColorStop(0.5,'rgba(40,10,55,0.85)'); bwG.addColorStop(1,'rgba(30,5,40,0.3)');
        ctx.fillStyle=bwG;
        ctx.beginPath();
        ctx.moveTo(x-2,y-2); ctx.bezierCurveTo(x-10,y-10,x-22,y-10+flap,x-28,y-8+flap);
        ctx.bezierCurveTo(x-20,y+4,x-10,y+6,x-2,y+4); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x+2,y-2); ctx.bezierCurveTo(x+10,y-10,x+22,y-10+flap,x+28,y-8+flap);
        ctx.bezierCurveTo(x+20,y+4,x+10,y+6,x+2,y+4); ctx.closePath(); ctx.fill();
        // 翼の骨格（指骨）
        ctx.strokeStyle='rgba(80,30,100,0.7)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x-2,y-2); ctx.lineTo(x-28,y-8+flap); ctx.stroke();
        ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-4,y-4); ctx.lineTo(x-20,y-12+flap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-6,y-2); ctx.lineTo(x-14,y-14+flap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+2,y-2); ctx.lineTo(x+28,y-8+flap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+4,y-4); ctx.lineTo(x+20,y-12+flap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+6,y-2); ctx.lineTo(x+14,y-14+flap); ctx.stroke();
        // 翼膜の血管
        ctx.strokeStyle='rgba(150,30,60,0.3)'; ctx.lineWidth=0.8;
        for(let bi=0;bi<3;bi++){
          const bfrac=(bi+1)*0.25;
          ctx.beginPath(); ctx.moveTo(x-2,y); ctx.lineTo(x-28*bfrac,y-8*bfrac+flap*bfrac); ctx.stroke();
        }
        // 胴体
        const bbG2=ctx.createRadialGradient(x-1,y-2,1,x,y,8);
        bbG2.addColorStop(0,'#3a1850'); bbG2.addColorStop(0.5,'#1e0c2e'); bbG2.addColorStop(1,'#0a0410');
        ctx.fillStyle=bbG2; ctx.shadowColor='#220033'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x,y,8,7,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 耳（大型・鋭い輪郭、耳珠付き）
        ctx.fillStyle='#1a0a22';
        ctx.beginPath(); ctx.moveTo(x-3,y-6); ctx.lineTo(x-8,y-18); ctx.lineTo(x-2,y-8); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+3,y-6); ctx.lineTo(x+8,y-18); ctx.lineTo(x+2,y-8); ctx.closePath(); ctx.fill();
        // 耳の内側（暗赤）
        ctx.fillStyle='rgba(100,20,40,0.7)';
        ctx.beginPath(); ctx.moveTo(x-3,y-7); ctx.lineTo(x-7,y-15); ctx.lineTo(x-3,y-9); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+3,y-7); ctx.lineTo(x+7,y-15); ctx.lineTo(x+3,y-9); ctx.closePath(); ctx.fill();
        // 鼻（葉鼻）
        ctx.fillStyle='#2a0c1e';
        ctx.beginPath(); ctx.moveTo(x-3,y-2); ctx.bezierCurveTo(x-4,y-6,x-1,y-8,x,y-6); ctx.bezierCurveTo(x+1,y-8,x+4,y-6,x+3,y-2); ctx.closePath(); ctx.fill();
        // 目（赤、小さく鋭い）
        ctx.fillStyle='rgba(200,0,20,0.95)'; ctx.shadowColor='#ff0020'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.ellipse(x-4,y-4,2,1.5,-0.2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+4,y-4,2,1.5,0.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(x-4,y-4,1,1,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+4,y-4,1,1,0,0,Math.PI*2); ctx.fill();
        // 牙（口から突き出す）
        ctx.fillStyle='#f0ece0';
        ctx.beginPath(); ctx.moveTo(x-2,y+2); ctx.lineTo(x-1,y+8); ctx.lineTo(x+1,y+2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+2,y+2); ctx.lineTo(x+3,y+7); ctx.lineTo(x+5,y+2); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        break;
      }

      case 'scarab':{
        // 戦甲虫 ─ 鋼鉄の甲冑を纏った凶暴な甲虫
        // 影
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x+2,y+12,15,4,0,0,Math.PI*2); ctx.fill();
        // 飛翔翅（羽ばたき中は少し見える）
        const wingF=Math.sin(frame*0.3)*4;
        ctx.fillStyle='rgba(30,80,20,0.25)'; ctx.beginPath(); ctx.ellipse(x-2,y-wingF,18,10,0,Math.PI,Math.PI*2); ctx.fill();
        // 鞘翅（厚い外殻・金属質）
        const scG=ctx.createRadialGradient(x-4,y-4,2,x,y,16);
        scG.addColorStop(0,'#2a6010'); scG.addColorStop(0.3,'#1a4808'); scG.addColorStop(0.65,'#0e2e04'); scG.addColorStop(1,'#060e02');
        ctx.fillStyle=scG; ctx.shadowColor='#446600'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x+1,y+1,14,10,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 鞘翅の光沢（金属的な反射）
        ctx.fillStyle='rgba(100,200,50,0.2)';
        ctx.beginPath(); ctx.ellipse(x-3,y-3,7,4,-0.3,0,Math.PI*2); ctx.fill();
        // 鞘翅の縦分割線（鋭い）
        ctx.strokeStyle='rgba(5,15,2,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x+2,y-10); ctx.lineTo(x+2,y+10); ctx.stroke();
        // 鞘翅の横スジ（節）
        ctx.strokeStyle='rgba(30,70,15,0.5)'; ctx.lineWidth=1;
        for(let ri=0;ri<3;ri++){
          ctx.beginPath(); ctx.ellipse(x+1,y,14-ri*0.5,10-ri*0.5,0,Math.PI*0.15,Math.PI*0.85); ctx.stroke();
        }
        // 前胸背板（首の盾）
        const proG=ctx.createLinearGradient(x-10,y-12,x+6,y-8);
        proG.addColorStop(0,'#0e2e04'); proG.addColorStop(0.4,'#2a6010'); proG.addColorStop(1,'#0e2e04');
        ctx.fillStyle=proG;
        ctx.beginPath(); ctx.moveTo(x-10,y-8); ctx.lineTo(x-8,y-14); ctx.lineTo(x+4,y-14); ctx.lineTo(x+6,y-8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(60,120,30,0.5)'; ctx.lineWidth=1; ctx.stroke();
        // 頭（角張った）
        ctx.fillStyle='#183808';
        ctx.beginPath(); ctx.ellipse(x-11,y,7,5,0,0,Math.PI*2); ctx.fill();
        // 頭楯（角状）
        ctx.fillStyle='#0e2808';
        ctx.beginPath(); ctx.moveTo(x-13,y-4); ctx.lineTo(x-20,y-7); ctx.lineTo(x-20,y-4); ctx.lineTo(x-14,y-1); ctx.closePath(); ctx.fill();
        // 大顎（鋭い）
        ctx.strokeStyle='#446620'; ctx.lineWidth=2.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x-16,y-3); ctx.lineTo(x-22,y-8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-16,y+3); ctx.lineTo(x-22,y+7); ctx.stroke();
        // 大顎の先端（鋭い鉤）
        ctx.strokeStyle='rgba(100,180,60,0.8)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-22,y-8); ctx.lineTo(x-24,y-6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-22,y+7); ctx.lineTo(x-24,y+5); ctx.stroke();
        // 触角（節付き）
        ctx.strokeStyle='rgba(40,90,20,0.85)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-14,y-5); ctx.bezierCurveTo(x-18,y-10,x-20,y-14,x-17,y-18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-14,y-5); ctx.bezierCurveTo(x-18,y-7,x-22,y-8,x-20,y-12); ctx.stroke();
        for(let ai=0;ai<3;ai++){
          ctx.beginPath(); ctx.arc(x-17-ai*1.5,y-12-ai*2,1.5,0,Math.PI*2); ctx.fill();
        }
        // 脚（6本、節付き、爪あり）
        ctx.strokeStyle='rgba(20,70,10,0.9)'; ctx.lineWidth=2; ctx.lineCap='round';
        for(let li=0;li<3;li++){
          const lx=x-4+li*5, anim=Math.sin(frame*0.3+li)*3;
          ctx.beginPath(); ctx.moveTo(lx,y-9); ctx.lineTo(lx-2+anim,y-16); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(lx,y+10); ctx.lineTo(lx-2-anim,y+17); ctx.stroke();
          // 爪
          ctx.strokeStyle='rgba(100,200,60,0.7)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(lx-2+anim,y-16); ctx.lineTo(lx-5+anim,y-18); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(lx-2-anim,y+17); ctx.lineTo(lx-5-anim,y+19); ctx.stroke();
          ctx.strokeStyle='rgba(20,70,10,0.9)'; ctx.lineWidth=2;
        }
        // 目（化合眼・深紅）
        ctx.fillStyle='rgba(160,10,10,0.95)'; ctx.shadowColor='#cc0000'; ctx.shadowBlur=5;
        ctx.beginPath(); ctx.ellipse(x-13,y-3,4,3,-0.2,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        break;
      }

      case 'ghost':{
        // 骸骨亡霊 ─ 骨格が透ける死の亡霊
        const gt=t*1.0+e.seed;
        const gAlpha=0.72+Math.sin(gt*1.4)*0.18;
        ctx.globalAlpha=gAlpha;
        ctx.shadowColor='#4400aa'; ctx.shadowBlur=18;
        // 霊体外層（エクトプラズム）
        const ghG=ctx.createRadialGradient(x,y-6,2,x,y+2,20);
        ghG.addColorStop(0,'rgba(180,160,255,0.7)');
        ghG.addColorStop(0.5,'rgba(80,60,160,0.45)');
        ghG.addColorStop(1,'rgba(20,0,60,0)');
        ctx.fillStyle=ghG;
        ctx.beginPath();
        ctx.arc(x,y-5,16,Math.PI,0);
        ctx.lineTo(x+16,y+14);
        for(let i=5;i>=0;i--){
          const wx=x+16-i*6.4, wave=Math.sin(gt*2+i*1.1)*4;
          ctx.lineTo(wx,y+14+wave-(i%2===0?5:2));
        }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 骸骨の頭（半透明に透ける）
        ctx.globalAlpha=gAlpha*0.85;
        ctx.fillStyle='rgba(220,215,200,0.55)';
        ctx.beginPath(); ctx.ellipse(x,y-8,10,11,0,0,Math.PI*2); ctx.fill();
        // 眼窩（深く暗い空洞）
        ctx.fillStyle='rgba(0,0,0,0.9)';
        ctx.beginPath(); ctx.ellipse(x-5,y-10,5,5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+5,y-10,5,5,0,0,Math.PI*2); ctx.fill();
        // 眼窩内の発光（青白い）
        ctx.fillStyle=`rgba(100,80,255,${0.5+Math.sin(gt*3)*0.3})`;
        ctx.shadowColor='#6644ff'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.ellipse(x-5,y-10,3,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+5,y-10,3,3,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 鼻腔（逆三角形の暗い穴）
        ctx.fillStyle='rgba(0,0,0,0.8)';
        ctx.beginPath(); ctx.moveTo(x,y-2); ctx.lineTo(x-2,y+1); ctx.lineTo(x+2,y+1); ctx.closePath(); ctx.fill();
        // 顎・歯（不規則）
        ctx.fillStyle='rgba(200,195,185,0.6)';
        ctx.beginPath(); ctx.moveTo(x-8,y+3); ctx.lineTo(x-8,y+6); ctx.lineTo(x+8,y+6); ctx.lineTo(x+8,y+3); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(0,0,0,0.7)';
        for(let ti=0;ti<4;ti++){
          ctx.fillRect(x-7+ti*4,y+3,3,4);
        }
        // 霊体のゆらぎ（触手状の裾）
        ctx.globalAlpha=gAlpha*0.5;
        ctx.fillStyle='rgba(120,80,255,0.6)';
        for(let li=0;li<4;li++){
          const lx=x-9+li*6;
          const lwave=Math.sin(gt*2.5+li*0.9)*5+14;
          ctx.beginPath(); ctx.ellipse(lx,y+lwave,2.5,5,0,0,Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha=1; ctx.shadowBlur=0;
        break;
      }

      case 'sandWorm':{
        // 砂虫 ─ 砂漠の巨大ワーム
        // 体節（後ろから）
        for(let i=3;i>=0;i--){
          const sy=y+i*8;
          const sw=9-i*1.2;
          const swG=ctx.createRadialGradient(x-sw*0.3,sy-sw*0.3,1,x,sy,sw+3);
          swG.addColorStop(0,'#ddb866'); swG.addColorStop(0.5,'#bb9933'); swG.addColorStop(1,'#886600');
          ctx.fillStyle=swG;
          ctx.beginPath(); ctx.ellipse(x,sy,sw,sw*0.7,0,0,Math.PI*2); ctx.fill();
          // 環状紋
          ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.arc(x,sy,sw*0.8,0,Math.PI*2); ctx.stroke();
        }
        // 頭（大きい）
        const shG=ctx.createRadialGradient(x-3,y-20,2,x,y-14,14);
        shG.addColorStop(0,'#f0cc88'); shG.addColorStop(0.5,'#cc9933'); shG.addColorStop(1,'#664400');
        ctx.fillStyle=shG; ctx.shadowColor='#aa6600'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x,y-14,11,13,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 口（大きく開いた）
        ctx.fillStyle='#330000';
        ctx.beginPath(); ctx.ellipse(x,y-8,8,5,0,0,Math.PI); ctx.fill();
        // 牙
        ctx.fillStyle='#ffffcc'; ctx.shadowColor='#ffff88'; ctx.shadowBlur=3;
        for(let i=0;i<4;i++){
          const fx=x-6+i*4, fy=y-10;
          ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+1,fy-7); ctx.lineTo(fx+2,fy); ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur=0;
        // 目
        ctx.fillStyle='#ff8800'; ctx.shadowColor='#ffaa00'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.arc(x-5,y-20,3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+5,y-20,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(x-5,y-20,1.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+5,y-20,1.5,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        break;
      }

      /* ══════════════════════════════════════════════
         STAGE 4: 遺跡
      ══════════════════════════════════════════════ */
      case 'alienBoss':{
        // ══ 巨大エイリアンボス ══
        const abt=frame*0.025;
        const eyeP=Math.abs(Math.sin(abt*2.5));
        const breathP=Math.abs(Math.sin(abt*3.2));
        const ph=e.phase||1;

        // ── 腕（伸縮クロー攻撃）──
        // armPhase: 0=待機 1=伸ばし中 2=縮み中
        if(e.armPhase===1){
          e.armExtend=(e.armExtend||0)+4;
          if(e.armExtend>=130) e.armPhase=2;
        } else if(e.armPhase===2){
          e.armExtend=Math.max(0,(e.armExtend||0)-5);
          if(e.armExtend<=0) e.armPhase=0;
        }
        const armLen=e.armExtend||0;
        const armD=e.armDir||(-1); // -1=上、1=下

        // 腕の描画（伸縮時のみ）
        if(armLen>0){
          const armBaseX=x-20, armBaseY=y+armD*15;
          const armTipX=armBaseX-armLen*0.6, armTipY=armBaseY+armD*armLen*0.55;
          // 腕の節（セグメント）
          const segs=5;
          ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=16; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(armBaseX,armBaseY); ctx.lineTo(armTipX,armTipY); ctx.stroke();
          const armG=ctx.createLinearGradient(armBaseX,armBaseY,armTipX,armTipY);
          armG.addColorStop(0,'#1a4030'); armG.addColorStop(0.3,'#2a6848'); armG.addColorStop(0.7,'#1e5438'); armG.addColorStop(1,'#0e2818');
          ctx.strokeStyle=armG; ctx.lineWidth=12;
          ctx.beginPath(); ctx.moveTo(armBaseX,armBaseY); ctx.lineTo(armTipX,armTipY); ctx.stroke();
          // 腕のスジ
          ctx.strokeStyle='rgba(0,255,120,0.3)'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(armBaseX+2,armBaseY); ctx.lineTo(armTipX+2,armTipY); ctx.stroke();
          // 節の輪
          for(let si=1;si<segs;si++){
            const t=si/segs;
            const nx2=armBaseX+(armTipX-armBaseX)*t;
            const ny2=armBaseY+(armTipY-armBaseY)*t;
            ctx.strokeStyle='rgba(0,200,80,0.5)'; ctx.lineWidth=2;
            ctx.beginPath(); ctx.arc(nx2,ny2,7,0,Math.PI*2); ctx.stroke();
            ctx.fillStyle='rgba(20,80,40,0.7)'; ctx.beginPath(); ctx.arc(nx2,ny2,5,0,Math.PI*2); ctx.fill();
          }
          // クロー先端（3本爪）
          ctx.strokeStyle='#66ff99'; ctx.lineWidth=3; ctx.lineCap='round';
          ctx.shadowColor='#00ff88'; ctx.shadowBlur=8;
          for(let ci=-1;ci<=1;ci++){
            const cAngle=Math.atan2(armTipY-armBaseY,armTipX-armBaseX)+ci*0.5;
            ctx.beginPath(); ctx.moveTo(armTipX,armTipY); ctx.lineTo(armTipX+Math.cos(cAngle)*18,armTipY+Math.sin(cAngle)*18); ctx.stroke();
          }
          ctx.shadowBlur=0;
        }

        // ── 胴体（巨大・楕円形の異形）──
        // 影
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x+4,y+6,55,38,0,0,Math.PI*2); ctx.fill();
        // 胴体グラデーション
        const abodyG=ctx.createRadialGradient(x-12,y-10,5,x,y,55);
        abodyG.addColorStop(0,'#aaffcc');
        abodyG.addColorStop(0.2,'#44cc88');
        abodyG.addColorStop(0.5,'#1a7a44');
        abodyG.addColorStop(0.75,'#0c4828');
        abodyG.addColorStop(1,'#062010');
        ctx.fillStyle=abodyG; ctx.shadowColor='#00ff88'; ctx.shadowBlur=20;
        ctx.beginPath(); ctx.ellipse(x,y,52,36,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 胸の発光環（生体エネルギー）
        for(let ri=0;ri<4;ri++){
          const rp=(abt*1.5+ri*0.6)%1;
          ctx.strokeStyle=`rgba(0,255,150,${0.5-rp*0.4})`;
          ctx.lineWidth=2-ri*0.3;
          ctx.beginPath(); ctx.ellipse(x,y,12+ri*9,8+ri*6,0,0,Math.PI*2); ctx.stroke();
        }
        // 表面のテクスチャ（生体膜）
        ctx.strokeStyle='rgba(0,180,80,0.3)'; ctx.lineWidth=1;
        for(let vi=0;vi<8;vi++){
          const va=(Math.PI*2/8)*vi;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(va)*20,y+Math.sin(va)*14);
          ctx.bezierCurveTo(x+Math.cos(va)*32,y+Math.sin(va)*22, x+Math.cos(va+0.4)*40,y+Math.sin(va+0.4)*28, x+Math.cos(va+0.2)*50,y+Math.sin(va+0.2)*34);
          ctx.stroke();
        }

        // ── 頭部（大きな卵型）──
        const aheadG=ctx.createRadialGradient(x-8,y-32,4,x,y-22,30);
        aheadG.addColorStop(0,'#ccffee');
        aheadG.addColorStop(0.3,'#66ddaa');
        aheadG.addColorStop(0.65,'#228855');
        aheadG.addColorStop(1,'#0a2e18');
        ctx.fillStyle=aheadG; ctx.shadowColor='#00ff88'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.ellipse(x,y-20,34,28,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 頭の脈絡
        ctx.strokeStyle='rgba(0,200,100,0.25)'; ctx.lineWidth=1;
        for(let vi=0;vi<6;vi++){
          const vx2=x-18+vi*7;
          ctx.beginPath(); ctx.moveTo(vx2,y-46); ctx.bezierCurveTo(vx2+4,y-35,vx2-2,y-24,vx2+2,y-10); ctx.stroke();
        }

        // ── 目（大きな漆黒の複眼）──
        // 眼窩の影
        ctx.fillStyle='rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.ellipse(x-16,y-26,4,3,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+16,y-26,4,3,-0.3,0,Math.PI*2); ctx.fill();
        // 複眼本体（漆黒）
        ctx.fillStyle='#020608';
        ctx.beginPath(); ctx.ellipse(x-16,y-26,6,4,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+16,y-26,6,4,-0.3,0,Math.PI*2); ctx.fill();
        // 目の発光（フェーズ2でより強く）
        const eyeColor=ph>=2?`rgba(0,255,80,${eyeP*0.9})`:`rgba(0,200,100,${eyeP*0.7})`;
        ctx.fillStyle=eyeColor; ctx.shadowColor=ph>=2?'#00ff44':'#00cc66'; ctx.shadowBlur=14*eyeP;
        ctx.beginPath(); ctx.ellipse(x-16,y-26,3,2,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+16,y-26,3,2,-0.3,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 目の光点
        ctx.fillStyle='rgba(200,255,220,0.7)';
        ctx.beginPath(); ctx.ellipse(x-18,y-28,1.5,1,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+14,y-28,1.5,1,-0.3,0,Math.PI*2); ctx.fill();
        // 瞳孔（縦長）
        ctx.fillStyle='#000';
        ctx.beginPath(); ctx.ellipse(x-16,y-26,1.5,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+16,y-26,1.5,3,0,0,Math.PI*2); ctx.fill();

        // ── 口（ビーム砲口）──
        const mouthOpen=0.4+breathP*0.6;
        const mouthY=y+10;
        // 口の周囲の発光（チャージ）
        ctx.shadowColor='#00ff88'; ctx.shadowBlur=12+breathP*18;
        ctx.fillStyle=`rgba(0,255,150,${breathP*0.4})`;
        ctx.beginPath(); ctx.ellipse(x-38,mouthY,16+breathP*8,12+breathP*6,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 口の輪郭
        ctx.fillStyle='#040e08';
        ctx.beginPath(); ctx.ellipse(x-38,mouthY,18,10+mouthOpen*5,-0.1,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#0a2018';
        ctx.beginPath(); ctx.ellipse(x-38,mouthY,14,7+mouthOpen*4,-0.1,0,Math.PI*2); ctx.fill();
        // 口内（ビームチャージ光）
        const mouthGlow=ctx.createRadialGradient(x-38,mouthY,0,x-38,mouthY,12+breathP*6);
        mouthGlow.addColorStop(0,`rgba(180,255,210,${breathP*0.9})`);
        mouthGlow.addColorStop(0.4,`rgba(0,255,130,${breathP*0.6})`);
        mouthGlow.addColorStop(1,'rgba(0,200,80,0)');
        ctx.fillStyle=mouthGlow; ctx.beginPath(); ctx.arc(x-38,mouthY,12+breathP*6,0,Math.PI*2); ctx.fill();
        // 歯（上下に並ぶ鋭い牙）
        ctx.fillStyle='rgba(200,255,220,0.8)';
        for(let ti=0;ti<4;ti++){
          const tx=x-48+ti*7;
          ctx.beginPath(); ctx.moveTo(tx,mouthY-6); ctx.lineTo(tx+3,mouthY-6-5-mouthOpen*2); ctx.lineTo(tx+6,mouthY-6); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(tx,mouthY+4); ctx.lineTo(tx+3,mouthY+4+5+mouthOpen*2); ctx.lineTo(tx+6,mouthY+4); ctx.closePath(); ctx.fill();
        }

        // ── 触手・補助腕（常時揺れる）──
        ctx.strokeStyle='#1a6040'; ctx.lineWidth=5; ctx.lineCap='round';
        for(let ti=0;ti<4;ti++){
          const tbase_y=y-10+ti*16;
          const wave2=Math.sin(abt*3+ti*1.2)*18;
          ctx.beginPath(); ctx.moveTo(x-48,tbase_y); ctx.bezierCurveTo(x-60,tbase_y+wave2*0.4,x-68,tbase_y+wave2,x-72+wave2*0.2,tbase_y+wave2*0.8); ctx.stroke();
        }
        ctx.strokeStyle='rgba(0,180,80,0.4)'; ctx.lineWidth=2;
        for(let ti=0;ti<4;ti++){
          const tbase_y=y-10+ti*16;
          const wave2=Math.sin(abt*3+ti*1.2)*18;
          ctx.beginPath(); ctx.moveTo(x-48,tbase_y); ctx.bezierCurveTo(x-60,tbase_y+wave2*0.4,x-68,tbase_y+wave2,x-72+wave2*0.2,tbase_y+wave2*0.8); ctx.stroke();
        }

        // HPバー
        hpBar(x,y-66,e.hp,300,100);
        ctx.fillStyle='#88ffcc'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText('ALIEN OVERLORD',x,y-70); ctx.textAlign='left';
        break;
      }

      case 'alien':{
        // 異星人戦闘員 ─ 凶暴な多肢外骨格生物
        const asz=e.isBoss?1.6:1;
        ctx.save(); ctx.scale(asz,asz); ctx.translate(x/asz-x,y/asz-y);
        const at=frame*0.05;
        // 後部推進膜（半透明）
        ctx.fillStyle='rgba(0,180,80,0.18)';
        ctx.beginPath(); ctx.ellipse(x-6,y,14,8,0,0,Math.PI*2); ctx.fill();
        // 胴体（外骨格・節付き）
        const alG=ctx.createLinearGradient(x-8,y-10,x+8,y+10);
        alG.addColorStop(0,'#0a2018'); alG.addColorStop(0.25,'#1a5030'); alG.addColorStop(0.5,'#0e3422'); alG.addColorStop(0.8,'#081a10'); alG.addColorStop(1,'#040c08');
        ctx.fillStyle=alG; ctx.shadowColor='#00aa44'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x,y+2,8,10,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 外骨格の分節線
        ctx.strokeStyle='rgba(0,180,80,0.4)'; ctx.lineWidth=1;
        for(let si=0;si<3;si++) { ctx.beginPath(); ctx.ellipse(x,y+2,8,10-si*2.5,0,Math.PI*0.2,Math.PI*0.8); ctx.stroke(); }
        // 多関節の腕（2対）
        ctx.strokeStyle='#0e3020'; ctx.lineWidth=2.5; ctx.lineCap='round';
        for(let ai=0;ai<2;ai++){
          const adir=ai===0?-1:1, awave=Math.sin(at*2+ai)*5;
          ctx.beginPath(); ctx.moveTo(x+adir*7,y-2); ctx.lineTo(x+adir*14,y+awave); ctx.lineTo(x+adir*18,y+awave+4); ctx.stroke();
          // 先端の爪
          ctx.strokeStyle='rgba(0,220,100,0.6)'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(x+adir*18,y+awave+4); ctx.lineTo(x+adir*22,y+awave+2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x+adir*18,y+awave+4); ctx.lineTo(x+adir*21,y+awave+7); ctx.stroke();
          ctx.strokeStyle='#0e3020'; ctx.lineWidth=2.5;
        }
        // 頭部（縦長・重厚な外骨格）
        const ahG=ctx.createRadialGradient(x-3,y-16,2,x,y-10,13);
        ahG.addColorStop(0,'#1a4a2a'); ahG.addColorStop(0.4,'#0e2e1a'); ahG.addColorStop(1,'#040e08');
        ctx.fillStyle=ahG; ctx.shadowColor='#008840'; ctx.shadowBlur=8;
        ctx.beginPath();
        ctx.moveTo(x-10,y-5); ctx.lineTo(x-12,y-14); ctx.lineTo(x-8,y-22); ctx.lineTo(x+8,y-22); ctx.lineTo(x+12,y-14); ctx.lineTo(x+10,y-5);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 頭頂のスパイク
        ctx.fillStyle='#0a2014';
        ctx.beginPath(); ctx.moveTo(x-6,y-22); ctx.lineTo(x-5,y-28); ctx.lineTo(x-2,y-22); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+3,y-22); ctx.lineTo(x+5,y-29); ctx.lineTo(x+7,y-22); ctx.closePath(); ctx.fill();
        // 複眼（多数の面が並ぶ）
        ctx.fillStyle='#000806';
        ctx.beginPath(); ctx.ellipse(x-6,y-13,6,5,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+6,y-13,6,5,-0.3,0,Math.PI*2); ctx.fill();
        // 複眼の光（緑の格子）
        ctx.fillStyle='rgba(0,220,80,0.55)'; ctx.shadowColor='#00ff60'; ctx.shadowBlur=5;
        for(let ei=0;ei<3;ei++) for(let ej=0;ej<2;ej++){
          ctx.beginPath(); ctx.arc(x-8+ei*3,y-14+ej*3,1.2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x+4+ei*3,y-14+ej*3,1.2,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
        // 口部（顎器官、横に裂ける）
        ctx.fillStyle='#060c0a';
        ctx.beginPath(); ctx.moveTo(x-7,y-6); ctx.lineTo(x+7,y-6); ctx.lineTo(x+5,y-3); ctx.lineTo(x-5,y-3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(0,200,80,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-6,y-6); ctx.lineTo(x+6,y-6); ctx.stroke();
        // 下肢（6本、節付き）
        ctx.strokeStyle='rgba(10,50,25,0.9)'; ctx.lineWidth=1.5; ctx.lineCap='round';
        for(let li=0;li<3;li++){
          const ly=y+2+li*4, lwave=Math.sin(at*2.5+li)*4;
          ctx.beginPath(); ctx.moveTo(x-7,ly); ctx.lineTo(x-15+lwave,ly+8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x+7,ly); ctx.lineTo(x+15-lwave,ly+8); ctx.stroke();
        }
        ctx.restore();
        if(e.isBoss) hpBar(x,y-38,e.hp,60,60);
        break;
      }

      case 'alienDrone':{
        // 異星偵察プローブ ─ 凶悪な自律機械探査機
        const drt=frame*0.03;
        // エンジン噴射（非対称・4方向）
        for(let ti=0;ti<4;ti++){
          const ta=(Math.PI/2)*ti+drt*0.5;
          const tlen=10+Math.sin(drt*3+ti)*3;
          const tdG=ctx.createLinearGradient(x+Math.cos(ta)*8,y+Math.sin(ta)*5,x+Math.cos(ta)*tlen*1.5,y+Math.sin(ta)*tlen);
          tdG.addColorStop(0,'rgba(0,220,120,0.8)'); tdG.addColorStop(1,'rgba(0,100,50,0)');
          ctx.fillStyle=tdG; ctx.shadowColor='#00ff88'; ctx.shadowBlur=6;
          ctx.beginPath(); ctx.ellipse(x+Math.cos(ta)*tlen,y+Math.sin(ta)*tlen*0.7,3,3,0,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
        // 本体（多角形の装甲プレート）
        const ddG=ctx.createLinearGradient(x-10,y-7,x+10,y+7);
        ddG.addColorStop(0,'#0a1e10'); ddG.addColorStop(0.3,'#1a4028'); ddG.addColorStop(0.6,'#0e2618'); ddG.addColorStop(1,'#040e08');
        ctx.fillStyle=ddG; ctx.shadowColor='#004420'; ctx.shadowBlur=4;
        ctx.beginPath();
        ctx.moveTo(x+10,y); ctx.lineTo(x+6,y-6); ctx.lineTo(x-2,y-8); ctx.lineTo(x-10,y-4);
        ctx.lineTo(x-10,y+4); ctx.lineTo(x-2,y+8); ctx.lineTo(x+6,y+6); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 装甲の分割線
        ctx.strokeStyle='rgba(0,140,60,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+10,y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x,y-8); ctx.lineTo(x,y+8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-6,y-6); ctx.lineTo(x+6,y+6); ctx.stroke();
        // 中央スキャナー（回転する）
        ctx.save(); ctx.translate(x,y); ctx.rotate(drt*2);
        ctx.strokeStyle=`rgba(0,255,100,${0.5+Math.sin(drt*5)*0.3})`; ctx.lineWidth=1.5;
        ctx.shadowColor='#00ff80'; ctx.shadowBlur=8;
        for(let ri=0;ri<3;ri++){
          const ra=(Math.PI*2/3)*ri;
          ctx.beginPath(); ctx.moveTo(Math.cos(ra)*2,Math.sin(ra)*2); ctx.lineTo(Math.cos(ra)*7,Math.sin(ra)*5); ctx.stroke();
        }
        ctx.restore();
        // コアレンズ
        const dcG=ctx.createRadialGradient(x-1,y-1,0,x,y,5);
        dcG.addColorStop(0,'rgba(200,255,220,0.9)'); dcG.addColorStop(0.4,'rgba(0,200,100,0.7)'); dcG.addColorStop(1,'rgba(0,80,40,0.4)');
        ctx.fillStyle=dcG; ctx.shadowColor='#00ff80'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 外縁の突起（武装）
        ctx.fillStyle='#0a1e10';
        ctx.strokeStyle='rgba(0,160,80,0.5)'; ctx.lineWidth=1;
        for(let wi=0;wi<4;wi++){
          const wa=(Math.PI/2)*wi;
          const wx2=x+Math.cos(wa)*12, wy2=y+Math.sin(wa)*8;
          ctx.beginPath(); ctx.rect(wx2-2,wy2-2,4,4); ctx.fill(); ctx.stroke();
        }
        break;
      }

      case 'facehugger':{
        // フェイスハガー ─ 蟹形寄生体
        ctx.shadowColor='#44ff88'; ctx.shadowBlur=5;
        // 胴体（卵形）
        const fG=ctx.createRadialGradient(x-2,y-2,2,x,y,10);
        fG.addColorStop(0,'#88ffaa'); fG.addColorStop(0.5,'#33aa55'); fG.addColorStop(1,'#114422');
        ctx.fillStyle=fG;
        ctx.beginPath(); ctx.ellipse(x,y,9,6,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 甲殻の溝
        ctx.strokeStyle='rgba(0,80,30,0.6)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x,y+6); ctx.stroke();
        ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.stroke();
        // 脚（8本）
        ctx.strokeStyle='#33aa55'; ctx.lineWidth=1.5; ctx.lineCap='round';
        for(let i=0;i<4;i++){
          const s=i<2?-1:1, yo=i%2===0?-1:1;
          const ft2=Math.sin(frame*0.15+i)*3;
          ctx.beginPath(); ctx.moveTo(x+s*8,y+yo*2); ctx.lineTo(x+s*16,y+yo*9+ft2); ctx.stroke();
          // 先端爪
          ctx.beginPath(); ctx.arc(x+s*16,y+yo*9+ft2,1.5,0,Math.PI*2); ctx.fill();
        }
        // 尾（長いカール）
        ctx.strokeStyle='#33aa55'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(x-9,y); ctx.bezierCurveTo(x-18,y+8,x-20,y+16,x-12,y+12); ctx.stroke();
        // 目
        ctx.fillStyle='#ff2200'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=4;
        ctx.beginPath(); ctx.arc(x-3,y-1,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+3,y-1,2,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        break;
      }

      case 'alienEgg':{
        // エイリアンエッグ ─ 産卵カプセル
        // 地面に固定されている感じ
        ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x,y+15,12,3,0,0,Math.PI*2); ctx.fill();
        // 根（触手状の固定器）
        ctx.strokeStyle='rgba(30,80,30,0.6)'; ctx.lineWidth=2;
        for(let i=0;i<3;i++){
          const ra=(Math.PI/4)*(i-1)+Math.PI/2;
          ctx.beginPath(); ctx.moveTo(x,y+13); ctx.lineTo(x+Math.cos(ra)*10,y+13+Math.sin(ra)*5); ctx.stroke();
        }
        // 卵体
        const egG=ctx.createRadialGradient(x-3,y-5,3,x,y,15);
        egG.addColorStop(0,'#88cc88'); egG.addColorStop(0.5,'#336633'); egG.addColorStop(0.9,'#112211');
        ctx.fillStyle=egG; ctx.shadowColor='#00ff44'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(x,y,10,14,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 表面の脈 
        ctx.strokeStyle='rgba(100,200,100,0.3)'; ctx.lineWidth=1;
        for(let i=0;i<4;i++){
          ctx.beginPath();
          ctx.moveTo(x-8+i*5,y-14); ctx.bezierCurveTo(x-10+i*6,y-4,x-9+i*5,y+6,x-8+i*5,y+14);
          ctx.stroke();
        }
        // 開いた口（脈動）
        const openAmt=Math.abs(Math.sin(frame*0.04))*6;
        ctx.fillStyle='rgba(0,0,0,0.9)';
        ctx.beginPath();
        ctx.moveTo(x-6,y-6); ctx.bezierCurveTo(x-4,y-6-openAmt,x+4,y-6-openAmt,x+6,y-6);
        ctx.bezierCurveTo(x+4,y-6+openAmt*0.3,x-4,y-6+openAmt*0.3,x-6,y-6);
        ctx.closePath(); ctx.fill();
        // 光る眼（中から）
        if(openAmt>2){
          ctx.fillStyle='rgba(0,255,100,0.8)'; ctx.shadowColor='#00ff00'; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.ellipse(x,y-7,openAmt*0.5,2,0,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
        }
        break;
      }

      /* ══════════════════════════════════════════════
         STAGE 5: 体内
      ══════════════════════════════════════════════ */
      case 'amoeba':{
        // アメーバ ─ 有機的に変形する単細胞生物（ボスは巨大捕食アメーバ）
        const asz2=e.isBoss?1.8:1;
        ctx.save(); ctx.scale(asz2,asz2); ctx.translate(x/asz2-x,y/asz2-y);
        const at=t+(e.seed||0);
        const isB=e.isBoss, ph=(e.phase||1);
        // フェーズ2では赤紫に変色
        const outerCol=ph>=2?'rgba(220,0,80,0.35)':'rgba(160,0,220,0.3)';
        const innerC1=ph>=2?'rgba(255,60,120,0.9)':'rgba(220,100,255,0.9)';
        const innerC2=ph>=2?'rgba(200,0,60,0.8)':'rgba(160,0,200,0.8)';
        const glowCol=ph>=2?'#ff0044':'#cc00ff';
        ctx.shadowColor=glowCol; ctx.shadowBlur=isB?16:10;

        // ── 偽足（ボス時、自機方向に伸ばす） ──
        if(isB){
          const pp=e.pseudoPod||0;
          if(pp>0){
            const pd=e.pseudoDir||0;
            ctx.shadowColor=glowCol; ctx.shadowBlur=8;
            ctx.strokeStyle=innerC1; ctx.lineWidth=10*pp; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(pd)*pp*28,y+Math.sin(pd)*pp*28); ctx.stroke();
            // 先端の捕食球
            ctx.fillStyle=innerC1;
            ctx.beginPath(); ctx.arc(x+Math.cos(pd)*pp*28,y+Math.sin(pd)*pp*28,6*pp,0,Math.PI*2); ctx.fill();
          }
          ctx.shadowBlur=0;
        }

        // 外層（激しく波打つ）
        ctx.fillStyle=outerCol;
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.18){
          const r=(isB?20:17)+Math.sin(a*3+at)*6+Math.cos(a*2+at*0.7)*4;
          a<0.05?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
        }
        ctx.closePath(); ctx.fill();

        // 中層
        const amG=ctx.createRadialGradient(x,y,3,x,y,isB?18:14);
        amG.addColorStop(0,innerC1); amG.addColorStop(0.5,innerC2); amG.addColorStop(1,'rgba(80,0,120,0.6)');
        ctx.fillStyle=amG;
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.2){
          const r=(isB?15:13)+Math.sin(a*4+at*1.2)*4+Math.cos(a*3+at)*2;
          a<0.05?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
        }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;

        // 核
        const ncG=ctx.createRadialGradient(x-2,y-2,1,x,y,isB?8:5);
        ncG.addColorStop(0,'#ffccff'); ncG.addColorStop(1,ph>=2?'#cc0044':'#8800cc');
        ctx.fillStyle=ncG; ctx.shadowColor=glowCol; ctx.shadowBlur=isB?10:4;
        ctx.beginPath(); ctx.arc(x,y,isB?8:6,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;

        // 内部気泡（ボスは多め）
        const bubN=isB?6:3;
        for(let i=0;i<bubN;i++){
          const ba=(Math.PI*2/bubN)*i+at*0.3;
          ctx.fillStyle='rgba(255,200,255,0.35)';
          ctx.beginPath(); ctx.arc(x+Math.cos(ba)*(isB?10:7),y+Math.sin(ba)*(isB?10:7),isB?3.5:2.5,0,Math.PI*2); ctx.fill();
        }
        // ボス: 内部に消化中の獲物（小さな暗い塊）
        if(isB){
          for(let di=0;di<3;di++){
            const da=(Math.PI*2/3)*di+at*0.08;
            ctx.fillStyle='rgba(30,0,50,0.6)';
            ctx.beginPath(); ctx.ellipse(x+Math.cos(da)*6,y+Math.sin(da)*6,4,3,da,0,Math.PI*2); ctx.fill();
          }
        }
        ctx.restore();
        if(e.isBoss) hpBar(x,y-36,e.hp,500,80);
        break;
      }

      case 'bloodCell':{
        // 変異赤血球 ─ 鋭いスパイクを持つ病的変異細胞
        const bct=frame*0.04+e.seed;
        ctx.shadowColor='#aa0000'; ctx.shadowBlur=7;
        // スパイク（突起した変異部位）
        ctx.strokeStyle='rgba(200,20,20,0.75)'; ctx.lineWidth=1.5;
        for(let si=0;si<8;si++){
          const sa=(Math.PI*2/8)*si+bct*0.2;
          const slen=10+Math.sin(bct*3+si)*3;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(sa)*9,y+Math.sin(sa)*6); ctx.lineTo(x+Math.cos(sa)*slen,y+Math.sin(sa)*slen*0.65); ctx.stroke();
          // 先端の凝固物
          ctx.fillStyle='rgba(180,0,0,0.8)';
          ctx.beginPath(); ctx.arc(x+Math.cos(sa)*slen,y+Math.sin(sa)*slen*0.65,1.5,0,Math.PI*2); ctx.fill();
        }
        // 変形した外郭（楕円でなく歪んだ形）
        const bcG=ctx.createRadialGradient(x-3,y-2,1,x,y,13);
        bcG.addColorStop(0,'#ee2222'); bcG.addColorStop(0.4,'#aa0000'); bcG.addColorStop(0.75,'#6a0000'); bcG.addColorStop(1,'#300000');
        ctx.fillStyle=bcG;
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.2){
          const r=11+Math.sin(a*5+bct)*1.5;
          a<0.05?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r*0.65):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r*0.65);
        }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 双凹のへこみ（病理的）
        ctx.fillStyle='rgba(60,0,0,0.7)';
        ctx.beginPath(); ctx.ellipse(x,y,5,3,0,0,Math.PI*2); ctx.fill();
        // 膜の亀裂（ひびが入っている）
        ctx.strokeStyle='rgba(255,100,100,0.35)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-8,y-2); ctx.lineTo(x-2,y+1); ctx.lineTo(x+5,y-2); ctx.stroke();
        break;
      }

      case 'virus':{
        // ウイルス ─ コロナウイルス形
        const vt=t*1.4+e.seed;
        ctx.shadowColor='#ff00aa'; ctx.shadowBlur=10;
        // 外周スパイク（タンパク突起）
        for(let i=0;i<10;i++){
          const sa=(Math.PI*2/10)*i+vt*0.15;
          const sx1=x+Math.cos(sa)*9, sy1=y+Math.sin(sa)*9;
          const sx2=x+Math.cos(sa)*15, sy2=y+Math.sin(sa)*15;
          ctx.strokeStyle=`rgba(255,${Math.floor(50+i*18)},150,0.8)`; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(sx1,sy1); ctx.lineTo(sx2,sy2); ctx.stroke();
          // スパイク先端のボール
          ctx.fillStyle=`rgba(255,120,200,0.7)`;
          ctx.beginPath(); ctx.arc(sx2,sy2,2.5,0,Math.PI*2); ctx.fill();
        }
        // 外膜
        const viG=ctx.createRadialGradient(x-2,y-2,2,x,y,10);
        viG.addColorStop(0,'#ffaaee'); viG.addColorStop(0.5,'#dd0088'); viG.addColorStop(1,'#660033');
        ctx.fillStyle=viG;
        ctx.beginPath(); ctx.arc(x,y,9,0,Math.PI*2); ctx.fill();
        // 内部RNA
        ctx.strokeStyle='rgba(255,180,255,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.4){
          const r=4+Math.sin(a*3+vt)*2;
          a<0.1?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
        }
        ctx.stroke();
        ctx.shadowBlur=0;
        break;
      }

      case 'whiteCell':{
        // 巨大捕食白血球 ─ 何でも溶かす強酸の細胞
        const wt=t*0.6+e.seed;
        // 酸の滴り（外側に広がる）
        ctx.shadowColor='#2244aa'; ctx.shadowBlur=10;
        ctx.fillStyle='rgba(60,80,180,0.18)';
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.15){
          const r=22+Math.sin(a*4+wt)*7+Math.cos(a*7+wt*1.6)*4;
          a<0.08?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
        }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 本体（偽足で変形）
        const wcG=ctx.createRadialGradient(x,y,3,x,y,16);
        wcG.addColorStop(0,'rgba(160,200,255,0.95)'); wcG.addColorStop(0.4,'rgba(80,120,220,0.85)'); wcG.addColorStop(0.8,'rgba(40,70,180,0.7)'); wcG.addColorStop(1,'rgba(20,40,120,0.5)');
        ctx.fillStyle=wcG;
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.18){
          const r=15+Math.sin(a*5+wt*1.2)*5+Math.cos(a*3+wt)*3;
          a<0.05?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
        }
        ctx.closePath(); ctx.fill();
        // 内部の消化液（乱れた模様）
        ctx.strokeStyle='rgba(30,60,160,0.35)'; ctx.lineWidth=1;
        for(let di=0;di<5;di++){
          const da=(Math.PI*2/5)*di+wt*0.4;
          ctx.beginPath(); ctx.arc(x+Math.cos(da)*6,y+Math.sin(da)*6,4,0,Math.PI*2); ctx.stroke();
        }
        // 消化中の異物（半溶けた粒子）
        ctx.fillStyle='rgba(0,0,50,0.6)';
        for(let pi=0;pi<3;pi++){
          const pa=(Math.PI*2/3)*pi+wt*0.3;
          ctx.beginPath(); ctx.ellipse(x+Math.cos(pa)*6,y+Math.sin(pa)*6,3,2,pa,0,Math.PI*2); ctx.fill();
        }
        // 核（多葉核・白血球の特徴）
        ctx.shadowColor='#0022cc'; ctx.shadowBlur=5;
        for(let ni=0;ni<3;ni++){
          const na=(Math.PI*2/3)*ni+wt*0.15;
          const ncG2=ctx.createRadialGradient(x+Math.cos(na)*4,y+Math.sin(na)*4,0,x+Math.cos(na)*4,y+Math.sin(na)*4,4);
          ncG2.addColorStop(0,'rgba(100,140,255,0.95)'); ncG2.addColorStop(0.5,'rgba(40,80,200,0.8)'); ncG2.addColorStop(1,'rgba(10,30,120,0.6)');
          ctx.fillStyle=ncG2; ctx.beginPath(); ctx.ellipse(x+Math.cos(na)*4,y+Math.sin(na)*4,4,3,na,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
        // 偽足の先端（捕食爪）
        ctx.strokeStyle='rgba(100,150,255,0.5)'; ctx.lineWidth=1.5;
        for(let fi=0;fi<6;fi++){
          const fa=(Math.PI/3)*fi+wt*0.8;
          const flen=15+Math.sin(wt+fi)*4;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(fa)*12,y+Math.sin(fa)*12); ctx.lineTo(x+Math.cos(fa)*flen,y+Math.sin(fa)*flen); ctx.stroke();
        }
        break;
      }

      case 'spore':{
        // 致死寄生胞子 ─ 神経を侵す寄生菌群
        const st2=t*0.8+e.seed;
        const pls=Math.abs(Math.sin(st2*2));
        ctx.shadowColor='#880088'; ctx.shadowBlur=8;
        // 菌糸（親胞子から伸びる糸）
        ctx.strokeStyle='rgba(140,0,180,0.4)'; ctx.lineWidth=1;
        for(let i=0;i<5;i++){
          const sa=(Math.PI*2/5)*i+st2*0.3;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.bezierCurveTo(x+Math.cos(sa)*6,y+Math.sin(sa)*6, x+Math.cos(sa)*10,y+Math.sin(sa)*10, x+Math.cos(sa)*12,y+Math.sin(sa)*12); ctx.stroke();
        }
        // 衛星胞子（鋭いスパイク付き）
        for(let i=0;i<5;i++){
          const sa=(Math.PI*2/5)*i+st2*0.5;
          const sx=x+Math.cos(sa)*12, sy=y+Math.sin(sa)*12;
          // 胞子本体（歪んだ球）
          const spG=ctx.createRadialGradient(sx-1,sy-1,0,sx,sy,5);
          spG.addColorStop(0,'#cc44cc'); spG.addColorStop(0.5,'#7700aa'); spG.addColorStop(1,'#220033');
          ctx.fillStyle=spG; ctx.beginPath(); ctx.arc(sx,sy,4.5,0,Math.PI*2); ctx.fill();
          // 感染スパイク（6本）
          ctx.strokeStyle='rgba(180,0,200,0.7)'; ctx.lineWidth=1.2;
          for(let j=0;j<6;j++){
            const ja=(Math.PI/3)*j+st2;
            ctx.beginPath(); ctx.moveTo(sx+Math.cos(ja)*3,sy+Math.sin(ja)*3); ctx.lineTo(sx+Math.cos(ja)*8,sy+Math.sin(ja)*8); ctx.stroke();
          }
          // スパイク先端の毒液
          ctx.fillStyle='rgba(220,100,255,0.6)';
          for(let j=0;j<6;j++){
            const ja=(Math.PI/3)*j+st2;
            ctx.beginPath(); ctx.arc(sx+Math.cos(ja)*8,sy+Math.sin(ja)*8,1.5,0,Math.PI*2); ctx.fill();
          }
        }
        // 中心親胞子（腐敗した核）
        const cpG2=ctx.createRadialGradient(x-2,y-2,0,x,y,8);
        cpG2.addColorStop(0,'#dd88ee'); cpG2.addColorStop(0.35,'#880099'); cpG2.addColorStop(0.7,'#440055'); cpG2.addColorStop(1,'#1a0022');
        ctx.fillStyle=cpG2; ctx.shadowColor='#aa00cc'; ctx.shadowBlur=10+pls*5;
        ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 内部の核（脈打つ）
        ctx.fillStyle=`rgba(255,${100+pls*100},255,${0.6+pls*0.3})`;
        ctx.beginPath(); ctx.arc(x,y,3+pls*1.5,0,Math.PI*2); ctx.fill();
        // 表面の腐食紋（暗い亀裂）
        ctx.strokeStyle='rgba(40,0,60,0.6)'; ctx.lineWidth=1;
        for(let ci=0;ci<4;ci++){
          const ca=(Math.PI/2)*ci+st2*0.2;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(ca)*2,y+Math.sin(ca)*2); ctx.lineTo(x+Math.cos(ca)*7,y+Math.sin(ca)*7); ctx.stroke();
        }
        break;
      }

      /* ══════════════════════════════════════════════
         STAGE 6: 宇宙
      ══════════════════════════════════════════════ */
      case 'corona':{
        // 恒星コロナ ─ 小型恒星のプラズマ
        const ct=t*0.8+e.seed;
        ctx.shadowColor='#ffaa00'; ctx.shadowBlur=16;
        // コロナプラズマ（外）
        ctx.fillStyle='rgba(255,140,0,0.25)';
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.18){
          const r=18+Math.sin(a*5+ct)*6+Math.cos(a*3+ct*0.8)*4;
          const px2=x+Math.cos(a)*r, py2=y+Math.sin(a)*r;
          a<0.05?ctx.moveTo(px2,py2):ctx.lineTo(px2,py2);
        }
        ctx.closePath(); ctx.fill();
        // コロナプラズマ（中）
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.2){
          const r=12+Math.sin(a*4+ct*1.2)*4+Math.cos(a*6+ct)*3;
          const px2=x+Math.cos(a)*r, py2=y+Math.sin(a)*r;
          a<0.05?ctx.moveTo(px2,py2):ctx.lineTo(px2,py2);
        }
        ctx.closePath();
        const coG=ctx.createRadialGradient(x,y,4,x,y,14);
        coG.addColorStop(0,'rgba(255,220,100,0.9)'); coG.addColorStop(0.5,'rgba(255,120,0,0.7)'); coG.addColorStop(1,'rgba(200,40,0,0.3)');
        ctx.fillStyle=coG; ctx.fill();
        // コア（白熱）
        const coCore=ctx.createRadialGradient(x-1,y-1,1,x,y,7);
        coCore.addColorStop(0,'#ffffff'); coCore.addColorStop(0.4,'#ffff88'); coCore.addColorStop(1,'#ffaa00');
        ctx.fillStyle=coCore; ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // フレア突起
        ctx.shadowColor='#ffcc00'; ctx.shadowBlur=8;
        for(let i=0;i<4;i++){
          const fa=(Math.PI/2)*i+ct*0.3;
          const flen=14+Math.sin(ct+i)*4;
          ctx.strokeStyle='rgba(255,180,0,0.7)'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(fa)*8,y+Math.sin(fa)*8); ctx.lineTo(x+Math.cos(fa)*flen,y+Math.sin(fa)*flen); ctx.stroke();
        }
        ctx.shadowBlur=0;
        break;
      }

      case 'asteroid':{
        // 小惑星 ─ 不規則形状の岩石
        ctx.save(); ctx.translate(x,y); ctx.rotate(e.rot||0);
        ctx.shadowColor='#885533'; ctx.shadowBlur=4;
        // 本体
        const astG=ctx.createRadialGradient(-3,-3,2,0,0,16);
        astG.addColorStop(0,'#998866'); astG.addColorStop(0.5,'#665533'); astG.addColorStop(1,'#332211');
        ctx.fillStyle=astG;
        ctx.beginPath();
        const pts=[
          [14,2],[11,8],[15,13],[8,15],[1,12],[-6,15],[-13,8],[-15,2],
          [-13,-6],[-8,-13],[0,-15],[8,-13],[13,-8],[15,-3]
        ];
        ctx.moveTo(pts[0][0],pts[0][1]);
        pts.forEach(p=>ctx.lineTo(p[0],p[1]));
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // クレーター
        ctx.fillStyle='rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(4,5,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-6,-4,3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(2,-9,2,0,Math.PI*2); ctx.fill();
        // ハイライト（光が当たっている面）
        ctx.fillStyle='rgba(220,200,170,0.3)';
        ctx.beginPath(); ctx.arc(-4,-5,6,0,Math.PI*2); ctx.fill();
        // 亀裂
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(2,8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6,-10); ctx.lineTo(10,4); ctx.stroke();
        ctx.restore();
        break;
      }

      case 'bigMeteor':{
        // 大型隕石 ─ 壊滅的な宇宙の岩塊
        const br=e.radius||36;
        ctx.save(); ctx.translate(x,y); ctx.rotate(e.rot||0);

        // 影（岩石の暗い側面）
        const bmShadow=ctx.createRadialGradient(br*0.15,br*0.1,br*0.2,0,0,br);
        bmShadow.addColorStop(0,'rgba(0,0,0,0)');
        bmShadow.addColorStop(0.7,'rgba(0,0,0,0.3)');
        bmShadow.addColorStop(1,'rgba(0,0,0,0.7)');

        // 外側グロー（宇宙に浮かぶ静的な岩のうっすらした放射）
        ctx.shadowColor='rgba(120,90,60,0.5)'; ctx.shadowBlur=14;

        // 本体: 不規則多角形 (12頂点)
        const bmPts=e.craters
          ? Array.from({length:12},(_,i)=>{ const a=Math.PI*2/12*i; const r=br*(0.82+0.18*Math.sin(a*3.1+1.2)); return[Math.cos(a)*r, Math.sin(a)*r]; })
          : Array.from({length:12},(_,i)=>{ const a=Math.PI*2/12*i; return[Math.cos(a)*br*0.9, Math.sin(a)*br*0.9]; });
        const bmG=ctx.createRadialGradient(-br*0.3,-br*0.3,br*0.05,0,0,br);
        bmG.addColorStop(0,'#b0987a');
        bmG.addColorStop(0.3,'#8a7055');
        bmG.addColorStop(0.65,'#5c4230');
        bmG.addColorStop(1,'#2a1a0c');
        ctx.fillStyle=bmG;
        ctx.beginPath();
        ctx.moveTo(bmPts[0][0],bmPts[0][1]);
        for(const p of bmPts) ctx.lineTo(p[0],p[1]);
        ctx.closePath(); ctx.fill();

        // 影オーバーレイ
        ctx.fillStyle=bmShadow;
        ctx.beginPath();
        ctx.moveTo(bmPts[0][0],bmPts[0][1]);
        for(const p of bmPts) ctx.lineTo(p[0],p[1]);
        ctx.closePath(); ctx.fill();

        // 光が当たっている面のハイライト（左上）
        const bmHL=ctx.createRadialGradient(-br*0.4,-br*0.4,0,-br*0.3,-br*0.3,br*0.7);
        bmHL.addColorStop(0,'rgba(255,240,200,0.22)');
        bmHL.addColorStop(0.5,'rgba(200,180,140,0.08)');
        bmHL.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=bmHL;
        ctx.beginPath();
        ctx.moveTo(bmPts[0][0],bmPts[0][1]);
        for(const p of bmPts) ctx.lineTo(p[0],p[1]);
        ctx.closePath(); ctx.fill();

        ctx.shadowBlur=0;

        // 亀裂（長く深い）
        ctx.strokeStyle='rgba(15,8,2,0.55)'; ctx.lineWidth=1.5;
        const cracks=[
          [[-br*0.5,br*0.1],[br*0.2,br*0.4]],
          [[br*0.1,-br*0.5],[br*0.4,br*0.2]],
          [[-br*0.2,-br*0.3],[-br*0.5,br*0.15]],
          [[br*0.3,br*0.05],[br*0.1,-br*0.3]],
          [[-br*0.1,br*0.3],[-br*0.4,br*0.1]],
        ];
        for(const [[x1,y1],[x2,y2]] of cracks){
          const mx=(x1+x2)/2+(Math.random()-0.5)*br*0.12;
          const my=(y1+y2)/2+(Math.random()-0.5)*br*0.12;
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(mx,my,x2,y2); ctx.stroke();
        }

        // クレーター
        if(e.craters){
          for(const cr of e.craters){
            const cx2=Math.cos(cr.a)*br*cr.r, cy2=Math.sin(cr.a)*br*cr.r;
            const cr2=br*cr.s;
            // クレーターのリム（外縁が少し明るい）
            ctx.fillStyle='rgba(180,150,110,0.18)';
            ctx.beginPath(); ctx.ellipse(cx2,cy2,cr2*1.3,cr2*1.1,0,0,Math.PI*2); ctx.fill();
            // クレーターの凹み（暗い）
            const crG=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,cr2);
            crG.addColorStop(0,'rgba(10,5,2,0.7)');
            crG.addColorStop(0.6,'rgba(30,18,8,0.4)');
            crG.addColorStop(1,'rgba(0,0,0,0)');
            ctx.fillStyle=crG;
            ctx.beginPath(); ctx.ellipse(cx2,cy2,cr2,cr2*0.85,0,0,Math.PI*2); ctx.fill();
          }
        }

        // 表面の微細なテクスチャ（小さな粒子感）
        ctx.fillStyle='rgba(0,0,0,0.15)';
        for(let ti=0;ti<8;ti++){
          const ta=(ti/8)*Math.PI*2+0.3; const tr=br*(0.2+Math.sin(ta*2.3)*0.2);
          ctx.beginPath(); ctx.arc(Math.cos(ta)*tr,Math.sin(ta)*tr,1.5,0,Math.PI*2); ctx.fill();
        }

        ctx.restore();

        // vy 適用（updateとは別に画面内位置を移動 ─ update側でも行われるため方向付けのみ描画）
        break;
      }

      case 'spaceJelly':{
        // 暗黒宇宙の肉食放電体 ─ 電撃触手を持つ真空生命体
        const jt2=t*0.7+e.seed;
        const pulse=1+Math.sin(jt2)*0.18;
        const zap=Math.abs(Math.sin(jt2*4));
        // 外縁放電（電撃エフェクト）
        ctx.shadowColor='#aa44ff'; ctx.shadowBlur=12+zap*8;
        ctx.strokeStyle=`rgba(180,80,255,${0.3+zap*0.4})`; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.ellipse(x,y-8,22*pulse,15,0,Math.PI,Math.PI*2); ctx.stroke();
        ctx.shadowBlur=0;
        // 外マント（半透明・歪んだ形状）
        ctx.fillStyle='rgba(40,10,80,0.5)';
        ctx.beginPath();
        for(let a=Math.PI;a<Math.PI*2;a+=0.15){
          const r=(19+Math.sin(a*6+jt2*2)*2)*pulse;
          a===Math.PI?ctx.moveTo(x+Math.cos(a)*r,y-6+Math.sin(a)*12):ctx.lineTo(x+Math.cos(a)*r,y-6+Math.sin(a)*12);
        }
        ctx.lineTo(x+20*pulse,y-6); ctx.closePath(); ctx.fill();
        // 内マント（濃い核）
        const sjG=ctx.createRadialGradient(x,y-12,2,x,y-8,16);
        sjG.addColorStop(0,'rgba(80,20,160,0.95)');
        sjG.addColorStop(0.5,'rgba(50,10,120,0.8)');
        sjG.addColorStop(1,'rgba(20,5,60,0.4)');
        ctx.fillStyle=sjG;
        ctx.beginPath(); ctx.ellipse(x,y-8,14*pulse,9,0,Math.PI,Math.PI*2); ctx.fill();
        // 胃（透けて見える消化器官）
        ctx.fillStyle='rgba(100,30,200,0.5)';
        ctx.beginPath(); ctx.ellipse(x,y-10,6,4,0,0,Math.PI*2); ctx.fill();
        // 複数の目（消化腺に見せかけた）
        ctx.shadowColor='#cc88ff'; ctx.shadowBlur=6;
        for(let ei=0;ei<3;ei++){
          const ex=x-6+ei*6, ey=y-10;
          ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.ellipse(ex,ey,3,2,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=`rgba(180,80,255,${0.6+zap*0.4})`; ctx.beginPath(); ctx.ellipse(ex,ey,2,1.5,0,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
        // 電撃触手（放電しながら攻撃）
        for(let i=0;i<5;i++){
          const tx=x-8+i*4;
          const sw=Math.sin(jt2*1.5+i*0.8)*8;
          ctx.lineWidth=2+zap*1.5; ctx.lineCap='round';
          // 電撃の稲妻形
          const tG2=ctx.createLinearGradient(tx,y-3,tx+sw*0.5,y+26);
          tG2.addColorStop(0,`rgba(200,120,255,0.9)`); tG2.addColorStop(0.5,`rgba(120,40,220,0.6)`); tG2.addColorStop(1,'rgba(60,10,160,0)');
          ctx.strokeStyle=tG2; ctx.shadowColor='#aa44ff'; ctx.shadowBlur=6*zap;
          ctx.beginPath(); ctx.moveTo(tx,y-3);
          ctx.lineTo(tx+sw*0.3,y+6); ctx.lineTo(tx-sw*0.4,y+12); ctx.lineTo(tx+sw*0.5,y+18); ctx.lineTo(tx+sw*0.3,y+26);
          ctx.stroke();
        }
        ctx.shadowBlur=0;
        break;
      }

      case 'meteorite':{
        // 流星 ─ 大気圏突入する燃える岩石
        ctx.save(); ctx.translate(x,y); ctx.rotate(Math.atan2(e.vy||0,e.vx||0));
        ctx.shadowColor='#ff8800'; ctx.shadowBlur=10;
        // 炎の尾（グラデーション）
        const mtG=ctx.createLinearGradient(-32,0,0,0);
        mtG.addColorStop(0,'rgba(255,60,0,0)'); mtG.addColorStop(0.4,'rgba(255,120,0,0.5)'); mtG.addColorStop(0.7,'rgba(255,180,0,0.7)'); mtG.addColorStop(1,'rgba(255,220,80,0.4)');
        ctx.fillStyle=mtG;
        ctx.beginPath(); ctx.ellipse(-16,0,18,6,0,0,Math.PI*2); ctx.fill();
        // 破片尾
        ctx.fillStyle='rgba(255,100,0,0.4)';
        ctx.beginPath(); ctx.ellipse(-22,0,8,3,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 岩石本体
        const mrG=ctx.createRadialGradient(-2,-2,1,0,0,11);
        mrG.addColorStop(0,'#ccaa88'); mrG.addColorStop(0.4,'#996644'); mrG.addColorStop(1,'#441100');
        ctx.fillStyle=mrG; ctx.shadowColor='#ff6600'; ctx.shadowBlur=8;
        ctx.beginPath();
        ctx.moveTo(12,0); ctx.lineTo(8,6); ctx.lineTo(10,9); ctx.lineTo(2,11); ctx.lineTo(-4,8);
        ctx.lineTo(-10,10); ctx.lineTo(-12,4); ctx.lineTo(-10,-5); ctx.lineTo(-4,-11); ctx.lineTo(4,-9); ctx.lineTo(10,-6);
        ctx.closePath(); ctx.fill();
        // 溶けた表面
        ctx.fillStyle='rgba(255,80,0,0.5)';
        ctx.beginPath(); ctx.arc(6,0,4,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.restore();
        break;
      }

      /* ══════════════════════════════════════════════
         BOSS
      ══════════════════════════════════════════════ */
      case 'spaceFortress':{
        // ══════════════════════════════════════════════════════
        // 宇宙要塞 ── 巨大複合戦闘ステーション
        // 弱点: 砲台1(上)→砲台2(下)→中枢コア の順に破壊
        // ══════════════════════════════════════════════════════
        const sft=frame*0.02;
        const pulse=Math.abs(Math.sin(sft*3));
        const rot=frame*0.008;
        const t1dead=e.turret1Hp<=0, t2dead=e.turret2Hp<=0;
        const ph=e.phase||1;
        // フェーズ移行（砲台両方撃破でフェーズ2）
        if(t1dead && t2dead && ph===1) e.phase=2;

        // ─── シールドリング（回転、砲台生存中）───
        if(!t1dead || !t2dead){
          e.shieldAngle=(e.shieldAngle||0)+0.018;
          const sa=e.shieldAngle;
          for(let si=0;si<3;si++){
            const sira=sa+si*(Math.PI*2/3);
            ctx.strokeStyle=`rgba(100,180,255,${0.5+pulse*0.3})`;
            ctx.lineWidth=3; ctx.shadowColor='#44aaff'; ctx.shadowBlur=10;
            ctx.beginPath();
            ctx.arc(x,y,95,sira,sira+Math.PI*0.5);
            ctx.stroke();
          }
          ctx.shadowBlur=0;
        }

        // ─── 後部スラスター（左側・3基）───
        for(let si=0;si<3;si++){
          const sy=y-44+si*44;
          const flen=20+Math.sin(sft*4+si)*8;
          const sfG=ctx.createLinearGradient(x-70,sy,x-70-flen,sy);
          sfG.addColorStop(0,'rgba(100,180,255,0.9)');
          sfG.addColorStop(0.4,'rgba(60,80,255,0.5)');
          sfG.addColorStop(1,'rgba(20,20,200,0)');
          ctx.fillStyle=sfG;
          ctx.beginPath(); ctx.ellipse(x-70,sy,flen,6,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(200,230,255,0.9)';
          ctx.beginPath(); ctx.ellipse(x-70,sy,4,4,0,0,Math.PI*2); ctx.fill();
        }

        // ─── 本体メインハル（大型六角形）───
        ctx.shadowColor='rgba(80,120,200,0.4)'; ctx.shadowBlur=18;
        const hullG=ctx.createLinearGradient(x-70,y-90,x+70,y+90);
        hullG.addColorStop(0,'#1a2040');
        hullG.addColorStop(0.2,'#2a3560');
        hullG.addColorStop(0.5,'#1e2a50');
        hullG.addColorStop(0.8,'#141e3a');
        hullG.addColorStop(1,'#0c1228');
        ctx.fillStyle=hullG;
        ctx.beginPath();
        ctx.moveTo(x+60,y);        // 右（前方）
        ctx.lineTo(x+36,y-80);     // 右上
        ctx.lineTo(x-20,y-96);     // 上
        ctx.lineTo(x-70,y-80);     // 左上
        ctx.lineTo(x-70,y+80);     // 左下
        ctx.lineTo(x-20,y+96);     // 下
        ctx.lineTo(x+36,y+80);     // 右下
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // ハルのエッジライン
        ctx.strokeStyle='rgba(60,100,200,0.6)'; ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(x+60,y); ctx.lineTo(x+36,y-80); ctx.lineTo(x-20,y-96); ctx.lineTo(x-70,y-80);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x+60,y); ctx.lineTo(x+36,y+80); ctx.lineTo(x-20,y+96); ctx.lineTo(x-70,y+80);
        ctx.stroke();

        // ─── パネルライン・装甲ブロック ───
        ctx.strokeStyle='rgba(40,70,160,0.45)'; ctx.lineWidth=1;
        // 横パネル
        for(let pi=-3;pi<=3;pi++){
          ctx.beginPath(); ctx.moveTo(x-65,y+pi*22); ctx.lineTo(x+40,y+pi*22); ctx.stroke();
        }
        // 縦パネル
        for(let pi=-2;pi<=2;pi++){
          ctx.beginPath(); ctx.moveTo(x+pi*22,y-88); ctx.lineTo(x+pi*22,y+88); ctx.stroke();
        }
        // アクセントライン（斜め）
        ctx.strokeStyle='rgba(80,130,220,0.3)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x+36,y-80); ctx.lineTo(x+60,y); ctx.lineTo(x+36,y+80); ctx.stroke();

        // ─── 発光窓・センサー ───
        const winColors=['#4488ff','#44ffcc','#ff4488','#ffcc44'];
        for(let wi=0;wi<12;wi++){
          const wx=x-55+wi%4*26, wy=y-44+Math.floor(wi/4)*28;
          const wc=winColors[wi%4];
          const wp=Math.abs(Math.sin(sft*2+wi*0.7));
          ctx.fillStyle=wc.replace(')',`,${0.4+wp*0.5})`).replace('#','rgba(').replace(/([0-9a-f]{2})/gi,(_,h)=>parseInt(h,16)+',').slice(0,-1)+')';
          // simpler approach:
          ctx.fillStyle=`rgba(80,140,255,${0.4+wp*0.4})`;
          if(wi%4===1) ctx.fillStyle=`rgba(80,255,200,${0.4+wp*0.4})`;
          if(wi%4===2) ctx.fillStyle=`rgba(255,80,150,${0.4+wp*0.4})`;
          if(wi%4===3) ctx.fillStyle=`rgba(255,200,80,${0.4+wp*0.3})`;
          ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=5*wp;
          ctx.beginPath(); ctx.rect(wx,wy,8,5); ctx.fill();
        }
        ctx.shadowBlur=0;

        // ─── サブキャノン（小型固定砲・側面に4門）───
        const subCannons=[[x+20,y-50],[x+40,y-25],[x+40,y+25],[x+20,y+50]];
        subCannons.forEach(([cx2,cy2])=>{
          ctx.fillStyle='#0e1830'; ctx.fillRect(cx2-4,cy2-5,16,10);
          ctx.strokeStyle='rgba(80,140,220,0.7)'; ctx.lineWidth=1; ctx.strokeRect(cx2-4,cy2-5,16,10);
          ctx.fillStyle='#060c18'; ctx.fillRect(cx2+10,cy2-3,6,6);
          ctx.strokeStyle='rgba(100,160,255,0.5)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(cx2+13,cy2,3,0,Math.PI*2); ctx.stroke();
        });

        // ─── 砲台1（上部: 自機を追尾する旋回砲）───
        const t1x=x-20, t1y=y-80;
        if(!t1dead){
          const t1angle=Math.atan2(player.y-t1y,player.x-t1x);
          // 台座
          ctx.fillStyle='#182038'; ctx.beginPath(); ctx.ellipse(t1x,t1y,22,16,0,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(100,150,255,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
          // 旋回砲身
          ctx.save(); ctx.translate(t1x,t1y); ctx.rotate(t1angle);
          const t1hpPct=e.turret1Hp/200;
          ctx.fillStyle=t1hpPct>0.5?'#2a4080':'#3a1020';
          ctx.fillRect(-6,-7,30,14);
          ctx.fillStyle='#0a1428'; ctx.fillRect(18,-5,12,10);
          ctx.strokeStyle=t1hpPct>0.5?'rgba(80,140,255,0.7)':'rgba(255,60,60,0.7)'; ctx.lineWidth=1; ctx.strokeRect(-6,-7,30,14);
          ctx.restore();
          // HP
          ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(t1x-25,t1y-30,50,5);
          ctx.fillStyle=t1hpPct>0.5?'#4488ff':'#ff2244';
          ctx.fillRect(t1x-25,t1y-30,50*t1hpPct,5);
          ctx.strokeStyle='#4488ff'; ctx.lineWidth=0.8; ctx.strokeRect(t1x-25,t1y-30,50,5);
          ctx.fillStyle='#88aaff'; ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('TURRET-A',t1x,t1y-33); ctx.textAlign='left';
        } else {
          // 破壊済み砲台
          ctx.fillStyle='#2a1010'; ctx.beginPath(); ctx.ellipse(t1x,t1y,18,12,0.3,0,Math.PI*2); ctx.fill();
          for(let si=0;si<5;si++){
            const age=(frame*0.06+si*0.6)%1;
            ctx.fillStyle=`rgba(60,40,40,${(1-age)*0.5})`;
            ctx.beginPath(); ctx.arc(t1x-6+si*4,t1y-8-age*20,3+age*5,0,Math.PI*2); ctx.fill();
          }
        }

        // ─── 砲台2（下部）───
        const t2x=x-20, t2y=y+80;
        if(!t2dead){
          const t2angle=Math.atan2(player.y-t2y,player.x-t2x);
          ctx.fillStyle='#182038'; ctx.beginPath(); ctx.ellipse(t2x,t2y,22,16,0,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(100,150,255,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
          ctx.save(); ctx.translate(t2x,t2y); ctx.rotate(t2angle);
          const t2hpPct=e.turret2Hp/200;
          ctx.fillStyle=t2hpPct>0.5?'#2a4080':'#3a1020';
          ctx.fillRect(-6,-7,30,14);
          ctx.fillStyle='#0a1428'; ctx.fillRect(18,-5,12,10);
          ctx.strokeStyle=t2hpPct>0.5?'rgba(80,140,255,0.7)':'rgba(255,60,60,0.7)'; ctx.lineWidth=1; ctx.strokeRect(-6,-7,30,14);
          ctx.restore();
          const t2hpPct2=e.turret2Hp/200;
          ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(t2x-25,t2y+24,50,5);
          ctx.fillStyle=t2hpPct2>0.5?'#4488ff':'#ff2244';
          ctx.fillRect(t2x-25,t2y+24,50*t2hpPct2,5);
          ctx.strokeStyle='#4488ff'; ctx.lineWidth=0.8; ctx.strokeRect(t2x-25,t2y+24,50,5);
          ctx.fillStyle='#88aaff'; ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('TURRET-B',t2x,t2y+36); ctx.textAlign='left';
        } else {
          ctx.fillStyle='#2a1010'; ctx.beginPath(); ctx.ellipse(t2x,t2y,18,12,-0.3,0,Math.PI*2); ctx.fill();
          for(let si=0;si<5;si++){
            const age=(frame*0.06+si*0.6)%1;
            ctx.fillStyle=`rgba(60,40,40,${(1-age)*0.5})`;
            ctx.beginPath(); ctx.arc(t2x-6+si*4,t2y+8+age*20,3+age*5,0,Math.PI*2); ctx.fill();
          }
        }

        // ─── 中枢コア（砲台両方破壊後に出現）───
        const coreX=x-55, coreY=y;
        if(t1dead && t2dead){
          e.laserCharge=(e.laserCharge||0)+1;
          const cPulse=Math.abs(Math.sin(sft*5));
          // コアの凹み（要塞ハルに穴が開いた）
          ctx.fillStyle='#04080e'; ctx.beginPath(); ctx.arc(coreX,coreY,28,0,Math.PI*2); ctx.fill();
          // コア外装（回転リング）
          e.shieldAngle=(e.shieldAngle||0)+0.04;
          for(let ri=0;ri<3;ri++){
            const ra=e.shieldAngle+ri*(Math.PI*2/3);
            ctx.strokeStyle=`rgba(255,80,180,${0.6+cPulse*0.3})`; ctx.lineWidth=2;
            ctx.shadowColor='#ff44aa'; ctx.shadowBlur=8;
            ctx.beginPath(); ctx.arc(coreX,coreY,20,ra,ra+Math.PI*0.55); ctx.stroke();
          }
          // コア本体（発光球体）
          const cG2=ctx.createRadialGradient(coreX-5,coreY-5,2,coreX,coreY,18);
          cG2.addColorStop(0,'rgba(255,240,255,0.95)');
          cG2.addColorStop(0.25,'rgba(255,100,220,0.9)');
          cG2.addColorStop(0.6,'rgba(200,20,150,0.8)');
          cG2.addColorStop(1,'rgba(80,0,80,0.6)');
          ctx.fillStyle=cG2; ctx.shadowColor='#ff00cc'; ctx.shadowBlur=20+cPulse*15;
          ctx.beginPath(); ctx.arc(coreX,coreY,18,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          // コアのエネルギー波紋
          for(let wi=0;wi<3;wi++){
            const wp2=(e.laserCharge*0.03+wi*0.33)%1;
            ctx.strokeStyle=`rgba(255,100,200,${(1-wp2)*0.6})`; ctx.lineWidth=2;
            ctx.beginPath(); ctx.arc(coreX,coreY,18+wp2*20,0,Math.PI*2); ctx.stroke();
          }
          // コアHP
          const cHpPct=(e.coreHp||400)/400;
          ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(coreX-30,coreY-42,60,6);
          ctx.fillStyle=cHpPct>0.5?'#ff44cc':'#ff0044';
          ctx.fillRect(coreX-30,coreY-42,60*cHpPct,6);
          ctx.strokeStyle='#ff44cc'; ctx.lineWidth=0.8; ctx.strokeRect(coreX-30,coreY-42,60,6);
          ctx.fillStyle='#ffaaee'; ctx.font='bold 8px monospace'; ctx.textAlign='center';
          ctx.fillText('▶CORE◀',coreX,coreY-45); ctx.textAlign='left';
        }

        // ─── 全体HPバー ───
        const totalHp=(e.turret1Hp||0)+(e.turret2Hp||0)+(e.coreHp||0);
        const totalMax=800;
        ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(x-60,y-112,120,8);
        const tpct2=Math.max(0,totalHp/totalMax);
        const barG=ctx.createLinearGradient(x-60,y-112,x+60,y-112);
        barG.addColorStop(0,'#4488ff'); barG.addColorStop(0.5,'#44ccff'); barG.addColorStop(1,'#4488ff');
        ctx.fillStyle=tpct2>0.4?barG:tpct2>0.15?'#ff8800':'#ff0044';
        ctx.fillRect(x-60,y-112,120*tpct2,8);
        ctx.strokeStyle='#44aaff'; ctx.lineWidth=1; ctx.strokeRect(x-60,y-112,120,8);
        ctx.fillStyle='#aaddff'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText('≪ SPACE FORTRESS ≫',x,y-116); ctx.textAlign='left';
        break;
      }

      case 'fireDragon':{
        // 火竜ボス ─ 圧倒的な存在感
        const dt=frame*0.025;
        // 翼
        const wflap=Math.sin(dt*2.5)*18;
        ctx.fillStyle='rgba(160,0,0,0.8)';
        ctx.beginPath();
        ctx.moveTo(x-5,y-12);
        ctx.bezierCurveTo(x-18,y-30,x-50,y-55+wflap,x-65,y-50+wflap);
        ctx.bezierCurveTo(x-50,y-35,x-25,y-20,x-5,y-12);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x+5,y-12);
        ctx.bezierCurveTo(x+18,y-30,x+50,y-55+wflap,x+65,y-50+wflap);
        ctx.bezierCurveTo(x+50,y-35,x+25,y-20,x+5,y-12);
        ctx.closePath(); ctx.fill();
        // 翼の骨格
        ctx.strokeStyle='rgba(255,80,0,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-5,y-12); ctx.lineTo(x-65,y-50+wflap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-20,y-20); ctx.lineTo(x-50,y-55+wflap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+5,y-12); ctx.lineTo(x+65,y-50+wflap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+20,y-20); ctx.lineTo(x+50,y-55+wflap); ctx.stroke();

        // 尾
        ctx.strokeStyle='#aa1100'; ctx.lineWidth=14; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x-30,y+8); ctx.bezierCurveTo(x-55,y+20,x-60,y,x-50,y-10); ctx.stroke();
        ctx.strokeStyle='#cc2200'; ctx.lineWidth=10;
        ctx.beginPath(); ctx.moveTo(x-30,y+8); ctx.bezierCurveTo(x-55,y+20,x-60,y,x-50,y-10); ctx.stroke();

        // 胴体
        const dbG=ctx.createRadialGradient(x-5,y-5,5,x,y,38);
        dbG.addColorStop(0,'#ff6600'); dbG.addColorStop(0.3,'#dd2200'); dbG.addColorStop(0.7,'#aa1100'); dbG.addColorStop(1,'#550000');
        ctx.fillStyle=dbG; ctx.shadowColor='#ff2200'; ctx.shadowBlur=20;
        ctx.beginPath(); ctx.ellipse(x,y,38,22,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 鱗
        ctx.strokeStyle='rgba(200,80,0,0.5)'; ctx.lineWidth=1.5;
        for(let i=-3;i<=3;i++){
          ctx.beginPath(); ctx.arc(x+i*10,y+6,8,0,Math.PI); ctx.stroke();
        }
        ctx.strokeStyle='rgba(255,120,0,0.3)'; ctx.lineWidth=1;
        for(let i=-3;i<=3;i++){
          ctx.beginPath(); ctx.arc(x+i*10+5,y-2,6,0,Math.PI); ctx.stroke();
        }
        // 首
        ctx.fillStyle='#cc2200';
        ctx.beginPath(); ctx.ellipse(x+44,y-8,14,10,-0.2,0,Math.PI*2); ctx.fill();
        // 頭
        const dhG=ctx.createRadialGradient(x+50,y-10,4,x+50,y-8,20);
        dhG.addColorStop(0,'#ff5500'); dhG.addColorStop(0.5,'#cc1100'); dhG.addColorStop(1,'#660000');
        ctx.fillStyle=dhG; ctx.shadowColor='#ff2200'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.ellipse(x+54,y-8,18,14,-0.15,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 下アゴ
        ctx.fillStyle='#bb1100';
        ctx.beginPath(); ctx.ellipse(x+52,y+2,15,7,0.2,0,Math.PI*2); ctx.fill();
        // 牙
        ctx.fillStyle='#ffeecc'; ctx.shadowColor='#ffffff'; ctx.shadowBlur=4;
        for(let i=0;i<4;i++){
          const fx=x+40+i*7, fy=y-2;
          ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+2,fy+9); ctx.lineTo(fx+4,fy); ctx.closePath(); ctx.fill();
        }
        for(let i=0;i<4;i++){
          const fx=x+40+i*7, fy=y-14;
          ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+2,fy-9); ctx.lineTo(fx+4,fy); ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur=0;
        // 角（2本）
        ctx.fillStyle='#ffaa00'; ctx.shadowColor='#ff6600'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(x+48,y-20); ctx.lineTo(x+55,y-40); ctx.lineTo(x+62,y-20); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+58,y-18); ctx.lineTo(x+64,y-36); ctx.lineTo(x+70,y-18); ctx.closePath(); ctx.fill();
        // 目
        ctx.fillStyle='#ffff00'; ctx.shadowColor='#ffff00'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.ellipse(x+58,y-10,6,8,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(x+59,y-10,3,5,0,0,Math.PI*2); ctx.fill();
        // 目のハイライト
        ctx.fillStyle='rgba(255,255,200,0.8)';
        ctx.beginPath(); ctx.arc(x+57,y-13,2,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // HPバー
        hpBar(x,y-52,e.hp,200,110);
        break;
      }

      case 'twinDragon':{
        // ══════════════════════════════════════════════════
        // ツイン火龍 ─ 極めてリアルな双頭火竜
        // ══════════════════════════════════════════════════
        const dt2=frame*0.018;
        const flap=Math.sin(dt2*2.6)*24;        // 翼の羽ばたき
        const sway=Math.sin(dt2*0.9)*4;          // 胴のうねり
        const breath=Math.abs(Math.sin(dt2*3.5));// ブレスの明滅
        const h1Dead=e.head1dead||false;
        const h2Dead=e.head2dead||false;

        // ── ヘルパー: 鱗列（始点→終点に沿って鱗を並べる）──
        const drawScales=(x1,y1,x2,y2,n,r,col)=>{
          for(let si=0;si<n;si++){
            const t=si/n;
            const sx=x1+(x2-x1)*t, sy=y1+(y2-y1)*t;
            ctx.fillStyle=col;
            ctx.beginPath(); ctx.arc(sx,sy,r,Math.PI,Math.PI*2); ctx.fill();
          }
        };

        // ════════════════════════════════
        // 1. 尾（太くうねる、先端に矢尻）
        // ════════════════════════════════
        ctx.lineCap='round'; ctx.lineJoin='round';
        // 尾の外形（影付き）
        ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=26;
        ctx.beginPath(); ctx.moveTo(x-32,y+10+sway);
        ctx.bezierCurveTo(x-62,y+28,x-95,y+18+sway*0.5,x-100,y-5);
        ctx.bezierCurveTo(x-105,y-28,x-88,y-44,x-72,y-36); ctx.stroke();

        const tailG=ctx.createLinearGradient(x-32,y,x-100,y);
        tailG.addColorStop(0,'#7a0a00'); tailG.addColorStop(0.4,'#a01200'); tailG.addColorStop(0.7,'#7a0a00'); tailG.addColorStop(1,'#3a0600');
        ctx.strokeStyle=tailG; ctx.lineWidth=22;
        ctx.beginPath(); ctx.moveTo(x-32,y+10+sway);
        ctx.bezierCurveTo(x-62,y+28,x-95,y+18+sway*0.5,x-100,y-5);
        ctx.bezierCurveTo(x-105,y-28,x-88,y-44,x-72,y-36); ctx.stroke();
        // 尾の腹側（明るい）
        ctx.strokeStyle='rgba(255,120,0,0.18)'; ctx.lineWidth=10;
        ctx.beginPath(); ctx.moveTo(x-32,y+14+sway);
        ctx.bezierCurveTo(x-62,y+32,x-93,y+22+sway*0.5,x-98,y-2);
        ctx.bezierCurveTo(x-103,y-25,x-87,y-40,x-73,y-33); ctx.stroke();
        // 尾の鱗
        drawScales(x-38,y+18+sway, x-98,y-2, 7, 9, 'rgba(180,30,0,0.55)');
        drawScales(x-40,y+8+sway,  x-100,y-8, 7, 7, 'rgba(100,10,0,0.35)');
        // 尾の先端・矢尻型
        ctx.fillStyle='#cc2000';
        ctx.beginPath(); ctx.moveTo(x-72,y-36); ctx.lineTo(x-84,y-50); ctx.lineTo(x-68,y-42); ctx.lineTo(x-78,y-56); ctx.lineTo(x-62,y-44); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#ff5500'; ctx.shadowColor='#ff3300'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.moveTo(x-72,y-36); ctx.lineTo(x-82,y-48); ctx.lineTo(x-68,y-40); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;

        // ── 尻尾突き攻撃の描画 ──
        {
          const te=e.tailExtend||0;
          if(te>0){
            const td=e.tailDir||1;
            // 尻尾を自機方向に伸ばす（胴体左側から突き出す）
            const tBaseX=x-60, tBaseY=y-5+sway;
            const tTipX=tBaseX-te*0.55, tTipY=tBaseY+td*te*0.7;
            // 尾の太いアーム
            ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=20; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(tBaseX,tBaseY); ctx.bezierCurveTo(tBaseX-te*0.2,tBaseY+td*te*0.2, tTipX+te*0.1,tTipY-td*te*0.1, tTipX,tTipY); ctx.stroke();
            const tG2=ctx.createLinearGradient(tBaseX,tBaseY,tTipX,tTipY);
            tG2.addColorStop(0,'#8a0a00'); tG2.addColorStop(0.5,'#aa1400'); tG2.addColorStop(1,'#6a0600');
            ctx.strokeStyle=tG2; ctx.lineWidth=16;
            ctx.beginPath(); ctx.moveTo(tBaseX,tBaseY); ctx.bezierCurveTo(tBaseX-te*0.2,tBaseY+td*te*0.2, tTipX+te*0.1,tTipY-td*te*0.1, tTipX,tTipY); ctx.stroke();
            // 腹側ハイライト
            ctx.strokeStyle='rgba(255,100,0,0.2)'; ctx.lineWidth=6;
            ctx.beginPath(); ctx.moveTo(tBaseX+3,tBaseY+2); ctx.bezierCurveTo(tBaseX-te*0.2+3,tBaseY+td*te*0.2+2, tTipX+te*0.1+2,tTipY-td*te*0.1+2, tTipX+2,tTipY+2); ctx.stroke();
            // 先端の矢尻（巨大な刃）
            const tipAng=Math.atan2(tTipY-tBaseY, tTipX-tBaseX);
            ctx.save(); ctx.translate(tTipX,tTipY); ctx.rotate(tipAng);
            ctx.fillStyle='#cc2000';
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-18,td>0?14:-14); ctx.lineTo(-6,td>0?6:-6); ctx.lineTo(-20,td>0?22:-22); ctx.lineTo(-8,td>0?10:-10); ctx.closePath(); ctx.fill();
            ctx.fillStyle='#ff4400'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=8;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-14,td>0?10:-10); ctx.lineTo(-4,td>0?4:-4); ctx.closePath(); ctx.fill();
            ctx.shadowBlur=0;
            ctx.restore();
          }
        }
        // 背中の背びれ列（脊椎棘）
        const spinePoints=[[x-28,y-18],[x-14,y-24],[x+0,y-26],[x+14,y-24],[x+28,y-20]];
        for(const [sx2,sy2] of spinePoints){
          ctx.fillStyle='rgba(0,0,0,0.4)';
          ctx.beginPath(); ctx.moveTo(sx2-6,sy2+2); ctx.lineTo(sx2,sy2-22); ctx.lineTo(sx2+6,sy2+2); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#cc3000';
          ctx.beginPath(); ctx.moveTo(sx2-5,sy2+2); ctx.lineTo(sx2,sy2-20); ctx.lineTo(sx2+5,sy2+2); ctx.closePath(); ctx.fill();
          ctx.fillStyle='rgba(255,140,0,0.6)';
          ctx.beginPath(); ctx.moveTo(sx2-1,sy2+2); ctx.lineTo(sx2,sy2-18); ctx.lineTo(sx2+2,sy2+2); ctx.closePath(); ctx.fill();
        }

        // ════════════════════════════════
        // 2. 翼（左右非対称、膜に骨格脈）
        // ════════════════════════════════
        const drawWing=(sign, baseX, baseY, flapDir)=>{
          const fv=flap*flapDir;
          // 翼の膜（3層: 影→本体→表面の光沢）
          ctx.fillStyle='rgba(0,0,0,0.5)';
          ctx.beginPath(); ctx.moveTo(baseX, baseY);
          ctx.bezierCurveTo(baseX+sign*14,baseY-12+fv*0.1, baseX+sign*55,baseY-62+fv, baseX+sign*82,baseY-72+fv*1.2);
          ctx.bezierCurveTo(baseX+sign*70,baseY-50+fv*0.9, baseX+sign*40,baseY-30, baseX,baseY+8);
          ctx.closePath(); ctx.fill();

          const wingG=ctx.createLinearGradient(baseX,baseY-40, baseX+sign*80,baseY-70+fv);
          wingG.addColorStop(0,'rgba(110,0,0,0.92)');
          wingG.addColorStop(0.35,'rgba(150,12,0,0.88)');
          wingG.addColorStop(0.65,'rgba(95,5,0,0.82)');
          wingG.addColorStop(1,'rgba(55,0,0,0.75)');
          ctx.fillStyle=wingG;
          ctx.beginPath(); ctx.moveTo(baseX, baseY);
          ctx.bezierCurveTo(baseX+sign*14,baseY-12+fv*0.1, baseX+sign*55,baseY-62+fv, baseX+sign*82,baseY-72+fv*1.2);
          ctx.bezierCurveTo(baseX+sign*70,baseY-50+fv*0.9, baseX+sign*40,baseY-30, baseX,baseY+8);
          ctx.closePath(); ctx.fill();

          // 翼の膜の透過ハイライト
          ctx.fillStyle='rgba(255,80,0,0.08)';
          ctx.beginPath(); ctx.moveTo(baseX+sign*10,baseY-5);
          ctx.bezierCurveTo(baseX+sign*30,baseY-30+fv*0.4, baseX+sign*60,baseY-55+fv, baseX+sign*78,baseY-68+fv*1.1);
          ctx.bezierCurveTo(baseX+sign*62,baseY-46+fv*0.8, baseX+sign*32,baseY-22, baseX+sign*8,baseY+2);
          ctx.closePath(); ctx.fill();

          // 翼の骨格（主骨・副骨）
          ctx.strokeStyle='rgba(200,30,0,0.65)'; ctx.lineWidth=3; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(baseX,baseY); ctx.bezierCurveTo(baseX+sign*30,baseY-28+fv*0.5, baseX+sign*65,baseY-60+fv, baseX+sign*82,baseY-72+fv*1.2); ctx.stroke();
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(baseX+sign*6,baseY-4); ctx.bezierCurveTo(baseX+sign*28,baseY-38+fv*0.6, baseX+sign*50,baseY-65+fv*1.1, baseX+sign*68,baseY-74+fv*1.3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(baseX+sign*10,baseY+2); ctx.bezierCurveTo(baseX+sign*32,baseY-20+fv*0.3, baseX+sign*55,baseY-42+fv*0.9, baseX+sign*72,baseY-52+fv); ctx.stroke();
          ctx.lineWidth=1.5;
          ctx.strokeStyle='rgba(255,100,0,0.3)';
          // 翼膜の縦筋
          for(let wi=0;wi<5;wi++){
            const wt=0.15+wi*0.17;
            const wx1=baseX+sign*wt*82, wy1=baseY-70*wt+fv*wt*1.2-10;
            const wx2=baseX+sign*wt*38+sign*10, wy2=baseY-20*wt+4;
            ctx.beginPath(); ctx.moveTo(wx1,wy1); ctx.lineTo(wx2,wy2); ctx.stroke();
          }
        };
        // 上翼（胴の上側から後方へ）
        drawWing(-1, x-12, y-16, 1);
        // 下翼（胴の下側から後方へ）
        ctx.save(); ctx.scale(1,-1);
        drawWing(-1, x-12, -(y+18), -1);
        ctx.restore();

        // ════════════════════════════════
        // 3. 胴体（鱗に覆われた巨体）
        // ════════════════════════════════
        // 胴の影
        ctx.fillStyle='rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.ellipse(x+2,y+4,52,30,0,0,Math.PI*2); ctx.fill();
        // 胴本体
        const bodyG2=ctx.createRadialGradient(x-10,y-8,6,x,y,52);
        bodyG2.addColorStop(0,'#ff4400');
        bodyG2.addColorStop(0.18,'#d42000');
        bodyG2.addColorStop(0.45,'#a01000');
        bodyG2.addColorStop(0.72,'#780800');
        bodyG2.addColorStop(1,'#3c0400');
        ctx.fillStyle=bodyG2; ctx.shadowColor='#ff1800'; ctx.shadowBlur=25;
        ctx.beginPath(); ctx.ellipse(x,y,50,28,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 腹側の黄金色
        const bellyG2=ctx.createLinearGradient(x-28,y+14,x+28,y+26);
        bellyG2.addColorStop(0,'rgba(200,100,0,0.1)');
        bellyG2.addColorStop(0.5,'rgba(255,200,60,0.35)');
        bellyG2.addColorStop(1,'rgba(200,80,0,0.1)');
        ctx.fillStyle=bellyG2; ctx.beginPath(); ctx.ellipse(x,y+18,32,9,0,0,Math.PI*2); ctx.fill();
        // 鱗（大粒・胴）
        ctx.strokeStyle='rgba(160,30,0,0.55)'; ctx.lineWidth=2;
        for(let row=0;row<3;row++) for(let col=-5;col<=5;col++){
          const sx2=x+col*10+(row%2)*5, sy2=y-8+row*11;
          if(Math.abs(sx2-x)/50+Math.abs(sy2-y)/28<0.95)
            { ctx.beginPath(); ctx.arc(sx2,sy2,6.5,0,Math.PI); ctx.stroke(); }
        }
        ctx.strokeStyle='rgba(255,100,0,0.28)'; ctx.lineWidth=1.5;
        for(let row=0;row<2;row++) for(let col=-5;col<=5;col++){
          const sx2=x+col*10+5+(row%2)*5, sy2=y-3+row*10;
          if(Math.abs(sx2-x)/50+Math.abs(sy2-y)/28<0.85)
            { ctx.beginPath(); ctx.arc(sx2,sy2,4.5,0,Math.PI); ctx.stroke(); }
        }

        // ════════════════════════════════
        // 4. 首1（上 → 右上方向）+ 頭1（火球攻撃）
        // ════════════════════════════════
        const h1OfsX=e.headOfs1?e.headOfs1.x:0, h1OfsY=e.headOfs1?e.headOfs1.y:0;
        const h2OfsX=e.headOfs2?e.headOfs2.x:0, h2OfsY=e.headOfs2?e.headOfs2.y:0;
        const neck1ctrl = { x1:x+22,y1:y-22, cx1:x+36+h1OfsX*0.3,cy1:y-36+h1OfsY*0.3, cx2:x+36+h1OfsX*0.7,cy2:y-52+h1OfsY*0.7, x2:x+32+h1OfsX,y2:y-64+h1OfsY };
        const h1x=x+32+h1OfsX, h1y=y-64+h1OfsY;

        const drawNeck=(p,thick,col1,col2)=>{
          ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=thick+6; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.x2,p.y2); ctx.stroke();
          const ng=ctx.createLinearGradient(p.x1,p.y1,p.x2,p.y2);
          ng.addColorStop(0,col1); ng.addColorStop(0.4,'#c01400'); ng.addColorStop(0.7,col2); ng.addColorStop(1,col2);
          ctx.strokeStyle=ng; ctx.lineWidth=thick;
          ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.x2,p.y2); ctx.stroke();
          // 首の腹側ハイライト
          ctx.strokeStyle='rgba(255,140,0,0.2)'; ctx.lineWidth=thick*0.4;
          ctx.beginPath(); ctx.moveTo(p.x1+3,p.y1+4); ctx.bezierCurveTo(p.cx1+3,p.cy1+4,p.cx2+2,p.cy2+4,p.x2+2,p.y2+4); ctx.stroke();
          // 鱗
          for(let ni=0;ni<=6;ni++){
            const nt=ni/6;
            const bx=p.x1+(p.x2-p.x1)*nt+(p.cx1-p.x1)*nt*(1-nt)*3;
            const by=p.y1+(p.y2-p.y1)*nt+(p.cy1-p.y1)*nt*(1-nt)*3;
            ctx.fillStyle='rgba(160,20,0,0.55)';
            ctx.beginPath(); ctx.arc(bx-4,by-2,5,0,Math.PI); ctx.fill();
          }
        };
        drawNeck(neck1ctrl,18,'#9a0e00','#7a0800');

        const drawDragonHead=(hx,hy,ang,hDead,isBreathHead)=>{
          if(hDead){
            // 破壊済み頭: 黒焦げ+煙
            ctx.save(); ctx.translate(hx,hy); ctx.rotate(ang);
            ctx.fillStyle='#1a1a1a'; ctx.shadowColor='#888'; ctx.shadowBlur=10;
            ctx.beginPath(); ctx.ellipse(8,0,26,14,0,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0;
            ctx.fillStyle='#333'; ctx.beginPath(); ctx.ellipse(8,0,22,11,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#555'; ctx.beginPath(); ctx.ellipse(6,-2,14,7,0.15,0,Math.PI*2); ctx.fill();
            for(let si=0;si<8;si++){
              const age=(frame*0.08+si*0.8)%1;
              const sx2=(-8+si*8)+(Math.sin(frame*0.05+si)*4);
              const sy2=-14-age*30;
              const sr=3+age*10;
              ctx.fillStyle=`rgba(60,60,60,${(1-age)*0.5})`;
              ctx.beginPath(); ctx.arc(sx2,sy2,sr,0,Math.PI*2); ctx.fill();
            }
            ctx.restore(); return;
          }

          ctx.save(); ctx.translate(hx,hy); ctx.rotate(ang);
          // 頭の主グラデーション（奥行き）
          ctx.shadowColor='rgba(255,30,0,0.5)'; ctx.shadowBlur=16;
          const hg=ctx.createRadialGradient(-4,-4,3,0,0,30);
          hg.addColorStop(0,'#ff5500');
          hg.addColorStop(0.2,'#dd1800');
          hg.addColorStop(0.5,'#aa0e00');
          hg.addColorStop(0.8,'#780800');
          hg.addColorStop(1,'#420000');

          // 頭蓋の輪郭（竜らしいカクカクした頭骨形）
          ctx.fillStyle='rgba(0,0,0,0.5)';
          ctx.beginPath();
          ctx.moveTo(-18,-2);
          ctx.lineTo(-16,-12);
          ctx.bezierCurveTo(-10,-18, 4,-20, 14,-16);
          ctx.lineTo(26,-12);
          ctx.bezierCurveTo(34,-8, 34,4, 28,8);
          ctx.lineTo(18,14);
          ctx.bezierCurveTo(6,18,-8,16,-16,10);
          ctx.lineTo(-18,4);
          ctx.closePath(); ctx.fill();

          ctx.fillStyle=hg;
          ctx.beginPath();
          ctx.moveTo(-16,-2);
          ctx.lineTo(-14,-12);
          ctx.bezierCurveTo(-8,-18, 4,-20, 14,-16);
          ctx.lineTo(26,-12);
          ctx.bezierCurveTo(34,-8, 34,4, 28,8);
          ctx.lineTo(18,14);
          ctx.bezierCurveTo(6,18,-8,16,-16,10);
          ctx.lineTo(-16,4);
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur=0;

          // 頭の鱗（小粒）
          ctx.strokeStyle='rgba(180,30,0,0.5)'; ctx.lineWidth=1.5;
          [[-10,-6],[-2,-8],[8,-8],[16,-6],[20,-2],[16,4],[8,6],[0,6]].forEach(([sx2,sy2])=>{
            if(Math.abs(sx2)/34+Math.abs(sy2)/20<0.9){
              ctx.beginPath(); ctx.arc(sx2,sy2,4,0,Math.PI); ctx.stroke();
            }
          });
          // 頭頂のやや明るい反射
          ctx.fillStyle='rgba(255,100,0,0.18)';
          ctx.beginPath(); ctx.ellipse(4,-8,14,6,0.1,0,Math.PI*2); ctx.fill();

          // 下アゴ（わずかに開いている）
          const jawOpen=isBreathHead? 4+breath*8 : 2+Math.abs(Math.sin(dt2*1.2))*4;
          ctx.fillStyle='rgba(0,0,0,0.45)';
          ctx.beginPath(); ctx.moveTo(-14,6+jawOpen*0.2); ctx.bezierCurveTo(-4,16+jawOpen,14,16+jawOpen,24,10+jawOpen*0.5); ctx.lineTo(20,14); ctx.bezierCurveTo(8,16,-6,14,-14,10); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#880a00';
          ctx.beginPath(); ctx.moveTo(-14,4+jawOpen*0.2); ctx.bezierCurveTo(-4,14+jawOpen,14,14+jawOpen,24,8+jawOpen*0.5); ctx.lineTo(20,12); ctx.bezierCurveTo(8,14,-6,12,-14,8); ctx.closePath(); ctx.fill();
          // 口の中（赤い）
          if(jawOpen>3){
            ctx.fillStyle='#cc0800';
            ctx.beginPath(); ctx.moveTo(-8,8); ctx.bezierCurveTo(2,10+jawOpen*0.7,14,10+jawOpen*0.7,20,6); ctx.lineTo(16,8); ctx.bezierCurveTo(8,9,0,9,-6,8); ctx.closePath(); ctx.fill();
            // 舌
            ctx.fillStyle='#ee1100';
            ctx.beginPath(); ctx.moveTo(8,10+jawOpen*0.4); ctx.bezierCurveTo(18,13+jawOpen*0.6, 26,10+jawOpen*0.3, 28,8); ctx.lineTo(26,8); ctx.bezierCurveTo(24,10+jawOpen*0.3,18,12+jawOpen*0.5,10,10+jawOpen*0.4); ctx.closePath(); ctx.fill();
          }

          // 牙（鋭く長い）: 上顎と下顎
          ctx.fillStyle='#f8eecc'; ctx.shadowColor='rgba(255,255,220,0.7)'; ctx.shadowBlur=4;
          const upperFangs=[[-10,-1],[-2,-1],[7,-1],[16,-1]];
          const lowerFangs=[[-8,jawOpen+3],[0,jawOpen+4],[8,jawOpen+4],[17,jawOpen+2]];
          upperFangs.forEach(([fx,fy])=>{ ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+2,fy+12); ctx.lineTo(fx+4,fy); ctx.closePath(); ctx.fill(); });
          lowerFangs.forEach(([fx,fy])=>{ ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+2,fy-11); ctx.lineTo(fx+4,fy); ctx.closePath(); ctx.fill(); });
          ctx.shadowBlur=0;

          // 角（鋭く複数）
          const hornData=isBreathHead?
            [[2,-18,10,-42,18,-18],[12,-16,20,-38,28,-16]]:
            [[2,-18,8,-44,16,-18],[12,-16,18,-40,26,-16]];
          hornData.forEach(([hx1,hy1,hx2,hy2,hx3,hy3])=>{
            ctx.fillStyle='rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.moveTo(hx1+1,hy1+2); ctx.lineTo(hx2+1,hy2+2); ctx.lineTo(hx3+1,hy3+2); ctx.closePath(); ctx.fill();
            const hornG=ctx.createLinearGradient(hx1,hy1,hx2,hy2);
            hornG.addColorStop(0,'#cc8800'); hornG.addColorStop(0.4,'#ee9900'); hornG.addColorStop(1,'#774400');
            ctx.fillStyle=hornG; ctx.shadowColor='#ff8800'; ctx.shadowBlur=8;
            ctx.beginPath(); ctx.moveTo(hx1,hy1); ctx.lineTo(hx2,hy2); ctx.lineTo(hx3,hy3); ctx.closePath(); ctx.fill();
            ctx.shadowBlur=0;
            // 角の縦筋
            ctx.strokeStyle='rgba(255,180,0,0.45)'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(hx1+2,hy1); ctx.lineTo(hx2+1,hy2); ctx.stroke();
          });

          // 眼窩の窪み（影）
          ctx.fillStyle='rgba(0,0,0,0.65)';
          ctx.beginPath(); ctx.ellipse(20,-8,10,11,0.1,0,Math.PI*2); ctx.fill();
          // 強膜（白目ではなく黄土色）
          ctx.fillStyle='#c88000'; ctx.shadowColor='#ffaa00'; ctx.shadowBlur=10;
          ctx.beginPath(); ctx.ellipse(20,-8,8,9,0.1,0,Math.PI*2); ctx.fill();
          // 瞳（縦長の爬虫類型）
          ctx.fillStyle='#1a0a00';
          ctx.beginPath(); ctx.ellipse(20,-8,3,7.5,0,0,Math.PI*2); ctx.fill();
          // 目の光彩（虹彩ライン）
          ctx.strokeStyle='rgba(200,120,0,0.5)'; ctx.lineWidth=1;
          for(let ri=1;ri<=3;ri++){
            ctx.beginPath(); ctx.ellipse(20,-8,ri*2+2,ri*2.5+2,0,0,Math.PI*2); ctx.stroke();
          }
          // ハイライト
          ctx.fillStyle='rgba(255,255,200,0.85)';
          ctx.beginPath(); ctx.arc(17,-12,2.5,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,240,180,0.5)';
          ctx.beginPath(); ctx.arc(22,-5,1.5,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;

          // 鼻孔
          ctx.fillStyle='rgba(0,0,0,0.7)';
          ctx.beginPath(); ctx.ellipse(28,-4,3,2,-0.3,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(28,-1,3,2,-0.3,0,Math.PI*2); ctx.fill();
          // 鼻孔から漏れる炎
          if(breath>0.3){
            const nfG=ctx.createRadialGradient(32,-2,0,34,-2,8+breath*6);
            nfG.addColorStop(0,`rgba(255,220,80,${breath*0.8})`);
            nfG.addColorStop(0.5,`rgba(255,80,0,${breath*0.5})`);
            nfG.addColorStop(1,'rgba(255,0,0,0)');
            ctx.fillStyle=nfG; ctx.beginPath(); ctx.arc(34,-2,8+breath*6,0,Math.PI*2); ctx.fill();
          }

          // ブレスヘッドのチャージ炎（口から）
          if(isBreathHead && breath>0.4){
            for(let pi=0;pi<6;pi++){
              const age2=(frame*0.09+pi*0.5)%1;
              const px2=28+age2*20+Math.sin(age2*Math.PI+pi)*5;
              const py2=-2+Math.cos(age2*Math.PI*2+pi)*4;
              const pr2=3+age2*8;
              ctx.fillStyle=`rgba(255,${Math.floor(160-age2*100)},0,${(1-age2)*0.7})`;
              ctx.beginPath(); ctx.arc(px2,py2,pr2,0,Math.PI*2); ctx.fill();
            }
          }

          ctx.restore();
        };

        // 首2（下 → 右下方向）
        const neck2ctrl = { x1:x+20,y1:y+22, cx1:x+34+h2OfsX*0.3,cy1:y+32+h2OfsY*0.3, cx2:x+32+h2OfsX*0.7,cy2:y+44+h2OfsY*0.7, x2:x+28+h2OfsX,y2:y+56+h2OfsY };
        const h2x=x+28+h2OfsX, h2y=y+56+h2OfsY;
        drawNeck(neck2ctrl,18,'#9a0e00','#7a0800');

        // 頭1（上: 火球）
        drawDragonHead(h1x, h1y, -0.25, h1Dead, false);
        // 頭2（下: ブレス）
        drawDragonHead(h2x, h2y, 0.20, h2Dead, true);

        // ════════════════════════════════
        // 5. HP表示
        // ════════════════════════════════
        const totalMaxHp=400;
        const totalNow=Math.max(0,(h1Dead?0:(e.head1hp||0))+(h2Dead?0:(e.head2hp||0)));
        // 全体HP
        ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(x-52,y-98,104,9);
        const tpct=totalNow/totalMaxHp;
        const tbarG=ctx.createLinearGradient(x-52,y-98,x+52,y-98);
        tbarG.addColorStop(0,'#ff2200'); tbarG.addColorStop(0.5,'#ff6600'); tbarG.addColorStop(1,'#ff2200');
        ctx.fillStyle=tpct>0.5?tbarG:tpct>0.25?'#ff6600':'#ff0000';
        ctx.fillRect(x-52,y-98,104*tpct,9);
        ctx.strokeStyle='#ff8800'; ctx.lineWidth=1; ctx.strokeRect(x-52,y-98,104,9);
        ctx.fillStyle='#ffcc88'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText('▲TWIN DRAGON▲',x,y-101);
        ctx.textAlign='left';

        // 頭1 HPバー（赤）
        if(!h1Dead){
          const h1p=Math.max(0,(e.head1hp||200)/200);
          ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(h1x-22,h1y-55,44,6);
          ctx.fillStyle=h1p>0.5?'#ff2200':'#ff0000';
          ctx.fillRect(h1x-22,h1y-55,44*h1p,6);
          ctx.strokeStyle='#ff6600'; ctx.lineWidth=1; ctx.strokeRect(h1x-22,h1y-55,44,6);
          ctx.fillStyle='#ff9966'; ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('HEAD1',h1x,h1y-58); ctx.textAlign='left';
        }
        // 頭2 HPバー（オレンジ）
        if(!h2Dead){
          const h2p=Math.max(0,(e.head2hp||200)/200);
          ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(h2x-22,h2y+36,44,6);
          ctx.fillStyle=h2p>0.5?'#ff6600':'#ff0000';
          ctx.fillRect(h2x-22,h2y+36,44*h2p,6);
          ctx.strokeStyle='#ffaa00'; ctx.lineWidth=1; ctx.strokeRect(h2x-22,h2y+36,44,6);
          ctx.fillStyle='#ffcc88'; ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('HEAD2',h2x,h2y+33); ctx.textAlign='left';
        }
        break;
      }


      case 'moaiBoss':{
        // モアイ大王 ─ 巨大リアルモアイ（3体構成ボス）
        // role: center=正面, top=天井（逆さ）, bottom=床
        const role=e.role||'center';
        const flipped=role==='top';
        if(flipped){
          ctx.save(); ctx.translate(x,y); ctx.scale(1,-1); ctx.translate(-x,-y);
        }
        const mbt=frame*0.02;
        const eyePulse=Math.abs(Math.sin(mbt*3));
        const sB='#252830', sM='#3e4350', sH='#5e6474', sT='#78808e';

        // 台座アフ（大型）
        const ahuBG=ctx.createLinearGradient(x-38,y+52,x+38,y+52);
        ahuBG.addColorStop(0,sB); ahuBG.addColorStop(0.4,sM); ahuBG.addColorStop(1,sB);
        ctx.fillStyle=ahuBG;
        ctx.beginPath(); ctx.moveTo(x-40,y+62); ctx.lineTo(x-36,y+44); ctx.lineTo(x+36,y+44); ctx.lineTo(x+40,y+62); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#14161a'; ctx.lineWidth=1; ctx.stroke();
        for(let li=0;li<3;li++){
          ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(x-38+li,y+48+li*6); ctx.lineTo(x+38-li,y+48+li*6); ctx.stroke();
        }

        // 胴体
        const bG2=ctx.createLinearGradient(x-30,y+44,x+30,y+44);
        bG2.addColorStop(0,sB); bG2.addColorStop(0.2,sM); bG2.addColorStop(0.5,sH); bG2.addColorStop(0.8,sM); bG2.addColorStop(1,sB);
        ctx.fillStyle=bG2; ctx.fillRect(x-28,y-6,56,52);
        ctx.strokeStyle=sT; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-28,y-6); ctx.lineTo(x+28,y-6); ctx.stroke();
        // 腕ライン（両脇）
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(x-24,y+2); ctx.lineTo(x-22,y+28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+24,y+2); ctx.lineTo(x+22,y+28); ctx.stroke();
        // 腹帯
        ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-27,y+18); ctx.lineTo(x+27,y+18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-27,y+32); ctx.lineTo(x+27,y+32); ctx.stroke();
        // 手（腹前で交差）
        ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(x-25,y+22); ctx.bezierCurveTo(x-14,y+18,x+14,y+18,x+25,y+22); ctx.stroke();

        // 首
        const nkG2=ctx.createLinearGradient(x-20,y-20,x+20,y-20);
        nkG2.addColorStop(0,sB); nkG2.addColorStop(0.3,sM); nkG2.addColorStop(0.7,sH); nkG2.addColorStop(1,sB);
        ctx.fillStyle=nkG2; ctx.fillRect(x-20,y-20,40,16);

        // 頭部（縦長のモアイ形）
        const hG2=ctx.createLinearGradient(x-32,y-90,x+32,y-20);
        hG2.addColorStop(0,sH); hG2.addColorStop(0.25,sT); hG2.addColorStop(0.55,sM); hG2.addColorStop(1,sB);
        ctx.fillStyle=hG2;
        ctx.beginPath();
        ctx.moveTo(x-20,y-20);
        ctx.lineTo(x-28,y-44);
        ctx.lineTo(x-26,y-72);
        ctx.lineTo(x-14,y-84);
        ctx.lineTo(x+14,y-84);
        ctx.lineTo(x+26,y-72);
        ctx.lineTo(x+28,y-44);
        ctx.lineTo(x+20,y-20);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#14161a'; ctx.lineWidth=1; ctx.stroke();

        // プカオ（帽子）: 赤褐色
        const pkG2=ctx.createLinearGradient(x-20,y-96,x+20,y-84);
        pkG2.addColorStop(0,'#2a1810'); pkG2.addColorStop(0.4,'#5c3022'); pkG2.addColorStop(1,'#2a1810');
        ctx.fillStyle=pkG2;
        ctx.beginPath(); ctx.moveTo(x-20,y-84); ctx.lineTo(x-18,y-100); ctx.lineTo(x+18,y-100); ctx.lineTo(x+20,y-84); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#4a2818'; ctx.fillRect(x-16,y-104,32,6);
        ctx.strokeStyle='#180e08'; ctx.lineWidth=1; ctx.beginPath(); ctx.strokeRect(x-20,y-84,40,16); ctx.stroke();

        // 眉骨（大きく張り出す）
        const brG2=ctx.createLinearGradient(x-28,y-58,x+28,y-48);
        brG2.addColorStop(0,sB); brG2.addColorStop(0.15,sM); brG2.addColorStop(0.5,sH); brG2.addColorStop(0.85,sM); brG2.addColorStop(1,sB);
        ctx.fillStyle=brG2;
        ctx.beginPath(); ctx.moveTo(x-28,y-50); ctx.lineTo(x-28,y-62); ctx.lineTo(x-2,y-60); ctx.lineTo(x-2,y-50); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+2,y-50); ctx.lineTo(x+2,y-60); ctx.lineTo(x+28,y-62); ctx.lineTo(x+28,y-50); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x-2,y-60,4,14);
        // 眉骨下の水平影
        ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-28,y-50); ctx.lineTo(x-2,y-50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+2,y-50); ctx.lineTo(x+28,y-50); ctx.stroke();

        // 目（発光する深い眼窩）
        ctx.fillStyle='#08080e';
        ctx.beginPath(); ctx.ellipse(x-14,y-42,6,4,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+14,y-42,6,4,0,0,Math.PI*2); ctx.fill();
        // 目の発光（青白い象嵌）
        ctx.fillStyle=`rgba(100,180,255,${eyePulse*0.9})`;
        ctx.shadowColor='#44aaff'; ctx.shadowBlur=10*eyePulse;
        ctx.beginPath(); ctx.ellipse(x-14,y-42,4,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+14,y-42,4,3,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 瞳孔（暗い中心）
        ctx.fillStyle='rgba(0,0,20,0.7)';
        ctx.beginPath(); ctx.ellipse(x-14,y-42,2,1.5,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+14,y-42,2,1.5,0,0,Math.PI*2); ctx.fill();

        // 鼻（幅広く重厚）
        const nsG2=ctx.createLinearGradient(x-12,y-34,x+12,y-34);
        nsG2.addColorStop(0,sB); nsG2.addColorStop(0.4,sH); nsG2.addColorStop(1,sB);
        ctx.fillStyle=nsG2;
        ctx.beginPath();
        ctx.moveTo(x-10,y-40);
        ctx.lineTo(x-14,y-20); ctx.lineTo(x-8,y-16);
        ctx.lineTo(x+8,y-16); ctx.lineTo(x+14,y-20);
        ctx.lineTo(x+10,y-40);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=sT; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(x-8,y-40); ctx.lineTo(x-8,y-18); ctx.stroke();

        // 口（水平に薄く閉じた口）
        ctx.fillStyle='#0a0c10';
        ctx.beginPath(); ctx.moveTo(x-18,y-12); ctx.lineTo(x+18,y-12); ctx.lineTo(x+16,y-6); ctx.lineTo(x-16,y-6); ctx.closePath(); ctx.fill();
        // 口上のファロン
        ctx.fillStyle=sM;
        ctx.beginPath(); ctx.moveTo(x-16,y-14); ctx.quadraticCurveTo(x,y-10,x+16,y-14); ctx.lineTo(x+14,y-12); ctx.lineTo(x-14,y-12); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x-18,y-12); ctx.lineTo(x+18,y-12); ctx.stroke();

        // 亀裂（大型・複数）
        ctx.strokeStyle='rgba(5,8,12,0.6)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(x-8,y-84); ctx.lineTo(x-12,y-54); ctx.lineTo(x-10,y-20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+16,y-76); ctx.lineTo(x+14,y-40); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x-18,y-10); ctx.lineTo(x-16,y+16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+8,y-8); ctx.lineTo(x+12,y+20); ctx.stroke();
        // 苔・シミ
        ctx.fillStyle='rgba(50,72,30,0.35)';
        ctx.beginPath(); ctx.ellipse(x+10,y-70,10,5,0.6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x-16,y+8,8,4,0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(40,50,60,0.3)';
        ctx.beginPath(); ctx.ellipse(x+18,y+30,7,4,0.4,0,Math.PI*2); ctx.fill();

        hpBar(x,y-110,e.hp,(e.role==='center'?200:150),80);
        if(e.role==='top'){ ctx.restore(); }
        break;
      }

      case 'androidBoss':{
        // ═══════════════════════════════════════════════
        // MEGA ROBOT BOSS — 画面半分を覆う巨大ロボット
        // ═══════════════════════════════════════════════
        const ph=e.phase||1;
        const rage=e.rageFlash>0;
        // フェーズ色テーマ
        const phCol  = ph===1?'#3a6080': ph===2?'#6a3090':'#902020';
        const phGlow = ph===1?'#44aaff': ph===2?'#aa44ff':'#ff4422';
        const phCore = ph===1?'#88ddff': ph===2?'#dd88ff':'#ff8844';
        const phDark = ph===1?'#1a3040': ph===2?'#3a1850':'#4a1010';
        const rage2  = rage?`rgba(255,80,0,${0.4+Math.sin(frame*0.3)*0.3})`:'rgba(0,0,0,0)';

        // ロボット中心座標 (x=右端基準, 画面右半分を占める大型)
        const rx=x, ry=y;
        const S=1.0; // スケール

        ctx.save();

        // ── 脚部（下部2本）──
        for(const sx of [-50,50]){
          const legX=rx+sx*S;
          // 大腿
          ctx.fillStyle=phDark;
          ctx.fillRect(legX-14*S, ry+70*S, 28*S, 80*S);
          ctx.fillStyle=phCol;
          ctx.fillRect(legX-11*S, ry+72*S, 22*S, 74*S);
          // 膝関節
          const kG=ctx.createRadialGradient(legX,ry+110*S,0,legX,ry+110*S,16*S);
          kG.addColorStop(0,phCore); kG.addColorStop(0.4,phCol); kG.addColorStop(1,phDark);
          ctx.fillStyle=kG; ctx.beginPath(); ctx.arc(legX,ry+110*S,16*S,0,Math.PI*2); ctx.fill();
          // 脛
          ctx.fillStyle=phDark; ctx.fillRect(legX-12*S,ry+126*S,24*S,70*S);
          ctx.fillStyle=phCol;  ctx.fillRect(legX-9*S, ry+128*S,18*S,66*S);
          // 足首・ブーツ
          ctx.fillStyle=phDark; ctx.fillRect(legX-20*S,ry+190*S,40*S,20*S);
          ctx.shadowColor=phGlow; ctx.shadowBlur=8;
          ctx.fillStyle=phCol;  ctx.fillRect(legX-18*S,ry+192*S,36*S,16*S);
          ctx.shadowBlur=0;
          // 排気口
          ctx.fillStyle='rgba(255,120,0,0.6)';
          ctx.beginPath(); ctx.ellipse(legX,ry+208*S,8*S,4*S,0,0,Math.PI*2); ctx.fill();
        }

        // ── 腰部 ──
        ctx.fillStyle=phDark; ctx.fillRect(rx-70*S,ry+65*S,140*S,20*S);
        ctx.fillStyle=phCol;  ctx.fillRect(rx-66*S,ry+67*S,132*S,16*S);
        // 腰のV字装飾
        ctx.strokeStyle=phCore; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(rx-60*S,ry+68*S); ctx.lineTo(rx,ry+80*S); ctx.lineTo(rx+60*S,ry+68*S); ctx.stroke();

        // ── 胴体 ──
        ctx.shadowColor=phGlow; ctx.shadowBlur=20;
        // 外装甲
        ctx.fillStyle=phDark;
        ctx.beginPath();
        ctx.moveTo(rx-80*S,ry+65*S);
        ctx.lineTo(rx-90*S,ry-30*S);
        ctx.lineTo(rx-70*S,ry-80*S);
        ctx.lineTo(rx+70*S,ry-80*S);
        ctx.lineTo(rx+90*S,ry-30*S);
        ctx.lineTo(rx+80*S,ry+65*S);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 内装甲（少し小さく）
        ctx.fillStyle=phCol;
        ctx.beginPath();
        ctx.moveTo(rx-72*S,ry+62*S);
        ctx.lineTo(rx-82*S,ry-26*S);
        ctx.lineTo(rx-62*S,ry-72*S);
        ctx.lineTo(rx+62*S,ry-72*S);
        ctx.lineTo(rx+82*S,ry-26*S);
        ctx.lineTo(rx+72*S,ry+62*S);
        ctx.closePath(); ctx.fill();

        // 胸部コアリアクター
        const coreR=ph===3?22*S+Math.sin(frame*0.12)*4:18*S;
        ctx.shadowColor=phCore; ctx.shadowBlur=30;
        const coreG=ctx.createRadialGradient(rx,ry,0,rx,ry,coreR);
        coreG.addColorStop(0,'#ffffff');
        coreG.addColorStop(0.3,phCore);
        coreG.addColorStop(0.7,phGlow);
        coreG.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=coreG; ctx.beginPath(); ctx.arc(rx,ry,coreR,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // コア外リング
        ctx.strokeStyle=phCore; ctx.lineWidth=2;
        for(let ri=0;ri<3;ri++){
          ctx.globalAlpha=0.4+ri*0.2;
          ctx.beginPath(); ctx.arc(rx,ry,coreR*(1.3+ri*0.25),0,Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha=1;

        // Ph2+: 胸部レーザー砲口
        if(ph>=2){
          for(const off of [-40,40]){
            ctx.shadowColor=phGlow; ctx.shadowBlur=12;
            ctx.fillStyle=ph===3?'#ff4422':phGlow;
            ctx.beginPath(); ctx.ellipse(rx+off*S,ry,8*S,14*S,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(rx+off*S,ry,4*S,8*S,0,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0;
          }
        }

        // 胴体の装甲ライン
        ctx.strokeStyle=`rgba(255,255,255,0.15)`; ctx.lineWidth=1;
        for(let li=0;li<4;li++){
          const lyy=ry-50*S+li*30*S;
          ctx.beginPath(); ctx.moveTo(rx-60*S,lyy); ctx.lineTo(rx+60*S,lyy); ctx.stroke();
        }

        // ── 肩・腕 ──
        for(let side=0;side<2;side++){
          const sx=side===0?-1:1;
          const baseAngle=side===0?(e.armAngle||0):(e.armAngle2||0);
          const shoulderX=rx+sx*90*S, shoulderY=ry-40*S;

          // 肩パーツ（大型）
          ctx.shadowColor=phGlow; ctx.shadowBlur=10;
          const shG=ctx.createRadialGradient(shoulderX,shoulderY,4,shoulderX,shoulderY,28*S);
          shG.addColorStop(0,phCore); shG.addColorStop(0.5,phCol); shG.addColorStop(1,phDark);
          ctx.fillStyle=shG; ctx.beginPath(); ctx.arc(shoulderX,shoulderY,28*S,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          // 肩スパイク
          for(let sp=0;sp<3;sp++){
            const sa=-Math.PI*0.5+sx*(sp-1)*0.4;
            ctx.fillStyle=phDark;
            ctx.beginPath();
            ctx.moveTo(shoulderX+Math.cos(sa)*22*S, shoulderY+Math.sin(sa)*22*S);
            ctx.lineTo(shoulderX+Math.cos(sa+0.2)*30*S, shoulderY+Math.sin(sa+0.2)*30*S);
            ctx.lineTo(shoulderX+Math.cos(sa-0.2)*30*S, shoulderY+Math.sin(sa-0.2)*30*S);
            ctx.fill();
          }

          // 上腕
          const armA=baseAngle+Math.sin(frame*0.04+side)*0.15;
          const elbX=shoulderX+Math.cos(armA+sx*0.6)*70*S;
          const elbY=shoulderY+Math.sin(armA+sx*0.6)*70*S;
          ctx.strokeStyle=phDark; ctx.lineWidth=22*S;
          ctx.beginPath(); ctx.moveTo(shoulderX,shoulderY); ctx.lineTo(elbX,elbY); ctx.stroke();
          ctx.strokeStyle=phCol; ctx.lineWidth=16*S;
          ctx.beginPath(); ctx.moveTo(shoulderX,shoulderY); ctx.lineTo(elbX,elbY); ctx.stroke();
          // 肘関節
          ctx.fillStyle=phCore; ctx.beginPath(); ctx.arc(elbX,elbY,10*S,0,Math.PI*2); ctx.fill();

          // 前腕
          const armA2=armA+sx*0.5+Math.sin(frame*0.05+side)*0.1;
          const handX=elbX+Math.cos(armA2)*60*S;
          const handY=elbY+Math.sin(armA2)*60*S;
          ctx.strokeStyle=phDark; ctx.lineWidth=18*S;
          ctx.beginPath(); ctx.moveTo(elbX,elbY); ctx.lineTo(handX,handY); ctx.stroke();
          ctx.strokeStyle=phCol; ctx.lineWidth=12*S;
          ctx.beginPath(); ctx.moveTo(elbX,elbY); ctx.lineTo(handX,handY); ctx.stroke();

          // 手部（Ph別: Ph1=キャノン Ph2=ビームソード Ph3=両方）
          if(ph===1||(ph===3&&side===1)){
            // キャノン砲口
            ctx.shadowColor='#ff8800'; ctx.shadowBlur=12;
            ctx.fillStyle=phDark; ctx.fillRect(handX-10*S,handY-10*S,24*S,20*S);
            ctx.fillStyle='#333'; ctx.fillRect(handX+8*S,handY-5*S,14*S,10*S);
            ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
            ctx.fillStyle='#ff6600'; ctx.beginPath(); ctx.arc(handX+18*S,handY,5*S,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0;
          }
          if(ph>=2||(ph===3&&side===0)){
            // ビームソード
            const swingOfs=Math.sin(frame*0.08+side*Math.PI)*30*S;
            const swordA=armA2+(side===0?0.8:-0.8);
            const sLen=70*S;
            // ソードグリップ
            ctx.strokeStyle=phDark; ctx.lineWidth=8*S;
            ctx.beginPath(); ctx.moveTo(handX,handY); ctx.lineTo(handX+Math.cos(swordA)*16*S,handY+Math.sin(swordA)*16*S); ctx.stroke();
            // ソードブレード（グロー）
            ctx.shadowColor=phGlow; ctx.shadowBlur=16;
            ctx.strokeStyle=phCore; ctx.lineWidth=4*S;
            ctx.beginPath(); ctx.moveTo(handX+Math.cos(swordA)*18*S,handY+Math.sin(swordA)*18*S);
            ctx.lineTo(handX+Math.cos(swordA)*sLen,handY+Math.sin(swordA)*sLen);
            ctx.stroke();
            ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.moveTo(handX+Math.cos(swordA)*18*S,handY+Math.sin(swordA)*18*S);
            ctx.lineTo(handX+Math.cos(swordA)*sLen,handY+Math.sin(swordA)*sLen);
            ctx.stroke();
            ctx.shadowBlur=0;
          }
        }

        // ── 首 ──
        ctx.fillStyle=phDark; ctx.fillRect(rx-18*S,ry-86*S,36*S,18*S);
        ctx.fillStyle=phCol;  ctx.fillRect(rx-14*S,ry-84*S,28*S,14*S);

        // ── 頭部 ──
        const headY=ry-120*S;
        ctx.shadowColor=phGlow; ctx.shadowBlur=18;
        // 頭部外装
        ctx.fillStyle=phDark;
        ctx.beginPath();
        ctx.moveTo(rx-45*S,headY+30*S);
        ctx.lineTo(rx-50*S,headY-10*S);
        ctx.lineTo(rx-30*S,headY-40*S);
        ctx.lineTo(rx+30*S,headY-40*S);
        ctx.lineTo(rx+50*S,headY-10*S);
        ctx.lineTo(rx+45*S,headY+30*S);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle=phCol;
        ctx.beginPath();
        ctx.moveTo(rx-38*S,headY+26*S);
        ctx.lineTo(rx-43*S,headY-6*S);
        ctx.lineTo(rx-24*S,headY-32*S);
        ctx.lineTo(rx+24*S,headY-32*S);
        ctx.lineTo(rx+43*S,headY-6*S);
        ctx.lineTo(rx+38*S,headY+26*S);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;

        // アンテナ
        ctx.strokeStyle=phDark; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(rx-15*S,headY-32*S); ctx.lineTo(rx-18*S,headY-55*S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rx+15*S,headY-32*S); ctx.lineTo(rx+18*S,headY-55*S); ctx.stroke();
        ctx.shadowColor=phGlow; ctx.shadowBlur=10;
        ctx.fillStyle=phCore;
        ctx.beginPath(); ctx.arc(rx-18*S,headY-55*S,5*S,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx+18*S,headY-55*S,5*S,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;

        // 目（複眼）
        const eyeFlicker=Math.sin(frame*0.2)*0.3+0.7;
        ctx.shadowColor= ph===3?'#ff2200':ph===2?'#cc44ff':phGlow; ctx.shadowBlur=16;
        for(const ex of [-20,20]){
          const eyeCol= ph===3?`rgba(255,${Math.floor(50+eyeFlicker*80)},0,${eyeFlicker})`:
                        ph===2?`rgba(200,${Math.floor(60+eyeFlicker*60)},255,${eyeFlicker})`
                              :`rgba(80,${Math.floor(200+eyeFlicker*55)},255,${eyeFlicker})`;
          ctx.fillStyle=eyeCol;
          ctx.beginPath(); ctx.ellipse(rx+ex*S,headY,12*S,8*S,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(rx+ex*S+3*S,headY-2*S,3*S,0,Math.PI*2); ctx.fill();
        }
        // 中央モノアイ（Ph3で点滅）
        if(ph===3){
          const blk=Math.sin(frame*0.35)>0;
          ctx.fillStyle=blk?'#ff2200':'#ff6600';
          ctx.beginPath(); ctx.ellipse(rx,headY+5*S,8*S,12*S,0,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;

        // 口部（グリル状）
        ctx.fillStyle=phDark;
        ctx.fillRect(rx-26*S,headY+12*S,52*S,14*S);
        for(let gi=0;gi<6;gi++){
          ctx.fillStyle= ph===3&&frame%8<4?'#ff3300':phGlow;
          ctx.fillRect(rx-22*S+gi*8*S,headY+14*S,5*S,10*S);
        }

        // ── Ph3: 怒り状態エフェクト ──
        if(ph===3||(ph>=2&&e.rageFlash>0)){
          const rAlpha=(e.rageFlash||0)/60;
          if(rAlpha>0){
            ctx.fillStyle=`rgba(255,0,0,${rAlpha*0.25})`;
            ctx.fillRect(rx-110*S,ry-170*S,220*S,400*S);
          }
          // 機体から火花
          if(frame%4===0){
            for(let si=0;si<3;si++){
              const sa=Math.random()*Math.PI*2;
              const sd=50+Math.random()*80;
              particles.push({x:rx+Math.cos(sa)*sd,y:ry+Math.sin(sa)*sd,vx:(Math.random()-0.5)*4,vy:-2-Math.random()*3,life:20+Math.floor(Math.random()*20),maxLife:40,color:'#ff6600',size:2+Math.random()*3});
            }
          }
        }

        // ── HPバー（ステージ横幅・フェーズ色）──
        const hpRatio=e.hp/800;
        const hpW=W-40;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(20,H-100,hpW,12);
        ctx.fillStyle= hpRatio>0.66?phGlow:hpRatio>0.33?'#aa44ff':'#ff3300';
        ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=8;
        ctx.fillRect(20,H-100,hpW*hpRatio,12);
        ctx.shadowBlur=0;
        ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
        ctx.strokeRect(20,H-100,hpW,12);
        // フェーズマーカー
        ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(20+hpW*0.33,H-102); ctx.lineTo(20+hpW*0.33,H-86); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20+hpW*0.66,H-102); ctx.lineTo(20+hpW*0.66,H-86); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='9px Courier New'; ctx.textAlign='center';
        ctx.fillText('Ph1',20+hpW*0.83,H-89);
        ctx.fillText('Ph2',20+hpW*0.5,H-89);
        ctx.fillText('Ph3',20+hpW*0.17,H-89);
        ctx.textAlign='left';
        // ボス名
        ctx.fillStyle=phGlow; ctx.font='bold 11px Courier New'; ctx.textAlign='center';
        ctx.shadowColor=phGlow; ctx.shadowBlur=8;
        ctx.fillText(`MEGA ROBOT — PHASE ${ph}`,W/2,H-103);
        ctx.shadowBlur=0; ctx.textAlign='left';

        ctx.restore();
        break;
      }

      default:{
        ctx.fillStyle='#ff4444'; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fill();
      }
      }
      ctx.restore();
    }

    // ─────────────────────────────────────────────────
    // DRAW ENEMY BULLETS
    // ─────────────────────────────────────────────────
    function drawEnemyBullet(b){
      ctx.save();
      switch(b.kind){
        case 'lava':{ // 溶岩弾 — 溶融コア＋テイル
          const lg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,7);
          lg.addColorStop(0,'#ffe8c0'); lg.addColorStop(0.4,'#ff6600'); lg.addColorStop(1,'rgba(200,30,0,0)');
          ctx.shadowColor='#ff4400'; ctx.shadowBlur=14;
          ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(b.x,b.y,7,0,Math.PI*2); ctx.fill();
          // テイル
          const ta=Math.atan2(b.vy||0,b.vx||0)+Math.PI;
          const tlg=ctx.createLinearGradient(b.x,b.y,b.x+Math.cos(ta)*14,b.y+Math.sin(ta)*14);
          tlg.addColorStop(0,'rgba(255,100,0,0.7)'); tlg.addColorStop(1,'rgba(255,60,0,0)');
          ctx.fillStyle=tlg; ctx.beginPath(); ctx.ellipse(b.x+Math.cos(ta)*7,b.y+Math.sin(ta)*7,8,2,ta,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0; break;
        }
        case 'ring':{ // モアイの小リング — エネルギーリング
          const rr=b.r||8;
          ctx.shadowColor='#6699ff'; ctx.shadowBlur=10;
          const rg=ctx.createRadialGradient(b.x,b.y,rr*0.5,b.x,b.y,rr*1.2);
          rg.addColorStop(0,'rgba(100,160,255,0.3)'); rg.addColorStop(1,'rgba(60,100,255,0)');
          ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(b.x,b.y,rr*1.2,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(160,210,255,0.9)'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(b.x,b.y,rr,0,Math.PI*2); ctx.stroke();
          ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.arc(b.x,b.y,rr*0.65,0,Math.PI*2); ctx.stroke();
          ctx.shadowBlur=0; break;
        }
        case 'moaiBeam': { // 巨大モアイのリングビーム（成長する）
          b.r=(b.r||10)+(b.grow||0.18);
          const mr=b.r;
          // 外縁グロー
          ctx.shadowColor='#88ccff'; ctx.shadowBlur=20;
          ctx.strokeStyle='rgba(100,180,255,0.25)'; ctx.lineWidth=mr*0.8;
          ctx.beginPath(); ctx.arc(b.x,b.y,mr*0.6,0,Math.PI*2); ctx.stroke();
          // メインリング
          ctx.shadowColor='#aaddff'; ctx.shadowBlur=14;
          ctx.strokeStyle='rgba(180,230,255,0.9)'; ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(b.x,b.y,mr,0,Math.PI*2); ctx.stroke();
          // 内側エッジ
          ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(b.x,b.y,mr-3,0,Math.PI*2); ctx.stroke();
          // 石紋様（ストーン感）
          ctx.strokeStyle='rgba(160,200,240,0.45)'; ctx.lineWidth=1;
          for(let ri=0;ri<8;ri++){
            const ra=(Math.PI*2/8)*ri;
            ctx.beginPath(); ctx.moveTo(b.x+Math.cos(ra)*mr,b.y+Math.sin(ra)*mr); ctx.lineTo(b.x+Math.cos(ra)*(mr-6),b.y+Math.sin(ra)*(mr-6)); ctx.stroke();
          }
          ctx.shadowBlur=0;
          break;
        }
        case 'bone':{ // 呪骨弾 — 古代の呪われた骨片
          ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot||Math.atan2(b.vy||0,b.vx||0));
          ctx.shadowColor='#ccbb88'; ctx.shadowBlur=8;
          const bnG=ctx.createLinearGradient(-6,0,6,0);
          bnG.addColorStop(0,'#b8a070'); bnG.addColorStop(0.5,'#eeddb0'); bnG.addColorStop(1,'#b8a070');
          ctx.fillStyle=bnG; ctx.fillRect(-7,-2,14,4);
          // 両端の関節
          ctx.fillStyle='#e8d4a0'; ctx.beginPath(); ctx.arc(-6,0,3,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(6,0,3,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0; ctx.restore(); break;
        }
        case 'ankh':{ // ツタンカーメンのアンク呪符
          b.rot=(b.rot||0)+(b.rotSpd||0.15);
          ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot);
          ctx.shadowColor='#FFD700'; ctx.shadowBlur=10;
          // アンクの縦棒
          ctx.strokeStyle='#FFD700'; ctx.lineWidth=3; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(0,7); ctx.stroke();
          // アンクの横棒
          ctx.beginPath(); ctx.moveTo(-6,-2); ctx.lineTo(6,-2); ctx.stroke();
          // アンクの円（上部ループ）
          ctx.beginPath(); ctx.arc(0,-5.5,4,0,Math.PI*2); ctx.stroke();
          // 中心の金の輝き
          ctx.fillStyle='rgba(255,220,0,0.6)';
          ctx.beginPath(); ctx.arc(0,-5.5,2,0,Math.PI*2); ctx.fill();
          ctx.restore();
          ctx.shadowBlur=0;
          break;
        }
        case 'goldBeam':{ // ツタンカーメンの黄金ビーム
          b.life=(b.life||60)-1;
          const glw=1-b.life/60;
          ctx.shadowColor='#FFD700'; ctx.shadowBlur=14;
          const gbG=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,8);
          gbG.addColorStop(0,'rgba(255,255,200,0.95)'); gbG.addColorStop(0.4,'rgba(255,200,0,0.8)'); gbG.addColorStop(1,'rgba(200,140,0,0)');
          ctx.fillStyle=gbG; ctx.beginPath(); ctx.arc(b.x,b.y,8,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          break;
        }
        case 'green':{ // エイリアン弾 — 有機酸弾
          const gg2=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,6);
          gg2.addColorStop(0,'#ccffdd'); gg2.addColorStop(0.5,'#22cc44'); gg2.addColorStop(1,'rgba(0,100,30,0)');
          ctx.shadowColor='#00ff66'; ctx.shadowBlur=12;
          ctx.fillStyle=gg2; ctx.beginPath(); ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(100,255,140,0.6)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(b.x,b.y,5,0,Math.PI*2); ctx.stroke();
          ctx.shadowBlur=0; break;
        }
        case 'alienBeam': { // 巨大エイリアンのビーム砲
          const alife=(b.life||80)/80;
          const abr=5+Math.sin(frame*0.5)*1.5;
          ctx.shadowColor='#00ffaa'; ctx.shadowBlur=18;
          // コア
          ctx.fillStyle=`rgba(180,255,200,${alife*0.95})`;
          ctx.beginPath(); ctx.ellipse(b.x,b.y,abr+2,abr+2,0,0,Math.PI*2); ctx.fill();
          // 発光アウター
          const abG2=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,abr*2.5);
          abG2.addColorStop(0,`rgba(0,255,160,${alife*0.5})`);
          abG2.addColorStop(1,'rgba(0,255,100,0)');
          ctx.fillStyle=abG2; ctx.beginPath(); ctx.arc(b.x,b.y,abr*2.5,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          break;
        }
        case 'blob':{ // アメーバ — 粘体プラズマ
          const blg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,8);
          blg.addColorStop(0,'#ffaaff'); blg.addColorStop(0.4,'#cc00ff'); blg.addColorStop(1,'rgba(80,0,120,0)');
          ctx.shadowColor='#dd00ff'; ctx.shadowBlur=14;
          ctx.fillStyle=blg; ctx.beginPath(); ctx.arc(b.x,b.y,8,0,Math.PI*2); ctx.fill();
          // 表面の脈動
          ctx.strokeStyle=`rgba(255,150,255,${0.4+Math.sin(frame*0.3)*0.3})`; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.stroke();
          ctx.shadowBlur=0; break;
        }
        case 'plasma':{ // 宇宙弾 — 高エネルギープラズマ
          const plg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,7);
          plg.addColorStop(0,'#e8f4ff'); plg.addColorStop(0.35,'#4488ff'); plg.addColorStop(0.7,'#0033cc'); plg.addColorStop(1,'rgba(0,20,100,0)');
          ctx.shadowColor='#2255ff'; ctx.shadowBlur=16;
          ctx.fillStyle=plg; ctx.beginPath(); ctx.arc(b.x,b.y,7,0,Math.PI*2); ctx.fill();
          // 高速移動の歪み表現
          const pa=Math.atan2(b.vy||0,b.vx||0);
          ctx.strokeStyle='rgba(100,160,255,0.4)'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.ellipse(b.x,b.y,9,4,pa,0,Math.PI*2); ctx.stroke();
          ctx.shadowBlur=0; break;
        }
        case 'fireball':{ // 火球 — 超高温炎塊
          const flg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,10);
          flg.addColorStop(0,'#fffff0'); flg.addColorStop(0.25,'#ffdd00'); flg.addColorStop(0.55,'#ff4400'); flg.addColorStop(1,'rgba(200,0,0,0)');
          ctx.shadowColor='#ff6600'; ctx.shadowBlur=20;
          ctx.fillStyle=flg; ctx.beginPath(); ctx.arc(b.x,b.y,10,0,Math.PI*2); ctx.fill();
          // 炎の揺らぎ
          for(let fi=0;fi<5;fi++){
            const fa=(Math.PI*2/5)*fi+frame*0.12;
            const fr2=8+Math.sin(frame*0.2+fi)*2;
            ctx.fillStyle=`rgba(255,${Math.floor(80+fi*20)},0,0.3)`;
            ctx.beginPath(); ctx.arc(b.x+Math.cos(fa)*fr2*0.5,b.y+Math.sin(fa)*fr2*0.5,3,0,Math.PI*2); ctx.fill();
          }
          ctx.shadowBlur=0; break;
        }
        case 'breath': { // 炎ブレス
          b.age=(b.age||0)+1;
          const bAlpha=Math.max(0,1-b.age/40);
          const bR=4+b.age*0.6;
          ctx.shadowColor='#ff8800'; ctx.shadowBlur=10;
          const bG=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,bR);
          bG.addColorStop(0,`rgba(255,240,80,${bAlpha})`);
          bG.addColorStop(0.4,`rgba(255,120,0,${bAlpha*0.8})`);
          bG.addColorStop(1,`rgba(255,30,0,0)`);
          ctx.fillStyle=bG; ctx.beginPath(); ctx.arc(b.x,b.y,bR,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          break;
        }
        default:
          ctx.fillStyle='#ff4444'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=6;
          ctx.fillRect(b.x-3,b.y-3,6,6);
      }
      ctx.shadowBlur=0; ctx.restore();
    }



    function drawPowerItem(it){
      ctx.save();
      const pulse=Math.sin(frame*0.1)*4;
      ctx.shadowColor='#ffff00'; ctx.shadowBlur=8+pulse;
      ctx.fillStyle='#cc8800'; ctx.beginPath(); ctx.arc(it.x,it.y,11,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffdd44'; ctx.beginPath(); ctx.arc(it.x,it.y,8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#000'; ctx.font='bold 10px Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('P',it.x,it.y);
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      ctx.shadowBlur=0; ctx.restore();
    }

    function spawnExplosion(x,y,big){
      const n=big?32:12;
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2, spd=1+Math.random()*(big?6:3);
        particles.push({
          x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
          life:big?60:35, maxLife:big?60:35,
          color:['#ff8800','#ffdd00','#ff4400','#ffffff','#ff0000'][Math.floor(Math.random()*5)],
          size:big?2+Math.random()*4:1+Math.random()*2
        });
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE ENEMY SPAWNING
    // ─────────────────────────────────────────────────
    function mkE(kind,oy,hp,w,h,vx,amp,freq,shootT,extra){
      return {kind,x:W+30,y:oy,hp,w,h,vx,vy:0,wave:{amp,freq,base:oy},t:0,
              shootTimer:shootT,seed:Math.random()*100,...extra};
    }
    function rY(margin){ return margin+Math.random()*(H-margin*2); }

    function spawnStageEnemies(){
      const sf=stageFrame;

      // ════ STAGE 1: 火山 ════
      if(stage===1){
        if(!bossAlive){
          if(sf%150===0){                                          // 火の鳥 2羽
            const base=rY(130);
            for(let i=0;i<2;i++) enemies.push(mkE('fireBird',base+i*60,2,24,14,-(2+Math.random()*0.6),35,0.03,120+Math.random()*40));
          }
          if(sf%200===80){                                         // 溶岩球 1個
            enemies.push(mkE('lavaBall',rY(120),3,22,22,-1.4,45,0.025,130,{seed:Math.random()*10}));
          }
          if(sf%220===130){                                        // 小型火竜 2体
            const by=rY(130);
            for(let i=0;i<2;i++) enemies.push(mkE('fireDrake',by+(i-0.5)*60,3,28,18,-2.2,20,0.05,140));
          }
          if(sf%180===50){                                         // 炎の精 3匹
            const by=rY(140);
            for(let i=0;i<3;i++) enemies.push(mkE('emberSprite',by+(i-1)*55,1,14,14,-2.8,55,0.05,150,{seed:i*2}));
          }
          // 火山弾: 間引いて1発ずつ
          if(sf%160===40){
            const lx=W*0.25+Math.random()*W*0.55;
            enemyBullets.push({kind:'lava',x:lx,y:getTopH(lx,scrollX)+6,vx:(Math.random()-0.5)*0.6,vy:1.8+Math.random()*1.0,volcano:true});
          }
          if(sf%160===80){
            const lx=W*0.25+Math.random()*W*0.55;
            enemyBullets.push({kind:'lava',x:lx,y:H-getBotH(lx,scrollX)-6,vx:(Math.random()-0.5)*0.6,vy:-(1.8+Math.random()*1.0),volcano:true});
          }
        }
        // 25画面(scrollX>=12000)でツイン火龍ボス出現
        if(scrollX>=12000&&!bossSpawned){ bossSpawned=true;bossAlive=true; enemies.push(mkE('twinDragon',H/2,400,90,120,-0.4,60,0.008,80,{isBoss:true,head1hp:200,head2hp:200,head1dead:false,head2dead:false,phase:1,tailPhase:0,tailExtend:0,tailDir:0,headOfs1:{x:0,y:0},headOfs2:{x:0,y:0},headTarget1:{x:0,y:0},headTarget2:{x:0,y:0},headMoveTimer:0})); }
      }

      // ════ STAGE 2: モアイ ════
      if(stage===2){
        if(!bossAlive){
          if(sf%240===0)                                           // モアイ 1体
            enemies.push(mkE('moai',rY(100),16,28,48,-1,0,0,120));
          if(sf%160===60){                                         // タツノオトシゴ 2体
            for(let i=0;i<2;i++) enemies.push(mkE('seahorse',rY(130),2,16,24,-1.5,40,0.04,140));
          }
          if(sf%200===100){                                        // クラゲ 2体
            for(let i=0;i<2;i++) enemies.push(mkE('jellyfish',rY(120),3,26,20,-1.3,65,0.03,150,{seed:i*3}));
          }
          if(sf%280===140&&sf<2400)                               // 石ゴーレム 1体
            enemies.push(mkE('stoneGolem',rY(120),8,20,32,-0.8,15,0.015,160));
        }
        if(sf===2800&&!bossSpawned){
          bossSpawned=true; bossAlive=true;
          // 正面（中央）: メイン、左→右に動く
          enemies.push(mkE('moaiBoss',H/2,   200,70,130,-0.3,0,0,   60,{isBoss:true,role:'center'}));
          // 天井（上）: 上に貼り付き、逆さ
          enemies.push(mkE('moaiBoss',60,     150,70,130,-0.3,0,0,   80,{isBoss:true,role:'top',   flipped:true}));
          // 床（下）: 下に貼り付き
          enemies.push(mkE('moaiBoss',H-60,   150,70,130,-0.3,0,0,  100,{isBoss:true,role:'bottom'}));
        }
      }

      // ════ STAGE 3: ピラミッド ════
      if(stage===3){
        if(!bossAlive){
          if(sf%160===0){                                          // ミイラ 2体
            for(let i=0;i<2;i++) enemies.push(mkE('mummy',rY(130),3,16,24,-1.5,25,0.025,140));
          }
          if(sf%130===50){                                         // 蝙蝠 3匹
            const by=rY(130);
            for(let i=0;i<3;i++) enemies.push(mkE('bat',by+(i-1)*50,1,24,14,-2.5,50,0.05,150,{seed:i}));
          }
          if(sf%200===100){                                        // スカラベ 3匹
            for(let i=0;i<3;i++) enemies.push(mkE('scarab',H/2+(i-1)*55,2,24,16,-1.8,10,0.02,145));
          }
          if(sf%220===130){                                        // 幽霊 2体
            for(let i=0;i<2;i++) enemies.push(mkE('ghost',rY(130),2,18,20,-1.2,38,0.03,160,{seed:i*4}));
          }
          if(sf%250===160){                                        // 砂虫 2匹
            for(let i=0;i<2;i++) enemies.push(mkE('sandWorm',H-70-i*70,4,20,26,-1.4,28,0.04,145));
          }
        }
        if(sf===3500&&!bossSpawned){ bossSpawned=true;bossAlive=true; enemies.push(mkE('tutankhamun',H/2,600,60,70,-0.5,60,0.008,55,{isBoss:true,phase:1,crookTimer:0,crookAngle:0,crookDir:0,staffTimer:0,staffPhase:0,ankh:0})); }
      }

      // ════ STAGE 4: 遺跡 ════
      if(stage===4){
        if(!bossAlive){
          if(sf%140===0){                                          // エイリアン 2体
            for(let i=0;i<2;i++) enemies.push(mkE('alien',rY(120),3,20,26,-1.8,42,0.04,130));
          }
          if(sf%150===60){                                         // ドローン 3機
            const by=rY(130);
            for(let i=0;i<3;i++) enemies.push(mkE('alienDrone',by+i*20,2,18,14,-3.2,8,0.015,130));
          }
          if(sf%200===100){                                        // フェイスハガー 2体
            for(let i=0;i<2;i++) enemies.push(mkE('facehugger',H/2+(i-0.5)*70,2,18,14,-1.8,10,0.01,145));
          }
          if(sf%300===150&&sf<2400)                               // エッグ砲台 1個
            enemies.push(mkE('alienEgg',rY(130),6,20,28,-0.4,0,0,180));
        }
        if(sf===3500&&!bossSpawned){ bossSpawned=true;bossAlive=true; enemies.push(mkE('alienBoss',H/2,600,80,120,-0.3,55,0.010,40,{isBoss:true,phase:1,beamCharge:0,armPhase:0,armExtend:0,armDir:0})); }
      }

      // ════ STAGE 5: 体内 ════
      if(stage===5){
        if(!bossAlive){
          if(sf%160===0){                                          // アメーバ 2体
            for(let i=0;i<2;i++) enemies.push(mkE('amoeba',rY(120),4,24,24,-1.4,55,0.04,140,{seed:Math.random()*10}));
          }
          if(sf%100===40){                                         // 赤血球 3個
            for(let i=0;i<3;i++) enemies.push(mkE('bloodCell',rY(110),2,24,16,-2.5,28,0.05,160));
          }
          if(sf%200===80){                                         // ウイルス 2個
            for(let i=0;i<2;i++) enemies.push(mkE('virus',rY(130),3,18,18,-1.8,45,0.04,150,{seed:i*5}));
          }
          if(sf%260===130)                                         // 白血球 1体
            enemies.push(mkE('whiteCell',rY(120),8,32,32,-0.9,38,0.02,170,{seed:Math.random()*10}));
          if(sf%220===110){                                        // 胞子 2個
            for(let i=0;i<2;i++) enemies.push(mkE('spore',rY(120),2,16,16,-1.7,50,0.05,155,{seed:i*3}));
          }
        }
        if(sf===3500&&!bossSpawned){ bossSpawned=true;bossAlive=true; enemies.push(mkE('amoeba',H/2,500,56,56,-0.5,70,0.009,45,{isBoss:true,phase:1,pseudoPod:0,pseudoDir:0,pseudoTimer:80,splitTimer:200})); }
      }

      // ════ STAGE 6: 宇宙 ════
      if(stage===6){
        if(!bossAlive){
          if(sf%160===0){                                          // コロナ 2個
            for(let i=0;i<2;i++) enemies.push(mkE('corona',rY(120),3,22,22,-2,38,0.03,150,{seed:Math.random()*10}));
          }
          if(sf%150===60){                                         // 小惑星 2個
            for(let i=0;i<2;i++)
              enemies.push(mkE('asteroid',rY(120),4,26,26,-2.3,18,0.02,160,{rot:Math.random()*Math.PI*2,rotSpd:0.04+Math.random()*0.04}));
          }
          if(sf%200===100){                                        // 宇宙クラゲ 2体
            for(let i=0;i<2;i++) enemies.push(mkE('spaceJelly',rY(120),3,24,20,-1.4,60,0.03,155,{seed:i*4}));
          }
          if(sf%120===80){                                         // 流星 2個
            for(let i=0;i<2;i++)
              enemies.push(mkE('meteorite',rY(110),2,20,12,-(4.5+Math.random()*1.5),0,0,999));
          }
          if(sf%240===140){                                        // 大型隕石 1個
            const bigR=28+Math.floor(Math.random()*20); // 半径28〜48
            const bigSpd=-(1.2+Math.random()*1.0);
            const bigAngle=(Math.random()-0.5)*0.5;      // 斜め方向
            enemies.push(mkE('bigMeteor',rY(80),18+Math.floor(bigR/4),bigR*2,bigR*2,bigSpd,0,0,999,
              {rot:Math.random()*Math.PI*2, rotSpd:(Math.random()-0.5)*0.025, vy:Math.sin(bigAngle)*Math.abs(bigSpd)*0.6,
               radius:bigR, craters:Array.from({length:5},()=>({a:Math.random()*Math.PI*2,r:0.25+Math.random()*0.35,s:0.12+Math.random()*0.12}))}));
          }
          if(sf%370===200 && Math.random()<0.5){           // 大型隕石 追加ランダム
            const bigR2=32+Math.floor(Math.random()*16);
            const bigSpd2=-(1.0+Math.random()*0.8);
            const bigAngle2=(Math.random()-0.5)*0.4;
            enemies.push(mkE('bigMeteor',rY(80),18+Math.floor(bigR2/4),bigR2*2,bigR2*2,bigSpd2,0,0,999,
              {rot:Math.random()*Math.PI*2, rotSpd:(Math.random()-0.5)*0.02, vy:Math.sin(bigAngle2)*Math.abs(bigSpd2)*0.5,
               radius:bigR2, craters:Array.from({length:6},()=>({a:Math.random()*Math.PI*2,r:0.2+Math.random()*0.3,s:0.1+Math.random()*0.15}))}));
          }
        }
        if(sf===3000&&!bossSpawned){ bossSpawned=true;bossAlive=true; enemies.push(mkE('spaceFortress',H/2,800,140,200,-0.2,40,0.006,50,{isBoss:true,phase:1,coreDead:false,coreHp:400,turret1Hp:200,turret2Hp:200,shieldAngle:0,laserCharge:0,missileTimer:0})); }
      }

      if(stage===7){
        // 要塞ステージ: 機械的な敵
        if(sf%180===0  &&!bossSpawned)
          for(let i=0;i<2;i++) enemies.push(mkE('gunship',rY(120),4,28,14,-2.5,20,0.025,110));
        if(sf%260===80 &&!bossSpawned)
          for(let i=0;i<3;i++) enemies.push(mkE('droneSwarm',H/2+(i-1)*70,2,16,14,-3.0,12,0.04,120));
        if(sf%300===140&&!bossSpawned)
          enemies.push(mkE('turret',rY(110),10,20,24,-0.5,0,0,90));
        if(sf%350===200&&!bossSpawned)
          enemies.push(mkE('shieldBot',rY(110),12,24,28,-0.8,18,0.015,140));
        if(sf%240===60 &&!bossSpawned)
          for(let i=0;i<2;i++) enemies.push(mkE('missilePod',H/2+(i-0.5)*100,6,18,18,-1.2,30,0.02,150));
        // 最終ボス: 巨大アンドロイド
        if(sf===3200&&!bossSpawned){
          bossSpawned=true; bossAlive=true;
          enemies.push(mkE('androidBoss',H/2,800,200,260,-0.3,45,0.005,50,{isBoss:true,phase:1,armAngle:0,armAngle2:0,eyeFlash:0,chargeBeam:0,chargeAngle:0,laserActive:0,laserAngle:0,swordSlash:0,swordDir:1,shieldRotate:0,rageFlash:0,missileTimer:0}));
        }
      }
    }

    // ─────────────────────────────────────────────────
    // SHOOT: enemy bullet by kind
    // ─────────────────────────────────────────────────
    function enemyShoot(e){
      const dx=player.x-e.x, dy=player.y-e.y;
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      const aim=(spd)=>({vx:(dx/dist)*spd,vy:(dy/dist)*spd});
      switch(e.kind){
        case 'fireBird':   // 自機狙い1発、ボスは+1発
          enemyBullets.push({kind:'lava',x:e.x,y:e.y,...aim(3)});
          if(e.isBoss) enemyBullets.push({kind:'lava',x:e.x,y:e.y,vx:aim(3).vx,vy:aim(3).vy+1.5});
          break;
        case 'lavaBall':   // 左右2方向
          enemyBullets.push({kind:'lava',x:e.x,y:e.y,vx:-2.5,vy:-1});
          enemyBullets.push({kind:'lava',x:e.x,y:e.y,vx:-2.5,vy:1});
          break;
        case 'fireDrake':  // 自機狙い1発
          enemyBullets.push({kind:'lava',x:e.x,y:e.y,...aim(3.2)});
          break;
        case 'emberSprite':// 自機狙い1発
          enemyBullets.push({kind:'lava',x:e.x,y:e.y,...aim(3.5)});
          break;
        case 'moai':
          { const n=3;
            for(let i=0;i<n;i++){ const a=Math.atan2(dy,dx)+(i-(n-1)/2)*0.35; enemyBullets.push({kind:'ring',x:e.x,y:e.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,r:6}); } }
          break;
        case 'moaiBoss':
          // 口から大型リングビーム（role別に発射方向変更）
          { const role=e.role||'center';
            const spd=3.0;
            if(role==='center'){
              // 正面: 自機狙い3連リング
              for(let i=0;i<3;i++){
                const a=Math.atan2(dy,dx)+(i-1)*0.28;
                enemyBullets.push({kind:'moaiBeam',x:e.x-35,y:e.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:10,grow:0.18});
              }
            } else if(role==='top'){
              // 天井: 下向き + 斜め3発
              for(let i=0;i<3;i++){
                const a=Math.PI/2+(i-1)*0.35;
                enemyBullets.push({kind:'moaiBeam',x:e.x-35,y:e.y+60,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:10,grow:0.18});
              }
            } else {
              // 床: 上向き + 斜め3発
              for(let i=0;i<3;i++){
                const a=-Math.PI/2+(i-1)*0.35;
                enemyBullets.push({kind:'moaiBeam',x:e.x-35,y:e.y-60,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:10,grow:0.18});
              }
            }
          }
          break;
        case 'seahorse':   // 1発
          enemyBullets.push({kind:'ring',x:e.x,y:e.y,...aim(2),r:5});
          break;
        case 'jellyfish':  // 3方向
          for(let i=0;i<3;i++){ const a=Math.PI+(Math.PI/3)*(i-1); enemyBullets.push({kind:'ring',x:e.x,y:e.y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,r:4}); }
          break;
        case 'stoneGolem': // 自機狙い1発
          enemyBullets.push({kind:'bone',x:e.x,y:e.y,...aim(2.5)});
          break;
        case 'mummy':      // 自機狙い1発、ボスは3発
          enemyBullets.push({kind:'bone',x:e.x,y:e.y,...aim(2.8)});
          if(e.isBoss){ enemyBullets.push({kind:'bone',x:e.x,y:e.y,vx:-2.8,vy:-1.2}); enemyBullets.push({kind:'bone',x:e.x,y:e.y,vx:-2.8,vy:1.2}); }
          break;
        case 'tutankhamun':{ // ファラオの呪い: 自機狙い+アンク呪符3発扇状+ゴールドビーム
          const tPhase=e.phase||1;
          const tAim=aim(3.2);
          // 自機狙い 1発
          enemyBullets.push({kind:'ankh',x:e.x-30,y:e.y,...tAim,rot:0,rotSpd:0.15});
          // 扇状 追加2発（フェーズ2以降は5発）
          const fanN=tPhase>=2?5:3;
          for(let fi=0;fi<fanN;fi++){
            const baseAng=Math.atan2(tAim.vy,tAim.vx);
            const spread=(Math.PI*0.28)*(fi/(fanN-1)-0.5)*2;
            const spd=3.0;
            enemyBullets.push({kind:'ankh',x:e.x-30,y:e.y,vx:Math.cos(baseAng+spread)*spd,vy:Math.sin(baseAng+spread)*spd,rot:0,rotSpd:0.15});
          }
          // フェーズ2: 黄金ビーム追加
          if(tPhase>=2){
            enemyBullets.push({kind:'goldBeam',x:e.x-30,y:e.y,...aim(5),life:60});
          }
          // フェーズ移行（HP≤150でフェーズ2）
          if((e.hp||600)<=300 && tPhase<2){ e.phase=2; }
          break;
        }
        case 'bat':        // 自機狙い1発
          enemyBullets.push({kind:'bone',x:e.x,y:e.y,...aim(3.2)});
          break;
        case 'scarab':     // 左向き2方向
          enemyBullets.push({kind:'bone',x:e.x,y:e.y,vx:-2.8,vy:-0.8});
          enemyBullets.push({kind:'bone',x:e.x,y:e.y,vx:-2.8,vy:0.8});
          break;
        case 'ghost':      // 自機狙い1発
          enemyBullets.push({kind:'bone',x:e.x,y:e.y,...aim(2.5)});
          break;
        case 'sandWorm':   // 自機狙い1発
          enemyBullets.push({kind:'bone',x:e.x,y:e.y,...aim(2.8)});
          break;
        case 'alien':      // 自機狙い1発
          enemyBullets.push({kind:'green',x:e.x,y:e.y,...aim(3.2)});
          break;
        case 'alienBoss': {
          // ビーム砲とクロー攻撃を交互に
          const abPhase=e.shootPhase=(e.shootPhase||0)+1;
          if(abPhase%3!==0){
            // 口からビーム砲（3方向扇）
            const bx=e.x-40, by2=e.y+20;
            const ba=Math.atan2(player.y-by2,player.x-bx);
            for(let bi=-1;bi<=1;bi++){
              enemyBullets.push({kind:'alienBeam',x:bx,y:by2,vx:Math.cos(ba+bi*0.28)*4.5,vy:Math.sin(ba+bi*0.28)*4.5,life:80});
            }
          } else {
            // 腕伸ばし攻撃（上下から）
            e.armExtend=0; e.armDir=player.y<e.y?-1:1; e.armPhase=1;
          }
          break;
        }
        case 'alienDrone': // 自機狙い1発
          enemyBullets.push({kind:'green',x:e.x,y:e.y,...aim(4)});
          break;
        case 'facehugger': // 自機狙い1発
          enemyBullets.push({kind:'green',x:e.x,y:e.y,...aim(2.8)});
          break;
        case 'alienEgg':   // 全周4発
          for(let i=0;i<4;i++){ const a=(Math.PI/2)*i; enemyBullets.push({kind:'green',x:e.x,y:e.y,vx:Math.cos(a)*2,vy:Math.sin(a)*2}); }
          break;
        case 'bloodCell':  // 自機狙い1発
          enemyBullets.push({kind:'blob',x:e.x,y:e.y,...aim(2.8)});
          break;
        case 'amoeba':
          if(!e.isBoss){
            // 雑魚: 自機狙い1発
            enemyBullets.push({kind:'blob',x:e.x,y:e.y,...aim(2.8)});
          } else {
            const amPh=e.phase||1;
            // フェーズ1: 8方向blob + 自機狙い
            enemyBullets.push({kind:'blob',x:e.x,y:e.y,...aim(3.5)});
            const dirs=amPh>=2?12:8;
            for(let i=0;i<dirs;i++){
              const a=(Math.PI*2/dirs)*i;
              enemyBullets.push({kind:'blob',x:e.x,y:e.y,vx:Math.cos(a)*3.0,vy:Math.sin(a)*3.0});
            }
            // フェーズ2: ホーミングblob追加
            if(amPh>=2){
              const ha=Math.atan2(player.y-e.y,player.x-e.x);
              for(let hi=0;hi<3;hi++){
                const hs=ha+(hi-1)*0.3;
                enemyBullets.push({kind:'blob',x:e.x,y:e.y,vx:Math.cos(hs)*4.5,vy:Math.sin(hs)*4.5,homing:true,homingStr:0.06});
              }
            }
            // 偽足タイマー更新
            e.pseudoTimer=(e.pseudoTimer||80)-1;
            if(e.pseudoTimer<=0){
              e.pseudoDir=Math.atan2(player.y-e.y,player.x-e.x);
              e.pseudoPod=0; e.pseudoTimer=120+Math.floor(Math.random()*80);
            }
            // フェーズ移行
            if((e.hp||500)<=250 && amPh<2){ e.phase=2; }
          }
          break;
        case 'virus':      // 4方向スパイク
          for(let i=0;i<4;i++){ const a=(Math.PI/2)*i+Math.PI/4; enemyBullets.push({kind:'blob',x:e.x,y:e.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5}); }
          break;
        case 'whiteCell':  // 自機狙い1発
          enemyBullets.push({kind:'blob',x:e.x,y:e.y,...aim(2)});
          break;
        case 'spore':      // 3方向
          for(let i=0;i<3;i++){ const a=Math.PI+(Math.PI/3)*(i-1); enemyBullets.push({kind:'blob',x:e.x,y:e.y,vx:Math.cos(a)*2.2,vy:Math.sin(a)*2.2}); }
          break;
        case 'corona':     // 4方向
          for(let i=0;i<4;i++){ const a=(Math.PI/2)*i; enemyBullets.push({kind:'plasma',x:e.x,y:e.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5}); }
          break;
        case 'asteroid':   // 自機狙い1発
          enemyBullets.push({kind:'plasma',x:e.x,y:e.y,...aim(2.8)});
          break;
        case 'spaceJelly': // 3方向
          for(let i=0;i<3;i++){ const a=Math.PI+(Math.PI/3)*(i-1); enemyBullets.push({kind:'plasma',x:e.x,y:e.y,vx:Math.cos(a)*2,vy:Math.sin(a)*2}); }
          break;
        case 'bigMeteor':   // 撃たない（体当たりのみ）
          break;
        case 'meteorite':  // 撃たない（体当たりのみ）
          break;
        case 'fireDragon': // 火球1発+3方向散弾
          enemyBullets.push({kind:'fireball',x:e.x+30,y:e.y,...aim(3.5)});
          for(let i=-1;i<=1;i++) enemyBullets.push({kind:'plasma',x:e.x,y:e.y,vx:aim(2.5).vx,vy:aim(2.5).vy+i*1.2});
          break;
        case 'spaceFortress': {
          const sfp=e.phase||1;
          const t1dead=e.turret1Hp<=0, t2dead=e.turret2Hp<=0;
          // 砲台1（上）: 自機狙い2連射
          if(!t1dead){
            const t1x=e.x-20, t1y=e.y-70;
            const a1=Math.atan2(player.y-t1y,player.x-t1x);
            enemyBullets.push({kind:'shell',x:t1x,y:t1y,vx:Math.cos(a1)*5,vy:Math.sin(a1)*5});
            enemyBullets.push({kind:'shell',x:t1x,y:t1y,vx:Math.cos(a1+0.15)*4.5,vy:Math.sin(a1+0.15)*4.5});
          }
          // 砲台2（下）: 自機狙い2連射
          if(!t2dead){
            const t2x=e.x-20, t2y=e.y+70;
            const a2=Math.atan2(player.y-t2y,player.x-t2x);
            enemyBullets.push({kind:'shell',x:t2x,y:t2y,vx:Math.cos(a2)*5,vy:Math.sin(a2)*5});
            enemyBullets.push({kind:'shell',x:t2x,y:t2y,vx:Math.cos(a2-0.15)*4.5,vy:Math.sin(a2-0.15)*4.5});
          }
          // コアビーム（砲台が両方死んだら解放）
          if(!e.coreDead && t1dead && t2dead){
            const cx2=e.x-55, cy2=e.y;
            const ca=Math.atan2(player.y-cy2,player.x-cx2);
            for(let bi=-2;bi<=2;bi++)
              enemyBullets.push({kind:'fortBeam',x:cx2,y:cy2,vx:Math.cos(ca+bi*0.18)*6,vy:Math.sin(ca+bi*0.18)*6,life:70});
            // フェーズ2: 全方位ミサイル
            if(sfp>=2){
              for(let mi=0;mi<8;mi++){
                const ma=(Math.PI*2/8)*mi;
                enemyBullets.push({kind:'homing',x:e.x,y:e.y,vx:Math.cos(ma)*3,vy:Math.sin(ma)*3,tracked:true});
              }
            }
          }
          break;
        }

        case 'twinDragon': { // ツイン火龍: 頭1→火球、頭2→炎ブレス
          const ph1=e.phase||1;
          // 頭1の位置（上の首の先）
          const h1x=e.x+30, h1y=e.y-55;
          // 頭2の位置（下の首の先）
          const h2x=e.x+25, h2y=e.y+45;
          const dx1=player.x-h1x, dy1=player.y-h1y;
          const d1=Math.sqrt(dx1*dx1+dy1*dy1)||1;
          const dx2=player.x-h2x, dy2=player.y-h2y;
          const d2=Math.sqrt(dx2*dx2+dy2*dy2)||1;
          const fireInterval=e.t%180; // 頭を交互に発射

          if(!e.head1dead){
            if(fireInterval<90){ // 頭1: 火球を2発
              if(fireInterval===0||fireInterval===20){
                enemyBullets.push({kind:'fireball',x:h1x,y:h1y,vx:(dx1/d1)*3.5+(Math.random()-0.5)*0.5,vy:(dy1/d1)*3.5+(Math.random()-0.5)*0.5});
              }
            }
          }
          if(!e.head2dead){
            if(fireInterval>=90){ // 頭2: 炎ブレス（扇形5発）
              if(fireInterval===90||fireInterval===105||fireInterval===120){
                const baseA=Math.atan2(dy2,dx2);
                for(let bi=-2;bi<=2;bi++){
                  const ba=baseA+bi*0.18;
                  enemyBullets.push({kind:'breath',x:h2x,y:h2y,vx:Math.cos(ba)*4.5,vy:Math.sin(ba)*4.5,age:0});
                }
              }
            }
          }
          // フェーズ2(HP<50%): 攻撃強化
          if(ph1===2){
            if(fireInterval===45){
              if(!e.head1dead) for(let bi=-1;bi<=1;bi++) enemyBullets.push({kind:'fireball',x:h1x,y:h1y,vx:-3.5+bi*0.3,vy:bi*1.5});
            }
            if(fireInterval===135){
              if(!e.head2dead){ const ba=Math.atan2(dy2,dx2); for(let bi=-3;bi<=3;bi++) enemyBullets.push({kind:'breath',x:h2x,y:h2y,vx:Math.cos(ba+bi*0.15)*5,vy:Math.sin(ba+bi*0.15)*5,age:0}); }
            }
          }
          break;
        }

        /* ===== STAGE 7: 要塞 ===== */
        case 'gunship':   // 自機狙い2連射
          enemyBullets.push({kind:'laser_bolt',x:e.x,y:e.y,...aim(4.5)});
          enemyBullets.push({kind:'laser_bolt',x:e.x,y:e.y,vx:aim(4).vx,vy:aim(4).vy+0.8});
          break;
        case 'droneSwarm': // 全周6発
          for(let i=0;i<6;i++){ const a=(Math.PI*2/6)*i; enemyBullets.push({kind:'laser_bolt',x:e.x,y:e.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3}); }
          break;
        case 'turret':    // 自機狙い高速3連
          for(let i=0;i<3;i++) enemyBullets.push({kind:'shell',x:e.x,y:e.y,vx:aim(5).vx+i*0.4,vy:aim(5).vy});
          break;
        case 'shieldBot': // 前方3発扇
          for(let i=-1;i<=1;i++){ const a=Math.atan2(dy,dx)+i*0.3; enemyBullets.push({kind:'shell',x:e.x,y:e.y,vx:Math.cos(a)*3.5,vy:Math.sin(a)*3.5}); }
          break;
        case 'missilePod': // 自機追尾ミサイル
          enemyBullets.push({kind:'homing',x:e.x,y:e.y,...aim(2.5),tracked:true});
          break;
        case 'androidBoss':
          { const ph=e.phase||1;
            const bx=e.x-30, by=e.y;
            if(ph===1){
              // Ph1: 肩キャノン5発扇形 + 自機狙い
              for(let i=-2;i<=2;i++){
                const a=Math.atan2(dy,dx)+(i)*0.22;
                enemyBullets.push({kind:'shell',x:bx,y:by+i*30,vx:Math.cos(a)*3.8,vy:Math.sin(a)*3.8});
              }
              enemyBullets.push({kind:'laser_bolt',x:bx,y:by,...aim(5)});
            } else if(ph===2){
              // Ph2: 胸部レーザー砲×2 + 追尾ミサイル3発
              enemyBullets.push({kind:'laser_bolt',x:bx,y:by-40,vx:-6,vy:-0.5});
              enemyBullets.push({kind:'laser_bolt',x:bx,y:by+40,vx:-6,vy:0.5});
              for(let i=0;i<3;i++){
                const a=Math.atan2(dy,dx)+(i-1)*0.35;
                enemyBullets.push({kind:'homing',x:bx,y:by+(i-1)*50,vx:Math.cos(a)*3.5,vy:Math.sin(a)*3.5,tracked:true});
              }
              // バリア発生と全周弾
              if((e.shootTimer||0)%3===0){
                for(let i=0;i<8;i++){ const a=(Math.PI*2/8)*i; enemyBullets.push({kind:'shell',x:bx,y:by,vx:Math.cos(a)*3,vy:Math.sin(a)*3}); }
              }
            } else {
              // Ph3(RAGE): 全周12発 + 高速自機狙い4連 + 螺旋
              for(let i=0;i<12;i++){ const a=(Math.PI*2/12)*i+(e.shootTimer||0)*0.06; enemyBullets.push({kind:'shell',x:bx,y:by,vx:Math.cos(a)*4.5,vy:Math.sin(a)*4.5}); }
              for(let i=0;i<4;i++){ const a=Math.atan2(dy,dx)+(i-1.5)*0.18; enemyBullets.push({kind:'laser_bolt',x:bx,y:by,vx:Math.cos(a)*6,vy:Math.sin(a)*6}); }
              enemyBullets.push({kind:'homing',x:bx,y:by,...aim(4.5),tracked:true});
            }
          }
          break;
      }
    }

    // ─────────────────────────────────────────────────
    // DRAW ENEMY BULLETS
    // ─────────────────────────────────────────────────
    function drawEnemyBullet(b){
      ctx.save();
      switch(b.kind){
        case 'lava': // 溶岩弾
          ctx.fillStyle='#ff6600'; ctx.shadowColor='#ff3300'; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.arc(b.x,b.y,5,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#ffaa00';
          ctx.beginPath(); ctx.arc(b.x-1,b.y-1,2,0,Math.PI*2); ctx.fill();
          break;
        case 'ring': // モアイの小リング
          ctx.strokeStyle='#aaccff'; ctx.lineWidth=3; ctx.shadowColor='#88aaff'; ctx.shadowBlur=6;
          ctx.beginPath(); ctx.arc(b.x,b.y,b.r||8,0,Math.PI*2); ctx.stroke();
          break;
        case 'moaiBeam': { // 巨大モアイのリングビーム（成長する）
          b.r=(b.r||10)+(b.grow||0.18);
          const mr=b.r;
          // 外縁グロー
          ctx.shadowColor='#88ccff'; ctx.shadowBlur=20;
          ctx.strokeStyle='rgba(100,180,255,0.25)'; ctx.lineWidth=mr*0.8;
          ctx.beginPath(); ctx.arc(b.x,b.y,mr*0.6,0,Math.PI*2); ctx.stroke();
          // メインリング
          ctx.shadowColor='#aaddff'; ctx.shadowBlur=14;
          ctx.strokeStyle='rgba(180,230,255,0.9)'; ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(b.x,b.y,mr,0,Math.PI*2); ctx.stroke();
          // 内側エッジ
          ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(b.x,b.y,mr-3,0,Math.PI*2); ctx.stroke();
          // 石紋様（ストーン感）
          ctx.strokeStyle='rgba(160,200,240,0.45)'; ctx.lineWidth=1;
          for(let ri=0;ri<8;ri++){
            const ra=(Math.PI*2/8)*ri;
            ctx.beginPath(); ctx.moveTo(b.x+Math.cos(ra)*mr,b.y+Math.sin(ra)*mr); ctx.lineTo(b.x+Math.cos(ra)*(mr-6),b.y+Math.sin(ra)*(mr-6)); ctx.stroke();
          }
          ctx.shadowBlur=0;
          break;
        }
        case 'bone': // ミイラの骨
          ctx.fillStyle='#ddcc99'; ctx.shadowColor='#bbaa77'; ctx.shadowBlur=4;
          ctx.fillRect(b.x-4,b.y-2,8,4);
          break;
        case 'ankh':{ // ツタンカーメンのアンク呪符
          b.rot=(b.rot||0)+(b.rotSpd||0.15);
          ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot);
          ctx.shadowColor='#FFD700'; ctx.shadowBlur=10;
          // アンクの縦棒
          ctx.strokeStyle='#FFD700'; ctx.lineWidth=3; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(0,7); ctx.stroke();
          // アンクの横棒
          ctx.beginPath(); ctx.moveTo(-6,-2); ctx.lineTo(6,-2); ctx.stroke();
          // アンクの円（上部ループ）
          ctx.beginPath(); ctx.arc(0,-5.5,4,0,Math.PI*2); ctx.stroke();
          // 中心の金の輝き
          ctx.fillStyle='rgba(255,220,0,0.6)';
          ctx.beginPath(); ctx.arc(0,-5.5,2,0,Math.PI*2); ctx.fill();
          ctx.restore();
          ctx.shadowBlur=0;
          break;
        }
        case 'goldBeam':{ // ツタンカーメンの黄金ビーム
          b.life=(b.life||60)-1;
          const glw=1-b.life/60;
          ctx.shadowColor='#FFD700'; ctx.shadowBlur=14;
          const gbG=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,8);
          gbG.addColorStop(0,'rgba(255,255,200,0.95)'); gbG.addColorStop(0.4,'rgba(255,200,0,0.8)'); gbG.addColorStop(1,'rgba(200,140,0,0)');
          ctx.fillStyle=gbG; ctx.beginPath(); ctx.arc(b.x,b.y,8,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          break;
        }
        case 'green': // エイリアン弾
          ctx.fillStyle='#44ff66'; ctx.shadowColor='#00ff44'; ctx.shadowBlur=6;
          ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill();
          break;
        case 'alienBeam': { // 巨大エイリアンのビーム砲
          const alife=(b.life||80)/80;
          const abr=5+Math.sin(frame*0.5)*1.5;
          ctx.shadowColor='#00ffaa'; ctx.shadowBlur=18;
          // コア
          ctx.fillStyle=`rgba(180,255,200,${alife*0.95})`;
          ctx.beginPath(); ctx.ellipse(b.x,b.y,abr+2,abr+2,0,0,Math.PI*2); ctx.fill();
          // 発光アウター
          const abG2=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,abr*2.5);
          abG2.addColorStop(0,`rgba(0,255,160,${alife*0.5})`);
          abG2.addColorStop(1,'rgba(0,255,100,0)');
          ctx.fillStyle=abG2; ctx.beginPath(); ctx.arc(b.x,b.y,abr*2.5,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          break;
        }
        case 'blob': // アメーバ
          ctx.fillStyle='rgba(200,0,255,0.8)'; ctx.shadowColor='#cc00ff'; ctx.shadowBlur=5;
          ctx.beginPath(); ctx.arc(b.x,b.y,5,0,Math.PI*2); ctx.fill();
          break;
        case 'plasma': // 宇宙弾
          ctx.fillStyle='#4488ff'; ctx.shadowColor='#2266ff'; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#ccddff';
          ctx.beginPath(); ctx.arc(b.x-1,b.y-1,1.5,0,Math.PI*2); ctx.fill();
          break;
        case 'fireball': // 火球
          ctx.fillStyle='#ff2200'; ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
          ctx.beginPath(); ctx.arc(b.x,b.y,7,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#ffaa00';
          ctx.beginPath(); ctx.arc(b.x-2,b.y-2,3,0,Math.PI*2); ctx.fill();
          break;
        case 'breath': { // 炎ブレス
          b.age=(b.age||0)+1;
          const bAlpha=Math.max(0,1-b.age/40);
          const bR=4+b.age*0.6;
          ctx.shadowColor='#ff8800'; ctx.shadowBlur=10;
          const bG=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,bR);
          bG.addColorStop(0,`rgba(255,240,80,${bAlpha})`);
          bG.addColorStop(0.4,`rgba(255,120,0,${bAlpha*0.8})`);
          bG.addColorStop(1,`rgba(255,30,0,0)`);
          ctx.fillStyle=bG; ctx.beginPath(); ctx.arc(b.x,b.y,bR,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          break;
        }
        case 'shell':{ // 砲弾
          const sa=Math.atan2(b.vy||0,b.vx||0);
          ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(sa);
          ctx.shadowColor='#ff8800'; ctx.shadowBlur=10;
          const stg=ctx.createLinearGradient(-14,0,0,0);
          stg.addColorStop(0,'rgba(255,80,0,0)'); stg.addColorStop(1,'rgba(255,140,0,0.5)');
          ctx.fillStyle=stg; ctx.fillRect(-14,-4,14,8);
          const shG=ctx.createLinearGradient(-6,-4,6,4);
          shG.addColorStop(0,'#ffe0a0'); shG.addColorStop(0.4,'#cc7700'); shG.addColorStop(1,'#3a2000');
          ctx.fillStyle=shG;
          ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(2,-4); ctx.lineTo(-6,-3); ctx.lineTo(-6,3); ctx.lineTo(2,4); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='rgba(255,180,60,0.5)'; ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(2,-4); ctx.lineTo(-6,-3); ctx.lineTo(-6,3); ctx.lineTo(2,4); ctx.closePath(); ctx.stroke();
          ctx.shadowBlur=0; ctx.restore(); break;
        }
        case 'laser_bolt':{ // レーザー砲弾
          const la=Math.atan2(b.vy||0,b.vx||0);
          ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(la);
          ctx.shadowColor='#ff2244'; ctx.shadowBlur=12;
          const lbG=ctx.createLinearGradient(-10,0,8,0);
          lbG.addColorStop(0,'rgba(255,20,60,0)'); lbG.addColorStop(0.4,'rgba(255,60,80,0.7)'); lbG.addColorStop(1,'rgba(255,180,200,0.95)');
          ctx.fillStyle=lbG;
          ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(4,-2.5); ctx.lineTo(-10,-1); ctx.lineTo(-10,1); ctx.lineTo(4,2.5); ctx.closePath(); ctx.fill();
          ctx.fillStyle='rgba(255,230,235,0.9)'; ctx.fillRect(-6,-0.8,12,1.6);
          ctx.shadowBlur=0; ctx.restore(); break;
        }
        case 'homing':{ // 追尾ミサイル
          const ha2=Math.atan2(b.vy||0,b.vx||0);
          ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ha2);
          ctx.shadowColor='#ff4400'; ctx.shadowBlur=10;
          const htg=ctx.createLinearGradient(-14,0,0,0);
          htg.addColorStop(0,'rgba(255,100,0,0)'); htg.addColorStop(1,'rgba(255,200,80,0.7)');
          ctx.fillStyle=htg; ctx.beginPath(); ctx.ellipse(-8,0,8,3,0,0,Math.PI*2); ctx.fill();
          const hmG=ctx.createLinearGradient(-4,-4,4,4);
          hmG.addColorStop(0,'#ffddaa'); hmG.addColorStop(0.5,'#cc4400'); hmG.addColorStop(1,'#220800');
          ctx.fillStyle=hmG;
          ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(4,-3); ctx.lineTo(-5,-3); ctx.lineTo(-8,0); ctx.lineTo(-5,3); ctx.lineTo(4,3); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#882200';
          ctx.beginPath(); ctx.moveTo(-2,-3); ctx.lineTo(-5,-7); ctx.lineTo(-6,-3); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-2,3); ctx.lineTo(-5,7); ctx.lineTo(-6,3); ctx.closePath(); ctx.fill();
          ctx.shadowBlur=0; ctx.restore(); break;
        }
        default:
          ctx.fillStyle='#ff4444'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=6;
          ctx.fillRect(b.x-3,b.y-3,6,6);
      }
      ctx.shadowBlur=0; ctx.restore();
    }

    function drawBullet(b){
      ctx.save();

      // ── Lv3 リングレーザー弾（進むほどリングが拡大）──
      if(b.ring){
        const r=5+b.age*0.7;
        const alpha=Math.max(0.1, 1.0-b.age*0.018);
        ctx.shadowColor='#00eeff'; ctx.shadowBlur=12+r*0.3;
        // 外リング（メイン）
        ctx.strokeStyle=`rgba(0,${Math.floor(220-b.age*1.5)},255,${alpha})`;
        ctx.lineWidth=3-Math.min(2,b.age*0.03);
        ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2); ctx.stroke();
        // 内リング（細い）
        ctx.strokeStyle=`rgba(180,255,255,${alpha*0.6})`;
        ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(b.x,b.y,r*0.55,0,Math.PI*2); ctx.stroke();
        // 中心光点
        ctx.shadowBlur=8;
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.85})`;
        ctx.beginPath(); ctx.arc(b.x,b.y,2.5,0,Math.PI*2); ctx.fill();
        // 外側グロー（大きなリングほどゆっくり消える）
        const gg=ctx.createRadialGradient(b.x,b.y,r*0.8,b.x,b.y,r*1.4);
        gg.addColorStop(0,`rgba(0,200,255,${alpha*0.25})`);
        gg.addColorStop(1,'rgba(0,100,255,0)');
        ctx.fillStyle=gg;
        ctx.beginPath(); ctx.arc(b.x,b.y,r*1.4,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.restore(); return;
      }

      // ── Lv3 波動砲弾 ────────────────────────────────
      if(b.wave){
        const hh=b.h/2;
        const intensity=b.power;
        ctx.shadowColor='#aaddff'; ctx.shadowBlur=20+intensity*10;
        // 外縁グロー（大）
        const wg=ctx.createLinearGradient(b.x,b.y-hh*2,b.x,b.y+hh*2);
        wg.addColorStop(0,'rgba(0,100,255,0)');
        wg.addColorStop(0.25,`rgba(0,${Math.floor(150+intensity*105)},255,${0.2+intensity*0.2})`);
        wg.addColorStop(0.5,`rgba(${Math.floor(100+intensity*155)},240,255,${0.5+intensity*0.3})`);
        wg.addColorStop(0.75,`rgba(0,${Math.floor(150+intensity*105)},255,${0.2+intensity*0.2})`);
        wg.addColorStop(1,'rgba(0,100,255,0)');
        ctx.fillStyle=wg;
        ctx.fillRect(b.x,b.y-hh*2,b.w,hh*4);
        // コア（白熱）
        const wc=ctx.createLinearGradient(b.x,b.y-hh,b.x,b.y+hh);
        wc.addColorStop(0,`rgba(${Math.floor(100+intensity*155)},230,255,0.4)`);
        wc.addColorStop(0.5,'rgba(255,255,255,0.95)');
        wc.addColorStop(1,`rgba(${Math.floor(100+intensity*155)},230,255,0.4)`);
        ctx.fillStyle=wc;
        ctx.fillRect(b.x,b.y-hh,b.w,hh*2);
        ctx.shadowBlur=0;
        // エネルギーリング（縁を流れる）
        const rspacing=24;
        const rOffset=(b.age*4)%rspacing;
        ctx.strokeStyle=`rgba(200,240,255,${0.4+intensity*0.3})`; ctx.lineWidth=1.5;
        for(let rx=b.x+rOffset;rx<b.x+b.w;rx+=rspacing){
          ctx.save(); ctx.translate(rx,b.y);
          ctx.beginPath(); ctx.ellipse(0,0,4,hh*0.8,0,0,Math.PI*2); ctx.stroke();
          ctx.restore();
        }
        // 先端の衝撃波
        ctx.shadowColor='#ffffff'; ctx.shadowBlur=16;
        ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=3;
        ctx.beginPath();
        ctx.moveTo(b.x+b.w,b.y-hh*1.5);
        ctx.bezierCurveTo(b.x+b.w+10,b.y-hh*0.8,b.x+b.w+10,b.y+hh*0.8,b.x+b.w,b.y+hh*1.5);
        ctx.stroke();
        ctx.shadowBlur=0;
        ctx.restore(); return;
      }
      if(b.missile){
        if(b.missUp){
          // ── 上ミサイル描画 ──────────────────────────
          const ulv=b.missUpLv||1;
          // Lv3 天井這い: 煙トレイル
          if(ulv===3 && b.sliding){
            // 天井這い煙（青みがかった煙）
            ctx.fillStyle='rgba(120,200,255,0.3)'; ctx.shadowBlur=0;
            ctx.fillRect(Math.floor(b.x-8),Math.floor(b.y-3),18,6);
          }
          // ミサイル本体
          // Lv1: 黄緑, Lv2: シアン, Lv3: 白青
          const mCol= ulv===3?'#aaffff': ulv===2?'#00ffcc':'#aaff44';
          const mShadow= ulv===3?'#88eeff': ulv===2?'#00ddcc':'#88dd00';
          ctx.shadowColor=mShadow; ctx.shadowBlur=8;
          ctx.save(); ctx.translate(Math.floor(b.x),Math.floor(b.y));
          // 角度: 這い中は水平、飛行中は速度方向
          ctx.rotate(b.sliding ? 0 : Math.atan2(b.vy,b.vx));
          const mW=ulv>=2?14:10, mH=ulv>=2?5:4;
          ctx.fillStyle=mCol;
          ctx.fillRect(-2,-mH/2,mW,mH);
          // 先端（Lv2は逆向きなので後端を光らせる）
          ctx.fillStyle='#ffffff';
          if(b.backward && !b.sliding){
            ctx.fillRect(-5,-1,3,2); // 後端（Lv2は後ろ向き発射）
          } else {
            ctx.fillRect(mW-3,-1,3,2);
          }
          // Lv3: 天井這い中はスパーク
          if(ulv===3 && b.sliding){
            ctx.fillStyle=`rgba(100,220,255,${0.4+Math.sin(frame*0.3)*0.3})`;
            ctx.beginPath(); ctx.arc(mW/2,-3,3,0,Math.PI*2); ctx.fill();
          }
          ctx.restore();
        } else {
          // ── 下ミサイル描画（従来）──────────────────
          const lv=b.missLv||1;
          // Lv3: 地面這いは白煙トレイル
          if(lv===3 && b.sliding){
            ctx.fillStyle='rgba(255,200,80,0.35)'; ctx.shadowBlur=0;
            ctx.fillRect(Math.floor(b.x-8),Math.floor(b.y-3),18,6);
          }
          // ミサイル本体
          ctx.shadowColor= lv===3?'#ffcc00': lv===2?'#ff8800':'#ffaa00';
          ctx.shadowBlur=8;
          ctx.save(); ctx.translate(Math.floor(b.x),Math.floor(b.y));
          ctx.rotate(b.sliding ? 0 : Math.atan2(b.vy,b.vx));
          const W2=lv>=2?14:10, H2=lv>=2?5:4;
          ctx.fillStyle= lv===3?'#ffe066': lv===2?'#ff9900':'#ffcc00';
          ctx.fillRect(-2,-H2/2,W2,H2);
          ctx.fillStyle='#fff8aa';
          ctx.fillRect(W2-3,-1,3,2);
          ctx.restore();
        }
      } else {
        // ── 通常弾: 細長いプラズマボルト ──
        const bx=Math.floor(b.x), by=Math.floor(b.y);
        // コアビーム
        ctx.shadowColor='#60e0ff'; ctx.shadowBlur=7;
        const bg=ctx.createLinearGradient(bx,by,bx+14,by);
        bg.addColorStop(0,'rgba(200,240,255,0.0)');
        bg.addColorStop(0.15,'rgba(180,230,255,0.7)');
        bg.addColorStop(0.5,'rgba(255,255,255,1.0)');
        bg.addColorStop(0.85,'rgba(160,220,255,0.8)');
        bg.addColorStop(1,'rgba(80,180,255,0.2)');
        ctx.fillStyle=bg;
        ctx.beginPath();
        ctx.moveTo(bx,   by);
        ctx.lineTo(bx+3, by-1.5);
        ctx.lineTo(bx+13,by-0.8);
        ctx.lineTo(bx+14,by);
        ctx.lineTo(bx+13,by+0.8);
        ctx.lineTo(bx+3, by+1.5);
        ctx.closePath(); ctx.fill();
        // 先端スパーク
        ctx.shadowColor='#ffffff'; ctx.shadowBlur=4;
        ctx.fillStyle='rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.arc(bx+13,by,1.2,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
      }
      ctx.shadowBlur=0; ctx.restore();
    }

    function drawPowerItem(it){
      ctx.save();
      const t2=frame*0.07;
      const px=Math.floor(it.x), py=Math.floor(it.y);
      const pulse2=Math.sin(t2*2)*3;
      ctx.strokeStyle=`rgba(0,220,255,${0.3+Math.sin(t2*1.5)*0.2})`; ctx.lineWidth=1;
      ctx.shadowColor='#00ddff'; ctx.shadowBlur=10+pulse2;
      ctx.beginPath(); ctx.arc(px,py,14+pulse2*0.3,0,Math.PI*2); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.save(); ctx.translate(px,py); ctx.rotate(t2*0.5);
      ctx.fillStyle='#0a2030'; ctx.strokeStyle='#0080b0'; ctx.lineWidth=1;
      for(let i=0;i<4;i++){
        ctx.save(); ctx.rotate((Math.PI/2)*i);
        ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(2.5,-8); ctx.lineTo(0,-5); ctx.lineTo(-2.5,-8);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.translate(px,py); ctx.rotate(t2*0.3);
      const cg3=ctx.createRadialGradient(0,0,0,0,0,8);
      cg3.addColorStop(0,'#ffffff'); cg3.addColorStop(0.3,'#80eeff');
      cg3.addColorStop(0.7,'#0090c0'); cg3.addColorStop(1,'#003050');
      ctx.fillStyle=cg3; ctx.shadowColor='#00ccff'; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(5,0); ctx.lineTo(0,8); ctx.lineTo(-5,0);
      ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(2,-3); ctx.lineTo(-2,-3); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      ctx.restore();
    }

    function spawnExplosion(x,y,big){
      const n=big?32:12;
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2, spd=1+Math.random()*(big?6:3);
        particles.push({
          x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
          life:big?60:35, maxLife:big?60:35,
          color:['#ff8800','#ffdd00','#ff4400','#ffffff','#ff0000'][Math.floor(Math.random()*5)],
          size:big?2+Math.random()*4:1+Math.random()*2
        });
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE ENEMY SPAWNING
    // ─────────────────────────────────────────────────

    // ─────────────────────────────────────────────────
    // SHOOT: enemy bullet by kind


    // ─────────────────────────────────────────────────
    // DRAW BACKGROUND per stage
    // ─────────────────────────────────────────────────
    function drawBackground(){
      switch(stage){
        case 1: drawVolcanoBack(); break;
        case 2: drawMoaiBack();    break;
        case 3: drawPyramidBack(); break;
        case 4: drawRuinsBack();   break;
        case 5: drawBodyBack();    break;
        case 6: drawCosmosBack();  break;
        case 7: drawFortressBack(); break;
      }
      drawTerrain();
    }

    // ══════════════════════════════════════════════════
    // STAGE 1: 火山 ─ 噴火する地獄の火山地帯
    // ══════════════════════════════════════════════════
    function drawVolcanoBack(){
      // ━━━ 背景: 黒 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ctx.fillStyle='#000000'; ctx.fillRect(0,0,W,H);

      // 遠景の山岳シルエット（2層視差・黒より少し明るい暗グレー）
      const mountLayers=[
        { spd:0.08, col:'#111111', mounts:[
          {x:0,  w:120,h:0.50},{x:100,w:90, h:0.60},{x:200,w:140,h:0.45},{x:320,w:100,h:0.55},
          {x:420,w:130,h:0.48},{x:530,w:110,h:0.62},{x:620,w:90, h:0.52},{x:700,w:120,h:0.44},
        ]},
        { spd:0.15, col:'#1a1a1a', mounts:[
          {x:50, w:80, h:0.55},{x:155,w:100,h:0.65},{x:270,w:90, h:0.50},{x:370,w:120,h:0.58},
          {x:480,w:100,h:0.52},{x:580,w:80, h:0.60},{x:660,w:110,h:0.48},
        ]},
      ];
      for(const ml of mountLayers){
        ctx.fillStyle=ml.col;
        const mox=(-scrollX*ml.spd%(W*2)+W*2)%(W*2);
        for(const m of ml.mounts){
          const mx=((m.x+mox)%(W+m.w+200)+W+200)%(W+m.w+200)-m.w;
          const my=H*m.h;
          ctx.beginPath();
          ctx.moveTo(mx-m.w*0.55,H);
          ctx.lineTo(mx,my);
          ctx.lineTo(mx+m.w*0.55,H);
          ctx.closePath(); ctx.fill();
          // 稜線（片側の明るいライン）
          ctx.strokeStyle='#222222'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+m.w*0.55,H); ctx.stroke();
        }
      }

      // ━━━ 中景: 火山（背景に見える火山）━━━━━━━━━━━━━━
      // 火山は上地形・下地形の間の中央帯に描画
      const volcDefs=[
        {x:80,  w:110, erupt:true },
        {x:250, w:90,  erupt:false},
        {x:390, w:130, erupt:true },
        {x:560, w:100, erupt:false},
        {x:700, w:120, erupt:true },
      ];
      const volcOx=(-scrollX*0.40%(W*2)+W*2)%(W*2);
      for(const v of volcDefs){
        const vx=((v.x+volcOx)%(W+v.w+300)+W+v.w+300)%(W+v.w+300)-(v.w+150);
        // 火山中心Y: 画面中央
        const vcY=H*0.5;
        const vH=v.w*0.65;  // 火山の高さ

        // 火山本体（岩山色: 暗茶〜暗灰）
        const vG=ctx.createLinearGradient(vx,vcY-vH,vx,vcY+vH);
        vG.addColorStop(0,'#2a2218');
        vG.addColorStop(0.4,'#3d3228');
        vG.addColorStop(1,'#1a1410');
        ctx.fillStyle=vG;
        // 上半分の山（上の岩山と接続）
        ctx.beginPath();
        ctx.moveTo(vx-v.w*0.6,vcY-vH*0.1);
        ctx.lineTo(vx-v.w*0.12,vcY-vH*0.85);
        ctx.lineTo(vx,vcY-vH);              // 山頂（火口）
        ctx.lineTo(vx+v.w*0.12,vcY-vH*0.85);
        ctx.lineTo(vx+v.w*0.6,vcY-vH*0.1);
        ctx.lineTo(vx+v.w*0.7,vcY+vH*0.1);
        ctx.lineTo(vx-v.w*0.7,vcY+vH*0.1);
        ctx.closePath(); ctx.fill();

        // 岩の線（横縞テクスチャ）
        ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
        for(let ri=1;ri<=3;ri++){
          const ry=vcY-vH*(0.3+ri*0.15);
          const rw=v.w*(0.25+ri*0.12);
          ctx.beginPath(); ctx.moveTo(vx-rw,ry); ctx.lineTo(vx+rw,ry); ctx.stroke();
        }

        // 火口の暗い窪み
        ctx.fillStyle='#0a0806';
        ctx.beginPath();
        ctx.ellipse(vx, vcY-vH, v.w*0.12, v.w*0.06, 0, 0, Math.PI*2);
        ctx.fill();

        if(v.erupt){
          // 噴火！ 火口からマグマ噴出
          const ep=Math.abs(Math.sin(frame*0.025+v.x*0.01));
          const eH=50+ep*60;
          // 噴出柱グラデーション
          const eG=ctx.createLinearGradient(vx,vcY-vH-eH,vx,vcY-vH);
          eG.addColorStop(0,'rgba(255,230,80,0)');
          eG.addColorStop(0.2,'rgba(255,160,0,0.7)');
          eG.addColorStop(0.7,'rgba(255,60,0,0.85)');
          eG.addColorStop(1,'rgba(200,30,0,0.6)');
          ctx.fillStyle=eG; ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
          ctx.beginPath();
          ctx.moveTo(vx-v.w*0.08, vcY-vH);
          ctx.quadraticCurveTo(vx-v.w*0.06, vcY-vH-eH*0.5, vx+(Math.sin(frame*0.04)*8), vcY-vH-eH);
          ctx.quadraticCurveTo(vx+v.w*0.06, vcY-vH-eH*0.5, vx+v.w*0.08, vcY-vH);
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur=0;

          // 溶岩しぶき（火口付近）
          for(let pi=0;pi<6;pi++){
            const pa=(frame*0.07+pi*1.05);
            const pr=8+Math.abs(Math.sin(pa))*v.w*0.18*ep;
            const px2=vx + Math.cos(pa)*pr;
            const py2=vcY - vH - eH*0.3 + Math.sin(pa)*pr*0.5;
            const ps=1.5+Math.sin(pa+pi)*1.5;
            ctx.fillStyle=`rgba(255,${Math.floor(120+ep*100)},0,0.8)`;
            ctx.beginPath(); ctx.arc(px2,py2,ps,0,Math.PI*2); ctx.fill();
          }

          // 火口の赤い光
          const cg=ctx.createRadialGradient(vx,vcY-vH,0,vx,vcY-vH,v.w*0.2+ep*10);
          cg.addColorStop(0,'rgba(255,180,0,0.7)');
          cg.addColorStop(0.5,'rgba(255,60,0,0.3)');
          cg.addColorStop(1,'rgba(255,0,0,0)');
          ctx.fillStyle=cg;
          ctx.beginPath(); ctx.ellipse(vx,vcY-vH,v.w*0.2+ep*10,v.w*0.1+ep*5,0,0,Math.PI*2); ctx.fill();
        }
      }

      // ━━━ 煙（白灰色）━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const ashOx=(-scrollX*0.2+frame*0.35)%(W*2);
      for(let i=0;i<18;i++){
        const ax=((i*97+ashOx)%(W+60)+W)%(W+60)-30;
        const ay=(i*53+frame*0.35+i*0.6)%(H*0.7) + H*0.15;
        const ar=1+(i%3)*0.5;
        ctx.fillStyle=`rgba(80,70,60,${0.15+i%3*0.05})`;
        ctx.beginPath(); ctx.arc(ax,ay,ar,0,Math.PI*2); ctx.fill();
      }
    }

    // ══════════════════════════════════════════════════
    // STAGE 2: モアイ ─ 南太平洋の謎めいた島
    // ══════════════════════════════════════════════════
    function drawMoaiBack(){
      // ══ イースター島 ─ 夕暮れの荒涼とした草原 ══
      // 空（夕暮れグラデーション）
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,'#1a0c2e');   // 最上: 深紫
      sky.addColorStop(0.25,'#3d1c55'); // 暗紫
      sky.addColorStop(0.5,'#7c3020');  // 赤橙
      sky.addColorStop(0.72,'#b85a18'); // オレンジ
      sky.addColorStop(0.88,'#d4782a'); // 夕焼け橙
      sky.addColorStop(1,'#c25818');    // 水平線付近
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

      // 星（上部のみ）
      for(const s of stars){
        if(s.y<H*0.3){
          ctx.fillStyle=`rgba(220,200,255,${s.bright*0.5})`;
          ctx.fillRect(Math.floor(s.x),Math.floor(s.y),s.size,s.size);
        }
      }

      // 太陽（沈みかけ、水平線付近）
      const sunX=W*0.2+(-scrollX*0.01%W+W)%W%W;
      const sunY=H*0.72;
      const sunG=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,55);
      sunG.addColorStop(0,'rgba(255,255,200,0.95)');
      sunG.addColorStop(0.15,'rgba(255,230,100,0.9)');
      sunG.addColorStop(0.4,'rgba(255,160,40,0.6)');
      sunG.addColorStop(0.7,'rgba(255,100,0,0.2)');
      sunG.addColorStop(1,'rgba(255,80,0,0)');
      ctx.fillStyle=sunG; ctx.beginPath(); ctx.arc(sunX,sunY,55,0,Math.PI*2); ctx.fill();
      // 太陽の中心
      ctx.fillStyle='rgba(255,255,220,0.95)';
      ctx.beginPath(); ctx.arc(sunX,sunY,14,0,Math.PI*2); ctx.fill();
      // 太陽光の帯
      ctx.fillStyle='rgba(255,180,50,0.12)';
      for(let ri=0;ri<5;ri++){
        const rr=22+ri*12;
        ctx.beginPath(); ctx.arc(sunX,sunY,rr,Math.PI*1.1,Math.PI*1.9); ctx.fill();
      }

      // 水平線の光芒
      const horizGlow=ctx.createLinearGradient(0,sunY-10,0,sunY+25);
      horizGlow.addColorStop(0,'rgba(255,160,40,0)');
      horizGlow.addColorStop(0.5,'rgba(255,140,30,0.35)');
      horizGlow.addColorStop(1,'rgba(200,80,0,0)');
      ctx.fillStyle=horizGlow; ctx.fillRect(0,sunY-10,W,35);

      // 遠景の海（水平線）
      const seaY=H*0.74;
      const deepSeaG=ctx.createLinearGradient(0,seaY,0,H*0.82);
      deepSeaG.addColorStop(0,'rgba(80,30,10,0.9)');
      deepSeaG.addColorStop(0.4,'rgba(50,15,5,0.95)');
      deepSeaG.addColorStop(1,'rgba(20,8,2,1)');
      ctx.fillStyle=deepSeaG; ctx.fillRect(0,seaY,W,H*0.82-seaY);
      // 海の波・反射
      ctx.strokeStyle='rgba(220,120,40,0.25)'; ctx.lineWidth=1;
      for(let wi=0;wi<5;wi++){
        const wy=seaY+wi*4+Math.sin(frame*0.025+wi)*2;
        ctx.beginPath();
        for(let wx=0;wx<W;wx+=6){
          const wY=wy+Math.sin((wx+scrollX*0.4+wi*30)*0.04)*2;
          wx===0?ctx.moveTo(wx,wY):ctx.lineTo(wx,wY);
        }
        ctx.stroke();
      }

      // 遠景の崖・丘（3層視差）
      const hillLayers=[
        { spd:0.06, fills:[
            {x:0,  w:180, peak:0.62, col:'#1e1208'},
            {x:160,w:140, peak:0.66, col:'#1e1208'},
            {x:320,w:200, peak:0.60, col:'#1e1208'},
            {x:520,w:160, peak:0.64, col:'#1e1208'},
        ]},
        { spd:0.12, fills:[
            {x:40, w:160, peak:0.66, col:'#28180a'},
            {x:220,w:140, peak:0.70, col:'#28180a'},
            {x:380,w:180, peak:0.64, col:'#28180a'},
            {x:560,w:120, peak:0.68, col:'#28180a'},
        ]},
        { spd:0.22, fills:[
            {x:80, w:120, peak:0.70, col:'#342010'},
            {x:240,w:140, peak:0.73, col:'#342010'},
            {x:420,w:110, peak:0.68, col:'#342010'},
            {x:600,w:130, peak:0.71, col:'#342010'},
        ]},
      ];
      for(const hl of hillLayers){
        const hox=(-scrollX*hl.spd%(W*2)+W*2)%(W*2);
        for(const h of hl.fills){
          ctx.fillStyle=h.col;
          const hx=((h.x+hox)%(W+h.w+300)+W+h.w+300)%(W+h.w+300)-(h.w+150);
          const hy=H*h.peak;
          ctx.beginPath();
          ctx.moveTo(hx-h.w*0.55,H*0.78);
          ctx.bezierCurveTo(hx-h.w*0.3,H*0.78,hx-h.w*0.15,hy,hx,hy);
          ctx.bezierCurveTo(hx+h.w*0.15,hy,hx+h.w*0.3,H*0.78,hx+h.w*0.55,H*0.78);
          ctx.closePath(); ctx.fill();
        }
      }

      // 中景の草原地面（地形）
      const grassY=H*0.76;
      const groundG=ctx.createLinearGradient(0,grassY,0,H);
      groundG.addColorStop(0,'#3a2808');
      groundG.addColorStop(0.15,'#4a3410');
      groundG.addColorStop(0.5,'#3a2808');
      groundG.addColorStop(1,'#281a04');
      ctx.fillStyle=groundG; ctx.fillRect(0,grassY,W,H-grassY);
      // 草の稜線（でこぼこした草原）
      ctx.fillStyle='#4a3a12';
      ctx.beginPath(); ctx.moveTo(0,grassY);
      for(let gx=0;gx<=W;gx+=3){
        const gy=grassY+Math.sin((gx+scrollX*0.8)*0.06)*4+Math.sin((gx+scrollX*0.5)*0.14)*2;
        ctx.lineTo(gx,gy);
      }
      ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
      // 草の色ライン（乾燥した草原）
      ctx.strokeStyle='rgba(90,72,20,0.5)'; ctx.lineWidth=1;
      for(let gi=0;gi<20;gi++){
        const gx=((gi*48+(-scrollX*1.0)%(W*2)+W*2)%(W+60)+W)%(W+60)-30;
        const gy=grassY+Math.sin((gx+scrollX*0.8)*0.06)*4;
        ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx-2,gy-6+Math.sin(frame*0.04+gi)*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gx+3,gy+1); ctx.lineTo(gx+1,gy-5+Math.sin(frame*0.04+gi+1)*2); ctx.stroke();
      }

      // 遠景モアイシルエット群（背景装飾）
      const bgMoaiDefs=[
        {x:60, h:28, w:10},{x:150,h:22,w:8},{x:290,h:32,w:12},
        {x:420,h:26,w:10},{x:560,h:30,w:11},{x:680,h:24,w:9},
      ];
      const bgMoaiOx=(-scrollX*0.25%(W*2)+W*2)%(W*2);
      for(const bm of bgMoaiDefs){
        const bmx=((bm.x+bgMoaiOx)%(W+bm.w*2+200)+W+bm.w*2+200)%(W+bm.w*2+200)-(bm.w+100);
        const bmy=grassY-2;
        ctx.fillStyle='rgba(20,14,6,0.8)';
        // 胴
        ctx.fillRect(bmx-bm.w/2, bmy-bm.h*0.55, bm.w, bm.h*0.55);
        // 頭
        ctx.beginPath(); ctx.moveTo(bmx-bm.w*0.55,bmy-bm.h*0.55);
        ctx.lineTo(bmx-bm.w*0.45,bmy-bm.h);
        ctx.lineTo(bmx+bm.w*0.45,bmy-bm.h);
        ctx.lineTo(bmx+bm.w*0.55,bmy-bm.h*0.55); ctx.closePath(); ctx.fill();
        // プカオ
        ctx.fillRect(bmx-bm.w*0.38,bmy-bm.h*1.06,bm.w*0.76,bm.h*0.1);
        // アフ
        ctx.beginPath(); ctx.moveTo(bmx-bm.w*0.75,bmy); ctx.lineTo(bmx-bm.w*0.55,bmy-3); ctx.lineTo(bmx+bm.w*0.55,bmy-3); ctx.lineTo(bmx+bm.w*0.75,bmy); ctx.closePath(); ctx.fill();
      }
    }

        // ══════════════════════════════════════════════════
    // STAGE 3: ピラミッド ─ 古代遺跡の内部通路
    // ══════════════════════════════════════════════════
    function drawPyramidBack(){
      // 壁: 古代石材の薄明かり
      const wall=ctx.createLinearGradient(0,0,0,H);
      wall.addColorStop(0,'#0d0900');
      wall.addColorStop(0.4,'#1a1200');
      wall.addColorStop(0.7,'#221500');
      wall.addColorStop(1,'#0d0900');
      ctx.fillStyle=wall; ctx.fillRect(0,0,W,H);

      // 遠景のピラミッド内部（視差）
      const pyrOx=(-scrollX*0.05%W+W)%W;
      // 消失点への廊下
      const vanX=W*0.5+pyrOx*0.02;
      const vanY=H*0.5;
      ctx.fillStyle='#0a0700';
      ctx.beginPath();
      ctx.moveTo(0,0); ctx.lineTo(vanX-180,vanY); ctx.lineTo(vanX+180,vanY); ctx.lineTo(W,0);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0,H); ctx.lineTo(vanX-180,vanY); ctx.lineTo(vanX+180,vanY); ctx.lineTo(W,H);
      ctx.closePath(); ctx.fill();

      // 石壁タイル（視差2層）
      for(let layer=0;layer<2;layer++){
        const spd=0.15+layer*0.15;
        const tileW=80-layer*20, tileH=60-layer*10;
        const ox=(-scrollX*spd%tileW+tileW)%tileW;
        const alpha=0.25-layer*0.1;
        // 石の影（目地）
        ctx.strokeStyle=`rgba(0,0,0,${alpha+0.1})`; ctx.lineWidth=layer===0?2:1;
        for(let tx=ox-tileW;tx<W+tileW;tx+=tileW){
          for(let ty=0;ty<H;ty+=tileH){
            ctx.strokeRect(tx,ty,tileW,tileH);
          }
        }
        // 石の光沢
        ctx.fillStyle=`rgba(${100+layer*20},${70+layer*15},${20},${alpha*0.5})`;
        for(let tx=ox-tileW+4;tx<W+tileW;tx+=tileW){
          for(let ty=4;ty<H;ty+=tileH){
            ctx.fillRect(tx,ty,tileW-10,4);
          }
        }
      }

      // 壁の象形文字
      const hierOx=(-scrollX*0.2%W+W)%W;
      ctx.fillStyle='rgba(180,130,30,0.35)';
      const hierSymbols=[
        (x,y)=>{ ctx.fillRect(x,y,8,12); ctx.fillRect(x+10,y,6,12); },
        (x,y)=>{ ctx.beginPath(); ctx.arc(x+5,y+5,5,0,Math.PI*2); ctx.fill(); },
        (x,y)=>{ ctx.beginPath(); ctx.moveTo(x,y+10); ctx.lineTo(x+5,y); ctx.lineTo(x+10,y+10); ctx.fill(); },
        (x,y)=>{ ctx.fillRect(x,y+4,12,4); ctx.fillRect(x+4,y,4,12); },
        (x,y)=>{ ctx.beginPath(); ctx.ellipse(x+5,y+6,5,6,0,0,Math.PI*2); ctx.fill(); },
      ];
      for(let i=0;i<20;i++){
        const hx=((i*55+hierOx)%(W+60)+W)%W - 20;
        const hy=30+i%4*120;
        hierSymbols[i%hierSymbols.length](hx,hy);
      }

      // たいまつの炎（壁に固定）
      const torchOx=(-scrollX*0.2%W+W)%W;
      for(let ti=0;ti<4;ti++){
        const tx=((ti*160+torchOx+80)%W+W)%W;
        const ty=H*0.5-20;
        // 炎の光
        const flameT=Math.sin(frame*0.12+ti)*0.5+0.5;
        const torchGlow=ctx.createRadialGradient(tx,ty,0,tx,ty,55);
        torchGlow.addColorStop(0,`rgba(255,180,50,${0.2+flameT*0.15})`);
        torchGlow.addColorStop(0.4,`rgba(255,100,0,${0.1+flameT*0.08})`);
        torchGlow.addColorStop(1,'rgba(255,60,0,0)');
        ctx.fillStyle=torchGlow; ctx.beginPath(); ctx.arc(tx,ty,55,0,Math.PI*2); ctx.fill();
        // 松明本体
        ctx.fillStyle='#663300'; ctx.fillRect(tx-2,ty,4,18);
        // 炎
        const fh=14+flameT*8;
        const flG=ctx.createLinearGradient(tx,ty-fh,tx,ty);
        flG.addColorStop(0,'rgba(255,220,80,0)'); flG.addColorStop(0.4,'rgba(255,140,0,0.9)'); flG.addColorStop(1,'rgba(255,60,0,0.7)');
        ctx.fillStyle=flG;
        ctx.beginPath();
        ctx.moveTo(tx-4,ty); ctx.bezierCurveTo(tx-6,ty-fh*0.5,tx-2,ty-fh*0.9,tx,ty-fh);
        ctx.bezierCurveTo(tx+2,ty-fh*0.9,tx+6,ty-fh*0.5,tx+4,ty); ctx.closePath(); ctx.fill();
      }

      // 天井/床の砂埃（奥行き感）
      const dustG1=ctx.createLinearGradient(0,0,0,H*0.2);
      dustG1.addColorStop(0,'rgba(100,70,20,0.5)'); dustG1.addColorStop(1,'rgba(100,70,20,0)');
      ctx.fillStyle=dustG1; ctx.fillRect(0,0,W,H*0.2);
      const dustG2=ctx.createLinearGradient(0,H*0.8,0,H);
      dustG2.addColorStop(0,'rgba(100,70,20,0)'); dustG2.addColorStop(1,'rgba(100,70,20,0.5)');
      ctx.fillStyle=dustG2; ctx.fillRect(0,H*0.8,W,H*0.2);
    }

    // ══════════════════════════════════════════════════
    // STAGE 4: 遺跡 ─ 宇宙人の廃墟都市
    // ══════════════════════════════════════════════════
    function drawRuinsBack(){
      // 空: 不気味な緑がかった夜空
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,'#020510');
      sky.addColorStop(0.4,'#05091a');
      sky.addColorStop(0.7,'#080d22');
      sky.addColorStop(1,'#0a1028');
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

      // 星雲（背景）
      const nebulaOx=(-scrollX*0.03%W+W)%W;
      for(let ni=0;ni<3;ni++){
        const nx=((ni*220+nebulaOx)%W+W)%W;
        const ny=80+ni*140;
        const nG=ctx.createRadialGradient(nx,ny,10,nx,ny,100);
        nG.addColorStop(0,`rgba(${20+ni*10},${60+ni*15},${80+ni*20},0.12)`);
        nG.addColorStop(0.5,`rgba(10,30,60,0.06)`);
        nG.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=nG; ctx.beginPath(); ctx.arc(nx,ny,100,0,Math.PI*2); ctx.fill();
      }

      // 星
      for(const s of stars){
        const tw=0.2+s.bright*0.8;
        ctx.fillStyle=`rgba(150,200,255,${tw*0.5})`;
        ctx.fillRect(Math.floor(s.x),Math.floor(s.y*0.7),s.size,s.size);
      }

      // 遠景の廃墟都市（視差3層）
      const cityLayers=[
        {spd:0.06, color:'rgba(5,10,20,0.95)', h:0.6,
         shapes:[{x:30,w:40,h2:0.18},{x:100,w:25,h2:0.25},{x:160,w:55,h2:0.15},{x:240,w:30,h2:0.30},
                 {x:310,w:45,h2:0.20},{x:380,w:28,h2:0.28},{x:430,w:60,h2:0.14},{x:490,w:22,h2:0.22}]},
        {spd:0.12, color:'rgba(8,14,28,0.9)', h:0.65,
         shapes:[{x:50,w:35,h2:0.22},{x:130,w:50,h2:0.18},{x:210,w:20,h2:0.32},{x:280,w:40,h2:0.24},
                 {x:350,w:30,h2:0.26},{x:410,w:45,h2:0.16},{x:470,w:25,h2:0.20}]},
        {spd:0.22, color:'rgba(12,18,35,0.85)', h:0.72,
         shapes:[{x:20,w:30,h2:0.28},{x:90,w:45,h2:0.24},{x:180,w:35,h2:0.20},{x:260,w:55,h2:0.16},
                 {x:340,w:25,h2:0.30},{x:400,w:40,h2:0.22},{x:460,w:30,h2:0.18}]},
      ];
      for(const layer of cityLayers){
        const ox=(-scrollX*layer.spd%W+W)%W;
        for(const b of layer.shapes){
          const bx=((b.x+ox)%(W+100)+W)%(W+100)-50;
          const bTopY=H*b.h2;
          const bBotY=H*layer.h;
          ctx.fillStyle=layer.color;
          ctx.fillRect(bx,bTopY,b.w,bBotY-bTopY);
          // 屋上構造物
          ctx.fillRect(bx+b.w*0.2,bTopY-8,b.w*0.3,8);
          // 窓の発光
          ctx.fillStyle='rgba(80,160,255,0.2)';
          for(let wy2=bTopY+8;wy2<bBotY-12;wy2+=16){
            for(let wx2=bx+4;wx2<bx+b.w-8;wx2+=10){
              if(Math.sin(wy2*0.3+wx2*0.2+frame*0.01)>0.3){
                ctx.fillRect(wx2,wy2,6,8);
              }
            }
          }
          // 非常灯（屋上）
          const beaconFlash=Math.floor(frame*0.06+b.x*0.1)%3===0;
          if(beaconFlash){
            ctx.fillStyle='rgba(255,80,80,0.6)';
            ctx.shadowColor='#ff2200'; ctx.shadowBlur=8;
            ctx.beginPath(); ctx.arc(bx+b.w*0.5,bTopY-4,3,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0;
          }
        }
      }

      // 列柱（前景）
      const colOx=(-scrollX*0.35%W+W)%W;
      for(let ci=0;ci<6;ci++){
        const cx=((ci*140+colOx+30)%W+W)%W;
        // 柱本体
        const colG=ctx.createLinearGradient(cx,0,cx+22,0);
        colG.addColorStop(0,'#12182a'); colG.addColorStop(0.4,'#1e2840'); colG.addColorStop(0.7,'#16203a'); colG.addColorStop(1,'#0e1420');
        ctx.fillStyle=colG; ctx.fillRect(cx,H*0.08,22,H*0.84);
        // 柱頭（エンタブラチュア）
        ctx.fillStyle='#1a2438'; ctx.fillRect(cx-8,H*0.07,38,16);
        ctx.fillStyle='#0e1420'; ctx.fillRect(cx-4,H*0.065,30,8);
        // 柱溝（フルート）
        ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
        for(let fl=0;fl<4;fl++){
          ctx.beginPath(); ctx.moveTo(cx+4+fl*4,H*0.09); ctx.lineTo(cx+4+fl*4,H*0.9); ctx.stroke();
        }
        // エネルギーの漏れ（SF感）
        ctx.fillStyle='rgba(60,120,255,0.05)';
        ctx.fillRect(cx,H*0.08,22,H*0.84);
      }

      // 空中を漂うパーティクル（ダスト）
      const dustOx=(scrollX*0.1+frame*0.3)%W;
      ctx.fillStyle='rgba(100,150,255,0.2)';
      for(let di=0;di<20;di++){
        const dx=((di*83+dustOx)%W+W)%W;
        const dy=(di*47+frame*0.15*(1+di%3))%H;
        ctx.beginPath(); ctx.arc(dx,dy,1,0,Math.PI*2); ctx.fill();
      }
    }

    // ══════════════════════════════════════════════════
    // STAGE 5: 体内 ─ エイリアンの生体内部
    // ══════════════════════════════════════════════════
    function drawBodyBack(){
      // 背景: 深紫・暗黒の生体膜
      const bg=ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#080012');
      bg.addColorStop(0.3,'#10001e');
      bg.addColorStop(0.6,'#18002a');
      bg.addColorStop(1,'#0c0018');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

      // 奥の生体壁（脈動するテクスチャ）
      const wallPulse=Math.sin(frame*0.025)*0.04;
      for(let layer=0;layer<3;layer++){
        const spd=0.04+layer*0.03;
        const ox=(-scrollX*spd%W+W)%W;
        const alpha=0.06+layer*0.03;
        // 有機的な細胞壁パターン
        for(let ci=0;ci<8;ci++){
          const cx=((ci*80+ox)%(W+100)+W)%(W+100)-50;
          const cy=H*0.2+layer*H*0.25;
          const cr=50+layer*15+Math.sin(frame*0.03+ci)*5;
          const cG=ctx.createRadialGradient(cx,cy,cr*0.3,cx,cy,cr);
          cG.addColorStop(0,`rgba(80,0,120,${alpha*0.5})`);
          cG.addColorStop(0.5,`rgba(120,0,180,${alpha})`);
          cG.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=cG; ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
        }
      }

      // 大血管（太い）
      const vesselOx=scrollX*0.06;
      for(let vi=0;vi<3;vi++){
        const vy=H*0.2+vi*H*0.3;
        const vPulse=Math.sin(frame*0.04+vi*1.5)*8;
        // 外壁
        ctx.strokeStyle=`rgba(${120+vi*20},0,${60+vi*20},0.4)`; ctx.lineWidth=18+vi*4+vPulse*0.3;
        ctx.beginPath();
        for(let vx=0;vx<W+20;vx+=8){
          const vy2=vy+Math.sin((vx+vesselOx+vi*100)*0.025)*30+vPulse;
          vx===0?ctx.moveTo(vx,vy2):ctx.lineTo(vx,vy2);
        }
        ctx.stroke();
        // 内腔（血液の流れ）
        ctx.strokeStyle=`rgba(${180+vi*20},0,${60+vi*20},0.6)`; ctx.lineWidth=8+vi*2;
        ctx.beginPath();
        for(let vx=0;vx<W+20;vx+=8){
          const vy2=vy+Math.sin((vx+vesselOx+vi*100)*0.025)*30+vPulse;
          vx===0?ctx.moveTo(vx,vy2):ctx.lineTo(vx,vy2);
        }
        ctx.stroke();
        // 光沢
        ctx.strokeStyle=`rgba(255,100,200,0.15)`; ctx.lineWidth=2;
        ctx.beginPath();
        for(let vx=0;vx<W+20;vx+=8){
          const vy2=vy+Math.sin((vx+vesselOx+vi*100)*0.025)*30+vPulse-4;
          vx===0?ctx.moveTo(vx,vy2):ctx.lineTo(vx,vy2);
        }
        ctx.stroke();
      }

      // 細い毛細血管網
      ctx.strokeStyle='rgba(150,0,80,0.2)'; ctx.lineWidth=1;
      const capOx=(-scrollX*0.15%W+W)%W;
      for(let ci=0;ci<10;ci++){
        ctx.beginPath();
        const cx=((ci*60+capOx)%(W+60)+W)%(W+60)-30;
        ctx.moveTo(cx,0);
        for(let step=0;step<8;step++){
          ctx.lineTo(cx+Math.sin(step*0.8+ci)*20,step*(H/7));
        }
        ctx.stroke();
      }

      // 細胞核（背景に浮かぶ）
      for(let ni=0;ni<6;ni++){
        const nx=((ni*90+(-scrollX*0.08)%(W*2)+W*2)%(W+200))-100;
        const ny=H*0.1+ni%3*H*0.35;
        const nr=15+ni%3*8;
        const nPulse=1+Math.sin(frame*0.05+ni)*0.08;
        const nG=ctx.createRadialGradient(nx-nr*0.3,ny-nr*0.3,1,nx,ny,nr*nPulse);
        nG.addColorStop(0,'rgba(200,100,255,0.3)');
        nG.addColorStop(0.5,'rgba(120,0,200,0.15)');
        nG.addColorStop(1,'rgba(60,0,100,0)');
        ctx.fillStyle=nG; ctx.beginPath(); ctx.arc(nx,ny,nr*nPulse,0,Math.PI*2); ctx.fill();
      }

      // 生体発光（ランダムな光の粒）
      const bioOx=(scrollX*0.2+frame*0.5)%W;
      for(let bi=0;bi<25;bi++){
        const bx=((bi*71+bioOx)%W+W)%W;
        const by=(bi*53+frame*0.2*(bi%3+1))%H;
        const bAlpha=0.3+Math.sin(frame*0.08+bi)*0.2;
        ctx.fillStyle=`rgba(${150+bi%100},0,${200+bi%55},${bAlpha})`;
        ctx.beginPath(); ctx.arc(bx,by,1.5,0,Math.PI*2); ctx.fill();
      }
    }

    // ══════════════════════════════════════════════════
    // STAGE 6: 宇宙 ─ 深宇宙・銀河の彼方
    // ══════════════════════════════════════════════════
    function drawCosmosBack(){
      // 背景: 深宇宙の漆黒
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,'#000004');
      sky.addColorStop(0.4,'#00000a');
      sky.addColorStop(0.7,'#000008');
      sky.addColorStop(1,'#000012');
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

      // 星雲（最遠景・ほぼ固定）
      const nebulaOx=(-scrollX*0.01%(W*3)+W*3)%(W*3);
      const nebulae=[
        {x:120,y:180,rx:200,ry:80,c1:'rgba(80,0,120,0.12)',c2:'rgba(40,0,80,0.06)'},
        {x:380,y:320,rx:160,ry:100,c1:'rgba(0,60,120,0.10)',c2:'rgba(0,30,80,0.05)'},
        {x:600,y:100,rx:180,ry:60,c1:'rgba(100,20,80,0.08)',c2:'rgba(60,0,60,0.04)'},
      ];
      for(const n of nebulae){
        const nx=((n.x-nebulaOx*0.3)%(W+400)+W+400)%(W+400)-200;
        const nG=ctx.createRadialGradient(nx,n.y,10,nx,n.y,n.rx);
        nG.addColorStop(0,n.c1); nG.addColorStop(0.5,n.c2); nG.addColorStop(1,'rgba(0,0,0,0)');
        ctx.save(); ctx.scale(1,n.ry/n.rx); ctx.translate(0,(n.y-n.y*(n.ry/n.rx)));
        ctx.fillStyle=nG; ctx.beginPath(); ctx.arc(nx,n.y,n.rx,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // 星（3層視差・密度重視）
      for(const s of stars){
        const tw=0.4+s.bright*0.6;
        // 明るい星はにじむ
        if(s.bright>0.8){
          ctx.fillStyle=`rgba(200,220,255,${tw*0.15})`;
          ctx.beginPath(); ctx.arc(Math.floor(s.x),Math.floor(s.y),3,0,Math.PI*2); ctx.fill();
        }
        ctx.fillStyle=`rgba(255,255,255,${tw})`;
        ctx.fillRect(Math.floor(s.x),Math.floor(s.y),s.size,s.size);
      }
      // 固定星（より明るい）
      const fixedStars=[
        {x:0.15,y:0.12,r:2.5,c:'rgba(200,220,255,0.9)'},{x:0.72,y:0.08,r:2,c:'rgba(255,240,200,0.9)'},
        {x:0.45,y:0.22,r:1.5,c:'rgba(180,200,255,0.8)'},{x:0.88,y:0.35,r:2,c:'rgba(255,220,180,0.9)'},
        {x:0.25,y:0.45,r:1.5,c:'rgba(220,200,255,0.8)'},{x:0.60,y:0.18,r:1,c:'rgba(255,255,255,0.9)'},
      ];
      for(const fs of fixedStars){
        const fsFlicker=0.7+Math.sin(frame*0.04+fs.x*10)*0.3;
        ctx.fillStyle=fs.c.replace(')',`,${fsFlicker})`).replace('rgba(','rgba(');
        ctx.shadowColor=fs.c; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.arc(fs.x*W,fs.y*H,fs.r,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
      }

      // 銀河帯（斜め）
      const milkyG=ctx.createLinearGradient(0,H*0.3,W,H*0.7);
      milkyG.addColorStop(0,'rgba(80,60,120,0)');
      milkyG.addColorStop(0.3,'rgba(100,80,160,0.06)');
      milkyG.addColorStop(0.5,'rgba(120,100,180,0.09)');
      milkyG.addColorStop(0.7,'rgba(100,80,160,0.06)');
      milkyG.addColorStop(1,'rgba(80,60,120,0)');
      ctx.fillStyle=milkyG; ctx.fillRect(0,0,W,H);

      // 中景の惑星・星系
      const planetData=[
        {x:0.20,y:0.35,r:28,c1:'#1a3366',c2:'#0a1a44',ring:true,ringC:'rgba(100,140,220,0.3)',spd:0.08},
        {x:0.70,y:0.60,r:20,c1:'#442200',c2:'#221100',ring:false,spd:0.12},
        {x:0.50,y:0.20,r:14,c1:'#002233',c2:'#001122',ring:true,ringC:'rgba(0,200,200,0.25)',spd:0.05},
      ];
      for(const pl of planetData){
        const pox=(-scrollX*pl.spd%(W*2)+W*2)%(W*2);
        const px=((pl.x*W-pox)%(W+200)+W+200)%(W+200)-100;
        const py=pl.y*H;
        // 惑星グロー
        const pgG=ctx.createRadialGradient(px,py,pl.r,px,py,pl.r*3);
        pgG.addColorStop(0,`rgba(${parseInt(pl.c1.slice(1,3),16)},${parseInt(pl.c1.slice(3,5),16)},${parseInt(pl.c1.slice(5,7),16)},0.12)`);
        pgG.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=pgG; ctx.beginPath(); ctx.arc(px,py,pl.r*3,0,Math.PI*2); ctx.fill();
        // リング（前）
        if(pl.ring){
          ctx.save(); ctx.translate(px,py); ctx.scale(1,0.3);
          ctx.strokeStyle=pl.ringC; ctx.lineWidth=6;
          ctx.beginPath(); ctx.arc(0,0,pl.r*1.8,Math.PI,Math.PI*2); ctx.stroke();
          ctx.restore();
        }
        // 惑星本体
        const pG=ctx.createRadialGradient(px-pl.r*0.3,py-pl.r*0.3,pl.r*0.1,px,py,pl.r);
        pG.addColorStop(0,pl.c1); pG.addColorStop(0.5,pl.c1); pG.addColorStop(0.8,pl.c2); pG.addColorStop(1,'#000000');
        ctx.fillStyle=pG; ctx.shadowColor=pl.c1; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.arc(px,py,pl.r,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 惑星の縞模様（大きい惑星）
        if(pl.r>22){
          ctx.save(); ctx.beginPath(); ctx.arc(px,py,pl.r,0,Math.PI*2); ctx.clip();
          ctx.fillStyle='rgba(0,0,0,0.2)';
          for(let li=0;li<5;li++){
            ctx.fillRect(px-pl.r,py-pl.r+li*(pl.r*0.4),pl.r*2,pl.r*0.15);
          }
          // 大赤斑
          ctx.fillStyle='rgba(100,30,0,0.4)';
          ctx.beginPath(); ctx.ellipse(px-5,py+5,8,5,0.3,0,Math.PI*2); ctx.fill();
          ctx.restore();
        }
        // リング（後）
        if(pl.ring){
          ctx.save(); ctx.translate(px,py); ctx.scale(1,0.3);
          ctx.strokeStyle=pl.ringC; ctx.lineWidth=6;
          ctx.beginPath(); ctx.arc(0,0,pl.r*1.8,0,Math.PI); ctx.stroke();
          ctx.restore();
        }
      }

      // 遠景の恒星（コロナ付き）
      const distStarOx=(-scrollX*0.04%(W*2)+W*2)%(W*2);
      for(let dsi=0;dsi<2;dsi++){
        const dsx=((dsi*300+distStarOx+100)%(W+300)+W+300)%(W+300)-150;
        const dsy=H*(0.3+dsi*0.4);
        const dsr=18+dsi*8;
        const dsFlicker=0.8+Math.sin(frame*0.03+dsi*2.1)*0.2;
        const dsG=ctx.createRadialGradient(dsx,dsy,2,dsx,dsy,dsr*3);
        dsG.addColorStop(0,'rgba(255,240,180,0.8)');
        dsG.addColorStop(0.2,'rgba(255,180,60,0.4)');
        dsG.addColorStop(0.5,'rgba(255,100,0,0.15)');
        dsG.addColorStop(1,'rgba(255,60,0,0)');
        ctx.fillStyle=dsG; ctx.shadowColor='#ffcc44'; ctx.shadowBlur=20*dsFlicker;
        ctx.beginPath(); ctx.arc(dsx,dsy,dsr*3,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 恒星コア
        const dscG=ctx.createRadialGradient(dsx-3,dsy-3,1,dsx,dsy,dsr);
        dscG.addColorStop(0,'#ffffff'); dscG.addColorStop(0.3,'#fffacc'); dscG.addColorStop(0.7,'#ffcc44'); dscG.addColorStop(1,'#ff6600');
        ctx.fillStyle=dscG; ctx.beginPath(); ctx.arc(dsx,dsy,dsr,0,Math.PI*2); ctx.fill();
      }
    }

    // ══════════════════════════════════════════════════
    // STAGE 7: 要塞 ─ 宇宙要塞の内部回廊
    // ══════════════════════════════════════════════════
    function drawFortressBack(){
      // 背景：極暗の金属空間
      const bg=ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#020204');
      bg.addColorStop(0.4,'#04040a');
      bg.addColorStop(0.7,'#060610');
      bg.addColorStop(1,'#020206');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

      // 遠景の宇宙（星）
      for(const s of stars){
        const tw=0.2+s.bright*0.4;
        ctx.fillStyle=`rgba(200,200,255,${tw*0.4})`;
        ctx.fillRect(Math.floor(s.x),Math.floor(s.y*0.5),s.size,s.size);
      }

      // 要塞外壁（遠景）
      const wallOx=(-scrollX*0.04%(W*3)+W*3)%(W*3);
      ctx.fillStyle='rgba(10,10,20,0.95)';
      // 要塞の巨大構造物シルエット（最遠景）
      const fortStructures=[
        {x:50,h:0.05,w:120},{x:180,h:0.12,w:80},{x:280,h:0.08,w:200},
        {x:500,h:0.06,w:100},{x:620,h:0.10,w:150},{x:750,h:0.04,w:180},
      ];
      for(const fs of fortStructures){
        const fx=((fs.x-wallOx)%(W+300)+W+300)%(W+300)-150;
        ctx.fillStyle='rgba(8,8,16,0.95)';
        ctx.fillRect(fx,fs.h*H,fs.w,H*(1-fs.h));
        // 窓の列（赤い警告灯）
        for(let wi=0;wi<Math.floor(fs.w/20);wi++){
          const wy=fs.h*H+10;
          const wFlash=Math.floor(frame*0.02+fs.x+wi*0.5)%3===0;
          ctx.fillStyle=wFlash?'rgba(255,50,50,0.7)':'rgba(60,20,20,0.5)';
          ctx.fillRect(fx+wi*20+5,wy,8,5);
        }
      }

      // グリッドライン（要塞の床/壁パターン）
      const gridSpX=60, gridSpY=60;
      const gOx=(-scrollX*0.2%gridSpX+gridSpX)%gridSpX;
      // 縦線
      ctx.strokeStyle='rgba(30,30,60,0.6)'; ctx.lineWidth=1;
      for(let gx=gOx-gridSpX;gx<W+gridSpX;gx+=gridSpX){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke();
      }
      // 横線
      for(let gy=0;gy<H;gy+=gridSpY){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
      }
      // 強調グリッド（太い）
      ctx.strokeStyle='rgba(40,40,80,0.5)'; ctx.lineWidth=2;
      for(let gx=gOx-gridSpX*3;gx<W+gridSpX*3;gx+=gridSpX*3){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke();
      }
      for(let gy=0;gy<H;gy+=gridSpY*3){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
      }

      // 中景の機械構造（配管・柱）
      const mechOx=(-scrollX*0.12%W+W)%W;
      for(let mi=0;mi<6;mi++){
        const mx=((mi*120+mechOx)%(W+120)+W+120)%(W+120)-60;
        // 縦パイプ
        const pG=ctx.createLinearGradient(mx-4,0,mx+4,0);
        pG.addColorStop(0,'#0a0a18'); pG.addColorStop(0.4,'#181830'); pG.addColorStop(1,'#0a0a18');
        ctx.fillStyle=pG; ctx.fillRect(mx-4,0,8,H);
        // パイプのリング（フランジ）
        for(let ri=0;ri<5;ri++){
          const ry=ri*(H/4);
          ctx.fillStyle='#141428'; ctx.fillRect(mx-7,ry-3,14,6);
          // 発光インジケーター
          const indFlash=(Math.floor(frame*0.04+mi+ri)%4===0);
          ctx.fillStyle=indFlash?'rgba(255,60,60,0.7)':'rgba(40,40,80,0.4)';
          ctx.fillRect(mx-2,ry-2,4,4);
        }
      }

      // レーザーバリア格子（定期的に出現）
      const barrierCycle=Math.floor(frame/80)%3;
      const barrierOx=(-scrollX*0.3%(W*2)+W*2)%(W*2);
      for(let bi=0;bi<4;bi++){
        if(bi%3!==barrierCycle) continue;
        const bx=((bi*180+barrierOx)%(W+180)+W+180)%(W+180)-90;
        const bAlpha=0.25+Math.sin(frame*0.08+bi)*0.1;
        ctx.fillStyle=`rgba(255,50,50,${bAlpha})`;
        ctx.fillRect(bx-1,0,2,H);
        ctx.shadowColor='#ff2200'; ctx.shadowBlur=8;
        for(let lpi=0;lpi<6;lpi++){
          ctx.fillStyle=`rgba(255,80,80,${bAlpha*0.8})`;
          ctx.fillRect(bx-0.5,lpi*(H/5),1,H/5-2);
        }
        ctx.shadowBlur=0;
      }

      // 電気アーク（壁から放電）
      if(frame%40<8){
        const arcOx=(-scrollX*0.2%W+W)%W;
        for(let ai=0;ai<3;ai++){
          const ax=((ai*200+arcOx+100)%W+W)%W;
          ctx.strokeStyle=`rgba(150,180,255,${0.3+Math.random()*0.4})`; ctx.lineWidth=1;
          ctx.beginPath();
          let ay=0;
          ctx.moveTo(ax,ay);
          while(ay<H){
            ay+=20+Math.random()*20;
            ctx.lineTo(ax+(Math.random()-0.5)*15,ay);
          }
          ctx.stroke();
        }
      }

      // 警告表示（DANGER）
      const dangerAlpha=Math.abs(Math.sin(frame*0.04))*0.35;
      ctx.fillStyle=`rgba(255,0,0,${dangerAlpha})`;
      ctx.font='bold 11px Courier New'; ctx.textAlign='center';
      for(let di=0;di<4;di++){
        const dx=((di*140+(-scrollX*0.4)%(W*2)+W*2)%(W+140)+W+140)%(W+140)-70;
        ctx.fillText('! WARNING !',dx,H*0.38);
        ctx.fillText('! WARNING !',dx,H*0.62);
      }
      ctx.textAlign='left';

      // 床の金属光沢
      const floorG=ctx.createLinearGradient(0,H*0.8,0,H);
      floorG.addColorStop(0,'rgba(20,20,40,0)');
      floorG.addColorStop(0.5,'rgba(30,30,60,0.3)');
      floorG.addColorStop(1,'rgba(20,20,40,0.6)');
      ctx.fillStyle=floorG; ctx.fillRect(0,H*0.8,W,H*0.2);
      const ceilingG=ctx.createLinearGradient(0,0,0,H*0.2);
      ceilingG.addColorStop(0,'rgba(20,20,40,0.6)');
      ceilingG.addColorStop(1,'rgba(20,20,40,0)');
      ctx.fillStyle=ceilingG; ctx.fillRect(0,0,W,H*0.2);
    }

    function drawTerrain(){
      const st=STAGES[stage-1];

      // ── 上地形 ──────────────────────────────────────
      // 地形グラデーション（奥行きのある岩盤）
      const topG=ctx.createLinearGradient(0,0,0,40);
      switch(stage){
        case 1: topG.addColorStop(0,'#3a3028'); topG.addColorStop(0.4,'#4a3e32'); topG.addColorStop(1,'#282018'); break;
        case 2: topG.addColorStop(0,'#1a2a1a'); topG.addColorStop(0.4,'#2a3a2a'); topG.addColorStop(1,'#0a1a0a'); break;
        case 3: topG.addColorStop(0,'#3d2800'); topG.addColorStop(0.4,'#5c3a00'); topG.addColorStop(1,'#2a1800'); break;
        case 4: topG.addColorStop(0,'#10141e'); topG.addColorStop(0.4,'#1a2030'); topG.addColorStop(1,'#080c14'); break;
        case 5: topG.addColorStop(0,'#280040'); topG.addColorStop(0.4,'#3d0060'); topG.addColorStop(1,'#180028'); break;
        case 6: topG.addColorStop(0,'#000818'); topG.addColorStop(0.4,'#001020'); topG.addColorStop(1,'#000408'); break;
        case 7: topG.addColorStop(0,'#0a0a1e'); topG.addColorStop(0.4,'#141428'); topG.addColorStop(1,'#060610'); break;
      }
      ctx.fillStyle=topG;
      ctx.beginPath(); ctx.moveTo(0,0);
      for(let x=0;x<W;x+=4){ ctx.lineTo(x,getTopH(x,scrollX)); }
      ctx.lineTo(W,0); ctx.closePath(); ctx.fill();

      // 地形エッジの発光ライン
      ctx.shadowColor=st.accentColor; ctx.shadowBlur=6;
      ctx.strokeStyle=st.accentColor; ctx.lineWidth=2;
      ctx.beginPath();
      for(let x=0;x<W;x+=4){
        const h=getTopH(x,scrollX);
        x===0?ctx.moveTo(x,h):ctx.lineTo(x,h);
      }
      ctx.stroke();
      ctx.shadowBlur=0;
      // 内側のやや暗いライン
      ctx.strokeStyle=`${st.accentColor}66`; ctx.lineWidth=1;
      ctx.beginPath();
      for(let x=0;x<W;x+=4){
        const h=getTopH(x,scrollX)+4;
        x===0?ctx.moveTo(x,h):ctx.lineTo(x,h);
      }
      ctx.stroke();

      // ── 下地形 ──────────────────────────────────────
      const botG=ctx.createLinearGradient(0,H-40,0,H);
      switch(stage){
        case 1: botG.addColorStop(0,'#282018'); botG.addColorStop(0.6,'#4a3e32'); botG.addColorStop(1,'#3a3028'); break;
        case 2: botG.addColorStop(0,'#0a1a0a'); botG.addColorStop(0.6,'#2a3a2a'); botG.addColorStop(1,'#1a2a1a'); break;
        case 3: botG.addColorStop(0,'#2a1800'); botG.addColorStop(0.6,'#5c3a00'); botG.addColorStop(1,'#3d2800'); break;
        case 4: botG.addColorStop(0,'#080c14'); botG.addColorStop(0.6,'#1a2030'); botG.addColorStop(1,'#10141e'); break;
        case 5: botG.addColorStop(0,'#180028'); botG.addColorStop(0.6,'#3d0060'); botG.addColorStop(1,'#280040'); break;
        case 6: botG.addColorStop(0,'#000408'); botG.addColorStop(0.6,'#001020'); botG.addColorStop(1,'#000818'); break;
        case 7: botG.addColorStop(0,'#060610'); botG.addColorStop(0.6,'#141428'); botG.addColorStop(1,'#0a0a1e'); break;
      }
      ctx.fillStyle=botG;
      ctx.beginPath(); ctx.moveTo(0,H);
      for(let x=0;x<W;x+=4){ ctx.lineTo(x,H-getBotH(x,scrollX)); }
      ctx.lineTo(W,H); ctx.closePath(); ctx.fill();

      ctx.shadowColor=st.accentColor; ctx.shadowBlur=6;
      ctx.strokeStyle=st.accentColor; ctx.lineWidth=2;
      ctx.beginPath();
      for(let x=0;x<W;x+=4){
        const h=getBotH(x,scrollX);
        x===0?ctx.moveTo(x,H-h):ctx.lineTo(x,H-h);
      }
      ctx.stroke();
      ctx.shadowBlur=0;
      ctx.strokeStyle=`${st.accentColor}66`; ctx.lineWidth=1;
      ctx.beginPath();
      for(let x=0;x<W;x+=4){
        const h=getBotH(x,scrollX);
        x===0?ctx.moveTo(x,H-h-4):ctx.lineTo(x,H-h-4);
      }
      ctx.stroke();

      // ── ステージ別地形装飾 ──────────────────────────
      if(stage===1){
        // 岩肌の凹凸ハイライト（地形エッジに岩の光沢）
        ctx.strokeStyle='rgba(90,76,58,0.7)'; ctx.lineWidth=1.5;
        ctx.beginPath();
        for(let x=0;x<W;x+=3){
          const h=getTopH(x,scrollX);
          x===0?ctx.moveTo(x,h):ctx.lineTo(x,h);
        }
        ctx.stroke();
        ctx.strokeStyle='rgba(90,76,58,0.7)'; ctx.lineWidth=1.5;
        ctx.beginPath();
        for(let x=0;x<W;x+=3){
          const h=H-getBotH(x,scrollX);
          x===0?ctx.moveTo(x,h):ctx.lineTo(x,h);
        }
        ctx.stroke();

        // 鍾乳石・鍾乳柱（岩峰）: 地形の突起
        const spkOx=(-scrollX*1.0%(W*2)+W*2)%(W*2);
        for(let i=0;i<20;i++){
          const rx=((i*55+spkOx)%(W+100)+W)%(W+100)-50;
          // 上から下に向かう岩のとがった突起
          const ry=getTopH(rx,scrollX);
          const rh=5+Math.abs(Math.sin(i*2.1+0.5))*12;
          const rw=3+Math.abs(Math.sin(i*1.3))*4;
          // 岩突起
          ctx.fillStyle='#302820';
          ctx.beginPath(); ctx.moveTo(rx-rw,ry+1); ctx.lineTo(rx,ry+rh); ctx.lineTo(rx+rw,ry+1); ctx.closePath(); ctx.fill();
          // ハイライト
          ctx.fillStyle='rgba(80,65,50,0.6)';
          ctx.beginPath(); ctx.moveTo(rx-1,ry+1); ctx.lineTo(rx,ry+rh); ctx.lineTo(rx+2,ry+1); ctx.closePath(); ctx.fill();
          // 下から上に向かう岩突起
          const bry=H-getBotH(rx,scrollX);
          const brh=5+Math.abs(Math.sin(i*2.1+1.0))*12;
          const brw=3+Math.abs(Math.sin(i*1.3+0.8))*4;
          ctx.fillStyle='#302820';
          ctx.beginPath(); ctx.moveTo(rx-brw,bry-1); ctx.lineTo(rx,bry-brh); ctx.lineTo(rx+brw,bry-1); ctx.closePath(); ctx.fill();
          ctx.fillStyle='rgba(80,65,50,0.6)';
          ctx.beginPath(); ctx.moveTo(rx-1,bry-1); ctx.lineTo(rx,bry-brh); ctx.lineTo(rx+2,bry-1); ctx.closePath(); ctx.fill();
        }

        // ── 木（火山地帯の焦げた枯れ木）──
        // 上地形の縁から下向き、下地形の縁から上向き
        const treeOx=(-scrollX%(W*3)+W*3)%(W*3);
        // 木の配置データ（位置・高さ・幹の太さを固定seed）
        const treeDefs=[
          {ox:30, h:28,tw:2.5},{ox:95, h:22,tw:2},{ox:160,h:34,tw:3},
          {ox:240,h:26,tw:2},{ox:310,h:38,tw:3.5},{ox:375,h:24,tw:2},
          {ox:450,h:32,tw:3},{ox:520,h:20,tw:2},{ox:590,h:30,tw:2.5},
          {ox:660,h:36,tw:3},{ox:730,h:22,tw:2},{ox:800,h:28,tw:2.5},
        ];

        function drawTree(tx, ty, treeH, trunkW, flipY){
          const sy = flipY ? -1 : 1;
          // 幹
          ctx.strokeStyle='#1a1008'; ctx.lineWidth=trunkW;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + sy*treeH*0.6); ctx.stroke();
          // ハイライト（幹の側面）
          ctx.strokeStyle='rgba(50,35,15,0.7)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(tx+trunkW*0.4, ty); ctx.lineTo(tx+trunkW*0.4, ty+sy*treeH*0.55); ctx.stroke();

          // 枝（3〜4本、左右に広がる）
          const branchDefs=[
            {t:0.35, angle: 0.55, len:0.45},
            {t:0.35, angle:-0.55, len:0.40},
            {t:0.60, angle: 0.65, len:0.35},
            {t:0.60, angle:-0.60, len:0.30},
            {t:0.80, angle: 0.40, len:0.28},
            {t:0.80, angle:-0.45, len:0.25},
          ];
          for(const b of branchDefs){
            const bx=tx; const by=ty+sy*treeH*0.6*b.t;
            const bAngle=(flipY ? Math.PI : 0) - Math.PI/2 + b.angle*sy;
            const bLen=treeH*b.len;
            const ex=bx+Math.cos(bAngle)*bLen;
            const ey=by+Math.sin(bAngle)*bLen;
            ctx.strokeStyle='#1a1008'; ctx.lineWidth=Math.max(1,trunkW*0.45);
            ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(ex,ey); ctx.stroke();
            // 小枝（先端から2本）
            const sbLen=bLen*0.4;
            for(const da of [-0.4, 0.4]){
              const sa=bAngle+da;
              ctx.strokeStyle='#1a1008'; ctx.lineWidth=1;
              ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ex+Math.cos(sa)*sbLen, ey+Math.sin(sa)*sbLen); ctx.stroke();
            }
          }
          // 火山の熱で木の根元が赤く光る
          const rg=ctx.createRadialGradient(tx,ty,0,tx,ty,8);
          rg.addColorStop(0,'rgba(255,80,0,0.18)');
          rg.addColorStop(1,'rgba(255,40,0,0)');
          ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(tx,ty,8,0,Math.PI*2); ctx.fill();
        }

        for(const td of treeDefs){
          // 上地形（根が地形縁、幹は下向き）
          const tx=((td.ox+treeOx)%(W+900)+W+900)%(W+900)-450;
          if(tx>-40 && tx<W+40){
            const topY=getTopH(tx,scrollX);
            drawTree(tx, topY, td.h, td.tw, false);
          }
          // 下地形（根が地形縁、幹は上向き） — 少しずらして配置
          const tx2=((td.ox+130+treeOx)%(W+900)+W+900)%(W+900)-450;
          if(tx2>-40 && tx2<W+40){
            const botY=H-getBotH(tx2,scrollX);
            drawTree(tx2, botY, td.h*0.85, td.tw, true);
          }
        }

        // 火口からの噴火の光（地形エッジが赤く光る箇所）
        const glowOx=(-scrollX*0.4%(W*2)+W*2)%(W*2);
        for(let i=0;i<5;i++){
          const gx=((i*130+glowOx)%(W+160)+W)%(W+160)-80;
          const gph=Math.abs(Math.sin(frame*0.025+i*0.8));
          if(gph>0.4){
            // 上地形の光
            const gyTop=getTopH(gx,scrollX)+2;
            const gg1=ctx.createRadialGradient(gx,gyTop,0,gx,gyTop,22);
            gg1.addColorStop(0,`rgba(255,140,0,${gph*0.5})`);
            gg1.addColorStop(1,'rgba(255,60,0,0)');
            ctx.fillStyle=gg1; ctx.beginPath(); ctx.arc(gx,gyTop,22,0,Math.PI*2); ctx.fill();
            // 下地形の光
            const gyBot=H-getBotH(gx,scrollX)-2;
            const gg2=ctx.createRadialGradient(gx,gyBot,0,gx,gyBot,22);
            gg2.addColorStop(0,`rgba(255,140,0,${gph*0.5})`);
            gg2.addColorStop(1,'rgba(255,60,0,0)');
            ctx.fillStyle=gg2; ctx.beginPath(); ctx.arc(gx,gyBot,22,0,Math.PI*2); ctx.fill();
          }
        }
      }

      if(stage===2){
        // 海中の珊瑚・岩（地形縁装飾）
        const coralOx=(-scrollX*1.0%(W*2)+W*2)%(W*2);
        for(let i=0;i<14;i++){
          const cx=((i*72+coralOx)%(W+80)+W)%(W+80)-40;
          const botY=H-getBotH(cx,scrollX);
          const h=10+Math.sin(i*2.3)*8;
          // 海藻
          ctx.strokeStyle=`rgba(0,${100+i%4*30},${60+i%3*20},0.7)`; ctx.lineWidth=2;
          for(let s=0;s<3;s++){
            ctx.beginPath(); ctx.moveTo(cx+s*4-4,botY);
            ctx.bezierCurveTo(cx+s*4-4+Math.sin(frame*0.03+s+i)*6,botY-h*0.5,cx+s*4-4+Math.sin(frame*0.03+s+i+1)*6,botY-h*0.8,cx+s*4-4+Math.sin(frame*0.04+s+i)*4,botY-h);
            ctx.stroke();
          }
          // 珊瑚
          ctx.fillStyle=`rgba(${180+i%3*20},${60+i%4*10},${80+i%2*20},0.6)`;
          ctx.beginPath(); ctx.arc(cx,botY-2,3+i%3,0,Math.PI*2); ctx.fill();
        }
        // 上地形の苔
        ctx.fillStyle='rgba(0,80,40,0.4)';
        for(let i=0;i<10;i++){
          const mx=((i*90+coralOx)%(W+80)+W)%(W+80)-40;
          const my=getTopH(mx,scrollX);
          ctx.beginPath(); ctx.ellipse(mx,my+3,8+i%4*3,4,0,0,Math.PI*2); ctx.fill();
        }
        // 海面の光の揺らめき
        ctx.shadowColor='rgba(80,180,255,0.3)'; ctx.shadowBlur=8;
        ctx.strokeStyle='rgba(100,200,255,0.2)'; ctx.lineWidth=3;
        for(let i=0;i<3;i++){
          const lx=((i*150+(-scrollX*0.5)%(W*2)+frame*0.8)%(W+100)+W)%(W+100)-50;
          const ly=getTopH(lx,scrollX)+2;
          ctx.beginPath(); ctx.moveTo(lx-20,ly); ctx.lineTo(lx+20,ly); ctx.stroke();
        }
        ctx.shadowBlur=0;
      }

      if(stage===3){
        // 石柱・方形ブロック（地形縁）
        ctx.fillStyle='#2a1a00';
        const blockOx=(-scrollX*1.0%(W*2)+W*2)%(W*2);
        for(let i=0;i<12;i++){
          const bx=((i*80+blockOx)%(W+80)+W)%(W+80)-40;
          const ty=getTopH(bx,scrollX);
          const by=H-getBotH(bx,scrollX);
          const bw=12+i%3*4; const bh=14+i%4*5;
          // 石柱（上から下がる）
          ctx.fillStyle='#2a1a00'; ctx.fillRect(bx-bw/2,ty,bw,bh);
          ctx.fillStyle='rgba(180,130,30,0.15)'; ctx.fillRect(bx-bw/2,ty,bw,3);
          // 石柱（下から上がる）
          ctx.fillStyle='#2a1a00'; ctx.fillRect(bx-bw/2,by-bh,bw,bh);
          ctx.fillStyle='rgba(180,130,30,0.15)'; ctx.fillRect(bx-bw/2,by-3,bw,3);
        }
        // 砂のサラサラ流れ
        ctx.fillStyle='rgba(180,140,60,0.25)';
        for(let i=0;i<20;i++){
          const sx=((i*47+(-scrollX*1.5)%(W*3)+frame*1.0)%(W+10)+W)%(W+10)-5;
          const sy=getTopH(sx,scrollX)+3+i%4;
          ctx.beginPath(); ctx.arc(sx,sy,1,0,Math.PI*2); ctx.fill();
        }
        // ヒエログリフ（地形表面）
        ctx.fillStyle='rgba(255,200,80,0.18)';
        for(let i=0;i<8;i++){
          const hx=((i*110+blockOx*0.5)%(W+80)+W)%(W+80)-40;
          const hy=getTopH(hx,scrollX)+18;
          const bhy=H-getBotH(hx,scrollX)-18;
          ctx.fillRect(hx-3,hy,6,8); ctx.fillRect(hx-3,bhy-8,6,8);
          ctx.beginPath(); ctx.arc(hx,hy-4,4,0,Math.PI); ctx.fill();
        }
      }

      if(stage===4){
        // エネルギー管・パイプ（地形縁）
        const pipeOx=(-scrollX*1.0%(W*2)+W*2)%(W*2);
        for(let i=0;i<8;i++){
          const px3=((i*95+pipeOx)%(W+80)+W)%(W+80)-40;
          const ty=getTopH(px3,scrollX);
          const by=H-getBotH(px3,scrollX);
          const pulse=Math.sin(frame*0.08+i)*0.5+0.5;
          // 上パイプ
          ctx.fillStyle='#1a2040'; ctx.fillRect(px3-6,ty,12,20);
          ctx.fillStyle=`rgba(60,120,255,${0.4+pulse*0.4})`; ctx.shadowColor='#4488ff'; ctx.shadowBlur=6;
          ctx.fillRect(px3-2,ty+2,4,16);
          ctx.shadowBlur=0;
          // 下パイプ
          ctx.fillStyle='#1a2040'; ctx.fillRect(px3-6,by-20,12,20);
          ctx.fillStyle=`rgba(60,120,255,${0.4+pulse*0.4})`; ctx.shadowColor='#4488ff'; ctx.shadowBlur=6;
          ctx.fillRect(px3-2,by-18,4,16);
          ctx.shadowBlur=0;
        }
        // 走るエネルギーライン（地形縁）
        const eOx=(scrollX*0.5+frame*3)%W;
        ctx.shadowColor='#4488ff'; ctx.shadowBlur=4;
        ctx.strokeStyle='rgba(100,180,255,0.5)'; ctx.lineWidth=2;
        ctx.beginPath();
        for(let x=0;x<W;x+=4){
          const h=getTopH(x,scrollX)+2;
          x===0?ctx.moveTo(x,h):ctx.lineTo(x,h);
        }
        ctx.stroke();
        ctx.beginPath();
        for(let x=0;x<W;x+=4){
          const h=H-getBotH(x,scrollX)-2;
          x===0?ctx.moveTo(x,h):ctx.lineTo(x,h);
        }
        ctx.stroke();
        // エネルギーノード（走る光点）
        for(let i=0;i<4;i++){
          const nx=((i*120+eOx)%(W+20)+W)%(W+20)-10;
          const ny=getTopH(nx,scrollX)+2;
          const nby=H-getBotH(nx,scrollX)-2;
          ctx.fillStyle='rgba(150,220,255,0.9)';
          ctx.beginPath(); ctx.arc(nx,ny,3,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(nx,nby,3,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
      }

      if(stage===5){
        // 生体膜（脈動する地形縁）
        const pulse5=Math.sin(frame*0.04)*5;
        const memG=ctx.createLinearGradient(0,0,0,14);
        memG.addColorStop(0,'rgba(220,0,255,0.7)'); memG.addColorStop(1,'rgba(120,0,200,0)');
        ctx.fillStyle=memG; ctx.shadowColor='#cc00ff'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(0,0);
        for(let x=0;x<W;x+=4){
          const pv=Math.sin((x+scrollX)*0.05+frame*0.05)*pulse5;
          ctx.lineTo(x,getTopH(x,scrollX)+pv+8);
        }
        ctx.lineTo(W,0); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // 絨毛（上地形から生える）
        ctx.strokeStyle='rgba(200,0,255,0.45)'; ctx.lineWidth=1.5;
        const villiOx=(-scrollX*1.0%(W*2)+W*2)%(W*2);
        for(let i=0;i<24;i++){
          const vx=((i*40+villiOx)%(W+40)+W)%(W+40)-20;
          const vy=getTopH(vx,scrollX);
          const vh=6+Math.sin(i*1.3)*4;
          const vsway=Math.sin(frame*0.06+i)*3;
          ctx.beginPath(); ctx.moveTo(vx,vy); ctx.quadraticCurveTo(vx+vsway,vy+vh*0.5,vx+vsway,vy+vh); ctx.stroke();
          // 下
          const bvy=H-getBotH(vx,scrollX);
          ctx.beginPath(); ctx.moveTo(vx,bvy); ctx.quadraticCurveTo(vx+vsway,bvy-vh*0.5,vx+vsway,bvy-vh); ctx.stroke();
        }
        // 生体発光粒子（地形から放出）
        ctx.shadowColor='#aa00ff'; ctx.shadowBlur=6;
        for(let i=0;i<10;i++){
          const px2=((i*97+(frame*1.5))%W+W)%W;
          const py=getTopH(px2,scrollX)+Math.sin(frame*0.05+i)*3;
          const bpy=H-getBotH(px2,scrollX)-Math.sin(frame*0.05+i)*3;
          const a=0.4+Math.sin(frame*0.1+i)*0.3;
          ctx.fillStyle=`rgba(200,0,255,${a})`;
          ctx.beginPath(); ctx.arc(px2,py,2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px2,bpy,2,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
      }

      if(stage===7){
        // 金属壁・ボルト・装甲プレート（地形縁）
        const fortOx=(-scrollX*1.0%(W*2)+W*2)%(W*2);
        // 上地形装甲プレート
        ctx.fillStyle='#0e0e1e';
        for(let i=0;i<14;i++){
          const fx=((i*70+fortOx)%(W+70)+W+70)%(W+70)-35;
          const fy=getTopH(fx,scrollX);
          ctx.fillRect(fx-16,fy,32,12);
          // ボルト（四隅）
          ctx.fillStyle='#2a2a44';
          ctx.beginPath(); ctx.arc(fx-12,fy+3,2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(fx+12,fy+3,2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#3a3a5a';
          ctx.beginPath(); ctx.arc(fx-12,fy+9,2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(fx+12,fy+9,2,0,Math.PI*2); ctx.fill();
          // 警告ストライプ
          ctx.fillStyle='rgba(255,200,0,0.25)';
          for(let si=0;si<4;si++){
            if(si%2===0) ctx.fillRect(fx-16+si*8,fy,8,12);
          }
          ctx.fillStyle='#0e0e1e';
        }
        // 下地形装甲プレート
        for(let i=0;i<14;i++){
          const fx=((i*70+fortOx+35)%(W+70)+W+70)%(W+70)-35;
          const fy=H-getBotH(fx,scrollX)-12;
          ctx.fillStyle='#0e0e1e'; ctx.fillRect(fx-16,fy,32,12);
          ctx.fillStyle='#2a2a44';
          ctx.beginPath(); ctx.arc(fx-12,fy+3,2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(fx+12,fy+3,2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#3a3a5a';
          ctx.beginPath(); ctx.arc(fx-12,fy+9,2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(fx+12,fy+9,2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,200,0,0.25)';
          for(let si=0;si<4;si++){
            if(si%2===0) ctx.fillRect(fx-16+si*8,fy,8,12);
          }
        }
        // 地形縁の赤ラインとエネルギー走査
        const eOx2=(scrollX*0.5+frame*2)%W;
        ctx.shadowColor='#ff2222'; ctx.shadowBlur=6;
        ctx.strokeStyle='rgba(255,50,50,0.6)'; ctx.lineWidth=2;
        ctx.beginPath();
        for(let x=0;x<W;x+=4){ const h=getTopH(x,scrollX)+2; x===0?ctx.moveTo(x,h):ctx.lineTo(x,h); }
        ctx.stroke();
        ctx.beginPath();
        for(let x=0;x<W;x+=4){ const h=H-getBotH(x,scrollX)-2; x===0?ctx.moveTo(x,h):ctx.lineTo(x,h); }
        ctx.stroke();
        // 走るエネルギーノード
        for(let i=0;i<5;i++){
          const nx=((i*100+eOx2)%(W+20)+W)%(W+20)-10;
          ctx.fillStyle='rgba(255,80,80,0.9)';
          ctx.beginPath(); ctx.arc(nx,getTopH(nx,scrollX)+2,3,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(nx,H-getBotH(nx,scrollX)-2,3,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0;
      }

      if(stage===6){
        // 宇宙ステーション構造物（地形縁）
        const structOx=(-scrollX*1.0%(W*2)+W*2)%(W*2);
        for(let i=0;i<8;i++){
          const sx=((i*100+structOx)%(W+80)+W)%(W+80)-40;
          const ty=getTopH(sx,scrollX);
          const by=H-getBotH(sx,scrollX);
          // アンテナ
          ctx.strokeStyle='#223355'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(sx,ty); ctx.lineTo(sx,ty+20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx-8,ty+8); ctx.lineTo(sx+8,ty+8); ctx.stroke();
          // 先端の発光
          const beaconP=Math.sin(frame*0.05+i*0.8)*0.5+0.5;
          ctx.fillStyle=`rgba(80,180,255,${beaconP*0.8})`; ctx.shadowColor='#4488ff'; ctx.shadowBlur=6*beaconP;
          ctx.beginPath(); ctx.arc(sx,ty+2,2.5,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          // 下
          ctx.strokeStyle='#223355'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(sx,by); ctx.lineTo(sx,by-20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx-8,by-8); ctx.lineTo(sx+8,by-8); ctx.stroke();
          ctx.fillStyle=`rgba(80,180,255,${beaconP*0.8})`; ctx.shadowColor='#4488ff'; ctx.shadowBlur=6*beaconP;
          ctx.beginPath(); ctx.arc(sx,by-2,2.5,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
        }
        // 宇宙塵（地形に沿って流れる）
        const dustOx2=(scrollX*0.3+frame*0.8)%W;
        ctx.fillStyle='rgba(100,150,255,0.3)';
        for(let i=0;i<16;i++){
          const dx=((i*63+dustOx2)%W+W)%W;
          const dy=getTopH(dx,scrollX)+Math.random()*0;
          const bdy=H-getBotH(dx,scrollX);
          ctx.fillRect(dx,dy+4,2+i%3,1);
          ctx.fillRect(dx,bdy-4,2+i%3,1);
        }
      }
    }

    // ─────────────────────────────────────────────────
    // DRAW POWER BAR
    // ─────────────────────────────────────────────────
    function drawPowerBar(){
      const BAR_Y=H-50, slotW=73, slotH=22, gap=2, barX=10;
      ctx.fillStyle='rgba(0,0,0,0.82)';
      ctx.fillRect(barX-4,BAR_Y-4,slotW*6+gap*5+8,slotH+8);
      ctx.strokeStyle='#333'; ctx.lineWidth=1;
      ctx.strokeRect(barX-4,BAR_Y-4,slotW*6+gap*5+8,slotH+8);

      for(let i=0;i<6;i++){
        const sx=barX+i*(slotW+gap);
        const sel=(puCursor===i);
        const grayed=(i===4 && optionCount>=5)||(i===3 && laserLv>=4)||(i===2 && missUpLv>=3);
        ctx.fillStyle=grayed?'#111':(sel?PU_COLORS[i]+'55':'#0a0a0a');
        ctx.fillRect(sx,BAR_Y,slotW,slotH);
        if(!grayed && sel && Math.floor(frame/6)%2===0){ ctx.fillStyle=PU_COLORS[i]+'88'; ctx.fillRect(sx,BAR_Y,slotW,slotH); }
        ctx.strokeStyle=grayed?'#222':(sel?PU_COLORS[i]:'#2a2a2a');
        ctx.lineWidth=sel&&!grayed?2:1; ctx.strokeRect(sx,BAR_Y,slotW,slotH);
        ctx.fillStyle=grayed?'#333':(sel?PU_COLORS[i]:'#444');
        ctx.font='bold 9px Courier New'; ctx.textAlign='center';
        ctx.fillText(PU_NAMES[i],sx+slotW/2,BAR_Y+14);
        ctx.font='8px Courier New';
        if(i===0&&speedLevel>1){ctx.fillStyle='#00ffff';ctx.fillText('Lv'+speedLevel,sx+slotW/2,BAR_Y+slotH-2);}
        if(i===1&&missDownLv>0){ctx.fillStyle=PU_COLORS[1];ctx.fillText('Lv'+missDownLv,sx+slotW/2,BAR_Y+slotH-2);}
        if(i===2&&missUpLv>0){ctx.fillStyle=PU_COLORS[2];ctx.fillText('Lv'+missUpLv,sx+slotW/2,BAR_Y+slotH-2);}
        if(i===3&&laserLv>0){
          ctx.fillStyle=waveCooldown>0?'#888':PU_COLORS[3];
          ctx.fillText(laserLv>=4?'Lv4 ◆':'Lv'+laserLv,sx+slotW/2,BAR_Y+slotH-2);
          // Lv3: チャージゲージ
          if(laserLv>=4&&(waveCharging||waveCharge>0)){
            ctx.fillStyle='rgba(100,200,255,0.7)';
            ctx.fillRect(sx+2,BAR_Y+slotH-5,Math.floor((slotW-4)*(waveCharge/60)),3);
          }
          if(laserLv>=4&&waveCooldown>0){
            ctx.fillStyle='rgba(80,80,120,0.7)';
            ctx.fillRect(sx+2,BAR_Y+slotH-5,Math.floor((slotW-4)*(waveCooldown/45)),3);
          }
        }
        if(i===4&&optionCount>0){
          ctx.fillStyle=grayed?'#555':PU_COLORS[4];
          ctx.fillText(optionCount>=5?'ORBIT×4':('×'+optionCount),sx+slotW/2,BAR_Y+slotH-2);
        }
        if(i===5&&barrierHp>0){ctx.fillStyle=PU_COLORS[5];ctx.fillText(barrierHp+'/15',sx+slotW/2,BAR_Y+slotH-2);}
        if(grayed){
          ctx.strokeStyle='rgba(80,80,80,0.4)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(sx,BAR_Y); ctx.lineTo(sx+slotW,BAR_Y+slotH); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx+slotW,BAR_Y); ctx.lineTo(sx,BAR_Y+slotH); ctx.stroke();
        }
      }
      ctx.textAlign='left';
      if(puCursor>=0){
        ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(6,BAR_Y-17,468,14);
        ctx.fillStyle='#ffff44'; ctx.font='9px Courier New'; ctx.textAlign='center';
        ctx.fillText('▼ バーをタップ or [X]キーで '+PU_NAMES[puCursor]+' 発動！',W/2,BAR_Y-6);
        ctx.textAlign='left';
      }
    }

    // ─────────────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────────────
    function update(){
      frame++; stageFrame++;
      // ステージ1ボス出現中はスクロール停止
      if(!bossAlive) scrollX += 1.5;



      // 星スクロール
      for(const s of stars){
        const spdMul=(stage===6||stage===7)?1.0:(stage===2)?0.3:0.15;
        s.x-=s.spd*spdMul;
        if(s.x<0){ s.x=W; s.y=Math.random()*H; }
      }

      if(gameState==='stageclear'){
        stageClearTimer--;
        if(stageClearTimer<=0){
          if(stage>=7){ gameState='gameclear'; stopBGM(); return; }
          stage++; stageFrame=0; bossSpawned=false; bossAlive=false;
          enemies=[]; enemyBullets=[];
          gameState='playing'; fadeBGM(stage);
        }
        return;
      }
      if(gameState!=='playing') return;

      // Player move
      const sp=playerSpeed();
      if(keys.up)    player.y=Math.max(getTopH(player.x,scrollX)+14, player.y-sp);
      if(keys.down)  player.y=Math.min(H-getBotH(player.x,scrollX)-14, player.y+sp);
      if(keys.left)  player.x=Math.max(20,player.x-sp);
      if(keys.right) player.x=Math.min(W*0.65,player.x+sp);

      // Options
      const orbitR=62, orbitSpd=0.045;
      for(let i=0;i<options.length;i++){
        const op=options[i];
        if(op.orbit){
          // Lv5: 4個が等間隔で周回 (位相オフセットを維持)
          op.angle+=orbitSpd;
          const phase=op.angle; // 各オプションの角度は追加時に設定済み
          op.x=player.x+Math.cos(phase)*orbitR;
          op.y=player.y+Math.sin(phase)*orbitR;
        } else {
          // Lv1〜4: 前の機体/オプションに後追い
          const anchor=i===0?player:options[i-1];
          const dist=36;
          const dx=anchor.x-op.x, dy=anchor.y-op.y;
          const d=Math.sqrt(dx*dx+dy*dy)||1;
          if(d>dist){ op.x+=(dx/d)*(d-dist)*0.3; op.y+=(dy/d)*(d-dist)*0.3; }
          op.x+=(anchor.x-op.x)*0.12;
          op.y+=(anchor.y-dist-op.y)*0.12;
        }
      }

      // Shoot
      if(shotCooldown>0) shotCooldown--;
      if(keys.shot && shotCooldown===0){
        const shooters=[{x:player.x,y:player.y},...options];
        for(const sh of shooters){
          // Lv0: 通常弾  Lv1/Lv2: ビーム連続(描画側)  Lv3: リングレーザー弾  Lv4: 波動砲(別ロジック)
          if(laserLv===0)      bullets.push({x:sh.x+14,y:sh.y,vx:9,vy:0,player:true});
          else if(laserLv===3) bullets.push({x:sh.x+14,y:sh.y,vx:7,vy:0,player:true,ring:true,age:0});
          // 下ミサイル
          if(missDownLv>0) bullets.push({x:sh.x,y:sh.y,vx:5,vy:3.5,player:true,missile:true,missLv:missDownLv});
          // 上ミサイル
          if(missUpLv>=1) bullets.push({x:sh.x,y:sh.y,vx:5,vy:-3.5,player:true,missile:true,missUp:true,missUpLv});
          if(missUpLv>=2) bullets.push({x:sh.x,y:sh.y,vx:-2,vy:-4.5,player:true,missile:true,missUp:true,missUpLv,backward:true});
        }
        if(laserLv===0) shotCooldown=10;
        if(laserLv===1) shotCooldown=4;   // ビーム: 連射(描画のみ、弾は出ない)
        if(laserLv===2) shotCooldown=4;   // ツインビーム: 同上
        if(laserLv===3) shotCooldown=18;  // リングレーザー
        if(laserLv===4) shotCooldown=4;   // 波動砲: チャージ側で管理
      }

      // Lv4 波動砲: プレイヤーのみチャージ発射
      if(laserLv===4){
        if(keys.shot && waveCooldown<=0){
          waveCharging=true;
          waveCharge=Math.min(60, waveCharge+1);
        } else if(!keys.shot && waveCharging){
          waveCharging=false;
          if(waveCharge>=10){
            const power=waveCharge/60;
            // プレイヤー + 各オプションから波動砲
            const waveShooters=[{x:player.x,y:player.y},...options];
            for(const ws of waveShooters){
              bullets.push({x:ws.x+14,y:ws.y,vx:12,vy:0,player:true,wave:true,power,age:0,w:20+power*40,h:6+power*30});
            }
          }
          waveCharge=0;
          waveCooldown=45;
        }
      }
      if(waveCooldown>0) waveCooldown--;

      // Lv1/Lv2 レーザービーム: 全shooterから当たり判定
      if((laserLv===1||laserLv===2) && keys.shot){
        const shooters=[{x:player.x,y:player.y},...options];
        for(const sh of shooters){
          for(let i=enemies.length-1;i>=0;i--){
            const e=enemies[i];
            // alienBossの腕先端で自機にダメージ（無敵モード中はスキップ）
        if(e.kind==='alienBoss' && (e.armExtend||0)>60){
          const armBaseX=e.x-20, armBaseY=e.y+(e.armDir||0)*15;
          const armTipX=armBaseX-(e.armExtend||0)*0.6, armTipY=armBaseY+(e.armDir||0)*(e.armExtend||0)*0.55;
          // 無敵モードがfalseのときのみダメージ (現状は無敵ON)
          // if(player.invincible===0 && Math.abs(player.x-armTipX)<18 && Math.abs(player.y-armTipY)<18){ playerHit(); }
        }
        // spaceFortress: 砲台・コアへの個別ヒット
        if(e.kind==='spaceFortress'){
          const st1x=e.x-20, st1y=e.y-80;
          const st2x=e.x-20, st2y=e.y+80;
          const sCoreX=e.x-55, sCoreY=e.y;
          const hitT1=!((e.turret1Hp||200)<=0) && Math.abs(b.x-st1x)<24 && Math.abs(b.y-st1y)<20;
          const hitT2=!((e.turret2Hp||200)<=0) && Math.abs(b.x-st2x)<24 && Math.abs(b.y-st2y)<20;
          const coreUnlocked=(e.turret1Hp||200)<=0 && (e.turret2Hp||200)<=0;
          const hitCore2=coreUnlocked && !e.coreDead && Math.abs(b.x-sCoreX)<22 && Math.abs(b.y-sCoreY)<22;
          if(hitT1||hitT2||hitCore2){
            spawnExplosion(b.x,b.y,false);
            if(hitT1){ e.turret1Hp=(e.turret1Hp||200)-1; if(e.turret1Hp<=0) spawnExplosion(st1x,st1y,true); }
            if(hitT2){ e.turret2Hp=(e.turret2Hp||200)-1; if(e.turret2Hp<=0) spawnExplosion(st2x,st2y,true); }
            if(hitCore2){ e.coreHp=(e.coreHp||400)-1; if(e.coreHp<=0){ e.coreDead=true; spawnExplosion(sCoreX,sCoreY,true); killEnemy(j); } }
            hit=true; break;
          }
          continue;
        }
        if(e.kind==='twinDragon'){
              // twinDragon: 頭1・頭2へのレーザーヒット
              const h1x=e.x+30, h1y=e.y-55;
              const h2x=e.x+25, h2y=e.y+45;
              if(!e.head1dead && sh.x<h1x+22 && Math.abs(sh.y-h1y)<14){
                e.head1hp=(e.head1hp||200)-0.15;
                if(e.head1hp<=0){ e.head1dead=true; spawnExplosion(h1x,h1y,true); }
                if(e.head1dead&&e.head2dead) killEnemy(i);
              } else if(!e.head2dead && sh.x<h2x+22 && Math.abs(sh.y-h2y)<14){
                e.head2hp=(e.head2hp||200)-0.15;
                if(e.head2hp<=0){ e.head2dead=true; spawnExplosion(h2x,h2y,true); }
                if(e.head1dead&&e.head2dead) killEnemy(i);
              }
              continue;
            }
            if(sh.y>e.y-e.h/2-2 && sh.y<e.y+e.h/2+2 && sh.x<e.x+e.w/2){
              e.hp-=0.15;
              if(e.hp<=0) killEnemy(i);
            }
          }
        }
      }

      // Bullet move & hit
      for(let i=bullets.length-1;i>=0;i--){
        const b=bullets[i];

        // ── ミサイル段階別挙動 ──────────────────────────────
        if(b.missile){
          // ── 上ミサイル専用処理 ──────────────────────────
          if(b.missUp){
            b.x+=b.vx; b.y+=b.vy;
            const ceilY=getTopH(b.x,scrollX);  // 上地形Y座標
            const ulv=b.missUpLv||1;
            // 上地形に当たったか
            const hitCeil=b.y<=ceilY+4;
            // 画面外（上端）に出た場合もLv1は消滅
            const outTop=b.y<0;
            if(hitCeil||outTop){
              if(ulv<=2){
                // Lv1/Lv2: 天井で消滅（爆発はLv2のみ）
                if(ulv===2){
                  spawnExplosion(b.x,ceilY+4,true);
                  for(let j=enemies.length-1;j>=0;j--){
                    const e=enemies[j];
                    if(Math.abs(b.x-e.x)<40 && e.y<ceilY+60){
                      e.hp-=2; spawnExplosion(e.x,e.y,false);
                      if(e.hp<=0) killEnemy(j);
                    }
                  }
                } else {
                  spawnExplosion(b.x,ceilY+4,false);
                }
                bullets.splice(i,1); continue;
              } else {
                // Lv3: 天井に着いて這い始める（逆方向）
                b.sliding=true; b.y=ceilY+4; b.vy=0; b.vx=6;
              }
            }
            if(b.sliding){
              b.x+=b.vx;
              b.y=getTopH(b.x,scrollX)+4;  // 天井に追従
              // 画面端か地形が急降下したら爆発
              const nextCeil=getTopH(b.x+8,scrollX);
              if(b.x>W+10 || nextCeil > b.y+20){
                spawnExplosion(b.x,b.y,true);
                // 爆発範囲ダメージ
                for(let j=enemies.length-1;j>=0;j--){
                  const e=enemies[j];
                  if(Math.abs(b.x-e.x)<45 && Math.abs(b.y-e.y)<45){
                    e.hp-=3; spawnExplosion(e.x,e.y,false);
                    if(e.hp<=0) killEnemy(j);
                  }
                }
                bullets.splice(i,1); continue;
              }
            }
            // 飛行中の敵ヒット判定
            if(!b.sliding){
              let hitUp=false;
              for(let j=enemies.length-1;j>=0;j--){
                const e=enemies[j];
                if(Math.abs(b.x-e.x)<e.w/2+6 && Math.abs(b.y-e.y)<e.h/2+6){
                  const ulv=b.missUpLv||1;
                  if(ulv===3){
                    spawnExplosion(b.x,b.y,true);
                    for(let k=enemies.length-1;k>=0;k--){
                      const e2=enemies[k];
                      if(Math.abs(b.x-e2.x)<40 && Math.abs(b.y-e2.y)<40){
                        e2.hp-=2; if(e2.hp<=0) killEnemy(k);
                      }
                    }
                  } else {
                    e.hp--; spawnExplosion(b.x,b.y,false);
                    if(e.hp<=0) killEnemy(j);
                  }
                  hitUp=true; break;
                }
              }
              if(hitUp){ bullets.splice(i,1); continue; }
            }
          } else {
          // ── 下ミサイル処理（従来） ────────────────────────
          const lv=b.missLv||1;
          const groundY=H-getBotH(b.x,scrollX);  // 下地面のY座標

          if(!b.sliding){
            // 斜め飛行中
            b.x+=b.vx; b.y+=b.vy;
            // 地面に到達？
            if(b.y>=groundY-4){
              if(lv===1){
                // Lv1: 地面で消滅（爆発なし、ただし敵には当たる）
                spawnExplosion(b.x,groundY,false);
                bullets.splice(i,1); continue;
              } else if(lv===2){
                // Lv2: 地面で爆発
                spawnExplosion(b.x,groundY,true);
                // 爆発範囲でダメージ
                for(let j=enemies.length-1;j>=0;j--){
                  const e=enemies[j];
                  if(Math.abs(b.x-e.x)<40 && e.y>groundY-60){
                    e.hp-=2; spawnExplosion(e.x,e.y,false);
                    if(e.hp<=0) killEnemy(j);
                  }
                }
                bullets.splice(i,1); continue;
              } else {
                // Lv3: 地面に着地して這い始める
                b.sliding=true; b.y=groundY-4; b.vy=0; b.vx=6;
              }
            }
          } else {
            // Lv3: 地面這い
            b.x+=b.vx;
            b.y=H-getBotH(b.x,scrollX)-4;  // 地面に追従
            // 画面端か地形が急上昇したら爆発
            const nextGround=H-getBotH(b.x+8,scrollX);
            if(b.x>W+10 || nextGround < b.y-20){
              spawnExplosion(b.x,b.y,true);
              bullets.splice(i,1); continue;
            }
          }
          } // end else(下ミサイル)
        } else {
          b.x+=b.vx; b.y+=b.vy;
        }

        if(b.x>W+40||b.x<-20||b.y<0||b.y>H){ bullets.splice(i,1); continue; }

        // ── Lv3 リングレーザー弾 ──
        if(b.ring){
          b.age++;
          b.x+=b.vx; b.y+=b.vy;
          const r=5+b.age*0.7;  // 進むにつれリングが拡大
          for(let j=enemies.length-1;j>=0;j--){
            const e=enemies[j];
            const dx=b.x-e.x, dy=b.y-e.y;
            if(Math.sqrt(dx*dx+dy*dy)<r+e.w/2){
              e.hp-=1.2; spawnExplosion(b.x,b.y,false);
              if(e.hp<=0) killEnemy(j);
              bullets.splice(i,1); break;
            }
          }
          if(b.x>W+60) bullets.splice(i,1);
          continue;
        }

        // ── Lv4 波動砲弾 ──
        if(b.wave){
          b.age++;
          b.x+=b.vx;
          // 幅・高さが進むにつれ少し拡大
          b.w=Math.min(b.w+0.3, b.w*1.002);
          // 当たり判定（広い）
          const hh=b.h/2;
          for(let j=enemies.length-1;j>=0;j--){
            const e=enemies[j];
            if(b.x<e.x+e.w/2 && b.x+b.w>e.x-e.w/2 && b.y-hh<e.y+e.h/2 && b.y+hh>e.y-e.h/2){
              const dmg=b.power*3+1;
              e.hp-=dmg; spawnExplosion(e.x,e.y,b.power>0.5);
              if(e.hp<=0) killEnemy(j);
            }
          }
          if(b.x>W+60) bullets.splice(i,1);
          continue;
        }

        // 敵ヒット判定
        let hit=false;
        for(let j=enemies.length-1;j>=0;j--){
          const e=enemies[j];
          // twinDragon: 頭1・頭2の個別ヒット判定
          // alienBossの腕先端で自機にダメージ（無敵モード中はスキップ）
        if(e.kind==='alienBoss' && (e.armExtend||0)>60){
          const armBaseX=e.x-20, armBaseY=e.y+(e.armDir||0)*15;
          const armTipX=armBaseX-(e.armExtend||0)*0.6, armTipY=armBaseY+(e.armDir||0)*(e.armExtend||0)*0.55;
          // 無敵モードがfalseのときのみダメージ (現状は無敵ON)
          // if(player.invincible===0 && Math.abs(player.x-armTipX)<18 && Math.abs(player.y-armTipY)<18){ playerHit(); }
        }
        if(e.kind==='twinDragon'){
            const h1x=e.x+30, h1y=e.y-55;
            const h2x=e.x+25, h2y=e.y+45;
            const hitH1=!e.head1dead && Math.abs(b.x-h1x)<22 && Math.abs(b.y-h1y)<22;
            const hitH2=!e.head2dead && Math.abs(b.x-h2x)<22 && Math.abs(b.y-h2y)<22;
            if(hitH1||hitH2){
              spawnExplosion(b.x,b.y,false);
              if(hitH1){ e.head1hp=(e.head1hp||200)-1; if(e.head1hp<=0){ e.head1dead=true; spawnExplosion(h1x,h1y,true); } }
              if(hitH2){ e.head2hp=(e.head2hp||200)-1; if(e.head2hp<=0){ e.head2dead=true; spawnExplosion(h2x,h2y,true); } }
              // 両頭破壊でボス撃破
              if(e.head1dead && e.head2dead){ killEnemy(j); }
              // フェーズ更新
              else if(!e.head1dead || !e.head2dead){
                const totalHp=(e.head1hp||0)+(e.head2hp||0);
                if(totalHp<200) e.phase=2;
              }
              hit=true; break;
            }
            continue; // 頭以外はヒットしない
          }
          if(Math.abs(b.x-e.x)<e.w/2+6 && Math.abs(b.y-e.y)<e.h/2+6){
            const lv=b.missLv||0;
            if(lv>=2){
              // Lv2/3: 爆発ダメージ(範囲)
              spawnExplosion(b.x,b.y,true);
              for(let k=enemies.length-1;k>=0;k--){
                const e2=enemies[k];
                if(Math.abs(b.x-e2.x)<35 && Math.abs(b.y-e2.y)<35){
                  e2.hp-=2; if(e2.hp<=0) killEnemy(k);
                }
              }
            } else {
              e.hp--; spawnExplosion(b.x,b.y,false);
              if(e.hp<=0) killEnemy(j);
            }
            hit=true; break;
          }
        }
        if(hit){ bullets.splice(i,1); }
      }

      // Power items
      for(let i=powerItems.length-1;i>=0;i--){
        powerItems[i].x-=2;
        if(powerItems[i].x<-20){ powerItems.splice(i,1); continue; }
        if(Math.abs(powerItems[i].x-player.x)<20 && Math.abs(powerItems[i].y-player.y)<20){
          powerItems.splice(i,1); advancePU();
        }
      }

      // Enemy spawn & move
      spawnStageEnemies();
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i]; e.t++;
        // twinDragonボスは画面右側に固定（左に流れない）
        // alienBossの腕先端で自機にダメージ（無敵モード中はスキップ）
        if(e.kind==='alienBoss' && (e.armExtend||0)>60){
          const armBaseX=e.x-20, armBaseY=e.y+(e.armDir||0)*15;
          const armTipX=armBaseX-(e.armExtend||0)*0.6, armTipY=armBaseY+(e.armDir||0)*(e.armExtend||0)*0.55;
          // 無敵モードがfalseのときのみダメージ (現状は無敵ON)
          // if(player.invincible===0 && Math.abs(player.x-armTipX)<18 && Math.abs(player.y-armTipY)<18){ playerHit(); }
        }
        if(e.kind==='twinDragon'){
          e.x=Math.max(W*0.55, Math.min(W*0.78, e.x+e.vx));

          // ── 頭のランダム移動 ──
          e.headMoveTimer=(e.headMoveTimer||0)-1;
          if(e.headMoveTimer<=0){
            // 新しいランダムターゲット（頭1=上、頭2=下）
            e.headTarget1={x:(Math.random()-0.5)*60, y:(Math.random()-0.5)*50-20};
            e.headTarget2={x:(Math.random()-0.5)*60, y:(Math.random()-0.5)*50+20};
            e.headMoveTimer=50+Math.floor(Math.random()*60);
          }
          // ターゲットに向かってゆっくり移動
          const hSpd=0.06;
          e.headOfs1=e.headOfs1||{x:0,y:0};
          e.headOfs2=e.headOfs2||{x:0,y:0};
          e.headOfs1.x+=(e.headTarget1.x-e.headOfs1.x)*hSpd;
          e.headOfs1.y+=(e.headTarget1.y-e.headOfs1.y)*hSpd;
          e.headOfs2.x+=(e.headTarget2.x-e.headOfs2.x)*hSpd;
          e.headOfs2.y+=(e.headTarget2.y-e.headOfs2.y)*hSpd;

          // ── 尻尾突き攻撃 ──
          // tailPhase: 0=待機 1=突き出し中 2=戻り中
          if(e.tailPhase===0){
            e.tailTimer=(e.tailTimer||0)-1;
            if(e.tailTimer<=0){
              e.tailPhase=1; e.tailExtend=0;
              // 自機が上か下か判定して突く方向を決める
              e.tailDir=player.y<e.y?-1:1;
              e.tailTimer=200+Math.floor(Math.random()*120);
            }
          } else if(e.tailPhase===1){
            e.tailExtend=(e.tailExtend||0)+5;
            if(e.tailExtend>=100) e.tailPhase=2;
          } else if(e.tailPhase===2){
            e.tailExtend=Math.max(0,(e.tailExtend||0)-4);
            if(e.tailExtend<=0) e.tailPhase=0;
          }
        } else if(e.kind==='spaceFortress'){
          e.x=Math.max(W*0.52, Math.min(W*0.75, e.x+e.vx));
        } else if(e.kind==='alienBoss'){
          e.x=Math.max(W*0.55, Math.min(W*0.78, e.x+e.vx));
        } else if(e.kind==='moaiBoss'){
          // moaiBoss: 画面右側に固定
          const minX = e.role==='center'? W*0.55 : W*0.5;
          e.x=Math.max(minX, Math.min(W*0.80, e.x+e.vx));
        } else {
          e.x+=e.vx;
        }
        if(e.wave.amp>0) e.y=e.wave.base+Math.sin(e.t*e.wave.freq)*e.wave.amp;
        // 小惑星: 回転更新
        if(e.kind==='asteroid' && e.rotSpd) e.rot=(e.rot||0)+e.rotSpd;
        // 大型隕石: 縦移動 + 回転
        if(e.kind==='bigMeteor'){
          if(e.vy!==undefined) e.y+=e.vy;
          if(e.rotSpd!==undefined) e.rot=(e.rot||0)+e.rotSpd;
        }
        e.shootTimer--;
        // ボスは密に撃ち、雑魚は種類別に間隔調整
        const shootInterval = e.isBoss ? 55
          : e.kind==='alienEgg' ? 180
          : e.kind==='stoneGolem' ? 160
          : e.kind==='whiteCell' ? 170
          : e.kind==='moai' ? 150
          : 120+Math.floor(Math.random()*60);
        if(e.shootTimer<=0){ enemyShoot(e); e.shootTimer=shootInterval; }
        // twinDragonは画面外で消えない
        // amoebaボス: 偽足伸縮アニメ
        if(e.kind==='amoeba' && e.isBoss){
          if((e.pseudoPod||0)<1 && (e.pseudoTimer||0)<=60){ e.pseudoPod=Math.min(1,(e.pseudoPod||0)+0.05); }
          else if(e.pseudoTimer>60){ e.pseudoPod=Math.max(0,(e.pseudoPod||0)-0.04); }
        }
        // amoebaボス: 偽足伸縮アニメ
        if(e.kind==='amoeba' && e.isBoss){
          if((e.pseudoTimer||80)>60){ e.pseudoPod=Math.max(0,(e.pseudoPod||0)-0.05); }
          else { e.pseudoPod=Math.min(1,(e.pseudoPod||0)+0.06); }
        }
        if(e.kind!=='twinDragon' && e.kind!=='moaiBoss' && e.kind!=='alienBoss' && e.kind!=='spaceFortress' && e.x<-120){ if(e.isBoss) bossAlive=false; enemies.splice(i,1); }
      }

      // Enemy bullets
      for(let i=enemyBullets.length-1;i>=0;i--){
        const b=enemyBullets[i];
        b.x+=b.vx; b.y+=b.vy;
        // リングは徐々に大きく
        if(b.kind==='ring') b.r=(b.r||6)+0.1;
        if(b.kind==='breath' && (b.age||0)>=50){ enemyBullets.splice(i,1); continue; }
        if(b.kind==='moaiBeam' && (b.r||10)>=60){ enemyBullets.splice(i,1); continue; }
        if(b.kind==='alienBeam'){ b.life=(b.life||80)-1; if(b.life<=0){ enemyBullets.splice(i,1); continue; } }
        if(b.kind==='goldBeam'){ b.life=(b.life||60)-1; if(b.life<=0){ enemyBullets.splice(i,1); continue; } }
        if(b.homing){ const ha=Math.atan2(player.y-b.y,player.x-b.x); b.vx+=(Math.cos(ha)*5-b.vx)*(b.homingStr||0.04); b.vy+=(Math.sin(ha)*5-b.vy)*(b.homingStr||0.04); }
        if(b.kind==='fortBeam'){ if((b.life||70)<=0){ enemyBullets.splice(i,1); continue; } }
        if(b.x>W+20||b.x<-20||b.y<-20||b.y>H+20){ enemyBullets.splice(i,1); continue; }
        // プレイヤーヒット判定はgameRefでスキップ（無敵モード維持）
        // if(player.invincible===0 && ...) playerHit();
      }

      // Particles
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.x+=p.vx; p.y+=p.vy; p.vx*=0.94; p.vy*=0.94; p.life--;
        if(p.life<=0) particles.splice(i,1);
      }
      if(player.invincible>0) player.invincible--;

      // Stage clear判定: ボスを倒す or 一定時間+ボスなし
      // ボス出現直後に雑魚を全消去（bossSpawnedフラグが立った瞬間のみ）
      if(bossSpawned && bossAlive && !window._bossMinionsCleared){
        window._bossMinionsCleared=true;
        for(let ci=enemies.length-1;ci>=0;ci--){
          if(!enemies[ci].isBoss){ spawnExplosion(enemies[ci].x,enemies[ci].y,false); enemies.splice(ci,1); }
        }
      }
      if(!bossSpawned) window._bossMinionsCleared=false;
      // androidBoss フェーズ管理
      const _ab=enemies.find(e=>e.kind==='androidBoss');
      if(_ab){
        const ratio=_ab.hp/800;
        if(ratio<=0.33 && _ab.phase<3){ _ab.phase=3; _ab.rageFlash=60; }
        else if(ratio<=0.66 && _ab.phase<2){ _ab.phase=2; _ab.rageFlash=60; }
        _ab.armAngle =(_ab.armAngle ||0)+0.04;
        _ab.armAngle2=(_ab.armAngle2||0)-0.035;
        _ab.shieldRotate=(_ab.shieldRotate||0)+0.06;
        if(_ab.rageFlash>0) _ab.rageFlash--;
        _ab.laserActive=Math.max(0,(_ab.laserActive||0)-1);
        _ab.chargeBeam =Math.max(0,(_ab.chargeBeam ||0)-1);
      }
      if(bossSpawned && !bossAlive){
        gameState='stageclear'; stageClearTimer=180;
      }
    }

    function killEnemy(i){
      const e=enemies[i];
      if(e.kind==='bigMeteor'){
        // 大爆発: 多数の破片パーティクル
        const br=e.radius||36;
        for(let pi=0;pi<18;pi++){
          const a=Math.PI*2/18*pi; const spd=2+Math.random()*4;
          particles.push({x:e.x+Math.cos(a)*br*0.5, y:e.y+Math.sin(a)*br*0.5,
            vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
            life:40+Math.floor(Math.random()*30), maxLife:70,
            color:`hsl(${20+Math.floor(Math.random()*30)},80%,${40+Math.floor(Math.random()*30)}%)`,
            size:2+Math.random()*4});
        }
        enemies.splice(i,1);
        score+=1500;
        return;
      }
      score+=e.isBoss?5000:e.kind==='moai'?500:200;
      spawnExplosion(e.x,e.y,e.isBoss||e.hp>10);
      if(e.isBoss){
        enemies.splice(i,1);
        // 全ボスが倒されたか確認
        if(!enemies.some(en=>en.isBoss)) bossAlive=false;
        killCount++;
        if(killCount%5===0) powerItems.push({x:e.x,y:e.y});
        return;
      }
      killCount++;
      if(killCount%5===0) powerItems.push({x:e.x,y:e.y});
      enemies.splice(i,1);
    }

    // ─────────────────────────────────────────────────
    // DRAW
    // ─────────────────────────────────────────────────
    function draw(){
      drawBackground();

      // Particles
      for(const p of particles){
        ctx.globalAlpha=p.life/p.maxLife; ctx.fillStyle=p.color;
        ctx.fillRect(Math.floor(p.x-p.size/2),Math.floor(p.y-p.size/2),p.size,p.size);
      }
      ctx.globalAlpha=1;

      for(const e of enemies) drawEnemy(e);
      for(const it of powerItems) drawPowerItem(it);

      // ── Lv1/Lv2: レーザービーム描画 ──
      if((laserLv===1||laserLv===2) && keys.shot){
        ctx.save();
        const shooters=[{x:player.x,y:player.y},...options];
        for(const sh of shooters){
          const lx=sh.x+14;

          if(laserLv===1){
            // ── Lv1: シングルレーザー ──
            const ly=sh.y;
            ctx.shadowColor='#00ffcc'; ctx.shadowBlur=18;
            const lg=ctx.createLinearGradient(lx,ly-6,lx,ly+6);
            lg.addColorStop(0,'rgba(0,255,200,0)');
            lg.addColorStop(0.4,'rgba(0,255,180,0.5)');
            lg.addColorStop(0.5,'rgba(200,255,255,0.85)');
            lg.addColorStop(0.6,'rgba(0,255,180,0.5)');
            lg.addColorStop(1,'rgba(0,255,200,0)');
            ctx.fillStyle=lg; ctx.fillRect(lx,ly-6,W-lx,12);
            ctx.shadowBlur=0;
            ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(lx,ly-1.5,W-lx,3);
            if(frame%3===0){
              ctx.strokeStyle='rgba(0,255,255,0.4)'; ctx.lineWidth=1;
              ctx.beginPath(); ctx.moveTo(lx,ly+4); ctx.lineTo(W,ly+2+Math.sin(frame*0.5)*2); ctx.stroke();
            }
          } else {
            // ── Lv2: ツインレーザー（上下2本）──
            const offsets=[-10, 10];
            for(const off of offsets){
              const ly=sh.y+off;
              ctx.shadowColor='#44ffee'; ctx.shadowBlur=14;
              const lg2=ctx.createLinearGradient(lx,ly-4,lx,ly+4);
              lg2.addColorStop(0,'rgba(0,220,255,0)');
              lg2.addColorStop(0.4,'rgba(0,210,255,0.55)');
              lg2.addColorStop(0.5,'rgba(180,255,255,0.9)');
              lg2.addColorStop(0.6,'rgba(0,210,255,0.55)');
              lg2.addColorStop(1,'rgba(0,220,255,0)');
              ctx.fillStyle=lg2; ctx.fillRect(lx,ly-4,W-lx,8);
              ctx.shadowBlur=0;
              ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fillRect(lx,ly-1,W-lx,2);
              // チラつき
              if(frame%3===0){
                ctx.strokeStyle='rgba(0,255,255,0.35)'; ctx.lineWidth=1;
                ctx.beginPath(); ctx.moveTo(lx,ly+3); ctx.lineTo(W,ly+2+Math.sin(frame*0.5+off)*2); ctx.stroke();
              }
            }
            // 中央つなぎグロー（2本の間）
            ctx.shadowColor='#00ffcc'; ctx.shadowBlur=8;
            ctx.fillStyle='rgba(0,255,200,0.12)'; ctx.fillRect(lx,sh.y-10,W-lx,20);
            ctx.shadowBlur=0;
          }
        }
        ctx.restore();
      }

      // ── Lv4: 波動砲チャージエフェクト ──
      if(laserLv===4 && waveCharging && waveCharge>0){
        ctx.save();
        const cx=player.x+14, cy=player.y;
        const r=8+waveCharge*0.8;
        const intensity=waveCharge/60;
        const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
        cg.addColorStop(0,'rgba(255,255,255,0.95)');
        cg.addColorStop(0.3,`rgba(80,${Math.floor(200+intensity*55)},255,0.8)`);
        cg.addColorStop(0.7,`rgba(0,${Math.floor(100+intensity*155)},255,0.5)`);
        cg.addColorStop(1,'rgba(0,50,200,0)');
        ctx.fillStyle=cg; ctx.shadowColor='#44aaff'; ctx.shadowBlur=r*1.5;
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle=`rgba(150,230,255,${0.3+intensity*0.5})`; ctx.lineWidth=2;
        for(let ri=0;ri<3;ri++){
          const rr=r*0.6+ri*r*0.15;
          const rot=frame*0.15*(ri+1);
          ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
          ctx.beginPath(); ctx.ellipse(0,0,rr,rr*0.35,0,0,Math.PI*2); ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle=`rgba(100,200,255,${intensity*0.7})`;
        for(let pi=0;pi<8;pi++){
          const pa=(Math.PI*2/8)*pi + frame*0.1;
          const pr=r*1.6+Math.sin(frame*0.2+pi)*5;
          ctx.beginPath(); ctx.arc(cx+Math.cos(pa)*pr,cy+Math.sin(pa)*pr,2+intensity*2,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
      }

      for(const b of bullets) drawBullet(b);
      for(const b of enemyBullets) drawEnemyBullet(b);
      for(const op of options) drawOption(op.x,op.y,player.invincible);
      drawPlayer(player.x,player.y,player.invincible);

      // ── HUD ─────────────────────────────────────────
      // 上部HUDバー（半透明パネル）
      ctx.fillStyle='rgba(0,8,20,0.72)';
      ctx.fillRect(0,0,W,44);
      ctx.strokeStyle='rgba(0,180,255,0.2)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,44); ctx.lineTo(W,44); ctx.stroke();

      // スコア
      ctx.fillStyle='rgba(0,180,255,0.5)'; ctx.font='9px Courier New';
      ctx.fillText('SCORE',10,12);
      ctx.shadowColor='#00ccff'; ctx.shadowBlur=8;
      ctx.fillStyle='#88eeff'; ctx.font='bold 16px Courier New';
      ctx.fillText(String(score).padStart(8,'0'),10,30);
      ctx.shadowBlur=0;

      // ステージ名
      const stInfo=STAGES[stage-1];
      ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='9px Courier New'; ctx.textAlign='center';
      ctx.fillText(`STAGE ${stage}`,W/2,12);
      ctx.shadowColor=stInfo.accentColor; ctx.shadowBlur=6;
      ctx.fillStyle=stInfo.accentColor; ctx.font='bold 13px Courier New';
      ctx.fillText(stInfo.name,W/2,28);
      ctx.shadowBlur=0; ctx.textAlign='left';

      // 残機（アイコン式）
      ctx.fillStyle='rgba(0,180,255,0.4)'; ctx.font='9px Courier New';
      ctx.textAlign='right'; ctx.fillText('SHIPS',W-8,12);
      for(let i=0;i<lives;i++){
        const sx=W-16-(lives-1-i)*18;
        ctx.save(); ctx.translate(sx,28);
        ctx.shadowColor='#40c0ff'; ctx.shadowBlur=6;
        ctx.fillStyle='#60c0ff';
        ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(2,-5); ctx.lineTo(-6,-4); ctx.lineTo(-6,4); ctx.lineTo(2,5); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(150,230,255,0.8)';
        ctx.beginPath(); ctx.ellipse(2,0,3,2,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0; ctx.restore();
      }
      ctx.textAlign='left';

      // KILLカウンター
      const killFrac=killCount%5;
      ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.font='9px Courier New';
      ctx.fillText('PWR',W-78,42);
      for(let k=0;k<5;k++){
        ctx.fillStyle=k<killFrac?'#ffcc00':'rgba(255,200,0,0.15)';
        ctx.fillRect(W-62+k*11,33,9,6);
      }

      drawPowerBar();

      // Stage clear overlay
      if(gameState==='stageclear'){
        ctx.fillStyle='rgba(0,5,15,0.65)'; ctx.fillRect(0,0,W,H);
        // 横ライン装飾
        ctx.strokeStyle='rgba(0,200,180,0.4)'; ctx.lineWidth=1;
        for(const y2 of [H/2-55,H/2+60]){ ctx.beginPath(); ctx.moveTo(40,y2); ctx.lineTo(W-40,y2); ctx.stroke(); }
        ctx.shadowColor='#00ffcc'; ctx.shadowBlur=20;
        ctx.fillStyle='#00ffcc'; ctx.font='bold 34px Courier New'; ctx.textAlign='center';
        ctx.fillText('MISSION COMPLETE',W/2,H/2-20);
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(0,200,180,0.6)'; ctx.font='12px Courier New';
        ctx.fillText(`STAGE ${stage} — ${STAGES[stage-1].name}`,W/2,H/2+14);
        if(stage<7){
          ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='11px Courier New';
          ctx.fillText(`NEXT: STAGE ${stage+1} — ${STAGES[stage].name}`,W/2,H/2+40);
        }
        ctx.textAlign='left';
      }
      if(gameState==='gameclear'){
        ctx.fillStyle='rgba(0,0,10,0.88)'; ctx.fillRect(0,0,W,H);
        // 枠
        ctx.strokeStyle='rgba(255,200,0,0.3)'; ctx.lineWidth=1.5;
        ctx.strokeRect(24,H/2-80,W-48,160);
        ctx.strokeStyle='rgba(255,220,0,0.1)'; ctx.lineWidth=0.5;
        ctx.strokeRect(28,H/2-76,W-56,152);
        ctx.shadowColor='#ffcc00'; ctx.shadowBlur=24;
        ctx.fillStyle='#ffdd00'; ctx.font='bold 28px Courier New'; ctx.textAlign='center';
        ctx.fillText('ALL STAGES CLEARED',W/2,H/2-42);
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='13px Courier New';
        ctx.fillText('FORTRESS SYSTEM: DESTROYED',W/2,H/2-14);
        ctx.fillStyle='rgba(0,220,255,0.6)'; ctx.font='11px Courier New';
        ctx.fillText('MEGA ROBOT — NEUTRALIZED',W/2,H/2+8);
        ctx.shadowColor='#ffdd00'; ctx.shadowBlur=10;
        ctx.fillStyle='#ffe066'; ctx.font='bold 18px Courier New';
        ctx.fillText(`FINAL SCORE  ${String(score).padStart(8,'0')}`,W/2,H/2+38);
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='10px Courier New';
        ctx.fillText('[ TAP B / Z TO RESTART ]',W/2,H/2+70);
        ctx.textAlign='left';
      }
      if(gameState==='gameover'){
        ctx.fillStyle='rgba(0,0,0,0.78)'; ctx.fillRect(0,0,W,H);
        // 赤スキャンライン
        for(let sl=0;sl<H;sl+=4){ ctx.fillStyle='rgba(80,0,0,0.06)'; ctx.fillRect(0,sl,W,2); }
        ctx.shadowColor='#ff2200'; ctx.shadowBlur=30;
        ctx.fillStyle='#cc1100'; ctx.font='bold 48px Courier New'; ctx.textAlign='center';
        ctx.fillText('GAME OVER',W/2,H/2-30);
        ctx.shadowBlur=0;
        ctx.strokeStyle='rgba(180,0,0,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(40,H/2-4); ctx.lineTo(W-40,H/2-4); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='14px Courier New';
        ctx.fillText(`SCORE  ${String(score).padStart(8,'0')}`,W/2,H/2+22);
        ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.font='10px Courier New';
        ctx.fillText('[ TAP B / Z TO RESTART ]',W/2,H/2+56);
        ctx.textAlign='left';
      }
      if(gameState==='select'){
        // 背景
        ctx.fillStyle='#00040e'; ctx.fillRect(0,0,W,H);
        // グリッド
        ctx.strokeStyle='rgba(0,60,120,0.25)'; ctx.lineWidth=1;
        for(let gx=0;gx<W;gx+=40){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
        for(let gy=0;gy<H;gy+=40){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }

        // タイトル
        ctx.shadowColor='#0088ff'; ctx.shadowBlur=18;
        ctx.fillStyle='#0088ff'; ctx.font='9px Courier New'; ctx.textAlign='center';
        ctx.fillText('GALACTIC ASSAULT SYSTEM  v2.0',W/2,14);
        ctx.shadowColor='#00ddff'; ctx.shadowBlur=22;
        ctx.fillStyle='#00ddff'; ctx.font='bold 20px Courier New';
        ctx.fillText('MISSION SELECT',W/2,34);
        ctx.shadowBlur=0;
        ctx.strokeStyle='rgba(0,160,255,0.25)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(20,42); ctx.lineTo(W-20,42); ctx.stroke();

        ctx.fillStyle='rgba(100,160,255,0.4)'; ctx.font='9px Courier New';
        ctx.fillText('↑↓ NAVIGATE   B/Z LAUNCH   A/X BOSS RUSH',W/2,52);

        const SNAMES=[
          ['ST1','VOLCANO',     '双頭火龍',   '#ff4400'],
          ['ST2','MOAI ISLAND', 'モアイ三神', '#88aacc'],
          ['ST3','PYRAMID',     'ツタンカーメン','#ccaa00'],
          ['ST4','ALIEN RUINS', 'ALIEN OVERLORD','#6688aa'],
          ['ST5','ALIEN BODY',  '大型アメーバ','#bb44ff'],
          ['ST6','COSMOS',      '宇宙要塞',   '#4488ff'],
          ['ST7','FORTRESS',    'MEGA ROBOT', '#ff4444'],
        ];
        const colW=W*0.47; const rowH=34;
        ['NORMAL','BOSS RUSH'].forEach((label,col)=>{
          const cx2=W*0.25+col*colW;
          const lCol=col===0?'#44aaff':'#ff5533';
          ctx.shadowColor=lCol; ctx.shadowBlur=8;
          ctx.fillStyle=lCol; ctx.font='bold 10px Courier New'; ctx.textAlign='center';
          ctx.fillText(`── ${label} ──`,cx2,66);
          ctx.shadowBlur=0;
          SNAMES.forEach((s,i)=>{
            const idx=col*7+i;
            const selected=(selectCursor===idx);
            const y2=80+i*rowH;
            const stCol=s[3];
            if(selected){
              // 選択枠
              ctx.fillStyle=col===0?'rgba(0,80,200,0.18)':'rgba(200,50,20,0.18)';
              ctx.fillRect(cx2-colW*0.44,y2-2,colW*0.88,rowH-2);
              // アクセントライン左
              ctx.fillStyle=stCol; ctx.fillRect(cx2-colW*0.44,y2-2,2,rowH-2);
              ctx.shadowColor=stCol; ctx.shadowBlur=8;
            }
            // ステージ番号
            ctx.fillStyle=selected?stCol:'rgba(100,120,140,0.7)';
            ctx.font=(selected?'bold ':'')+'9px Courier New'; ctx.textAlign='center';
            ctx.fillText(s[0],cx2-colW*0.28,y2+8);
            // ステージ名
            ctx.fillStyle=selected?'#ffffff':'rgba(180,190,200,0.6)';
            ctx.font=(selected?'bold ':'')+'12px Courier New';
            ctx.fillText(s[1],cx2+10,y2+8);
            // ボス名
            ctx.fillStyle=selected?'rgba(200,210,220,0.8)':'rgba(100,110,120,0.5)';
            ctx.font='9px Courier New';
            ctx.fillText(s[2],cx2+10,y2+21);
            ctx.shadowBlur=0;
          });
        });
        // 中央区切り
        ctx.strokeStyle='rgba(0,80,160,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(W/2,58); ctx.lineTo(W/2,H-18); ctx.stroke();
        // フッター
        ctx.fillStyle='rgba(255,160,0,0.35)'; ctx.font='9px Courier New'; ctx.textAlign='center';
        ctx.fillText('BOSS RUSH: FULL ARMAMENT — IMMEDIATE ENGAGEMENT',W/2,H-7);
        ctx.textAlign='left';
      }
    }

    // ─────────────────────────────────────────────────
    // LOOP
    // ─────────────────────────────────────────────────
    function loop(){
      if(gameState==='select'){
        // カーソル移動
        if(keys.up   && !upPressed)  { selectCursor=(selectCursor-1+14)%14; upPressed=true; }
        if(keys.down && !downPressed) { selectCursor=(selectCursor+1)%14; downPressed=true; }
        if(!keys.up)   upPressed=false;
        if(!keys.down) downPressed=false;
        // 決定: Shot = 通常プレイ、Aボタン/Enter = ボスラッシュ
        if(keys.shot && !shotPressed){
          const stg = selectCursor<7 ? selectCursor+1 : selectCursor-6;
          const bossOnly = selectCursor>=7;
          startStage(stg, bossOnly);
          shotPressed=true;
        }
        if(!keys.shot) shotPressed=false;
        // activatePU でボスラッシュ直行
        update(); draw(); rafId=requestAnimationFrame(loop); return;
      }
      if((gameState==='gameover'||gameState==='gameclear') && keys.shot){
        if(!shotPressed){ initGame(); shotPressed=true; }
      } else { shotPressed=false; }
      update(); draw();
      rafId=requestAnimationFrame(loop);
    }

    // Input
    const onKeyDown=e=>{
      if(e.key==='ArrowUp')    keys.up=true;
      if(e.key==='ArrowDown')  keys.down=true;
      if(e.key==='ArrowLeft')  keys.left=true;
      if(e.key==='ArrowRight') keys.right=true;
      if(e.key==='z'||e.key==='Z'||e.key===' ') keys.shot=true;
      if(e.key==='x'||e.key==='X'||e.key==='Enter') activatePU();
      e.preventDefault();
    };
    const onKeyUp=e=>{
      if(e.key==='ArrowUp')    keys.up=false;
      if(e.key==='ArrowDown')  keys.down=false;
      if(e.key==='ArrowLeft')  keys.left=false;
      if(e.key==='ArrowRight') keys.right=false;
      if(e.key==='z'||e.key==='Z'||e.key===' ') keys.shot=false;
    };
    const onCanvasClick=e=>{
      const r=canvas.getBoundingClientRect();
      const cy=(e.clientY-r.top)*(H/r.height);
      if(cy>H-62) activatePU();
    };
    const onCanvasTouch=e=>{
      e.preventDefault();
      const r=canvas.getBoundingClientRect();
      const cy=(e.changedTouches[0].clientY-r.top)*(H/r.height);
      if(cy>H-62) activatePU();
    };

    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('keyup',onKeyUp);
    canvas.addEventListener('click',onCanvasClick);
    canvas.addEventListener('touchend',onCanvasTouch,{passive:false});

    initGame();
    rafId=requestAnimationFrame(loop);
    gameRef.current={keys,activatePU};

    return ()=>{
      stopBGM();
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown',onKeyDown);
      window.removeEventListener('keyup',onKeyUp);
      canvas.removeEventListener('click',onCanvasClick);
      canvas.removeEventListener('touchend',onCanvasTouch);
    };
  },[]);

  // Virtual stick
  const stickRef=useRef({active:false,id:null,ox:0,oy:0});
  const DEAD=10;
  function applyStick(dx,dy){
    const k=gameRef.current?.keys; if(!k) return;
    k.up=dy<-DEAD; k.down=dy>DEAD; k.left=dx<-DEAD; k.right=dx>DEAD;
  }
  function releaseStick(){ const k=gameRef.current?.keys; if(k){k.up=false;k.down=false;k.left=false;k.right=false;} }
  function press(key,val){ if(gameRef.current) gameRef.current.keys[key]=val; }

  // ── 十字キーゾーン専用タッチハンドラ ──────────────────
  // ボタン個別ではなく、エリア全体で指の位置→方向を判定
  // スライドしながらの方向変化にも即対応
  const dpadRef=useRef(null);
  const dpadTouchId=useRef(null);
  useEffect(()=>{
    const el=dpadRef.current; if(!el) return;
    function getDir(e, touchId){
      const r=el.getBoundingClientRect();
      let t=null;
      for(const touch of e.touches){ if(touch.identifier===touchId){ t=touch; break; } }
      if(!t) return;
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const dx=t.clientX-cx, dy=t.clientY-cy;
      const k=gameRef.current?.keys; if(!k) return;
      const THRESH=14; // 中心からこの距離で方向確定
      k.up   = dy < -THRESH;
      k.down = dy >  THRESH;
      k.left = dx < -THRESH;
      k.right= dx >  THRESH;
    }
    function onTS(e){ e.preventDefault(); e.stopPropagation();
      if(dpadTouchId.current!==null) return; // 既に押している
      dpadTouchId.current=e.changedTouches[0].identifier;
      getDir(e, dpadTouchId.current);
    }
    function onTM(e){ e.preventDefault(); e.stopPropagation();
      getDir(e, dpadTouchId.current);
    }
    function onTE(e){ e.preventDefault(); e.stopPropagation();
      for(const t of e.changedTouches){
        if(t.identifier===dpadTouchId.current){
          dpadTouchId.current=null; releaseStick(); break;
        }
      }
    }
    el.addEventListener('touchstart', onTS,{passive:false});
    el.addEventListener('touchmove',  onTM,{passive:false});
    el.addEventListener('touchend',   onTE,{passive:false});
    el.addEventListener('touchcancel',onTE,{passive:false});
    return ()=>{
      el.removeEventListener('touchstart', onTS);
      el.removeEventListener('touchmove',  onTM);
      el.removeEventListener('touchend',   onTE);
      el.removeEventListener('touchcancel',onTE);
    };
  },[]);

  const overlayRef=useRef(null);
  useEffect(()=>{
    const el=overlayRef.current; if(!el) return;
    const getR=()=>el.getBoundingClientRect();
    function onTS(e){ e.preventDefault();
      press('shot',true);
    }
    function onTM(e){ e.preventDefault(); }
    function onTE(e){ e.preventDefault();
      press('shot',false);
    }
    el.addEventListener('touchstart',onTS,{passive:false});
    el.addEventListener('touchmove',onTM,{passive:false});
    el.addEventListener('touchend',onTE,{passive:false});
    el.addEventListener('touchcancel',onTE,{passive:false});
    return ()=>{ el.removeEventListener('touchstart',onTS); el.removeEventListener('touchmove',onTM); el.removeEventListener('touchend',onTE); el.removeEventListener('touchcancel',onTE); };
  },[]);

  const shotBtn={
    onMouseDown:  ()=>press('shot',true),
    onMouseUp:    ()=>press('shot',false),
    onMouseLeave: ()=>press('shot',false),
    onTouchStart: (e)=>{ e.preventDefault(); e.stopPropagation(); press('shot',true); },
    onTouchEnd:   (e)=>{ e.preventDefault(); e.stopPropagation(); press('shot',false); },
    onTouchCancel:(e)=>{ e.preventDefault(); e.stopPropagation(); press('shot',false); },
  };

  const puBtn={
    onMouseDown:  ()=>{ if(gameRef.current) gameRef.current.activatePU(); },
    onTouchStart: (e)=>{ e.preventDefault(); e.stopPropagation(); if(gameRef.current) gameRef.current.activatePU(); },
    onTouchEnd:   (e)=>{ e.preventDefault(); e.stopPropagation(); },
    onTouchCancel:(e)=>{ e.preventDefault(); e.stopPropagation(); },
  };

  return (
    <div style={{background:'#000',display:'flex',justifyContent:'center',alignItems:'flex-start',
                 width:'100%',height:'100%',minHeight:700,touchAction:'none',userSelect:'none'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>

        {/* ── キャンバス（タッチオーバーレイ付き）── */}
        <div style={{position:'relative',width:W,height:H}}>
          <canvas ref={canvasRef} width={W} height={H}
            style={{display:'block',imageRendering:'pixelated',border:'2px solid #333'}}/>
          <div ref={overlayRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',touchAction:'none',zIndex:10}}/>
        </div>

        {/* ── コントロールバー（キャンバスの下）── */}
        <div style={{width:W,height:140,background:'rgba(0,0,0,0.85)',borderTop:'1px solid #222',
                     display:'flex',flexDirection:'row',alignItems:'center',
                     justifyContent:'center',gap:60,padding:'8px 20px',boxSizing:'border-box'}}>

          {/* 十字キー — エリア全体がタッチゾーン（スライド対応） */}
          <div ref={dpadRef} style={{
            position:'relative', width:150, height:150, flexShrink:0,
            borderRadius:'50%', touchAction:'none',
            background:'rgba(255,255,255,0.06)',
            border:'2px solid rgba(255,255,255,0.15)',
            cursor:'pointer', WebkitTapHighlightColor:'transparent',
          }}>
            {/* 方向表示ラベル（装飾のみ・タッチ受けず） */}
            {[
              {label:'▲', style:{top:6,   left:'50%', transform:'translateX(-50%)'}},
              {label:'▼', style:{bottom:6, left:'50%', transform:'translateX(-50%)'}},
              {label:'◀', style:{left:6,  top:'50%',  transform:'translateY(-50%)'}},
              {label:'▶', style:{right:6, top:'50%',  transform:'translateY(-50%)'}},
            ].map(({label,style})=>(
              <div key={label} style={{
                position:'absolute', ...style,
                fontSize:20, color:'rgba(255,255,255,0.55)',
                pointerEvents:'none', userSelect:'none', lineHeight:1,
              }}>{label}</div>
            ))}
            {/* 中心十字ライン */}
            <div style={{position:'absolute',top:'50%',left:'20%',width:'60%',height:1,background:'rgba(255,255,255,0.1)',transform:'translateY(-50%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',left:'50%',top:'20%',height:'60%',width:1,background:'rgba(255,255,255,0.1)',transform:'translateX(-50%)',pointerEvents:'none'}}/>
          </div>

          {/* A・Bボタン */}
          <div style={{display:'flex',flexDirection:'row',gap:16,alignItems:'center',flexShrink:0}}>
            {/* Bボタン: 射撃 */}
            <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'center'}}>
              <div style={{width:68,height:68,borderRadius:'50%',
                background:'radial-gradient(circle at 35% 35%,#e03030,#900)',
                border:'3px solid #f66',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:20,fontWeight:'bold',color:'#fff',cursor:'pointer',
                boxShadow:'0 4px 0 #500,0 0 18px rgba(255,60,60,0.4)',
                WebkitTapHighlightColor:'transparent',userSelect:'none',touchAction:'none',
              }} {...shotBtn}>B</div>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',letterSpacing:1}}>SHOT</div>
            </div>
            {/* Aボタン: パワーアップ発動 */}
            <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'center'}}>
              <div style={{width:56,height:56,borderRadius:'50%',
                background:'radial-gradient(circle at 35% 35%,#30a0e0,#005090)',
                border:'3px solid #66ccff',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:17,fontWeight:'bold',color:'#fff',cursor:'pointer',
                boxShadow:'0 4px 0 #003060,0 0 14px rgba(60,160,255,0.4)',
                WebkitTapHighlightColor:'transparent',userSelect:'none',touchAction:'none',
              }} {...puBtn}>A</div>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',letterSpacing:1}}>POWER</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
