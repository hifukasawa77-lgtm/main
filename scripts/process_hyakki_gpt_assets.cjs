const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const ASSET_DIR = path.join(ROOT, "assets", "hyakki-gpt");
const POSES = ["idle", "walk", "jump", "punch", "kick", "weapon", "special", "throw"];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeDataUrl(filePath, dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
}

function imageDataUrl(filePath) {
  const data = fs.readFileSync(filePath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (let charId = 0; charId < 5; charId++) {
    const sheetPath = fs
      .readdirSync(path.join(ASSET_DIR, "sheets"))
      .find((name) => name.startsWith(`char-${charId}-`) && name.endsWith("-sheet-source.png"));
    if (!sheetPath) throw new Error(`Missing sheet for char-${charId}`);

    const outDir = path.join(ASSET_DIR, `char-${charId}`);
    ensureDir(outDir);

    const results = await page.evaluate(
      async ({ src, poses }) => {
        const loadImage = (url) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });

        const isKey = (r, g, b) =>
          g > 145 && r < 115 && b < 135 && g - r > 55 && g - b > 45;

        const img = await loadImage(src);
        const outputs = [];
        const columns = 4;
        const rows = 2;

        for (let i = 0; i < poses.length; i++) {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const x0 = Math.round((col * img.width) / columns);
          const x1 = Math.round(((col + 1) * img.width) / columns);
          const y0 = Math.round((row * img.height) / rows);
          const y1 = Math.round(((row + 1) * img.height) / rows);
          const cellW = x1 - x0;
          const cellH = y1 - y0;

          const cell = document.createElement("canvas");
          cell.width = cellW;
          cell.height = cellH;
          const cctx = cell.getContext("2d", { willReadFrequently: true });
          cctx.drawImage(img, x0, y0, cellW, cellH, 0, 0, cellW, cellH);

          const imageData = cctx.getImageData(0, 0, cellW, cellH);
          const data = imageData.data;
          let minX = cellW;
          let minY = cellH;
          let maxX = -1;
          let maxY = -1;

          for (let p = 0; p < data.length; p += 4) {
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const px = (p / 4) % cellW;
            const py = Math.floor(p / 4 / cellW);
            if (isKey(r, g, b)) {
              data[p + 3] = 0;
            } else {
              if (g > r + 24 && g > b + 24) {
                data[p + 1] = Math.min(g, Math.max(r, b) + 18);
              }
              if (px < minX) minX = px;
              if (py < minY) minY = py;
              if (px > maxX) maxX = px;
              if (py > maxY) maxY = py;
            }
          }
          cctx.putImageData(imageData, 0, 0);

          const out = document.createElement("canvas");
          out.width = 256;
          out.height = 341;
          const octx = out.getContext("2d");
          octx.clearRect(0, 0, out.width, out.height);
          octx.imageSmoothingEnabled = true;
          octx.imageSmoothingQuality = "high";

          if (maxX >= 0) {
            const pad = 12;
            const sx = Math.max(0, minX - pad);
            const sy = Math.max(0, minY - pad);
            const sw = Math.min(cellW - sx, maxX - minX + 1 + pad * 2);
            const sh = Math.min(cellH - sy, maxY - minY + 1 + pad * 2);
            const scale = Math.min(236 / sw, 321 / sh);
            const dw = Math.round(sw * scale);
            const dh = Math.round(sh * scale);
            const dx = Math.round((out.width - dw) / 2);
            const dy = Math.round(out.height - dh - 6);
            octx.drawImage(cell, sx, sy, sw, sh, dx, dy, dw, dh);
          }

          outputs.push({ pose: poses[i], dataUrl: out.toDataURL("image/png") });
        }
        return outputs;
      },
      {
        src: imageDataUrl(path.join(ASSET_DIR, "sheets", sheetPath)),
        poses: POSES,
      },
    );

    for (const result of results) {
      const outPath = path.join(outDir, `${result.pose}.png`);
      writeDataUrl(outPath, result.dataUrl);
      if (result.pose === "idle") {
        writeDataUrl(path.join(ASSET_DIR, `hyakki-char-${charId}.png`), result.dataUrl);
      }
    }
  }

  const thumbDataUrl = await page.evaluate(async ({ src }) => {
    const loadImage = (url) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    const img = await loadImage(src);
    const out = document.createElement("canvas");
    out.width = 1200;
    out.height = 630;
    const ctx = out.getContext("2d");
    const targetRatio = out.width / out.height;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;
    if (img.width / img.height > targetRatio) {
      sw = Math.round(img.height * targetRatio);
      sx = Math.round((img.width - sw) / 2);
    } else {
      sh = Math.round(img.width / targetRatio);
      sy = Math.round((img.height - sh) / 2);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }, { src: imageDataUrl(path.join(ASSET_DIR, "hyakki-title-key-art-gpt-image-2.png")) });

  writeDataUrl(path.join(ASSET_DIR, "hyakki-thumb-gpt-image-2.png"), thumbDataUrl);

  await browser.close();
})();
