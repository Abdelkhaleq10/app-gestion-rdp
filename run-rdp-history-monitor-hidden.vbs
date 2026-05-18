Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c cd /d C:\AppWeb && node rdp-history-monitor.js", 0, False