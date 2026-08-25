package com.hide.intlcallblocker.core

/** 相手番号の素性 / Where the other party's number appears to come from. */
enum class CallOrigin {
    /** 緊急通報番号。設定に関わらず必ず通す。 */
    EMERGENCY,

    /** 自国内の番号。 */
    DOMESTIC,

    /** 自国以外の国番号。これが遮断の主対象。 */
    INTERNATIONAL,

    /** 番号が取れない着信（非通知・公衆電話・圏外表示）。 */
    WITHHELD,

    /** 3〜4 桁の国内特番（117 / 171 / 189 など）。 */
    SHORT_CODE,

    /** MMI / USSD コード（`*#06#` など）。発信時に横取りしてはいけない。 */
    MMI,

    /** 国内・国際のどちらとも断定できない書式。 */
    UNKNOWN,
}

/** 発着信の向き。 */
enum class CallDirection { INCOMING, OUTGOING }

/** 判定結果のアクション。 */
enum class CallAction { ALLOW, BLOCK }

/** ブロック／通過の理由。UI とログの表示に使う。 */
enum class DecisionReason {
    /** 緊急通報のため無条件で通した。 */
    EMERGENCY_ALWAYS_ALLOWED,

    /** 許可リストに一致したため通した。 */
    ALLOW_LIST_MATCH,

    /** MMI / USSD のため通した。 */
    MMI_PASSTHROUGH,

    /** 国際着信を遮断した。 */
    INTERNATIONAL_INCOMING_BLOCKED,

    /** 国際発信を抑止した。 */
    INTERNATIONAL_OUTGOING_BLOCKED,

    /** 非通知・番号不明の着信を遮断した。 */
    WITHHELD_BLOCKED,

    /** 書式不明の番号を遮断した。 */
    UNKNOWN_FORMAT_BLOCKED,

    /** 該当するブロック条件が無かった。 */
    NO_RULE_MATCHED,

    /** 機能が無効化されている。 */
    FEATURE_DISABLED,
}

/**
 * 1 件の発着信に対する判定結果。
 *
 * @param action       通す / 遮断する
 * @param origin       相手番号の素性
 * @param reason       そう判断した理由
 * @param e164         E.164 へ揃えた番号（揃えられなければ正規化文字列、番号なしなら null）
 * @param countryCode  国際の場合の国番号（`+` なし）。判定できなければ null
 * @param matchedRule  許可リストで一致したエントリ
 */
data class CallDecision(
    val action: CallAction,
    val origin: CallOrigin,
    val reason: DecisionReason,
    val e164: String?,
    val countryCode: String? = null,
    val matchedRule: String? = null,
) {
    val isBlocked: Boolean get() = action == CallAction.BLOCK

    /** 記録に残す価値がある結論か。規則は [isNoteworthy] を参照。 */
    val isNoteworthy: Boolean get() = isNoteworthy(isBlocked, reason)
}

/**
 * 記録に残す価値がある結論か / Whether a verdict is worth logging.
 *
 * 着信スクリーニングは**すべての着信**で呼ばれるため、素直に全件記録すると
 * 普段の国内通話でログの上限が埋まり、肝心の遮断記録が押し出されて消える。
 * 端末の通話履歴と重複するだけの国内通話は残さず、次の 2 つに絞る。
 *
 * - 遮断したもの（何を止めたのか分からないと誤遮断に気づけない）
 * - 許可リストで通した国際通話（例外が意図どおり効いたかを確かめられる）
 *
 * 判定結果（[CallDecision]）と保存済みログ行の両方から参照するため、
 * 規則そのものはここ 1 箇所に置く。2 箇所に書くと必ず片方だけ変わる。
 */
fun isNoteworthy(blocked: Boolean, reason: DecisionReason): Boolean =
    blocked || reason == DecisionReason.ALLOW_LIST_MATCH
