// 入力: キーボード＋ゲームパッドを「行動」に束ねる。毎フレーム update() で押した瞬間(pressed)を確定する。
(function (K) {
  const MAP = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyK', 'ArrowUp', 'KeyW'],
    attack: ['KeyZ', 'KeyJ'],          // Aボタン: 七星剣
    sub: ['KeyX', 'KeyL'],             // Bボタン: セレクトアイテム（投擲）
    pause: ['Enter', 'KeyP'],          // ポーズ（単発アイテムの選択）
    cycle: ['KeyC'],                   // 訓練場専用: セレクトアイテムを順に切り替える
  };
  class Input {
    constructor() {
      this.keys = {}; this.down = {}; this.pressed = {}; this.prev = {}; this.pointers = new Map();
      this.pendingPointers = new Map(); this.pendingKeys = new Set(); this.clicks = new Set();
      for (const a in MAP) { this.down[a] = false; this.pressed[a] = false; this.prev[a] = false; }
      const block = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
      window.addEventListener('keydown', e => {
        if (e.target && /^(INPUT|SELECT|TEXTAREA|SUMMARY|A)$/.test(e.target.tagName)) return;
        if (e.target && e.target.tagName === 'BUTTON' && (!e.target.dataset.komaAction || e.code === 'Enter' || e.code === 'Space')) return;
        if (!this.keys[e.code]) this.pendingKeys.add(e.code);
        this.keys[e.code] = true; if (block.has(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', e => { this.keys[e.code] = false; });
      const reset = () => {
        this.keys = {}; this.pointers.clear(); this.pendingPointers.clear(); this.pendingKeys.clear(); this.clicks.clear();
        document.querySelectorAll('[data-koma-action]').forEach(b => b.classList.remove('held'));
      };
      window.addEventListener('blur', reset);
      document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
      document.querySelectorAll('[data-koma-action]').forEach(button => {
        const action = button.dataset.komaAction;
        if (!Object.prototype.hasOwnProperty.call(MAP, action)) return;
        button.addEventListener('pointerdown', e => {
          if (e.button !== 0) return;
          e.preventDefault();
          button.setPointerCapture(e.pointerId);
          this.pointers.set(e.pointerId, action);
          this.pendingPointers.set(e.pointerId, action);
          button.classList.add('held');
        });
        const release = e => {
          const held = this.pointers.delete(e.pointerId);
          if (e.type === 'pointercancel' || (e.type === 'lostpointercapture' && held)) this.pendingPointers.delete(e.pointerId);
          if (![...this.pointers.values()].includes(action)) button.classList.remove('held');
        };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
        button.addEventListener('contextmenu', e => e.preventDefault());
        // キーボード・支援技術による標準のボタン操作。ポインター由来のclickは二重登録しない。
        button.addEventListener('click', e => { if (e.detail === 0) this.clicks.add(action); });
      });
    }
    pad() {
      const r = {}; let gp = null;
      try { gp = (navigator.getGamepads && navigator.getGamepads() || [])[0]; } catch (e) { gp = null; }
      if (!gp) return r;
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      r.left = b(14) || gp.axes[0] < -0.5; r.right = b(15) || gp.axes[0] > 0.5;
      r.up = b(12) || gp.axes[1] < -0.6; r.down = b(13) || gp.axes[1] > 0.6;
      r.jump = b(0); r.attack = b(2); r.sub = b(1); r.pause = b(9); r.cycle = b(3);
      return r;
    }
    update() {
      const pd = this.pad(), touch = new Set([...this.pointers.values(), ...this.pendingPointers.values(), ...this.clicks]);
      for (const a in MAP) {
        const cur = MAP[a].some(c => this.keys[c] || this.pendingKeys.has(c)) || !!pd[a] || touch.has(a);
        this.pressed[a] = cur && !this.prev[a];
        this.prev[a] = cur; this.down[a] = cur;
      }
      this.pendingPointers.clear(); this.pendingKeys.clear(); this.clicks.clear();
    }
    // 検査用: キーを直接押し/離す
    set(code, on) { this.keys[code] = on; }
  }
  K.Input = Input;
})(window.KOMA);
