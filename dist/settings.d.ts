export interface Settings {
    model: {
        current: string;
    };
    ui: {
        asciiLogo: 'on' | 'off';
        color: 'auto' | 'on' | 'off';
        promptStyle: 'compact' | 'verbose';
    };
    execution: {
        confirmationMode: 'strict' | 'normal';
        maxPlanIterations: number;
        allowShellExec: boolean;
    };
    context: {
        scope: 'open' | 'touched' | 'full';
        maxTokens: number;
    };
    debug: {
        logging: boolean;
        errorDetail: 'brief' | 'full';
        dumpState: boolean;
    };
    firstRun: boolean;
}
export interface ModelDefinition {
    id: string;
    name: string;
    description: string;
}
export declare const ZAI_MODELS: ModelDefinition[];
export declare const AVAILABLE_MODELS: string[];
export declare function loadSettings(): Settings;
export declare function saveSettings(settings: Settings): void;
export declare function getSetting<K extends keyof Settings>(key: K): Settings[K];
export declare function getModel(): string;
export declare function setModel(model: string): void;
export declare function markFirstRunComplete(): void;
export declare function isFirstRun(): boolean;
export declare function shouldShowColor(): boolean;
export declare function shouldShowLogo(): boolean;
export declare function setNestedSetting(path: string, value: string): boolean;
export declare function loadProjectSettings(projectPath?: string): Partial<Settings> | null;
export declare function getEffectiveSettings(projectPath?: string): Settings;
export declare function saveProjectSettings(settings: Partial<Settings>, projectPath?: string): void;
export declare function hasProjectSettings(projectPath?: string): boolean;
//# sourceMappingURL=settings.d.ts.map