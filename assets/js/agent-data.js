/* ==========================================================
   hideの案内エージェント — データ定義 (agent-data.js)
   ゲーム一覧・セクション・FAQ知識・intent辞書・チップ表記。
   日次自己進化（/agent-evolve）の編集対象は原則このファイルと
   data/agent-news.json のみ。ロジックは assets/js/agent.js。
   ========================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();           // Node（生成・検査スクリプト用）
  } else {
    root.AGENT_DATA = factory();          // ブラウザ
  }
})(typeof self !== 'undefined' ? self : this, function () {

      // ── Game Registry ────────────────────────────────────────
      const GAMES = [
        { slug:'black-fang', href:'beat_em_up.html', cat:'action', thumb:'assets/black-fang/black-fang-thumb.png',
          title:{ja:'BLACK FANG',en:'BLACK FANG'}, emoji:'👊',
          desc:{ja:'ニューヨークを舞台にしたレトロベルトスクロールアクション。スマホ横向き対応',en:'Retro belt-scroll action set in New York. Mobile landscape play supported'},
          aliases:{ja:['ブラックファング','black fang','ベルトスクロール','横スクロールアクション','ジャック','コタロウ','スマホ','スマートフォン','モバイル'],en:['black fang','beat em up','belt scroll','jack','kotaro','mobile','smartphone']} },
        { slug:'zelda', href:'zelda_like.html', cat:'rpg', thumb:'assets/zelda-like/kenney_roguelike-rpg-pack/Sample1.png',
          title:{ja:'ファーレンクエスト',en:'FAHREN QUEST'}, emoji:'🗡️',
          desc:{ja:'Canvas APIで作ったトップビューRPG',en:'Top-down RPG built with Canvas API'},
          aliases:{ja:['ファーレン','ふぁーれん','rpg','アクションrpg','クエスト'],en:['fahren','quest','rpg']} },
        { slug:'shogi', href:'shogi.html', cat:'board', thumb:'assets/shogi-gpt/shogi-thumb-gpt-image-2.png',
          title:{ja:'AI将棋',en:'AI Shogi'}, emoji:'♟️',
          desc:{ja:'藤井棋風AIと3段階難易度で対局',en:'Play vs Fujii-style AI, 3 difficulties'},
          aliases:{ja:['将棋','しょうぎ','ショウギ'],en:['shogi','japanese chess']} },
        { slug:'chess', href:'chess.html', cat:'board', thumb:'assets/chess-gpt/chess-thumb-gpt-image-2.png',
          title:{ja:'AIチェス',en:'Chess AI'}, emoji:'♔',
          desc:{ja:'キャスリング・アンパッサン対応のチェスAI',en:'Chess AI with castling and en passant'},
          aliases:{ja:['チェス','ちぇす'],en:['chess']} },
        { slug:'mahjong', href:'mahjong.html', cat:'board', thumb:'assets/mahjong-thumb.svg',
          title:{ja:'AI麻雀',en:'AI Mahjong'}, emoji:'🀄',
          desc:{ja:'本格ルール・ロン/ツモ/カン対応',en:'Full rules with ron, tsumo, kan'},
          aliases:{ja:['麻雀','まーじゃん','マージャン'],en:['mahjong']} },
        { slug:'hanafuda', href:'hanafuda.html', cat:'board',
          title:{ja:'AI花札',en:'AI Hanafuda'}, emoji:'🌸',
          desc:{ja:'こいこい形式の花札・役判定あり',en:'Koi-koi style hanafuda with scoring'},
          aliases:{ja:['花札','はなふだ','こいこい'],en:['hanafuda','koi-koi','koikoi']} },
        { slug:'hyakunin-isshu', href:'hyakunin_isshu.html', cat:'board',
          title:{ja:'百人一首かるた',en:'Hyakunin Isshu Karuta'}, emoji:'📜',
          desc:{ja:'100首のかるたゲーム・4難易度',en:'100-poem karuta game, 4 difficulty levels'},
          aliases:{ja:['百人一首','かるた','ひゃくにんいっしゅ','和歌'],en:['karuta','hyakunin','poem','isshu']} },
        { slug:'go', href:'go.html', cat:'board', thumb:'assets/go-gpt/go-thumb-gpt-image-2.png',
          title:{ja:'AI囲碁',en:'AI Go'}, emoji:'⚫',
          desc:{ja:'UCT-MCTS搭載 9路盤/13路盤',en:'UCT-MCTS engine, 9x9 and 13x13'},
          aliases:{ja:['囲碁','いご','ご'],en:['go','baduk','weiqi']} },
        { slug:'othello', href:'othello.html', cat:'board',
          title:{ja:'AIオセロ',en:'Reversi AI'}, emoji:'⚪',
          desc:{ja:'ミニマックスAI搭載のオセロ',en:'Reversi with minimax AI'},
          aliases:{ja:['オセロ','おせろ','リバーシ'],en:['othello','reversi']} },
        { slug:'backgammon', href:'backgammon.html', cat:'board', thumb:'assets/backgammon/backgammon-thumb-gpt-image-2.png',
          title:{ja:'Backgammon AI',en:'Backgammon AI'}, emoji:'🎲',
          desc:{ja:'ボードゲーム × AI対戦',en:'Classic board game vs AI'},
          aliases:{ja:['バックギャモン','ばっくぎゃもん'],en:['backgammon']} },
        { slug:'estate-tycoon', href:'estate-tycoon.html', cat:'board', thumb:'assets/estate-tycoon-gpt/estate-thumb-gpt-image-2.png',
          title:{ja:'街区王 - Block Baron',en:'Block Baron'}, emoji:'🏙️',
          desc:{ja:'東京23区の物件を独占して区を支配する資産すごろく',en:'Monopolize Tokyo wards and control districts'},
          aliases:{ja:['街区王','東京23区','不動産','すごろく','資産ゲーム','区を支配'],en:['block baron','tokyo wards','estate','property','asset board game','board game']} },
        { slug:'ludo', href:'ludo.html', cat:'board', thumb:'assets/ludo/ludo-thumb-gpt-image-2.png',
          title:{ja:'Ludo Neon Dice',en:'Ludo Neon Dice'}, emoji:'🎯',
          desc:{ja:'ルドー盤 × Canvas API',en:'Ludo board built with Canvas API'},
          aliases:{ja:['ルド','ルドー','すごろく'],en:['ludo']} },
        { slug:'chinese-checkers', href:'chinese_checkers.html', cat:'board', thumb:'assets/chinese-checkers/chinese-checkers-board.svg',
          title:{ja:'Chinese Checkers',en:'Chinese Checkers Neon'}, emoji:'🟣',
          desc:{ja:'チャイニーズチェッカー × AI',en:'Chinese checkers with AI'},
          aliases:{ja:['チャイニーズチェッカー','ダイヤモンドゲーム'],en:['chinese checkers','sternhalma']} },
        { slug:'checkers', href:'checkers.html', cat:'board', thumb:'assets/checkers/checkers-thumb.png',
          title:{ja:'Checkers AI',en:'Checkers AI'}, emoji:'⛀',
          desc:{ja:'強制ジャンプ・キング対応のチェッカーAI',en:'Checkers with forced jumps and kings'},
          aliases:{ja:['チェッカー','チェッカーズ','ドラフツ'],en:['checkers','draughts']} },
        { slug:'no-luck-poker', href:'no-luck-poker.html', cat:'board',
          title:{ja:'ノーラックポーカー',en:'No Luck Poker'}, emoji:'♠',
          desc:{ja:'陣取り×ポーカー × AI対戦',en:'Grid strategy meets poker vs AI'},
          aliases:{ja:['ノーラックポーカー','ポーカー','陣取りポーカー'],en:['no luck poker','no-luck-poker','poker']} },
        { slug:'dots-and-boxes', href:'dots-and-boxes.html', cat:'board',
          title:{ja:'ドットアンドボックス',en:'Dots and Boxes'}, emoji:'🟦',
          desc:{ja:'陣取りゲーム × CPU対戦',en:'Territory game vs CPU'},
          aliases:{ja:['ドットアンドボックス','点繋ぎ','陣取り'],en:['dots and boxes','dots-and-boxes']} },
        { slug:'hex', href:'hex.html', cat:'board', thumb:'assets/hex/hex-thumb.png',
          title:{ja:'ヘックス',en:'Hex'}, emoji:'⬡',
          desc:{ja:'六角形マス × ヒント機能',en:'Hexagonal connection game with hints'},
          aliases:{ja:['ヘックス','へっくす'],en:['hex']} },
        { slug:'conhex', href:'conhex.html', cat:'board',
          title:{ja:'ConHex',en:'ConHex'}, emoji:'🔷',
          desc:{ja:'穴・石・セル獲得のボードゲーム',en:'Board game with pegs, holes, and cells'},
          aliases:{ja:['コンヘックス','ConHex'],en:['conhex']} },
        { slug:'indigo', href:'indigo.html', cat:'board',
          title:{ja:'Indigo',en:'Indigo'}, emoji:'💎',
          desc:{ja:'クニツィア設計 × 宝石誘導',en:'Knizia design — guide gems to the edges'},
          aliases:{ja:['インディゴ','indigo'],en:['indigo']} },
        { slug:'carrom', href:'carrom.html', cat:'board',
          title:{ja:'Carrom（キャロム）',en:'Carrom'}, emoji:'🎯',
          desc:{ja:'物理シミュレーション × キャロムAI対戦',en:'Physics-based carrom with AI'},
          aliases:{ja:['キャロム','かろむ','カロム'],en:['carrom','finger billiards']} },
        { slug:'momentum-territory', href:'momentum-territory.html', cat:'action',
          title:{ja:'モーメンタム・テリトリー',en:'Momentum Territory'}, emoji:'⚡',
          desc:{ja:'物理陣取り × 軌跡システム',en:'Physics territory game with trails'},
          aliases:{ja:['モーメンタム','テリトリー','陣取り物理'],en:['momentum','territory']} },
        { slug:'mahjong-solitaire', href:'mahjong-solitaire.html', cat:'puzzle',
          title:{ja:'麻雀ソリティア',en:'Mahjong Solitaire'}, emoji:'🀫',
          desc:{ja:'上海パズル × 144枚',en:'Shanghai-style solitaire with 144 tiles'},
          aliases:{ja:['麻雀ソリティア','上海','じゃんそり'],en:['mahjong solitaire','shanghai']} },
        { slug:'fruit-water', href:'浮き沈みゲーム/fruit-water-game.html', cat:'puzzle',
          title:{ja:'うかぶ？しずむ？',en:'Float or Sink?'}, emoji:'🍎',
          desc:{ja:'物理パズル × ミッションモード',en:'Physics puzzle with mission mode'},
          aliases:{ja:['うかぶ','しずむ','浮き沈み','果物'],en:['float','sink','fruit water']} },
        { slug:'shogi-rpg', href:'shogi_rpg_local.html', cat:'rpg',
          title:{ja:'将棋RPG Enhanced',en:'Shogi RPG Enhanced'}, emoji:'⚔️',
          desc:{ja:'将棋 × RPGの育成・バトル融合',en:'Shogi pieces + RPG leveling and battles'},
          aliases:{ja:['将棋rpg','しょうぎrpg'],en:['shogi rpg','shogirpg']} },
        { slug:'bubble-rescue', href:'bubble_rescue.html', cat:'puzzle',
          title:{ja:'BUBBLE RESCUE CLIMBER',en:'Bubble Rescue Climber'}, emoji:'🫧',
          desc:{ja:'泡割り × 小人誘導パズル',en:'Pop bubbles, guide tiny climbers'},
          aliases:{ja:['バブル','泡','レスキュー'],en:['bubble','rescue','climber']} },
        { slug:'galactic', href:'galactic-assault.html', cat:'action',
          title:{ja:'GALACTIC ASSAULT',en:'Galactic Assault'}, emoji:'🚀',
          desc:{ja:'シューティング × 7ボス × SVGスプライト',en:'Side-scroll shooter, 7 bosses, SVG sprites'},
          aliases:{ja:['シューティング','ギャラクティック','宇宙'],en:['shooter','galactic','space']} },
        { slug:'city', href:'cyber-city.html', cat:'sim',
          title:{ja:'CITY BUILDER',en:'City Builder'}, emoji:'🏙️',
          desc:{ja:'シムシティ風 × 電力管理',en:'SimCity-style with power grid'},
          aliases:{ja:['シティ','街','シムシティ','都市'],en:['city','simcity','builder']} },
        { slug:'trains', href:'train-collection.html', cat:'sim',
          title:{ja:'でんしゃずかんワールド',en:'Train Collection World'}, emoji:'🚆',
          desc:{ja:'ガチャ × 鉄道図鑑 × すごろく旅',en:'Train gacha collection & sugoroku travel'},
          aliases:{ja:['電車','でんしゃ','鉄道','ガチャ','すごろく','コレクション'],en:['train','railway','collection','gacha']} },
        { slug:'card-games', href:'card-games.html', cat:'card', thumb:'assets/images/card-games-thumb.svg',
          title:{ja:'トランプゲーム集',en:'Card Game Collection'}, emoji:'🃏',
          desc:{ja:'7タイトル収録のトランプ集',en:'7 card game titles bundled together'},
          aliases:{ja:['トランプ','カードゲーム','ポーカー'],en:['cards','poker','playing cards']} },
        { slug:'typing', href:'typing_dojo.html', cat:'other',
          title:{ja:'Typing Dojo',en:'Typing Dojo'}, emoji:'⌨️',
          desc:{ja:'タイピング × アーケード演出',en:'Arcade-style typing trainer'},
          aliases:{ja:['タイピング','タイプ'],en:['typing','keyboard','typing dojo']} },
        { slug:'fixer', href:'fixer-of-history.html', cat:'board',
          title:{ja:'影の権力者',en:'Fixer of History'}, emoji:'📜',
          desc:{ja:'ボードゲーム × 歴史シミュレーション',en:'Board game with historical simulation'},
          aliases:{ja:['影の権力者','歴史','フィクサー'],en:['fixer','history','shadow']} },
        { slug:'hyakki', href:'hyakki.html', cat:'action',
          title:{ja:'百鬼演武録',en:'Hyakki Enburok'}, emoji:'⚔️',
          desc:{ja:'和風2D格闘ゲーム。盲目の剣士「月影」vs 鬼化する盗賊「紅蓮」',en:'Japanese-style 2D fighting game — blind swordsman vs demon thief'},
          aliases:{ja:['百鬼演武録','ひゃっき','格闘','格闘ゲーム','月影','紅蓮','2d格闘'],en:['hyakki','fighting','fighter','sword']} },
        { slug:'corridor', href:'corridor.html', cat:'board', thumb:'assets/corridor/corridor-thumb.png',
          title:{ja:'ウォールチェイス',en:'Wall Chase'}, emoji:'🧱',
          desc:{ja:'壁を置いて相手の進路を封鎖する戦略ボードゲーム',en:'Block your opponent\'s path with walls'},
          aliases:{ja:['ウォールチェイス','コリドール','ころりどー','壁','通路','戦略ゲーム'],en:['wall chase','corridor','wall','path','strategy']} },
      ];
      const RECOMMENDS = ['zelda','shogi','mahjong'];

      // ── Section navigation map ───────────────────────────────
      const SECTIONS = {
        top:        { ja:'トップ',           en:'top' },
        local:      { ja:'三郷市のこと',     en:'about Misato' },
        hobby:      { ja:'趣味',             en:'hobbies' },
        pet:        { ja:'ペット紹介',       en:'pet' },
        blog:       { ja:'ブログ',           en:'blog' },
        tools:      { ja:'Claudeツール',     en:'Claude tools' },
        dashboard:  { ja:'ダッシュボード',   en:'dashboard' },
        works:      { ja:'ゲーム一覧',       en:'games' },
        'ai-slides':{ ja:'AI解説スライド',   en:'AI slides' },
        contact:    { ja:'連絡先',           en:'contact' }
      };
      const SECTION_ALIASES = {
        ja: {
          top:['トップ','一番上','最上部','てっぺん'],
          local:['三郷','みさと','地域','地元','埼玉'],
          hobby:['趣味','好きなこと'],
          pet:['ペット','ゆうた','うちのこ'],
          blog:['ブログ','blog','日記'],
          tools:['ツール','claudeツール','claude tools'],
          dashboard:['ダッシュボード','dashboard','ホーム'],
          works:['ゲーム','作品','works','一覧','どんなゲーム','ゲーム何','何があ','ある？','タイトル'],
          'ai-slides':['スライド','ai解説','slides','ai slides','資料'],
          contact:['連絡','contact','メール','問い合わせ','コンタクト']
        },
        en: {
          top:['top','top of page'],
          local:['misato','local','saitama','about misato'],
          hobby:['hobby','hobbies'],
          pet:['pet','yuta'],
          blog:['blog','diary'],
          tools:['tools','claude tools'],
          dashboard:['dashboard','home dashboard'],
          works:['games','works','what games','game list','titles'],
          'ai-slides':['slides','ai slides','deck'],
          contact:['contact','email','reach']
        }
      };

      // ── Knowledge base for FAQ-style answers ─────────────────
      const KB = {
        free: {
          ja:'すべて無料・インストール不要で遊べます ✨\nブラウザでそのままプレイ可能。スマホ・PC両対応です。',
          en:"Everything's free, no install needed ✨\nJust open in your browser — works on mobile and desktop."
        },
        misato: {
          ja:'三郷市は埼玉県の南東端にある街です 🏙️\n東京まで電車で約15〜20分。江戸川と中川に挟まれた水辺の町で、ららぽーとやコストコもあって暮らしやすいです。',
          en:'Misato City sits in the south-east of Saitama Prefecture 🏙️\nAbout 15–20 minutes by train to central Tokyo. A riverside town with LaLaport and Costco nearby — easy to live in.'
        },
        misatoPop: {
          ja:'三郷市の人口は約14万人（2024年）。サイト内の「三郷市のこと」セクションで推移グラフも見られます 📊',
          en:'Misato has a population of around 140,000 (2024). See the trend chart in the Misato section 📊'
        },
        misatoEvents: {
          ja:'三郷市の年間イベントを紹介します 🎉\n直近・今後のものを優先して表示しています。',
          en:"Here's a roundup of Misato City's annual events 🎉\nUpcoming events shown first."
        },
        hobby: {
          ja:'hideの趣味はこちら 😊\n🎮 ゲーム開発（Canvas APIで地道に）\n🤖 AI・Claude活用（毎日使用）\n☕ カフェ巡り\n🐾 ペット（ゆうた）\nゲーム作りがきっかけで Claude を使い始めました。',
          en:"hide's hobbies 😊\n🎮 Game dev (Canvas API)\n🤖 AI & Claude (daily driver)\n☕ Café hopping\n🐾 Pet (Yuta)\nGame-making is what got me into Claude in the first place."
        },
        claude: {
          ja:'ClaudeはAnthropic社が開発するAIです 🤖\nこのサイトのゲームはほぼすべてClaudeとペアプロで作っています。コードレビューや設計の相談に毎日活用中。',
          en:'Claude is an AI built by Anthropic 🤖\nNearly every game on this site was pair-programmed with Claude — code reviews, design chats, daily driver.'
        },
        pet: {
          ja:'ゆうたは hide の大切なペットです 🐾\nプロフィールにも登場。詳細はナイショですが、とても可愛いです 😄',
          en:"Yuta is hide's beloved pet 🐾\nFeatured in the profile. Details are a secret — but very, very cute 😄"
        },
        contact: {
          ja:'お問い合わせは「連絡先」セクションのメールリンクからお気軽にどうぞ ✉️\nGitHubリポジトリも公開しています。',
          en:'Reach out via the email link in the Contact section ✉️\nThe GitHub repo is public too.'
        },
        blog: {
          ja:'ブログでは日々の気づき・開発メモ・失敗談を書いています ✏️\n「ブログ」セクションから読めます。',
          en:'The blog covers daily notes, dev logs, and stories of things going wrong ✏️\nFind it in the Blog section.'
        },
        about: {
          ja:'hide は埼玉県三郷市在住。Claude AI とペアプロしながらブラウザゲーム{GAME_COUNT}本・各種ツールを開発しています。',
          en:'hide lives in Misato, Saitama. Pair-programs with Claude to ship {GAME_COUNT} browser games and assorted tools.'
        },
        greet: {
          ja:'こんにちは！何かお手伝いできることはありますか？',
          en:'Hi there! What can I help you with?'
        },
        thanks: {
          ja:'どういたしまして 🙌 また気軽に聞いてくださいね。',
          en:'You’re welcome! Ask me anything else whenever.'
        }
      };

      // ── Intent dictionary with weighted keywords ─────────────
      const INTENT_DICT = {
        ja: {
          forex:     [['円相場',2.5],['ドル円',2.5],['為替',2.5],['円安',1.5],['円高',1.5],['usd',1.5],['jpy',1.5],['レート',1.5],['相場',1]],
          weather:   [['天気',2.5],['気温',2],['雨',1.2],['暑い',1],['寒い',1],['降',0.8]],
          recommend: [['おすすめ',2.5],['人気',2],['面白い',1.5],['何から',1.5],['一番',1]],
          listGames: [['ゲーム一覧',3],['どんなゲーム',2.5],['全部',1.5],['一覧',1.8],['何がある',2.5],['何がある？',2.5],['ゲーム何',2],['タイトル',1]],
          free:      [['無料',2.5],['お金',2],['課金',2],['インストール',2],['有料',1.5]],
          misato:    [['三郷',2],['みさと',2],['地元',1.5],['埼玉',1.2]],
          misatoPop: [['人口',2.5],['何人',2],['統計',1.5]],
          misatoEvents:[['イベント',2.5],['お祭り',2.5],['祭り',2],['行事',2],['フェスティバル',1.5],['花火',1.8],['獅子舞',2.5],['ハロウィン',2],['七福神',2.5],['イルミネーション',2],['盆踊り',2],['マラソン',2],['さつき',1.5],['菊花',2],['文化祭',2],['産業フェスタ',2.5],['船着場',2.5],['オビジャ',2.5],['大般若',2.5],['里神楽',2.5]],
          hobby:     [['趣味',2.5],['好きなこと',2],['ハマって',1.5]],
          claude:    [['claude',2.5],['クロード',2.5],['anthropic',2],['人工知能',1.5]],
          pet:       [['ペット',2.5],['ゆうた',2.5],['猫',1],['犬',1],['動物',1]],
          contact:   [['連絡',2.5],['問い合わせ',2.5],['メール',2],['contact',2]],
          blog:      [['ブログ',2.5],['blog',2.5],['記事',1.5],['日記',1.5]],
          about:     [['hide',2],['作者',2],['誰',1.5],['プロフィール',2]],
          greet:     [['こんにちは',2.5],['はじめまして',2.5],['やあ',2],['hi',2],['hello',2]],
          thanks:    [['ありがとう',2.5],['thanks',2.5],['助かった',2]],
          clear:     [['リセット',2.5],['履歴',2],['クリア',2],['消して',1.5],['やり直し',2]],
          lang_en:   [['英語で',2.5],['in english',3],['english please',3]],
          lang_ja:   [['日本語で',2.5],['in japanese',3],['にほんごで',2.5]],
          more:      [['もっと',2.5],['他には',2],['他に',1.5],['次',1.5]],
          stock:     [['株価',2.5],['株式',2],['株',1.5],['上場',1.5],['終値',2],['時価',1.5]],
          howto:     [['遊び方',2.5],['あそびかた',2.5],['やり方',2.2],['やりかた',2.2],['操作方法',2.5],['操作',1.5],['ルール',2],['どうやって遊',2.2],['遊べばいい',2]],
          newGames:  [['新作',2.5],['新しいゲーム',2.5],['最近追加',2.5],['最新ゲーム',2.5],['最近のゲーム',2.2],['新着',2.2],['できたばかり',2]],
          catGames:  [['アクションゲーム',2.5],['パズルゲーム',2.5],['ボードゲーム',2.5],['カードゲーム',2.5],['シミュレーションゲーム',2.5],['アクション系',2.2],['パズル系',2.2],['ボード系',2.2],['シミュレーション系',2.2]]
        },
        en: {
          forex:     [['usd',2.5],['jpy',2.5],['usd/jpy',3],['forex',2.5],['exchange',2],['rate',1.5],['yen',1.5]],
          weather:   [['weather',2.5],['temperature',2],['rain',1.5],['forecast',1.5]],
          recommend: [['recommend',2.5],['suggest',2],['best',1.5],['favorite',1.5],['popular',1.5]],
          listGames: [['list games',3],['what games',3],['all games',2.5],['games',1.5],['titles',1.5],['catalog',1.5]],
          free:      [['free',2.5],['paid',2],['install',2],['cost',1.5]],
          misato:    [['misato',2.5],['saitama',1.5],['hometown',1.5]],
          misatoPop: [['population',2.5],['how many people',2.5]],
          misatoEvents:[['event',2.5],['events',2.5],['festival',2.5],['fireworks',2],['matsuri',2.5],['halloween',2],['marathon',2],['illumination',2]],
          hobby:     [['hobby',2.5],['hobbies',2.5],['interest',1.5]],
          claude:    [['claude',2.5],['anthropic',2.5]],
          pet:       [['pet',2.5],['yuta',2.5],['dog',1],['cat',1]],
          contact:   [['contact',2.5],['email',2],['reach',1.5]],
          blog:      [['blog',2.5],['article',1.5]],
          about:     [['about you',2.5],['who are you',2.5],['profile',2],['hide',1.5]],
          greet:     [['hi',2.5],['hello',2.5],['hey',2]],
          thanks:    [['thanks',2.5],['thank you',2.5],['cheers',1.5]],
          clear:     [['reset',2.5],['clear history',3],['clear',1.5],['start over',2]],
          lang_en:   [['in english',3],['english please',3]],
          lang_ja:   [['in japanese',3],['日本語で',2.5]],
          more:      [['more',2.5],['next',2],['others',1.5]],
          stock:     [['stock price',3],['stock',2.5],['share price',2.5],['share',2],['listed',1.5],['quote',1.5]],
          howto:     [['how to play',2.8],['how do i play',2.8],['controls',2.2],['rules',2],['tutorial',2]],
          newGames:  [['new games',2.5],['newest',2.2],['recently added',2.5],['latest game',2.5],["what's new",2.4]],
          catGames:  [['action game',2.5],['puzzle game',2.5],['board game',2.5],['card game',2.5],['simulation game',2.5]]
        }
      };

      const INTENT_CHIP_LABELS = {
        ja: {
          forex:     '💴 ドル円教えて',
          weather:   '☀️ 三郷市の天気',
          listGames: '🎮 ゲーム一覧が見たい',
          recommend: '✨ おすすめゲームは？',
          stock:     '📈 株価を調べる',
          about:     '👤 hideについて教えて',
          blog:      '📝 ブログを見たい',
          hobby:     '🎯 趣味を教えて',
          contact:   '📬 連絡先を知りたい',
          howto:     '🕹️ 遊び方を知りたい',
          newGames:  '🆕 新作ゲームは？',
        },
        en: {
          forex:     '💴 USD/JPY rate',
          weather:   '☀️ Misato weather',
          listGames: '🎮 List all games',
          recommend: '✨ Recommend a game',
          stock:     '📈 Check a stock',
          about:     '👤 About hide',
          blog:      '📝 Read the blog',
          hobby:     '🎯 What are your hobbies?',
          contact:   '📬 How to contact?',
          howto:     '🕹️ How to play',
          newGames:  '🆕 What’s new?',
        }
      };


  return { GAMES, RECOMMENDS, SECTIONS, SECTION_ALIASES, KB, INTENT_DICT, INTENT_CHIP_LABELS };
});
