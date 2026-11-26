import { WIDTH, HEIGHT, BUMPERS, TARGETS, RAILS, SLINGS, POSTS, tip, clamp } from './engine.mjs';

const TAU = Math.PI * 2;
const CYAN = '#8deaff';
const VIOLET = '#c8afff';
const GOLD = '#ffd68d';

function line(ctx, points, width, color) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function circle(ctx, x, y, r, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function panel(ctx, x, y, width, height, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 7);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function label(ctx, text, x, y, color, font) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function paintBackdrop(ctx) {
  const field = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  field.addColorStop(0, '#162442');
  field.addColorStop(.42, '#0b102b');
  field.addColorStop(1, '#18182e');
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const nebula = ctx.createRadialGradient(255, 290, 30, 255, 290, 280);
  nebula.addColorStop(0, '#5346819b');
  nebula.addColorStop(.53, '#24375865');
  nebula.addColorStop(1, '#18244100');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  let seed = 4827;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 160; i++) {
    const x = random() * WIDTH;
    const y = random() * HEIGHT;
    const radius = .28 + random() ** 3 * 1.3;
    ctx.globalAlpha = .24 + random() * .61;
    circle(ctx, x, y, radius, i % 4 === 0 ? GOLD : CYAN);
  }
  ctx.globalAlpha = 1;

  // Perspective grid and the planet's rings are painted once per resize.
  for (let i = -5; i <= 5; i++) line(ctx, [230 + i * 24, 416, 230 + i * 92, 680], 1, '#6673a326');
  for (const y of [420, 433, 452, 477, 510, 553, 610, 680]) line(ctx, [22, y, 432, y], 1, '#6673a32d');
  ctx.save();
  ctx.translate(228, 376);
  ctx.rotate(-.29);
  for (const [rx, ry] of [[159, 42], [142, 33], [124, 27]]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = '#b2a2e468';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  ctx.restore();
  const planet = ctx.createRadialGradient(192, 339, 3, 232, 378, 87);
  planet.addColorStop(0, '#6c7ca9');
  planet.addColorStop(.48, '#3b4877');
  planet.addColorStop(1, '#141c3d');
  circle(ctx, 228, 376, 72, planet, '#92a7db72', 1.4);
  ctx.save();
  ctx.translate(228, 376);
  ctx.rotate(-.29);
  for (const [rx, ry] of [[159, 42], [142, 33], [124, 27]]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
    ctx.strokeStyle = '#c1b6ee9a';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  ctx.restore();

  ctx.lineCap = 'round';
  for (const rail of RAILS) {
    line(ctx, rail, 11, '#050a1c');
    line(ctx, rail, 6, '#45577e');
    line(ctx, rail, 2, '#a0b8db');
  }
  for (const [x, y, radius] of POSTS) {
    circle(ctx, x, y, radius + 3, '#101528', '#5b6a92', 2);
    circle(ctx, x, y, radius - 1, '#36446c', '#8d9ec4', 1);
    circle(ctx, x - 2, y - 2, 2, '#c3d2eb');
  }
  for (const [index, sling] of SLINGS.entries()) {
    const [x, y, tx, ty] = sling;
    const side = index === 0 ? -22 : 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.lineTo(x + side, ty - 28);
    ctx.closePath();
    ctx.fillStyle = '#302451';
    ctx.fill();
    ctx.strokeStyle = '#66578d';
    ctx.lineWidth = 2;
    ctx.stroke();
    line(ctx, sling, 4, '#a491dc');
  }
  panel(ctx, 178, 51, 104, 25, '#121c37', '#69799b');
  label(ctx, 'ORBITAL STATION', 230, 64, '#d0dcfb', '700 10px monospace');
  label(ctx, 'REACTOR', 229, 288, '#b3c0e1', '700 11px monospace');
  label(ctx, 'ORBITAL ARRAY', 228, 472, '#b3c0e1', '700 12px monospace');
  label(ctx, 'DRAIN', 240, 669, '#8795b6', '700 10px monospace');
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.backdrop = document.createElement('canvas');
    this.particles = [];
    this.ripples = [];
    this.popups = [];
    this.bumperFlash = [0, 0, 0];
    this.shake = 0;
    this.quality = 2;
    this.reduced = false;
    this.scale = 0;
    this.ballSprites = [];
  }

  resize() {
    const scale = Math.min(1.65, Math.max(.68, this.canvas.clientWidth * Math.min(devicePixelRatio, 1.65) / WIDTH));
    const width = Math.round(WIDTH * scale);
    if (this.canvas.width === width && this.scale) return;
    const height = Math.round(HEIGHT * scale);
    this.scale = scale;
    this.canvas.width = this.backdrop.width = width;
    this.canvas.height = this.backdrop.height = height;
    const ctx = this.backdrop.getContext('2d', { alpha: false });
    ctx.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
    paintBackdrop(ctx);

    this.ballSprites = [CYAN, VIOLET, GOLD].map(color => {
      const sprite = document.createElement('canvas');
      const size = Math.round(42 * scale);
      sprite.width = sprite.height = size;
      const brush = sprite.getContext('2d');
      brush.scale(size / 42, size / 42);
      const aura = brush.createRadialGradient(21, 21, 3, 21, 21, 20);
      aura.addColorStop(0, color);
      aura.addColorStop(.43, color + '86');
      aura.addColorStop(1, color + '00');
      circle(brush, 21, 21, 20, aura);
      const glass = brush.createRadialGradient(18, 17, 0, 21, 21, 8);
      glass.addColorStop(0, '#ffffff');
      glass.addColorStop(.46, '#eff8ff');
      glass.addColorStop(.78, color);
      glass.addColorStop(1, '#4a6492');
      circle(brush, 21, 21, 7.5, glass, '#f0f8ff', .65);
      return sprite;
    });
  }

  setReduced(reduced) {
    this.reduced = reduced;
    if (reduced) this.clear();
  }

  clear() {
    this.particles.length = this.ripples.length = this.popups.length = 0;
    this.bumperFlash.fill(0);
    this.shake = 0;
  }

  event(event) {
    const { type, index, x, y, power } = event;
    if (type === 'score') {
      if (this.popups.length >= 12) this.popups.shift();
      if (!this.reduced) this.popups.push({ x: clamp(x, 35, 445), y: y - 12, value: event.points, life: .75 });
    }
    if (type === 'nudge' && !this.reduced && this.quality > 0) this.shake = .14;
    if (type === 'bumper') {
      this.bumperFlash[index] = this.reduced ? .07 : .23;
      if (!this.reduced && this.quality > 0 && this.ripples.length < 10) this.ripples.push({ x, y, life: .36, color: BUMPERS[index].color });
    }

    if (this.reduced || this.quality === 0 || !['bumper', 'sling', 'target', 'strike', 'rail', 'transfer'].includes(type)) return;
    const cap = this.quality === 2 ? 100 : 38;
    const count = type === 'rail' ? (power > .4 ? 3 : 1) : this.quality === 2 ? 13 : 6;
    const color = type === 'target' ? GOLD : type === 'bumper' ? BUMPERS[index].color : CYAN;
    for (let i = 0; i < count && this.particles.length < cap; i++) {
      const angle = Math.random() * TAU;
      const speed = 29 + Math.random() * 200;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .24 + Math.random() * .17, color });
    }
  }

  update(dt, game) {
    this.shake = Math.max(0, this.shake - dt);
    for (let index = 0; index < this.bumperFlash.length; index++) this.bumperFlash[index] = Math.max(0, this.bumperFlash[index] - dt);
    for (const group of [this.particles, this.ripples, this.popups]) {
      for (let i = group.length - 1; i >= 0; i--) {
        const item = group[i];
        item.life -= dt;
        if (item.life <= 0) group.splice(i, 1);
      }
    }
    for (const spark of this.particles) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 200 * dt;
    }
    for (const popup of this.popups) popup.y -= dt * 34;
    const length = this.reduced ? 0 : [2, 4, 8][this.quality];
    for (const ball of game.balls) {
      if (ball.lane || !length) { ball.trail.length = 0; continue; }
      ball.trail.push([ball.x, ball.y]);
      while (ball.trail.length > length) ball.trail.shift();
    }
  }

  draw(game) {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    if (this.shake) ctx.translate(Math.sin(game.time * 160) * this.shake * 15, 0);
    ctx.lineCap = 'round';
    for (const [index, target] of TARGETS.entries()) {
      const lit = Boolean(game.targetMask & (1 << index));
      line(ctx, target, 13, '#101429');
      line(ctx, target, 8, lit ? GOLD : '#8970c3');
      line(ctx, target, 2, lit ? '#fff2d0' : '#d6bfff');
    }
    for (const [index, bumper] of BUMPERS.entries()) {
      const { x, y, radius, color } = bumper;
      const flash = this.bumperFlash[index];
      circle(ctx, x, y, radius + 5, '#10162b', '#6d7fad', 1.4);
      circle(ctx, x, y, radius, flash && !this.reduced ? '#414a77' : '#222d50', color, flash && !this.reduced ? 3 : 2);
      circle(ctx, x, y, radius - 6, null, color + '87', 1);
      label(ctx, '150', x, y + 1, color, '800 14px monospace');
    }
    for (const flipper of game.flippers) {
      const [x, y] = flipper.tip ?? tip(flipper);
      const bar = [flipper.x, flipper.y, x, y];
      const color = game.tilt ? '#9396a9' : flipper.right ? VIOLET : CYAN;
      line(ctx, bar, 18, '#0a1025');
      line(ctx, bar, 13, color);
      line(ctx, bar, 4, '#eafaff');
      circle(ctx, flipper.x, flipper.y, 6, '#253056', color, 2);
    }

    if (game.balls.some(ball => ball.lane)) {
      const y = 657 - game.charge * 110;
      panel(ctx, 440, 543, 18, 115, '#172044', '#58668d');
      if (game.charge > 0) panel(ctx, 442, y, 14, 657 - y, game.charge > .78 ? GOLD : CYAN);
    }
    for (const ring of this.ripples) {
      ctx.globalAlpha = ring.life / .36 * .63;
      circle(ctx, ring.x, ring.y, 29 + (1 - ring.life / .36) * 37, null, ring.color, 2);
    }
    for (const spark of this.particles) {
      ctx.globalAlpha = clamp(spark.life * 3, 0, 1);
      ctx.fillStyle = spark.color;
      ctx.fillRect(spark.x, spark.y, 2, 2);
    }
    for (const popup of this.popups) {
      ctx.globalAlpha = clamp(popup.life * 3, 0, 1);
      label(ctx, '+' + popup.value, popup.x, popup.y, GOLD, '800 15px monospace');
    }
    for (const [index, ball] of game.balls.entries()) {
      const color = [CYAN, VIOLET, GOLD][index % 3];
      for (const [trailIndex, [x, y]] of ball.trail.entries()) {
        const fraction = (trailIndex + 1) / (ball.trail.length + 1);
        ctx.globalAlpha = fraction * .37;
        circle(ctx, x, y, fraction * 6, color);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(this.ballSprites[index % 3], ball.x - 21, ball.y - 21, 42, 42);
    }
    ctx.globalAlpha = 1;
  }
}
