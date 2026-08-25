package com.hide.intlcallblocker.core

/**
 * 電話番号の正規化ユーティリティ / Phone number normalisation helpers.
 *
 * Android 依存を持たない純 Kotlin。JVM 上でそのままテストできる。
 * No Android dependencies — unit-testable on a plain JVM.
 */
object PhoneNumbers {

    /** ポーズ／待機を表す文字。ここから後ろはダイヤル先の識別に関係しない。 */
    private const val POST_DIAL_CHARS = ",;pPwW"

    /**
     * `tel:` / `sip:` URI や整形済み表記を、判定に使える素の文字列へ落とす。
     *
     * - 全角数字・全角プラスを半角へ
     * - スキーム（`tel:` `sip:` `tels:`）と SIP のホスト部を除去
     * - 区切り記号（空白・ハイフン・括弧・ドット）を除去
     * - ポーズ以降を切り捨て
     * - 先頭の `+` だけ残し、数字と `*` `#` を保持（MMI コード判定のため）
     *
     * @return 正規化後の文字列。判定材料が何も残らなければ null。
     */
    fun normalize(raw: String?): String? {
        if (raw == null) return null

        var s = toHalfWidth(raw).trim()
        if (s.isEmpty()) return null

        // スキーム除去（tel: / sip: / sips: / tel://）
        val colon = s.indexOf(':')
        if (colon in 1..5) {
            val scheme = s.substring(0, colon).lowercase()
            if (scheme == "tel" || scheme == "sip" || scheme == "sips") {
                s = s.substring(colon + 1).removePrefix("//")
            }
        }
        // SIP の user@host → user だけ見る
        val at = s.indexOf('@')
        if (at >= 0) s = s.substring(0, at)

        // ポーズ以降を切り捨て
        val pause = s.indexOfFirst { it in POST_DIAL_CHARS }
        if (pause >= 0) s = s.substring(0, pause)

        val plus = s.startsWith("+")
        val body = buildString {
            for (c in s) {
                if (c.isDigit() || c == '*' || c == '#') append(c)
            }
        }
        if (body.isEmpty()) return null
        return if (plus) "+$body" else body
    }

    /** 全角英数記号を半角へ。日本語IMEや連絡先アプリ由来の全角混じりを吸収する。 */
    fun toHalfWidth(s: String): String = buildString(s.length) {
        for (c in s) {
            append(
                when (c) {
                    in '０'..'９' -> c - 0xFEE0            // ０-９
                    '＋' -> '+'                                // ＋
                    '－', '−', 'ー', '‐', '‑',
                    '‒', '–', '—', '―' -> '-'  // 各種ダッシュ
                    '（' -> '('
                    '）' -> ')'
                    '＃' -> '#'
                    '＊' -> '*'
                    '　' -> ' '
                    else -> c
                }
            )
        }
    }

    /** MMI / USSD コード（`*#06#` `*67...` など）。発信時に絶対に横取りしてはいけない。 */
    fun isMmiCode(normalized: String?): Boolean {
        if (normalized.isNullOrEmpty()) return false
        return normalized.startsWith("*") || normalized.startsWith("#")
    }

    /** `+` を除いた数字列。`*` `#` は落とす。 */
    fun digitsOnly(normalized: String?): String =
        normalized?.filter { it.isDigit() } ?: ""

    /**
     * 可能なら E.164（`+<国番号><国内番号>`）へ揃える。
     * 国内表記（先頭 `0` の市外局番形式）は home の国番号を付けて国際形式にする。
     *
     * 揃えられない（短縮番号・書式不明）場合は正規化文字列をそのまま返す。
     */
    fun toE164(normalized: String?, plan: DialPlan): String? {
        val n = normalized ?: return null
        if (isMmiCode(n)) return n
        if (n.startsWith("+")) return "+" + digitsOnly(n)

        val d = digitsOnly(n)
        if (d.isEmpty()) return null

        // 国際発信プレフィックス（日本なら 010、事業者選択 00XY を含む）
        val intl = stripInternationalPrefix(d, plan)
        if (intl != null) return "+$intl"

        // 国内表記: 先頭の trunk prefix を落として国番号を付ける
        if (plan.trunkPrefix.isNotEmpty() && d.startsWith(plan.trunkPrefix) && d.length > plan.trunkPrefix.length) {
            return "+" + plan.homeCountryCode + d.substring(plan.trunkPrefix.length)
        }
        return n
    }

    /**
     * 国際発信プレフィックスを剥がして「国番号から始まる数字列」を返す。
     * 該当しなければ null。
     *
     * 対応形:
     * - `010XXXX`                     … 日本の国際発信プレフィックス
     * - `0033010XXXX` `001010XXXX` 等 … 事業者選択番号 + 010
     * - `00XXXX`                      … 多くの国で使われる IDD（`plan.bareDoubleZeroIsIdd` が true のとき）
     */
    fun stripInternationalPrefix(digits: String, plan: DialPlan): String? {
        // 1. 素の国際発信プレフィックス（日本なら 010）
        for (p in plan.internationalPrefixes) {
            if (digits.startsWith(p) && digits.length > p.length) return digits.substring(p.length)
        }

        // 2. 事業者選択番号 + 国際発信プレフィックス（0033010… / 001010… / 0061010… など）。
        //    事業者選択番号は 001（3桁）〜 005345（6桁）と桁数がまちまちなので、
        //    正規表現の貪欲マッチで 1 通りだけ試すと桁数違いを取り逃がす。全長を総当たりする。
        if (digits.startsWith(CARRIER_SELECT_HEAD)) {
            for (extra in 1..MAX_CARRIER_SELECT_EXTRA_DIGITS) {
                val headLen = CARRIER_SELECT_HEAD.length + extra
                if (digits.length <= headLen) break
                val rest = digits.substring(headLen)
                for (p in plan.internationalPrefixes) {
                    if (!rest.startsWith(p)) continue
                    val dest = rest.substring(p.length)
                    // 事業者番号の切り出しは曖昧さがあるので、宛先として短すぎるものは誤検出とみなす
                    if (dest.length >= MIN_INTERNATIONAL_DESTINATION_DIGITS) return dest
                }
            }
        }

        // 3. 事業者選択番号を持たず 00 が直接 IDD の国（欧州など）
        if (plan.bareDoubleZeroIsIdd && digits.startsWith("00") && digits.length > 4) {
            return digits.substring(2)
        }
        return null
    }

    /** 日本の事業者選択番号は必ず `00` で始まる。 */
    private const val CARRIER_SELECT_HEAD = "00"

    /** `00` の後ろに続く事業者識別桁の最大長（005345 = 4 桁）。 */
    private const val MAX_CARRIER_SELECT_EXTRA_DIGITS = 4

    /** 国番号 + 加入者番号として成立しうる最小桁数。これ未満は事業者番号の切り出しミス。 */
    private const val MIN_INTERNATIONAL_DESTINATION_DIGITS = 7
}
