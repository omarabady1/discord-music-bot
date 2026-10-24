$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'logs\bot.pid'
$shell = New-Object -ComObject WScript.Shell

function Show-BotMessage([string]$text, [int]$seconds, [int]$icon) {
    $null = $shell.Popup($text, $seconds, 'Discord Music Bot', $icon)
}

function Get-BotProcess {
    if (-not (Test-Path $pidFile)) { return $null }

    $raw = Get-Content $pidFile -Raw -ErrorAction SilentlyContinue
    if (-not $raw) { return $null }

    $botPid = 0
    if (-not [int]::TryParse($raw.Trim(), [ref]$botPid)) { return $null }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $botPid" -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.Name -ne 'node.exe') { return $null }
    if ($process.CommandLine -notmatch 'src[\\/]index\.js') { return $null }

    return $process
}

$bot = Get-BotProcess
if ($null -eq $bot) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Show-BotMessage 'The bot is not running.' 4 64
    exit 0
}

Stop-Process -Id $bot.ProcessId -Force -ErrorAction SilentlyContinue
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Show-BotMessage 'The bot has stopped.' 3 64
