(function(K){
 const FILES={title:'title',stage1:'stage1',stage2:'stage2',stage3:'stage3',stage4:'stage4',gate:'gate',gate_boss:'gate_boss',boss:'boss',ending:'ending',over:'over',clear:'clear',fly:'fly',dragon:'dragon',chibi:'chibi',invincible1:'invincible1',invincible2:'invincible2'};
 const ONCE=new Set(['title','ending','over','clear']);
 class Music{
  constructor(){this.audio=new Audio();this.audio.preload='auto';this.enabled=true;this.volume=.3;this.available=true;this.unlocked=false;this.track=null;this.lastGame=null;this.hidden=false;this.audio.volume=this.volume;this.audio.addEventListener('error',()=>{this.error='BGMの音声ファイルを読み込めませんでした';});}
  choose(g){
   if(!g||g.state==='title')return 'title';if(g.state==='ending')return 'ending';if(g.state==='over')return 'over';if(g.state==='clear')return 'clear';
   if(g.roomBoss)return 'gate_boss';if(g.boss)return 'boss';if(g.room)return 'gate';
   const fx=g.player&&g.player.fx||{};if(fx.dragon>0)return 'dragon';if(fx.fly>0)return 'fly';if(fx.mini>0)return 'chibi';if(fx.gold>0)return 'invincible1';
   const id=g.stage&&g.stage.id||'r1s1';return /^r2/.test(id)?'stage2':/^r3/.test(id)?'stage3':/^r4/.test(id)?'stage4':'stage1';
  }
  async unlock(){this.unlocked=true;this.update(this.lastGame,this.hidden);if(!this.enabled||this.hidden||this.lastGame?.state==='pause'||Date.now()<(this.silenceUntil||0))return true;try{await this.audio.play();this.error=null;return true;}catch(e){this.error='クリックしてBGMを開始してください';return false;}}
  setVolume(value){const n=Number(value);if(Number.isFinite(n))this.volume=Math.max(0,Math.min(.7,n));this.audio.volume=this.volume;}
  mute(){this.enabled=!this.enabled;this.update(this.lastGame,this.hidden);}
  update(g,hidden){
   this.lastGame=g;this.hidden=!!hidden;const wanted=this.choose(g);
   if(this.track!==wanted){this.audio.pause();this.track=wanted;this.audio.src='assets/koma-ken/audio/'+FILES[wanted]+'.mp3';this.audio.loop=!ONCE.has(wanted);this.audio.currentTime=0;}
   const paused=this.hidden||!this.enabled||g?.state==='pause'||Date.now()<(this.silenceUntil||0);if(paused){if(!this.audio.paused)this.audio.pause();return;}
   if(this.unlocked&&this.audio.paused&&!this.audio.ended){const promise=this.audio.play();if(promise&&promise.catch)promise.catch(()=>{this.error='クリックしてBGMを開始してください';});}
  }
 }
 K.Music=Music;
})(window.KOMA);
