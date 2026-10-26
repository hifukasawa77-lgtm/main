// 敵・弾。敵は属性タグ(tags)を持ち、相性ダメージは items.js の K.calcDamage が決める。
(function (K) {
  // 訓練場用の見本。ステージ実装(フェーズ4)では同じ形式で敵を足していく
  K.ENEMY_TYPES = {
    plain:  { name: '雑兵',   tags: [],        hp: 6, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 100, sprite: 'enemy_plain',  color: '#c8c8c8' },
    ember:  { name: '火鬼',   tags: ['FIRE'],  hp: 6, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 200, sprite: 'enemy_ember',  color: '#ff6a2a' },
    frost:  { name: '氷鬼',   tags: ['ICE'],   hp: 6, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 200, sprite: 'enemy_frost',  color: '#8fd4ff' },
    knight: { name: '鎧武者', tags: ['ARMOR'], hp: 8, w: 16, h: 30, speed: 0.3, ai: 'walk',  score: 300, sprite: 'enemy_knight', color: '#8a8fa0' },
    ghoul:  { name: '亡者',   tags: ['UNDEAD'],hp: 6, w: 14, h: 26, speed: 0.3, ai: 'walk',  score: 200, sprite: 'enemy_ghoul',  color: '#a070d0' },
    naga:   { name: '水妖',   tags: ['WATER'], hp: 6, w: 14, h: 22, speed: 0.4, ai: 'walk',  score: 200, sprite: 'enemy_naga',   color: '#3a9bd8' },
    bat:    { name: '洞窟蝙蝠', tags: ['CAVE'], hp: 4, w: 16, h: 12, speed: 0.8, ai: 'fly',   score: 150, sprite: 'enemy_bat',    color: '#6a5a4a' },
    gunner: { name: '射手',   tags: [],        hp: 6, w: 14, h: 24, speed: 0,   ai: 'shoot', score: 250, sprite: 'enemy_plain',  color: '#d0a040' },
  };

  class Enemy {
    constructor(type, x, y) {
      const d = K.ENEMY_TYPES[type]; if (!d) throw new Error('unknown enemy: ' + type);
      this.type = type; this.def = d; this.name = d.name; this.tags = d.tags.slice();
      this.x = x; this.y = y != null ? y : K.GROUND; this.x0 = x; this.y0 = this.y;
      this.w = d.w; this.h = d.h; this.hp = d.hp; this.maxHp = d.hp;
      this.dir = -1; this.t = 0; this.flash = 0; this.frozen = 0; this.dead = false;
      this.cd = 60 + Math.floor(Math.random() * 40); this.swordCd = 0;
      this.invisible = false;     // 見えない敵（護符・見破りの法で扱う。フェーズ4）
    }
    update(g) {
      this.t++; if (this.flash > 0) this.flash--; if (this.swordCd > 0) this.swordCd--;
      if (this.frozen > 0) { this.frozen--; return; }
      const d = this.def, p = g.player;
      if (d.ai === 'walk') {
        this.x += this.dir * d.speed;
        if (this.x > this.x0 + 40) this.dir = -1; else if (this.x < this.x0 - 40) this.dir = 1;
      } else if (d.ai === 'fly') {
        this.x = this.x0 + Math.sin(this.t / 40) * 50; this.y = this.y0 - 30 + Math.sin(this.t / 17) * 8;
        this.dir = Math.cos(this.t / 40) >= 0 ? 1 : -1;
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

  // 敵の弾。七星剣(剣の判定)に触れると消える
  class EShot {
    constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.w = 6; this.h = 6; this.dead = false; }
    update() { this.x += this.vx; this.y += this.vy; }
    get box() { return { x: this.x - 3, y: this.y - 3, w: 6, h: 6 }; }
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
