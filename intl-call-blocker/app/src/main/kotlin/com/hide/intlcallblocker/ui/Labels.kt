package com.hide.intlcallblocker.ui

import com.hide.intlcallblocker.core.CallOrigin
import com.hide.intlcallblocker.core.DecisionReason

/**
 * 判定結果の日英ラベル / Bilingual labels for engine verdicts.
 *
 * core モジュールは表示文言を持たない（Android 非依存に保つため）。
 * 列挙子から人間向けの文言への対応はここに集約する。
 */

fun originLabel(origin: CallOrigin): String = when (origin) {
    CallOrigin.EMERGENCY -> "緊急通報 / Emergency"
    CallOrigin.DOMESTIC -> "国内 / Domestic"
    CallOrigin.INTERNATIONAL -> "国際 / International"
    CallOrigin.WITHHELD -> "非通知・番号不明 / Withheld"
    CallOrigin.SHORT_CODE -> "国内特番 / Short code"
    CallOrigin.MMI -> "MMI コード / MMI code"
    CallOrigin.UNKNOWN -> "書式不明 / Unrecognised"
}

fun reasonLabel(reason: DecisionReason): String = when (reason) {
    DecisionReason.EMERGENCY_ALWAYS_ALLOWED -> "緊急通報のため常に通す / Emergency, always allowed"
    DecisionReason.ALLOW_LIST_MATCH -> "許可リストに一致 / Matched the allow list"
    DecisionReason.MMI_PASSTHROUGH -> "MMI コードのため通す / MMI code, passed through"
    DecisionReason.INTERNATIONAL_INCOMING_BLOCKED -> "国際着信のため遮断 / Incoming international call"
    DecisionReason.INTERNATIONAL_OUTGOING_BLOCKED -> "国際発信のため抑止 / Outgoing international call"
    DecisionReason.WITHHELD_BLOCKED -> "番号が取得できないため遮断 / Number withheld"
    DecisionReason.UNKNOWN_FORMAT_BLOCKED -> "書式不明のため遮断 / Unrecognised number format"
    DecisionReason.NO_RULE_MATCHED -> "該当する遮断条件なし / No blocking rule matched"
    DecisionReason.FEATURE_DISABLED -> "その遮断は無効になっている / That rule is switched off"
}
