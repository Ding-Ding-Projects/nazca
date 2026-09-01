[CmdletBinding()]
param(
    [ValidateSet('Dependencies', 'Build', 'Bundle')]
    [string]$Mode = 'Build',
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$startedAt = Get-Date
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'dependency-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

function Write-Phase([string]$Message) {
    Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $Message)
}

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

if (-not $Silent) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdministrator) {
        Write-Phase 'Requesting elevation before any build work begins.'
        try {
            Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', $PSCommandPath,
                '-Mode', $Mode
            )
            exit 0
        }
        catch {
            throw "Elevation was declined before the build began: $($_.Exception.Message)"
        }
    }
}

function Resolve-Node {
    $minimum = [Version]$manifest.node.minimumVersion
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) {
        $rawVersion = (& $command.Source --version).Trim().TrimStart('v')
        if ([Version]$rawVersion -ge $minimum) {
            Write-Phase "Using Node.js $rawVersion at $($command.Source)."
            return Split-Path -Parent $command.Source
        }
        Write-Phase "Node.js $rawVersion is below the required $minimum."
    }

    $architecture = switch ($env:PROCESSOR_ARCHITECTURE.ToUpperInvariant()) {
        'AMD64' { 'x64' }
        'ARM64' { 'arm64' }
        default { throw "Unsupported Windows architecture: $env:PROCESSOR_ARCHITECTURE" }
    }
    $entry = $manifest.node.windows.$architecture
    $toolRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'NazcaRailway\toolchain'
    $downloadRoot = Join-Path $toolRoot 'downloads'
    $archive = Join-Path $downloadRoot $entry.file
    $nodeRoot = Join-Path $toolRoot ("node-v{0}-win-{1}" -f $manifest.node.version, $architecture)
    $nodeExecutable = Join-Path $nodeRoot 'node.exe'
    $source = "$($manifest.node.source)$($entry.file)"

    New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
    if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
        Write-Phase "Downloading Node.js $($manifest.node.version) from $source."
        Invoke-WebRequest -UseBasicParsing -Uri $source -OutFile $archive
    }
    $actualHash = Get-Sha256 $archive
    if ($actualHash -ne $entry.sha256) {
        throw "Node.js digest mismatch for $archive. Expected $($entry.sha256); received $actualHash."
    }
    Write-Phase "Verified Node.js archive SHA-256 $actualHash."

    if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf)) {
        $staging = Join-Path $toolRoot ("extract-{0}" -f [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $staging -Force | Out-Null
        try {
            Expand-Archive -LiteralPath $archive -DestinationPath $staging -Force
            $expanded = Join-Path $staging ("node-v{0}-win-{1}" -f $manifest.node.version, $architecture)
            if (-not (Test-Path -LiteralPath (Join-Path $expanded 'node.exe') -PathType Leaf)) {
                throw "The verified Node.js archive did not contain node.exe at $expanded."
            }
            if (Test-Path -LiteralPath $nodeRoot) {
                Remove-Item -LiteralPath $nodeRoot -Recurse -Force
            }
            Move-Item -LiteralPath $expanded -Destination $nodeRoot
        }
        finally {
            if (Test-Path -LiteralPath $staging) {
                Remove-Item -LiteralPath $staging -Recurse -Force
            }
        }
    }
    Write-Phase "Using portable Node.js at $nodeExecutable."
    return $nodeRoot
}

$nodeDirectory = Resolve-Node
$env:Path = "$nodeDirectory;$env:Path"
$npm = Join-Path $nodeDirectory 'npm.cmd'
if (-not (Test-Path -LiteralPath $npm -PathType Leaf)) {
    $npmCommand = Get-Command npm.cmd -ErrorAction Stop
    $npm = $npmCommand.Source
}

$lockfile = Join-Path $projectRoot 'package-lock.json'
$lockHash = Get-Sha256 $lockfile
$stamp = Join-Path $projectRoot 'node_modules\.nazca-package-lock.sha256'
$warm = (Test-Path -LiteralPath $stamp -PathType Leaf) -and
    ((Get-Content -LiteralPath $stamp -Raw).Trim() -eq $lockHash) -and
    (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\vinext\dist\cli.js') -PathType Leaf)

if ($warm) {
    Write-Phase "Reusing dependencies verified for package-lock SHA-256 $lockHash."
}
else {
    Write-Phase 'Installing exact package-lock dependencies with npm ci.'
    & $npm ci --audit=false
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci exited with code $LASTEXITCODE."
    }
    Set-Content -LiteralPath $stamp -Value $lockHash -Encoding Ascii
    Write-Phase "Recorded package-lock SHA-256 $lockHash."
    Write-Phase 'Checking production dependencies for high or critical advisories.'
    & $npm audit --omit=dev --audit-level=high
    if ($LASTEXITCODE -ne 0) {
        throw "The production dependency audit exited with code $LASTEXITCODE."
    }
}

if ($Mode -eq 'Dependencies') {
    Write-Phase 'Dependency acquisition completed.'
    Write-Phase ("Elapsed: {0}" -f ((Get-Date) - $startedAt))
    exit 0
}

if ($Mode -eq 'Build') {
    Write-Phase 'Building the Sites deployment candidate.'
    & $npm run build
}
else {
    Write-Phase 'Building the offline static website bundle.'
    & $npm run build:offline
    if ($LASTEXITCODE -eq 0) {
        & $npm run package:offline
    }
}
if ($LASTEXITCODE -ne 0) {
    throw "The $Mode operation exited with code $LASTEXITCODE."
}

Write-Phase ("$Mode completed successfully.")
Write-Phase ("Elapsed: {0}" -f ((Get-Date) - $startedAt))

if (-not $Silent -and $Mode -eq 'Build') {
    $answer = Read-Host 'Run the local preview now? [y/N]'
    if ($answer -match '^[Yy]') {
        & $npm run dev
        exit $LASTEXITCODE
    }
}
