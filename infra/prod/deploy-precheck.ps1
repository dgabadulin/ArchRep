param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [string]$OutFile = ''
)

# Pre-deploy gate (issue #96). deploy_local.bat == prod, so the rules are strict:
#   1) clean working tree (allowlist: modules/, temp/, frontend-v3-dist/, docs/exports/, .env*, deploy_*)
#   2) no unpushed commits (HEAD equals its upstream; uses local remote-tracking ref, no network)
#   3) HEAD is exactly on a tag, and package.json version equals the tag version
# On success writes KEY=VALUE file for deploy.bat (APP_VERSION / APP_COMMIT / APP_BUILD_TIME / APP_TAG).

$ErrorActionPreference = 'Continue'
$fail = @()
$warn = @()
$allow = @('modules/', 'temp/', 'frontend-v3-dist/', 'docs/exports/')

if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
    $fail += "Not a git repository: $RepoRoot"
}

# --- 1) dirty tree -----------------------------------------------------------
if ($fail.Count -eq 0) {
    $statusLines = @(& git -C $RepoRoot status --porcelain=v1 --untracked-files=normal 2>$null)
    $bad = @()
    foreach ($line in $statusLines) {
        $text = [string]$line
        if ([string]::IsNullOrWhiteSpace($text) -or $text.Length -lt 4) { continue }
        $path = $text.Substring(3).Trim().Trim('"')
        if ($path -match '(^|/)\.env') { continue }
        if ($path -match '^deploy_') { continue }
        if ($path -eq 'modules' -or $path.StartsWith('modules/')) { continue }
        $skip = $false
        foreach ($a in $allow) { if ($path.StartsWith($a)) { $skip = $true; break } }
        if ($skip) { continue }
        $bad += $text
    }
    if ($bad.Count -gt 0) {
        $fail += 'Working tree is dirty - commit or revert these changes:'
        foreach ($b in $bad) { $fail += "    $b" }
    }
}

# --- 2) unpushed commits -----------------------------------------------------
if ($fail.Count -eq 0) {
    $upstream = [string](& git -C $RepoRoot rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null)
    $upstream = $upstream.Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
        $fail += 'Branch has no upstream - push it first (git push -u origin <branch>)'
    } else {
        $counts = [string](& git -C $RepoRoot rev-list --left-right --count "HEAD...$upstream" 2>$null)
        $counts = $counts.Trim()
        if (-not [string]::IsNullOrWhiteSpace($counts)) {
            $parts = $counts -split '\s+'
            $ahead = [int]$parts[0]
            $behind = [int]$parts[1]
            if ($ahead -gt 0) { $fail += "$ahead local commit(s) not pushed to $upstream - push before deploy" }
            if ($behind -gt 0) { $warn += "$behind commit(s) behind $upstream - deploying an older commit" }
        }
    }
}

# --- 3) tag on HEAD + version consistency ------------------------------------
$tag = ''
if ($fail.Count -eq 0) {
    $tag = [string](& git -C $RepoRoot describe --tags --exact-match HEAD 2>$null)
    $tag = $tag.Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($tag)) {
        $fail += 'HEAD is not tagged - releases must be deployed from a tag (vX.Y.Z)'
        $tag = ''
    }
}

$version = ''
if (-not [string]::IsNullOrWhiteSpace($tag)) {
    $version = $tag -replace '^v', ''
    $pkgPath = Join-Path $RepoRoot 'package.json'
    if (Test-Path $pkgPath) {
        $pkgVersion = [string](Get-Content -Raw -Encoding UTF8 $pkgPath | ConvertFrom-Json).version
        if ($pkgVersion -ne $version) {
            $fail += "package.json version ($pkgVersion) != tag ($version) - merge the release PR first"
        }
    }
}

foreach ($w in $warn) { Write-Output "[precheck] WARN: $w" }

if ($fail.Count -gt 0) {
    foreach ($item in $fail) { Write-Output "[precheck] ERROR: $item" }
    Write-Output '[precheck] FAILED - deploy aborted'
    exit 1
}

$commit = [string](& git -C $RepoRoot rev-parse --short HEAD 2>$null)
$commit = $commit.Trim()
$buildTime = (Get-Date).ToString('o')

if (-not [string]::IsNullOrWhiteSpace($OutFile)) {
    $lines = @(
        "APP_VERSION=$version",
        "APP_COMMIT=$commit",
        "APP_BUILD_TIME=$buildTime",
        "APP_TAG=$tag"
    )
    Set-Content -Path $OutFile -Value $lines -Encoding ASCII
}

Write-Output "[precheck] OK: $tag (version $version, commit $commit)"
exit 0

