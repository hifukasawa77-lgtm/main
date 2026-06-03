// se_correct.js
// クイズ正解音: 明るいピコピコ音（約0.8秒）
// 呼び出し: window.SE_CORRECT(audioCtx)
window.SE_CORRECT = function(audioCtx) {
  var now = audioCtx.currentTime;

  // ピコピコ3音上昇（子どもに馴染みやすい電子音）
  var notes = [
    { freq: 659.25, time: 0.00, dur: 0.12 },  // E5
    { freq: 783.99, time: 0.14, dur: 0.12 },  // G5
    { freq: 1046.5, time: 0.28, dur: 0.20 }   // C6（明るく締め）
  ];

  notes.forEach(function(note) {
    var osc = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    osc.type = 'square'; // ピコピコ感
    osc.frequency.setValueAtTime(note.freq, now + note.time);
    gainNode.gain.setValueAtTime(0.0, now + note.time);
    gainNode.gain.linearRampToValueAtTime(0.18, now + note.time + 0.01);
    gainNode.gain.setValueAtTime(0.18, now + note.time + note.dur - 0.02);
    gainNode.gain.linearRampToValueAtTime(0.0, now + note.time + note.dur);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now + note.time);
    osc.stop(now + note.time + note.dur + 0.01);
  });

  // キラリとした余韻（高いサイン波）
  var shineOsc = audioCtx.createOscillator();
  var shineGain = audioCtx.createGain();
  shineOsc.type = 'sine';
  shineOsc.frequency.setValueAtTime(2093.0, now + 0.30); // C7
  shineGain.gain.setValueAtTime(0.0, now + 0.30);
  shineGain.gain.linearRampToValueAtTime(0.10, now + 0.32);
  shineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.80);
  shineOsc.connect(shineGain);
  shineGain.connect(audioCtx.destination);
  shineOsc.start(now + 0.30);
  shineOsc.stop(now + 0.80);
};
