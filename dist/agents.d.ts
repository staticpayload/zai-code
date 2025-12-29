export interface AgentsConfig {
    exists: boolean;
    content: string | null;
    error: string | null;
}
export declare function loadAgentsConfig(projectPath?: string): AgentsConfig;
export declare function hasAgentsConfig(projectPath?: string): boolean;
export declare function getAgentsContext(projectPath?: string): string;
//# sourceMappingURL=agents.d.ts.map