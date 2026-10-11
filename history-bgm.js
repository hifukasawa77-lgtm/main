/* Original music, shared accessible playback controls. No third-party services. */
(() => {
  'use strict';
  const theme = document.currentScript.dataset.theme;
  const audio = new Audio(`assets/audio/${theme}-dawn.wav`);
  audio.loop = true;
  audio.preload = 'none';
  let enabled = true;
  let started = false;
  let volume = 0.32;
  try {
    enabled = localStorage.getItem('history-bgm-enabled') !== 'false';
    const saved = Number(localStorage.getItem('history-bgm-volume') ?? 0.32);
    if (Number.isFinite(saved)) volume = Math.max(0, Math.min(1, saved));
  } catch (_) {}
  audio.volume = volume;
  const panel = document.createElement('div');
  panel.className = 'history-music';
  panel.innerHTML = '<button type="button" aria-pressed="false">♪ BGMを再生 / Play</button><label>音量 / Volume <input type="range" min="0" max="100" aria-label="BGM音量 / Music volume"></label>';
  const style = document.createElement('style');
  style.textContent = '.history-music{position:fixed;left:12px;bottom:8px;z-index:120;display:flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid #ad915d;border-radius:6px;background:#fff9edf2;color:#423a2b;font:11px system-ui;box-shadow:0 2px 12px #392a2222}.history-music button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;min-height:30px}.history-music label{display:flex;align-items:center;gap:6px}.history-music input{width:70px;accent-color:#a6462d}.history-music :focus-visible{outline:2px solid #a6462d;outline-offset:2px}@media(max-width:600px){.history-music{left:4px;bottom:3px;font-size:10px;padding:2px 6px;gap:4px}.history-music input{width:45px}}';
  document.head.append(style);
  document.body.append(panel);
  // Native modal dialogs make the rest of the document inert.
  function placeControls() {
    const modal = document.querySelector('dialog[open]');
    const host = modal || document.body;
    if (panel.parentNode !== host) host.append(panel);
  }
  document.querySelectorAll('dialog').forEach(dialog => {
    new MutationObserver(placeControls).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  });
  placeControls();
  const button = panel.querySelector('button');
  const slider = panel.querySelector('input');
  slider.value = volume * 100;
  function persist(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function update() {
    button.textContent = audio.paused ? '♪ BGMを再生 / Play' : '♪ BGM停止 / Pause';
    button.setAttribute('aria-pressed', String(!audio.paused));
  }
  async function play() {
    if (!enabled || document.hidden) return;
    try { await audio.play(); started = true; } catch (_) {
      button.textContent = '♪ 再生を再試行 / Retry';
    }
  }
  button.addEventListener('click', () => {
    if (audio.paused) { enabled = true; play(); }
    else { enabled = false; audio.pause(); update(); }
    persist('history-bgm-enabled', String(enabled));
  });
  slider.addEventListener('input', () => {
    audio.volume = Number(slider.value) / 100;
    persist('history-bgm-volume', String(audio.volume));
  });
  audio.addEventListener('play', update);
  audio.addEventListener('pause', update);
  audio.addEventListener('error', () => { button.textContent = '♪ 読込失敗・再試行 / Retry'; });
  function unlock(event) {
    if (panel.contains(event.target)) return;
    if (event.type === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
    if (!started && enabled) play();
  }
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
    else if (started && enabled) play();
  });
})();
