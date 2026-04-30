# ==========================================
# Notify active RDP user
# ==========================================

$message = "Un autre employe a demande l'acces au poste principal. Merci de terminer votre travail des que possible."

try {
    $sessions = query user 2>$null

    foreach ($line in $sessions) {
        $cleanLine = $line.Trim()

        # Detecter session RDP active FR/EN
        if (
            $cleanLine -match "rdp-tcp" -and
            (
                $cleanLine -match "Actif" -or
                $cleanLine -match "Active"
            )
        ) {
            # Exemple ligne:
            # >autocad_user   rdp-tcp#0   1   Actif   .   30/04/2026 11:12

            $parts = $cleanLine -split "\s+"

            # Chercher ID numerique dans la ligne
            $sessionId = $null

            foreach ($p in $parts) {
                if ($p -match "^\d+$") {
                    $sessionId = $p
                    break
                }
            }

            if ($sessionId) {
                msg $sessionId $message
                Write-Host "Notification envoyee a la session ID: $sessionId"
                exit 0
            }
        }
    }

    Write-Host "Aucune session RDP active trouvee."
}
catch {
    Write-Host "Erreur notification: $_"
}