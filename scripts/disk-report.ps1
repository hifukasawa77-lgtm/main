<#
disk-report.ps1 — Cドライブを圧迫しているものを、削除の安全度つきで一覧化する（読み取り専用）

このスクリプトは何も削除しません。測って、分類して、削除コマンドを「提示するだけ」です。
実行するかどうかは中身を見てから判断してください。

使い方:
    powershell -ExecutionPolicy Bypass -File scripts\disk-report.ps1
    powershell -ExecutionPolicy Bypass -File scripts\disk-report.ps1 -Root C:\Users\hifuk
    powershell -ExecutionPolicy Bypass -File scripts\disk-report.ps1 -Top 40

安全度:
  [安全]  キャッシュ・再取得できるもの。消してもやり直せる
  [注意]  再取得に時間や通信量がかかるもの（AIモデル等）。要否を自分で判断する
  [危険]  未コミット・未pushの作業が入っている可能性。消す前に必ず中を確認する
#>

param(
  [string]$Root = "$env:USERPROFILE",
  [int]$Top = 30
)

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

function Get-DirSize {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $sum = (Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
  if ($null -eq $sum) { return 0 } else { return $sum }
}

function Format-GB { param([double]$Bytes) return ("{0,8:N1} GB" -f ($Bytes / 1GB)) }

Write-Host ""
Write-Host "=== ディスク使用量レポート（読み取り専用・何も削除しません） ===" -ForegroundColor Cyan
Write-Host "対象: $Root"
Write-Host "（フォルダを実測するため数分かかります。何も削除しません）" -ForegroundColor DarkGray

$drive = Get-PSDrive -Name ($Root.Substring(0,1)) -ErrorAction SilentlyContinue
if ($drive) {
  Write-Host ("ドライブ空き: {0:N1} GB / 全体 {1:N1} GB" -f ($drive.Free/1GB), (($drive.Used + $drive.Free)/1GB)) -ForegroundColor Yellow
}
Write-Host ""

# ---------------------------------------------------------------------------
# 1. 既知の大物。場所と安全度が分かっているものを名指しで測る
# ---------------------------------------------------------------------------
$known = @(
  @{ Path = "$Root\.ollama\models";                       Level = "注意"; What = "Ollama のローカルLLM。ZERO-1の設定→モデル管理・厳選 から不要分を削除できる" }
  @{ Path = "$Root\.cache\huggingface";                   Level = "安全"; What = "HuggingFace のダウンロードキャッシュ。消しても必要時に再取得される" }
  @{ Path = "$Root\.cache\torch";                         Level = "安全"; What = "PyTorch のキャッシュ" }
  @{ Path = "$Root\AppData\Local\ms-playwright";          Level = "安全"; What = "Playwright のブラウザ実体。npx playwright install で戻せる" }
  @{ Path = "$Root\AppData\Local\npm-cache";              Level = "安全"; What = "npm キャッシュ。npm cache clean --force で消せる" }
  @{ Path = "$Root\AppData\Local\pip\Cache";              Level = "安全"; What = "pip キャッシュ。pip cache purge で消せる" }
  @{ Path = "$Root\AppData\Local\Temp";                   Level = "安全"; What = "一時ファイル。再起動後に消してよい" }
  @{ Path = "$Root\AppData\Local\Microsoft\Edge\User Data\Default\Cache"; Level = "安全"; What = "Edge のキャッシュ" }
  @{ Path = "$Root\AppData\Local\Google\Chrome\User Data\Default\Cache";  Level = "安全"; What = "Chrome のキャッシュ" }
  @{ Path = "$Root\AppData\Local\Docker";                 Level = "注意"; What = "Docker のデータ。使っていなければ大きい" }
  @{ Path = "$Root\Downloads";                            Level = "注意"; What = "ダウンロード。中身を見て判断" }
  @{ Path = "$Root\.nuget\packages";                      Level = "安全"; What = "NuGet パッケージキャッシュ" }
  @{ Path = "$Root\.gradle\caches";                       Level = "安全"; What = "Gradle キャッシュ" }
  @{ Path = "$Root\AppData\Local\Yarn\Cache";             Level = "安全"; What = "Yarn キャッシュ" }
)

Write-Host "--- 既知の大物 ---" -ForegroundColor Cyan
$rows = @()
foreach ($k in $known) {
  $size = Get-DirSize $k.Path
  if ($null -eq $size) { continue }
  if ($size -lt 100MB) { continue }
  $rows += [pscustomobject]@{ Size = $size; Level = $k.Level; Path = $k.Path; What = $k.What }
}
foreach ($r in ($rows | Sort-Object Size -Descending)) {
  $color = switch ($r.Level) { "安全" { "Green" } "注意" { "Yellow" } default { "Red" } }
  Write-Host ("{0}  [{1}]  {2}" -f (Format-GB $r.Size), $r.Level, $r.Path) -ForegroundColor $color
  Write-Host ("                    {0}" -f $r.What) -ForegroundColor DarkGray
}
if ($rows.Count -eq 0) { Write-Host "  100MB超の既知フォルダは見つかりませんでした" }

# ---------------------------------------------------------------------------
# 2. Ollama のモデル内訳
# ---------------------------------------------------------------------------
$ollamaBlobs = "$Root\.ollama\models\blobs"
if (Test-Path -LiteralPath $ollamaBlobs) {
  Write-Host ""
  Write-Host "--- Ollama のモデル（合計と、導入済み一覧） ---" -ForegroundColor Cyan
  Write-Host ("{0}  .ollama\models 合計" -f (Format-GB (Get-DirSize "$Root\.ollama\models")))
  $ollama = Get-Command ollama -ErrorAction SilentlyContinue
  if ($ollama) {
    Write-Host ""
    & ollama list
    Write-Host ""
    Write-Host "  ZERO-1 の 設定 → モデル管理・厳選 を開くと、役割ごとの担当と削除候補が出ます。" -ForegroundColor DarkGray
    Write-Host "  目標容量を選ぶと、超過分を自動で削除候補にします（役割が空になる削除はしません）。" -ForegroundColor DarkGray
  } else {
    Write-Host "  ollama コマンドが見つかりません（PATHが通っていない可能性）" -ForegroundColor DarkGray
  }
}

# ---------------------------------------------------------------------------
# 3. node_modules / venv / __pycache__ — 再生成できるもの
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- 再生成できるフォルダ（node_modules / venv） ---" -ForegroundColor Cyan
# 170GB を丸ごと再帰すると何十分もかかる。AppData を除き、深さを6段までに絞る
# （プロジェクトはユーザー直下から数段以内に置かれているのが普通）。
$regen = Get-ChildItem -LiteralPath $Root -Recurse -Depth 6 -Force -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\AppData\\" } |
  Where-Object { $_.Name -in @("node_modules", ".venv", "venv", "__pycache__", ".next", "dist", "target") } |
  Where-Object { $_.FullName -notmatch "\\node_modules\\.*\\node_modules" }
$regenRows = @()
foreach ($d in $regen) {
  $size = Get-DirSize $d.FullName
  if ($size -ge 100MB) { $regenRows += [pscustomobject]@{ Size = $size; Path = $d.FullName } }
}
$regenTotal = ($regenRows | Measure-Object -Property Size -Sum).Sum
foreach ($r in ($regenRows | Sort-Object Size -Descending | Select-Object -First $Top)) {
  Write-Host ("{0}  [安全]  {1}" -f (Format-GB $r.Size), $r.Path) -ForegroundColor Green
}
if ($regenRows.Count -gt 0) {
  Write-Host ("  合計 {0}（npm install / pip install で戻せます）" -f (Format-GB $regenTotal)) -ForegroundColor DarkGray
} else {
  Write-Host "  100MB超のものはありませんでした"
}

# ---------------------------------------------------------------------------
# 4. gitリポジトリ — 消す前に「失われる作業」が無いか必ず確認する
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- gitリポジトリ（消す前の安全確認つき） ---" -ForegroundColor Cyan
$repos = Get-ChildItem -LiteralPath $Root -Recurse -Depth 6 -Force -Directory -Filter ".git" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\node_modules\\" } |
  Where-Object { $_.FullName -notmatch "\\AppData\\" }

foreach ($g in $repos) {
  $repo = Split-Path -Parent $g.FullName
  $size = Get-DirSize $repo
  if ($size -lt 50MB) { continue }

  Push-Location -LiteralPath $repo
  $dirty     = (& git status --porcelain 2>$null)
  $unpushed  = (& git log --branches --not --remotes --oneline 2>$null)
  $stash     = (& git stash list 2>$null)
  $remote    = (& git remote get-url origin 2>$null)
  Pop-Location

  $dirtyLines    = @($dirty)    | Where-Object { $_ -and $_.Trim() }
  $unpushedLines = @($unpushed) | Where-Object { $_ -and $_.Trim() }

  $risk = @()
  if ($dirtyLines.Count    -gt 0) { $risk += ("未コミットの変更 {0} 件" -f $dirtyLines.Count) }
  if ($unpushedLines.Count -gt 0) { $risk += ("未pushのコミット {0} 件" -f $unpushedLines.Count) }
  if ($stash)       { $risk += "stash あり" }
  if (-not $remote) { $risk += "リモート未設定（pushされていない）" }

  if ($risk.Count -gt 0) {
    Write-Host ("{0}  [危険]  {1}" -f (Format-GB $size), $repo) -ForegroundColor Red
    Write-Host ("                    消すと失われます: {0}" -f ($risk -join " / ")) -ForegroundColor Red
    if ($dirtyLines.Count -gt 0) {
      Write-Host "                    内訳（先頭10件）:" -ForegroundColor DarkGray
      $dirtyLines | Select-Object -First 10 | ForEach-Object {
        Write-Host ("                      {0}" -f $_) -ForegroundColor DarkGray
      }
    }
  } else {
    Write-Host ("{0}  [安全]  {1}" -f (Format-GB $size), $repo) -ForegroundColor Green
    Write-Host ("                    全てpush済み。消しても clone し直せます（{0}）" -f $remote) -ForegroundColor DarkGray
  }
}

# ---------------------------------------------------------------------------
# 5. その他の大物（上位フォルダ）
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- $Root 直下の大きいフォルダ ---" -ForegroundColor Cyan
$tops = @()
foreach ($d in (Get-ChildItem -LiteralPath $Root -Force -Directory -ErrorAction SilentlyContinue)) {
  $size = Get-DirSize $d.FullName
  if ($size -ge 1GB) { $tops += [pscustomobject]@{ Size = $size; Path = $d.FullName } }
}
foreach ($t in ($tops | Sort-Object Size -Descending | Select-Object -First $Top)) {
  Write-Host ("{0}  {1}" -f (Format-GB $t.Size), $t.Path)
}

Write-Host ""
Write-Host "=== ここまで測っただけです。削除は行っていません ===" -ForegroundColor Cyan
Write-Host "次の順で判断してください:" -ForegroundColor Cyan
Write-Host "  1. [危険] と出た git リポジトリは、まず中の作業を push する（消すのはそのあと）"
Write-Host "  2. [安全] のキャッシュ類から消す。やり直しが効きます"
Write-Host "  3. Ollama のモデルは ZERO-1 の モデル管理・厳選 で削除候補を見てから"
Write-Host "  4. 画像・音楽・動画生成のモデル（ComfyUI/Stable Diffusion 等）は、使っていないものを1つずつ"
Write-Host ""
Write-Host "リポジトリを消したあと、必要になったら軽量クローンで取り直せます:" -ForegroundColor Cyan
Write-Host "  docs\クローンを軽くする.md（1.3GB → 18MB）"
