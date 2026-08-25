package com.hide.intlcallblocker.core

/**
 * 「自国」をどう定義するかの番号計画 / Numbering plan that defines what counts as *domestic*.
 *
 * 既定は日本（JAPAN）。海外在住で使う場合はここを差し替えれば判定全体が追随する。
 */
data class DialPlan(
    /** 自国の国番号（`+` なし）。例: 日本 = "81" */
    val homeCountryCode: String,
    /** 国内長距離プレフィックス（trunk prefix）。日本 = "0" */
    val trunkPrefix: String,
    /** 国際発信プレフィックス。日本 = ["010"] */
    val internationalPrefixes: List<String>,
    /** 緊急通報番号。何があっても発着信をブロックしない。 */
    val emergencyNumbers: Set<String>,
    /**
     * 事業者選択番号を伴わない裸の `00` を国際発信とみなすか。
     * 日本は `00XY` が事業者選択番号なので false。欧州等は true。
     */
    val bareDoubleZeroIsIdd: Boolean = false,
    /** 国内の 3〜4 桁特番（117 時報 / 171 災害伝言ダイヤル など）。常に国内扱い。 */
    val shortCodeLengths: IntRange = 3..4,
) {
    init {
        require(homeCountryCode.isNotEmpty() && homeCountryCode.all { it.isDigit() }) {
            "homeCountryCode must be digits: $homeCountryCode"
        }
    }

    companion object {
        /**
         * 日本の番号計画。
         *
         * 緊急通報は 110（警察）/ 118（海上保安庁）/ 119（消防・救急）。
         * 海外 SIM 由来の 112 / 911 も端末側が緊急扱いするため、保険として含める。
         */
        val JAPAN = DialPlan(
            homeCountryCode = "81",
            trunkPrefix = "0",
            internationalPrefixes = listOf("010"),
            emergencyNumbers = setOf("110", "118", "119", "112", "911"),
            bareDoubleZeroIsIdd = false,
        )
    }
}
