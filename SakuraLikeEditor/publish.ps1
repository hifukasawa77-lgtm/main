param(
  [ValidateSet("win-x64")]
  [string]$Runtime = "win-x64",

  # Default is framework-dependent publish (works offline; requires .NET Desktop Runtime on target PC).
  [switch]$SelfContained = $false,
  [switch]$SingleFile = $false
)

$ErrorActionPreference = "Stop"

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
  $env:DOTNET_CLI_HOME = (Join-Path (Get-Location) "..\.dotnet_home")
  $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"

  $project = "SakuraLikeEditor.csproj"
  $outSubdir = "framework-dependent"
  if ($SelfContained)
  {
    $outSubdir = if ($SingleFile) { "$Runtime-selfcontained-singlefile" } else { "$Runtime-selfcontained" }
  }

  $outDir = Join-Path (Get-Location) ("publish\{0}" -f $outSubdir)

  $args = @(
    "publish", $project,
    "-c", "Release",
    "-o", $outDir,
    "--nologo",
    "-p:PublishTrimmed=false",
    "-p:DebugType=None",
    "-p:DebugSymbols=false"
  )

  if ($SelfContained)
  {
    $args += @("-r", $Runtime, "--self-contained", "true")
    if ($SingleFile) { $args += @("-p:PublishSingleFile=true", "-p:IncludeNativeLibrariesForSelfExtract=true") }
  }
  else
  {
    $args += @("--self-contained", "false")
  }

  dotnet @args

  Write-Host ""
  Write-Host ("OK: {0}" -f (Join-Path $outDir "SakuraLikeEditor.exe"))
}
finally {
  Pop-Location
}
