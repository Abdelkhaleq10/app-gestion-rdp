try {
    $url = "http://127.0.0.1:3000/api/sync-rdp-history"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
    $logLine = "$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss') | OK | $($response.Content)"
}
catch {
    $logLine = "$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss') | ERROR | $($_.Exception.Message)"
}

Add-Content -Path "C:\Logs\sync_rdp_history_log.txt" -Value $logLine -Encoding utf8