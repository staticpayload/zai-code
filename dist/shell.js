"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DANGEROUS_PATTERNS = exports.ALLOWED_COMMANDS = void 0;
exports.validateCommand = validateCommand;
exports.executeCommand = executeCommand;
exports.getAllowedCommands = getAllowedCommands;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const session_1 = require("./session");
// Platform-specific command aliases
const WINDOWS_ALIASES = {
    'ls': 'dir',
    'cat': 'type',
    'pwd': 'cd',
    'clear': 'cls',
};
// Allowlist of permitted commands (cross-platform)
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
    'python',
    'python3',
    'pip',
    'pip3',
    'go',
    'cargo',
    'rustc',
    'make',
    'cmake',
    'docker',
    'kubectl',
    // Unix commands
    'ls',
    'cat',
    'head',
    'tail',
    'wc',
    'grep',
    'find',
    'pwd',
    'echo',
    'touch',
    'mkdir',
    'cp',
    'mv',
    'diff',
    'sort',
    'uniq',
    'sed',
    'awk',
    'curl',
    'wget',
    // Windows commands
    'dir',
    'type',
    'where',
    'findstr',
    'copy',
    'move',
    'del',
]);
exports.ALLOWED_COMMANDS = ALLOWED_COMMANDS;
// Dangerous patterns that are never allowed
const DANGEROUS_PATTERNS = [
    /\|/, // Pipes
    /(?:^|[^-])>/, // Redirects (but allow flags like --verbose)
    /</, // Input redirects
    /;/, // Command chaining
    /&&/, // AND chaining
    /\|\|/, // OR chaining
    /`/, // Backticks
    /\$\(/, // Command substitution
    /\$\{/, // Variable expansion
    /\brm\s+-rf/i, // Dangerous rm (word boundary to avoid false positives)
    /\brm\s+--no-preserve-root/i,
    /\bsudo\b/i, // Sudo (word boundary)
    /\bchmod\s+777\b/, // Dangerous chmod
    /\bcurl\b.*\|.*\bsh\b/i, // Curl pipe to shell
    /\bwget\b.*\|.*\bsh\b/i, // Wget pipe to shell
    /\beval\s/i, // Eval (followed by space to avoid matching 'evaluate')
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
            return { valid: false, error: `Dangerous pattern detected` };
        }
    }
    // Extract the base command (handle paths like ./script.sh or /usr/bin/node)
    const parts = trimmed.split(/\s+/);
    let baseCommand = parts[0];
    if (!baseCommand) {
        return { valid: false, error: 'Could not parse command' };
    }
    // Extract just the command name from paths
    if (baseCommand.includes('/')) {
        baseCommand = path.basename(baseCommand);
    }
    // Check allowlist
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
        return { valid: false, error: `Command not allowed: ${baseCommand}. Allowed: ${Array.from(ALLOWED_COMMANDS).slice(0, 10).join(', ')}...` };
    }
    return { valid: true };
}
// Translate Unix commands to Windows equivalents if needed
function translateCommand(command) {
    if (process.platform !== 'win32') {
        return command;
    }
    const parts = command.trim().split(/\s+/);
    const baseCmd = parts[0];
    if (WINDOWS_ALIASES[baseCmd]) {
        parts[0] = WINDOWS_ALIASES[baseCmd];
        return parts.join(' ');
    }
    return command;
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
    // Validate working directory exists
    const fs = require('fs');
    if (!fs.existsSync(workingDir)) {
        return {
            success: false,
            command,
            stdout: '',
            stderr: '',
            exitCode: -1,
            error: `Working directory does not exist: ${workingDir}`,
        };
    }
    // Translate command for Windows if needed
    const translatedCommand = translateCommand(command);
    const options = {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    };
    try {
        const stdout = (0, child_process_1.execSync)(translatedCommand, options);
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
            exitCode: typeof err.status === 'number' ? err.status : 1,
            error: err.message,
        };
    }
}
// Get list of allowed commands
function getAllowedCommands() {
    return Array.from(ALLOWED_COMMANDS).sort();
}
//# sourceMappingURL=shell.js.map