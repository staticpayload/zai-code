import { PlanStep } from './session';
import { ResponseSchema } from './runtime';
declare const MAX_PLAN_ITERATIONS = 5;
declare const MAX_REFINE_ITERATIONS = 3;
export interface PlannerResult {
    success: boolean;
    iterations: number;
    plan: PlanStep[] | null;
    message: string;
    needsConfirmation: boolean;
}
export interface GenerateResult {
    success: boolean;
    iterations: number;
    changes: ResponseSchema | null;
    message: string;
    needsConfirmation: boolean;
}
export declare function runPlannerLoop(): Promise<PlannerResult>;
export declare function runGenerateLoop(): Promise<GenerateResult>;
export { MAX_PLAN_ITERATIONS, MAX_REFINE_ITERATIONS };
//# sourceMappingURL=planner.d.ts.map