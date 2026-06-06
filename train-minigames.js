/**
 * train-minigames.js
 * でんしゃずかんワールド ミニゲーム群
 * - スタンプラリー (#screen-stamp)
 * - たんていクイズ  (#screen-quiz)
 * - たびすごろく    (#screen-sugoroku)
 */

'use strict';

/* ──────────────────────────────────────────────────────
   スタンプラリー データ
────────────────────────────────────────────────────── */
const STAMP_STATIONS = [
  {id:'sapporo',   name:'さっぽろ',    pct:{x:72,y:12}, lineId:'hakodate',  trainId:'local-furano'},
  {id:'hakodate',  name:'はこだて',    pct:{x:68,y:20}, lineId:'hakodate',  trainId:'tram-hakodate'},
  {id:'aomori',    name:'あおもり',    pct:{x:65,y:25}, lineId:'tohoku',    trainId:'sl-banetsu'},
  {id:'sendai',    name:'せんだい',    pct:{x:67,y:33}, lineId:'tohoku',    trainId:'shinkansen-hayabusa'},
  {id:'niigata',   name:'にいがた',    pct:{x:58,y:35}, lineId:'joetsu',    trainId:'shinkansen-toki'},
  {id:'akita',     name:'あきた',      pct:{x:62,y:30}, lineId:'akita',     trainId:'shinkansen-komachi'},
  {id:'morioka',   name:'もりおか',    pct:{x:66,y:29}, lineId:'tohoku',    trainId:'resort-shirakami'},
  {id:'tokyo',     name:'とうきょう',  pct:{x:60,y:42}, lineId:'tokaido',   trainId:'shinkansen-nozomi'},
  {id:'yokohama',  name:'よこはま',    pct:{x:60,y:43}, lineId:'tokaido',   trainId:'commuter-e235'},
  {id:'nagoya',    name:'なごや',      pct:{x:52,y:46}, lineId:'tokaido',   trainId:'limited-shimakaze'},
  {id:'kyoto',     name:'きょうと',    pct:{x:47,y:46}, lineId:'tokaido',   trainId:'local-sagano'},
  {id:'osaka',     name:'おおさか',    pct:{x:46,y:47}, lineId:'tokaido',   trainId:'limited-romancecar'},
  {id:'kobe',      name:'こうべ',      pct:{x:45,y:47}, lineId:'sanyo',     trainId:'shinkansen-mizuho'},
  {id:'hiroshima', name:'ひろしま',    pct:{x:38,y:47}, lineId:'sanyo',     trainId:'shinkansen-500'},
  {id:'okayama',   name:'おかやま',    pct:{x:40,y:46}, lineId:'sanyo',     trainId:'tram-hiroshima'},
  {id:'takamatsu', name:'たかまつ',    pct:{x:41,y:49}, lineId:'shikoku',   trainId:'local-seto-ohashi'},
  {id:'kochi',     name:'こうち',      pct:{x:39,y:53}, lineId:'shikoku',   trainId:'resort-uvf'},
  {id:'matsuyama', name:'まつやま',    pct:{x:37,y:50}, lineId:'shikoku',   trainId:'limited-yakumo'},
  {id:'fukuoka',   name:'ふくおか',    pct:{x:30,y:50}, lineId:'kyushu',    trainId:'shinkansen-sakura'},
  {id:'nagasaki',  name:'ながさき',    pct:{x:27,y:53}, lineId:'nagasaki',  trainId:'limited-kamome'},
  {id:'kumamoto',  name:'くまもと',    pct:{x:31,y:54}, lineId:'kyushu',    trainId:'tram-kumamoto'},
  {id:'kagoshima', name:'かごしま',    pct:{x:32,y:58}, lineId:'kyushu',    trainId:'shinkansen-tsubame'},
  {id:'miyazaki',  name:'みやざき',    pct:{x:34,y:56}, lineId:'kyushu',    trainId:'local-itozakura'},
  {id:'oita',      name:'おおいた',    pct:{x:33,y:52}, lineId:'kyushu',    trainId:'limited-yufuin'},
  {id:'kanazawa',  name:'かなざわ',    pct:{x:50,y:39}, lineId:'hokuriku',  trainId:'shinkansen-kagayaki'},
  {id:'nagano',    name:'ながの',      pct:{x:55,y:40}, lineId:'hokuriku',  trainId:'limited-azusa'},
  {id:'matsumoto', name:'まつもと',    pct:{x:54,y:41}, lineId:'chubu',     trainId:'limited-azusa'},
  {id:'naha',      name:'なは',        pct:{x:22,y:75}, lineId:'okinawa',   trainId:'monorail-okinawa'},
  {id:'shizuoka',  name:'しずおか',    pct:{x:55,y:45}, lineId:'tokaido',   trainId:'shinkansen-hikari'},
  {id:'hachinohe', name:'はちのへ',    pct:{x:66,y:27}, lineId:'tohoku',    trainId:'sl-paleo'},
];

/* ──────────────────────────────────────────────────────
   すごろく データ
────────────────────────────────────────────────────── */
const SUGOROKU_SQUARES = [
  {sq:0,  region:'start',    name:'スタート（とうきょう）', type:'start',   trainId:null,                        coins:0},
  {sq:1,  region:'kanto',    name:'よこはま',              type:'normal',  trainId:'commuter-e235',              coins:10},
  {sq:2,  region:'kanto',    name:'なりた',                type:'bonus',   trainId:null,                        coins:30},
  {sq:3,  region:'tokai',    name:'しずおか',              type:'normal',  trainId:'shinkansen-hikari',          coins:10},
  {sq:4,  region:'tokai',    name:'なごや',                type:'normal',  trainId:'limited-shimakaze',          coins:15},
  {sq:5,  region:'tokai',    name:'ドクターイエロースポット',type:'event',  trainId:'shinkansen-doctor-yellow',   coins:50},
  {sq:6,  region:'kansai',   name:'きょうと',              type:'normal',  trainId:'local-sagano',               coins:15},
  {sq:7,  region:'kansai',   name:'おおさか',              type:'normal',  trainId:'limited-romancecar',         coins:15},
  {sq:8,  region:'kansai',   name:'こうべ',                type:'bonus',   trainId:null,                        coins:30},
  {sq:9,  region:'chugoku',  name:'おかやま',              type:'normal',  trainId:'limited-yakumo',             coins:10},
  {sq:10, region:'chugoku',  name:'ひろしま',              type:'normal',  trainId:'tram-hiroshima',             coins:15},
  {sq:11, region:'chugoku',  name:'しものせき',            type:'bonus',   trainId:null,                        coins:30},
  {sq:12, region:'kyushu',   name:'きたきゅうしゅう',      type:'normal',  trainId:'shinkansen-sakura',          coins:15},
  {sq:13, region:'kyushu',   name:'ふくおか',              type:'normal',  trainId:'local-orenji',               coins:15},
  {sq:14, region:'kyushu',   name:'くまもと',              type:'normal',  trainId:'tram-kumamoto',              coins:10},
  {sq:15, region:'kyushu',   name:'かごしま',              type:'event',   trainId:'shinkansen-tsubame',         coins:50},
  {sq:16, region:'shikoku',  name:'たかまつ',              type:'normal',  trainId:'local-seto-ohashi',          coins:10},
  {sq:17, region:'shikoku',  name:'こうち',                type:'bonus',   trainId:null,                        coins:30},
  {sq:18, region:'chubu',    name:'まつもと',              type:'normal',  trainId:'limited-azusa',              coins:10},
  {sq:19, region:'hokuriku', name:'かなざわ',              type:'normal',  trainId:'shinkansen-kagayaki',        coins:15},
  {sq:20, region:'tohoku',   name:'にいがた',              type:'normal',  trainId:'shinkansen-toki',            coins:10},
  {sq:21, region:'tohoku',   name:'せんだい',              type:'event',   trainId:'shinkansen-hayabusa',        coins:50},
  {sq:22, region:'tohoku',   name:'もりおか',              type:'normal',  trainId:'resort-shirakami',           coins:10},
  {sq:23, region:'tohoku',   name:'あきた',                type:'normal',  trainId:'shinkansen-komachi',         coins:15},
  {sq:24, region:'tohoku',   name:'あおもり',              type:'bonus',   trainId:null,                        coins:30},
  {sq:25, region:'hokkaido', name:'はこだて',              type:'normal',  trainId:'tram-hakodate',              coins:15},
  {sq:26, region:'hokkaido', name:'さっぽろ',              type:'event',   trainId:'local-furano',               coins:50},
  {sq:27, region:'hokkaido', name:'あさひかわ',            type:'bonus',   trainId:null,                        coins:30},
  {sq:28, region:'tohoku',   name:'かえりみち①',          type:'return',  trainId:null,                        coins:10},
  {sq:29, region:'kanto',    name:'かえりみち②',          type:'return',  trainId:null,                        coins:10},
  {sq:30, region:'kansai',   name:'かえりみち③',          type:'return',  trainId:null,                        coins:10},
  {sq:31, region:'kyushu',   name:'ドクターS',             type:'special', trainId:'futuristic-maglev',          coins:80},
  {sq:32, region:'chugoku',  name:'500けいスポット',       type:'special', trainId:'shinkansen-500',             coins:80},
  {sq:33, region:'sanyo',    name:'のぞみグランドクロス',  type:'special', trainId:'shinkansen-nozomi',          coins:100},
  {sq:34, region:'tokai',    name:'もうすこし！',          type:'normal',  trainId:null,                        coins:20},
  {sq:35, region:'okinawa',  name:'ゴール！（なは）',       type:'goal',    trainId:'monorail-okinawa',           coins:200},
];

/* ──────────────────────────────────────────────────────
   共通ユーティリティ
────────────────────────────────────────────────────── */
function tcCall(fn, ...args) {
  if (!window.TC || typeof window.TC[fn] !== 'function') return undefined;
  return window.TC[fn](...args);
}

const trainImageCache = {};

function loadTrainImage(train, onReady) {
  if (!train || !train.imagePath) return null;
  const cached = trainImageCache[train.imagePath];
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;

  const img = cached || new Image();
  if (!cached) {
    trainImageCache[train.imagePath] = img;
    img.src = train.imagePath;
  }
  img.onload = () => onReady && onReady(img);
  return null;
}

function _playSE(name) {
  tcCall('playSE', name);
}

function mkEl(tag, attrs, text) {
  const el = document.createElement(tag);
  if (attrs) Object.assign(el, attrs);
  if (text !== undefined) el.textContent = text;
  return el;
}

function homeBtn() {
  const btn = mkEl('button', {className:'mg-home-btn'}, 'ホームにもどる');
  btn.addEventListener('click', () => tcCall('openScreen', 'home'));
  return btn;
}

/* ──────────────────────────────────────────────────────
   スタンプラリー
────────────────────────────────────────────────────── */
function initStampRally() {
  const screen = document.getElementById('screen-stamp');
  if (!screen) return;

  // localStorage で取得済み駅セット管理
  function loadStamps() {
    try {
      const raw = localStorage.getItem('train-stamps-v1');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }
  function saveStamps(set) {
    localStorage.setItem('train-stamps-v1', JSON.stringify([...set]));
  }

  let stampedSet = loadStamps();

  // DOM構築
  screen.innerHTML = '';
  screen.style.cssText = 'position:relative;width:100%;min-height:100vh;background:#e8f4f8;overflow:hidden;font-family:"M PLUS Rounded 1c",sans-serif;';

  const header = mkEl('div', {className:'mg-header'});
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);position:sticky;top:0;z-index:10;';
  const title = mkEl('h2', {}, 'スタンプラリー');
  title.style.cssText = 'font-size:20px;color:#1a1a2e;margin:0;';
  const counter = mkEl('span', {id:'stamp-counter'});
  counter.style.cssText = 'font-size:14px;color:#555;';
  header.append(title, counter, homeBtn());
  screen.appendChild(header);

  // 地図コンテナ
  const mapWrap = mkEl('div', {className:'mg-map-wrap'});
  mapWrap.style.cssText = 'position:relative;width:100%;max-width:600px;margin:0 auto;user-select:none;';

  const mapImg = mkEl('img');
  mapImg.src = 'assets/trains/generated/ui/japan-map.png';
  mapImg.alt = '日本地図';
  mapImg.style.cssText = 'width:100%;display:block;';
  mapWrap.appendChild(mapImg);

  // 駅アイコン群（地図読み込み後に配置）
  const pinLayer = mkEl('div', {id:'stamp-pin-layer'});
  pinLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
  mapWrap.appendChild(pinLayer);
  screen.appendChild(mapWrap);

  function updateCounter() {
    counter.textContent = `${stampedSet.size} / ${STAMP_STATIONS.length} えき`;
  }
  updateCounter();

  function renderPins() {
    pinLayer.innerHTML = '';
    STAMP_STATIONS.forEach(st => {
      const stamped = stampedSet.has(st.id);
      const pin = mkEl('button');
      pin.title = st.name;
      pin.setAttribute('aria-label', st.name);
      pin.style.cssText = [
        'position:absolute',
        `left:${st.pct.x}%`,
        `top:${st.pct.y}%`,
        'transform:translate(-50%,-50%)',
        'width:36px;height:36px',
        'border:none;background:transparent',
        'cursor:pointer;pointer-events:auto',
        'padding:0;border-radius:50%',
        'display:flex;align-items:center;justify-content:center',
      ].join(';');

      // スタンプアイコン（SVG参照）
      const icon = mkEl('img');
      icon.src = stamped
        ? 'assets/trains/generated/ui/stamp-done.png'
        : 'assets/trains/generated/ui/stamp-empty.png';
      icon.alt = stamped ? 'スタンプ済み' : '未スタンプ';
      icon.style.cssText = `width:32px;height:32px;filter:${stamped ? 'none' : 'grayscale(1) opacity(.55)'};`;
      pin.appendChild(icon);

      pin.addEventListener('click', () => onStationClick(st));
      pinLayer.appendChild(pin);
    });
  }

  mapImg.addEventListener('load', renderPins);
  // すでにキャッシュ済みなら即描画
  if (mapImg.complete) renderPins();

  /* ---- ドアタイミングミニゲーム モーダル ---- */
  const modal = mkEl('div', {id:'stamp-modal'});
  modal.style.cssText = [
    'display:none;position:fixed;inset:0',
    'background:rgba(0,0,0,.55)',
    'z-index:100;align-items:center;justify-content:center',
  ].join(';');

  const card = mkEl('div');
  card.style.cssText = [
    'background:#fff;border-radius:20px',
    'padding:28px 24px;max-width:360px;width:90%',
    'text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2)',
  ].join(';');
  modal.appendChild(card);
  document.body.appendChild(modal);

  let currentStation = null;
  let timingRafId = null;
  let barProgress = 0; // 0..1
  let barDir = 1;
  let barStartTime = null;
  const BAR_DURATION = 2000; // ms for full sweep
  const GREEN_MIN = 0.40;
  const GREEN_MAX = 0.60;

  function openStampModal(st) {
    currentStation = st;
    card.innerHTML = '';
    modal.style.display = 'flex';

    const stName = mkEl('div', {}, `【${st.name}】`);
    stName.style.cssText = 'font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:8px;';
    card.appendChild(stName);

    const msg = mkEl('p', {}, 'ドアが あいたら のろう！');
    msg.style.cssText = 'font-size:16px;margin-bottom:16px;color:#333;';
    card.appendChild(msg);

    // プログレスバー外枠
    const barOuter = mkEl('div');
    barOuter.style.cssText = [
      'position:relative;height:40px;border-radius:20px',
      'background:#e0e0e0;overflow:hidden;margin-bottom:16px;cursor:pointer',
    ].join(';');

    // 緑ゾーン
    const greenZone = mkEl('div');
    greenZone.style.cssText = [
      `position:absolute;top:0;left:${GREEN_MIN * 100}%;`,
      `width:${(GREEN_MAX - GREEN_MIN) * 100}%;height:100%`,
      'background:rgba(76,175,80,.30);pointer-events:none',
    ].join(';');
    barOuter.appendChild(greenZone);

    // 動くバー（列車アイコン代わりのインジケータ）
    const indicator = mkEl('div');
    indicator.style.cssText = [
      'position:absolute;top:4px;width:32px;height:32px',
      'background:#FF8C00;border-radius:50%',
      'transform:translateX(-50%)',
      'transition:none;pointer-events:none',
    ].join(';');
    barOuter.appendChild(indicator);

    // タップ判定
    barOuter.addEventListener('click', onBarTap);
    barOuter.addEventListener('touchend', onBarTap, {passive:true});
    card.appendChild(barOuter);

    const feedback = mkEl('p', {id:'stamp-feedback'}, '');
    feedback.style.cssText = 'font-size:14px;color:#555;min-height:20px;margin-bottom:12px;';
    card.appendChild(feedback);

    const closeBtn = mkEl('button', {}, 'とじる');
    closeBtn.style.cssText = btStyle('#888');
    closeBtn.addEventListener('click', closeModal);
    card.appendChild(closeBtn);

    // アニメーション開始
    barProgress = 0;
    barDir = 1;
    barStartTime = null;
    if (timingRafId) cancelAnimationFrame(timingRafId);

    function animate(ts) {
      if (!barStartTime) barStartTime = ts;
      const elapsed = (ts - barStartTime) % (BAR_DURATION * 2);
      // 往復
      const raw = elapsed / BAR_DURATION;
      barProgress = raw <= 1 ? raw : 2 - raw;
      indicator.style.left = `${barProgress * 100}%`;
      timingRafId = requestAnimationFrame(animate);
    }
    timingRafId = requestAnimationFrame(animate);

    function onBarTap(e) {
      e.stopPropagation();
      cancelAnimationFrame(timingRafId);
      const hit = barProgress >= GREEN_MIN && barProgress <= GREEN_MAX;
      const fb = document.getElementById('stamp-feedback');

      if (hit) {
        _playSE('stamp');
        tcCall('addCoins', 30);
        stampedSet.add(st.id);
        saveStamps(stampedSet);
        tcCall('addOwnedTrain', st.trainId);
        updateCounter();
        renderPins();

        fb.textContent = 'スタンプゲット！ コイン+30';
        fb.style.color = '#4CAF50';
        barOuter.removeEventListener('click', onBarTap);
        barOuter.removeEventListener('touchend', onBarTap);
        barOuter.style.cursor = 'default';

        // 30駅コンプリートチェック
        if (stampedSet.size >= STAMP_STATIONS.length) {
          tcCall('addCoins', 500);
          const bonus = mkEl('div', {}, 'ぜんぶコンプリート！ ボーナスコイン+500');
          bonus.style.cssText = 'color:#FF8C00;font-weight:700;font-size:15px;margin-top:8px;';
          card.appendChild(bonus);
        }
      } else {
        _playSE('wrong');
        fb.textContent = 'おしい！ もう一度！';
        fb.style.color = '#e53935';
        // 再アニメ
        barStartTime = null;
        timingRafId = requestAnimationFrame(animate);
      }
    }
  }

  function closeModal() {
    if (timingRafId) cancelAnimationFrame(timingRafId);
    modal.style.display = 'none';
    currentStation = null;
  }

  function onStationClick(st) {
    if (stampedSet.has(st.id)) {
      showToast('もうスタンプがあるよ！');
      return;
    }
    openStampModal(st);
  }
}

/* ──────────────────────────────────────────────────────
   たんていクイズ
────────────────────────────────────────────────────── */
function initQuiz() {
  const screen = document.getElementById('screen-quiz');
  if (!screen) return;

  const MAX_DAILY = 5;
  const COIN_CORRECT = 20;
  const COIN_WRONG = 5;

  function loadQuizState() {
    try {
      const raw = localStorage.getItem('train-quiz-v1');
      if (!raw) return {date:'', count:0};
      return JSON.parse(raw);
    } catch { return {date:'', count:0}; }
  }
  function saveQuizState(s) {
    localStorage.setItem('train-quiz-v1', JSON.stringify(s));
  }
  function todayStr() {
    return new Date().toISOString().slice(0,10);
  }

  screen.innerHTML = '';
  screen.style.cssText = 'position:relative;width:100%;min-height:100vh;background:#faf3e0;font-family:"M PLUS Rounded 1c",sans-serif;box-sizing:border-box;';

  const header = mkEl('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);';
  const htitle = mkEl('h2',{},'たんていクイズ');
  htitle.style.cssText = 'font-size:20px;margin:0;color:#1a1a2e;';
  const diffSel = mkEl('select');
  diffSel.style.cssText = 'font-size:14px;padding:4px 8px;border-radius:8px;border:1px solid #ccc;';
  ['ふつう', 'かんたん（しんかんせんのみ）'].forEach((lbl, i) => {
    const opt = mkEl('option', {value: i===1 ? 'easy' : 'normal'}, lbl);
    diffSel.appendChild(opt);
  });
  header.append(htitle, diffSel, homeBtn());
  screen.appendChild(header);

  const body = mkEl('div', {id:'quiz-body'});
  body.style.cssText = 'padding:20px 16px;max-width:480px;margin:0 auto;';
  screen.appendChild(body);

  function buildQuestion() {
    const state = loadQuizState();
    const today = todayStr();

    body.innerHTML = '';

    // 日付リセット
    if (state.date !== today) {
      state.date = today;
      state.count = 0;
      saveQuizState(state);
    }

    if (state.count >= MAX_DAILY) {
      const msg = mkEl('div');
      msg.style.cssText = 'text-align:center;padding:40px 16px;';
      msg.innerHTML = '<p style="font-size:18px;color:#555;">きょうのもんだいはおわったよ！<br>またあしたきてね！</p>';
      body.appendChild(msg);
      return;
    }

    const TC = window.TC;
    if (!TC || !Array.isArray(TC.TRAINS) || TC.TRAINS.length < 4) {
      body.textContent = 'データをよみこんでいます…';
      return;
    }

    const difficulty = diffSel.value;
    let pool = difficulty === 'easy'
      ? TC.TRAINS.filter(t => t.id && t.id.startsWith('shinkansen'))
      : TC.TRAINS;
    if (pool.length < 4) pool = TC.TRAINS;

    // 正解車両
    const correct = pool[Math.floor(Math.random() * pool.length)];

    // ダミー3択（同レア度帯優先）
    const sameRarity = pool.filter(t => t.id !== correct.id && t.rarity === correct.rarity);
    const others = pool.filter(t => t.id !== correct.id);
    let dummyPool = sameRarity.length >= 3 ? sameRarity : others;
    const dummies = shuffleArr(dummyPool).slice(0, 3);

    // 4択シャッフル
    const choices = shuffleArr([correct, ...dummies]);

    // カウント更新
    state.count += 1;
    saveQuizState(state);

    // 問題カード
    const remainMsg = mkEl('p', {}, `のこり ${MAX_DAILY - state.count + 1} もん`);
    remainMsg.style.cssText = 'font-size:13px;color:#888;text-align:right;margin-bottom:8px;';
    body.appendChild(remainMsg);

    const qLabel = mkEl('p', {}, 'これは なんの でんしゃ？');
    qLabel.style.cssText = 'font-size:18px;font-weight:700;color:#1a1a2e;text-align:center;margin-bottom:12px;';
    body.appendChild(qLabel);

    // シルエット Canvas
    const canvasWrap = mkEl('div');
    canvasWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:20px;';
    const canvas = mkEl('canvas');
    canvas.width = 320;
    canvas.height = 120;
    canvas.style.cssText = 'border-radius:12px;background:#ddd;';
    canvasWrap.appendChild(canvas);
    body.appendChild(canvasWrap);

    drawSilhouette(canvas, correct, false);

    // 4択ボタン
    const choiceGrid = mkEl('div');
    choiceGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;';

    let answered = false;
    choices.forEach(ch => {
      const btn = mkEl('button', {}, ch.name || ch.id);
      btn.style.cssText = btStyle('#87CEEB') + 'min-height:64px;font-size:15px;white-space:normal;word-break:break-all;';
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const isCorrect = ch.id === correct.id;
        onAnswer(isCorrect, correct, canvas, btn, choiceGrid);
      });
      choiceGrid.appendChild(btn);
    });
    body.appendChild(choiceGrid);
  }

  function onAnswer(isCorrect, correct, canvas, clickedBtn, grid) {
    if (isCorrect) {
      _playSE('correct');
      tcCall('addCoins', COIN_CORRECT);
      clickedBtn.style.background = '#4CAF50';
      clickedBtn.style.color = '#fff';

      // シルエット → フルカラー フェードイン
      drawSilhouette(canvas, correct, false);
      let alpha = 0;
      const step = () => {
        alpha = Math.min(alpha + 0.05, 1);
        drawSilhouette(canvas, correct, false, alpha);
        if (alpha < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);

      showResult(true, correct);
    } else {
      _playSE('wrong');
      tcCall('addCoins', COIN_WRONG);
      clickedBtn.style.background = '#e53935';
      clickedBtn.style.color = '#fff';

      // 正解ボタンをハイライト
      Array.from(grid.children).forEach(b => {
        if ((b.textContent || '') === (correct.name || correct.id)) {
          b.style.background = '#4CAF50';
          b.style.color = '#fff';
        }
      });
      showResult(false, correct);
    }
  }

  function showResult(isCorrect, correct) {
    const existing = document.getElementById('quiz-result');
    if (existing) existing.remove();

    const res = mkEl('div', {id:'quiz-result'});
    res.style.cssText = 'text-align:center;padding:12px;';

    if (isCorrect) {
      res.innerHTML = `<p style="font-size:20px;color:#4CAF50;font-weight:700;">せいかい！ コイン+${COIN_CORRECT}</p>`;
    } else {
      res.innerHTML = `<p style="font-size:18px;color:#e53935;font-weight:700;">こたえはこれだよ！</p><p style="font-size:15px;color:#333;">${escHtml(correct.name || correct.id)}</p><p style="font-size:14px;color:#888;">コイン+${COIN_WRONG}</p>`;
    }

    const nextBtn = mkEl('button', {}, 'つぎのもんだいへ');
    nextBtn.style.cssText = btStyle('#FF8C00') + 'margin-top:12px;';
    nextBtn.addEventListener('click', buildQuestion);
    res.appendChild(nextBtn);

    body.appendChild(res);
  }

  /**
   * Canvas にシルエットまたはカラー描画
   * revealAlpha=0 → 黒シルエット、revealAlpha=1 → フルカラー（ダミーグラデ）
   */
  function drawSilhouette(canvas, train, _unused, revealAlpha) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const alpha = revealAlpha !== undefined ? revealAlpha : 0;
    const trainImg = loadTrainImage(train, () => drawSilhouette(canvas, train, _unused, revealAlpha));

    if (trainImg) {
      const maxW = W * 0.86;
      const maxH = H * 0.62;
      const ratio = Math.min(maxW / trainImg.naturalWidth, maxH / trainImg.naturalHeight);
      const iw = trainImg.naturalWidth * ratio;
      const ih = trainImg.naturalHeight * ratio;
      const ix = (W - iw) / 2;
      const iy = (H - ih) / 2 + 8;

      ctx.save();
      ctx.drawImage(trainImg, ix, iy, iw, ih);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      if (alpha > 0) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(trainImg, ix, iy, iw, ih);
        ctx.restore();
      }
      return;
    }

    // 車体（角丸矩形）
    const bodyColor = alpha > 0 ? interpolateColor('#333', getTrainColor(train), alpha) : '#333';
    ctx.fillStyle = bodyColor;
    roundRect(ctx, 20, 30, W - 40, H - 50, 16);
    ctx.fill();

    // 窓列
    const winCount = 6;
    const winW = 24;
    const winH = 16;
    const winY = 44;
    const spacing = (W - 40 - winW) / (winCount - 1);
    for (let i = 0; i < winCount; i++) {
      const wx = 28 + i * spacing;
      const wc = alpha > 0
        ? interpolateColor('#111', '#87CEEB', alpha)
        : '#111';
      ctx.fillStyle = wc;
      roundRect(ctx, wx, winY, winW, winH, 4);
      ctx.fill();
    }

    // 車輪
    ctx.fillStyle = alpha > 0 ? interpolateColor('#222', '#555', alpha) : '#222';
    [50, W - 70].forEach(cx => {
      ctx.beginPath();
      ctx.arc(cx, H - 18, 10, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function getTrainColor(train) {
    if (!train || !train.id) return '#1976D2';
    if (train.id.startsWith('shinkansen')) return '#1976D2';
    if (train.id.startsWith('tram')) return '#e53935';
    if (train.id.startsWith('limited')) return '#FF8C00';
    if (train.id.startsWith('sl')) return '#4a2c0a';
    return '#4CAF50';
  }

  function interpolateColor(from, to, t) {
    const f = hexToRgb(from);
    const tC = hexToRgb(to);
    const r = Math.round(f[0] + (tC[0]-f[0])*t);
    const g = Math.round(f[1] + (tC[1]-f[1])*t);
    const b = Math.round(f[2] + (tC[2]-f[2])*t);
    return `rgb(${r},${g},${b})`;
  }

  diffSel.addEventListener('change', buildQuestion);
  buildQuestion();
}

/* ──────────────────────────────────────────────────────
   たびすごろく
────────────────────────────────────────────────────── */
function initSugoroku() {
  const screen = document.getElementById('screen-sugoroku');
  if (!screen) return;

  const SQ_COUNT = SUGOROKU_SQUARES.length; // 36

  function loadSugorokuState() {
    try {
      const raw = localStorage.getItem('train-sugoroku-v1');
      if (!raw) return {pos:0, lap:1};
      return JSON.parse(raw);
    } catch { return {pos:0, lap:1}; }
  }
  function saveSugorokuState(s) {
    localStorage.setItem('train-sugoroku-v1', JSON.stringify(s));
  }

  let gameState = loadSugorokuState();
  let rolling = false;

  screen.innerHTML = '';
  screen.style.cssText = 'position:relative;width:100%;min-height:100vh;background:#e8f5e9;font-family:"M PLUS Rounded 1c",sans-serif;box-sizing:border-box;';

  // ヘッダー
  const header = mkEl('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);position:sticky;top:0;z-index:10;';
  const htitle = mkEl('h2',{},'たびすごろく');
  htitle.style.cssText = 'font-size:20px;margin:0;color:#1a1a2e;';
  const lapBadge = mkEl('span', {id:'sugoroku-lap'}, `${gameState.lap}しゅうめ`);
  lapBadge.style.cssText = 'font-size:13px;background:#4CAF50;color:#fff;padding:4px 10px;border-radius:12px;';
  header.append(htitle, lapBadge, homeBtn());
  screen.appendChild(header);

  // 地図 + マス
  const mapWrap = mkEl('div');
  mapWrap.style.cssText = 'position:relative;width:100%;max-width:600px;margin:0 auto;';

  const mapImg = mkEl('img');
  mapImg.src = 'assets/trains/generated/ui/japan-map.png';
  mapImg.alt = '日本地図';
  mapImg.style.cssText = 'width:100%;display:block;opacity:.85;';
  mapWrap.appendChild(mapImg);

  // マスオーバーレイ
  const sqLayer = mkEl('div', {id:'sugoroku-sq-layer'});
  sqLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
  mapWrap.appendChild(sqLayer);

  // 駒
  const piece = mkEl('div', {id:'sugoroku-piece'});
  piece.style.cssText = [
    'position:absolute;width:32px;height:32px',
    'background:#FF8C00;border-radius:50%;border:3px solid #fff',
    'box-shadow:0 2px 8px rgba(0,0,0,.3)',
    'transform:translate(-50%,-50%)',
    'transition:left .5s ease,top .5s ease',
    'z-index:5;pointer-events:none',
    'display:flex;align-items:center;justify-content:center;font-size:16px;',
  ].join(';');
  piece.textContent = '🚃';
  mapWrap.appendChild(piece);
  screen.appendChild(mapWrap);

  // マス座標定義（地図に対する%）
  // SUGOROKU_SQUARES の region/name からマッピング
  const SQ_POS = [
    {x:60,y:42}, // 0 スタート（とうきょう）
    {x:60,y:43}, // 1 よこはま
    {x:61,y:41}, // 2 なりた
    {x:55,y:45}, // 3 しずおか
    {x:52,y:46}, // 4 なごや
    {x:51,y:47}, // 5 ドクターイエロー
    {x:47,y:46}, // 6 きょうと
    {x:46,y:47}, // 7 おおさか
    {x:45,y:47}, // 8 こうべ
    {x:40,y:46}, // 9 おかやま
    {x:38,y:47}, // 10 ひろしま
    {x:35,y:48}, // 11 しものせき
    {x:31,y:49}, // 12 きたきゅうしゅう
    {x:30,y:50}, // 13 ふくおか
    {x:31,y:54}, // 14 くまもと
    {x:32,y:58}, // 15 かごしま
    {x:41,y:49}, // 16 たかまつ
    {x:39,y:53}, // 17 こうち
    {x:54,y:41}, // 18 まつもと
    {x:50,y:39}, // 19 かなざわ
    {x:58,y:35}, // 20 にいがた
    {x:67,y:33}, // 21 せんだい
    {x:66,y:29}, // 22 もりおか
    {x:62,y:30}, // 23 あきた
    {x:65,y:25}, // 24 あおもり
    {x:68,y:20}, // 25 はこだて
    {x:72,y:12}, // 26 さっぽろ
    {x:74,y:10}, // 27 あさひかわ
    {x:68,y:18}, // 28 かえりみち①
    {x:64,y:27}, // 29 かえりみち②
    {x:48,y:44}, // 30 かえりみち③
    {x:29,y:52}, // 31 ドクターS
    {x:37,y:46}, // 32 500けいスポット
    {x:44,y:46}, // 33 のぞみグランドクロス
    {x:56,y:44}, // 34 もうすこし！
    {x:22,y:75}, // 35 ゴール！（なは）
  ];

  function renderSquares() {
    sqLayer.innerHTML = '';
    SUGOROKU_SQUARES.forEach((sq, i) => {
      const pos = SQ_POS[i] || {x:50,y:50};
      const dot = mkEl('div');
      const isCurrentPos = i === gameState.pos;
      const typeColor = {
        start: '#87CEEB',
        normal: '#fff',
        bonus: '#FFD700',
        event: '#FF8C00',
        special: '#9d00ff',
        return: '#aaa',
        goal: '#4CAF50',
      }[sq.type] || '#fff';

      dot.style.cssText = [
        'position:absolute',
        `left:${pos.x}%`,
        `top:${pos.y}%`,
        'transform:translate(-50%,-50%)',
        'width:20px;height:20px;border-radius:50%',
        `background:${typeColor}`,
        `border:${isCurrentPos ? '3px solid #FF8C00' : '2px solid rgba(0,0,0,.2)'}`,
        'font-size:9px;display:flex;align-items:center;justify-content:center',
        'color:#333;font-weight:700',
      ].join(';');
      dot.textContent = i;
      dot.title = sq.name;
      sqLayer.appendChild(dot);
    });
  }

  function placePiece(idx) {
    const pos = SQ_POS[idx] || {x:50,y:50};
    piece.style.left = `${pos.x}%`;
    piece.style.top = `${pos.y}%`;
  }

  mapImg.addEventListener('load', () => {
    renderSquares();
    placePiece(gameState.pos);
  });
  if (mapImg.complete) { renderSquares(); placePiece(gameState.pos); }

  // コントロールパネル
  const ctrl = mkEl('div');
  ctrl.style.cssText = 'max-width:480px;margin:16px auto;padding:0 16px;';

  // 現在マス情報
  const curInfo = mkEl('div', {id:'sugoroku-cur-info'});
  curInfo.style.cssText = [
    'background:#fff;border-radius:16px;padding:14px 16px',
    'margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.10)',
  ].join(';');
  ctrl.appendChild(curInfo);

  // サイコロボタン
  const diceWrap = mkEl('div');
  diceWrap.style.cssText = 'display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:16px;';

  const diceImg = mkEl('img');
  diceImg.src = 'assets/trains/generated/ui/dice.png';
  diceImg.alt = 'さいころ';
  diceImg.style.cssText = 'width:72px;height:72px;cursor:pointer;transition:transform .15s;';
  diceImg.id = 'dice-img';

  const diceNum = mkEl('div', {id:'dice-num'}, '?');
  diceNum.style.cssText = 'font-size:48px;font-weight:700;color:#FF8C00;min-width:56px;text-align:center;';

  diceWrap.append(diceImg, diceNum);
  ctrl.appendChild(diceWrap);

  const rollBtn = mkEl('button', {id:'sugoroku-roll-btn'}, 'さいころをふる');
  rollBtn.style.cssText = btStyle('#FF8C00') + 'width:100%;font-size:18px;min-height:64px;';
  ctrl.appendChild(rollBtn);

  // イベントログ
  const logBox = mkEl('div', {id:'sugoroku-log'});
  logBox.style.cssText = [
    'background:#fff;border-radius:16px;padding:14px 16px',
    'margin-top:12px;max-height:160px;overflow-y:auto',
    'box-shadow:0 2px 8px rgba(0,0,0,.10);font-size:14px;color:#333;',
  ].join(';');
  ctrl.appendChild(logBox);

  screen.appendChild(ctrl);

  function updateCurInfo() {
    const sq = SUGOROKU_SQUARES[gameState.pos];
    if (!sq) return;
    curInfo.innerHTML = `<b style="font-size:15px;">いまいる：${escHtml(sq.name)}</b><br><span style="font-size:13px;color:#888;">マス${gameState.pos} / ${SQ_COUNT-1}</span>`;
  }
  updateCurInfo();

  function addLog(msg) {
    const p = mkEl('p', {}, msg);
    p.style.cssText = 'margin:4px 0;padding:4px 0;border-bottom:1px solid #eee;';
    logBox.insertBefore(p, logBox.firstChild);
  }

  rollBtn.addEventListener('click', () => {
    if (rolling) return;
    rolling = true;
    rollBtn.disabled = true;
    _playSE('dice');

    // サイコロアニメ（300ms ランダム切り替え）
    let elapsed = 0;
    const faces = ['1','2','3','4','5','6'];
    const anim = setInterval(() => {
      diceNum.textContent = faces[Math.floor(Math.random()*6)];
      elapsed += 80;
      if (elapsed >= 800) {
        clearInterval(anim);
        const result = Math.floor(Math.random()*6) + 1;
        diceNum.textContent = String(result);
        movePiece(result);
      }
    }, 80);
  });

  function movePiece(steps) {
    const startPos = gameState.pos;
    let moved = 0;

    // 1マスずつアニメーション移動
    function step() {
      if (moved >= steps) {
        // 着地処理
        onLand(gameState.pos);
        return;
      }
      moved++;
      gameState.pos = (gameState.pos + 1) % SQ_COUNT;

      // ゴールを超えた → ラップ
      if (gameState.pos === 0 && moved < steps) {
        gameState.lap++;
        document.getElementById('sugoroku-lap').textContent = `${gameState.lap}しゅうめ`;
      }

      placePiece(gameState.pos);
      renderSquares();
      updateCurInfo();
      saveSugorokuState(gameState);
      setTimeout(step, 350);
    }
    step();
  }

  function onLand(idx) {
    const sq = SUGOROKU_SQUARES[idx];
    rolling = false;
    rollBtn.disabled = false;

    if (!sq) return;

    const TC = window.TC;

    switch (sq.type) {
      case 'normal': {
        tcCall('addCoins', sq.coins);
        _playSE('coin');
        if (sq.trainId && TC) tcCall('addOwnedTrain', sq.trainId);
        addLog(`【${sq.name}】 コイン+${sq.coins}${sq.trainId ? ' でんしゃゲット！' : ''}`);
        break;
      }
      case 'bonus': {
        tcCall('addCoins', sq.coins);
        _playSE('coin');
        addLog(`【${sq.name}】 ボーナス！ コイン+${sq.coins}`);
        showSquareToast(`ボーナス！ コイン+${sq.coins}`, '#FFD700');
        break;
      }
      case 'event': {
        tcCall('addCoins', sq.coins);
        _playSE('coin');
        if (sq.trainId && TC) tcCall('addOwnedTrain', sq.trainId);
        addLog(`【${sq.name}】 イベント！ コイン+${sq.coins} でんしゃゲット！`);
        showSquareToast(`イベント！ コイン+${sq.coins}`, '#FF8C00');
        fireworks();
        break;
      }
      case 'special': {
        tcCall('addCoins', sq.coins);
        _playSE('coin');
        if (sq.trainId && TC) tcCall('addOwnedTrain', sq.trainId);
        addLog(`【${sq.name}】 スペシャル！ コイン+${sq.coins} レジェンドゲット！`);
        showSquareToast(`スペシャル！ コイン+${sq.coins}`, '#9d00ff');
        fireworks();
        break;
      }
      case 'return': {
        tcCall('addCoins', sq.coins);
        _playSE('coin');
        addLog(`【${sq.name}】 かえりみち コイン+${sq.coins}`);
        break;
      }
      case 'goal': {
        tcCall('addCoins', sq.coins);
        _playSE('coin');
        if (sq.trainId && TC) tcCall('addOwnedTrain', sq.trainId);
        addLog(`【ゴール！】 コイン+${sq.coins} おめでとう！`);
        showSquareToast(`ゴール！ コイン+${sq.coins}`, '#4CAF50');
        fireworks();
        // 2週目開始
        gameState.pos = 0;
        gameState.lap++;
        document.getElementById('sugoroku-lap').textContent = `${gameState.lap}しゅうめ`;
        saveSugorokuState(gameState);
        setTimeout(() => { placePiece(0); renderSquares(); updateCurInfo(); }, 600);
        break;
      }
      case 'start':
      default: {
        addLog(`【${sq.name}】 スタート地点だよ！`);
        break;
      }
    }
  }

  function showSquareToast(msg, color) {
    const t = mkEl('div', {}, msg);
    t.style.cssText = [
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)',
      `background:${color};color:#fff;font-size:22px;font-weight:700`,
      'padding:16px 32px;border-radius:20px;z-index:200',
      'pointer-events:none;opacity:1;transition:opacity .5s',
    ].join(';');
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 1500);
  }
}

/* ──────────────────────────────────────────────────────
   花火アニメーション（Canvas）
────────────────────────────────────────────────────── */
function fireworks() {
  const canvas = mkEl('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:150;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const particles = [];
  const COLORS = ['#FF8C00','#87CEEB','#4CAF50','#FFD700','#9d00ff','#e53935','#fff'];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width * (.2 + Math.random()*.6),
      y: canvas.height * (.1 + Math.random()*.5),
      vx: (Math.random()-0.5)*8,
      vy: (Math.random()-0.5)*8 - 2,
      alpha: 1,
      color: COLORS[Math.floor(Math.random()*COLORS.length)],
      size: 4 + Math.random()*6,
    });
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.alpha -= 0.018;
      if (p.alpha < 0) p.alpha = 0;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    frame++;
    if (frame < 90) requestAnimationFrame(draw);
    else canvas.remove();
  }
  requestAnimationFrame(draw);
}

/* ──────────────────────────────────────────────────────
   汎用トースト
────────────────────────────────────────────────────── */
function showToast(msg, duration) {
  duration = duration || 1600;
  const t = mkEl('div', {}, msg);
  t.style.cssText = [
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%)',
    'background:rgba(0,0,0,.75);color:#fff;font-size:15px',
    'padding:10px 20px;border-radius:20px;z-index:300',
    'pointer-events:none;opacity:1;transition:opacity .4s',
    'font-family:"M PLUS Rounded 1c",sans-serif;',
  ].join(';');
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, duration);
}

/* ──────────────────────────────────────────────────────
   共通スタイルヘルパー
────────────────────────────────────────────────────── */
function btStyle(bg) {
  return [
    `background:${bg}`,
    'color:#1a1a2e',
    'border:none',
    'border-radius:16px',
    'padding:12px 20px',
    'font-size:16px',
    'font-family:"M PLUS Rounded 1c",sans-serif',
    'font-weight:700',
    'cursor:pointer',
    'min-width:96px',
    'min-height:48px',
    'box-shadow:0 2px 8px rgba(0,0,0,.12)',
  ].join(';');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [
    parseInt(h.slice(0,2),16),
    parseInt(h.slice(2,4),16),
    parseInt(h.slice(4,6),16),
  ];
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* ──────────────────────────────────────────────────────
   エントリーポイント
────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.TC) {
    console.warn('[train-minigames] window.TC が見つかりません。ミニゲームの初期化をスキップします。');
    return;
  }
  initStampRally();
  initQuiz();
  initSugoroku();
});
