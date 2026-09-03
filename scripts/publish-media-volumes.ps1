[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,
  [string]$Repository = 'Ding-Ding-Projects/nazca',
  [string]$JournalPath = '',
  [switch]$Publish
)

$ErrorActionPreference = 'Stop'
$MaxAssetsPerRelease = 1000
$SupportedMime = @('image/png', 'image/jpeg', 'image/gif', 'image/webp')

function Fail([string]$Message) {
  throw "Media publication refused: $Message"
}

function Invoke-GhJson([string[]]$Arguments) {
  $output = & gh @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail ("gh " + ($Arguments -join ' ') + " returned exit code ${LASTEXITCODE}: " + ($output -join "`n"))
  }
  if (-not $output) {
    Fail ("gh " + ($Arguments -join ' ') + ' returned no JSON.')
  }
  return (($output -join "`n") | ConvertFrom-Json)
}

function Invoke-RegistryValidation([string]$Path, [string]$ExpectedRepository) {
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $nodeCommand) {
    Fail 'node.exe is required for the shared media registry validator.'
  }
  $validatorPath = Join-Path $PSScriptRoot 'validate-media-release-registry.mts'
  if (-not (Test-Path -LiteralPath $validatorPath -PathType Leaf)) {
    Fail "shared media registry validator '$validatorPath' does not exist."
  }
  $output = & $nodeCommand.Source --experimental-strip-types $validatorPath $Path $ExpectedRepository 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail ('shared media registry validation failed: ' + ($output -join "`n"))
  }
  $output | Write-Output
}

function Get-Header([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $buffer = [byte[]]::new(16)
    $read = $stream.Read($buffer, 0, $buffer.Length)
    return $buffer[0..($read - 1)]
  } finally {
    $stream.Dispose()
  }
}

function Detect-Mime([byte[]]$Header) {
  if ($Header.Length -ge 8 -and $Header[0] -eq 0x89 -and $Header[1] -eq 0x50 -and $Header[2] -eq 0x4e -and $Header[3] -eq 0x47 -and $Header[4] -eq 0x0d -and $Header[5] -eq 0x0a -and $Header[6] -eq 0x1a -and $Header[7] -eq 0x0a) { return 'image/png' }
  if ($Header.Length -ge 3 -and $Header[0] -eq 0xff -and $Header[1] -eq 0xd8 -and $Header[2] -eq 0xff) { return 'image/jpeg' }
  if ($Header.Length -ge 6 -and [Text.Encoding]::ASCII.GetString($Header[0..5]) -in @('GIF87a', 'GIF89a')) { return 'image/gif' }
  if ($Header.Length -ge 12 -and [Text.Encoding]::ASCII.GetString($Header[0..3]) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($Header[8..11]) -eq 'WEBP') { return 'image/webp' }
  return $null
}

function Assert-SafeAssetName([string]$Name) {
  if ([string]::IsNullOrWhiteSpace($Name) -or $Name.Length -gt 127 -or $Name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$' -or $Name.Contains('..')) {
    Fail "unsafe release asset filename '$Name'"
  }
}

function Resolve-SafeChildPath([string]$Root, [string]$Name) {
  Assert-SafeAssetName $Name
  $fullRoot = [System.IO.Path]::GetFullPath($Root)
  $fullRoot = $fullRoot.TrimEnd([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar))
  if ($fullRoot.Length -eq 2 -and $fullRoot[1] -eq ':') {
    $fullRoot += [System.IO.Path]::DirectorySeparatorChar
  }
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $fullRoot $Name))
  $prefix = $fullRoot + [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    Fail "asset '$Name' escapes the source directory."
  }
  return $fullPath
}

function Get-ChecksumEntries([string]$Path, [object[]]$Assets, [string]$Tag) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Fail "checksums file for volume '$Tag' is missing: '$Path'."
  }
  $lines = @(Get-Content -LiteralPath $Path)
  $entries = @{}
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
      continue
    }
    $parts = @($trimmed -split '\s+')
    if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[a-f0-9]{64}$') {
      Fail "checksums file '$Path' has a malformed line. Expected '<sha256> <filename>'."
    }
    $name = [string]$parts[1]
    Assert-SafeAssetName $name
    if ($entries.ContainsKey($name)) {
      Fail "checksums file '$Path' repeats asset '$name'."
    }
    $entries[$name] = [string]$parts[0]
  }
  if ($entries.Count -ne @($Assets).Count) {
    Fail "checksums file '$Path' contains $($entries.Count) entries for $(@($Assets).Count) image assets."
  }
  foreach ($asset in @($Assets)) {
    $name = [string]$asset.releaseAssetName
    if (-not $entries.ContainsKey($name)) {
      Fail "checksums file '$Path' does not contain asset '$name'."
    }
    if ([string]$entries[$name] -ne [string]$asset.expectedSha256) {
      Fail "checksums file '$Path' has a digest mismatch for asset '$name'."
    }
  }
  return $entries
}

function Test-LocalVolume([object]$Volume, [string]$SourceRoot) {
  $tag = [string]$Volume.releaseTag
  $checksumName = [string]$Volume.checksumsFile
  $checksumPath = Resolve-SafeChildPath $SourceRoot $checksumName
  if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
    Fail "checksums file for volume '$tag' is missing."
  }
  $checksumDigest = (Get-FileHash -Algorithm SHA256 -LiteralPath $checksumPath).Hash.ToLowerInvariant()
  if ($checksumDigest -ne [string]$Volume.manifestSha256) {
    Fail "checksums file '$checksumName' has digest '$checksumDigest', expected manifestSha256 '$($Volume.manifestSha256)'."
  }
  $checksumEntries = Get-ChecksumEntries $checksumPath @($Volume.assets) $tag
  $assetRecords = @()
  foreach ($asset in @($Volume.assets | Sort-Object releaseAssetName)) {
    $name = [string]$asset.releaseAssetName
    $sourcePath = Resolve-SafeChildPath $SourceRoot $name
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      Fail "source file for '$name' is missing."
    }
    $file = Get-Item -LiteralPath $sourcePath
    if ($file.Length -le 0 -or $file.Length -ne [int64]$asset.expectedBytes) {
      Fail "asset '$name' has a mismatched nonzero byte count."
    }
    $mime = Detect-Mime (Get-Header $sourcePath)
    if ($mime -ne [string]$asset.expectedMime) {
      Fail "asset '$name' has MIME/signature mismatch: detected '$mime', expected '$($asset.expectedMime)'."
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourcePath).Hash.ToLowerInvariant()
    if ($hash -ne [string]$asset.expectedSha256) {
      Fail "asset '$name' has a mismatched SHA-256 hash."
    }
    if ([string]$checksumEntries[$name] -ne $hash) {
      Fail "checksums file '$checksumName' does not match source asset '$name'."
    }
    $assetRecords += [pscustomobject]@{
      Name = $name
      Path = $sourcePath
      Hash = $hash
      Bytes = [int64]$file.Length
      Asset = $asset
    }
  }
  return [pscustomobject]@{
    Tag = $tag
    Volume = $Volume
    ChecksumName = $checksumName
    ChecksumPath = $checksumPath
    ChecksumHash = $checksumDigest
    Assets = @($assetRecords)
  }
}

function Get-AssetDigest([object]$Asset) {
  $digest = [string]$Asset.digest
  if ($digest -match '^sha256:([a-f0-9]{64})$') { return $Matches[1] }
  if ($digest -match '^[a-f0-9]{64}$') { return $digest }
  Fail "GitHub did not return a SHA-256 digest for asset '$($Asset.name)'."
}

function Get-Release([string]$Tag) {
  try {
    return Invoke-GhJson @('api', "repos/$Repository/releases/tags/$Tag")
  } catch {
    Fail "missing release/tag '$Tag' or unreadable release metadata."
  }
}

function Verify-RemoteAsset([object]$RemoteAsset, [string]$SourcePath, [string]$ExpectedHash, [string]$Tag, [string]$Name) {
  if ($null -eq $RemoteAsset) {
    Fail "release '$Tag' does not contain asset '$Name'."
  }
  $sourceFile = Get-Item -LiteralPath $SourcePath
  if ([int64]$RemoteAsset.size -ne [int64]$sourceFile.Length -or (Get-AssetDigest $RemoteAsset) -ne $ExpectedHash) {
    Fail "release asset '$Name' contains different bytes."
  }
  if ([string]::IsNullOrWhiteSpace([string]$RemoteAsset.browser_download_url)) {
    Fail "release asset '$Name' has no downloadable URL."
  }
  $downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("nazca-media-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $downloadRoot | Out-Null
  try {
    & gh release download $Tag --repo $Repository --pattern $Name --dir $downloadRoot
    if ($LASTEXITCODE -ne 0) { Fail "fresh download failed for '$Name'." }
    $downloaded = Join-Path $downloadRoot $Name
    if (-not (Test-Path -LiteralPath $downloaded -PathType Leaf)) { Fail "fresh download did not produce '$Name'." }
    $downloadFile = Get-Item -LiteralPath $downloaded
    $downloadHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $downloaded).Hash.ToLowerInvariant()
    if ($downloadFile.Length -ne $sourceFile.Length -or $downloadHash -ne $ExpectedHash) {
      Fail "fresh download verification failed for '$Name'."
    }
  } finally {
    if (Test-Path -LiteralPath $downloadRoot) { Remove-Item -LiteralPath $downloadRoot -Recurse -Force }
  }
}

if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { Fail "unsafe repository '$Repository'." }
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { Fail "manifest '$ManifestPath' does not exist." }

$manifestFullPath = [System.IO.Path]::GetFullPath($ManifestPath)
Invoke-RegistryValidation $manifestFullPath $Repository
$manifest = Get-Content -Raw -LiteralPath $manifestFullPath | ConvertFrom-Json
if ([string]$manifest.repository -ne $Repository) {
  Fail "manifest repository '$($manifest.repository)' does not match -Repository '$Repository'."
}
if ([int]$manifest.maxAssetsPerRelease -ne $MaxAssetsPerRelease) {
  Fail 'manifest maxAssetsPerRelease is not 1000.'
}
if (-not (Test-Path -LiteralPath $SourceDirectory -PathType Container)) { Fail "source directory '$SourceDirectory' does not exist." }

$sourceRoot = [System.IO.Path]::GetFullPath($SourceDirectory)
$plannedVolumes = @($manifest.releases | Where-Object { $_.publicationState -in @('planned', 'uploading', 'published') })
if ($plannedVolumes.Count -eq 0) {
  Write-Output 'No planned or published media volumes are present. The honest empty registry requires no upload.'
  exit 0
}

$preflightVolumes = @()
foreach ($volume in $plannedVolumes) {
  $preflightVolumes += Test-LocalVolume $volume $sourceRoot
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail 'gh CLI is unavailable.' }

foreach ($preflight in $preflightVolumes) {
  $tag = [string]$preflight.Tag
  $volume = $preflight.Volume
  $expectedReleaseUrl = "https://github.com/$Repository/releases/tag/$tag"
  $release = Get-Release $tag
  if ([bool]$release.draft) { Fail "release '$tag' is still a draft." }
  if ([bool]$release.prerelease) { Fail "release '$tag' is a prerelease, not an immutable published volume." }
  if ([string]$release.tag_name -ne $tag) { Fail "release metadata tag mismatch for '$tag'." }
  if ([string]$release.html_url -ne $expectedReleaseUrl) { Fail "release URL mismatch for '$tag'." }

  $remoteAssets = @($release.assets)
  $checksumRemote = $remoteAssets | Where-Object { $_.name -eq $preflight.ChecksumName } | Select-Object -First 1
  if ($null -eq $checksumRemote) {
    if (-not $Publish) {
      Fail "release '$tag' is missing checksums file '$($preflight.ChecksumName)'. Supply -Publish to upload the verified file."
    }
    if ($PSCmdlet.ShouldProcess("$Repository/$tag/$($preflight.ChecksumName)", 'Upload verified checksums file')) {
      & gh release upload $tag $preflight.ChecksumPath --repo $Repository
      if ($LASTEXITCODE -ne 0) { Fail "upload failed for checksums file '$($preflight.ChecksumName)'." }
    }
    $release = Get-Release $tag
    $remoteAssets = @($release.assets)
    $checksumRemote = $remoteAssets | Where-Object { $_.name -eq $preflight.ChecksumName } | Select-Object -First 1
  }
  Verify-RemoteAsset $checksumRemote $preflight.ChecksumPath $preflight.ChecksumHash $tag $preflight.ChecksumName

  foreach ($assetRecord in @($preflight.Assets)) {
    $remote = $remoteAssets | Where-Object { $_.name -eq $assetRecord.Name } | Select-Object -First 1
    if ($null -eq $remote) {
      if (-not $Publish) {
        Fail "release '$tag' is missing image asset '$($assetRecord.Name)'. Supply -Publish to upload verified assets."
      }
      if ($PSCmdlet.ShouldProcess("$Repository/$tag/$($assetRecord.Name)", 'Upload one verified image asset')) {
        & gh release upload $tag $assetRecord.Path --repo $Repository
        if ($LASTEXITCODE -ne 0) { Fail "upload failed for '$($assetRecord.Name)'." }
      }
      $release = Get-Release $tag
      $remoteAssets = @($release.assets)
      $remote = $remoteAssets | Where-Object { $_.name -eq $assetRecord.Name } | Select-Object -First 1
    }
    Verify-RemoteAsset $remote $assetRecord.Path $assetRecord.Hash $tag $assetRecord.Name
  }

  $release = Get-Release $tag
  $remoteAssets = @($release.assets)
  $expectedNames = @($preflight.ChecksumName) + @($preflight.Assets | ForEach-Object { $_.Name })
  foreach ($expectedName in $expectedNames) {
    if ($null -eq ($remoteAssets | Where-Object { $_.name -eq $expectedName } | Select-Object -First 1)) {
      Fail "volume '$tag' is incomplete because release asset '$expectedName' is absent."
    }
  }
  Write-Output "Validated volume '$tag' with $(@($preflight.Assets).Count) image assets and checksums '$($preflight.ChecksumName)'."
}

Write-Output 'Media volume validation finished. No release was created, no tag was created, and no asset was uploaded unless -Publish was explicitly supplied.'
