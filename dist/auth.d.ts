export declare function getApiKey(): Promise<string | null>;
export declare function setApiKey(key: string): Promise<void>;
export declare function deleteApiKey(): Promise<void>;
export declare function hasValidCredentials(): Promise<boolean>;
export declare function validateApiKey(key: string): Promise<boolean>;
export declare function promptForApiKey(): Promise<string>;
export declare function runOnboarding(): Promise<void>;
export declare function ensureAuthenticated(): Promise<string>;
//# sourceMappingURL=auth.d.ts.map