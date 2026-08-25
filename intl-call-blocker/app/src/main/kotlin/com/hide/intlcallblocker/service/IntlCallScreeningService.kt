package com.hide.intlcallblocker.service

import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.TelecomManager
import android.util.Log
import com.hide.intlcallblocker.core.CallDecision
import com.hide.intlcallblocker.core.CallDirection
import com.hide.intlcallblocker.core.ScreeningPolicy
import com.hide.intlcallblocker.data.BlockLogEntry
import com.hide.intlcallblocker.data.ScreeningRepository

/**
 * 着信スクリーニング / Incoming call screening.
 *
 * `ROLE_CALL_SCREENING` を保持している間、**呼び出し音が鳴る前**に [onScreenCall] が呼ばれる。
 * ここで [respondToCall] を返すまで着信は保留される。
 *
 * ### 実装上の必須事項
 * - **[respondToCall] を必ず 1 回だけ呼ぶ**。0 回なら着信が宙吊りになり、2 回目は
 *   1 回目と矛盾する応答（遮断のあとに「介入しない」）を送りかねない。
 *   そのため「判定して応答する」段と「記録・通知」段を分け、後段の失敗が
 *   前段をやり直させないようにしている。
 * - 応答できなかったときだけ「通す」側へ倒す。遮断アプリの不具合で
 *   正当な着信が消える方が損害が大きい。
 * - **数秒で返す**。Telecom 側に待ち時間の上限がある。I/O は SharedPreferences のみに留める。
 * - メインスレッドで呼ばれる。重い処理を置かない。
 */
class IntlCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        var responded = false
        try {
            val repository = ScreeningRepository.get(this)
            val policy = repository.policy.value
            val decision = decide(callDetails, repository)

            respondToCall(callDetails, buildResponse(decision, policy))
            responded = true

            // ここから先は記録と通知だけ。失敗しても応答はやり直さない
            // （やり直すと respondToCall が 2 回呼ばれてしまう）。
            recordAndNotify(repository, policy, decision)
        } catch (t: Throwable) {
            Log.e(TAG, "スクリーニングに失敗しました", t)
            if (!responded) {
                // まだ応答していない場合に限り、着信を通して宙吊りを防ぐ。
                runCatching { respondToCall(callDetails, CallResponse.Builder().build()) }
            }
        }
    }

    /**
     * 相手番号を判定する。
     *
     * 着信以外（発信は [IntlCallRedirectionService] の担当）は判定せず
     * 「介入しない」を意味する結論を返す。
     */
    private fun decide(callDetails: Call.Details, repository: ScreeningRepository): CallDecision? {
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) return null

        // 番号が「提示されている」かどうか。非通知・公衆電話・圏外表示はここで false になる。
        // handle が null でも presentation が ALLOWED のことがあるため、両方を見る。
        val presented =
            callDetails.handlePresentation == TelecomManager.PRESENTATION_ALLOWED &&
                callDetails.handle != null

        return repository.engine()
            .decide(callDetails.handle?.schemeSpecificPart, CallDirection.INCOMING, presented)
    }

    private fun buildResponse(decision: CallDecision?, policy: ScreeningPolicy): CallResponse = when {
        // 何も設定しない CallResponse ＝「このアプリは介入しない」。
        decision == null || !decision.isBlocked -> CallResponse.Builder().build()

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

    private fun recordAndNotify(
        repository: ScreeningRepository,
        policy: ScreeningPolicy,
        decision: CallDecision?,
    ) {
        if (decision == null) return
        runCatching {
            repository.record(
                BlockLogEntry.from(decision, CallDirection.INCOMING, System.currentTimeMillis()),
            )
            if (decision.isBlocked && policy.notifyOnBlock) {
                BlockNotifier.notifyBlocked(this, decision, CallDirection.INCOMING)
            }
        }.onFailure { Log.e(TAG, "遮断の記録に失敗しました（着信の処理そのものは完了しています）", it) }
    }

    private companion object {
        const val TAG = "IntlCallScreening"
    }
}
