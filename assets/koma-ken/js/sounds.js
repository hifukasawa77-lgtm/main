(function(K){
 class Sounds{
  constructor(){this.enabled=true;this.unlocked=false;this.volume=.55;this.active=new Set();this.last={};this.error=null;}
  unlock(){this.unlocked=true;}
  setVolume(value){const n=Number(value);if(Number.isFinite(n))this.volume=Math.max(0,Math.min(1,n));for(const a of this.active)a.volume=this.volume;}
  mute(){this.enabled=!this.enabled;if(!this.enabled)this.stopAll();}
  play(key){
   if(!this.unlocked||!this.enabled||this.volume===0)return;
   const now=Date.now();if(now-(this.last[key]||0)<45)return;this.last[key]=now;
   if(this.active.size>=8){const first=this.active.values().next().value;first.pause();this.active.delete(first);}
   if(key==='death')this.stopAll();
   const file={sword:'sword-v2',shot:'shot-v2',enemy_down:'enemy_down-v2'}[key]||key;
   const a=new Audio('assets/koma-ken/audio/sfx/'+file+'.mp3');a.volume=this.volume;this.active.add(a);
   const done=()=>{this.active.delete(a);};a.addEventListener('ended',done,{once:true});a.addEventListener('error',()=>{done();this.error='効果音を読み込めませんでした';},{once:true});
   const p=a.play();if(p&&p.catch)p.catch(()=>{done();this.error='効果音を開始できませんでした';});
  }
  stopAll(){for(const a of this.active)a.pause();this.active.clear();}
 }
 K.Sounds=Sounds;
})(window.KOMA);
