const assert = require("assert");
const {
  createServer,
  createStore,
  maskSensitiveText,
  summarizeTranscript
} = require("./server");

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

async function withServer(testFn) {
  const server = createServer(createStore());
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await testFn(baseUrl);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function run() {
  assert.strictEqual(
    maskSensitiveText("連絡先は test@example.com と 090-1234-5678 です"),
    "連絡先は [email] と [phone] です"
  );

  const summary = summarizeTranscript(
    { meetingId: "m-1", title: "週次会議" },
    {
      language: "ja-JP",
      segments: [
        {
          speaker: "佐藤",
          timestamp: "2026-05-13T10:00:00Z",
          text: "新機能は6月に進める方針で合意しました。山田さんは5月20日までに見積作成をお願いします。懸念はAPI権限です。"
        }
      ]
    },
    { includeActionItems: true }
  );
  assert.strictEqual(summary.meetingId, "m-1");
  assert.ok(summary.decisions[0].includes("合意"));
  assert.ok(summary.actionItems[0].task.includes("見積作成"));
  assert.ok(summary.risks[0].includes("懸念"));

  await withServer(async baseUrl => {
    let result = await request(baseUrl, "/api/meetings", {
      method: "POST",
      body: JSON.stringify({
        meetingId: "demo",
        title: "Teams連携確認",
        startedAt: "2026-05-13T10:00:00Z"
      })
    });
    assert.strictEqual(result.response.status, 201);

    result = await request(baseUrl, "/api/meetings/demo/transcripts", {
      method: "POST",
      body: JSON.stringify({
        language: "ja-JP",
        segments: [
          {
            speaker: "深澤",
            text: "今日は議事録プラグインをMVPとして進める方針で決定。山田さんは明日までにGraph権限を確認してください。",
            timestamp: "2026-05-13T10:01:00Z"
          }
        ]
      })
    });
    assert.strictEqual(result.response.status, 202);

    result = await request(baseUrl, "/api/meetings/demo/summarize", {
      method: "POST",
      body: JSON.stringify({ maxBullets: 5, includeActionItems: true })
    });
    assert.strictEqual(result.response.status, 202);
    assert.strictEqual(result.body.status, "completed");
    assert.ok(result.body.summary.decisions[0].includes("決定"));

    result = await request(baseUrl, "/api/meetings/demo/adaptive-card");
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.type, "AdaptiveCard");
  });
}

run()
  .then(() => {
    console.log("All tests passed.");
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
