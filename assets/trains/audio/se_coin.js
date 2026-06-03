// se_coin.js
// コイン獲得音: コインをチャリンと拾う音（明るい、約0.5秒）
// 呼び出し: window.SE_COIN(audioCtx)
window.SE_COIN = function(audioCtx) {
  var now = audioCtx.currentTime;

  // メイン音: 金属的な高音（チャリン）
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1480, now);          // F#6 あたり
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // 少し下がって落ち着く
  gain.gain.setValueAtTime(0.0, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.46);

  // 2倍音（煌めき）
  var osc2 = audioCtx.createOscillator();
  var gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2960, now);         // 2倍音
  osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
  gain2.gain.setValueAtTime(0.0, now);
  gain2.gain.linearRampToValueAtTime(0.12, now + 0.005);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(now);
  osc2.stop(now + 0.31);

  // コインが当たる瞬間のプチッ（インパクトノイズ）
  var bufSize = Math.floor(audioCtx.sampleRate * 0.02);
  var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
  }
  var ns = audioCtx.createBufferSource();
  ns.buffer = buf;
  var hpf = audioCtx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 3000;
  var ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.18, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  ns.connect(hpf);
  hpf.connect(ng);
  ng.connect(audioCtx.destination);
  ns.start(now);
  ns.stop(now + 0.03);
};
