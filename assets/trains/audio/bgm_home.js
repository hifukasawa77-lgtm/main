// bgm_home.js
// ホーム画面BGM: 軽快で明るい電車・旅テーマのジングル風ループBGM（約12秒でループ）
// 呼び出し:
//   var handle = window.BGM_HOME_START(audioCtx);  // 再生開始
//   window.BGM_HOME_STOP(handle);                   // 停止（フェードアウト）
//
// 実装方式: Web Audio API プロシージャル生成（AudioBufferSourceNode + スケジューリング）

(function() {
  'use strict';

  // ===== 音楽定数 =====
  var BPM = 126;
  var BEAT = 60 / BPM;       // 1拍の長さ（秒）
  var BAR = BEAT * 4;        // 1小節

  // スケール: Cメジャーペンタトニック（子どもに馴染みやすく明るい）
  // C4=261.63, D4=293.66, E4=329.63, G4=392.00, A4=440.00, C5=523.25 ...
  var NOTE = {
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
    C6: 1046.5, D6: 1174.66, E6: 1318.5, G6: 1567.98
  };

  // ===== メロディ（8小節 = 約15.2秒 @BPM126）=====
  // 電車出発・旅立ちをイメージした軽快なフレーズ
  // [周波数, 開始拍(0始まり), 長さ(拍)]
  var MELODY = [
    // フレーズA（出発！）
    [NOTE.E5, 0,   0.5], [NOTE.G5, 0.5, 0.5],
    [NOTE.A5, 1,   0.5], [NOTE.G5, 1.5, 0.5],
    [NOTE.E5, 2,   0.5], [NOTE.C5, 2.5, 0.5],
    [NOTE.D5, 3,   1.0],

    // フレーズB（旅路）
    [NOTE.G5, 4,   0.5], [NOTE.A5, 4.5, 0.5],
    [NOTE.C6, 5,   1.0],
    [NOTE.A5, 6,   0.5], [NOTE.G5, 6.5, 0.5],
    [NOTE.E5, 7,   1.0],

    // フレーズC（車窓）
    [NOTE.D5, 8,   0.5], [NOTE.E5, 8.5, 0.5],
    [NOTE.G5, 9,   0.5], [NOTE.A5, 9.5, 0.5],
    [NOTE.G5, 10,  0.5], [NOTE.E5, 10.5, 0.5],
    [NOTE.D5, 11,  1.0],

    // フレーズD（次の駅へ！　クライマックス）
    [NOTE.E5, 12,  0.5], [NOTE.G5, 12.5, 0.5],
    [NOTE.A5, 13,  0.5], [NOTE.C6, 13.5, 0.5],
    [NOTE.G5, 14,  0.5], [NOTE.E5, 14.5, 0.25],
    [NOTE.D5, 14.75, 0.25],
    [NOTE.C5, 15,  1.0]   // 締め → ここでループに戻る
  ];

  var LOOP_BEATS = 16; // 16拍でループ
  var LOOP_DURATION = LOOP_BEATS * BEAT;

  // ===== ベース（シンプルなルート音）=====
  var BASS = [
    [NOTE.C4, 0, 0.8], [NOTE.C4, 2, 0.8],
    [NOTE.G4, 4, 0.8], [NOTE.G4, 6, 0.8],
    [NOTE.A4, 8, 0.8], [NOTE.A4, 10, 0.8],
    [NOTE.G4, 12, 0.8], [NOTE.C4, 14, 0.8], [NOTE.C4, 15, 0.5]
  ];

  // ===== コード（背景の和音）=====
  var CHORDS = [
    // [周波数配列, 開始拍, 長さ]
    { freqs: [NOTE.C4, NOTE.E4, NOTE.G4], beat: 0,  dur: 4 },  // C
    { freqs: [NOTE.G4, NOTE.D4, NOTE.G4], beat: 4,  dur: 4 },  // G
    { freqs: [NOTE.A4, NOTE.E4, NOTE.A4], beat: 8,  dur: 4 },  // Am
    { freqs: [NOTE.G4, NOTE.D4, NOTE.G4], beat: 12, dur: 4 }   // G
  ];

  // ===== リズム（打楽器的なパルス）=====
  // キックとスネア風のシンプルなリズム
  var KICK_BEATS  = [0, 2, 4, 6, 8, 10, 12, 14];      // 拍の頭
  var SNARE_BEATS = [1, 3, 5, 7, 9, 11, 13, 15];      // 裏拍
  var HI_BEATS    = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,  // 8分音符ハット
                     4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5,
                     8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5,
                     12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5];

  // ===== 音符生成ユーティリティ =====
  function playNote(ctx, freq, startTime, dur, type, volume, attack, release) {
    var osc = ctx.createOscillator();
    var gainNode = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(0.0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + (attack || 0.01));
    gainNode.gain.setValueAtTime(volume, startTime + dur - (release || 0.04));
    gainNode.gain.linearRampToValueAtTime(0.0, startTime + dur);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.01);
    return { osc: osc, gain: gainNode };
  }

  function playKick(ctx, t) {
    var osc = ctx.createOscillator();
    var gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gainNode.gain.setValueAtTime(0.0, t);
    gainNode.gain.linearRampToValueAtTime(0.30, t + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  function playSnare(ctx, t) {
    var bufSize = Math.floor(ctx.sampleRate * 0.12);
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.4));
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1500;
    var gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.10, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(hpf);
    hpf.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.13);
  }

  function playHiHat(ctx, t) {
    var bufSize = Math.floor(ctx.sampleRate * 0.06);
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 6000;
    var gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.04, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hpf);
    hpf.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.06);
  }

  // ===== 1ループ分のスケジューリング =====
  function scheduleLoop(ctx, startTime, masterGain) {
    // メロディ
    MELODY.forEach(function(m) {
      var t = startTime + m[1] * BEAT;
      var dur = m[2] * BEAT * 0.85; // 少し短くスタッカート気味
      var osc = ctx.createOscillator();
      var gainNode = ctx.createGain();
      osc.type = 'triangle'; // まろやかな笛風
      osc.frequency.setValueAtTime(m[0], t);
      gainNode.gain.setValueAtTime(0.0, t);
      gainNode.gain.linearRampToValueAtTime(0.22, t + 0.015);
      gainNode.gain.setValueAtTime(0.22, t + dur - 0.03);
      gainNode.gain.linearRampToValueAtTime(0.0, t + dur);
      osc.connect(gainNode);
      gainNode.connect(masterGain);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });

    // ベース
    BASS.forEach(function(b) {
      var t = startTime + b[1] * BEAT;
      var dur = b[2] * BEAT;
      var osc = ctx.createOscillator();
      var gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b[0] / 2, t); // オクターブ下げてベース感
      gainNode.gain.setValueAtTime(0.0, t);
      gainNode.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gainNode.gain.setValueAtTime(0.16, t + dur - 0.04);
      gainNode.gain.linearRampToValueAtTime(0.0, t + dur);
      osc.connect(gainNode);
      gainNode.connect(masterGain);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });

    // 和音（コード）
    CHORDS.forEach(function(chord) {
      chord.freqs.forEach(function(freq) {
        var t = startTime + chord.beat * BEAT;
        var dur = chord.dur * BEAT * 0.95;
        var osc = ctx.createOscillator();
        var gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gainNode.gain.setValueAtTime(0.0, t);
        gainNode.gain.linearRampToValueAtTime(0.06, t + 0.05);
        gainNode.gain.setValueAtTime(0.06, t + dur - 0.1);
        gainNode.gain.linearRampToValueAtTime(0.0, t + dur);
        osc.connect(gainNode);
        gainNode.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      });
    });

    // ドラム系
    KICK_BEATS.forEach(function(b) {
      var tempCtx = ctx;
      // キックはdestinationへ直接（音量バランス調整済み）
      playKick(tempCtx, startTime + b * BEAT);
    });
    SNARE_BEATS.forEach(function(b) {
      playSnare(ctx, startTime + b * BEAT);
    });
    HI_BEATS.forEach(function(b) {
      playHiHat(ctx, startTime + b * BEAT);
    });

    // 電車っぽいシュッという効果音（各フレーズ頭）
    [0, 4, 8, 12].forEach(function(b) {
      var t = startTime + b * BEAT;
      var bufSize = Math.floor(ctx.sampleRate * 0.15);
      var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) {
        var env = Math.exp(-i / (bufSize * 0.5));
        d[i] = (Math.random() * 2 - 1) * 0.12 * env;
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 3000;
      var gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.08, t);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      src.connect(hpf);
      hpf.connect(gainNode);
      gainNode.connect(masterGain);
      src.start(t);
      src.stop(t + 0.16);
    });
  }

  // ===== ループスケジューラー =====
  // 先読みスケジューリングで途切れなくループ
  var SCHEDULE_AHEAD = 0.2; // 先読み時間（秒）
  var LOOP_CHECK_INTERVAL = 100; // チェック間隔（ms）

  window.BGM_HOME_START = function(audioCtx) {
    var masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.85, audioCtx.currentTime + 1.0); // フェードイン
    masterGain.connect(audioCtx.destination);

    var handle = {
      active: true,
      masterGain: masterGain,
      nextLoopTime: audioCtx.currentTime,
      timerId: null
    };

    function schedule() {
      if (!handle.active) return;

      // 現在時刻より先にスケジューリングが必要なループを追加
      while (handle.nextLoopTime < audioCtx.currentTime + SCHEDULE_AHEAD + LOOP_DURATION) {
        scheduleLoop(audioCtx, handle.nextLoopTime, masterGain);
        handle.nextLoopTime += LOOP_DURATION;
      }

      handle.timerId = setTimeout(schedule, LOOP_CHECK_INTERVAL);
    }

    schedule();
    return handle;
  };

  window.BGM_HOME_STOP = function(handle) {
    if (!handle || !handle.active) return;
    handle.active = false;
    if (handle.timerId) {
      clearTimeout(handle.timerId);
      handle.timerId = null;
    }
    // フェードアウト
    var now = handle.masterGain.context.currentTime;
    handle.masterGain.gain.setValueAtTime(handle.masterGain.gain.value, now);
    handle.masterGain.gain.linearRampToValueAtTime(0.0, now + 1.5);
  };

})();
