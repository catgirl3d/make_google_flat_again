param(
  [string]$OutputName
)

$packageScript = Join-Path $PSScriptRoot "package-extension.ps1"
$packageArgs = @("-Target", "chrome")

if (-not [string]::IsNullOrWhiteSpace($OutputName)) {
  $packageArgs += @("-OutputName", $OutputName)
}

& $packageScript @packageArgs

if (-not $?) {
  exit $LASTEXITCODE
}
