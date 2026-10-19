/**
 * face-auth-core.js — 顔認証 / Face Unlock の判定層（純粋ロジック）
 *
 * 【層の分け方】エアタッチ（gesture-pointer.js）と同じ考え方で3層に分ける。
 *   1. 推定層（source）… 映像 → 顔の枠・68点ランドマーク・128次元の特徴量。face-api。差し替え可能。
 *   2. 判定層（このファイル）… 特徴量の照合・まばたき/首振りの生体確認・連続失敗のロック。**作用を持たない**。
 *   3. 画面（face-auth.html）… カメラ・描画・保存。
 * ヘッドレスにはカメラもGPUも無いので、この分離が無いと何ひとつ機械検査できない
 * （scripts/verify-face-auth.mjs は 1 を合成データに差し替えて 2・3 を通しで確かめる）。
 *
 * 【守れる強さの線】これは体験用の顔認証で、本人確認の鍵ではない。
 *   - 顔写真はまばたきも首振りもできないので、生体確認（ランダムな順番の指示）で落ちる
 *   - ただし録画の再生・精巧なマスク・よく似た家族（双子）は通り得る。深度センサーも赤外線も使えない
 *   - 登録データは端末の localStorage にあり、同じサイトの別ページの不具合（XSS）からは読める
 *   本物の鍵が要るなら、OSの顔認証をパスキー（WebAuthn）経由で呼ぶ（顔の照合はOSが専用チップで行う）。
 *
 * 【ハマりどころ】
 *   - 距離の閾値は1つにしない。1回の照合で決めると、境目の人は押すたびに通ったり落ちたりする。
 *     複数フレームの**中央値**で決める（1枚だけの偶然の一致・不一致に引きずられない）
 *   - まばたきの閾値は人によって目の開き方が違うので固定値にしない。**開いているときの自分の値**を
 *     基準にして比で見る（固定値だと目の細い人は「ずっと閉じている」判定になる）
 *   - 生体確認と照合は**同じ顔**で行う。まばたきの後に写真へ差し替えられないよう、
 *     確認の前後両方で照合し、途中で顔を見失ったら最初からやり直す
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FaceAuthCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DESCRIPTOR_LEN = 128;
  const STORAGE_VERSION = 1;

  const DEFAULTS = Object.freeze({
    // 実測（2026-10-19・本物の face-api 1.7.15 で肖像画119枚＝7,021組）:
    //   別人どうし: 最小0.206 / 下位1% 0.268 / 下位5% 0.305 / 中央値0.436
    //   同一人物（回転・縮小・暗く・ぼかした写し）: 中央値0.196 / 最大0.286
    // 「別人は0.55以上」という通説で 0.45 にしていたら、別人の組の54%が通っていた。
    // 0.30 で別人の通過は4.3%、0.26 で1%未満（同じ画風の肖像画なので実際の顔より厳しい条件）。
    // face-api 既定の 0.6 は「同じ人を探す」用途の値で、認証には全く使えない。
    threshold: { standard: 0.30, strict: 0.26 },
    enrollSamples: 5,
    // 登録の各サンプルどうしがこれ以上離れていたら、別人が混じったか画質が悪い
    enrollMaxSpread: 0.5,
    matchFrames: 3,
    // 顔の大きさ（映像の短辺に対する枠の幅）。小さいと特徴量が荒れる
    minFaceRatio: 0.22,
    maxCenterOffset: 0.28,
    // まばたき: 開いているときの自分の値に対する比
    blinkClose: 0.72,
    blinkOpen: 0.86,
    // 首振り: 正面 0・左右 ±1 に正規化した向き
    turnOn: 0.3,
    turnCenter: 0.14,
    challengeTimeoutMs: 8000,
    // 連続失敗のロック（端末内の目安。localStorage を消せば解ける＝体験用の抑止）
    maxFailures: 5,
    lockBaseMs: 30000,
    lockMaxMs: 15 * 60 * 1000,
  });

  /* ---------------- ベクトル ---------------- */
  function isDescriptor(d) {
    if (!d || typeof d.length !== 'number' || d.length !== DESCRIPTOR_LEN) return false;
    for (let i = 0; i < DESCRIPTOR_LEN; i++) {
      const v = d[i];
      if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 10) return false;
    }
    return true;
  }
  function distance(a, b) {
    let s = 0;
    for (let i = 0; i < DESCRIPTOR_LEN; i++) { const t = a[i] - b[i]; s += t * t; }
    return Math.sqrt(s);
  }
  function mean(list) {
    const out = new Array(DESCRIPTOR_LEN).fill(0);
    for (const d of list) for (let i = 0; i < DESCRIPTOR_LEN; i++) out[i] += d[i];
    for (let i = 0; i < DESCRIPTOR_LEN; i++) out[i] /= list.length;
    return out;
  }
  function median(nums) {
    const s = nums.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* ---------------- 顔の写り方 ---------------- */
  /**
   * 照合に使える写り方か。使えない理由は利用者が直せる言葉で返す。
   * @param {{faces:Array<{box:{x,y,width,height}}>, width:number, height:number}} frame
   */
  function assessFrame(frame, opt) {
    const o = Object.assign({}, DEFAULTS, opt);
    const faces = (frame && frame.faces) || [];
    if (faces.length === 0) return { ok: false, code: 'no-face', msg: '顔が見つかりません', en: 'No face found' };
    if (faces.length > 1) return { ok: false, code: 'multi', msg: '画面に顔が2つ以上あります。1人で映ってください', en: 'Only one face, please' };
    const f = faces[0], b = f.box;
    const short = Math.min(frame.width, frame.height) || 1;
    if (b.width / short < o.minFaceRatio) return { ok: false, code: 'small', msg: 'もう少し近づいてください', en: 'Move closer' };
    const cx = (b.x + b.width / 2) / frame.width - 0.5;
    const cy = (b.y + b.height / 2) / frame.height - 0.5;
    if (Math.abs(cx) > o.maxCenterOffset || Math.abs(cy) > o.maxCenterOffset) {
      return { ok: false, code: 'off-center', msg: '顔を枠の中央へ', en: 'Center your face' };
    }
    return { ok: true, code: 'ok', face: f };
  }

  /* ---------------- 68点ランドマークから ---------------- */
  const dist2d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  /** 目の縦横比（Eye Aspect Ratio）。目の6点 p1..p6 */
  function eyeAspectRatio(e) {
    const w = dist2d(e[0], e[3]);
    if (!w) return 0;
    return (dist2d(e[1], e[5]) + dist2d(e[2], e[4])) / (2 * w);
  }
  /** 両目の平均EARと顔の左右の向き。向きは「本人から見て左」が正。 */
  function poseFromLandmarks(pts) {
    if (!pts || pts.length < 68) return null;
    const ear = (eyeAspectRatio(pts.slice(36, 42)) + eyeAspectRatio(pts.slice(42, 48))) / 2;
    const jawL = pts[0], jawR = pts[16], nose = pts[30];
    const w = jawR.x - jawL.x;
    // カメラの生の映像（鏡像ではない）では、本人の左は画像の右側に写る。
    // 本人が左を向くと鼻先は画像の右（x が大きい側）へ寄る → 正
    const yaw = w ? ((nose.x - (jawL.x + jawR.x) / 2) / w) * 2 : 0;
    return { ear, yaw };
  }

  /* ---------------- 生体確認（まばたき・首振り） ---------------- */
  const CHALLENGES = {
    blink: { msg: 'まばたきを1回してください', en: 'Blink once' },
    left: { msg: 'ゆっくり左を向いてください', en: 'Turn your head left' },
    right: { msg: 'ゆっくり右を向いてください', en: 'Turn your head right' },
  };
  /** 指示の順番は毎回ランダム（決まった順の録画で通らないように）。rand は検査用の差し替え口 */
  function pickChallenges(rand) {
    const r = rand || Math.random;
    const turn = r() < 0.5 ? 'left' : 'right';
    return r() < 0.5 ? ['blink', turn] : [turn, 'blink'];
  }

  function createLiveness(challenges, now, opt) {
    const o = Object.assign({}, DEFAULTS, opt);
    const list = challenges.slice();
    let idx = 0, startedAt = now;
    let earOpen = null;          // 開いているときの自分の値（直近の中央値）
    const earHist = [];
    let closed = false, centered = false;

    function current() { return list[idx]; }
    function info(extra) {
      const c = current();
      return Object.assign({
        step: idx, total: list.length, challenge: c,
        msg: c ? CHALLENGES[c].msg : '', en: c ? CHALLENGES[c].en : '',
        done: idx >= list.length, failed: false,
      }, extra);
    }
    function advance(t) { idx++; startedAt = t; closed = false; centered = false; }

    return {
      challenges: list,
      /** @param {{ear:number,yaw:number}|null} pose */
      update(pose, t) {
        if (idx >= list.length) return info();
        if (t - startedAt > o.challengeTimeoutMs) {
          return info({ failed: true, code: 'timeout', reason: '時間内に指示の動きが確認できませんでした', reasonEn: 'Timed out' });
        }
        if (!pose) return info();
        const c = current();
        if (c === 'blink') {
          // 開いている基準: 首を振っていない間の値だけで取る（横を向くと目が細く写る）
          if (Math.abs(pose.yaw) < o.turnCenter && !closed) {
            earHist.push(pose.ear); if (earHist.length > 15) earHist.shift();
            if (earHist.length >= 3) earOpen = median(earHist);
          }
          if (earOpen) {
            const r = pose.ear / earOpen;
            if (!closed && r < o.blinkClose) closed = true;
            else if (closed && r > o.blinkOpen) { advance(t); return info({ passed: 'blink' }); }
          }
          return info({ progress: closed ? 0.6 : 0 });
        }
        // 首振り: いったん正面を経てから、指示の向きへ振り切る
        const want = c === 'left' ? 1 : -1;
        if (Math.abs(pose.yaw) < o.turnCenter) centered = true;
        if (centered && pose.yaw * want > o.turnOn) { advance(t); return info({ passed: c }); }
        return info({ progress: centered ? Math.max(0, Math.min(1, (pose.yaw * want) / o.turnOn)) : 0 });
      },
    };
  }

  /* ---------------- 照合 ---------------- */
  /**
   * 複数フレームの距離の中央値で判定する。1枚だけの偶然に引きずられない。
   * @returns {{ok:boolean, distance:number, threshold:number, distances:number[]}}
   */
  function decide(template, descriptors, threshold) {
    const ds = descriptors.filter(isDescriptor).map((d) => distance(template, d));
    if (!ds.length) return { ok: false, distance: Infinity, threshold, distances: [] };
    const m = median(ds);
    return { ok: m <= threshold, distance: m, threshold, distances: ds };
  }

  /* ---------------- 登録 ---------------- */
  /** 登録サンプルから型を作る。別人が混じった・画質が悪いときは理由を返して作らない */
  function buildTemplate(samples, now, opt) {
    const o = Object.assign({}, DEFAULTS, opt);
    const good = samples.filter(isDescriptor);
    if (good.length < o.enrollSamples) return { ok: false, code: 'too-few', reason: '撮影枚数が足りません', reasonEn: 'Not enough samples' };
    let spread = 0;
    for (let i = 0; i < good.length; i++) for (let j = i + 1; j < good.length; j++) spread = Math.max(spread, distance(good[i], good[j]));
    if (spread > o.enrollMaxSpread) {
      return { ok: false, code: 'inconsistent', spread, reason: '撮影ごとの差が大きすぎます（別の人が映った・暗い・ぶれた）。明るい場所で撮り直してください', reasonEn: 'Samples disagree — retake in good light' };
    }
    const d = mean(good).map((v) => Math.round(v * 1e5) / 1e5);
    return { ok: true, template: { v: STORAGE_VERSION, created: now, n: good.length, spread: Math.round(spread * 1e4) / 1e4, d } };
  }

  /** 保存データの検疫。壊れていたら null（例外を投げない＝画面が丸ごと描けなくなるのを防ぐ） */
  function sanitizeTemplate(raw) {
    let o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (_) { return null; } }
    if (!o || typeof o !== 'object' || o.v !== STORAGE_VERSION) return null;
    if (!Array.isArray(o.d) || !isDescriptor(o.d)) return null;
    const created = Number(o.created);
    return {
      v: STORAGE_VERSION,
      created: Number.isFinite(created) && created > 0 ? created : 0,
      n: Number.isInteger(o.n) && o.n > 0 && o.n < 100 ? o.n : DEFAULTS.enrollSamples,
      spread: Number.isFinite(o.spread) ? o.spread : 0,
      d: o.d.slice(),
    };
  }

  /* ---------------- 連続失敗のロック ---------------- */
  function sanitizeLock(raw) {
    let o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (_) { o = null; } }
    const fails = o && Number.isInteger(o.fails) && o.fails >= 0 && o.fails < 1000 ? o.fails : 0;
    const until = o && Number.isFinite(o.until) && o.until > 0 ? o.until : 0;
    const level = o && Number.isInteger(o.level) && o.level >= 0 && o.level < 20 ? o.level : 0;
    return { fails, until, level };
  }
  function lockState(lock, now) {
    const l = sanitizeLock(lock);
    return { locked: l.until > now, remainMs: Math.max(0, l.until - now), fails: l.fails };
  }
  /** 失敗を1回数える。上限に達したらロックし、ロックのたびに時間を倍にする */
  function recordFailure(lock, now, opt) {
    const o = Object.assign({}, DEFAULTS, opt);
    const l = sanitizeLock(lock);
    l.fails++;
    if (l.fails >= o.maxFailures) {
      l.until = now + Math.min(o.lockMaxMs, o.lockBaseMs * Math.pow(2, l.level));
      l.level++;
      l.fails = 0;
    }
    return l;
  }
  function recordSuccess() { return { fails: 0, until: 0, level: 0 }; }

  return {
    DEFAULTS, DESCRIPTOR_LEN, STORAGE_VERSION, CHALLENGES,
    isDescriptor, distance, mean, median,
    assessFrame, eyeAspectRatio, poseFromLandmarks,
    pickChallenges, createLiveness, decide,
    buildTemplate, sanitizeTemplate,
    sanitizeLock, lockState, recordFailure, recordSuccess,
  };
});
