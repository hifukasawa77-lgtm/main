// 降魔七星剣 ─ 共通定数と小さな道具。名前空間は KOMA に集約する（外部ライブラリ・ビルド不使用）。
window.KOMA = window.KOMA || {};
(function (K) {
  K.W = 256; K.H = 240;            // 内部解像度（8ビット機相当の低解像度）。画面へは整数倍で拡大する
  K.GROUND = 208;                  // 地面の高さ（足元のY）
  K.GRAV = 0.22; K.MAXFALL = 6;
  K.FPS = 60;

  // 敵の属性タグ（フェーズ2：相性ダメージの鍵）
  K.TAG = { FIRE: 'FIRE', ICE: 'ICE', ARMOR: 'ARMOR', UNDEAD: 'UNDEAD', WATER: 'WATER', CAVE: 'CAVE' };
  K.TAG_JP = { FIRE: '火', ICE: '氷', ARMOR: '鎧', UNDEAD: '死人', WATER: '水', CAVE: '洞窟' };

  // 箱は {x,y,w,h}（左上基準）。キャラは x=中心 / y=足元 で持ち、box() で変換する
  K.overlap = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
  K.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  K.box = function (e) { return { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h }; };
})(window.KOMA);
