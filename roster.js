/* 人物台帳: 画像は assets/portraits/<id>.png に個別配置する。 */
const ROSTER_GROUPS = [
  ['幕府・徳川家', ['徳川慶喜','徳川家茂','徳川斉昭','徳川慶勝','松平春嶽','井伊直弼','阿部正弘','堀田正睦','安藤信正','板倉勝静','小栗忠順','勝海舟','大久保一翁','山岡鉄舟','高橋泥舟','榎本武揚','大鳥圭介','小野友五郎','栗本鋤雲','川路聖謨','岩瀬忠震','永井尚志','江川英龍','高島秋帆']],
  ['薩摩藩', ['島津斉彬','島津久光','島津忠義','西郷隆盛','大久保利通','小松帯刀','大山綱良','海江田信義','吉井友実','伊地知正治','野津鎮雄','野津道貫','大山巌','黒田清隆','川村純義','五代友厚','寺島宗則','中村半次郎（桐野利秋）','有村次左衛門','奈良原喜左衛門','奈良原繁','森有礼']],
  ['長州藩', ['毛利敬親','毛利元徳','吉田松陰','木戸孝允（桂小五郎）','高杉晋作','久坂玄瑞','大村益次郎','伊藤博文','山県有朋','井上馨','前原一誠','山田顕義','品川弥二郎','入江九一','寺島忠三郎','吉田稔麿','来島又兵衛','周布政之助','村田清風','椋梨藤太','赤禰武人','白石正一郎']],
  ['土佐藩・海援隊・陸援隊', ['山内容堂','吉田東洋','後藤象二郎','板垣退助','谷干城','佐々木高行','武市半平太','坂本龍馬','中岡慎太郎','岡田以蔵','田中光顕','陸奥宗光','長岡謙吉','沢村惣之丞']],
  ['会津藩', ['松平容保','西郷頼母','田中土佐','神保内蔵助','秋月悌次郎','山川浩','佐川官兵衛','梶原平馬','林権助','萱野権兵衛','山本覚馬','横山主税','中野竹子']],
  ['新選組', ['近藤勇','土方歳三','沖田総司','斎藤一','永倉新八','原田左之助','藤堂平助','山南敬助','井上源三郎','伊東甲子太郎','武田観柳斎','島田魁','市村鉄之助','相馬主計']],
  ['朝廷・公家', ['孝明天皇','明治天皇','岩倉具視','三条実美','中山忠能','中山忠光','姉小路公知','中御門経之','正親町三条実愛','大原重徳','有栖川宮熾仁親王','小松宮彰仁親王']],
  ['水戸藩', ['藤田東湖','武田耕雲斎','戸田忠太夫','会沢正志斎','藤田小四郎','金子孫二郎','関鉄之介','斎藤監物','鯉淵要人']],
  ['越前・福井藩', ['橋本左内','由利公正','中根雪江','横井小楠','三岡八郎']],
  ['肥前佐賀藩', ['鍋島直正','鍋島直大','江藤新平','大木喬任','大隈重信','副島種臣','佐野常民','島義勇','枝吉神陽','石井忠亮']],
  ['熊本藩', ['細川斉護','細川韶邦','細川護久','長岡監物','宮部鼎蔵','河上彦斎']],
  ['長岡藩', ['牧野忠恭','牧野忠訓','河井継之助','山本帯刀','三間市之進']],
  ['庄内藩', ['酒井忠発','酒井忠寛','酒井忠篤','松平権十郎','菅実秀','酒井玄蕃']],
  ['仙台・米沢・奥羽越列藩同盟', ['伊達慶邦','但木土佐','坂英力','玉虫左太夫','上杉斉憲','上杉茂憲','甘糟継成','千坂高雅','色部長門']],
  ['宇和島藩', ['伊達宗城','伊達宗徳','前原巧山']],
  ['紀州・尾張・彦根・桑名', ['徳川茂徳','徳川茂承','井伊直憲','松平定敬','立見尚文']],
  ['蝦夷共和国・箱館戦争', ['松平太郎','荒井郁之助','甲賀源吾','ジュール・ブリュネ','アンドレ・カズヌーヴ']],
  ['女性人物', ['篤姫（天璋院）','和宮親子内親王','幾島','幾松（木戸松子）','楢崎龍（お龍）','千葉佐那','松平照','山本八重']]
];
const EXISTING_PORTRAIT_IDS = { '徳川慶喜':'tokugawa-yoshinobu', '徳川家茂':'tokugawa-iemochi', '井伊直弼':'ii-naosuke', '勝海舟':'katsu-kaishu', '松平春嶽':'matsudaira-shungaku', '榎本武揚':'enomoto-takeaki', '島津斉彬':'shimazu-nariakira', '島津久光':'shimazu-hisamitsu', '小松帯刀':'komatsu-tatewaki', '西郷隆盛':'saigo-takamori', '大久保利通':'okubo-toshimichi', '木戸孝允（桂小五郎）':'kido-takayoshi', '高杉晋作':'takasugi-shinsaku', '大村益次郎':'oomura-masujiro', '伊藤博文':'ito-hirobumi', '山県有朋':'yamagata-aritomo', '坂本龍馬':'sakamoto-ryoma', '武市半平太':'takechi-hanpeita', '松平容保':'matsudaira-katamori', '山川浩':'yamakawa-hiroshi', '土方歳三':'hijikata-toshizo', '近藤勇':'kondo-isami', '沖田総司':'okita-soji', '斎藤一':'saito-hajime', '永倉新八':'nagakura-shinpachi', '岩倉具視':'iwakura-tomomi', '河井継之助':'kawai-tsugunosuke', '松平太郎':'matsudaira-taro', '山本八重':'yamamoto-yaeko', '篤姫（天璋院）':'atsuhime', '鍋島直正':'nabeshima-naomasa', '藤田東湖':'fujita-toko', '横井小楠':'yokoi-shonan', '中野竹子':'nakano-takeko', '和宮親子内親王':'kazunomiya', '山本覚馬':'yamamoto-kakuma', '後藤象二郎':'goto-shojiro', '板垣退助':'itagaki-taisuke', '陸奥宗光':'mutsu-munemitsu', '荒井郁之助':'arai-ikunousuke', 'ジュール・ブリュネ':'jules-brunet', '吉田松陰':'yoshida-shoin', '小栗忠順':'oguri-tadamasa', '江川英龍':'egawa-hidetatsu', '井上馨':'inoue-kaoru', '阿部正弘':'abe-masahiro', '山田顕義':'yamada-akiyoshi', '立見尚文':'tatemi-naofumi', '大鳥圭介':'otori-keisuke', '小野友五郎':'ono-tomogoro', '栗本鋤雲':'kurimoto-joun', '久坂玄瑞':'kusaka-genzui', '大山巌':'oyama-iwao', '五代友厚':'godai-tomoatsu', '牧野忠恭':'makino-tadayoshi', '牧野忠訓':'makino-tadanori', '山本帯刀':'yamamoto-taito', '三間市之進':'mima-ichinoshin', '西郷頼母':'saigo-tanomo', '田中土佐':'tanaka-tosa', '神保内蔵助':'jinbo-kuranosuke', '秋月悌次郎':'akizuki-teijiro', '佐川官兵衛':'sagawa-kanbei', '梶原平馬':'kajiwara-heima' };
const CHARACTER_ASSET_MANIFEST = Object.freeze(ROSTER_GROUPS.flatMap(([faction,names], factionIndex) => names.map((name,index) => {
  const id = EXISTING_PORTRAIT_IDS[name] || `portrait-${String(factionIndex + 1).padStart(2,'0')}-${String(index + 1).padStart(3,'0')}`;
  return Object.freeze({ id, name, faction, portrait: `assets/portraits/${id}.png` });
})));
