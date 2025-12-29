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
  };
}

// ASCII logo - minimal, 3 lines
const ASCII_LOGO = `
 _____ ___  ___
|__  // _ |/  /
  / // __ | __|
 /___\\___|___|  code
`;

// Show logo on startup (only if enabled and first run or setting is on)
export function renderStartup(projectName: string): string {
  const c = getColors();
  const lines: string[] = [];

  // Logo (optional)
  if (shouldShowLogo()) {
    lines.push(c.dim + ASCII_LOGO.trim() + c.reset);
    lines.push('');
  }

  // Header
  lines.push(`Z.ai Code ${c.dim}— project: ${projectName}${c.reset}`);

  return lines.join('\n');
}

// Get state label
function getStateLabel(session: SessionState): string {
  if (session.pendingActions) return 'dirty';
  if (session.lastDiff) return 'dirty';
  if (session.lastPlan && session.lastPlan.length > 0) return 'pending';
  return 'clean';
}

// Get focus (current file or step)
function getFocus(session: SessionState): string | null {
  if (session.openFiles.length === 1) {
    const file = session.openFiles[0];
    // Return just filename
    return file.split('/').pop() || null;
  }
  if (session.taskSteps.length > 0 && session.currentStepIndex < session.taskSteps.length) {
    return `step${session.currentStepIndex + 1}`;
  }
  return null;
}

// Build prompt: [mode][dry-run?][state][focus]>
export function getPrompt(session: SessionState): string {
  const state = getStateLabel(session);
  const focus = getFocus(session);

  let prompt = `[${session.mode}]`;
  if (session.dryRun) {
    prompt += '[dry-run]';
  }
  prompt += `[${state}]`;
  if (focus) {
    prompt += `[${focus}]`;
  }
  prompt += '> ';

  return prompt;
}

// Status line: Mode: <mode> | State: <state>
export function renderStatus(session: SessionState): string {
  const c = getColors();
  const state = getStateLabel(session);
  return `${c.dim}Mode: ${session.mode} | State: ${state}${c.reset}`;
}

// Status bar: git | model | profile | pending
export function renderStatusBar(session: SessionState): string {
  const c = getColors();
  const gitInfo = getGitInfo(session.workingDirectory);
  const gitStatus = formatGitStatus(gitInfo);
  const model = getModel().split('-').slice(0, 2).join('-'); // Shorten model name
  const profile = getActiveProfileName();
  const pending = session.pendingActions ? (session.pendingActions.files?.length || 0) + (session.pendingActions.diffs?.length || 0) : 0;

  const parts = [
    gitStatus,
    `model:${model}`,
    `profile:${profile}`,
  ];

  if (pending > 0) {
    parts.push(`pending:${pending}`);
  }

  return c.dim + parts.join(' | ') + c.reset;
}

// Contextual warnings
export function getWarnings(session: SessionState): string[] {
  const warnings: string[] = [];
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  // Check: running in home directory
  if (session.workingDirectory === os.homedir()) {
    warnings.push('Warning: running in home directory');
  }

  // Check: not in a git repo
  const gitDir = path.join(session.workingDirectory, '.git');
  if (!fs.existsSync(gitDir)) {
    warnings.push('Note: not a git repository');
  }

  // Check: pending changes
  if (session.pendingActions) {
    warnings.push('Pending changes exist. Use /diff to review.');
  }

  return warnings;
}

// Output helpers
export function success(msg: string): string {
  const c = getColors();
  return `${c.green}${msg}${c.reset}`;
}

export function warning(msg: string): string {
  const c = getColors();
  return `${c.yellow}${msg}${c.reset}`;
}

export function error(msg: string): string {
  const c = getColors();
  return `${c.red}${msg}${c.reset}`;
}

export function dim(msg: string): string {
  const c = getColors();
  return `${c.dim}${msg}${c.reset}`;
}

export function info(msg: string): string {
  const c = getColors();
  return `${c.cyan}${msg}${c.reset}`;
}

// Hint for next action
export function hint(msg: string): string {
  const c = getColors();
  return `${c.dim}next: ${msg}${c.reset}`;
}

// Remove old exports
export { ASCII_LOGO };
