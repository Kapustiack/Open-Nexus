import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ToolExecutionOptions {
  workspaceRoot: string;
  knownFiles: Set<string>;
  allowTerminal: boolean;
  recentMessages?: string[];
  requestApproval?: (question: string) => Promise<boolean>;
  jailbreak?: boolean;
}

function extractMentionedFilePaths(messages: string[]): string[] {
  const joined = messages.join('\n');
  const matches = joined.match(/[A-Za-z0-9_./\\-]+\.[A-Za-z0-9_]+/g) || [];
  return Array.from(new Set(matches));
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function findClosestMentionedPath(targetPath: string, mentionedPaths: string[], workspaceRoot: string): string | null {
  const targetBase = path.basename(targetPath).toLowerCase();
  let best: { candidate: string; score: number } | null = null;

  for (const candidate of mentionedPaths) {
    const candidateBase = path.basename(candidate).toLowerCase();
    if (path.extname(candidateBase) !== path.extname(targetBase)) continue;

    const score = levenshtein(targetBase, candidateBase);
    if (score <= 2 && (!best || score < best.score)) {
      best = { candidate, score };
    }
  }

  if (!best) return null;
  return path.isAbsolute(best.candidate) ? best.candidate : path.join(workspaceRoot, best.candidate);
}

function sortToolsForExecution(tools: any[]): any[] {
  const priorities: Record<string, number> = {
    list_files: 1,
    read_file: 2,
    create_directory: 3,
    diff: 4,
    edit_file_ops: 4,
    patch: 5,
    write_file: 6,
    terminal: 7,
    delete_path: 8,
  };

  const sorted = [...tools].sort((a, b) => (priorities[a.type] || 99) - (priorities[b.type] || 99));
  const deferredDeletes = sorted.filter((tool) => tool.type === 'delete_path');
  const remaining = sorted.filter((tool) => tool.type !== 'delete_path');
  return [...remaining, ...deferredDeletes];
}

function resolvePath(workspaceRoot: string, targetPath: string, jailbreak = false): string {
  if (!targetPath) throw new Error('Path is required.');
  const fullPath = path.isAbsolute(targetPath) ? path.normalize(targetPath) : path.normalize(path.join(workspaceRoot, targetPath));

  if (jailbreak) return fullPath;

  const normalizedRoot = path.normalize(workspaceRoot + path.sep);
  if (!fullPath.startsWith(normalizedRoot) && fullPath !== path.normalize(workspaceRoot)) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }
  return fullPath;
}

function scanDirectory(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const fullPath = path.join(dirPath, entry.name);
    output.push(`${entry.isDirectory() ? 'DIR' : 'FILE'}: ${path.relative(dirPath, fullPath) || entry.name}`);
  }

  return output.sort();
}

function applyDiffToContent(content: string, changes: Array<{ search: string; replace: string }>): string {
  let updated = content.replace(/\r\n/g, '\n');

  for (const change of changes) {
    const search = (change.search || '').replace(/\r\n/g, '\n');
    const replace = (change.replace || '').replace(/\r\n/g, '\n');

    if (search.trim() === '[EMPTY]' || search === '') {
      const trimmedAppend = replace.trim();
      if (trimmedAppend && updated.trimEnd().endsWith(trimmedAppend)) {
        continue;
      }
      updated = updated.length === 0 || updated.endsWith('\n') ? `${updated}${replace}` : `${updated}\n${replace}`;
      continue;
    }

    if (updated.includes(search)) {
      updated = updated.replace(search, replace);
      continue;
    }

    const contentLines = updated.split('\n');
    const searchLines = search.split('\n');
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

    if (foundIndex === -1) {
      throw new Error(`Search block not found for diff change.`);
    }

    contentLines.splice(foundIndex, searchLines.length, replace);
    updated = contentLines.join('\n');
  }

  return updated;
}

function applyLineOperations(content: string, operations: any[]): string {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  for (const operation of operations) {
    if (operation.type === 'append') {
      const appendText = (operation.content || '').replace(/\r\n/g, '\n');
      const trimmedAppend = appendText.trim();
      if (trimmedAppend && lines.join('\n').trimEnd().endsWith(trimmedAppend)) {
        continue;
      }
      const appendLines = appendText.split('\n');
      if (lines.length === 1 && lines[0] === '') lines.splice(0, 1, ...appendLines);
      else lines.push(...appendLines);
      continue;
    }

    const index = Math.max(0, (operation.position || 1) - 1);
    if (operation.type === 'add_line') {
      lines.splice(index, 0, ...(operation.content || '').replace(/\r\n/g, '\n').split('\n'));
    } else if (operation.type === 'replace_line') {
      lines.splice(index, 1, ...(operation.content || '').replace(/\r\n/g, '\n').split('\n'));
    } else if (operation.type === 'remove_line') {
      if (index < lines.length) lines.splice(index, 1);
    }
  }

  return lines.join('\n');
}

async function runTerminalCommand(command: string, workspaceRoot: string): Promise<string> {
  const cleanedCommand = command
    .replace(/^[^\S\r\n]*tag:\s*/i, '')
    .replace(/<run>([\s\S]*?)<\/run>/i, '$1')
    .trim();

  return new Promise((resolve) => {
    const proc = spawn(cleanedCommand, {
      cwd: workspaceRoot,
      shell: process.platform === 'win32' ? 'powershell.exe' : true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      resolve(`[COMMAND EXIT ${code}]\n${stdout}${stderr}`.trim());
    });
  });
}

export async function executeTools(tools: any[], options: ToolExecutionOptions): Promise<string> {
  const results: string[] = [];
  const mentionedPaths = extractMentionedFilePaths(options.recentMessages || []);

  for (const tool of sortToolsForExecution(tools)) {
    try {
      if (tool.type === 'list_files') {
        results.push(`[DIRECTORY LISTING]\n${scanDirectory(options.workspaceRoot).join('\n')}`);
        continue;
      }

      if (tool.type === 'read_file') {
        const fullPath = resolvePath(options.workspaceRoot, tool.payload, options.jailbreak);
        const content = fs.readFileSync(fullPath, 'utf-8');
        options.knownFiles.add(tool.payload);
        options.knownFiles.add(fullPath);
        results.push(`[FILE CONTENT: ${tool.payload}]\n${content}`);
        continue;
      }

      if (tool.type === 'create_directory') {
        fs.mkdirSync(resolvePath(options.workspaceRoot, tool.payload, options.jailbreak), { recursive: true });
        results.push(`[DIRECTORY CREATED: ${tool.payload}]`);
        continue;
      }

      if (tool.type === 'delete_path') {
        const fullPath = resolvePath(options.workspaceRoot, tool.payload, options.jailbreak);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) fs.rmSync(fullPath, { recursive: true, force: false });
        else fs.unlinkSync(fullPath);
        results.push(`[PATH DELETED: ${tool.payload}]`);
        continue;
      }

      if (tool.type === 'write_file') {
        let toolPath = tool.payload.path;
        const initialFullPath = resolvePath(options.workspaceRoot, toolPath, options.jailbreak);
        if (!fs.existsSync(initialFullPath)) {
          const remapped = findClosestMentionedPath(toolPath, mentionedPaths, options.workspaceRoot);
          if (remapped) {
            const remappedFullPath = resolvePath(options.workspaceRoot, remapped, options.jailbreak);
            if (fs.existsSync(remappedFullPath)) {
              toolPath = remapped;
            }
          }
        }

        const fullPath = resolvePath(options.workspaceRoot, toolPath, options.jailbreak);
        const existed = fs.existsSync(fullPath);
        if (existed && !options.knownFiles.has(toolPath) && !options.knownFiles.has(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          options.knownFiles.add(toolPath);
          options.knownFiles.add(fullPath);
          results.push(`[READ REQUIRED BEFORE EDIT: ${toolPath}]\n${content}\n\nPlease read the file first, then propose the edit again with an exact diff.`);
          continue;
        }

        if (existed) {
          const existing = fs.readFileSync(fullPath, 'utf-8').replace(/\r\n/g, '\n');
          let incoming = (tool.payload.content || '').replace(/\r\n/g, '\n');
          const existingTrimmed = existing.trim();
          const incomingTrimmed = incoming.trim();
          const preservesExistingContent = existingTrimmed.length === 0 || incoming.includes(existingTrimmed);
          const likelyOverwrite = incomingTrimmed.length > 0 && incoming !== existing && !preservesExistingContent;
          if (likelyOverwrite) {
            results.push(`[WRITE BLOCKED FOR EXISTING FILE: ${toolPath}]\nExisting file edits must use read + diff/patch instead of replacing the whole file.\n[FILE CONTENT: ${toolPath}]\n${existing}`);
            continue;
          }

          if (!existing.startsWith('\n') && incoming.startsWith('\n')) {
            incoming = incoming.replace(/^\n+/, '');
          }

          fs.writeFileSync(fullPath, incoming, 'utf-8');
          results.push(`[SUCCESSFULLY WRITTEN: ${toolPath}]`);
          continue;
        }
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, tool.payload.content, 'utf-8');
        results.push(`[SUCCESSFULLY WRITTEN: ${toolPath}]`);
        continue;
      }

      if (tool.type === 'patch') {
        const fullPath = resolvePath(options.workspaceRoot, tool.payload.path, options.jailbreak);
        const existing = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
        if (existing && !options.knownFiles.has(tool.payload.path) && !options.knownFiles.has(fullPath)) {
          options.knownFiles.add(tool.payload.path);
          options.knownFiles.add(fullPath);
          results.push(`[READ REQUIRED BEFORE EDIT: ${tool.payload.path}]\n${existing}\n\nPlease read the file first, then propose the edit again with an exact diff.`);
          continue;
        }
        const next = existing && !existing.endsWith('\n') ? `${existing}\n${tool.payload.content}` : `${existing}${tool.payload.content}`;
        fs.writeFileSync(fullPath, next, 'utf-8');
        results.push(`[PATCH APPLIED: ${tool.payload.path}]`);
        continue;
      }

      if (tool.type === 'diff') {
        const fullPath = resolvePath(options.workspaceRoot, tool.payload.path, options.jailbreak);
        const existing = fs.readFileSync(fullPath, 'utf-8');
        if (!options.knownFiles.has(tool.payload.path) && !options.knownFiles.has(fullPath)) {
          options.knownFiles.add(tool.payload.path);
          options.knownFiles.add(fullPath);
          results.push(`[READ REQUIRED BEFORE EDIT: ${tool.payload.path}]\n${existing}\n\nPlease read the file first, then propose the edit again with an exact diff.`);
          continue;
        }
        const next = applyDiffToContent(existing, tool.payload.changes);
        fs.writeFileSync(fullPath, next, 'utf-8');
        results.push(`[DIFF APPLIED: ${tool.payload.path}]`);
        continue;
      }

      if (tool.type === 'edit_file_ops') {
        const fullPath = resolvePath(options.workspaceRoot, tool.payload.path, options.jailbreak);
        const existing = fs.readFileSync(fullPath, 'utf-8');
        if (!options.knownFiles.has(tool.payload.path) && !options.knownFiles.has(fullPath)) {
          options.knownFiles.add(tool.payload.path);
          options.knownFiles.add(fullPath);
          results.push(`[READ REQUIRED BEFORE EDIT: ${tool.payload.path}]\n${existing}\n\nPlease read the file first, then propose the edit again with an exact diff.`);
          continue;
        }

        const next = applyLineOperations(existing, tool.payload.operations || []);
        fs.writeFileSync(fullPath, next, 'utf-8');
        results.push(`[DIRECT EDIT APPLIED: ${tool.payload.path}]`);
        continue;
      }

      if (tool.type === 'terminal') {
        if (!options.allowTerminal) {
          results.push(`[TERMINAL BLOCKED]\n${tool.payload}`);
          continue;
        }

        const approved = options.requestApproval ? await options.requestApproval(`Run terminal command?\n${tool.payload}`) : true;
        if (!approved) {
          results.push(`[TERMINAL DECLINED]\n${tool.payload}`);
          continue;
        }

        const output = await runTerminalCommand(tool.payload, options.workspaceRoot);
        results.push(output);
        continue;
      }
    } catch (error: any) {
      const targetPath = tool?.payload?.path || tool?.payload || '(unknown target)';
      let details = error?.message || String(error);

      if (tool.type === 'diff' || tool.type === 'edit_file_ops' || tool.type === 'patch' || tool.type === 'write_file') {
        try {
          const fullPath = resolvePath(options.workspaceRoot, tool?.payload?.path || tool?.payload, options.jailbreak);
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const current = fs.readFileSync(fullPath, 'utf-8');
            options.knownFiles.add(tool?.payload?.path || tool?.payload);
            options.knownFiles.add(fullPath);
            details += `\n[FILE CONTENT: ${targetPath}]\n${current}`;
          }
        } catch {
        }
      }

      results.push(`[TOOL ERROR: ${tool.type} ${targetPath}]\n${details}`);
    }
  }

  return results.join('\n\n');
}
