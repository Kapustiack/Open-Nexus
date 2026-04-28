import { dialog, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

let currentWorkspacePath: string | null = null;

export function getCurrentWorkspacePath(): string | null {
  return currentWorkspacePath;
}

export async function selectWorkspace(window: BrowserWindow) {
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  currentWorkspacePath = result.filePaths[0];
  return {
    path: currentWorkspacePath,
    tree: scanDirectory(currentWorkspacePath)
  };
}

export function refreshWorkspace() {
  if (!currentWorkspacePath) return null;
  return {
    path: currentWorkspacePath,
    tree: scanDirectory(currentWorkspacePath)
  };
}

function scanDirectory(dirPath: string): FileNode[] {
  try {
    const files = fs.readdirSync(dirPath);
    return files.map(file => {
      const fullPath = path.join(dirPath, file);
      const stats = fs.statSync(fullPath);
      const isDirectory = stats.isDirectory();

      const node: FileNode = {
        name: file,
        path: fullPath,
        isDirectory
      };

      if (isDirectory && !file.startsWith('.') && file !== 'node_modules') {
        node.children = scanDirectory(fullPath);
      }

      return node;
    }).sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (e) {
    console.error('Failed to scan directory', e);
    return [];
  }
}

ipcMain.handle('open-workspace', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    return await selectWorkspace(window);
  }
  return null;
});

ipcMain.handle('refresh-workspace', async () => {
  return refreshWorkspace();
});
