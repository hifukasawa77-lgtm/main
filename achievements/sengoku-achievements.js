// 戦国風雲記（sengoku.html） 実績システム
// Achievement Agent 自動生成
//
// ★本ファイルは sengoku.html を一切改変せずに作成した「実績定義＋実行エンジン」。
//   組み込み（フック呼び出しの追加）は Code-Generator が別途行うこと。
//
// ============================================================================
// 組み込みガイド（Code-Generator 向け）
// ============================================================================
// sengoku.html は「毎ターン進行する内政・外交・合戦シミュレーション本体の state」
// を中心に動く。実績条件は次の2種類に分けて判定する。
//
//   1) checkAchievementsPoll(pollState) ...... 「値が閾値を超えたか」を
//      ターン確定処理の末尾（_finalizeTurn(game) の末尾、st.peakProvinces を
//      更新している行＝現在 sengoku.html 12534行目の直後）で毎ターン呼ぶ。
//      冪等なので何度呼んでも安全（獲得済みなら内部で無視される）。
//
//   2) checkAchievementsEvent(eventName, payload) ... 「ある操作が成功した
//      瞬間」を捉えるもの。該当箇所の成功パスに1回だけ差し込む。
//
// 呼び出し箇所の対応表（sengoku.html の関数名・行番号 → イベント名。行番号は
// 2026-09-23 時点、Code-Generator が実装時に前後の一致で確認すること）:
//
//   _finalizeTurn(game) 内、合戦解決の共通処理
//     if (playerWon) st.battlesWon=(st.battlesWon||0)+1;   （現在地16567行目付近）
//     の直後に:
//     → checkAchievementsEvent('battle_won', { battlesWon: st.battlesWon })
//     （playerWon が true の分岐でのみ呼ぶ）
//
//   _recruitCaptive(game, gid) 内
//     st.captivesRecruited=(st.captivesRecruited||0)+1;    （現在地12332行目）
//     の直後に:
//     → checkAchievementsEvent('captive_recruited', { captivesRecruited: st.captivesRecruited })
//
//   _armedForcePropose(game, forceId, kind) 内、各成功分岐の this._save() 直前に:
//     kind==='hire'   → checkAchievementsEvent('force_action', { kind:'hire',   forceType:'ninja' })
//     kind==='vassal' → checkAchievementsEvent('force_action', { kind:'vassal', forceType: naval?'naval':ninja?'ninja':'kokujin' })
//     kind==='annex'  → checkAchievementsEvent('force_action', { kind:'annex',  forceType:'kokujin' })
//
//   _religiousPropose(game, forceId, kind) 内、各成功分岐の this._save() 直前に:
//     kind==='offering' → checkAchievementsEvent('force_action', { kind:'offering', forceType:'religious' })
//       ※ この分岐は寺社への「布施」成功ごとに毎回呼んでよい（回数を数える実績のため）
//     kind==='vassal'   → checkAchievementsEvent('force_action', { kind:'vassal', forceType:'religious' })
//
//   _courtPropose(game,'offering') 内、if (meetsReq && srand(st)<chance){ ... } の
//     dmyo.kanoi_court=nextRank.name; の直後に:
//     → checkAchievementsEvent('court_rank_promoted', {
//          rankName: dmyo.kanoi_court,
//          rankIndex: COURT_KANOI_RANKS.findIndex(r=>r.name===dmyo.kanoi_court)
//        })
//
//   _shogunPropose(game,'request_role') 内、同様の分岐の
//     dmyo.kanoi_shogun=nextRole.name; の直後に:
//     → checkAchievementsEvent('shogun_role_promoted', {
//          roleName: dmyo.kanoi_shogun,
//          roleIndex: SHOGUN_ROLE_RANKS.findIndex(r=>r.name===dmyo.kanoi_shogun)
//        })
//
//   _castle(game) 内
//     prov.castleLevel++;                                   （現在地11949行目）
//     の直後に:
//     → checkAchievementsEvent('castle_upgraded', { castleLevel: prov.castleLevel })
//
//   _execPloy(game, kind) 内、'defect' と agitate（else節）それぞれの
//     if (roll<chance){ ...成功処理... } ブロックの中（this._save() の前）に:
//     → checkAchievementsEvent('ploy_resolved', { kind, success:true })
//     （kind は 'defect' または 'agitate'）
//
//   _ninjaAction(game, forceId, actionKind, targetPid) 内、5種の each
//     if (success){ ... } ブロックの中（this._save() の前）に:
//     → checkAchievementsEvent('ninja_action', { kind: actionKind, success:true })
//     （actionKind は 'spy'|'arson'|'sabotage'|'seduce'|'disrupt'）
//
//   _finalizeTurn(game) 内、下剋上イベント発火直後
//     this.overlay={type:'gekokujo',gid:playerGekokujo.gid,kind:playerGekokujo.kind,...}
//     （現在地12575行目）の直後に:
//     → checkAchievementsEvent('gekokujo_faced', { kind: playerGekokujo.kind })
//     ※ kind==='assassination'（本能寺型・当主が討たれる）のときは、
//        state.achieveStats.hadAssassinationGekokujo = true; も一緒に立てること
//        （game_over イベントの payload で参照するため）
//
//   _checkEnd(game) 内、3つの this.overlay={type:'gameover', ...} 代入の
//     それぞれの直前・直後どちらでもよいが、必ず3分岐とも呼ぶこと:
//       mine===0                                    （現在地12891行目・敗北）
//       mine===DATA.provinces.length                （現在地12892行目・天下統一）
//       controlled >= ceil(provinces*0.8) かつ tenka （現在地12897行目・天下静謐）
//     → checkAchievementsEvent('game_over', {
//          win: <trueなら勝利、falseなら敗北>,
//          seihitsu: <天下静謐分岐のみtrue、それ以外false/undefined>,
//          provincesOwned: mine,
//          totalProvinces: DATA.provinces.length,
//          difficulty: st.difficulty,
//          hadAssassinationGekokujo: !!(st.achieveStats && st.achieveStats.hadAssassinationGekokujo),
//        })
//
// pollState（毎ターン末に checkAchievementsPoll へ渡す想定のオブジェクト）:
//   {
//     provincesOwned: ownedProvinces(st, st.playerDaimyo).length,
//     totalProvinces: DATA.provinces.length,
//     peakProvinces: st.peakProvinces || 0,
//     battlesWon: st.battlesWon || 0,
//     captivesRecruited: st.captivesRecruited || 0,
//     kanoiCourtRank: dmyo.kanoi_court ? COURT_KANOI_RANKS.findIndex(r=>r.name===dmyo.kanoi_court) : -1,
//     kanoiShogunRank: dmyo.kanoi_shogun ? SHOGUN_ROLE_RANKS.findIndex(r=>r.name===dmyo.kanoi_shogun) : -1,
//     navalVassalCount: NAVAL_FORCES.filter(f => getAF(st, f.id).vassalOf === st.playerDaimyo).length,
//     navalTotal: NAVAL_FORCES.length,
//     offeringCount: (st.achieveStats && st.achieveStats.offeringCount) || 0,
//     ninjaKindsSucceeded: (st.achieveStats && st.achieveStats.ninjaKindsSucceeded) || [],
//   }
//
// ↑ 「offeringCount」「ninjaKindsSucceeded」「hadAssassinationGekokujo」は
//   sengoku.html の state に無いので、Code-Generator が
//   state.achieveStats = { offeringCount:0, ninjaKindsSucceeded:[], hadAssassinationGekokujo:false }
//   のような小さな集計オブジェクトを1つ追加し、各フックの中で加算・push するのが最短。
//   state 本体のロジックは一切変えず、末尾に集計フィールドを足すだけで済む設計にしてある。
//   （'force_action' イベントの kind==='offering' を受けた側で offeringCount++、
//    'ninja_action' イベントを受けた側で ninjaKindsSucceeded に kind を重複無く push する）

const ACHIEVEMENTS = [
  // ------------------------------------------------------------------ common
  {
    id: 'first_castle_captured',
    name: '初陣の勝ち鬨',
    description: '合戦に初めて勝利した。乱世に第一歩を刻んだ',
    rarity: 'common',
    icon: '🏯',
    // イベント: battle_won（battlesWon が 0→1 になった瞬間）
  },
  {
    id: 'first_captive_recruited',
    name: '捕虜、我が麾下に',
    description: '捕らえた敵将を初めて登用した',
    rarity: 'common',
    icon: '🤝',
    // イベント: captive_recruited（captivesRecruited が 0→1 になった瞬間）
  },
  {
    id: 'first_ninja_hired',
    name: '影の契約',
    description: '忍者衆を初めて雇用し、闇に働く手駒を得た',
    rarity: 'common',
    icon: '🥷',
    // イベント: force_action（kind:'hire'）の初回
  },
  {
    id: 'first_force_vassal',
    name: '旗下に加わる者',
    description: '水軍・忍者・国人・寺社のいずれかを初めて従属させた',
    rarity: 'common',
    icon: '⚓',
    // イベント: force_action（kind:'vassal' または 'annex'）の初回
  },
  {
    id: 'first_court_rank',
    name: '従五位下、拝命',
    description: '朝廷より初めて官位を賜った',
    rarity: 'common',
    icon: '📜',
    // イベント: court_rank_promoted の初回（rankIndex===0 でなくとも初叙任なら発火）
  },
  {
    id: 'first_castle_upgrade',
    name: '普請奉行',
    description: '城を初めて強化した',
    rarity: 'common',
    icon: '🏗️',
    // イベント: castle_upgraded の初回
  },
  {
    id: 'first_ploy_success',
    name: '調略、成る',
    description: '寝返り工作か流言扇動のいずれかを初めて成功させた',
    rarity: 'common',
    icon: '🗝️',
    // イベント: ploy_resolved（success:true）の初回
  },
  {
    id: 'survive_gekokujo',
    name: '乱世の生き残り',
    description: '下剋上・謀叛の急報を受けてなお、家名を保った',
    rarity: 'common',
    icon: '💢',
    // イベント: gekokujo_faced の初回（発火時点で mine===0 にはなっていない＝家は残っている）
  },

  // -------------------------------------------------------------------- rare
  {
    id: 'battles_won_20',
    name: '百戦錬磨',
    description: '勝ち戦を20戦数えた',
    rarity: 'rare',
    icon: '⚔️',
    // ポーリング: pollState.battlesWon >= 20
  },
  {
    id: 'captives_recruited_10',
    name: '降将、十指に余る',
    description: '捕虜武将を10名登用した',
    rarity: 'rare',
    icon: '🎖️',
    // ポーリング: pollState.captivesRecruited >= 10
  },
  {
    id: 'ninja_five_arts',
    name: '五術皆伝',
    description: '忍びの五術（情報収集・放火・破壊工作・引き抜き・撹乱）を全て成功させた',
    rarity: 'rare',
    icon: '🌀',
    // ポーリング: pollState.ninjaKindsSucceeded に spy/arson/sabotage/seduce/disrupt の
    //           5種が全て含まれる
  },
  {
    id: 'naval_fleet_complete',
    name: '瀬戸内、我が掌中に',
    description: '全ての水軍を従属させた',
    rarity: 'rare',
    icon: '⛵',
    // ポーリング: pollState.navalVassalCount >= pollState.navalTotal（NAVAL_FORCES.length、実数は変動しうるため常に動的比較）
  },
  {
    id: 'peak_provinces_20',
    name: '二十洲の太守',
    description: '最大版図が20洲に達した',
    rarity: 'rare',
    icon: '🗾',
    // ポーリング: pollState.peakProvinces >= 20
  },
  {
    id: 'offering_10',
    name: '寺社の後ろ盾',
    description: '寺社への布施を10回重ねた',
    rarity: 'rare',
    icon: '⛩️',
    // ポーリング: pollState.offeringCount >= 10
  },

  // -------------------------------------------------------------------- epic
  {
    id: 'shogun_kanrei',
    name: '管領の重み',
    description: '幕府より「管領」に任ぜられた',
    rarity: 'epic',
    icon: '👑',
    // イベント: shogun_role_promoted（payload.roleName === '管領'、SHOGUN_ROLE_RANKS[5].name）
  },
  {
    id: 'court_shoichii',
    name: '正一位、極まる',
    description: '朝廷官位の極位「正一位」に叙された',
    rarity: 'epic',
    icon: '🎋',
    // イベント: court_rank_promoted（payload.rankName === '正一位'、COURT_KANOI_RANKS[7].name）
  },
  {
    id: 'seihitsu_victory',
    name: '天下静謐',
    description: '征夷大将軍として天下の8割を静謐に導いた',
    rarity: 'epic',
    icon: '🕊️',
    // イベント: game_over（win:true, seihitsu:true）
  },
  {
    id: 'hard_mode_win',
    name: '難路、踏破す',
    description: '「難しい」難易度で乱世を制した',
    rarity: 'epic',
    icon: '🔥',
    // イベント: game_over（win:true, difficulty:'hard'）
  },

  // --------------------------------------------------------------- legendary
  {
    id: 'full_unification',
    name: '天下布武、成る',
    description: '全64洲を平らげ、乱世に終止符を打った',
    rarity: 'legendary',
    icon: '☯️',
    // イベント: game_over（win:true, seihitsu:falsy, provincesOwned===totalProvinces）
    //           ＝ _checkEnd の mine===DATA.provinces.length 分岐
  },
  {
    id: 'honnoji_survivor',
    name: '本能寺、されど滅びず',
    description: '当主が弑逆される謀叛の急変を乗り越え、なお天下を獲った',
    rarity: 'legendary',
    icon: '⚡',
    // イベント: game_over（win:true, hadAssassinationGekokujo:true）
    //           ＝ gekokujo_faced（kind:'assassination'）を一度でも経験した状態での勝利
  },
];

// ============================================================================
// 獲得済み管理（localStorageに保存）
// ============================================================================
const STORAGE_KEY = 'sengoku_achievements';

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
// 1) ポーリング判定 — 毎ターン確定処理の末尾で1回呼ぶ
// ---------------------------------------------------------------------------
function checkAchievementsPoll(pollState) {
  if (!pollState) return;
  const earned = getEarned();

  const tryUnlock = (id, cond) => {
    if (!earned.has(id) && cond) unlock(id);
  };

  tryUnlock('battles_won_20', (pollState.battlesWon || 0) >= 20);
  tryUnlock('captives_recruited_10', (pollState.captivesRecruited || 0) >= 10);
  tryUnlock('ninja_five_arts',
    ['spy', 'arson', 'sabotage', 'seduce', 'disrupt']
      .every((k) => (pollState.ninjaKindsSucceeded || []).includes(k)));
  tryUnlock('naval_fleet_complete',
    (pollState.navalTotal || 0) > 0
    && (pollState.navalVassalCount || 0) >= (pollState.navalTotal || Infinity));
  tryUnlock('peak_provinces_20', (pollState.peakProvinces || 0) >= 20);
  tryUnlock('offering_10', (pollState.offeringCount || 0) >= 10);
  tryUnlock('court_shoichii', (pollState.kanoiCourtRank || -1) >= 7);
  tryUnlock('shogun_kanrei', (pollState.kanoiShogunRank || -1) >= 5);
}

// ---------------------------------------------------------------------------
// 2) イベント判定 — 該当する操作が成功した直後に1回呼ぶ
// ---------------------------------------------------------------------------
function checkAchievementsEvent(eventName, payload) {
  payload = payload || {};
  switch (eventName) {
    case 'battle_won':
      if ((payload.battlesWon || 0) >= 1) unlock('first_castle_captured');
      break;
    case 'captive_recruited':
      if ((payload.captivesRecruited || 0) >= 1) unlock('first_captive_recruited');
      break;
    case 'force_action':
      if (payload.kind === 'hire') unlock('first_ninja_hired');
      if (payload.kind === 'vassal' || payload.kind === 'annex') unlock('first_force_vassal');
      break;
    case 'court_rank_promoted':
      unlock('first_court_rank');
      if (payload.rankName === '正一位') unlock('court_shoichii');
      break;
    case 'shogun_role_promoted':
      if (payload.roleName === '管領') unlock('shogun_kanrei');
      break;
    case 'castle_upgraded':
      unlock('first_castle_upgrade');
      break;
    case 'ploy_resolved':
      if (payload.success) unlock('first_ploy_success');
      break;
    case 'ninja_action':
      // 個別成功回数はポーリング側（ninjaKindsSucceeded）で5種コンプリートを判定するため、
      // ここでは単発の即時実績は設けていない（5種を跨ぐ実績のみ）。
      break;
    case 'gekokujo_faced':
      unlock('survive_gekokujo');
      break;
    case 'game_over':
      if (payload.win) {
        if (payload.seihitsu) unlock('seihitsu_victory');
        if (payload.difficulty === 'hard') unlock('hard_mode_win');
        if (!payload.seihitsu && payload.provincesOwned === payload.totalProvinces) {
          unlock('full_unification');
        }
        if (payload.hadAssassinationGekokujo) unlock('honnoji_survivor');
      }
      break;
    default:
      break;
  }
}

// ============================================================================
// トースト表示（戦国風雲記の色調＝墨・朱・金に合わせた和紙風パネル）
// ============================================================================
function showToast(achievement) {
  const existing = document.getElementById('achievement-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'achievement-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px',
    'background:rgba(16,14,12,0.95)',
    'border:1px solid #c9a34e',
    'border-radius:6px',
    'padding:14px 18px',
    'color:#e8dcc0',
    'font-family:"Hiragino Mincho ProN","Yu Mincho",serif',
    'font-size:14px',
    'z-index:9999',
    'max-width:300px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.6)',
    'animation:achievementIn 0.3s ease',
  ].join(';');

  const rarityColors = {
    common: '#8b98ab', rare: '#4fa3d1',
    epic: '#a25bc9', legendary: '#e8b23a',
  };
  const rarityJP = {
    common: '常', rare: '稀', epic: '奇', legendary: '伝',
  };
  const color = rarityColors[achievement.rarity] || '#8b98ab';

  // XSS対策: innerHTMLではなくDOM生成＋textContentのみで組み立てる（CLAUDE.md方針）
  const head = document.createElement('div');
  head.style.cssText = 'font-size:0.65em;color:' + color + ';letter-spacing:0.15em;margin-bottom:6px';
  head.textContent = '実績解除 ・ ' + (rarityJP[achievement.rarity] || '') + ' ' + achievement.rarity;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:10px';
  const iconEl = document.createElement('span');
  iconEl.style.cssText = 'font-size:1.8em';
  iconEl.textContent = achievement.icon;
  const textWrap = document.createElement('div');
  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'color:#e8b23a;font-weight:bold';
  nameEl.textContent = achievement.name;
  const descEl = document.createElement('div');
  descEl.style.cssText = 'color:#c2b490;font-size:0.85em;margin-top:2px';
  descEl.textContent = achievement.description;
  textWrap.appendChild(nameEl); textWrap.appendChild(descEl);
  row.appendChild(iconEl); row.appendChild(textWrap);
  toast.appendChild(head); toast.appendChild(row);

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

// ゲーム本体（sengoku.html）への組み込み例:
//
//   // _finalizeTurn(game) の末尾（st.peakProvinces 更新の直後）で:
//   checkAchievementsPoll({
//     provincesOwned: ownedProvinces(st, st.playerDaimyo).length,
//     totalProvinces: DATA.provinces.length,
//     peakProvinces: st.peakProvinces || 0,
//     battlesWon: st.battlesWon || 0,
//     captivesRecruited: st.captivesRecruited || 0,
//     kanoiCourtRank: dmyo.kanoi_court ? COURT_KANOI_RANKS.findIndex(r=>r.name===dmyo.kanoi_court) : -1,
//     kanoiShogunRank: dmyo.kanoi_shogun ? SHOGUN_ROLE_RANKS.findIndex(r=>r.name===dmyo.kanoi_shogun) : -1,
//     navalVassalCount: NAVAL_FORCES.filter(f => getAF(st, f.id).vassalOf === st.playerDaimyo).length,
//     navalTotal: NAVAL_FORCES.length,
//     offeringCount: (st.achieveStats && st.achieveStats.offeringCount) || 0,
//     ninjaKindsSucceeded: (st.achieveStats && st.achieveStats.ninjaKindsSucceeded) || [],
//   });
//
//   // _recruitCaptive(game, gid) 内、st.captivesRecruited++ の直後:
//   checkAchievementsEvent('captive_recruited', { captivesRecruited: st.captivesRecruited });
//
//   // _ninjaAction(game, forceId, actionKind, targetPid) の success 分岐内:
//   if (success) {
//     state.achieveStats = state.achieveStats || { offeringCount:0, ninjaKindsSucceeded:[], hadAssassinationGekokujo:false };
//     if (!state.achieveStats.ninjaKindsSucceeded.includes(actionKind)) {
//       state.achieveStats.ninjaKindsSucceeded.push(actionKind);
//     }
//     checkAchievementsEvent('ninja_action', { kind: actionKind, success: true });
//   }
