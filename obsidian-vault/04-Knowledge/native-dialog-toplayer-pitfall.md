---
type: knowledge
tags: [knowledge, dom, dialog, mobile-ui]
---

# ネイティブ`<dialog>`のトップレイヤーがposition:fixed要素を隠す

## 症状
`<dialog>`を`showModal()`で開くと、ブラウザは要素をDOM順・z-index無関係に
**トップレイヤー**（top layer）へ昇格させる。このとき生成される`::backdrop`
疑似要素も同じくトップレイヤーに乗るため、**通常のフロー内にある
`position:fixed`要素（z-indexをどれだけ高くしても）はdialog表示中は
完全に覆われ、クリック/タップが一切届かなくなる**。

実例（幕末風雲記, 2026-08-23）: スマホ向け「⛶ 全画面切替」ボタンを
`position:fixed`の独立要素として実装したところ、起動直後に開く
`<dialog id="start-dialog">`（シナリオ/勢力選択ウィザード）が表示されて
いる間、⛶ボタンが完全に押せなくなっていた。fsGate（タップ誘導オーバー
レイ）のテキストもbackdropの半透明部分から透けて見える表示崩れとして
現れた。

**気づきにくい理由**: 開発時にdialogをすぐ閉じて動作確認すると
（例: 勢力選択後にdialogが閉じてから⛶ボタンを触る）再現しない。
dialogが開いている**間だけ**再現するため、「ゲーム開始後は動く」という
実機報告だけでは原因が特定しづらい。

## 対処
`position:fixed`要素はDOM上の位置に関わらず視覚的な配置が変わらない
（fixed のcontaining blockは基本的にviewport）。これを利用し、**同じ
要素をdialogの子要素としてもう一つ複製**すれば、dialog表示中だけ
その複製がトップレイヤー内から操作可能になる（元の要素はdialog表示中
は自動的に非表示/操作不能のままでよく、閉じている間は元の要素だけが
見える）。

```html
<!-- 通常時用（body直下）-->
<button id="fsToggle" class="fs-toggle">⛶</button>
<dialog id="start-dialog">
  <!-- dialog表示中用（同じCSSクラスを複製）-->
  <button id="fsToggleDialog" class="fs-toggle">⛶</button>
  ...
</dialog>
```

JS側は`document.querySelectorAll('.fs-toggle')`でまとめて拾い、
`forEach`でイベントを配線すればよい（1つのidに依存しない）。

## 適用範囲の確認
サイト内の他ゲーム（sengoku.html / sanguo.html / taihei.html /
genpei.html）は`<dialog>`を使わず独自のdiv製モーダルで実装しているため
この問題の対象外（2026-08-23時点でgrep確認済み）。**新規ゲームで
`<dialog>`のshowModal/close`とposition:fixedの常駐UI（全画面ボタン・
ヘルプボタン等）を併用する場合にのみ注意すること**。

## 関連
- [[0027-chatgpt-proposal-phased-implementation]]
- リポジトリルートの `bakumatsu.html` / `bakumatsu.css`（実装箇所）
