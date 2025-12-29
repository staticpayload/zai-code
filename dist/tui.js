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
// ASCII Logo - ZAI CODE in matching block style, blue-themed
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
    // Create screen
    const screen = blessed.screen({
        smartCSR: true,
        title: 'zai·code',
        fullUnicode: true,
    });
    // Header with logo
    const header = blessed.box({
        top: 0,
        left: 0,
        width: '100%',
        height: (0, settings_1.shouldShowLogo)() ? 8 : 2,
        tags: true,
        content: (0, settings_1.shouldShowLogo)() ? ASCII_LOGO : MINIMAL_LOGO,
        style: {
            fg: 'white',
            bg: 'default',
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
            fg: 'white',
            bg: 'default',
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
            bg: 'default',
            border: {
                fg: 'yellow',
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
            fg: 'white',
            bg: 'default',
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
                fg: 'blue',
            },
        },
        style: {
            fg: 'white',
            bg: 'default',
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
            border: {
                fg: 'blue',
            },
        },
    });
    // Input prompt symbol
    const inputPrompt = blessed.text({
        parent: inputContainer,
        left: 1,
        top: 0,
        content: '{bold}{blue-fg}❯{/blue-fg}{/bold}',
        tags: true,
    });
    // Input textbox
    const input = blessed.textbox({
        parent: inputContainer,
        left: 3,
        top: 0,
        width: '100%-5',
        height: 1,
        inputOnFocus: true,
        style: {
            fg: 'white',
            bg: 'default',
        },
    });
    // Placeholder text
    const placeholder = blessed.text({
        parent: inputContainer,
        left: 3,
        top: 0,
        tags: true,
        content: '{gray-fg}Type your message or @path/to/file{/gray-fg}',
        style: {
            fg: 'gray',
        },
    });
    // Status bar at bottom
    const statusBar = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: {
            fg: 'white',
            bg: 'default',
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
    // Command palette
    const palette = blessed.list({
        bottom: 5,
        left: 1,
        width: 40,
        height: 10,
        tags: true,
        border: {
            type: 'line',
        },
        style: {
            fg: 'white',
            bg: 'default',
            border: {
                fg: 'blue',
            },
            selected: {
                bg: 'blue',
                fg: 'white',
                bold: true,
            },
        },
        keys: true,
        vi: true,
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
    // State
    let showPalette = false;
    let paletteFilter = '';
    // Update palette content
    function updatePalette(filter) {
        const query = filter.replace(/^\//, '').toLowerCase();
        const filtered = COMMANDS.filter(c => c.name.startsWith(query));
        palette.setItems(filtered.map(c => `{bold}/${c.name}{/bold}  {gray-fg}${c.description}{/gray-fg}`));
        palette.select(0);
    }
    // Show/hide palette
    function togglePalette(show, filter = '/') {
        showPalette = show;
        paletteFilter = filter;
        if (show) {
            updatePalette(filter);
            palette.show();
            palette.focus();
        }
        else {
            palette.hide();
            input.focus();
        }
        screen.render();
    }
    // Process input
    async function processInput(value) {
        if (!value.trim())
            return;
        placeholder.hide();
        output.log(`{gray-fg}> ${value}{/gray-fg}`);
        if (value === '/exit' || value === 'exit' || value === 'quit') {
            onExit?.();
            return process.exit(0);
        }
        // Capture console.log
        const originalLog = console.log;
        console.log = (...args) => {
            output.log(args.map(a => String(a)).join(' '));
        };
        try {
            await (0, orchestrator_1.orchestrate)(value);
        }
        catch (e) {
            output.log(`{red-fg}Error: ${e}{/red-fg}`);
        }
        console.log = originalLog;
        updateStatusBar();
        screen.render();
    }
    // Input events
    input.on('focus', () => {
        placeholder.hide();
        screen.render();
    });
    input.on('blur', () => {
        if (!input.getValue()) {
            placeholder.show();
        }
        screen.render();
    });
    input.on('submit', async (value) => {
        input.clearValue();
        await processInput(value);
        input.focus();
    });
    // CRITICAL: Intercept "/" at INPUT level - fires BEFORE text is added
    input.on('keypress', (ch) => {
        // If palette is already open, ignore
        if (showPalette) {
            return;
        }
        // "/" ALWAYS opens command palette (when input is empty or first char)
        if (ch === '/' && (!input.getValue() || input.getValue() === '')) {
            // Clear any "/" that might have been typed
            input.clearValue();
            togglePalette(true, '/');
        }
    });
    // Palette events
    palette.on('select', (item) => {
        const text = item.getContent().replace(/{[^}]+}/g, '').trim();
        const cmd = text.split(' ')[0];
        input.setValue(cmd + ' ');
        togglePalette(false);
        input.focus();
        screen.render();
    });
    palette.key('escape', () => {
        togglePalette(false);
    });
    palette.key(['up', 'down'], () => {
        // Navigation handled by list widget
    });
    palette.key('enter', () => {
        // Selection handled by 'select' event
    });
    // Global key bindings
    screen.key(['escape'], () => {
        if (showPalette) {
            togglePalette(false);
        }
    });
    screen.key(['C-c'], () => {
        onExit?.();
        return process.exit(0);
    });
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
    screen.render();
}
//# sourceMappingURL=tui.js.map