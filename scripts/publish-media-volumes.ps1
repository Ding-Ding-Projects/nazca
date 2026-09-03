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
  if ($LASTEXITCODE -ne 0) { Fail ("gh " + ($Arguments -join ' ') + " returned exit code $LASTEXITCODE: " + ($output -join "`n")) }
  if (-not $output) { Fail ("gh " + ($Arguments -join ' ') + ' returned no JSON.') }
  return (($output -join "`n") | ConvertFrom-Json)
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

function Get-AssetDigest([object]$Asset) {
  $digest = [string]$Asset.digest
  if ($digest -match '^sha256:([a-f0-9]{64})$') { return $Matches[1] }
  if ($digest -match '^[a-f0-9]{64}$') { return $digest }
  Fail "GitHub did not return a SHA-256 digest for asset '$($Asset.name)'"
}

function Get-Release([string]$Tag) {
  try { return Invoke-GhJson @('api', "repos/$Repository/releases/tags/$Tag") }
  catch { Fail "missing release/tag '$Tag' or unreadable release metadata" }
}

if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { Fail "unsafe repository '$Repository'" }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail 'gh CLI is unavailable.' }
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { Fail "manifest '$ManifestPath' does not exist." }
if (-not (Test-Path -LiteralPath $SourceDirectory -PathType Container)) { Fail "source directory '$SourceDirectory' does not exist." }

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
if ($manifest.recordType -ne 'MediaReleaseRegistryV1' -or $manifest.schemaVersion -ne '1.0.0') { Fail 'manifest record type or schema version is unsupported.' }
if ([int]$manifest.maxAssetsPerRelease -ne $MaxAssetsPerRelease) { Fail 'manifest maxAssetsPerRelease is not 1000.' }

$registryPath = [System.IO.Path]::GetFullPath($ManifestPath)
$sourceRoot = [System.IO.Path]::GetFullPath($SourceDirectory).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
$seenTags = @{}
$seenTitles = @{}
$seenNames = @{}
$plannedVolumes = @($manifest.releases | Where-Object { $_.publicationState -in @('planned', 'uploading', 'published') })

if ($plannedVolumes.Count -eq 0) {
  Write-Output 'No planned or published media volumes are present. The honest empty registry requires no upload.'
  exit 0
}

$journal = @{}
if ($JournalPath) {
  if (Test-Path -LiteralPath $JournalPath -PathType Leaf) { $journal = Get-Content -Raw -LiteralPath $JournalPath | ConvertFrom-Json -AsHashtable }
}

foreach ($volume in $plannedVolumes) {
  $tag = [string]$volume.releaseTag
  if ($tag -notmatch '^nazca-media-v1-\d{6}$') { Fail "unsafe or missing release tag '$tag'" }
  if ($seenTags.ContainsKey($tag)) { Fail "duplicate release tag '$tag'" }
  $seenTags[$tag] = $true
  if ([int]$volume.reservedAssetSlots -ne $MaxAssetsPerRelease) { Fail "volume '$tag' does not reserve exactly 1000 image slots." }
  $assets = @($volume.assets)
  if ($assets.Count -eq 0 -or $assets.Count -gt $MaxAssetsPerRelease -or [int]$volume.expectedAssetCount -ne $assets.Count) { Fail "volume '$tag' has an incomplete or oversized asset manifest." }
  $release = Get-Release $tag
  if ([bool]$release.draft) { Fail "release '$tag' is still a draft." }
  if ([bool]$release.prerelease) { Fail "release '$tag' is a prerelease, not an immutable published volume." }
  if ([string]$release.tag_name -ne $tag) { Fail "release metadata tag mismatch for '$tag'." }

  $remoteAssets = @($release.assets)
  foreach ($asset in ($assets | Sort-Object releaseAssetName)) {
    $name = [string]$asset.releaseAssetName
    Assert-SafeAssetName $name
    if ($seenNames.ContainsKey($name)) { Fail "duplicate asset name '$name'" }
    $seenNames[$name] = $true
    $title = [string]$asset.canonicalTitle
    if ($seenTitles.ContainsKey($title)) { Fail "duplicate canonical media title '$title'" }
    $seenTitles[$title] = $true
    if ([string]::IsNullOrWhiteSpace([string]$asset.mediaId) -or [string]::IsNullOrWhiteSpace([string]$asset.source.sourceUrl) -or [string]$asset.source.sourceSha1 -notmatch '^[a-f0-9]{40}$') { Fail "asset '$name' is missing a source identity." }
    if ([string]::IsNullOrWhiteSpace([string]$asset.rights.id) -or [string]::IsNullOrWhiteSpace([string]$asset.rights.license) -or [string]::IsNullOrWhiteSpace([string]$asset.rights.permissionBasis) -or @($asset.rights.evidence).Count -eq 0) { Fail "asset '$name' is missing a rights record." }
    if ([string]$asset.expectedMime -notin $SupportedMime -or [string]$asset.expectedSha256 -notmatch '^[a-f0-9]{64}$' -or [int64]$asset.expectedBytes -le 0) { Fail "asset '$name' has incomplete expected byte, MIME, or hash metadata." }
    $sourcePath = [System.IO.Path]::GetFullPath((Join-Path $sourceRoot $name))
    if (-not $sourcePath.StartsWith("$sourceRoot$([System.IO.Path]::DirectorySeparatorChar)", [StringComparison]::OrdinalIgnoreCase)) { Fail "asset '$name' escapes the source directory." }
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { Fail "source file for '$name' is missing." }
    $file = Get-Item -LiteralPath $sourcePath
    if ($file.Length -le 0 -or $file.Length -ne [int64]$asset.expectedBytes) { Fail "asset '$name' has a mismatched nonzero byte count." }
    $mime = Detect-Mime (Get-Header $sourcePath)
    if ($mime -ne [string]$asset.expectedMime) { Fail "asset '$name' has MIME/signature mismatch: detected '$mime', expected '$($asset.expectedMime)'." }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourcePath).Hash.ToLowerInvariant()
    if ($hash -ne [string]$asset.expectedSha256) { Fail "asset '$name' has a mismatched SHA-256 hash." }

    $remote = $remoteAssets | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if ($remote) {
      if ([int64]$remote.size -ne $file.Length -or (Get-AssetDigest $remote) -ne $hash) { Fail "existing release asset '$name' contains different bytes." }
    } elseif ($Publish) {
      if ($PSCmdlet.ShouldProcess("$Repository/$tag/$name", 'Upload one verified image asset')) {
        & gh release upload $tag $sourcePath --repo $Repository
        if ($LASTEXITCODE -ne 0) { Fail "upload failed for '$name'." }
      }
      $release = Get-Release $tag
      $remote = @($release.assets) | Where-Object { $_.name -eq $name } | Select-Object -First 1
      if (-not $remote) { Fail "uploaded asset '$name' was not returned by GitHub." }
      if ([int64]$remote.size -ne $file.Length -or (Get-AssetDigest $remote) -ne $hash -or [string]::IsNullOrWhiteSpace([string]$remote.browser_download_url)) { Fail "uploaded asset '$name' failed size, digest, or download URL verification." }
    } else {
      Write-Output "Validated locally, not uploaded: $tag/$name"
    }

    if ($remote) {
      if ([string]::IsNullOrWhiteSpace([string]$remote.browser_download_url)) { Fail "release asset '$name' has no downloadable URL." }
      $downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("nazca-media-" + [guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $downloadRoot | Out-Null
      try {
        & gh release download $tag --repo $Repository --pattern $name --dir $downloadRoot
        if ($LASTEXITCODE -ne 0) { Fail "fresh download failed for '$name'." }
        $downloaded = Join-Path $downloadRoot $name
        if (-not (Test-Path -LiteralPath $downloaded -PathType Leaf)) { Fail "fresh download did not produce '$name'." }
        $downloadFile = Get-Item -LiteralPath $downloaded
        if ($downloadFile.Length -ne $file.Length -or (Get-FileHash -Algorithm SHA256 -LiteralPath $downloaded).Hash.ToLowerInvariant() -ne $hash) { Fail "fresh download verification failed for '$name'." }
      } finally {
        if (Test-Path -LiteralPath $downloadRoot) { Remove-Item -LiteralPath $downloadRoot -Recurse -Force }
      }
    }
  }

  $release = Get-Release $tag
  $verifiedRemote = @($release.assets) | Where-Object { $_.name -in @($assets.releaseAssetName) }
  if ($verifiedRemote.Count -ne $assets.Count) { Fail "volume '$tag' is incomplete and cannot be marked complete." }
  if ($Publish -and $volume.publicationState -ne 'published') { Write-Output "All $($assets.Count) assets in '$tag' are individually verified. Update the tracked registry to published only in the same commit as the verified checksums." }
}

Write-Output 'Media volume validation finished. No release was created, no tag was created, and no asset was uploaded unless -Publish was explicitly supplied.'
