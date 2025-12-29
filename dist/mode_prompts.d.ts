import { SessionMode } from './session';
export interface ModePrompt {
    systemPrefix: string;
    constraints: string;
    outputFormat: string;
    allowedActions: {
        plan: boolean;
        generate: boolean;
        apply: boolean;
        execute: boolean;
    };
}
export declare function getModePrompt(mode?: SessionMode): ModePrompt;
export declare function buildSystemPrompt(mode?: SessionMode, projectPath?: string): string;
export declare function isActionAllowed(action: keyof ModePrompt['allowedActions'], mode?: SessionMode): boolean;
export declare function getModeDescription(mode: SessionMode): string;
//# sourceMappingURL=mode_prompts.d.ts.map