---
type: decision
tags: [decision, self-improve, routine, pr-backlog, canvas]
date: 2026-10-04
status: accepted
related: [0035-self-improve-2026-09-27-promotions, verification-counts-the-wrong-thing]
---

# 0036: /self-improve 2回目の実運用（Routine全5本の成果物確認・新しい破損パターン修正・学び2件昇格）

## 背景
前回（2026-09-27、ADR 0035）の `/self-improve` が修正したRoutineの効果を1週間ぶりに確認する回。
PR #356（前回の自己改善PR）は2026-09-29にマージ済み。今回のセッションも `claude/self-improve` は
origin/mainへマージ済みのため、`git checkout -B claude/self-improve origin/main` で作り直した。

## 確認したこと

### 1. Routine全5本の成果物を実地確認（検査#15が全項目✓に到達）
- `/self-improve`・`/marketer-evolve`・`/site-proposal`・`/note-post` は前回の修正どおり正常に
  成果物（ローリングPR #359/#360、Issue #357）を出し続けている
- `/agent-evolve`（2026-09-30発火）は **新しい破損パターン** を発見・自己解決していた:
  固定ブランチ `claude/agent-evolve` が、2026-07-22時点の旧mainから分岐したまま2ヶ月放置された結果、
  **`origin/main` と共通祖先を持たない（unrelated histories）状態**になっていた
  （リポジトリ本体の履歴操作が原因。詳細な操作内容は未特定）。
  通常push・fast-forwardマージ不能、`force-with-lease`はauto-modeの破壊的git操作ガードに正しく拒否された。
  対処: 新ブランチ `claude/agent-evolve-2026-09-30` を `origin/main` から作り直し、新PR #363を起票し
  旧PR #272をクローズ（深澤判断）。**これは「PRが既にマージ済み」とは別の失敗モードであり、
  本セッションの冒頭ブランチ運用手順（merged済みなら作り直す）だけでは拾えない**
- 対処: CLAUDE.md「定期実行（Routine）一覧」の `/agent-evolve` 成果物欄を実際のブランチ名へ更新し、
  「原因2」として unrelated histories の発生と復旧手順を追記。`verify-routine-delivery.mjs` は
  CLAUDE.mdの表を単一ソースとして読むため、追加のコード変更は不要だった
- 検証: 修正前は agent-evolve のみ✗（旧ブランチ名を見ていたため）、修正後は5本全て✓

### 2. Vaultデータ破損を発見・修復
`obsidian-vault/01-Daily/2026-09-25.md` が、`claude/note-post` ブランチの別コミット（既存ファイルへの
追記のつもりで新規ファイルのつもりの内容を書き、frontmatterを二重に持つ形で追記）によって破損して
いた（main上で既に発生）。レシートOCRの記録の後ろに、無関係な「Routine診断」セクションが
重複frontmatter付きで連結されていた。単一frontmatル・見出し構造へ修復した。
**教訓**: 既存ファイルへ追記するセッションは、追記前にファイルの現在の構造（frontmatterの有無）を
確認すべき。今回は実害が軽微（表示上の破損のみ）だったため、内容を活かして統合する形で修復した

### 3. 未マージPRバックログの再点検（`/pr-backlog` スキル使用）
前回報告した6本中、PR #272（agent-evolve旧）はクローズ済み、PR #356（self-improve前回分）は
マージ済み。残り（PR #345/#332/#316/#347）は今回も未マージで滞留が進行（18〜82日）。
新たに4本（PR #359 marketer-evolve／#360 note-post／#361 context-saver／#363 agent-evolve）が
積まれ、いずれも健全（CI相当の自己検証済み・小粒）。

**新しい発見**: PR #359（marketer-evolve）の本文が、`marketing/post-log.json` が**完全に空**であることを
報告している。週次SNS自動投稿（GitHub Actions `Auto Social Post`）が一度も実投稿していない可能性があり、
Secretsの登録状況の確認が必要（`docs/social-setup.md`）。マーケティングの自己進化ループ自体は
正常に動いているが、**投稿が始まらなければ「反応を見て改善する」フェーズに永遠に入れない**

**新しい発見**: PR #271（ファミコンエミュレータ開発ラボ、Codexツール由来・82日滞留）は、
提案対象の `nes-emulator.html` が**既にmain上に別実装（27行・CSP強化済み）として存在**しており、
PR側の88行版（CSP無し）とは別物。本日（10-04）の `assets/nes/` 配下の新実装（本体風UI・NES/FDS実行
コア）も含め、PR #271の機能は既にmain側で独立に複数回実装・置き換えられている。**死蔵と判定**

## 決定
1. CLAUDE.md「定期実行（Routine）一覧」の `/agent-evolve` 成果物欄とunrelated histories対処手順を更新
2. 学び2件を昇格（下表）
3. Vault破損の修復（obsidian-vault/01-Daily/2026-09-25.md）
4. PRバックログの棚卸し結果を深澤へ報告（マージ・クローズは本セッションでは実施しない）

| 学び | 昇格先 |
|---|---|
| 固定ブランチがunrelated historiesになることがある。直し方は新ブランチで作り直し＋新PR＋旧PRクローズ | CLAUDE.md「定期実行（Routine）一覧」節 |
| Canvasの高さがDPR対応リサイズで複利膨張する（`canvas.height`属性を論理サイズとして読み戻すと壊れる） | `game-dev/SKILL.md`「Canvas API テクニック拡充」 |

## 影響・トレードオフ
- PR #271は死蔵と判定したが、クローズは深澤の承認後に行う（本ADRでは提案のみ）
- PR #345のADR番号0035〜0039は、前回（ADR 0035）と今回（ADR 0036）の両方と衝突が拡大している。
  マージ時の番号付け替えは依然未実施
