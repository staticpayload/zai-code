import { SessionState } from './session';
import { shouldShowColor, shouldShowLogo, getModel } from './settings';
import { getGitInfo, formatGitStatus } from './git';
import { getActiveProfileName } from './profiles';

// Colors - only if enabled
function getColors() {
  const enabled = shouldShowColor();
  return {
    reset: enabled ? '\x1b[0m' : '',
    dim: enabled ? '\x1b[2m' : '',
    bold: enabled ? '\x1b[1m' : '',
    italic: enabled ? '\x1b[3m' : '',
    underline: enabled ? '\x1b[4m' : '',
    green: enabled ? '\x1b[32m' : '',
    yellow: enabled ? '\x1b[33m' : '',
    red: enabled ? '\x1b[31m' : '',
    cyan: enabled ? '\x1b[36m' : '',
    blue: enabled ? '\x1b[34m' : '',
    magenta: enabled ? '\x1b[35m' : '',
    white: enabled ? '\x1b[37m' : '',
    gray: enabled ? '\x1b[90m' : '',
    bgBlue: enabled ? '\x1b[44m' : '',
    bgGreen: enabled ? '\x1b[42m' : '',
    bgRed: enabled ? '\x1b[41m' : '',
    bgYellow: enabled ? '\x1b[43m' : '',
  };
}

// Spinner frames for CLI
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Progress bar characters
const PROGRESS_FULL = '█';
const PROGRESS_EMPTY = '░';

// Minimal ASCII logo - 2 lines max
const ASCII_LOGO = `zai·code`;

// Show logo on startup (only if enabled)
export function renderStartup(projectName: string): string {
  const c = getColors();
  const lines: string[] = [];

  // Logo (optional, minimal)
  if (shouldShowLogo()) {
    lines.push('');
    lines.push(`${c.bold}${c.cyan}⚡ zai${c.reset}${c.dim}·code${c.reset}  ${c.gray}AI-native code editor${c.reset}`);
  }

  // Get git info
  const cwd = process.cwd();
  const gitInfo = getGitInfo(cwd);
  const gitStatus = gitInfo.isRepo ?
    `${gitInfo.branch || 'unknown'}${gitInfo.isDirty ? '*' : ''}` :
    'no-git';

  // Status line
  const model = getModel().split('-').slice(1, 3).join('-');
  const profile = getActiveProfileName() || 'custom';

  lines.push('');
  lines.push(`${c.dim}${projectName}${c.reset} ${c.dim}│${c.reset} ${gitStatus} ${c.dim}│${c.reset} ${model}`);
  lines.push('');

  return lines.join('\n');
}

// Get state label
function getStateLabel(session: SessionState): string {
  if (session.pendingActions) return 'pending';
  if (session.lastDiff) return 'pending';
  if (session.lastPlan && session.lastPlan.length > 0) return 'planned';
  return 'ready';
}

// Get focus (current file or step)
function getFocus(session: SessionState): string | null {
  if (session.taskSteps.length > 0 && session.currentStepIndex < session.taskSteps.length) {
    return `${session.currentStepIndex + 1}/${session.taskSteps.length}`;
  }
  if (session.openFiles.length === 1) {
    const file = session.openFiles[0];
    return file.split('/').pop() || null;
  }
  return null;
}

// Build prompt - minimal and clear
export function getPrompt(session: SessionState): string {
  const c = getColors();
  const state = getStateLabel(session);
  const focus = getFocus(session);

  // Format: mode:state focus>
  // Examples: edit:ready> edit:pending auth.ts>
  let prompt = `${c.cyan}${session.mode}${c.reset}`;

  if (session.dryRun) {
    prompt += `${c.yellow}(dry)${c.reset}`;
  }

  prompt += `${c.dim}:${c.reset}${state}`;

  if (focus) {
    prompt += ` ${c.dim}${focus}${c.reset}`;
  }

  prompt += `${c.bold}>${c.reset} `;

  return prompt;
}

// Status bar for info display
export function renderStatusBar(session: SessionState): string {
  const c = getColors();
  const gitInfo = getGitInfo(session.workingDirectory);
  const gitStatus = formatGitStatus(gitInfo);
  const model = getModel().split('-').slice(0, 2).join('-');
  const profile = getActiveProfileName();
  const pending = session.pendingActions ?
    (session.pendingActions.files?.length || 0) + (session.pendingActions.diffs?.length || 0) : 0;

  const parts = [gitStatus, `${model}`, profile];
  if (pending > 0) {
    parts.push(`${pending} pending`);
  }

  return c.dim + parts.join(' · ') + c.reset;
}

// Status line: Mode: <mode> | State: <state>
export function renderStatus(session: SessionState): string {
  const c = getColors();
  const state = getStateLabel(session);
  return `${c.dim}Mode: ${session.mode} | State: ${state}${c.reset}`;
}

// Contextual warnings
export function getWarnings(session: SessionState): string[] {
  const warnings: string[] = [];
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  try {
    if (session.workingDirectory === os.homedir()) {
      warnings.push('Warning: running in home directory');
    }

    const gitDir = path.join(session.workingDirectory, '.git');
    if (!fs.existsSync(gitDir)) {
      warnings.push('Not a git repository');
    }

    if (session.pendingActions) {
      const pendingCount = (session.pendingActions.files?.length || 0) + (session.pendingActions.diffs?.length || 0);
      if (pendingCount > 0) {
        warnings.push(`${pendingCount} pending change(s). Use /diff to review.`);
      }
    }
  } catch {
    // Ignore errors in warning generation
  }

  return warnings;
}

// Output helpers
export function success(msg: string): string {
  const c = getColors();
  return `${c.green}✓${c.reset} ${msg}`;
}

export function warning(msg: string): string {
  const c = getColors();
  return `${c.yellow}⚠${c.reset} ${msg}`;
}

export function error(msg: string): string {
  const c = getColors();
  return `${c.red}✗${c.reset} ${msg}`;
}

export function dim(msg: string): string {
  const c = getColors();
  return `${c.dim}${msg}${c.reset}`;
}

export function info(msg: string): string {
  const c = getColors();
  return `${c.cyan}${msg}${c.reset}`;
}

// Hint for next action - now more prominent
export function hint(action: string): string {
  const c = getColors();
  return `${c.dim}→ ${action}${c.reset}`;
}

// Section header
export function header(title: string): string {
  const c = getColors();
  return `${c.bold}${title}${c.reset}`;
}

// Highlight text
export function highlight(msg: string): string {
  const c = getColors();
  return `${c.cyan}${c.bold}${msg}${c.reset}`;
}

// Code/command formatting
export function code(msg: string): string {
  const c = getColors();
  return `${c.gray}\`${msg}\`${c.reset}`;
}

// Progress bar
export function progressBar(current: number, total: number, width: number = 20): string {
  const c = getColors();
  const percent = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = PROGRESS_FULL.repeat(filled) + PROGRESS_EMPTY.repeat(empty);
  return `${c.cyan}${bar}${c.reset} ${Math.round(percent * 100)}%`;
}

// Spinner frame
export function spinner(frame: number): string {
  const c = getColors();
  return `${c.cyan}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}${c.reset}`;
}

// File operation formatting
export function fileOp(operation: string, filePath: string): string {
  const c = getColors();
  const opColors: Record<string, string> = {
    'create': c.green,
    'modify': c.yellow,
    'delete': c.red,
  };
  const color = opColors[operation] || c.cyan;
  const icons: Record<string, string> = {
    'create': '+',
    'modify': '~',
    'delete': '-',
  };
  const icon = icons[operation] || '?';
  return `${color}${icon}${c.reset} ${filePath}`;
}

// Diff line formatting
export function diffLine(line: string): string {
  const c = getColors();
  if (line.startsWith('+')) {
    return `${c.green}${line}${c.reset}`;
  } else if (line.startsWith('-')) {
    return `${c.red}${line}${c.reset}`;
  } else if (line.startsWith('@')) {
    return `${c.cyan}${line}${c.reset}`;
  }
  return line;
}

// Table formatting
export function table(rows: string[][], headers?: string[]): string {
  const c = getColors();
  const lines: string[] = [];
  
  // Calculate column widths
  const allRows = headers ? [headers, ...rows] : rows;
  const colWidths = allRows[0].map((_, i) => 
    Math.max(...allRows.map(row => (row[i] || '').length))
  );
  
  // Header
  if (headers) {
    const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
    lines.push(`${c.bold}${headerLine}${c.reset}`);
    lines.push(`${c.dim}${'─'.repeat(headerLine.length)}${c.reset}`);
  }
  
  // Rows
  for (const row of rows) {
    const rowLine = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('  ');
    lines.push(rowLine);
  }
  
  return lines.join('\n');
}

// Box drawing for structured output
export function box(content: string[], title?: string): string {
  const c = getColors();
  const maxLen = Math.max(...content.map(l => l.length), title?.length || 0);
  const lines: string[] = [];

  if (title) {
    lines.push(`${c.dim}─${c.reset} ${title} ${c.dim}${'─'.repeat(Math.max(0, maxLen - title.length))}${c.reset}`);
  }

  for (const line of content) {
    lines.push(`  ${line}`);
  }

  return lines.join('\n');
}

export { ASCII_LOGO };
