/* =========================================================================
 * GameKit — hide_0001 ポートフォリオ用 Canvas マイクロエンジン
 * GameKit — Canvas micro-engine for the hide_0001 portfolio
 *
 * 方針 / Policy:
 *  - フレームワーク不使用・ビルド不要。<script src="gamekit/gamekit.js"> で読み込むだけ
 *  - Canvas API のみ。DOM はキャンバス1枚あれば動く
 *  - ダーク背景 + シアン/パープルのアクセント（サイバーパンク演出は不可）
 *
 * 使い方 / Usage:
 *   const game = new GameKit.Engine(canvas, { width: 960, height: 540 });
 *   game.changeScene(new TitleScene());
 *   game.start();
 * ========================================================================= */
(function (global) {
  'use strict';

  const GameKit = {};

  /* ----------------------------------------------------------------------
   * Engine — ゲームループ + シーン管理
   * deltaTime はフレームレート非依存（秒単位・0.1sでキャップ）
   * -------------------------------------------------------------------- */
  class Engine {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.width = opts.width || canvas.width;
      this.height = opts.height || canvas.height;
      canvas.width = this.width;
      canvas.height = this.height;
      this.scene = null;
      this.isPaused = false;
      this.input = new Input(canvas);
      this.audio = new Sfx();
      this._last = 0;
      this._raf = 0;
      this._running = false;
    }

    changeScene(next) {
      if (this.scene && this.scene.exit) this.scene.exit(this);
      this.scene = next;
      if (next && next.enter) next.enter(this);
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._last = performance.now();
      const loop = (t) => {
        if (!this._running) return;
        const dt = Math.min((t - this._last) / 1000, 0.1);
        this._last = t;
        if (!this.isPaused && this.scene) {
          this.scene.update(dt, this);
          this.scene.draw(this.ctx, this);
        }
        this.input.endFrame();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    stop() {
      this._running = false;
      cancelAnimationFrame(this._raf);
    }
  }
  GameKit.Engine = Engine;

  /* ----------------------------------------------------------------------
   * Scene — 基底クラス。enter/exit/update/draw を上書きして使う
   * -------------------------------------------------------------------- */
  class Scene {
    enter(game) {}
    exit(game) {}
    update(dt, game) {}
    draw(ctx, game) {}
  }
  GameKit.Scene = Scene;

  /* ----------------------------------------------------------------------
   * Input — キーボード + ポインタ（マウス/タッチ統合）
   *   isDown('ArrowLeft') : 押下中
   *   justPressed('Space'): このフレームで押された
   *   pointer: { x, y, isDown, justPressed }（キャンバス座標系に変換済み）
   * -------------------------------------------------------------------- */
  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this._down = new Set();
      this._pressed = new Set();
      this.pointer = { x: 0, y: 0, isDown: false, justPressed: false };

      global.addEventListener('keydown', (e) => {
        if (!this._down.has(e.code)) this._pressed.add(e.code);
        this._down.add(e.code);
        // ゲーム操作キーのスクロールを抑止
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
      });
      global.addEventListener('keyup', (e) => this._down.delete(e.code));

      const toLocal = (e) => {
        const r = canvas.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return {
          x: ((p.clientX - r.left) / r.width) * canvas.width,
          y: ((p.clientY - r.top) / r.height) * canvas.height,
        };
      };
      const down = (e) => {
        const p = toLocal(e);
        Object.assign(this.pointer, p, { isDown: true, justPressed: true });
        if (e.touches) e.preventDefault();
      };
      const move = (e) => {
        if (e.touches && !this.pointer.isDown) return;
        Object.assign(this.pointer, toLocal(e));
      };
      const up = () => { this.pointer.isDown = false; };
      canvas.addEventListener('mousedown', down);
      canvas.addEventListener('mousemove', move);
      global.addEventListener('mouseup', up);
      canvas.addEventListener('touchstart', down, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', up);
    }

    isDown(code) { return this._down.has(code); }
    justPressed(code) { return this._pressed.has(code); }
    /** 方向入力を {x,y} (-1..1) で返す（矢印 + WASD） */
    axis() {
      const x = (this.isDown('ArrowRight') || this.isDown('KeyD') ? 1 : 0)
              - (this.isDown('ArrowLeft') || this.isDown('KeyA') ? 1 : 0);
      const y = (this.isDown('ArrowDown') || this.isDown('KeyS') ? 1 : 0)
              - (this.isDown('ArrowUp') || this.isDown('KeyW') ? 1 : 0);
      return { x, y };
    }
    endFrame() {
      this._pressed.clear();
      this.pointer.justPressed = false;
    }
  }
  GameKit.Input = Input;

  /* ----------------------------------------------------------------------
   * Assets — 画像/JSON のプリロード（404 は reject して検知可能にする）
   *   const img = await GameKit.Assets.loadImages({ hero: 'assets/art/hero.png' });
   * -------------------------------------------------------------------- */
  GameKit.Assets = {
    loadImages(map) {
      const entries = Object.entries(map).map(([name, url]) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([name, img]);
          img.onerror = () => reject(new Error('画像の読み込みに失敗 / failed to load: ' + url));
          img.src = url;
        })
      );
      return Promise.all(entries).then((pairs) => Object.fromEntries(pairs));
    },
    loadJSON(url) {
      return fetch(url).then((r) => {
        if (!r.ok) throw new Error('JSONの読み込みに失敗 / failed to load: ' + url);
        return r.json();
      });
    },
  };

  /* ----------------------------------------------------------------------
   * Sprite — スプライトシートのフレームアニメーション
   *   new Sprite(img, { fw: 32, fh: 32, frames: 4, fps: 8 })
   * -------------------------------------------------------------------- */
  class Sprite {
    constructor(img, opts) {
      this.img = img;
      this.fw = opts.fw;
      this.fh = opts.fh;
      this.frames = opts.frames;
      this.fps = opts.fps || 8;
      this.t = 0;
    }
    update(dt) { this.t += dt; }
    draw(ctx, x, y, w, h) {
      const i = Math.floor(this.t * this.fps) % this.frames;
      const cols = Math.floor(this.img.width / this.fw);
      const sx = (i % cols) * this.fw;
      const sy = Math.floor(i / cols) * this.fh;
      ctx.drawImage(this.img, sx, sy, this.fw, this.fh, x, y, w || this.fw, h || this.fh);
    }
  }
  GameKit.Sprite = Sprite;

  /* ----------------------------------------------------------------------
   * Collision — 衝突判定（game-dev スキル準拠）
   * -------------------------------------------------------------------- */
  GameKit.Collision = {
    aabb(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    },
    circles(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
    },
    rectCircle(rect, c) {
      const nx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
      const ny = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
      return Math.hypot(c.x - nx, c.y - ny) < c.r;
    },
  };

  /* ----------------------------------------------------------------------
   * Sfx — Web Audio API プロシージャル効果音（音声ファイル不要）
   * Music-Generator エージェントの納品コードもここに統合できる
   * -------------------------------------------------------------------- */
  class Sfx {
    constructor() { this._ctx = null; }
    _ac() {
      // AudioContext はユーザー操作後に生成（autoplay 制限対策）
      if (!this._ctx) this._ctx = new (global.AudioContext || global.webkitAudioContext)();
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }
    /** 単音ビープ。type: 'sine'|'square'|'triangle'|'sawtooth' */
    beep(freq = 440, dur = 0.12, type = 'sine', vol = 0.2) {
      const ac = this._ac();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    }
    /** ノイズバースト（ヒット/爆発用） */
    noise(dur = 0.2, vol = 0.25) {
      const ac = this._ac();
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      const gain = ac.createGain();
      gain.gain.value = vol;
      src.buffer = buf;
      src.connect(gain).connect(ac.destination);
      src.start();
    }
    /** 音符列ジングル。notes: [{f: 周波数, d: 長さ秒}] */
    jingle(notes, type = 'triangle', vol = 0.18) {
      const ac = this._ac();
      let t = ac.currentTime;
      for (const n of notes) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.value = n.f;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + n.d);
        t += n.d;
      }
    }
  }
  GameKit.Sfx = Sfx;

  /* ----------------------------------------------------------------------
   * Particles — アンビエントパーティクル（ポートフォリオ共通の背景演出）
   * -------------------------------------------------------------------- */
  class Particles {
    constructor(w, h, opts = {}) {
      this.w = w;
      this.h = h;
      this.colors = opts.colors || ['#22d3ee', '#a78bfa'];
      this.items = Array.from({ length: opts.count || 60 }, () => this._spawn());
    }
    _spawn() {
      return {
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 0.5 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 18,
        c: this.colors[(Math.random() * this.colors.length) | 0],
        a: 0.15 + Math.random() * 0.45,
      };
    }
    update(dt) {
      for (const p of this.items) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0) p.x += this.w; else if (p.x > this.w) p.x -= this.w;
        if (p.y < 0) p.y += this.h; else if (p.y > this.h) p.y -= this.h;
      }
    }
    draw(ctx) {
      for (const p of this.items) {
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  GameKit.Particles = Particles;

  /* ----------------------------------------------------------------------
   * UI — Glassmorphism パネルとテキスト描画
   * -------------------------------------------------------------------- */
  GameKit.UI = {
    glassPanel(ctx, x, y, w, h, opts = {}) {
      const r = opts.radius || 14;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = opts.fill || 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = opts.stroke || 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    },
    text(ctx, str, x, y, opts = {}) {
      ctx.save();
      ctx.font = opts.font || '16px "Segoe UI", "Hiragino Sans", sans-serif';
      ctx.fillStyle = opts.color || '#e2e8f0';
      ctx.textAlign = opts.align || 'center';
      ctx.textBaseline = opts.baseline || 'top';
      ctx.fillText(str, x, y);
      ctx.restore();
    },
  };

  /* ----------------------------------------------------------------------
   * Save — localStorage ラッパー（ゲームごとに名前空間を分ける）
   * -------------------------------------------------------------------- */
  class Save {
    constructor(ns) { this.ns = 'gamekit:' + ns + ':'; }
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(this.ns + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    }
    set(key, value) {
      try { localStorage.setItem(this.ns + key, JSON.stringify(value)); } catch (e) {}
    }
  }
  GameKit.Save = Save;

  /* Math ユーティリティ */
  GameKit.MathX = {
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (lo, hi) => lo + Math.random() * (hi - lo),
  };

  global.GameKit = GameKit;
})(window);
