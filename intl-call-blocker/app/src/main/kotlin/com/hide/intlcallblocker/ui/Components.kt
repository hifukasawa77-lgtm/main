package com.hide.intlcallblocker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * すりガラス調のカード / Glassmorphism-style card.
 *
 * 半透明の面 ＋ 細い輪郭線で、黒背景から少しだけ浮かせる。
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    accent: Color = AppColors.Outline,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.verticalGradient(
                    listOf(
                        AppColors.SurfaceRaised.copy(alpha = 0.92f),
                        AppColors.Surface.copy(alpha = 0.92f),
                    ),
                ),
            )
            .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        content()
    }
}

/**
 * 日英併記のラベル / Bilingual label.
 *
 * 日本語を主、英語を従（小さく淡く）として 2 行で示す。
 */
@Composable
fun BilingualText(
    ja: String,
    en: String,
    modifier: Modifier = Modifier,
    emphasize: Boolean = false,
) {
    Column(modifier = modifier) {
        Text(
            text = ja,
            style = if (emphasize) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
            color = AppColors.OnBackground,
        )
        Text(
            text = en,
            style = MaterialTheme.typography.labelSmall,
            color = AppColors.Muted,
        )
    }
}

/** 見出し。左に細いアクセントバーを添える。 */
@Composable
fun SectionHeader(ja: String, en: String, accent: Color = AppColors.Cyan) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Spacer(
            Modifier
                .size(width = 3.dp, height = 22.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(accent),
        )
        Spacer(Modifier.width(10.dp))
        BilingualText(ja, en, emphasize = true)
    }
}

/** 状態を示す小さな丸。 */
@Composable
fun StatusDot(color: Color, modifier: Modifier = Modifier) {
    Spacer(
        modifier
            .size(9.dp)
            .clip(CircleShape)
            .background(color),
    )
}

/**
 * 設定 1 項目（説明 ＋ スイッチ）。
 *
 * @param enabled false のときはスイッチを触れなくする。必要な役割が未取得で
 *                その機能が実際には働かない場合に使う。
 */
@Composable
fun ToggleRow(
    ja: String,
    en: String,
    description: String,
    checked: Boolean,
    enabled: Boolean = true,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            BilingualText(ja, en)
            Spacer(Modifier.size(4.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = AppColors.Muted,
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedThumbColor = AppColors.Background,
                checkedTrackColor = AppColors.Cyan,
                checkedBorderColor = AppColors.Cyan,
                uncheckedThumbColor = AppColors.Muted,
                uncheckedTrackColor = AppColors.Surface,
                uncheckedBorderColor = AppColors.Outline,
            ),
        )
    }
}
