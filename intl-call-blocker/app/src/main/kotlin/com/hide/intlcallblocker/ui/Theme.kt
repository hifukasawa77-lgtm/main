package com.hide.intlcallblocker.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * 配色 / Palette.
 *
 * 黒背景 ＋ シアン・パープル系アクセント。発光は控えめに保ち、
 * ネオン過多のサイバーパンク調にはしない。
 */
object AppColors {
    val Background = Color(0xFF07070B)
    val Surface = Color(0xFF12121A)
    val SurfaceRaised = Color(0xFF191924)
    val Outline = Color(0xFF2A2A38)

    /** 主アクセント（シアン）。有効・保護されている状態を表す。 */
    val Cyan = Color(0xFF22D3EE)

    /** 副アクセント（パープル）。補助情報・リンクに使う。 */
    val Purple = Color(0xFFA78BFA)

    /** 遮断・警告。 */
    val Danger = Color(0xFFF87171)

    /** 注意（役割が未取得など、機能が働いていない状態）。 */
    val Warning = Color(0xFFFBBF24)

    val OnBackground = Color(0xFFE7E7EE)
    val Muted = Color(0xFF9A9AAB)
}

private val DarkScheme = darkColorScheme(
    primary = AppColors.Cyan,
    onPrimary = Color(0xFF04222A),
    secondary = AppColors.Purple,
    onSecondary = Color(0xFF1B1233),
    background = AppColors.Background,
    onBackground = AppColors.OnBackground,
    surface = AppColors.Surface,
    onSurface = AppColors.OnBackground,
    surfaceVariant = AppColors.SurfaceRaised,
    onSurfaceVariant = AppColors.Muted,
    outline = AppColors.Outline,
    error = AppColors.Danger,
)

private val AppTypography = Typography(
    titleLarge = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.2.sp),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 13.sp, lineHeight = 19.sp),
    labelSmall = TextStyle(fontSize = 11.sp, letterSpacing = 0.4.sp),
)

/**
 * 常にダークで表示する。端末がライトテーマでも配色は変えない
 * （黒背景前提で明度差を設計しているため）。
 */
@Composable
fun IntlCallBlockerTheme(
    @Suppress("UNUSED_PARAMETER") darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = DarkScheme,
        typography = AppTypography,
        content = content,
    )
}
