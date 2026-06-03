// se_dice.js
// サイコロを振る音: カラカラ転がる音（約1秒）
// 呼び出し: window.SE_DICE(audioCtx)
window.SE_DICE = function(audioCtx) {
  var now = audioCtx.currentTime;
  var duration = 1.0;

  // ===== ころころ転がる高周波ノイズ =====
  var bufSize = Math.floor(audioCtx.sampleRate * duration);
  var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.12;
  }
  var noise = audioCtx.createBufferSource();
  noise.buffer = buf;

  var hpf = audioCtx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.setValueAtTime(1000, now);
  hpf.Q.value = 0.8;

  var noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.0, now);
  noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.05);
  noiseGain.gain.setValueAtTime(0.5, now + 0.7);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(hpf);
  hpf.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + duration);

  // ===== コツコツ当たる打音（角が当たる感じ）=====
  // 不規則な間隔で「コツ」と鳴らす
  var hits = [];
  var t = 0.0;
  while (t < 0.85) {
    hits.push(t);
    // 最初は速く、最後は遅くなる（減速感）
    var gap = 0.04 + (t / 0.85) * 0.08 + Math.random() * 0.03;
    t += gap;
  }
  hits.push(0.88); // 最後の一音

  hits.forEach(function(ht) {
    var osc = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    osc.type = 'triangle';
    var baseFreq = 300 + Math.random() * 200;
    osc.frequency.setValueAtTime(baseFreq, now + ht);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + ht + 0.04);
    gainNode.gain.setValueAtTime(0.0, now + ht);
    gainNode.gain.linearRampToValueAtTime(0.22, now + ht + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + ht + 0.05);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now + ht);
    osc.stop(now + ht + 0.06);
  });

  // ===== 最後の「ストン」と止まる音 =====
  var stopOsc = audioCtx.createOscillator();
  var stopGain = audioCtx.createGain();
  stopOsc.type = 'triangle';
  stopOsc.frequency.setValueAtTime(180, now + 0.90);
  stopOsc.frequency.exponentialRampToValueAtTime(100, now + 0.95);
  stopGain.gain.setValueAtTime(0.0, now + 0.90);
  stopGain.gain.linearRampToValueAtTime(0.28, now + 0.902);
  stopGain.gain.exponentialRampToValueAtTime(0.001, now + 1.00);
  stopOsc.connect(stopGain);
  stopGain.connect(audioCtx.destination);
  stopOsc.start(now + 0.90);
  stopOsc.stop(now + 1.01);
};
