declare const MAX_CONTEXT_TOKENS = 50000;
declare const MAX_FILE_SIZE = 50000;
declare const MAX_FILES = 50;
export interface FileScore {
    path: string;
    score: number;
    size: number;
    extension: string;
}
export interface ContextResult {
    files: Array<{
        path: string;
        content: string;
        truncated: boolean;
    }>;
    totalTokens: number;
    fileCount: number;
    truncatedCount: number;
}
export declare function indexWorkspace(rootPath: string): FileScore[];
export declare function scoreFileRelevance(file: FileScore, intent: string, intentType: string): number;
export declare function summarizeFile(content: string, maxChars: number): {
    summary: string;
    truncated: boolean;
};
export declare function buildContext(rootPath: string, intent: string, intentType: string, additionalFiles?: string[]): ContextResult;
export declare function formatContextForModel(context: ContextResult): string;
export { MAX_CONTEXT_TOKENS, MAX_FILE_SIZE, MAX_FILES };
//# sourceMappingURL=context_builder.d.ts.map