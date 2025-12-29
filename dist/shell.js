"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DANGEROUS_PATTERNS = exports.ALLOWED_COMMANDS = void 0;
exports.validateCommand = validateCommand;
exports.executeCommand = executeCommand;
exports.getAllowedCommands = getAllowedCommands;
const child_process_1 = require("child_process");
const session_1 = require("./session");
// Allowlist of permitted commands
const ALLOWED_COMMANDS = new Set([
    'git',
    'npm',
    'pnpm',
    'yarn',
    'node',
    'npx',
    'tsc',
    'jest',
    'vitest',
    'mocha',
    'pytest',
    'go',
    'cargo',
    'make',
    'ls',
    'cat',
    'head',
    'tail',
    'wc',
    'grep',
    'find',
    'pwd',
    'echo',
]);
exports.ALLOWED_COMMANDS = ALLOWED_COMMANDS;
// Dangerous patterns that are never allowed
const DANGEROUS_PATTERNS = [
    /\|/, // Pipes
    />/, // Redirects
    /</, // Input redirects
    /;/, // Command chaining
    /&&/, // AND chaining
    /\|\|/, // OR chaining
    /`/, // Backticks
    /\$\(/, // Command substitution
    /\$\{/, // Variable expansion
    /rm\s+-rf/i, // Dangerous rm
    /rm\s+--no-preserve-root/i,
    /sudo/i, // Sudo
    /chmod\s+777/, // Dangerous chmod
    /curl.*\|.*sh/i, // Curl pipe to shell
    /wget.*\|.*sh/i, // Wget pipe to shell
    /eval/i, // Eval
    /exec/i, // Exec (the shell builtin)
];
exports.DANGEROUS_PATTERNS = DANGEROUS_PATTERNS;
// Validate command against allowlist
function validateCommand(command) {
    const trimmed = command.trim();
    if (!trimmed) {
        return { valid: false, error: 'Empty command' };
    }
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { valid: false, error: `Dangerous pattern detected: ${pattern.source}` };
        }
    }
    // Extract the base command
    const parts = trimmed.split(/\s+/);
    const baseCommand = parts[0];
    if (!baseCommand) {
        return { valid: false, error: 'Could not parse command' };
    }
    // Check allowlist
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
        return { valid: false, error: `Command not allowed: ${baseCommand}. Allowed: ${Array.from(ALLOWED_COMMANDS).join(', ')}` };
    }
    return { valid: true };
}
// Execute a command safely
function executeCommand(command, cwd) {
    const validation = validateCommand(command);
    if (!validation.valid) {
        return {
            success: false,
            command,
            stdout: '',
            stderr: '',
            exitCode: -1,
            error: validation.error,
        };
    }
    const session = (0, session_1.getSession)();
    const workingDir = cwd || session.workingDirectory;
    const options = {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
        stdio: ['pipe', 'pipe', 'pipe'],
    };
    try {
        const stdout = (0, child_process_1.execSync)(command, options);
        return {
            success: true,
            command,
            stdout: stdout || '',
            stderr: '',
            exitCode: 0,
        };
    }
    catch (err) {
        return {
            success: false,
            command,
            stdout: err.stdout?.toString() || '',
            stderr: err.stderr?.toString() || '',
            exitCode: err.status || 1,
            error: err.message,
        };
    }
}
// Get list of allowed commands
function getAllowedCommands() {
    return Array.from(ALLOWED_COMMANDS).sort();
}
//# sourceMappingURL=shell.js.map