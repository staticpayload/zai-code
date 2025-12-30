import * as fs from 'fs';
import * as path from 'path';
import { IntentType } from '../session';

export interface FileScore {
  path: string;
  score: number;
  size: number;
  extension: string;
}

export interface ContextResult {
  files: FileScore[];
  totalTokens: number;
  truncated: boolean;
}

// File extensions priority for code context
const EXTENSION_PRIORITY: Record<string, number> = {
  '.ts': 10,
  '.tsx': 10,
  '.js': 9,
  '.jsx': 9,
  '.py': 9,
  '.go': 9,
  '.rs': 9,
  '.java': 8,
  '.c': 8,
  '.cpp': 8,
  '.h': 7,
  '.hpp': 7,
  '.json': 6,
  '.yaml': 6,
  '.yml': 6,
  '.toml': 6,
  '.md': 5,
  '.txt': 4,
  '.css': 4,
  '.scss': 4,
  '.html': 4,
  '.sql': 5,
  '.sh': 5,
  '.bash': 5,
};

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'coverage',
  '.nyc_output',
  'vendor',
  '.zai',
]);

// Files to skip
const SKIP_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.DS_Store',
  'Thumbs.db',
]);

// Estimate tokens from content (rough: 1 token ≈ 4 chars)
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

// Index workspace files
export function indexWorkspace(workingDir: string, maxDepth: number = 5): FileScore[] {
  const files: FileScore[] = [];

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(workingDir, fullPath);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          walk(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;

        const ext = path.extname(entry.name).toLowerCase();
        const priority = EXTENSION_PRIORITY[ext] || 1;

        let size = 0;
        try {
          const stat = fs.statSync(fullPath);
          size = stat.size;
        } catch {
          continue;
        }

        // Skip very large files (> 100KB)
        if (size > 100000) continue;

        files.push({
          path: relativePath,
          score: priority,
          size,
          extension: ext,
        });
      }
    }
  }

  walk(workingDir, 0);
  return files;
}

// Score files based on relevance to intent
function scoreFileRelevance(file: FileScore, intent: string, intentType: IntentType): number {
  let score = file.score;
  const lowerPath = file.path.toLowerCase();
  const lowerIntent = intent.toLowerCase();

  // Boost files mentioned in intent
  const words = lowerIntent.split(/\s+/);
  for (const word of words) {
    if (word.length > 2 && lowerPath.includes(word)) {
      score += 5;
    }
  }

  // Boost based on intent type
  if (intentType === 'DEBUG' && (lowerPath.includes('test') || lowerPath.includes('spec'))) {
    score += 3;
  }
  if (intentType === 'REVIEW' && lowerPath.includes('readme')) {
    score += 2;
  }

  // Boost entry points
  if (lowerPath === 'index.ts' || lowerPath === 'index.js' || lowerPath === 'main.ts') {
    score += 2;
  }

  return score;
}

// Build context for API call
export function buildContext(
  workingDir: string,
  intent: string,
  intentType: IntentType,
  openFiles: string[] = [],
  maxTokens: number = 50000
): ContextResult {
  const allFiles = indexWorkspace(workingDir);

  // Score and sort files
  const scoredFiles = allFiles.map(f => ({
    ...f,
    score: scoreFileRelevance(f, intent, intentType),
  }));

  // Prioritize open files
  for (const openFile of openFiles) {
    const relative = path.relative(workingDir, openFile);
    const found = scoredFiles.find(f => f.path === relative);
    if (found) {
      found.score += 20;
    }
  }

  // Sort by score descending
  scoredFiles.sort((a, b) => b.score - a.score);

  // Select files within token budget
  const selectedFiles: FileScore[] = [];
  let totalTokens = 0;
  let truncated = false;

  for (const file of scoredFiles) {
    const estimatedTokens = Math.ceil(file.size / 4);
    if (totalTokens + estimatedTokens > maxTokens) {
      truncated = true;
      continue;
    }
    selectedFiles.push(file);
    totalTokens += estimatedTokens;
  }

  return {
    files: selectedFiles,
    totalTokens,
    truncated,
  };
}

// Format context for model
export function formatContextForModel(context: ContextResult, workingDir?: string): string {
  if (context.files.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const file of context.files.slice(0, 20)) {
    try {
      const fullPath = workingDir ? path.join(workingDir, file.path) : file.path;
      const content = fs.readFileSync(fullPath, 'utf-8');
      parts.push(`--- ${file.path} ---\n${content}\n`);
    } catch {
      // Skip unreadable files
    }
  }

  return parts.join('\n');
}
