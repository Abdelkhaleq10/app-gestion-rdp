# ==========================================================
# RDP Sync Final - IP FIXED
# ==========================================================

$LogsDir = "C:\Logs"
$HistoryFile = "$LogsDir\RDP_Users_History.csv"
$StatusFile = "$LogsDir\RDP_Status.txt"

if (!(Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir | Out-Null
}

function Get-EventData {
    param($Event)

    $xml = [xml]$Event.ToXml()
    $data = @{}

    foreach ($d in $xml.Event.EventData.Data) {
        if ($d.Name) {
            $data[$d.Name] = $d.'#text'
        }
    }

    return $data
}

function Clean-User {
    param($User)

    if ([string]::IsNullOrWhiteSpace($User)) {
        return "N/A"
    }

    $User = $User.Trim()

    if ($User -like "*\*") {
        return ($User.Split("\")[-1])
    }

    return $User
}

function Clean-IP {
    param($IP)

    if ([string]::IsNullOrWhiteSpace($IP)) {
        return "N/A"
    }

    $IP = $IP.Trim()

    if ($IP -eq "::1") {
        return "127.0.0.1"
    }

    if ($IP -eq "-") {
        return "N/A"
    }

    return $IP
}

function Get-IP-FromMessage {
    param($Message)

    if ([string]::IsNullOrWhiteSpace($Message)) {
        return "N/A"
    }

    if ($Message -match "Adresse réseau source\s*:\s*([0-9]{1,3}(\.[0-9]{1,3}){3})") {
        return $matches[1]
    }

    if ($Message -match "Source Network Address\s*:\s*([0-9]{1,3}(\.[0-9]{1,3}){3})") {
        return $matches[1]
    }

    return "N/A"
}

function Get-User-FromMessage {
    param($Message)

    if ([string]::IsNullOrWhiteSpace($Message)) {
        return "N/A"
    }

    if ($Message -match "Utilisateur\s*:\s*([^\r\n]+)") {
        return Clean-User $matches[1]
    }

    if ($Message -match "User\s*:\s*([^\r\n]+)") {
        return Clean-User $matches[1]
    }

    return "N/A"
}

# ----------------------------------------------------------
# 1) RemoteConnectionManager 1149 = IP source
# ----------------------------------------------------------
$rcmEvents = Get-WinEvent -FilterHashtable @{
    LogName = "Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational"
    Id = 1149
} -MaxEvents 1000 -ErrorAction SilentlyContinue

$authList = @()

foreach ($ev in $rcmEvents) {
    $data = Get-EventData $ev

    $user = Clean-User $data["Param1"]
    $ip = Clean-IP $data["Param3"]

    # Backup parsing depuis Message
    if ($user -eq "N/A") {
        $user = Get-User-FromMessage $ev.Message
    }

    if ($ip -eq "N/A") {
        $ip = Get-IP-FromMessage $ev.Message
    }

    $authList += [PSCustomObject]@{
        Time = $ev.TimeCreated
        User = $user
        IP = $ip
    }
}

# ----------------------------------------------------------
# 2) LocalSessionManager events
# ----------------------------------------------------------
$lsmEvents = Get-WinEvent -FilterHashtable @{
    LogName = "Microsoft-Windows-TerminalServices-LocalSessionManager/Operational"
    Id = 21,23,24,25
} -MaxEvents 1000 -ErrorAction SilentlyContinue

$result = @()

foreach ($ev in $lsmEvents) {
    $data = Get-EventData $ev

    $user = Clean-User $data["User"]
    $sessionId = $data["SessionID"]
    $address = Clean-IP $data["Address"]

    switch ($ev.Id) {
        21 { $action = "Connexion RDP" }
        23 { $action = "Deconnexion RDP" }
        24 { $action = "Session deconnectee" }
        25 { $action = "Reconnexion RDP" }
        default { $action = "Evenement RDP" }
    }

    $ip = "N/A"

    if ($address -ne "N/A") {
        $ip = $address
    }

    # Chercher IP proche avec même user
    if ($ip -eq "N/A" -and $user -ne "N/A") {
        $nearAuth = $authList |
            Where-Object {
                $_.User -eq $user -and
                $_.IP -ne "N/A" -and
                $_.Time -le $ev.TimeCreated.AddMinutes(3) -and
                $_.Time -ge $ev.TimeCreated.AddMinutes(-20)
            } |
            Sort-Object Time -Descending |
            Select-Object -First 1

        if ($nearAuth) {
            $ip = $nearAuth.IP
        }
    }

    # Backup: chercher IP proche même sans user
    if ($ip -eq "N/A") {
        $nearAnyAuth = $authList |
            Where-Object {
                $_.IP -ne "N/A" -and
                $_.Time -le $ev.TimeCreated.AddMinutes(3) -and
                $_.Time -ge $ev.TimeCreated.AddMinutes(-20)
            } |
            Sort-Object Time -Descending |
            Select-Object -First 1

        if ($nearAnyAuth) {
            $ip = $nearAnyAuth.IP
        }
    }

    if ([string]::IsNullOrWhiteSpace($sessionId)) {
        $sessionId = "N/A"
    }

    $result += [PSCustomObject]@{
        date = $ev.TimeCreated.ToString("dd/MM/yyyy")
        heure = $ev.TimeCreated.ToString("HH:mm:ss")
        utilisateur = $user
        machine = $env:COMPUTERNAME
        ip = $ip
        action = $action
        session_active = $sessionId
        date_complete = $ev.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
    }
}

$result = $result | Sort-Object date_complete -Descending
$result | Export-Csv -Path $HistoryFile -NoTypeInformation -Encoding UTF8

# ----------------------------------------------------------
# Status Libre / Occupe
# Important:
# - Local PC responsable = Libre
# - Vraie session RDP active = Occupe
# - Windows FR kaykteb "Actif"
# - Windows EN kaykteb "Active"
# ----------------------------------------------------------

$activeRdpSessions = @()

try {
    $queryUserOutput = query user 2>$null

    foreach ($line in $queryUserOutput) {
        $cleanLine = $line.Trim()

        if (
            $cleanLine -match "rdp-tcp" -and
            (
                $cleanLine -match "Actif" -or
                $cleanLine -match "Active"
            )
        ) {
            $activeRdpSessions += $cleanLine
        }
    }
}
catch {
    $activeRdpSessions = @()
}

if ($activeRdpSessions.Count -gt 0) {
    $etat = "Occupe"
    $nbSessions = $activeRdpSessions.Count
}
else {
    $etat = "Libre"
    $nbSessions = 0
}

$statusContent = @"
etat_poste=$etat
nombre_sessions_actives=$nbSessions
date_verification=$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

$statusContent | Out-File -FilePath $StatusFile -Encoding UTF8 -Force

Write-Host "======================================"
Write-Host "Sync RDP terminee"
Write-Host "Historique: $HistoryFile"
Write-Host "Status: $StatusFile"
Write-Host "Etat poste: $etat"
Write-Host "Sessions actives: $nbSessions"
Write-Host "======================================"