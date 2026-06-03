// se_gacha_roll.js
// ガチャ演出音: カプセルがコロコロ回る機械音（約2秒）
// 呼び出し: window.SE_GACHA_ROLL(audioCtx)
window.SE_GACHA_ROLL = function(audioCtx) {
  var now = audioCtx.currentTime;
  var duration = 2.0;

  // --- ガラガラ回転ノイズ ---
  var bufferSize = audioCtx.sampleRate * duration;
  var noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  var data = noiseBuffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15;
  }
  var noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // バンドパスフィルタで「ガラガラ」らしい帯域を強調
  var bpf = audioCtx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.setValueAtTime(400, now);
  bpf.frequency.linearRampToValueAtTime(200, now + duration);
  bpf.Q.value = 1.5;

  var noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.0, now);
  noiseGain.gain.linearRampToValueAtTime(0.6, now + 0.1);
  noiseGain.gain.linearRampToValueAtTime(0.5, now + 1.5);
  noiseGain.gain.linearRampToValueAtTime(0.0, now + duration);

  noiseSource.connect(bpf);
  bpf.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noiseSource.start(now);
  noiseSource.stop(now + duration);

  // --- コツコツ打撃音（カプセルが当たる感触）ランダム間隔 ---
  var clickIntervals = [0.0, 0.12, 0.27, 0.38, 0.51, 0.63, 0.78, 0.90,
                        1.05, 1.18, 1.32, 1.44, 1.60, 1.75, 1.88];
  clickIntervals.forEach(function(t) {
    var clickOsc = audioCtx.createOscillator();
    var clickGain = audioCtx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(180 + Math.random() * 80, now + t);
    clickGain.gain.setValueAtTime(0.25, now + t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.06);
    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    clickOsc.start(now + t);
    clickOsc.stop(now + t + 0.06);
  });

  // --- 機械ゼンマイ音（低めのブーン）---
  var mechOsc = audioCtx.createOscillator();
  var mechGain = audioCtx.createGain();
  mechOsc.type = 'sawtooth';
  mechOsc.frequency.setValueAtTime(60, now);
  mechOsc.frequency.linearRampToValueAtTime(45, now + duration);
  mechGain.gain.setValueAtTime(0.08, now);
  mechGain.gain.setValueAtTime(0.08, now + 1.6);
  mechGain.gain.linearRampToValueAtTime(0.0, now + duration);
  mechOsc.connect(mechGain);
  mechGain.connect(audioCtx.destination);
  mechOsc.start(now);
  mechOsc.stop(now + duration);
};
