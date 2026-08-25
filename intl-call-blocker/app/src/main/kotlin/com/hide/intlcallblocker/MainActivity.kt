package com.hide.intlcallblocker

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.hide.intlcallblocker.data.CallRoles
import com.hide.intlcallblocker.data.ScreeningRepository
import com.hide.intlcallblocker.ui.AllowListScreen
import com.hide.intlcallblocker.ui.AppColors
import com.hide.intlcallblocker.ui.HomeScreen
import com.hide.intlcallblocker.ui.IntlCallBlockerTheme
import com.hide.intlcallblocker.ui.LogScreen

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            IntlCallBlockerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = AppColors.Background,
                ) {
                    AppRoot()
                }
            }
        }
    }
}

private enum class AppTab(val ja: String, val en: String) {
    HOME("保護", "Protection"),
    ALLOW("許可リスト", "Allow list"),
    LOG("記録", "Log"),
}

@Composable
private fun AppRoot() {
    val context = LocalContext.current
    val repository = remember { ScreeningRepository.get(context) }

    var selectedTab by remember { mutableIntStateOf(0) }

    // 役割の付与は OS の設定画面で行われるため、戻ってきたタイミングで読み直す。
    // これを怠ると「許可したのに未取得のまま表示される」という誤解を招く。
    var roleState by remember { mutableStateOf(CallRoles.snapshot(context)) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) roleState = CallRoles.snapshot(context)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val roleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        // 結果コードに関わらず実際の保持状況を見に行く（機種により結果が返らないことがある）。
        roleState = CallRoles.snapshot(context)
    }

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* 拒否されても遮断機能そのものには影響しない */ }

    Scaffold(
        containerColor = AppColors.Background,
        topBar = {
            Column(Modifier.background(AppColors.Background)) {
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = AppColors.Background,
                    contentColor = AppColors.Cyan,
                ) {
                    AppTab.entries.forEachIndexed { index, tab ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = {
                                Column {
                                    Text(tab.ja, style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        tab.en,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = AppColors.Muted,
                                    )
                                }
                            },
                        )
                    }
                }
            }
        },
    ) { insets ->
        Box(Modifier.padding(insets)) {
            when (AppTab.entries[selectedTab]) {
                AppTab.HOME -> HomeScreen(
                    repository = repository,
                    roleState = roleState,
                    onRequestRole = { role ->
                        CallRoles.requestIntent(context, role)?.let { roleLauncher.launch(it) }
                    },
                    onRequestNotificationPermission = {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    },
                )

                AppTab.ALLOW -> AllowListScreen(repository)
                AppTab.LOG -> LogScreen(repository)
            }
        }
    }
}
