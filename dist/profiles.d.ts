export interface Profile {
    name: string;
    description: string;
    settings: Partial<{
        model: string;
        contextScope: 'open' | 'touched' | 'full';
        confirmationMode: 'strict' | 'normal';
        maxPlanIterations: number;
    }>;
}
export declare const BUILT_IN_PROFILES: Profile[];
export declare function getProfile(name: string): Profile | null;
export declare function listProfiles(): Profile[];
export declare function applyProfile(name: string): boolean;
export declare function getActiveProfileName(): string | null;
//# sourceMappingURL=profiles.d.ts.map