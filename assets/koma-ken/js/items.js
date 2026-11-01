// アイテム定義（4分類）と、属性相性ダメージ、所持品の管理。仕組みは指定どおり、名称・見た目はオリジナル。
(function (K) {
  // ---- 1) 自動アイテム: 持っているだけで条件を満たすと自動で効く ----
  K.AUTO = {
    decoy:   { id: 'decoy',   name: '身代わり人形', desc: 'ミスしたとき1つ消費して復活' },
    peacock: { id: 'peacock', name: '金翅鳥',       desc: '底なし沼や穴に落ちたとき救出' },
    key:     { id: 'key',     name: '門の鍵',       desc: 'ステージ内の「結界門」に入れる' },
    torch:   { id: 'torch',   name: '松明',         desc: '結界門の中の暗闇を照らす' },
    charm:   { id: 'charm',   name: '護符',         desc: '見えない敵から身を守る' },
  };

  // ---- 2) 即効アイテム: 取ると一定時間効く（frames は持続フレーム数） ----
  K.INSTANT = {
    eight:   { id: 'eight',   name: '八方破',     frames: 600, desc: '攻撃が8方向へ飛ぶ' },
    dragon:  { id: 'dragon',  name: '蒼龍変化',   frames: 480, desc: '龍に変身・無敵' },
    spin:    { id: 'spin',    name: '旋風斬',     frames: 600, desc: '剣が高速回転し身を守る' },
    speed:   { id: 'speed',   name: '韋駄天',     frames: 900, desc: '移動速度アップ' },
    mini:    { id: 'mini',    name: '小分身',     frames: 600, desc: '4人に分裂して同時に斬る' },
    falcon:  { id: 'falcon',  name: '隼',         frames: 900, desc: '頭上の敵を隼が攻撃' },
    twin:    { id: 'twin',    name: '双身',       frames: 480, desc: '2人になり無敵' },
    after:   { id: 'after',   name: '残像',       frames: 480, desc: '残像をまとい無敵' },
    gold:    { id: 'gold',    name: '金仏',       frames: 0,   desc: '10,000点', score: 10000 },
    float:   { id: 'float',   name: '浮遊仏',     frames: 0,   desc: '1UP', life: 1 },
  };

  // ---- 3) セレクトアイテム: Bボタンで投げる遠距離武器。ボス撃破で次へ成長する ----
  //   weak: この属性タグの敵に3倍 / allMult: 全ての敵へ倍率 / pierce: 貫通
  K.SELECT = [
    { id: 'white',   name: '白珠',     dmg: 1, pierce: false, color: '#f4f4f4' },
    { id: 'red',     name: '紅珠',     dmg: 1, pierce: true,  color: '#e04040' },
    { id: 'snow',    name: '雪珠',     dmg: 1, weak: 'FIRE',   color: '#9fd8ff' },
    { id: 'flame',   name: '火炎弾',   dmg: 1, weak: 'ICE',    color: '#ff8a2a' },
    { id: 'thunder', name: '雷閃',     dmg: 1, weak: 'ARMOR',  color: '#ffe84a' },
    { id: 'rosary',  name: '念珠',     dmg: 1, weak: 'UNDEAD', color: '#b080ff' },
    { id: 'light',   name: '光珠',     dmg: 1, weak: 'CAVE',   color: '#fff6a0' },
    { id: 'air',     name: '風弾',     dmg: 1, weak: 'WATER',  color: '#7fe8c8' },
    { id: 'psy1',    name: '念動波・壱', dmg: 1, pierce: true, allMult: 3, color: '#ff60d0' },
    { id: 'psy2',    name: '念動波・弐', dmg: 1, pierce: true, allMult: 5, color: '#ff2090' },
  ];

  // ---- 4) 単発アイテム: ポーズ画面で選んで1回使い切り ----
  K.SINGLE = {
    fly:     { id: 'fly',     name: '飛翔の法',   desc: '一定時間、空を飛べる' },
    wind:    { id: 'wind',    name: '疾風の法',   desc: '画面内の敵を全滅させる' },
    fire:    { id: 'fire',    name: '護法火',     desc: '周囲を回る火の玉をまとう' },
    bind:    { id: 'bind',    name: '縛呪の法',   desc: '敵を全員止める' },
    escape:  { id: 'escape',  name: '脱出の法',   desc: '冥府の門から緊急脱出（門の外では使えない）' },
    thunder: { id: 'thunder', name: '雷鳴の法',   desc: '画面内の敵に大ダメージ' },
    see:     { id: 'see',     name: '見破りの法', desc: '見えない敵が見えるようになる' },
    halt:    { id: 'halt',    name: '封魔の法',   desc: '敵の出現を止める' },
    aurora:  { id: 'aurora',  name: '極光の法',   desc: '前方へ極光の光線を放つ' },
    bomb:    { id: 'bomb',    name: '連爆の法',   desc: '自爆して画面内に大ダメージ（体力は1になる）' },
  };

  // ---- 属性相性ダメージ（フェーズ2の中核。純粋関数なので単体で検査できる） ----
  //  weapon: {dmg, weak?, allMult?}  enemy: {tags: string[]}
  K.calcDamage = function (weapon, enemy) {
    let mult = 1, weak = false;
    if (weapon.allMult) mult *= weapon.allMult;
    if (weapon.weak && enemy.tags && enemy.tags.indexOf(weapon.weak) >= 0) { mult *= 3; weak = true; }
    return { dmg: (weapon.dmg || 0) * mult, mult: mult, weak: weak };
  };

  // ---- 所持品 ----
  class Inventory {
    constructor() {
      this.auto = { decoy: 0, peacock: 0, key: 0, torch: 0, charm: 0 };
      this.selectIndex = 0;      // K.SELECT の添字
      this.single = [];          // 単発アイテムの id（最大6個）
    }
    get select() { return K.SELECT[this.selectIndex]; }
    cycleSelect() { this.selectIndex = (this.selectIndex + 1) % K.SELECT.length; }
    growSelect() { this.selectIndex = Math.min(this.selectIndex + 1, K.SELECT.length - 1); }   // ボス撃破で成長
    addAuto(id) { if (id in this.auto) { this.auto[id] = Math.min(this.auto[id] + 1, 9); return true; } return false; }
    consumeAuto(id) { if (this.auto[id] > 0) { this.auto[id]--; return true; } return false; }
    addSingle(id) { if (K.SINGLE[id] && this.single.length < 6) { this.single.push(id); return true; } return false; }
    takeSingle(index) { return index >= 0 && index < this.single.length ? this.single.splice(index, 1)[0] : null; }
  }
  K.Inventory = Inventory;
})(window.KOMA);
