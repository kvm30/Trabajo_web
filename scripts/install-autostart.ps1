$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$node = Get-Command node.exe -ErrorAction Stop
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskName = 'Backweb'

$action = New-ScheduledTaskAction `
    -Execute $node.Source `
    -Argument '"src\index.js"' `
    -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Inicia el servidor Backweb al iniciar sesión en Windows.' `
    -Force | Out-Null

Write-Host "Tarea '$taskName' creada. Backweb se iniciará al iniciar sesión en Windows."
