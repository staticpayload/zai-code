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
    green: enabled ? '\x1b[32m' : '',
    yellow: enabled ? '\x1b[33m' : '',
    red: enabled ? '\x1b[31m' : '',
    cyan: enabled ? '\x1b[36m' : '',
    blue: enabled ? '\x1b[34m' : '',
    white: enabled ? '\x1b[37m' : '',
    bgBlue: enabled ? '\x1b[44m' : '',
  };
}

// Minimal ASCII logo - 2 lines max
const ASCII_LOGO = `zai·code`;

// Show logo on startup (only if enabled)
export function renderStartup(projectName: string): string {
  const c = getColors();
  const lines: string[] = [];

  // Logo (optional, minimal)
  if (shouldShowLogo()) {
    lines.push('');
    lines.push(`${c.bold}zai${c.reset}${c.dim}·code${c.reset}`);
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
  lines.push(`${c.dim}${projectName}${c.reset} ${c.dim}|${c.reset} ${gitStatus} ${c.dim}|${c.reset} ${model}`);
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

  if (session.workingDirectory === os.homedir()) {
    warnings.push('Warning: running in home directory');
  }

  const gitDir = path.join(session.workingDirectory, '.git');
  if (!fs.existsSync(gitDir)) {
    warnings.push('Not a git repository');
  }

  if (session.pendingActions) {
    warnings.push('Pending changes. Use /diff to review.');
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
  return `${c.yellow}!${c.reset} ${msg}`;
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
