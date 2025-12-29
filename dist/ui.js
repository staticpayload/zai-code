"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASCII_LOGO = void 0;
exports.renderStartup = renderStartup;
exports.getPrompt = getPrompt;
exports.renderStatusBar = renderStatusBar;
exports.renderStatus = renderStatus;
exports.getWarnings = getWarnings;
exports.success = success;
exports.warning = warning;
exports.error = error;
exports.dim = dim;
exports.info = info;
exports.hint = hint;
exports.header = header;
exports.highlight = highlight;
exports.code = code;
exports.progressBar = progressBar;
exports.spinner = spinner;
exports.fileOp = fileOp;
exports.diffLine = diffLine;
exports.table = table;
exports.box = box;
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
exports.ASCII_LOGO = ASCII_LOGO;
// Show logo on startup (only if enabled)
function renderStartup(projectName) {
    const c = getColors();
    const lines = [];
    // Logo (optional, minimal)
    if ((0, settings_1.shouldShowLogo)()) {
        lines.push('');
        lines.push(`${c.bold}${c.cyan}⚡ zai${c.reset}${c.dim}·code${c.reset}  ${c.gray}AI-native code editor${c.reset}`);
    }
    // Get git info
    const cwd = process.cwd();
    const gitInfo = (0, git_1.getGitInfo)(cwd);
    const gitStatus = gitInfo.isRepo ?
        `${gitInfo.branch || 'unknown'}${gitInfo.isDirty ? '*' : ''}` :
        'no-git';
    // Status line
    const model = (0, settings_1.getModel)().split('-').slice(1, 3).join('-');
    const profile = (0, profiles_1.getActiveProfileName)() || 'custom';
    lines.push('');
    lines.push(`${c.dim}${projectName}${c.reset} ${c.dim}│${c.reset} ${gitStatus} ${c.dim}│${c.reset} ${model}`);
    lines.push('');
    return lines.join('\n');
}
// Get state label
function getStateLabel(session) {
    if (session.pendingActions)
        return 'pending';
    if (session.lastDiff)
        return 'pending';
    if (session.lastPlan && session.lastPlan.length > 0)
        return 'planned';
    return 'ready';
}
// Get focus (current file or step)
function getFocus(session) {
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
function getPrompt(session) {
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
function renderStatusBar(session) {
    const c = getColors();
    const gitInfo = (0, git_1.getGitInfo)(session.workingDirectory);
    const gitStatus = (0, git_1.formatGitStatus)(gitInfo);
    const model = (0, settings_1.getModel)().split('-').slice(0, 2).join('-');
    const profile = (0, profiles_1.getActiveProfileName)();
    const pending = session.pendingActions ?
        (session.pendingActions.files?.length || 0) + (session.pendingActions.diffs?.length || 0) : 0;
    const parts = [gitStatus, `${model}`, profile];
    if (pending > 0) {
        parts.push(`${pending} pending`);
    }
    return c.dim + parts.join(' · ') + c.reset;
}
// Status line: Mode: <mode> | State: <state>
function renderStatus(session) {
    const c = getColors();
    const state = getStateLabel(session);
    return `${c.dim}Mode: ${session.mode} | State: ${state}${c.reset}`;
}
// Contextual warnings
function getWarnings(session) {
    const warnings = [];
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
    }
    catch {
        // Ignore errors in warning generation
    }
    return warnings;
}
// Output helpers
function success(msg) {
    const c = getColors();
    return `${c.green}✓${c.reset} ${msg}`;
}
function warning(msg) {
    const c = getColors();
    return `${c.yellow}⚠${c.reset} ${msg}`;
}
function error(msg) {
    const c = getColors();
    return `${c.red}✗${c.reset} ${msg}`;
}
function dim(msg) {
    const c = getColors();
    return `${c.dim}${msg}${c.reset}`;
}
function info(msg) {
    const c = getColors();
    return `${c.cyan}${msg}${c.reset}`;
}
// Hint for next action - now more prominent
function hint(action) {
    const c = getColors();
    return `${c.dim}→ ${action}${c.reset}`;
}
// Section header
function header(title) {
    const c = getColors();
    return `${c.bold}${title}${c.reset}`;
}
// Highlight text
function highlight(msg) {
    const c = getColors();
    return `${c.cyan}${c.bold}${msg}${c.reset}`;
}
// Code/command formatting
function code(msg) {
    const c = getColors();
    return `${c.gray}\`${msg}\`${c.reset}`;
}
// Progress bar
function progressBar(current, total, width = 20) {
    const c = getColors();
    const percent = Math.min(1, Math.max(0, current / total));
    const filled = Math.round(width * percent);
    const empty = width - filled;
    const bar = PROGRESS_FULL.repeat(filled) + PROGRESS_EMPTY.repeat(empty);
    return `${c.cyan}${bar}${c.reset} ${Math.round(percent * 100)}%`;
}
// Spinner frame
function spinner(frame) {
    const c = getColors();
    return `${c.cyan}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}${c.reset}`;
}
// File operation formatting
function fileOp(operation, filePath) {
    const c = getColors();
    const opColors = {
        'create': c.green,
        'modify': c.yellow,
        'delete': c.red,
    };
    const color = opColors[operation] || c.cyan;
    const icons = {
        'create': '+',
        'modify': '~',
        'delete': '-',
    };
    const icon = icons[operation] || '?';
    return `${color}${icon}${c.reset} ${filePath}`;
}
// Diff line formatting
function diffLine(line) {
    const c = getColors();
    if (line.startsWith('+')) {
        return `${c.green}${line}${c.reset}`;
    }
    else if (line.startsWith('-')) {
        return `${c.red}${line}${c.reset}`;
    }
    else if (line.startsWith('@')) {
        return `${c.cyan}${line}${c.reset}`;
    }
    return line;
}
// Table formatting
function table(rows, headers) {
    const c = getColors();
    const lines = [];
    // Calculate column widths
    const allRows = headers ? [headers, ...rows] : rows;
    const colWidths = allRows[0].map((_, i) => Math.max(...allRows.map(row => (row[i] || '').length)));
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
function box(content, title) {
    const c = getColors();
    const maxLen = Math.max(...content.map(l => l.length), title?.length || 0);
    const lines = [];
    if (title) {
        lines.push(`${c.dim}─${c.reset} ${title} ${c.dim}${'─'.repeat(Math.max(0, maxLen - title.length))}${c.reset}`);
    }
    for (const line of content) {
        lines.push(`  ${line}`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=ui.js.map