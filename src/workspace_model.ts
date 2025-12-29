import * as fs from 'fs';
import * as path from 'path';
import { getSession, SessionState, SessionMode, PlanStep, setLastPlan, setLastDiff, setPendingActions, setMode, clearOpenFiles, addOpenFile, setIntent, setIntentType, IntentType } from './session';
import { ResponseSchema } from './runtime';
import { indexWorkspace, FileScore } from './context/context_builder';

// Workspace state file location
const WORKSPACE_STATE_FILE = '.zai/workspace.json';

// Serializable workspace state
export interface WorkspaceState {
  version: number;
  workingDirectory: string;
  mode: SessionMode;
  openFiles: string[];
  currentIntent: string | null;
  intentType: IntentType | null;
  lastPlan: PlanStep[] | null;
  lastDiff: ResponseSchema | null;
  pendingActions: ResponseSchema | null;
  dryRun: boolean;
  lastUpdated: string;
}

// File tree node
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
  extension?: string;
}

// Workspace model - authoritative state
export class Workspace {
  private rootPath: string;
  private fileTree: FileTreeNode | null = null;
  private fileIndex: FileScore[] = [];

  constructor(rootPath?: string) {
    this.rootPath = rootPath || process.cwd();
  }

  // Get root path
  getRoot(): string {
    return this.rootPath;
  }

  // Index the file tree
  indexFileTree(maxDepth: number = 5): FileTreeNode {
    const buildTree = (dirPath: string, depth: number): FileTreeNode => {
      const name = path.basename(dirPath) || dirPath;
      const relativePath = path.relative(this.rootPath, dirPath);

      const node: FileTreeNode = {
        name,
        path: relativePath || '.',
        type: 'directory',
        children: [],
      };

      if (depth >= maxDepth) return node;

      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage']);

        for (const entry of entries) {
          if (entry.name.startsWith('.') && entry.name !== '.zai') continue;
          if (skipDirs.has(entry.name)) continue;

          const fullPath = path.join(dirPath, entry.name);
          const relPath = path.relative(this.rootPath, fullPath);

          if (entry.isDirectory()) {
            node.children!.push(buildTree(fullPath, depth + 1));
          } else if (entry.isFile()) {
            try {
              const stats = fs.statSync(fullPath);
              node.children!.push({
                name: entry.name,
                path: relPath,
                type: 'file',
                size: stats.size,
                extension: path.extname(entry.name),
              });
            } catch {
              // Skip files we can't stat
            }
          }
        }

        // Sort: directories first, then files
        node.children!.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      } catch {
        // Skip directories we can't read
      }

      return node;
    };

    this.fileTree = buildTree(this.rootPath, 0);
    this.fileIndex = indexWorkspace(this.rootPath);
    return this.fileTree;
  }

  // Get file tree
  getFileTree(): FileTreeNode | null {
    return this.fileTree;
  }

  // Get file index
  getFileIndex(): FileScore[] {
    return this.fileIndex;
  }

  // Get current state from session
  getCurrentState(): WorkspaceState {
    const session = getSession();
    return {
      version: 1,
      workingDirectory: session.workingDirectory,
      mode: session.mode,
      openFiles: session.openFiles,
      currentIntent: session.currentIntent,
      intentType: session.intentType,
      lastPlan: session.lastPlan,
      lastDiff: session.lastDiff,
      pendingActions: session.pendingActions,
      dryRun: session.dryRun,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Save workspace state to disk
  saveState(): void {
    const state = this.getCurrentState();
    const statePath = path.join(this.rootPath, WORKSPACE_STATE_FILE);
    const stateDir = path.dirname(statePath);

    try {
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      // Fail silently - state persistence is optional
    }
  }

  // Load workspace state from disk
  loadState(): WorkspaceState | null {
    const statePath = path.join(this.rootPath, WORKSPACE_STATE_FILE);

    try {
      if (!fs.existsSync(statePath)) {
        return null;
      }
      const content = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(content) as WorkspaceState;
    } catch {
      return null;
    }
  }

  // Restore session from saved state
  restoreState(): boolean {
    const state = this.loadState();
    if (!state) return false;

    try {
      // Restore mode
      setMode(state.mode);

      // Restore open files
      clearOpenFiles();
      for (const file of state.openFiles) {
        addOpenFile(file);
      }

      // Restore intent
      if (state.currentIntent) {
        setIntent(state.currentIntent);
      }
      if (state.intentType) {
        setIntentType(state.intentType);
      }

      // Restore plan and diff
      if (state.lastPlan) {
        setLastPlan(state.lastPlan);
      }
      if (state.lastDiff) {
        setLastDiff(state.lastDiff);
      }
      if (state.pendingActions) {
        setPendingActions(state.pendingActions);
      }

      return true;
    } catch {
      return false;
    }
  }

  // Clear saved state
  clearState(): void {
    const statePath = path.join(this.rootPath, WORKSPACE_STATE_FILE);
    try {
      if (fs.existsSync(statePath)) {
        fs.unlinkSync(statePath);
      }
    } catch {
      // Fail silently
    }
  }

  // Print file tree summary
  printTreeSummary(): string {
    if (!this.fileTree) {
      this.indexFileTree();
    }

    const countNodes = (node: FileTreeNode): { files: number; dirs: number } => {
      if (node.type === 'file') {
        return { files: 1, dirs: 0 };
      }
      let files = 0;
      let dirs = 1;
      for (const child of node.children || []) {
        const counts = countNodes(child);
        files += counts.files;
        dirs += counts.dirs;
      }
      return { files, dirs };
    };

    const counts = countNodes(this.fileTree!);
    return `Workspace: ${counts.dirs} directories, ${counts.files} files`;
  }
}

// Global workspace instance
let currentWorkspace: Workspace | null = null;

// Get or create workspace
export function getWorkspace(rootPath?: string): Workspace {
  if (!currentWorkspace) {
    currentWorkspace = new Workspace(rootPath);
  }
  return currentWorkspace;
}

// Reset workspace
export function resetWorkspace(): void {
  currentWorkspace = null;
}

export { WORKSPACE_STATE_FILE };
