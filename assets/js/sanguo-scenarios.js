/* 三国志・天下三分 シナリオ定義 / Scenario setups for "Sanguo: Three Kingdoms Divided".
   sanguo.html より前に classic script として読み込む。
   Loaded as a classic script before sanguo.html's IIFE (ES Modules are not usable under file://).

   配置の正は [[sanguo_基本設計]] 3.4「シナリオ別 勢力配置」の表。全20都市をフル記述する（差分方式は不採用）。
   City ownership is transcribed from the canonical table in the basic design doc; every scenario
   lists all 20 cities explicitly (no diff/patch layering).

   1件の構造 / Shape of one entry:
   {
     id:'red_cliffs', year:208, playable:['wei','shu','wu'],
     victory:{ratio:0.75, hint:'…'},
     gold:{def:600, by:{wei:900}}, food:{def:1200, by:{wei:2000}},
     relations:[['shu','wu','alliance']],
     wildSeed:'red_cliffs', notes:'…',
     cities:{ chang_an:['wei',70,60,['zhong_yao']], … 全20都市を必ず列挙 … }
   }

   cities のタプル / City tuple: [owner, garrison, prosperity, fixedGeneralIds[]]
   generals には「史実上その都市にいなければ嘘になる者」のみを置く。残りは在野プールへ回し
   distributeWild() が決定論的に配分する。
   Only historically load-bearing generals are pinned here; everyone else falls to the wild pool.

   ※ zhang_jiao（張角）/ cao_zhen（曹真）は GENERAL_IDS に未収録。追記すると肖像アトラスの
     インデックス対応が壊れるため、statFor() の決定論フォールバックに任せる。
     Not present in GENERAL_IDS on purpose — statFor() generates their stats deterministically.
*/
window.SANGUO_SCENARIOS = [

  /* ── 184 黄巾の乱 / The Yellow Turban Rebellion ───────────────────────────── */
  {
    id:'yellow_turban',
    year:184,
    playable:['turban','wei','shu','wu','yuan','dong','han'],
    victory:{ratio:0.70, hint:'蒼天已死。天下の七割を制し、乱世の主となれ / Seize 70% of the realm and become master of the age'},
    gold:{def:400, by:{turban:700, dong:600, han:500, yuan:350, wei:300, wu:300, shu:200}},
    food:{def:800, by:{turban:1400, dong:1100, han:1000, yuan:700, wei:600, wu:600, shu:400}},
    // 漢朝討伐連合。序盤10ターンだけ官軍側が休戦する / The loyalist coalition holds for ten turns
    relations:[['han','wei','truce',10],['han','shu','truce',10],['han','wu','truce',10],['han','yuan','truce',10],['han','dong','truce',10]],
    wildSeed:'yellow_turban',
    notes:'D-02: 劉備は史実では無領地だが playable 化のため平原を保持させる。太平道の蜂起地は鄴・宛・江陵・長沙に集約。朝廷直轄・地方太守はすべて han（中立枠）。',
    cities:{
      chang_an:  ['dong',   60, 70, ['dong_zhuo','li_ru']],
      luo_yang:  ['han',    70, 80, ['wang_yun']],
      ye:        ['turban', 90, 55, ['zhang_jiao']],
      ping_yuan: ['shu',    30, 42, ['liu_bei','guan_yu','zhang_fei']],
      xu_chang:  ['wei',    45, 46, ['cao_cao']],
      wan:       ['turban', 70, 56, []],
      han_zhong: ['han',    40, 50, []],
      cheng_du:  ['han',    55, 68, []],
      zi_tong:   ['han',    35, 50, []],
      jiang_zhou:['han',    30, 40, []],
      xiang_yang:['han',    45, 60, []],
      jiang_ling:['turban', 55, 58, []],
      jiang_xia: ['han',    38, 50, []],
      chang_sha: ['turban', 50, 50, []],
      wuchang:   ['han',    35, 52, []],
      jian_ye:   ['han',    40, 55, []],
      he_fei:    ['han',    35, 46, []],
      poyang:    ['han',    28, 40, []],
      kuai_ji:   ['wu',     40, 50, ['sun_jian']],
      liao_dong: ['yuan',   45, 34, ['gongsun_zan']]
    }
  },

  /* ── 190 反董卓連合 / The Coalition against Dong Zhuo ─────────────────────── */
  {
    id:'anti_dong_zhuo',
    year:190,
    playable:['dong','yuan','wei','shu','wu','biao','han'],
    victory:{ratio:0.60, hint:'洛陽の炎を越え、天下の六割を掌握せよ / Rise from the ashes of Luoyang and hold 60% of the realm'},
    gold:{def:500, by:{dong:900, yuan:700, biao:600, wei:450, wu:450, han:400, shu:250}},
    food:{def:1000, by:{dong:1800, yuan:1400, biao:1200, wei:900, wu:900, shu:500}},
    // 反董卓連合 / The anti-Dong coalition
    relations:[['wei','yuan','alliance'],['wei','shu','truce',12],['yuan','shu','truce',12],['yuan','wu','truce',10]],
    wildSeed:'anti_dong_zhuo',
    notes:'D-03: 荊州軍 biao を新設し、襄陽・江陵・江夏・長沙を劉表領へ補正（旧データの董卓領・蜀領は史実乖離）。D-04: 益州の劉焉・漢中の張魯は han に集約。',
    cities:{
      chang_an:  ['dong', 90, 68, ['dong_zhuo','li_ru']],
      luo_yang:  ['dong', 80, 72, ['lu_bu']],
      ye:        ['yuan', 85, 62, ['yuan_shao']],
      ping_yuan: ['shu',  35, 44, ['liu_bei','guan_yu','zhang_fei']],
      xu_chang:  ['wei',  55, 50, ['cao_cao','xun_yu']],
      wan:       ['dong', 60, 56, []],
      han_zhong: ['han',  45, 50, ['zhang_lu']],
      cheng_du:  ['han',  60, 68, []],
      zi_tong:   ['han',  38, 50, []],
      jiang_zhou:['han',  32, 40, []],
      xiang_yang:['biao', 65, 64, ['liu_biao']],
      jiang_ling:['biao', 55, 60, []],
      jiang_xia: ['biao', 45, 52, []],
      chang_sha: ['biao', 45, 52, []],
      wuchang:   ['wu',   45, 54, []],
      jian_ye:   ['wu',   60, 58, ['sun_jian']],
      he_fei:    ['wei',  40, 48, []],
      poyang:    ['wu',   35, 42, []],
      kuai_ji:   ['wu',   45, 50, []],
      liao_dong: ['yuan', 40, 34, ['gongsun_zan']]
    }
  },

  /* ── 198 呂布討伐 / The Campaign against Lu Bu ───────────────────────────── */
  {
    id:'lu_bu_campaign',
    year:198,
    playable:['wei','lubu','yuan','shu','biao','wu'],
    victory:{ratio:0.60, hint:'飛将を討ち、中原の六割を押さえよ / Bring down the Flying General and hold 60% of the realm'},
    gold:{def:500, by:{yuan:900, wei:800, biao:650, wu:550, lubu:350, shu:250}},
    food:{def:1000, by:{yuan:1900, wei:1600, biao:1300, wu:1100, lubu:700, shu:500}},
    // 曹操・劉備の共同討伐 / Cao Cao and Liu Bei jointly besiege Lu Bu
    relations:[['wei','shu','alliance'],['wei','yuan','truce',8]],
    wildSeed:'lu_bu_campaign',
    notes:'D-01: 呂布の本拠を下邳ではなく合肥とする（徐州・淮南の都市が存在しないため）。合肥は許昌・武昌・建業に隣接し四面楚歌を再現できる。D-04: 劉璋・張魯は han に集約。長安の李傕・郭汜残党も han 扱い。',
    cities:{
      chang_an:  ['han',  50, 52, []],
      luo_yang:  ['wei',  55, 50, ['xiahou_dun']],
      ye:        ['yuan', 90, 70, ['yuan_shao','tian_feng']],
      ping_yuan: ['shu',  32, 46, ['liu_bei','guan_yu','zhang_fei']],
      xu_chang:  ['wei',  85, 68, ['cao_cao','guo_jia','xun_yu']],
      wan:       ['wei',  55, 56, ['zhang_xiu']],
      han_zhong: ['han',  48, 52, ['zhang_lu']],
      cheng_du:  ['han',  62, 70, ['liu_zhang']],
      zi_tong:   ['han',  40, 52, []],
      jiang_zhou:['han',  34, 42, []],
      xiang_yang:['biao', 70, 66, ['liu_biao','huang_zhong']],
      jiang_ling:['biao', 58, 62, []],
      jiang_xia: ['biao', 48, 52, []],
      chang_sha: ['biao', 46, 54, []],
      wuchang:   ['wu',   50, 56, []],
      jian_ye:   ['wu',   70, 60, ['sun_ce','zhou_yu']],
      he_fei:    ['lubu', 75, 50, ['lu_bu','chen_gong']],
      poyang:    ['wu',   38, 44, []],
      kuai_ji:   ['wu',   48, 52, []],
      liao_dong: ['yuan', 42, 34, []]
    }
  },

  /* ── 200 官渡の戦い / The Battle of Guandu ───────────────────────────────── */
  {
    id:'guandu',
    year:200,
    playable:['wei','yuan','shu','biao','wu'],
    victory:{ratio:0.65, hint:'黄河の覇権を決し、天下の六割五分を制せよ / Decide the Yellow River and hold 65% of the realm'},
    gold:{def:500, by:{yuan:1100, wei:850, biao:650, wu:600, shu:250}},
    food:{def:1000, by:{yuan:2200, wei:1500, biao:1300, wu:1200, shu:450}},
    // 劉備は袁紹に身を寄せ、孫権は曹操と表面上の和睦 / Liu Bei shelters with Yuan Shao; Sun Quan feigns peace
    relations:[['shu','yuan','alliance'],['wu','wei','truce',8]],
    wildSeed:'guandu',
    notes:'D-04: 益州の劉璋・漢中の張魯・関中の馬騰はすべて han（中立枠）。劉備は史実の汝南に相当する都市が無いため長沙に置く（荊南の客将として扱う）。',
    cities:{
      chang_an:  ['han',  45, 50, ['ma_teng']],
      luo_yang:  ['wei',  55, 54, []],
      ye:        ['yuan', 95, 74, ['yuan_shao','tian_feng','ju_shou']],
      ping_yuan: ['yuan', 60, 46, ['yan_liang','wen_chou']],
      xu_chang:  ['wei',  90, 72, ['cao_cao','guo_jia','xun_yu','xu_chu']],
      wan:       ['wei',  55, 58, []],
      han_zhong: ['han',  50, 52, ['zhang_lu']],
      cheng_du:  ['han',  65, 72, ['liu_zhang']],
      zi_tong:   ['han',  42, 52, []],
      jiang_zhou:['han',  35, 42, []],
      xiang_yang:['biao', 70, 68, ['liu_biao']],
      jiang_ling:['biao', 58, 62, []],
      jiang_xia: ['biao', 50, 54, []],
      chang_sha: ['shu',  35, 52, ['liu_bei','guan_yu','zhang_fei']],
      wuchang:   ['wu',   52, 56, []],
      jian_ye:   ['wu',   75, 62, ['sun_quan','zhou_yu']],
      he_fei:    ['wei',  50, 48, []],
      poyang:    ['wu',   40, 44, []],
      kuai_ji:   ['wu',   50, 52, ['taishi_ci']],
      liao_dong: ['yuan', 45, 34, []]
    }
  },

  /* ── 207 三顧の礼 / Three Visits to the Thatched Hut ─────────────────────── */
  {
    id:'three_visits',
    year:207,
    playable:['wei','biao','shu','wu'],
    victory:{ratio:0.70, hint:'臥龍を得て天下三分の計を成し、七割を掌握せよ / Win the Sleeping Dragon and hold 70% of the realm'},
    gold:{def:550, by:{wei:1000, wu:700, biao:650, han:500, shu:300}},
    food:{def:1100, by:{wei:2000, wu:1400, biao:1300, shu:550}},
    // 劉備は劉表の客将 / Liu Bei serves as Liu Biao's guest-general
    relations:[['shu','biao','alliance']],
    wildSeed:'three_visits',
    notes:'D-03: 荊州は劉表（biao）が襄陽・江陵・江夏を保持。D-04: 益州・漢中・関中は han。劉備の駐屯地は史実の新野に相当する都市が無いため長沙に置き、劉表領に隣接させる。',
    cities:{
      chang_an:  ['han',  50, 55, ['ma_teng','han_sui']],
      luo_yang:  ['wei',  60, 60, []],
      ye:        ['wei',  80, 70, ['cao_pi']],
      ping_yuan: ['wei',  50, 48, []],
      xu_chang:  ['wei',  95, 76, ['cao_cao','sima_yi']],
      wan:       ['wei',  60, 58, []],
      han_zhong: ['han',  52, 54, ['zhang_lu']],
      cheng_du:  ['han',  68, 74, ['liu_zhang']],
      zi_tong:   ['han',  45, 54, []],
      jiang_zhou:['han',  36, 44, []],
      xiang_yang:['biao', 68, 70, ['liu_biao','huang_zhong']],
      jiang_ling:['biao', 58, 64, []],
      jiang_xia: ['biao', 50, 54, []],
      chang_sha: ['shu',  35, 54, ['liu_bei','guan_yu','zhang_fei','zhao_yun','xu_shu']],
      wuchang:   ['wu',   55, 58, []],
      jian_ye:   ['wu',   80, 66, ['sun_quan','zhou_yu','lu_su']],
      he_fei:    ['wei',  55, 50, []],
      poyang:    ['wu',   42, 46, []],
      kuai_ji:   ['wu',   52, 54, []],
      liao_dong: ['wei',  45, 36, []]
    }
  },

  /* ── 208 赤壁の戦い / The Battle of Red Cliffs ───────────────────────────── */
  {
    id:'red_cliffs',
    year:208,
    playable:['wei','shu','wu'],
    victory:{ratio:0.80, hint:'長江を制し、天下の八割を統一せよ / Command the Yangtze and unify 80% of the realm'},
    gold:{def:600, by:{wei:900, wu:700, han:500, shu:350}},
    food:{def:1200, by:{wei:2000, wu:1400, han:900, shu:600}},
    // 孫劉同盟 — 本シナリオの主題 / The Sun-Liu alliance is the premise of this scenario
    relations:[['shu','wu','alliance']],
    wildSeed:'red_cliffs',
    notes:'D-06: 劉備は江夏1都市のみ（史実の夏口）。1都市からの逆転が本シナリオの主題で難易度は★★★。D-04: 荊南（長沙＝韓玄）と益州・漢中は han。曹操は10都市を持つが1都市あたりの兵力は抑え、孫劉同盟で覆せる比率に調整した。',
    cities:{
      chang_an:  ['wei', 55, 58, []],
      luo_yang:  ['wei', 55, 62, []],
      ye:        ['wei', 70, 70, ['cao_pi']],
      ping_yuan: ['wei', 45, 48, []],
      xu_chang:  ['wei', 75, 78, ['xun_yu']],
      wan:       ['wei', 50, 58, []],
      han_zhong: ['han', 52, 54, ['zhang_lu']],
      cheng_du:  ['han', 68, 76, ['liu_zhang']],
      zi_tong:   ['han', 45, 54, []],
      jiang_zhou:['han', 36, 44, []],
      xiang_yang:['wei', 80, 68, ['cao_cao','xiahou_dun','zhang_liao']],
      jiang_ling:['wei', 65, 62, ['cao_ren']],
      jiang_xia: ['shu', 40, 54, ['liu_bei','guan_yu','zhang_fei','zhuge_liang','zhao_yun']],
      chang_sha: ['han', 45, 56, ['huang_zhong']],
      wuchang:   ['wu',  70, 60, ['zhou_yu','huang_gai','gan_ning']],
      jian_ye:   ['wu',  80, 68, ['sun_quan','lu_su']],
      he_fei:    ['wei', 50, 50, []],
      poyang:    ['wu',  45, 46, []],
      kuai_ji:   ['wu',  52, 54, []],
      liao_dong: ['wei', 35, 36, []]
    }
  },

  /* ── 214 益州平定 / The Pacification of Yi Province ──────────────────────── */
  {
    id:'yi_province',
    year:214,
    playable:['wei','shu','wu'],
    victory:{ratio:0.75, hint:'三分の一角を固め、天下の七割五分を制せよ / Secure your third of the realm, then take 75% of it'},
    gold:{def:600, by:{wei:1000, wu:800, shu:600, han:400}},
    food:{def:1200, by:{wei:2200, wu:1600, shu:1300, han:700}},
    // 荊州の帰属をめぐり孫劉同盟は軋む / The Sun-Liu alliance strains over Jing province
    relations:[['shu','wu','truce',12]],
    wildSeed:'yi_province',
    notes:'D-04: 漢中の張魯のみ han として残る（215年に曹操が接収する史実の直前）。荊南は湘水の盟の前段として蜀領（長沙）と呉領（江夏）に分割した。',
    cities:{
      chang_an:  ['wei', 70, 64, ['cao_cao','sima_yi']],
      luo_yang:  ['wei', 62, 66, []],
      ye:        ['wei', 75, 72, ['cao_pi']],
      ping_yuan: ['wei', 48, 50, []],
      xu_chang:  ['wei', 85, 78, []],
      wan:       ['wei', 55, 58, []],
      han_zhong: ['han', 55, 54, ['zhang_lu']],
      cheng_du:  ['shu', 80, 74, ['liu_bei','zhuge_liang','fa_zheng']],
      zi_tong:   ['shu', 55, 54, ['zhang_fei','ma_chao']],
      jiang_zhou:['shu', 42, 46, []],
      xiang_yang:['wei', 72, 68, ['cao_ren']],
      jiang_ling:['shu', 60, 64, ['guan_yu']],
      jiang_xia: ['wu',  50, 56, []],
      chang_sha: ['shu', 45, 56, []],
      wuchang:   ['wu',  60, 60, []],
      jian_ye:   ['wu',  82, 70, ['sun_quan','lu_meng']],
      he_fei:    ['wei', 65, 52, ['zhang_liao']],
      poyang:    ['wu',  45, 48, []],
      kuai_ji:   ['wu',  52, 54, []],
      liao_dong: ['wei', 38, 38, []]
    }
  },

  /* ── 223 五路侵攻 / The Five-Pronged Invasion ────────────────────────────── */
  {
    id:'five_routes',
    year:223,
    playable:['shu','wei','wu','nanman'],
    victory:{ratio:0.75, hint:'五路の兵を退け、天下の七割五分を取り戻せ / Turn back the five armies and reclaim 75% of the realm'},
    gold:{def:600, by:{wei:1100, wu:900, shu:550, nanman:300}},
    food:{def:1200, by:{wei:2400, wu:1800, shu:1100, nanman:600}},
    // 魏が南蛮を唆して五路の一とする。呉とは鄧芝の使いで再同盟が成る前夜
    // Wei incites the Nanman as one of the five routes; the Shu-Wu accord is not yet restored
    relations:[['wei','nanman','alliance'],['shu','wu','truce',8]],
    wildSeed:'five_routes',
    notes:'D-05: 南中に相当する都市が無いため南蛮に江州を割り当てる（成都・梓潼に隣接し蜀の南方脅威として機能する）。劉備没直後の設定のため蜀は3都市のみで最も苦しい立ち上がりになる。',
    cities:{
      chang_an:  ['wei',    78, 68, ['sima_yi','cao_zhen']],
      luo_yang:  ['wei',    70, 70, ['cao_pi']],
      ye:        ['wei',    72, 72, []],
      ping_yuan: ['wei',    48, 50, []],
      xu_chang:  ['wei',    82, 76, []],
      wan:       ['wei',    58, 58, []],
      han_zhong: ['shu',    60, 56, ['wei_yan','ma_dai']],
      cheng_du:  ['shu',    70, 72, ['zhuge_liang','zhao_yun']],
      zi_tong:   ['shu',    45, 54, []],
      jiang_zhou:['nanman', 55, 44, ['meng_huo','lady_zhurong']],
      xiang_yang:['wei',    70, 66, []],
      jiang_ling:['wu',     65, 64, []],
      jiang_xia: ['wu',     52, 56, []],
      chang_sha: ['wu',     48, 56, []],
      wuchang:   ['wu',     68, 62, []],
      jian_ye:   ['wu',     80, 70, ['sun_quan','lu_xun']],
      he_fei:    ['wei',    68, 54, []],
      poyang:    ['wu',     48, 48, []],
      kuai_ji:   ['wu',     55, 56, []],
      liao_dong: ['wei',    40, 38, []]
    }
  }

];
