package com.hide.intlcallblocker.core

/**
 * 遮断ルールの設定 / User-facing screening policy.
 *
 * 既定値は「国際電話を完全シャットアウト」。
 */
data class ScreeningPolicy(
    /** 国際着信を拒否する。 */
    val blockInternationalIncoming: Boolean = true,

    /** 非通知・公衆電話・番号不明の着信を拒否する。 */
    val blockWithheldIncoming: Boolean = true,

    /** 国際発信（010 / +国番号）を抑止する。折り返し詐欺の被害を防ぐ。 */
    val blockInternationalOutgoing: Boolean = true,

    /**
     * 国内・国際のどちらとも判定できない書式の着信を拒否する。
     *
     * 既定は false。true にすると取りこぼしは減るが、
     * 交換機によっては正当な国内着信も落ちうる。
     */
    val blockUnknownFormatIncoming: Boolean = false,

    /**
     * 拒否ではなく「呼び出し音を鳴らさずに放置」する。
     *
     * false（既定）… 即時拒否。相手には話中／切断が返る。
     * true          … 着信音だけ鳴らさない。相手からは呼び出し中に見える。
     */
    val silenceInsteadOfReject: Boolean = false,

    /** 遮断した着信を端末の通話履歴に残す。false（既定）ならアプリ内ログにだけ残る。 */
    val keepBlockedInCallLog: Boolean = false,

    /** 遮断した着信を端末の通知に出す。false（既定）なら通知も出さない。 */
    val keepBlockedNotification: Boolean = false,

    /** アプリ内ログに遮断・通過の記録を残す。 */
    val recordLog: Boolean = true,

    /**
     * 遮断したことを本アプリ自身の通知で知らせる。
     *
     * 端末の着信通知（[keepBlockedNotification]）とは別物。
     * こちらを true にすると「いつ・どこから遮断したか」が通知領域に静かに残る。
     */
    val notifyOnBlock: Boolean = true,
) {
    /** 3 つの遮断機能がすべて無効か（＝実質何もしない状態か）。 */
    val isFullyDisabled: Boolean
        get() = !blockInternationalIncoming &&
            !blockWithheldIncoming &&
            !blockInternationalOutgoing &&
            !blockUnknownFormatIncoming

    companion object {
        /** 出荷時設定＝国際電話を完全シャットアウト。 */
        val DEFAULT = ScreeningPolicy()
    }
}
