$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logs'
$pidFile = Join-Path $logs 'bot.pid'
$outLog = Join-Path $logs 'bot.log'
$errLog = Join-Path $logs 'bot.err.log'
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

try {
    if ($null -ne (Get-BotProcess)) {
        Show-BotMessage 'The bot is already running.' 4 64
        exit 0
    }

    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Set-Location $root

    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) {
        Show-BotMessage 'Node.js was not found. Install Node.js 20 or newer.' 8 16
        exit 1
    }

    $startArgs = @{
        FilePath               = $node
        ArgumentList           = 'src/index.js'
        WorkingDirectory       = $root
        WindowStyle            = 'Hidden'
        RedirectStandardOutput = $outLog
        RedirectStandardError  = $errLog
        PassThru               = $true
    }
    $bot = Start-Process @startArgs
    Set-Content -Path $pidFile -Value $bot.Id

    $deadline = (Get-Date).AddSeconds(20)
    $online = $false

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        $bot.Refresh()

        if ($bot.HasExited) { break }

        if (Test-Path $outLog) {
            $loggedIn = Select-String -Path $outLog -Pattern 'Logged in as' -Quiet -ErrorAction SilentlyContinue
            if ($loggedIn) {
                $online = $true
                break
            }
        }
    }

    if ($bot.HasExited) {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

        $details = ''
        if (Test-Path $errLog) {
            $details = (Get-Content $errLog -Tail 5 -Encoding UTF8 -ErrorAction SilentlyContinue) -join "`n"
        }
        if (-not $details -and (Test-Path $outLog)) {
            $details = (Get-Content $outLog -Tail 5 -Encoding UTF8 -ErrorAction SilentlyContinue) -join "`n"
        }

        Show-BotMessage ("The bot stopped right after starting.`n`n" + $details) 15 16
        exit 1
    }

    if ($online) {
        Show-BotMessage 'Discord Music Bot is online.' 3 64
    } else {
        Show-BotMessage 'The bot is starting. Check logs\bot.log if it does not appear in Discord.' 5 64
    }
} catch {
    Show-BotMessage ("Could not start the bot.`n`n" + $_.Exception.Message) 12 16
    exit 1
}
