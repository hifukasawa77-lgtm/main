// All positions and speeds are in logical playfield units.
export const WIDTH = 480;
export const HEIGHT = 690;
export const STEP = 1 / 300;
const GRAVITY = 860;
const SPEED_LIMIT = 1830;
const BALL_RADIUS = 7.5;
const TARGET_MASK = 15;
const COMBO_LEVELS = [[10, 10], [7, 5], [5, 3], [3, 2]];
export const RANKS = [[0, 'CADET', '候補生'], [3500, 'PILOT', '操縦士'], [9000, 'ACE', 'エース'], [20000, 'COMMANDER', '司令官']];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const RAILS = [
  [28, 160, 39, 108], [39, 108, 74, 65], [74, 65, 138, 36], [138, 36, 225, 25],
  [225, 25, 330, 35], [330, 35, 410, 63], [410, 63, 451, 101], [451, 101, 467, 145],
  [467, 145, 467, 660], [467, 660, 431, 660], [431, 660, 431, 130],
  [28, 160, 28, 509], [28, 509, 63, 554], [63, 554, 152, 604],
  [431, 491, 401, 548], [401, 548, 327, 604],
  [29, 509, 29, 639], [29, 639, 81, 667], [431, 491, 431, 639], [431, 639, 381, 667]
];

export const BUMPERS = [
  { x: 219, y: 151, radius: 27, color: '#77e5ff' },
  { x: 142, y: 226, radius: 25, color: '#c6a4ff' },
  { x: 298, y: 225, radius: 25, color: '#ffc979' }
];

export const TARGETS = [
  [61, 284, 71, 306], [50, 324, 58, 346], [381, 279, 370, 301], [393, 319, 384, 341]
];

export const SLINGS = [[85, 461, 144, 536], [381, 461, 324, 536]];
const POSTS = [[67, 403, 10], [383, 403, 10], [76, 131, 9], [363, 132, 9]];
const POST_RAILS = POSTS.map(([x, y, radius]) => ({ rail: [x, y, x, y], radius }));
export { POSTS };

function dateHash(date) {
  let hash = 0;
  for (const char of date) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return hash;
}

export function dailyFor(date) {
  const hash = dateHash(date);
  const options = [
    { type: 'bumpers', goal: 12 + hash % 5, label: 'バンパー / Bumpers' },
    { type: 'combo', goal: 5 + hash % 3, label: '連続ヒット / Combo' },
    { type: 'score', goal: 4500 + (hash % 5) * 500, label: '得点 / Score' }
  ];
  return { date, ...options[hash % options.length] };
}

function makeBall(x, y, vx = 0, vy = 0, lane = false) {
  return { x, y, vx, vy, radius: BALL_RADIUS, lane, shooter: false, cooldown: 0, trail: [] };
}

function makeFlipper(x, right) {
  const rest = right ? Math.PI - .32 : .32;
  return { x, y: 607, length: 72, right, rest, angle: rest, omega: 0, active: right ? Math.PI + .58 : -.58, held: false };
}

export function tip(flipper) {
  return [flipper.x + Math.cos(flipper.angle) * flipper.length, flipper.y + Math.sin(flipper.angle) * flipper.length];
}

// A circle against a capsule. Zero distance uses the segment normal opposing travel.
export function contact(ball, x1, y1, x2, y2, padding = 0) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared ? clamp(((ball.x - x1) * dx + (ball.y - y1) * dy) / lengthSquared, 0, 1) : 0;
  const x = x1 + dx * fraction;
  const y = y1 + dy * fraction;
  const ox = ball.x - x;
  const oy = ball.y - y;
  const distance = Math.hypot(ox, oy);
  const depth = ball.radius + padding - distance;
  if (depth <= 0) return null;
  if (distance > .000001) return { x, y, nx: ox / distance, ny: oy / distance, depth, fraction };
  const length = Math.sqrt(lengthSquared) || 1;
  const nx = lengthSquared ? -dy / length : 0;
  const ny = lengthSquared ? dx / length : -1;
  const side = ball.vx * nx + ball.vy * ny > 0 ? -1 : 1;
  return { x, y, nx: nx * side, ny: ny * side, depth, fraction };
}

function resolve(ball, hit, restitution, vx = 0, vy = 0, grip = .025) {
  const { nx, ny, depth } = hit;
  ball.x += nx * (depth + .025);
  ball.y += ny * (depth + .025);
  const relativeX = ball.vx - vx;
  const relativeY = ball.vy - vy;
  const approach = -(relativeX * nx + relativeY * ny);
  if (approach <= 0) return 0;
  const tangent = (-relativeX * ny + relativeY * nx) * grip;
  const normal = (1 + restitution) * approach;
  ball.vx += normal * nx + tangent * ny;
  ball.vy += normal * ny - tangent * nx;
  return approach;
}

function limitSpeed(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > SPEED_LIMIT) {
    ball.vx *= SPEED_LIMIT / speed;
    ball.vy *= SPEED_LIMIT / speed;
  }
}

export class Pinball {
  constructor({ date = new Date().toISOString().slice(0, 10), daily = null, onEvent = () => {} } = {}) {
    this.onEvent = onEvent;
    this.daily = dailyFor(date);
    this.dailyBest = daily?.date === date ? Math.max(0, +daily.best || 0) : 0;
    this.dailyCleared = daily?.date === date && !!daily.cleared;
    this.state = 'ready';
    this.time = 0;
    this.score = 0;
    this.stock = 3;
    this.chain = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.bestChain = 0;
    this.bumperHits = 0;
    this.targetMask = 0;
    this.bankClears = 0;
    this.mission = 0;
    this.bonus = 0;
    this.bonusHits = 0;
    this.multiballStarted = false;
    this.extraBalls = 0;
    this.rank = 0;
    this.charge = 0;
    this.nudgeHeat = 0;
    this.nudgeCooldown = 0;
    this.tilt = 0;
    this.flippers = [makeFlipper(153, false), makeFlipper(327, true)];
    this.balls = [makeBall(449, 645, 0, 0, true)];
    this.stallTime = 0;
  }

  emit(type, detail = {}) {
    this.onEvent({ type, ...detail });
  }

  launch(power = this.charge) {
    const ball = this.balls.find(candidate => candidate.lane);
    if (this.state !== 'playing' || !ball) return false;
    this.charge = 0;
    ball.lane = false;
    ball.shooter = true;
    ball.power = clamp(power, 0, 1);
    ball.vy = -1090 - ball.power * 430;
    this.emit('launch', { x: ball.x, y: ball.y, power: ball.power });
    return true;
  }

  nudge(direction = 0) {
    if (this.state !== 'playing' || this.nudgeCooldown > 0 || this.tilt > 0 || !this.balls.some(ball => !ball.lane && !ball.shooter)) return false;
    this.nudgeCooldown = .24;
    this.nudgeHeat += .37;
    if (this.nudgeHeat > 1) {
      this.tilt = 2.2;
      this.emit('tilt');
      return false;
    }
    for (const ball of this.balls) {
      if (ball.lane || ball.shooter) continue;
      ball.vx += clamp(direction, -1, 1) * 155;
      ball.vy -= 125;
      limitSpeed(ball);
    }
    this.emit('nudge', { direction });
    return true;
  }

  addScore(base, x, y, combo = true) {
    if (combo) {
      this.chain++;
      this.comboTimer = 4;
      this.bestChain = Math.max(this.bestChain, this.chain);
      const oldMultiplier = this.multiplier;
      this.multiplier = COMBO_LEVELS.find(([hits]) => this.chain >= hits)?.[1] ?? 1;
      if (oldMultiplier !== this.multiplier) this.emit('combo', { multiplier: this.multiplier, x, y });
    }
    const points = base * (combo ? this.multiplier * (this.bonus > 0 ? 2 : 1) : 1);
    this.score += points;
    this.dailyBest = Math.max(this.dailyBest, this.score);
    this.emit('score', { points, x, y });
    const rank = RANKS.findLastIndex(([minimum]) => this.score >= minimum);
    if (rank > this.rank) {
      this.rank = rank;
      this.emit('rank', { rank });
    }
    this.checkDaily();
  }

  get dailyProgress() {
    return this.daily.type === 'bumpers' ? this.bumperHits : this.daily.type === 'combo' ? this.bestChain : this.score;
  }

  checkDaily() {
    if (this.dailyCleared || this.dailyProgress < this.daily.goal) return;
    this.dailyCleared = true;
    this.emit('daily');
  }

  get missionProgress() {
    return [
      [this.bumperHits, 10], [this.bankClears ? 4 : this.targetMask.toString(2).replaceAll('0', '').length, 4],
      [this.bestChain, 5], [this.multiballStarted ? 1 : 0, 1], [this.bonusHits, 6]
    ][this.mission] ?? [1, 1];
  }

  advanceMissions() {
    while (this.mission < 5) {
      const [progress, goal] = this.missionProgress;
      if (this.mission === 4) {
        if (this.bonusHits < 6 || this.bonus <= 0) return;
      } else if (progress < goal) return;
      this.mission++;
      this.addScore(this.mission === 5 ? 5000 : 600, WIDTH / 2, 328, false);
      this.emit('mission', { mission: this.mission });
      if (this.mission === 3) this.startMultiball();
      if (this.mission === 4) this.startBonus();
      if (this.mission === 5) {
        this.bonus = 0;
        this.extraBalls++;
        this.stock++;
        this.emit('extra');
      }
    }
  }

  startMultiball() {
    if (this.multiballStarted) return;
    this.multiballStarted = true;
    this.balls.push(makeBall(101, 120, 120, 115), makeBall(344, 105, -105, 135));
    this.emit('multiball');
  }

  startBonus() {
    this.bonus = 24;
    this.bonusHits = 0;
    this.emit('bonus');
  }

  hitBumper(index) {
    const { x, y } = BUMPERS[index];
    this.bumperHits++;
    if (this.bonus > 0) this.bonusHits++;
    this.emit('bumper', { index, x, y });
    this.addScore(150, x, y);
    this.advanceMissions();
  }

  hitTarget(index, x, y) {
    const bit = 1 << index;
    if (this.targetMask & bit) return;
    this.targetMask |= bit;
    this.emit('target', { index, x, y });
    this.addScore(300, x, y);
    if (this.targetMask === TARGET_MASK) {
      this.bankClears++;
      this.targetMask = 0;
      this.addScore(1500, WIDTH / 2, 365, false);
      this.emit('bank');
      if (this.mission === 4 && this.bonus <= 0) this.startBonus();
    }
    this.advanceMissions();
  }

  step(input) {
    if (this.state !== 'playing') return;
    this.time += STEP;
    this.nudgeCooldown = Math.max(0, this.nudgeCooldown - STEP);
    this.nudgeHeat = Math.max(0, this.nudgeHeat - STEP * .105);
    this.tilt = Math.max(0, this.tilt - STEP);
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - STEP);
      if (!this.comboTimer) {
        this.chain = 0;
        this.multiplier = 1;
      }
    }
    if (this.bonus > 0 && this.balls.some(ball => !ball.lane)) {
      this.bonus = Math.max(0, this.bonus - STEP);
      if (!this.bonus) this.emit('bonusEnd');
    }
    if (input.launch && this.balls.some(ball => ball.lane)) this.charge = Math.min(1, this.charge + STEP / .88);
    for (const [index, flipper] of this.flippers.entries()) {
      const held = this.tilt <= 0 && (index === 0 ? input.left : input.right);
      if (held && !flipper.held) this.emit('flipper', { index });
      flipper.held = held;
      const goal = held ? flipper.active : flipper.rest;
      const travel = (held ? 41 : 24) * STEP;
      const change = clamp(goal - flipper.angle, -travel, travel);
      flipper.angle += change;
      flipper.omega = change / STEP;
      flipper.tip = tip(flipper);
    }

    // Iterate only the balls present at the start of the step. Mission spawns join next step.
    const count = this.balls.length;
    for (let i = 0; i < count; i++) {
      const ball = this.balls[i];
      if (!ball.lane) this.moveBall(ball);
    }
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) this.collideBalls(this.balls[i], this.balls[j]);
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      if (this.balls[i].y > HEIGHT + 23) this.balls.splice(i, 1);
    }
    if (!this.balls.length) this.drain();
    this.recoverStalledBall();
  }

  moveBall(ball) {
    ball.cooldown = Math.max(0, ball.cooldown - STEP);
    ball.vy += GRAVITY * STEP;
    ball.vx *= .99972;
    limitSpeed(ball);
    ball.x += ball.vx * STEP;
    ball.y += ball.vy * STEP;

    // Keep the ball centered in the shooter until it clears the inner rail.
    if (ball.shooter && ball.y <= 114) {
      ball.shooter = false;
      ball.vx = -410 - ball.power * 200;
      ball.vy = -140 - ball.power * 160;
      this.emit('transfer', { x: ball.x, y: ball.y });
    }

    for (const rail of RAILS) this.hitRail(ball, rail, .64, 2);
    for (const { rail, radius } of POST_RAILS) this.hitRail(ball, rail, .78, radius);

    for (const [index, bumper] of BUMPERS.entries()) {
      const { x, y, radius } = bumper;
      const hit = contact(ball, x, y, x, y, radius);
      if (!hit || !resolve(ball, hit, .79)) continue;
      ball.vx += hit.nx * 355;
      ball.vy += hit.ny * 355;
      this.hitBumper(index);
    }
    for (const sling of SLINGS) {
      const hit = contact(ball, ...sling, 3);
      if (!hit || !resolve(ball, hit, .81)) continue;
      ball.vx += hit.nx * 300;
      ball.vy += hit.ny * 300 - 90;
      this.emit('sling', { x: hit.x, y: hit.y });
      this.addScore(85, hit.x, hit.y);
      this.advanceMissions();
    }
    for (const [index, target] of TARGETS.entries()) {
      if (this.targetMask & (1 << index)) continue;
      const hit = contact(ball, ...target, 4);
      if (hit && resolve(ball, hit, .71)) this.hitTarget(index, hit.x, hit.y);
    }
    for (const flipper of this.flippers) this.hitFlipper(ball, flipper);
    limitSpeed(ball);
    if (ball.x < -30 || ball.x > WIDTH + 30 || ball.y < -35) ball.y = HEIGHT + 24;
  }

  collideBalls(a, b) {
    if (a.lane || b.lane || a.shooter || b.shooter) return;
    const hit = contact(a, b.x, b.y, b.x, b.y, b.radius);
    if (!hit) return;
    const { nx, ny, depth } = hit;
    const separation = depth * .5 + .025;
    a.x += nx * separation;
    a.y += ny * separation;
    b.x -= nx * separation;
    b.y -= ny * separation;
    const approach = -((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
    if (approach <= 0) return;
    const impulse = approach * .94;
    a.vx += nx * impulse;
    a.vy += ny * impulse;
    b.vx -= nx * impulse;
    b.vy -= ny * impulse;
    if (approach > 75) this.emit('rail', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, power: Math.min(1, approach / 860) });
  }

  hitRail(ball, rail, restitution, padding) {
    const hit = contact(ball, ...rail, padding);
    if (!hit) return;
    const approach = resolve(ball, hit, restitution);
    if (approach > 75 && !ball.cooldown) {
      ball.cooldown = .045;
      this.emit('rail', { x: hit.x, y: hit.y, power: Math.min(1, approach / 860) });
    }
  }

  hitFlipper(ball, flipper) {
    const [x, y] = flipper.tip ?? tip(flipper);
    const hit = contact(ball, flipper.x, flipper.y, x, y, 7);
    if (!hit) return;
    const vx = -(hit.y - flipper.y) * flipper.omega;
    const vy = (hit.x - flipper.x) * flipper.omega;
    const isStroke = flipper.held && Math.abs(flipper.omega) > 10 && hit.ny < -.33 && (vx * hit.nx + vy * hit.ny) > 0;
    const approach = resolve(ball, hit, isStroke ? .28 : .5, vx, vy, .06);
    if (isStroke && approach > 0) {
      const leverage = hit.fraction;
      ball.vy = Math.min(ball.vy - 125, -660 - 510 * leverage);
      // Preserve aim from the contact normal and constrain near-horizontal launches.
      ball.vx = clamp(ball.vx, -1050, 1050);
      this.emit('strike', { x: hit.x, y: hit.y });
    } else if (approach > 105 && !ball.cooldown) {
      ball.cooldown = .045;
      this.emit('rail', { x: hit.x, y: hit.y, power: .4 });
    }
  }

  recoverStalledBall() {
    const ball = this.balls[0];
    const stationary = this.balls.length === 1 && ball && !ball.lane && Math.hypot(ball.vx, ball.vy) < 32;
    this.stallTime = stationary ? this.stallTime + STEP : 0;
    if (this.stallTime < 2.4) return;
    if (ball.x > 434) {
      ball.x = 449;
      ball.y = 645;
      ball.vx = ball.vy = 0;
      ball.lane = true;
      ball.shooter = false;
    } else {
      ball.vx = ball.x < WIDTH / 2 ? 180 : -180;
      ball.vy = -280;
    }
    this.stallTime = 0;
    this.emit('rescue');
  }

  drain() {
    this.stock--;
    this.chain = this.comboTimer = this.charge = 0;
    this.multiplier = 1;
    this.emit('drain');
    if (this.stock <= 0) {
      this.state = 'over';
      this.emit('over');
    } else {
      this.balls.push(makeBall(449, 645, 0, 0, true));
    }
  }
}
