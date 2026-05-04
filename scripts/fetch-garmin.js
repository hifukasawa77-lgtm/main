#!/usr/bin/env node
// Garmin Connect からヘルスデータを取得して garmin-data.json に書き出す
// 使用ライブラリ: garmin-connect (非公式API)
// 必要環境変数: GARMIN_EMAIL, GARMIN_PASSWORD

const { GarminConnect } = require('garmin-connect');
const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, '..', 'garmin-data.json');

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

  const client = new GarminConnect({ username: email, password });
  await client.login();
  console.log('Garmin Connect ログイン成功');

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
