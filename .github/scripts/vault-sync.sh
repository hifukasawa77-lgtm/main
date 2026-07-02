#!/bin/bash
# vault-sync.sh — obsidian-vault/ と専用Vaultリポジトリ（スマホObsidian用）の双方向同期
#
# 背景: 本リポジトリは packサイズ約800MiB あり、スマホの Obsidian Git プラグインは
#       クローン時のブランチ指定ができないため、リポジトリ全体をスマホへ渡せない。
#       そこで Vault の内容だけを持つ軽量な専用リポジトリを同期先として公開し、
#       スマホはそちらをクローンする（詳細: obsidian-vault/MOBILE-SETUP.md）。
#
# 同期の流れ（毎回この順で実行）:
#   1. 取込: Vaultリポジトリの sync-base タグ以降の差分（=スマホでの編集）を
#      main の obsidian-vault/ へ 3-way apply してコミット＆プッシュ
#   2. ミラー: CLAUDE.md 全文を obsidian-vault/04-Knowledge/claude-md-mirror.md へ再生成
#   3. 公開: main の obsidian-vault/ を Vaultリポジトリへ rsync してコミット＆プッシュ
#   4. sync-base タグを公開時点へ更新（次回取込の差分基準）
#
# 環境変数:
#   VAULT_URL      同期先リポジトリのURL（認証込み or file://。テスト用）
#   VAULT_REPO     owner/repo 形式（VAULT_URL 未指定時に TOKEN と組み合わせて使用）
#   TOKEN          VAULT_REPO 用のPAT（Contents: Read and write）
#   TARGET_BRANCH  同期元リポジトリのブランチ（既定: main）
#   FORCE_PUBLISH  1 で取込をスキップし main の内容で強制上書き公開（コンフリクト復旧用）
set -euo pipefail

TARGET_BRANCH="${TARGET_BRANCH:-main}"
PREFIX="obsidian-vault"
MIRROR="$PREFIX/04-Knowledge/claude-md-mirror.md"

if [ -z "${VAULT_URL:-}" ]; then
  if [ -z "${VAULT_REPO:-}" ] || [ -z "${TOKEN:-}" ]; then
    echo "VAULT_URL または VAULT_REPO+TOKEN が必要（未設定なら同期スキップ）"
    exit 0
  fi
  VAULT_URL="https://x-access-token:${TOKEN}@github.com/${VAULT_REPO}.git"
fi

git config user.name  "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if ! git ls-remote "$VAULT_URL" >/dev/null 2>&1; then
  echo "::warning::Vaultリポジトリにアクセスできない（未作成 or PAT権限不足）。手順: obsidian-vault/MOBILE-SETUP.md"
  exit 0
fi
REMOTE_MAIN=$(git ls-remote "$VAULT_URL" refs/heads/main | cut -f1 || true)
REMOTE_BASE=$(git ls-remote "$VAULT_URL" refs/tags/sync-base | cut -f1 || true)

# ---- 1. 取込（スマホ → main） -------------------------------------------------
PHONE_CHANGES=0
if [ "${FORCE_PUBLISH:-0}" = "1" ]; then
  echo "FORCE_PUBLISH=1: 取込をスキップし、main の内容で上書き公開する"
elif [ -n "$REMOTE_MAIN" ] && [ -n "$REMOTE_BASE" ] && [ "$REMOTE_MAIN" != "$REMOTE_BASE" ]; then
  git fetch --no-tags "$VAULT_URL" \
    "refs/heads/main:refs/vault/main" "refs/tags/sync-base:refs/vault/base"
  git diff --binary refs/vault/base refs/vault/main -- . ':!.obsidian' > /tmp/phone.patch
  if [ -s /tmp/phone.patch ]; then
    if ! git apply --directory="$PREFIX" --3way /tmp/phone.patch; then
      echo "::error::スマホ編集の取込がコンフリクト。main側の obsidian-vault/ を手で揃えるか、workflow_dispatch の force_publish で main の内容に強制統一する（スマホ編集は破棄）"
      exit 1
    fi
    PHONE_CHANGES=1
  fi
fi

# ---- 2. CLAUDE.md 全文ミラー再生成 --------------------------------------------
if [ -f CLAUDE.md ]; then
  mkdir -p "$(dirname "$MIRROR")"
  {
    printf -- '---\ntype: knowledge\ntags: [knowledge, claude-md, auto-generated]\n---\n\n'
    printf '# CLAUDE.md（全文ミラー）\n\n'
    printf '> ⚠️ 自動生成（.github/scripts/vault-sync.sh）。編集はリポジトリ直下の CLAUDE.md へ。このファイルへの編集は次回同期で上書きされる。\n\n'
    cat CLAUDE.md
  } > "$MIRROR"
fi

git add -A "$PREFIX"
if ! git diff --cached --quiet; then
  if [ "$PHONE_CHANGES" = "1" ]; then
    git commit -m "vault-sync: スマホ側の編集を取込（＋CLAUDE.mdミラー更新）"
  else
    git commit -m "vault-sync: CLAUDE.mdミラーを更新"
  fi
  git push origin "HEAD:$TARGET_BRANCH"
fi

# ---- 3. 公開（main → Vaultリポジトリ） ----------------------------------------
TMP=$(mktemp -d)
if [ -n "$REMOTE_MAIN" ]; then
  git clone --quiet --branch main "$VAULT_URL" "$TMP"
else
  git clone --quiet "$VAULT_URL" "$TMP"   # 空リポジトリ（初回）。警告は無害
fi
# main のVault内容で全置換（.git と端末ローカルの .obsidian は保護）
find "$TMP" -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.obsidian' -exec rm -rf {} +
cp -a "$PREFIX"/. "$TMP"/
rm -rf "$TMP/.obsidian"   # 万一コピーされた場合も端末ローカル設定は同期しない
git -C "$TMP" config user.name  "github-actions[bot]"
git -C "$TMP" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git -C "$TMP" add -A
if ! git -C "$TMP" diff --cached --quiet || ! git -C "$TMP" rev-parse HEAD >/dev/null 2>&1; then
  git -C "$TMP" commit -m "vault-sync: main から公開"
  git -C "$TMP" push origin HEAD:main
fi

# ---- 4. 同期基準タグ更新 -------------------------------------------------------
NEW_HEAD=$(git -C "$TMP" rev-parse HEAD 2>/dev/null || true)
if [ -n "$NEW_HEAD" ] && [ "$NEW_HEAD" != "$REMOTE_BASE" ]; then
  git -C "$TMP" tag -f sync-base
  git -C "$TMP" push -f origin refs/tags/sync-base
fi
rm -rf "$TMP"
echo "vault-sync: 完了（取込=$PHONE_CHANGES / 公開HEAD=${NEW_HEAD:-なし}）"
