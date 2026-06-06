param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("firefox", "chrome")]
  [string]$Target,

  [string]$OutputName
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetsPath = Join-Path $projectRoot "assets"
$srcPath = Join-Path $projectRoot "src"
$manifestBuilderPath = Join-Path $projectRoot "scripts\build-manifest.js"
$manifestsPath = Join-Path $projectRoot "manifests"
$distDir = Join-Path $projectRoot "dist"
$stageDir = Join-Path $distDir "$Target-package"
$archiveTempPath = Join-Path $distDir "$Target-package.zip"

foreach ($requiredPath in @($assetsPath, $srcPath, $manifestBuilderPath, $manifestsPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Missing required path: $requiredPath"
  }
}

if (Test-Path -LiteralPath $stageDir) {
  Remove-Item -LiteralPath $stageDir -Recurse -Force
}

if (Test-Path -LiteralPath $archiveTempPath) {
  Remove-Item -LiteralPath $archiveTempPath -Force
}

New-Item -ItemType Directory -Path $distDir -Force | Out-Null
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

Copy-Item -LiteralPath $assetsPath -Destination $stageDir -Recurse -Force
Copy-Item -LiteralPath $srcPath -Destination $stageDir -Recurse -Force

& node $manifestBuilderPath $Target $stageDir

if (-not $?) {
  throw "Manifest build failed for target '$Target'."
}

if ($Target -eq "firefox") {
  $chromePlatformPath = Join-Path $stageDir "src\platform\chrome"
  $chromeBackgroundPath = Join-Path $stageDir "src\background\background-chrome.js"

  if (Test-Path -LiteralPath $chromePlatformPath) {
    Remove-Item -LiteralPath $chromePlatformPath -Recurse -Force
  }

  if (Test-Path -LiteralPath $chromeBackgroundPath) {
    Remove-Item -LiteralPath $chromeBackgroundPath -Force
  }
}

if ($Target -eq "chrome") {
  $firefoxPlatformPath = Join-Path $stageDir "src\platform\firefox"

  if (Test-Path -LiteralPath $firefoxPlatformPath) {
    Remove-Item -LiteralPath $firefoxPlatformPath -Recurse -Force
  }
}

$manifestPath = Join-Path $stageDir "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($OutputName)) {
  if ($Target -eq "firefox") {
    $OutputName = "make-google-flat-again-$($manifest.version)-firefox.xpi"
  } else {
    $OutputName = "make-google-flat-again-$($manifest.version)-chrome.zip"
  }
}

if ($Target -eq "firefox" -and -not $OutputName.EndsWith(".xpi")) {
  $OutputName = "$OutputName.xpi"
}

if ($Target -eq "chrome" -and -not $OutputName.EndsWith(".zip")) {
  $OutputName = "$OutputName.zip"
}

$outputPath = Join-Path $distDir $OutputName

if (Test-Path -LiteralPath $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $archiveTempPath -CompressionLevel Optimal
Move-Item -LiteralPath $archiveTempPath -Destination $outputPath -Force

"Built $Target package: $outputPath"
"Staged extension payload: $stageDir"
