"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInteractive = startInteractive;
const session_1 = require("./session");
const orchestrator_1 = require("./orchestrator");
const git_1 = require("./git");
const settings_1 = require("./settings");
const profiles_1 = require("./profiles");
// Command definitions with descriptions
const COMMANDS = [
    { name: 'help', description: 'Show all commands' },
    { name: 'plan', description: 'Generate execution plan' },
    { name: 'generate', description: 'Create file changes' },
    { name: 'diff', description: 'Review pending changes' },
    { name: 'apply', description: 'Apply changes' },
    { name: 'undo', description: 'Rollback last operation' },
    { name: 'reset', description: 'Reset session state' },
    { name: 'exit', description: 'Exit zcode' },
    { name: 'mode', description: 'Set mode' },
    { name: 'model', description: 'Select AI model' },
    { name: 'dry-run', description: 'Toggle dry-run mode' },
    { name: 'profile', description: 'Manage profiles' },
    { name: 'settings', description: 'Open settings menu' },
    { name: 'context', description: 'Show current context' },
    { name: 'files', description: 'List open files' },
    { name: 'open', description: 'Add file to context' },
    { name: 'workspace', description: 'Show workspace info' },
    { name: 'git', description: 'Show git status' },
    { name: 'exec', description: 'Run shell command' },
    { name: 'history', description: 'View task history' },
    { name: 'doctor', description: 'System health check' },
    { name: 'decompose', description: 'Break task into steps' },
    { name: 'step', description: 'Plan current step' },
    { name: 'next', description: 'Complete and advance' },
    { name: 'skip', description: 'Skip current step' },
    { name: 'progress', description: 'Show task progress' },
];
// ANSI escape codes
const ESC = '\x1b';
const CSI = `${ESC}[`;
// Screen control
const screen = {
    clear: () => process.stdout.write(`${CSI}2J${CSI}H`),
    clearLine: () => process.stdout.write(`${CSI}2K`),
    moveTo: (row, col) => process.stdout.write(`${CSI}${row};${col}H`),
    moveUp: (n) => process.stdout.write(`${CSI}${n}A`),
    moveDown: (n) => process.stdout.write(`${CSI}${n}B`),
    saveCursor: () => process.stdout.write(`${ESC}7`),
    restoreCursor: () => process.stdout.write(`${ESC}8`),
    showCursor: () => process.stdout.write(`${CSI}?25h`),
    hideCursor: () => process.stdout.write(`${CSI}?25l`),
};
// Colors
const c = {
    reset: `${CSI}0m`,
    dim: `${CSI}2m`,
    bold: `${CSI}1m`,
    cyan: `${CSI}36m`,
    green: `${CSI}32m`,
    yellow: `${CSI}33m`,
    red: `${CSI}31m`,
    inverse: `${CSI}7m`,
};
// Get terminal dimensions
function getTermSize() {
    return {
        rows: process.stdout.rows || 24,
        cols: process.stdout.columns || 80,
    };
}
// Render header
function renderHeader(projectName) {
    const { cols } = getTermSize();
    const session = (0, session_1.getSession)();
    const gitInfo = (0, git_1.getGitInfo)(session.workingDirectory);
    const model = (0, settings_1.getModel)().split('-').slice(1, 3).join('-');
    const profile = (0, profiles_1.getActiveProfileName)() || 'custom';
    const gitStatus = gitInfo.isRepo
        ? `${gitInfo.branch || '?'}${gitInfo.isDirty ? '*' : ''}`
        : 'no-git';
    const left = `${c.bold}${c.cyan}zai${c.reset}${c.dim}·code${c.reset} ${c.dim}${projectName}${c.reset}`;
    const right = `${c.dim}${gitStatus} · ${model} · ${profile}${c.reset}`;
    // Strip ANSI for length calculation
    const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
    const leftLen = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const padding = Math.max(0, cols - leftLen - rightLen - 2);
    screen.moveTo(1, 1);
    screen.clearLine();
    process.stdout.write(`${left}${' '.repeat(padding)}${right}`);
    // Separator line
    screen.moveTo(2, 1);
    screen.clearLine();
    process.stdout.write(`${c.dim}${'─'.repeat(cols)}${c.reset}`);
}
// Render prompt
function renderPrompt(input) {
    const { rows, cols } = getTermSize();
    const session = (0, session_1.getSession)();
    // State
    const state = session.pendingActions || session.lastDiff ? 'pending' :
        session.lastPlan?.length ? 'planned' : 'ready';
    // Build prompt
    const prompt = `${c.cyan}${session.mode}${c.reset}${session.dryRun ? `${c.yellow}(dry)${c.reset}` : ''}${c.dim}:${c.reset}${state}${c.bold}>${c.reset} `;
    const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
    const promptLen = stripAnsi(prompt).length;
    // Separator
    screen.moveTo(rows - 1, 1);
    screen.clearLine();
    process.stdout.write(`${c.dim}${'─'.repeat(cols)}${c.reset}`);
    // Prompt line
    screen.moveTo(rows, 1);
    screen.clearLine();
    if (input) {
        process.stdout.write(`${prompt}${input}`);
    }
    else {
        process.stdout.write(`${prompt}${c.dim}Type / for commands...${c.reset}`);
    }
    // Position cursor
    screen.moveTo(rows, promptLen + input.length + 1);
}
// Render command palette
function renderPalette(filter, selectedIndex) {
    const { rows, cols } = getTermSize();
    const query = filter.replace(/^\//, '').toLowerCase();
    const filtered = COMMANDS.filter(cmd => cmd.name.startsWith(query)).slice(0, 8);
    if (filtered.length === 0)
        return 0;
    const paletteTop = rows - 2 - filtered.length;
    for (let i = 0; i < filtered.length; i++) {
        const cmd = filtered[i];
        const row = paletteTop + i;
        const isSelected = i === selectedIndex;
        screen.moveTo(row, 1);
        screen.clearLine();
        if (isSelected) {
            process.stdout.write(`${c.inverse} ▸ /${cmd.name.padEnd(14)} ${cmd.description.substring(0, cols - 20)} ${c.reset}`);
        }
        else {
            process.stdout.write(`   ${c.dim}/${cmd.name.padEnd(14)}${c.reset} ${c.dim}${cmd.description.substring(0, cols - 20)}${c.reset}`);
        }
    }
    // Hint line
    screen.moveTo(rows - 2, 1);
    screen.clearLine();
    process.stdout.write(`${c.dim}↑↓ navigate · Enter select · Esc close${c.reset}`);
    return filtered.length;
}
// Clear palette
function clearPalette(count) {
    const { rows } = getTermSize();
    const paletteTop = rows - 2 - count;
    for (let i = 0; i <= count + 1; i++) {
        screen.moveTo(paletteTop + i, 1);
        screen.clearLine();
    }
}
// Output buffer
let outputLines = [];
// Add output line
function addOutput(line) {
    outputLines.push(line);
    renderOutput();
}
// Render output area
function renderOutput() {
    const { rows } = getTermSize();
    const outputStart = 3;
    const outputEnd = rows - 2;
    const outputHeight = outputEnd - outputStart;
    const visible = outputLines.slice(-outputHeight);
    for (let i = 0; i < outputHeight; i++) {
        screen.moveTo(outputStart + i, 1);
        screen.clearLine();
        if (visible[i]) {
            process.stdout.write(visible[i]);
        }
    }
}
// Main interactive loop
async function startInteractive(options) {
    const projectName = options?.projectName || 'project';
    let input = '';
    let showPalette = false;
    let paletteIndex = 0;
    let paletteCount = 0;
    // Initial render
    screen.clear();
    renderHeader(projectName);
    if (options?.restored) {
        addOutput(`${c.dim}Session restored.${c.reset}`);
    }
    addOutput(`${c.dim}Type / for commands, or enter a task${c.reset}`);
    renderOutput();
    renderPrompt(input);
    // Enable raw mode
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    screen.showCursor();
    const handleKey = async (key) => {
        // Ctrl+C
        if (key === '\x03') {
            screen.clear();
            screen.moveTo(1, 1);
            screen.showCursor();
            if (process.stdin.isTTY)
                process.stdin.setRawMode(false);
            options?.onExit?.();
            return;
        }
        // Escape
        if (key === '\x1b' && showPalette) {
            clearPalette(paletteCount);
            showPalette = false;
            paletteIndex = 0;
            paletteCount = 0;
            renderPrompt(input);
            return;
        }
        // Up arrow
        if (key === '\x1b[A' && showPalette) {
            paletteIndex = Math.max(0, paletteIndex - 1);
            paletteCount = renderPalette(input, paletteIndex);
            renderPrompt(input);
            return;
        }
        // Down arrow
        if (key === '\x1b[B' && showPalette) {
            paletteIndex = Math.min(paletteCount - 1, paletteIndex + 1);
            paletteCount = renderPalette(input, paletteIndex);
            renderPrompt(input);
            return;
        }
        // Tab - autocomplete
        if (key === '\t' && showPalette && paletteCount > 0) {
            const query = input.replace(/^\//, '').toLowerCase();
            const filtered = COMMANDS.filter(cmd => cmd.name.startsWith(query));
            if (filtered[paletteIndex]) {
                input = `/${filtered[paletteIndex].name} `;
                clearPalette(paletteCount);
                showPalette = false;
                paletteIndex = 0;
                paletteCount = 0;
                renderPrompt(input);
            }
            return;
        }
        // Enter
        if (key === '\r' || key === '\n') {
            // Select from palette
            if (showPalette && paletteCount > 0) {
                const query = input.replace(/^\//, '').toLowerCase();
                const filtered = COMMANDS.filter(cmd => cmd.name.startsWith(query));
                if (filtered[paletteIndex]) {
                    input = `/${filtered[paletteIndex].name}`;
                }
                clearPalette(paletteCount);
                showPalette = false;
                paletteIndex = 0;
                paletteCount = 0;
            }
            // Submit
            const trimmed = input.trim();
            input = '';
            if (trimmed) {
                addOutput(`${c.dim}> ${trimmed}${c.reset}`);
                // Exit
                if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
                    screen.clear();
                    screen.moveTo(1, 1);
                    screen.showCursor();
                    if (process.stdin.isTTY)
                        process.stdin.setRawMode(false);
                    options?.onExit?.();
                    return;
                }
                // Process command
                const originalLog = console.log;
                console.log = (...args) => {
                    addOutput(args.map(a => String(a)).join(' '));
                };
                try {
                    await (0, orchestrator_1.orchestrate)(trimmed);
                }
                catch (e) {
                    addOutput(`${c.red}Error: ${e}${c.reset}`);
                }
                console.log = originalLog;
                renderHeader(projectName);
                renderOutput();
            }
            renderPrompt(input);
            return;
        }
        // Backspace
        if (key === '\x7f' || key === '\b') {
            if (input.length > 0) {
                input = input.slice(0, -1);
                if (input.startsWith('/')) {
                    clearPalette(paletteCount);
                    paletteIndex = 0;
                    paletteCount = renderPalette(input, paletteIndex);
                    showPalette = paletteCount > 0;
                }
                else if (showPalette) {
                    clearPalette(paletteCount);
                    showPalette = false;
                    paletteCount = 0;
                }
                renderPrompt(input);
            }
            return;
        }
        // Regular character
        if (key.length === 1 && key >= ' ') {
            input += key;
            if (input.startsWith('/')) {
                clearPalette(paletteCount);
                paletteIndex = 0;
                paletteCount = renderPalette(input, paletteIndex);
                showPalette = paletteCount > 0;
            }
            renderPrompt(input);
        }
    };
    process.stdin.on('data', handleKey);
    process.on('SIGINT', () => {
        cleanup();
    });
    process.on('SIGTERM', () => {
        cleanup();
    });
    function cleanup() {
        screen.clear();
        screen.moveTo(1, 1);
        screen.showCursor();
        if (process.stdin.isTTY)
            process.stdin.setRawMode(false);
        process.stdin.pause();
        options?.onExit?.();
        process.exit(0);
    }
    // Handle terminal resize
    process.stdout.on('resize', () => {
        screen.clear();
        renderHeader(projectName);
        renderOutput();
        if (showPalette) {
            paletteCount = renderPalette(input, paletteIndex);
        }
        renderPrompt(input);
    });
    // Handle uncaught errors gracefully
    process.on('uncaughtException', (err) => {
        addOutput(`Error: ${err.message}`);
        renderOutput();
        renderPrompt(input);
    });
    return new Promise(() => { });
}
//# sourceMappingURL=interactive.js.map