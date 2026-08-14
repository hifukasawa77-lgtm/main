# グラフィックEQ＆シンセサイザー — コンテンツ一式
作成日: 2026-08-09
作成: Marketer エージェント

URL: https://hifukasawa77-lgtm.github.io/main/synth-eq.html
戦略: `marketing/グラフィックEQシンセサイザー_strategy.md`

> 記載はすべて `synth-eq.html` の実装で確認した機能のみ。実績値・ユーザー数は書いていない。

---

## 1. Xポスト（日本語）

### パターンA — 体験訴求（主力・画面録画Aを添付）

ブラウザだけで動くシンセサイザーと10バンドEQを1ページにまとめました。

作った音をその場でEQに通せて、
かけたカーブがスペクトラムに重なって見えます。
「上げたつもり」と実際の効きがズレません。

インストール不要・アカウント不要で触れます。
https://hifukasawa77-lgtm.github.io/main/synth-eq.html

#個人開発 #WebAudioAPI #JavaScript #DTM

---

### パターンB — 技術訴求（エンジニア向け・スレッド起点）

Web Audio API だけでシンセ＋10バンドEQを作りました。フレームワーク・ビルドツールなし、HTML1ファイルです。

EQカーブは設定値の絵ではなく getFrequencyResponse の実測を描いています。

アナライザは出力ゲインより前段。スピーカー出力を切ってもスペクトラムと録音が生きます。

https://hifukasawa77-lgtm.github.io/main/synth-eq.html

#個人開発 #WebAudioAPI #JavaScript #フロントエンド

---

### パターンC — DTM初学者向け（画面録画Bを添付）

減算合成って結局どういうことなのか、耳と目で同時に確かめられるページを作りました。

・オシレーター2基＋サブ＋ノイズ
・フィルターとフィルターEG、ADSR
・16ステップのシーケンサー（和音も置ける）
・音色プリセット8種／EQプリセット10種

音色もEQもURLで共有できます。
https://hifukasawa77-lgtm.github.io/main/synth-eq.html

#DTM #シンセサイザー #個人開発 #WebAudioAPI

---

### スレッド案（パターンBの続き）

**返信1 — 音源**

音源はシンセ／音声ファイル／マイクの3系統で、どれも同じ10バンドEQを通ります。

31Hz〜16kHz・±18dB、両端はシェルビング、中央はピーキング。
EQ通過後の音は16bitステレオWAVで書き出せます。

**返信2 — 無音との戦い**

Web Audio は、ノードの接続漏れやエンベロープの時刻ミスで
例外もエラーも出さずに無音になります。
「動いた」の判定が目視だと危ない領域でした。

なので Playwright で45項目の自動検査を書き、アナライザのピーク値・声部の残留・EQの実効まで機械で見ています。

**返信3 — 落とし穴メモ**

・setTargetAtTime の直後に AudioParam.value を読むと目標値に届いていない（時定数の10倍待つ）
・無音判定はリバーブのIR長より長く待たないと必ず落ちる
・ヘッドレスでは autoplay policy を外さないと AudioContext が suspended のまま全項目が無音になる

同じところで詰まった人の役に立てば。

**返信4 — 触るときの注意**

マイクを使うときはヘッドホンを推奨します（スピーカーだとハウリングします）。
「スピーカーへ出力」をオフにしても、スペクトラムと録音は動き続けます。

MIDI鍵盤は Chrome / Edge で使えます。
https://hifukasawa77-lgtm.github.io/main/synth-eq.html

---

## 2. Xポスト（英語）

### Pattern A — Experience-first（画面録画Aを添付）

I built a subtractive synth and a 10-band graphic EQ into a single web page.

Play a sound, then shape it — and watch the EQ curve drawn on top of the live spectrum, so what you set is what you actually get.

No install, no account, no API key.
https://hifukasawa77-lgtm.github.io/main/synth-eq.html

#webaudio #javascript #creativecoding #synth

---

### Pattern B — Tech-first

A 10-band EQ + subtractive synth in one HTML file. Web Audio API only — no frameworks, no build step.

The EQ curve is measured with getFrequencyResponse, not faked from slider values.

The analyser sits before the output gain, so you can mute your speakers and still see the spectrum and record. That's how mic input avoids feedback here.

Synth, audio file, or mic — all three run through the same EQ.

https://hifukasawa77-lgtm.github.io/main/synth-eq.html

#webaudio #javascript #webdev #dsp

---

## 3. GitHub README 紹介文

### 短版（リポジトリ内の一覧行・OGP説明用）

> ブラウザだけで動く10バンドグラフィックEQ＋減算合成シンセ。作った音・音声ファイル・マイクの音をその場で整えて、EQカーブをスペクトラムに重ねて確認できます。Web Audio API のみ、外部送信ゼロ。

> A 10-band graphic EQ and a subtractive synthesizer in one page. Shape synth, file, or mic audio in real time and see the measured EQ curve over the live spectrum. Web Audio API only — nothing leaves your browser.

### 長版（セクション用）

```markdown
## 🎛️ グラフィックEQ ＆ シンセサイザー / Graphic EQ & Synthesizer

**[▶ 開く / Open](https://hifukasawa77-lgtm.github.io/main/synth-eq.html)**

10バンドのグラフィックイコライザーと減算合成シンセサイザーを1ページに統合した、
ブラウザ完結のオーディオツールです。

### これは何か

オンラインのEQツールは「読み込んだ音を整えて書き出す」だけ、
ブラウザシンセは「音を作る」だけで終わりがちでした。
このページはその両方を同じ画面に置いて、**作る → 整える → 効きを見る → 書き出す**
までを途切れずにできるようにしたものです。

シンセ・音声ファイル・マイクの3系統がすべて同じEQを通ります。

### どんな人に向いているか

- **Web Audio API を実装レベルで読みたい人** — フレームワーク不使用、HTML1ファイル。
  EQカーブは `getFrequencyResponse` の実測値を描画しています
- **減算合成やEQを体感で理解したい人** — フェーダーを動かすと、
  スペクトラムに重なったEQカーブが同時に動きます
- **手元の音を軽く整えたい人** — 音声ファイルもマイクもブラウザの外に出ません。
  EQ通過後を16bitステレオWAVで書き出せます

### 主な機能

| | |
|---|---|
| **EQ** | 10バンド（31Hz〜16kHz・±18dB）／両端シェルビング・中央ピーキング／プリセット10種／EQ ON-OFFのA/B比較／自動レベル補正 |
| **シンセ** | オシレーター2基＋サブ＋ノイズ／フィルター＋フィルターEG／ADSR／ポリ・モノ＋グライド／アルペジエーター／音色プリセット8種 |
| **シーケンサー** | 16ステップ（16分音符）／和音対応／パターン4種／ランダム生成 |
| **音源** | シンセ／音声ファイル／マイク（すべてEQを通過） |
| **可視化** | 対数軸スペクトラム＋EQカーブ重ね描き／ピークホールド／波形モニター／カーソルで周波数とdBを読み取り |
| **入出力** | 画面鍵盤2オクターブ・PCキーボード演奏・Web MIDI入力（Chrome / Edge）／16bitステレオWAV書き出し／設定を埋め込んだ共有リンク |

### 技術メモ

- **アナライザは出力ゲインより前段**に置いています。
  これにより「スピーカーへ出力」をオフにしてもスペクトラムと録音が生き、
  マイク使用時のハウリングを注意書きではなく信号経路で回避しています
- **Web Audio は例外を出さずに無音になります**（ノードの未接続、エンベロープの時刻ミス）。
  そのため Playwright による自動検査45項目で、アナライザのピーク値・声部の残留・
  EQの実効（`getFrequencyResponse` の実測）まで機械検証しています

```bash
node scripts/verify-synth-eq.mjs
```

### プライバシー

音声ファイルもマイク入力も、ブラウザの外へ送信しません。
共有リンクは設定をURLに埋め込むだけで、サーバーには何も保存しません。
APIキーは不要です。

### 動作環境

モダンブラウザ（Chrome / Edge / Safari / Firefox）。
MIDI入力は Web MIDI API に対応した Chrome / Edge のみです。
```

### English version

```markdown
## 🎛️ Graphic EQ & Synthesizer

**[▶ Open](https://hifukasawa77-lgtm.github.io/main/synth-eq.html)**

A 10-band graphic equalizer and a subtractive synthesizer in a single page,
running entirely in the browser.

### What it is

Online EQ tools only clean up audio you already have. Browser synths only make sound.
This page puts both on the same screen, so you can **build a sound, shape it,
see exactly what the EQ is doing, and export it** without leaving the tab.

Synth, audio file, and microphone all run through the same EQ.

### Who it's for

- **Developers reading Web Audio API code** — no frameworks, one HTML file.
  The EQ curve is drawn from `getFrequencyResponse`, not from slider positions
- **People learning subtractive synthesis and EQ** — move a fader and watch the curve
  move against the live spectrum
- **Anyone shaping a quick recording** — audio files and mic input never leave the browser,
  and you can export the post-EQ signal as a 16-bit stereo WAV

### Features

- 10-band EQ, 31 Hz–16 kHz, ±18 dB, shelving at both ends, peaking in between
- 10 EQ presets, EQ on/off A/B, auto make-up gain
- Subtractive synth: 2 oscillators + sub + noise, filter with envelope, ADSR,
  poly/mono with glide, arpeggiator, 8 sound presets
- 16-step sequencer, chords supported, 4 patterns, random generator
- Log-scale spectrum with the EQ curve overlaid, peak hold, waveform scope,
  cursor readout of frequency and dB
- On-screen and computer-keyboard playing, Web MIDI input (Chrome / Edge)
- 16-bit stereo WAV export, shareable link that encodes patch, EQ and sequence

### Implementation notes

The analyser is placed **before** the output gain, so muting the speakers keeps the
spectrum and the recorder alive — mic feedback is solved in the signal path rather
than in a warning label.

Web Audio fails silently: an unconnected node or a mistimed envelope produces no
exception, just no sound. A Playwright suite of 45 checks verifies analyser peak
levels, voice leakage and the measured EQ response.

### Privacy

Nothing is uploaded. No account, no API key.
```

---

## 4. キャッチコピー集

短尺（SNSプロフィール・OGP・カード・見出しに転用可）。

1. 音を作って、10バンドで整える。ブラウザだけで。
2. かけたEQが、そのまま目に見える。
3. 「上げたつもり」と実際の効きが、ズレない。
4. シンセも、音声ファイルも、マイクも、同じEQへ。
5. インストールなし、アカウントなし、送信なし。
6. 耳で聴いて、目で確かめる10バンド。
7. HTML1ファイル分の、シンセとイコライザー。
8. 作る・整える・書き出す。タブを離れずに。
9. Build a sound, then shape it — right in the browser.
10. The EQ curve you set is the EQ curve you get.

**用途の目安**
- OGP／カードのリード: 1・9
- 技術訴求の見出し: 2・3・7・10
- 一般向けの見出し: 4・5・6・8

---

## 5. Zenn / Qiita 記事アウトライン（任意成果物）

### タイトル案

1. **「Web Audio は例外を出さずに無音になる——ブラウザシンセを45項目で機械検証した話」**
2. **「getFrequencyResponse で"効いているEQ"を描く——スペクトラムにカーブを重ねるまで」**
3. **「アナライザを出力ゲインの前に置くと、マイクのハウリングが設計で解ける」**

### 詳細アウトライン（タイトル案1）

#### はじめに
- 作ったもの: 10バンドEQ＋減算合成シンセを1ページに（デモURL）
- この記事で扱うこと: **音が出ない**というバグの見つけ方
- 前提: フレームワーク不使用、Web Audio API のみ

#### H2: 「例外0件」はWeb Audioでは何も保証しない
- H3: 無音になる典型3パターン（connect漏れ／エンベロープの時刻ミス／AudioContext が suspended）
- H3: 目視デバッグの限界——「さっきは鳴っていた」が再現しない
- H3: 判定基準を `analyser.getByteFrequencyData` のピーク値に置く

#### H2: テスト用のデバッグブリッジを開ける
- H3: `window.SYNTHEQ_DEBUG` に何を出すか（声部数・ピーク値・EQゲイン・make-up gain）
- H3: 実装に関数を足したらブリッジにも足す、を運用ルールにする
- H3: Playwright から叩く最小構成

#### H2: 実際に踏んだ落とし穴
- H3: `setTargetAtTime` の直後に `AudioParam.value` を読むと目標値に達していない
  （時定数の10倍待つ／忘れると「フェーダーがフィルターに届いていない」という偽の不合格が出る）
- H3: 無音判定はリバーブのIR長より長く待つ（600msでは余韻で必ず落ちる）
- H3: ヘッドレスでは `--autoplay-policy=no-user-gesture-required` が要る
- H3: EQカーブの抜き取り位置——バンド周波数の真上ではなく平坦部（20Hz / 20kHz）で見る

#### H2: 可視化の実装——設定値ではなく実測を描く
- H3: `getFrequencyResponse` に対数軸の周波数配列を渡す
- H3: スペクトラムとカーブを同じ座標系に載せる
- H3: ピークホールドとカーソル読み取り

#### H2: 信号経路で解いた問題
- H3: アナライザを出力ゲインの前段へ——マイク時のハウリングと可視化の両立
- H3: 録音は make-up gain の後ろから分岐する（EQ通過後をWAVにする）

#### H2: まとめ
- 「動いた」の定義を数値に置き換えると、無音バグは再発しなくなる
- 検査45項目の内訳と、追加していく指針
- デモとソースへのリンク

---

## 6. プレスリリース文（任意成果物・約320字）

個人開発者のhide（深澤）は2026年8月、ブラウザだけで動作するオーディオツール
「グラフィックEQ＆シンセサイザー」を無料公開しました。

10バンド（31Hz〜16kHz）のグラフィックイコライザーと、減算合成シンセサイザーを
1ページに統合したツールです。シンセの音・音声ファイル・マイク入力の3系統をすべて
同じEQに通すことができ、設定したEQカーブを周波数スペクトラムに重ねて表示するため、
補正の効き具合を目で確認しながら調整できます。EQ通過後の音は16bitステレオWAVとして
書き出せるほか、音色・EQ・シーケンスをURLに埋め込んで共有することも可能です。

実装はフレームワークを使わずWeb Audio APIのみで構成されており、APIキーは不要。
音声ファイルもマイク入力も外部へ送信されません。

公開URL: https://hifukasawa77-lgtm.github.io/main/synth-eq.html

---

## 7. ランディングページコピー（任意成果物・Code-Generator引き渡し用）

> ポートフォリオ `index.html` のカード、または専用セクションを作る場合に使用。
> 既存のダーク＋シアン／パープルのGlassmorphismスタイルを踏襲すること（サイバーパンク演出は禁止）。

### ヒーローセクション

- **バッジ**: ブラウザ完結・APIキー不要 / 100% in-browser, no API key
- **H1**: グラフィックEQ ＆ シンセサイザー
- **サブ（英）**: Graphic EQ & Synthesizer
- **リード**: 音を作って、10バンドで整える。かけたEQカーブがスペクトラムに重なって見えるから、「上げたつもり」と実際の効きがズレません。
- **CTA（主）**: ▶ 開いて音を出す
- **CTA（副）**: ソースを見る（GitHub）
- **補足**: インストール不要／アカウント不要／音声は外部に送信されません

### 特徴セクション（3カラム）

**01 — 作る**
オシレーター2基＋サブ＋ノイズ、フィルターEG、ADSR、アルペジエーター。
音色プリセット8種と16ステップのシーケンサーで、すぐ音が鳴らせます。

**02 — 整える**
31Hz〜16kHzの10バンド、±18dB。両端はシェルビング、中央はピーキング。
プリセット10種とEQ ON/OFFのA/B比較、自動レベル補正つき。

**03 — 見る**
対数軸のスペクトラムにEQカーブを重ねて表示。
カーブは設定値の絵ではなく、実測した周波数特性です。

### 副次セクション（横並び4項目）

- **3つの音源** — シンセ／音声ファイル／マイク。どれも同じEQを通ります
- **WAV書き出し** — EQ通過後の音を16bitステレオで保存
- **共有リンク** — 音色・EQ・シーケンスをURLに埋め込み（サーバー保存なし）
- **MIDI入力** — Web MIDI 対応（Chrome / Edge）

### 信頼セクション

**フレームワーク不使用。Web Audio API のみ。**
HTML1ファイルで完結しています。音声ファイルもマイク入力もブラウザの外に出ません。
Web Audio は例外を出さずに無音になるため、Playwright による自動検査45項目で、
アナライザのピーク値・声部の残留・EQの実効まで機械検証しています。

### 注意書き（フッター近く・小さく）

マイクを使うときはヘッドホンを推奨します。スピーカーで鳴らすとハウリングします
（「スピーカーへ出力」をオフにしても、スペクトラムと録音は動きます）。
MIDI入力は Web MIDI API 対応ブラウザ（Chrome / Edge）でのみ利用できます。

### 最終CTA

**H2**: 開いて、フェーダーを1本動かしてみてください。
**ボタン**: ▶ グラフィックEQ＆シンセサイザーを開く
**サブテキスト**: 読み込みだけで音は鳴りません。まずは「デモ演奏」から。
