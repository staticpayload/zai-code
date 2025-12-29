import { ResponseSchema } from './runtime';
export interface ApplyResult {
    success: boolean;
    applied: string[];
    failed: Array<{
        path: string;
        error: string;
    }>;
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
export declare function validatePath(filePath: string, basePath?: string): PathValidationResult;
/**
 * Apply a single file operation atomically
 */
export declare function applyFileOperation(operation: 'create' | 'modify' | 'delete', filePath: string, content?: string, options?: ApplyOptions): FileOperationResult;
/**
 * Apply diff hunks to a file
 */
export declare function applyDiff(filePath: string, hunks: DiffHunk[], options?: ApplyOptions): FileOperationResult;
/**
 * Main entry: apply all changes from a ResponseSchema
 */
export declare function applyResponse(response: ResponseSchema, options?: ApplyOptions): ApplyResult;
//# sourceMappingURL=apply.d.ts.map