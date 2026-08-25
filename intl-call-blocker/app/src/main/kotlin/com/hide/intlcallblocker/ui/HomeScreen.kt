package com.hide.intlcallblocker.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.item
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hide.intlcallblocker.data.CallRoles
import com.hide.intlcallblocker.data.ScreeningRepository

/**
 * 保護状況と遮断設定の画面 / Protection status and screening switches.
 *
 * **役割（Role）の取得状況を最上部に置く**のが要。設定をいくら入れても
 * 役割が無ければ 1 件も遮断されないので、そこを見落とすと
 * 「設定したのに国際電話が鳴る」という最悪の誤解が起きる。
 */
@Composable
fun HomeScreen(
    repository: ScreeningRepository,
    roleState: CallRoles.RoleState,
    onRequestRole: (String) -> Unit,
    onRequestNotificationPermission: () -> Unit,
) {
    val policy by repository.policy.collectAsStateWithLifecycle()
    val log by repository.log.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val blockedCount = log.count { it.blocked }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // ---------------------------------------------------------- 全体状況
        item {
            val protected = roleState.fullyProtected && !policy.isFullyDisabled
            val accent = when {
                protected -> AppColors.Cyan
                roleState.incomingProtected -> AppColors.Warning
                else -> AppColors.Danger
            }
            GlassCard(accent = accent) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusDot(accent)
                    Spacer(Modifier.width(10.dp))
                    BilingualText(
                        ja = when {
                            protected -> "国際電話を遮断中"
                            roleState.incomingProtected -> "一部だけ有効"
                            else -> "遮断は働いていません"
                        },
                        en = when {
                            protected -> "International calls are being blocked"
                            roleState.incomingProtected -> "Partially active"
                            else -> "Not protecting this device"
                        },
                        emphasize = true,
                    )
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    text = if (blockedCount > 0) {
                        "これまでに $blockedCount 件を遮断しました。\n$blockedCount call(s) blocked so far."
                    } else {
                        "まだ遮断した通話はありません。\nNo calls blocked yet."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = AppColors.Muted,
                )
            }
        }

        // ------------------------------------------------------ 役割の取得
        item { SectionHeader("端末の権限", "Device roles") }

        item {
            RoleCard(
                ja = "通話スクリーニング",
                en = "Call screening",
                description = "着信を呼び出し音より前に判定する役割。これが無いと着信の遮断は 1 件も効きません。",
                held = roleState.screeningHeld,
                available = roleState.screeningAvailable,
                onRequest = { onRequestRole(CallRoles.SCREENING) },
            )
        }

        item {
            RoleCard(
                ja = "発信リダイレクト",
                en = "Call redirection",
                description = "発信が回線に載る直前に判定する役割。これが無いと国際発信の抑止は効きません。",
                held = roleState.redirectionHeld,
                available = roleState.redirectionAvailable,
                onRequest = { onRequestRole(CallRoles.REDIRECTION) },
            )
        }

        // ---------------------------------------------------------- 遮断設定
        item { SectionHeader("遮断する対象", "What to block", AppColors.Purple) }

        item {
            GlassCard {
                ToggleRow(
                    ja = "国際着信を拒否",
                    en = "Block incoming international calls",
                    description = "日本（+81）以外の国番号からの着信を、呼び出し音を鳴らさずに切ります。",
                    checked = policy.blockInternationalIncoming,
                    enabled = roleState.screeningHeld,
                ) { v -> repository.updatePolicy { it.copy(blockInternationalIncoming = v) } }

                HorizontalDivider(color = AppColors.Outline)

                ToggleRow(
                    ja = "非通知・番号不明を拒否",
                    en = "Block withheld and unidentified numbers",
                    description = "非通知・公衆電話・圏外表示など、番号が取得できない着信を切ります。",
                    checked = policy.blockWithheldIncoming,
                    enabled = roleState.screeningHeld,
                ) { v -> repository.updatePolicy { it.copy(blockWithheldIncoming = v) } }

                HorizontalDivider(color = AppColors.Outline)

                ToggleRow(
                    ja = "国際発信を抑止",
                    en = "Block outgoing international calls",
                    description = "010 や +国番号 への発信を止めます。ワン切りへの折り返しによる高額請求を防ぎます。",
                    checked = policy.blockInternationalOutgoing,
                    enabled = roleState.redirectionHeld,
                ) { v -> repository.updatePolicy { it.copy(blockInternationalOutgoing = v) } }

                HorizontalDivider(color = AppColors.Outline)

                ToggleRow(
                    ja = "書式不明の番号も拒否",
                    en = "Also block unrecognised number formats",
                    description = "国内・国際のどちらとも判定できない番号を拒否します。取りこぼしは減りますが、正当な着信が落ちることがあります。",
                    checked = policy.blockUnknownFormatIncoming,
                    enabled = roleState.screeningHeld,
                ) { v -> repository.updatePolicy { it.copy(blockUnknownFormatIncoming = v) } }
            }
        }

        // -------------------------------------------------------- 遮断の仕方
        item { SectionHeader("遮断したときの動作", "How blocking behaves", AppColors.Purple) }

        item {
            GlassCard {
                ToggleRow(
                    ja = "切らずに着信音だけ鳴らさない",
                    en = "Silence instead of rejecting",
                    description = "相手には呼び出し中に見えます。オフのときは即座に切断します。",
                    checked = policy.silenceInsteadOfReject,
                ) { v -> repository.updatePolicy { it.copy(silenceInsteadOfReject = v) } }

                HorizontalDivider(color = AppColors.Outline)

                ToggleRow(
                    ja = "端末の通話履歴に残す",
                    en = "Keep in the device call log",
                    description = "オフのときはアプリ内の「記録」タブにだけ残ります。",
                    checked = policy.keepBlockedInCallLog,
                ) { v -> repository.updatePolicy { it.copy(keepBlockedInCallLog = v) } }

                HorizontalDivider(color = AppColors.Outline)

                ToggleRow(
                    ja = "端末の不在着信通知を出す",
                    en = "Keep the missed-call notification",
                    description = "オフのときは通知も出さず、完全に黙らせます。",
                    checked = policy.keepBlockedNotification,
                ) { v -> repository.updatePolicy { it.copy(keepBlockedNotification = v) } }

                HorizontalDivider(color = AppColors.Outline)

                ToggleRow(
                    ja = "遮断をアプリ通知で知らせる",
                    en = "Notify me when a call is blocked",
                    description = "音・バイブを鳴らさずに、遮断した相手を通知領域へ静かに残します。",
                    checked = policy.notifyOnBlock,
                ) { v ->
                    repository.updatePolicy { it.copy(notifyOnBlock = v) }
                    if (v) onRequestNotificationPermission()
                }
            }
        }

        // 通知を出す設定なのに権限が無いと、無言で何も出ない状態になる。
        val notificationBlocked = policy.notifyOnBlock &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED

        if (notificationBlocked) {
            item {
                GlassCard(accent = AppColors.Warning) {
                    BilingualText(
                        ja = "通知の権限がありません",
                        en = "Notification permission is missing",
                        emphasize = true,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "遮断をアプリ通知で知らせる設定になっていますが、通知の権限が無いため何も表示されません。",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.Muted,
                    )
                    TextButton(onClick = onRequestNotificationPermission) {
                        Text("権限を許可する / Grant permission", color = AppColors.Cyan)
                    }
                }
            }
        }

        // ------------------------------------------------------------ 注意書き
        item { SectionHeader("必ず知っておくこと", "Important limits", AppColors.Purple) }

        item {
            GlassCard {
                Caveat(
                    "緊急通報は必ず通ります",
                    "110 / 118 / 119 / 112 / 911 は、すべての設定を有効にしていても発着信ともに遮断しません。",
                )
                Caveat(
                    "発信者番号は偽装できます",
                    "国際発信を国内の番号に偽装した着信は、通信事業者の情報だけでは見分けられません。このアプリは端末に届いた番号で判定します。",
                )
                Caveat(
                    "役割は端末で 1 アプリだけ",
                    "他の迷惑電話対策アプリが同じ役割を持っている場合、そちらを解除しないとこのアプリは役割を取得できません。",
                )
                Caveat(
                    "判定の基準は日本の番号計画",
                    "+81 を自国、010 を国際発信プレフィックスとして扱います。海外の SIM で使う場合はこの前提が合いません。",
                )
            }
        }

        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun RoleCard(
    ja: String,
    en: String,
    description: String,
    held: Boolean,
    available: Boolean,
    onRequest: () -> Unit,
) {
    val accent: Color = if (held) AppColors.Cyan else AppColors.Danger
    GlassCard(accent = accent) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                StatusDot(accent)
                Spacer(Modifier.width(10.dp))
                BilingualText(ja, en)
            }
            Text(
                text = if (held) "取得済 / Held" else "未取得 / Not held",
                style = MaterialTheme.typography.labelSmall,
                color = accent,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(description, style = MaterialTheme.typography.bodyMedium, color = AppColors.Muted)

        if (!held) {
            Spacer(Modifier.height(10.dp))
            if (available) {
                Button(
                    onClick = onRequest,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.Cyan,
                        contentColor = AppColors.Background,
                    ),
                ) {
                    Text("この権限を許可する / Grant this role")
                }
            } else {
                Text(
                    "この端末ではこの役割を利用できません。\nThis role is not available on this device.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = AppColors.Warning,
                )
            }
        }
    }
}

@Composable
private fun Caveat(title: String, body: String) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            StatusDot(AppColors.Purple)
            Spacer(Modifier.width(8.dp))
            Text(title, style = MaterialTheme.typography.titleMedium, color = AppColors.OnBackground)
        }
        Spacer(Modifier.height(4.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium, color = AppColors.Muted)
    }
}
