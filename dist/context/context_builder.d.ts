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
export declare function indexWorkspace(workingDir: string, maxDepth?: number): FileScore[];
export declare function buildContext(workingDir: string, intent: string, intentType: IntentType, openFiles?: string[], maxTokens?: number): ContextResult;
export declare function formatContextForModel(context: ContextResult): string;
//# sourceMappingURL=context_builder.d.ts.map