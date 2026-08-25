package com.hide.intlcallblocker.data

import android.content.Context
import android.content.SharedPreferences
import com.hide.intlcallblocker.core.AllowList
import com.hide.intlcallblocker.core.AllowRule
import com.hide.intlcallblocker.core.CallScreeningEngine
import com.hide.intlcallblocker.core.DialPlan
import com.hide.intlcallblocker.core.ScreeningPolicy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

/**
 * 設定・許可リスト・ログの保管庫 / Persistent store for policy, allow list and log.
 *
 * **プロセスの寿命に依存しないこと**が重要。着信スクリーニングはアプリが起動していない
 * 状態でも呼ばれ、そのとき Android はプロセスを新規に作る。UI が事前に読み込んでいる前提の
 * メモリ上の状態に頼ると、初回着信だけ設定が効かない、という無言の不具合になる。
 * そのため生成時に必ず SharedPreferences から読み直す。
 */
class ScreeningRepository private constructor(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** 判定の基準となる番号計画。現状は日本固定。 */
    val dialPlan: DialPlan = DialPlan.JAPAN

    private val _policy = MutableStateFlow(loadPolicy())
    val policy: StateFlow<ScreeningPolicy> = _policy.asStateFlow()

    private val _allowRules = MutableStateFlow(loadAllowRules())
    val allowRules: StateFlow<List<AllowRule>> = _allowRules.asStateFlow()

    private val _log = MutableStateFlow(loadLog())
    val log: StateFlow<List<BlockLogEntry>> = _log.asStateFlow()

    // ------------------------------------------------------------------ 判定

    /** 現在の設定で組んだ判定エンジン。呼ぶたびに最新の設定で作り直す。 */
    fun engine(): CallScreeningEngine =
        CallScreeningEngine(dialPlan, _policy.value, AllowList(_allowRules.value, dialPlan))

    // ------------------------------------------------------------------ 設定

    fun updatePolicy(transform: (ScreeningPolicy) -> ScreeningPolicy) {
        val next = transform(_policy.value)
        _policy.value = next
        prefs.edit().apply {
            putBoolean(KEY_BLOCK_INTL_IN, next.blockInternationalIncoming)
            putBoolean(KEY_BLOCK_WITHHELD, next.blockWithheldIncoming)
            putBoolean(KEY_BLOCK_INTL_OUT, next.blockInternationalOutgoing)
            putBoolean(KEY_BLOCK_UNKNOWN, next.blockUnknownFormatIncoming)
            putBoolean(KEY_SILENCE, next.silenceInsteadOfReject)
            putBoolean(KEY_KEEP_CALL_LOG, next.keepBlockedInCallLog)
            putBoolean(KEY_KEEP_NOTIFICATION, next.keepBlockedNotification)
            putBoolean(KEY_RECORD_LOG, next.recordLog)
            putBoolean(KEY_NOTIFY_ON_BLOCK, next.notifyOnBlock)
        }.apply()
    }

    private fun loadPolicy(): ScreeningPolicy {
        val d = ScreeningPolicy.DEFAULT
        return ScreeningPolicy(
            blockInternationalIncoming = prefs.getBoolean(KEY_BLOCK_INTL_IN, d.blockInternationalIncoming),
            blockWithheldIncoming = prefs.getBoolean(KEY_BLOCK_WITHHELD, d.blockWithheldIncoming),
            blockInternationalOutgoing = prefs.getBoolean(KEY_BLOCK_INTL_OUT, d.blockInternationalOutgoing),
            blockUnknownFormatIncoming = prefs.getBoolean(KEY_BLOCK_UNKNOWN, d.blockUnknownFormatIncoming),
            silenceInsteadOfReject = prefs.getBoolean(KEY_SILENCE, d.silenceInsteadOfReject),
            keepBlockedInCallLog = prefs.getBoolean(KEY_KEEP_CALL_LOG, d.keepBlockedInCallLog),
            keepBlockedNotification = prefs.getBoolean(KEY_KEEP_NOTIFICATION, d.keepBlockedNotification),
            recordLog = prefs.getBoolean(KEY_RECORD_LOG, d.recordLog),
            notifyOnBlock = prefs.getBoolean(KEY_NOTIFY_ON_BLOCK, d.notifyOnBlock),
        )
    }

    // -------------------------------------------------------------- 許可リスト

    /**
     * 許可リストへ 1 件追加する。
     *
     * @return 追加できたら true。桁を含まない（＝全許可になってしまう）入力や
     *         既に同じパターンがある場合は false。
     */
    fun addAllowRule(rule: AllowRule): Boolean {
        if (!rule.isValid) return false
        val current = _allowRules.value
        if (current.any { it.pattern.trim() == rule.pattern.trim() }) return false
        saveAllowRules(current + rule.copy(pattern = rule.pattern.trim()))
        return true
    }

    fun removeAllowRule(rule: AllowRule) {
        saveAllowRules(_allowRules.value.filterNot { it.pattern == rule.pattern })
    }

    private fun saveAllowRules(rules: List<AllowRule>) {
        _allowRules.value = rules
        val array = JSONArray()
        for (r in rules) {
            array.put(JSONObject().put(KEY_RULE_PATTERN, r.pattern).put(KEY_RULE_LABEL, r.label))
        }
        prefs.edit().putString(KEY_ALLOW_RULES, array.toString()).apply()
    }

    private fun loadAllowRules(): List<AllowRule> {
        val raw = prefs.getString(KEY_ALLOW_RULES, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val o = array.optJSONObject(i) ?: continue
                    val pattern = o.optString(KEY_RULE_PATTERN, "")
                    if (pattern.isEmpty()) continue
                    add(AllowRule(pattern, o.optString(KEY_RULE_LABEL, "")))
                }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    // ------------------------------------------------------------------ ログ

    /** ログを 1 行追加する。上限を超えた古い行は捨てる。 */
    fun record(entry: BlockLogEntry) {
        if (!_policy.value.recordLog) return
        val next = (listOf(entry) + _log.value).take(MAX_LOG_ENTRIES)
        _log.value = next
        val array = JSONArray()
        for (e in next) array.put(e.toJson())
        prefs.edit().putString(KEY_LOG, array.toString()).apply()
    }

    fun clearLog() {
        _log.value = emptyList()
        prefs.edit().remove(KEY_LOG).apply()
    }

    private fun loadLog(): List<BlockLogEntry> {
        val raw = prefs.getString(KEY_LOG, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val o = array.optJSONObject(i) ?: continue
                    BlockLogEntry.fromJson(o)?.let { add(it) }
                }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    companion object {
        private const val PREFS_NAME = "intl_call_blocker"

        private const val KEY_BLOCK_INTL_IN = "block_international_incoming"
        private const val KEY_BLOCK_WITHHELD = "block_withheld_incoming"
        private const val KEY_BLOCK_INTL_OUT = "block_international_outgoing"
        private const val KEY_BLOCK_UNKNOWN = "block_unknown_format_incoming"
        private const val KEY_SILENCE = "silence_instead_of_reject"
        private const val KEY_KEEP_CALL_LOG = "keep_blocked_in_call_log"
        private const val KEY_KEEP_NOTIFICATION = "keep_blocked_notification"
        private const val KEY_RECORD_LOG = "record_log"
        private const val KEY_NOTIFY_ON_BLOCK = "notify_on_block"

        private const val KEY_ALLOW_RULES = "allow_rules"
        private const val KEY_RULE_PATTERN = "pattern"
        private const val KEY_RULE_LABEL = "label"

        private const val KEY_LOG = "log"

        /** 保持するログの上限。SharedPreferences に収める前提なので控えめに取る。 */
        const val MAX_LOG_ENTRIES = 300

        @Volatile
        private var instance: ScreeningRepository? = null

        fun get(context: Context): ScreeningRepository =
            instance ?: synchronized(this) {
                instance ?: ScreeningRepository(context).also { instance = it }
            }
    }
}
