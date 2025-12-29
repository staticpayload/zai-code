import { execSync, ExecSyncOptions } from 'child_process';
import * as path from 'path';
import { getSession } from './session';

// Platform-specific command aliases
const WINDOWS_ALIASES: Record<string, string> = {
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

// Dangerous patterns that are never allowed
const DANGEROUS_PATTERNS = [
  /\|/,           // Pipes
  /(?:^|[^-])>/,  // Redirects (but allow flags like --verbose)
  /</,            // Input redirects
  /;/,            // Command chaining
  /&&/,           // AND chaining
  /\|\|/,         // OR chaining
  /`/,            // Backticks
  /\$\(/,         // Command substitution
  /\$\{/,         // Variable expansion
  /\brm\s+-rf/i,  // Dangerous rm (word boundary to avoid false positives)
  /\brm\s+--no-preserve-root/i,
  /\bsudo\b/i,    // Sudo (word boundary)
  /\bchmod\s+777\b/, // Dangerous chmod
  /\bcurl\b.*\|.*\bsh\b/i, // Curl pipe to shell
  /\bwget\b.*\|.*\bsh\b/i, // Wget pipe to shell
  /\beval\s/i,    // Eval (followed by space to avoid matching 'evaluate')
];

// Execution result
export interface ExecResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

// Validate command against allowlist
export function validateCommand(command: string): { valid: boolean; error?: string } {
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
function translateCommand(command: string): string {
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
export function executeCommand(command: string, cwd?: string): ExecResult {
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

  const session = getSession();
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

  const options: ExecSyncOptions = {
    cwd: workingDir,
    encoding: 'utf-8',
    timeout: 30000, // 30 second timeout
    maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
  };

  try {
    const stdout = execSync(translatedCommand, options) as string;
    return {
      success: true,
      command,
      stdout: stdout || '',
      stderr: '',
      exitCode: 0,
    };
  } catch (err: any) {
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
export function getAllowedCommands(): string[] {
  return Array.from(ALLOWED_COMMANDS).sort();
}

// Export for external use
export { ALLOWED_COMMANDS, DANGEROUS_PATTERNS };
