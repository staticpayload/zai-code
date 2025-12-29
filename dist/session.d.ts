import { ResponseSchema } from './runtime';
import { ExecResult } from './shell';
export type IntentType = 'QUESTION' | 'CODE_EDIT' | 'REFACTOR' | 'DEBUG' | 'REVIEW' | 'COMMAND';
export declare const PLAN_SCHEMA: {
    readonly type: "object";
    readonly required: readonly ["status", "plan"];
    readonly properties: {
        readonly status: {
            readonly type: "string";
            readonly enum: readonly ["success", "error"];
        };
        readonly plan: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly required: readonly ["id", "description"];
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                    };
                    readonly description: {
                        readonly type: "string";
                    };
                    readonly files: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "string";
                        };
                    };
                };
            };
        };
        readonly error: {
            readonly type: "string";
        };
    };
};
export type SessionMode = 'edit' | 'ask' | 'explain' | 'review' | 'debug' | 'auto';
export interface PlanStep {
    id: string;
    description: string;
    status: 'pending' | 'complete' | 'failed';
}
export interface TaskStep {
    id: string;
    description: string;
    status: 'pending' | 'planned' | 'generated' | 'applied' | 'skipped';
    plan?: PlanStep[];
    diff?: ResponseSchema;
}
export interface SessionState {
    openFiles: string[];
    lastPlan: PlanStep[] | null;
    lastDiff: ResponseSchema | null;
    pendingActions: ResponseSchema | null;
    mode: SessionMode;
    dryRun: boolean;
    workingDirectory: string;
    currentIntent: string | null;
    intentType: IntentType | null;
    lastExecResult: ExecResult | null;
    taskSteps: TaskStep[];
    currentStepIndex: number;
}
export declare function createSession(workingDirectory?: string): SessionState;
export declare function getSession(): SessionState;
export declare function initSession(workingDirectory: string): SessionState;
export declare function resetSession(): void;
export declare function addOpenFile(path: string): void;
export declare function removeOpenFile(path: string): void;
export declare function clearOpenFiles(): void;
export declare function setLastPlan(plan: PlanStep[] | null): void;
export declare function setLastDiff(diff: ResponseSchema | null): void;
export declare function setPendingActions(actions: ResponseSchema | null): void;
export declare function setMode(mode: SessionMode): void;
export declare function setDryRun(enabled: boolean): void;
export declare function getMode(): SessionMode;
export declare function isDryRun(): boolean;
export declare function setIntent(intent: string): void;
export declare function getIntent(): string | null;
export declare function clearIntent(): void;
export declare function setIntentType(type: IntentType): void;
export declare function getIntentType(): IntentType | null;
export declare function setLastExecResult(result: ExecResult): void;
export declare function getLastExecResult(): ExecResult | null;
export declare function setTaskSteps(steps: TaskStep[]): void;
export declare function getTaskSteps(): TaskStep[];
export declare function getCurrentStep(): TaskStep | null;
export declare function advanceStep(): TaskStep | null;
export declare function updateStepStatus(stepId: string, status: TaskStep['status']): void;
export declare function getStepProgress(): {
    current: number;
    total: number;
    completed: number;
};
//# sourceMappingURL=session.d.ts.map