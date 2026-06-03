// se_door_close.js
// 電車のドアが閉まる音（約1.5秒）
// 呼び出し: window.SE_DOOR_CLOSE(audioCtx)
window.SE_DOOR_CLOSE = function(audioCtx) {
  var now = audioCtx.currentTime;

  // ===== 警告チャイム（ドア閉まり前ブザー）=====
  // 「ドンカン」2音（開く時より少し低い）
  var chime1 = audioCtx.createOscillator();
  var chimeGain1 = audioCtx.createGain();
  chime1.type = 'sine';
  chime1.frequency.setValueAtTime(1108.73, now); // C#6（高い方から）
  chimeGain1.gain.setValueAtTime(0.0, now);
  chimeGain1.gain.linearRampToValueAtTime(0.20, now + 0.01);
  chimeGain1.gain.setValueAtTime(0.20, now + 0.14);
  chimeGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
  chime1.connect(chimeGain1);
  chimeGain1.connect(audioCtx.destination);
  chime1.start(now);
  chime1.stop(now + 0.27);

  var chime2 = audioCtx.createOscillator();
  var chimeGain2 = audioCtx.createGain();
  chime2.type = 'sine';
  chime2.frequency.setValueAtTime(880, now + 0.28); // A5（低い方へ）
  chimeGain2.gain.setValueAtTime(0.0, now + 0.28);
  chimeGain2.gain.linearRampToValueAtTime(0.20, now + 0.29);
  chimeGain2.gain.setValueAtTime(0.20, now + 0.42);
  chimeGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  chime2.connect(chimeGain2);
  chimeGain2.connect(audioCtx.destination);
  chime2.start(now + 0.28);
  chime2.stop(now + 0.56);

  // ===== ドアがスライドして閉まるノイズ（高め→低め）=====
  var slideStart = 0.60;
  var slideDuration = 0.65;
  var bufSize = Math.floor(audioCtx.sampleRate * slideDuration);
  var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) {
    var progress = i / bufSize;
    // 閉まりは後半で加速、最後にドンと止まる
    var envelope = progress < 0.6
      ? 0.6 + progress * 0.4
      : 1.0;
    d[i] = (Math.random() * 2 - 1) * 0.22 * envelope;
  }
  var noise = audioCtx.createBufferSource();
  noise.buffer = buf;

  var lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(500, now + slideStart);
  lpf.frequency.linearRampToValueAtTime(200, now + slideStart + slideDuration);

  var noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.20, now + slideStart);
  noiseGain.gain.linearRampToValueAtTime(0.28, now + slideStart + slideDuration * 0.7);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + slideStart + slideDuration + 0.05);

  noise.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start(now + slideStart);
  noise.stop(now + slideStart + slideDuration + 0.06);

  // ===== 閉まり切った「ガンッ」インパクト音 =====
  var endTime = slideStart + slideDuration;

  var impOsc = audioCtx.createOscillator();
  var impGain = audioCtx.createGain();
  impOsc.type = 'triangle';
  impOsc.frequency.setValueAtTime(150, now + endTime);
  impOsc.frequency.exponentialRampToValueAtTime(70, now + endTime + 0.10);
  impGain.gain.setValueAtTime(0.0, now + endTime);
  impGain.gain.linearRampToValueAtTime(0.35, now + endTime + 0.004);
  impGain.gain.exponentialRampToValueAtTime(0.001, now + endTime + 0.18);
  impOsc.connect(impGain);
  impGain.connect(audioCtx.destination);
  impOsc.start(now + endTime);
  impOsc.stop(now + endTime + 0.19);

  // インパクト時の金属的なリング
  var ringOsc = audioCtx.createOscillator();
  var ringGain = audioCtx.createGain();
  ringOsc.type = 'sine';
  ringOsc.frequency.setValueAtTime(440, now + endTime);
  ringGain.gain.setValueAtTime(0.0, now + endTime);
  ringGain.gain.linearRampToValueAtTime(0.10, now + endTime + 0.005);
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + endTime + 0.25);
  ringOsc.connect(ringGain);
  ringGain.connect(audioCtx.destination);
  ringOsc.start(now + endTime);
  ringOsc.stop(now + endTime + 0.26);
};
