// アセット管理: 設定ファイル(assets_config.js)の画像を読み込み、描画を担う。ゲーム本体は画像の有無を知らなくてよい。
//  - 画像が無い/読めない → 登録済みの「仮描画」へ自動で落ちる（例外は出さず、status に理由を残す）
//  - 実行中に setSource() で差し替え可能（画像生成ツールの出力を試すとき用）
(function (K) {
  class AssetManager {
    constructor(config) {
      this.cfg = config; this.images = {}; this.status = {}; this.placeholders = {}; this.tick = 0;
    }
    entries() {
      const out = [];
      for (const k in this.cfg.sprites) out.push({ key: k, kind: 'sprite', def: this.cfg.sprites[k] });
      for (const k in this.cfg.backgrounds) out.push({ key: k, kind: 'background', def: this.cfg.backgrounds[k] });
      for (const k in this.cfg.ui) out.push({ key: k, kind: 'ui', def: this.cfg.ui[k] });
      return out;
    }
    def(key) { return this.cfg.sprites[key] || this.cfg.backgrounds[key] || this.cfg.ui[key] || null; }
    registerPlaceholder(key, fn) { this.placeholders[key] = fn; }

    loadOne(key, src) {
      return new Promise(resolve => {
        if (!src) { this.status[key] = 'placeholder'; resolve(false); return; }
        const img = new Image();
        const url = /^(https?:|data:|blob:|\/)/.test(src) ? src : this.cfg.basePath + src;
        img.onload = () => { this.images[key] = img; this.status[key] = 'loaded'; resolve(true); };
        img.onerror = () => { delete this.images[key]; this.status[key] = 'failed: ' + url; console.warn('[asset] 読めません → 仮描画で続行:', url); resolve(false); };
        img.src = url;
      });
    }
    async loadAll(onProgress) {
      const list = this.entries(); let done = 0;
      await Promise.all(list.map(async e => { await this.loadOne(e.key, e.def.src); done++; if (onProgress) onProgress(done, list.length); }));
    }
    // 実行中の差し替え。例: assets.setSource('player', 'player.webp')
    async setSource(key, src) {
      const d = this.def(key); if (!d) throw new Error('unknown asset key: ' + key);
      d.src = src; return this.loadOne(key, src);
    }
    has(key) { return !!this.images[key]; }
    summary() {
      let loaded = 0, ph = 0, failed = 0;
      for (const k in this.status) { const s = this.status[k]; if (s === 'loaded' || s === 'generated') loaded++; else if (s === 'placeholder') ph++; else failed++; }
      return { loaded: loaded, placeholder: ph, failed: failed, total: loaded + ph + failed };
    }

    // スプライト描画。x=足元中央 / y=足元。opts: {anim, flip, alpha, w, h, t, ...仮描画へ渡す任意の値}
    drawSprite(ctx, key, x, y, opts) {
      opts = opts || {}; const d = this.def(key); const img = this.images[key];
      if (img && d) {
        const an = (d.anims && d.anims[opts.anim || 'idle']) || { row: 0, frames: 1, fps: 1 };
        const t = opts.t != null ? opts.t : this.tick;
        const f = opts.frame != null ? Math.min(opts.frame, an.frames - 1) : (an.frames > 1 ? Math.floor(t * an.fps / K.FPS) % an.frames : 0);
        const fw = d.frameW, fh = d.frameH, dw = opts.w || d.drawW || fw, dh = opts.h || d.drawH || fh;
        ctx.save(); if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
        ctx.translate(Math.round(x), Math.round(y)); if (opts.flip) ctx.scale(-1, 1);
        ctx.drawImage(img, f * fw, an.row * fh, fw, fh, -dw / 2, -dh, dw, dh); ctx.restore();
        return;
      }
      const ph = this.placeholders[key] || this.placeholders['*'];
      if (ph) ph(ctx, x, y, opts, key);
    }
    // 背景・UIなど、矩形いっぱいに敷く画像。画像が無ければ false（呼び側が仮描画する）
    drawImage(ctx, key, dx, dy, dw, dh) {
      const img = this.images[key]; if (!img) return false;
      ctx.drawImage(img, dx, dy, dw || img.width, dh || img.height); return true;
    }
  }
  K.AssetManager = AssetManager;
})(window.KOMA);
