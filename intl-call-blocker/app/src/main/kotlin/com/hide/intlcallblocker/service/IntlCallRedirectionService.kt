package com.hide.intlcallblocker.service

import android.net.Uri
import android.telecom.CallRedirectionService
import android.telecom.PhoneAccountHandle
import android.util.Log
import com.hide.intlcallblocker.core.CallDirection
import com.hide.intlcallblocker.data.BlockLogEntry
import com.hide.intlcallblocker.data.ScreeningRepository

/**
 * 発信リダイレクト / Outgoing call redirection.
 *
 * `ROLE_CALL_REDIRECTION` を保持している間、**発信が回線に載る直前**に [onPlaceCall] が呼ばれる。
 * 折り返し詐欺（ワン切り国際電話）で高額請求を受けるのを防ぐのが主目的。
 *
 * ### 実装上の必須事項
 * - **[placeCallUnmodified] / [redirectCall] / [cancelCall] のうち 1 つを、必ず 1 回だけ呼ぶ**。
 *   0 回なら発信が止まったままになり、`cancelCall()` のあとに [placeCallUnmodified] を
 *   呼ぶような二重通知は、止めたはずの発信を通しかねない。
 *   そのため「判定して結論を出す」段と「記録・通知」段を分け、後段の失敗が
 *   前段をやり直させないようにしている。
 * - 結論を出せなかったときだけ「そのまま発信」へ倒す。止めたままにする方が危険。
 * - 緊急通報と MMI / USSD コードは絶対に横取りしない（判定エンジン側で保証している）。
 * - 数秒で返す。
 */
class IntlCallRedirectionService : CallRedirectionService() {

    override fun onPlaceCall(
        handle: Uri,
        initialPhoneAccount: PhoneAccountHandle,
        allowInteractiveResponse: Boolean,
    ) {
        var answered = false
        try {
            val repository = ScreeningRepository.get(this)
            val policy = repository.policy.value

            val decision = repository.engine()
                .decide(handle.schemeSpecificPart, CallDirection.OUTGOING, numberPresented = true)

            if (decision.isBlocked) cancelCall() else placeCallUnmodified()
            answered = true

            // ここから先は記録と通知だけ。失敗しても発信の可否はやり直さない
            // （やり直すと cancelCall のあとに placeCallUnmodified が走りうる）。
            runCatching {
                repository.record(
                    BlockLogEntry.from(decision, CallDirection.OUTGOING, System.currentTimeMillis()),
                )
                if (decision.isBlocked && policy.notifyOnBlock) {
                    BlockNotifier.notifyBlocked(this, decision, CallDirection.OUTGOING)
                }
            }.onFailure { Log.e(TAG, "発信の記録に失敗しました（発信の処理そのものは完了しています）", it) }
        } catch (t: Throwable) {
            Log.e(TAG, "発信判定に失敗しました", t)
            if (!answered) {
                // まだ結論を返していない場合に限り、そのまま発信して宙吊りを防ぐ。
                runCatching { placeCallUnmodified() }
            }
        }
    }

    private companion object {
        const val TAG = "IntlCallRedirection"
    }
}
