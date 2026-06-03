// se_stamp.js
// スタンプ取得音: ペタッとスタンプを押す音 + 小さなチャイム（約1秒）
// 呼び出し: window.SE_STAMP(audioCtx)
window.SE_STAMP = function(audioCtx) {
  var now = audioCtx.currentTime;

  // ===== ペタッ音（スタンプのインパクト）=====
  // 短い低音アタック
  var stampOsc = audioCtx.createOscillator();
  var stampGain = audioCtx.createGain();
  stampOsc.type = 'triangle';
  stampOsc.frequency.setValueAtTime(120, now);
  stampOsc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
  stampGain.gain.setValueAtTime(0.0, now);
  stampGain.gain.linearRampToValueAtTime(0.35, now + 0.008);
  stampGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  stampOsc.connect(stampGain);
  stampGain.connect(audioCtx.destination);
  stampOsc.start(now);
  stampOsc.stop(now + 0.13);

  // スタンプのザッという圧着ノイズ
  var bufSize = Math.floor(audioCtx.sampleRate * 0.08);
  var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.4));
  }
  var noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  var bpf = audioCtx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 600;
  bpf.Q.value = 1.2;
  var noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.20, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(bpf);
  bpf.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + 0.09);

  // ===== 小さなチャイム（スタンプ後のご褒美音）=====
  var chimes = [
    { freq: 1046.5, time: 0.15 },  // C6
    { freq: 1318.5, time: 0.30 },  // E6
    { freq: 1567.98, time: 0.46 }  // G6
  ];

  chimes.forEach(function(c) {
    var osc = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(c.freq, now + c.time);
    gainNode.gain.setValueAtTime(0.0, now + c.time);
    gainNode.gain.linearRampToValueAtTime(0.14, now + c.time + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + c.time + 0.45);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now + c.time);
    osc.stop(now + c.time + 0.46);
  });
};
