package com.hide.intlcallblocker.data

import com.hide.intlcallblocker.core.CallDecision
import com.hide.intlcallblocker.core.CallDirection
import com.hide.intlcallblocker.core.CallOrigin
import com.hide.intlcallblocker.core.DecisionReason
import org.json.JSONObject

/**
 * アプリ内ログの 1 行 / One row of the in-app screening log.
 *
 * 端末の通話履歴には残さない設定で運用する前提なので、
 * 「何を遮断したのか」を利用者が確認できる唯一の記録になる。
 */
data class BlockLogEntry(
    val timestampMillis: Long,
    val e164: String?,
    val direction: CallDirection,
    val origin: CallOrigin,
    val reason: DecisionReason,
    val blocked: Boolean,
    val countryCode: String?,
    val matchedRule: String?,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put(KEY_TIME, timestampMillis)
        put(KEY_NUMBER, e164 ?: JSONObject.NULL)
        put(KEY_DIRECTION, direction.name)
        put(KEY_ORIGIN, origin.name)
        put(KEY_REASON, reason.name)
        put(KEY_BLOCKED, blocked)
        put(KEY_COUNTRY, countryCode ?: JSONObject.NULL)
        put(KEY_RULE, matchedRule ?: JSONObject.NULL)
    }

    companion object {
        private const val KEY_TIME = "t"
        private const val KEY_NUMBER = "n"
        private const val KEY_DIRECTION = "d"
        private const val KEY_ORIGIN = "o"
        private const val KEY_REASON = "r"
        private const val KEY_BLOCKED = "b"
        private const val KEY_COUNTRY = "c"
        private const val KEY_RULE = "m"

        fun from(decision: CallDecision, direction: CallDirection, now: Long): BlockLogEntry =
            BlockLogEntry(
                timestampMillis = now,
                e164 = decision.e164,
                direction = direction,
                origin = decision.origin,
                reason = decision.reason,
                blocked = decision.isBlocked,
                countryCode = decision.countryCode,
                matchedRule = decision.matchedRule,
            )

        /**
         * 保存済み JSON から復元する。
         *
         * 列挙子の名前が将来変わっても落ちないよう、未知の値は握りつぶして null を返す
         * （ログ 1 行のために起動不能になる方が損害が大きい）。
         */
        fun fromJson(o: JSONObject): BlockLogEntry? = try {
            BlockLogEntry(
                timestampMillis = o.getLong(KEY_TIME),
                // JSONObject.NULL に optString を使うと文字列 "null" が返るため isNull で判定する
                e164 = if (o.isNull(KEY_NUMBER)) null else o.getString(KEY_NUMBER),
                direction = CallDirection.valueOf(o.getString(KEY_DIRECTION)),
                origin = CallOrigin.valueOf(o.getString(KEY_ORIGIN)),
                reason = DecisionReason.valueOf(o.getString(KEY_REASON)),
                blocked = o.getBoolean(KEY_BLOCKED),
                countryCode = if (o.isNull(KEY_COUNTRY)) null else o.getString(KEY_COUNTRY),
                matchedRule = if (o.isNull(KEY_RULE)) null else o.getString(KEY_RULE),
            )
        } catch (e: Exception) {
            null
        }
    }
}
