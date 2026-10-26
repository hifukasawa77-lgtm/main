// ゲーム本体: メインループ・戦闘判定・ポーズ(単発アイテム)・HUD。固定1/60秒の更新で、描画は画面に合わせて整数倍に拡大。
(function (K) {
  const SWORD = { dmg: 2 };            // 七星剣のダメージ（属性なし）
  const FALCON = { dmg: 1 }, FIREORB = { dmg: 2 };

  class Game {
    constructor(canvas, assets) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.assets = assets;
      canvas.width = K.W; canvas.height = K.H; this.ctx.imageSmoothingEnabled = false;
      this.input = new K.Input(); this.inv = new K.Inventory(); this.player = new K.Player(this);
      this.state = 'title'; this.tick = 0; this.score = 0; this.lives = 3; this.debug = false;
      this.stage = K.STAGES.training; this.enemies = []; this.shots = []; this.eshots = []; this.pickups = [];
      this.popups = []; this.msgs = []; this.queue = []; this.camX = 0; this.spawnHalt = 0; this.pauseIdx = 0; this.sparks = [];
    }

    // ---------- 開始 ----------
    start(stageId) {
      this.stage = K.STAGES[stageId] || K.STAGES.training;
      this.inv = new K.Inventory(); this.score = 0; this.lives = 3; this.tick = 0;
      this.player.reset(32);
      this.shots = []; this.eshots = []; this.popups = []; this.msgs = []; this.queue = []; this.sparks = []; this.spawnHalt = 0;
      this.enemies = this.stage.enemies.map(e => new K.Enemy(e.type, e.x, e.y));
      this.pickups = this.stage.pickups.map(p => ({ cat: p.cat, id: p.id, x: p.x, y: p.y != null ? p.y : K.GROUND, taken: false }));
      this.state = 'play'; this.camX = 0;
      this.msg(this.stage.name + '  ―  Z:剣  X:珠  Enter:ポーズ', 200);
    }

    // ---------- 地形 ----------
    inPit(x) { const p = this.stage.pits || []; for (let i = 0; i < p.length; i++) if (x >= p[i][0] && x <= p[i][1]) return true; return false; }
    // 落下中の足元 y0→y1 の間に床があれば、その高さ
    supportY(x, y0, y1) {
      let best = null;
      if (!this.inPit(x) && y0 <= K.GROUND && y1 >= K.GROUND) best = K.GROUND;
      for (const p of this.stage.platforms || [])
        if (x >= p.x && x <= p.x + p.w && y0 <= p.y && y1 >= p.y && (best == null || p.y < best)) best = p.y;
      return best;
    }

    msg(text, frames) { this.msgs.push({ text: text, life: frames || 120 }); if (this.msgs.length > 3) this.msgs.shift(); }

    // ---------- 攻撃 ----------
    fireSub(p) {
      const w = this.inv.select;
      let n = 0; for (const s of this.shots) if (s.sub && !s.dead) n++;
      if (n >= 3) return;
      const sp = w.pierce ? 3.4 : 2.8, y = p.y - (p.crouch ? 10 : 20);
      const s = new K.Shot(p.x + p.dir * 8, y, p.dir * sp, 0, w, { life: 90 }); s.sub = true; this.shots.push(s);
    }
    fireEight(p) {
      const w = { dmg: 1, color: '#ffd040' };
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        this.shots.push(new K.Shot(p.x, p.y - 14, Math.cos(a) * 2.4, Math.sin(a) * 2.4, w, { life: 50 }));
      }
    }
    damageEnemy(e, weapon, x, y) {
      if (e.dead) return;
      const r = K.calcDamage(weapon, e);
      const killed = e.hit(r.dmg);
      this.popups.push({ x: x != null ? x : e.x, y: y != null ? y : e.y - e.h, text: (Number.isInteger(r.dmg) ? r.dmg : r.dmg.toFixed(1)) + (r.weak ? ' 弱点!' : ''), weak: r.weak, life: 36 });
      if (killed) this.killEnemy(e);
    }
    killEnemy(e) {
      this.score += e.def.score; this.sparks.push({ x: e.x, y: e.y - e.h / 2, life: 14 });
      if (this.stage.respawn) this.queue.push({ type: e.type, x: e.x0, y: e.y0, at: this.tick + 360 });
    }
    onScreen(e) { return e.x >= this.camX - 8 && e.x <= this.camX + K.W + 8; }

    // ---------- 単発アイテム（ポーズ画面から） ----------
    useSingle(id) {
      const p = this.player, live = this.enemies.filter(e => !e.dead && this.onScreen(e));
      switch (id) {
        case 'fly': p.fx.fly = 480; break;
        case 'wind': live.forEach(e => this.damageEnemy(e, { dmg: 999 })); break;
        case 'fire': p.fx.orbit = 420; break;
        case 'bind': this.enemies.forEach(e => { e.frozen = 300; }); break;
        case 'escape': this.msg('ここでは使えない（冥府の門の中で使う）', 120); return false;
        case 'thunder': live.forEach(e => this.damageEnemy(e, { dmg: 12 })); break;
        case 'see': p.fx.see = 900; break;
        case 'halt': this.spawnHalt = 900; break;
        case 'aurora': this.shots.push(new K.Shot(p.x + p.dir * 16, p.y - 16, p.dir * 5, 0, { dmg: 8, pierce: true, color: '#aaffee' }, { w: 90, h: 14, life: 26 })); break;
        case 'bomb': live.forEach(e => this.damageEnemy(e, { dmg: 30 })); p.hp = 1; p.inv = 60; this.sparks.push({ x: p.x, y: p.y - 14, life: 20 }); break;
        default: return false;
      }
      this.msg(K.SINGLE[id].name, 90); return true;
    }

    // ---------- 取得 ----------
    applyPickup(pk) {
      const p = this.player;
      if (pk.cat === 'auto') { if (!this.inv.addAuto(pk.id)) return false; this.msg(K.AUTO[pk.id].name + ' を手に入れた', 100); }
      else if (pk.cat === 'instant') {
        const d = K.INSTANT[pk.id]; if (d.frames) p.fx[pk.id] = d.frames;
        if (d.score) this.score += d.score; if (d.life) this.lives += d.life;
        this.msg(d.name + '  ' + d.desc, 100);
      } else if (pk.cat === 'single') { if (!this.inv.addSingle(pk.id)) { this.msg('これ以上持てない', 80); return false; } this.msg(K.SINGLE[pk.id].name + ' を手に入れた', 100); }
      else if (pk.cat === 'select') { const i = K.SELECT.findIndex(s => s.id === pk.id); if (i >= 0) { this.inv.selectIndex = i; this.msg(K.SELECT[i].name, 100); } }
      return true;
    }

    // ---------- ミス・穴 ----------
    loseLife(fromPit) {
      const p = this.player;
      if (this.inv.consumeAuto('decoy')) {                       // 身代わり人形で復活
        p.hp = p.maxHp; p.inv = 120; this.msg('身代わり人形が身代わりになった', 120);
        if (fromPit) this.rescueFromPit();
        return;
      }
      this.lives--;
      if (this.lives < 0) { this.state = 'over'; return; }
      p.reset(32); p.inv = 120; this.shots = []; this.eshots = []; this.msg('ミス  残り ' + this.lives, 100);
    }
    // 穴から引き上げる。縁ぎりぎりに戻すと、右キーを押したままなら即座にまた落ちるので、少し手前へ置く
    rescueFromPit() { const p = this.player; p.x = Math.max(8, p.safeX - 30); p.y = 60; p.vy = 0; p.vx = 0; p.takeoffVx = 0; }
    playerDown() { this.loseLife(false); }
    fellInPit() {
      const p = this.player;
      if (this.inv.consumeAuto('peacock')) { this.rescueFromPit(); p.inv = 90; this.msg('金翅鳥が助けてくれた', 120); return; }
      this.loseLife(true);
    }

    // ---------- 更新 ----------
    update() {
      this.input.update(); const inp = this.input;
      if (inp.pressed.pause && (this.state === 'play' || this.state === 'pause')) { this.state = this.state === 'play' ? 'pause' : 'play'; this.pauseIdx = 0; }
      if (this.state === 'title') { if (inp.pressed.attack || inp.pressed.pause || inp.pressed.jump) this.start('training'); this.assets.tick++; return; }
      if (this.state === 'over') { if (inp.pressed.attack || inp.pressed.pause) this.state = 'title'; return; }
      if (this.state === 'pause') {
        const n = this.inv.single.length;
        if (n) {
          if (inp.pressed.down) this.pauseIdx = (this.pauseIdx + 1) % n;
          if (inp.pressed.up) this.pauseIdx = (this.pauseIdx + n - 1) % n;
          if (inp.pressed.attack) { const id = this.inv.single[this.pauseIdx]; if (this.useSingle(id)) { this.inv.takeSingle(this.pauseIdx); this.state = 'play'; } }
        }
        return;
      }
      this.tick++; this.assets.tick++;
      const p = this.player;
      if (inp.pressed.cycle && this.stage.respawn) { this.inv.cycleSelect(); this.msg(this.inv.select.name, 60); }
      p.update(inp);

      // 敵の更新と再出現
      for (const e of this.enemies) e.update(this);
      this.enemies = this.enemies.filter(e => !e.dead);
      if (this.spawnHalt > 0) this.spawnHalt--;
      else for (let i = this.queue.length - 1; i >= 0; i--) if (this.tick >= this.queue[i].at) { const q = this.queue.splice(i, 1)[0]; this.enemies.push(new K.Enemy(q.type, q.x, q.y)); }

      // 七星剣・旋風斬・分身の刃
      const boxes = p.swordBoxes();
      for (const e of this.enemies) {
        const eb = K.box(e);
        for (const b of boxes) {
          if (!K.overlap(b, eb)) continue;
          if (b.swing) { if (!p.swingHit.has(e)) { p.swingHit.add(e); this.damageEnemy(e, SWORD); } }
          else if (e.swordCd <= 0) { e.swordCd = 14; this.damageEnemy(e, SWORD); }
        }
        if (p.fx.falcon > 0) for (const b of p.bodies()) {
          if (K.overlap({ x: b.x - 12, y: b.y - 58, w: 24, h: 22 }, eb) && e.swordCd <= 0) { e.swordCd = 20; this.damageEnemy(e, FALCON); }
        }
        if (p.fx.orbit > 0) for (let k = 0; k < 4; k++) {
          const a = this.tick / 14 + k * Math.PI / 2, ox = p.x + Math.cos(a) * 26, oy = p.y - 16 + Math.sin(a) * 18;
          if (K.overlap({ x: ox - 5, y: oy - 5, w: 10, h: 10 }, eb) && e.swordCd <= 0) { e.swordCd = 14; this.damageEnemy(e, FIREORB); }
        }
      }
      this.enemies = this.enemies.filter(e => !e.dead);

      // 自分の弾
      for (const s of this.shots) {
        s.update(); const sb = s.box;
        for (const e of this.enemies) {
          if (s.dead && !s.pierce) break;
          if (e.dead || s.hit.has(e) || !K.overlap(sb, K.box(e))) continue;
          s.hit.add(e); this.damageEnemy(e, s.weapon, s.x, s.y - 4);
          if (!s.pierce) { s.dead = true; break; }
        }
        if (s.x < this.camX - 40 || s.x > this.camX + K.W + 40) s.dead = true;
      }
      this.shots = this.shots.filter(s => !s.dead); this.enemies = this.enemies.filter(e => !e.dead);

      // 敵の弾: 七星剣に触れると消える（バリア）。自分に当たるとダメージ
      for (const s of this.eshots) {
        s.update(); const sb = s.box;
        for (const b of boxes) if (K.overlap(b, sb)) { s.dead = true; this.sparks.push({ x: s.x, y: s.y, life: 8 }); break; }
        if (!s.dead && K.overlap(sb, p.hb)) { s.dead = true; p.hurtBy(); }
        if (s.x < this.camX - 40 || s.x > this.camX + K.W + 40) s.dead = true;
      }
      this.eshots = this.eshots.filter(s => !s.dead);
      // 敵との接触
      for (const e of this.enemies) if (!e.dead && K.overlap(p.hb, K.box(e))) p.hurtBy();

      // アイテム取得
      for (const pk of this.pickups) {
        if (pk.taken) continue;
        if (K.overlap(p.hb, { x: pk.x - 8, y: pk.y - 16, w: 16, h: 16 }) && this.applyPickup(pk)) pk.taken = true;
      }

      // 演出の寿命・カメラ
      for (const q of this.popups) { q.life--; q.y -= 0.3; } this.popups = this.popups.filter(q => q.life > 0);
      for (const q of this.sparks) q.life--; this.sparks = this.sparks.filter(q => q.life > 0);
      for (const m of this.msgs) m.life--; this.msgs = this.msgs.filter(m => m.life > 0);
      this.camX = K.clamp(p.x - 112, 0, this.stage.width - K.W);
    }

    // ---------- 描画 ----------
    txt(s, x, y, c, align) { const g = this.ctx; g.fillStyle = '#000'; g.textAlign = align || 'left'; g.fillText(s, x + 1, y + 1); g.fillStyle = c || '#fff'; g.fillText(s, x, y); }
    draw() {
      const g = this.ctx, A = this.assets, cam = Math.round(this.camX);
      g.font = '8px "MS Gothic", "Yu Gothic", monospace'; g.textBaseline = 'alphabetic';
      if (this.state === 'title') { this.drawTitle(); return; }
      const bgKey = this.stage.bg;
      if (!A.drawImage(g, bgKey, 0, 0, K.W, K.H)) K.drawBackgroundPlaceholder(g, cam, this.stage);

      for (const pk of this.pickups) if (!pk.taken) {
        const d = pk.cat === 'auto' ? K.AUTO[pk.id] : pk.cat === 'instant' ? K.INSTANT[pk.id] : pk.cat === 'single' ? K.SINGLE[pk.id] : K.SELECT.find(s => s.id === pk.id);
        if (pk.x - cam > -16 && pk.x - cam < K.W + 16) A.drawSprite(g, 'item', pk.x - cam, pk.y + Math.sin(this.tick / 12 + pk.x) * 2, { cat: pk.cat, label: d ? d.name : '?' });
      }
      for (const e of this.enemies) if (!e.invisible || this.player.fx.see > 0 || this.inv.auto.charm > 0)
        A.drawSprite(g, e.def.sprite, e.x - cam, e.y, { anim: e.def.ai === 'fly' ? 'fly' : 'walk', flip: e.dir < 0, t: e.t, state: e });
      for (const s of this.shots) A.drawSprite(g, 'shot_orb', s.x - cam, s.y, { color: s.weapon.color, w: s.w > 12 ? s.w : undefined, h: s.h > 12 ? s.h : undefined });
      for (const s of this.eshots) A.drawSprite(g, 'enemy_shot', s.x - cam, s.y, {});
      this.drawPlayer(cam);
      for (const q of this.sparks) { g.fillStyle = '#fff'; g.fillRect(q.x - cam - 3, q.y - 3, 6, 6); }
      for (const q of this.popups) this.txt(q.text, q.x - cam, q.y, q.weak ? '#ffe040' : '#fff', 'center');
      if (this.debug) this.drawDebug(cam);
      this.drawHud();
      if (this.state === 'pause') this.drawPause();
      if (this.state === 'over') { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, K.W, K.H); this.txt('GAME OVER', K.W / 2, 110, '#ff6060', 'center'); this.txt('Z / Enter でタイトルへ', K.W / 2, 130, '#fff', 'center'); }
    }
    drawPlayer(cam) {
      const p = this.player, A = this.assets, g = this.ctx;
      const anim = p.fx.dragon > 0 ? 'dragon' : p.hurt > 0 ? 'hurt' : p.atk > 0 ? (p.crouch ? 'crouchAttack' : 'attack') : p.crouch ? 'crouch' : !p.onGround ? 'jump' : p.vx ? 'walk' : 'idle';
      const blink = p.inv > 0 && p.fx.dragon <= 0 && (p.t & 2);
      const bodies = p.bodies();
      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        if (i === 0 && blink) continue;
        A.drawSprite(g, 'player', b.x - cam, b.y, { anim: i ? 'idle' : anim, flip: b.dir < 0, t: p.t, alpha: i ? 0.55 : null, state: { crouch: b.crouch, atk: b.atk } });
      }
      if (p.fx.after > 0) for (let k = 6; k <= 18; k += 6) { const h = p.hist[p.hist.length - 1 - k]; if (h) A.drawSprite(g, 'player', h.x - cam, h.y, { anim: 'idle', flip: h.dir < 0, alpha: 0.3, state: { crouch: h.crouch, atk: 0 } }); }
      if (p.fx.spin > 0) { g.strokeStyle = '#d8f0ff'; g.beginPath(); g.arc(p.x - cam, p.y - 16, 20, p.t / 3, p.t / 3 + 4); g.stroke(); }
      if (p.fx.orbit > 0) for (let k = 0; k < 4; k++) { const a = this.tick / 14 + k * Math.PI / 2; g.fillStyle = '#ff7a20'; g.fillRect(p.x - cam + Math.cos(a) * 26 - 3, p.y - 16 + Math.sin(a) * 18 - 3, 6, 6); }
      if (p.fx.falcon > 0) { g.fillStyle = '#c8a060'; g.fillRect(p.x - cam - 6, p.y - 52 + Math.sin(p.t / 6) * 3, 12, 5); }
    }
    drawHud() {
      const g = this.ctx, p = this.player;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, K.W, 24);
      for (let i = 0; i < p.maxHp; i++) { g.fillStyle = i < p.hp ? '#ff4040' : '#401010'; g.fillRect(6 + i * 9, 6, 7, 8); }
      this.txt('命 ' + this.lives, 70, 14, '#fff'); this.txt('SCORE ' + String(this.score).padStart(7, '0'), 110, 14, '#fff');
      const w = this.inv.select; g.fillStyle = w.color; g.fillRect(200, 5, 8, 8); this.txt(w.name, 211, 13, '#fff');
      const a = this.inv.auto; let s = ''; for (const k in a) if (a[k]) s += K.AUTO[k].name.slice(0, 2) + a[k] + ' ';
      this.txt(s || '', 6, 22, '#9f9');
      let y = 32; for (const k in p.fx) if (p.fx[k] > 0) { const d = K.INSTANT[k]; const nm = d ? d.name : ({ fly: '飛翔', orbit: '護法火', see: '見破り' }[k] || k); this.txt(nm, 6, y, '#ffd040'); g.fillStyle = '#ffd040'; g.fillRect(44, y - 6, Math.min(40, p.fx[k] / 15), 3); y += 9; }
      this.txt('単発 ' + this.inv.single.length + '/6', 214, 22, '#f8f', 'left');
      const m = this.msgs[this.msgs.length - 1]; if (m) this.txt(m.text, K.W / 2, 64, '#fff', 'center');
      if (this.spawnHalt > 0) this.txt('封魔', K.W - 30, 34, '#8cf');
    }
    drawPause() {
      const g = this.ctx; g.fillStyle = 'rgba(0,0,40,.82)'; g.fillRect(24, 28, K.W - 48, K.H - 56);
      this.txt('ポーズ / PAUSE', K.W / 2, 46, '#fff', 'center');
      const list = this.inv.single;
      if (!list.length) this.txt('単発アイテムを持っていない', K.W / 2, 100, '#aaa', 'center');
      list.forEach((id, i) => { const d = K.SINGLE[id]; this.txt((i === this.pauseIdx ? '▶ ' : '   ') + d.name, 40, 68 + i * 12, i === this.pauseIdx ? '#ffe040' : '#fff'); });
      if (list.length) this.txt(K.SINGLE[list[this.pauseIdx]].desc, 40, 150, '#9cf');
      this.txt('↑↓ 選択   Z 使う   Enter 再開', K.W / 2, 200, '#ccc', 'center');
    }
    drawTitle() {
      const g = this.ctx;
      if (!this.assets.drawImage(g, 'title', 0, 0, K.W, K.H)) {
        const gr = g.createLinearGradient(0, 0, 0, K.H); gr.addColorStop(0, '#080818'); gr.addColorStop(1, '#301020'); g.fillStyle = gr; g.fillRect(0, 0, K.W, K.H);
      }
      g.font = 'bold 24px "MS Gothic", "Yu Gothic", monospace'; this.txt('降魔七星剣', K.W / 2, 90, '#ffe8c0', 'center');
      g.font = '8px "MS Gothic", "Yu Gothic", monospace';
      this.txt('SHICHISEI-KEN  /  Retro side-scrolling action', K.W / 2, 108, '#ccc', 'center');
      this.txt('PRESS Z / ENTER  ―  訓練場 / Training', K.W / 2, 150, '#ffd040', 'center');
      this.txt('矢印:移動 ↓:しゃがみ ↑/Space:ジャンプ Z:七星剣 X:セレクト Enter:ポーズ', K.W / 2, 186, '#aaa', 'center');
      this.txt('C: セレクトアイテム切替（訓練場）  `: 判定表示', K.W / 2, 198, '#aaa', 'center');
    }
    drawDebug(cam) {
      const g = this.ctx, p = this.player; g.lineWidth = 1;
      const rect = (b, c) => { g.strokeStyle = c; g.strokeRect(Math.round(b.x - cam) + .5, Math.round(b.y) + .5, b.w, b.h); };
      rect(p.hb, '#0f0'); p.swordBoxes().forEach(b => rect(b, '#0ff')); this.enemies.forEach(e => rect(K.box(e), '#f80')); this.eshots.forEach(s => rect(s.box, '#f00'));
      const sm = this.assets.summary(); this.txt('assets: loaded ' + sm.loaded + ' / placeholder ' + sm.placeholder + ' / failed ' + sm.failed, 4, K.H - 4, '#0f0');
    }
  }
  K.Game = Game;
})(window.KOMA);
