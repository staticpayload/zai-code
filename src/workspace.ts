import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceContext {
  root: string;
  files: Array<{ path: string; size: number }>;
  gitStatus?: string;
}

export interface CollectOptions {
  maxFiles?: number;
  maxFileSize?: number;
  extensions?: string[];
}

const DEFAULT_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css', '.html'];

const DEFAULT_MAX_FILES = 100;
const DEFAULT_MAX_FILE_SIZE = 100 * 1024;
const IGNORED_DIRS = ['node_modules', '.git', '.svn', 'dist', 'build', 'out', 'target', 'vendor', '.venv', 'venv', '__pycache__', '.next', '.nuxt'];

function shouldIgnore(dirName: string): boolean {
  return IGNORED_DIRS.includes(dirName);
}

function hasAllowedExtension(filePath: string, extensions: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return extensions.includes(ext);
}

export function collectWorkspace(rootPath: string, options?: CollectOptions): WorkspaceContext {
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const extensions = options?.extensions ?? DEFAULT_EXTENSIONS;

  const files: Array<{ path: string; size: number }> = [];

  function walkDirectory(dir: string): void {
    if (files.length >= maxFiles) {
      return;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= maxFiles) {
          break;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!shouldIgnore(entry.name)) {
            walkDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          if (hasAllowedExtension(entry.name, extensions)) {
            try {
              const stats = fs.statSync(fullPath);
              if (stats.size <= maxFileSize) {
                const relativePath = path.relative(rootPath, fullPath);
                files.push({ path: relativePath, size: stats.size });
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  walkDirectory(rootPath);

  let gitStatus: string | undefined;
  try {
    const gitDir = path.join(rootPath, '.git');
    if (fs.existsSync(gitDir)) {
      gitStatus = 'git';
    }
  } catch {
    // Not a git repo or can't check
  }

  return {
    root: rootPath,
    files,
    gitStatus,
  };
}

export function getFileContent(filePath: string, maxSize?: number): string | null {
  const max = maxSize ?? DEFAULT_MAX_FILE_SIZE;

  try {
    const stats = fs.statSync(filePath);
    if (stats.size > max) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function buildContextString(workspace: WorkspaceContext, includeContent?: boolean): string {
  let result = `Working directory: ${workspace.root}\n`;
  result += `Files (${workspace.files.length}):\n`;

  for (const file of workspace.files) {
    result += `  - ${file.path}\n`;
  }

  if (workspace.gitStatus) {
    result += `\nGit repository: ${workspace.gitStatus}\n`;
  }

  return result;
}
