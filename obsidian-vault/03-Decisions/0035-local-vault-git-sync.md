---
type: decision
tags: [decision, second-brain, obsidian, git, infra]
date: 2026-09-10
status: accepted
related: [0001-second-brain-vault-structure, second-brain-system]
---

# 0035: ローカルObsidian保管庫（保管庫１）とはgit経由の双方向同期で連携する

## 背景・問題
深澤から「第二の脳は `C:\Users\hifuk\OneDrive\ドキュメント\オブシディアン` へ記録すること」、
続けて「以下の保管庫と連携してください: `...\オブシディアン\保管庫１`」という依頼を受けた。

Claude Code（クラウド版）は隔離されたLinuxコンテナで動作しており、深澤のWindows PCの
ファイルシステムには一切触れられない。最初の依頼には `obsidian-vault/` 全体をzipにまとめて
`SendUserFile` で渡す方法で暫定対応したが、これは**一方向・都度手動**であり、
「連携」（継続的な双方向同期）の要求には応えられていない。

## 決定
1. **正本は引き続き `obsidian-vault/`（このリポジトリ）**。ローカルの「保管庫１」は
   そのgit cloneのサブフォルダとして運用し、別物を作らない
2. **保管庫１の直下にサイト本体を丸ごとcloneしない**。`docs/クローンを軽くする.md` の
   軽量クローン手法（`--depth 1 --filter=blob:none --sparse`）を転用し、
   `sparse-checkout set obsidian-vault` で `obsidian-vault/` のみ展開する
   （サイト本体込みの通常cloneは1.3GBだが、この方式なら数百KB）
3. **ローカル→リモートの自動化はObsidian Gitプラグインに任せる**。Claude Code側から
   ユーザーのPCを操作する手段が無い以上、ローカル側のpull/push自動化はローカルのツールに
   委ねるほかない
4. 手順を `docs/obsidian-vault-git-sync.md` に文書化し、`obsidian-vault/README.md` から
   リンクする

## 理由
- **環境の物理的制約が起点**。クラウドのコンテナはユーザーのローカルファイルシステムに
  書けないため、「連携」を実現する唯一の経路はGitHub（gitリモート）を介する方法になる
- 既に `obsidian-vault/` はこのリポジトリでgit管理されており正本として機能しているため、
  ローカル側に別のデータストアを作るのではなく、**同じgitリポジトリの別チェックアウト**
  にする方が、正本が二重化しない
- 保管庫１はOneDrive配下にあるため、サイト本体（画像アセット多数）まで持ち込むと
  重量・OneDriveの同期負荷の両面で不利。`sparse-checkout` で `obsidian-vault/` だけに絞るのが
  既存の軽量クローン方針（0025系, `docs/クローンを軽くする.md`）と一貫する

## 影響・トレードオフ
- ローカルで書いてpushし忘れると、次回セッションの `second-brain-recall.sh` はその変更を
  拾えない（gitに乗っていない情報はセッションから見えない）。運用でカバーする
  （Obsidian Gitの自動push間隔を短めに設定）
- 双方向同期ゆえ、Claude Code側とローカル側が同じファイルの同じ行を同時に編集すると
  コンフリクトが起き得る。Markdownの追記が主体なので実運用上の頻度は低いと見込むが、
  発生時は手動解消が要る（手順書に明記）
- 保管庫１がOneDrive配下にあるため、gitの内部ファイル操作とOneDriveの同期エンジンが
  まれに競合する可能性がある（手順書に回避策を明記。頻発時はclone場所をOneDrive外へ）
