import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.send('save-config', config),

  openWorkspace: () => ipcRenderer.invoke('open-workspace'),
  refreshWorkspace: () => ipcRenderer.invoke('refresh-workspace'),
  pathExists: (path: string) => ipcRenderer.invoke('path-exists', path),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', { filePath: path, content }),
  createDirectory: (path: string) => ipcRenderer.invoke('create-directory', path),
  deletePath: (path: string) => ipcRenderer.invoke('delete-path', path),
  applyPatch: (payload: any) => ipcRenderer.invoke('patch', payload),
  applyDiff: (payload: any) => ipcRenderer.invoke('apply-diff', payload),

  chat: (messages: any[]) => ipcRenderer.invoke('ai-chat', messages),
  terminalFeedback: (payload: any) => ipcRenderer.invoke('terminal-feedback', payload),
  fetchModels: (payload: any) => ipcRenderer.invoke('fetch-models', payload),

  sendTerminalInput: (data: string, sessionId?: string | null) => ipcRenderer.send('terminal-input', { data, sessionId }),
  runProposedCommand: (command: string, sessionId?: string | null) => ipcRenderer.send('run-proposed-command', { command, sessionId }),
  onTerminalData: (callback: (data: string) => void) => {
    const subscription = (event: any, data: string) => callback(data);
    ipcRenderer.on('terminal-data', subscription);
    return () => ipcRenderer.removeListener('terminal-data', subscription);
  },

  generateSpeech: (payload: any) => ipcRenderer.invoke('generate-speech', payload),
  getPiperVoices: () => ipcRenderer.invoke('get-piper-voices')
});
