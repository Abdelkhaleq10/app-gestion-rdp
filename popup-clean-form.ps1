Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$responseDir = "C:\Logs\RDP_Request_Responses"
$currentFile = Join-Path $responseDir "popup-current.json"

if (!(Test-Path $currentFile)) { exit }

try {
    $data = Get-Content $currentFile -Raw | ConvertFrom-Json
} catch {
    exit
}

$requestId = [int]$data.requestId
$token = [string]$data.popupToken
$secondsLeft = 60

$form = New-Object System.Windows.Forms.Form
$form.Text = "POPUP_RDP_UNIQUE_2026"
$form.Width = 650
$form.Height = 360
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$title = New-Object System.Windows.Forms.Label
$title.Text = "Un collegue demande l'acces au poste principal."
$title.Left = 30
$title.Top = 25
$title.Width = 580
$title.Height = 35
$title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)

$details = New-Object System.Windows.Forms.Label
$details.Left = 30
$details.Top = 75
$details.Width = 580
$details.Height = 110
$details.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$details.Text =
"Employe : $($data.employee)`r`n" +
"Priorite : $($data.priority)`r`n" +
"Motif : $($data.reason)`r`n" +
"Message : $($data.message)"

$question = New-Object System.Windows.Forms.Label
$question.Text = "Voulez-vous liberer la session ?"
$question.Left = 30
$question.Top = 190
$question.Width = 580
$question.Height = 25
$question.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)

$info = New-Object System.Windows.Forms.Label
$info.Text = "Expiration automatique dans 60 secondes. Si une demande plus prioritaire arrive, cette fenetre sera remplacee."
$info.Left = 30
$info.Top = 225
$info.Width = 580
$info.Height = 35
$info.ForeColor = [System.Drawing.Color]::FromArgb(29, 78, 216)

$timerLabel = New-Object System.Windows.Forms.Label
$timerLabel.Text = "Expiration dans 60 secondes"
$timerLabel.Left = 30
$timerLabel.Top = 285
$timerLabel.Width = 260
$timerLabel.Height = 30

$yesBtn = New-Object System.Windows.Forms.Button
$yesBtn.Text = "Oui"
$yesBtn.Left = 390
$yesBtn.Top = 275
$yesBtn.Width = 100
$yesBtn.Height = 40
$yesBtn.BackColor = [System.Drawing.Color]::FromArgb(22, 163, 74)
$yesBtn.ForeColor = [System.Drawing.Color]::White

$noBtn = New-Object System.Windows.Forms.Button
$noBtn.Text = "Non"
$noBtn.Left = 510
$noBtn.Top = 275
$noBtn.Width = 100
$noBtn.Height = 40
$noBtn.BackColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
$noBtn.ForeColor = [System.Drawing.Color]::White

function Send-Answer($answer) {
    try {
        $responseFile = Join-Path $responseDir ("request_" + $requestId + ".txt")
        Set-Content -Path $responseFile -Value $answer -Encoding UTF8 -Force
    } catch {}
    $form.Close()
}

$yesBtn.Add_Click({ Send-Answer "YES" })
$noBtn.Add_Click({ Send-Answer "NO" })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({
    try {
        if (!(Test-Path $currentFile)) {
            $form.Close()
            return
        }

        $current = Get-Content $currentFile -Raw | ConvertFrom-Json

        if ([int]$current.requestId -ne $requestId) {
            $form.Close()
            return
        }

        if ([string]$current.popupToken -ne $token) {
            $form.Close()
            return
        }
    } catch {
        $form.Close()
        return
    }

    $script:secondsLeft--
    if ($script:secondsLeft -lt 0) { $script:secondsLeft = 0 }

    $timerLabel.Text = "Expiration dans $script:secondsLeft secondes"

    if ($script:secondsLeft -le 0) {
        Send-Answer "TIMEOUT"
    }
})

$form.Controls.Add($title)
$form.Controls.Add($details)
$form.Controls.Add($question)
$form.Controls.Add($info)
$form.Controls.Add($timerLabel)
$form.Controls.Add($yesBtn)
$form.Controls.Add($noBtn)

$timer.Start()
[void]$form.ShowDialog()