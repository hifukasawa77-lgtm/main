import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// 判定ロジックだけを持つ純 Kotlin モジュール。
// Android SDK にも実機にも依存しないので、素の JVM でテストが回る。
plugins {
    alias(libs.plugins.kotlin.jvm)
}

// バイトコードの出力先を 17 に固定するだけに留め、ビルドに使う JDK は縛らない。
// `jvmToolchain(17)` にすると JDK 17 が入っていない環境（Android Studio 同梱が 21 の構成、
// CI の素の JDK など）で `:core:test` すら動かせなくなる。app 側と ABI を合わせるのに
// 必要なのは出力ターゲットの一致であって、ビルド JDK の一致ではない。
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
    }
}
