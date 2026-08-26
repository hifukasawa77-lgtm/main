<#
find-genai-models.ps1 — 画像・動画・音楽生成AIのモデルを見つけて容量を出す

既定では**報告のみ**で、何も削除しません。削除するには -Delete を明示し、
さらに確認の入力が必要です。

使い方:
    powershell -ExecutionPolicy Bypass -File scripts\find-genai-models.ps1
    powershell -ExecutionPolicy Bypass -File scripts\find-genai-models.ps1 -Root D:\
    powershell -ExecutionPolicy Bypass -File scripts\find-genai-models.ps1 -Delete

対象: Stable Diffusion / FLUX / ComfyUI / A1111 / diffusers など、
      画像・動画生成の重みファイル（.safetensors / .ckpt / .pth / .bin）。

      音楽生成（ACE-Step / MusicGen 等）は既定では対象外。要否が画像・動画とは別なので、
      消す場合は -IncludeAudio を明示すること。

対象外（誤って消さないための除外）:
  * ~\.ollama            … ローカルLLM。ZERO-1 の モデル管理・厳選 から個別に消すこと
  * 拡張子 .gguf         … llama.cpp / Ollama 系の重み
  * gitリポジトリの中身  … 作業物が混ざるため触らない
#>

param(
  [string[]]$Root = @("$env:USERPROFILE", "C:\", "D:\"),
  [int]$MinSizeMB = 200,
  [switch]$Delete,
  # 音楽生成（ACE-Step / MusicGen 等）も対象に含める。既定では含めない
  [switch]$IncludeAudio
)

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

# 画像・動画生成のモデル置き場と分かる名前
$GENAI_DIR = '(ComfyUI|stable-diffusion|stable_diffusion|sd-webui|automatic1111|a1111|InvokeAI|Fooocus|AnimateDiff|LTX|Wan2|diffusers)'
# 音楽生成。-IncludeAudio を付けたときだけ対象にする（画像・動画とは要否が別のため）
$AUDIO_DIR = '(ACE-Step|ace_step|MusicGen|AudioCraft|audiocraft|bark|riffusion)'
# その中でも重みが置かれるフォルダ
$WEIGHT_DIR = '(checkpoints|unet|vae|clip|clip_vision|loras|controlnet|upscale_models|embeddings|Stable-diffusion|models--)'
$WEIGHT_EXT = @('.safetensors', '.ckpt', '.pth', '.bin')

# 触らないもの
$EXCLUDE = '(\\\.ollama\\|\\\.git\\|\\node_modules\\|\\Windows\\|\\Program Files)'

function Format-GB { param([double]$Bytes) return ("{0,8:N1} GB" -f ($Bytes / 1GB)) }

Write-Host ""
$scope = if ($IncludeAudio) { "画像・動画・音楽" } else { "画像・動画" }
Write-Host ("=== {0}生成モデルの調査 ===" -f $scope) -ForegroundColor Cyan
if ($Delete) {
  Write-Host "モード: 削除（確認あり）" -ForegroundColor Red
} else {
  Write-Host "モード: 報告のみ（何も削除しません）" -ForegroundColor Green
}
Write-Host "（ドライブを走査するため数分かかります）" -ForegroundColor DarkGray
Write-Host ""

$hits = @()
foreach ($r in $Root) {
  if (-not (Test-Path -LiteralPath $r)) { continue }
  Write-Host "走査中: $r" -ForegroundColor DarkGray

  Get-ChildItem -LiteralPath $r -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Length -ge ($MinSizeMB * 1MB) -and
      $WEIGHT_EXT -contains $_.Extension.ToLower() -and
      $_.FullName -notmatch $EXCLUDE -and
      ($_.FullName -match $GENAI_DIR -or ($IncludeAudio -and $_.FullName -match $AUDIO_DIR) -or $_.DirectoryName -match $WEIGHT_DIR)
    } |
    ForEach-Object { $hits += $_ }
}

if ($hits.Count -eq 0) {
  Write-Host ""
  Write-Host "  該当するモデルファイルは見つかりませんでした。" -ForegroundColor Yellow
  Write-Host "  別のドライブにある場合は -Root で指定してください（例: -Root E:\）"
  if (-not $IncludeAudio) { Write-Host "  音楽生成（ACE-Step / MusicGen）も消す場合は -IncludeAudio を付けてください" -ForegroundColor DarkGray }
  exit 0
}

# フォルダ単位で集計する（1つずつ消すより、置き場ごと判断するほうが早い）
$byDir = $hits | Group-Object DirectoryName | Sort-Object { ($_.Group | Measure-Object Length -Sum).Sum } -Descending

$total = ($hits | Measure-Object -Property Length -Sum).Sum
Write-Host ""
Write-Host ("合計 {0}  ({1} ファイル / {2} フォルダ)" -f (Format-GB $total), $hits.Count, $byDir.Count) -ForegroundColor Yellow
Write-Host ""

foreach ($g in $byDir) {
  $dirSize = ($g.Group | Measure-Object Length -Sum).Sum
  Write-Host ("{0}  {1}" -f (Format-GB $dirSize), $g.Name) -ForegroundColor Cyan
  foreach ($f in ($g.Group | Sort-Object Length -Descending | Select-Object -First 8)) {
    Write-Host ("          {0,8:N1} GB  {1}" -f ($f.Length / 1GB), $f.Name) -ForegroundColor DarkGray
  }
  if ($g.Group.Count -gt 8) { Write-Host ("          … 他 {0} ファイル" -f ($g.Group.Count - 8)) -ForegroundColor DarkGray }
}

Write-Host ""
if (-not $Delete) {
  Write-Host "削除するには、上の一覧を確認したうえで -Delete を付けて再実行してください:" -ForegroundColor Cyan
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\find-genai-models.ps1 -Delete"
  Write-Host ""
  Write-Host "フォルダごと消す場合は、中身を見てから手で:" -ForegroundColor Cyan
  foreach ($g in ($byDir | Select-Object -First 3)) {
    Write-Host ("  Remove-Item -Recurse -Force `"{0}`"" -f $g.Name)
  }
  exit 0
}

Write-Host ("これから {0} 分のモデルファイルを削除します。元に戻せません。" -f (Format-GB $total)) -ForegroundColor Red
Write-Host "続けるには DELETE と入力してください（それ以外は中止）:" -ForegroundColor Red
$answer = Read-Host
if ($answer -ne "DELETE") {
  Write-Host "中止しました。何も削除していません。" -ForegroundColor Green
  exit 0
}

$freed = 0
foreach ($f in $hits) {
  try {
    $size = $f.Length
    Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
    $freed += $size
    Write-Host ("  削除: {0,8:N1} GB  {1}" -f ($size / 1GB), $f.FullName) -ForegroundColor DarkGray
  } catch {
    Write-Host ("  削除できず: {0}  ({1})" -f $f.FullName, $_.Exception.Message) -ForegroundColor Yellow
  }
}
Write-Host ""
Write-Host ("解放しました: {0}" -f (Format-GB $freed)) -ForegroundColor Green
Write-Host "空になったフォルダやアプリ本体（ComfyUI 等）は、必要なら手で削除してください。" -ForegroundColor DarkGray
