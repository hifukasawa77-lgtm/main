/* 三国志・天下三分 シナリオ定義 / Scenario setups for "Sanguo: Three Kingdoms Divided".
   sanguo.html より前に classic script として読み込む。
   Loaded as a classic script before sanguo.html's IIFE (ES Modules are not usable under file://).

   P0 時点では空配列。P1 で 8シナリオ × 全20都市を記述する。
   Empty at P0; the eight scenario setups (20 cities each) land in P1.

   1件の構造 / Shape of one entry:
   {
     id:'red_cliffs', year:208, playable:['wei','shu','wu'],
     victory:{ratio:0.75, hint:'…'},
     gold:{def:600, by:{wei:900}}, food:{def:1200, by:{wei:2000}},
     relations:[['shu','wu','alliance']],
     wildSeed:'red_cliffs', notes:'…',
     cities:{ chang_an:['wei',70,60,['zhong_yao']], … 全20都市を必ず列挙 … }
   }
*/
window.SANGUO_SCENARIOS = [];
