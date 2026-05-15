const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3978);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function createStore() {
  return {
    meetings: new Map(),
    transcripts: new Map(),
    summaries: new Map()
  };
}

const store = createStore();

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png"
  }[extension] || "application/octet-stream";
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!resolved.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(resolved, (error, data) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": getContentType(resolved),
      "Content-Length": data.length
    });
    res.end(data);
  });
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

function normalizeSegments(body) {
  if (!Array.isArray(body.segments)) {
    throw new Error("segments must be an array.");
  }
  return body.segments.map((segment, index) => ({
    speaker: requireString(segment.speaker, `segments[${index}].speaker`),
    text: maskSensitiveText(requireString(segment.text, `segments[${index}].text`)),
    timestamp: requireString(segment.timestamp, `segments[${index}].timestamp`)
  }));
}

function maskSensitiveText(text) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b0\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}\b/g, "[phone]");
}

function splitSentences(segments) {
  return segments
    .flatMap(segment => {
      const parts = segment.text
        .split(/(?<=[。！？!?])|\n+/)
        .map(text => text.trim())
        .filter(Boolean);
      return parts.map(text => ({
        speaker: segment.speaker,
        timestamp: segment.timestamp,
        text
      }));
    });
}

function pickLines(sentences, patterns, limit) {
  const seen = new Set();
  const results = [];
  for (const sentence of sentences) {
    if (!patterns.some(pattern => pattern.test(sentence.text))) {
      continue;
    }
    const line = `${sentence.speaker}: ${sentence.text}`;
    if (seen.has(line)) {
      continue;
    }
    seen.add(line);
    results.push(line);
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function buildActionItems(sentences, limit) {
  return pickLines(sentences, [
    /TODO|ToDo|タスク|宿題|対応|担当|やる|作成|確認|連絡|共有|まで|期限/i
  ], limit).map(line => {
    const ownerMatch = line.match(/^([^:：]+)[:：]/);
    const dueMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?|\d{1,2}月\d{1,2}日|来週|明日|今日)/);
    return {
      owner: ownerMatch ? ownerMatch[1].trim() : "未定",
      task: line.replace(/^([^:：]+)[:：]\s*/, ""),
      dueDate: dueMatch ? dueMatch[1] : "未定"
    };
  });
}

function summarizeTranscript(meeting, transcript, options = {}) {
  const maxBullets = Math.max(1, Math.min(Number(options.maxBullets || 8), 12));
  const sentences = splitSentences(transcript.segments || []);
  const allText = sentences.map(sentence => sentence.text).join(" ");

  const decisions = pickLines(sentences, [
    /決定|決め|合意|承認|採用|方針|確定|リリース|進める/
  ], maxBullets);
  const risks = pickLines(sentences, [
    /懸念|リスク|課題|問題|遅延|ブロック|不足|注意|依存/
  ], maxBullets);
  const openQuestions = pickLines(sentences, [
    /[?？]|未定|要確認|確認したい|どうする|検討|論点/
  ], maxBullets);
  const actionItems = options.includeActionItems === false
    ? []
    : buildActionItems(sentences, maxBullets);

  return {
    meetingId: meeting.meetingId,
    title: meeting.title,
    generatedAt: new Date().toISOString(),
    language: transcript.language,
    headline: createHeadline(meeting.title, allText),
    overview: createOverview(sentences, maxBullets),
    decisions: decisions.length ? decisions : ["明確な決定事項は検出されませんでした。"],
    actionItems,
    risks,
    openQuestions,
    source: {
      transcriptSegments: transcript.segments.length,
      summarizer: "local-rule-based-mvp"
    }
  };
}

function createHeadline(title, allText) {
  const first = allText.split(/[。！？!?]/).map(text => text.trim()).find(Boolean);
  if (!first) {
    return `${title} の議事録要約`;
  }
  return first.length > 70 ? `${first.slice(0, 70)}...` : first;
}

function createOverview(sentences, limit) {
  return sentences.slice(0, limit).map(sentence => `${sentence.speaker}: ${sentence.text}`);
}

function buildAdaptiveCard(summary) {
  return {
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: `議事録要約: ${summary.title}`,
        weight: "Bolder",
        size: "Medium",
        wrap: true
      },
      {
        type: "TextBlock",
        text: summary.headline,
        wrap: true
      },
      {
        type: "FactSet",
        facts: [
          { title: "決定事項", value: summary.decisions.slice(0, 3).join("\n") || "なし" },
          { title: "TODO", value: summary.actionItems.slice(0, 3).map(item => `${item.owner}: ${item.task}`).join("\n") || "なし" },
          { title: "懸念", value: summary.risks.slice(0, 3).join("\n") || "なし" }
        ]
      }
    ]
  };
}

function getMeetingIdFromRoute(pathname, suffix) {
  const prefix = "/api/meetings/";
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return null;
  }
  return decodeURIComponent(pathname.slice(prefix.length, -suffix.length));
}

async function handleApi(req, res, activeStore) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/meetings") {
    sendJson(res, 200, { meetings: Array.from(activeStore.meetings.values()) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/meetings") {
    const body = await readJson(req);
    const meeting = {
      meetingId: requireString(body.meetingId, "meetingId"),
      title: requireString(body.title, "title"),
      startedAt: requireString(body.startedAt, "startedAt"),
      createdAt: new Date().toISOString()
    };
    activeStore.meetings.set(meeting.meetingId, meeting);
    sendJson(res, 201, meeting);
    return;
  }

  const transcriptMeetingId = getMeetingIdFromRoute(pathname, "/transcripts");
  if (req.method === "POST" && transcriptMeetingId) {
    if (!activeStore.meetings.has(transcriptMeetingId)) {
      sendJson(res, 404, { error: "Meeting not found." });
      return;
    }
    const body = await readJson(req);
    const transcript = {
      meetingId: transcriptMeetingId,
      language: requireString(body.language, "language"),
      segments: normalizeSegments(body),
      updatedAt: new Date().toISOString()
    };
    activeStore.transcripts.set(transcriptMeetingId, transcript);
    activeStore.summaries.delete(transcriptMeetingId);
    sendJson(res, 202, {
      status: "accepted",
      meetingId: transcriptMeetingId,
      segments: transcript.segments.length
    });
    return;
  }

  const summarizeMeetingId = getMeetingIdFromRoute(pathname, "/summarize");
  if (req.method === "POST" && summarizeMeetingId) {
    const meeting = activeStore.meetings.get(summarizeMeetingId);
    const transcript = activeStore.transcripts.get(summarizeMeetingId);
    if (!meeting) {
      sendJson(res, 404, { error: "Meeting not found." });
      return;
    }
    if (!transcript) {
      sendJson(res, 409, { error: "Transcript is required before summarizing." });
      return;
    }
    const body = await readJson(req);
    const summary = summarizeTranscript(meeting, transcript, body);
    activeStore.summaries.set(summarizeMeetingId, summary);
    sendJson(res, 202, { status: "completed", summary });
    return;
  }

  const summaryMeetingId = getMeetingIdFromRoute(pathname, "/summary");
  if (req.method === "GET" && summaryMeetingId) {
    const summary = activeStore.summaries.get(summaryMeetingId);
    if (!summary) {
      sendJson(res, 404, { error: "Summary not found." });
      return;
    }
    sendJson(res, 200, summary);
    return;
  }

  const cardMeetingId = getMeetingIdFromRoute(pathname, "/adaptive-card");
  if (req.method === "GET" && cardMeetingId) {
    const summary = activeStore.summaries.get(cardMeetingId);
    if (!summary) {
      sendJson(res, 404, { error: "Summary not found." });
      return;
    }
    sendJson(res, 200, buildAdaptiveCard(summary));
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

function createServer(activeStore = store) {
  return http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      handleApi(req, res, activeStore).catch(error => {
        sendJson(res, 400, { error: error.message });
      });
      return;
    }
    serveStatic(req, res);
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`Teams minutes MVP running at http://localhost:${PORT}`);
  });
}

module.exports = {
  buildAdaptiveCard,
  createServer,
  createStore,
  maskSensitiveText,
  summarizeTranscript
};
