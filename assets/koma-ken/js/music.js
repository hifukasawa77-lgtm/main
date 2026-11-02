// BGM: Web Audio で合成するオリジナルの短い旋律。外部の音声ファイル・通信・タイマーは使わない（毎フレームの update で進める）。
(function(K){
 // MIDIノート番号。0は休符。
 const TUNES={
  title:[57,64,67,64,60,67,69,67,59,66,69,66,64,62,60,59],
  stage:[57,60,64,69,67,64,60,64,55,59,62,67,64,62,59,55],
  boss:[45,57,48,60,46,58,52,64,45,57,51,63,52,64,48,60],
  gate:[69,0,72,76,74,0,72,67,69,0,64,67,72,0,71,67],
  clear:[60,64,67,72,76,72,79,0],
  ending:[60,67,72,76,74,72,67,64,62,69,74,77,76,72,71,72],
  over:[64,62,60,59,57,0,45,0]
 };
 // 場面ごとの設定: [旋律, 1音の秒数, 移調(半音), 音色, 1回だけ鳴らすか]
 const TRACKS={
  title:['title',.28,0,'triangle',1],
  stage1:['stage',.23,0,'triangle',0],stage2:['stage',.21,2,'triangle',0],stage3:['stage',.2,-3,'triangle',0],stage4:['stage',.19,5,'triangle',0],
  gate:['gate',.2,0,'triangle',0],gate_boss:['boss',.18,0,'triangle',0],boss:['boss',.15,0,'triangle',0],
  ending:['ending',.3,0,'triangle',1],over:['over',.35,0,'triangle',1],clear:['clear',.2,0,'triangle',1],
  fly:['gate',.14,7,'square',0],dragon:['boss',.13,3,'sawtooth',0],chibi:['stage',.12,12,'triangle',0],
  invincible1:['stage',.1,5,'square',0],invincible2:['stage',.1,7,'square',0]
 };
 class Music{
  constructor(){
   this.enabled=true;this.volume=.3;this.available=K.audioSupported;this.unlocked=false;this.track=null;this.lastGame=null;this.hidden=false;
   this.error=null;this.silenceUntil=0;this.master=null;this.voices=new Set();this.beat=0;this.next=0;
  }
  choose(g){
   if(!g||(g.state==='title'||g.state==='intro'))return 'title';if(g.state==='ending')return 'ending';if(g.state==='over')return 'over';if(g.state==='clear')return 'clear';
   if(g.roomBoss)return 'gate_boss';if(g.boss)return 'boss';if(g.room)return 'gate';
   const fx=g.player&&g.player.fx||{};if(fx.dragon>0)return 'dragon';if(fx.fly>0)return 'fly';if(fx.mini>0)return 'chibi';if(fx.gold>0)return 'invincible1';
   const id=g.stage&&g.stage.id||'r1s1';return /^r2/.test(id)?'stage2':/^r3/.test(id)?'stage3':/^r4/.test(id)?'stage4':'stage1';
  }
  async unlock(){
   this.unlocked=true;
   const ctx=K.audioContext(true);
   if(!ctx){this.available=false;return false;}
   if(!this.master){this.master=ctx.createGain();this.master.gain.value=this.volume;this.master.connect(ctx.destination);}
   try{if(ctx.state==='suspended')await ctx.resume();this.error=null;}catch(e){this.error='クリックしてBGMを開始してください';return false;}
   this.update(this.lastGame,this.hidden);
   return ctx.state==='running';
  }
  setVolume(value){const n=Number(value);if(Number.isFinite(n))this.volume=Math.max(0,Math.min(.7,n));if(this.master)this.master.gain.value=this.volume;}
  mute(){this.enabled=!this.enabled;if(!this.enabled)this.stopVoices();this.update(this.lastGame,this.hidden);}
  stopVoices(){for(const v of this.voices){try{v.stop();}catch(e){}}this.voices.clear();}
  tone(ctx,hz,dur,type,level){
   if(this.voices.size>=24)return;
   const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
   o.type=type;o.frequency.setValueAtTime(hz,t);
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
   o.connect(g);g.connect(this.master);this.voices.add(o);
   o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();};
   o.start(t);o.stop(t+dur+.02);
  }
  update(g,hidden){
   this.lastGame=g;this.hidden=!!hidden;const wanted=this.choose(g);
   if(this.track!==wanted){this.stopVoices();this.track=wanted;this.beat=0;this.next=0;}
   const paused=this.hidden||!this.enabled||(g&&(g.state==='pause'||g.state==='intro'))||Date.now()<this.silenceUntil;
   if(paused){if(this.voices.size)this.stopVoices();return;}
   const ctx=K.audioContext(false);
   if(!this.unlocked||!ctx||!this.master||ctx.state!=='running')return;
   const now=ctx.currentTime;if(now<this.next)return;
   const [name,sec,shift,type,once]=TRACKS[wanted],tune=TUNES[name];
   if(once&&this.beat>=tune.length){this.next=Infinity;return;}
   const note=tune[this.beat%tune.length];this.beat++;this.next=now+sec;
   if(note){
    const hz=440*Math.pow(2,(note+shift-69)/12);
    this.tone(ctx,hz,sec*.8,type,.08);
    if(this.beat%2===1)this.tone(ctx,hz/4,sec*1.5,'triangle',.05);
   }
  }
 }
 K.Music=Music;
})(window.KOMA);
