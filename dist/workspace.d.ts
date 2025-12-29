export interface WorkspaceContext {
    root: string;
    files: Array<{
        path: string;
        size: number;
    }>;
    gitStatus?: string;
}
export interface CollectOptions {
    maxFiles?: number;
    maxFileSize?: number;
    extensions?: string[];
}
export declare function collectWorkspace(rootPath: string, options?: CollectOptions): WorkspaceContext;
export declare function getFileContent(filePath: string, maxSize?: number): string | null;
export declare function buildContextString(workspace: WorkspaceContext, includeContent?: boolean): string;
//# sourceMappingURL=workspace.d.ts.map