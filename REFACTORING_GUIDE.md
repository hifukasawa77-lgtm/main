# リファクタリング実装ガイド

## 段階的な実装手順

---

## ? Phase 1: useReducer + Context 導入

### Step 1: Game State の定義

**ファイル: `src/contexts/gameStateTypes.js`**

```javascript
// ゲーム状態の初期値
export const initialGameState = {
  // UI状態
  gameState: 'start', // 'start' | 'playing' | 'shop' | 'stageClear' | 'gameover' | 'victory'
  showShop: false,
  showInventory: false,
  showCollection: false,
  showTutorial: false,
  showStory: false,
  
  // ゲーム進行
  currentStage: 1,
  currentTurn: 'player', // 'player' | 'enemy'
  
  // ボード状態
  board: [],
  selectedCell: null,
  hint: null,
  
  // プレイヤー状態
  playerHp: 200,
  armor: 0,
  money: 100000,
  combo: 0,
  hintCount: 3,
  promoteCardCount: 0,
  
  // 敵状態
  monsterHp: 0,
  
  // UI表示
  message: '',
  damageAnimation: null,
  
  // 設定
  difficulty: 'normal', // 'easy' | 'normal' | 'hard'
  soundEnabled: true,
  
  // プログレッション
  achievements: {
    firstWin: false,
    perfectStage: false,
    comboMaster: false,
    allClear: false,
    noHint: true
  },
  dailyMissions: {
    lastDate: '',
    missions: []
  },
  rankings: [],
  yokaiCollection: [],
  inventory: [],
  shopCategory: 'all'
};

// アクションタイプ定義
export const ACTIONS = {
  // UI
  SET_GAME_STATE: 'SET_GAME_STATE',
  TOGGLE_SHOP: 'TOGGLE_SHOP',
  TOGGLE_INVENTORY: 'TOGGLE_INVENTORY',
  
  // ゲーム進行
  START_NEW_GAME: 'START_NEW_GAME',
  START_NEXT_STAGE: 'START_NEXT_STAGE',
  ADVANCE_TURN: 'ADVANCE_TURN',
  
  // ダメージと状態変化
  DEAL_DAMAGE: 'DEAL_DAMAGE',
  HEAL: 'HEAL',
  ADD_ARMOR: 'ADD_ARMOR',
  
  // コンボとスコア
  INCREMENT_COMBO: 'INCREMENT_COMBO',
  RESET_COMBO: 'RESET_COMBO',
  ADD_MONEY: 'ADD_MONEY',
  
  // ボード操作
  SET_BOARD: 'SET_BOARD',
  SELECT_CELL: 'SELECT_CELL',
  SET_HINT: 'SET_HINT',
  
  // アイテム
  ADD_INVENTORY_ITEM: 'ADD_INVENTORY_ITEM',
  REMOVE_INVENTORY_ITEM: 'REMOVE_INVENTORY_ITEM',
  USE_ITEM: 'USE_ITEM',
  
  // その他
  SET_MESSAGE: 'SET_MESSAGE',
  SET_DAMAGE_ANIMATION: 'SET_DAMAGE_ANIMATION',
  UPDATE_DAILY_MISSION: 'UPDATE_DAILY_MISSION',
  UPDATE_ACHIEVEMENTS: 'UPDATE_ACHIEVEMENTS'
};
```

### Step 2: Reducer 実装

**ファイル: `src/reducers/gameReducer.js`**

```javascript
import { ACTIONS, initialGameState } from '../contexts/gameStateTypes';

export const gameReducer = (state = initialGameState, action) => {
  switch (action.type) {
    case ACTIONS.SET_GAME_STATE:
      return {
        ...state,
        gameState: action.payload
      };
    
    case ACTIONS.TOGGLE_SHOP:
      return {
        ...state,
        showShop: !state.showShop
      };
    
    case ACTIONS.START_NEW_GAME:
      return {
        ...state,
        gameState: 'playing',
        currentStage: 1,
        currentTurn: 'player',
        playerHp: action.payload.playerHp || 200,
        monsterHp: action.payload.monsterHp || 0,
        board: action.payload.board || [],
        combo: 0,
        message: 'ゲーム開始！',
        achievements: {
          ...state.achievements,
          noHint: true
        }
      };
    
    case ACTIONS.DEAL_DAMAGE: {
      const newMonsterHp = Math.max(0, state.monsterHp - action.payload.damage);
      return {
        ...state,
        monsterHp: newMonsterHp,
        combo: state.combo + 1,
        message: `${action.payload.damage} のダメージ！`,
        damageAnimation: {
          damage: action.payload.damage,
          target: action.payload.target || 'enemy'
        }
      };
    }
    
    case ACTIONS.RESET_COMBO:
      return {
        ...state,
        combo: 0
      };
    
    case ACTIONS.ADD_MONEY:
      return {
        ...state,
        money: state.money + action.payload
      };
    
    case ACTIONS.ADD_INVENTORY_ITEM: {
      const existing = state.inventory.find(i => i.itemId === action.payload.itemId);
      if (existing) {
        return {
          ...state,
          inventory: state.inventory.map(i =>
            i.itemId === action.payload.itemId
              ? { ...i, quantity: i.quantity + (action.payload.quantity || 1) }
              : i
          )
        };
      }
      return {
        ...state,
        inventory: [...state.inventory, { itemId: action.payload.itemId, quantity: 1 }]
      };
    }
    
    case ACTIONS.ADVANCE_TURN:
      return {
        ...state,
        currentTurn: state.currentTurn === 'player' ? 'enemy' : 'player'
      };
    
    case ACTIONS.SET_MESSAGE:
      return {
        ...state,
        message: action.payload
      };
    
    case ACTIONS.UPDATE_ACHIEVEMENTS:
      return {
        ...state,
        achievements: {
          ...state.achievements,
          ...action.payload
        }
      };
    
    default:
      return state;
  }
};
```

### Step 3: Context 作成

**ファイル: `src/contexts/GameContext.js`**

```javascript
import React, { useReducer, useCallback } from 'react';
import { gameReducer } from '../reducers/gameReducer';
import { initialGameState, ACTIONS } from './gameStateTypes';

export const GameContext = React.createContext();
export const GameDispatchContext = React.createContext();

export const GameContextProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  
  // convenience hooks for common actions
  const gameActions = useCallback({
    dealDamage: (damage, target = 'enemy') => 
      dispatch({
        type: ACTIONS.DEAL_DAMAGE,
        payload: { damage, target }
      }),
    
    addMoney: (amount) =>
      dispatch({
        type: ACTIONS.ADD_MONEY,
        payload: amount
      }),
    
    resetCombo: () =>
      dispatch({ type: ACTIONS.RESET_COMBO }),
    
    startNewGame: (playerHp, monsterHp, board) =>
      dispatch({
        type: ACTIONS.START_NEW_GAME,
        payload: { playerHp, monsterHp, board }
      }),
    
    setMessage: (message) =>
      dispatch({
        type: ACTIONS.SET_MESSAGE,
        payload: message
      })
  }, []);
  
  return (
    <GameContext.Provider value={state}>
      <GameDispatchContext.Provider value={{ dispatch, ...gameActions }}>
        {children}
      </GameDispatchContext.Provider>
    </GameContext.Provider>
  );
};

// Custom hooks for usage
export const useGameState = () => {
  const context = React.useContext(GameContext);
  if (!context) {
    throw new Error('useGameState must be used within GameContextProvider');
  }
  return context;
};

export const useGameDispatch = () => {
  const context = React.useContext(GameDispatchContext);
  if (!context) {
    throw new Error('useGameDispatch must be used within GameContextProvider');
  }
  return context;
};
```

### Step 4: 既存コンポーネントの変更

**Before (古いコード)**
```jsx
const [playerHp, setPlayerHp] = useState(200);
const [monsterHp, setMonsterHp] = useState(0);
const [money, setMoney] = useState(100000);
const [combo, setCombo] = useState(0);
const [armor, setArmor] = useState(0);
const [message, setMessage] = useState('');

// ダメージ処理
const handleDamage = (damage) => {
  setPlayerHp(prev => Math.max(0, prev - damage));
  setMessage(`${damage} ダメージを受けた！`);
};

// 敵へのダメージ
const dealDamage = (damageAmount) => {
  setMonsterHp(prev => Math.max(0, prev - damageAmount));
  setCombo(prev => prev + 1);
};
```

**After (新しいコード)**
```jsx
import { useGameState, useGameDispatch } from '../contexts/GameContext';

const ShogiRPG = () => {
  const gameState = useGameState();
  const { dispatch, dealDamage, setMessage } = useGameDispatch();
  
  // シンプル！
  const handleDamage = (damage) => {
    dealDamage(damage, 'player');
  };
  
  return (
    <div>
      <div>HP: {gameState.playerHp}</div>
      <div>金銭: {gameState.money}</div>
      <div>コンボ: {gameState.combo}</div>
      <button onClick={() => handleDamage(50)}>攻撃</button>
    </div>
  );
};
```

---

## ? Phase 2: ファイル分割

### ファイル構成例

```
src/
├── contexts/
│   ├── GameContext.js              ← State / Dispatch provider
│   ├── gameStateTypes.js           ← State定義 + Action types
│   └── index.js                    ← re-export
│
├── reducers/
│   ├── gameReducer.js              ← main reducer
│   └── index.js
│
├── hooks/
│   ├── useGameState.js             ← custom hooks
│   ├── useBoard.js                 ← board logic
│   └── useAI.js                    ← AI logic
│
├── components/
│   ├── ShogiRPG.jsx                ← main component (cleaned)
│   ├── GameBoard/
│   │   ├── GameBoard.jsx
│   │   ├── ShogiPiece.jsx
│   │   └── styles.js
│   ├── MonsterDisplay.jsx
│   ├── Shop.jsx
│   ├── Inventory.jsx
│   ├── YokaiCollection.jsx
│   ├── DailyMissions.jsx
│   └── Tutorial.jsx
│
├── utils/
│   ├── constants.js                 ← MONSTERS, PIECES, SHOP_ITEMS
│   ├── gameLogic.js                 ← findMatches, applyGravity等
│   ├── audioSynthesis.js            ← sounds
│   └── storageManager.js            ← LocalStorage
│
├── styles/
│   ├── animations.css               ← SVG animations
│   ├── theme.js                     ← color constants
│   └── global.css
│
└── App.jsx                          ← Entry point
```

---

## ? Phase 3: CSS 統一

**元のコード（bad）:**
```jsx
const YokaiSVG = ({ type, size = 140 }) => {
  if (type === 'zashiki') {
    return (
      <svg width={size} height={size} viewBox="0 0 140 140">
        <defs>
          <style>{`
            @keyframes zashikiSway { ... }
            @keyframes float { ... }
          `}</style>
        </defs>
        ...
      </svg>
    );
  }
  if (type === 'kappa') {
    return (
      <svg width={size} height={size} viewBox="0 0 140 140">
        <defs>
          <style>{`
            @keyframes kappaFloat { ... }
            @keyframes float { ... }  // ? 重複
          `}</style>
        </defs>
        ...
      </svg>
    );
  }
};
```

**改善後（good）:**

**ファイル: `src/styles/animations.css`**
```css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes zashikiSway {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}

@keyframes kappaFloat {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-8px) rotate(1deg); }
}

.yokai-container {
  display: inline-block;
  position: relative;
}

.zashiki-body {
  animation: zashikiSway 3s ease-in-out infinite, float 4s ease-in-out infinite;
}

.kappa-body {
  animation: kappaFloat 3s ease-in-out infinite;
}
```

**コンポーネント:**
```jsx
import './animations.css';

const YokaiSVG = ({ type, size = 140 }) => {
  const svgPath = {
    zashiki: <ZashikiSVG />,
    kappa: <KappaSVG />,
    tengu: <TenguSVG />,
    oni: <OniSVG />,
    kyubi: <KyubiSVG />
  };
  
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" className="yokai-container">
      {svgPath[type]}
    </svg>
  );
};

// 各yokaiは個別コンポーネント
const ZashikiSVG = () => (
  <g className="zashiki-body">
    {/* SVG paths */}
  </g>
);
```

---

## ? マイグレーション チェックリスト

### Phase 1
- [ ] `gameStateTypes.js` 作成
- [ ] `gameReducer.js` 作成  
- [ ] `GameContext.js` 作成
- [ ] `ShogiRPG.jsx` を Context 使用に変更
- [ ] テスト: ゲーム開始できるか
- [ ] テスト: ダメージ計算の正確性

### Phase 2
- [ ] `GameBoard.jsx` 抽出
- [ ] `MonsterDisplay.jsx` 抽出
- [ ] `Shop.jsx` 抽出
- [ ] `Inventory.jsx` 抽出
- [ ] 各コンポーネントでテスト

### Phase 3
- [ ] `animations.css` 作成＆統一
- [ ] SVG から inline style 削除
- [ ] styled-components 導入 (optional)

---

## ? 推定工数

| 項目 | 時間 | 備考 |
|-----|-----|------|
| State/Reducer/Context | 2h | テスト込 |
| ファイル分割 | 4h | 各種チェック含 |
| CSS 統一 | 1h | minor |
| テスト・デバッグ | 3h | safety margin |
| **合計** | **10h** | 1.25人日 |

---

## ?? やってはいけない

? 一気にリファクタリングをしない
? テストなしで変更しない
? git commit を忘れずに（段階的にcommit）
? 既存機能を壊さない

## ? ベストプラクティス

? 小さな commit で段階的に進める
? テストしながら進める
? PR でレビューしてもらう
? ローカルで十分テストしてから git push
