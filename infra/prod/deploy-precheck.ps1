param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [string]$OutFile = '',
    [ValidateSet('strict', 'ahead', 'dirty')][string]$Gate = ''
)

# Pre-deploy gate (issue #96) with modes (docs/versioning.md §4):
#   strict (default) - HEAD is exactly on a tag, clean tree, everything pushed;
#   ahead  - allows deploy "ahead of the tag" (N commits not in a release) and marks
#            the deploy state in /api/version and the About page;
#   dirty  - emergency only: allows uncommitted files (code outside git), always marked
#            as a dirty deploy (pass explicitly).
# Invariant in every mode: no unpushed commits (otherwise the build is not reproducible).
# On success writes a KEY=VALUE file for deploy.bat.

$ErrorActionPreference = 'Continue'
$fail = @()
$warn = @()
$allow = @('temp/', 'frontend-v3-dist/', 'docs/exports/')

# Safe git output (PowerShell returns $null when the command writes nothing).
function GitOut([string[]]$gitArgs) {
    $out = & git -C $RepoRoot @gitArgs 2>$null
    if ($null -eq $out) { return '' }
    return ([string](@($out) -join "`n")).Trim()
}

if ([string]::IsNullOrWhiteSpace($Gate)) {
    if (-not [string]::IsNullOrWhiteSpace($env:DEPLOY_GATE)) { $Gate = $env:DEPLOY_GATE } else { $Gate = 'strict' }
}

if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
    $fail += "Not a git repository: $RepoRoot"
}

$state = 'release'
$dirtyFiles = @()
$aheadCommits = 0
$baseTag = ''

# --- 1) dirty tree -----------------------------------------------------------
if ($fail.Count -eq 0) {
    $statusLines = @(& git -C $RepoRoot status --porcelain=v1 --untracked-files=normal 2>$null)
    foreach ($line in $statusLines) {
        $text = [string]$line
        if ([string]::IsNullOrWhiteSpace($text) -or $text.Length -lt 4) { continue }
        $path = $text.Substring(3).Trim().Trim('"')
        if ($path -match '(^|/)\.env') { continue }
        if ($path -match '^deploy_') { continue }
        $skip = $false
        foreach ($a in $allow) { if ($path.StartsWith($a)) { $skip = $true; break } }
        if ($skip) { continue }
        $dirtyFiles += $text
    }
    if ($dirtyFiles.Count -gt 0) {
        if ($Gate -eq 'dirty') {
            $state = 'dirty'
            $warn += "dirty tree: $($dirtyFiles.Count) file(s) outside git - deploy marked as dirty"
            foreach ($d in $dirtyFiles) { $warn += "    $d" }
        } else {
            $fail += 'Working tree is dirty - commit or revert these changes (emergency: --allow-dirty):'
            foreach ($d in $dirtyFiles) { $fail += "    $d" }
        }
    }
}

# --- 2) unpushed commits (required in every mode) ----------------------------
if ($fail.Count -eq 0) {
    $upstream = GitOut @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
    if ([string]::IsNullOrWhiteSpace($upstream)) {
        $fail += 'Branch has no upstream - push it first (git push -u origin <branch>)'
    } else {
        $counts = GitOut @('rev-list', '--left-right', '--count', "HEAD...$upstream")
        if (-not [string]::IsNullOrWhiteSpace($counts)) {
            $parts = $counts -split '\s+'
            $aheadLocal = [int]$parts[0]
            $behind = [int]$parts[1]
            if ($aheadLocal -gt 0) { $fail += "$aheadLocal local commit(s) not pushed to $upstream - push before deploy" }
            if ($behind -gt 0) { $warn += "$behind commit(s) behind $upstream - deploying an older commit" }
        }
    }
}


# --- 3) tag / release base ---------------------------------------------------
$commit = GitOut @('rev-parse', '--short', 'HEAD')
$tag = ''
if ($fail.Count -eq 0) {
    $tag = GitOut @('describe', '--tags', '--exact-match', 'HEAD')
    if ([string]::IsNullOrWhiteSpace($tag)) {
        $tag = ''
        $desc = GitOut @('describe', '--tags', '--long', 'HEAD')
        if ([string]::IsNullOrWhiteSpace($desc)) {
            $fail += 'HEAD is not on a tag and has no reachable tag base - cut a release first'
        } else {
            $m = [regex]::Match($desc, '^(?<tag>.+)-(?<n>\d+)-g(?<sha>[0-9a-f]+)$')
            if (-not $m.Success) {
                $fail += "cannot parse git describe output: $desc"
            } else {
                $baseTag = $m.Groups['tag'].Value
                $aheadCommits = [int]$m.Groups['n'].Value
                if ($Gate -eq 'strict') {
                    $fail += "HEAD is not tagged: $aheadCommits commit(s) ahead of $baseTag (release first, or --ahead for a hotfix deploy)"
                } else {
                    if ($state -ne 'dirty') { $state = 'ahead' }
                    $warn += "deploy ahead of $baseTag by $aheadCommits commit(s) - state marked as $state"
                }
            }
        }
    } else {
        $baseTag = $tag
    }
}

# --- 4) version and package.json consistency ---------------------------------
$version = ''
if ($fail.Count -eq 0) {
    if ($aheadCommits -gt 0) {
        $baseVersion = $baseTag -replace '^v', ''
        $version = "$baseVersion+$aheadCommits.g$commit"
        if ($state -eq 'dirty') { $version = "$version.dirty" }
    } else {
        $version = $tag -replace '^v', ''
        if ($state -eq 'dirty') { $version = "$version+dirty.$commit" }
    }

    $expectedPkg = if ($aheadCommits -gt 0) { $baseTag -replace '^v', '' } else { $version }
    $pkgPath = Join-Path $RepoRoot 'package.json'
    if (Test-Path $pkgPath) {
        $pkgVersion = [string](Get-Content -Raw -Encoding UTF8 $pkgPath | ConvertFrom-Json).version
        if ($pkgVersion -ne $expectedPkg) {
            $fail += "package.json version ($pkgVersion) != expected ($expectedPkg) - merge the release PR first"
        }
    }
}

foreach ($w in $warn) { Write-Output "[precheck] WARN: $w" }

if ($fail.Count -gt 0) {
    foreach ($item in $fail) { Write-Output "[precheck] ERROR: $item" }
    Write-Output '[precheck] FAILED - deploy aborted'
    exit 1
}

$buildTime = (Get-Date).ToString('o')
$channel = if ($state -eq 'release') { 'stable' } else { 'dev' }
# Docker image tags do not allow '+' - the image gets the '-' form.
$imageTag = $version.Replace('+', '-')

if (-not [string]::IsNullOrWhiteSpace($OutFile)) {
    $lines = @(
        "APP_VERSION=$version",
        "APP_COMMIT=$commit",
        "APP_BUILD_TIME=$buildTime",
        "APP_TAG=$baseTag",
        "APP_BASE_TAG=$baseTag",
        "APP_DEPLOY_STATE=$state",
        "APP_AHEAD_COMMITS=$aheadCommits",
        "APP_DIRTY_FILES=$($dirtyFiles.Count)",
        "APP_IMAGE_TAG=$imageTag",
        "APP_CHANNEL=$channel"
    )
    Set-Content -Path $OutFile -Value $lines -Encoding ASCII
}

$tagLabel = if ($aheadCommits -gt 0) { "$baseTag+$aheadCommits" } else { $baseTag }
Write-Output "[precheck] OK ($state): $tagLabel (version $version, commit $commit, image tag $imageTag)"
exit 0
