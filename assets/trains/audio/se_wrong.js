// se_wrong.js
// クイズ不正解音（優しい音）: 穏やかなブー音（子どもが泣かないよう配慮。約0.8秒）
// 呼び出し: window.SE_WRONG(audioCtx)
window.SE_WRONG = function(audioCtx) {
  var now = audioCtx.currentTime;

  // 低めの丸い音（ボワン、とした優しい感じ）。サイン波で柔らかく
  var osc1 = audioCtx.createOscillator();
  var gain1 = audioCtx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(220, now);       // A3
  osc1.frequency.linearRampToValueAtTime(180, now + 0.4); // 少し下がる
  gain1.gain.setValueAtTime(0.0, now);
  gain1.gain.linearRampToValueAtTime(0.22, now + 0.06);
  gain1.gain.setValueAtTime(0.22, now + 0.35);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);
  osc1.start(now);
  osc1.stop(now + 0.76);

  // 少し高めの同系音を重ねてぼんやりした響きに
  var osc2 = audioCtx.createOscillator();
  var gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(277.18, now);     // C#4 相当（不協和感を抑えた柔らかい音）
  osc2.frequency.linearRampToValueAtTime(233.08, now + 0.4); // Bb3 相当
  gain2.gain.setValueAtTime(0.0, now);
  gain2.gain.linearRampToValueAtTime(0.12, now + 0.08);
  gain2.gain.setValueAtTime(0.12, now + 0.30);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.70);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(now);
  osc2.stop(now + 0.71);

  // 低域の柔らかいローパスフィルタを通したノイズ（ふわっと感）
  var bufSize = Math.floor(audioCtx.sampleRate * 0.8);
  var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.04;
  }
  var noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  var lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 300;
  var noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.0, now);
  noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
  noise.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + 0.66);
};
