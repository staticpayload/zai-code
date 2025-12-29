import { execSync } from 'child_process';
import * as path from 'path';

export interface GitInfo {
  isRepo: boolean;
  branch: string | null;
  isDirty: boolean;
  uncommittedFiles: number;
  repoName: string | null;
}

export function getGitInfo(cwd: string): GitInfo {
  const result: GitInfo = {
    isRepo: false,
    branch: null,
    isDirty: false,
    uncommittedFiles: 0,
    repoName: null,
  };

  try {
    // Check if git repo
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
    result.isRepo = true;

    // Get repo name from remote or folder
    try {
      const remote = execSync('git remote get-url origin', { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim();
      const match = remote.match(/\/([^\/]+?)(\.git)?$/);
      result.repoName = match ? match[1] : path.basename(cwd);
    } catch {
      result.repoName = path.basename(cwd);
    }

    // Get branch
    try {
      result.branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim();
    } catch {
      result.branch = 'unknown';
    }

    // Check dirty state
    try {
      const status = execSync('git status --porcelain', { cwd, stdio: 'pipe', encoding: 'utf-8' });
      const lines = status.trim().split('\n').filter(l => l.length > 0);
      result.uncommittedFiles = lines.length;
      result.isDirty = lines.length > 0;
    } catch {
      // Ignore
    }
  } catch {
    // Not a git repo
  }

  return result;
}

export function formatGitStatus(info: GitInfo): string {
  if (!info.isRepo) return 'no git';
  const dirty = info.isDirty ? '*' : '';
  return `${info.repoName || 'repo'}:${info.branch}${dirty}`;
}
