param(
  [string]$OutputName
)

$packageScript = Join-Path $PSScriptRoot "package-extension.ps1"
& $packageScript -Target chrome -OutputName $OutputName
