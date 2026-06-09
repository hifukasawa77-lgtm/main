# 動画編集スキル集

Canvas API + MediaRecorder API を用いたブラウザ上の動画録画・エフェクト実装ガイドライン。

---

## Skill: ゲーム画面録画 (Canvas Recording with MediaRecorder)
- **概要**: ゲームの Canvas を MediaRecorder でキャプチャし、WebM 動画として保存する。
- **実装要件**:
  - `canvas.captureStream(60)` で 60fps のストリームを取得し、`new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })` に渡すこと。
  - `MediaRecorder.isTypeSupported()` で対応コーデックを事前確認し、非対応の場合は `video/webm;codecs=vp8` → `video/webm` の順でフォールバックすること。
  - `dataavailable` イベントで Blob チャンクを配列に蓄積し、`stop` イベントで `new Blob(chunks, { type: 'video/webm' })` にまとめてから `URL.createObjectURL` でダウンロードリンクを生成すること。
  - 録画中は UI から録画ボタンを無効化し、`MediaRecorder.state` で状態を管理すること。

## Skill: 音声付き録画 (Audio + Video Capture)
- **概要**: Web Audio API の出力と Canvas 映像を合成して音声付き動画を録画する。
- **実装要件**:
  - `AudioContext` に `createMediaStreamDestination()` を追加し、BGM・SE の出力先を `destination.stream` にルーティングすること。
  - Canvas ストリームと音声ストリームのトラックを `new MediaStream([...videoStream.getTracks(), ...audioStream.getTracks()])` で結合してから MediaRecorder に渡すこと。
  - `AudioContext` の `resume()` を録画開始と同期させ、音ズレを防ぐこと。
  - 録画開始前に `canvas.captureStream()` と `AudioContext` の両方が `running` 状態であることを確認すること。

## Skill: Canvas ビデオエフェクト (Canvas Video Effects)
- **概要**: `<video>` 要素の映像を Canvas に転写し、フレーム単位でエフェクトを加工する。
- **実装要件**:
  - `ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)` を `requestAnimationFrame` ループ内で呼ぶことで映像をフレームごとに転写すること。
  - `ctx.filter` プロパティ（`grayscale()` / `brightness()` / `contrast()` / `sepia()`）で CSS フィルタをそのまま適用できる。複数フィルタは空白区切りで連結すること。
  - ピクセル操作が必要な場合は `getImageData` でデータを取得し、`Uint8ClampedArray` を直接書き換えて `putImageData` で戻す。毎フレーム呼ぶと重いため、オフスクリーン Canvas を使ってメイン Canvas への転写回数を最小化すること。
  - `ctx.globalCompositeOperation` でオーバーレイ合成（`'screen'` / `'multiply'` / `'overlay'`）を活用し、フィルタでは表現できない合成効果を加えること。

## Skill: フレームキャプチャと GIF 生成 (Frame Capture & GIF)
- **概要**: Canvas の静止フレームを連続取得し、アニメーション GIF または PNG シーケンスとして書き出す。
- **実装要件**:
  - 静止画キャプチャは `canvas.toBlob((blob) => { ... }, 'image/png')` を使うこと。`toDataURL` より非同期でメモリ効率が良い。
  - GIF 生成はブラウザネイティブでは非対応のため、`gif.js`（CDN）などのライブラリを使う。フレーム配列を `gif.addFrame(canvas, { delay: 33 })` で追加し、`gif.render()` で完成させること。
  - 高解像度キャプチャが必要な場合はオフスクリーン Canvas を `new OffscreenCanvas(w, h)` で生成し、`drawImage` でスケールアップしてから書き出すこと。
  - PNG シーケンスは `frames.forEach((blob, i) => saveAs(blob, \`frame_\${String(i).padStart(4, '0')}.png\`))` でゼロ埋め連番で保存すること。

## Skill: タイムライン制御 (Timeline Playback Control)
- **概要**: 録画済み WebM をブラウザ上でトリムまたは再生制御する。
- **実装要件**:
  - `<video>` の `currentTime` を直接操作してシーク位置を制御すること。`seeked` イベントを待ってから `drawImage` を呼ぶことでサムネイル生成が確実になる。
  - トリム（開始/終了点の指定）はブラウザネイティブでは書き出せないため、開始点から `MediaRecorder` を再スタートする方法か、FFmpeg.wasm を使う方法を選ぶこと。
  - 再生速度は `video.playbackRate` で 0.25〜2.0 倍速を設定できる。Canvas 転写ループはそのまま追従する。
  - ループ再生は `video.loop = true`、または `ended` イベントで `video.currentTime = startTime` にリセットして区間ループを実装すること。
