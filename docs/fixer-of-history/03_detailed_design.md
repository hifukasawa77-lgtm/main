# 影の権力者（Fixer of History）詳細設計書

## 1. 実装ファイル

### 1.1 新規作成

- `fixer-of-history.html`

### 1.2 変更

- `index.html`
- `sitemap.xml` は実装時に公開URL方針に合わせて更新判断

### 1.3 任意追加

- `assets/images/fixer-of-history-hero.png`

ユーザー提供画像を正式に使用する場合のみ追加する。画像がない場合はCSS / Canvasサムネイルで代替する。

## 2. `index.html` 変更設計

### 2.1 追加位置

`#works .works-grid` のボードゲーム群の先頭付近に追加する。

候補位置:

- `backgammon.html` カードの前
- または `hanafuda.html` の後

新作として目立たせる場合は先頭付近を推奨する。

### 2.2 カードHTML案

```html
<a class="card work-card reveal" href="fixer-of-history.html" data-category="board">
  <div class="work-thumb work-thumb-fixer">
    <span class="work-thumb-emoji">密</span>
  </div>
  <div class="work-body">
    <div class="work-kicker" data-i18n="kicker-board-sim">ボードゲーム × 歴史シミュレーション</div>
    <h3 data-i18n="work-fixer-title">影の権力者</h3>
    <p data-i18n="work-fixer-desc">偉人を裏から動かし、恩義と悪名を管理して歴史の勝ち馬を操る戦略ボードゲーム。</p>
    <span class="work-link" data-i18n="work-play-now">今すぐ遊ぶ →</span>
  </div>
</a>
```

### 2.3 追加CSS案

既存の `work-thumb-*` 群付近に追加する。

```css
.work-thumb-fixer {
  position: relative;
  background:
    radial-gradient(circle at 26% 22%, rgba(34, 211, 238, 0.18), transparent 28%),
    linear-gradient(135deg, #120f19 0%, #22172d 52%, #2a1d18 100%);
}
.work-thumb-fixer::before {
  content: "";
  position: absolute;
  inset: 22% 16%;
  border: 1px solid rgba(245, 222, 179, 0.32);
  background:
    linear-gradient(90deg, transparent 48%, rgba(245, 222, 179, 0.22) 49%, rgba(245, 222, 179, 0.22) 51%, transparent 52%),
    linear-gradient(rgba(245, 222, 179, 0.1), rgba(245, 222, 179, 0.04));
  transform: rotate(-5deg);
}
.work-thumb-fixer .work-thumb-emoji {
  position: relative;
  color: #f4d58d;
  font-weight: 900;
  font-size: 2.2rem;
}
```

### 2.4 i18n追加キー

日本語辞書:

```js
'kicker-board-sim': 'ボードゲーム × 歴史シミュレーション',
'work-fixer-title': '影の権力者',
'work-fixer-desc': '偉人を裏から動かし、恩義と悪名を管理して歴史の勝ち馬を操る戦略ボードゲーム。',
```

英語辞書:

```js
'kicker-board-sim': 'Board Game / History Sim',
'work-fixer-title': 'Fixer of History',
'work-fixer-desc': 'Manipulate historical heroes from the shadows, balancing favors and infamy to back the winning side.',
```

## 3. `fixer-of-history.html` HTML構造

```html
<body>
  <canvas id="bg-canvas" aria-hidden="true"></canvas>
  <header class="game-header">...</header>
  <main class="game-shell">
    <section class="board-section">
      <div class="turn-strip">...</div>
      <canvas id="game-board"></canvas>
    </section>
    <aside class="side-panel">
      <section class="panel player-panel">...</section>
      <section class="panel action-panel">...</section>
      <section class="panel cards-panel">...</section>
      <section class="panel heroes-panel">...</section>
    </aside>
    <section class="log-panel">...</section>
  </main>
  <dialog id="result-dialog">...</dialog>
  <script>...</script>
</body>
```

## 4. CSS設計

### 4.1 主要変数

```css
:root {
  --bg: #08070b;
  --surface: rgba(20, 18, 28, 0.78);
  --surface-strong: rgba(32, 28, 42, 0.92);
  --line: rgba(255, 255, 255, 0.12);
  --text: #f7f0df;
  --muted: #b7ad9b;
  --cyan: #22d3ee;
  --purple: #a78bfa;
  --gold: #f4d58d;
  --red: #ef4444;
  --green: #22c55e;
}
```

### 4.2 レイアウト

- `.game-shell`: PCでは2カラム
- `.board-section`: Canvasを主役にする
- `.side-panel`: ステータス、行動、カードを縦に並べる
- 900px未満では1カラム

### 4.3 カードUI

- 角丸は既存サイトより控えめにし、8pxから14px程度
- 背景は半透明
- 境界線は薄い白
- 選択中のカードのみアクセント色で強調

## 5. JavaScript設計

### 5.1 定数

```js
const MAX_TURNS = 10;
const ACTIONS_PER_TURN = 2;
const INITIAL_MONEY = 10;
const INITIAL_HAND_SIZE = 3;
const PURGE_INFAMY = 12;
```

### 5.2 状態

```js
const state = {
  lang: 'ja',
  turn: 1,
  phase: 'planning',
  actionsLeft: 2,
  selectedHeroId: null,
  selectedLocationId: null,
  selectedCardId: null,
  fixers: [],
  heroes: [],
  locations: [],
  deck: [],
  discard: [],
  log: [],
  gameOver: false
};
```

### 5.3 データ定義

#### locations

```js
const LOCATION_DEFS = [
  { id: 'owari', nameJa: '尾張', nameEn: 'Owari', x: 0.55, y: 0.56, value: 4, neighbors: ['kyoto', 'omi', 'kai'] },
  { id: 'kyoto', nameJa: '京', nameEn: 'Kyoto', x: 0.45, y: 0.48, value: 6, neighbors: ['owari', 'omi', 'settsu'] },
  { id: 'omi', nameJa: '近江', nameEn: 'Omi', x: 0.50, y: 0.50, value: 3, neighbors: ['kyoto', 'owari', 'echizen'] },
  { id: 'kai', nameJa: '甲斐', nameEn: 'Kai', x: 0.66, y: 0.50, value: 4, neighbors: ['owari', 'edo', 'echigo'] },
  { id: 'echigo', nameJa: '越後', nameEn: 'Echigo', x: 0.66, y: 0.32, value: 4, neighbors: ['kai', 'edo'] },
  { id: 'aki', nameJa: '安芸', nameEn: 'Aki', x: 0.23, y: 0.56, value: 4, neighbors: ['settsu'] },
  { id: 'settsu', nameJa: '摂津', nameEn: 'Settsu', x: 0.38, y: 0.55, value: 5, neighbors: ['kyoto', 'aki'] },
  { id: 'edo', nameJa: '江戸', nameEn: 'Edo', x: 0.78, y: 0.54, value: 5, neighbors: ['kai', 'echigo'] }
];
```

座標はCanvasサイズに対する比率で保持し、リサイズ時に再計算する。

#### heroes

```js
const HERO_DEFS = [
  { id: 'nobunaga', nameJa: '織田信長', nameEn: 'Oda Nobunaga', ambition: 5, locationId: 'owari', color: '#ef4444' },
  { id: 'hideyoshi', nameJa: '豊臣秀吉', nameEn: 'Toyotomi Hideyoshi', ambition: 4, locationId: 'settsu', color: '#f59e0b' },
  { id: 'ieyasu', nameJa: '徳川家康', nameEn: 'Tokugawa Ieyasu', ambition: 4, locationId: 'edo', color: '#22c55e' },
  { id: 'shingen', nameJa: '武田信玄', nameEn: 'Takeda Shingen', ambition: 5, locationId: 'kai', color: '#dc2626' },
  { id: 'kenshin', nameJa: '上杉謙信', nameEn: 'Uesugi Kenshin', ambition: 5, locationId: 'echigo', color: '#38bdf8' },
  { id: 'motonari', nameJa: '毛利元就', nameEn: 'Mori Motonari', ambition: 3, locationId: 'aki', color: '#a78bfa' }
];
```

#### cards

```js
const CARD_DEFS = [
  { id: 'march', type: 'move', nameJa: '進軍命令', nameEn: 'March Order' },
  { id: 'raid', type: 'attack', nameJa: '密命襲撃', nameEn: 'Covert Raid' },
  { id: 'bribe', type: 'favor', nameJa: '賄賂', nameEn: 'Bribe' },
  { id: 'disrupt', type: 'debuff', nameJa: '攪乱', nameEn: 'Disruption' },
  { id: 'cover', type: 'cover', nameJa: '隠蔽', nameEn: 'Cover-Up' }
];
```

## 6. 主要関数

### 6.1 初期化

```js
function initGame() {
  state.turn = 1;
  state.phase = 'planning';
  state.actionsLeft = ACTIONS_PER_TURN;
  state.fixers = createFixers();
  state.heroes = createHeroes();
  state.locations = createLocations();
  state.deck = createDeck();
  dealInitialHands();
  renderAll();
}
```

### 6.2 描画

```js
function renderAll() {
  renderBoard();
  renderTurnStrip();
  renderPlayerPanel();
  renderActionPanel();
  renderCards();
  renderHeroes();
  renderLog();
}
```

### 6.3 投資

```js
function invest(fixerId, heroId, amount) {
  const fixer = getFixer(fixerId);
  const hero = getHero(heroId);
  if (!hero.alive || fixer.money < amount) return false;

  fixer.money -= amount;
  hero.funds += amount;
  fixer.favors[heroId] = (fixer.favors[heroId] || 0) + amount;
  addLog('invest', { fixerId, heroId, amount });
  consumeActionIfHuman(fixerId);
  return true;
}
```

### 6.4 密書

```js
function playCard(fixerId, cardInstanceId, target) {
  const card = findCardInHand(fixerId, cardInstanceId);
  if (!card) return false;

  switch (card.type) {
    case 'move':
      return applyMoveCard(fixerId, card, target);
    case 'attack':
      return applyAttackCard(fixerId, card, target);
    case 'favor':
      return applyFavorCard(fixerId, card, target);
    case 'debuff':
      return applyDebuffCard(fixerId, card, target);
    case 'cover':
      return applyCoverCard(fixerId, card, target);
    default:
      return false;
  }
}
```

### 6.5 激動フェイズ

```js
function resolveUpheavalPhase() {
  state.phase = 'upheaval';
  const actingHeroes = [...state.heroes]
    .filter(hero => hero.alive)
    .sort((a, b) => b.funds - a.funds || b.ambition - a.ambition);

  actingHeroes.forEach(hero => {
    if (!hero.alive) return;
    resolveHeroAction(hero);
    resolveBattlesAt(hero.locationId);
  });
}
```

### 6.6 偉人AI

```js
function resolveHeroAction(hero) {
  const location = getLocation(hero.locationId);
  const enemiesHere = getHeroesAt(location.id).filter(other => other.id !== hero.id);
  if (enemiesHere.length > 0) return;

  const next = chooseHeroDestination(hero, location);
  if (next) {
    hero.locationId = next.id;
    addLog('heroMove', { heroId: hero.id, locationId: next.id });
  }
}
```

移動先選定:

```js
function chooseHeroDestination(hero, location) {
  const candidates = location.neighbors.map(getLocation);
  return candidates.sort((a, b) => {
    const enemyScoreB = getHeroesAt(b.id).length > 0 ? 3 : 0;
    const enemyScoreA = getHeroesAt(a.id).length > 0 ? 3 : 0;
    return (b.value + enemyScoreB) - (a.value + enemyScoreA);
  })[0];
}
```

### 6.7 合戦

```js
function resolveBattle(attacker, defender) {
  const attackScore = rollD6() + attacker.ambition + attacker.funds + (attacker.battleModifier || 0);
  const defendScore = rollD6() + defender.ambition + defender.funds + (defender.battleModifier || 0);
  const winner = chooseBattleWinner(attacker, defender, attackScore, defendScore);
  const loser = winner.id === attacker.id ? defender : attacker;

  offerBetrayalIfNeeded(winner, loser);
  killHero(loser.id);
  addLog('battle', { winnerId: winner.id, loserId: loser.id, attackScore, defendScore });
}
```

### 6.8 乗り換え

人間プレイヤーの場合は確認UIを表示する。

```js
function betray(fixerId, loserHeroId, winnerHeroId) {
  const fixer = getFixer(fixerId);
  const oldFavor = fixer.favors[loserHeroId] || 0;
  const movedFavor = Math.floor(oldFavor / 2);

  fixer.favors[loserHeroId] = 0;
  fixer.favors[winnerHeroId] = (fixer.favors[winnerHeroId] || 0) + movedFavor;
  fixer.infamy += 3;
  addLog('betray', { fixerId, loserHeroId, winnerHeroId, movedFavor });
}
```

### 6.9 収穫

```js
function resolveHarvestPhase() {
  state.phase = 'harvest';
  state.heroes.filter(h => h.alive).forEach(hero => {
    const location = getLocation(hero.locationId);
    const totalFavor = getTotalFavorForHero(hero.id);
    if (totalFavor <= 0) return;

    state.fixers.forEach(fixer => {
      if (fixer.purged) return;
      const favor = fixer.favors[hero.id] || 0;
      const payout = Math.floor(location.value * favor / totalFavor);
      fixer.money += payout;
      if (payout > 0) addLog('harvest', { fixerId: fixer.id, heroId: hero.id, payout });
    });
  });
}
```

### 6.10 パラドックスイベント

```js
function resolveParadoxEvent() {
  const ranking = calculateCurrentInfluenceRanking();
  const leader = ranking[0];
  const runnerUp = ranking[1];
  if (!leader || !runnerUp) return;

  const gap = leader.score - runnerUp.score;
  const chance = gap >= 5 ? 0.45 : 0.15;
  if (Math.random() > chance) return;

  triggerParadoxFor(leader.fixerId);
}
```

## 7. UIイベント

### 7.1 Canvasクリック

- 拠点クリック: `selectedLocationId` を更新
- 偉人クリック: `selectedHeroId` を更新
- 選択状態をアクションパネルへ反映

### 7.2 アクションボタン

- 投資: 選択偉人と金額を検証して `invest`
- 密書: 選択カードと対象を検証して `playCard`
- 流言飛語: 対象CPU / 偉人を選択して `accuse`
- 休息: 資金+1、アクション消費

### 7.3 フェイズ進行

人間のアクションが0になったら、CPU策謀を実行し、激動、収穫、終了処理へ進む。

```js
function consumeActionIfHuman(fixerId) {
  if (fixerId !== 'player') return;
  state.actionsLeft -= 1;
  if (state.actionsLeft <= 0) endPlanningPhase();
  renderAll();
}
```

## 8. ログ設計

ログは最新30件まで保持する。

ログ種別:

- `invest`
- `card`
- `accuse`
- `heroMove`
- `battle`
- `betray`
- `harvest`
- `paradox`
- `purge`
- `gameEnd`

ログ文言は `tLog(type, payload)` で言語ごとに生成する。

## 9. 結果画面

表示項目:

- 順位
- フィクサー名
- 影響力
- 生存偉人への恩義
- 拠点ボーナス
- 悪名
- 悪名ペナルティ
- 粛清状態

勝者の表示:

```text
勝者: あなた
歴史は表の英雄ではなく、影の一筆で動いた。
```

英語:

```text
Winner: You
History was moved not by the hero in the light, but by the hand in the shadows.
```

## 10. 検証項目

### 10.1 機能検証

- ゲーム開始できる
- 投資で資金が減り、恩義が増える
- 密書カードが手札から消費される
- 偉人が自動移動する
- 同一拠点で合戦が発生する
- 敗者が死亡する
- 乗り換えで悪名が増える
- 収穫で資金が増える
- パラドックスイベントが発生する
- 悪名12以上で粛清される
- 10ターンで結果が出る

### 10.2 UI検証

- PC幅でボードとサイドパネルが崩れない
- 360px幅で主要ボタンが押せる
- Canvas選択状態が見える
- ログが読める
- 日本語 / 英語を切り替えられる

### 10.3 セキュリティ検証

- `innerHTML` にユーザー入力を入れない
- ログ描画は `textContent` を基本にする
- 外部スクリプトを追加しない

## 11. 実装順序

1. `fixer-of-history.html` の静的レイアウト作成
2. データ定義と初期化
3. Canvasボード描画
4. 投資アクション
5. 密書カード
6. CPU策謀
7. 偉人AIと合戦
8. 収穫、悪名、粛清
9. パラドックスイベント
10. 結果画面
11. `index.html` のカード追加
12. 表示確認と仕様適合チェック

## 12. Evaluator採点観点

合格基準:

- 80点以上
- 仕様適合性16点以上
- XSS等の重大リスクがない

採点内訳:

- 仕様適合性: 20点
- ゲーム進行の安定性: 20点
- UI / UX: 15点
- レスポンシブ対応: 10点
- デザイン整合性: 10点
- コード品質: 10点
- セキュリティ: 10点
- ローカライズ: 5点
