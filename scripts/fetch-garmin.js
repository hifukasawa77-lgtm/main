#!/usr/bin/env node
// Garmin Connect からヘルスデータを取得して garmin-data.json に書き出す
// 使用ライブラリ: garmin-connect (非公式API)
// 必要環境変数: GARMIN_EMAIL, GARMIN_PASSWORD
// 注意: NODE_TLS_REJECT_UNAUTHORIZED='0'（TLS検証無効化）は認証情報を扱うため禁止。
// ローカルのプロキシ環境でTLSエラーが出る場合は NODE_EXTRA_CA_CERTS でCA証明書を指定する。

const { GarminConnect } = require('garmin-connect');
const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, '..', 'garmin-data.json');
// OAuthトークンの保存先。GitHub Actionsでは actions/cache で毎時引き継ぐ。
// 毎時パスワードログインするとGarmin側のレート制限(429)に当たるため、
// 一度ログインに成功したらトークンを再利用してログイン自体を回避する。
const TOKEN_DIR = process.env.GARMIN_TOKEN_DIR || path.join(__dirname, '..', '.garmin-token');

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    console.error('GARMIN_EMAIL / GARMIN_PASSWORD が未設定です');
    process.exit(1);
  }

  let client = new GarminConnect({ username: email, password });
  let usedToken = false;
  try {
    client.loadTokenByFile(TOKEN_DIR);
    await client.getUserProfile(); // トークンが生きているか検証（期限切れは内部で自動リフレッシュ）
    usedToken = true;
    console.log('保存済みトークンで再開（パスワードログインをスキップ）');
  } catch (e) {
    console.log(`トークン再利用不可（${e.message}）→ パスワードログインします`);
    client = new GarminConnect({ username: email, password });
    await client.login();
    console.log('Garmin Connect ログイン成功');
  }

  const today = toDateStr(new Date());

  // 今日の統計
  const stats = await client.getUserStats(today).catch(() => null);

  // ストレスデータ
  const stressData = await client.getStress(today).catch(() => null);

  // 週間データ（月曜日起点）
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=日
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const weeklyStats = await client.getWeeklyStats(toDateStr(monday), today).catch(() => null);

  // 心拍
  const restingHR = stats?.restingHeartRate ?? null;

  // カロリー
  const totalCal = stats?.totalKilocalories ?? stats?.burnedCalorie ?? null;
  const activeCal = stats?.activeKilocalories ?? stats?.burnedCalorie ?? null;
  const bmrCal = totalCal !== null && activeCal !== null ? totalCal - activeCal : stats?.bmrKilocalories ?? null;

  // 週間運動量
  const weeklyMinutes =
    (weeklyStats?.moderateIntensityMinutes ?? 0) +
    (weeklyStats?.vigorousIntensityMinutes ?? 0) * 2;
  const weeklyGoal = weeklyStats?.weeklyGoalMinutes ?? 150;

  // アクティブな曜日
  const activeDays = [];
  if (weeklyStats?.days) {
    weeklyStats.days.forEach((d, i) => {
      if ((d.moderateIntensityMinutes ?? 0) + (d.vigorousIntensityMinutes ?? 0) > 0) {
        activeDays.push(i);
      }
    });
  }

  // ストレス現在値
  const currentStress = stressData?.overallStressLevel ?? stressData?.avgStressLevel ?? null;

  // 全カテゴリがnull＝APIが実質失敗している（無効トークン等）。
  // null塗りのJSONをコミットしないよう失敗扱いにする（トークンキャッシュも保存されない）。
  if (!stats && !stressData && !weeklyStats) {
    console.error('全データの取得に失敗しました（認証切れ・レート制限の可能性）');
    process.exit(1);
  }

  // 取得成功時はトークンを保存（リフレッシュ済みトークンの永続化を含む）
  client.exportTokenToFile(TOKEN_DIR);
  if (!usedToken) console.log('トークンを保存しました:', TOKEN_DIR);

  const output = {
    updated: new Date().toISOString(),
    heartRate: {
      resting: restingHR,
    },
    calories: {
      total: totalCal,
      active: activeCal,
      bmr: bmrCal,
    },
    weeklyExercise: {
      minutes: weeklyMinutes,
      goal: weeklyGoal,
      activeDays,
    },
    stress: {
      current: currentStress,
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log('garmin-data.json を更新しました:', output);
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
