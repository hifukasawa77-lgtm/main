const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const ASSET_DIR = path.join(ROOT, "assets", "black-fang");

function dataUrl(filePath) {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function writeDataUrl(filePath, value) {
  fs.writeFileSync(filePath, Buffer.from(value.replace(/^data:image\/png;base64,/, ""), "base64"));
}

async function processAtlas(page, sourceName, cols, rows, outputName, cellSize) {
  const result = await page.evaluate(async ({ src, cols, rows, cellSize }) => {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const isKey = (r, g, b) => g > 145 && r < 120 && b < 140 && g - r > 50 && g - b > 40;
    const output = document.createElement("canvas");
    output.width = cols * cellSize;
    output.height = rows * cellSize;
    const out = output.getContext("2d");
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = "high";

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x0 = Math.round(col * image.width / cols);
        const x1 = Math.round((col + 1) * image.width / cols);
        const y0 = Math.round(row * image.height / rows);
        const y1 = Math.round((row + 1) * image.height / rows);
        const cell = document.createElement("canvas");
        cell.width = x1 - x0;
        cell.height = y1 - y0;
        const ctx = cell.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, x0, y0, cell.width, cell.height, 0, 0, cell.width, cell.height);
        const pixels = ctx.getImageData(0, 0, cell.width, cell.height);
        let minX = cell.width;
        let minY = cell.height;
        let maxX = -1;
        let maxY = -1;
        for (let i = 0; i < pixels.data.length; i += 4) {
          const r = pixels.data[i];
          const g = pixels.data[i + 1];
          const b = pixels.data[i + 2];
          const p = i / 4;
          const px = p % cell.width;
          const py = Math.floor(p / cell.width);
          if (isKey(r, g, b)) {
            pixels.data[i + 3] = 0;
          } else {
            if (g > r + 24 && g > b + 24) pixels.data[i + 1] = Math.min(g, Math.max(r, b) + 18);
            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
          }
        }
        ctx.putImageData(pixels, 0, 0);
        if (maxX < 0) continue;
        const pad = 8;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(cell.width - sx, maxX - minX + 1 + pad * 2);
        const sh = Math.min(cell.height - sy, maxY - minY + 1 + pad * 2);
        const scale = Math.min((cellSize - 20) / sw, (cellSize - 20) / sh);
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        const dx = col * cellSize + Math.round((cellSize - dw) / 2);
        const dy = row * cellSize + cellSize - dh - 8;
        out.drawImage(cell, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
    return output.toDataURL("image/png");
  }, {
    src: dataUrl(path.join(ASSET_DIR, "source", sourceName)),
    cols,
    rows,
    cellSize
  });
  writeDataUrl(path.join(ASSET_DIR, outputName), result);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await processAtlas(page, "black-fang-weapon-props-source.png", 5, 1, "weapon-props-alpha.png", 320);
  await processAtlas(page, "black-fang-hero-weapon-actions-source.png", 5, 4, "hero-weapon-actions-alpha.png", 320);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
