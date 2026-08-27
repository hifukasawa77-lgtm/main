# 必要なものだけを落とす軽量クローン / Slim clone for a tight C drive
#
# このリポジトリを普通に clone すると、assets（587MB）と全履歴のぶんで 1.3GB 以上になる。
# 実際に作業するのは一度に1〜2ゲームぶんなので、その分だけ落とす。
#
#   実測（2026-08-25）
#     ふつうの clone（浅い）        : 1.3 GB
#     このスクリプト（既定）        :  18 MB   ← ルートのHTML/JS/CSSだけ
#     + scripts/docs/gamekit/.claude:  20 MB
#     + assets/bakumatsu + maps     :  74 MB
#
# 仕組み:
#   --depth 1          過去の履歴を落とさない（旧PNGが履歴に残っているため効果が大きい）
#   --filter=blob:none ファイルの中身は「実際に取り出すぶんだけ」後から取る
#   --sparse           既定ではルート直下のファイルしか展開しない
#
# あとから足す:  git sparse-checkout add assets/sengoku
# いまの設定を見る: git sparse-checkout list
# 全部に戻す:    git sparse-checkout disable

param(
  [string]$Destination = "main",
  [string[]]$Include = @("scripts", "docs", "gamekit", ".claude"),
  [string]$RepoUrl = "https://github.com/hifukasawa77-lgtm/main.git"
)

$ErrorActionPreference = "Stop"

if (Test-Path -LiteralPath $Destination) {
  Write-Host "$Destination は既に存在します。別の場所を指定するか、先に削除してください。" -ForegroundColor Yellow
  exit 1
}

Write-Host "軽量クローンを作成します: $Destination" -ForegroundColor Cyan
git clone --depth 1 --filter=blob:none --sparse $RepoUrl $Destination
Set-Location -LiteralPath $Destination

if ($Include.Count -gt 0) {
  Write-Host "作業フォルダを追加します: $($Include -join ', ')" -ForegroundColor Cyan
  git sparse-checkout set $Include
}

$size = (Get-ChildItem -Recurse -Force -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ("完了。現在の大きさ: {0:N0} MB" -f $size) -ForegroundColor Green
Write-Host ""
Write-Host "ゲームのアセットが要るときは、そのぶんだけ足してください:" -ForegroundColor Cyan
Write-Host "  git sparse-checkout add assets/sengoku      # 戦国風雲記   153MB"
Write-Host "  git sparse-checkout add assets/genpei       # 源平         111MB"
Write-Host "  git sparse-checkout add assets/portraits    # 肖像         167MB"
Write-Host "  git sparse-checkout add assets/bakumatsu    # 幕末風雲記    22MB"
Write-Host ""
Write-Host "使い終わったら外せます:" -ForegroundColor Cyan
Write-Host "  git sparse-checkout set scripts docs gamekit .claude"
Write-Host ""
Write-Host ("作業するには: cd {0}" -f (Get-Location).Path) -ForegroundColor Cyan
