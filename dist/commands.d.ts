export interface CommandContext {
    args: string[];
    rawInput: string;
}
export type CommandHandler = (ctx: CommandContext) => Promise<void> | void;
export interface ParsedCommand {
    isSlashCommand: boolean;
    command?: string;
    args?: string[];
    rawInput: string;
}
export declare function parseInput(input: string): ParsedCommand;
export declare function executeCommand(parsed: ParsedCommand): Promise<boolean>;
export declare function getAvailableCommands(): string[];
//# sourceMappingURL=commands.d.ts.map