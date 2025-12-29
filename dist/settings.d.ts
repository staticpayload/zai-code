export interface Settings {
    ui: {
        asciiLogo: 'on' | 'off';
        color: 'auto' | 'on' | 'off';
    };
    firstRun: boolean;
}
export declare function loadSettings(): Settings;
export declare function saveSettings(settings: Settings): void;
export declare function getSetting<K extends keyof Settings>(key: K): Settings[K];
export declare function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
export declare function setNestedSetting(path: string, value: string): boolean;
export declare function markFirstRunComplete(): void;
export declare function isFirstRun(): boolean;
export declare function shouldShowColor(): boolean;
export declare function shouldShowLogo(): boolean;
//# sourceMappingURL=settings.d.ts.map