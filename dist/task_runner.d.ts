import { TaskStep } from './session';
export declare function decomposeTask(): Promise<{
    success: boolean;
    steps: TaskStep[];
    message: string;
}>;
export declare function planCurrentStep(): Promise<{
    success: boolean;
    message: string;
}>;
export declare function printProgress(): void;
export declare function completeCurrentStep(): {
    success: boolean;
    hasMore: boolean;
    message: string;
};
export declare function skipCurrentStep(): {
    success: boolean;
    hasMore: boolean;
    message: string;
};
//# sourceMappingURL=task_runner.d.ts.map