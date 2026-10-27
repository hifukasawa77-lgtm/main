// ゲーム本体: メインループ・戦闘判定・ステージ進行・ボス戦・結界門・ポーズ(単発アイテム)・HUD。
// 固定1/60秒の更新で、描画は画面に合わせて整数倍に拡大。
(function (K) {
  const SWORD = { dmg: 2 };            // 七星剣のダメージ（属性なし）
  const FALCON = { dmg: 1 }, FIREORB = { dmg: 2 };
  const clone = o => JSON.parse(JSON.stringify(o));

  class Game {
    constructor(canvas, assets) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.assets = assets;
      canvas.width = K.W; canvas.height = K.H; this.ctx.imageSmoothingEnabled = false;
      this.input = new K.Input(); this.inv = new K.Inventory(); this.player = new K.Player(this); this.audio = new K.Audio();
      this.state = 'title'; this.tick = 0; this.score = 0; this.lives = 3; this.debug = false; this.menuIdx = 0;
      this.stage = clone(K.STAGES.training); this.enemies = []; this.shots = []; this.eshots = []; this.pickups = [];
      this.popups = []; this.msgs = []; this.queue = []; this.camX = 0; this.spawnHalt = 0; this.pauseIdx = 0; this.sparks = [];
      this.boss = null; this.bossDone = false; this.lockX = 0; this.minX = 8; this.room = null; this.outer = null; this.nearDoor = false; this.clearT = 0;
      this.roomSeed = 1;
      this.checkpoint = K.SaveStore.read(); this.saveFailed = false;
      this.pauseView = 'items'; this.guidePage = 0; this.guideIdx = 0; this.quitIdx = 0;
      const suspend = () => { if (this.state === 'play') { this.state = 'pause'; this.pauseIdx = 0; } };
      window.addEventListener('blur', suspend);
      document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
    }

    // ---------- 開始・ステージ進行 ----------
    newGame(stageId) {          // 最初から（持ち物・得点・残機を初期化）
      this.inv = new K.Inventory(); this.score = 0; this.lives = 3;
      this.loadStage(stageId || 'r1s1');
    }
    start(stageId) { this.newGame(stageId); }   // 旧名（検査・訓練場から）
    loadStage(id) {             // 次の面へ（持ち物・得点・残機は引き継ぐ）
      this.stage = clone(K.STAGES[id] || K.STAGES.training);
      this.tick = 0; this.room = null; this.outer = null; this.boss = null; this.bossDone = false; this.minX = 8; this.lockX = this.stage.lockX || 0;
      this.player.reset(32);
      this.shots = []; this.eshots = []; this.popups = []; this.msgs = []; this.queue = []; this.sparks = []; this.spawnHalt = 0;
      this.enemies = this.stage.enemies.map(e => new K.Enemy(e.type, e.x, e.y));
      this.pickups = this.stage.pickups.map(p => ({ cat: p.cat, id: p.id, x: p.x, y: p.y != null ? p.y : K.GROUND, taken: false }));
      this.state = 'play'; this.camX = 0;
      this.msg((this.stage.label ? this.stage.label + '  ' : '') + this.stage.name, 160);
      if (K.STAGE_LIST.some(s => s.id === this.stage.id)) {
        this.checkpoint = { version: 1, stageId: this.stage.id, score: this.score, lives: this.lives,
          selectIndex: this.inv.selectIndex, auto: clone(this.inv.auto), single: this.inv.single.slice() };
        this.saveFailed = !K.SaveStore.write(this.checkpoint);
        if (this.saveFailed) this.msg('自動保存できません / Save unavailable', 200);
      }
    }
    continueGame() {
      const s = this.checkpoint;
      if (!s) return;
      this.inv = new K.Inventory(); this.inv.selectIndex = s.selectIndex;
      for (const id of Object.keys(this.inv.auto)) this.inv.auto[id] = s.auto[id];
      this.inv.single = s.single.slice(); this.score = s.score; this.lives = s.lives;
      this.loadStage(s.stageId);
    }
    clearCheckpoint() { this.checkpoint = null; this.saveFailed = !K.SaveStore.clear(); }
    guideEntries() {
      if (this.guidePage === 1) return K.SELECT;
      return Object.values([null, null, K.AUTO, K.INSTANT, K.SINGLE][this.guidePage] || {});
    }
    nextStageId() { const s = K.STAGE_LIST.find(x => x.id === this.stage.id); return s ? s.next : null; }

    // ---------- 地形 ----------
    inPit(x) { const p = this.stage.pits || []; for (let i = 0; i < p.length; i++) if (x >= p[i][0] && x <= p[i][1]) return true; return false; }
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
      this.audio.effect('sub');
      const sp = w.pierce ? 3.4 : 2.8, y = p.y - (p.crouch ? 10 : 20);
      const s = new K.Shot(p.x + p.dir * 8, y, p.dir * sp, 0, w, { life: 90 }); s.sub = true; this.shots.push(s);
    }
    fireEight(p) {
      const w = { dmg: 1, color: '#ffd040' };
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.shots.push(new K.Shot(p.x, p.y - 14, Math.cos(a) * 2.4, Math.sin(a) * 2.4, w, { life: 50 })); }
    }
    damageEnemy(e, weapon, x, y) {
      if (e.dead) return;
      if (e.guard && !e.guard(this, weapon, x, y)) {                         // 効かない（弱点の癖）。火花だけ出す
        this.sparks.push({ x: x != null ? x : e.x, y: y != null ? y : e.y - e.h / 2, life: 6 });
        if (!e.guardMsgAt || this.tick - e.guardMsgAt > 40) { e.guardMsgAt = this.tick; this.popups.push({ x: e.x, y: e.y - e.h - 4, text: '効かない', weak: false, life: 30 }); }
        return;
      }
      const r = K.calcDamage(weapon, e);
      const killed = e.hit(r.dmg);
      this.audio.effect('hit');
      this.popups.push({ x: x != null ? x : e.x, y: y != null ? y : e.y - e.h, text: (Number.isInteger(r.dmg) ? r.dmg : r.dmg.toFixed(1)) + (r.weak ? ' 弱点!' : ''), weak: r.weak, life: 36 });
      if (killed) this.killEnemy(e);
    }
    killEnemy(e) {
      if (e.fallen === true && e.def && e.def.ai === 'drop') return;
      this.score += e.def.score; this.sparks.push({ x: e.x, y: e.y - e.h / 2, life: 14 });
      if (e.isBoss) { this.onBossDead(e); return; }
      if (this.stage.respawn) this.queue.push({ type: e.type, x: e.x0, y: e.y0, at: this.tick + 360 });
    }
    onScreen(e) { return e.x >= this.camX - 8 && e.x <= this.camX + K.W + 8; }

    // ---------- ボス ----------
    spawnBoss() {
      const s = this.stage; this.enemies = []; this.queue = []; this.eshots = [];
      const b = new K.Boss(s.boss, s.width - 60); this.boss = b;
      if (b.kind === 'sorcerer') for (let i = 0; i < 2; i++) { const d = new K.Decoy(s.width - 60, b.def); b.decoys.push(d); this.enemies.push(d); }
      this.enemies.push(b); this.minX = this.lockX + 10;
      this.msg('強敵  ' + b.name, 150);
      this.msg(K.BOSS_TIPS[b.kind].ja, 240);
    }
    onBossDead(b) {
      this.audio.effect('clear');
      this.boss = null; this.bossDone = true; this.eshots = []; this.enemies = [];
      for (let i = 0; i < 8; i++) this.sparks.push({ x: b.x + (i - 4) * 6, y: b.y - 10 - (i % 3) * 10, life: 30 + i * 4 });
      this.inv.growSelect(); this.msg(this.inv.select.name + ' に成長した', 200);
      this.state = 'clear'; this.clearT = 0;
    }

    // ---------- 結界門 ----------
    doorNear(p) {
      if (this.room) { for (const d of this.stage.doors || []) if (Math.abs(p.x - d.x) < 14) return d; return null; }
      const g = this.stage.gate; if (g && !g.used && Math.abs(p.x - g.x) < 16) return { x: g.x, to: 'gate' };
      return null;
    }
    useDoor(d) {
      if (d.to === 'gate') {
        if (!this.inv.consumeAuto('key')) { this.msg('門の鍵が要る', 90); return; }
        this.enterRoom('hub'); this.msg('結界門に入った（鍵を1つ使った）', 120); return;
      }
      if (d.to === 'outside') { this.exitRoom(); return; }
      this.enterRoom(d.to);
    }
    enterRoom(kind) {
      const p = this.player;
      if (!this.room) this.outer = { stage: this.stage, enemies: this.enemies, pickups: this.pickups, queue: this.queue, camX: this.camX, minX: this.minX, lockX: this.lockX, boss: this.boss };
      this.roomSeed = this.tick + 1; this.stage = K.makeRoom(kind, this.roomSeed); this.room = kind;
      this.enemies = this.stage.enemies.map(e => new K.Enemy(e.type, e.x, e.y));
      this.pickups = this.stage.pickups.map(q => ({ cat: q.cat, id: q.id, x: q.x, y: q.y != null ? q.y : K.GROUND, taken: false }));
      this.shots = []; this.eshots = []; this.queue = []; this.minX = 8; this.lockX = 0; this.camX = 0;
      p.x = 40; p.y = K.GROUND; p.vy = 0; p.vx = 0; p.onGround = true; p.safeX = 40; p.inv = 30;
      this.msg(this.stage.name, 100);
    }
    exitRoom() {
      if (!this.room || !this.outer) return;
      const o = this.outer, p = this.player;
      this.stage = o.stage; this.enemies = o.enemies; this.pickups = o.pickups; this.queue = o.queue; this.minX = o.minX; this.lockX = o.lockX; this.boss = o.boss;
      if (this.stage.gate) this.stage.gate.used = true;
      this.room = null; this.outer = null; this.shots = []; this.eshots = [];
      p.x = this.stage.gate ? this.stage.gate.x : p.x; p.y = K.GROUND; p.vy = 0; p.vx = 0; p.onGround = true; p.inv = 60; p.safeX = p.x;
      this.camX = K.clamp(p.x - 112, 0, this.stage.width - K.W);
    }

    // ---------- 単発アイテム（ポーズ画面から） ----------
    useSingle(id) {
      const p = this.player, live = this.enemies.filter(e => !e.dead && !e.harmless && this.onScreen(e));
      switch (id) {
        case 'fly': p.fx.fly = 480; break;
        case 'wind': live.forEach(e => this.damageEnemy(e, { dmg: 999 })); break;
        case 'fire': p.fx.orbit = 420; break;
        case 'bind': this.enemies.forEach(e => { e.frozen = 300; }); break;
        case 'escape':
          if (this.room) { this.exitRoom(); break; }
          this.msg('ここでは使えない（結界門の中で使う）', 120); return false;
        case 'thunder': live.forEach(e => this.damageEnemy(e, { dmg: 12 })); break;
        case 'see': p.fx.see = 900; break;
        case 'halt': this.spawnHalt = 900; break;
        case 'aurora': this.shots.push(new K.Shot(p.x + p.dir * 16, p.y - 16, p.dir * 5, 0, { dmg: 8, pierce: true, color: '#aaffee' }, { w: 90, h: 14, life: 26 })); break;
        case 'bomb': live.forEach(e => this.damageEnemy(e, { dmg: 30 })); p.hp = 1; p.inv = 60; this.sparks.push({ x: p.x, y: p.y - 14, life: 20 }); break;
        default: return false;
      }
      this.audio.effect('sub'); this.msg(K.SINGLE[id].name, 90); return true;
    }

    // ---------- 取得 ----------
    applyPickup(pk) {
      const p = this.player;
      if (pk.cat === 'auto') { if (!this.inv.addAuto(pk.id)) return false; this.msg(K.AUTO[pk.id].name + ' を手に入れた', 100); }
      else if (pk.cat === 'heal') { p.hp = p.maxHp; this.msg('体力が全回復した', 100); }
      else if (pk.cat === 'instant') {
        const d = K.INSTANT[pk.id]; if (d.frames) p.fx[pk.id] = d.frames;
        if (d.score) this.score += d.score; if (d.life) this.lives += d.life;
        this.msg(d.name + '  ' + d.desc, 100);
      } else if (pk.cat === 'single') { if (!this.inv.addSingle(pk.id)) { this.msg('これ以上持てない', 80); return false; } this.msg(K.SINGLE[pk.id].name + ' を手に入れた', 100); }
      else if (pk.cat === 'select') { const i = K.SELECT.findIndex(s => s.id === pk.id); if (i >= 0) { this.inv.selectIndex = i; this.msg(K.SELECT[i].name, 100); } }
      this.audio.effect('pickup'); return true;
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
      this.audio.effect('defeat');
      if (this.lives < 0) { this.state = 'over'; if (!this.stage.respawn) this.clearCheckpoint(); return; }
      if (this.room) this.exitRoom();
      p.reset(this.boss ? this.lockX + 30 : 32); p.inv = 120; this.shots = []; this.eshots = []; this.msg('ミス  残り ' + this.lives, 100);
    }
    // 穴から引き上げる。縁ぎりぎりに戻すと、右キーを押したままなら即座にまた落ちるので、少し手前へ置く
    rescueFromPit() { const p = this.player; p.x = Math.max(this.minX, p.safeX - 30); p.y = 60; p.vy = 0; p.vx = 0; p.takeoffVx = 0; }
    playerDown() { this.loseLife(false); }
    fellInPit() {
      const p = this.player;
      if (this.inv.consumeAuto('peacock')) { this.rescueFromPit(); p.inv = 90; this.msg('金翅鳥が助けてくれた', 120); return; }
      this.loseLife(true);
    }

    // ---------- 更新 ----------
    update() {
      try { this.updateFrame(); } finally { this.audio.sync(this); }
    }
    updateFrame() {
      this.input.update(); const inp = this.input;
      if (inp.pressed.pause && (this.state === 'play' || this.state === 'pause')) { this.state = this.state === 'play' ? 'pause' : 'play'; this.pauseIdx = 0; this.pauseView = 'items'; }
      if (this.state === 'title') {
        this.assets.tick++; this.tick++;
        const count = this.checkpoint ? 3 : 2;
        this.menuIdx = Math.min(this.menuIdx, count - 1);
        if (inp.pressed.down) this.menuIdx = (this.menuIdx + 1) % count;
        if (inp.pressed.up) this.menuIdx = (this.menuIdx + count - 1) % count;
        if (inp.pressed.attack || inp.pressed.pause) { if (this.menuIdx === 2) this.continueGame(); else this.newGame(this.menuIdx === 0 ? 'r1s1' : 'training'); }
        return;
      }
      if (this.state === 'over') { if (inp.pressed.attack || inp.pressed.pause) this.state = 'title'; return; }
      if (this.state === 'ending') { this.clearT++; if (this.clearT > 120 && (inp.pressed.attack || inp.pressed.pause)) this.state = 'title'; return; }
      if (this.state === 'clear') {
        this.clearT++; this.assets.tick++;
        for (const q of this.sparks) q.life--; this.sparks = this.sparks.filter(q => q.life > 0);
        for (const m of this.msgs) m.life--; this.msgs = this.msgs.filter(m => m.life > 0);
        if (this.clearT > 260) { const n = this.nextStageId(); if (n) { const hp = this.player.maxHp; this.loadStage(n); this.player.hp = hp; } else { this.state = 'ending'; this.clearT = 0; this.clearCheckpoint(); } }
        return;
      }
      if (this.state === 'pause') {
        if (inp.pressed.sub) { this.pauseView = this.pauseView === 'guide' ? 'items' : 'guide'; this.guidePage = 0; this.guideIdx = 0; return; }
        if (this.pauseView === 'guide') {
          if (inp.pressed.left || inp.pressed.right) { this.guidePage = (this.guidePage + (inp.pressed.right ? 1 : 4)) % 5; this.guideIdx = 0; }
          const count = this.guideEntries().length;
          if (count && (inp.pressed.up || inp.pressed.down)) this.guideIdx = (this.guideIdx + (inp.pressed.down ? 1 : count - 1)) % count;
          return;
        }
        if (this.pauseView === 'quit') {
          if (inp.pressed.up || inp.pressed.down) this.quitIdx = 1 - this.quitIdx;
          if (inp.pressed.attack) {
            if (this.quitIdx === 1) { this.state = 'title'; this.menuIdx = this.checkpoint ? 2 : 0; }
            this.pauseView = 'items';
          }
          return;
        }
        const n = this.inv.single.length;
        if (inp.pressed.down) this.pauseIdx = (this.pauseIdx + 1) % (n + 1);
        if (inp.pressed.up) this.pauseIdx = (this.pauseIdx + n) % (n + 1);
        if (inp.pressed.attack && this.pauseIdx === n) { this.pauseView = 'quit'; this.quitIdx = 0; return; }
        if (n) {
          if (inp.pressed.attack) {
            const id = this.inv.single[this.pauseIdx];
            if (this.useSingle(id)) {
              this.inv.takeSingle(this.pauseIdx);
              // 攻撃アイテムでボスを倒した場合は、クリア状態を維持する。
              if (this.state === 'pause') this.state = 'play';
            }
          }
        }
        return;
      }
      this.tick++; this.assets.tick++;
      const p = this.player;
      if (inp.pressed.cycle && this.stage.respawn) { this.inv.cycleSelect(); this.msg(this.inv.select.name, 60); }

      // 門・出入口（上キー）。近くにあるときは上キーでジャンプしない
      const door = this.doorNear(p); this.nearDoor = !!door;
      if (door && inp.pressed.up && p.onGround) this.useDoor(door);

      // ボス部屋へ入ったらボス出現・画面固定
      if (this.stage.boss && !this.boss && !this.bossDone && !this.room && p.x >= this.lockX + 12) this.spawnBoss();
      p.update(inp);
      if (this.state !== 'play') return;

      // 敵の更新と再出現
      for (const e of this.enemies) e.update(this);
      this.enemies = this.enemies.filter(e => !e.dead);
      if (this.spawnHalt > 0) this.spawnHalt--;
      else for (let i = this.queue.length - 1; i >= 0; i--) if (this.tick >= this.queue[i].at) { const q = this.queue.splice(i, 1)[0]; this.enemies.push(new K.Enemy(q.type, q.x, q.y)); }
      if (this.state !== 'play') return;

      // 七星剣・旋風斬・分身の刃
      const boxes = p.swordBoxes();
      for (const e of this.enemies) {
        const eb = K.box(e);
        for (const b of boxes) {
          if (!K.overlap(b, eb)) continue;
          const hx = b.x + b.w / 2, hy = b.y + b.h / 2;
          if (b.swing) { if (!p.swingHit.has(e)) { p.swingHit.add(e); this.damageEnemy(e, SWORD, hx, hy); } }
          else if (e.swordCd <= 0) { e.swordCd = 14; this.damageEnemy(e, SWORD, hx, hy); }
        }
        if (p.fx.falcon > 0) for (const b of p.bodies()) {
          if (K.overlap({ x: b.x - 12, y: b.y - 58, w: 24, h: 22 }, eb) && e.swordCd <= 0) { e.swordCd = 20; this.damageEnemy(e, FALCON, b.x, b.y - 48); }
        }
        if (p.fx.orbit > 0) for (let k = 0; k < 4; k++) {
          const a = this.tick / 14 + k * Math.PI / 2, ox = p.x + Math.cos(a) * 26, oy = p.y - 16 + Math.sin(a) * 18;
          if (K.overlap({ x: ox - 5, y: oy - 5, w: 10, h: 10 }, eb) && e.swordCd <= 0) { e.swordCd = 14; this.damageEnemy(e, FIREORB, ox, oy); }
        }
      }
      this.enemies = this.enemies.filter(e => !e.dead);
      if (this.state !== 'play') return;

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
      if (this.state !== 'play') return;

      // 敵の弾: 七星剣に触れると消える（バリア）。solid（斬撃・衝撃波・光線）は消せない。自分に当たるとダメージ
      for (const s of this.eshots) {
        s.update(this); const sb = s.box;
        if (!s.solid) for (const b of boxes) if (K.overlap(b, sb)) { s.dead = true; this.sparks.push({ x: s.x, y: s.y, life: 8 }); break; }
        if (!s.dead && K.overlap(sb, p.hb)) { if (!s.solid) s.dead = true; p.hurtBy(); }
        const m = s.solid ? 160 : 40;
        if (s.x < this.camX - m || s.x > this.camX + K.W + m || s.y > K.H + 20 || s.y < -40) s.dead = true;
      }
      this.eshots = this.eshots.filter(s => !s.dead);
      if (this.state !== 'play') return;
      // 敵との接触
      for (const e of this.enemies) if (!e.dead && !e.harmless && K.overlap(p.hb, K.box(e))) {
        p.hurtBy();
        if (this.state !== 'play') return;
      }

      // アイテム取得
      for (const pk of this.pickups) {
        if (pk.taken) continue;
        if (K.overlap(p.hb, { x: pk.x - 8, y: pk.y - 16, w: 16, h: 16 }) && this.applyPickup(pk)) pk.taken = true;
      }

      // 演出の寿命・カメラ
      for (const q of this.popups) { q.life--; q.y -= 0.3; } this.popups = this.popups.filter(q => q.life > 0);
      for (const q of this.sparks) q.life--; this.sparks = this.sparks.filter(q => q.life > 0);
      for (const m of this.msgs) m.life--; this.msgs = this.msgs.filter(m => m.life > 0);
      this.camX = this.boss ? this.lockX : K.clamp(p.x - 112, 0, this.stage.width - K.W);
    }

    // ---------- 描画 ----------
    txt(s, x, y, c, align) { const g = this.ctx; g.fillStyle = '#000'; g.textAlign = align || 'left'; g.fillText(s, x + 1, y + 1); g.fillStyle = c || '#fff'; g.fillText(s, x, y); }
    draw() {
      const g = this.ctx, A = this.assets, cam = Math.round(this.camX);
      g.font = '8px "MS Gothic", "Yu Gothic", monospace'; g.textBaseline = 'alphabetic';
      if (this.state === 'title') { this.drawTitle(); return; }
      if (this.state === 'ending') { this.drawEnding(); return; }
      const bgImg = A.images[this.stage.bg];
      if (bgImg) { const sx = -Math.floor((this.room ? 0 : cam * 0.35) % K.W); g.drawImage(bgImg, sx, 0, K.W, K.H); g.drawImage(bgImg, sx + K.W, 0, K.W, K.H); }   // 横にゆっくり流れる遠景
      else K.drawBackgroundPlaceholder(g, cam, this.stage);
      K.drawTerrain(g, cam, this.stage);
      if (this.stage.gate && !this.stage.gate.used) A.drawSprite(g, 'gate', this.stage.gate.x - cam, K.GROUND, { w: 40, h: 56 });
      for (const d of this.stage.doors || []) { A.drawSprite(g, 'gate', d.x - cam, K.GROUND, { w: 28, h: 44 }); this.txt(d.label, d.x - cam, K.GROUND - 48, '#fff', 'center'); }

      for (const pk of this.pickups) if (!pk.taken) {
        const d = pk.cat === 'auto' ? K.AUTO[pk.id] : pk.cat === 'instant' ? K.INSTANT[pk.id] : pk.cat === 'single' ? K.SINGLE[pk.id] : pk.cat === 'heal' ? { name: '回復' } : K.SELECT.find(s => s.id === pk.id);
        if (pk.x - cam > -16 && pk.x - cam < K.W + 16) A.drawSprite(g, 'item', pk.x - cam, pk.y + Math.sin(this.tick / 12 + pk.x) * 2, { cat: pk.cat, label: d ? d.name : '?' });
      }
      for (const e of this.enemies) if (!e.invisible || this.player.fx.see > 0 || this.inv.auto.charm > 0)
        A.drawSprite(g, e.def.sprite, e.x - cam, e.y, { anim: e.isBoss ? (e.flash > 0 ? 'hurt' : (['wind', 'dash', 'spin', 'jump', 'leap', 'dive'].indexOf(e.st) >= 0 ? 'attack' : 'idle')) : e.decoy ? 'idle' : (e.def.ai === 'fly' ? 'fly' : (e.def.ai === 'walk' || e.def.ai === 'hop' ? 'walk' : 'idle')), flip: e.dir < 0, t: e.t, state: e, alpha: e.alpha != null && e.alpha < 1 ? e.alpha : null });
      for (const e of this.enemies) if (e.warn) this.drawWarn(e, cam);
      for (const s of this.shots) A.drawSprite(g, 'shot_orb', s.x - cam, s.y, { color: s.weapon.color, w: s.w > 12 ? s.w : undefined, h: s.h > 12 ? s.h : undefined });
      for (const s of this.eshots) {
        if (s.solid || s.w > 12) { g.fillStyle = s.color; g.globalAlpha = 0.85; g.fillRect(Math.round(s.x - s.w / 2 - cam), Math.round(s.y - s.h / 2), s.w, s.h); g.globalAlpha = 1; }
        else A.drawSprite(g, 'enemy_shot', s.x - cam, s.y, { color: s.color });
      }
      this.drawPlayer(cam);
      for (const q of this.sparks) { g.fillStyle = '#fff'; g.fillRect(q.x - cam - 3, q.y - 3, 6, 6); }
      for (const q of this.popups) this.txt(q.text, q.x - cam, q.y, q.weak ? '#ffe040' : '#fff', 'center');
      if (this.stage.dark) this.drawDark(cam);
      if (this.debug) this.drawDebug(cam);
      this.drawHud();
      if (this.state === 'pause') this.drawPause();
      if (this.state === 'clear') { this.txt('ROUND CLEAR', K.W / 2, 100, '#ffe040', 'center'); this.txt(this.stage.name + ' ― ' + (this.stage.boss ? K.BOSS_DEFS[this.stage.boss].name + ' 撃破' : ''), K.W / 2, 116, '#fff', 'center'); }
      if (this.state === 'over') { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, K.W, K.H); this.txt('GAME OVER', K.W / 2, 110, '#ff6060', 'center'); this.txt('Z / Enter でタイトルへ', K.W / 2, 130, '#fff', 'center'); }
    }
    drawWarn(e, cam) {
      const g = this.ctx, w = e.warn;
      if (w.beam) { g.fillStyle = 'rgba(180,240,255,.35)'; const x0 = w.x - w.w / 2 - cam; g.fillRect(Math.round(x0), K.GROUND - (w.lane ? 24 : 4) - 3, w.w, 6); }
      else if (w.bar) { this.txt('!', e.x - cam, e.y - e.h - 6, '#ff4040', 'center'); }
      else { g.fillStyle = 'rgba(255,120,40,.5)'; g.fillRect(Math.round(w.x - cam - 6), K.GROUND - 6, 12, 6); }
    }
    drawDark(cam) {
      const g = this.ctx, p = this.player, r = this.inv.auto.torch > 0 ? 78 : 26;
      g.save(); g.beginPath(); g.rect(0, 0, K.W, K.H); g.arc(Math.round(p.x - cam), Math.round(p.y - 14), r, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.95)'; g.fill('evenodd'); g.restore();
    }
    drawPlayer(cam) {
      const p = this.player, A = this.assets, g = this.ctx;
      const anim = p.fx.dragon > 0 ? 'dragon' : p.hurt > 0 ? 'hurt' : p.atk > 0 ? (p.crouch ? 'crouchAttack' : 'attack') : p.crouch ? 'crouch' : !p.onGround ? 'jump' : p.vx ? 'walk' : 'idle';
      const blink = p.inv > 0 && p.fx.dragon <= 0 && (p.t & 2);
      const bodies = p.bodies();
      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        if (i === 0 && blink) continue;
        const an = i ? (b.atk > 0 ? (b.crouch ? 'crouchAttack' : 'attack') : (b.crouch ? 'crouch' : 'idle')) : anim;
        const fr = (an === 'attack' || an === 'crouchAttack') ? (b.atk > 11 ? 0 : b.atk > 4 ? 1 : 2) : undefined;   // 刃が出るコマと判定を同期させる
        A.drawSprite(g, 'player', b.x - cam, b.y, { anim: an, frame: fr, flip: b.dir < 0, t: p.t, alpha: i ? 0.55 : null, state: { crouch: b.crouch, atk: b.atk } });
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
      if (this.stage.label) this.txt(this.stage.label + ' ' + this.stage.name, K.W - 4, 34, '#bbb', 'right');
      const m = this.msgs[this.msgs.length - 1]; if (m) this.txt(m.text, K.W / 2, 64, '#fff', 'center');
      if (this.spawnHalt > 0) this.txt('封魔', K.W - 30, 44, '#8cf');
      const b = this.boss;                                         // ボスの体力
      if (b) { g.fillStyle = '#300'; g.fillRect(40, K.H - 14, 176, 6); g.fillStyle = '#e03030'; g.fillRect(40, K.H - 14, 176 * Math.max(0, b.hp) / b.maxHp, 6); this.txt(b.name, 40, K.H - 17, '#fff'); }
    }
    drawPause() {
      const g = this.ctx; g.fillStyle = 'rgba(0,0,40,.94)'; g.fillRect(24, 28, K.W - 48, K.H - 40);
      if (this.pauseView === 'guide') { this.drawGuide(); return; }
      if (this.pauseView === 'quit') {
        this.txt('タイトルへ戻る？ / QUIT?', 128, 56, '#fff', 'center');
        this.txt('続きからは面の開始時に戻ります', 128, 84, '#9cf', 'center');
        this.txt('Continue restarts the saved stage.', 128, 98, '#9cf', 'center');
        ['戻らない / CANCEL', 'タイトルへ / TITLE'].forEach((s, i) => this.txt((this.quitIdx === i ? '▶ ' : '   ') + s, 40, 130 + i * 16, this.quitIdx === i ? '#ffe040' : '#fff'));
        this.txt('↑↓ 選択  Z 決定 / Select, Sword', 128, 190, '#ccc', 'center');
        this.txt('Enter: 再開 / Resume', 128, 210, '#ccc', 'center');
        return;
      }
      this.txt('ポーズ / PAUSE', K.W / 2, 46, '#fff', 'center');
      const list = this.inv.single;
      if (!list.length) this.txt('単発アイテムなし / No items', K.W / 2, 100, '#aaa', 'center');
      list.forEach((id, i) => { const d = K.SINGLE[id]; this.txt((i === this.pauseIdx ? '▶ ' : '   ') + d.name, 40, 68 + i * 12, i === this.pauseIdx ? '#ffe040' : '#fff'); });
      this.txt((this.pauseIdx === list.length ? '▶ ' : '   ') + 'タイトルへ / TITLE', 40, 68 + list.length * 12, this.pauseIdx === list.length ? '#ffe040' : '#fff');
      if (this.pauseIdx < list.length) (K.SINGLE[list[this.pauseIdx]].desc.match(/.{1,23}/gu) || []).forEach((line, i) => this.txt(line, 36, 154 + i * 10, '#9cf'));
      if (this.boss) {
        const tip = K.BOSS_TIPS[this.boss.kind];
        this.txt(tip.ja, 128, 178, '#ffdfa0', 'center');
        this.txt(tip.en, 128, 188, '#ffdfa0', 'center');
      }
      this.txt('↑↓ 選択   Z 使う   Enter 再開', K.W / 2, 200, '#ccc', 'center');
      this.txt('X: 手引 / Guide', K.W / 2, 216, '#9cf', 'center');
    }
    drawGuide() {
      const names = ['操作 / Controls', '武器 / Weapons', '自動 / Auto', '即効 / Effects', '単発 / Single-use'];
      this.txt('手引 / GUIDE  ' + (this.guidePage + 1) + '/5', 128, 44, '#ffe040', 'center');
      this.txt(names[this.guidePage], 128, 58, '#fff', 'center');
      if (this.guidePage === 0) {
        ['←→ 移動 / Move', '↑/Space 跳ぶ / Jump', '↓ しゃがむ / Crouch', 'Z 斬る・弾消し / Sword', 'X 道具を投げる / Throw', '↑ 門に入る / Enter gate', 'Enter 休止・再開 / Pause', 'C 訓練の武器切替 / Cycle'].forEach((s, i) => this.txt(s, 36, 76 + i * 14, '#fff'));
      } else {
        const entries = this.guideEntries();
        entries.forEach((e, i) => this.txt((i === this.guideIdx ? '▶ ' : '   ') + e.name, 36, 72 + i * 9, i === this.guideIdx ? '#ffe040' : '#fff'));
        const e = entries[this.guideIdx];
        let desc = e.desc;
        if (this.guidePage === 1) desc = e.allMult ? '全ての敵に' + e.allMult + '倍ダメージ' : e.weak ? K.TAG_JP[e.weak] + '属性の敵に3倍ダメージ' : e.pierce ? '敵を貫通する遠距離武器' : '基本の遠距離武器';
        if (this.guidePage === 3 && e.frames) desc += '（' + (e.frames / K.FPS) + '秒）';
        (desc.match(/.{1,23}/gu) || []).forEach((line, i) => this.txt(line, 36, 170 + i * 10, '#9cf'));
      }
      this.txt('←→ 分類  ↑↓ 選択 / Browse', 128, 207, '#ccc', 'center');
      this.txt('X 戻る / Back   Enter 再開', 128, 220, '#ccc', 'center');
    }
    drawTitle() {
      const g = this.ctx;
      if (!this.assets.drawImage(g, 'title', 0, 0, K.W, K.H)) {
        const gr = g.createLinearGradient(0, 0, 0, K.H); gr.addColorStop(0, '#080818'); gr.addColorStop(1, '#301020'); g.fillStyle = gr; g.fillRect(0, 0, K.W, K.H);
      }
      g.font = 'bold 24px "MS Gothic", "Yu Gothic", monospace'; this.txt('降魔七星剣', K.W / 2, 80, '#ffe8c0', 'center');
      g.font = '8px "MS Gothic", "Yu Gothic", monospace';
      this.txt('SHICHISEI-KEN  /  Retro side-scrolling action', K.W / 2, 98, '#ccc', 'center');
      const items = ['冒険を始める  /  START (ROUND 1-1)', '訓練場  /  TRAINING'];
      if (this.checkpoint) items.push('続きから / CONTINUE ' + this.checkpoint.stageId.toUpperCase());
      items.forEach((t, i) => this.txt((this.menuIdx === i ? '▶ ' : '   ') + t, K.W / 2, 128 + i * 14, this.menuIdx === i ? '#ffd040' : '#aaa', 'center'));
      this.txt(this.saveFailed ? '保存できません / Save unavailable' : '↑↓ 選択   Z / Enter 決定', K.W / 2, 176, '#888', 'center');
      this.txt('←→ 移動 / Move   ↓ しゃがむ / Crouch', K.W / 2, 190, '#ccc', 'center');
      this.txt('↑/Space 跳ぶ / Jump   ↑ 門 / Gate', K.W / 2, 202, '#ccc', 'center');
      this.txt('Z 剣 / Sword  X 道具 / Item  Enter 休止', K.W / 2, 214, '#ccc', 'center');
      this.txt('C 訓練の武器 / Cycle  ` 判定 / Hitboxes', K.W / 2, 226, '#aaa', 'center');
    }
    drawEnding() {
      const g = this.ctx; g.fillStyle = '#05000c'; g.fillRect(0, 0, K.W, K.H);
      g.font = 'bold 20px "MS Gothic", "Yu Gothic", monospace'; this.txt('冥府に光が戻った', K.W / 2, 90, '#ffe8c0', 'center');
      g.font = '8px "MS Gothic", "Yu Gothic", monospace';
      this.txt('THE END  ―  降魔七星剣', K.W / 2, 112, '#ccc', 'center');
      this.txt('SCORE ' + String(this.score).padStart(7, '0') + '    残機 ' + this.lives, K.W / 2, 140, '#fff', 'center');
      if (this.clearT > 120) this.txt('Z / Enter でタイトルへ', K.W / 2, 180, '#ffd040', 'center');
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
