param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("firefox", "chrome")]
  [string]$Target,

  [string]$OutputName
)

$packageScript = Join-Path $PSScriptRoot "package-extension.js"
$nodeArgs = @($packageScript, $Target)

if (-not [string]::IsNullOrWhiteSpace($OutputName)) {
  $nodeArgs += @("--output-name", $OutputName)
}

& node @nodeArgs

if (-not $?) {
  exit $LASTEXITCODE
}
