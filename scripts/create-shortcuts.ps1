$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
$shell = New-Object -ComObject WScript.Shell

function New-BotShortcut([string]$name, [string]$script, [string]$description) {
    $path = Join-Path $desktop $name
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = $powershell
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    $shortcut.WorkingDirectory = $root
    $shortcut.Description = $description
    if ($node) {
        $shortcut.IconLocation = "$node,0"
    }
    $shortcut.Save()
    Write-Host "Created $path"
}

New-BotShortcut 'Discord Music Bot.lnk' `
    (Join-Path $root 'scripts\start-bot.ps1') `
    'Start the Discord music bot in the background'

New-BotShortcut 'Stop Discord Music Bot.lnk' `
    (Join-Path $root 'scripts\stop-bot.ps1') `
    'Stop the Discord music bot'
