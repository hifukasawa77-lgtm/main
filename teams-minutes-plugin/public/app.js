const sampleTranscript = [
  "深澤: Teamsプラグイン版はまずMVPとして進める方針で決定しました。",
  "佐藤: Graph APIの権限は録画と文字起こし取得に絞り、山田さんが5月20日までに確認します。",
  "山田: 懸念はテナントごとの管理者同意と、会議データの保存期間です。",
  "深澤: 要約は決定事項、TODO、リスク、未決事項に分けたいです。",
  "佐藤: Botから会議チャットへAdaptive Cardで投稿する案を検討しますか？"
].join("\n");

const statusEl = document.querySelector("#api-status");
const form = document.querySelector("#meeting-form");
const summaryEl = document.querySelector("#summary");
const emptyEl = document.querySelector("#summary-empty");
const transcriptEl = document.querySelector("#transcript");
const copyCardButton = document.querySelector("#copy-card");

let latestMeetingId = null;

document.querySelector("#load-sample").addEventListener("click", () => {
  transcriptEl.value = sampleTranscript;
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(form);
  const meetingId = data.get("meetingId").trim();
  const title = data.get("title").trim();
  const language = data.get("language");
  const maxBullets = Number(data.get("maxBullets") || 8);
  const includeActionItems = data.get("includeActionItems") === "on";
  const transcript = data.get("transcript").trim();

  setStatus("Generating...", "");

  try {
    await api("/api/meetings", {
      method: "POST",
      body: {
        meetingId,
        title,
        startedAt: new Date().toISOString()
      }
    });

    await api(`/api/meetings/${encodeURIComponent(meetingId)}/transcripts`, {
      method: "POST",
      body: {
        language,
        segments: toSegments(transcript)
      }
    });

    const result = await api(`/api/meetings/${encodeURIComponent(meetingId)}/summarize`, {
      method: "POST",
      body: {
        maxBullets,
        includeActionItems
      }
    });

    latestMeetingId = meetingId;
    renderSummary(result.summary);
    setStatus("API connected", "ok");
  } catch (error) {
    setStatus("API error", "error");
    showError(error.message);
  }
});

copyCardButton.addEventListener("click", async () => {
  if (!latestMeetingId) {
    return;
  }
  const card = await api(`/api/meetings/${encodeURIComponent(latestMeetingId)}/adaptive-card`);
  await navigator.clipboard.writeText(JSON.stringify(card, null, 2));
  copyCardButton.textContent = "Copied";
  window.setTimeout(() => {
    copyCardButton.textContent = "Copy card JSON";
  }, 1400);
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Request failed.");
  }
  return body;
}

function toSegments(text) {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
      return {
        speaker: match ? match[1].trim() : "Speaker",
        text: match ? match[2].trim() : line,
        timestamp: new Date(Date.now() + index * 1000).toISOString()
      };
    });
}

function renderSummary(summary) {
  emptyEl.hidden = true;
  summaryEl.hidden = false;
  summaryEl.innerHTML = "";

  summaryEl.append(
    section("Headline", [
      `<div class="headline">${escapeHtml(summary.headline)}</div>`,
      `<div class="meta">${escapeHtml(summary.title)} / ${escapeHtml(summary.generatedAt)}</div>`
    ].join(""))
  );
  summaryEl.append(section("Overview / 概要", list(summary.overview)));
  summaryEl.append(section("Decisions / 決定事項", list(summary.decisions)));
  summaryEl.append(section("Action items / TODO", list(summary.actionItems.map(item => `${item.owner}: ${item.task} (期限: ${item.dueDate})`))));
  summaryEl.append(section("Risks / 懸念点", list(summary.risks.length ? summary.risks : ["検出なし"])));
  summaryEl.append(section("Open questions / 未決事項", list(summary.openQuestions.length ? summary.openQuestions : ["検出なし"])));
}

function section(title, content) {
  const element = document.createElement("section");
  element.className = "summary-section";
  element.innerHTML = `<h3>${escapeHtml(title)}</h3>${content}`;
  return element;
}

function list(items) {
  return `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showError(message) {
  emptyEl.hidden = true;
  summaryEl.hidden = false;
  summaryEl.innerHTML = "";
  summaryEl.append(section("Error", `<p>${escapeHtml(message)}</p>`));
}

function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = `status-pill ${className}`.trim();
}

function drawParticles() {
  const canvas = document.querySelector("#particles");
  const ctx = canvas.getContext("2d");
  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: 1 + Math.random() * 2,
    speed: 0.0008 + Math.random() * 0.0016
  }));

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const particle of particles) {
      particle.y = (particle.y + particle.speed) % 1;
      const x = particle.x * canvas.width;
      const y = particle.y * canvas.height;
      ctx.fillStyle = "rgba(160, 224, 255, 0.42)";
      ctx.beginPath();
      ctx.arc(x, y, particle.size * window.devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  resize();
  tick();
}

async function checkHealth() {
  try {
    await api("/api/health");
    setStatus("API connected", "ok");
  } catch (error) {
    setStatus("API offline", "error");
  }
}

transcriptEl.value = sampleTranscript;
drawParticles();
checkHealth();
