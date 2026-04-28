import { BrowserWindow } from 'electron';
import * as path from 'path';

export let mainWindow: BrowserWindow | null = null;

export function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#050506',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  return mainWindow;
}
