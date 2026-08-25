package com.hide.intlcallblocker.service

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.hide.intlcallblocker.MainActivity
import com.hide.intlcallblocker.R
import com.hide.intlcallblocker.core.CallDecision
import com.hide.intlcallblocker.core.CallDirection
import com.hide.intlcallblocker.core.CallOrigin
import com.hide.intlcallblocker.core.CountryCodes

/**
 * 遮断したことを静かに知らせる通知 / Silent notification for a blocked call.
 *
 * 端末側の着信通知は既定で抑止する運用なので、これが無いと利用者は
 * 「何が起きたのか」を全く知れない。音・バイブは鳴らさず、履歴だけ残す。
 */
object BlockNotifier {

    private const val CHANNEL_ID = "blocked_calls"
    private const val NOTIFICATION_ID = 4081

    fun notifyBlocked(context: Context, decision: CallDecision, direction: CallDirection) {
        if (!hasPermission(context)) return

        ensureChannel(context)

        val title = when (direction) {
            CallDirection.INCOMING -> context.getString(R.string.notif_blocked_incoming_title)
            CallDirection.OUTGOING -> context.getString(R.string.notif_blocked_outgoing_title)
        }

        val body = when (decision.origin) {
            CallOrigin.WITHHELD -> context.getString(R.string.notif_body_withheld)
            else -> {
                val number = decision.e164 ?: context.getString(R.string.label_unknown_number)
                val country = CountryCodes.label(decision.countryCode)
                context.getString(R.string.notif_body_number, number, country)
            }
        }

        val openApp = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_blocked)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .setAutoCancel(true)
            .setContentIntent(openApp)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        }
    }

    private fun hasPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.notif_channel_name),
            // 音もバイブも鳴らさない。遮断は静かに済ませるのが目的なので割り込ませない。
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = context.getString(R.string.notif_channel_description)
            setSound(null, null)
            enableVibration(false)
        }
        manager.createNotificationChannel(channel)
    }
}
