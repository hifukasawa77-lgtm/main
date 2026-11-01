// Web Audioで合成するオリジナルの短い旋律と効果音。外部音源・タイマーは使わない。
(function (K) {
  const KEY = 'koma-ken.audio.v1';
  const TUNES = {
    title: [57, 64, 67, 64, 60, 67, 69, 67, 59, 66, 69, 66, 64, 62, 60, 59],
    stage: [57, 60, 64, 69, 67, 64, 60, 64, 55, 59, 62, 67, 64, 62, 59, 55],
    boss: [45, 57, 48, 60, 46, 58, 52, 64, 45, 57, 51, 63, 52, 64, 48, 60],
    gate: [69, 0, 72, 76, 74, 0, 72, 67, 69, 0, 64, 67, 72, 0, 71, 67],
    clear: [60, 64, 67, 72, 76, 72, 79, 0],
    ending: [60, 67, 72, 76, 74, 72, 67, 64, 62, 69, 74, 77, 76, 72, 71, 72],
    over: [64, 62, 60, 59, 57, 0, 45, 0],
  };
  const FX = { sword: [1000, 180, .07], sub: [660, 330, .1], hit: [220, 90, .13],
    pickup: [660, 1320, .16], hurt: [170, 55, .2], defeat: [150, 40, .3], clear: [523, 1046, .35] };
  class Audio {
    constructor() {
      this.mode = 'off'; this.volume = .3; this.ctx = null; this.master = null;
      this.voices = new Set(); this.music = new Set(); this.lastFx = {}; this.scene = ''; this.beat = 0; this.next = 0; this.blocked = false;
      this.supported = !!(window.AudioContext || window.webkitAudioContext);
      try {
        const s = JSON.parse(window.localStorage.getItem(KEY));
        if (s && ['off', 'effects', 'all'].includes(s.mode)) this.mode = s.mode;
        if (s && typeof s.volume === 'number' && Number.isFinite(s.volume) && s.volume >= 0 && s.volume <= 1) this.volume = s.volume;
      } catch (e) { /* 保存不可でも操作できる */ }
      const suspend = () => { this.blocked = true; this.stop(); };
      window.addEventListener('blur', suspend);
      window.addEventListener('focus', () => { this.blocked = document.hidden; });
      document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else this.blocked = false; });
    }
    persist() { try { window.localStorage.setItem(KEY, JSON.stringify({ mode: this.mode, volume: this.volume })); } catch (e) {} }
    unlock() {
      if (!this.supported || this.mode === 'off') return;
      try {
        if (!this.ctx) {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
          this.master.connect(this.ctx.destination);
        }
        const pending = this.ctx.resume();
        if (pending && pending.catch) pending.catch(() => {});
      } catch (e) { this.supported = false; }
    }
    setMode(mode) {
      if (!['off', 'effects', 'all'].includes(mode)) return;
      this.mode = mode; this.stop();
      if (this.master) this.master.gain.value = mode === 'off' ? 0 : this.volume;
      this.persist(); this.unlock();
    }
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      this.volume = K.clamp(value, 0, 1);
      if (this.master) this.master.gain.setTargetAtTime(this.mode === 'off' ? 0 : this.volume, this.ctx.currentTime, .01);
      this.persist();
    }
    stop() {
      for (const v of this.voices) { try { v.stop(); } catch (e) {} }
      this.voices.clear(); this.music.clear(); this.scene = ''; this.beat = 0; this.next = 0;
    }
    stopMusic() {
      for (const v of this.music) { try { v.stop(); } catch (e) {} this.voices.delete(v); }
      this.music.clear(); this.scene = ''; this.beat = 0; this.next = 0;
    }
    tone(hz, endHz, duration, type, level, music) {
      if (!this.ctx || !this.master || this.ctx.state !== 'running' || this.mode === 'off' || this.blocked || this.voices.size >= 24) return;
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), gain = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(endHz, t + duration);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(level, t + .004); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      o.connect(gain); gain.connect(this.master); this.voices.add(o);
      if (music) this.music.add(o);
      o.onended = () => { this.voices.delete(o); this.music.delete(o); o.disconnect(); gain.disconnect(); };
      o.start(t); o.stop(t + duration + .01);
    }
    effect(id) {
      if (!this.ctx || this.mode === 'off' || this.blocked) return;
      const f = FX[id], now = this.ctx.currentTime;
      if (!f || now - (this.lastFx[id] ?? -1) < .045) return;
      this.lastFx[id] = now; this.tone(f[0], f[1], f[2], id === 'pickup' || id === 'clear' ? 'triangle' : 'square', .14);
    }
    sync(game) {
      if (game.state === 'pause' || this.blocked) { if (this.voices.size || this.scene) this.stop(); return; }
      const scene = game.state === 'play' ? (game.room ? 'gate' : game.boss ? 'boss' : 'stage') : game.state;
      if (this.mode !== 'all' || this.blocked || !TUNES[scene] || !this.ctx || this.ctx.state !== 'running') {
        if (this.scene) this.stopMusic();
        return;
      }
      if (scene !== this.scene) { this.stopMusic(); this.scene = scene; }
      const now = this.ctx.currentTime;
      if (now < this.next) return;
      const tune = TUNES[scene], beat = this.beat++;
      if ((scene === 'clear' || scene === 'over') && beat >= tune.length) { this.next = Infinity; return; }
      const note = tune[beat % tune.length], seconds = scene === 'boss' ? .15 : .23;
      this.next = now + seconds;
      if (note) {
        const hz = 440 * Math.pow(2, (note - 69) / 12);
        this.tone(hz, hz, seconds * .8, 'triangle', .08, true);
        if (beat % 2 === 0) this.tone(hz / 4, hz / 4, seconds * 1.5, 'triangle', .05, true);
      }
    }
  }
  K.Audio = Audio;
})(window.KOMA);
