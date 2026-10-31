// ボス13体。構成（ラウンドごとの4体＋最終ボス）と「弱点の癖」は仕様どおり、名前・見た目はオリジナル。
// 共通の部品（Boss クラス）の上に、種類ごとのAI（K.BOSS_AI）を載せる。弾は solid=true なら七星剣で消せない。
(function (K) {
  const GROUND = K.GROUND;

  // id → 定義。kind が AI の名前。tags は相性ダメージ用の属性（その属性の武器が3倍）
  K.BOSS_DEFS = {
    r1s1: { kind: 'oni',       name: '鬼面の女',   hp: 40, w: 22, h: 40, tags: [],         color: '#c04070', score: 3000 },
    r1s2: { kind: 'monk',      name: '岩坊主',     hp: 44, w: 26, h: 40, tags: ['ARMOR'],  color: '#7a6a5a', score: 3000 },
    r1s3: { kind: 'guardian',  name: '門番の金剛', hp: 40, w: 28, h: 56, tags: ['ARMOR'],  color: '#a05030', score: 3500 },
    r1s4: { kind: 'sorcerer',  name: '闇の導師',   hp: 34, w: 18, h: 36, tags: ['UNDEAD'], color: '#6040a0', score: 4000 },
    r2s1: { kind: 'flame',     name: '炎の邪神',   hp: 56, w: 38, h: 48, tags: ['FIRE'],   color: '#e04820', score: 4500 },
    r2s2: { kind: 'wraith',    name: '水底の亡霊', hp: 50, w: 30, h: 44, tags: ['WATER'],  color: '#3070b0', score: 4500 },
    r2s3: { kind: 'yuki',      name: '雪の精',     hp: 40, w: 20, h: 40, tags: ['ICE'],    color: '#a8e0ff', score: 4500 },
    r2s4: { kind: 'tengu',     name: '空の天狗',   hp: 46, w: 26, h: 36, tags: [],         color: '#c83030', score: 5000 },
    r3s1: { kind: 'swordsman', name: '念の剣客',   hp: 46, w: 18, h: 38, tags: [],         color: '#d060c0', score: 5000 },
    r3s2: { kind: 'samurai',   name: '光の侍',     hp: 50, w: 20, h: 40, tags: [],         color: '#e0e0a0', score: 5500 },
    r3s3: { kind: 'armor',     name: '鎧の大将',   hp: 64, w: 36, h: 52, tags: ['ARMOR'],  color: '#707890', score: 6000 },
    r3s4: { kind: 'matron',    name: '邪鬼の長',   hp: 56, w: 24, h: 42, tags: [],         color: '#a03060', score: 6500 },
    r4s1: { kind: 'overlord',  name: '闇の支配者', hp: 90, w: 38, h: 56, tags: [],         color: '#302040', score: 20000 },
  };

  class Boss {
    constructor(id, x, floorY = GROUND) {
      const d = K.BOSS_DEFS[id]; if (!d) throw new Error('unknown boss: ' + id);
      this.id = id; this.kind = d.kind; this.def = { name: d.name, color: d.color, score: d.score, sprite: 'boss_' + id, ai: 'boss' };
      this.isBoss = true; this.name = d.name; this.tags = d.tags.slice();
      this.floorY = floorY; this.x = x; this.y = floorY; this.w = d.w; this.h = d.h; this.hp = this.maxHp = d.hp;
      this.dir = -1; this.vx = 0; this.vy = 0; this.onGround = true; this.t = 0; this.flash = 0; this.frozen = 0; this.dead = false;
      this.swordCd = 0; this.invisible = false; this.harmless = false;
      this.st = 'walk'; this.sc = 0; this.cool = 60; this.alpha = 1; this.warn = null; this.decoys = []; this.ring = false;
      this.homeX = x; this.lane = 0; this.noTurn = 0;
    }
    sign(p) { return p.x < this.x ? -1 : 1; }
    phys() {
      this.vy += K.GRAV; this.y += this.vy;
      if (this.y >= this.floorY) { this.y = this.floorY; this.vy = 0; this.onGround = true; } else this.onGround = false;
    }
    shoot(g, x, y, vx, vy, o) { g.eshots.push(new K.EShot(x, y, vx, vy, o)); }
    slash(g, w, h, dx, dy, life) { g.eshots.push(new K.EShot(this.x + dx, this.y + dy, 0, 0, { w: w, h: h, life: life, solid: true, color: '#ffffff' })); }
    // 当たってよいか。false なら「効かない」火花だけ出る（弱点の癖）
    guard(g, weapon, x, y) {
      const p = g.player;
      switch (this.kind) {
        case 'oni': return (p.x - this.x) * this.dir < 0;                           // 背面のみ有効
        case 'monk': return this.st !== 'spin';                                    // 回転中は無敵
        case 'guardian': return y == null || y <= this.y - this.h + 24;            // 頭だけ有効
        case 'matron': return !this.ring;                                          // 結界が張られている間は無敵
        case 'sorcerer': return this.st !== 'vanish';
        default: return true;
      }
    }
    update(g) {
      this.t++; if (this.flash > 0) this.flash--; if (this.swordCd > 0) this.swordCd--;
      if (this.frozen > 0) { this.frozen--; return; }
      if (this.cool > 0) this.cool--;
      const ai = K.BOSS_AI[this.kind]; if (ai) ai(this, g, g.player);
      this.x = K.clamp(this.x, g.lockX + 16, g.arenaRight() - 16);
      if (this.warn && this.warn.until < this.t) this.warn = null;
    }
    hit(dmg) { this.hp -= dmg; this.flash = 6; if (this.hp <= 0) this.dead = true; return this.dead; }
  }

  // 分身（闇の導師用）。触れても害はなく、何を当てても効かない
  class Decoy {
    constructor(x, def, floorY = GROUND) { this.isBoss = false; this.decoy = true; this.harmless = true; this.x = x; this.y = floorY; this.w = def.w; this.h = def.h; this.hp = 9999; this.maxHp = 9999; this.tags = []; this.def = def; this.dir = -1; this.t = 0; this.flash = 0; this.frozen = 0; this.dead = false; this.swordCd = 0; this.invisible = false; this.alpha = 0.55; }
    update() { this.t++; }
    guard() { return false; }
    hit() { return false; }
  }

  const AI = {
    // 鬼面の女: 近づいて斬る／高く跳んで背後へ回り込む。弱点は背中
    oni(b, g, p) {
      b.phys();
      if (b.st === 'walk') {
        if (b.t >= b.noTurn) b.dir = b.sign(p);
        b.x += b.dir * 0.5; b.sc++;
        if (Math.abs(p.x - b.x) < 40 && b.cool <= 0) { b.st = 'wind'; b.sc = 0; }
        else if (b.sc > 150 && b.onGround) { b.st = 'jump'; b.vy = -7.2; b.vx = ((p.x + (p.x > b.x ? 34 : -34)) - b.x) / 66; b.sc = 0; }
      } else if (b.st === 'wind') {
        b.sc++; if (b.sc === 16) b.slash(g, 28, 14, b.dir * (b.w / 2 + 14), -26, 10);
        if (b.sc > 34) { b.st = 'walk'; b.sc = 0; b.cool = 60; }
      } else if (b.st === 'jump') {
        b.x += b.vx; b.sc++;
        if (b.onGround && b.sc > 5) { b.st = 'walk'; b.sc = 0; b.vx = 0; b.noTurn = b.t + 55; }   // 着地後しばらく向き直らない＝背中が空く
      }
    },
    // 岩坊主: 岩を降らせ、分銅の金棒を回して突進（回転中は無敵）。止まった隙を狙う
    monk(b, g, p) {
      b.phys(); b.sc++;
      if (b.st === 'walk') b.st = 'idle';
      if (b.st === 'idle') {
        b.dir = b.sign(p);
        if (b.sc % 100 === 50) b.shoot(g, p.x + ((b.t * 7) % 50 - 25), b.floorY - 178, 0, 0.5, { g: 0.12, w: 10, h: 10, life: 200, color: '#8a7a6a' });
        if (b.sc > 110) { b.st = 'spin'; b.sc = 0; }
      } else if (b.st === 'spin') {
        b.dir = b.sign(p); b.x += b.dir * 1.5; if (b.sc > 110) { b.st = 'tired'; b.sc = 0; }
      } else if (b.st === 'tired') { if (b.sc > 80) { b.st = 'idle'; b.sc = 0; } }
    },
    // 門番の金剛: ゆっくり迫り、長い金棒を下段・上段へ振る。頭にしか効かない（ジャンプ攻撃が要る）
    guardian(b, g, p) {
      b.phys(); b.dir = b.sign(p);
      if (b.st === 'walk') {
        if (Math.abs(p.x - b.x) > 54) b.x += b.dir * 0.3;
        b.sc++; if (b.sc > 120) { b.st = 'wind'; b.sc = 0; b.lane = (b.lane + 1) % 2; }
      } else if (b.st === 'wind') {
        b.sc++; if (b.sc === 24) b.slash(g, 48, 12, b.dir * (b.w / 2 + 24), b.lane ? -48 : -12, 14);
        if (b.sc > 46) { b.st = 'walk'; b.sc = 0; }
      }
    },
    // 闇の導師: 闇に紛れて位置を替え、本物は1体だけ。光の輪（行って戻る）を投げる
    sorcerer(b, g, p) {
      const xs = [g.lockX + 60, g.lockX + 128, g.lockX + 196];
      b.sc++;
      if (b.sc === 1 || b.sc > 150) {
        b.sc = 1; b.st = 'vanish'; const real = (b.t * 7 + (p.x | 0)) % 3; b.real = real;
        b.x = xs[real]; let k = 0; xs.forEach((x, i) => { if (i !== real && b.decoys[k]) { b.decoys[k].x = x; k++; } });
      }
      if (b.sc > 22) b.st = 'show';
      b.dir = b.sign(p); b.alpha = b.st === 'vanish' ? 0.3 : 1;
      if (b.st === 'show' && b.sc % 70 === 40) b.shoot(g, b.x + b.dir * 10, b.y - 22, b.dir * 1.8, 0, { boom: true, life: 120, w: 10, h: 10, color: '#ffe080' });
    },
    // 炎の邪神: 火炎を扇状に吐き、足元から火柱を立てる
    flame(b, g, p) {
      b.dir = -1; b.sc++;
      b.x = b.homeX + Math.sin(b.t / 90) * 10;
      if (b.sc % 110 === 60) for (let i = -2; i <= 2; i++) b.shoot(g, b.x - 14, b.y - 34, -1.6, i * 0.32 - 0.2, { g: 0.02, life: 150, w: 10, h: 10, color: '#ff7020' });
      if (b.sc % 170 === 100) b.warn = { x: p.x, until: b.t + 30 };
      if (b.sc % 170 === 130) b.shoot(g, p.x, b.floorY, 0, -5.4, { g: 0.2, life: 70, w: 12, h: 14, solid: true, color: '#ff4010' });
    },
    // 水底の亡霊: 宙に漂い、金棒で地面に衝撃波を走らせ、水妖を呼ぶ
    wraith(b, g, p) {
      b.dir = b.sign(p); b.sc++;
      b.y = b.floorY - 6 - 14 * Math.sin(b.t / 30);
      if (Math.abs(p.x - b.x) > 40) b.x += b.dir * 0.35;
      if (b.sc % 120 === 100) b.warn = { x: b.x, until: b.t + 20, bar: true };
      if (b.sc % 120 === 0 && b.sc > 0) { b.shoot(g, b.x - 14, b.floorY - 5, -1.8, 0, { w: 14, h: 10, solid: true, life: 110, color: '#60c0ff' }); b.shoot(g, b.x + 14, b.floorY - 5, 1.8, 0, { w: 14, h: 10, solid: true, life: 110, color: '#60c0ff' }); }
      if (b.sc % 240 === 200) { const n = g.enemies.filter(e => e.type === 'naga' && !e.dead).length; if (n < 2) g.enemies.push(new K.Enemy('naga', K.clamp(b.x - 36, g.lockX + 24, g.arenaRight() - 24), b.floorY)); }
    },
    // 雪の精: 位置を転じ、高い/低い光線を予告してから放つ（しゃがむ・跳ぶで避ける）
    yuki(b, g, p) {
      const xs = [g.lockX + 70, g.lockX + 130, g.lockX + 200]; b.sc++;
      if (b.sc === 1) { b.x = xs[(b.t >> 3) % 3]; b.lane = (b.t >> 2) % 2; }
      b.dir = b.sign(p);
      b.alpha = b.sc < 30 ? 0.35 : 1;
      if (b.sc === 60) b.warn = { x: b.x + b.dir * (b.w / 2 + 105), until: b.t + 28, beam: true, lane: b.lane, w: 210 };
      if (b.sc === 90) { b.shoot(g, b.x + b.dir * (b.w / 2 + 105), b.floorY - (b.lane ? 24 : 4), 0, 0, { w: 210, h: 8, solid: true, life: 24, color: '#c0f8ff' }); }
      if (b.sc > 140) b.sc = 0;
    },
    // 空の天狗: 空を舞い、跳ねる独楽を落とし、時おり急降下する
    tengu(b, g, p) {
      b.sc++;
      if (b.st === 'walk') {
        b.x = g.lockX + 128 + Math.sin(b.t / 80) * 90; b.y = b.floorY - 78 + Math.sin(b.t / 23) * 10; b.dir = b.sign(p);
        if (b.sc % 70 === 35) b.shoot(g, b.x, b.y, 0, 0.5, { g: 0.12, bounce: true, life: 260, w: 10, h: 10, color: '#e0a040' });
        if (b.sc > 300) { b.st = 'dive'; b.sc = 0; b.tx = p.x; }
      } else if (b.st === 'dive') {
        const k = b.sc / 40; b.x += (b.tx - b.x) * 0.06; b.y = b.floorY - 78 + (k < 1 ? 56 * k : 56 * (2 - k > 0 ? 2 - k : 0)) ;
        if (b.sc > 80) { b.st = 'walk'; b.sc = 0; }
      }
    },
    // 念の剣客: 念動波を3方向に放ち、踏み込んで斬る
    swordsman(b, g, p) {
      b.phys(); b.sc++;
      if (b.st === 'walk') {
        b.dir = b.sign(p); if (Math.abs(p.x - b.x) > 90) b.x += b.dir * 0.4;
        if (b.sc === 50) for (let i = -1; i <= 1; i++) b.shoot(g, b.x + b.dir * 12, b.y - 24, b.dir * 2, i * 0.5, { life: 150, w: 8, h: 8, color: '#ff60d0' });
        if (b.sc > 110) { b.st = 'wind'; b.sc = 0; }
      } else if (b.st === 'wind') { if (b.sc > 24) { b.st = 'dash'; b.sc = 0; b.dir = b.sign(p); } }
      else if (b.st === 'dash') { b.x += b.dir * 3.2; if (b.sc % 3 === 0) b.slash(g, 22, 16, b.dir * 16, -24, 4); if (b.sc > 28) { b.st = 'walk'; b.sc = 0; } }
    },
    // 光の侍: 光線を溜めて連射し、跳びかかって斬る
    samurai(b, g, p) {
      b.phys(); b.sc++;
      if (b.st === 'walk') {
        b.dir = b.sign(p); if (Math.abs(p.x - b.x) > 110) b.x += b.dir * 0.4;
        if (b.sc === 50 || b.sc === 64) b.shoot(g, b.x + b.dir * 12, b.y - (b.sc === 50 ? 14 : 30), b.dir * 3.4, 0, { w: 18, h: 4, solid: true, life: 120, color: '#a0ffff' });
        if (b.sc > 130) { b.st = 'leap'; b.sc = 0; b.vy = -6; b.vx = (p.x - b.x) / 50; }
      } else if (b.st === 'leap') {
        b.x += b.vx;
        if (b.onGround && b.sc > 5) { b.slash(g, 34, 18, b.dir * 24, -20, 12); b.st = 'walk'; b.sc = 0; b.vx = 0; }
      }
    },
    // 鎧の大将: 胸の顔から火の玉、近づけば大太刀。足踏みで衝撃波
    armor(b, g, p) {
      b.dir = b.sign(p); b.sc++;
      if (Math.abs(p.x - b.x) > 60) b.x += b.dir * 0.25;
      if (b.sc % 100 === 60) { const a = Math.atan2(p.y - 20 - (b.y - 34), p.x - b.x); for (let i = -1; i <= 1; i++) b.shoot(g, b.x + b.dir * 10, b.y - 34, Math.cos(a + i * 0.25) * 1.5, Math.sin(a + i * 0.25) * 1.5, { life: 160, w: 8, h: 8, color: '#ff8020' }); }
      if (Math.abs(p.x - b.x) < 56 && b.cool <= 0) { b.cool = 110; b.warn = { x: b.x, until: b.t + 18, bar: true }; b.swing = b.t + 18; }
      if (b.swing && b.t === b.swing) b.slash(g, 46, 18, b.dir * (b.w / 2 + 22), -34, 12);
      if (b.sc % 260 === 200) { b.shoot(g, b.x - 16, b.floorY - 5, -1.8, 0, { w: 14, h: 10, solid: true, life: 100, color: '#ffa060' }); b.shoot(g, b.x + 16, b.floorY - 5, 1.8, 0, { w: 14, h: 10, solid: true, life: 100, color: '#ffa060' }); }
    },
    // 邪鬼の長: 結界で身を守りながら怨みの玉を放つ。結界が解けた隙に攻める
    matron(b, g, p) {
      b.phys(); b.dir = b.sign(p); b.sc++;
      if (b.st === 'walk') { b.st = 'barrier'; b.sc = 0; }
      if (b.st === 'barrier') {
        b.ring = true; if (b.sc % 55 === 30) b.shoot(g, b.x, b.y - 24, b.dir * 1.2, -0.6, { homing: 0.035, life: 260, w: 9, h: 9, color: '#c040ff' });
        if (b.sc > 170) { b.st = 'open'; b.sc = 0; b.ring = false; }
      } else if (b.st === 'open') {
        if (Math.abs(p.x - b.x) > 50) b.x += b.dir * 0.3;
        if (b.sc > 130) { b.st = 'barrier'; b.sc = 0; }
      }
    },
    // 闇の支配者: 化石の龍を走らせ、暗い玉を撃つ。体力が半分を切ると位置を転じ、上からも龍が来る
    overlord(b, g, p) {
      b.sc++; b.dir = b.sign(p); const phase2 = b.hp < b.maxHp / 2;
      if (!phase2) {
        if (b.sc % 200 === 120) for (let i = 0; i < 7; i++) b.shoot(g, g.lockX + 262 + i * 14, b.floorY - 8, -2.2, 0, { w: 16, h: 14, solid: true, life: 260, color: '#d8d0b0' });
        if (b.sc % 90 === 45) for (let i = -1; i <= 1; i++) { const a = Math.atan2(p.y - 20 - (b.y - 40), p.x - b.x); b.shoot(g, b.x + b.dir * 12, b.y - 40, Math.cos(a + i * 0.3) * 1.6, Math.sin(a + i * 0.3) * 1.6, { life: 200, w: 8, h: 8, color: '#8040c0' }); }
      } else {
        if (b.sc % 140 === 1) { const xs = [g.lockX + 60, g.lockX + 128, g.lockX + 196, g.arenaRight() - 40]; b.x = xs[(b.t >> 2) % 4]; }
        if (b.sc % 220 === 120) for (let i = 0; i < 7; i++) b.shoot(g, g.lockX + 262 + i * 14, b.floorY - 168 + i * 4, -1.8, 0.9, { w: 16, h: 14, solid: true, life: 260, color: '#d8d0b0' });
        if (b.sc % 150 === 75) { const n = g.enemies.filter(e => e.type === 'ghoul' && !e.dead).length; if (n < 2) g.enemies.push(new K.Enemy('ghoul', K.clamp(b.x - 40, g.lockX + 24, g.arenaRight() - 24), b.floorY)); }
        if (b.sc % 80 === 40) { const a = Math.atan2(p.y - 20 - (b.y - 40), p.x - b.x); b.shoot(g, b.x + b.dir * 12, b.y - 40, Math.cos(a) * 1.8, Math.sin(a) * 1.8, { life: 200, w: 9, h: 9, color: '#a050e0' }); }
      }
    },
  };
  AI.gate_guard=(b,g,p)=>{
    b.phys();b.dir=b.sign(p);b.sc++;
    if(b.st==='walk'){b.x+=b.dir*.35;if(Math.abs(p.x-b.x)<48&&b.cool<=0){b.st='wind';b.sc=0;}}
    else if(b.st==='wind'&&b.sc>=16){b.slash(g,32,14,b.dir*22,-24,8);b.st='recover';b.sc=0;}
    else if(b.st==='recover'&&b.sc>=24){b.st='walk';b.sc=0;b.cool=60;}
  };
  // Reference footage shows both later gate opponents hopping with straight swords.
  // Exact frame timings remain inferred; identities are selected by the outer round.
  const gateDuelist=(b,g,p,round)=>{
    b.phys();b.dir=b.sign(p);b.sc++;
    if(!b.onGround)b.x+=b.vx;
    if(b.st==='walk'){
      if(b.onGround)b.x+=b.dir*(round===2?.45:.5);
      if(b.onGround&&b.t%120===60){b.vy=round===2?-6.4:-6.8;b.vx=b.dir*1.2;b.onGround=false;}
      if(Math.abs(p.x-b.x)<(round===2?66:50)&&b.cool<=0){b.st='wind';b.sc=0;}
    }else if(b.st==='wind'&&b.sc>=18){
      if(round===2)b.slash(g,44,8,b.dir*29,-29,9);
      else b.slash(g,24,40,b.dir*20,-26,9);
      b.st='recover';b.sc=0;
    }else if(b.st==='recover'&&b.sc>=24){b.st='walk';b.sc=0;b.cool=54;}
  };
  AI.gate_duelist_r2=(b,g,p)=>gateDuelist(b,g,p,2);
  AI.gate_duelist_r3=(b,g,p)=>gateDuelist(b,g,p,3);
  K.BOSS_AI = AI;
  K.Boss = Boss; K.Decoy = Decoy;
})(window.KOMA);
