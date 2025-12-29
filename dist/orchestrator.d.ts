import { IntentType } from './session';
export type WorkflowType = 'slash_command' | 'capture_intent' | 'ask_question' | 'chat' | 'append_context' | 'confirm_action' | 'auto_execute' | 'ignore';
export interface OrchestrationResult {
    inputType: 'slash' | 'free_text';
    intent: IntentType;
    workflow: WorkflowType;
    handled: boolean;
    message?: string;
}
export declare function orchestrate(input: string): Promise<OrchestrationResult>;
//# sourceMappingURL=orchestrator.d.ts.map