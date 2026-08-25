package com.hide.intlcallblocker.core

/**
 * 許可リストの 1 エントリ / One entry of the allow list.
 *
 * @param pattern 利用者が入力した文字列。末尾 `*` で前方一致。
 *                例: `+1 202-555-0143`（完全一致） / `+8210*`（韓国の携帯すべて）
 * @param label   表示名（「家族（NY）」など）。空でもよい。
 */
data class AllowRule(
    val pattern: String,
    val label: String = "",
) {
    /** 前方一致ルールか。 */
    val isPrefix: Boolean get() = pattern.trimEnd().endsWith("*")

    /** 桁を 1 つも含まないパターンは全許可の事故になるため無効とする。 */
    val isValid: Boolean get() = pattern.any { it.isDigit() }
}

/**
 * 許可リスト。国際遮断の例外を管理する。
 *
 * 入力表記の揺れ（`090-1234-5678` / `+819012345678` / 全角）を吸収するため、
 * 突き合わせは E.164 へ正規化してから行う。
 */
class AllowList(
    rules: List<AllowRule>,
    private val plan: DialPlan = DialPlan.JAPAN,
) {
    /** 正規化済み（照合用キー, 前方一致か, 元ルール）の三つ組。 */
    private val compiled: List<Triple<String, Boolean, AllowRule>> = rules
        .filter { it.isValid }
        .mapNotNull { rule ->
            val isPrefix = rule.isPrefix
            val body = rule.pattern.trimEnd().let { if (isPrefix) it.dropLast(1) else it }
            val key = canonicalKey(body) ?: return@mapNotNull null
            if (key.isEmpty()) return@mapNotNull null
            Triple(key, isPrefix, rule)
        }

    /** 有効なルール数。 */
    val size: Int get() = compiled.size

    /**
     * 番号が許可リストに載っているか。
     *
     * @param number E.164 でも国内表記でも生の入力でもよい。内部で正規化して突き合わせる。
     * @return 一致したルール。無ければ null。
     */
    fun match(number: String?): AllowRule? {
        val key = canonicalKey(number ?: return null) ?: return null
        if (key.isEmpty()) return null
        for ((ruleKey, isPrefix, rule) in compiled) {
            if (if (isPrefix) key.startsWith(ruleKey) else key == ruleKey) return rule
        }
        return null
    }

    /**
     * 照合用の正準表記へ落とす。
     *
     * `+` を含む完全形は E.164 の数字列、国内表記は国番号を補って同じ土俵に載せる。
     * 前方一致パターン（`+8210` のような途中まで）も同じ関数で扱えるよう、
     * 変換できない断片は数字列をそのまま返す。
     */
    private fun canonicalKey(input: String): String? {
        val normalized = PhoneNumbers.normalize(input) ?: return null
        val e164 = PhoneNumbers.toE164(normalized, plan) ?: return null
        return if (e164.startsWith("+")) e164.substring(1) else PhoneNumbers.digitsOnly(e164)
    }

    companion object {
        /** 空の許可リスト。 */
        fun empty(plan: DialPlan = DialPlan.JAPAN) = AllowList(emptyList(), plan)
    }
}
