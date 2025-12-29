import { SessionMode, PlanStep, IntentType } from './session';
import { ResponseSchema } from './runtime';
import { FileScore } from './context/context_builder';
declare const WORKSPACE_STATE_FILE = ".zai/workspace.json";
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
export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    children?: FileTreeNode[];
    extension?: string;
}
export declare class Workspace {
    private rootPath;
    private fileTree;
    private fileIndex;
    constructor(rootPath?: string);
    getRoot(): string;
    indexFileTree(maxDepth?: number): FileTreeNode;
    getFileTree(): FileTreeNode | null;
    getFileIndex(): FileScore[];
    getCurrentState(): WorkspaceState;
    saveState(): boolean;
    loadState(): WorkspaceState | null;
    restoreState(): boolean;
    clearState(): void;
    printTreeSummary(): string;
}
export declare function getWorkspace(rootPath?: string): Workspace;
export declare function resetWorkspace(): void;
export { WORKSPACE_STATE_FILE };
//# sourceMappingURL=workspace_model.d.ts.map