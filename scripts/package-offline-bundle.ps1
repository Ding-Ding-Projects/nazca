[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$outputRoot = Join-Path $projectRoot 'outputs'
$stagingRoot = Join-Path $projectRoot 'work\offline-bundle'
$clientRoot = Join-Path $projectRoot 'dist\client'
$archive = Join-Path $outputRoot ("nazca-railway-static-{0}.zip" -f $packageJson.version)

function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try {
        $algorithm = [Security.Cryptography.SHA256]::Create()
        try {
            return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        }
        finally {
            $algorithm.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $clientRoot -PathType Container)) {
    throw "Static output is missing at $clientRoot. Run npm run build:offline first."
}

if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
Copy-Item -Path (Join-Path $clientRoot '*') -Destination $stagingRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'offline-server.mjs') -Destination (Join-Path $stagingRoot 'offline-server.mjs')

@'
@echo off
setlocal
where node >nul 2>nul || (
  echo Node.js 22.13.0 or newer is required to serve this static bundle.
  exit /b 1
)
start "" http://127.0.0.1:4173/
node "%~dp0offline-server.mjs"
'@ | Set-Content -LiteralPath (Join-Path $stagingRoot 'start.bat') -Encoding Ascii

@'
# Nazca Railway static website bundle

This archive is an offline static website bundle, not a native installer.

Run `start.bat` on Windows with Node.js 22.13.0 or newer. The server binds only to
`127.0.0.1:4173`. Stop it with Ctrl+C in the terminal.
'@ | Set-Content -LiteralPath (Join-Path $stagingRoot 'README.md') -Encoding UTF8

if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
}
Compress-Archive -Path (Join-Path $stagingRoot '*') -DestinationPath $archive -CompressionLevel Optimal
$hash = Get-Sha256 $archive
$size = (Get-Item -LiteralPath $archive).Length
Write-Host "Static website bundle: $archive"
Write-Host "Bytes: $size"
Write-Host "SHA-256: $hash"
