// audio.js — beat_em_up.html 用 Web Audio API 音声定義
// 参考: zelda_like.html の playTone / scheduleAudio パターン
// このファイルの内容を beat_em_up.html の <script> 内に埋め込む

// ============================================================
//  低レベルユーティリティ
// ============================================================

/**
 * 単音を指定時刻に鳴らす（zelda_like.html 版と同設計）
 * @param {AudioContext} audioCtx
 * @param {number}  freq      - 周波数 [Hz]
 * @param {string}  type      - OscillatorType ('square'|'sawtooth'|'triangle'|'sine')
 * @param {number}  duration  - 発音時間 [s]
 * @param {number}  vol       - ピーク音量 [0-1]
 * @param {number}  startTime - audioCtx.currentTime 基準の開始時刻 [s]
 * @param {number}  [attack=0.02]  - アタック時間 [s]
 * @param {number}  [release=0.03] - リリース時間 [s]
 */
function playTone(audioCtx, freq, type, duration, vol, startTime, attack, release) {
    if (!audioCtx) return;
    const atk = (attack  !== undefined) ? attack  : 0.02;
    const rel = (release !== undefined) ? release : 0.03;
    const end = startTime + duration;

    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + atk);
    gain.gain.setValueAtTime(vol, Math.max(startTime + atk, end - rel));
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(end);
}

/**
 * 周波数スライド付きトーン（SE演出用）
 */
function playSlide(audioCtx, freqFrom, freqTo, type, duration, vol, startTime) {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, startTime);
    osc.frequency.linearRampToValueAtTime(freqTo, startTime + duration);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
}

/**
 * ノイズバースト（打撃の「ドスッ」成分）
 */
function playNoise(audioCtx, duration, vol, startTime, lowpass) {
    if (!audioCtx) return;
    const bufSize = Math.ceil(audioCtx.sampleRate * duration);
    const buf  = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src   = audioCtx.createBufferSource();
    const gain  = audioCtx.createGain();
    const filt  = audioCtx.createBiquadFilter();

    src.buffer = buf;
    filt.type = 'lowpass';
    filt.frequency.value = lowpass || 800;

    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(startTime);
    src.stop(startTime + duration);
}

// ============================================================
//  initAudio — AudioContext 初期化
// ============================================================

/**
 * AudioContext を初期化し、BGMスケジューラーをセットアップする。
 * ユーザー操作イベント（click / keydown）のハンドラ内で一度だけ呼ぶこと。
 * @param {object} audioState - { ctx, bgmKey, melodyIdx, bassIdx, melodyTime, bassTime, timer }
 */
function initAudio(audioState) {
    if (audioState.ctx) return;
    try {
        audioState.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioState.ctx.state === 'suspended') audioState.ctx.resume();
        const t = audioState.ctx.currentTime + 0.1;
        audioState.melodyTime = t;
        audioState.bassTime   = t;
        audioState.melodyIdx  = 0;
        audioState.bassIdx    = 0;
    } catch (e) {
        console.error('[audio.js] Web Audio API not supported:', e);
    }
}

// ============================================================
//  SE — 効果音 10 種
// ============================================================

/**
 * 効果音を再生する
 * @param {AudioContext} audioCtx
 * @param {string} type - SE種別 (see switch cases)
 */
function playSE(audioCtx, type) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;

    switch (type) {

        // ---- 1. パンチヒット（低め打撃音 + ノイズ）----
        case 'punch_hit':
            playNoise(audioCtx, 0.08, 0.6, t, 600);
            playTone(audioCtx, 120, 'sawtooth', 0.07, 0.10, t,     0.005, 0.05);
            playTone(audioCtx,  90, 'sawtooth', 0.10, 0.08, t+0.03, 0.005, 0.07);
            break;

        // ---- 2. キックヒット（やや高め + ノイズ）----
        case 'kick_hit':
            playNoise(audioCtx, 0.06, 0.5, t, 1200);
            playTone(audioCtx, 200, 'sawtooth', 0.06, 0.10, t,     0.005, 0.04);
            playSlide(audioCtx, 280, 140, 'square', 0.08, 0.07, t + 0.01);
            break;

        // ---- 3. プレイヤーダメージ（悲鳴的下降+ノイズ）----
        case 'player_hurt':
            playSlide(audioCtx, 440, 220, 'sawtooth', 0.20, 0.12, t);
            playNoise(audioCtx, 0.12, 0.35, t, 900);
            playTone(audioCtx, 180, 'square', 0.15, 0.07, t + 0.05, 0.01, 0.10);
            break;

        // ---- 4. 敵ダウン（ドカッ + 低重心）----
        case 'enemy_down':
            playNoise(audioCtx, 0.18, 0.7, t, 500);
            playSlide(audioCtx, 160, 60, 'sawtooth', 0.20, 0.12, t);
            playTone(audioCtx, 55, 'sine', 0.22, 0.10, t + 0.03, 0.01, 0.15);
            break;

        // ---- 5. ジャンプ（上昇スライド）----
        case 'jump':
            playSlide(audioCtx, 300, 600, 'square', 0.12, 0.06, t);
            playTone(audioCtx, 600, 'triangle', 0.08, 0.04, t + 0.10, 0.01, 0.06);
            break;

        // ---- 6. 必殺技発動（力溜め + 爆発）----
        case 'special':
            // チャージ感
            playSlide(audioCtx, 200, 900,  'sawtooth', 0.18, 0.08, t);
            playSlide(audioCtx, 200, 900,  'square',   0.18, 0.06, t + 0.02);
            // 爆発
            playNoise(audioCtx, 0.25, 0.8, t + 0.18, 1500);
            playTone(audioCtx, 80, 'sawtooth', 0.28, 0.15, t + 0.18, 0.01, 0.20);
            playSlide(audioCtx, 500, 100, 'sawtooth', 0.30, 0.10, t + 0.20);
            // 余韻
            playTone(audioCtx, 440, 'square', 0.10, 0.04, t + 0.40, 0.02, 0.08);
            playTone(audioCtx, 550, 'square', 0.10, 0.04, t + 0.48, 0.02, 0.08);
            break;

        // ---- 7. ナイフ投げ（鋭い高音スライド）----
        case 'knife_throw':
            playSlide(audioCtx, 1800, 900, 'sawtooth', 0.10, 0.05, t);
            playTone(audioCtx, 1400, 'square', 0.06, 0.03, t + 0.02, 0.005, 0.05);
            break;

        // ---- 8. 気功弾（チャージ → 発射 ビーム感）----
        case 'ki_ball':
            // チャージ：うなり
            playSlide(audioCtx, 160, 320, 'sawtooth', 0.15, 0.07, t);
            playSlide(audioCtx, 160, 320, 'square',   0.15, 0.05, t + 0.03);
            // 発射
            playSlide(audioCtx, 640, 1280, 'sawtooth', 0.20, 0.09, t + 0.15);
            playSlide(audioCtx, 640, 1280, 'square',   0.20, 0.07, t + 0.17);
            playTone(audioCtx, 1280, 'triangle', 0.12, 0.05, t + 0.30, 0.01, 0.10);
            break;

        // ---- 9. ステージクリア（短いファンファーレ）----
        case 'stage_clear': {
            // ファンファーレ音程: C5-E5-G5-C6
            const fanfare = [523, 659, 784, 1047];
            fanfare.forEach((f, i) => {
                playTone(audioCtx, f, 'square', 0.18, 0.08, t + i * 0.15, 0.02, 0.06);
                playTone(audioCtx, f / 2, 'triangle', 0.18, 0.05, t + i * 0.15, 0.02, 0.06);
            });
            // 最後に長め
            playTone(audioCtx, 1047, 'square',   0.45, 0.10, t + 0.60, 0.02, 0.30);
            playTone(audioCtx,  523, 'triangle', 0.45, 0.06, t + 0.60, 0.02, 0.30);
            break;
        }

        // ---- 10. ゲームオーバー（重い下降音）----
        case 'game_over':
            playSlide(audioCtx, 440, 220, 'sawtooth', 0.35, 0.10, t);
            playSlide(audioCtx, 330, 165, 'sawtooth', 0.35, 0.08, t + 0.30);
            playSlide(audioCtx, 220, 110, 'sawtooth', 0.45, 0.10, t + 0.60);
            playSlide(audioCtx, 165,  55, 'sawtooth', 0.55, 0.12, t + 0.90);
            playTone(audioCtx, 55, 'sine', 0.80, 0.08, t + 1.20, 0.05, 0.60);
            break;

        default:
            console.warn('[audio.js] Unknown SE type:', type);
    }
}

// ============================================================
//  BGM 定義（音符データ）
// ============================================================

// 音名 → 周波数 変換テーブル
const N = {
    R:    0,       // 休符
    // オクターブ 3
    C3:  130.81, D3:  146.83, E3:  164.81, F3:  174.61,
    G3:  196.00, A3:  220.00, B3:  246.94,
    // オクターブ 4
    C4:  261.63, Cs4: 277.18, D4:  293.66, Ds4: 311.13,
    E4:  329.63, F4:  349.23, Fs4: 369.99, G4:  392.00,
    Gs4: 415.30, A4:  440.00, As4: 466.16, B4:  493.88,
    // オクターブ 5
    C5:  523.25, Cs5: 554.37, D5:  587.33, Ds5: 622.25,
    E5:  659.26, F5:  698.46, Fs5: 739.99, G5:  783.99,
    Gs5: 830.61, A5:  880.00, As5: 932.33, B5:  987.77,
    // オクターブ 6
    C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98,
};

// BPM 設定（BGMごとに異なる）
const BPM = {
    title:    88,   // 重厚・カッコいい
    stage1:  138,   // 夜の繁華街・ファンキー
    stage2_3: 115,  // 波止場・廃工場・ダーク
    stage4_5: 126,  // 和風×ロック
    boss:    130,   // ボス戦・緊張感MAX
};

// 1拍の長さ [s] を計算するヘルパー
function beatLen(bpmKey) {
    return 60 / BPM[bpmKey];
}

// ノート形式: [周波数, 拍数]
// 例: [N.C4, 1] → C4を1拍、[N.R, 0.5] → 休符0.5拍

const BGM = {

    // ----------------------------------------------------------
    //  bgm_title: タイトル画面。カッコいい・重厚。BPM 88
    //  Cm-Ab-Eb-Bb 進行、square + sawtooth
    // ----------------------------------------------------------
    title: {
        melody: [
            // 小節1 — Cm
            [N.C5,  1], [N.Ds5, 1], [N.G5,  1], [N.R,   0.5], [N.G5, 0.5],
            // 小節2 — Ab
            [N.As4, 1], [N.Gs5, 1], [N.F5,  1], [N.R,   1],
            // 小節3 — Eb
            [N.G5,  0.5],[N.F5,0.5],[N.Ds5, 1], [N.C5,  1],   [N.R, 1],
            // 小節4 — Bb
            [N.D5,  1], [N.F5,  1], [N.As4, 2],
            // 小節5 — Cm（変奏）
            [N.C5,  0.5],[N.R,0.5],[N.Ds5, 0.5],[N.R,  0.5],
            [N.G5,  0.5],[N.R,0.5],[N.As5, 0.5],[N.R,  0.5],
            // 小節6 — Ab
            [N.Gs5, 1.5],[N.F5,  0.5],[N.Ds5, 1],[N.C5, 1],
            // 小節7 — Eb
            [N.Ds5, 1], [N.G5,  1], [N.As5, 1], [N.R,  1],
            // 小節8 — Cm（締め）
            [N.C5,  1], [N.G4,  1], [N.C5,  2],
        ],
        bass: [
            // Cm / Ab / Eb / Bb × 2
            [N.C3,  2], [N.G3,  2],
            [N.Gs3, 2], [N.Ds3, 2],
            [N.Ds3, 2], [N.As3, 2],
            [N.As2, 2], [N.F3,  2],
            [N.C3,  2], [N.G3,  2],
            [N.Gs3, 2], [N.Ds3, 2],
            [N.Ds3, 2], [N.As3, 2],
            [N.C3,  4],
        ],
        melodyType: 'square',
        bassType:   'sawtooth',
        melodyVol:  0.05,
        bassVol:    0.07,
        bpmKey:     'title',
    },

    // ----------------------------------------------------------
    //  bgm_stage1: 夜の繁華街。テンポ速め・ファンキー。BPM 138
    //  Am-F-C-G 進行、square + triangle
    // ----------------------------------------------------------
    stage1: {
        melody: [
            // Am riff
            [N.A4,  0.5],[N.C5, 0.5],[N.E5, 0.5],[N.A5, 0.5],
            [N.G5,  0.5],[N.E5, 0.5],[N.R,  0.5],[N.A4, 0.5],
            // F
            [N.F4,  0.5],[N.A4, 0.5],[N.C5, 0.5],[N.F5, 0.5],
            [N.E5,  0.5],[N.C5, 0.5],[N.R,  0.5],[N.F4, 0.5],
            // C
            [N.C5,  0.5],[N.E5, 0.5],[N.G5, 0.5],[N.C6, 0.5],
            [N.B5,  0.5],[N.G5, 0.5],[N.E5, 0.5],[N.C5, 0.5],
            // G
            [N.G4,  0.5],[N.B4, 0.5],[N.D5, 0.5],[N.G5, 0.5],
            [N.Fs5, 0.5],[N.D5, 0.5],[N.B4, 0.5],[N.G4, 0.5],
            // Am variation
            [N.A4,  0.5],[N.E5, 0.5],[N.A5, 0.5],[N.C6, 0.5],
            [N.B5,  0.25],[N.A5,0.25],[N.G5,0.5],[N.E5, 0.5],
            // F
            [N.F5,  0.5],[N.C5, 0.5],[N.A4, 0.5],[N.F4, 0.5],
            [N.G4,  0.5],[N.A4, 0.5],[N.C5, 0.5],[N.R,  0.5],
            // C-G（ターン）
            [N.E5,  0.5],[N.G5, 0.5],[N.E5, 0.5],[N.C5, 0.5],
            [N.D5,  0.5],[N.B4, 0.5],[N.G4, 0.5],[N.R,  0.5],
            // Am（解決）
            [N.A4,  1],  [N.E5, 1],  [N.A5, 2],
        ],
        bass: [
            // 8ビートベース
            [N.A3,  0.5],[N.R,  0.5],[N.A3, 0.5],[N.R,  0.5], // Am
            [N.A3,  0.5],[N.R,  0.5],[N.A3, 0.5],[N.R,  0.5],
            [N.F3,  0.5],[N.R,  0.5],[N.F3, 0.5],[N.R,  0.5], // F
            [N.F3,  0.5],[N.R,  0.5],[N.F3, 0.5],[N.R,  0.5],
            [N.C3,  0.5],[N.R,  0.5],[N.C3, 0.5],[N.R,  0.5], // C
            [N.C3,  0.5],[N.R,  0.5],[N.G3, 0.5],[N.R,  0.5],
            [N.G3,  0.5],[N.R,  0.5],[N.G3, 0.5],[N.R,  0.5], // G
            [N.G3,  0.5],[N.R,  0.5],[N.D3, 0.5],[N.R,  0.5],
            [N.A3,  0.5],[N.R,  0.5],[N.A3, 0.5],[N.R,  0.5], // Am
            [N.A3,  0.5],[N.R,  0.5],[N.A3, 0.5],[N.R,  0.5],
            [N.F3,  0.5],[N.R,  0.5],[N.F3, 0.5],[N.R,  0.5], // F
            [N.F3,  0.5],[N.R,  0.5],[N.C3, 0.5],[N.R,  0.5],
            [N.C3,  0.5],[N.R,  0.5],[N.E3, 0.5],[N.R,  0.5], // C-G
            [N.G3,  0.5],[N.R,  0.5],[N.B3, 0.5],[N.R,  0.5],
            [N.A3,  0.5],[N.R,  0.5],[N.E3, 0.5],[N.R,  0.5], // Am解決
            [N.A3,  0.5],[N.R,  0.5],[N.A3, 1.0],
        ],
        melodyType: 'square',
        bassType:   'triangle',
        melodyVol:  0.05,
        bassVol:    0.06,
        bpmKey:     'stage1',
    },

    // ----------------------------------------------------------
    //  bgm_stage2_3: 波止場・廃工場。緊張感・ダーク。BPM 115
    //  Em-C-D-Am 進行、sawtooth + square
    // ----------------------------------------------------------
    stage2_3: {
        melody: [
            // Em（不穏なリフ）
            [N.E4,  0.5],[N.G4, 0.5],[N.B4, 0.5],[N.R,  0.5],
            [N.D5,  0.5],[N.B4, 0.5],[N.G4, 0.5],[N.R,  0.5],
            // C
            [N.C5,  0.5],[N.E5, 0.5],[N.G5, 0.5],[N.R,  0.5],
            [N.F5,  0.5],[N.E5, 0.5],[N.C5, 0.5],[N.R,  0.5],
            // D（緊張）
            [N.D5,  0.5],[N.Fs5,0.5],[N.A5, 0.5],[N.R,  0.5],
            [N.G5,  0.5],[N.Fs5,0.5],[N.D5, 0.5],[N.R,  0.5],
            // Am（解決しない）
            [N.A4,  0.5],[N.C5, 0.5],[N.E5, 0.5],[N.G5, 0.5],
            [N.A5,  1],  [N.R,  1],
            // Em（変奏・クロマチック）
            [N.E5,  0.5],[N.Ds5,0.5],[N.D5, 0.5],[N.Cs5,0.5],
            [N.C5,  0.5],[N.B4, 0.5],[N.As4,0.5],[N.A4, 0.5],
            // C-D-Em（クライマックス）
            [N.G5,  1],  [N.A5, 0.5],[N.B5, 0.5],
            [N.D6,  1],  [N.B5, 0.5],[N.G5, 0.5],
            [N.E5,  2],  [N.R,  2],
        ],
        bass: [
            // Em ostinato
            [N.E3,  1],  [N.B3, 1],
            [N.E3,  1],  [N.G3, 1],
            // C
            [N.C3,  1],  [N.G3, 1],
            [N.C3,  1],  [N.E3, 1],
            // D
            [N.D3,  1],  [N.A3, 1],
            [N.D3,  1],  [N.Fs3,1],
            // Am
            [N.A3,  1],  [N.E3, 1],
            [N.A3,  2],
            // Em変奏
            [N.E3,  0.5],[N.G3, 0.5],[N.B3, 0.5],[N.E4, 0.5],
            [N.D4,  0.5],[N.B3, 0.5],[N.G3, 0.5],[N.E3, 0.5],
            // C-D-Em
            [N.C3,  2],  [N.D3, 2],
            [N.E3,  4],
        ],
        melodyType: 'sawtooth',
        bassType:   'square',
        melodyVol:  0.05,
        bassVol:    0.06,
        bpmKey:     'stage2_3',
    },

    // ----------------------------------------------------------
    //  bgm_stage4_5: 忍の砦・ラストステージ。和風×ロック。BPM 126
    //  Am-G-F-E (フリジアン風), square + triangle
    //  和音程: 三味線的な短音連打 + 五音音階
    // ----------------------------------------------------------
    stage4_5: {
        melody: [
            // 五音音階（A-C-D-E-G）による和風リフ
            [N.A5,  0.5],[N.R,  0.25],[N.A5, 0.25],[N.G5, 0.5],[N.E5, 0.5],
            [N.D5,  0.5],[N.E5, 0.5], [N.A5, 1],
            [N.G5,  0.5],[N.R,  0.25],[N.G5, 0.25],[N.E5, 0.5],[N.D5, 0.5],
            [N.C5,  0.5],[N.D5, 0.5], [N.E5, 1],
            // ロックリフ化
            [N.A4,  0.25],[N.A4,0.25],[N.C5, 0.25],[N.A4,0.25],
            [N.D5,  0.25],[N.A4,0.25],[N.E5, 0.25],[N.A4,0.25],
            [N.G4,  0.25],[N.G4,0.25],[N.As4,0.25],[N.G4,0.25],
            [N.C5,  0.25],[N.G4,0.25],[N.D5, 0.25],[N.G4,0.25],
            // 転調風（E経由）
            [N.E5,  0.5],[N.Gs5,0.5],[N.B5, 0.5],[N.E6, 0.5],
            [N.D6,  0.5],[N.B5, 0.5],[N.Gs5,0.5],[N.E5, 0.5],
            // 解決フレーズ
            [N.A5,  0.5],[N.G5, 0.5],[N.E5, 0.5],[N.D5, 0.5],
            [N.C5,  0.5],[N.D5, 0.5],[N.E5, 0.5],[N.A4, 0.5],
            // 締め
            [N.A4,  1],  [N.E5, 1],  [N.A5, 2],
        ],
        bass: [
            // Am-G-F-E のパワーコード風 ostinato
            [N.A3,  0.5],[N.A3, 0.5],[N.E3, 0.5],[N.A3, 0.5], // Am
            [N.A3,  0.5],[N.A3, 0.5],[N.A3, 1],
            [N.G3,  0.5],[N.G3, 0.5],[N.D3, 0.5],[N.G3, 0.5], // G
            [N.G3,  0.5],[N.G3, 0.5],[N.G3, 1],
            [N.F3,  0.5],[N.F3, 0.5],[N.C3, 0.5],[N.F3, 0.5], // F
            [N.F3,  0.5],[N.F3, 0.5],[N.F3, 1],
            [N.E3,  0.5],[N.E3, 0.5],[N.B3, 0.5],[N.E3, 0.5], // E（フリジアン）
            [N.E3,  0.5],[N.E3, 0.5],[N.E3, 1],
            [N.A3,  0.5],[N.E3, 0.5],[N.A3, 0.5],[N.E3, 0.5], // Am（繰り返し）
            [N.A3,  0.5],[N.E3, 0.5],[N.A3, 1],
            [N.G3,  0.5],[N.D3, 0.5],[N.G3, 0.5],[N.D3, 0.5],
            [N.G3,  0.5],[N.D3, 0.5],[N.G3, 1],
            [N.F3,  0.5],[N.C3, 0.5],[N.F3, 0.5],[N.C3, 0.5],
            [N.E3,  0.5],[N.B2, 0.5],[N.E3, 1],
            [N.A3,  1],  [N.E3, 1],  [N.A3, 2],
        ],
        melodyType: 'square',
        bassType:   'triangle',
        melodyVol:  0.05,
        bassVol:    0.07,
        bpmKey:     'stage4_5',
    },

    // ----------------------------------------------------------
    //  bgm_boss: ボス戦。緊張感MAX。BPM 130
    //  Dm-Bb-C-A (フラメンコ風), sawtooth × 2ch + square
    // ----------------------------------------------------------
    boss: {
        melody: [
            // 主旋律（攻撃的・半音下降）
            [N.D5,  0.5],[N.C5, 0.5],[N.As4,0.5],[N.A4, 0.5],
            [N.Gs4, 0.5],[N.G4, 0.5],[N.Fs4,0.5],[N.F4, 0.5],
            // 反転上昇
            [N.F4,  0.5],[N.G4, 0.5],[N.A4, 0.5],[N.As4,0.5],
            [N.C5,  0.5],[N.D5, 0.5],[N.R,  1],
            // Bb アクセント
            [N.F5,  0.5],[N.D5, 0.5],[N.As4,0.5],[N.F4, 0.5],
            [N.G4,  0.5],[N.As4,0.5],[N.C5, 0.5],[N.R,  0.5],
            // A（フラメンコ終止）
            [N.E5,  0.5],[N.D5, 0.5],[N.C5, 0.5],[N.B4, 0.5],
            [N.A4,  2],  [N.R,  2],
            // 変奏（16分連打）
            [N.D5,  0.25],[N.D5,0.25],[N.D5,0.25],[N.R,  0.25],
            [N.D5,  0.25],[N.D5,0.25],[N.C5,0.25],[N.As4,0.25],
            [N.A4,  0.25],[N.A4,0.25],[N.A4,0.25],[N.R,  0.25],
            [N.A4,  0.25],[N.Gs4,0.25],[N.G4,0.25],[N.Fs4,0.25],
            // クライマックス
            [N.D6,  1],  [N.C6, 0.5],[N.As5,0.5],
            [N.A5,  1],  [N.E5, 1],
            [N.D5,  4],
        ],
        // ch2: countermelody (sawtooth)
        melody2: [
            [N.R,   4],
            [N.A4,  0.5],[N.C5, 0.5],[N.D5, 0.5],[N.F5, 0.5],
            [N.E5,  0.5],[N.D5, 0.5],[N.C5, 0.5],[N.R,  0.5],
            [N.D5,  0.5],[N.F5, 0.5],[N.A5, 0.5],[N.R,  0.5],
            [N.G5,  0.5],[N.F5, 0.5],[N.D5, 0.5],[N.R,  0.5],
            [N.E5,  0.5],[N.Cs5,0.5],[N.A4, 0.5],[N.E4, 0.5],
            [N.A4,  2],  [N.R,  2],
            [N.R,   8],
            [N.F5,  1],  [N.E5, 1],
            [N.D5,  1],  [N.Cs5,1],
            [N.D5,  4],
        ],
        bass: [
            // Dm ostinato (16th-note pulse)
            [N.D3,  0.5],[N.R,  0.25],[N.D3,0.25],[N.R,  0.25],[N.D3,0.25],[N.R,  0.25],[N.D3,0.25],[N.R,0.25],
            [N.D3,  0.5],[N.R,  0.25],[N.D3,0.25],[N.R,  0.25],[N.A3,0.25],[N.R,  0.25],[N.F3,0.25],[N.R,0.25],
            // Bb
            [N.As2, 0.5],[N.R,  0.25],[N.As2,0.25],[N.R, 0.25],[N.As2,0.25],[N.R, 0.25],[N.As2,0.25],[N.R,0.25],
            [N.As2, 0.5],[N.R,  0.25],[N.As2,0.25],[N.F3,0.5],[N.D3, 0.5],
            // C
            [N.C3,  0.5],[N.R,  0.25],[N.C3,0.25],[N.R,  0.25],[N.C3,0.25],[N.R,  0.25],[N.C3,0.25],[N.R,0.25],
            [N.C3,  0.5],[N.R,  0.25],[N.G3,0.25],[N.E3, 0.5],[N.C3, 0.5],
            // A（フラメンコ終止）
            [N.A2,  0.5],[N.R,  0.25],[N.A2,0.25],[N.E3, 0.5],[N.A2, 0.5],
            [N.A2,  2],
            // 繰り返し
            [N.D3,  0.5],[N.R,  0.25],[N.D3,0.25],[N.A2, 0.5],[N.D3, 0.5],
            [N.D3,  0.5],[N.R,  0.25],[N.D3,0.25],[N.A2, 0.5],[N.F3, 0.5],
            [N.A2,  0.5],[N.R,  0.25],[N.A2,0.25],[N.E3, 0.5],[N.A2, 0.5],
            [N.A2,  2],
            // クライマックスベース
            [N.D3,  1],  [N.F3, 1],
            [N.A3,  1],  [N.E3, 1],
            [N.D3,  4],
        ],
        melodyType:  'sawtooth',
        melody2Type: 'sawtooth',
        bassType:    'square',
        melodyVol:   0.05,
        melody2Vol:  0.04,
        bassVol:     0.07,
        bpmKey:      'boss',
    },
};

// ============================================================
//  BGM スケジューラー
// ============================================================

/**
 * BGM を lookahead バッファ方式でスケジュールする。
 * setInterval で定期的に呼び出すこと（推奨: 100ms 間隔）。
 *
 * @param {AudioContext} audioCtx
 * @param {string}  bgmKey  - BGM.xxx のキー名 ('title'|'stage1'|'stage2_3'|'stage4_5'|'boss')
 * @param {object}  state   - スケジューラー状態オブジェクト（以下のプロパティが必要）
 *   state.melodyIdx   {number}  - メロディートラックのインデックス
 *   state.bassIdx     {number}  - ベーストラックのインデックス
 *   state.melody2Idx  {number}  - 第2メロディー（bossのみ）のインデックス
 *   state.melodyTime  {number}  - 次のメロディー音の開始時刻 [s]
 *   state.bassTime    {number}  - 次のベース音の開始時刻 [s]
 *   state.melody2Time {number}  - 次の第2メロディー音の開始時刻 [s]
 */
function scheduleBGM(audioCtx, bgmKey, state) {
    if (!audioCtx || !bgmKey) return;
    const bgm = BGM[bgmKey];
    if (!bgm) return;

    const LOOKAHEAD = 0.5; // 先読み時間 [s]
    const lookahead = audioCtx.currentTime + LOOKAHEAD;
    const bl = beatLen(bgm.bpmKey);

    // --- メロディートラック ---
    while (state.melodyTime < lookahead) {
        const note = bgm.melody[state.melodyIdx];
        if (note[0] !== N.R) {
            playTone(
                audioCtx,
                note[0],
                bgm.melodyType,
                note[1] * bl * 0.82,
                bgm.melodyVol,
                state.melodyTime,
                0.01,
                0.04
            );
        }
        state.melodyTime += note[1] * bl;
        state.melodyIdx = (state.melodyIdx + 1) % bgm.melody.length;
    }

    // --- ベーストラック ---
    while (state.bassTime < lookahead) {
        const note = bgm.bass[state.bassIdx];
        if (note[0] !== N.R) {
            playTone(
                audioCtx,
                note[0],
                bgm.bassType,
                note[1] * bl * 0.88,
                bgm.bassVol,
                state.bassTime,
                0.01,
                0.05
            );
        }
        state.bassTime += note[1] * bl;
        state.bassIdx = (state.bassIdx + 1) % bgm.bass.length;
    }

    // --- 第2メロディートラック（boss のみ）---
    if (bgm.melody2) {
        while (state.melody2Time < lookahead) {
            const note = bgm.melody2[state.melody2Idx];
            if (note[0] !== N.R) {
                playTone(
                    audioCtx,
                    note[0],
                    bgm.melody2Type,
                    note[1] * bl * 0.80,
                    bgm.melody2Vol,
                    state.melody2Time,
                    0.01,
                    0.04
                );
            }
            state.melody2Time += note[1] * bl;
            state.melody2Idx = (state.melody2Idx + 1) % bgm.melody2.length;
        }
    }
}

// ============================================================
//  BGM 管理ヘルパー
//  beat_em_up.html 側での使用例を示す
// ============================================================

/**
 * BGMの状態をリセットして新しいBGMを開始する。
 * @param {object} audioState  - initAudio() で初期化した状態オブジェクト
 * @param {string} bgmKey      - BGM キー名
 */
function startBGM(audioState, bgmKey) {
    if (!audioState.ctx) return;
    // 現在のタイマーを止める
    if (audioState.timer) {
        clearInterval(audioState.timer);
        audioState.timer = null;
    }
    const t = audioState.ctx.currentTime + 0.05;
    audioState.bgmKey    = bgmKey;
    audioState.melodyIdx  = 0;
    audioState.bassIdx    = 0;
    audioState.melody2Idx = 0;
    audioState.melodyTime  = t;
    audioState.bassTime    = t;
    audioState.melody2Time = t;
    // 100ms ごとにスケジュール
    audioState.timer = setInterval(() => {
        scheduleBGM(audioState.ctx, audioState.bgmKey, audioState);
    }, 100);
    // 初回即時呼び出し
    scheduleBGM(audioState.ctx, audioState.bgmKey, audioState);
}

/**
 * BGMを停止する。
 * @param {object} audioState
 */
function stopBGM(audioState) {
    if (audioState.timer) {
        clearInterval(audioState.timer);
        audioState.timer = null;
    }
    audioState.bgmKey = null;
}

// ============================================================
//  使用例（beat_em_up.html に埋め込む場合）
// ============================================================
/*
    // --- 1. 状態オブジェクトをグローバルに宣言 ---
    const audioState = {
        ctx:        null,
        bgmKey:     null,
        melodyIdx:  0,
        bassIdx:    0,
        melody2Idx: 0,
        melodyTime: 0,
        bassTime:   0,
        melody2Time:0,
        timer:      null,
    };

    // --- 2. 最初のユーザー操作で初期化 ---
    document.addEventListener('keydown', () => {
        initAudio(audioState);
    }, { once: true });
    document.addEventListener('click', () => {
        initAudio(audioState);
    }, { once: true });

    // --- 3. タイトル画面でBGM開始 ---
    //   initAudio(audioState);
    //   startBGM(audioState, 'title');

    // --- 4. ステージ1開始 ---
    //   startBGM(audioState, 'stage1');

    // --- 5. ボス戦 ---
    //   startBGM(audioState, 'boss');

    // --- 6. SE再生 ---
    //   playSE(audioState.ctx, 'punch_hit');
    //   playSE(audioState.ctx, 'stage_clear');
    //   playSE(audioState.ctx, 'game_over');

    // --- 7. BGM停止 ---
    //   stopBGM(audioState);
*/
