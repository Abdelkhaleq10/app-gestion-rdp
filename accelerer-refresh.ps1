# C:\AppWeb\accelerer-refresh-final.ps1
# Objectif:
# - Statut Libre/Occupe plus rapide
# - Historique/Demandes plus rapides
# - Sans modifier le design
# - Backup automatique avant modification

$ErrorActionPreference = "Stop"

$APP = "C:\AppWeb"
$BACKUP_DIR = Join-Path $APP ("backup_refresh_final_" + (Get-Date -Format "yyyyMMdd_HHmmss"))

Write-Host "=== ACCELERATION REFRESH APP RDP ===" -ForegroundColor Cyan
Write-Host "Projet : $APP"
Write-Host "Backup : $BACKUP_DIR"

if (!(Test-Path $APP)) {
  Write-Host "ERREUR: C:\AppWeb introuvable." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null

function Backup-File {
  param([string]$FilePath)

  if (!(Test-Path $FilePath)) {
    Write-Host "SKIP backup: fichier introuvable -> $FilePath" -ForegroundColor Yellow
    return
  }

  $relative = $FilePath.Replace($APP, "").TrimStart("\")
  $dest = Join-Path $BACKUP_DIR $relative
  $destDir = Split-Path $dest -Parent

  if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }

  Copy-Item $FilePath $dest -Force
  Write-Host "Backup OK: $relative" -ForegroundColor DarkGray
}

function Replace-Exact {
  param(
    [string]$FilePath,
    [string]$OldText,
    [string]$NewText,
    [string]$Label
  )

  if (!(Test-Path $FilePath)) {
    Write-Host "SKIP: fichier introuvable -> $FilePath" -ForegroundColor Yellow
    return
  }

  Backup-File $FilePath

  $content = Get-Content $FilePath -Raw -Encoding UTF8

  if ($content.Contains($OldText)) {
    $content = $content.Replace($OldText, $NewText)
    Set-Content $FilePath $content -Encoding UTF8
    Write-Host "OK: $Label" -ForegroundColor Green
  } else {
    Write-Host "INFO: deja modifie ou texte non trouve -> $Label" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== 1) Acceleration frontend ===" -ForegroundColor Cyan

# Page employe: 5s -> 3s
Replace-Exact `
  -FilePath "$APP\app\page.tsx" `
  -OldText "}, 5000);" `
  -NewText "}, 3000);" `
  -Label "app\page.tsx : 5000ms -> 3000ms"

# Dashboard responsable: 5s -> 3s
Replace-Exact `
  -FilePath "$APP\app\responsable\dashboard\page.tsx" `
  -OldText "}, 5000);" `
  -NewText "}, 3000);" `
  -Label "dashboard\page.tsx : 5000ms -> 3000ms"

# Demandes: 30s -> 3s
Replace-Exact `
  -FilePath "$APP\app\responsable\demandes\page.tsx" `
  -OldText "}, 30000);" `
  -NewText "}, 3000);" `
  -Label "demandes\page.tsx : 30000ms -> 3000ms"

# Historique: 30s -> 3s
Replace-Exact `
  -FilePath "$APP\app\responsable\historique\page.tsx" `
  -OldText "}, 30000);" `
  -NewText "}, 3000);" `
  -Label "historique\page.tsx : 30000ms -> 3000ms"

Write-Host ""
Write-Host "=== 2) Acceleration monitor historique ===" -ForegroundColor Cyan

# History monitor: 5s -> 3s
# On ne touche pas aux timeout: 20000
Replace-Exact `
  -FilePath "$APP\rdp-history-monitor.js" `
  -OldText "setInterval(tick, 5000);" `
  -NewText "setInterval(tick, 3000);" `
  -Label "rdp-history-monitor.js : 5000ms -> 3000ms"

Write-Host ""
Write-Host "=== 3) Verification realtime monitor ===" -ForegroundColor Cyan

$rtm = "$APP\rdp-realtime-monitor.js"
if (Test-Path $rtm) {
  $rtmContent = Get-Content $rtm -Raw -Encoding UTF8
  if ($rtmContent.Contains("setInterval(tick, 1000);")) {
    Write-Host "OK: rdp-realtime-monitor.js reste a 1000ms. Ne pas modifier." -ForegroundColor Green
  } else {
    Write-Host "ATTENTION: setInterval(tick, 1000) non trouve. Verifie manuellement." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== 4) Verification intervals ===" -ForegroundColor Cyan

Select-String -Path `
  "$APP\app\page.tsx", `
  "$APP\app\responsable\dashboard\page.tsx", `
  "$APP\app\responsable\demandes\page.tsx", `
  "$APP\app\responsable\historique\page.tsx", `
  "$APP\rdp-history-monitor.js", `
  "$APP\rdp-realtime-monitor.js" `
  -Pattern "setInterval|setTimeout|30000|5000|3000|2000|1000|20000" `
  -ErrorAction SilentlyContinue |
  Select-Object Path, LineNumber, Line |
  Format-List

Write-Host ""
Write-Host "=== 5) Restart monitors ===" -ForegroundColor Cyan

$processes = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like "*rdp-realtime-monitor.js*" -or
  $_.CommandLine -like "*rdp-history-monitor.js*" -or
  $_.CommandLine -like "*popup-rdp-request.js*" -or
  $_.CommandLine -like "*save-popup-response.js*" -or
  $_.CommandLine -like "*mshta.exe*"
}

if ($processes) {
  $processes | Select-Object ProcessId, Name, CommandLine | Format-List

  foreach ($p in $processes) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped PID $($p.ProcessId)" -ForegroundColor Yellow
  }
} else {
  Write-Host "Aucun ancien process trouve." -ForegroundColor DarkGray
}

Remove-Item "C:\Logs\RDP_Request_Responses\realtime-monitor.lock" -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Logs\RDP_Request_Responses\history-monitor.lock" -Force -ErrorAction SilentlyContinue

try {
  schtasks /Run /TN "RDP Realtime Monitor" | Out-Host
} catch {
  Write-Host "Task RDP Realtime Monitor introuvable ou erreur." -ForegroundColor Yellow
}

if (Test-Path "$APP\rdp-history-monitor.js") {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d C:\AppWeb && node rdp-history-monitor.js >> C:\Logs\rdp-history-monitor.log 2>>&1" -WindowStyle Hidden
  Write-Host "OK: rdp-history-monitor.js relance en background." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== TERMINE ===" -ForegroundColor Green
Write-Host "Derniere etape: restart Next.js:"
Write-Host "cd C:\AppWeb"
Write-Host "Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue"
Write-Host "npm run dev"
