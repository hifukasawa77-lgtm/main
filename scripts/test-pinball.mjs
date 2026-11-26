import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { describe, test } from 'node:test';
import { Pinball, STEP, contact, tip, dailyFor, HEIGHT } from '../assets/pinball/engine.mjs';

const controls = { left: false, right: false, launch: false };
const run = (game, steps, input = controls) => {
  for (let i = 0; i < steps; i++) game.step(input);
};
const active = onEvent => {
  const game = new Pinball({ date: '2026-11-26', onEvent });
  game.state = 'playing';
  return game;
};

describe('physics', () => {
  test('minimum and maximum launches reach playfield, and charge respects the cap', () => {
    const launchSpeeds = [];
    for (const power of [0, 1]) {
      const game = active();
      if (power) run(game, 330, { ...controls, launch: true });
      assert.equal(game.charge, power);
      assert(game.launch());
      assert(!game.launch());
      const ball = game.balls[0];
      launchSpeeds.push(Math.abs(ball.vy));
      for (let i = 0; i < 500 && ball.x > 416; i++) game.step(controls);
      assert(ball.x <= 416 && ball.y < 165, 'shooter must feed inside the divider');
      assert.equal(ball.shooter, false);
    }
    assert(launchSpeeds[1] - launchSpeeds[0] >= 400);
  });

  test('both flippers reach full travel in 24 ms and release independently', () => {
    const game = active();
    run(game, 7, { ...controls, left: true, right: true });
    for (const flipper of game.flippers) assert(Math.abs(flipper.angle - flipper.active) < .001);
    run(game, 12, { ...controls, right: true });
    assert(Math.abs(game.flippers[0].angle - game.flippers[0].rest) < .001);
    assert(Math.abs(game.flippers[1].angle - game.flippers[1].active) < .001);
  });

  test('well-timed strokes launch above 950 units per second from either flipper', () => {
    for (const index of [0, 1]) {
      const events = [];
      const game = active(event => events.push(event));
      const flipper = game.flippers[index];
      const [x, y] = tip(flipper);
      const ball = game.balls[0];
      Object.assign(ball, {
        x: flipper.x + (x - flipper.x) * .72,
        y: flipper.y + (y - flipper.y) * .72 - 25,
        vx: 0, vy: 235, lane: false
      });
      run(game, 4, { ...controls, [index === 0 ? 'left' : 'right']: true });
      assert(events.some(event => event.type === 'strike'));
      assert(ball.vy <= -950, 'strong upward strike: ' + ball.vy);
    }
  });

  test('high-speed ball reflects off a rail without crossing it', () => {
    const game = active();
    const ball = game.balls[0];
    Object.assign(ball, { x: 49, y: 386, vx: -1830, vy: 0, lane: false });
    run(game, 6);
    assert(ball.x > 37);
    assert(ball.vx > 900);
    const centered = contact({ x: 10, y: 10, vx: 0, vy: 30, radius: 8 }, 0, 10, 20, 10, 2);
    assert.deepEqual([centered.depth, centered.ny], [10, -1]);
  });

  test('multiball spheres separate and exchange momentum', () => {
    const game = active();
    game.launch();
    game.startMultiball();
    const [a, b] = game.balls.slice(1);
    Object.assign(a, { x: 200, y: 360, vx: 300, vy: 0 });
    Object.assign(b, { x: 216, y: 360, vx: -300, vy: 0 });
    game.step(controls);
    assert(a.vx < -250 && b.vx > 250);
    assert(b.x - a.x >= a.radius + b.radius);
  });

  test('active nudge changes trajectory and repeated nudges cause temporary tilt', () => {
    const game = active();
    assert.equal(game.nudge(), false);
    const ball = game.balls[0];
    Object.assign(ball, { x: 210, y: 420, lane: false });
    assert(game.nudge(1));
    assert.equal(ball.vx, 155);
    assert.equal(ball.vy, -125);
    assert(!game.nudge(-1));
    run(game, 74);
    assert(game.nudge(-1));
    run(game, 74);
    assert(!game.nudge(1));
    assert(game.tilt > 2);
    game.step({ ...controls, left: true });
    assert(!game.flippers[0].held);
  });
});

describe('scoring and progression', () => {
  test('hits award the correct multiplier, combo expires, and ranks advance', () => {
    const game = active();
    const rates = [];
    for (let i = 0; i < 10; i++) {
      game.addScore(100, 20, 20);
      rates.push(game.multiplier);
    }
    assert.deepEqual(rates, [1, 1, 2, 2, 3, 3, 5, 5, 5, 10]);
    assert.equal(game.score, 3700);
    assert.equal(game.rank, 1);
    run(game, 1201);
    assert.equal(game.multiplier, 1);
  });

  test('missions unlock 3-ball play, bonus scoring, and one extra ball', () => {
    const events = [];
    const game = active(event => events.push(event.type));
    game.launch();
    for (let i = 0; i < 10; i++) game.hitBumper(i % 3);
    assert.equal(game.mission, 1);
    for (let i = 0; i < 4; i++) game.hitTarget(i, 50, 50);
    assert.equal(game.mission, 4);
    assert.equal(game.balls.length, 3);
    assert(game.bonus > 0);
    assert.equal(game.bonusHits, 0);
    const score = game.score;
    game.hitBumper(0);
    assert.equal(game.score - score, 150 * 10 * 2);
    for (let i = 0; i < 5; i++) game.hitBumper(i % 3);
    assert.equal(game.mission, 5);
    assert.equal(game.stock, 4);
    assert.equal(game.extraBalls, 1);
    assert(events.includes('multiball') && events.includes('bonus') && events.includes('extra'));
    for (let i = 0; i < 8; i++) game.hitBumper(0);
    assert.equal(game.extraBalls, 1);

    game.balls[1].y = HEIGHT + 35;
    game.step(controls);
    assert.equal(game.balls.length, 2);
    assert.equal(game.stock, 4, 'individual multiball losses do not consume stock');
  });

  test('bonus can be retried by clearing another bank', () => {
    const game = active();
    game.mission = 4;
    game.bonus = STEP;
    game.launch();
    game.step(controls);
    assert.equal(game.bonus, 0);
    for (let i = 0; i < 4; i++) game.hitTarget(i, 50, 50);
    assert.equal(game.bonus, 24);
  });

  test('daily challenge is deterministic, persists for the date and resets on UTC rollover', () => {
    const date = '2026-11-26';
    const challenge = dailyFor(date);
    assert.deepEqual(dailyFor(date), challenge);
    const game = active();
    if (challenge.type === 'combo') for (let i = 0; i < challenge.goal; i++) game.addScore(10, 0, 0);
    else if (challenge.type === 'bumpers') for (let i = 0; i < challenge.goal; i++) game.hitBumper(0);
    else game.addScore(challenge.goal, 0, 0);
    assert(game.dailyCleared);
    assert.equal(game.dailyBest, game.score);
    const daily = { date, best: game.dailyBest, cleared: true };
    assert(new Pinball({ date, daily }).dailyCleared);
    assert.equal(new Pinball({ date: '2026-11-27', daily }).dailyBest, 0);
  });

  test('pause preserves the ball, all three drains end the session, new game resets', () => {
    const game = active();
    game.launch();
    game.state = 'paused';
    const position = game.balls[0].y;
    run(game, 500);
    assert.equal(game.balls[0].y, position);
    game.state = 'playing';
    for (let i = 0; i < 3; i++) {
      game.launch();
      game.balls[0].y = HEIGHT + 35;
      game.step(controls);
    }
    assert.equal(game.state, 'over');
    assert.equal(game.stock, 0);
    assert.equal(game.balls.length, 0);
    const fresh = active();
    assert.equal(fresh.stock, 3);
    assert.equal(fresh.score, 0);
  });
});

test('accelerated 15-minute soak keeps physics finite and ball counts bounded', t => {
  const start = performance.now();
  let game = active();
  let peakBalls = 0;
  for (let i = 0; i < 15 * 60 * 300; i++) {
    if (game.state === 'over') game = active();
    if (game.balls.some(ball => ball.lane)) game.launch(i % 3 / 2);
    game.step({ left: i % 84 < 18, right: i % 101 < 18, launch: false });
    peakBalls = Math.max(peakBalls, game.balls.length);
    for (const ball of game.balls) assert([ball.x, ball.y, ball.vx, ball.vy].every(Number.isFinite));
  }
  assert(peakBalls >= 1 && peakBalls <= 3);
  t.diagnostic(`270,000 fixed steps, ${Math.round(performance.now() - start)} ms wall time, max ${peakBalls} balls`);
});
