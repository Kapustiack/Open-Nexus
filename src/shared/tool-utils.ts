import * as path from 'path';

export function extractMentionedFilePaths(messages: string[]): string[] {
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

export function findClosestMentionedPath(targetPath: string, mentionedPaths: string[], workspaceRoot: string): string | null {
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

export function sortToolsForExecution(tools: any[]): any[] {
  const priorities: Record<string, number> = {
    list_files: 1,
    read_file: 2,
    create_directory: 3,
    diff: 4,
    edit_file_ops: 4,
    patch: 5,
    write_file: 6,
    delete_path: 7,
    terminal: 8,
  };

  return [...tools].sort((a, b) => (priorities[a.type] || 99) - (priorities[b.type] || 99));
}
