while ($true) {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\script_RDP\RDP_log.ps1"
  Start-Sleep -Seconds 3
}

