"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePath = validatePath;
exports.applyFileOperation = applyFileOperation;
exports.applyDiff = applyDiff;
exports.applyResponse = applyResponse;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const rollback_1 = require("./rollback");
/**
 * Validate a file path is safe (no path traversal, absolute or within basePath)
 */
function validatePath(filePath, basePath) {
    try {
        let resolvedPath = path.resolve(filePath);
        // Normalize the path to remove any redundant components
        resolvedPath = path.normalize(resolvedPath);
        // If basePath is provided, ensure the resolved path is within it
        if (basePath) {
            const resolvedBase = path.resolve(basePath);
            const resolvedBaseNormalized = path.normalize(resolvedBase);
            // Check if the resolved path is within the base path
            const relativePath = path.relative(resolvedBaseNormalized, resolvedPath);
            // If the relative path starts with '..', it's outside the base path
            if (relativePath.startsWith('..')) {
                return {
                    valid: false,
                    resolved: resolvedPath,
                    error: `Path '${filePath}' is outside base path '${basePath}'`,
                };
            }
        }
        // Check for path traversal attempts in the original input
        const normalizedInput = path.normalize(filePath);
        if (normalizedInput.includes('..')) {
            // If basePath is set, allow relative paths with .. as long as they resolve within basePath
            if (!basePath) {
                return {
                    valid: false,
                    resolved: resolvedPath,
                    error: `Path '${filePath}' contains path traversal`,
                };
            }
            // Re-check with basePath logic above
        }
        return { valid: true, resolved: resolvedPath };
    }
    catch (error) {
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
function atomicWrite(filePath, content) {
    try {
        // Ensure parent directory exists
        const parentDir = path.dirname(filePath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }
        // Create temp file in same directory to ensure same filesystem
        const tempPath = path.join(parentDir, `.tmp_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        // Write to temp file
        fs.writeFileSync(tempPath, content, 'utf-8');
        // Atomic rename
        fs.renameSync(tempPath, filePath);
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Apply a single file operation atomically
 */
function applyFileOperation(operation, filePath, content, options) {
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
            if (fs.existsSync(resolvedPath)) {
                return { success: false, error: `File already exists: ${resolvedPath}` };
            }
            if (content === undefined) {
                return { success: false, error: 'Content required for create operation' };
            }
            (0, rollback_1.createBackup)(resolvedPath, 'create');
            return atomicWrite(resolvedPath, content);
        case 'modify':
            if (!fs.existsSync(resolvedPath)) {
                return { success: false, error: `File does not exist: ${resolvedPath}` };
            }
            if (content === undefined) {
                return { success: false, error: 'Content required for modify operation' };
            }
            (0, rollback_1.createBackup)(resolvedPath, 'modify');
            return atomicWrite(resolvedPath, content);
        case 'delete':
            if (!fs.existsSync(resolvedPath)) {
                return { success: false, error: `File does not exist: ${resolvedPath}` };
            }
            (0, rollback_1.createBackup)(resolvedPath, 'delete');
            try {
                fs.unlinkSync(resolvedPath);
                return { success: true };
            }
            catch (error) {
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
function applyDiff(filePath, hunks, options) {
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
    // Read existing file
    let lines;
    try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        lines = content.split('\n');
    }
    catch (error) {
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
        // Convert from 1-indexed to 0-indexed
        const startIndex = start - 1;
        const endIndex = end - 1;
        // Validate line numbers
        if (startIndex < 0 || startIndex >= lines.length) {
            return {
                success: false,
                error: `Invalid hunk start line: ${start} (file has ${lines.length} lines)`,
            };
        }
        if (endIndex < startIndex || endIndex >= lines.length) {
            return {
                success: false,
                error: `Invalid hunk end line: ${end} (file has ${lines.length} lines)`,
            };
        }
        // Split content into lines
        const newLines = content.split('\n');
        // Replace lines from start to end with new content
        lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
    }
    // Dry run - don't write
    if (options?.dryRun) {
        return { success: true };
    }
    // Create backup before applying diff
    (0, rollback_1.createBackup)(resolvedPath, 'modify');
    // Write atomically
    const newContent = lines.join('\n');
    return atomicWrite(resolvedPath, newContent);
}
/**
 * Main entry: apply all changes from a ResponseSchema
 */
function applyResponse(response, options) {
    const result = {
        success: true,
        applied: [],
        failed: [],
    };
    // Track if any operation failed
    let hasFailures = false;
    // Apply file operations if present
    if (response.files && response.files.length > 0) {
        for (const fileOp of response.files) {
            const opResult = applyFileOperation(fileOp.operation, fileOp.path, fileOp.content, options);
            if (opResult.success) {
                result.applied.push(`${fileOp.operation}:${fileOp.path}`);
            }
            else {
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
            }
            else {
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
//# sourceMappingURL=apply.js.map