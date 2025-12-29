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
exports.startTUI = startTUI;
const blessed = __importStar(require("blessed"));
const session_1 = require("./session");
const orchestrator_1 = require("./orchestrator");
const git_1 = require("./git");
const settings_1 = require("./settings");
const agents_1 = require("./agents");
// Command definitions
const COMMANDS = [
    { name: 'help', description: 'Show all commands' },
    { name: 'ask', description: 'Switch to ask mode (read-only)' },
    { name: 'plan', description: 'Generate execution plan' },
    { name: 'generate', description: 'Create file changes' },
    { name: 'diff', description: 'Review pending changes' },
    { name: 'apply', description: 'Apply changes' },
    { name: 'undo', description: 'Rollback last operation' },
    { name: 'model', description: 'Select AI model' },
    { name: 'mode', description: 'Set mode' },
    { name: 'settings', description: 'Open settings menu' },
    { name: 'git', description: 'Show git status' },
    { name: 'reset', description: 'Reset session' },
    { name: 'exit', description: 'Exit zcode' },
];
// ASCII Logo
const ASCII_LOGO = `
{bold}{blue-fg}███████╗{/blue-fg}{cyan-fg} █████╗ {/cyan-fg}{blue-fg}██╗{/blue-fg}    {cyan-fg} ██████╗ ██████╗ ██████╗ ███████╗{/cyan-fg}{/bold}
{bold}{blue-fg}╚══███╔╝{/blue-fg}{cyan-fg}██╔══██╗{/cyan-fg}{blue-fg}██║{/blue-fg}    {cyan-fg}██╔════╝██╔═══██╗██╔══██╗██╔════╝{/cyan-fg}{/bold}
{bold}{blue-fg}  ███╔╝ {/blue-fg}{cyan-fg}███████║{/cyan-fg}{blue-fg}██║{/blue-fg}    {cyan-fg}██║     ██║   ██║██║  ██║█████╗  {/cyan-fg}{/bold}
{bold}{blue-fg} ███╔╝  {/blue-fg}{cyan-fg}██╔══██║{/cyan-fg}{blue-fg}██║{/blue-fg}    {cyan-fg}██║     ██║   ██║██║  ██║██╔══╝  {/cyan-fg}{/bold}
{bold}{blue-fg}███████╗{/blue-fg}{cyan-fg}██║  ██║{/cyan-fg}{blue-fg}██║{/blue-fg}    {cyan-fg}╚██████╗╚██████╔╝██████╔╝███████╗{/cyan-fg}{/bold}
{bold}{blue-fg}╚══════╝{/blue-fg}{cyan-fg}╚═╝  ╚═╝{/cyan-fg}{blue-fg}╚═╝{/blue-fg}    {cyan-fg} ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝{/cyan-fg}{/bold}
`;
const MINIMAL_LOGO = '{bold}{blue-fg}zai{/blue-fg} {cyan-fg}code{/cyan-fg}{/bold}';
async function startTUI(options) {
    const { projectName, restored, onExit } = options;
    const session = (0, session_1.getSession)();
    // Check if TTY is available
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error('Error: TUI requires an interactive terminal.');
        console.error('Run in a terminal that supports TTY, or use "zcode run <task>" for non-interactive mode.');
        process.exit(1);
    }
    // Create screen with explicit color support
    const screen = blessed.screen({
        smartCSR: true,
        title: 'zai·code',
        fullUnicode: true,
        dockBorders: true,
        autoPadding: true,
        warnings: false, // Suppress blessed warnings
    });
    // Theme colors
    const theme = {
        bg: 'black',
        fg: 'white',
        border: 'blue',
        highlight: 'cyan',
        gray: 'gray'
    };
    // Header with logo
    const header = blessed.box({
        top: 0,
        left: 0,
        width: '100%',
        height: (0, settings_1.shouldShowLogo)() ? 8 : 2,
        tags: true,
        content: (0, settings_1.shouldShowLogo)() ? ASCII_LOGO : MINIMAL_LOGO,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
    });
    // Tips section
    const tips = blessed.box({
        top: (0, settings_1.shouldShowLogo)() ? 8 : 2,
        left: 0,
        width: '100%',
        height: 4,
        tags: true,
        content: `{bold}Tips for getting started:{/bold}
1. Type a task or question to begin.
2. Use {bold}/commands{/bold} for direct actions.
3. {bold}/help{/bold} for more information.`,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1 },
    });
    // Warning box (if in home directory)
    const warningTop = (0, settings_1.shouldShowLogo)() ? 12 : 6;
    const warning = blessed.box({
        top: warningTop,
        left: 0,
        width: '100%',
        height: 3,
        tags: true,
        border: {
            type: 'line',
        },
        style: {
            fg: 'yellow',
            bg: theme.bg,
            border: {
                fg: 'yellow',
                bg: theme.bg
            },
        },
        padding: { left: 1 },
        hidden: true,
    });
    // Check warnings
    const gitInfo = (0, git_1.getGitInfo)(session.workingDirectory);
    if (session.workingDirectory === require('os').homedir()) {
        warning.setContent('You are running in your home directory. It is recommended to run in a project-specific directory.');
        warning.show();
    }
    else if (!gitInfo.isRepo) {
        warning.setContent('Not a git repository. Changes cannot be tracked.');
        warning.show();
    }
    // Context line (Using: X files)
    const contextTop = warning.hidden ? warningTop : warningTop + 3;
    const context = blessed.box({
        top: contextTop,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        content: `{bold}${projectName}{/bold}  ·  ${session.openFiles.length || 0} file(s) in context`,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1 },
    });
    // Main output area
    const outputTop = contextTop + 2;
    const output = blessed.log({
        top: outputTop,
        left: 0,
        width: '100%',
        height: `100%-${outputTop + 6}`,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: '│',
            style: {
                fg: theme.highlight,
                bg: theme.bg
            },
        },
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1, right: 1 },
    });
    // Input box container
    const inputContainer = blessed.box({
        bottom: 2,
        left: 0,
        width: '100%',
        height: 3,
        border: {
            type: 'line',
        },
        style: {
            bg: theme.bg,
            border: {
                fg: theme.border,
                bg: theme.bg
            },
        },
    });
    // Input prompt symbol
    const inputPrompt = blessed.text({
        parent: inputContainer,
        left: 1,
        top: 0,
        content: `{bold}{blue-fg}❯{/blue-fg}{/bold}`,
        tags: true,
        style: {
            bg: theme.bg
        }
    });
    // Input textbox - higher z-index to be on top
    const input = blessed.textbox({
        parent: inputContainer,
        left: 3,
        top: 0,
        width: '100%-5',
        height: 1,
        inputOnFocus: true,
        keys: true,
        mouse: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
    });
    // NOTE: Removed placeholder text element entirely to prevent overlap issues
    // The tips section already explains how to use the interface
    // Status bar at bottom
    const statusBar = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1, right: 1 },
    });
    // Update status bar
    function updateStatusBar() {
        const model = (0, settings_1.getModel)();
        const mode = (0, session_1.getSession)().mode;
        const gitStatus = gitInfo.isRepo ? `${gitInfo.branch}${gitInfo.isDirty ? '*' : ''}` : 'no-git';
        const left = `{bold}[${mode}]{/bold}`;
        const center = `${gitStatus}`;
        const right = `{cyan-fg}${model}{/cyan-fg}`;
        const width = screen.width || 80;
        const padding = Math.max(0, Math.floor((width - 40) / 2));
        statusBar.setContent(`${left}${' '.repeat(padding)}${center}${' '.repeat(padding)}${right}`);
    }
    // Command palette - NO keys/mouse to prevent stealing focus
    const palette = blessed.list({
        bottom: 5,
        left: 1,
        width: 40,
        height: 10,
        tags: true,
        keys: false, // CRITICAL: Don't let palette handle keys
        mouse: false, // CRITICAL: Don't let palette handle mouse
        interactive: false, // Not interactive - we handle navigation manually
        border: {
            type: 'line',
        },
        style: {
            fg: theme.fg,
            bg: theme.bg,
            border: {
                fg: theme.border,
                bg: theme.bg
            },
            selected: {
                bg: theme.border,
                fg: theme.fg,
                bold: true,
            },
        },
        hidden: true,
    });
    // Add all elements to screen
    screen.append(header);
    screen.append(tips);
    screen.append(warning);
    screen.append(context);
    screen.append(output);
    screen.append(inputContainer);
    screen.append(statusBar);
    screen.append(palette);
    // Initial render
    updateStatusBar();
    input.focus();
    screen.render();
    // Restored message
    if (restored) {
        output.log('{gray-fg}Session restored.{/gray-fg}');
    }
    // agents.md notice
    if ((0, agents_1.hasAgentsConfig)(session.workingDirectory)) {
        output.log('{green-fg}agents.md detected and applied{/green-fg}');
    }
    // --- LOGIC ---
    let showPalette = false;
    function updatePalette(filter) {
        const query = filter.replace(/^\//, '').toLowerCase();
        const filtered = COMMANDS.filter(c => c.name.startsWith(query));
        palette.setItems(filtered.map(c => `{bold}/${c.name}{/bold}  {gray-fg}${c.description}{/gray-fg}`));
        // Reset selection to top on new filter
        if (filtered.length > 0) {
            palette.select(0);
        }
    }
    function togglePalette(show, filter = '/') {
        showPalette = show;
        if (show) {
            updatePalette(filter);
            palette.show();
            // CRITICAL: Do NOT focus palette. Keep input focused.
            screen.render();
        }
        else {
            palette.hide();
            screen.render();
        }
    }
    // Process input
    async function processInput(value) {
        if (!value.trim())
            return;
        output.log(`{cyan-fg}>{/cyan-fg} ${value}`);
        screen.render();
        const trimmed = value.trim();
        if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
            onExit?.();
            return process.exit(0);
        }
        if (trimmed === '/settings') {
            showSettingsMenu();
            return;
        }
        // Capture console.log to redirect to output
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        console.log = (...args) => {
            const msg = args.map(a => String(a)).join(' ');
            output.log(msg);
            screen.render();
        };
        console.error = (...args) => {
            const msg = args.map(a => String(a)).join(' ');
            output.log(`{red-fg}${msg}{/red-fg}`);
            screen.render();
        };
        console.warn = (...args) => {
            const msg = args.map(a => String(a)).join(' ');
            output.log(`{yellow-fg}${msg}{/yellow-fg}`);
            screen.render();
        };
        try {
            output.log('{gray-fg}Processing...{/gray-fg}');
            screen.render();
            await (0, orchestrator_1.orchestrate)(value);
        }
        catch (e) {
            output.log(`{red-fg}Error: ${e?.message || e}{/red-fg}`);
        }
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        updateStatusBar();
        screen.render();
    }
    // Input events
    input.on('focus', () => {
        screen.render();
    });
    input.on('blur', () => {
        screen.render();
    });
    // Manual keypress handling for Palette interaction
    input.on('keypress', (ch, key) => {
        if (!key) {
            screen.render();
            return;
        }
        if (key.name === 'escape') {
            if (showPalette) {
                togglePalette(false);
            }
            screen.render();
            return;
        }
        if (key.name === 'down') {
            if (showPalette) {
                palette.down(1);
                screen.render();
                return;
            }
        }
        if (key.name === 'up') {
            if (showPalette) {
                palette.up(1);
                screen.render();
                return;
            }
        }
        // Check input content on next tick to see if we should show palette
        setImmediate(() => {
            const val = input.getValue();
            if (val && val.startsWith('/')) {
                togglePalette(true, val);
            }
            else {
                if (showPalette)
                    togglePalette(false);
            }
            screen.render();
        });
    });
    // Submit handler
    input.on('submit', async (value) => {
        const inputValue = value || input.getValue() || '';
        if (showPalette && inputValue.startsWith('/')) {
            const selectedIndex = palette.selected || 0;
            const filter = inputValue.replace(/^\//, '').toLowerCase();
            const filteredCommands = COMMANDS.filter(c => c.name.startsWith(filter));
            if (filteredCommands[selectedIndex]) {
                // Check if command needs arguments
                const cmd = filteredCommands[selectedIndex];
                const hasArgs = ['mode', 'model', 'open', 'file', 'exec'].includes(cmd.name);
                if (hasArgs && !inputValue.includes(' ')) {
                    // Command needs args - autocomplete and wait for user to type args
                    input.setValue('/' + cmd.name + ' ');
                    togglePalette(false);
                    input.focus();
                    screen.render();
                    return;
                }
            }
        }
        // Clear input and palette before processing
        input.clearValue();
        togglePalette(false);
        screen.render();
        // Process the input
        if (inputValue && inputValue.trim()) {
            await processInput(inputValue);
        }
        // Refocus input for next command
        input.focus();
        screen.render();
    });
    // SETTINGS MODAL
    function showSettingsMenu() {
        let settingsActive = true;
        let currentSettings = (0, settings_1.loadSettings)();
        const models = settings_1.AVAILABLE_MODELS;
        let selectedIndex = 0;
        const getListItems = () => [
            `Model: ${currentSettings.model.current}`,
            `Color: ${currentSettings.ui.color}`,
            `Prompt: ${currentSettings.ui.promptStyle}`,
            `Confirm: ${currentSettings.execution.confirmationMode}`,
            `Shell Exec: ${currentSettings.execution.allowShellExec}`,
            `Debug Log: ${currentSettings.debug.logging}`
        ];
        const modal = blessed.box({
            parent: screen,
            top: 'center',
            left: 'center',
            width: '50%',
            height: '60%',
            border: { type: 'line' },
            label: ' Settings ',
            tags: true,
            style: {
                bg: 'black',
                fg: 'white',
                border: { fg: 'cyan' },
                label: { fg: 'cyan', bold: true }
            },
        });
        const list = blessed.list({
            parent: modal,
            top: 1,
            left: 1,
            right: 1,
            bottom: 3,
            keys: false, // We handle keys manually
            mouse: false,
            style: {
                selected: { bg: 'blue', fg: 'white', bold: true },
                item: { fg: 'white', bg: 'black' }
            },
            items: getListItems()
        });
        const help = blessed.text({
            parent: modal,
            bottom: 1,
            left: 1,
            content: '↑↓:navigate  Enter:toggle  Esc:save & exit',
            style: { fg: 'gray', bg: 'black' }
        });
        list.select(0);
        screen.render();
        function cycleValue() {
            if (selectedIndex === 0) { // Model
                const currIdx = models.indexOf(currentSettings.model.current);
                const nextIdx = (currIdx + 1) % models.length;
                currentSettings.model.current = models[nextIdx];
            }
            else if (selectedIndex === 1) { // Color
                const vals = ['auto', 'on', 'off'];
                const n = (vals.indexOf(currentSettings.ui.color) + 1) % 3;
                currentSettings.ui.color = vals[n];
            }
            else if (selectedIndex === 2) { // Prompt
                currentSettings.ui.promptStyle = currentSettings.ui.promptStyle === 'compact' ? 'verbose' : 'compact';
            }
            else if (selectedIndex === 3) { // Confirm
                currentSettings.execution.confirmationMode = currentSettings.execution.confirmationMode === 'strict' ? 'normal' : 'strict';
            }
            else if (selectedIndex === 4) { // Shell
                currentSettings.execution.allowShellExec = !currentSettings.execution.allowShellExec;
            }
            else if (selectedIndex === 5) { // Debug
                currentSettings.debug.logging = !currentSettings.debug.logging;
            }
            list.setItems(getListItems());
            list.select(selectedIndex);
            screen.render();
        }
        function closeSettings() {
            if (!settingsActive)
                return;
            settingsActive = false;
            (0, settings_1.saveSettings)(currentSettings);
            updateStatusBar();
            screen.remove(modal);
            input.focus();
            screen.render();
            output.log('{green-fg}Settings saved.{/green-fg}');
        }
        // Handle keys on screen level while settings is open
        const settingsKeyHandler = (ch, key) => {
            if (!settingsActive)
                return;
            if (key.name === 'escape') {
                closeSettings();
            }
            else if (key.name === 'up') {
                selectedIndex = Math.max(0, selectedIndex - 1);
                list.select(selectedIndex);
                screen.render();
            }
            else if (key.name === 'down') {
                selectedIndex = Math.min(getListItems().length - 1, selectedIndex + 1);
                list.select(selectedIndex);
                screen.render();
            }
            else if (key.name === 'enter' || key.name === 'return') {
                cycleValue();
            }
        };
        screen.on('keypress', settingsKeyHandler);
        // Cleanup when modal is destroyed
        modal.on('destroy', () => {
            screen.removeListener('keypress', settingsKeyHandler);
        });
    }
    // Global Key Bindings
    screen.key(['C-c'], () => {
        onExit?.();
        return process.exit(0);
    });
    screen.key(['q'], () => {
        // Only quit if not focused on input
        if (screen.focused !== input) {
            onExit?.();
            return process.exit(0);
        }
    });
    // Handle errors gracefully
    screen.on('warning', (msg) => {
        // Suppress blessed warnings
    });
    process.on('uncaughtException', (err) => {
        output.log(`{red-fg}Error: ${err.message}{/red-fg}`);
        screen.render();
    });
    screen.render();
}
//# sourceMappingURL=tui.js.map