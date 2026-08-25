#!/usr/bin/env bash
# 判定ロジック（core モジュール）の全テストを実行する。
#
# Android SDK も実機も不要。`--configure-on-demand` を付けるのが要点で、
# これが無いと Gradle は :app も構成しに行き、Android Gradle Plugin と
# Android SDK が無い環境では :core:test すら起動できない。
set -euo pipefail
cd "$(dirname "$0")"

GRADLE_CMD="./gradlew"
if [ ! -x "$GRADLE_CMD" ]; then
  GRADLE_CMD="gradle"
fi

"$GRADLE_CMD" :core:test --configure-on-demand "$@"

echo
echo "レポート: core/build/reports/tests/test/index.html"
