package com.hide.intlcallblocker.data

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent

/**
 * 端末の「役割（Role）」の取得状況 / Telecom role acquisition state.
 *
 * このアプリは自前で着信を止められるわけではない。Android から
 * 通話スクリーニング／発信リダイレクトの役割を与えられている間だけ、
 * 通話の前段に割り込む機会をもらえる。**役割が無ければ全機能が無効**になるので、
 * 設定より前にここの状態を利用者へ見せる必要がある。
 *
 * 各役割は端末内で 1 アプリしか保持できない。他アプリ（迷惑電話対策アプリ等）が
 * 持っている場合は、そちらを外さない限り取得できない。
 */
object CallRoles {

    /** 着信スクリーニングの役割。これが無いと国際着信・非通知の遮断は一切効かない。 */
    const val SCREENING: String = RoleManager.ROLE_CALL_SCREENING

    /** 発信リダイレクトの役割。これが無いと国際発信の抑止は効かない。 */
    const val REDIRECTION: String = RoleManager.ROLE_CALL_REDIRECTION

    private fun manager(context: Context): RoleManager? =
        context.getSystemService(RoleManager::class.java)

    /** その役割がこの端末で扱えるか（機種・OS 構成によっては存在しない）。 */
    fun isAvailable(context: Context, role: String): Boolean =
        manager(context)?.isRoleAvailable(role) == true

    /** その役割を今このアプリが保持しているか。 */
    fun isHeld(context: Context, role: String): Boolean =
        manager(context)?.isRoleHeld(role) == true

    /**
     * 役割の付与をシステムに要求する Intent。
     * `startActivityForResult` 相当で投げると、OS の確認ダイアログが出る。
     * 付与を強制する方法は無く、利用者が拒否すれば取得できない。
     */
    fun requestIntent(context: Context, role: String): Intent? =
        manager(context)?.createRequestRoleIntent(role)

    /** 画面表示用に 2 つの役割の状態をまとめて取る。 */
    fun snapshot(context: Context): RoleState = RoleState(
        screeningAvailable = isAvailable(context, SCREENING),
        screeningHeld = isHeld(context, SCREENING),
        redirectionAvailable = isAvailable(context, REDIRECTION),
        redirectionHeld = isHeld(context, REDIRECTION),
    )

    /** 2 つの役割の取得状況。 */
    data class RoleState(
        val screeningAvailable: Boolean,
        val screeningHeld: Boolean,
        val redirectionAvailable: Boolean,
        val redirectionHeld: Boolean,
    ) {
        /** 着信側の遮断が実際に働く状態か。 */
        val incomingProtected: Boolean get() = screeningHeld

        /** 発信側の抑止が実際に働く状態か。 */
        val outgoingProtected: Boolean get() = redirectionHeld

        /** すべての役割が揃っているか。 */
        val fullyProtected: Boolean get() = screeningHeld && redirectionHeld
    }
}
