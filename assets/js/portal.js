/* ==========================================================
   hideの部屋 — トップのポータル機能 (portal.js) 2026-11 刷新
   ヘッダー / メニュー / サイト内検索 / 作品カタログ（検索・ジャンル・並べ替え）
   / 新着・おすすめ / 今日のおすすめ / ページトップへ / 英日切替。

   方針:
   - app.js（既存）は読むだけで書き換えない。カードは index.html の既存DOMが正本。
     新着・おすすめの棚はカードを「複製」して作る（作品情報を二重に持たない）。
   - 外部や利用者由来の文字列は textContent でだけ描く（innerHTML を使うのは
     辞書に自分で書いた data-pi18n-html だけ）。
   - 保存するのは並べ替えの選択だけ（キー `portal-cat-sort`）。既存キーには触れない。
   - 日付は data/catalog-meta.json（git 履歴から生成）だけを使う。人気順は元データが
     無いので作らない（捏造しない）。
   - window.__PORTAL_TEST のときだけ検査用の橋渡し window.PORTAL_DEBUG を開ける。
   ========================================================== */
(function () {
  'use strict';

  const META_URL = 'data/catalog-meta.json?v=20261114';
  const NEW_DAYS = 45;          // 公開からこの日数以内なら NEW 印
  const SORT_KEY = 'portal-cat-sort';

  // ── 辞書（data-pi18n*）。app.js の TRANS とは別に持つ（app.js を膨らませない） ──
  const DICT = {
    ja: {
      'nav-zero1': 'ZERO-1', search: '検索', menu: 'メニュー', close: '閉じる',
      'search-open': 'サイト内検索を開く（/ キー）', 'menu-open': 'メニューを開く',
      'search-title': 'サイト内検索',
      'search-ph': 'ゲーム名・ツール・ジャンルで探す（例: 将棋 / パズル / OCR）',
      'grp-make': '遊ぶ・使う', 'grp-read': '読む', 'grp-life': '暮らし・趣味',
      'd-works': '🕹️ ブラウザゲーム', 'd-tools': '🤖 AIツール', 'd-zero1': '🧠 ZERO-1 プロジェクト',
      'd-zero1m': '📱 ZERO-1 Mobile を起動', 'd-slides': '📑 AI解説スライド', 'd-learn': '📚 学習',
      'd-agents': '👥 AIチーム（開発体制）', 'd-blog': '✏️ ブログ', 'd-about': '👤 運営者について',
      'd-faq': '❓ よくある質問', 'd-local': '🏙️ 三郷市の地域情報', 'd-gourmet': '🍜 三郷グルメまとめ',
      'd-hobby': '🎯 趣味', 'd-pet': '🐾 ペット', 'd-sports': '⚾ スポーツ速報',
      'd-dashboard': '📊 ホームダッシュボード', 'd-contact': '📬 連絡先',
      'hero-eyebrow': '個人開発 × Claude Code ／ 埼玉県三郷市',
      'hero-title': 'インストール不要。<br><span class="portal-grad">遊べる・使える</span>実験室。',
      'hero-lead': '戦国シミュレーションから将棋・麻雀・アクションまで、ブラウザだけで遊べる無料ゲームと、AIで作った便利ツールを公開しています。すべて Claude Code と二人三脚の個人開発です。',
      'hero-cta-games': 'ゲームを探す', 'hero-cta-tools': 'AIツールを見る', 'hero-cta-zero1': 'ZERO-1 とは →',
      'stat-games': 'ゲーム', 'stat-tools': 'ツール', 'stat-install': 'インストール', 'stat-price': '料金', 'stat-free': '無料',
      'pick-label': '今日のおすすめ', 'pick-fallback': 'ゲーム一覧から選ぶ', 'pick-next': '別の作品を見る ↻', play: '遊ぶ →',
      'j-works': '🕹️ ゲーム', 'j-tools': '🤖 AIツール', 'j-zero1': '🧠 ZERO-1', 'j-blog': '✏️ ブログ',
      'j-about': '👤 運営者', 'j-local': '🏙️ 地域', 'j-sports': '⚾ スポーツ', 'j-dashboard': '📊 ダッシュボード',
      'shelf-new': '🆕 新着', 'shelf-new-note': 'リポジトリへの追加日順', 'shelf-pick': '⭐ おすすめ', 'shelf-pick-note': '運営者のおすすめ',
      'cat-search-label': 'タイトル・説明で検索', 'cat-search-ph': 'タイトル・説明で絞り込み', 'cat-sort': '並べ替え',
      'sort-default': 'おすすめ順', 'sort-new': '新着順', 'sort-name': '名前順',
      'g-all': 'すべて', 'g-board': 'ボードゲーム', 'g-puzzle': 'パズル', 'g-action': 'アクション',
      'g-sim': 'シミュレーション', 'g-card': 'カードゲーム', 'g-rpg': 'RPG', 'g-word': 'ことば・タイピング', 'g-ai': 'AI・実験',
      'cat-empty': '条件に合うゲームがありません。', 'cat-reset': '条件をクリア',
      count: (n, t) => `${t}作品中 ${n}作品を表示`,
      'new-badge': 'NEW', 'mobile-badge': '📱 スマホ対応', added: d => `公開 ${d}`,
      more: '詳しく ▾', less: '閉じる ▴', 'to-top': 'ページの先頭へ',
      'res-game': 'ゲーム', 'res-tool': 'ツール', 'res-section': 'セクション',
      'res-none': '見つかりませんでした。別のことばで試してください。', 'res-count': n => `${n}件`,
      'res-hint': '↑↓で選択・Enterで開く',
      'z-title': '🧠 ZERO-1 — 自分のためのAIアシスタント',
      'z-desc': 'ZERO-1 は、手元の端末で動くAI（ローカルLLM）を中心に、必要なときだけクラウドのAIを借りる「自分専用のAIアシスタント」をつくるプロジェクトです。ここでは<strong>今つかえるもの</strong>と<strong>これから作るもの</strong>を分けて紹介します。',
    },
    en: {
      'nav-zero1': 'ZERO-1', search: 'Search', menu: 'Menu', close: 'Close',
      'search-open': 'Open site search (/ key)', 'menu-open': 'Open menu',
      'search-title': 'Site search',
      'search-ph': 'Search games, tools, genres (e.g. shogi / puzzle / OCR)',
      'grp-make': 'Play & use', 'grp-read': 'Read', 'grp-life': 'Life & hobbies',
      'd-works': '🕹️ Browser games', 'd-tools': '🤖 AI tools', 'd-zero1': '🧠 ZERO-1 project',
      'd-zero1m': '📱 Launch ZERO-1 Mobile', 'd-slides': '📑 AI explainer slides', 'd-learn': '📚 Learning',
      'd-agents': '👥 AI team (how it is built)', 'd-blog': '✏️ Blog', 'd-about': '👤 About me',
      'd-faq': '❓ FAQ', 'd-local': '🏙️ Misato local info', 'd-gourmet': '🍜 Misato food guide',
      'd-hobby': '🎯 Hobbies', 'd-pet': '🐾 Pet', 'd-sports': '⚾ Sports scores',
      'd-dashboard': '📊 Home dashboard', 'd-contact': '📬 Contact',
      'hero-eyebrow': 'Indie dev × Claude Code / Misato, Saitama',
      'hero-title': 'Nothing to install.<br>A lab you can <span class="portal-grad">play & use</span>.',
      'hero-lead': 'Free browser games — from samurai strategy to shogi, mahjong and action — plus handy AI-made tools. Everything is built solo, pair-programming with Claude Code.',
      'hero-cta-games': 'Find a game', 'hero-cta-tools': 'See AI tools', 'hero-cta-zero1': 'What is ZERO-1 →',
      'stat-games': 'Games', 'stat-tools': 'Tools', 'stat-install': 'Installs', 'stat-price': 'Price', 'stat-free': 'Free',
      'pick-label': "Today's pick", 'pick-fallback': 'Browse all games', 'pick-next': 'Show another ↻', play: 'Play →',
      'j-works': '🕹️ Games', 'j-tools': '🤖 AI tools', 'j-zero1': '🧠 ZERO-1', 'j-blog': '✏️ Blog',
      'j-about': '👤 About', 'j-local': '🏙️ Local', 'j-sports': '⚾ Sports', 'j-dashboard': '📊 Dashboard',
      'shelf-new': '🆕 New', 'shelf-new-note': 'by date added to the repo', 'shelf-pick': '⭐ Picks', 'shelf-pick-note': "author's picks",
      'cat-search-label': 'Search by title or description', 'cat-search-ph': 'Filter by title or description', 'cat-sort': 'Sort',
      'sort-default': 'Recommended', 'sort-new': 'Newest', 'sort-name': 'Name',
      'g-all': 'All', 'g-board': 'Board', 'g-puzzle': 'Puzzle', 'g-action': 'Action',
      'g-sim': 'Strategy', 'g-card': 'Cards', 'g-rpg': 'RPG', 'g-word': 'Words & typing', 'g-ai': 'AI & labs',
      'cat-empty': 'No games match these filters.', 'cat-reset': 'Clear filters',
      count: (n, t) => `Showing ${n} of ${t} games`,
      'new-badge': 'NEW', 'mobile-badge': '📱 Mobile OK', added: d => `Added ${d}`,
      more: 'More ▾', less: 'Less ▴', 'to-top': 'Back to top',
      'res-game': 'Game', 'res-tool': 'Tool', 'res-section': 'Section',
      'res-none': 'Nothing found. Try another word.', 'res-count': n => `${n} results`,
      'res-hint': '↑↓ to select, Enter to open',
      'z-title': '🧠 ZERO-1 — an AI assistant of my own',
      'z-desc': 'ZERO-1 is a project to build a personal AI assistant that runs a local LLM on your own device and borrows a cloud AI only when needed. Below, <strong>what works today</strong> and <strong>what is planned</strong> are kept separate.',
      'z-live': 'Live — try it now', 'z-mobile-title': 'ZERO-1 Mobile',
      'z-mobile-desc': 'A phone AI that runs in the browser. The model runs on-device via WebGPU, so by default your conversation never leaves the phone.',
      'z-f1': 'On-device LLM (WebGPU; model downloaded once)', 'z-f2': 'Voice input and read-aloud',
      'z-f3': 'Built-in tools: clock, timer, memo, unit conversion, calculator, site search',
      'z-f4': 'Answers using this site’s knowledge (on-device search)', 'z-f5': '“Air Touch”: control the screen by pointing at the camera',
      'z-f6': 'Optional switch to a cloud AI with your own API key', 'z-open': 'Open ZERO-1 Mobile',
      'z-dev': 'In development / planned', 'z-desk-title': 'ZERO-1 Desktop (planned)',
      'z-desk-desc': 'An always-on assistant for the PC, prototyped in a separate repository. Everything here is a <strong>plan that is not yet released</strong>.',
      'z-p1h': 'Local + cloud', 'z-p1': 'Local LLM by default; hard questions go to the cloud under a spending cap',
      'z-p2h': 'Voice conversation', 'z-p2': 'Wake it by voice and talk',
      'z-p3h': 'AI dev agents', 'z-p3': 'The same plan → build → verify agent team used for this site, on your desk',
      'z-p4h': 'Knowledge search & long-term memory', 'z-p4': 'Remembers notes and decisions and recalls them when needed',
      'z-p5h': 'Smart home', 'z-p5': 'Controlling lights and appliances (future idea)',
      'z-road-title': 'Roadmap to 2030 (vision)', 'z-road-note': 'Plans change as development goes. Only finished items have a ✅.',
      'z-r1': '✅ ZERO-1 Mobile released (on-device LLM, voice, tools, Air Touch)',
      'z-r2': 'Desktop release (local + cloud, voice conversation)',
      'z-r3': 'Long-term memory, knowledge search, dev agents built in',
      'z-r4': 'Smart-home control — an assistant for everyday life',
    },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* シークレットタブ等では保存しない */ } },
  };
  let lang = (store.get('site-lang') === 'en') ? 'en' : 'ja';
  const t = (k, ...a) => {
    const v = (DICT[lang] && DICT[lang][k] !== undefined) ? DICT[lang][k] : DICT.ja[k];
    return typeof v === 'function' ? v(...a) : v;
  };
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 日本語の原文は HTML に書いてある。初回に控えておき、ja へ戻すときに使う
  // （辞書に ja が無いキーでも、英→日の切替で英語が残らないように）
  const ORIGINAL = new WeakMap();
  function applyDict() {
    $$('[data-pi18n]').forEach(el => {
      if (!ORIGINAL.has(el)) ORIGINAL.set(el, el.innerHTML);
      const k = el.dataset.pi18n;
      const v = DICT[lang][k];
      if (lang === 'ja') el.innerHTML = ORIGINAL.get(el);
      else if (typeof v === 'string') {
        // en 辞書の値は自前の固定文。<strong> など装飾を含むものだけ innerHTML
        if (/<[a-z]/i.test(v)) el.innerHTML = v; else el.textContent = v;
      }
    });
    $$('[data-pi18n-html]').forEach(el => {
      if (!ORIGINAL.has(el)) ORIGINAL.set(el, el.innerHTML);
      el.innerHTML = lang === 'ja' ? ORIGINAL.get(el) : DICT.en[el.dataset.pi18nHtml];
    });
    $$('[data-pi18n-ph]').forEach(el => { el.placeholder = t(el.dataset.pi18nPh); });
    $$('[data-pi18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.pi18nAria)); });
  }

  // ── ヘッダー（スクロールで縮む） ──
  function initHeader() {
    const header = $('#site-header');
    if (!header) return;
    let ticking = false;
    const update = () => { header.classList.toggle('is-scrolled', window.scrollY > 8); ticking = false; };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ── モーダル共通（メニュー・検索）: Esc / 背景クリック / フォーカスの閉じ込めと戻し ──
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
  let openLayer = null;
  function openModal(layer, opener, focusEl) {
    if (openLayer) closeModal(openLayer, false);
    layer.hidden = false;
    layer._opener = opener || document.activeElement;
    document.documentElement.classList.add('portal-locked');
    if (opener) opener.setAttribute('aria-expanded', 'true');
    openLayer = layer;
    requestAnimationFrame(() => {
      layer.classList.add('is-open');
      (focusEl || layer.querySelector(FOCUSABLE))?.focus();
    });
  }
  function closeModal(layer, restore = true) {
    if (!layer || layer.hidden) return;
    layer.classList.remove('is-open');
    layer.hidden = true;
    document.documentElement.classList.remove('portal-locked');
    const op = layer._opener;
    if (op && op.hasAttribute && op.hasAttribute('aria-expanded')) op.setAttribute('aria-expanded', 'false');
    if (openLayer === layer) openLayer = null;
    if (restore && op && typeof op.focus === 'function') op.focus();
  }
  function trapFocus(e) {
    if (!openLayer || e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, openLayer).filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function initDrawer() {
    const drawer = $('#portal-drawer'), btn = $('#portal-menu-btn');
    if (!drawer || !btn) return;
    btn.addEventListener('click', () => openModal(drawer, btn));
    drawer.addEventListener('click', e => {
      if (e.target.closest('[data-portal-close]')) closeModal(drawer);
      // ページ内リンクは移動先へフォーカスを渡したいので、戻し先には戻さない
      else if (e.target.closest('a[href]')) closeModal(drawer, false);
    });
  }

  // ── 検索の正規化（全角半角・大文字小文字・カタカナ/ひらがなを同一視） ──
  function norm(s) {
    return String(s || '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/\s+/g, ' ').trim();
  }

  // ── 作品カタログ ──
  const cat = { cards: [], grid: null, meta: {}, q: '', genre: 'all', sort: 'default' };

  function cardTitle(card) { return (card.querySelector('h3')?.textContent || '').trim(); }
  function cardHref(card) { return card.getAttribute('href') || ''; }

  function buildIndex(card, kind, href) {
    const aliases = [];
    const games = (window.AGENT_DATA && window.AGENT_DATA.GAMES) || [];
    const g = games.find(x => x.href === href);
    if (g) {
      aliases.push(g.title?.ja, g.title?.en, g.desc?.ja, g.desc?.en);
      (g.aliases?.ja || []).forEach(a => aliases.push(a));
      (g.aliases?.en || []).forEach(a => aliases.push(a));
    }
    return norm([card.textContent, ...aliases].join(' '));
  }

  function initCatalog() {
    cat.grid = $('#works .works-grid');
    if (!cat.grid) return;
    cat.cards = $$('.work-card', cat.grid).map((el, i) => ({
      el, i, href: cardHref(el), title: cardTitle(el), genre: el.dataset.category || 'other',
      text: '', mobile: false, added: '',
    }));
    cat.cards.forEach(c => {
      c.text = buildIndex(c.el, 'game', c.href);
      // 「スマホ対応」は作者自身の説明（カード文・案内データ）に書いてあるものだけ
      c.mobile = /スマホ|スマートフォン|モバイル|タッチ操作|mobile|smartphone|touch/.test(c.text);
    });

    const saved = store.get(SORT_KEY);
    if (saved === 'new' || saved === 'name') cat.sort = saved;
    const sortSel = $('#portal-cat-sort');
    if (sortSel) {
      sortSel.value = cat.sort;
      sortSel.addEventListener('change', () => { cat.sort = sortSel.value; store.set(SORT_KEY, cat.sort); applyCatalog(); });
    }
    const q = $('#portal-cat-q');
    if (q) {
      let timer;
      q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { cat.q = norm(q.value); applyCatalog(); }, 120); });
    }
    // 既存のジャンルボタン（app.js も聞いている）。こちらは後から走るので、検索と組み合わせて最終状態を決める
    $$('.works-filter-btn').forEach(b => b.addEventListener('click', () => {
      cat.genre = b.dataset.filter || 'all';
      $$('.works-filter-btn').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      applyCatalog();
    }));
    $('#portal-cat-reset')?.addEventListener('click', () => {
      cat.q = ''; if (q) q.value = '';
      $('.works-filter-btn[data-filter="all"]')?.click();
      q?.focus();
    });

    decorateCards();
    applyCatalog();
  }

  function decorateCards() {
    const today = Date.now();
    cat.cards.forEach(c => {
      const body = c.el.querySelector('.work-body');
      if (!body || body.querySelector('.portal-card-meta')) return;
      const meta = document.createElement('div');
      meta.className = 'portal-card-meta';
      body.insertBefore(meta, body.firstChild);
      // 説明文が長いカードだけ「詳しく」を付ける（3行で切る）
      const p = body.querySelector('p');
      if (p) {
        p.classList.add('portal-clamp');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'portal-more-btn';
        btn.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          const open = p.classList.toggle('is-open');
          btn.setAttribute('aria-expanded', String(open));
          btn.textContent = open ? t('less') : t('more');
        });
        p.after(btn);
        c.moreBtn = btn; c.desc = p;
      }
    });
    renderCardMeta(today);
    requestAnimationFrame(measureClamp);
  }

  function renderCardMeta(now = Date.now()) {
    cat.cards.forEach(c => {
      const meta = c.el.querySelector('.portal-card-meta');
      if (!meta) return;
      meta.textContent = '';
      if (c.added) {
        const days = (now - Date.parse(c.added)) / 864e5;
        if (days >= 0 && days <= NEW_DAYS) {
          const b = document.createElement('span'); b.className = 'portal-badge portal-badge-new'; b.textContent = t('new-badge'); meta.appendChild(b);
        }
        const d = document.createElement('span'); d.className = 'portal-badge portal-badge-date'; d.textContent = t('added', c.added); meta.appendChild(d);
      }
      if (c.mobile) {
        const m = document.createElement('span'); m.className = 'portal-badge'; m.textContent = t('mobile-badge'); meta.appendChild(m);
      }
      meta.hidden = !meta.childElementCount;
      if (c.moreBtn) c.moreBtn.textContent = c.desc.classList.contains('is-open') ? t('less') : t('more');
    });
  }

  function measureClamp() {
    cat.cards.forEach(c => {
      if (!c.moreBtn || c.desc.classList.contains('is-open')) return;
      c.moreBtn.hidden = !(c.desc.scrollHeight > c.desc.clientHeight + 2);
    });
  }

  function applyCatalog() {
    const shown = [];
    cat.cards.forEach(c => {
      const ok = (cat.genre === 'all' || c.genre === cat.genre) && (!cat.q || cat.q.split(' ').every(w => c.text.includes(w)));
      c.el.classList.toggle('hidden', !ok);
      // reveal 前に隠したカードは交差判定されず opacity:0 のまま残る（app.js の注記と同じ理由）
      if (ok) { c.el.classList.add('visible'); shown.push(c); }
    });
    const order = cat.cards.slice();
    if (cat.sort === 'new') order.sort((a, b) => (b.added || '').localeCompare(a.added || '') || a.i - b.i);
    else if (cat.sort === 'name') order.sort((a, b) => a.title.localeCompare(b.title, lang === 'en' ? 'en' : 'ja') || a.i - b.i);
    else order.sort((a, b) => a.i - b.i);
    const frag = document.createDocumentFragment();
    order.forEach(c => frag.appendChild(c.el));
    cat.grid.appendChild(frag);

    const count = $('#portal-cat-count');
    if (count) count.textContent = t('count', shown.length, cat.cards.length);
    const empty = $('#portal-cat-empty');
    if (empty) empty.hidden = shown.length > 0;
    requestAnimationFrame(measureClamp);
  }

  // ── 新着・おすすめの棚と、ヒーローの「今日のおすすめ」 ──
  function pickHrefs() {
    // 正本は「気分で選ぶおすすめゲーム」の表（運営者が手で選んだもの）
    const seen = new Set();
    return $$('.genre-table a[href]').map(a => a.getAttribute('href')).filter(h => !seen.has(h) && seen.add(h));
  }
  function miniCard(c) {
    const a = document.createElement('a');
    a.className = 'portal-mini';
    a.href = c.href;
    const thumb = c.el.querySelector('.work-thumb');
    if (thumb) {
      const clone = thumb.cloneNode(true);
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      clone.setAttribute('aria-hidden', 'true');
      clone.classList.add('portal-mini-thumb');
      a.appendChild(clone);
    }
    const body = document.createElement('span');
    body.className = 'portal-mini-body';
    const k = document.createElement('span');
    k.className = 'portal-mini-kicker';
    k.textContent = (c.el.querySelector('.work-kicker')?.textContent || '').split('/')[lang === 'en' ? 1 : 0]?.trim() || '';
    const h = document.createElement('strong');
    h.textContent = c.title;
    body.append(k, h);
    if (c.added) {
      const d = document.createElement('span'); d.className = 'portal-mini-date'; d.textContent = t('added', c.added); body.appendChild(d);
    }
    a.appendChild(body);
    return a;
  }
  function renderShelves() {
    const box = $('#portal-highlights');
    if (!box || !cat.cards.length) return;
    const byHref = new Map(cat.cards.map(c => [c.href, c]));
    const newest = cat.cards.filter(c => c.added).sort((a, b) => b.added.localeCompare(a.added) || a.i - b.i).slice(0, 4);
    const picks = pickHrefs().map(h => byHref.get(h)).filter(Boolean).slice(0, 4);
    const rowNew = $('#portal-shelf-new'), rowPick = $('#portal-shelf-pick');
    rowNew.textContent = ''; rowPick.textContent = '';
    newest.forEach(c => rowNew.appendChild(miniCard(c)));
    picks.forEach(c => rowPick.appendChild(miniCard(c)));
    rowNew.closest('.portal-shelf').hidden = !newest.length;
    rowPick.closest('.portal-shelf').hidden = !picks.length;
    box.hidden = !newest.length && !picks.length;
  }

  let pickIndex = -1;
  function renderPick(step = 0) {
    const card = $('#portal-pick-card');
    if (!card || !cat.cards.length) return;
    const byHref = new Map(cat.cards.map(c => [c.href, c]));
    const list = pickHrefs().map(h => byHref.get(h)).filter(Boolean);
    if (!list.length) return;
    if (pickIndex < 0) pickIndex = Math.floor(Date.now() / 864e5) % list.length; // 日替わり（全員同じ）
    pickIndex = (pickIndex + step + list.length) % list.length;
    const c = list[pickIndex];
    card.href = c.href;
    const thumbBox = card.querySelector('.portal-pick-thumb');
    thumbBox.textContent = '';
    const thumb = c.el.querySelector('.work-thumb');
    if (thumb) {
      const clone = thumb.cloneNode(true);
      clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      clone.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      thumbBox.appendChild(clone);
    }
    const kicker = (c.el.querySelector('.work-kicker')?.textContent || '').split('/');
    card.querySelector('.portal-pick-genre').textContent = (kicker[lang === 'en' ? 1 : 0] || kicker[0] || '').trim();
    const title = card.querySelector('.portal-pick-title');
    title.removeAttribute('data-pi18n');
    title.textContent = c.title;
    card.querySelector('.portal-pick-desc').textContent = (c.el.querySelector('.work-body p')?.textContent || '').trim();
  }

  // ── サイト内検索 ──
  const search = { items: [], results: [], active: -1 };
  function buildSearchIndex() {
    const items = [];
    cat.cards.forEach(c => items.push({ kind: 'game', title: c.title, sub: (c.el.querySelector('.work-kicker')?.textContent || '').trim(), href: c.href, text: c.text }));
    $$('.tools-grid .tool-card').forEach(el => {
      const link = el.querySelector('a.tool-link[href]');
      if (!link) return;
      const title = (el.querySelector('h3')?.textContent || '').trim();
      items.push({ kind: 'tool', title, sub: (el.querySelector('p')?.textContent || '').trim().slice(0, 60), href: link.getAttribute('href'), text: norm(el.textContent) });
    });
    $$('main section[id]').forEach(sec => {
      const h = sec.querySelector('h2');
      if (!h) return;
      const title = h.textContent.replace(/\s+/g, ' ').trim();
      items.push({ kind: 'section', title, sub: (sec.querySelector('.sec-desc')?.textContent || '').trim().slice(0, 60), href: '#' + sec.id, text: norm(title + ' ' + sec.id + ' ' + (sec.querySelector('.sec-desc')?.textContent || '')) });
    });
    search.items = items;
  }
  function runSearch(raw) {
    const q = norm(raw);
    const words = q ? q.split(' ') : [];
    let res;
    if (!words.length) {
      res = search.items.filter(x => x.kind === 'section');
    } else {
      res = search.items.map(x => {
        if (!words.every(w => x.text.includes(w))) return null;
        const tn = norm(x.title);
        const score = (tn.startsWith(words[0]) ? 3 : 0) + (tn.includes(words[0]) ? 2 : 0) + (x.kind === 'game' ? 0.5 : 0);
        return { x, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.x);
    }
    search.results = res.slice(0, 30);
    search.active = search.results.length ? 0 : -1;
    renderResults(words.length > 0);
  }
  function renderResults(hasQuery) {
    const ul = $('#portal-search-results'), status = $('#portal-search-status'), input = $('#portal-search-input');
    ul.textContent = '';
    search.results.forEach((r, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = 'portal-res-' + i;
      li.setAttribute('aria-selected', String(i === search.active));
      const a = document.createElement('a');
      a.href = r.href;
      a.tabIndex = -1;
      const kind = document.createElement('span');
      kind.className = 'portal-res-kind portal-res-' + r.kind;
      kind.textContent = t('res-' + r.kind);
      const title = document.createElement('strong');
      title.textContent = r.title;
      const sub = document.createElement('span');
      sub.className = 'portal-res-sub';
      sub.textContent = r.sub;
      a.append(kind, title, sub);
      li.appendChild(a);
      li.addEventListener('mousemove', () => { if (search.active !== i) { search.active = i; markActive(); } });
      ul.appendChild(li);
    });
    if (input) input.setAttribute('aria-activedescendant', search.active >= 0 ? 'portal-res-' + search.active : '');
    if (status) status.textContent = !search.results.length ? t('res-none') : (hasQuery ? t('res-count', search.results.length) + ' · ' + t('res-hint') : t('res-hint'));
  }
  function markActive() {
    $$('#portal-search-results [role="option"]').forEach((li, i) => {
      li.setAttribute('aria-selected', String(i === search.active));
      if (i === search.active) li.scrollIntoView({ block: 'nearest' });
    });
    $('#portal-search-input')?.setAttribute('aria-activedescendant', search.active >= 0 ? 'portal-res-' + search.active : '');
  }
  function initSearch() {
    const layer = $('#portal-search'), btn = $('#portal-search-btn'), input = $('#portal-search-input');
    if (!layer || !btn || !input) return;
    const open = () => { if (!search.items.length) buildSearchIndex(); input.value = ''; runSearch(''); openModal(layer, btn, input); };
    btn.addEventListener('click', open);
    input.addEventListener('input', () => runSearch(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!search.results.length) return;
        search.active = (search.active + (e.key === 'ArrowDown' ? 1 : -1) + search.results.length) % search.results.length;
        markActive();
      } else if (e.key === 'Enter') {
        const r = search.results[search.active];
        if (r) { e.preventDefault(); go(r.href); }
      }
    });
    layer.addEventListener('click', e => {
      if (e.target.closest('[data-portal-close]')) closeModal(layer);
      const a = e.target.closest('#portal-search-results a[href]');
      if (a) { e.preventDefault(); go(a.getAttribute('href')); }
    });
    function go(href) {
      closeModal(layer, false);
      if (href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
          history.replaceState(null, '', href);
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      } else {
        location.href = href;
      }
    }
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (!openLayer && !typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
        e.preventDefault(); open();
      }
    });
    search.open = open;
  }

  // ── ページトップへ ──
  function initToTop() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'portal-to-top';
    b.id = 'portal-to-top';
    b.setAttribute('aria-label', t('to-top'));
    b.dataset.pi18nAria = 'to-top';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg>';
    b.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      document.querySelector('.brand')?.focus({ preventScroll: true });
    });
    document.body.appendChild(b);
    let ticking = false;
    const update = () => { b.classList.toggle('is-visible', window.scrollY > 900); ticking = false; };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  function updateCounts() {
    const games = $$('#works .work-card').length;
    const tools = $$('.tools-grid .tool-card').length;
    $$('[data-portal-count="games"]').forEach(el => { el.textContent = games; });
    $$('[data-portal-count="tools"]').forEach(el => { el.textContent = tools; });
  }

  async function loadMeta() {
    try {
      const res = await fetch(META_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const items = (json && typeof json.items === 'object') ? json.items : {};
      cat.cards.forEach(c => {
        const a = items[c.href] && items[c.href].added;
        c.added = (typeof a === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a)) ? a : '';
      });
    } catch (e) {
      // 取れなければ日付なし（新着順は既定の並びのまま、NEW も出さない）。偽の日付は作らない
      const sel = $('#portal-cat-sort option[value="new"]');
      if (sel) sel.disabled = true;
    }
    renderCardMeta();
    renderShelves();
    applyCatalog();
  }

  function onLang(next) {
    lang = next === 'en' ? 'en' : 'ja';
    applyDict();
    renderCardMeta();
    renderShelves();
    renderPick(0);
    applyCatalog();
    search.items = [];
  }

  function init() {
    applyDict();
    initHeader();
    initDrawer();
    initCatalog();
    initSearch();
    initToTop();
    updateCounts();
    renderShelves();
    renderPick(0);
    $('#portal-pick-next')?.addEventListener('click', () => renderPick(1));
    // 「気分で選ぶ」表はスマホでは長い（6行×3列が縦に伸びる）ので、初期状態で畳む
    const guide = $('#portal-genre-guide');
    if (guide && window.matchMedia && window.matchMedia('(max-width: 640px)').matches) guide.open = false;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && openLayer) { e.preventDefault(); closeModal(openLayer); }
      trapFocus(e);
    });
    window.addEventListener('site-lang-change', e => onLang(e.detail && e.detail.lang));
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measureClamp, 150); });
    loadMeta();

    if (window.__PORTAL_TEST) {
      window.PORTAL_DEBUG = {
        state: () => ({ q: cat.q, genre: cat.genre, sort: cat.sort, shown: cat.cards.filter(c => !c.el.classList.contains('hidden')).length, total: cat.cards.length }),
        dates: () => cat.cards.map(c => ({ href: c.href, added: c.added })),
        openSearch: () => search.open && search.open(),
        lang: () => lang,
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
