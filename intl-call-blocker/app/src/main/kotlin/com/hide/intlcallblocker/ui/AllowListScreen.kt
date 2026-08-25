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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hide.intlcallblocker.core.AllowRule
import com.hide.intlcallblocker.core.CallDirection
import com.hide.intlcallblocker.core.CountryCodes
import com.hide.intlcallblocker.data.ScreeningRepository

/**
 * 許可リストと番号テスター / Allow list and a number tester.
 *
 * テスターを同じ画面に置くのは、追加したルールが**実際に効いているか**を
 * その場で確かめられるようにするため。ルールを入れたつもりで効いていない、
 * という失敗は着信が来るまで気づけない。
 */
@Composable
fun AllowListScreen(repository: ScreeningRepository) {
    val rules by repository.allowRules.collectAsStateWithLifecycle()
    val policy by repository.policy.collectAsStateWithLifecycle()

    var input by remember { mutableStateOf("") }
    var label by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { SectionHeader("例外として通す番号", "Numbers to always allow") }

        item {
            GlassCard {
                Text(
                    "国際遮断をかけたままでも、ここに載せた番号だけは通します。" +
                        "末尾に * を付けると前方一致になります（例: +8210* で韓国の携帯すべて）。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = AppColors.Muted,
                )
                Spacer(Modifier.height(12.dp))

                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it; error = null },
                    label = { Text("電話番号 / Phone number") },
                    placeholder = { Text("+1 202-555-0143") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    colors = fieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = label,
                    onValueChange = { label = it },
                    label = { Text("メモ（任意） / Label (optional)") },
                    placeholder = { Text("家族（NY）") },
                    singleLine = true,
                    colors = fieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )

                error?.let {
                    Spacer(Modifier.height(6.dp))
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = AppColors.Danger)
                }

                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        val rule = AllowRule(input.trim(), label.trim())
                        when {
                            !rule.isValid ->
                                error = "数字を 1 桁も含まない指定は、すべてを許可してしまうため登録できません。"

                            !repository.addAllowRule(rule) ->
                                error = "同じ番号がすでに登録されています。"

                            else -> {
                                input = ""; label = ""; error = null
                            }
                        }
                    },
                    enabled = input.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.Cyan,
                        contentColor = AppColors.Background,
                    ),
                ) {
                    Text("追加 / Add")
                }
            }
        }

        // ------------------------------------------------------- 番号テスター
        item { SectionHeader("この番号はどう扱われるか", "Test a number", AppColors.Purple) }

        item {
            val engine = remember(policy, rules) { repository.engine() }
            val probe = input.ifBlank { null }
            GlassCard(accent = AppColors.Purple) {
                if (probe == null) {
                    Text(
                        "上の入力欄に番号を入れると、いまの設定でどう判定されるかをここに表示します。\n" +
                            "Type a number above to see how it would be handled right now.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.Muted,
                    )
                } else {
                    for (direction in CallDirection.entries) {
                        val decision = engine.decide(probe, direction)
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    if (direction == CallDirection.INCOMING) "着信 / Incoming" else "発信 / Outgoing",
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Text(
                                    reasonLabel(decision.reason),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = AppColors.Muted,
                                )
                            }
                            Text(
                                if (decision.isBlocked) "遮断 / Blocked" else "通す / Allowed",
                                style = MaterialTheme.typography.titleMedium,
                                color = if (decision.isBlocked) AppColors.Danger else AppColors.Cyan,
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                    val c = engine.classify(probe)
                    Text(
                        "判定: ${originLabel(c.origin)}" +
                            (c.e164?.let { "  ·  $it" } ?: "") +
                            (c.countryCode?.let { "  ·  ${CountryCodes.label(it)}" } ?: ""),
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.Purple,
                    )
                }
            }
        }

        // ------------------------------------------------------------ 一覧
        item {
            SectionHeader("登録済み（${rules.size} 件）", "Registered entries (${rules.size})")
        }

        if (rules.isEmpty()) {
            item {
                GlassCard {
                    Text(
                        "まだ登録がありません。国際電話はすべて遮断されます。\n" +
                            "No entries yet — every international call is blocked.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.Muted,
                    )
                }
            }
        }

        items(rules, key = { it.pattern }) { rule ->
            GlassCard {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(rule.pattern, style = MaterialTheme.typography.titleMedium)
                        val note = buildString {
                            if (rule.label.isNotEmpty()) append(rule.label)
                            if (rule.isPrefix) {
                                if (isNotEmpty()) append("  ·  ")
                                append("前方一致 / prefix match")
                            }
                        }
                        if (note.isNotEmpty()) {
                            Text(note, style = MaterialTheme.typography.bodyMedium, color = AppColors.Muted)
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    TextButton(onClick = { repository.removeAllowRule(rule) }) {
                        Text("削除 / Remove", color = AppColors.Danger)
                    }
                }
            }
        }

        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = AppColors.Cyan,
    unfocusedBorderColor = AppColors.Outline,
    focusedLabelColor = AppColors.Cyan,
    unfocusedLabelColor = AppColors.Muted,
    focusedTextColor = AppColors.OnBackground,
    unfocusedTextColor = AppColors.OnBackground,
    cursorColor = AppColors.Cyan,
)
