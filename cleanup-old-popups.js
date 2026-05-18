const { execFileSync } = require("child_process");

function runPowerShell(command) {
  try {
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { windowsHide: true, stdio: "ignore" }
    );
  } catch {}
}

function runCmd(command) {
  try {
    execFileSync("cmd.exe", ["/c", command], {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch {}
}

// Kill old classic popup by window title.
// Important: ma kay9isx RDP HTA POPUP.
runPowerShell(`
Get-Process -ErrorAction SilentlyContinue |
Where-Object {
  $_.MainWindowTitle -like "*Demande*RDP*" -and
  $_.MainWindowTitle -notlike "*RDP HTA POPUP*"
} |
ForEach-Object {
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
`);

// Backup method b taskkill window title.
runCmd('taskkill /F /FI "WINDOWTITLE eq Demande*d*acces*RDP*" /T');
runCmd('taskkill /F /FI "WINDOWTITLE eq Demande*d*accès*RDP*" /T');

// Kill any old PowerShell script launcher if it exists.
runPowerShell(`
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
Where-Object {
  $_.CommandLine -like "*show-rdp-popup.ps1*" -or
  $_.CommandLine -like "*run-popup-monitor-hidden.vbs*"
} |
ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
`);