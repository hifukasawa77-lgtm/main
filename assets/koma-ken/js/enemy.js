// 敵・弾。敵は属性タグ(tags)を持ち、相性ダメージは items.js の K.calcDamage が決める。
(function (K) {
  // 雑魚の定義。ステージ(stages.js)が組み合わせて配置する
  K.ENEMY_TYPES = {
    plain:    { name: '雑兵',     tags: [],         hp: 1, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 100, sprite: 'enemy_plain',  color: '#c8c8c8' },
    ember:    { name: '火鬼',     tags: ['FIRE'],   hp: 1, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 200, sprite: 'enemy_ember',  color: '#ff6a2a' },
    frost:    { name: '氷鬼',     tags: ['ICE'],    hp: 1, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 200, sprite: 'enemy_frost',  color: '#8fd4ff' },
    knight:   { name: '鎧武者',   tags: ['ARMOR'],  hp: 1, w: 16, h: 30, speed: 0.3, ai: 'walk',  score: 300, sprite: 'enemy_knight', color: '#8a8fa0' },
    ghoul:    { name: '亡者',     tags: ['UNDEAD'], hp: 1, w: 14, h: 26, speed: 0.3, ai: 'walk',  score: 200, sprite: 'enemy_ghoul',  color: '#a070d0' },
    skeleton: { name: '骸骨',     tags: ['UNDEAD'], hp: 1, w: 14, h: 26, speed: 0.5, ai: 'walk',  score: 200, sprite: 'enemy_ghoul',  color: '#e8e8d0' },
    naga:     { name: '水妖',     tags: ['WATER'],  hp: 1, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 200, sprite: 'enemy_naga',   color: '#3a9bd8' },
    bat:      { name: '洞窟蝙蝠', tags: ['CAVE'],   hp: 1, w: 16, h: 12, speed: 0.8, ai: 'fly',   score: 150, sprite: 'enemy_bat',    color: '#6a5a4a' },
    hopper:   { name: '跳ね鬼',   tags: [],         hp: 1, w: 14, h: 20, speed: 0.5, ai: 'hop',   score: 150, sprite: 'enemy_plain',  color: '#b8c860' },
    emberhop: { name: '火の跳ね鬼', tags: ['FIRE'], hp: 1, w: 14, h: 20, speed: 0.5, ai: 'hop',   score: 200, sprite: 'enemy_ember',  color: '#ff8a40' },
    frosthop: { name: '氷の跳ね鬼', tags: ['ICE'],  hp: 1, w: 14, h: 20, speed: 0.5, ai: 'hop',   score: 200, sprite: 'enemy_frost',  color: '#a8e4ff' },
    ghostfire:{ name: '鬼火',     tags: ['FIRE'],   hp: 1, w: 14, h: 14, speed: 0.7, ai: 'fly',   score: 150, sprite: 'enemy_bat',    color: '#ff9a40' },
    icicle:   { name: '氷柱',     tags: ['ICE'],    hp: 1, w: 8,  h: 14, speed: 0,   ai: 'drop',  score: 50,  sprite: 'enemy_frost',  color: '#c0f0ff' },
    gunner:   { name: '射手',     tags: [],         hp: 1, w: 14, h: 24, speed: 0,   ai: 'shoot', score: 250, sprite: 'enemy_plain',  color: '#d0a040' },
    turret:   { name: '石弓の罠', tags: ['ARMOR'],  hp: 1, w: 16, h: 20, speed: 0,   ai: 'shoot', score: 300, sprite: 'enemy_knight', color: '#707080' },
  };

  class Enemy {
    constructor(type, x, y) {
      const d = K.ENEMY_TYPES[type]; if (!d) throw new Error('unknown enemy: ' + type);
      this.type = type; this.def = d; this.name = d.name; this.tags = d.tags.slice();
      this.x = x; this.y = y != null ? y : K.GROUND; this.x0 = x; this.y0 = this.y;
      this.w = d.w; this.h = d.h; this.hp = d.hp; this.maxHp = d.hp;
      this.dir = -1; this.t = 0; this.flash = 0; this.frozen = 0; this.dead = false; this.vy = 0; this.fallen = false;
      this.cd = 60 + Math.floor(Math.random() * 40); this.swordCd = 0;
      this.invisible = false;     // 見えない敵（護符・見破りの法で扱う）
    }
    update(g) {
      this.t++; if (this.flash > 0) this.flash--; if (this.swordCd > 0) this.swordCd--;
      if (this.frozen > 0) { this.frozen--; return; }
      const d = this.def, p = g.player;
      if (g.stage.geometry && (d.ai === 'walk' || d.ai === 'hop')) {
        if (d.ai === 'hop' && Math.abs(p.x - this.x) < 110) this.dir = p.x < this.x ? -1 : 1;
        const m = g.geometry().move(this, this.dir * d.speed, Math.min(this.vy + K.GRAV, K.MAXFALL));
        this.x = m.x; this.y = m.y;
        this.vy = m.hitY ? 0 : Math.min(this.vy + K.GRAV, K.MAXFALL);
        if (m.hitX || this.x > this.x0 + 40 || this.x < this.x0 - 40) this.dir = -this.dir;
        if (d.ai === 'hop' && m.grounded && --this.cd <= 0) { this.vy = -3.6; this.cd = 50 + (this.t % 40); }
        if (g.geometry().belowWorld(this.y)) this.dead = true;
        return;
      }
      if (d.ai === 'walk') {
        this.x += this.dir * d.speed;
        if (this.x > this.x0 + 40) this.dir = -1; else if (this.x < this.x0 - 40) this.dir = 1;
      } else if (d.ai === 'fly') {
        this.x = this.x0 + Math.sin(this.t / 40) * 50; this.y = this.y0 - 30 + Math.sin(this.t / 17) * 8;
        this.dir = Math.cos(this.t / 40) >= 0 ? 1 : -1;
      } else if (d.ai === 'hop') {
        if (Math.abs(p.x - this.x) < 110) this.dir = p.x < this.x ? -1 : 1; else if (this.t % 120 === 0) this.dir = -this.dir;
        this.x += this.dir * d.speed;
        this.vy += K.GRAV; this.y += this.vy;
        if (this.y >= this.y0) { this.y = this.y0; this.vy = 0; if (--this.cd <= 0) { this.vy = -3.6; this.cd = 50 + (this.t % 40); } }
      } else if (d.ai === 'drop') {                       // 天井の氷柱: 真下に来ると落ちる
        if (!this.fallen && Math.abs(p.x - this.x) < 22) this.fallen = true;
        if (this.fallen) {
          const y0 = this.y; this.vy += 0.25; this.y += this.vy;
          if (g.stage.geometry ? (g.supportY(this.x, y0, this.y) != null || g.geometry().belowWorld(this.y)) : this.y >= K.GROUND) this.dead = true;
        }
      } else if (d.ai === 'shoot') {
        this.dir = p.x < this.x ? -1 : 1;
        if (--this.cd <= 0 && Math.abs(p.x - this.x) < 170) {
          this.cd = 90;
          g.eshots.push(new EShot(this.x + this.dir * 8, this.y - this.h * 0.65, this.dir * 1.6, 0));
        }
      }
    }
    hit(dmg) { this.hp -= dmg; this.flash = 6; if (this.hp <= 0) this.dead = true; return this.dead; }
  }

  // 敵の弾。七星剣(剣の判定)に触れると消える。ただし solid（斬撃・衝撃波・光線）は消せない
  //  opts: {w,h,g(重力),life,solid,bounce,boom(行って戻る),homing,color}
  class EShot {
    constructor(x, y, vx, vy, opts) {
      opts = opts || {};
      this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.w = opts.w || 6; this.h = opts.h || 6;
      this.g = opts.g || 0; this.life = opts.life || 400; this.solid = !!opts.solid; this.bounce = !!opts.bounce;
      this.boom = !!opts.boom; this.homing = opts.homing || 0; this.color = opts.color || '#ff3030';
      this.dead = false; this.age = 0; this.life0 = this.life;
    }
    update(game) {
      this.age++;
      if (this.homing && game) {
        const p = game.player, dx = p.x - this.x, dy = p.y - 14 - this.y, m = Math.hypot(dx, dy) || 1;
        this.vx += dx / m * this.homing; this.vy += dy / m * this.homing;
        const sp = Math.hypot(this.vx, this.vy), cap = 1.6; if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
      }
      if (this.boom && this.age === Math.floor(this.life0 / 2)) this.vx = -this.vx;
      const y0 = this.y; this.vy += this.g; this.x += this.vx; this.y += this.vy;
      if (this.bounce && this.vy > 0) {
        const floor = game && game.stage.geometry ? game.supportY(this.x, y0 + this.h / 2, this.y + this.h / 2) : (this.y >= K.GROUND - this.h / 2 ? K.GROUND : null);
        if (floor != null) { this.y = floor - this.h / 2; this.vy = -this.vy * 0.8; }
      }
      if (--this.life <= 0) this.dead = true;
    }
    get box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  }

  // 自分の弾（セレクトアイテム・極光・八方破など）。weapon は K.SELECT の要素と同じ形 {dmg,weak?,allMult?,pierce?,color}
  class Shot {
    constructor(x, y, vx, vy, weapon, opts) {
      opts = opts || {};
      this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.weapon = weapon;
      this.w = opts.w || 8; this.h = opts.h || 8; this.life = opts.life || 120;
      this.pierce = !!(weapon.pierce || opts.pierce); this.hit = new Set(); this.dead = false;
    }
    update() { this.x += this.vx; this.y += this.vy; if (--this.life <= 0) this.dead = true; }
    get box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  }

  K.Enemy = Enemy; K.EShot = EShot; K.Shot = Shot;
})(window.KOMA);
