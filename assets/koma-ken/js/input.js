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
      this.keys = {}; this.down = {}; this.pressed = {}; this.prev = {};
      for (const a in MAP) { this.down[a] = false; this.pressed[a] = false; this.prev[a] = false; }
      const block = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
      window.addEventListener('keydown', e => { this.keys[e.code] = true; if (block.has(e.code)) e.preventDefault(); });
      window.addEventListener('keyup', e => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = {}; });
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
      const pd = this.pad();
      for (const a in MAP) {
        const cur = MAP[a].some(c => this.keys[c]) || !!pd[a];
        this.pressed[a] = cur && !this.prev[a];
        this.prev[a] = cur; this.down[a] = cur;
      }
    }
    // 検査用: キーを直接押し/離す
    set(code, on) { this.keys[code] = on; }
  }
  K.Input = Input;
})(window.KOMA);
