declare const ALLOWED_COMMANDS: Set<string>;
declare const DANGEROUS_PATTERNS: RegExp[];
export interface ExecResult {
    success: boolean;
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
}
export declare function validateCommand(command: string): {
    valid: boolean;
    error?: string;
};
export declare function executeCommand(command: string, cwd?: string): ExecResult;
export declare function getAllowedCommands(): string[];
export { ALLOWED_COMMANDS, DANGEROUS_PATTERNS };
//# sourceMappingURL=shell.d.ts.map