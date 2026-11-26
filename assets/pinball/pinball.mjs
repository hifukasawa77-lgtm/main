import { Pinball, RANKS, STEP, clamp } from './engine.mjs';
import { Renderer } from './render.mjs';
import { PinballAudio } from './audio.mjs';

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
const format = new Intl.NumberFormat('ja-JP');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const input = { left: false, right: false, launch: false };
const keys = new Set();
const pointers = new Map();
const controls = ['left', 'right', 'launch', 'nudge'];
const keyActions = new Map([
  ['ArrowLeft', 'left'], ['KeyA', 'left'], ['KeyZ', 'left'],
  ['ArrowRight', 'right'], ['KeyD', 'right'], ['KeyM', 'right'],
  ['Space', 'launch'], ['ArrowDown', 'launch']
]);
const missions = [
  ['リアクター起動 / Reactor', 'バンパーに10回当てる'],
  ['軌道アレイ / Orbital array', '左右4つのターゲットを点灯'],
  ['連続照準 / Target lock', '5連続ヒットを達成'],
  ['増援発進 / Multiball', '3球のマルチボールを解放'],
  ['軌道防衛 / Orbital defense', '24秒以内にバンパー6回。失敗したらアレイ全点灯で再挑戦'],
  ['軌道基地防衛完了 / Complete', 'エクストラボール獲得']
];

function read(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private or restricted storage. */ }
}

const storage = 'neon-pinball:';
const savedSettings = read(storage + 'settings') ?? {};
const settings = {
  volume: Number.isFinite(savedSettings.volume) ? clamp(savedSettings.volume, 0, 100) : 55,
  mute: Boolean(savedSettings.mute ?? read('gamekit:neon-pinball:muted', false)),
  music: savedSettings.music !== false,
  reduced: typeof savedSettings.reduced === 'boolean' ? savedSettings.reduced : motionPreference.matches
};
let best = Math.max(0, +read(storage + 'best', 0) || 0, +read('gamekit:neon-pinball:hiscore', 0) || 0);
let bestAtStart = best;
let shownScore = 0;
let game;
let nextLaunch = false;
let nudgeDirection = null;
let lag = 0;
let previousTime = 0;
let nextHud = 0;
let frameAverage = 16.7;
let qualityTime = 0;
let announcement = '';
let announcementUntil = 0;
let announcementPriority = 0;
let hudDirty = true;
let needsDraw = true;
let persistPending = false;
let nextSave = 0;
let startKeyHeld = false;
const flipperPulse = { left: 0, right: 0 };
let frameHandle = 0;

function requestFrame() {
  if (!frameHandle) frameHandle = requestAnimationFrame(frame);
}

const renderer = new Renderer(ui.game);
const audio = new PinballAudio();

function text(id, value) {
  const node = ui[id];
  if (node.textContent !== value) node.textContent = value;
}

function progress(id, value, max = 1) {
  const node = ui[id];
  if (node.max !== max) node.max = max;
  const next = clamp(value, 0, max);
  if (node.value !== next) node.value = next;
}

function saveScores() {
  if (!persistPending) return;
  write(storage + 'best', best);
  write(storage + 'daily', { date: game.daily.date, best: game.dailyBest, cleared: game.dailyCleared });
  persistPending = false;
}

function announce(message, priority = 1, seconds = 1.8) {
  if (game.time < announcementUntil && priority < announcementPriority) return;
  announcement = message;
  announcementPriority = priority;
  announcementUntil = game.time + seconds;
  text('status', message);
}

function onEvent(event) {
  renderer.event(event);
  audio.cue(event);
  hudDirty = true;
  switch (event.type) {
    case 'score':
      if (game.score > best) best = game.score;
      persistPending = true;
      break;
    case 'combo': announce('COMBO ×' + event.multiplier, 2); break;
    case 'bank': announce('アレイ全点灯 / ARRAY CLEAR', 3); break;
    case 'mission': announce(event.mission === 5 ? '軌道防衛完了 / MISSION COMPLETE' : 'ミッション達成 / MISSION CLEAR', 3); break;
    case 'multiball': announce('3球マルチボール / MULTIBALL', 5); break;
    case 'bonus':
      announce(game.balls.length === 3 ? 'MULTIBALL + BONUS ×2' : 'ボーナス / BONUS ×2', 6, 3);
      break;
    case 'bonusEnd': announce('アレイ全点灯で再挑戦 / Relight the array', 4, 3); break;
    case 'extra': announce('任務完了 · EXTRA BALL', 7, 3); break;
    case 'rank': announce(RANKS[event.rank][1] + ' / ランクアップ', 2); break;
    case 'tilt': announce('TILT · フリッパー停止', 8, 2.2); break;
    case 'rescue': announce('ボールを復帰 / Ball recovered'); break;
    case 'launch': text('status', '発射 / Ball launched'); break;
    case 'drain': text('status', '次の球を発射 / Launch next ball'); break;
    case 'daily':
      persistPending = true;
      announce('デイリー達成 / DAILY CLEAR', 3);
      break;
    case 'over':
      saveScores();
      setState('over', true);
      break;
  }
}

function newGame(start) {
  saveScores();
  game = new Pinball({ daily: read(storage + 'daily'), onEvent });
  renderer.clear();
  shownScore = 0;
  bestAtStart = best;
  announcement = '';
  announcementUntil = announcementPriority = 0;
  text('status', '長押しして離す / Hold & release');
  setState(start ? 'playing' : 'ready', start);
}

function clearInput() {
  keys.clear();
  pointers.clear();
  input.left = input.right = input.launch = false;
  flipperPulse.left = flipperPulse.right = 0;
  startKeyHeld = false;
  nextLaunch = false;
  nudgeDirection = null;
  game.charge = 0;
  for (const name of controls) ui[name].classList.remove('is-held');
}

function setState(state, focus = false) {
  game.state = state;
  clearInput();
  lag = 0;
  previousTime = 0;
  const playing = state === 'playing';
  ui.overlay.hidden = playing;
  ui.pause.disabled = state === 'ready' || state === 'over';
  text('pause', state === 'paused' ? '再開 / Resume' : '停止 / Pause');
  audio.configure(settings, playing);
  if (state === 'ready') {
    text('overlay-kicker', 'ORBITAL STATION');
    text('overlay-title', '発射準備');
    text('overlay-detail', '3球で5つのミッションをクリアしよう。');
    text('play', 'プレイ / Play');
  } else if (state === 'paused') {
    text('overlay-kicker', 'PAUSED');
    text('overlay-title', '一時停止');
    text('overlay-detail', '再開すると停止時の盤面に戻ります。');
    text('play', '再開 / Resume');
  } else if (state === 'over') {
    text('overlay-kicker', game.score > bestAtStart ? 'NEW HIGH SCORE' : 'GAME OVER');
    text('overlay-title', 'ゲーム終了');
    text('overlay-detail', format.format(game.score) + ' 点 · ' + RANKS[game.rank][1]);
    text('play', 'もう一度 / Retry');
  }
  syncHud();
  needsDraw = true;
  requestFrame();
  if (focus) {
    const node = playing ? ui.pause : ui.play;
    node.focus({ preventScroll: true });
    // Keep Space mapped to the plunger after an on-screen start.
    if (playing) node.blur();
  }
}

function togglePause() {
  if (game.state === 'playing') {
    saveScores();
    setState('paused', true);
  } else if (game.state === 'paused') {
    audio.unlock(settings);
    setState('playing', true);
  }
}

function openDialog(dialog) {
  if (game.state === 'playing') {
    saveScores();
    setState('paused');
  }
  dialog.showModal();
}

function syncHud() {
  const playing = game.state === 'playing';
  const inLane = game.balls.some(ball => ball.lane);
  ui.left.disabled = ui.right.disabled = ui.nudge.disabled = !playing;
  ui.launch.disabled = !playing || !inLane;
  text('stock', String(game.stock));
  text('best', format.format(best));
  text('multiplier', '×' + game.multiplier);
  const [name, instruction] = missions[game.mission];
  const [current, goal] = game.missionProgress;
  text('mission-count', game.mission === 5 ? '5 / 5 ✓' : (game.mission + 1) + ' / 5');
  text('mission-name', name);
  text('mission-detail', game.mission === 5 ? instruction : Math.min(current, goal) + ' / ' + goal + ' · ' + instruction);
  progress('mission-meter', current, goal);
  const [, rank, japanese] = RANKS[game.rank];
  text('rank', rank + ' / ' + japanese);
  text('rank-next', RANKS[game.rank + 1] ? '次の昇格まで ' + format.format(RANKS[game.rank + 1][0] - game.score) + ' 点' : '最高ランク / Top rank');
  text('daily-goal', game.daily.label + ' ' + format.format(game.daily.goal));
  text('daily-best', (game.dailyCleared ? '達成 ✓ · ' : '') + game.daily.date + ' UTC · 最高 ' + format.format(game.dailyBest));
  progress('daily-meter', game.dailyCleared ? game.daily.goal : game.dailyProgress, game.daily.goal);

  if (game.tilt > 0) {
    text('mode', 'TILT / フリッパー停止');
    text('mode-value', game.tilt.toFixed(1) + ' s');
    progress('mode-meter', game.tilt, 2.2);
  } else if (inLane) {
    text('mode', '長押しで発射 / Hold to launch');
    text('mode-value', Math.round(game.charge * 100) + '%');
    progress('mode-meter', game.charge);
  } else if (game.bonus > 0) {
    text('mode', game.balls.length > 1 ? 'MULTIBALL · BONUS ×2' : 'ボーナス / BONUS ×2');
    text('mode-value', Math.ceil(game.bonus) + ' s');
    progress('mode-meter', game.bonus, 24);
  } else if (game.comboTimer > 0) {
    text('mode', 'コンボ / Combo ' + game.chain);
    text('mode-value', game.comboTimer.toFixed(1) + ' s');
    progress('mode-meter', game.comboTimer, 4);
  } else {
    text('mode', game.balls.length > 1 ? 'マルチボール / Multiball' : 'プレイ中 / Ball in play');
    text('mode-value', game.balls.length > 1 ? String(game.balls.length) : '');
    progress('mode-meter', 0);
  }
  hudDirty = false;
}

function refreshInput() {
  input.left = input.right = input.launch = false;
  for (const code of keys) input[keyActions.get(code)] = true;
  for (const action of pointers.values()) if (action !== 'nudge') input[action] = true;
  for (const name of controls) {
    ui[name].classList.toggle('is-held', name === 'nudge' ? [...pointers.values()].includes(name) : input[name]);
  }
}

function releasePointer(event) {
  const action = pointers.get(event.pointerId);
  if (!action) return;
  pointers.delete(event.pointerId);
  refreshInput();
  if (action === 'launch' && !input.launch) {
    if (event.type === 'pointerup') nextLaunch = true;
    else game.charge = 0;
  }
}

function bindPointer(node, actionFor) {
  node.addEventListener('pointerdown', event => {
    if (game.state !== 'playing' || event.button !== 0) return;
    const action = actionFor(event);
    if (ui[action].disabled) return;
    event.preventDefault();
    audio.unlock(settings);
    node.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, action);
    if (action === 'nudge') nudgeDirection = 0;
    if (action === 'left' || action === 'right') flipperPulse[action] = .027;
    refreshInput();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(type, releasePointer);
}

for (const action of controls) bindPointer(ui[action], () => action);
bindPointer(ui.game, event => {
  if (game.balls.some(ball => ball.lane)) return 'launch';
  const rect = ui.game.getBoundingClientRect();
  return event.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
});

for (const action of controls) {
  ui[action].addEventListener('click', event => {
    if (event.detail !== 0 || game.state !== 'playing') return;
    audio.unlock(settings);
    if (action === 'launch') nextLaunch = true;
    else if (action === 'nudge') nudgeDirection = 0;
    else flipperPulse[action] = .027;
  });
}

window.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || ui['controls-dialog'].open || ui['settings-dialog'].open) return;
  const { code, repeat } = event;
  if ((code === 'KeyP' || code === 'Escape') && !repeat) {
    if (!ui.pause.disabled) { event.preventDefault(); togglePause(); }
    return;
  }
  if (code === 'Space' && event.target.closest?.('button')) return;
  if (code === 'Space' && game.state !== 'playing' && !repeat) {
    event.preventDefault();
    if (game.state === 'paused') togglePause();
    else { audio.unlock(settings); newGame(true); }
    startKeyHeld = true;
    return;
  }
  if (game.state !== 'playing') return;
  if (['KeyX', 'KeyQ', 'KeyE'].includes(code) && !repeat) {
    nudgeDirection = code === 'KeyQ' ? -1 : code === 'KeyE' ? 1 : 0;
    audio.unlock(settings);
  }
  const action = keyActions.get(code);
  if (!action) return;
  event.preventDefault();
  if (repeat || (code === 'Space' && startKeyHeld)) return;
  keys.add(code);
  if (action === 'left' || action === 'right') flipperPulse[action] = .027;
  audio.unlock(settings);
  refreshInput();
});

window.addEventListener('keyup', event => {
  if (event.code === 'Space') startKeyHeld = false;
  if (!keys.delete(event.code)) return;
  refreshInput();
  if (keyActions.get(event.code) === 'launch' && !input.launch) nextLaunch = true;
});

function pauseOnLeave() {
  saveScores();
  if (game.state === 'playing') setState('paused');
}
window.addEventListener('blur', pauseOnLeave);
window.addEventListener('pagehide', saveScores);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });

ui.play.addEventListener('click', () => {
  audio.unlock(settings);
  if (game.state === 'paused') togglePause();
  else newGame(true);
});
ui.pause.addEventListener('click', togglePause);
ui.help.addEventListener('click', () => openDialog(ui['controls-dialog']));
ui.settings.addEventListener('click', () => openDialog(ui['settings-dialog']));

ui.volume.value = settings.volume;
ui.mute.checked = settings.mute;
ui.music.checked = settings.music;
ui.reduced.checked = settings.reduced;
text('volume-value', settings.volume + '%');

function applyPreferences() {
  text('volume-value', settings.volume + '%');
  renderer.setReduced(settings.reduced);
  audio.configure(settings, game.state === 'playing');
  needsDraw = true;
  requestFrame();
}
function changePreference(event) {
  const { id, checked, value } = event.target;
  settings[id] = id === 'volume' ? Number(value) : checked;
  applyPreferences();
  if (event.type === 'change') write(storage + 'settings', settings);
}

for (const id of ['volume', 'mute', 'music', 'reduced']) ui[id].addEventListener('change', changePreference);
ui.volume.addEventListener('input', changePreference);
motionPreference.addEventListener('change', event => {
  if (typeof read(storage + 'settings')?.reduced === 'boolean') return;
  settings.reduced = event.matches;
  ui.reduced.checked = settings.reduced;
  applyPreferences();
});

newGame(false);
applyPreferences();
renderer.resize();
new ResizeObserver(() => {
  renderer.resize();
  needsDraw = true;
  requestFrame();
}).observe(ui.game);

const stepInput = { left: false, right: false, launch: false };

function frame(now) {
  frameHandle = 0;
  const rawDelta = previousTime ? now - previousTime : 16.7;
  const dt = Math.min(rawDelta / 1000, .05);
  previousTime = now;
  if (game.state === 'playing') {
    frameAverage += (Math.min(rawDelta, 80) - frameAverage) * .035;
    if (now - qualityTime >= 1100) {
      if (frameAverage > 21 && renderer.quality > 0) renderer.quality--;
      else if (frameAverage < 18 && renderer.quality < 2) renderer.quality++;
      qualityTime = now;
    }
    if (nudgeDirection !== null) {
      game.nudge(nudgeDirection);
      nudgeDirection = null;
    }
    if (nextLaunch) {
      game.launch();
      nextLaunch = false;
    }
    lag += dt;
    while (lag >= STEP && game.state === 'playing') {
      stepInput.left = input.left || flipperPulse.left > 0;
      stepInput.right = input.right || flipperPulse.right > 0;
      stepInput.launch = input.launch;
      flipperPulse.left = Math.max(0, flipperPulse.left - STEP);
      flipperPulse.right = Math.max(0, flipperPulse.right - STEP);
      lag -= STEP;
      game.step(stepInput);
    }
    renderer.update(dt, game);
    audio.update();
    needsDraw = true;
  }
  if (shownScore !== game.score) {
    const difference = game.score - shownScore;
    shownScore = settings.reduced || game.state !== 'playing' ? game.score :
      shownScore + Math.min(difference, Math.max(1, Math.ceil(difference * dt * 15)));
  }
  text('score', format.format(shownScore));
  if (hudDirty || (game.state === 'playing' && now >= nextHud)) {
    nextHud = now + 90;
    syncHud();
  }
  if (now >= nextSave) {
    nextSave = now + 1500;
    saveScores();
  }
  text('announcement', game.state === 'playing' && game.time < announcementUntil ? announcement : '');
  if (needsDraw) {
    renderer.draw(game);
    needsDraw = false;
  }
  if (game.state === 'playing') requestFrame();
}
