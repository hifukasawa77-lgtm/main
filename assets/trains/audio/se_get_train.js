// se_get_train.js
// 車両獲得音（コモン/レア共通）: キラキラした明るいチャイム音（約1.5秒）
// 呼び出し: window.SE_GET_TRAIN(audioCtx)
window.SE_GET_TRAIN = function(audioCtx) {
  var now = audioCtx.currentTime;

  // 明るいチャイム音階（C5 E5 G5 C6）
  var notes = [
    { freq: 523.25, time: 0.00 },   // C5
    { freq: 659.25, time: 0.18 },   // E5
    { freq: 783.99, time: 0.34 },   // G5
    { freq: 1046.5, time: 0.52 },   // C6
    { freq: 1318.5, time: 0.72 },   // E6（キラキラ余韻）
    { freq: 1567.98, time: 0.90 }   // G6（最後の輝き）
  ];

  notes.forEach(function(note) {
    // シネ波で柔らかいチャイム
    var osc = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, now + note.time);

    gainNode.gain.setValueAtTime(0.0, now + note.time);
    gainNode.gain.linearRampToValueAtTime(0.28, now + note.time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + note.time + 0.6);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now + note.time);
    osc.stop(now + note.time + 0.65);

    // 倍音を重ねてキラキラ感を出す（2倍音、小さめ）
    var osc2 = audioCtx.createOscillator();
    var gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(note.freq * 2, now + note.time);
    gain2.gain.setValueAtTime(0.0, now + note.time);
    gain2.gain.linearRampToValueAtTime(0.08, now + note.time + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + note.time + 0.5);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + note.time);
    osc2.stop(now + note.time + 0.55);
  });

  // 全体を包む柔らかいシマー（高周波キラキラ持続）
  var shimmerOsc = audioCtx.createOscillator();
  var shimmerGain = audioCtx.createGain();
  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.setValueAtTime(2093, now + 0.5); // C7
  shimmerGain.gain.setValueAtTime(0.0, now + 0.5);
  shimmerGain.gain.linearRampToValueAtTime(0.06, now + 0.6);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  shimmerOsc.connect(shimmerGain);
  shimmerGain.connect(audioCtx.destination);
  shimmerOsc.start(now + 0.5);
  shimmerOsc.stop(now + 1.5);
};
