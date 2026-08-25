package com.hide.intlcallblocker.core

/**
 * E.164 国番号テーブル / ITU-T E.164 country calling codes.
 *
 * 遮断の判定そのものには使わない（判定は「自国の国番号で始まるか」だけで足りる）。
 * ブロックログに「どこからの着信だったか」を出すための表示用データ。
 *
 * E.164 の国番号は接頭辞符号（prefix-free code）なので、最長一致で一意に決まる。
 */
object CountryCodes {

    /** 国番号 → 日本語名 / English name */
    private val TABLE: Map<String, Pair<String, String>> = buildMap {
        fun p(code: String, ja: String, en: String) = put(code, ja to en)

        p("1", "アメリカ・カナダ", "USA / Canada")
        p("7", "ロシア・カザフスタン", "Russia / Kazakhstan")

        // --- Zone 2: アフリカ ---
        p("20", "エジプト", "Egypt"); p("27", "南アフリカ", "South Africa")
        p("211", "南スーダン", "South Sudan"); p("212", "モロッコ", "Morocco")
        p("213", "アルジェリア", "Algeria"); p("216", "チュニジア", "Tunisia")
        p("218", "リビア", "Libya"); p("220", "ガンビア", "Gambia")
        p("221", "セネガル", "Senegal"); p("222", "モーリタニア", "Mauritania")
        p("223", "マリ", "Mali"); p("224", "ギニア", "Guinea")
        p("225", "コートジボワール", "Côte d'Ivoire"); p("226", "ブルキナファソ", "Burkina Faso")
        p("227", "ニジェール", "Niger"); p("228", "トーゴ", "Togo")
        p("229", "ベナン", "Benin"); p("230", "モーリシャス", "Mauritius")
        p("231", "リベリア", "Liberia"); p("232", "シエラレオネ", "Sierra Leone")
        p("233", "ガーナ", "Ghana"); p("234", "ナイジェリア", "Nigeria")
        p("235", "チャド", "Chad"); p("236", "中央アフリカ", "Central African Rep.")
        p("237", "カメルーン", "Cameroon"); p("238", "カーボベルデ", "Cape Verde")
        p("239", "サントメ・プリンシペ", "São Tomé and Príncipe")
        p("240", "赤道ギニア", "Equatorial Guinea"); p("241", "ガボン", "Gabon")
        p("242", "コンゴ共和国", "Congo"); p("243", "コンゴ民主共和国", "DR Congo")
        p("244", "アンゴラ", "Angola"); p("245", "ギニアビサウ", "Guinea-Bissau")
        p("246", "ディエゴガルシア", "Diego Garcia"); p("247", "アセンション島", "Ascension")
        p("248", "セーシェル", "Seychelles"); p("249", "スーダン", "Sudan")
        p("250", "ルワンダ", "Rwanda"); p("251", "エチオピア", "Ethiopia")
        p("252", "ソマリア", "Somalia"); p("253", "ジブチ", "Djibouti")
        p("254", "ケニア", "Kenya"); p("255", "タンザニア", "Tanzania")
        p("256", "ウガンダ", "Uganda"); p("257", "ブルンジ", "Burundi")
        p("258", "モザンビーク", "Mozambique"); p("260", "ザンビア", "Zambia")
        p("261", "マダガスカル", "Madagascar"); p("262", "レユニオン・マヨット", "Réunion / Mayotte")
        p("263", "ジンバブエ", "Zimbabwe"); p("264", "ナミビア", "Namibia")
        p("265", "マラウイ", "Malawi"); p("266", "レソト", "Lesotho")
        p("267", "ボツワナ", "Botswana"); p("268", "エスワティニ", "Eswatini")
        p("269", "コモロ", "Comoros"); p("290", "セントヘレナ", "Saint Helena")
        p("291", "エリトリア", "Eritrea"); p("297", "アルバ", "Aruba")
        p("298", "フェロー諸島", "Faroe Islands"); p("299", "グリーンランド", "Greenland")

        // --- Zone 3/4: ヨーロッパ ---
        p("30", "ギリシャ", "Greece"); p("31", "オランダ", "Netherlands")
        p("32", "ベルギー", "Belgium"); p("33", "フランス", "France")
        p("34", "スペイン", "Spain"); p("36", "ハンガリー", "Hungary")
        p("39", "イタリア", "Italy"); p("40", "ルーマニア", "Romania")
        p("41", "スイス", "Switzerland"); p("43", "オーストリア", "Austria")
        p("44", "イギリス", "United Kingdom"); p("45", "デンマーク", "Denmark")
        p("46", "スウェーデン", "Sweden"); p("47", "ノルウェー", "Norway")
        p("48", "ポーランド", "Poland"); p("49", "ドイツ", "Germany")
        p("350", "ジブラルタル", "Gibraltar"); p("351", "ポルトガル", "Portugal")
        p("352", "ルクセンブルク", "Luxembourg"); p("353", "アイルランド", "Ireland")
        p("354", "アイスランド", "Iceland"); p("355", "アルバニア", "Albania")
        p("356", "マルタ", "Malta"); p("357", "キプロス", "Cyprus")
        p("358", "フィンランド", "Finland"); p("359", "ブルガリア", "Bulgaria")
        p("370", "リトアニア", "Lithuania"); p("371", "ラトビア", "Latvia")
        p("372", "エストニア", "Estonia"); p("373", "モルドバ", "Moldova")
        p("374", "アルメニア", "Armenia"); p("375", "ベラルーシ", "Belarus")
        p("376", "アンドラ", "Andorra"); p("377", "モナコ", "Monaco")
        p("378", "サンマリノ", "San Marino"); p("379", "バチカン", "Vatican City")
        p("380", "ウクライナ", "Ukraine"); p("381", "セルビア", "Serbia")
        p("382", "モンテネグロ", "Montenegro"); p("383", "コソボ", "Kosovo")
        p("385", "クロアチア", "Croatia"); p("386", "スロベニア", "Slovenia")
        p("387", "ボスニア・ヘルツェゴビナ", "Bosnia and Herzegovina")
        p("389", "北マケドニア", "North Macedonia")
        p("420", "チェコ", "Czechia"); p("421", "スロバキア", "Slovakia")
        p("423", "リヒテンシュタイン", "Liechtenstein")

        // --- Zone 5: 中南米 ---
        p("51", "ペルー", "Peru"); p("52", "メキシコ", "Mexico")
        p("53", "キューバ", "Cuba"); p("54", "アルゼンチン", "Argentina")
        p("55", "ブラジル", "Brazil"); p("56", "チリ", "Chile")
        p("57", "コロンビア", "Colombia"); p("58", "ベネズエラ", "Venezuela")
        p("500", "フォークランド諸島", "Falkland Islands"); p("501", "ベリーズ", "Belize")
        p("502", "グアテマラ", "Guatemala"); p("503", "エルサルバドル", "El Salvador")
        p("504", "ホンジュラス", "Honduras"); p("505", "ニカラグア", "Nicaragua")
        p("506", "コスタリカ", "Costa Rica"); p("507", "パナマ", "Panama")
        p("508", "サンピエール島・ミクロン島", "Saint Pierre and Miquelon")
        p("509", "ハイチ", "Haiti"); p("590", "グアドループ", "Guadeloupe")
        p("591", "ボリビア", "Bolivia"); p("592", "ガイアナ", "Guyana")
        p("593", "エクアドル", "Ecuador"); p("594", "仏領ギアナ", "French Guiana")
        p("595", "パラグアイ", "Paraguay"); p("596", "マルティニーク", "Martinique")
        p("597", "スリナム", "Suriname"); p("598", "ウルグアイ", "Uruguay")
        p("599", "キュラソー・カリブ蘭領", "Curaçao / Caribbean Netherlands")

        // --- Zone 6: 東南アジア・オセアニア ---
        p("60", "マレーシア", "Malaysia"); p("61", "オーストラリア", "Australia")
        p("62", "インドネシア", "Indonesia"); p("63", "フィリピン", "Philippines")
        p("64", "ニュージーランド", "New Zealand"); p("65", "シンガポール", "Singapore")
        p("66", "タイ", "Thailand"); p("670", "東ティモール", "Timor-Leste")
        p("672", "ノーフォーク島・南極", "Norfolk Island / Antarctica")
        p("673", "ブルネイ", "Brunei"); p("674", "ナウル", "Nauru")
        p("675", "パプアニューギニア", "Papua New Guinea"); p("676", "トンガ", "Tonga")
        p("677", "ソロモン諸島", "Solomon Islands"); p("678", "バヌアツ", "Vanuatu")
        p("679", "フィジー", "Fiji"); p("680", "パラオ", "Palau")
        p("681", "ウォリス・フツナ", "Wallis and Futuna"); p("682", "クック諸島", "Cook Islands")
        p("683", "ニウエ", "Niue"); p("685", "サモア", "Samoa")
        p("686", "キリバス", "Kiribati"); p("687", "ニューカレドニア", "New Caledonia")
        p("688", "ツバル", "Tuvalu"); p("689", "仏領ポリネシア", "French Polynesia")
        p("690", "トケラウ", "Tokelau"); p("691", "ミクロネシア", "Micronesia")
        p("692", "マーシャル諸島", "Marshall Islands")

        // --- Zone 8: 東アジア・南アジア ---
        p("81", "日本", "Japan"); p("82", "韓国", "South Korea")
        p("84", "ベトナム", "Vietnam"); p("86", "中国", "China")
        p("850", "北朝鮮", "North Korea"); p("852", "香港", "Hong Kong")
        p("853", "マカオ", "Macau"); p("855", "カンボジア", "Cambodia")
        p("856", "ラオス", "Laos"); p("880", "バングラデシュ", "Bangladesh")
        p("886", "台湾", "Taiwan")

        // --- Zone 9: 中東・中央アジア ---
        p("90", "トルコ", "Türkiye"); p("91", "インド", "India")
        p("92", "パキスタン", "Pakistan"); p("93", "アフガニスタン", "Afghanistan")
        p("94", "スリランカ", "Sri Lanka"); p("95", "ミャンマー", "Myanmar")
        p("98", "イラン", "Iran"); p("960", "モルディブ", "Maldives")
        p("961", "レバノン", "Lebanon"); p("962", "ヨルダン", "Jordan")
        p("963", "シリア", "Syria"); p("964", "イラク", "Iraq")
        p("965", "クウェート", "Kuwait"); p("966", "サウジアラビア", "Saudi Arabia")
        p("967", "イエメン", "Yemen"); p("968", "オマーン", "Oman")
        p("970", "パレスチナ", "Palestine"); p("971", "アラブ首長国連邦", "United Arab Emirates")
        p("972", "イスラエル", "Israel"); p("973", "バーレーン", "Bahrain")
        p("974", "カタール", "Qatar"); p("975", "ブータン", "Bhutan")
        p("976", "モンゴル", "Mongolia"); p("977", "ネパール", "Nepal")
        p("992", "タジキスタン", "Tajikistan"); p("993", "トルクメニスタン", "Turkmenistan")
        p("994", "アゼルバイジャン", "Azerbaijan"); p("995", "ジョージア", "Georgia")
        p("996", "キルギス", "Kyrgyzstan"); p("998", "ウズベキスタン", "Uzbekistan")

        // --- 国際サービス（特定の国に属さない） ---
        p("800", "国際フリーフォン", "International Freephone")
        p("808", "国際共同課金", "International Shared Cost")
        p("870", "インマルサット", "Inmarsat")
        p("878", "ユニバーサル・パーソナル通信", "Universal Personal Telecom.")
        p("881", "移動体衛星", "Global Mobile Satellite")
        p("882", "国際ネットワーク", "International Networks")
        p("883", "国際ネットワーク", "International Networks")
        p("888", "災害救援", "Disaster Relief (OCHA)")
        p("979", "国際プレミアムレート", "International Premium Rate")
    }

    /** 国番号として使われうる桁数（1〜3）。 */
    private val LENGTHS = intArrayOf(3, 2, 1)

    /**
     * `+` を除いた数字列の先頭から国番号を最長一致で取り出す。
     *
     * E.164 の国番号は接頭辞符号なので、最長一致で一意に決まる。
     * 未登録の番号帯なら null。
     */
    fun extract(digitsAfterPlus: String): String? {
        for (len in LENGTHS) {
            if (digitsAfterPlus.length >= len) {
                val candidate = digitsAfterPlus.substring(0, len)
                if (TABLE.containsKey(candidate)) return candidate
            }
        }
        return null
    }

    /** 国番号 → 日本語名。未登録なら null。 */
    fun nameJa(countryCode: String?): String? = countryCode?.let { TABLE[it]?.first }

    /** 国番号 → 英語名。未登録なら null。 */
    fun nameEn(countryCode: String?): String? = countryCode?.let { TABLE[it]?.second }

    /** 「日本 / Japan」形式の併記ラベル。未登録なら「+<code>」。 */
    fun label(countryCode: String?): String {
        if (countryCode == null) return "不明 / Unknown"
        val ja = nameJa(countryCode)
        val en = nameEn(countryCode)
        return if (ja != null && en != null) "$ja / $en" else "+$countryCode"
    }

    /** 登録済み国番号の総数（テストと自己診断用）。 */
    val size: Int get() = TABLE.size

    /** 登録済み国番号の一覧（テスト用）。 */
    fun allCodes(): Set<String> = TABLE.keys
}
