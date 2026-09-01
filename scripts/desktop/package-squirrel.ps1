[CmdletBinding()]
param(
  [switch]$Silent,
  [string]$Output
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Error 'Node.js is required to create the desktop package. Run the repository dependency bootstrap first.'
  exit 1
}

$arguments = @((Join-Path $repositoryRoot 'scripts/desktop/package-squirrel.mjs'))
if ($Output) { $arguments += @('--output', $Output) }
if ($Silent) { $arguments += '--silent' }

& $node @arguments
exit $LASTEXITCODE
