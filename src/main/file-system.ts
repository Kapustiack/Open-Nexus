import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getCurrentWorkspacePath } from './workspace';

function resolveWorkspacePath(targetPath: string): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('A valid path is required.');
  }

  if (path.isAbsolute(targetPath)) {
    return path.normalize(targetPath);
  }

  const workspacePath = getCurrentWorkspacePath();
  if (!workspacePath) {
    throw new Error('No workspace is currently selected.');
  }

  const resolvedPath = path.normalize(path.join(workspacePath, targetPath));
  const normalizedWorkspace = path.normalize(workspacePath + path.sep);

  if (!resolvedPath.startsWith(normalizedWorkspace) && resolvedPath !== path.normalize(workspacePath)) {
    throw new Error('Path escapes the active workspace.');
  }

  return resolvedPath;
}

export function initFileSystem(mainWindow: any) {
  ipcMain.handle('path-exists', async (event, targetPath) => {
    try {
      const fullPath = resolveWorkspacePath(targetPath);
      const exists = fs.existsSync(fullPath);
      const isDirectory = exists ? fs.statSync(fullPath).isDirectory() : false;
      return { exists, isDirectory, fullPath };
    } catch (e) {
      return { exists: false, isDirectory: false, error: `${e}` };
    }
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const fullPath = resolveWorkspacePath(filePath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (e) {
      return `Error reading file: ${e}`;
    }
  });

  ipcMain.handle('write-file', async (event, payload) => {
    try {
      const filePath = payload?.path ?? payload?.filePath;
      const content = payload?.content ?? '';
      const fullPath = resolveWorkspacePath(filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true, updatedContent: content };
    } catch (e) {
      return { success: false, error: `${e}` };
    }
  });

  ipcMain.handle('create-directory', async (event, dirPath) => {
    try {
      const fullPath = resolveWorkspacePath(dirPath);
      fs.mkdirSync(fullPath, { recursive: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: `${e}` };
    }
  });

  ipcMain.handle('delete-path', async (event, targetPath) => {
    try {
      const fullPath = resolveWorkspacePath(targetPath);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `Path not found: ${targetPath}` };
      }

      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: false });
      } else {
        fs.unlinkSync(fullPath);
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: `${e}` };
    }
  });

  ipcMain.handle('patch', async (event, { path: filePath, content: appendContent }) => {
    try {
      const fullPath = resolveWorkspacePath(filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';

      if (content && !content.endsWith('\n')) content += '\n';
      content += appendContent;

      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true, updatedContent: content };
    } catch (e) {
      return { success: false, error: `${e}` };
    }
  });

  ipcMain.handle('apply-diff', async (event, { path: filePath, changes }) => {
    try {
      const fullPath = resolveWorkspacePath(filePath);
      let content = fs.readFileSync(fullPath, 'utf-8');

      for (const change of changes) {
        const normalizedReplace = change.replace.replace(/\r\n/g, '\n');
        const searchRaw = typeof change.search === 'string' ? change.search : '';
        const normalizedSearch = searchRaw.replace(/\r\n/g, '\n');

        if (normalizedSearch.trim() === '[EMPTY]' || normalizedSearch === '') {
          if (!content.endsWith('\n') && content.length > 0) content += '\n';
          content += normalizedReplace;
          continue;
        }

        const normalizedContent = content.replace(/\r\n/g, '\n');

        if (normalizedContent.includes(normalizedSearch)) {
          content = normalizedContent.replace(normalizedSearch, normalizedReplace);
        } else {
          const contentLines = normalizedContent.split('\n');
          const searchLines = normalizedSearch.split('\n');

          let foundIndex = -1;
          for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
            let match = true;
            for (let j = 0; j < searchLines.length; j++) {
              if (contentLines[i + j].trim() !== searchLines[j].trim()) {
                match = false;
                break;
              }
            }
            if (match) {
              foundIndex = i;
              break;
            }
          }

          if (foundIndex !== -1) {
            contentLines.splice(foundIndex, searchLines.length, normalizedReplace);
            content = contentLines.join('\n');
          } else {
            return { success: false, error: `CRITICAL: Search block not found in ${filePath}. Ensure you provide enough context in the SEARCH block.` };
          }
        }
      }

      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true, updatedContent: content };
    } catch (e) {
      return { success: false, error: `${e}` };
    }
  });
}
