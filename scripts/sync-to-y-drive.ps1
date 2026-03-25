# Mirrors C:\pstudy-web -> Y:\PSTUDY\Cursor\pstudy-web (Y becomes an exact copy of C).
# Run manually after coding, or schedule in Windows Task Scheduler (see comments at bottom).
#
# Requires: Y: available (network/USB drive mapped).
# Exits non-zero if robocopy had a real error (see robocopy exit codes: 0-7 = OK, 8+ = error).

$ErrorActionPreference = "Stop"

$Source = "C:\pstudy-web"
$Dest   = "Y:\PSTUDY\Cursor\pstudy-web"

if (-not (Test-Path -LiteralPath $Source)) {
    Write-Error "Source folder not found: $Source"
    exit 1
}
if (-not (Test-Path -LiteralPath "Y:\")) {
    Write-Error "Drive Y: is not available. Connect or map the drive, then run this script again."
    exit 1
}

# Ensure parent exists
$parent = Split-Path -Parent $Dest
if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}

Write-Host "Syncing (mirror):" -ForegroundColor Cyan
Write-Host "  From: $Source"
Write-Host "  To:   $Dest"
Write-Host ""

# /MIR = mirror (deletes files on Y that were removed on C — keeps copies identical)
# /Z   = restartable mode (better for network drives)
# /MT:8 = multi-threaded copy
# /R:2 /W:2 = retry twice, 2 sec wait (network hiccups)
# Exit codes: 0-7 success (0=nothing, 1=files copied, etc.), 8+ = failure
$robocopyArgs = @(
    $Source, $Dest,
    "/MIR",
    "/Z",
    "/MT:8",
    "/R:2",
    "/W:2",
    "/NFL", "/NDL", "/NP"
)

& robocopy @robocopyArgs
$exit = $LASTEXITCODE

if ($exit -ge 8) {
    Write-Host "Robocopy failed with exit code $exit" -ForegroundColor Red
    exit $exit
}

Write-Host ""
Write-Host "Done. Y: copy is up to date with C:\pstudy-web" -ForegroundColor Green
exit 0

# ----- Optional: schedule daily sync -----
# 1. Open Task Scheduler (taskschd.msc)
# 2. Create Task (not Basic Task) -> General: Run whether user is logged on or not (or only when logged on)
# 3. Triggers: Daily at a time you choose, or "At log on"
# 4. Actions: Start a program
#    Program: powershell.exe
#    Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\pstudy-web\scripts\sync-to-y-drive.ps1"
# 5. OK and enter your Windows password if asked
#
# Or run manually: Right-click this file -> Run with PowerShell
