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
 * - **[placeCallUnmodified] / [redirectCall] / [cancelCall] のいずれか 1 つを必ず呼ぶ**。
 *   呼ばないと発信が止まったままになる。例外時は「そのまま発信」へ倒す。
 * - 緊急通報と MMI / USSD コードは絶対に横取りしない（判定エンジン側で保証している）。
 * - 数秒で返す。
 */
class IntlCallRedirectionService : CallRedirectionService() {

    override fun onPlaceCall(
        handle: Uri,
        initialPhoneAccount: PhoneAccountHandle,
        allowInteractiveResponse: Boolean,
    ) {
        try {
            place(handle)
        } catch (t: Throwable) {
            // 判定に失敗したら発信はそのまま通す。止めたままにする方が危険。
            Log.e(TAG, "発信判定に失敗したためそのまま発信します", t)
            runCatching { placeCallUnmodified() }
        }
    }

    private fun place(handle: Uri) {
        val repository = ScreeningRepository.get(this)
        val policy = repository.policy.value

        val decision = repository.engine()
            .decide(handle.schemeSpecificPart, CallDirection.OUTGOING, numberPresented = true)

        if (decision.isBlocked) {
            cancelCall()
            repository.record(
                BlockLogEntry.from(decision, CallDirection.OUTGOING, System.currentTimeMillis()),
            )
            if (policy.notifyOnBlock) {
                BlockNotifier.notifyBlocked(this, decision, CallDirection.OUTGOING)
            }
        } else {
            placeCallUnmodified()
        }
    }

    private companion object {
        const val TAG = "IntlCallRedirection"
    }
}
