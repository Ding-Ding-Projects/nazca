[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string]$RemoteUrl,

    [ValidatePattern('^[A-Za-z0-9._/-]+$')]
    [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'
$tokenBuilder = [System.Text.StringBuilder]::new()

try {
    while ($true) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq [ConsoleKey]::Enter) {
            break
        }
        if ($key.Key -eq [ConsoleKey]::Backspace) {
            if ($tokenBuilder.Length -gt 0) {
                $tokenBuilder.Length -= 1
            }
            continue
        }
        if (-not [char]::IsControl($key.KeyChar)) {
            [void]$tokenBuilder.Append($key.KeyChar)
        }
    }

    $token = $tokenBuilder.ToString()
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw 'The Sites source credential was empty.'
    }

    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GCM_INTERACTIVE = 'Never'
    $env:GIT_CONFIG_COUNT = '1'
    $env:GIT_CONFIG_KEY_0 = 'http.extraHeader'
    $env:GIT_CONFIG_VALUE_0 = "Authorization: Bearer $token"

    & git push $RemoteUrl "HEAD:$Branch"
    if ($LASTEXITCODE -ne 0) {
        throw "The Sites source push exited with code $LASTEXITCODE."
    }
    Write-Output 'Sites source push completed.'
}
finally {
    $token = $null
    [void]$tokenBuilder.Clear()
    Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
    Remove-Item Env:GCM_INTERACTIVE -ErrorAction SilentlyContinue
    Remove-Item Env:GIT_CONFIG_COUNT -ErrorAction SilentlyContinue
    Remove-Item Env:GIT_CONFIG_KEY_0 -ErrorAction SilentlyContinue
    Remove-Item Env:GIT_CONFIG_VALUE_0 -ErrorAction SilentlyContinue
}
