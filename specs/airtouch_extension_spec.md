# エアタッチ ブラウザ拡張機能（AirTouch Hands-Free Pointer）— 要件定義書／基本設計書／詳細設計書

- 起票: Planner
- 依頼元: 深澤（PM）
- 日付: 2026-10-04
- 状態: **仕様書のみ。実装しない。深澤の承認後に Verifier / Code-Generator / Graphic-Designer へ渡す**
- 対象: Google Chrome / Microsoft Edge（フェーズ1）→ Firefox（フェーズ2）→ Mac の Safari（フェーズ3）
- 置き場所: このリポジトリの `extension/`（ビルド生成物は `extension/dist/`・gitignore）
- 流用元の正本: `assets/js/gesture-pointer.js`（1344行・ESモジュール）。**手編集で複製しない**
- 関連: CLAUDE.md「ZERO-1 Mobile とエアタッチの必須チェック」節、`scripts/verify-gesture-pointer.mjs`（84項目）

表記: 「確定」= 設計判断として決めた。「要試作」= 実機・実ブラウザで動かして確かめるまで断定しない。
「要確認」= 公式情報・規約で確かめるまで断定しない。**この仕様書の作成環境（Linux・外部は限定プロキシ）では、
Chrome / Edge / Firefox の公式ドキュメントに到達できなかった。Apple の2ページのみ確認済み**（§10）。

---

## 0. 先に読む要約（結論）

| # | 論点 | 結論 |
|---|---|---|
| 1 | カメラの置き場所 | **拡張オリジンの「カメラ係ページ」で1回だけ許可を取り、手の21点の座標だけをアクティブタブの content script へ送る**。Chromium=offscreen document（USER_MEDIA）／Firefox=background（event page）／Safari=拡張ページ（要試作）。映像は端末外へも**カメラ係の外へも出さない** |
| 2 | MV3のCDN禁止 | MediaPipe の wasm・ライブラリ・モデル(約7MB)を**全て同梱**。CSP は拡張ページに `wasm-unsafe-eval` のみ。content script には wasm を置かない（ページのCSPに触れない） |
| 3 | 合成イベントの限界 | 対応できない範囲を**表で確定**（§4.3）。操作先が分かるものは**画面に理由を出す**。ブラウザUIや chrome:// には届かないので、**ツールバーのバッジ＋ポップアップ**で伝える。タブ切替は拡張API専用ジェスチャ（Could） |
| 4 | 権限 | インストール時の権限は `offscreen` `storage` `scripting` `activeTab` のみ。**全サイト権限は任意（`optional_host_permissions`）**。既定は「今開いているタブだけ」 |
| 5 | 既存知見 | CLAUDE.md の全項目を要件化（§1.4に対応表）。`sw.js` 相当の別オリジン問題は拡張では発生しない（§4.8） |
| 6 | 配布と費用 | 開発者モード読込は無料。**ストア公開は課金が絡む**ので深澤の承認が前提（§9）。Safari の Apple Developer Program は年約99ドルで**月次上限¥5,000を超える** |
| 7 | ビルド | **依存ゼロの連結スクリプト**（`scripts/build-extension.mjs`・node標準のみ）。manifest は**1本の共通元＋ブラウザ別の差分3つから生成**（§5.3） |
| 8 | 機械検査 | 新設 `scripts/verify-airtouch-extension.mjs`。静的(A)／Chromium実機E2E・合成ソース(B)／偽カメラ実機(C)の3層＋`--inject`故障注入（§7） |
| 9 | 利用者導線 | 初回ウェルカム→カメラ許可→範囲選択→練習ページ。失敗は「段階・名前・次の一手」を日英で（§6） |
| 10 | リスク | Safari の可否、offscreen内のカメラ許可・推論タイミング、ストア審査が最大（§11） |

---

## 1. 要件定義書

### 1.1 背景・目的

エアタッチは現状 `zero-1-mobile.html` 等に**ページ単位で**組み込まれている（カメラに指をかざして画面を操作）。
これを**どのサイトでも使えるハンズフリー操作**にするためブラウザ拡張にする。調理中・手が汚れている・
マウスが持てない人向けのアクセシビリティ寄りの価値を狙う。

**目的**: 拡張をONにすれば、開いている任意のWebページを、カメラに映した指のつまみでタップ／スクロール／ドラッグできる。

**対象ユーザー**: 手が離せない状況の人／マウス・タッチ操作が難しい人／デモ・非接触操作に興味がある人。
**非対象**: スマートフォンのブラウザ（モバイル拡張は対象外。モバイルは既存の `zero-1-mobile.html` 組み込みで足りる）。

### 1.2 機能要件（MoSCoW）

| ID | 区分 | 要件 |
|---|---|---|
| F1 | Must | カメラの許可を**拡張オリジンで1回だけ**取る。サイトごとに許可を聞かない |
| F2 | Must | オン/オフ（ポップアップ・キーボードショートカット）。**ブラウザ起動時は常にオフ**（カメラを勝手に回さない） |
| F3 | Must | オンの間、手の21点の座標だけを**アクティブなタブ**へ届け、ポインター移動・タップ（つまみ）・スクロール（パン）・ドラッグ&ドロップを実DOMへ作用させる |
| F4 | Must | オフ／失敗／タブ切替で、オーバーレイを片付け、押下を解除し、カメラを止める |
| F5 | Must | 失敗時は「どの段階で・何が起き・次に何をすればよいか」を日英で画面に残す（§6.3） |
| F6 | Must | 手を見失ったら押下を解除。カメラ係が黙ったら（応答なし）検知して押下を解除し理由を出す |
| F7 | Must | つまみ調整（キャリブレーション）。結果は保存し次回以降も使う |
| F8 | Must | できることの一覧（ヘルプ）。切ってある操作は載せない |
| F9 | Must | 設定は拡張側 `storage.local` に保存（ページの localStorage には書かない）。読み書きは必ず try/catch で既定へ落とす |
| F10 | Must | 操作できない範囲を利用者に見せる（§4.3）：iframe・ファイル選択等・ブラウザ自身のUI・制限ページ |
| F11 | Must | 初回ウェルカム（何ができるか／映像は外へ出ない／許可→範囲選択→練習） |
| F12 | Must | 練習ページ（拡張内ページ。ボタン・スクロール枠・ドラッグ項目）。検査の標的も兼ねる |
| F13 | Should | 静止クリック（既定OFF）・横払いで戻る（既定OFF）・中指つまみ＝右クリック（既定ON・人差し指が開いている条件つき） |
| F14 | Should | 手の骨格プレビュー（映像は出さず骨格のみ）。ドック位置の上下切替 |
| F15 | Should | 手が10分（設定可・0=無し）映らなければ自動オフ |
| F16 | Should | オーバーレイをトップレイヤー（`popover="manual"`）に載せ、`<dialog>` のモーダルの下に隠れないようにする（要試作・§4.3） |
| F17 | Could | ブラウザ操作ジェスチャ（手のひら横払い=前/次のタブ）。**既定OFF**。拡張APIで実行（合成イベントでは不可能なため）。`tabs.update` 等 |
| F18 | Could | 同一オリジン iframe の内側への操作（`all_frames`＋座標中継は要試作） |
| W1 | Won't | `debugger` 権限による「本物の入力イベント」の送出（常時の警告バーとストア審査で不利。**検討して却下**） |
| W2 | Won't | キーボード入力の代替、音声、複数の手、モバイルブラウザ、映像の保存・送信、利用統計の送信 |

### 1.3 非機能要件

| 項目 | 要件 |
|---|---|
| 性能 | 手の座標がタブへ届くまで中央値 50ms 以下・95%点 120ms 以下（Layer-Cで実測）。推定は ≧15 fps（要試作：offscreen内のタイマー制限）。CPU常用を避け、タブが裏の間は推定結果を送らない |
| プライバシー | 映像はカメラ係ページの外に出さない。保存・送信なし。外部通信は**0件**（検査で機械確認）。利用統計・クラッシュ送信なし |
| セキュリティ | ページ由来の文字列を `innerHTML` に入れない。content script はページの内容（テキスト・入力値）を読まない（`elementFromPoint`・`getComputedStyle`・イベント送出のみ）。メッセージは送信元と形を検証 |
| 互換性 | Chrome・Edge（Chromium MV3）、Firefox（MV3・event page）、Safari（macOSのみ・要確認） |
| 権限 | 最小（§4.4）。**権限を足したら検査が落ちる**（`permissions` を完全一致で検査） |
| 保守 | 判定層・作用層は `assets/js/gesture-pointer.js` が唯一の正本。拡張側に複製を**コミットしない** |
| a11y | `prefers-reduced-motion` を尊重（正本が対応済み）。ポップアップはキーボード操作可・コントラスト確保 |
| デザイン | 黒背景＋シアン/パープル。**サイバーパンク調（ネオングロウ過多・原色ネオン・SF都市風）禁止**。色は正本の `STYLE`（`gesture-pointer.js` 内）とサイトの既存CSS変数に揃える。具体色コードは CLAUDE.md が唯一の正 |
| UI言語 | UI文言は日英バイリンガル（「日本語 / English」）。ストア表示用は `_locales/{ja,en}` |

### 1.4 既存知見の取り込み（CLAUDE.md「ZERO-1 Mobile とエアタッチ」節 → 拡張での実装先）

| 既存の知見 | 拡張での扱い | 検査 |
|---|---|---|
| ヒステリシス（押下の閾値は上下2つ） | 正本の GestureEngine をそのまま使用（再実装しない） | 正本側の verify-gesture-pointer（既存） |
| キャリブレーション（山が重なれば閾値を作らず理由を返す／調整中は押下を通さない） | 正本 `PinchCalibration` と `AirTouch.tick` の挙動をそのまま使用。ポップアップから開始 | B-calib（調整中のpointerdown数が0） |
| 起動失敗は理由が残るまで作り込む | カメラ係が段階つきで失敗を送る。ポップアップ・ページ内ヒントの両方に出す。診断ブロック（コピー可）を持つ | B-fail |
| 待ち続けない（stallGuard／時間切れ） | 段階ごとの進捗時間切れ（§4.5）。検査用に短縮する口は**テストビルドだけ**に置く | B-stall |
| オーバーレイに `pointer-events:none` | 正本の CSS 任せにせず、**実測**（`getComputedStyle`＋`elementFromPoint`）で検査 | B-overlay |
| 起動失敗時の片付け | 失敗・オフ・タブ離脱・ポート切断のすべてで `AirTouch.disable()` 相当と層削除 | B-fail / B-tab / B-off |
| ピンチ量の手サイズ正規化 | 正本 `pinchRatio` が担う。**拡張は座標を加工せず素通し**（加工すると正規化が壊れる） | B-transport（座標の完全一致） |
| 静止クリック／横払いは既定OFF | 設定の既定値は正本の `DEFAULTS` に従う。拡張が上書きしない | A（既定値がOFFのまま） |
| 設定は try/catch で保存 | `storage.local` の読み書きを try/catch。壊れた値は `sanitizeSettings` へ。読めなくても動く | B-settings |
| 手を見失ったら押下を解除 | 正本の挙動＋**転送路の黙り（ハートビート途絶・ポート切断）でも解除** | B-lost / B-heartbeat |
| 「worker は作れても動かない」（自分で ready と言わせる） | カメラ係が `ready` を送る。来なければ失敗にする（§4.5） | B-stall |
| 合成した PointerEvent から mouse 系が自動生成されない／`:hover` は点かない | 正本が両方出す・`.airtouch-hover` クラス。**CSP厳格ページでも**層が出ることを検査 | B-csp |
| 「検査は合成ソースを差し込んで通しで確かめる」 | §7 の Layer-B（合成ランドマーク）＋ Layer-C（偽カメラ実機） | — |
| 画面を消すだけでGPU切断（スマホ） | デスクトップでは主因でない。ただし**オフスクリーンの GPU delegate 失敗は CPU へ落とす**（正本の挙動）。切断の兆候はハートビートの `frames` 停止で検知 | B-heartbeat |
| 失敗パネルに配信経路を出す | 診断ブロックに「カメラ係の種類（offscreen / background / 拡張ページ）」「ブラウザ名と版」「拡張版」を出す | B-fail |

---

## 2. 基本設計書

### 2.1 システム構成図

```
┌──────────────────────── 拡張オリジン（chrome-extension:// / moz-extension:// / safari-web-extension://）────────────────────────┐
│                                                                                                                                │
│  [カメラ係] camera-host（Chromium: offscreen / Firefox: background / Safari: 拡張ページ）                                         │
│    getUserMedia → <video> → MediaPipe HandLandmarker（wasm・モデル同梱）→ ランドマーク21点（63数値）                              │
│    ※映像・フレームはここから出ない。出すのは座標・状態・ハートビートだけ                                                       │
│        │ runtime Port "airtouch-camera"（30Hz程度・座標のみ）                                                                  │
│        ▼                                                                                                                       │
│  [中継] background（Chromium: service worker / Firefox: event page）                                                           │
│    状態（オン/オフ・対象タブ・モード）／カメラ係の起動停止／アクティブタブの追跡／権限・注入／バッジ／コマンド（ショートカット）  │
│        │ runtime Port "airtouch-content"（アクティブタブにだけ座標を流す）                                                      │
│        ▼                                                                                                                       │
│  [popup / options / welcome / practice / permission] 拡張内ページ（UI・設定・練習・許可取り）                                    │
└────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
         ▼
 ┌─ 各Webページ（content script・isolated world）─────────────────────────────┐
 │  RelaySource（座標を受けて poll() で返す推定層の代役）                       │
 │      ↓                                                                       │
 │  AirTouch（正本）= GestureEngine → PointerDriver（実DOMへイベント合成）       │
 └──────────────────────────────────────────────────────────────────────────────┘
```

3層との対応: 推定層=**カメラ係＋RelaySource に分割して作り直す**／判定層（GestureEngine・OneEuroFilter・PinchCalibration・各純粋関数）=流用／
作用層（PointerDriver）=流用。`AirTouch` クラスは `createSource` を差し替えられるのでそのまま使い、**拡張側で書く判定ロジックは0行**にする。

### 2.2 論点1の結論 — カメラの置き場所

**問題**: content script から `getUserMedia` を呼ぶと、許可がサイト（ページのオリジン）単位になり、サイトごとに許可ダイアログが出る。
HTTP のページでは使えもしない。ハンズフリー用途として成立しない。

**結論（確定）**: カメラは拡張オリジンのページだけが持つ。許可は拡張オリジンに1回。座標だけをタブへ送る。

| ブラウザ | カメラ係 | 初回の許可 | 状態 |
|---|---|---|---|
| Chrome / Edge（MV3） | **offscreen document**（reason=`USER_MEDIA`）。service worker には DOM が無く `getUserMedia` も使えないため | offscreen は画面に出ないので**許可ダイアログが出ない可能性が高い**。そのため**見える拡張ページ `permission.html` で先に1回 `getUserMedia` して許可を取って**から offscreen を使う（許可は拡張オリジンに残る） | **要試作**：①offscreen 内で許可が引き継がれるか ②offscreen に寿命制限があるか（理由ごとに違う）③GPU delegate（WebGL）が offscreen で使えるか ④画面外ドキュメントの rAF/タイマー間引き |
| Firefox（MV3） | background の **event page**（`background.scripts`）。DOM があり getUserMedia を呼べる | background からは許可の案内が出ない／出ても気付けない恐れ。**`permission.html` で先に取る**手順は共通にする | **要試作**：①event page が長く生きるか（アイドルで落ちる）②落ちたときの再起動で許可が残るか |
| Safari（macOS） | **拡張ページ**（offscreen 相当が無い前提）。具体案：ツールバーのポップアップは閉じると死ぬので、**固定された拡張タブ（`camera-host.html`）またはウインドウ**をカメラ係にする | Safari 拡張ページでの getUserMedia 可否・許可の保持・UIは**未確認** | **要試作・要確認**。**成立しなければフェーズ3は中止**（深澤へ報告） |

**カメラ係の共通I/F（確定）**: `camera-host.js` は種類によらず同じコードで、起動方法だけが違う（Chromium=offscreen を作る／Firefox=background に同居／Safari=固定タブを開く）。
起動方法は background の `CameraHostLauncher`（ブラウザ別実装・小さい）に閉じ込める。

**映像の取り扱い（確定）**: カメラ係は `<video>`＋推論だけ。`canvas` に描いても `toDataURL`・`blob`・`postMessage` で外へ出さない。
外へ出る型はプロトコル（§3.2）の座標配列のみ。送信先は background だけ。検査（A-egress／B-egress）で
「外部ネットワーク要求0件」「プロトコル外の型のメッセージ0件」「カメラ係のCSPが `connect-src 'self'`」を機械確認する
（`connect-src` を拡張ページのCSPに書けるかは**要確認**。書けないブラウザは検査の網羅（要求0件）で担保する）。

### 2.3 論点2の結論 — MV3の「実行コードはCDN不可」への対応

- 同梱するもの（`extension/vendor/`）: `@mediapipe/tasks-vision@1.0.1`（既存 `VISION_VERSION` と**同じ版に固定**）の `vision_bundle.mjs` と
  `wasm/vision_wasm_internal.{js,wasm}`・`vision_wasm_nosimd_internal.{js,wasm}`、手のモデル `hand_landmarker.task`（約7MB）。
  合計は**約25〜30MBの見込み（要実測）**。
- 取得は `scripts/fetch-extension-vendor.mjs`（npm registry の tarball を取り `dist.integrity`＝sha512 で照合・モデルは `storage.googleapis.com` からsha256を記録）。
  **ハッシュは `extension/vendor.lock.json` に固定**し、ビルドと検査が突き合わせる。モデルの初回取得は期待値が無い（TOFU）ので、
  初回は人が取得元と大きさを確かめてロックへ書く。この環境からモデルURLへ届くかは**要確認**（届かなければ手元PCで取得して配置）。
- CSP（確定）: `extension_pages` に `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`。`unsafe-eval` は入れない。
  MediaPipe の wasm ローダが `eval`／`new Function` を使っていないかは**要試作**（使っていれば CSP 違反が出るので、検査が `securitypolicyviolation` を拾う）。
- **content script には wasm も MediaPipe も置かない**。ページ側のCSPと無関係に動かせ、「リモートコード」審査の面でも安全。
- 実行コードのURLリテラル（`https://…`）は**配布物から0件**（ライセンス表記のコメントを除く）。正本の推定層（CDNを読む部分）は
  ビルドで**切り落とす**（§5.4）。
- ライセンス: MediaPipe（tasks-vision）は Apache-2.0 と理解しているが**要確認**。モデルファイルのライセンスは**別に要確認**。
  `extension/THIRD_PARTY_LICENSES.txt` に名称・版・ライセンス全文・入手元を置き、配布物へ同梱。Legal-Checker に回す（§12）。

### 2.4 画面（ページ）構成

| ページ | ファイル | 役割 |
|---|---|---|
| ポップアップ | `popup/popup.html` | オン/オフ、状態（段階・理由）、つまみ調整、ヘルプ表示、設定ページへ。320px幅 |
| 設定 | `options/options.html` | 範囲（今のタブだけ／全サイト）、静止クリック・横払い・右クリック・ドック位置、自動オフ、既定へ戻す、診断情報のコピー |
| ウェルカム | `welcome/welcome.html` | インストール直後に開く。説明→カメラ許可→範囲選択→練習 |
| カメラ許可 | `permission/permission.html` | 見える状態で `getUserMedia`→数秒のプレビュー→停止。失敗は理由と手順を表示 |
| 練習 | `practice/practice.html` | 押すボタン（カウント）・縦横スクロール枠・ドラッグ項目。content script と同じ経路で動く |
| カメラ係 | `camera/camera-host.html` | 非表示（Chromium offscreen）。推論とハートビート |

状態遷移: `off → starting（許可/ライブラリ/モデル/カメラ/ready の段階）→ on(tracking | no-hand) → stopping → off` ／ 任意の段階から `error`（理由つき）→ `off`。
タブ別: `idle → attached → active | paused（タブが裏）→ detached`／`unsupported`（注入不可）。

### 2.5 データ構造（概要）

- 拡張設定 `ext:v1`（`storage.local`）: `{ scope: 'tab'|'all', language: 'ja-en', showPreview, autoOffMin, tabGestures, welcomed }`
- エンジン設定 `airtouch:settings:v1`: 正本の `SETTING_KEYS`（`pinchDown, pinchUp, dwellEnabled, dwellMs, secondaryEnabled, navigateOnSwipe, dockSide`）と**同じ形**。`sanitizeSettings` を通す
- 実行状態 `state:v1`（`storage.session`・ブラウザ終了で消える）: `{ on, startedAt, activeTabId, hostKind, stage }`。**ONはブラウザ終了をまたいで保持しない**
- ランドマークフレーム: §3.2 の `hand` メッセージ

---

## 3. 詳細設計書（メッセージ・I/F）

### 3.1 ファイル構成

```
extension/
  manifest.base.json            # 共通の元
  manifest.chromium.json        # 差分（Chrome/Edge）
  manifest.firefox.json         # 差分
  manifest.safari.json          # 差分
  vendor.lock.json              # 同梱物のハッシュ固定
  THIRD_PARTY_LICENSES.txt
  PRIVACY.md                    # ストア審査用プライバシー説明（日英）
  src/
    shared/protocol.js          # メッセージ型・検証関数（純粋ロジック・Node でも読める）
    shared/i18n.js              # 日英文言表（失敗理由・次の一手）
    shared/errors.js            # 例外→{stage,name,message,hint} の変換（純粋）
    background/background.js    # 中継・状態・注入・バッジ・コマンド（Chromium=SW / Firefox=event page 共通本体）
    background/launcher-*.js    # CameraHostLauncher（offscreen / background / tab）
    camera/camera-host.html     # 推定層（拡張向け）
    camera/camera-host.js
    camera/hand-landmarker.js   # MediaPipe呼び出し（ローカル同梱物のみ）
    content/relay-source.js     # 推定層の代役（poll を満たす）
    content/content-main.js     # AirTouch の生成・破棄・メッセージ配線
    popup/ options/ welcome/ permission/ practice/   # 各 .html .js .css
    _locales/ja/messages.json  _locales/en/messages.json
  icons/                        # PNG（16/32/48/128）※拡張のアイコンはPNG指定のため assets/ 外に置く
  test/                         # 検査用（テストビルドだけに入る）
    fake-landmark-source.js     # 合成ランドマーク（§7.2）
    test-hooks.js               # 時間切れ短縮・状態公開
    pages/                      # 検査の標的ページ（通常/CSP厳格/iframe/ファイル入力 等）
  dist/                         # 生成物（gitignore）: chromium/ firefox/ safari/ と *-test/
scripts/
  build-extension.mjs           # 連結・manifest生成・正本取り込み（node標準のみ）
  fetch-extension-vendor.mjs    # 同梱物の取得とハッシュ照合
  verify-airtouch-extension.mjs # 機械検査（§7）
```

### 3.2 メッセージプロトコル（`shared/protocol.js`・版 `v:1`）

全メッセージは `{ v:1, t:<型>, … }`。**受信側は型・数値の有限性・長さを検証し、不正は捨てる（捨てた数を数える）**。
`sender.id === runtime.id` を background と content で確認する。`externally_connectable` は設定しない。

| 方向 | 型 `t` | 中身 | 用途 |
|---|---|---|---|
| camera→bg | `ready` | `{hostKind, delegate:'GPU'|'CPU', verifiedVendor:true}` | カメラ係の自己申告（「作れても動かない」対策。来なければ失敗） |
| camera→bg | `status` | `{stage, text, level}` | 段階 `permission/library/model/camera/ready` の進捗（日英文言） |
| camera→bg | `hand` | `{seq, ts, lm:number[63]|null, hd:'Left'|'Right'|''}` | 座標のみ。`lm` は x,y,z を 21点×3 の平坦配列（小数4桁）。手無しは `null` |
| camera→bg | `beat` | `{seq, ts, frames, fps}` | 1秒ごと。手が映っていなくても出す（黙りの検知） |
| camera→bg | `fatal` | `{stage, name, message, hint}` | 失敗。`name` は例外名（`NotAllowedError` 等）を保持 |
| bg→camera | `start` / `stop` | `{opts}` / `{}` | 起動・停止（停止は必ず `track.stop()` と `landmarker.close()` を行い `stopped` を返す） |
| camera→bg | `stopped` | `{}` | 停止完了の確認（検査がカメラ解放を確かめる） |
| bg→content | `attach` / `detach` | `{settings, ext}` / `{reason}` | AirTouch の生成・破棄 |
| bg→content | `pause` / `resume` | `{}` | タブが裏／表。**pause で押下解除・カーソル非表示** |
| bg→content | `hand` / `status` / `fatal` / `calibrate` / `help` | 上記同様 | 転送。アクティブタブにだけ送る |
| content→bg | `hello` / `bye` | `{}`（中身なし） | 接続の確立。**URLやページ内容は送らない** |
| content→bg | `settings` | `{patch}` | 調整結果などの保存（`sanitizeSettings` 後） |
| content→bg | `cmd` | `{name:'tab-next'|'tab-prev'}` | ブラウザ操作ジェスチャ（F17） |

- 接続は `runtime.connect` の **Port**（ポートでメッセージが流れている間はMV3のSWが落ちにくい）。SWが落ちて Port が切れたら、
  カメラ係・content の双方が**再接続**し、再接続できないときは理由を出す（B-swrestart）。**要試作**：SW再起動中の取りこぼし量。
- 古いフレームの扱い: content の `RelaySource.poll()` は最後の `hand` が **250ms 以上古ければ `null`（＝手を見失った）** を返す。
  これで「SWが死んだまま最後の位置で固まる／押下が張り付く」を防ぐ。**ハートビートが3秒途絶したら、押下解除＋「カメラ側から応答がありません」を表示**。
- 座標は**加工せず素通し**（丸めは小数4桁まで。検査で `GestureEngine` へ渡った値と元の値の誤差 ≦1e-4 を確認）。

### 3.3 RelaySource（推定層の代役・`content/relay-source.js`）

`AirTouch` が要求する `{ start(doc), poll(now), stop(), video }` を満たす。

- `start`: background へ `hello` を送り、`ready` が来たら解決。**時間切れ（§4.5）**で失敗にする。
- `poll(now)`: 最新の `hand` を `{landmarks:[{x,y,z}×21], handedness}` に組んで返す。古ければ `null`。`doc.hidden` の間は `null`。
- `stop`: Port を閉じるが**カメラは止めない**（止めるのは background がオフにしたとき）。
- `video`: 骨格プレビュー用の**黒背景プレースホルダ要素**を返す（`mountPreview` が子要素として載せるだけ）。映像は content に存在しない。

### 3.4 background の責務

- **状態**: オン/オフ・対象タブ・段階。`storage.session` に写す（SW再起動に耐える）。ブラウザ起動時は必ずオフ。
- **アクティブタブ追跡**: `tabs.onActivated` / `windows.onFocusChanged` で対象を切替え、旧タブへ `pause`、新タブへ `resume`（未注入なら注入）。
  **座標は対象タブにだけ送る**（全タブへ送ると押下が複数タブで同時に起きる）。
- **注入**: 範囲が `all` ならホスト権限があるタブへ登録済み content script（`scripting.registerContentScripts`・`persistAcrossSessions`）。
  範囲が `tab` なら、ショートカット／ポップアップ操作（=`activeTab` 付与）の瞬間に `scripting.executeScript`。
  注入できなかったタブは `unsupported`（理由＝制限ページ／権限なし／ファイルURL許可なし）として記録し、**バッジとポップアップに出す**。
- **バッジ**: `ON`／`!`（このタブは使えない）／`×`（失敗）／なし。`action.setTitle` に理由。
- **コマンド**: `toggle`（既定 Alt+Shift+A。**カメラ以外の逃げ道**＝手が効かなくても必ずオフにできる）。
- **自動オフ**（F15）: `beat` に手無しが続けば `alarms` ではなく**時刻比較**（絶対時刻を正本にする。タイマーはSWで止まる・遅れる）。
  `alarms` 権限は足さない。

### 3.5 content script の責務（`content-main.js`）

- 既定では**何もしない**（DOM に触れない）。`attach` を受けたら `AirTouch` を `createSource: () => new RelaySource(...)` で生成し `enable()`。
- 設定の保存先は**インメモリ storage アダプタ**を `AirTouch` の `storage` に渡す（`getItem/setItem` が同期で要るため）。
  `attach` で受けた設定を読み込み、`setItem` は `settings` メッセージで background へ書き戻す。
  **既定の `safeStorage(doc)` はページの localStorage を使うので使わせない**（サイトごとに設定が分かれ、ページから読める）。
- `detach`/`pause`/Port切断/`fatal` で `AirTouch.disable()` を呼び、**層が DOM から消えたことを確認**する。
- 操作対象の注意（F10）: タップ先が `<iframe>`／`<input type=file|color|date|time…>`／`<select>`／`<embed>`・`<object>` のとき、
  ページ内ヒント「この部分はブラウザの安全のため手で操作できません。マウスをお使いください / Browser security blocks this — please use the mouse」を出す。
  該当一覧は `UNSUPPORTED_TARGETS`（静的表・検査で網羅確認）。

### 3.6 正本 `assets/js/gesture-pointer.js` への最小変更（深澤の承認事項）

拡張専用の複製を持たないために、正本へ**挙動を変えない**範囲で次を入れる。いずれもサイト側（zero-1-mobile.html）の既存検査が緑のままであること。

| ID | 変更 | 理由 |
|---|---|---|
| C1 | 推定層（`VISION_VERSION`〜`createHandSource` の範囲）を `// @airtouch:cut-begin` / `// @airtouch:cut-end` の目印で囲む | ビルドが**正規表現でなく目印で**切り落とせる。CDN読込コードを配布物に残さない |
| C2 | `PointerDriver` のカーソル生成の `innerHTML`（固定文字列）を `createElement` に置換 | Trusted Types を要求するページ（`require-trusted-types-for 'script'`）で `innerHTML` が例外になる恐れ（要試作）。サイトのXSS方針（外部由来文字列を innerHTML に入れない）にも一致 |
| C3 | `ensureStyle` を「`options.styleSheet`（注入済みの CSSStyleSheet）があればそれを `adoptedStyleSheets` へ、無ければ従来どおり `<style>`」にする。`STYLE` を `export` | 厳格な `style-src` のページでは content script が作った `<style>` が効かない恐れ（要試作）。`scripting.insertCSS` / `adoptedStyleSheets` は CSP の対象外 |
| C4 | （F16・Should）層を `popover="manual"` で表示できる任意の設定 | `<dialog>` のモーダルの下に隠れる対策（要試作） |

変更後は `verify-gesture-pointer.mjs` に「C1の目印が対で存在」「`innerHTML` が正本に無い」を追加する（Verifier）。

---

## 4. 論点別の設計判断

### 4.1 （論点1）→ §2.2 に記載

### 4.2 （論点2）→ §2.3 に記載

### 4.3 論点3 — 合成イベント（`isTrusted=false`）の限界と、見せ方

**確定の対応表**（「手では動かない」を利用者に隠さない）。

| 対象 | 結果 | 利用者への見せ方 |
|---|---|---|
| 通常のリンク・ボタン・フォーム送信・チェックボックス | 動く（正本が pointer と mouse の両系を出す） | — |
| 全画面（`requestFullscreen`）・クリップボード読み書き・`window.open` のポップアップ・メディアの音あり自動再生解除 | **ユーザー操作の判定が通らず失敗しうる**（ブラウザ次第・要試作で一覧化） | 練習ページに「動かないことがあります」一覧。ヘルプにも載せる。ページ内での検出はできない（失敗はページ側に投げられ見えない）ため、**事前に一覧で伝える** |
| `<input type=file>` のファイル選択・`<select>` のネイティブ一覧・色/日付ピッカー | 開かない | **検出できる**。ページ内ヒントを出す（`UNSUPPORTED_TARGETS`） |
| `<iframe>`（別オリジン）の内側 | 届かない（フェーズ1は最上位フレームのみ） | iframe の上へポインターが乗ったら「枠の中は操作できません」ヒント。F18（Could）で同一オリジンのみ対応を検討（要試作） |
| `<dialog>` モーダル・popover の最前面 | 操作はできるが**カーソルが下に隠れる恐れ** | C4（Should・要試作） |
| ブラウザ自身のUI（タブ・アドレスバー・拡張メニュー・ダウンロード）、ブラウザ制限ページ（`chrome://` `edge://` `about:` `moz-extension://` 他拡張のページ）、ストア（Chrome Web Store・Edge Add-ons・AMO）、ビルトインPDFビューア、`view-source:`、`file://`（ブラウザ設定の許可が必要） | content script が注入されない／届かない | background が注入失敗を検知→バッジ`!`＋タイトル＋ポップアップに理由。**ページ内には何も出せない**ので、バッジが唯一の表示。ウェルカムと説明文にも明記 |
| タブ切替・ウインドウ操作・戻る/進む（ブラウザ側） | 合成イベントでは不可能 | 拡張APIの専用ジェスチャ（F17・既定OFF・手のひら横払い）。拡張API（`tabs.update` 等）で実行 |
| 本物の入力が要る場面全般 | `debugger` 権限で可能だが**却下（W1）**：常時の警告バー・審査・信頼性 | — |

### 4.4 論点4 — 権限とプライバシー

**インストール時の権限（確定・検査で完全一致）**: `offscreen`（Chromiumのみ）、`storage`、`scripting`、`activeTab`。
`commands`（manifestキー）で toggle。**`tabs` は付けない**（`tabs.query({active:true})`・`tabs.update`・`sendMessage` は `tabs` 権限が無くても使える。URL文字列は読まない）。
`alarms`・`webNavigation`・`webRequest`・`debugger`・`clipboard*`・`downloads`・`history`・`cookies` は**付けない**。

**ホスト権限**:

| 範囲 | 仕組み | 利点 | 欠点 |
|---|---|---|---|
| 今のタブだけ（**既定**） | `activeTab`。ショートカット／ポップアップ操作で付与→`executeScript` | インストール時に「全サイトのデータを読み取る」警告が出ない。審査に有利 | ハンズフリーで**別ページへ遷移すると途切れる**（遷移後に再度ショートカット）。**手だけで連続操作したい用途とは相性が悪い** |
| 全サイト（任意） | `optional_host_permissions: ["<all_urls>"]`。設定画面のボタン（ユーザー操作）で `permissions.request`。許可後に content script を登録 | 遷移しても続く | 強い権限。説明責任が重い |

**結論**: 既定は「今のタブだけ」。ハンズフリーの本命は「全サイト」なので、ウェルカムで**違いを日英で説明して選ばせる**（推奨表示は「全サイト」だが既定はタブのみ）。
全サイトは任意でいつでも取り消せる（設定画面から `permissions.remove`）。Firefox は MV3 でホスト権限が既定で任意扱い（要確認）。
`file://` は別設定（ブラウザの「ファイルURLへのアクセスを許可」）で、拡張からは付与できない旨を説明する。

**プライバシー説明（ストア審査向け・`PRIVACY.md` と掲載文の元）**:
- カメラは手の位置を求めるためだけに使う。**映像・画像・手の座標は、保存も送信もしない**。処理は全てこの端末内。
- 取得した座標は拡張内でメモリ上にだけ存在し、表示中のタブの操作に変換して捨てる。
- ページの内容（本文・入力値・URL）は読まない・送らない。
- 保存するのは設定（つまみ感度・オン/オフの好み）だけで、拡張のローカル領域に置く。同期ストレージ（`storage.sync`）は使わない。
- 外部サーバーへの通信は無い。分析・広告・トラッキング無し。
- オフ、またはブラウザ終了でカメラは止まる。カメラ使用中はツールバーのバッジが `ON` になる。
- 単一目的の説明（ストア規定）: 「カメラで指の動きを読み取り、Webページをハンズフリーで操作する」。権限ごとの用途説明を提出時に用意（§9）。

### 4.5 論点5 — 起動失敗・時間切れ（待ち続けない）

段階と時間切れ（実時間で待つ検査は遅いだけで落ちるので、**短縮の口はテストビルドだけ**に置く＝`test/test-hooks.js` が `storage.local` の `__test_timeouts` を読む。本番ビルドには存在しない。検査A-prodが確認）:

| 段階 | 失敗の例 | 時間切れ（本番の既定・要チューニング） | 次の一手（日英） |
|---|---|---|---|
| permission | `NotAllowedError`（拒否）/ `NotFoundError`（カメラ無し）/ `NotReadableError`（他アプリが使用中） | 許可画面が開いてから 120s 無反応 | 拒否: ブラウザごとの「カメラの許可を戻す手順」。無し: 接続確認。使用中: 他のアプリ（会議アプリ等）を閉じる |
| library / model | 同梱ファイルの読込失敗・CSP違反・wasm初期化失敗 | 30s 進捗なし | 拡張の再インストール／再読込。診断ブロックをコピーして報告 |
| camera | `getUserMedia` 解決後に映像が来ない | 15s | カメラを抜き差し／他アプリを閉じる |
| ready | カメラ係が `ready` を言わない（作れても動かない） | 20s | 再試行ボタン。診断ブロック |
| 稼働中 | ハートビート3秒途絶／GPU失敗でCPUへ落ちた | 3s | 自動で1回だけ再起動→戻らなければ理由を出してオフ |

- 失敗時は**必ず**: カメラ係停止（`stopped` 確認）→ content の層削除 → バッジ`×` → ポップアップに「段階／例外名／メッセージ／次の一手」と診断ブロック。
- 診断ブロック: `拡張版・ブラウザ名と版・カメラ係の種類（offscreen/background/tab）・段階・例外名・delegate・フレーム数・SWの再起動回数`。
- 例外の英文はそのまま出さず、`name` で日本語に引き当てる（辞書に無い名前は原文を併記）。判定の目印は `name` に持たせ、自分で投げる例外に英文を混ぜない（既存知見）。
- **推測で妨げない**: 空きメモリ等の推測では起動を止めない（GPU無しはCPUへ落とす）。

### 4.6 論点9 — 利用者向け導線（日英）

| 場面 | 文言（「日本語 / English」） |
|---|---|
| ウェルカム冒頭 | 「カメラに指をかざして、ページを操作します / Control web pages by holding up a finger to your camera」 |
| プライバシー | 「映像は端末の外に出ません。保存もしません / Video never leaves your device. Nothing is stored」 |
| 許可案内 | 「次の画面でカメラの使用を許可してください（1回だけ） / Allow camera access on the next screen (just once)」 |
| 範囲選択 | 「今のタブだけ（おすすめの安全設定） / This tab only」「全サイトで使う（遷移しても続きます） / All sites (keeps working across pages)」 |
| 使えないページ | 「このページではエアタッチを使えません（ブラウザの制限） / AirTouch can't run on this page (browser restriction)」 |
| 操作不可の部品 | 「この部分はブラウザの安全のため手で操作できません。マウスをお使いください / Browser security blocks this — please use the mouse」 |
| ヘルプ | 正本 `helpText(options)`（切ってある操作は載せない）。ポップアップの「できること」ボタンで表示 |
| オフの逃げ道 | 「Alt+Shift+A でいつでもオフにできます / Press Alt+Shift+A to turn off any time」 |

ポップアップの状態表示は「オフ／準備中（段階名）／手を探しています／操作中／失敗（理由）」。**止まっているときに細かい設定を並べない**
（押しても効かず「壊れている」と取られる。既存知見）。つまみ調整・静止クリック等は「オンの間だけ」ポップアップに出す。

### 4.7 論点7 — ビルドと manifest

**ビルドは「依存追加なし・node標準のみ」の連結スクリプトで足りる（確定）**。理由: ①content script は3ファイル（正本IIFE化＋relay-source＋content-main）の連結で済む
②拡張内ページ（popup 等）は ESM をそのまま `<script type=module>` で読める ③npm依存を持ち込むとサイト側の「ビルドツール不使用」方針との境界が曖昧になる。
連結後の `content.js` は `vm.Script` で**クラシックスクリプトとして構文検査**する（`import`/`export` が残っていれば落ちる）。esbuild 等の導入は、
連結で足りなくなった時点で深澤へ再判断を仰ぐ。**TDZに注意**: 連結順で `const` の宣言より前に使う箇所が無いことを B で実行して確かめる。

**manifest は「共通元1本＋ブラウザ別の差分3つ」から生成（確定。3本の手書きは持たない）**:

| 差分の中身 | Chromium | Firefox | Safari |
|---|---|---|---|
| background | `service_worker`（type module可） | `scripts: [...]`（event page） | 要確認（非永続のページ／SW） |
| `permissions` | `offscreen` を含む | `offscreen` を含まない | 要確認 |
| `browser_specific_settings` | なし | `gecko.id`（AMOのMV3で必須）・`strict_min_version`（要確認）・データ収集の宣言（近年AMOが要求。要確認） | 変換ツールが生成 |
| `commands` / `action` | 共通 | 共通 | 要確認 |
| CSP | `wasm-unsafe-eval` | 同（Firefoxの既定CSPとの関係は要確認） | 要確認 |

生成物は `extension/dist/<browser>/manifest.json`。ビルドは**マージ後に必須キー・禁止キーを検査**し、不正なら失敗させる（§7 A）。

### 4.8 `sw.js` 相当の別オリジン問題は拡張では起きない

サイトの `sw.js` は「スコープ内の全GETを横取りし、別オリジンの失敗が理由の消えた `Failed to fetch` になる」問題があった。
拡張では: ①モデルもwasmも**同梱で同一オリジン**（`chrome-extension://…`）＝別オリジン通信が存在しない ②拡張のSWはページの通信を横取りしない
（`fetch` ハンドラを書かない。`webRequest` 権限も無い） ③したがって「Failed to fetch で理由が消える」経路は無い。
代わりに拡張固有の**無言の失敗**（§11 R・§7 B）を機械検査する: SWの停止、offscreenの寿命、注入の失敗、オーバーレイの層、ハートビートの途絶。
**拡張のSWに `fetch` リスナーを足さないこと**を静的検査（A）で固定する。

---

## 5. ビルド・取り込み設計

### 5.1 コマンド

```bash
node scripts/fetch-extension-vendor.mjs      # 同梱物の取得とハッシュ照合（初回・版更新時のみ）
node scripts/build-extension.mjs             # dist/chromium, dist/firefox, dist/safari を生成
node scripts/build-extension.mjs --test      # dist/*-test（合成ランドマーク＋検査フック入り）
node scripts/verify-airtouch-extension.mjs   # 機械検査（§7）
```

### 5.2 正本の取り込み（手編集禁止）

- ビルドは `assets/js/gesture-pointer.js` を読み、`extension/dist/_gen/gesture-pointer.mjs`（ESM用）と
  content 用 IIFE の素材を**生成**する。先頭に `GENERATED FROM assets/js/gesture-pointer.js sha256=<…> — DO NOT EDIT` のバナーを付ける。
- 生成物は `dist/`（gitignore）にだけ存在し**コミットしない**＝重複を持たない。
- 検査は毎回「生成物のバナーのsha256＝正本の現在のsha256」「生成物の本文＝正本から再生成した結果」を確かめる（手編集・古い複製の検出。A-sync）。

### 5.3 manifest 生成 → §4.7

### 5.4 content 用 IIFE の作り方

1. 正本から C1 の目印で囲まれた範囲（推定層）を除く。
2. 行頭の `export ` を外し、`export default …;` 行を削除（正規表現でなく**行頭一致のみ**・対象は許容表で固定。想定外の `export` 形が残れば失敗）。
3. `(function(){ … return { AirTouch, helpText, … }; })()` で包み、`AirTouch` が参照する `createHandSource` は**明示的に例外を投げるスタブ**を同梱（拡張では必ず `createSource` を渡すため呼ばれない。呼ばれたら理由つきで落ちる）。
4. `relay-source.js`・`content-main.js` を後ろへ連結。
5. 配布物に `import(`・`https://`・`eval(`・`new Function` が無いことを確認。

---

## 6. 利用者導線の詳細（画面ごとの要件）

### 6.1 ウェルカム → 許可 → 練習

1. インストール直後に `welcome.html` を開く（`runtime.onInstalled` の `reason==='install'`）。
2. 「カメラを許可する」ボタン→ `permission.html`（ユーザー操作内で `getUserMedia`）。成功: 3秒のライブ表示（ここだけ映像を見せる・端末内）→**必ず停止**。
   失敗: 例外名ごとの手順（拒否の戻し方はブラウザごと）。
3. 範囲の選択（§4.4）。「全サイト」を選んだら `permissions.request`（ユーザー操作内）。拒否されても「今のタブだけ」で続けられる。
4. `practice.html` で試す（ボタン・スクロール・ドラッグ）。つまみ調整へ誘導（任意・スキップ可）。
5. **手のひら位置の案内**: 「カメラから 40〜80cm・手を画面の中央に」（日英）。

### 6.2 ポップアップ

- 大きい1つのオン/オフ。状態行（段階・理由）。「つまみ調整 / Calibrate」「できること / What I can do」「設定 / Settings」。
- 失敗時は赤ではなく**アクセント色の警告枠**（ネオン調にしない）。診断ブロックのコピーボタン。
- オンの間だけ: 静止クリック・右クリックの入切、ドック位置。

### 6.3 失敗時の表示の最低条件

「段階」「例外名」「日本語の理由」「次の一手（具体）」「診断ブロック」の5点が**ポップアップに必ず出る**（B-failが文字列で確認）。ページ内ヒントにも同じ要約。

---

## 7. 機械検査の設計（受け入れ条件の核）

**事故の型**: 例外もエラーも出ないのに動かない。本拡張で予想される無言の故障を、検査が必ず拾う設計にする。

| 無言の故障 | 見え方 | 拾う検査 |
|---|---|---|
| 手の座標がタブへ届かない（Portが切れた・送信先がずれた） | カーソルが出ない／固まる | B-transport / B-swrestart |
| オーバーレイが操作を横取り（`pointer-events` 漏れ） | 何も押せない | B-overlay |
| タブ切替で押下が張り付く／別タブで暴発 | 勝手にクリックされる | B-tab |
| カメラが止まらない | 信用を失う | B-off |
| 失敗してもオーバーレイが残る | 次のページに残骸 | B-fail |
| SW/カメラ係が黙る | 最後の位置で固まる | B-heartbeat |
| 権限が増える／CDNコードが紛れる | 審査落ち・規約違反 | A-manifest / A-remote |
| 正本と拡張の複製がずれる | 修正が片方にしか効かない | A-sync |
| 設定がページのlocalStorageへ漏れる | サイトごとに設定・ページから読める | B-settings |
| 厳格CSP／Trusted Typesのサイトで層が出ない | 一部サイトだけ無反応 | B-csp |
| 映像・座標が外へ出る | プライバシー事故 | A-egress / B-egress |

### 7.1 検査スクリプトの構成（`scripts/verify-airtouch-extension.mjs`）

引数: `--phase 1|2|3`（既定1）／`--layer A|B|C`（既定 A,B）／`--inject`（故障注入）／`--shots DIR`。**実時間に依存しない**（時刻・フレームは検査から明示的に渡す）。

**Layer-A（ブラウザ不要・高速。正本変更時にも走らせる）**

| ID | 検査 |
|---|---|
| A-build | ビルドが成功し、2回ビルドして同一ハッシュ（決定的） |
| A-sync | 生成物のバナー sha256＝正本。本文が正本からの再生成結果と一致（手編集検出） |
| A-classic | `content.js` が `vm.Script` で構文検査を通る（`import`/`export` 残りなし）。連結順のTDZを避けた上で、`vm` 内で偽の `chrome`/`document` を渡して**読み込みが例外なく終わる** |
| A-remote | 配布物のJS/HTMLに外部URLリテラル・`eval`・`new Function`・`import(`（動的・外部）が無い（ライセンスコメントの許可リスト付き） |
| A-manifest | `permissions` が許可リストと**完全一致**／`host_permissions` 無し／`optional_host_permissions` が設計どおり／CSP に `wasm-unsafe-eval` があり `unsafe-eval` が無い／`web_accessible_resources` が空（または許可リストのみ）／version一致／**manifestが指す全ファイル（icons・html・script・_locales）が実在**（`sw.js`の事前キャッシュの教訓：無言で空になる）／`default_locale` の `_locales` 実在／ブラウザ別の必須キー（Firefox: `gecko.id`） |
| A-nofetch | background に `fetch` リスナー（`addEventListener('fetch'`）が無い |
| A-vendor | `vendor.lock.json` と同梱物のハッシュ一致／MediaPipe版が正本の `VISION_VERSION` と一致 |
| A-license | `THIRD_PARTY_LICENSES.txt` に MediaPipe・モデルの名称・版・ライセンス・入手元がある |
| A-protocol | `protocol.js` の検証が、NaN・Infinity・長さ違い・型違い・未知の `v`・巨大配列を**捨てる**。正常値は通す |
| A-i18n | 文言表の全キーが日英の両方を持つ。失敗理由の辞書が主要な例外名（`NotAllowedError` `NotFoundError` `NotReadableError` `OverconstrainedError` `AbortError` ほか）を網羅 |
| A-prod | 本番ビルドに検査フック（`__test_timeouts`・`fake-landmark-source`）が**無い**。テストビルドとのファイル差分が許可リストのみ |
| A-unsupported | `UNSUPPORTED_TARGETS` が §4.3 の一覧（file/select/color/date/time/iframe/embed/object）を網羅 |
| A-privacy | `PRIVACY.md` が存在し、保存・送信しない旨と権限ごとの用途を含む |

**Layer-B（Chromium実機E2E・合成ランドマーク）**

- 起動: `chromium.launchPersistentContext(tmpdir, { args: ['--headless=new', '--disable-extensions-except=<dist/chromium-test>', '--load-extension=<dist/chromium-test>', '--no-sandbox'] })`。
  **新しいヘッドレスが必要**（従来のheadless shellは拡張を読まない）。この環境のPlaywright版が拡張を読めるかは**要確認＝最初の試作で確かめる**。
- 拡張IDは SW の URL から取得。SW 等は `context.serviceWorkers()` / `context.backgroundPages()` で観測。
- 合成ランドマーク: テストビルドの `fake-landmark-source` が、検査から渡された**フレーム列**（`{lm, hd}` と時刻）を `hand` メッセージとして送る。
  検査は SW 経由で `test:script` メッセージを送ってフレームを流し込む（時間は検査が決める）。
- 標的ページ（ローカルHTTPサーバ）: ①通常（ボタンのクリック記録・縦スクロール枠・ドラッグ元と先） ②厳格CSP（`default-src 'none'; style-src 'self'`＋`require-trusted-types-for 'script'`） ③iframe入り ④`<input type=file>`入り ⑤`<dialog>`入り。

| ID | 検査（合格条件） |
|---|---|
| B-boot | 拡張が読み込まれ SW が起動。**起動直後のコンソールエラー・SW例外・CSP違反が0件**（content/SW/カメラ係を合算して数える。`pageerror`だけ見る検査は素通りする） |
| B-start | オンにすると、段階 `permission→library→model→camera→ready` が**順に**届き、`ready` で終わる。カメラ係の種類が offscreen |
| B-transport | 合成フレームを N 個流し、content が **seq の欠落なく**受信。`GestureEngine` へ渡った座標が元の値と誤差 ≦1e-4。送信から受信までの遅延（検査時計）の中央値・95%点が §1.3 以内 |
| B-cursor | 手を画面の指定正規化座標へ置くと、カーソルが `mapToScreen` の期待ピクセル±許容に位置する（ミラー込み） |
| B-click | つまむ→離す で、標的ボタンの `click` が **1回**記録され、`pointerdown/up` と `mousedown/up` の**両系**が来る。`isTrusted===false` を記録（限界の証拠として固定） |
| B-scroll | 開いた手のパンでスクロール枠の `scrollTop` が実際に変わる。ゆっくり→1:1、速い→増幅（`scrollGain`）を満たす |
| B-drag | ドラッグ&ドロップが標的へ届き、`drop` が1回記録される |
| B-hysteresis-link | 閾値の“間”で往復させても押下が連打されない（転送路を通しても正本の性質が保たれる＝連結で壊れていない） |
| B-overlay | `.airtouch-layer` の `getComputedStyle().pointerEvents==='none'`、かつカーソル位置で `document.elementFromPoint` が**ページの要素**（層ではない）を返す。`z-index` が最前面。ホバー用クラスが付く |
| B-lost | 手を `null` にすると押下が解除（`mouseup`/`pointerup` が出る）。250ms以上古いフレームも「見失い」として扱う |
| B-heartbeat | カメラ係のハートビートを止める（テストフック）と、3秒（テスト時は短縮）後に content が押下解除＋「応答なし」表示＋バッジ`×`。**再開すると復帰** |
| B-calib | 調整開始中の pointerdown が**0件**（クリックでなく押し始めを数える）。山が重なる合成データで閾値が**作られず理由が出る**。成功で `storage.local` に保存 |
| B-tab | タブ2を前面にすると、タブ1は `pause`（層非表示・押下解除）、タブ2が `resume`。**タブ1へは座標が届かない**（受信数が増えない）。タブ1へ戻ると復帰 |
| B-off | オフで ①層が DOM から消える ②カメラ係が `stopped` を返す（`track.readyState==='ended'`・`landmarker.close()` を確認するフック）③offscreen が閉じる ④バッジが消える |
| B-fail | 失敗注入（許可拒否 `NotAllowedError`／カメラ無し／`ready` を言わない／ライブラリ読込失敗）ごとに、①ポップアップに §6.3 の5点が出る ②層が残らない ③カメラ係が止まる ④再度オンにできる |
| B-stall | 進捗を止める→テスト用短縮時間で**段階名つきの失敗**になる（永久に待たない） |
| B-swrestart | SW を強制停止（CDP/`chrome.runtime` 経由）→ content と カメラ係が再接続し、ポインターが再開する。**再開しない場合は理由が出る**（無言で固まらない） |
| B-settings | 設定が `storage.local` にあり、**ページの `localStorage` に `airtouch:` キーが無い**。不正な保存値は既定へ落ちる。`storage` を例外化しても起動する |
| B-csp | 厳格CSP＋Trusted Types のページで、層が現れ、B-click/B-scroll が通る（C2/C3 の検査） |
| B-unsupported | iframe／`input[type=file]` の上でヒントが出て、クリックは**偽の成功にならない**（ヒントが出る）。制限ページ（`chrome://version` 等）では注入失敗が検知されバッジ`!`＋理由 |
| B-scope | 範囲「今のタブだけ」では、操作していないタブに content script が**注入されていない**。「全サイト」では権限許可後に新規タブへ入る |
| B-egress | 検査中の**全ネットワーク要求がローカル（検査サーバ・拡張オリジン）のみ**。外部0件。プロトコル外の型のメッセージ0件 |
| B-practice | `practice.html` で B-click/B-scroll/B-drag が通る（拡張内ページでも同じ経路） |

**Layer-C（偽カメラ実機・本番ビルドそのもの）** — 「テストビルドだけ緑」の穴を塞ぐ。

- `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`（映像は合成の縞模様）で**本番ビルド**を起動。
- 確かめるもの: C-chain=`getUserMedia`→MediaPipe(wasm)→推論が**例外・CSP違反なく動き**、ハートビートの `frames` が増え `fps ≧ 15`（offscreen内のタイマー間引きの検出）。
  `delegate` が GPU/CPU のどちらかで確定し、`ready` が来る。
- 縞模様に手は映らないので「手の座標」は出ない（`hand` は `null`）。**手が映る素材での確認は任意**：`--use-file-for-fake-video-capture=<手の動画>`。
  動画は深澤本人が自分の手を撮る（第三者の肖像・著作権の問題を避ける）。素材が無い間は手動チェックリスト（§8）で担保。
- 許可ダイアログの自動承認は `--use-fake-ui-for-media-stream`。**拒否の経路は Layer-B の注入で担保**（同フラグでは拒否を作れない）。

**手動チェックリスト（自動化できない部分。各フェーズの受け入れ条件に含める）**: §8。

### 7.2 テストビルドと本番ビルドの差（最小化）

差は ①`test/fake-landmark-source.js`（カメラ係の `hand-landmarker.js` の代役）②`test/test-hooks.js`（時間切れ短縮・状態公開・停止確認）③`test/pages/` のみ。
**差のファイル一覧を許可リストで固定**し（A-prod）、Layer-C が本番ビルドで実カメラ経路（偽デバイス）を通す。

### 7.3 故障注入（`--inject`）

検査自身の信頼のため、**ソースを書き換えた dist のコピーを読み込んで壊す**（検査側から内部関数を呼ぶ方式は空振りする＝既存知見）。
各注入は「置換が実際に当たったか」を確認し、当たらなければ**注入自体を ✗** にする（空振りの検出）。期待する ✗ が出なければ検査が不合格。

| # | 注入 | 期待する ✗ |
|---|---|---|
| I1 | オーバーレイの `pointer-events:none` を外す | B-overlay |
| I2 | `pause` で押下解除をしない | B-tab / B-lost |
| I3 | アクティブタブ限定をやめ全タブへ座標を送る | B-tab |
| I4 | `protocol.js` の有限性検証を外す | A-protocol |
| I5 | `permissions` に `tabs` を足す | A-manifest |
| I6 | manifest の icons が指す先を消す | A-manifest |
| I7 | content に CDN URL を混ぜる | A-remote |
| I8 | 生成物の正本コピーを1文字編集 | A-sync |
| I9 | ハートビート途絶の検知を外す | B-heartbeat |
| I10 | 失敗時の層削除をしない | B-fail |
| I11 | `track.stop()` を呼ばない | B-off |
| I12 | 設定の保存先をページの localStorage にする | B-settings |
| I13 | 進捗の時間切れを外す | B-stall |
| I14 | カーソル生成を `innerHTML` に戻す（Trusted Types） | B-csp |
| I15 | 古いフレームの破棄（250ms）を外す | B-lost |
| I16 | background に `fetch` リスナーを足す | A-nofetch |
| I17 | 本番ビルドにテストフックを混ぜる | A-prod |
| I18 | 外部へ `fetch` する（座標を送る想定）を足す | B-egress / A-remote |

### 7.4 `verify-gesture-pointer.mjs`（84項目）とのすみ分け

| | `verify-gesture-pointer.mjs`（既存） | `verify-airtouch-extension.mjs`（新設） |
|---|---|---|
| 守るもの | 判定の正しさ（手ぶれ取り・閾値・ヒステリシス・調整・タップ/スワイプ/ドラッグの作用）と**サイト組み込み**（CSP・importmap） | **転送・注入・ライフサイクル・権限・配布物**と、連結後に正本が動くこと |
| 推定層 | `__AIRTOUCH_SOURCE_FACTORY` で合成 | カメラ係＋RelaySource を通す合成／偽カメラ |
| 重複 | 閾値や判定の数値は**再検査しない**（二重管理になる） | B-hysteresis-link 等は「転送路を通しても性質が保たれる」の確認のみ |
| 追加が要るもの | C1の目印・`innerHTML` 不在・`STYLE` export の確認（3項目程度） | — |

正本が変わったら**両方**を通す（§4 対応表）。

### 7.5 登録（Verifier の責務・3箇所すべて）

1. `scripts/verify-airtouch-extension.mjs`・`scripts/build-extension.mjs`・`scripts/fetch-extension-vendor.mjs` の実体。
2. `.claude/agent-conventions.md` §4 対応表: 新しい行「`extension/`・`scripts/build-extension.mjs`」→ `node scripts/build-extension.mjs && node scripts/verify-airtouch-extension.mjs`、
   および `assets/js/gesture-pointer.js` の行を **`verify-gesture-pointer.mjs` と `verify-airtouch-extension.mjs --layer A`** に更新。
3. CLAUDE.md: ファイル構成に `extension/`、新節「エアタッチ ブラウザ拡張の必須チェック」を追加（本仕様の教訓を転記）。
   `harness-lint` 検査#14 が対応表のコマンド実在を機械確認するので、**スクリプトを置いてから**登録する。
4. 任意: `release-check` に Layer-A（高速）を組み込むか Verifier が判断。

---

## 8. 受け入れ条件（フェーズ別）

### フェーズ1: Chrome + Edge（Chromium系1本）

- [ ] `node scripts/build-extension.mjs` が成功（chromium と chromium-test）
- [ ] `node scripts/verify-airtouch-extension.mjs --phase 1` が緑（Layer A・B）
- [ ] `node scripts/verify-airtouch-extension.mjs --phase 1 --layer C` が緑（偽カメラで本番ビルドの推論経路・fps ≧ 15）
- [ ] `node scripts/verify-airtouch-extension.mjs --inject` で I1〜I18 の期待どおりの ✗ が出る（注入の空振り0）
- [ ] `node scripts/verify-gesture-pointer.mjs` が緑（正本の C1〜C3 変更後）／`node scripts/verify-zero1-mobile.mjs` が緑（サイト側の回帰なし）
- [ ] `bash .claude/skills/release-check/release-check.sh` が緑
- [ ] 手動（深澤または実機）: 実カメラで **Chrome と Edge の両方**
  - [ ] M1 初回: ウェルカム→許可（1回）→練習ページでタップ・スクロール・ドラッグができる
  - [ ] M2 別サイト2つ以上で**許可ダイアログが再度出ない**
  - [ ] M3 offscreen での推論が15fps以上・30分連続で落ちない・CPU使用が常識的
  - [ ] M4 オフでカメラのランプが消える
  - [ ] M5 `chrome://` / ストア / PDF でバッジ`!`と理由が出る
  - [ ] M6 厳格CSPの実サイト（例: 大手サイト数件）でカーソルが出る
  - [ ] M7 Alt+Shift+A で手が効かなくても確実にオフにできる
  - [ ] M8 「全サイト」の許可を後から取り消せる
- [ ] Legal-Checker（MediaPipe・モデルのライセンス・名称の商標）／Security／i18n／Asset-Guardian が通過
- [ ] Evaluator が Must 要件（F1〜F12）の実装を採点

### フェーズ2: Firefox

- [ ] フェーズ1の A 層が Firefox 向けビルドでも緑（`dist/firefox` の manifest 検査を含む）
- [ ] `web-ext lint`（`npx` で版固定・**開発時のみ**の道具）が警告0（またはリスト化した許容のみ）
- [ ] カメラ係（background event page）で許可→推論→座標が content へ届く（**要試作**。自動化手段が無ければ手動で担保）
- [ ] 手動: M1〜M8 を Firefox で実施（event page が落ちたときの再起動・許可の保持を重点確認）
- [ ] Firefox 自動E2E: **要試作**（Playwright は Firefox 拡張の読込に対応していない。候補＝WebDriver BiDi/geckodriver によるアドオンの一時インストール。成立しなければ純粋層の共有検査＋手動チェックリストで受け入れる。依存追加が要る場合は深澤へ判断を仰ぐ）

### フェーズ3: Safari（Mac のみ）

- [ ] **前提**: Mac と Xcode が使える（このクラウド環境＝Linuxではビルド・検査とも不可）。可否は §11 の試作で先に確定
- [ ] `xcrun safari-web-extension-converter extension/dist/safari …` で Xcode プロジェクト化し、ビルドでき、Safari の拡張機能一覧に現れて有効化できる
- [ ] 手動チェックリスト S1〜S10: S1 カメラ係（固定タブ/ウィンドウ）で getUserMedia が許可できる／S2 許可が保持される／S3 座標が content へ届く／S4 タップ・スクロール・ドラッグ／S5 制限ページの扱い／S6 オフでカメラが止まる／S7 Safari再起動後に常にオフ／S8 プライバシー表示（カメラ使用中の表示）／S9 `activeTab` 相当の権限ダイアログの文言／S10 Intel/Apple Silicon（実機があれば）
- [ ] 成立しない（Safari拡張ページで getUserMedia が使えない等）場合は**深澤へ報告して中止**（無理な迂回をしない）

---

## 9. 配布と費用（論点6）

| 配布先 | 費用 | 条件 | 出典（確認状況） |
|---|---|---|---|
| 開発者モードで読込（Chrome/Edge） | 無料 | リポジトリをビルドして `extension/dist/chromium` を読込。Chrome は起動のたびに開発者モード拡張の警告が出るなど常用には不便（要確認） | — |
| Chrome ウェブストア | **初回のみ約5ドル（要確認）** | 開発者登録。審査あり。権限ごとの用途説明・プライバシーポリシーURL・単一目的の説明が必要。**Edge ユーザーは Chrome ウェブストアの拡張を入れられる（要確認）ので、Edge専用掲載は後回しでもよい** | https://developer.chrome.com/docs/webstore/register （**この環境から到達不可・未確認**） |
| Edge Add-ons | 無料（要確認） | Microsoft パートナーセンター登録 | https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account （**到達不可・未確認**） |
| Firefox AMO | 無料（要確認） | 公開は審査あり。非公開（自己配布）でも署名は必要（要確認）。MV3 は `gecko.id` 必須 | https://extensionworkshop.com/documentation/publish/ （**到達不可・未確認**） |
| Safari（Mac） | **Apple Developer Program 年額 99ドル（確認済み）** | Xcode 変換が必要＝**Macでのビルド必須**。App Store 配布に加入が必要と理解しているが、公式ページの取得結果は Safari 拡張への適用を明示していない（**要確認**）。無料の個人チームでの手元実行・未署名拡張の許可は可能かもしれないが**要確認** | https://developer.apple.com/programs/whats-included/ （確認済み・年額 $99）／https://developer.apple.com/documentation/safariservices/converting-a-web-extension-for-safari （確認済み・Xcode＋macOS＋変換ツール） |

**課金の扱い（確定）**:
- **開発・検査・開発者モード読込は課金ゼロ**。ストアに出さない限り費用は発生しない。
- 課金が発生する操作（Chrome 登録 約5ドル／Apple 年額約99ドル）は、**実行前に Accounting-Agent が深澤へ通知し承認を取る**（`.claude/hooks/accounting-guard.sh`）。この仕様書は**課金の実行を指示しない**。
- 予算: 月次上限は ¥5,000（`accounting/budget.md`）。**約5ドルは範囲内の見込み、約99ドルは上限を超える見込み**（為替で変動。換算は Accounting が行う）。
  CLAUDE.md の「有料・従量課金サービス禁止」との整合も含め、**Safari の公開は深澤の明示的な例外承認が必要**（§13 未決1）。
- 無料で届ける代替: GitHub Releases に zip を置き開発者モード手順を書く（Chrome/Edge）／Firefox は署名のみ（AMO 非公開・無料の見込み・要確認）／Safari は無料の公開手段なし。

---

## 10. 出典と確認状況（正直な記録）

- 確認済み: Apple Developer Program は年額 $99（上記URL）。Safari への変換は Xcode・macOS・`safari-web-extension-converter` が必要（上記URL）。
- **未確認（作成環境から到達不可）**: developer.chrome.com（offscreen API・USER_MEDIA・MV3のCSP・ウェブストア手数料）、learn.microsoft.com（Edge Add-ons）、extensionworkshop.com（AMO）。
  本書の Chrome/Firefox/Edge に関する挙動・金額は設計者の理解であり、**実装前に Code-Generator／Verifier が公式ページで確認し、本書の「要確認」を潰す**こと。
- 同梱するライブラリの版は既存コードと同じ `@mediapipe/tasks-vision@1.0.1`（`assets/js/gesture-pointer.js` の `VISION_VERSION`）。モデルURLも既存 `MODEL_URL` と同じ。

---

## 11. リスクと未確認事項

| # | リスク／未確認 | 影響 | 扱い |
|---|---|---|---|
| R1 | **Safari 拡張ページで getUserMedia が使えるか・許可が保持されるか**・offscreen 相当が無い | フェーズ3が成立しない | **要確認・要試作**（Mac必須）。成立しなければ中止報告 |
| R2 | **offscreen 内で `getUserMedia` の許可が通るか**（ダイアログが出ない／先に見える拡張ページで取る必要） | 初回導線の設計 | 要試作。§2.2 の `permission.html` 先行取得が前提 |
| R3 | **offscreen（画面外ドキュメント）で rAF/タイマーが間引かれ推論が遅くなる** | fps低下・操作が重い | 要試作。`requestVideoFrameCallback`／MessageChannel でのスケジューリングを比較。Layer-C が fps を測る |
| R4 | offscreen の寿命制限（理由ごと）・同時に1つだけ・SWとの生存競合 | 長時間で黙って止まる | 要確認・要試作。ハートビートと再起動で救う（B-heartbeat・B-swrestart） |
| R5 | MV3のSW停止（約30秒アイドル）中の取りこぼし | 一瞬固まる | Port＋再接続。要試作で取りこぼし量を測る |
| R6 | GPU delegate が offscreen／Firefox の background で使えない | 遅い | 正本のCPUフォールバックを使う。delegate を診断に出す |
| R7 | MediaPipe の wasm/JS が CSP（`wasm-unsafe-eval`のみ）で動くか（`eval`系の有無） | 起動不能 | 要試作。CSP違反を検査が拾う |
| R8 | content script の `<style>` が厳格CSPで効かない／Trusted Types で `innerHTML` が例外 | 一部サイトで無反応 | C2/C3 で対処・B-csp。要試作 |
| R9 | 合成イベントで動かない部品（§4.3）の網羅 | 「壊れている」と思われる | 一覧化＋ヒント＋練習ページで明示。実機で追加収集 |
| R10 | Firefox: event page がアイドルで落ちる・許可ダイアログの出方・AMOのMV3必須項目（`data_collection_permissions` 等） | フェーズ2の設計 | 要確認・要試作 |
| R11 | ストア審査: カメラ＋全サイト権限は審査が厳しい／単一目的／リモートコード／プライバシー | 公開できない・遅延 | 既定をタブのみ・権限最小・同梱・PRIVACY.md。審査結果は**未知** |
| R12 | モデル・MediaPipe のライセンス表記 | 公開不可・規約違反 | Legal-Checker（要確認） |
| R13 | 名称「AirTouch」の商標 | 公開時の差し戻し | Legal-Checker で事前確認。代替名を用意 |
| R14 | 同梱物のサイズ（約25〜30MB見込み）と、リポジトリ容量（GitHub Pages公開上限1GB・現在約264MB） | 容量圧迫 | 要実測。コミットするか（§13 未決3）。**拡張は Pages で配信しない**が、リポジトリが Pages 公開対象なので `extension/vendor` が公開サイトに載る点も確認 |
| R15 | Playwright が拡張を読み込める版か・新ヘッドレスの可否 | 検査が書けない | 最初の試作で確認 |
| R16 | Firefox/Safari の自動E2Eが組めない | 手動依存が増える | 純粋層の共有と手動チェックリスト。成立しなければ明記 |
| R17 | カメラ使用中の表示（ブラウザ側のインジケータが offscreen で出るか） | 信頼性 | 要確認。拡張側のバッジ`ON`で補う |
| R18 | 複数ウィンドウ・複数モニタ・ズーム率・`devicePixelRatio` でのカーソル位置ずれ | 狙いが外れる | B-cursor にズーム変化を含める。実機で確認 |

---

## 12. 推定工数と引き渡し

| 区分 | 内容 | 規模 |
|---|---|---|
| 試作（先行・捨てコード可） | R1〜R4・R7・R8・R15 の確認（Chromium で offscreen 許可/推論 fps/CSP、Playwright の拡張読込）。**ここを先にやり、結果で本設計の「要試作」を確定** | 小〜中（半日〜1日） |
| フェーズ1 実装 | build・vendor取得・background・camera-host・content・popup/welcome/permission/practice・正本C1〜C3 | 大（2〜3日） |
| フェーズ1 検査 | Verifier: verify-airtouch-extension（A/B/C＋inject）・登録3箇所 | 大（1〜2日・実装と並行） |
| フェーズ2 | Firefox 差分・web-ext lint・手動確認 | 中（半日〜1日） |
| フェーズ3 | Mac で Safari 変換・成立確認・チェックリスト | 中〜大（1〜2日・**Mac前提**） |

**Graphic-Designer への発注**: ツールバー用アイコン PNG 16/32/48/128（拡張のマニフェストはPNG指定。`extension/icons/` へ。`assets/` 外なので `verify-asset-format` の対象外だが、容量は小さく保つ）。
モチーフ=指先のポインターとリング。黒背景に映えるシアン/パープル、**ネオングロウ過多・原色ネオンは禁止**。ストア用スクリーンショット（1280×800・実画面から）とプロモ画像（小）は実装後。
**Music-Generator**: 不要。

**次の担当**: 深澤の承認 → ①`verifier`（検査の設計・新設：§7）と ②`code-generator`（試作→実装）を**並行**。協調の契約は §3.2（プロトコル）と §7.1（テストビルドの口）。
Legal-Checker は同梱ライブラリ・名称の事前確認で早めに起動。Accounting は配布前に起動。

---

## 13. 深澤に決めてほしい未決事項

1. **配布するか・課金を承認するか**: 開発者モード読込だけなら無料で全フェーズ可能。Chrome ウェブストア約5ドル（要確認）を承認するか。**Safari は年約99ドル（確認済み）で月次上限¥5,000を超える**ため、例外承認か、Safari を非公開（Macで自分用）にとどめるか。
2. **ホスト権限の既定**: 「今のタブだけ」（審査に有利・遷移で途切れる）を既定にし、「全サイト」を任意にする案（推奨）でよいか。
3. **同梱物（約25〜30MB見込み）をリポジトリへコミットするか**、ビルド時に取得するか。コミットすると再現性・審査の面で楽だが容量が増える。
4. **正本 `assets/js/gesture-pointer.js` への最小変更 C1〜C3（C4はShould）の承認**（サイト側の挙動は変えない。変更後に verify-gesture-pointer と verify-zero1-mobile で回帰確認）。
5. **名称**: 「AirTouch」を名乗ってよいか（商標確認後。代替名の希望があれば）。
6. **手の動画**（Layer-C の任意の確認用）を深澤本人が撮影して提供するか。無ければ手動チェックリストで担保。
7. **開発専用ツールの例外**: Firefox の `web-ext lint`（`npx` で版固定・サイトには入れない）を使ってよいか。Firefox の自動E2Eに依存追加が要る場合は再度相談。
8. **ブラウザ操作ジェスチャ（タブ切替）を今回の範囲に入れるか**（既定は Could・既定OFF）。
9. **Mac の確保**: フェーズ3の実施時期（Mac が用意できるまで保留でよいか）。
