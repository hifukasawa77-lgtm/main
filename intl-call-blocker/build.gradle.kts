// ルートではプラグインを宣言しない。
//
// ここで Android Gradle Plugin を `apply false` で宣言してしまうと、`:core` だけを
// ビルドしたいときにもルートの構成で AGP の解決が走り、Android SDK が無い環境
// （CI の軽量ジョブなど）で `:core:test` すら実行できなくなる。
// 版は gradle/libs.versions.toml に集約し、適用は各モジュールで行う。
