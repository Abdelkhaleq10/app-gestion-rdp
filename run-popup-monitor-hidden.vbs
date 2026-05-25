Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c cd /d C:\AppWeb && node popup-rdp-request.js", 0, False