Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c cd /d C:\AppWeb && node rdp-realtime-monitor.js", 0, False