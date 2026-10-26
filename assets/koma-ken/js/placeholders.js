// 仮描画（画像が無いとき・初期状態）。AssetManager に登録して使う。画像を差し替えると自動で使われなくなる。
(function (K) {
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function player(ctx, x, y, o) {
    const crouch = o.state && o.state.crouch, h = crouch ? 18 : 28, f = o.flip ? -1 : 1;
    ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.translate(Math.round(x), Math.round(y)); ctx.scale(f, 1);
    const dragon = o.anim === 'dragon';
    rect(ctx, -6, -h, 12, h, dragon ? '#3fd0a8' : (o.anim === 'hurt' ? '#ff9090' : '#e8e0d0'));
    rect(ctx, -6, -h, 12, 6, '#c03030');                 // 鉢巻
    rect(ctx, 1, -h + 8, 3, 3, '#202020');               // 目
    if (o.state && o.state.atk > 4 && o.state.atk <= 11) {   // 七星剣
      rect(ctx, 4, crouch ? -14 : -22, 26, 5, '#d8f0ff'); rect(ctx, 4, crouch ? -14 : -22, 26, 1, '#ffffff');
    }
    ctx.restore();
  }
  function enemy(ctx, x, y, o, key) {
    const e = o.state; if (!e) return;
    ctx.save(); if (e.flash > 0 && (e.flash & 1)) ctx.globalAlpha = 0.45;
    ctx.translate(Math.round(x), Math.round(y)); if (o.flip) ctx.scale(-1, 1);
    rect(ctx, -e.w / 2, -e.h, e.w, e.h, e.def.color);
    rect(ctx, 1, -e.h + 5, 3, 3, '#101010');
    // 属性の目印（頭の色帯）。仮描画でも相性が見分けられるように
    if (e.tags.length) rect(ctx, -e.w / 2, -e.h, e.w, 3, { FIRE: '#ff2a00', ICE: '#00a8ff', ARMOR: '#ffffff', UNDEAD: '#8000ff', WATER: '#0050ff', CAVE: '#ffcc00' }[e.tags[0]]);
    ctx.restore();
    // 体力バー
    if (e.hp < e.maxHp) { rect(ctx, x - 8, y - e.h - 5, 16, 2, '#400'); rect(ctx, x - 8, y - e.h - 5, 16 * Math.max(0, e.hp) / e.maxHp, 2, '#4f4'); }
  }
  function shot(ctx, x, y, o) { const c = o.color || '#fff'; rect(ctx, x - 3, y - 3, 6, 6, c); rect(ctx, x - 1, y - 1, 2, 2, '#fff'); }
  function eshot(ctx, x, y) { rect(ctx, x - 3, y - 3, 6, 6, '#ff3030'); rect(ctx, x - 1, y - 1, 2, 2, '#ffd0d0'); }
  function item(ctx, x, y, o) {
    const c = { auto: '#60d060', instant: '#ffd040', select: '#40c0ff', single: '#ff80ff' }[o.cat] || '#fff';
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y - 8), 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#101010'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText((o.label || '?').slice(0, 1), Math.round(x), Math.round(y - 5));
  }
  function gate(ctx, x, y) { rect(ctx, x - 20, y - 56, 40, 56, '#503020'); rect(ctx, x - 14, y - 50, 28, 50, '#100808'); }
  // ボス（仮描画）。種類ごとの目印を付けて、弱点の癖が画面から読めるようにする
  function boss(ctx, x, y, o) {
    const e = o.state; if (!e) return;
    ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha; if (e.flash > 0 && (e.flash & 1)) ctx.globalAlpha = 0.5;
    ctx.translate(Math.round(x), Math.round(y)); if (o.flip) ctx.scale(-1, 1);
    const w = e.w, h = e.h, c = e.def.color;
    rect(ctx, -w / 2, -h, w, h, c);
    rect(ctx, w / 2 - 8, -h + 8, 4, 4, '#ffe040'); rect(ctx, w / 2 - 15, -h + 8, 4, 4, '#ffe040');   // 目
    if (e.kind === 'guardian') rect(ctx, -w / 2, -h, w, 24, '#e8a070');                                // 頭（ここだけ有効）
    if (e.kind === 'oni') rect(ctx, -w / 2, -h + 14, 5, h - 28, '#ffd0e0');                            // 背中（弱点）
    if (e.kind === 'monk' && e.st === 'spin') { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -h / 2, w * 0.8, e.t / 2, e.t / 2 + 4.5); ctx.stroke(); }
    if (e.kind === 'matron' && e.ring) { ctx.strokeStyle = '#d070ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -h / 2, Math.max(w, h) * 0.7, 0, 7); ctx.stroke(); }
    if (e.kind === 'armor') rect(ctx, w / 2 - 14, -h + 20, 10, 10, '#ff9040');                         // 胸の顔
    if (e.kind === 'overlord') { rect(ctx, -w / 2 - 6, -h - 8, 8, 14, '#d8d0b0'); rect(ctx, w / 2 - 2, -h - 8, 8, 14, '#d8d0b0'); }
    ctx.restore();
  }
  function generic(ctx, x, y, o, key) { rect(ctx, x - 8, y - 16, 16, 16, '#ff00ff'); }

  K.installPlaceholders = function (assets) {
    assets.registerPlaceholder('player', player);
    ['enemy_plain', 'enemy_ember', 'enemy_frost', 'enemy_knight', 'enemy_ghoul', 'enemy_naga', 'enemy_bat'].forEach(function (k) { assets.registerPlaceholder(k, enemy); });
    assets.registerPlaceholder('shot_orb', shot); assets.registerPlaceholder('enemy_shot', eshot);
    assets.registerPlaceholder('item', item); assets.registerPlaceholder('gate', gate);
    ['r1s1', 'r1s2', 'r1s3', 'r1s4', 'r2s1', 'r2s2', 'r2s3', 'r2s4', 'r3s1', 'r3s2', 'r3s3', 'r3s4', 'r4s1'].forEach(function (id) { assets.registerPlaceholder('boss_' + id, boss); });
    assets.registerPlaceholder('*', generic);
  };

  // 背景の仮描画（画像が無いとき）。遠景のゆるい帯と地面
  K.drawBackgroundPlaceholder = function (ctx, camX, stage) {
    const th = stage.theme || { sky: ['#0a0818', '#2a1838'], far: '#1a1028', ground: '#3a2a1a' };
    const g = ctx.createLinearGradient(0, 0, 0, K.GROUND);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, K.W, K.H);
    ctx.fillStyle = th.far;
    for (let i = -1; i < 8; i++) { const bx = i * 48 - (camX * 0.5 % 48); ctx.fillRect(bx, K.GROUND - 60 - ((i * 37) % 30), 30, 70); }
    ctx.fillStyle = th.ground;
    const pits = stage.pits || [];
    let x0 = 0;
    for (const p of pits.concat([[stage.width + 1, stage.width + 1]])) {
      const a = Math.max(0, x0 - camX), b = Math.min(K.W, p[0] - camX);
      if (b > a) { ctx.fillRect(a, K.GROUND, b - a, K.H - K.GROUND); ctx.fillStyle = '#7a6a4a'; ctx.fillRect(a, K.GROUND, b - a, 3); ctx.fillStyle = th.ground; }
      x0 = p[1];
    }
    for (const p of stage.platforms || []) { ctx.fillStyle = '#6a5a3a'; ctx.fillRect(p.x - camX, p.y, p.w, 6); }
  };
})(window.KOMA);
