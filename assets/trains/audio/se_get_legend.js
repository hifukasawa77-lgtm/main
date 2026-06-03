// se_get_legend.js
// レジェンド車両獲得音（ドクターイエロー等）: ファンファーレ風の豪華なSE（約3秒）
// 呼び出し: window.SE_GET_LEGEND(audioCtx)
window.SE_GET_LEGEND = function(audioCtx) {
  var now = audioCtx.currentTime;

  // ===== ファンファーレ主旋律（ブラス風）=====
  // C5 → G5 → E5 → C6（勝利コード感）
  var fanfare = [
    { freq: 523.25, start: 0.00, dur: 0.28 },  // C5
    { freq: 523.25, start: 0.00, dur: 0.28 },  // C5（2音重ね）
    { freq: 659.25, start: 0.30, dur: 0.18 },  // E5
    { freq: 783.99, start: 0.50, dur: 0.18 },  // G5
    { freq: 1046.5, start: 0.70, dur: 0.55 },  // C6（伸ばす）
    { freq: 1174.66, start: 1.28, dur: 0.18 }, // D6
    { freq: 1318.5, start: 1.48, dur: 0.18 },  // E6
    { freq: 1567.98, start: 1.70, dur: 0.70 }, // G6（フィナーレ）
    { freq: 2093.0, start: 2.45, dur: 0.55 }   // C7（最高音〆）
  ];

  fanfare.forEach(function(note) {
    // ブラス風: sawtooth + フィルタ
    var osc = audioCtx.createOscillator();
    var filter = audioCtx.createBiquadFilter();
    var gainNode = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(note.freq, now + note.start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now + note.start);
    filter.Q.value = 1.0;

    gainNode.gain.setValueAtTime(0.0, now + note.start);
    gainNode.gain.linearRampToValueAtTime(0.22, now + note.start + 0.03);
    gainNode.gain.setValueAtTime(0.22, now + note.start + note.dur - 0.04);
    gainNode.gain.linearRampToValueAtTime(0.0, now + note.start + note.dur);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.05);

    // 純音の倍音（明るさ補強）
    var osc2 = audioCtx.createOscillator();
    var gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(note.freq, now + note.start);
    gain2.gain.setValueAtTime(0.0, now + note.start);
    gain2.gain.linearRampToValueAtTime(0.12, now + note.start + 0.03);
    gain2.gain.setValueAtTime(0.12, now + note.start + note.dur - 0.04);
    gain2.gain.linearRampToValueAtTime(0.0, now + note.start + note.dur);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + note.start);
    osc2.stop(now + note.start + note.dur + 0.05);
  });

  // ===== キラキラチャイム装飾（上から降る）=====
  var sparkles = [
    { freq: 4186.0, time: 0.10 },  // C8
    { freq: 3520.0, time: 0.22 },  // A7
    { freq: 2793.83, time: 0.35 }, // F7
    { freq: 2093.0, time: 0.48 },  // C7
    { freq: 4186.0, time: 0.80 },
    { freq: 3136.0, time: 0.90 },  // G7
    { freq: 2637.0, time: 1.00 },  // E7
    { freq: 4186.0, time: 1.75 },
    { freq: 3520.0, time: 1.85 },
    { freq: 2793.83, time: 1.95 },
    { freq: 4186.0, time: 2.50 },
    { freq: 3520.0, time: 2.62 },
    { freq: 4186.0, time: 2.75 }
  ];

  sparkles.forEach(function(s) {
    var osc = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(s.freq, now + s.time);
    gainNode.gain.setValueAtTime(0.0, now + s.time);
    gainNode.gain.linearRampToValueAtTime(0.07, now + s.time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + s.time + 0.35);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now + s.time);
    osc.stop(now + s.time + 0.36);
  });

  // ===== ドラム風アクセント（スネア的な打音）=====
  var drumTimes = [0.0, 0.30, 0.70, 1.28];
  drumTimes.forEach(function(t) {
    var bufSize = Math.floor(audioCtx.sampleRate * 0.08);
    var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
    }
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var bpf = audioCtx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 200;
    bpf.Q.value = 0.8;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.18, now + t);
    g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);
    src.connect(bpf);
    bpf.connect(g);
    g.connect(audioCtx.destination);
    src.start(now + t);
    src.stop(now + t + 0.09);
  });

  // ===== 終音のリバーブ風余韻（低いサイン波の響き）=====
  var reverbOsc = audioCtx.createOscillator();
  var reverbGain = audioCtx.createGain();
  reverbOsc.type = 'sine';
  reverbOsc.frequency.setValueAtTime(261.63, now + 2.0); // C4（土台）
  reverbGain.gain.setValueAtTime(0.0, now + 2.0);
  reverbGain.gain.linearRampToValueAtTime(0.12, now + 2.1);
  reverbGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
  reverbOsc.connect(reverbGain);
  reverbGain.connect(audioCtx.destination);
  reverbOsc.start(now + 2.0);
  reverbOsc.stop(now + 3.0);
};
