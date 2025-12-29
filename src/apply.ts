import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ResponseSchema } from './runtime';
import { createBackup } from './rollback';

export interface ApplyResult {
  success: boolean;
  applied: string[];
  failed: Array<{ path: string; error: string }>;
}

export interface ApplyOptions {
  dryRun?: boolean;
  basePath?: string;
}

export interface PathValidationResult {
  valid: boolean;
  resolved: string;
  error?: string;
}

export interface FileOperationResult {
  success: boolean;
  error?: string;
}

export interface DiffHunk {
  start: number;
  end: number;
  content: string;
}

/**
 * Validate a file path is safe (no path traversal, absolute or within basePath)
 */
export function validatePath(
  filePath: string,
  basePath?: string
): PathValidationResult {
  try {
    // Resolve relative to basePath if provided, otherwise cwd
    let resolvedPath: string;
    if (basePath) {
      resolvedPath = path.resolve(basePath, filePath);
    } else {
      resolvedPath = path.resolve(filePath);
    }

    // Normalize the path to remove any redundant components
    resolvedPath = path.normalize(resolvedPath);

    // If basePath is provided, ensure the resolved path is within it
    if (basePath) {
      const resolvedBase = path.resolve(basePath);
      const resolvedBaseNormalized = path.normalize(resolvedBase);

      // Check if the resolved path is within the base path
      const relativePath = path.relative(resolvedBaseNormalized, resolvedPath);

      // If the relative path starts with '..', it's outside the base path
      // Also check for absolute paths on Windows (e.g., C:\)
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return {
          valid: false,
          resolved: resolvedPath,
          error: `Path '${filePath}' is outside base path '${basePath}'`,
        };
      }
    }

    // Check for path traversal attempts in the original input when no basePath
    if (!basePath) {
      const normalizedInput = path.normalize(filePath);
      if (normalizedInput.startsWith('..')) {
        return {
          valid: false,
          resolved: resolvedPath,
          error: `Path '${filePath}' contains path traversal`,
        };
      }
    }

    return { valid: true, resolved: resolvedPath };
  } catch (error) {
    return {
      valid: false,
      resolved: filePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Write content to a file atomically using temp file + rename
 */
function atomicWrite(filePath: string, content: string): FileOperationResult {
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Create temp file in same directory to ensure same filesystem
    const tempPath = path.join(
      parentDir,
      `.tmp_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

    // Write to temp file
    fs.writeFileSync(tempPath, content, 'utf-8');

    // Atomic rename
    fs.renameSync(tempPath, filePath);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply a single file operation atomically
 */
export function applyFileOperation(
  operation: 'create' | 'modify' | 'delete',
  filePath: string,
  content?: string,
  options?: ApplyOptions
): FileOperationResult {
  // Validate the path
  const validation = validatePath(filePath, options?.basePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  const resolvedPath = validation.resolved;

  // Block binary files
  const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.a', '.lib', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.rar'];
  const ext = path.extname(filePath).toLowerCase();
  if (binaryExtensions.includes(ext)) {
    return { success: false, error: 'Binary file modification blocked' };
  }

  // Warn on large content
  if (content && content.length > 50000) {
    console.log(`Warning: Large file (${Math.round(content.length / 1000)}KB)`);
  }

  // Dry run - just validate
  if (options?.dryRun) {
    switch (operation) {
      case 'create':
        if (fs.existsSync(resolvedPath)) {
          return { success: false, error: `File already exists: ${resolvedPath}` };
        }
        break;
      case 'modify':
        if (!fs.existsSync(resolvedPath)) {
          return { success: false, error: `File does not exist: ${resolvedPath}` };
        }
        if (content === undefined) {
          return { success: false, error: 'Content required for modify operation' };
        }
        break;
      case 'delete':
        if (!fs.existsSync(resolvedPath)) {
          return { success: false, error: `File does not exist: ${resolvedPath}` };
        }
        break;
    }
    return { success: true };
  }

  // Actual operation
  switch (operation) {
    case 'create':
      if (content === undefined) {
        return { success: false, error: 'Content required for create operation' };
      }
      // Allow create to overwrite existing files (common use case for code generation)
      createBackup(resolvedPath, fs.existsSync(resolvedPath) ? 'modify' : 'create');
      return atomicWrite(resolvedPath, content);

    case 'modify':
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `File does not exist: ${resolvedPath}` };
      }
      if (content === undefined) {
        return { success: false, error: 'Content required for modify operation' };
      }
      createBackup(resolvedPath, 'modify');
      return atomicWrite(resolvedPath, content);

    case 'delete':
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `File does not exist: ${resolvedPath}` };
      }
      createBackup(resolvedPath, 'delete');
      try {
        fs.unlinkSync(resolvedPath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

    default:
      return { success: false, error: `Unknown operation: ${operation}` };
  }
}

/**
 * Apply diff hunks to a file
 */
export function applyDiff(
  filePath: string,
  hunks: DiffHunk[],
  options?: ApplyOptions
): FileOperationResult {
  // Validate the path
  const validation = validatePath(filePath, options?.basePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  const resolvedPath = validation.resolved;

  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    return { success: false, error: `File does not exist: ${resolvedPath}` };
  }

  // Validate hunks
  if (!hunks || hunks.length === 0) {
    return { success: false, error: 'No hunks provided' };
  }

  // Read existing file
  let lines: string[];
  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    lines = content.split('\n');
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Sort hunks in reverse order by start line to apply from bottom to top
  // This prevents line number shifts from affecting earlier hunks
  const sortedHunks = [...hunks].sort((a, b) => b.start - a.start);

  // Apply each hunk
  for (const hunk of sortedHunks) {
    const { start, end, content } = hunk;

    // Validate hunk has required fields
    if (typeof start !== 'number' || typeof end !== 'number') {
      return {
        success: false,
        error: `Invalid hunk: start and end must be numbers`,
      };
    }

    // Convert from 1-indexed to 0-indexed
    const startIndex = start - 1;
    const endIndex = end - 1;

    // Validate line numbers
    if (startIndex < 0) {
      return {
        success: false,
        error: `Invalid hunk start line: ${start} (must be >= 1)`,
      };
    }
    if (startIndex >= lines.length) {
      return {
        success: false,
        error: `Invalid hunk start line: ${start} (file has ${lines.length} lines)`,
      };
    }
    if (endIndex < startIndex) {
      return {
        success: false,
        error: `Invalid hunk: end line (${end}) must be >= start line (${start})`,
      };
    }
    if (endIndex >= lines.length) {
      return {
        success: false,
        error: `Invalid hunk end line: ${end} (file has ${lines.length} lines)`,
      };
    }

    // Split content into lines (handle undefined/null content)
    const newLines = (content ?? '').split('\n');

    // Replace lines from start to end with new content
    lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
  }

  // Dry run - don't write
  if (options?.dryRun) {
    return { success: true };
  }

  // Create backup before applying diff
  createBackup(resolvedPath, 'modify');

  // Write atomically
  const newContent = lines.join('\n');
  return atomicWrite(resolvedPath, newContent);
}

/**
 * Main entry: apply all changes from a ResponseSchema
 */
export function applyResponse(
  response: ResponseSchema,
  options?: ApplyOptions
): ApplyResult {
  const result: ApplyResult = {
    success: true,
    applied: [],
    failed: [],
  };

  // Track if any operation failed
  let hasFailures = false;

  // Apply file operations if present
  if (response.files && response.files.length > 0) {
    for (const fileOp of response.files) {
      const opResult = applyFileOperation(
        fileOp.operation,
        fileOp.path,
        fileOp.content,
        options
      );

      if (opResult.success) {
        result.applied.push(`${fileOp.operation}:${fileOp.path}`);
      } else {
        result.failed.push({
          path: fileOp.path,
          error: opResult.error || 'Unknown error',
        });
        hasFailures = true;
      }
    }
  }

  // Apply diff operations if present
  if (response.diffs && response.diffs.length > 0) {
    for (const diff of response.diffs) {
      const diffResult = applyDiff(diff.file, diff.hunks, options);

      if (diffResult.success) {
        result.applied.push(`diff:${diff.file}`);
      } else {
        result.failed.push({
          path: diff.file,
          error: diffResult.error || 'Unknown error',
        });
        hasFailures = true;
      }
    }
  }

  // Set overall success status
  result.success = !hasFailures && result.failed.length === 0;

  return result;
}
