/* ==========================================================
   hideの案内エージェント — ロジック (agent.js)
   データは assets/js/agent-data.js（window.AGENT_DATA）を参照。
   読み込み順: app.js → agent-data.js → agent.js（defer 記述順）
   ========================================================== */
    (function () {
      'use strict';

      // データ定義は assets/js/agent-data.js（window.AGENT_DATA）に分離
      const { GAMES, RECOMMENDS, SECTIONS, SECTION_ALIASES, KB, INTENT_DICT, INTENT_CHIP_LABELS } = window.AGENT_DATA;

      // ── Constants ────────────────────────────────────────────
      const STATE_KEY = 'hide-agent-state-v1';
      const MAX_TURNS = 20;
      const TYPE_SPEED_MS = 10;





      // 事前正規化済みインテント辞書（detectIntent 等での重複normalize呼び出しを回避）
      const INTENT_DICT_NORM = {};
      for (const lang in INTENT_DICT) {
        INTENT_DICT_NORM[lang] = {};
        for (const intent in INTENT_DICT[lang]) {
          INTENT_DICT_NORM[lang][intent] = INTENT_DICT[lang][intent].map(([kw, w]) => [normalize(String(kw)), w]);
        }
      }

      // ── AI Agent 設定 ──────────────────────────────────────
      // Cloudflare Worker URL を設定（README: cloudflare-worker/README.md）
      const AGENT_PROXY_URL = 'https://ai-proxy.hi-fukasawa77.workers.dev';

      async function askGemini(userText, historyTurns) {
        if (!AGENT_PROXY_URL) throw new Error('no-key');
        const controller = new AbortController();
        // コールドスタート＋大型モデル対策で15秒
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch(AGENT_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userText,
              history: (historyTurns || []).slice(-6).map(m => ({
                role: m.role,
                text: m.text,
              })),
            }),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error('proxy-http-' + res.status);
          const data = await res.json();
          const text = data?.text;
          if (!text) throw new Error('proxy-empty');
          return { text: text.trim(), source: data.source || 'ai', key: data.key || null };
        } finally {
          clearTimeout(timeout);
        }
      }

      // 👍/👎 フィードバックを共有学習メモリへ送信（失敗しても無視）
      // key があれば学習エントリを直接特定して紐付け、なければ質問文での類似検索にフォールバック
      function sendAgentFeedback(question, vote, key) {
        if (!AGENT_PROXY_URL) return;
        fetch(AGENT_PROXY_URL + '/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: question, vote: vote, key: key || null }),
        }).catch(() => {});
      }

      // ── Utilities ────────────────────────────────────────────
      // 長音記号「ー」の展開先（え段→い、お段→う の慣用表記）。関数宣言なので巻き上げされ、
      // IIFE冒頭の INTENT_DICT_NORM 生成からも安全に呼べる。
      function longVowelOf(c) {
        if (!longVowelOf._m) {
          const m = {};
          [['あぁかがさざただなはばぱまゃやらわ', 'あ'],
           ['いぃきぎしじちぢにひびぴみり', 'い'],
           ['うぅゔくぐすずつづぬふぶぷむゅゆる', 'う'],
           ['えぇけげせぜてでねへべぺめれ', 'い'],
           ['おぉこごそぞとどのほぼぽもょよろを', 'う']].forEach(([chars, v]) => {
            for (const ch of chars) m[ch] = v;
          });
          longVowelOf._m = m;
        }
        return longVowelOf._m[c] || '';
      }

      // 正規化: 全角→半角・小文字化に加え、カタカナ→ひらがな折り畳みと
      // 長音展開（しょーぎ→しょうぎ）で表記ゆれを吸収する。辞書側も同じ関数で
      // 事前正規化するため、入力と辞書の表記が常に同じ土俵で比較される。
      function normalize(s) {
        let t = (s || '').toLowerCase()
          .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
          .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
          .replace(/\s+/g, ' ').trim();
        for (let i = 0; i < 3 && t.indexOf('ー') !== -1; i++) {
          t = t.replace(/([ぁ-ん])ー/g, (m, p) => p + (longVowelOf(p) || ''));
        }
        return t.replace(/ー/g, '');
      }

      // bigram Jaccard 類似度（worker の共有学習メモリと同一ロジック）
      function bigrams(s) {
        const set = new Set();
        for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
        return set;
      }
      function similarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const A = bigrams(a), B = bigrams(b);
        if (!A.size || !B.size) return 0;
        let inter = 0;
        for (const g of A) if (B.has(g)) inter++;
        return inter / (A.size + B.size - inter);
      }
      // 入力文 t の部分列に kw とほぼ一致する箇所があるか（タイポ耐性の第2パス用）。
      // 完全一致パスで拾えなかったときだけ呼ぶこと（総当たりのため）。
      function fuzzyScore(t, kw) {
        if (kw.length < 3 || t.length < 2) return 0;
        let best = 0;
        for (const len of [kw.length, kw.length + 1, kw.length - 1]) {
          if (len < 2 || len > t.length) continue;
          for (let i = 0; i + len <= t.length; i++) {
            const s = similarity(t.slice(i, i + len), kw);
            if (s > best) best = s;
          }
        }
        return best;
      }

      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }

      function uid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      }

      // ── State ────────────────────────────────────────────────
      const State = {
        lang: 'ja',
        history: [],
        lastIntent: null,
        paginationOffset: 0,
        // 直前の話題スロット（「それの遊び方は？」等の指示語解決に使う）
        slots: { game: null, stock: null, cat: null },
        load() {
          try {
            const raw = sessionStorage.getItem(STATE_KEY);
            if (!raw) return;
            const o = JSON.parse(raw);
            if (o && Array.isArray(o.history)) {
              this.history = o.history.slice(-MAX_TURNS);
              this.lastIntent = o.lastIntent || null;
              this.paginationOffset = o.paginationOffset || 0;
              if (o.slots && typeof o.slots === 'object') {
                this.slots = { game: o.slots.game || null, stock: o.slots.stock || null, cat: o.slots.cat || null };
              }
            }
          } catch (e) { /* ignore */ }
        },
        save() {
          try {
            sessionStorage.setItem(STATE_KEY, JSON.stringify({
              history: this.history.slice(-MAX_TURNS),
              lastIntent: this.lastIntent,
              paginationOffset: this.paginationOffset,
              slots: this.slots
            }));
          } catch (e) { /* ignore */ }
        },
        push(msg) {
          this.history.push(msg);
          if (this.history.length > MAX_TURNS) this.history.shift();
          this.save();
        },
        reset() {
          this.history = [];
          this.lastIntent = null;
          this.paginationOffset = 0;
          this.slots = { game: null, stock: null, cat: null };
          try { sessionStorage.removeItem(STATE_KEY); } catch (e) { /* ignore */ }
        }
      };

      // ── Intent recognition ──────────────────────────────────
      function pickBest(scores) {
        let best = null, bestScore = 0, second = 0;
        for (const k in scores) {
          if (scores[k] > bestScore) { second = bestScore; bestScore = scores[k]; best = k; }
          else if (scores[k] > second) { second = scores[k]; }
        }
        return { name: best, score: bestScore, runnerUp: second };
      }

      function detectIntent(text, lang) {
        const t = normalize(text);
        if (!t) return { name: null, score: 0 };
        const dict = INTENT_DICT_NORM[lang] || INTENT_DICT_NORM.ja;
        const scores = {};
        for (const intent in dict) {
          let s = 0;
          for (const [kw, w] of dict[intent]) {
            if (!kw) continue;
            if (t.indexOf(kw) !== -1) s += w;
          }
          if (s > 0) scores[intent] = s;
        }
        // bonus: continuation of last intent (e.g. "more")
        if (State.lastIntent && scores[State.lastIntent]) scores[State.lastIntent] += 0.4;
        let result = pickBest(scores);
        // ファジー第2パス（タイポ耐性）: 完全一致で確信が持てないときのみ。
        // 3文字以上のキーワードに限定し、類似度0.8以上を弱め（×0.6）に加点する。
        if (result.score < 1.0) {
          for (const intent in dict) {
            let s = scores[intent] || 0;
            for (const [kw, w] of dict[intent]) {
              if (kw && kw.length >= 3 && t.indexOf(kw) === -1 && fuzzyScore(t, kw) >= 0.8) s += w * 0.6;
            }
            if (s > 0) scores[intent] = s;
          }
          result = pickBest(scores);
        }
        return result;
      }

      // ゲームエイリアスは起動時に正規化しておく（カナ折り畳み・長音展開を辞書側にも適用）
      const GAME_ALIAS_NORM = GAMES.map(g => ({
        g,
        aliases: [...(g.aliases.ja || []), ...(g.aliases.en || []), g.title.ja, g.title.en]
          .filter(Boolean).map(a => normalize(a)).filter(a => a.length >= 2)
      }));

      function detectGame(text) {
        const t = normalize(text);
        if (!t) return [];
        const hits = [];
        for (const e of GAME_ALIAS_NORM) {
          if (e.aliases.some(a => t.indexOf(a) !== -1)) hits.push(e.g);
        }
        if (hits.length) return hits;
        // ファジー第2パス（タイポ耐性）: 最も近い1件のみ、閾値0.78
        let best = null, bestSim = 0;
        for (const e of GAME_ALIAS_NORM) {
          for (const a of e.aliases) {
            if (a.length < 3) continue;
            const s = fuzzyScore(t, a);
            if (s > bestSim) { bestSim = s; best = e.g; }
          }
        }
        return best && bestSim >= 0.78 ? [best] : [];
      }

      function detectSection(text, lang) {
        const t = normalize(text);
        if (!t) return null;
        const map = SECTION_ALIASES[lang] || SECTION_ALIASES.ja;
        let best = null, bestLen = 0;
        for (const sec in map) {
          for (const a of map[sec]) {
            const al = normalize(a);
            if (t.indexOf(al) !== -1 && al.length > bestLen) { best = sec; bestLen = al.length; }
          }
        }
        return best;
      }

      // ── Stock company detection ─────────────────────────────
      function detectStock(text) {
        const nt = normalize(text);
        if (!nt) return null;
        for (const alias of STOCK_ALIASES) {
          for (const key of alias.keys) {
            const nk = normalize(key);
            if (nk.length <= 4 && /^[a-z0-9&\s-]+$/.test(nk)) {
              // 短い英字キー（au/tel/nec等）は単語境界で判定（"claude"内の"au"等への誤爆防止）
              const esc = nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              if (new RegExp('(^|[^a-z0-9])' + esc + '($|[^a-z0-9])').test(nt)) return alias;
            } else if (nt.includes(nk)) {
              return alias;
            }
          }
        }
        return null;
      }

      // ── Fallback suggestion (④) ──────────────────────────────

      function suggestFromText(text, lang) {
        const nt = normalize(text);
        const suggestions = [];

        // 1. Partial game title match
        for (const g of GAMES) {
          const titles = [g.title && g.title.ja, g.title && g.title.en].filter(Boolean).map(normalize);
          if (titles.some(ti => ti.length >= 2 && (nt.includes(ti.slice(0, 2)) || ti.includes(nt.slice(0, 2))))) {
            const label = (lang === 'en' ? g.title.en : g.title.ja) || g.title.ja || '';
            if (label) suggestions.push({ label, query: label });
            if (suggestions.length >= 2) break;
          }
        }

        // 2. Partial stock name match
        if (suggestions.length < 3) {
          const hit = detectStock(text);
          if (hit) {
            const q = lang === 'en' ? hit.name + ' stock' : hit.name + 'の株価';
            suggestions.push({ label: '📈 ' + (lang === 'en' ? hit.name + ' stock?' : hit.name + 'の株価？'), query: q });
          }
        }

        // 3. Weak intent matches
        if (suggestions.length < 3) {
          const dict = INTENT_DICT[lang] || INTENT_DICT.ja;
          const labels = INTENT_CHIP_LABELS[lang] || INTENT_CHIP_LABELS.ja;
          const scores = {};
          for (const intent in dict) {
            let s = 0;
            for (const [kw, w] of dict[intent]) {
              if (nt.includes(normalize(kw))) s += w;
            }
            if (s > 0) scores[intent] = s;
          }
          const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          for (const [intentName] of sorted) {
            if (labels[intentName] && suggestions.length < 3) {
              suggestions.push({ label: labels[intentName], query: labels[intentName].replace(/^[^\s]+\s/, '') });
            }
          }
        }

        return suggestions.slice(0, 3);
      }

      // ── i18n helper ─────────────────────────────────────────
      function t(key) {
        try {
          const dict = (window.__TRANS__ && window.__TRANS__[State.lang]) || null;
          if (dict && dict[key]) return dict[key];
        } catch (e) { /* ignore */ }
        // Fallback strings if TRANS isn't exposed
        const FB = {
          ja: { 'agent-welcome':'こんにちは！hideのポートフォリオへようこそ 👋 ゲーム紹介・サイト案内・為替や天気の取得ができます。下のチップからどうぞ。',
                'agent-fallback':'ごめんなさい、その質問にはまだ対応していません。下のチップから選ぶか、別の言い方で試してみてください。',
                'agent-thinking':'考えています…','agent-tool-loading':'取得中…','agent-tool-error':'取得できませんでした。',
                'agent-action-play':'遊ぶ →','agent-action-open-section':'移動する →','agent-action-copy':'コピー','agent-action-retry':'再試行',
                'agent-clear-confirm':'会話履歴をリセットしました。','agent-disambig':'次のどれのことですか？','agent-more':'もっと見る',
                'agent-quick-1':'🎮 ゲーム何ある？','agent-quick-2':'✨ おすすめは？','agent-quick-3':'☀️ 三郷市の天気','agent-quick-4':'💴 ドル円教えて' },
          en: { 'agent-welcome':"Hi! Welcome to hide's portfolio 👋 I can introduce games, navigate the site, and fetch live data. Try a chip below.",
                'agent-fallback':"Sorry, I haven't learned that yet. Try a chip below or rephrase.",
                'agent-thinking':'Thinking…','agent-tool-loading':'Fetching…','agent-tool-error':'Could not fetch.',
                'agent-action-play':'Play →','agent-action-open-section':'Go there →','agent-action-copy':'Copy','agent-action-retry':'Retry',
                'agent-clear-confirm':'Conversation history cleared.','agent-disambig':'Which one did you mean?','agent-more':'See more',
                'agent-quick-1':'🎮 What games are here?','agent-quick-2':'✨ Recommend one','agent-quick-3':'☀️ Misato weather','agent-quick-4':'💴 USD/JPY rate' }
        };
        return (FB[State.lang] && FB[State.lang][key]) || key;
      }

      // ── DOM refs (populated on init) ─────────────────────────
      let fab, panel, messagesEl, typingEl, formEl, inputEl, sendBtn, clearBtn, closeBtn, quickEl;
      let typingAbort = null;

      let idleProactiveTimer = null;
      function setOpen(open) {
        if (!panel) return;
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        fab.setAttribute('aria-expanded', open ? 'true' : 'false');
        fab.hidden = open; // パネルを開いたらFABを全画面サイズで非表示
        if (idleProactiveTimer) { clearTimeout(idleProactiveTimer); idleProactiveTimer = null; }
        if (open) {
          clearFabBadge();
          if (State.history.length === 0) welcome();
          // 60秒無操作なら自発的にもうひと押し提案（セッション上限あり）
          idleProactiveTimer = setTimeout(() => {
            if (panel.classList.contains('open')) maybeProactive();
          }, 60000);
          requestAnimationFrame(() => inputEl && inputEl.focus());
        }
      }

      // ⑤ 時間帯連動クイックチップ
      function getTimeChips() {
        const h = new Date().getHours();
        const isJa = State.lang === 'ja';
        if (h >= 6 && h < 12) {
          // 朝：天気・為替・ゲーム
          return isJa
            ? [{ text: '☀️ 今日の天気', q: '三郷市の天気' }, { text: '💴 ドル円教えて', q: 'ドル円教えて' }, { text: '🎮 ゲーム何ある？', q: 'ゲーム何ある？' }]
            : [{ text: '☀️ Misato weather', q: 'Misato weather' }, { text: '💴 USD/JPY rate', q: 'USD/JPY rate' }, { text: '🎮 What games?', q: 'What games are here?' }];
        } else if (h >= 12 && h < 17) {
          // 昼：ゲーム・おすすめ・株価
          return isJa
            ? [{ text: '🎮 ゲーム何ある？', q: 'ゲーム何ある？' }, { text: '✨ おすすめは？', q: 'おすすめは？' }, { text: '📈 株価を調べる', q: 'トヨタの株価' }]
            : [{ text: '🎮 What games?', q: 'What games are here?' }, { text: '✨ Recommend one', q: 'Recommend one' }, { text: '📈 Check a stock', q: 'Toyota stock' }];
        } else if (h >= 17 && h < 21) {
          // 夕方：為替・株価・おすすめ
          return isJa
            ? [{ text: '💴 ドル円教えて', q: 'ドル円教えて' }, { text: '📈 ソニーの株価', q: 'ソニーの株価' }, { text: '✨ おすすめゲームは？', q: 'おすすめは？' }]
            : [{ text: '💴 USD/JPY rate', q: 'USD/JPY rate' }, { text: '📈 Sony stock', q: 'Sony stock' }, { text: '✨ Recommend a game', q: 'Recommend one' }];
        } else {
          // 夜（21〜5時）：暇つぶし・おすすめ・ゲーム一覧
          return isJa
            ? [{ text: '🎮 暇つぶしゲームは？', q: 'ゲーム何ある？' }, { text: '✨ おすすめは？', q: 'おすすめは？' }, { text: '💴 ドル円教えて', q: 'ドル円教えて' }]
            : [{ text: '🎮 Kill some time', q: 'What games are here?' }, { text: '✨ Recommend one', q: 'Recommend one' }, { text: '💴 USD/JPY rate', q: 'USD/JPY rate' }];
        }
      }

      function renderQuickActions() {
        if (!quickEl) return;
        const isJa = State.lang === 'ja';
        const savedTab = localStorage.getItem('agent-tab-pref') || 'games';

        const tabs = [
          { id: 'games', label: isJa ? '🎮 ゲーム' : '🎮 Games' },
          { id: 'live',  label: isJa ? '📡 ライブ' : '📡 Live' },
          { id: 'about', label: isJa ? '👤 hide'   : '👤 About' },
        ];
        const tabContent = {
          games: isJa
            ? [{ text: 'ゲーム一覧が見たい', q: 'ゲーム何ある？' }, { text: 'おすすめは？', q: 'おすすめは？' }, { text: '無料で遊べる？', q: '無料で遊べる？' }]
            : [{ text: 'All games', q: 'What games are here?' }, { text: 'Recommend one', q: 'Recommend one' }, { text: 'Are they free?', q: 'Are they free?' }],
          live: isJa
            ? [{ text: '☀️ 三郷市の天気', q: '三郷市の天気' }, { text: '💴 ドル円教えて', q: 'ドル円教えて' }, { text: '📈 株価を調べる', q: 'トヨタの株価' }]
            : [{ text: '☀️ Misato weather', q: 'Misato weather' }, { text: '💴 USD/JPY rate', q: 'USD/JPY rate' }, { text: '📈 Check a stock', q: 'Toyota stock' }],
          about: isJa
            ? [{ text: '👤 hideについて', q: 'hideについて教えて' }, { text: '🎯 趣味を教えて', q: '趣味を教えて' }, { text: '📬 連絡先', q: '連絡先を知りたい' }, { text: '🤖 Claude使ってる？', q: 'Claudeについて' }]
            : [{ text: '👤 About hide', q: 'About hide' }, { text: '🎯 Hobbies', q: 'What are your hobbies?' }, { text: '📬 Contact', q: 'How to contact?' }, { text: '🤖 Using Claude?', q: 'About Claude' }],
        };

        quickEl.innerHTML = '';
        const tabRow = document.createElement('div');
        tabRow.className = 'agent-qa-tab-row';
        const panes = {};

        tabs.forEach(tab => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'agent-qa-tab-btn' + (tab.id === savedTab ? ' qa-active' : '');
          btn.textContent = tab.label;
          btn.dataset.tab = tab.id;
          tabRow.appendChild(btn);

          const pane = document.createElement('div');
          pane.className = 'agent-qa-tab-pane' + (tab.id === savedTab ? ' qa-active' : '');
          pane.dataset.tab = tab.id;
          (tabContent[tab.id] || []).forEach(item => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'agent-chip';
            chip.textContent = item.text;
            chip.addEventListener('click', () => handleQuery(item.q));
            pane.appendChild(chip);
          });
          panes[tab.id] = pane;
        });

        tabRow.addEventListener('click', e => {
          const btn = e.target.closest('.agent-qa-tab-btn');
          if (!btn) return;
          const id = btn.dataset.tab;
          tabRow.querySelectorAll('.agent-qa-tab-btn').forEach(b => b.classList.toggle('qa-active', b.dataset.tab === id));
          Object.entries(panes).forEach(([k, p]) => p.classList.toggle('qa-active', k === id));
          try { localStorage.setItem('agent-tab-pref', id); } catch (e) { /* ignore */ }
        });

        quickEl.appendChild(tabRow);
        Object.values(panes).forEach(p => quickEl.appendChild(p));
      }

      function setTyping(on) {
        if (!typingEl) return;
        typingEl.classList.toggle('active', !!on);
        if (on && messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      let scrollScheduled = false;
      function scrollToBottom() {
        if (!messagesEl || scrollScheduled) return;
        scrollScheduled = true;
        requestAnimationFrame(() => {
          messagesEl.scrollTop = messagesEl.scrollHeight;
          scrollScheduled = false;
        });
      }

      function renderMessage(role, content, opts) {
        opts = opts || {};
        const wrap = document.createElement('div');
        wrap.className = 'agent-msg ' + role;
        const bubble = document.createElement('div');
        bubble.className = 'agent-bubble';
        if (typeof content === 'string') {
          bubble.textContent = content;
        } else if (content && content.nodeType) {
          bubble.appendChild(content);
        }
        wrap.appendChild(bubble);
        if (role === 'agent') {
          const actions = document.createElement('div');
          actions.className = 'msg-actions';
          if (opts.learned) {
            const tag = document.createElement('span');
            tag.className = 'msg-learned-tag';
            tag.textContent = '🧠 ' + (State.lang === 'ja' ? '学習済み' : 'learned');
            tag.title = State.lang === 'ja' ? 'みんなの質問から学習した回答です' : 'Answer learned from past visitors';
            actions.appendChild(tag);
          }
          const copy = document.createElement('button');
          copy.type = 'button';
          copy.className = 'msg-action-btn';
          copy.textContent = t('agent-action-copy');
          copy.addEventListener('click', () => {
            const text = bubble.innerText;
            if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
          });
          actions.appendChild(copy);
          if (opts.feedbackFor) {
            // 👍/👎 — 共有学習メモリへのフィードバック（押下後は両方無効化）
            actions.classList.add('has-fb');
            const fbBtns = [];
            [['👍', 'up'], ['👎', 'down']].forEach(([icon, vote]) => {
              const b = document.createElement('button');
              b.type = 'button';
              b.className = 'msg-action-btn msg-fb-btn';
              b.textContent = icon;
              b.title = State.lang === 'ja'
                ? (vote === 'up' ? '役に立った' : '回答がよくなかった')
                : (vote === 'up' ? 'Helpful' : 'Not helpful');
              b.addEventListener('click', () => {
                sendAgentFeedback(opts.feedbackFor, vote, opts.feedbackKey);
                fbBtns.forEach(x => { x.disabled = true; });
                b.classList.add('voted');
              });
              fbBtns.push(b);
              actions.appendChild(b);
            });
          }
          wrap.appendChild(actions);
        }
        messagesEl.appendChild(wrap);
        scrollToBottom();
        return { wrap, bubble };
      }

      function renderChips(items) {
        const row = document.createElement('div');
        row.className = 'agent-chips';
        items.forEach(it => {
          const c = document.createElement('button');
          c.type = 'button';
          c.className = 'agent-chip';
          c.textContent = it.label;
          c.addEventListener('click', () => {
            if (it.action) it.action();
            else if (it.query) handleQuery(it.query);
          });
          row.appendChild(c);
        });
        messagesEl.appendChild(row);
        scrollToBottom();
        return row;
      }

      function renderGameCards(games) {
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '6px';
        list.style.marginTop = '4px';
        games.forEach(g => list.appendChild(buildGameCard(g)));
        messagesEl.appendChild(list);
        scrollToBottom();
        return list;
      }

      function buildGameCard(g) {
        const a = document.createElement('a');
        a.className = 'game-card-mini';
        a.href = g.href;
        a.addEventListener('click', () => {
          try {
            localStorage.setItem('agent-last-game', JSON.stringify({
              title: g.title[State.lang] || g.title.ja,
              href: g.href,
              ts: Date.now()
            }));
          } catch(e) {}
          recordGamePlay(g.slug);
        });
        a.rel = 'noopener';
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        if (g.thumb) {
          const img = document.createElement('img');
          img.src = g.thumb;
          img.alt = g.title[State.lang] || g.title.ja;
          img.loading = 'lazy';
          thumb.appendChild(img);
        } else {
          thumb.textContent = g.emoji || '🎮';
        }
        a.appendChild(thumb);
        const body = document.createElement('div');
        body.className = 'body';
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = g.title[State.lang] || g.title.ja;
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = g.desc[State.lang] || g.desc.ja;
        const cta = document.createElement('div');
        cta.className = 'cta';
        cta.textContent = t('agent-action-play');
        body.appendChild(title);
        body.appendChild(desc);
        body.appendChild(cta);
        a.appendChild(body);
        return a;
      }

      function typeInto(bubble, text) {
        if (typingAbort) { typingAbort.aborted = true; typingAbort = null; }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          bubble.textContent = text;
          return Promise.resolve();
        }
        const token = { aborted: false };
        typingAbort = token;
        bubble.textContent = '';
        const caret = document.createElement('span');
        caret.className = 'caret';
        bubble.appendChild(caret);
        return new Promise(resolve => {
          let i = 0;
          const step = () => {
            if (token.aborted) { resolve(); return; }
            if (i >= text.length) {
              caret.remove();
              resolve();
              return;
            }
            const ch = text[i++];
            caret.insertAdjacentText('beforebegin', ch);
            scrollToBottom();
            // 文字位置によるアクセル・デセル効果
            const progress = text.length > 1 ? i / text.length : 0.5;
            let delay;
            if (ch === '。' || ch === '！' || ch === '？') {
              delay = TYPE_SPEED_MS * 3.5;    // 句点・感嘆符で長めの間
            } else if (ch === '、' || ch === '…') {
              delay = TYPE_SPEED_MS * 2.2;    // 読点で短めの間
            } else if (ch === '\n') {
              delay = TYPE_SPEED_MS * 4;      // 改行で最長の間
            } else if (progress < 0.15) {
              delay = TYPE_SPEED_MS * 0.6;    // 冒頭15%は速め
            } else if (progress > 0.80) {
              delay = TYPE_SPEED_MS * 1.4;    // 末尾20%はゆっくり
            } else {
              delay = TYPE_SPEED_MS;          // 中間は通常速度
            }
            setTimeout(step, delay);
          };
          step();
        });
      }

      let voiceEnabled = false;
      let voiceGender = 'female';

      // 音声リストは非同期ロードされるため、選択結果をキャッシュし voiceschanged で再選択
      let cachedVoice = { key: '', voice: null };
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices(); // ウォームアップ（初回呼び出しは空配列のことがある）
        if (typeof window.speechSynthesis.addEventListener === 'function') {
          window.speechSynthesis.addEventListener('voiceschanged', () => { cachedVoice = { key: '', voice: null }; });
        }
      }

      // 自然さ優先のスコア方式で音声を選ぶ:
      // ニューラル系（Natural/Neural/Online/Google）＞ 性別名マッチ ＞ ネットワーク音声 ＞ その他
      function pickVoice(langPrefix, gender) {
        const key = langPrefix + ':' + gender;
        if (cachedVoice.key === key && cachedVoice.voice) return cachedVoice.voice;
        const voices = window.speechSynthesis.getVoices()
          .filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
        if (!voices.length) return null;
        const femaleNames = /nanami|haruka|kyoko|ayumi|hikari|sayaka|samantha|karen|victoria|susan|zira|aria|jenny|female|女性/i;
        const maleNames = /ichiro|kenji|otoya|takeru|keita|daichi|daniel|alex|david|mark|guy|male|男性/i;
        const wantNames = gender === 'female' ? femaleNames : maleNames;
        const avoidNames = gender === 'female' ? maleNames : femaleNames;
        let best = null, bestScore = -Infinity;
        for (const v of voices) {
          let s = 0;
          if (/natural|neural|online/i.test(v.name)) s += 8; // Edge等のニューラル音声
          if (/google/i.test(v.name)) s += 6;                // Android Chromeの自然音声
          if (wantNames.test(v.name)) s += 4;
          if (avoidNames.test(v.name)) s -= 5;
          if (!v.localService) s += 1;                       // ネットワーク音声の方が概して自然
          if (s > bestScore) { bestScore = s; best = v; }
        }
        cachedVoice = { key: key, voice: best };
        return best;
      }

      // 読み上げ用テキスト整形: 絵文字・マークダウン・URL・括弧を除去し文単位に分割
      function cleanForSpeech(text) {
        return String(text)
          .replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu, '')
          .replace(/https?:\/\/\S+/g, State.lang === 'ja' ? 'リンク' : 'link')
          .replace(/[*_`#>|]+/g, '')
          .replace(/[「」『』【】〔〕《》［］()（）]/g, '')
          .replace(/([。！？!?])/g, '$1\n')
          .replace(/\n+/g, '\n')
          .trim();
      }

      function speak(text) {
        if (!voiceEnabled || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        const sentences = cleanForSpeech(text).split('\n').map(s => s.trim()).filter(Boolean);
        if (!sentences.length) return;

        const isJa = State.lang === 'ja';
        const voice = pickVoice(isJa ? 'ja' : 'en', voiceGender);
        const basePitch = voiceGender === 'female' ? (isJa ? 1.04 : 1.06) : (isJa ? 0.9 : 0.92);

        function makeUtt(sentence) {
          const utt = new SpeechSynthesisUtterance(sentence);
          utt.lang = isJa ? 'ja-JP' : 'en-US';
          if (voice) utt.voice = voice;
          // 文ごとに微小な揺らぎを与えて単調さを減らす。疑問文はやや高めに
          const isQuestion = /[？?]\s*$/.test(sentence);
          utt.pitch = Math.max(0.5, basePitch + (Math.random() - 0.5) * 0.06 + (isQuestion ? 0.05 : 0));
          utt.rate = Math.max(0.5, 1.0 + (Math.random() - 0.5) * 0.08);
          return utt;
        }

        // 文を順番にキューイングし、文間に自然な間（200〜350ms）を置く
        function speakQueue(arr, idx) {
          if (idx >= arr.length) return;
          const utt = makeUtt(arr[idx]);
          utt.onend = () => {
            if (idx < arr.length - 1) {
              setTimeout(() => speakQueue(arr, idx + 1), 200 + Math.random() * 150);
            }
          };
          window.speechSynthesis.speak(utt);
        }

        speakQueue(sentences, 0);
      }

      async function botSay(text, opts) {
        opts = opts || {};
        setTyping(true);
        const delay = opts.delay != null ? opts.delay : 220;
        await new Promise(r => setTimeout(r, delay));
        setTyping(false);
        const { bubble } = renderMessage('agent', '', { feedbackFor: opts.feedbackFor, feedbackKey: opts.feedbackKey, learned: opts.learned });
        await typeInto(bubble, text);
        State.push({ id: uid(), role: 'agent', text: text, ts: Date.now() });
        speak(text);
        return bubble;
      }

      function userSay(text) {
        renderMessage('user', text);
        State.push({ id: uid(), role: 'user', text: text, ts: Date.now() });
      }

      // ── ネットワーク堅牢化ヘルパー（タイムアウト＋前回値キャッシュ）──
      // 外部APIが落ちた/遅い場合でもUIが固まらないよう、各fetchに上限時間を設ける。
      // 全ソース失敗時は localStorage の前回値を stale フラグ付きで返し、空表示を防ぐ。
      function fetchWithTimeout(url, opts, timeoutMs) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), timeoutMs || 6000);
        return fetch(url, Object.assign({}, opts || {}, { signal: ctrl.signal }))
          .finally(() => clearTimeout(id));
      }
      function cacheSet(key, data) {
        try { localStorage.setItem('hide-cache-' + key, JSON.stringify({ data: data, ts: Date.now() })); } catch (e) {}
      }
      function cacheGet(key) {
        try {
          const raw = localStorage.getItem('hide-cache-' + key);
          return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
      }

      // ── Tool implementations ────────────────────────────────
      async function fetchForex() {
        const today = new Date().toISOString().slice(0, 10);
        const sources = [
          // ① frankfurter.app
          async () => {
            const r = await fetchWithTimeout('https://api.frankfurter.app/latest?from=USD&to=JPY');
            if (r.ok) { const d = await r.json(); if (d.rates && d.rates.JPY) return { rate: d.rates.JPY, date: d.date || today }; }
          },
          // ② open.er-api.com (free, no key)
          async () => {
            const r = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD');
            if (r.ok) { const d = await r.json(); if (d.rates && d.rates.JPY) return { rate: d.rates.JPY, date: today }; }
          },
          // ③ jsdelivr CDN currency API
          async () => {
            const r = await fetchWithTimeout('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
            if (r.ok) { const d = await r.json(); if (d.usd && d.usd.jpy) return { rate: d.usd.jpy, date: d.date || today }; }
          },
        ];
        for (const src of sources) {
          try { const v = await src(); if (v) { cacheSet('forex', v); return v; } } catch (e) { /* 次のソースへ */ }
        }
        // 全滅: 前回値があれば前回値表示にフォールバック
        const cached = cacheGet('forex');
        if (cached && cached.data) return Object.assign({}, cached.data, { stale: true });
        throw new Error('forex-all-sources-failed');
      }

      async function fetchWeatherMisato() {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=35.83&longitude=139.87&current=temperature_2m,weather_code,wind_speed_10m&timezone=Asia%2FTokyo';
        try {
          const res = await fetchWithTimeout(url);
          if (!res.ok) throw new Error('weather http ' + res.status);
          const data = await res.json();
          if (data && data.current) { cacheSet('weather', data.current); return data.current; }
          throw new Error('weather-empty');
        } catch (e) {
          const cached = cacheGet('weather');
          if (cached && cached.data) return Object.assign({}, cached.data, { stale: true });
          throw e;
        }
      }

      const WEATHER_CODE = {
        ja: { 0:'快晴', 1:'晴れ', 2:'晴れ時々曇り', 3:'曇り', 45:'霧', 48:'霧氷', 51:'弱い霧雨', 53:'霧雨', 55:'強い霧雨',
              61:'弱い雨', 63:'雨', 65:'強い雨', 71:'弱い雪', 73:'雪', 75:'強い雪', 77:'霧雪',
              80:'弱いにわか雨', 81:'にわか雨', 82:'激しいにわか雨', 85:'にわか雪', 86:'激しいにわか雪',
              95:'雷雨', 96:'雷雨（雹）', 99:'雷雨（強い雹）' },
        en: { 0:'Clear', 1:'Mostly clear', 2:'Partly cloudy', 3:'Overcast', 45:'Fog', 48:'Rime fog', 51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
              61:'Light rain', 63:'Rain', 65:'Heavy rain', 71:'Light snow', 73:'Snow', 75:'Heavy snow', 77:'Snow grains',
              80:'Light showers', 81:'Showers', 82:'Heavy showers', 85:'Snow showers', 86:'Heavy snow showers',
              95:'Thunderstorm', 96:'Thunderstorm with hail', 99:'Heavy thunderstorm with hail' }
      };
      const WEATHER_EMOJI = { 0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️' };

      function buildWeatherCard(data) {
        const card = document.createElement('div');
        card.className = 'tool-card';
        const wCode = data.weather_code;
        const desc = (WEATHER_CODE[State.lang] && WEATHER_CODE[State.lang][wCode]) || (State.lang === 'ja' ? '—' : '—');
        const emoji = WEATHER_EMOJI[wCode] || '🌡️';
        const title = document.createElement('div');
        title.className = 'tool-card-title';
        title.textContent = (State.lang === 'ja' ? '🏙️ 三郷市の天気' : '🏙️ Weather in Misato');
        const body = document.createElement('div');
        body.className = 'tool-card-body';
        const big = document.createElement('div');
        big.className = 'big';
        big.textContent = emoji + ' ' + (typeof data.temperature_2m === 'number' ? data.temperature_2m.toFixed(1) + '°C' : '—');
        const sub = document.createElement('div');
        sub.textContent = desc + (typeof data.wind_speed_10m === 'number' ? ' / ' + (State.lang === 'ja' ? '風速 ' : 'wind ') + data.wind_speed_10m.toFixed(1) + ' m/s' : '');
        body.appendChild(big);
        body.appendChild(sub);
        const meta = document.createElement('div');
        meta.className = 'tool-card-meta';
        meta.textContent = (State.lang === 'ja' ? '出典: open-meteo.com' : 'source: open-meteo.com')
          + (data.stale ? (State.lang === 'ja' ? '（前回取得値）' : ' (last known value)') : '');
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(meta);
        return card;
      }

      function buildForexCard(rate, date, stale) {
        const card = document.createElement('div');
        card.className = 'tool-card';
        const title = document.createElement('div');
        title.className = 'tool-card-title';
        title.textContent = (State.lang === 'ja' ? '💴 USD/JPY 為替レート' : '💴 USD/JPY exchange rate');
        const body = document.createElement('div');
        body.className = 'tool-card-body';
        const big = document.createElement('div');
        big.className = 'big';
        big.textContent = '1 USD = ' + rate.toFixed(2) + ' JPY';
        body.appendChild(big);
        const meta = document.createElement('div');
        meta.className = 'tool-card-meta';
        meta.textContent = (State.lang === 'ja' ? '出典: frankfurter.app / 基準日: ' : 'source: frankfurter.app / as of ') + date
          + (stale ? (State.lang === 'ja' ? '（前回取得値）' : ' (last known value)') : '');
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(meta);
        return card;
      }

      function buildStockCard(quote, name, symbol) {
        const card = document.createElement('div');
        card.className = 'tool-card';
        const change = quote.price - quote.prev;
        const pct = quote.prev ? (change / quote.prev) * 100 : 0;
        const up = change >= 0;
        const sign = up ? '+' : '';
        const changeColor = up ? '#34d399' : '#f87171';
        const arrow = up ? '▲' : '▼';
        const title = document.createElement('div');
        title.className = 'tool-card-title';
        title.textContent = '📈 ' + name + ' (' + symbol + ')';
        const body = document.createElement('div');
        body.className = 'tool-card-body';
        const big = document.createElement('div');
        big.className = 'big';
        big.textContent = '¥' + Math.round(quote.price).toLocaleString('ja-JP');
        const sub = document.createElement('div');
        sub.style.color = changeColor;
        sub.style.fontSize = '0.9rem';
        sub.style.fontWeight = '600';
        sub.textContent = arrow + ' ' + sign + change.toFixed(1) + ' (' + sign + pct.toFixed(2) + '%)';
        body.appendChild(big);
        body.appendChild(sub);
        const meta = document.createElement('div');
        meta.className = 'tool-card-meta';
        meta.textContent = State.lang === 'ja' ? '出典: Yahoo Finance / リアルタイムではありません' : 'source: Yahoo Finance / not real-time';
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(meta);
        return card;
      }

      function scrollToSection(sec) {
        const el = document.getElementById(sec);
        if (!el) return false;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }

      function buildSectionAction(sec) {
        const wrap = document.createElement('div');
        wrap.className = 'agent-chips';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'agent-chip';
        btn.textContent = t('agent-action-open-section');
        btn.addEventListener('click', () => { scrollToSection(sec); setOpen(false); });
        wrap.appendChild(btn);
        return wrap;
      }

      // ── Main dispatcher ─────────────────────────────────────
      async function handleQuery(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return;
        userSay(text);

        // language switch shortcuts
        const intent0 = detectIntent(text, State.lang);
        if (intent0.name === 'lang_en' && intent0.score >= 2) { switchLang('en'); return; }
        if (intent0.name === 'lang_ja' && intent0.score >= 2) { switchLang('ja'); return; }
        if (intent0.name === 'clear' && intent0.score >= 2)   { doClear(); return; }

        // game match has priority
        const gameHits = detectGame(text);
        if (gameHits.length === 1) {
          State.lastIntent = 'open_game';
          State.slots.game = gameHits[0].slug;
          State.save();
          await botSay(State.lang === 'ja'
            ? '「' + gameHits[0].title.ja + '」ですね！下のカードから遊べます 🎮'
            : 'Here’s ' + gameHits[0].title.en + ' — tap below to play 🎮');
          renderGameCards(gameHits);
          renderChips(contextChips('open_game'));
          return;
        }
        if (gameHits.length > 1) {
          State.lastIntent = 'disambig_game';
          State.save();
          await botSay(t('agent-disambig'));
          const chips = gameHits.slice(0, 4).map(g => ({
            label: g.title[State.lang] || g.title.ja,
            action: () => handleQuery(g.title[State.lang] || g.title.ja)
          }));
          renderChips(chips);
          return;
        }

        // ③ stock match（銘柄名が含まれる場合は直接取得）
        const stockHit = detectStock(text);
        if (stockHit) {
          State.lastIntent = 'stock';
          State.slots.stock = stockHit.name || null;
          State.save();
          await runStock(stockHit);
          return;
        }

        // Section navigation has high priority for unambiguous matches
        const sec = detectSection(text, State.lang);
        const intent = intent0;

        // If only section detected and intent score is weak → goto_section
        if (sec && (!intent.name || intent.score < 1.6) && sec !== 'works') {
          State.lastIntent = 'goto_section';
          State.save();
          const name = SECTIONS[sec][State.lang] || SECTIONS[sec].ja;
          await botSay(State.lang === 'ja' ? '「' + name + '」セクションへご案内します 🧭' : 'Taking you to "' + name + '" 🧭');
          messagesEl.appendChild(buildSectionAction(sec));
          scrollToBottom();
          return;
        }

        // intent dispatch
        if (intent.name && intent.score >= 2.0) {
          State.lastIntent = intent.name;
          State.save();
          await runIntent(intent.name, text);
          return;
        }
        if (intent.name && intent.score >= 1.0) {
          // disambiguation when borderline
          State.lastIntent = 'disambig_intent';
          State.save();
          await botSay(t('agent-disambig'));
          renderChips(borderlineChips(intent.name));
          return;
        }

        // ④ fallback — AI自由回答を最優先で試行（どんな質問にも答える）
        State.lastIntent = null;
        State.save();
        if (AGENT_PROXY_URL) {
          setTyping(true);
          try {
            const reply = await askGemini(text, State.history);
            setTyping(false);
            await botSay(reply.text, { delay: 0, feedbackFor: text, feedbackKey: reply.key, learned: reply.source === 'learned' });
            renderChips(defaultChips());
            return;
          } catch (e) {
            setTyping(false);
            // AI失敗 → 下の類似サジェストへフォールバック
          }
        }
        const sug = suggestFromText(text, State.lang);
        if (sug.length > 0) {
          const msg = State.lang === 'ja'
            ? 'うまく理解できませんでした 🙏 もしかしてこちらですか？'
            : "I didn't quite get that 🙏 Did you mean one of these?";
          await botSay(msg);
          renderChips(sug);
        } else {
          // 全インテントのスコアを計算して最も近い3候補を提示
          const isJa = State.lang === 'ja';
          const dict = INTENT_DICT_NORM[isJa ? 'ja' : 'en'] || INTENT_DICT_NORM.ja;
          const labels = INTENT_CHIP_LABELS[isJa ? 'ja' : 'en'] || INTENT_CHIP_LABELS.ja;
          const nt = normalize(text);
          const scores = {};
          for (const intent in dict) {
            let s = 0;
            for (const [kw, w] of dict[intent]) {
              if (nt.includes(kw)) s += w;
            }
            if (s > 0) scores[intent] = s;
          }
          const topIntents = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name);

          if (topIntents.length > 0) {
            const msg = isJa
              ? 'ちょっとうまく聞き取れませんでした 😅 こういったことでしょうか？'
              : "Hmm, I'm not sure I followed that 😅 Maybe one of these?";
            await botSay(msg);
            const chips = topIntents
              .filter(name => labels[name])
              .map(name => ({ label: labels[name], query: labels[name].replace(/^[^\s]+\s/, '') }));
            renderChips(chips.length > 0 ? chips : defaultChips());
          } else {
            const msg = isJa
              ? 'うまく聞き取れませんでした 😅 別の言い方で試してみてください。'
              : "I couldn't quite understand that 😅 Try rephrasing, or pick from below.";
            await botSay(msg);
            renderChips(defaultChips());
          }
        }
      }

      function borderlineChips(intentName) {
        const cm = {
          recommend: ['agent-quick-1','agent-quick-2'],
          listGames: ['agent-quick-2'],
          forex:     ['agent-quick-4'],
          weather:   ['agent-quick-3']
        };
        const keys = cm[intentName] || ['agent-quick-1','agent-quick-2'];
        return keys.map(k => ({ label: t(k), query: t(k) }));
      }

      // インテント使用回数を端末ごとに記録し、クイックチップを使用頻度順に並べ替える
      const AGENT_STATS_KEY = 'hide-agent-stats-v1';
      function loadIntentStats() {
        try { return JSON.parse(localStorage.getItem(AGENT_STATS_KEY)) || {}; } catch (e) { return {}; }
      }
      function recordIntentUse(name) {
        try {
          const stats = loadIntentStats();
          stats[name] = (stats[name] || 0) + 1;
          localStorage.setItem(AGENT_STATS_KEY, JSON.stringify(stats));
        } catch (e) { /* プライベートモード等では無視 */ }
      }

      function defaultChips() {
        const quickIntent = {
          'agent-quick-1': 'listGames',
          'agent-quick-2': 'recommend',
          'agent-quick-3': 'weather',
          'agent-quick-4': 'forex',
        };
        const stats = loadIntentStats();
        return ['agent-quick-1','agent-quick-2','agent-quick-3','agent-quick-4']
          .map((k, i) => ({ k: k, i: i, n: stats[quickIntent[k]] || 0 }))
          .sort((a, b) => b.n - a.n || a.i - b.i)
          .map(o => ({ label: t(o.k), query: t(o.k) }));
      }

      // 会話文脈に応じたクイックチップを返す（インテント名 → チップ配列）
      function contextChips(intentName) {
        const isJa = State.lang === 'ja';
        const map = {
          listGames: isJa
            ? [{ label: '✨ おすすめは？', query: 'おすすめは？' },
               { label: '🎲 ボードゲームは？', query: 'ボードゲーム何ある？' },
               { label: '🆓 無料で遊べる？', query: '無料で遊べる？' }]
            : [{ label: '✨ Recommend one', query: 'Recommend one' },
               { label: '🎲 Board games?', query: 'What board games?' },
               { label: '🆓 Are they free?', query: 'Are they free?' }],
          recommend: isJa
            ? [{ label: '🎮 ゲーム一覧も見る', query: 'ゲーム何ある？' },
               { label: '🎲 他のジャンルは？', query: 'ボードゲーム何ある？' },
               { label: '🆓 無料で遊べる？', query: '無料で遊べる？' }]
            : [{ label: '🎮 See all games', query: 'What games are here?' },
               { label: '🎲 Other genres?', query: 'What board games?' },
               { label: '🆓 Are they free?', query: 'Are they free?' }],
          open_game: isJa
            ? [{ label: '✨ 他のおすすめは？', query: 'おすすめは？' },
               { label: '🎮 ゲーム一覧', query: 'ゲーム何ある？' }]
            : [{ label: '✨ Other picks?', query: 'Recommend one' },
               { label: '🎮 All games', query: 'What games are here?' }],
          forex: isJa
            ? [{ label: '📈 株価も調べる', query: 'トヨタの株価' },
               { label: '☀️ 天気も教えて', query: '三郷市の天気' },
               { label: '📊 ダッシュボードへ', action: () => { scrollToSection('dashboard'); setOpen(false); } }]
            : [{ label: '📈 Check a stock', query: 'Toyota stock' },
               { label: '☀️ Misato weather', query: 'Misato weather' },
               { label: '📊 Dashboard', action: () => { scrollToSection('dashboard'); setOpen(false); } }],
          weather: isJa
            ? [{ label: '💴 ドル円も見る', query: 'ドル円教えて' },
               { label: '📈 株価を調べる', query: 'トヨタの株価' },
               { label: '📊 ダッシュボードへ', action: () => { scrollToSection('dashboard'); setOpen(false); } }]
            : [{ label: '💴 USD/JPY rate', query: 'USD/JPY rate' },
               { label: '📈 Check a stock', query: 'Toyota stock' },
               { label: '📊 Dashboard', action: () => { scrollToSection('dashboard'); setOpen(false); } }],
          stock: isJa
            ? [{ label: '💴 ドル円も見る', query: 'ドル円教えて' },
               { label: '📈 他の銘柄', query: 'ソニーの株価' },
               { label: '📊 ダッシュボードへ', action: () => { scrollToSection('dashboard'); setOpen(false); } }]
            : [{ label: '💴 USD/JPY rate', query: 'USD/JPY rate' },
               { label: '📈 Another stock', query: 'Sony stock' },
               { label: '📊 Dashboard', action: () => { scrollToSection('dashboard'); setOpen(false); } }],
          about: isJa
            ? [{ label: '🎯 趣味は？', query: '趣味を教えて' },
               { label: '📬 連絡先', query: '連絡先を知りたい' },
               { label: '🎮 ゲーム見てみる', query: 'ゲーム何ある？' }]
            : [{ label: '🎯 Hobbies?', query: 'What are your hobbies?' },
               { label: '📬 Contact', query: 'How to contact?' },
               { label: '🎮 Check games', query: 'What games are here?' }],
          greet: isJa
            ? [{ label: '🎮 ゲーム何ある？', query: 'ゲーム何ある？' },
               { label: '✨ おすすめは？', query: 'おすすめは？' },
               { label: '☀️ 今日の天気', query: '三郷市の天気' }]
            : [{ label: '🎮 What games?', query: 'What games are here?' },
               { label: '✨ Recommend one', query: 'Recommend one' },
               { label: '☀️ Misato weather', query: 'Misato weather' }],
        };
        return map[intentName] || defaultChips();
      }

      async function runIntent(name, rawText) {
        recordIntentUse(name);
        switch (name) {
          case 'forex':     return runForex();
          case 'weather':   return runWeather();
          case 'recommend': return runRecommend();
          case 'listGames': return runListGames(rawText);
          case 'catGames':  return runCatGames(rawText);
          case 'howto':     return runHowto();
          case 'newGames':  return runNewGames();
          case 'free':      return runKb('free');
          case 'misato':       return runKb('misato', { chips: [{label: t('agent-quick-1'), query: t('agent-quick-1')}] });
          case 'misatoPop':    return runKb('misatoPop');
          case 'misatoEvents': return runMisatoEvents();
          case 'hobby':     return runKb('hobby');
          case 'claude':    return runKb('claude');
          case 'pet':       return runKb('pet');
          case 'contact':   return runKb('contact', { section: 'contact' });
          case 'blog':      return runKb('blog', { section: 'blog' });
          case 'about':     return runKb('about');
          case 'greet':     return runKb('greet', { chips: contextChips('greet') });
          case 'thanks':    return runKb('thanks');
          case 'more':      return runMore();
          case 'stock':     return runStockGeneric();
          default:          await botSay(t('agent-fallback')); renderChips(defaultChips());
        }
      }

      async function runKb(key, opts) {
        opts = opts || {};
        const raw = (KB[key] && KB[key][State.lang]) || (KB[key] && KB[key].ja) || t('agent-fallback');
        const txt = raw.replace(/\{GAME_COUNT\}/g, String(GAMES.length));
        await botSay(txt);
        if (opts.section) {
          messagesEl.appendChild(buildSectionAction(opts.section));
          scrollToBottom();
        }
        if (opts.chips) renderChips(opts.chips);
      }

      async function runForex() {
        setTyping(true);
        try {
          const { rate, date, stale } = await fetchForex();
          setTyping(false);
          const { bubble } = renderMessage('agent', '');
          const intro = State.lang === 'ja' ? '現在のドル円レートはこちらです 💴' : "Here's the current USD/JPY rate 💴";
          await typeInto(bubble, intro);
          State.push({ id: uid(), role: 'agent', text: intro, ts: Date.now() });
          messagesEl.appendChild(buildForexCard(rate, date, stale));
          scrollToBottom();
          renderChips(contextChips('forex'));
        } catch (e) {
          setTyping(false);
          await botSay(t('agent-tool-error'));
          renderChips([{ label: t('agent-action-retry'), action: () => runForex() }]);
        }
      }

      async function runWeather() {
        setTyping(true);
        try {
          const data = await fetchWeatherMisato();
          setTyping(false);
          const { bubble } = renderMessage('agent', '');
          const intro = State.lang === 'ja' ? '三郷市のいまの天気はこちら ☁️' : "Here's the current weather in Misato ☁️";
          await typeInto(bubble, intro);
          State.push({ id: uid(), role: 'agent', text: intro, ts: Date.now() });
          messagesEl.appendChild(buildWeatherCard(data));
          scrollToBottom();
          renderChips(contextChips('weather'));
        } catch (e) {
          setTyping(false);
          await botSay(t('agent-tool-error'));
          renderChips([{ label: t('agent-action-retry'), action: () => runWeather() }]);
        }
      }

      async function runMisatoEvents() {
        const intro = State.lang === 'ja'
          ? '三郷市の年間イベントをご紹介します 🎉\n直近・今後のものを優先して表示しています。'
          : "Here's a roundup of Misato City's annual events 🎉\nUpcoming events shown first.";
        await botSay(intro);

        const grid = document.getElementById('misato-events-grid');
        if (!grid) { await botSay(t('agent-fallback')); return; }

        const items = Array.from(grid.querySelectorAll('.event-item'));
        if (!items.length) { await botSay(t('agent-fallback')); return; }

        const getClass = el => ['next-up','upcoming','past'].find(c => el.classList.contains(c)) || 'past';
        const order = { 'next-up':0, 'upcoming':1, 'past':2 };
        items.sort((a,b) => order[getClass(a)] - order[getClass(b)]);

        const upcoming = items.filter(i => !i.classList.contains('past'));
        const past     = items.filter(i => i.classList.contains('past'));
        const toShow   = upcoming.length ? upcoming : items;

        const listEl = document.createElement('div');
        listEl.className = 'agent-event-list';

        toShow.forEach(item => {
          const cls   = getClass(item);
          const mini  = document.createElement('div');
          mini.className = 'agent-event-mini ev-' + cls;

          const name  = item.querySelector('.event-item-name')?.textContent   || '';
          const date  = item.querySelector('.event-item-date')?.textContent   || '';
          const loc   = item.querySelector('.event-item-location')?.textContent || '';
          const desc  = item.querySelector('.event-item-desc')?.textContent   || '';
          const emoji = item.querySelector('.event-item-emoji')?.textContent  || '🎉';

          const head  = document.createElement('div'); head.className = 'agent-event-mini-head';
          const nameEl = document.createElement('span'); nameEl.className = 'agent-event-mini-name';
          nameEl.textContent = emoji + ' ' + name;
          if (cls === 'next-up') {
            const badge = document.createElement('span');
            badge.className = 'agent-event-mini-badge';
            badge.textContent = 'NEXT';
            nameEl.appendChild(badge);
          }
          const dateEl = document.createElement('span'); dateEl.className = 'agent-event-mini-date';
          dateEl.textContent = date;
          head.appendChild(nameEl); head.appendChild(dateEl);
          mini.appendChild(head);

          const locEl = document.createElement('div'); locEl.className = 'agent-event-mini-loc';
          locEl.textContent = loc;
          mini.appendChild(locEl);

          if (desc) {
            const descEl = document.createElement('div'); descEl.className = 'agent-event-mini-desc';
            descEl.textContent = desc;
            mini.appendChild(descEl);
          }

          listEl.appendChild(mini);
        });

        if (past.length && upcoming.length) {
          const noteEl = document.createElement('div');
          noteEl.className = 'agent-event-past-note';
          noteEl.textContent = State.lang === 'ja'
            ? '（終了済み ' + past.length + '件は省略）'
            : '(' + past.length + ' past events not shown)';
          listEl.appendChild(noteEl);
        }

        messagesEl.appendChild(listEl);
        scrollToBottom();

        renderChips([
          { label: State.lang === 'ja' ? '📅 イベントカレンダーへ' : '📅 See Calendar',
            action: () => { scrollToSection('local'); setOpen(false); } },
          { label: State.lang === 'ja' ? '☀️ 三郷市の天気' : '☀️ Weather',
            query:  State.lang === 'ja' ? '三郷市の天気' : 'weather' }
        ]);
      }

      // よく遊ぶジャンル・未プレイ状況にもとづくパーソナライズおすすめ
      async function runRecommend() {
        const isJa = State.lang === 'ja';
        const prof = loadProfile();
        const played = prof.playedGames || {};
        const catCount = {};
        for (const slug in played) {
          const g = GAMES.find(x => x.slug === slug);
          if (g) catCount[g.cat] = (catCount[g.cat] || 0) + (played[slug].count || 1);
        }
        const favCat = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0] || null;
        const unplayed = GAMES.filter(g => !played[g.slug]);
        const picks = [];
        if (favCat) for (const g of unplayed) { if (g.cat === favCat && picks.length < 3) picks.push(g); }
        for (const slug of RECOMMENDS) {
          if (picks.length >= 3) break;
          const g = GAMES.find(x => x.slug === slug);
          if (g && picks.indexOf(g) === -1 && !played[g.slug]) picks.push(g);
        }
        for (const g of unplayed) { if (picks.length >= 3) break; if (picks.indexOf(g) === -1) picks.push(g); }
        for (const slug of RECOMMENDS) {
          if (picks.length >= 3) break;
          const g = GAMES.find(x => x.slug === slug);
          if (g && picks.indexOf(g) === -1) picks.push(g);
        }
        const txt = favCat && picks.some(g => g.cat === favCat)
          ? (isJa ? 'よく遊ばれているジャンルから、まだ遊んでいない3本を選びました 🌟'
                  : "Based on what you play, here are 3 picks you haven't tried 🌟")
          : (isJa ? '今のおすすめはこの3本です 🌟 どれもブラウザですぐ遊べます！'
                  : "Today's top 3 picks 🌟 — all playable right in the browser!");
        await botSay(txt);
        renderGameCards(picks.slice(0, 3));
        renderChips(contextChips('recommend'));
      }

      async function runListGames(rawText) {
        // 「アクションゲームある？」等、ジャンル指定が含まれていればフィルタ表示へ
        const cat = detectCat(rawText || '');
        if (cat) return runCatGames(rawText);
        State.paginationOffset = 0;
        const first = GAMES.slice(0, 5);
        const txt = State.lang === 'ja'
          ? `全${GAMES.length}本のブラウザゲームから5本ずつ紹介します 🎮 続きは「もっと」でどうぞ。`
          : `I've got ${GAMES.length} browser games — here's the first 5. Say “more” for the next batch 🎮`;
        await botSay(txt);
        renderGameCards(first);
        State.paginationOffset = 5;
        State.save();
        // ページネーションの「もっと」は残しつつ文脈チップで補完
        const chips = [{ label: t('agent-more'), action: () => runMore() }, ...contextChips('listGames')];
        renderChips(chips);
      }

      // ── ジャンル別一覧（発話からカテゴリを特定してフィルタ）──
      const CAT_KEYWORDS = {
        action: ['アクション', 'action'],
        puzzle: ['パズル', 'puzzle'],
        rpg: ['ロールプレイング', 'role playing', 'rpg系'],
        board: ['ボード', '将棋系', 'board game', 'board'],
        card: ['トランプ', 'card game'],
        sim: ['シミュレーション', 'シュミレーション', 'simulation', '経営', '育成'],
      };
      const CAT_LABELS = {
        action: { ja: 'アクション', en: 'action' },
        puzzle: { ja: 'パズル', en: 'puzzle' },
        rpg:    { ja: 'RPG', en: 'RPG' },
        board:  { ja: 'ボード', en: 'board' },
        card:   { ja: 'カード', en: 'card' },
        sim:    { ja: 'シミュレーション', en: 'simulation' },
        other:  { ja: 'その他', en: 'other' },
      };
      function detectCat(text) {
        const nt = normalize(text);
        if (!nt) return null;
        for (const cat in CAT_KEYWORDS) {
          if (CAT_KEYWORDS[cat].some(k => nt.indexOf(normalize(k)) !== -1)) return cat;
        }
        return null;
      }
      async function runCatGames(rawText) {
        const isJa = State.lang === 'ja';
        const cat = detectCat(rawText || '') || State.slots.cat;
        const hits = cat ? GAMES.filter(g => g.cat === cat) : [];
        if (!hits.length) return runListGames();
        State.slots.cat = cat;
        State.save();
        const label = (CAT_LABELS[cat] && CAT_LABELS[cat][isJa ? 'ja' : 'en']) || cat;
        await botSay(isJa
          ? label + '系のゲームは全' + hits.length + '本あります 🎮 まずはこちら！'
          : 'I have ' + hits.length + ' ' + label + ' games 🎮 Here are some!');
        renderGameCards(hits.slice(0, 5));
        if (hits.length > 5) {
          renderChips([{ label: isJa ? '全部見る' : 'See all games', query: isJa ? 'ゲーム一覧が見たい' : 'List all games' }]);
        }
      }

      // ── 遊び方（直前の話題スロットで「それ」を解決）─────────
      async function runHowto() {
        const isJa = State.lang === 'ja';
        const g = State.slots.game && GAMES.find(x => x.slug === State.slots.game);
        if (!g) {
          await botSay(isJa
            ? 'どのゲームの遊び方が知りたいですか？🎮 ゲーム名を教えてください。'
            : 'Which game would you like to learn? 🎮 Tell me its name.');
          renderChips(defaultChips());
          return;
        }
        await botSay(isJa
          ? '「' + g.title.ja + '」ですね！' + (g.desc.ja || '') + '。\n詳しい操作はゲームページ内の説明をどうぞ。下のカードから開けます 👇'
          : 'You mean ' + (g.title.en || g.title.ja) + '! ' + (g.desc.en || '') + '.\nFull controls are explained on the game page — tap below 👇');
        renderGameCards([g]);
      }

      // ── 新作（GAMES配列は追加順のため末尾が最新）────────────
      async function runNewGames() {
        const isJa = State.lang === 'ja';
        const latest = GAMES.slice(-3).reverse();
        await botSay(isJa ? '最近追加されたのはこちらの3本です ✨' : 'Here are the 3 most recently added games ✨');
        renderGameCards(latest);
        renderChips(contextChips('listGames'));
      }

      async function runMore() {
        if (State.paginationOffset >= GAMES.length) {
          const txt = State.lang === 'ja' ? 'これで全部です！どれか気になるものはありましたか？😊' : "That's the full list! See anything you like? 😊";
          await botSay(txt);
          renderChips([{ label: t('agent-quick-2'), query: t('agent-quick-2') }]);
          State.paginationOffset = 0;
          State.save();
          return;
        }
        const next = GAMES.slice(State.paginationOffset, State.paginationOffset + 5);
        const remaining = GAMES.length - State.paginationOffset - next.length;
        const txt = State.lang === 'ja'
          ? '続きはこちらです（残り ' + remaining + ' 本）'
          : 'More titles below (' + remaining + ' to go)';
        await botSay(txt);
        renderGameCards(next);
        State.paginationOffset += next.length;
        State.save();
        const chips = [];
        if (remaining > 0) chips.push({ label: t('agent-more'), action: () => runMore() });
        chips.push({ label: t('agent-quick-2'), query: t('agent-quick-2') });
        renderChips(chips);
      }

      // ③ 株価インテント
      // Yahoo Finance 失敗時に Stooq CSV へフォールバックする株価取得
      // Stooq CSV をパースして { price, prev } を返す
      function parseStooqCsv(text) {
        // フォーマット: Symbol,Date,Close （f=sd2c）
        // ヘッダー行を除いた最初の2行を使用
        const rows = text.trim().split('\n')
          .map(l => l.trim())
          .filter(l => l && !/^Symbol/i.test(l));
        if (!rows.length) return null;
        const price = parseFloat(rows[0].split(',')[2]);
        if (!isFinite(price) || price <= 0) return null;
        const prevRaw = rows.length > 1 ? parseFloat(rows[1].split(',')[2]) : price;
        const prev = isFinite(prevRaw) && prevRaw > 0 ? prevRaw : price;
        return { price, prev };
      }

      async function fetchStooqCsv(stooqSym) {
        // Symbol,Date,Close のシンプルフォーマット・直近2日分
        const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&f=sd2c&i=d`;
        const proxies = [
          url,                                                        // 直接 (CORSが通れば最速)
          `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
          `https://corsproxy.io/?${encodeURIComponent(url)}`,
          `https://api.codetabs.com/v1/proxy?quest=${url}`,
        ];
        for (const pUrl of proxies) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 12000);
            const res = await fetch(pUrl, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) continue;
            const text = await res.text();
            const parsed = parseStooqCsv(text);
            if (parsed) return parsed;
          } catch (e) { continue; }
        }
        return null;
      }

      async function fetchStockForAgent(symbol) {
        // 1. 既存の fetchStock（Yahoo Finance + キャッシュ）
        try {
          const data = await fetchStock(symbol);
          if (data) return data;
        } catch (e) { /* fall through */ }

        // 2. Stooq CSV（.T → .jp、直接 + 複数プロキシ）
        const stooqSym = /\.T$/i.test(symbol)
          ? symbol.replace(/\.T$/i, '.jp')
          : symbol.toLowerCase();
        const result = await fetchStooqCsv(stooqSym);
        if (result) return result;

        throw new Error('all-sources-failed');
      }

      // データ取得不可時に外部リンクカードを表示
      function buildStockLinkCard(match) {
        const card = document.createElement('div');
        card.className = 'tool-card';
        const title = document.createElement('div');
        title.className = 'tool-card-title';
        title.textContent = '📈 ' + match.name + ' (' + match.symbol + ')';
        const body = document.createElement('div');
        body.className = 'tool-card-body';
        const link = document.createElement('a');
        link.href = 'https://finance.yahoo.co.jp/quote/' + encodeURIComponent(match.symbol);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'color:#06b6d4;font-size:0.9rem;';
        link.textContent = State.lang === 'ja' ? 'Yahoo!ファイナンスで確認する →' : 'View on Yahoo Finance →';
        body.appendChild(link);
        const meta = document.createElement('div');
        meta.className = 'tool-card-meta';
        meta.textContent = State.lang === 'ja' ? 'リアルタイムデータの取得に失敗しました' : 'Real-time data unavailable';
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(meta);
        return card;
      }

      async function runStock(match) {
        setTyping(true);
        try {
          const quote = await fetchStockForAgent(match.symbol);
          setTyping(false);
          const { bubble } = renderMessage('agent', '');
          const intro = State.lang === 'ja'
            ? '「' + match.name + '」の株価はこちらです 📈'
            : 'Here\'s the latest quote for ' + match.name + ' 📈';
          await typeInto(bubble, intro);
          State.push({ id: uid(), role: 'agent', text: intro, ts: Date.now() });
          messagesEl.appendChild(buildStockCard(quote, match.name, match.symbol));
          scrollToBottom();
          renderChips(contextChips('stock'));
        } catch (e) {
          setTyping(false);
          const msg = State.lang === 'ja'
            ? '現在リアルタイムデータを取得できません。外部サイトでご確認ください。'
            : 'Unable to fetch real-time data. Please check an external source.';
          await botSay(msg);
          messagesEl.appendChild(buildStockLinkCard(match));
          scrollToBottom();
          renderChips([{ label: t('agent-action-retry'), action: () => runStock(match) }]);
        }
      }

      // 銘柄未指定の stock インテント（例示チップを表示）
      async function runStockGeneric() {
        const isJa = State.lang === 'ja';
        const msg = isJa
          ? '調べたい銘柄を教えてください 📈 例：「ソニーの株価」「任天堂の株価」'
          : 'Which company? e.g. "Sony stock", "Nintendo stock" 📈';
        await botSay(msg);
        const chips = isJa
          ? [{ label: 'ソニーの株価', query: 'ソニーの株価' }, { label: '任天堂の株価', query: '任天堂の株価' }, { label: 'トヨタの株価', query: 'トヨタの株価' }]
          : [{ label: 'Sony stock', query: 'Sony stock' }, { label: 'Nintendo stock', query: 'Nintendo stock' }, { label: 'Toyota stock', query: 'Toyota stock' }];
        renderChips(chips);
      }

      function switchLang(lang) {
        if (typeof window.applyLang === 'function') {
          try { window.applyLang(lang); } catch (e) { /* ignore */ }
        }
        State.lang = lang;
        State.save();
        renderQuickActions();
        botSay(lang === 'ja' ? '日本語に切り替えました。' : 'Switched to English.');
      }

      function doClear() {
        State.reset();
        messagesEl.innerHTML = '';
        renderQuickActions();
        welcome();
      }

      // ── 永続パーソナライズ（localStorage プロファイル）───────
      const PROFILE_KEY = 'hide-agent-profile-v1';
      function loadProfile() {
        let p = null;
        try { p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { /* ignore */ }
        if (!p || p.v !== 1) {
          p = { v: 1, visits: 0, playedGames: {}, seenGameSlugs: [], readNewsIds: [] };
          // 旧キー（agent-visit-count）からの移行
          try { p.visits = parseInt(localStorage.getItem('agent-visit-count') || '0', 10) || 0; } catch (e) { /* ignore */ }
        }
        if (!p.playedGames || typeof p.playedGames !== 'object') p.playedGames = {};
        if (!Array.isArray(p.seenGameSlugs)) p.seenGameSlugs = [];
        if (!Array.isArray(p.readNewsIds)) p.readNewsIds = [];
        return p;
      }
      function saveProfile(p) {
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
      }
      function recordGamePlay(slug) {
        const p = loadProfile();
        const e = p.playedGames[slug] || { count: 0, last: 0 };
        e.count++; e.last = Date.now();
        p.playedGames[slug] = e;
        saveProfile(p);
      }
      function markGamesSeen(prof) {
        prof.seenGameSlugs = GAMES.map(g => g.slug);
        saveProfile(prof);
      }

      // ── プロアクティブ提案エンジン ───────────────────────────
      // 自発的な提案は1セッション最大2件。優先度: 未読お知らせ → 新着ゲーム → 未プレイのおすすめ。
      const NEWS_URL = 'data/agent-news.json';
      const PROACTIVE_MAX_PER_SESSION = 2;
      function proactiveCount() {
        try { return parseInt(sessionStorage.getItem('agent-proactive-count') || '0', 10) || 0; } catch (e) { return PROACTIVE_MAX_PER_SESSION; }
      }
      function bumpProactiveCount() {
        try { sessionStorage.setItem('agent-proactive-count', String(proactiveCount() + 1)); } catch (e) { /* ignore */ }
      }
      let newsCache = null;
      async function fetchNews() {
        if (newsCache) return newsCache;
        try {
          const res = await fetchWithTimeout(NEWS_URL + '?_=' + Date.now(), { cache: 'no-store' }, 3000);
          if (!res.ok) return [];
          const arr = await res.json();
          if (!Array.isArray(arr)) return [];
          const now = Date.now();
          newsCache = arr.filter(n => n && n.id && (n.ja || n.en) && (!n.expires || Date.parse(n.expires) > now));
          return newsCache;
        } catch (e) { return []; }
      }
      async function proactiveSay(text, opts) {
        const bubble = await botSay(text, opts);
        const wrap = bubble && bubble.closest ? bubble.closest('.agent-msg') : null;
        if (wrap) wrap.classList.add('agent-proactive');
        bumpProactiveCount();
        return bubble;
      }
      async function maybeProactive() {
        if (proactiveCount() >= PROACTIVE_MAX_PER_SESSION) return;
        const isJa = State.lang === 'ja';
        const prof = loadProfile();

        // 1) 未読のお知らせ（data/agent-news.json — 日次自己進化が更新するフィード）
        const news = await fetchNews();
        const unread = news.find(n => prof.readNewsIds.indexOf(n.id) === -1);
        if (unread) {
          await proactiveSay('📣 ' + ((isJa ? unread.ja : unread.en) || unread.ja), { delay: 400 });
          if (unread.href) {
            renderChips([{ label: isJa ? '見てみる →' : 'Check it out →', action: () => window.open(unread.href, '_blank', 'noopener') }]);
          }
          prof.readNewsIds = prof.readNewsIds.concat(unread.id).slice(-50);
          saveProfile(prof);
          return;
        }

        // 2) 新着ゲーム検知（前回訪問時に存在しなかったタイトル）
        if (prof.visits > 1 && prof.seenGameSlugs.length > 0) {
          const fresh = GAMES.filter(g => prof.seenGameSlugs.indexOf(g.slug) === -1).slice(0, 2);
          if (fresh.length) {
            await proactiveSay(isJa
              ? '✨ 前回の訪問から新しいゲームが追加されています！'
              : '✨ New games have landed since your last visit!', { delay: 400 });
            renderGameCards(fresh);
            markGamesSeen(prof);
            return;
          }
        }

        // 3) 未プレイのおすすめ（再訪ユーザーのみ・時間帯のひとことつき）
        if (prof.visits > 1) {
          const unplayed = GAMES.filter(g => !prof.playedGames[g.slug]);
          if (unplayed.length) {
            const pick = unplayed.find(g => RECOMMENDS.indexOf(g.slug) !== -1) || unplayed[0];
            const h = new Date().getHours();
            const flavor = isJa
              ? (h >= 21 || h < 5 ? '夜ふかしのおともにどうぞ 🌙' : h < 12 ? '朝のウォームアップにどうぞ ☀️' : 'ひと息つくときにどうぞ ☕')
              : (h >= 21 || h < 5 ? 'Perfect for a late night 🌙' : h < 12 ? 'A quick morning warm-up ☀️' : 'Great for a short break ☕');
            await proactiveSay(isJa
              ? '🎮 まだ遊んでいないおすすめがあります。「' + pick.title.ja + '」— ' + flavor
              : '🎮 One you haven\'t tried yet: ' + (pick.title.en || pick.title.ja) + ' — ' + flavor, { delay: 400 });
            renderGameCards([pick]);
          }
        }
        markGamesSeen(prof);
      }

      // ── FAB未読バッジ（新着お知らせ/新着ゲームがあるとき）────
      function showFabBadge() {
        if (!fab || fab.querySelector('.agent-fab-dot')) return;
        const dot = document.createElement('span');
        dot.className = 'agent-fab-dot';
        dot.setAttribute('aria-hidden', 'true');
        fab.appendChild(dot);
        fab.setAttribute('aria-label', State.lang === 'ja' ? '案内エージェントを開く（新着あり）' : 'Open the guide agent (new updates)');
      }
      function clearFabBadge() {
        const dot = fab && fab.querySelector('.agent-fab-dot');
        if (dot) dot.remove();
      }
      async function checkFabBadge() {
        try {
          const prof = loadProfile();
          const news = await fetchNews();
          const hasUnread = news.some(n => prof.readNewsIds.indexOf(n.id) === -1);
          const hasFresh = prof.visits > 0 && prof.seenGameSlugs.length > 0 && GAMES.some(g => prof.seenGameSlugs.indexOf(g.slug) === -1);
          if (hasUnread || hasFresh) showFabBadge();
        } catch (e) { /* ignore */ }
      }

      async function welcome() {
        const isJa = State.lang === 'ja';
        const h = new Date().getHours();

        // 訪問回数を取得・更新（永続プロファイル）
        const prof = loadProfile();
        prof.visits = (prof.visits || 0) + 1;
        saveProfile(prof);
        const visitCount = prof.visits;

        // 挨拶文を決定
        let greeting;
        if (visitCount > 1) {
          greeting = isJa ? 'おかえりなさい！また来てくれてありがとう 😊' : 'Welcome back! Great to see you again 😊';
        } else if (h >= 5 && h < 12) {
          greeting = isJa ? 'おはようございます！hideのポートフォリオへようこそ 👋' : 'Good morning! Welcome to hide\'s portfolio 👋';
        } else if (h >= 12 && h < 17) {
          greeting = isJa ? 'こんにちは！hideのポートフォリオへようこそ 👋' : 'Good afternoon! Welcome to hide\'s portfolio 👋';
        } else {
          greeting = isJa ? 'こんばんは！hideのポートフォリオへようこそ 👋' : 'Good evening! Welcome to hide\'s portfolio 👋';
        }

        const capabilities = isJa
          ? 'ゲーム紹介・サイト案内・為替や天気の取得ができます。下のチップからどうぞ。'
          : "I can introduce games, navigate the site, and fetch live data. Try a chip below.";

        await botSay(greeting + '\n' + capabilities, { delay: 120 });

        // 前回遊んだゲームのサジェスト（変更5と共用）
        let lastGame = null;
        try { lastGame = JSON.parse(localStorage.getItem('agent-last-game') || 'null'); } catch(e) {}
        if (lastGame && lastGame.title && lastGame.href) {
          const msg = isJa
            ? '前回「' + lastGame.title + '」を見ていましたね。続きはこちら →'
            : 'Last time you checked out "' + lastGame.title + '". Continue here →';
          await botSay(msg, { delay: 500 });
          renderChips([
            { label: (isJa ? '🎮 ' + lastGame.title + 'を開く' : '🎮 Open ' + lastGame.title),
              action: () => { window.open(lastGame.href, '_blank', 'noopener'); } },
            { label: (isJa ? '他のゲームも見る' : 'Browse other games'),
              query: isJa ? 'ゲーム何ある？' : 'What games are here?' }
          ]);
        }

        // 自発的な提案（お知らせ・新着ゲーム・未プレイのおすすめ）
        await maybeProactive();
      }

      // ── Restore history on open ─────────────────────────────
      function restoreHistory() {
        if (!messagesEl) return;
        messagesEl.innerHTML = '';
        for (const m of State.history) {
          if (m.role === 'user') renderMessage('user', m.text);
          else if (m.role === 'agent') {
            const { bubble } = renderMessage('agent', '');
            bubble.textContent = m.text;
          }
        }
      }

      // ── Init ────────────────────────────────────────────────
      function init() {
        fab        = document.getElementById('agent-fab');
        panel      = document.getElementById('agent-panel');
        messagesEl = document.getElementById('agent-messages');
        typingEl   = document.getElementById('agent-typing');
        formEl     = document.getElementById('agent-form');
        inputEl    = document.getElementById('agent-input');
        sendBtn    = formEl ? formEl.querySelector('.agent-send') : null;
        clearBtn   = document.getElementById('agent-clear');
        closeBtn   = document.getElementById('agent-close');
        quickEl    = document.getElementById('agent-quick-actions');
        if (!fab || !panel) return;

        State.lang = (localStorage.getItem('site-lang') || 'ja');
        State.load();

        renderQuickActions();
        restoreHistory();
        checkFabBadge(); // 新着お知らせ/新着ゲームがあればFABに未読ドットを表示

        fab.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
        closeBtn && closeBtn.addEventListener('click', () => setOpen(false));
        clearBtn && clearBtn.addEventListener('click', doClear);

        formEl.addEventListener('submit', e => {
          e.preventDefault();
          const v = inputEl.value.trim();
          if (!v) return;
          inputEl.value = '';
          handleQuery(v);
        });

        // sync with global lang toggle (existing applyLang dispatches site-lang-change in some setups)
        window.addEventListener('site-lang-change', e => {
          const lang = e && e.detail && e.detail.lang;
          if (!lang) return;
          State.lang = lang;
          State.save();
          renderQuickActions();
        });
        // Fallback: poll localStorage periodically (cheap, covers manual lang toggles)
        let lastLang = State.lang;
        setInterval(() => {
          const cur = localStorage.getItem('site-lang') || 'ja';
          if (cur !== lastLang) {
            lastLang = cur;
            State.lang = cur;
            State.save();
            renderQuickActions();
          }
        }, 700);

        // Esc to close
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false);
        });

        // ── 音声出力トグル ──────────────────────────────────────
        const voiceToggleBtn = document.getElementById('agent-voice-toggle');
        if (voiceToggleBtn && window.speechSynthesis) {
          voiceToggleBtn.addEventListener('click', () => {
            voiceEnabled = !voiceEnabled;
            voiceToggleBtn.textContent = voiceEnabled ? '🔊' : '🔇';
            voiceToggleBtn.title = voiceEnabled ? '音声出力オン（クリックでオフ）' : '音声出力オフ（クリックでオン）';
            voiceToggleBtn.classList.toggle('voice-on', voiceEnabled);
            if (!voiceEnabled) window.speechSynthesis.cancel();
          });
        } else if (voiceToggleBtn) {
          voiceToggleBtn.style.opacity = '0.3';
          voiceToggleBtn.title = 'このブラウザは音声合成未対応';
        }

        // ── 声の性別切替 ────────────────────────────────────────
        const genderToggleBtn = document.getElementById('agent-gender-toggle');
        if (genderToggleBtn && window.speechSynthesis) {
          genderToggleBtn.classList.add('gender-active');
          genderToggleBtn.addEventListener('click', () => {
            voiceGender = voiceGender === 'female' ? 'male' : 'female';
            const isFemale = voiceGender === 'female';
            genderToggleBtn.textContent = isFemale ? '♀' : '♂';
            genderToggleBtn.title = isFemale ? '女声（クリックで男声に）' : '男声（クリックで女声に）';
            genderToggleBtn.setAttribute('aria-label', isFemale ? '女声' : '男声');
            genderToggleBtn.classList.toggle('gender-male', !isFemale);
          });
        } else if (genderToggleBtn) {
          genderToggleBtn.style.opacity = '0.3';
        }

        // ── 音声入力（マイク） ──────────────────────────────────
        const micBtn = document.getElementById('agent-mic');
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (micBtn && SR) {
          const rec = new SR();
          rec.continuous = false;
          rec.interimResults = false;
          let listening = false;

          micBtn.addEventListener('click', () => {
            if (listening) { rec.stop(); return; }
            rec.lang = State.lang === 'ja' ? 'ja-JP' : 'en-US';
            rec.start();
          });

          rec.onstart = () => {
            listening = true;
            micBtn.classList.add('listening');
            micBtn.title = '聞いています…（クリックで停止）';
          };

          rec.onresult = e => {
            const last = e.results[e.results.length - 1];
            if (!last.isFinal) return;
            const transcript = last[0].transcript.trim();
            if (transcript) {
              rec.stop();
              inputEl.value = '';
              handleQuery(transcript);
            }
          };

          rec.onerror = () => {
            listening = false;
            micBtn.classList.remove('listening');
            micBtn.title = '音声入力';
          };

          rec.onend = () => {
            listening = false;
            micBtn.classList.remove('listening');
            micBtn.title = '音声入力';
          };
        } else if (micBtn) {
          micBtn.style.opacity = '0.3';
          micBtn.title = 'このブラウザは音声入力未対応';
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
