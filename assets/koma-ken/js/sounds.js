// 効果音: Web Audio で合成するオリジナル音。外部の音声ファイル・通信は使わない。
(function(K){
 // 効果音とBGMで共有する AudioContext（最初の操作で1回だけ作る）
 K.audioContext=function(create){
  if(K._ctx)return K._ctx;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC||!create)return null;
  try{K._ctx=new AC();}catch(e){K._ctx=null;}
  return K._ctx;
 };
 K.audioSupported=!!(window.AudioContext||window.webkitAudioContext);
 // key: [型, 開始Hz, 終了Hz, 秒, 音量, ノイズ量]
 const FX={
  sword:['square',1000,180,.07,.12,0],
  shot:['square',660,330,.1,.1,0],
  hit:['square',220,90,.13,.12,.06],
  hurt:['sawtooth',170,55,.2,.14,0],
  death:['square',300,40,.6,.14,.04],
  jump:['square',300,640,.09,.08,0],
  deflect:['triangle',1400,900,.05,.1,0],
  enemy_down:['square',420,80,.18,.1,.08],
  pickup:['triangle',660,1320,.16,.14,0]
 };
 class Sounds{
  constructor(){this.enabled=true;this.unlocked=false;this.volume=.55;this.active=new Set();this.last={};this.error=null;this.master=null;this.noiseBuf=null;}
  unlock(){
   this.unlocked=true;
   const ctx=K.audioContext(true);if(!ctx)return;
   if(!this.master){this.master=ctx.createGain();this.master.gain.value=this.volume;this.master.connect(ctx.destination);}
   const p=ctx.state==='suspended'?ctx.resume():null;if(p&&p.catch)p.catch(()=>{});
  }
  setVolume(value){const n=Number(value);if(Number.isFinite(n))this.volume=Math.max(0,Math.min(1,n));if(this.master)this.master.gain.value=this.volume;}
  mute(){this.enabled=!this.enabled;if(!this.enabled)this.stopAll();}
  noise(ctx,dur){
   if(!this.noiseBuf){const n=Math.floor(ctx.sampleRate*.4);this.noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);const d=this.noiseBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}
   const s=ctx.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;return s;
  }
  play(key){
   const f=FX[key];if(!f||!this.unlocked||!this.enabled||this.volume===0)return;
   const ctx=K.audioContext(false);if(!ctx||!this.master||ctx.state!=='running')return;
   const now=Date.now();if(now-(this.last[key]||0)<45)return;this.last[key]=now;
   if(this.active.size>=8){const first=this.active.values().next().value;try{first.stop();}catch(e){}this.active.delete(first);}
   if(key==='death')this.stopAll();
   const t=ctx.currentTime,[type,hz0,hz1,dur,level,noise]=f;
   const o=ctx.createOscillator(),g=ctx.createGain();
   o.type=type;o.frequency.setValueAtTime(hz0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,hz1),t+dur);
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
   o.connect(g);g.connect(this.master);this.active.add(o);
   o.onended=()=>{this.active.delete(o);o.disconnect();g.disconnect();};
   o.start(t);o.stop(t+dur+.02);
   if(noise>0){
    const n=this.noise(ctx,dur),ng=ctx.createGain();
    ng.gain.setValueAtTime(noise,t);ng.gain.exponentialRampToValueAtTime(.0001,t+dur);
    n.connect(ng);ng.connect(this.master);this.active.add(n);
    n.onended=()=>{this.active.delete(n);n.disconnect();ng.disconnect();};
    n.start(t);n.stop(t+dur+.02);
   }
  }
  stopAll(){for(const a of this.active){try{a.stop();}catch(e){}}this.active.clear();}
 }
 K.Sounds=Sounds;
})(window.KOMA);
