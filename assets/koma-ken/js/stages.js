// ステージデータ。形式はフェーズ4で全ステージに使い回す:
//   width: ステージの幅(px) / pits: 穴[[x1,x2],...] / platforms: 足場[{x,y,w}] / enemies: [{type,x,y?}]
//   pickups: [{cat:'instant'|'auto'|'select'|'single', id, x, y?}] / respawn: 倒した敵が再出現するか（訓練場のみ）
(function (K) {
  // 訓練場: 属性相性・アイテム・弾消し・穴落ち（金翅鳥の救出）を一通り試せる
  const training = {
    id: 'training', name: '訓練場', jp: '訓練場', bg: 'training', respawn: true, width: 1280,
    pits: [[900, 940]],
    platforms: [{ x: 600, y: 160, w: 64 }, { x: 700, y: 128, w: 64 }],
    enemies: [
      { type: 'plain', x: 220 }, { type: 'ember', x: 320 }, { type: 'frost', x: 420 }, { type: 'knight', x: 520 },
      { type: 'ghoul', x: 640 }, { type: 'naga', x: 760 }, { type: 'bat', x: 820, y: 190 }, { type: 'gunner', x: 1060 },
    ],
    pickups: [
      { cat: 'auto', id: 'decoy', x: 90 }, { cat: 'auto', id: 'peacock', x: 110 }, { cat: 'auto', id: 'key', x: 130 }, { cat: 'auto', id: 'charm', x: 150 },
      { cat: 'instant', id: 'speed', x: 170 }, { cat: 'instant', id: 'spin', x: 190 }, { cat: 'instant', id: 'eight', x: 210 },
      { cat: 'instant', id: 'mini', x: 250 }, { cat: 'instant', id: 'dragon', x: 280 }, { cat: 'instant', id: 'twin', x: 310 }, { cat: 'instant', id: 'falcon', x: 340 },
      { cat: 'instant', id: 'after', x: 370 }, { cat: 'instant', id: 'gold', x: 400 }, { cat: 'instant', id: 'float', x: 430 },
      { cat: 'single', id: 'wind', x: 460 }, { cat: 'single', id: 'thunder', x: 480 }, { cat: 'single', id: 'bind', x: 500 }, { cat: 'single', id: 'fire', x: 540 },
      { cat: 'single', id: 'aurora', x: 560 }, { cat: 'single', id: 'fly', x: 580 },
    ],
  };

  // 全13ステージの枠（フェーズ4で中身を実装）。名称・ボスはオリジナル。構成（4ラウンド・全13）は仕様どおり
  const names = [
    ['r1s1', 'ROUND 1-1', '竹林', '鬼面の女'], ['r1s2', 'ROUND 1-2', '杉の山道', '岩坊主'],
    ['r1s3', 'ROUND 1-3', '墓地', '門番の金剛'], ['r1s4', 'ROUND 1-4', '魔寺', '闇の導師'],
    ['r2s1', 'ROUND 2-1', '火炎山', '炎の邪神'], ['r2s2', 'ROUND 2-2', '鍾乳洞', '水底の亡霊'],
    ['r2s3', 'ROUND 2-3', '氷結山', '雪の精'], ['r2s4', 'ROUND 2-4', '飛天の塔', '空の天狗'],
    ['r3s1', 'ROUND 3-1', '底なし沼', '念の剣客'], ['r3s2', 'ROUND 3-2', '城壁', '光の侍'],
    ['r3s3', 'ROUND 3-3', '石垣', '鎧の大将'], ['r3s4', 'ROUND 3-4', '城内', '邪鬼の長'],
    ['r4s1', 'LAST ROUND', '冥府', '闇の支配者'],
  ];
  K.STAGE_LIST = names.map(function (n) { return { id: n[0], label: n[1], name: n[2], boss: n[3], implemented: false }; });
  K.STAGES = { training: training };
})(window.KOMA);
