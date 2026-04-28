import { ipcMain } from 'electron';
import { AppConfig, loadSharedConfig, saveSharedConfig } from '../shared/config-store';

export type { AppConfig };

export function loadConfig(): AppConfig {
  return loadSharedConfig();
}

export function saveConfig(config: AppConfig) {
  saveSharedConfig(config);
}

ipcMain.handle('get-config', () => loadConfig());
ipcMain.on('save-config', (event, config: AppConfig) => saveConfig(config));
