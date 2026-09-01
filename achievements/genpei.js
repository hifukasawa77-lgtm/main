// 源平争乱記（genpei.html） 実績システム
// Achievement Agent 自動生成
//
// ★本ファイルは genpei.html を一切改変せずに作成した「実績定義＋実行エンジン」。
//   組み込み（フック呼び出しの追加）は Code-Generator が別途行うこと。
//
// ============================================================================
// 組み込みガイド（Code-Generator 向け）
// ============================================================================
// genpei.html は「毎月ターンを進めるシミュレーション本体の state」と
// 「合戦（ヘックス）画面のローカルな戦闘状態 b」の二層で出来ている。
// 実績条件はこの二層それぞれから拾う必要があるため、判定を2種類に分けている。
//
//   1) checkAchievementsPoll(pollState) ...... 「値が閾値を超えたか」を
//      ターン処理の最後（nextTurn 相当の処理の末尾）で毎回呼ぶ。冪等なので
//      何度呼んでも安全（すでに獲得済みなら内部で無視される）。
//
//   2) checkAchievementsEvent(eventName, payload) ... 「ある操作が成功した
//      瞬間」を捉えるもの。該当する関数が ok:true を返した直後に1回だけ呼ぶ。
//
// 呼び出し箇所の対応表（genpei.html の関数名 → イベント名）:
//   tryBloodlessOpen()  が {ok:true, opened:true} を返した直後
//     → checkAchievementsEvent('bloodless_open', { fid, kyotenId, isPlayer })
//   declareChoteki()    で対象 t.choteki が false→true になった直後
//     → checkAchievementsEvent('choteki_declared', { targetFid, byFid })
//   Battle.resolveDuel() が {accepted:true, ...} を返した直後
//     → checkAchievementsEvent('duel_resolved', { winSide, death, winGenId, loseGenId, myFid, bandDuels })
//   Battle.tickSuigunDefect() 内で state.suigun[sid].faction が変わった直後
//     → checkAchievementsEvent('suigun_defected', { suigunId, fromFid, toFid })
//   purgeBand()  が {ok:true} を返した直後
//     → checkAchievementsEvent('band_purged', { fid })
//   tryRecruit() が {ok:true, joined:true} を返した直後
//     → checkAchievementsEvent('band_recruited', { fid, poached: !!from })
//   grantAndo() / grantShinon() が {ok:true} を返した直後
//     → checkAchievementsEvent('reward_granted', { fid })
//   donateJisha() / donateCourt() が {ok:true} を返した直後
//     → checkAchievementsEvent('donation_made', { fid })
//   pillage() が {ok:true} を返した直後
//     → checkAchievementsEvent('pillaged', { fid })
//   applyActions() で troops>0 の出兵を1回でも実行した直後（自勢力のみでよい）
//     → checkAchievementsEvent('army_marched', { fid })
//   checkVictory() が {done:true} を返した直後（勝敗に関わらず）
//     → checkAchievementsEvent('scenario_ended', { win, victory: FACTIONS[state.faction].victory,
//                                                   faction: state.faction, scenario: state.scenario })
//
// pollState（毎ターン末に checkAchievementsPoll へ渡す想定のオブジェクト）:
//   {
//     faction: state.faction,
//     scenario: state.scenario,
//     meibun: Rule.calcMeibun(state, state.faction),
//     seats: Rule.ownedKyoten(state, state.faction).filter(k => k.type === 'kokufu').length,
//     kyotoHoldMonths: state.kyotoHoldMonths,
//     jingiLost: state.jingiLost,
//     famineActive: Rule.famineActive(state),
//     foodNegativeDuringFamine: <実装側で famineActive 中に一度でも food<0 になったら true にするフラグ>,
//     bloodlessOpenCount: <実装側で 'bloodless_open' イベント成功回数を積算したカウンタ>,
//     armyMarchedCount: <実装側で 'army_marched' イベント回数を積算したカウンタ>,
//   }
//
// ↑ 「カウンタ」「フラグ」は genpei.html の state に無いので、Code-Generator が
//   state.achieveStats = { bloodlessOpenCount:0, armyMarchedCount:0, foodNegativeDuringFamine:false, ... }
//   のような小さな集計オブジェクトを1つ追加し、各フックの中で加算するのが最短。
//   state 本体のロジックは一切変えず、末尾に集計フィールドを足すだけで済む設計にしてある。

const ACHIEVEMENTS = [
  // ------------------------------------------------------------------ common
  {
    id: 'first_victory',
    name: '旗揚げ',
    description: 'いずれかのシナリオで勝利条件を満たし、乱世に名を残した',
    rarity: 'common',
    icon: '🚩',
    // イベント: scenario_ended, payload.win === true
  },
  {
    id: 'first_bloodless_open',
    name: '開かずの門を開く',
    description: '無血開城で初めて国府を得た。矢の一本も放たずに',
    rarity: 'common',
    icon: '🏯',
    // イベント: bloodless_open（isPlayer === true）の初回
  },
  {
    id: 'meibun_500',
    name: '名分五百',
    description: '名分が500に達した。院も無視できぬ大義となった',
    rarity: 'common',
    icon: '📜',
    // ポーリング: pollState.meibun >= 500
  },
  {
    id: 'first_duel_win',
    name: '初陣の名乗り',
    description: '一騎討ちで初めて勝ちを収めた',
    rarity: 'common',
    icon: '⚔️',
    // イベント: duel_resolved（accepted:true かつ win側が自分）の初回
  },
  {
    id: 'first_reward',
    name: '御恩を施す',
    description: '本領安堵か新恩給与を初めて行い、御恩と奉公の理を実践した',
    rarity: 'common',
    icon: '🎁',
    // イベント: reward_granted の初回
  },
  {
    id: 'first_donation',
    name: '京への手土産',
    description: '寺社か院への寄進を初めて行い、評判を金で買い戻した',
    rarity: 'common',
    icon: '⛩️',
    // イベント: donation_made の初回
  },
  {
    id: 'first_pillage',
    name: '乱妨取りの誘惑',
    description: '乱妨取りに手を染めた。兵糧は満ちたが、京の覚えは失われた',
    rarity: 'common',
    icon: '🔥',
    // イベント: pillaged の初回
  },
  {
    id: 'first_recruit',
    name: '麾下に加わる',
    description: '中立の武士団を初めて勧誘し、麾下に加えた',
    rarity: 'common',
    icon: '🤝',
    // イベント: band_recruited（poached: false）の初回
  },

  // -------------------------------------------------------------------- rare
  {
    id: 'poach_rival_band',
    name: '不義の引き抜き',
    description: '他勢力の武士団を引き抜いた。京ではこれを不義と言う',
    rarity: 'rare',
    icon: '🗡️',
    // イベント: band_recruited（poached: true）
  },
  {
    id: 'became_choteki',
    name: '朝敵の烙印',
    description: '自らが朝敵に認定された。院宣は時に牙を剥く',
    rarity: 'rare',
    icon: '⚡',
    // イベント: choteki_declared（targetFid === 自勢力）
  },
  {
    id: 'suigun_defected_to_me',
    name: '寝返る帆',
    description: '敵方の水軍が自分に寝返った。壇ノ浦を決めたのと同じ理屈で',
    rarity: 'rare',
    icon: '⛵',
    // イベント: suigun_defected（toFid === 自勢力）
  },
  {
    id: 'purged_a_band',
    name: '粛清の座',
    description: '麾下の武士団を誅した。味方の胸に疑いが残る道を選んだ',
    rarity: 'rare',
    icon: '🩸',
    // イベント: band_purged の初回
  },
  {
    id: 'survived_famine',
    name: '飢饉を凌ぐ',
    description: '養和の飢饉（1181年6月〜1182年12月）の間、一度も兵糧を欠かさなかった',
    rarity: 'rare',
    icon: '🌾',
    // ポーリング: famineActive の全期間を通じて foodNegativeDuringFamine が
    //           一度も true にならないまま飢饉期間を終えた
  },
  {
    id: 'triple_duel_one_battle',
    name: '三度の名乗り',
    description: '一度の合戦で名乗りの上限いっぱいまで一騎討ちを重ねた',
    rarity: 'rare',
    icon: '🎌',
    // イベント: duel_resolved の payload.bandDuels が RULE.duel.maxPerBattle(3) に到達
  },

  // -------------------------------------------------------------------- epic
  {
    id: 'lived_past_dannoura',
    name: '宝剣、失われて後',
    description: '三種の神器の宝剣が失われた世を生き、なお終幕まで版図を保った',
    rarity: 'epic',
    icon: '🌊',
    // イベント: scenario_ended（done時点で pollState.jingiLost === true）
  },
  {
    id: 'kyoto_hold_12',
    name: '十二月、京は動かず',
    description: '朝敵とならぬまま京を12ヶ月保った。木曽の悲願に手が届いた証',
    rarity: 'epic',
    icon: '🏙️',
    // ポーリング: pollState.kyotoHoldMonths >= 12（RULE.capital.holdMonths）
  },
  {
    id: 'victory_hiraizumi',
    name: '平泉、最後まで',
    description: '奥州藤原氏として、1189年9月まで平泉を保ち抜いた',
    rarity: 'epic',
    icon: '🏔️',
    // イベント: scenario_ended（faction:'oshu', victory:'hiraizumi', win:true）
  },
  {
    id: 'victory_taira_survive_regime',
    name: '知行国主、されど主にあらず',
    description: '平氏として、諸国を握れど家人が集まらぬという史実の弱点を越えて勝った',
    rarity: 'epic',
    icon: '👑',
    // イベント: scenario_ended（faction:'taira', victory:'survive_regime', win:true）
  },

  // --------------------------------------------------------------- legendary
  {
    id: 'atsumori_duel_echo',
    name: '小次郎、薄命',
    description: '一騎討ちの結末が、一ノ谷で史実に刻まれたその組み合わせをなぞった',
    rarity: 'legendary',
    icon: '🎐',
    // イベント: duel_resolved（death:true, winGenId:'kumagai_naozane', loseGenId:'taira_atsumori'）
    // ★GENERALS配列の生没年（taira_atsumori: 1169-1184）と実際に一致する隠し実績。
    //   熊谷直実と平敦盛が隣り合い、名乗りが受理され、直実が勝って討ち取ったときのみ発火する。
  },
  {
    id: 'bloodless_only_conquest',
    name: '名分あれば、矢は要らぬ',
    description: '一度も出兵せず、無血開城だけで国府を10ヶ国以上手に入れた',
    rarity: 'legendary',
    icon: '🕊️',
    // ポーリング: pollState.armyMarchedCount === 0 かつ pollState.seats >= 10
    //           かつ pollState.bloodlessOpenCount >= 10
  },
];

// ============================================================================
// 獲得済み管理（localStorageに保存）
// ============================================================================
const STORAGE_KEY = 'genpei_achievements';

function getEarned() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch (e) {
    return new Set();
  }
}

function saveEarned(earned) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned]));
  } catch (e) {
    /* 保存できない環境（プライベートモード等）では諦める。実績は今回限りで消える */
  }
}

function getAchievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

function unlock(id) {
  const a = getAchievementById(id);
  if (!a) return;
  const earned = getEarned();
  if (earned.has(id)) return;
  earned.add(id);
  saveEarned(earned);
  showToast(a);
}

// ---------------------------------------------------------------------------
// 1) ポーリング判定 — 毎ターン処理の末尾で1回呼ぶ
// ---------------------------------------------------------------------------
function checkAchievementsPoll(pollState) {
  if (!pollState) return;
  const earned = getEarned();

  const tryUnlock = (id, cond) => {
    if (!earned.has(id) && cond) unlock(id);
  };

  tryUnlock('meibun_500', (pollState.meibun || 0) >= 500);
  tryUnlock('kyoto_hold_12', (pollState.kyotoHoldMonths || 0) >= 12);
  tryUnlock('survived_famine',
    pollState.famineJustEnded === true && pollState.foodNegativeDuringFamine === false);
  tryUnlock('bloodless_only_conquest',
    (pollState.armyMarchedCount || 0) === 0
    && (pollState.bloodlessOpenCount || 0) >= 10
    && (pollState.seats || 0) >= 10);
}

// ---------------------------------------------------------------------------
// 2) イベント判定 — 該当する操作が成功した直後に1回呼ぶ
// ---------------------------------------------------------------------------
function checkAchievementsEvent(eventName, payload) {
  payload = payload || {};
  switch (eventName) {
    case 'bloodless_open':
      if (payload.isPlayer) unlock('first_bloodless_open');
      break;
    case 'choteki_declared':
      if (payload.targetFid === payload.myFid) unlock('became_choteki');
      break;
    case 'duel_resolved':
      if (payload.accepted && payload.winIsMine) unlock('first_duel_win');
      if (payload.bandDuels >= 3) unlock('triple_duel_one_battle');
      if (payload.death
          && payload.winGenId === 'kumagai_naozane'
          && payload.loseGenId === 'taira_atsumori') {
        unlock('atsumori_duel_echo');
      }
      break;
    case 'suigun_defected':
      if (payload.toFid === payload.myFid) unlock('suigun_defected_to_me');
      break;
    case 'band_purged':
      unlock('purged_a_band');
      break;
    case 'band_recruited':
      if (payload.poached) unlock('poach_rival_band');
      else unlock('first_recruit');
      break;
    case 'reward_granted':
      unlock('first_reward');
      break;
    case 'donation_made':
      unlock('first_donation');
      break;
    case 'pillaged':
      unlock('first_pillage');
      break;
    case 'scenario_ended':
      if (payload.win) {
        unlock('first_victory');
        if (payload.jingiLost) unlock('lived_past_dannoura');
        if (payload.faction === 'oshu' && payload.victory === 'hiraizumi') unlock('victory_hiraizumi');
        if (payload.faction === 'taira' && payload.victory === 'survive_regime') unlock('victory_taira_survive_regime');
      }
      break;
    default:
      break;
  }
}

// ============================================================================
// トースト表示（源平争乱記の色調＝金・朱・墨に合わせた和紙風パネル）
// ============================================================================
function showToast(achievement) {
  const existing = document.getElementById('achievement-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'achievement-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px',
    'background:rgba(20,14,10,0.95)',
    'border:1px solid #d8b26a',
    'border-radius:6px',
    'padding:14px 18px',
    'color:#ecd9a0',
    'font-family:"Hiragino Mincho ProN","Yu Mincho",serif',
    'font-size:14px',
    'z-index:9999',
    'max-width:300px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.6)',
    'animation:achievementIn 0.3s ease',
  ].join(';');

  const rarityColors = {
    common: '#8b98ab', rare: '#3aa7c9',
    epic: '#9b59b6', legendary: '#f9d423',
  };
  const rarityJP = {
    common: '常', rare: '稀', epic: '奇', legendary: '伝',
  };
  const color = rarityColors[achievement.rarity] || '#8b98ab';

  toast.innerHTML = `
    <div style="font-size:0.65em;color:${color};letter-spacing:0.15em;margin-bottom:6px">
      実績解除 ・ ${rarityJP[achievement.rarity] || ''} ${achievement.rarity}
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:1.8em">${achievement.icon}</span>
      <div>
        <div style="color:#f9d423;font-weight:bold">${achievement.name}</div>
        <div style="color:#c8b78c;font-size:0.85em;margin-top:2px">${achievement.description}</div>
      </div>
    </div>
  `;

  if (!document.getElementById('achievement-style')) {
    const style = document.createElement('style');
    style.id = 'achievement-style';
    style.textContent = '@keyframes achievementIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 3500);
  setTimeout(() => toast.remove(), 4000);
}

// ゲーム本体（genpei.html）への組み込み例:
//
//   // ターン処理の末尾（nextTurn 相当）で:
//   checkAchievementsPoll({
//     faction: state.faction,
//     meibun: Rule.calcMeibun(state, state.faction),
//     seats: Rule.ownedKyoten(state, state.faction).filter(k => k.type === 'kokufu').length,
//     kyotoHoldMonths: state.kyotoHoldMonths,
//     famineJustEnded: /* famineActive が true→false に変わった月だけ true */,
//     foodNegativeDuringFamine: state.achieveStats.foodNegativeDuringFamine,
//     armyMarchedCount: state.achieveStats.armyMarchedCount,
//     bloodlessOpenCount: state.achieveStats.bloodlessOpenCount,
//   });
//
//   // tryBloodlessOpen() 呼び出し側で opened:true を確認した直後:
//   if (r.opened) {
//     state.achieveStats.bloodlessOpenCount++;
//     checkAchievementsEvent('bloodless_open', { isPlayer: fid === state.faction });
//   }
//
//   // Battle.resolveDuel() 呼び出し側で:
//   const r = Battle.resolveDuel(b, a, d);
//   checkAchievementsEvent('duel_resolved', {
//     accepted: r.accepted, death: r.death,
//     winGenId: r.winGenId, loseGenId: r.loseGenId,
//     winIsMine: r.win === (b.spec.fid === state.faction ? 'atk' : 'def'),
//     bandDuels: b.duels,
//   });
