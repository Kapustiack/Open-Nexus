import { app, BrowserWindow, dialog } from 'electron';
import { createWindow } from './window';
import { initTerminal } from './terminal';
import { initFileSystem } from './file-system';
import { checkForUpdates } from '../shared/updater';
import './ipc';
import './config';
import './workspace';
import './ai-agent';
import './piper';

app.whenReady().then(async () => {
  try {
    const updated = await checkForUpdates(true);
    if (updated) {
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Open Nexus Updated',
        message: 'Open Nexus has been updated, please wait for installation. Installation complete. Please restart Open Nexus to apply changes.',
      });
    }
  } catch (e) {
    console.error('Update check failed:', e);
  }

  const window = createWindow();

  initTerminal(window);
  initFileSystem(window);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow();
      initTerminal(win);
      initFileSystem(win);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
