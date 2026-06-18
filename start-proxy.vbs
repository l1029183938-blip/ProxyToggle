Set ws = CreateObject("WScript.Shell")
curDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
psPath = curDir & "\clash-helper.ps1"
ws.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """", 0, False
