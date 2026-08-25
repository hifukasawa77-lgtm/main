package com.hide.intlcallblocker.service

import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.TelecomManager
import android.util.Log
import com.hide.intlcallblocker.core.CallDirection
import com.hide.intlcallblocker.data.BlockLogEntry
import com.hide.intlcallblocker.data.ScreeningRepository

/**
 * 着信スクリーニング / Incoming call screening.
 *
 * `ROLE_CALL_SCREENING` を保持している間、**呼び出し音が鳴る前**に [onScreenCall] が呼ばれる。
 * ここで [respondToCall] を返すまで着信は保留される。
 *
 * ### 実装上の必須事項
 * - **必ず [respondToCall] を 1 回だけ呼ぶ**。例外で抜けると着信が宙吊りになる。
 *   そのため判定全体を try/catch で囲み、失敗時は「通す」側へ倒す
 *   （遮断アプリの不具合で正当な着信が消える方が損害が大きい）。
 * - **数秒で返す**。Telecom 側に待ち時間の上限がある。I/O は SharedPreferences のみに留める。
 * - メインスレッドで呼ばれる。重い処理を置かない。
 */
class IntlCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        try {
            screen(callDetails)
        } catch (t: Throwable) {
            // 判定に失敗したら着信は通す。ここで握りつぶさないと着信が保留されたままになる。
            Log.e(TAG, "スクリーニングに失敗したため着信を通します", t)
            runCatching { respondToCall(callDetails, CallResponse.Builder().build()) }
        }
    }

    private fun screen(callDetails: Call.Details) {
        // 発信は CallRedirectionService の担当。ここでは何もせず通す。
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(callDetails, CallResponse.Builder().build())
            return
        }

        val repository = ScreeningRepository.get(this)
        val policy = repository.policy.value

        // 番号が「提示されている」かどうか。非通知・公衆電話・圏外表示はここで false になる。
        // handle が null でも presentation が ALLOWED のことがあるため、両方を見る。
        val presented =
            callDetails.handlePresentation == TelecomManager.PRESENTATION_ALLOWED &&
                callDetails.handle != null

        val rawNumber = callDetails.handle?.schemeSpecificPart

        val decision = repository.engine().decide(rawNumber, CallDirection.INCOMING, presented)

        val response = when {
            !decision.isBlocked ->
                // 何も設定しない CallResponse ＝「このアプリは介入しない」。
                CallResponse.Builder().build()

            policy.silenceInsteadOfReject ->
                // 拒否せず着信音だけ鳴らさない。相手からは呼び出し中に見える。
                // setSilenceCall と setDisallowCall は併用しない（同時指定は意味が競合する）。
                CallResponse.Builder()
                    .setDisallowCall(false)
                    .setRejectCall(false)
                    .setSilenceCall(true)
                    .setSkipCallLog(false)
                    .setSkipNotification(false)
                    .build()

            else ->
                CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSilenceCall(false)
                    .setSkipCallLog(!policy.keepBlockedInCallLog)
                    .setSkipNotification(!policy.keepBlockedNotification)
                    .build()
        }

        respondToCall(callDetails, response)

        repository.record(BlockLogEntry.from(decision, CallDirection.INCOMING, System.currentTimeMillis()))
        if (decision.isBlocked && policy.notifyOnBlock) {
            BlockNotifier.notifyBlocked(this, decision, CallDirection.INCOMING)
        }
    }

    private companion object {
        const val TAG = "IntlCallScreening"
    }
}
