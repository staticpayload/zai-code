import * as fs from 'fs';
import * as path from 'path';
import { getSession } from './session';

// Backup entry for a file operation
export interface BackupEntry {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  originalContent: string | null;  // null for created files (didn't exist)
  timestamp: string;
}

// Rollback history stack
export interface RollbackState {
  entries: BackupEntry[];
  maxEntries: number;
}

// Global rollback state
let rollbackState: RollbackState = {
  entries: [],
  maxEntries: 50,
};

// Create backup before applying changes
export function createBackup(filePath: string, operation: 'create' | 'modify' | 'delete'): void {
  const session = getSession();
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(session.workingDirectory, filePath);

  let originalContent: string | null = null;

  try {
    if (fs.existsSync(absolutePath)) {
      originalContent = fs.readFileSync(absolutePath, 'utf-8');
    }
  } catch {
    // File doesn't exist or can't be read
  }

  const entry: BackupEntry = {
    path: absolutePath,
    operation,
    originalContent,
    timestamp: new Date().toISOString(),
  };

  // Add to stack
  rollbackState.entries.push(entry);

  // Limit stack size
  if (rollbackState.entries.length > rollbackState.maxEntries) {
    rollbackState.entries.shift();
  }
}

// Undo last operation
export function undoLast(): { success: boolean; message: string; entry?: BackupEntry } {
  if (rollbackState.entries.length === 0) {
    return { success: false, message: 'Nothing to undo.' };
  }

  const entry = rollbackState.entries.pop()!;

  try {
    switch (entry.operation) {
      case 'create':
        // File was created, delete it
        if (entry.originalContent === null) {
          if (fs.existsSync(entry.path)) {
            fs.unlinkSync(entry.path);
            // Clean up empty parent directories
            const dir = path.dirname(entry.path);
            try {
              const dirContents = fs.readdirSync(dir);
              if (dirContents.length === 0) {
                fs.rmdirSync(dir);
              }
            } catch {
              // Ignore cleanup errors
            }
          }
          return { success: true, message: `Deleted: ${entry.path}`, entry };
        }
        // File existed before, restore original
        const createDir = path.dirname(entry.path);
        if (!fs.existsSync(createDir)) {
          fs.mkdirSync(createDir, { recursive: true });
        }
        fs.writeFileSync(entry.path, entry.originalContent, 'utf-8');
        return { success: true, message: `Restored: ${entry.path}`, entry };

      case 'modify':
        // Restore original content
        if (entry.originalContent !== null) {
          const modifyDir = path.dirname(entry.path);
          if (!fs.existsSync(modifyDir)) {
            fs.mkdirSync(modifyDir, { recursive: true });
          }
          fs.writeFileSync(entry.path, entry.originalContent, 'utf-8');
          return { success: true, message: `Restored: ${entry.path}`, entry };
        }
        return { success: false, message: `No backup content for: ${entry.path}` };

      case 'delete':
        // File was deleted, restore it
        if (entry.originalContent !== null) {
          const deleteDir = path.dirname(entry.path);
          if (!fs.existsSync(deleteDir)) {
            fs.mkdirSync(deleteDir, { recursive: true });
          }
          fs.writeFileSync(entry.path, entry.originalContent, 'utf-8');
          return { success: true, message: `Restored: ${entry.path}`, entry };
        }
        return { success: false, message: `Cannot restore deleted file (no backup): ${entry.path}` };

      default:
        return { success: false, message: `Unknown operation: ${(entry as BackupEntry).operation}` };
    }
  } catch (err: any) {
    // Re-add entry if undo failed
    rollbackState.entries.push(entry);
    return { success: false, message: `Undo failed: ${err?.message || String(err)}` };
  }
}

// Undo multiple operations
export function undoN(count: number): { success: boolean; undone: number; messages: string[] } {
  const messages: string[] = [];
  let undone = 0;

  for (let i = 0; i < count; i++) {
    const result = undoLast();
    if (!result.success) {
      messages.push(result.message);
      break;
    }
    messages.push(result.message);
    undone++;
  }

  return { success: undone > 0, undone, messages };
}

// Get undo history
export function getUndoHistory(): BackupEntry[] {
  return [...rollbackState.entries];
}

// Get pending undo count
export function getUndoCount(): number {
  return rollbackState.entries.length;
}

// Check if there are pending undos
export function hasUndoHistory(): boolean {
  return rollbackState.entries.length > 0;
}

// Clear undo history
export function clearUndoHistory(): void {
  rollbackState.entries = [];
}

// Export for testing
export { rollbackState };
