/* 三国志・天下三分 武将ロア定義 / General lore for "Sanguo: Three Kingdoms Divided".
   sanguo.html より前に classic script として読み込む。
   Loaded as a classic script before sanguo.html's IIFE (ES Modules are not usable under file://).

   P0 時点では空の器。P5（一騎打ちの名乗り演出）で epithet を充実させる。
   Skeleton at P0; `epithet` is filled out in P5 (duel challenge cut-scene).

   epithet    : {generalId: {sobriquet:'二つ名', origin:'出身地'}}  未定義は決定論生成にフォールバック
   affinity   : {generalId: ['cityId', …]}  在野配分でこの都市に配られやすくなる（重み ×6）
   extraNames : {generalId: '表示名'}  GENERAL_JP に無い武将の日本語名
*/
window.SANGUO_LORE = { epithet: {}, affinity: {}, extraNames: {} };
