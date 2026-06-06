const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const assetDir = path.join(root, "assets", "kage-shura-gpt");
const sourcePath = path.join(assetDir, "source", "kage-shura-actors-atlas-source.png");
const actorDir = path.join(assetDir, "actors");
const propsSourcePath = path.join(assetDir, "source", "kage-shura-props-atlas-source.png");
const propsDir = path.join(assetDir, "props");
const names = [
  "hero-idle",
  "hero-run",
  "hero-jump",
  "hero-attack",
  "bandit",
  "yokai",
  "boss-oni",
  "hero-special",
];

function asDataUrl(filePath) {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function writeDataUrl(filePath, dataUrl) {
  fs.writeFileSync(filePath, Buffer.from(dataUrl.split(",")[1], "base64"));
}

(async () => {
  fs.mkdirSync(actorDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const outputs = await page.evaluate(async ({ src, names }) => {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const results = [];

    for (let index = 0; index < names.length; index++) {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x0 = Math.round((col * image.width) / 4);
      const x1 = Math.round(((col + 1) * image.width) / 4);
      const y0 = Math.round((row * image.height) / 2);
      const y1 = Math.round(((row + 1) * image.height) / 2);
      const width = x1 - x0;
      const height = y1 - y0;
      const cell = document.createElement("canvas");
      cell.width = width;
      cell.height = height;
      const ctx = cell.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, x0, y0, width, height, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height);
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i];
        const g = pixels.data[i + 1];
        const b = pixels.data[i + 2];
        const x = (i / 4) % width;
        const y = Math.floor(i / 4 / width);
        if (g > 145 && r < 120 && b < 140 && g - r > 50 && g - b > 40) {
          pixels.data[i + 3] = 0;
        } else {
          if (g > r + 24 && g > b + 24) {
            pixels.data[i + 1] = Math.min(g, Math.max(r, b) + 16);
          }
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      ctx.putImageData(pixels, 0, 0);
      if (index === 6) maxX = Math.min(maxX, width - 115);

      const out = document.createElement("canvas");
      out.width = 192;
      out.height = 256;
      const outCtx = out.getContext("2d");
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";
      if (maxX >= 0) {
        const pad = 10;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
        const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);
        const scale = Math.min(176 / sw, 240 / sh);
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        outCtx.drawImage(cell, sx, sy, sw, sh, Math.round((192 - dw) / 2), 250 - dh, dw, dh);
      }
      results.push({ name: names[index], dataUrl: out.toDataURL("image/png") });
    }
    return results;
  }, { src: asDataUrl(sourcePath), names });

  for (const output of outputs) {
    writeDataUrl(path.join(actorDir, `${output.name}.png`), output.dataUrl);
  }

  fs.mkdirSync(propsDir, { recursive: true });
  const propNames = [
    "ground",
    "bamboo",
    "branch",
    "spring",
    "falling",
    "scroll",
    "heal",
    "spirit",
  ];
  const propOutputs = await page.evaluate(async ({ src, names }) => {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const results = [];
    for (let index = 0; index < names.length; index++) {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x0 = Math.round((col * image.width) / 4);
      const x1 = Math.round(((col + 1) * image.width) / 4);
      const y0 = Math.round((row * image.height) / 2);
      const y1 = Math.round(((row + 1) * image.height) / 2);
      const width = x1 - x0;
      const height = y1 - y0;
      const cell = document.createElement("canvas");
      cell.width = width;
      cell.height = height;
      const ctx = cell.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, x0, y0, width, height, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height);
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i];
        const g = pixels.data[i + 1];
        const b = pixels.data[i + 2];
        const x = (i / 4) % width;
        const y = Math.floor(i / 4 / width);
        if (g > 145 && r < 120 && b < 140 && g - r > 50 && g - b > 40) {
          pixels.data[i + 3] = 0;
        } else {
          if (g > r + 24 && g > b + 24) {
            pixels.data[i + 1] = Math.min(g, Math.max(r, b) + 16);
          }
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      ctx.putImageData(pixels, 0, 0);
      const out = document.createElement("canvas");
      out.width = 256;
      out.height = 128;
      const outCtx = out.getContext("2d");
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";
      if (maxX >= 0) {
        const pad = 10;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
        const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);
        const scale = Math.min(240 / sw, 112 / sh);
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        outCtx.drawImage(cell, sx, sy, sw, sh, Math.round((256 - dw) / 2), 120 - dh, dw, dh);
      }
      results.push({ name: names[index], dataUrl: out.toDataURL("image/png") });
    }
    return results;
  }, { src: asDataUrl(propsSourcePath), names: propNames });

  for (const output of propOutputs) {
    writeDataUrl(path.join(propsDir, `${output.name}.png`), output.dataUrl);
  }
  await browser.close();
})();
