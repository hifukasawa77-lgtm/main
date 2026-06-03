// se_door_open.js
// 電車のドアが開く音（約1.5秒）
// 呼び出し: window.SE_DOOR_OPEN(audioCtx)
window.SE_DOOR_OPEN = function(audioCtx) {
  var now = audioCtx.currentTime;

  // ===== 警告チャイム（ドア開放前ブザー）=====
  // 「ピンポン」2音
  var chime1 = audioCtx.createOscillator();
  var chimeGain1 = audioCtx.createGain();
  chime1.type = 'sine';
  chime1.frequency.setValueAtTime(880, now);    // A5
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
  chime2.frequency.setValueAtTime(1108.73, now + 0.28); // C#6
  chimeGain2.gain.setValueAtTime(0.0, now + 0.28);
  chimeGain2.gain.linearRampToValueAtTime(0.20, now + 0.29);
  chimeGain2.gain.setValueAtTime(0.20, now + 0.42);
  chimeGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  chime2.connect(chimeGain2);
  chimeGain2.connect(audioCtx.destination);
  chime2.start(now + 0.28);
  chime2.stop(now + 0.56);

  // ===== ドアがスライドして開くノイズ =====
  var slideStart = 0.60;
  var slideDuration = 0.70;
  var bufSize = Math.floor(audioCtx.sampleRate * slideDuration);
  var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) {
    // 前半は加速、後半は減速してドアが開き切る感じ
    var progress = i / bufSize;
    var envelope = progress < 0.3
      ? progress / 0.3
      : 1.0 - (progress - 0.3) / 0.7;
    d[i] = (Math.random() * 2 - 1) * 0.25 * envelope;
  }
  var noise = audioCtx.createBufferSource();
  noise.buffer = buf;

  var lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(600, now + slideStart);
  lpf.frequency.linearRampToValueAtTime(300, now + slideStart + slideDuration);

  var noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.30, now + slideStart);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + slideStart + slideDuration);

  noise.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start(now + slideStart);
  noise.stop(now + slideStart + slideDuration + 0.01);

  // ===== ドアが開き切った「ガチャ」音 =====
  var endTime = slideStart + slideDuration;
  var stopOsc = audioCtx.createOscillator();
  var stopGain = audioCtx.createGain();
  stopOsc.type = 'triangle';
  stopOsc.frequency.setValueAtTime(200, now + endTime);
  stopOsc.frequency.exponentialRampToValueAtTime(100, now + endTime + 0.06);
  stopGain.gain.setValueAtTime(0.0, now + endTime);
  stopGain.gain.linearRampToValueAtTime(0.22, now + endTime + 0.005);
  stopGain.gain.exponentialRampToValueAtTime(0.001, now + endTime + 0.10);
  stopOsc.connect(stopGain);
  stopGain.connect(audioCtx.destination);
  stopOsc.start(now + endTime);
  stopOsc.stop(now + endTime + 0.11);
};
