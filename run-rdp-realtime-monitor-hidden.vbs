Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c cd /d C:\AppWeb && node rdp-realtime-monitor.js >> C:\Logs\rdp-realtime-monitor.log 2>>&1", 0, False