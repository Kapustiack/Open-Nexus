import { ipcMain, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';

let shellProcesses = new Map<string, any>();
let mainWindow: BrowserWindow | null = null;
let terminalBuffers = new Map<string, string[]>();

function stripAnsi(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g, '');
}

function getProcess(sessionId: string): any {
  if (!shellProcesses.has(sessionId)) {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const startingDir = os.homedir() || process.cwd();

    const proc = spawn(shell, [], {
      cwd: startingDir,
      env: process.env,
      shell: true
    });

    proc.stdout.on('data', (data: any) => {
      const text = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-data', { sessionId, data: text });
        const clean = stripAnsi(text);
        if (clean.trim()) {
          let buffer = terminalBuffers.get(sessionId) || [];
          buffer.push(clean.trim());
          if (buffer.length > 100) buffer.shift();
          terminalBuffers.set(sessionId, buffer);
        }
      }
    });

    proc.stderr.on('data', (data: any) => {
      const text = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-data', { sessionId, data: text });
      }
    });

    proc.on('exit', () => {
      shellProcesses.delete(sessionId);
      terminalBuffers.delete(sessionId);
    });

    shellProcesses.set(sessionId, proc);
  }
  return shellProcesses.get(sessionId);
}

function analyzeOutput(sessionId: string) {
  const buffer = terminalBuffers.get(sessionId);
  if (!buffer || buffer.length === 0) return;

  const recentOutput = buffer.slice(-20).join('\n');
  const errorRegex = /\b(error:|exception:|failed\b|command not found|is not recognized|exit status \d+|cannot find the path|is not a recognized command)\b/i;

  if (errorRegex.test(recentOutput)) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-error-detected', { sessionId, output: recentOutput });
    }
  }
}

export function initTerminal(window: BrowserWindow) {
  mainWindow = window;

  ipcMain.on('terminal-input', (event, arg) => {
    const sessionId = (arg && typeof arg === 'object') ? arg.sessionId : null;
    const data = (arg && typeof arg === 'object') ? arg.data : arg;

    if (data !== undefined && data !== null) {
      const proc = getProcess(sessionId || 'default');
      if (proc && proc.stdin) {
        proc.stdin.write(data.toString());
        setTimeout(() => analyzeOutput(sessionId || 'default'), 1000);
      }
    }
  });

  ipcMain.on('run-proposed-command', (event, arg) => {
    const sessionId = (arg && typeof arg === 'object') ? arg.sessionId : null;
    const command = (arg && typeof arg === 'object') ? arg.command : arg;

    if (command) {
      const proc = getProcess(sessionId || 'default');
      if (proc && proc.stdin) {
        const isWin = os.platform() === 'win32';
        const wrappedCommand = isWin
          ? `& { ${command} }; $nexus_res = $?; Start-Sleep -m 500; if ($nexus_res) { Write-Host "\`nSUCCESSFUL\`n" } else { Write-Host "\`nNAH\`n" }`
          : `{ ${command} ; } ; nexus_res=$? ; sleep 0.5; [ $nexus_res -eq 0 ] && echo -e "\nSUCCESSFUL\n" || echo -e "\nNAH\n"`;

        proc.stdin.write(`\r\n${wrappedCommand}\r\n`);
      }
    }
  });

  ipcMain.on('set-terminal-cwd', (event, arg) => {
    const sessionId = (arg && typeof arg === 'object') ? arg.sessionId : null;
    const dir = (arg && typeof arg === 'object') ? arg.dir : arg;

    if (dir) {
      const proc = getProcess(sessionId || 'default');
      if (proc && proc.stdin) {
        proc.stdin.write(`cd "${dir}"\r\n`);
      }
    }
  });

  ipcMain.on('close-terminal-session', (event, sessionId) => {
    if (sessionId) {
      const proc = shellProcesses.get(sessionId);
      if (proc) {
        proc.kill();
        shellProcesses.delete(sessionId);
        terminalBuffers.delete(sessionId);
      }
    }
  });
}
