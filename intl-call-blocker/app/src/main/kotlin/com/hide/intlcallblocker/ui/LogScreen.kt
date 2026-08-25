package com.hide.intlcallblocker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.item
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hide.intlcallblocker.core.CallDirection
import com.hide.intlcallblocker.core.CallOrigin
import com.hide.intlcallblocker.core.CountryCodes
import com.hide.intlcallblocker.data.BlockLogEntry
import com.hide.intlcallblocker.data.ScreeningRepository
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 遮断・通過の記録 / Screening log.
 *
 * 端末の通話履歴に残さない運用が既定なので、ここが唯一の記録になる。
 * 「何をどういう理由で止めたか」を出さないと、誤遮断に気づけない。
 */
@Composable
fun LogScreen(repository: ScreeningRepository) {
    val log by repository.log.collectAsStateWithLifecycle()
    val formatter = remember { SimpleDateFormat("M/d HH:mm", Locale.getDefault()) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                SectionHeader("記録（${log.size} 件）", "Log (${log.size} entries)")
                if (log.isNotEmpty()) {
                    TextButton(onClick = { repository.clearLog() }) {
                        Text("消去 / Clear", color = AppColors.Danger)
                    }
                }
            }
        }

        if (log.isEmpty()) {
            item {
                GlassCard {
                    Text(
                        "まだ記録がありません。\nNothing recorded yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.Muted,
                    )
                }
            }
        }

        items(log, key = { it.timestampMillis.toString() + (it.e164 ?: "") + it.direction.name }) { entry ->
            LogRow(entry, formatter)
        }

        item {
            Spacer(Modifier.height(8.dp))
            Text(
                "記録は最新 ${ScreeningRepository.MAX_LOG_ENTRIES} 件まで保持します。\n" +
                    "Only the most recent ${ScreeningRepository.MAX_LOG_ENTRIES} entries are kept.",
                style = MaterialTheme.typography.bodyMedium,
                color = AppColors.Muted,
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun LogRow(entry: BlockLogEntry, formatter: SimpleDateFormat) {
    val accent = if (entry.blocked) AppColors.Danger else AppColors.Cyan
    GlassCard(accent = accent) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                StatusDot(accent)
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(
                        text = entry.e164 ?: "非通知 / Withheld",
                        style = MaterialTheme.typography.titleMedium,
                        color = AppColors.OnBackground,
                    )
                    val meta = buildString {
                        append(if (entry.direction == CallDirection.INCOMING) "着信" else "発信")
                        append("  ·  ")
                        append(formatter.format(Date(entry.timestampMillis)))
                        if (entry.origin == CallOrigin.INTERNATIONAL) {
                            append("  ·  ")
                            append(CountryCodes.label(entry.countryCode))
                        }
                    }
                    Text(meta, style = MaterialTheme.typography.bodyMedium, color = AppColors.Muted)
                }
            }
            Text(
                if (entry.blocked) "遮断" else "通過",
                style = MaterialTheme.typography.titleMedium,
                color = accent,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(reasonLabel(entry.reason), style = MaterialTheme.typography.bodyMedium, color = AppColors.Muted)
        entry.matchedRule?.let {
            Text("一致したルール: $it", style = MaterialTheme.typography.labelSmall, color = AppColors.Purple)
        }
    }
}
