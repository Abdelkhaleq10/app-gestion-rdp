cd C:\AppWeb

@'
$APP = "C:\AppWeb"
$BACKUP = "$APP\backup_refresh_2s_" + (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Path $BACKUP -Force | Out-Null

function Backup($path) {
  if (Test-Path $path) {
    $rel = $path.Replace($APP, "").TrimStart("\")
    $dest = Join-Path $BACKUP $rel
    New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
    Copy-Item $path $dest -Force
  }
}

function ReplaceAll($path, $old, $new) {
  if (Test-Path $path) {
    Backup $path
    $c = Get-Content $path -Raw -Encoding UTF8
    $c = $c.Replace($old, $new)
    Set-Content $path $c -Encoding UTF8
    Write-Host "OK: $path" -ForegroundColor Green
  }
}

function AddNoCacheToApi($path) {
  if (!(Test-Path $path)) { return }
  Backup $path
  $c = Get-Content $path -Raw -Encoding UTF8

  if ($c -notmatch 'export const dynamic') {
    $c = "export const dynamic = `"force-dynamic`";`r`nexport const revalidate = 0;`r`n" + $c
  }

  Set-Content $path $c -Encoding UTF8
  Write-Host "NO-CACHE OK: $path" -ForegroundColor Green
}

# 1) Frontend refresh rapide
ReplaceAll "$APP\app\page.tsx" "}, 5000);" "}, 2000);"
ReplaceAll "$APP\app\responsable\dashboard\page.tsx" "}, 5000);" "}, 2000);"
ReplaceAll "$APP\app\responsable\demandes\page.tsx" "}, 30000);" "}, 2000);"
ReplaceAll "$APP\app\responsable\historique\page.tsx" "}, 30000);" "}, 2000);"

# 2) History monitor plus rapide
ReplaceAll "$APP\rdp-history-monitor.js" "setInterval(tick, 5000);" "setInterval(tick, 2000);"
ReplaceAll "$APP\rdp-history-monitor.js" "setInterval(tick, 3000);" "setInterval(tick, 2000);"

# 3) APIs sans cache
AddNoCacheToApi "$APP\app\api\status\route.ts"
AddNoCacheToApi "$APP\app\api\dashboard\route.ts"
AddNoCacheToApi "$APP\app\api\history\route.ts"
AddNoCacheToApi "$APP\app\api\requests\route.ts"

# 4) Stop old monitors
Get-CimInstance Win32_Process |
Where-Object {
  $_.CommandLine -like "*rdp-realtime-monitor.js*" -or
  $_.CommandLine -like "*rdp-history-monitor.js*" -or
  $_.CommandLine -like "*popup-rdp-request.js*" -or
  $_.CommandLine -like "*mshta.exe*"
} |
ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Remove-Item "C:\Logs\RDP_Request_Responses\realtime-monitor.lock" -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Logs\RDP_Request_Responses\history-monitor.lock" -Force -ErrorAction SilentlyContinue

# 5) Restart monitors
schtasks /Run /TN "RDP Realtime Monitor"

Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d C:\AppWeb && node rdp-history-monitor.js >> C:\Logs\rdp-history-monitor.log 2>>&1" -WindowStyle Hidden

Write-Host ""
Write-Host "TERMINE. Daba restart Next.js:" -ForegroundColor Cyan
Write-Host "cd C:\AppWeb"
Write-Host "Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue"
Write-Host "npm run dev"
'@ | Set-Content "C:\AppWeb\fix-refresh-2s.ps1" -Encoding UTF8

powershell -ExecutionPolicy Bypass -File "C:\AppWeb\fix-refresh-2s.ps1"