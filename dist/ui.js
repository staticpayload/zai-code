"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASCII_LOGO = void 0;
exports.renderStartup = renderStartup;
exports.getPrompt = getPrompt;
exports.renderStatus = renderStatus;
exports.renderStatusBar = renderStatusBar;
exports.getWarnings = getWarnings;
exports.success = success;
exports.warning = warning;
exports.error = error;
exports.dim = dim;
exports.info = info;
exports.hint = hint;
const settings_1 = require("./settings");
const git_1 = require("./git");
const profiles_1 = require("./profiles");
// Colors - only if enabled
function getColors() {
    const enabled = (0, settings_1.shouldShowColor)();
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
exports.ASCII_LOGO = ASCII_LOGO;
// Show logo on startup (only if enabled and first run or setting is on)
function renderStartup(projectName) {
    const c = getColors();
    const lines = [];
    // Logo (optional)
    if ((0, settings_1.shouldShowLogo)()) {
        lines.push(c.dim + ASCII_LOGO.trim() + c.reset);
        lines.push('');
    }
    // Header
    lines.push(`Z.ai Code ${c.dim}— project: ${projectName}${c.reset}`);
    return lines.join('\n');
}
// Get state label
function getStateLabel(session) {
    if (session.pendingActions)
        return 'dirty';
    if (session.lastDiff)
        return 'dirty';
    if (session.lastPlan && session.lastPlan.length > 0)
        return 'pending';
    return 'clean';
}
// Get focus (current file or step)
function getFocus(session) {
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
function getPrompt(session) {
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
function renderStatus(session) {
    const c = getColors();
    const state = getStateLabel(session);
    return `${c.dim}Mode: ${session.mode} | State: ${state}${c.reset}`;
}
// Status bar: git | model | profile | pending
function renderStatusBar(session) {
    const c = getColors();
    const gitInfo = (0, git_1.getGitInfo)(session.workingDirectory);
    const gitStatus = (0, git_1.formatGitStatus)(gitInfo);
    const model = (0, settings_1.getModel)().split('-').slice(0, 2).join('-'); // Shorten model name
    const profile = (0, profiles_1.getActiveProfileName)();
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
function getWarnings(session) {
    const warnings = [];
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
function success(msg) {
    const c = getColors();
    return `${c.green}${msg}${c.reset}`;
}
function warning(msg) {
    const c = getColors();
    return `${c.yellow}${msg}${c.reset}`;
}
function error(msg) {
    const c = getColors();
    return `${c.red}${msg}${c.reset}`;
}
function dim(msg) {
    const c = getColors();
    return `${c.dim}${msg}${c.reset}`;
}
function info(msg) {
    const c = getColors();
    return `${c.cyan}${msg}${c.reset}`;
}
// Hint for next action
function hint(msg) {
    const c = getColors();
    return `${c.dim}next: ${msg}${c.reset}`;
}
//# sourceMappingURL=ui.js.map