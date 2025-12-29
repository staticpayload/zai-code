export interface BackupEntry {
    path: string;
    operation: 'create' | 'modify' | 'delete';
    originalContent: string | null;
    timestamp: string;
}
export interface RollbackState {
    entries: BackupEntry[];
    maxEntries: number;
}
declare let rollbackState: RollbackState;
export declare function createBackup(filePath: string, operation: 'create' | 'modify' | 'delete'): void;
export declare function undoLast(): {
    success: boolean;
    message: string;
    entry?: BackupEntry;
};
export declare function undoN(count: number): {
    success: boolean;
    undone: number;
    messages: string[];
};
export declare function getUndoHistory(): BackupEntry[];
export declare function getUndoCount(): number;
export declare function hasUndoHistory(): boolean;
export declare function clearUndoHistory(): void;
export { rollbackState };
//# sourceMappingURL=rollback.d.ts.map