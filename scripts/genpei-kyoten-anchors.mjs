/*
 * genpei-kyoten-anchors.mjs — 源平争乱記の拠点147のアンカー定義（生成の入力）
 *
 * 詳細設計 第2節のロスターをデータ化したもの。gen-genpei-kyoten.mjs がこれを読み、
 * siro_ichi.csv のアンカー城の画素座標に (dx,dy) を足して kyoten_ichi.csv を書き出す。
 *
 * ★ これは「初回生成のための種」である。生成後の正本は kyoten_ichi.csv。
 *   位置を直したくなったら CSV を編集する（このファイルを直しても上書き生成しない限り効かない）。
 *
 * ★ 地図は絵地図で緯度経度換算と一致しない（九州はx方向に約380pxずれる）。
 *   よって経緯度からは起こさず、必ず近傍の既知の城から局所内挿する。
 *   dx,dy は地図画像(1672x941)の画素。おおよそ 1px ≒ 1.1km。
 */

/* ============================================================
 * シナリオ定義
 * ============================================================ */
export const SCENARIOS = [
  { key: 'S1180',  id: 's1180',  nameJP: '令旨、東国に至る',   start: [1180, 8],  end: [1190, 3] },
  { key: 'S1183',  id: 's1183',  nameJP: '倶利伽羅の落日',     start: [1183, 5],  end: [1190, 3] },
  { key: 'S1184',  id: 's1184',  nameJP: '鵯越、一ノ谷',       start: [1184, 2],  end: [1190, 3] },
  { key: 'S1185A', id: 's1185a', nameJP: '壇ノ浦、潮の変わり目', start: [1185, 2],  end: [1190, 3] },
  { key: 'S1185B', id: 's1185b', nameJP: '判官、都を落つ',     start: [1185, 11], end: [1190, 3] },
  { key: 'SIF',    id: 'sif',    nameJP: 'もし清盛が死なざれば', start: [1181, 3],  end: [1191, 3] },
];

/* ============================================================
 * シナリオ別の国の領有（未列挙の国は中立）
 * 拠点の既定の支配勢力はここから導く。個別の例外は KYOTEN.own で上書きする。
 * ============================================================ */
const KINAI = ['yamashiro', 'yamato', 'kawachi', 'izumi', 'settsu'];
const SANIN = ['tanba', 'tango', 'tajima', 'inaba', 'hoki', 'izumo', 'iwami', 'oki'];
const SANYO = ['harima', 'mimasaka', 'bizen', 'bitchu', 'bingo', 'aki', 'suo', 'nagato'];
const NANKAI = ['kii', 'awaji', 'awa_shikoku', 'sanuki', 'iyo', 'tosa'];
const SAIKAI = ['buzen', 'bungo', 'chikuzen', 'chikugo', 'hizen', 'higo', 'hyuga', 'osumi', 'satsuma'];
const BANDO = ['sagami', 'musashi', 'awa_kanto', 'kazusa', 'shimousa', 'hitachi', 'kozuke', 'shimotsuke'];
const HOKURIKU = ['wakasa', 'echizen', 'kaga', 'noto', 'etchu', 'echigo', 'sado'];
const TOKAI_W = ['iga', 'ise', 'shima', 'owari', 'mikawa'];
const OU = ['mutsu', 'dewa'];

export const PROVINCE_OWNER = {
  // 1180年8月 — 頼朝挙兵の月。奥羽以外は平氏の知行国。源氏は館ひとつから始まる
  S1180: {
    taira: [...KINAI, ...TOKAI_W, ...SANIN, ...SANYO, ...NANKAI, ...SAIKAI, ...BANDO, ...HOKURIKU,
            'totomi', 'suruga', 'izu', 'kai', 'shinano', 'omi', 'mino', 'hida'],
    oshu: OU,
  },
  // 1183年5月 — 義仲が北陸道を制し、頼朝は坂東を固めた
  S1183: {
    taira: [...KINAI, ...TOKAI_W, ...SANIN, ...SANYO, ...NANKAI, ...SAIKAI,
            'omi', 'mino', 'hida', 'wakasa', 'sado'],
    kiso: ['shinano', 'echigo', 'etchu', 'kaga', 'noto', 'echizen', 'kozuke'],
    // 三河・尾張は寿永二年十月宣旨（1183年10月）まで係争中。開始時点では平氏方に置く
    kamakura: ['sagami', 'musashi', 'awa_kanto', 'kazusa', 'shimousa', 'hitachi', 'shimotsuke',
               'izu', 'suruga'],
    kai: ['kai', 'totomi'],
    oshu: OU,
  },
  // 1184年2月 — 義仲は滅び、東国軍が畿内を制した。平氏は西国へ
  S1184: {
    kamakura: [...BANDO, ...HOKURIKU, ...KINAI, 'izu', 'suruga', 'totomi', 'mikawa', 'owari',
               'kai', 'shinano', 'mino', 'hida', 'omi', 'iga', 'ise', 'shima', 'tanba'],
    taira: [...SANYO, ...NANKAI, ...SAIKAI, 'tango', 'tajima', 'inaba', 'hoki', 'izumo', 'iwami', 'oki'],
    oshu: OU,
  },
  // 1185年2月 — 屋島から壇ノ浦へ。平氏の版図は瀬戸内と九州北部のみ
  S1185A: {
    kamakura: [...BANDO, ...HOKURIKU, ...KINAI, ...TOKAI_W, ...SANIN,
               'izu', 'suruga', 'totomi', 'kai', 'shinano', 'mino', 'hida', 'omi',
               'harima', 'mimasaka', 'bizen', 'bitchu', 'bingo', 'kii', 'awaji', 'tosa'],
    taira: ['aki', 'suo', 'nagato', 'sanuki', 'awa_shikoku', 'iyo',
            'buzen', 'chikuzen', 'chikugo', 'hizen'],
    oshu: OU,
  },
  // 1185年11月 — 平氏は滅び、義経に院宣が下る。実力基盤を持たない義経の逃避行
  S1185B: {
    kamakura: [...BANDO, ...HOKURIKU, ...KINAI, ...TOKAI_W, ...SANIN, ...SANYO, ...NANKAI, ...SAIKAI,
               'izu', 'suruga', 'totomi', 'kai', 'shinano', 'mino', 'hida', 'omi'],
    oshu: OU,
  },
  // IF: 清盛存命（1181年3月）— 平氏の統制が保たれたまま長期戦へ
  SIF: {
    taira: [...KINAI, ...TOKAI_W, ...SANIN, ...SANYO, ...NANKAI, ...SAIKAI, ...HOKURIKU,
            'totomi', 'omi', 'mino', 'hida'],
    kamakura: ['sagami', 'musashi', 'awa_kanto', 'kazusa', 'shimousa', 'hitachi', 'shimotsuke',
               'izu', 'suruga'],
    kiso: ['shinano', 'kozuke'],
    kai: ['kai'],
    oshu: OU,
  },
};

/* ============================================================
 * 国衙66 — [アンカー城, dx, dy]
 * 国府の比定地は『延喜式』『和名類聚抄』による。dx,dy は地図画素。
 * ============================================================ */
export const KOKUGA_ANCHOR = {
  // 畿内
  yamashiro: ['二条御所', -4, 8],  yamato: ['多聞山城', 4, 6],  kawachi: ['高屋城', -5, 4],
  izumi: ['岸和田城', 3, 5],       settsu: ['石山御坊', -6, 3],
  // 東海道
  iga: ['伊賀上野城', 3, 4],       ise: ['霧山城', 8, 6],       shima: ['鳥羽城', 4, 4],
  owari: ['清洲城', -5, 6],        mikawa: ['岡崎城', 4, 5],    totomi: ['曳馬城', -4, 5],
  suruga: ['駿府館', 4, 4],        izu: ['伊豆韮山城', 4, 8],   kai: ['躑躅ヶ崎館', 5, 6],
  sagami: ['小机城', -25, 5],      musashi: ['江戸城', -22, 0], awa_kanto: ['館山城', 5, 5],
  kazusa: ['真里谷城', 6, 6],      shimousa: ['関宿城', 8, 32], hitachi: ['府中城', 0, 0],
  // 東山道
  omi: ['観音寺城', -28, 12],      mino: ['稲葉山城', -5, 5],   hida: ['松倉城', 4, 5],
  shinano: ['深志城', 0, 0],       kozuke: ['箕輪城', 6, 5],    shimotsuke: ['唐沢山城', -8, 2],
  mutsu: ['岩出山城', 14, 30],     dewa: ['大宝寺城', 4, -20],
  // 北陸道
  wakasa: ['後瀬山城', 4, 5],      echizen: ['一乗谷城', -5, 4], kaga: ['尾山御坊', 5, 5],
  noto: ['七尾城', -5, 5],         etchu: ['富山城', 5, 5],     echigo: ['春日山城', 5, 5],
  sado: ['雑太城', 4, 4],
  // 山陰道
  tanba: ['丹波亀山城', -5, 5],    tango: ['弓木城', 4, 5],     tajima: ['此隅山城', 5, 5],
  inaba: ['鳥取城', -4, 6],        hoki: ['羽衣石城', -6, 5],   izumo: ['月山富田城', -8, 4],
  iwami: ['山吹城', 5, 5],         oki: ['月山富田城', -10, -55],
  // 山陽道
  harima: ['姫路城', 5, 6],        mimasaka: ['津山城', 4, 5],  bizen: ['岡山城', 5, 5],
  bitchu: ['備中高松城', -5, 5],   bingo: ['神辺城', 4, 5],     aki: ['吉田郡山城', 5, 28],
  suo: ['山口館', 5, 6],           nagato: ['櫛崎城', 5, -6],
  // 南海道
  kii: ['雑賀城', 5, 6],           awaji: ['洲本城', -5, 4],    awa_shikoku: ['勝瑞城', 5, 5],
  sanuki: ['十河城', -6, 4],       iyo: ['湯築城', 5, 5],       tosa: ['岡豊城', 5, 5],
  // 西海道
  buzen: ['小倉城', 6, 22],        bungo: ['府内館', 0, 0],     chikuzen: ['立花山城', -3, 18],
  chikugo: ['柳川城', 5, -5],      hizen: ['佐賀城', 5, 5],     higo: ['隈本城', 5, 5],
  hyuga: ['佐土原城', 5, 5],       osumi: ['肝付城', 5, 5],     satsuma: ['内城', 5, 5],
};

/* ============================================================
 * 荘園40 — holder: jisha(寺社) / sekkanke(摂関家) / kuge(公家) / buke(武家)
 * jisha・sekkanke の荘園を接収すると名分が下がる（基本設計 4.1）。
 * ============================================================ */
export const SHOEN = [
  ['shoen_kamakura_mikuriya', '鎌倉御厨',   'Kamakura Estate',      'sagami',   'jisha',    '小机城',      -8, 14, 45],
  ['shoen_oba_mikuriya',      '大庭御厨',   'Oba Estate',           'sagami',   'jisha',    '小田原城',     18, 6, 55],
  ['shoen_miura',             '三浦荘',     'Miura Estate',         'sagami',   'buke',     '小机城',       8, 20, 50],
  ['shoen_chichibu',          '秩父牧',     'Chichibu Pasture',     'musashi',  'buke',     '鉢形城',      -6, 8, 40],
  ['shoen_kodama',            '児玉荘',     'Kodama Estate',        'musashi',  'buke',     '鉢形城',      10, -6, 35],
  ['shoen_soma_mikuriya',     '相馬御厨',   'Soma Estate',          'shimousa', 'jisha',    '関宿城',      14, 10, 45],
  ['shoen_chiba',             '千葉荘',     'Chiba Estate',         'shimousa', 'buke',     '佐倉城',      -8, 8, 55],
  ['shoen_satake',            '佐竹荘',     'Satake Estate',        'hitachi',  'buke',     '太田城',       6, 6, 50],
  ['shoen_nasu',              '那須荘',     'Nasu Estate',          'shimotsuke','buke',    '烏山城',       6, -8, 35],
  ['shoen_nitta',             '新田荘',     'Nitta Estate',         'kozuke',   'buke',     '新田金山城',    6, 6, 45],
  ['shoen_ashikaga',          '足利荘',     'Ashikaga Estate',      'shimotsuke','buke',    '唐沢山城',     12, -8, 40],
  ['shoen_ichijo',            '一条荘',     'Ichijo Estate',        'kai',      'buke',     '躑躅ヶ崎館',   -8, 10, 35],
  ['shoen_shioda',            '塩田荘',     'Shioda Estate',        'shinano',  'sekkanke', '上原城',       8, 6, 40],
  ['shoen_kanbara',           '蒲原荘',     'Kanbara Estate',       'suruga',   'kuge',     '蒲原城',       6, 6, 35],
  ['shoen_fuji_omiya',        '富士大宮',   'Fuji Grand Shrine',    'suruga',   'jisha',    '蒲原城',      -8, -8, 30],
  ['shoen_kawai',             '河合荘',     'Kawai Estate',         'echizen',  'jisha',    '一乗谷城',     10, -8, 40],
  ['shoen_kuratsuki',         '倉月荘',     'Kuratsuki Estate',     'kaga',     'sekkanke', '尾山御坊',    -8, 8, 35],
  ['shoen_hakusan',           '白山宮領',   'Hakusan Shrine Land',  'kaga',     'jisha',    '大聖寺城',     10, -8, 40],
  ['shoen_byodoin',           '平等院領',   'Byodoin Estate',       'yamashiro','sekkanke', '二条御所',     6, 18, 45],
  ['shoen_tobadono',          '鳥羽殿領',   'Toba Palace Estate',   'yamashiro','kuge',     '勝龍寺城',     8, -8, 40],
  ['shoen_iwashimizu',        '石清水八幡宮領','Iwashimizu Shrine', 'yamashiro','jisha',    '勝龍寺城',    -6, 12, 45],
  ['shoen_kasuga',            '春日社領',   'Kasuga Shrine Land',   'yamato',   'jisha',    '多聞山城',    -8, -6, 55],
  ['shoen_kuroda',            '黒田荘',     'Kuroda Estate',        'yamato',   'jisha',    '多聞山城',     14, 10, 45],
  ['shoen_oyama',             '大山荘',     'Oyama Estate',         'tanba',    'jisha',    '八上城',       6, 6, 40],
  ['shoen_koyasan',           '高野山領',   'Mt. Koya Estate',      'kii',      'jisha',    '新宮城',     -22, -8, 55],
  ['shoen_kumano',            '熊野三山領', 'Kumano Shrine Land',   'kii',      'jisha',    '新宮城',       6, 8, 60],
  ['shoen_ota',               '大田荘',     'Ota Estate',           'bingo',    'jisha',    '神辺城',      -8, -12, 45],
  ['shoen_itsukushima',       '厳島社領',   'Itsukushima Shrine',   'aki',      'jisha',    '吉田郡山城',   -8, 34, 60],
  ['shoen_yuge',              '弓削島荘',   'Yuge Island Estate',   'iyo',      'jisha',    '川之江城',    -8, 6, 30],
  ['shoen_oe',                '麻植荘',     'Oe Estate',            'awa_shikoku','buke',   '勝瑞城',     -14, 6, 40],
  ['shoen_yashima',           '屋島荘',     'Yashima Estate',       'sanuki',   'jisha',    '十河城',       6, -8, 35],
  ['shoen_kanzaki',           '神埼荘',     'Kanzaki Estate',       'hizen',    'buke',     '佐賀城',      10, -8, 60],
  ['shoen_usa',               '宇佐宮領',   'Usa Shrine Land',      'buzen',    'jisha',    '城井谷城',     6, 6, 55],
  ['shoen_ogata',             '緒方荘',     'Ogata Estate',         'bungo',    'buke',     '府内館',     -12, 8, 45],
  ['shoen_aso',               '阿蘇社領',   'Aso Shrine Land',      'higo',     'jisha',    '岩尾城',       6, 6, 50],
  ['shoen_shimazu',           '島津荘',     'Shimazu Estate',       'hyuga',    'sekkanke', '佐土原城',   -12, 10, 90],
  ['shoen_hiraizumi',         '平泉領',     'Hiraizumi Estate',     'mutsu',    'buke',     '高水寺城',    -8, 8, 80],
  ['shoen_kesen',             '気仙荘',     'Kesen Estate',         'mutsu',    'buke',     '寺池城',       8, -10, 45],
  ['shoen_shirakawa',         '白河荘',     'Shirakawa Estate',     'mutsu',    'buke',     '白河城',       6, 6, 40],
  ['shoen_yusa',              '遊佐荘',     'Yusa Estate',          'dewa',     'buke',     '大宝寺城',    -8, -12, 40],
];

/* ============================================================
 * 館・城郭25 — scale は収容兵力の上限
 * own: シナリオ別の支配勢力の上書き（国の領有より優先）
 * ============================================================ */
export const TACHI = [
  ['tachi_kamakura',   '鎌倉大倉御所', 'Kamakura Palace',    'sagami',   '小机城',      -14, 22, 3000, 45,
    { S1183: 'kamakura', S1184: 'kamakura', S1185A: 'kamakura', S1185B: 'kamakura', SIF: 'kamakura' }],
  ['tachi_kinugasa',   '衣笠城',       'Kinugasa Fort',      'sagami',   '小机城',       -4, 30, 800, 35, {}],
  ['tachi_ishibashi',  '石橋山',       'Ishibashiyama',      'sagami',   '小田原城',      8, 16, 400, 25, {}],
  ['tachi_oba',        '大庭館',       'Oba Residence',      'sagami',   '小田原城',     26, 12, 900, 30, {}],
  ['tachi_yamaki',     '山木館',       'Yamaki Residence',   'izu',      '伊豆韮山城',   10, -6, 300, 20, {}],
  ['tachi_hojo',       '北条館',       'Hojo Residence',     'izu',      '伊豆韮山城',   -8, -4, 500, 25,
    { S1180: 'kamakura', S1183: 'kamakura', S1184: 'kamakura', S1185A: 'kamakura', S1185B: 'kamakura', SIF: 'kamakura' }],
  ['tachi_chiba',      '千葉館',       'Chiba Residence',    'shimousa', '佐倉城',       10, -8, 1200, 30, {}],
  ['tachi_kazusa',     '上総一宮館',   'Kazusa Ichinomiya',  'kazusa',   '真里谷城',     -8, 12, 2000, 30, {}],
  ['tachi_kanasa',     '金砂城',       'Kanasa Fort',        'hitachi',  '太田城',       -8, -8, 1000, 40, {}],
  ['tachi_nitta',      '新田館',       'Nitta Residence',    'kozuke',   '新田金山城',   -8, -6, 800, 28, {}],
  ['tachi_takeda',     '武田館',       'Takeda Residence',   'kai',      '躑躅ヶ崎館',    8, -6, 1500, 35,
    { S1180: 'kai', S1183: 'kai', SIF: 'kai' }],
  ['tachi_yoda',       '依田城',       'Yoda Fort',          'shinano',  '上原城',       -8, -8, 700, 30,
    { S1180: 'kiso', S1183: 'kiso', SIF: 'kiso' }],
  ['tachi_kiso',       '木曽館',       'Kiso Residence',     'shinano',  '木曽福島城',    6, 6, 600, 25,
    { S1180: 'kiso', S1183: 'kiso', SIF: 'kiso' }],
  ['tachi_jo',         '城氏館',       'Jo Residence',       'echigo',   '春日山城',     -8, -10, 1200, 32, {}],
  ['tachi_kurikara',   '倶利伽羅陣',   'Kurikara Camp',      'etchu',    '富山城',      -14, 8, 1000, 30, {}],
  ['tachi_rokuhara',   '六波羅館',     'Rokuhara Palace',    'yamashiro','二条御所',      8, 6, 4000, 55,
    { S1185B: 'yoshitsune' }],
  ['tachi_byodoin',    '宇治平等院',   'Byodoin Temple',     'yamashiro','二条御所',     12, 22, 600, 30, {}],
  ['tachi_hojuji',     '法住寺殿',     'Hojuji Palace',      'yamashiro','二条御所',     -8, 14, 800, 28,
    { S1180: 'goshirakawa', S1183: 'goshirakawa', S1184: 'goshirakawa', S1185A: 'goshirakawa',
      S1185B: 'goshirakawa', SIF: 'goshirakawa' }],
  ['tachi_fukuhara',   '福原京',       'Fukuhara Capital',   'settsu',   '有岡城',        8, 22, 3500, 45, {}],
  ['tachi_ichinotani', '一ノ谷城郭',   'Ichinotani Fort',    'settsu',   '有岡城',       -6, 28, 2500, 42, {}],
  ['tachi_yashima',    '屋島陣',       'Yashima Camp',       'sanuki',   '十河城',       -8, -14, 2000, 38, {}],
  ['tachi_hikoshima',  '彦島',         'Hikoshima',          'nagato',   '櫛崎城',       -8, 6, 1800, 35, {}],
  ['tachi_dazaifu',    '太宰府',       'Dazaifu',            'chikuzen', '立花山城',      6, 14, 1500, 40, {}],
  ['tachi_hiraizumi',  '柳之御所',     'Yanaginogosho',      'mutsu',    '高水寺城',      8, -6, 3000, 50,
    { S1180: 'oshu', S1183: 'oshu', S1184: 'oshu', S1185A: 'oshu', S1185B: 'oshu', SIF: 'oshu' }],
  ['tachi_koromogawa', '衣川館',       'Koromogawa',         'mutsu',    '花巻城',       -8, -14, 400, 22,
    { S1180: 'oshu', S1183: 'oshu', S1184: 'oshu', S1185A: 'oshu', S1185B: 'oshu', SIF: 'oshu' }],
];

/* ============================================================
 * 湊16 — scale は船数。suigun は既定で結びつく水軍勢力
 * ============================================================ */
// riverPort: true は河港。「半径内に海があること」の検査から外す（淀津は淀川の湊）
export const MINATO = [
  ['minato_watanabe',  '渡辺津',   'Watanabe Harbor',  'settsu',   '石山御坊',   8, 10, 40, null],
  ['minato_owada',     '大輪田泊', 'Owada Harbor',     'settsu',   '有岡城',    14, 26, 60, null],
  ['minato_yodo',      '淀津',     'Yodo Harbor',      'yamashiro','勝龍寺城',   6, 6, 25, null, true],
  ['minato_atsuta',    '熱田湊',   'Atsuta Harbor',    'owari',    '鳴海城',    -6, 8, 30, null],
  ['minato_kuwana',    '桑名湊',   'Kuwana Harbor',    'ise',      '長島城',     8, -6, 25, null],
  ['minato_shinagawa', '品川湊',   'Shinagawa Harbor', 'musashi',  '江戸城',     4, 14, 20, null],
  ['minato_miura',     '三浦湊',   'Miura Harbor',     'sagami',   '小机城',    14, 28, 30, null],
  ['minato_naoetsu',   '直江津',   'Naoetsu Harbor',   'echigo',   '春日山城',  -8, 12, 20, null],
  ['minato_tsuruga',   '敦賀津',   'Tsuruga Harbor',   'echizen',  '金ケ崎城',   6, 8, 30, null],
  ['minato_mikuni',    '三国湊',   'Mikuni Harbor',    'echizen',  '一乗谷城', -18, -12, 25, null],
  ['minato_shingu',    '新宮湊',   'Shingu Harbor',    'kii',      '新宮城',    14, 6, 45, 'suigun_kumano'],
  ['minato_muya',      '撫養湊',   'Muya Harbor',      'awa_shikoku','勝瑞城',  12, -10, 50, 'suigun_awa'],
  ['minato_yashima',   '屋島湊',   'Yashima Harbor',   'sanuki',   '十河城',     6, -20, 35, null],
  ['minato_mitsuhama', '三津浜',   'Mitsuhama Harbor', 'iyo',      '湯築城',   -12, 6, 45, 'suigun_kono'],
  ['minato_ushimado',  '牛窓',     'Ushimado Harbor',  'bizen',    '岡山城',    18, 12, 25, null],
  ['minato_hakata',    '博多津',   'Hakata Harbor',    'chikuzen', '立花山城',  -8, 6, 40, 'suigun_matsura'],
];
