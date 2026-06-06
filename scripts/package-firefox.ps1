param(
  [string]$OutputName
)

$packageScript = Join-Path $PSScriptRoot "package-extension.ps1"
& $packageScript -Target firefox -OutputName $OutputName
