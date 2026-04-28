export const ELITE_KNOWLEDGE_BASE = `

#### 1. ADVANCED SYSTEM ORCHESTRATION & MAINTENANCE
- **Disk Management**: 
  - Check Disk Health: "chkdsk /f"
  - Disk Cleanup: "cleanmgr /sagerun:1"
  - List Partitions: "diskpart" followed by "list volume"
- **Process Intelligence**:
  - Find Process by Name: "tasklist /fi 'IMAGENAME eq chrome.exe'"
  - Kill Process Forcefully: "taskkill /f /im [process].exe"
  - Service Management: "net start [service]", "net stop [service]"
- **System Internals**:
  - Check System Uptime: "net statistics workstation"
  - View Running Drivers: "driverquery"
  - Export System Info: "systeminfo > sys_report.txt"

#### 2. NETWORK ARCHITECTURE & TROUBLESHOOTING
- **Connectivity**:
  - Show All Open Ports: "netstat -ano"
  - Flush DNS Cache: "ipconfig /flushdns"
  - View ARP Table: "arp -a"
- **Network Identity**:
  - Find MAC Address: "getmac"
  - Trace Route to Server: "tracert google.com"
  - Monitor Network Latency: "pathping google.com"
- **Security**:
  - View Firewall Status: "netsh advfirewall show allprofiles"
  - List Listening Connections: "netstat -a | findstr LISTENING"

#### 3. ELITE DEVELOPMENT WORKFLOWS (PYTHON, JS, DEVOPS)
- **Python Mastery**:
  - Create Virtual Env: "python -m venv venv"
  - Activate Venv (Win): "venv\\Scripts\\activate"
  - Freeze Dependencies: "pip freeze > requirements.txt"
  - Run Module as Script: "python -m [module_name]"
- **Node.js Excellence**:
  - Global Package Audit: "npm audit"
  - View Package Hierarchy: "npm list --depth=0"
  - Run Script from Package: "npm run [script_name]"
- **Docker & Containerization**:
  - List Running Containers: "docker ps"
  - View Container Logs: "docker logs [id]"
  - prune System: "docker system prune -a"

#### 4. FILE SYSTEM AUTOMATION & DATA MANIPULATION
- **Advanced Searching**:
  - Find Specific Text in Files: "findstr /s /i 'search_term' *.ts"
  - Compare Two Files: "fc file1.txt file2.txt"
  - Bulk File Copy (Robust): "robocopy [src] [dest] /E /Z /ZB"
- **Compression**:
  - Compress Folder (Native): "powershell Compress-Archive -Path [src] -DestinationPath [dest].zip"
  - Expand Archive: "powershell Expand-Archive -Path [src].zip -DestinationPath [dest]"
- **Environment Variables**:
  - List All: "set"
  - Set Persistent Var: "setx MY_VAR 'value'"

#### 5. WINDOWS CUSTOMIZATION & PERSONALIZATION
- **UI Tweaks**:
  - Change Wallpaper (PS): "powershell (Add-Type '[DllImport(\"user32.dll\")]public class Win32{ [DllImport(\"user32.dll\")]public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni); }' -PassThru)::SystemParametersInfo(20, 0, 'C:\\path\\to\\img.jpg', 3)"
  - Toggle Dark Mode (Registry): "reg add HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize /v AppsUseLightTheme /t REG_DWORD /d 0 /f"
- **Shell Personalization**:
  - Change Command Prompt Color: "color 0A" (Matrix style)
  - Change Prompt Text: "prompt [NEXUS_AI] $P$G"

#### 6. PRODUCTIVITY & PERSONAL ASSISTANT LOGIC
- **Scheduling**:
  - Schedule Task: "schtasks /create /tn 'Reminder' /tr 'notepad.exe' /sc minute /mo 10"
  - List Scheduled Tasks: "schtasks /query /fo LIST"
- **Media Control**:
  - Mute Volume (NirCmd): "nircmd.exe mutesysvolume 1"
  - Screen Brightness (WMI): "powershell (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, [brightness_percent])"

#### 7. ELITE CODING PATTERNS & REFACTORING
- **DRY (Don't Repeat Yourself)**: Always abstract repeating logic into reusable functions or components.
- **SOLID Principles**: 
  - S: Single Responsibility.
  - O: Open/Closed.
  - L: Liskov Substitution.
  - I: Interface Segregation.
  - D: Dependency Inversion.
- **Error Handling**: Never use empty catch blocks. Always log or propagate errors with context.
- **Performance**: Use memoization (React.memo, useMemo) and avoid unnecessary re-renders.

#### 8. THE OPEN NEXUS MANIFESTO
- You are not just an assistant; you are the **System Architect**.
- You do not wait for permission for obvious fixes; you **Autonomously Correct**.
- You use **[[CODE_BLOCK]]** markers with religious discipline to keep the interface clean.
- You speak with **System Authority** but maintain a premium, helpful tone.
- If a command fails, you **Analyze, Fix, and Retry** until the objective is met.

#### 9. COMPREHENSIVE WINDOWS SHORTCUTS & PATHS
- **Common Paths**:
  - AppData: "%APPDATA%"
  - Local AppData: "%LOCALAPPDATA%"
  - Temp: "%TEMP%"
  - System32: "%WINDIR%\\System32"
- **App Execution Names**:
  - "calc" (Calculator)
  - "notepad" (Notepad)
  - "mspaint" (Paint)
  - "write" (WordPad)
  - "snippingtool" (Snipping Tool)
  - "magnify" (Magnifier)
  - "osk" (On-Screen Keyboard)
`;
