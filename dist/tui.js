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
const workspace_model_1 = require("./workspace_model");
const agents_1 = require("./agents");
// Command definitions with categories and shortcuts
const COMMANDS = [
    // Quick actions (most used)
    { name: 'do', description: 'Quick: plan + generate', category: 'quick', shortcut: 'Ctrl+D' },
    { name: 'run', description: 'Auto: plan + generate + apply', category: 'quick', shortcut: 'Ctrl+R' },
    { name: 'ask', description: 'Quick question', category: 'quick', shortcut: 'Ctrl+A' },
    { name: 'fix', description: 'Debug mode task', category: 'quick', shortcut: 'Ctrl+F' },
    // Workflow
    { name: 'plan', description: 'Generate execution plan', category: 'workflow', shortcut: 'Ctrl+P' },
    { name: 'generate', description: 'Create file changes', category: 'workflow', shortcut: 'Ctrl+G' },
    { name: 'diff', description: 'Review pending changes', category: 'workflow' },
    { name: 'apply', description: 'Apply changes', category: 'workflow' },
    { name: 'undo', description: 'Rollback last operation', category: 'workflow', shortcut: 'Ctrl+Z' },
    { name: 'retry', description: 'Retry last failed operation', category: 'workflow' },
    { name: 'clear', description: 'Clear current task', category: 'workflow' },
    // Files
    { name: 'open', description: 'Add file to context', category: 'files' },
    { name: 'close', description: 'Remove file from context', category: 'files' },
    { name: 'files', description: 'List open files', category: 'files' },
    { name: 'search', description: 'Search files', category: 'files' },
    { name: 'read', description: 'View file contents', category: 'files' },
    { name: 'tree', description: 'Show file tree', category: 'files' },
    // Modes
    { name: 'mode', description: 'Set mode (edit/ask/auto/debug)', category: 'modes' },
    { name: 'model', description: 'Select AI model', category: 'modes' },
    { name: 'dry-run', description: 'Toggle dry-run mode', category: 'modes' },
    // Git
    { name: 'git', description: 'Git operations', category: 'git' },
    { name: 'commit', description: 'AI-powered commit', category: 'git' },
    // System
    { name: 'help', description: 'Show all commands', category: 'system' },
    { name: 'settings', description: 'Open settings menu', category: 'system' },
    { name: 'status', description: 'Show session status', category: 'system' },
    { name: 'doctor', description: 'System health check', category: 'system' },
    { name: 'version', description: 'Show version', category: 'system' },
    { name: 'reset', description: 'Reset session', category: 'system' },
    { name: 'exit', description: 'Exit zcode', category: 'system', shortcut: 'Ctrl+C' },
];
// Smart suggestions based on context
function getSmartSuggestions() {
    const session = (0, session_1.getSession)();
    const suggestions = [];
    // Based on current state
    if (session.pendingActions || session.lastDiff) {
        suggestions.push('/diff - Review changes');
        suggestions.push('/apply - Apply changes');
    }
    else if (session.lastPlan && session.lastPlan.length > 0) {
        suggestions.push('/generate - Create changes');
    }
    else if (session.currentIntent) {
        suggestions.push('/plan - Create plan');
    }
    // Based on mode
    if (session.mode === 'edit' && !session.currentIntent) {
        suggestions.push('Type a task to get started');
    }
    // Git suggestions
    const gitInfo = (0, git_1.getGitInfo)(session.workingDirectory);
    if (gitInfo.isRepo && gitInfo.isDirty) {
        suggestions.push('/commit - Commit changes');
    }
    return suggestions.slice(0, 3);
}
// Spinner frames for loading animation
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROGRESS_CHARS = ['▱', '▰'];
// Get contextual placeholder based on mode
function getPlaceholder() {
    const session = (0, session_1.getSession)();
    const mode = session.mode;
    switch (mode) {
        case 'auto':
            return 'Type a task to execute automatically...';
        case 'ask':
            return 'Ask a question about your code...';
        case 'debug':
            return 'Describe the bug or error...';
        case 'review':
            return 'What would you like reviewed?';
        case 'explain':
            return 'What would you like explained?';
        default:
            if (session.pendingActions)
                return '/apply to execute, /diff to review';
            if (session.lastPlan?.length)
                return '/generate to create changes';
            if (session.currentIntent)
                return '/plan to create execution plan';
            return 'Describe what you want to build...';
    }
}
// Recent commands history
const commandHistory = [];
let historyIndex = -1;
// Animated Robot Mascot Frames
const MASCOT_FRAMES = [
    // Frame 1 - looking right
    `{cyan-fg}   ╭───╮   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{bold}{white-fg}◉ ◉{/white-fg}{/bold}{cyan-fg}│   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{yellow-fg} ▽ {/yellow-fg}{cyan-fg}│   {/cyan-fg}
{cyan-fg}  ╭┴───┴╮  {/cyan-fg}
{cyan-fg}  │ {/cyan-fg}{blue-fg}ZAI{/blue-fg}{cyan-fg} │  {/cyan-fg}
{cyan-fg}  ╰┬───┬╯  {/cyan-fg}`,
    // Frame 2 - looking left
    `{cyan-fg}   ╭───╮   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{bold}{white-fg}◉ ◉{/white-fg}{/bold}{cyan-fg}│   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{yellow-fg} ◡ {/yellow-fg}{cyan-fg}│   {/cyan-fg}
{cyan-fg}  ╭┴───┴╮  {/cyan-fg}
{cyan-fg}  │ {/cyan-fg}{blue-fg}ZAI{/blue-fg}{cyan-fg} │  {/cyan-fg}
{cyan-fg}  ╰┬───┬╯  {/cyan-fg}`,
    // Frame 3 - blinking
    `{cyan-fg}   ╭───╮   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{bold}{white-fg}─ ─{/white-fg}{/bold}{cyan-fg}│   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{yellow-fg} ◡ {/yellow-fg}{cyan-fg}│   {/cyan-fg}
{cyan-fg}  ╭┴───┴╮  {/cyan-fg}
{cyan-fg}  │ {/cyan-fg}{blue-fg}ZAI{/blue-fg}{cyan-fg} │  {/cyan-fg}
{cyan-fg}  ╰┬───┬╯  {/cyan-fg}`,
    // Frame 4 - happy
    `{cyan-fg}   ╭───╮   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{bold}{white-fg}◠ ◠{/white-fg}{/bold}{cyan-fg}│   {/cyan-fg}
{cyan-fg}   │{/cyan-fg}{yellow-fg} ◡ {/yellow-fg}{cyan-fg}│   {/cyan-fg}
{cyan-fg}  ╭┴───┴╮  {/cyan-fg}
{cyan-fg}  │ {/cyan-fg}{blue-fg}ZAI{/blue-fg}{cyan-fg} │  {/cyan-fg}
{cyan-fg}  ╰┬───┬╯  {/cyan-fg}`,
];
// Compact header with mascot
const HEADER_WITH_MASCOT = `{bold}{cyan-fg}zai{/cyan-fg}{blue-fg}·{/blue-fg}{cyan-fg}code{/cyan-fg}{/bold} {gray-fg}v1.4.0{/gray-fg}`;
const MINIMAL_LOGO = '{bold}{cyan-fg}⚡ zai·code{/cyan-fg}{/bold} {gray-fg}AI-native editor{/gray-fg}';
// Welcome tips - rotate through these
const WELCOME_TIPS = [
    'Type a task naturally, like "add error handling to auth.ts"',
    'Use /do <task> for quick plan+generate in one step',
    'Use /run <task> for full auto execution (YOLO mode)',
    'Use /ask for quick questions without changing mode',
    'Try /fix <problem> to quickly debug issues',
    '/commit generates AI-powered commit messages',
    'Use /mode auto for autonomous execution',
    'Use ↑↓ to navigate commands, Tab to complete',
];
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
        warnings: false,
    });
    // Theme colors - modern dark theme
    const theme = {
        bg: 'black',
        fg: 'white',
        border: 'blue',
        highlight: 'cyan',
        accent: 'magenta',
        success: 'green',
        warning: 'yellow',
        error: 'red',
        gray: 'gray'
    };
    // State for spinner and processing
    let spinnerInterval = null;
    let spinnerFrame = 0;
    let isProcessing = false;
    let currentTip = Math.floor(Math.random() * WELCOME_TIPS.length);
    let mascotFrame = 0;
    let mascotInterval = null;
    // Header with animated mascot
    const header = blessed.box({
        top: 0,
        left: 0,
        width: '100%',
        height: (0, settings_1.shouldShowLogo)() ? 8 : 2,
        tags: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
    });
    // Update header with mascot animation
    function updateHeader() {
        if ((0, settings_1.shouldShowLogo)()) {
            const mascot = MASCOT_FRAMES[mascotFrame];
            const title = `{bold}{cyan-fg}zai{/cyan-fg}{blue-fg}·{/blue-fg}{cyan-fg}code{/cyan-fg}{/bold} {gray-fg}v1.4.0{/gray-fg}`;
            const subtitle = '{gray-fg}AI-native code editor{/gray-fg}';
            // Combine mascot with title
            const mascotLines = mascot.split('\n');
            const content = mascotLines.map((line, i) => {
                if (i === 1)
                    return line + '  ' + title;
                if (i === 2)
                    return line + '  ' + subtitle;
                return line;
            }).join('\n');
            header.setContent(content);
        }
        else {
            header.setContent(MINIMAL_LOGO);
        }
    }
    // Start mascot animation
    function startMascotAnimation() {
        if (mascotInterval)
            return;
        mascotInterval = setInterval(() => {
            mascotFrame = (mascotFrame + 1) % MASCOT_FRAMES.length;
            updateHeader();
            screen.render();
        }, 2000); // Change every 2 seconds
    }
    // Stop mascot animation
    function stopMascotAnimation() {
        if (mascotInterval) {
            clearInterval(mascotInterval);
            mascotInterval = null;
        }
    }
    // Initialize header
    updateHeader();
    if ((0, settings_1.shouldShowLogo)()) {
        startMascotAnimation();
    }
    // Quick actions bar - keyboard shortcuts
    const quickActions = blessed.box({
        top: (0, settings_1.shouldShowLogo)() ? 8 : 2,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        content: '{gray-fg}↑↓{/gray-fg} navigate  {gray-fg}Tab{/gray-fg} complete  {gray-fg}Enter{/gray-fg} select  {gray-fg}Esc{/gray-fg} close',
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1 },
    });
    // Context/status line
    const contextTop = (0, settings_1.shouldShowLogo)() ? 9 : 3;
    const contextLine = blessed.box({
        top: contextTop,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1 },
    });
    // Update context line with current state
    function updateContextLine() {
        const gitInfo = (0, git_1.getGitInfo)(session.workingDirectory);
        const model = (0, settings_1.getModel)();
        const mode = session.mode;
        const intent = (0, session_1.getIntent)();
        const fileCount = session.openFiles.length;
        let parts = [];
        parts.push(`{bold}${projectName}{/bold}`);
        if (gitInfo.isRepo) {
            const dirty = gitInfo.isDirty ? '{yellow-fg}*{/yellow-fg}' : '';
            parts.push(`{gray-fg}git:{/gray-fg}${gitInfo.branch}${dirty}`);
        }
        const modeColors = {
            'auto': 'magenta', 'edit': 'cyan', 'ask': 'green',
            'debug': 'red', 'review': 'yellow', 'explain': 'blue'
        };
        const modeColor = modeColors[mode] || 'cyan';
        parts.push(`{${modeColor}-fg}${mode}{/${modeColor}-fg}`);
        parts.push(`{gray-fg}${model}{/gray-fg}`);
        if (fileCount > 0)
            parts.push(`{gray-fg}${fileCount} file(s){/gray-fg}`);
        if (intent) {
            const truncated = intent.length > 30 ? intent.substring(0, 30) + '...' : intent;
            parts.push(`{yellow-fg}→ ${truncated}{/yellow-fg}`);
        }
        contextLine.setContent(parts.join('  {gray-fg}│{/gray-fg}  '));
    }
    // Tips section - smart suggestions
    const tipsTop = contextTop + 1;
    const tips = blessed.box({
        top: tipsTop,
        left: 0,
        width: '100%',
        height: 2,
        tags: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1 },
    });
    function updateTips() {
        const smartSuggestions = getSmartSuggestions();
        if (smartSuggestions.length > 0) {
            tips.setContent(`{gray-fg}💡 ${smartSuggestions.join('  │  ')}{/gray-fg}`);
        }
        else {
            tips.setContent(`{gray-fg}💡 ${WELCOME_TIPS[currentTip]}{/gray-fg}`);
        }
    }
    // Warning box (if in home directory)
    const warningTop = tipsTop + 2;
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
        warning.setContent('{yellow-fg}⚠{/yellow-fg} Running in home directory. Consider using a project directory.');
        warning.show();
    }
    else if (!gitInfo.isRepo) {
        warning.setContent('{yellow-fg}⚠{/yellow-fg} Not a git repository. Changes cannot be tracked.');
        warning.show();
    }
    // Main output area
    const outputTop = warning.hidden ? warningTop : warningTop + 3;
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
    // Processing spinner indicator
    const processingIndicator = blessed.box({
        bottom: 5,
        right: 2,
        width: 25,
        height: 1,
        tags: true,
        style: {
            fg: theme.highlight,
            bg: theme.bg,
        },
        hidden: true,
    });
    function startSpinner(message = 'Processing') {
        isProcessing = true;
        processingIndicator.show();
        spinnerInterval = setInterval(() => {
            spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
            processingIndicator.setContent(`{cyan-fg}${SPINNER_FRAMES[spinnerFrame]} ${message}...{/cyan-fg}`);
            screen.render();
        }, 80);
    }
    function stopSpinner() {
        isProcessing = false;
        if (spinnerInterval) {
            clearInterval(spinnerInterval);
            spinnerInterval = null;
        }
        processingIndicator.hide();
        screen.render();
    }
    // Input box container with mode indicator
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
    // Mode indicator icon
    const modeIndicator = blessed.text({
        parent: inputContainer,
        left: 1,
        top: 0,
        tags: true,
        style: {
            bg: theme.bg
        }
    });
    function updateModeIndicator() {
        const mode = session.mode;
        const modeColors = {
            'auto': 'magenta', 'edit': 'cyan', 'ask': 'green',
            'debug': 'red', 'review': 'yellow', 'explain': 'blue'
        };
        const color = modeColors[mode] || 'cyan';
        const icons = {
            'auto': '⚡', 'edit': '❯', 'ask': '?', 'debug': '🔧', 'review': '👁', 'explain': '📖'
        };
        const icon = icons[mode] || '❯';
        modeIndicator.setContent(`{bold}{${color}-fg}${icon}{/${color}-fg}{/bold}`);
    }
    // Input textbox
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
    // Placeholder text
    const placeholder = blessed.text({
        parent: inputContainer,
        left: 4,
        top: 0,
        tags: true,
        style: {
            fg: theme.gray,
            bg: theme.bg,
        },
    });
    function updatePlaceholder() {
        const val = input.getValue();
        if (!val || val.length === 0) {
            placeholder.setContent(`{gray-fg}${getPlaceholder()}{/gray-fg}`);
            placeholder.show();
        }
        else {
            placeholder.hide();
        }
    }
    // Status bar at bottom - more informative
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
    // Update status bar with state
    function updateStatusBar() {
        const model = (0, settings_1.getModel)();
        const mode = (0, session_1.getSession)().mode;
        const gitStatus = gitInfo.isRepo ? `${gitInfo.branch}${gitInfo.isDirty ? '*' : ''}` : 'no-git';
        const dryRun = session.dryRun ? ' {yellow-fg}[DRY]{/yellow-fg}' : '';
        // State indicator
        let state = '{green-fg}ready{/green-fg}';
        if (session.pendingActions || session.lastDiff) {
            state = '{yellow-fg}pending{/yellow-fg}';
        }
        else if (session.lastPlan && session.lastPlan.length > 0) {
            state = '{cyan-fg}planned{/cyan-fg}';
        }
        else if (session.currentIntent) {
            state = '{blue-fg}intent{/blue-fg}';
        }
        const left = `{bold}[${mode}]{/bold} ${state}${dryRun}`;
        const center = `${gitStatus}`;
        const right = `{cyan-fg}${model}{/cyan-fg} {gray-fg}/help{/gray-fg}`;
        const width = screen.width || 80;
        const padding = Math.max(0, Math.floor((width - 50) / 2));
        statusBar.setContent(`${left}${' '.repeat(padding)}${center}${' '.repeat(padding)}${right}`);
    }
    // Command palette - enhanced
    const palette = blessed.list({
        bottom: 5,
        left: 1,
        width: 55,
        height: 12,
        tags: true,
        keys: false,
        mouse: false,
        interactive: false,
        border: {
            type: 'line',
        },
        label: ' Commands ',
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
    // File autocomplete
    const fileAutocomplete = blessed.list({
        bottom: 5,
        left: 1,
        width: 60,
        height: 10,
        tags: true,
        keys: false,
        mouse: false,
        interactive: false,
        border: {
            type: 'line',
        },
        label: ' Files ',
        style: {
            fg: theme.fg,
            bg: theme.bg,
            border: {
                fg: theme.success,
                bg: theme.bg
            },
            selected: {
                bg: theme.success,
                fg: theme.bg,
                bold: true,
            },
        },
        hidden: true,
    });
    // Add all elements to screen
    screen.append(header);
    screen.append(quickActions);
    screen.append(contextLine);
    screen.append(tips);
    screen.append(warning);
    screen.append(output);
    screen.append(processingIndicator);
    screen.append(inputContainer);
    screen.append(statusBar);
    screen.append(palette);
    screen.append(fileAutocomplete);
    // Initial render
    updateContextLine();
    updateTips();
    updateStatusBar();
    updateModeIndicator();
    updatePlaceholder();
    input.focus();
    screen.render();
    // Welcome messages
    if (restored) {
        output.log('{green-fg}✓{/green-fg} Session restored');
        if (session.currentIntent) {
            output.log(`{gray-fg}  Task: ${session.currentIntent.substring(0, 60)}...{/gray-fg}`);
        }
    }
    else {
        output.log('{cyan-fg}Welcome to zai·code!{/cyan-fg} {gray-fg}Type a task or /help{/gray-fg}');
    }
    // agents.md notice
    if ((0, agents_1.hasAgentsConfig)(session.workingDirectory)) {
        output.log('{green-fg}✓{/green-fg} agents.md detected');
    }
    output.log('');
    // --- LOGIC ---
    let showPalette = false;
    let showFileAutocomplete = false;
    let autocompleteFiles = [];
    function updatePalette(filter) {
        const query = filter.replace(/^\//, '').toLowerCase();
        const filtered = COMMANDS.filter(c => c.name.startsWith(query) || c.description.toLowerCase().includes(query));
        const items = filtered.slice(0, 10).map(c => {
            const shortcut = c.shortcut ? ` {gray-fg}${c.shortcut}{/gray-fg}` : '';
            return `{bold}{cyan-fg}/${c.name}{/cyan-fg}{/bold}  ${c.description}${shortcut}`;
        });
        palette.setItems(items);
        if (filtered.length > 0) {
            palette.select(0);
        }
    }
    function updateFileAutocomplete(query) {
        const ws = (0, workspace_model_1.getWorkspace)(session.workingDirectory);
        ws.indexFileTree();
        const files = ws.getFileIndex();
        const pattern = query.toLowerCase();
        autocompleteFiles = files
            .filter(f => f.path.toLowerCase().includes(pattern))
            .slice(0, 10)
            .map(f => f.path);
        fileAutocomplete.setItems(autocompleteFiles.map(f => `{green-fg}📄{/green-fg} ${f}`));
        if (autocompleteFiles.length > 0) {
            fileAutocomplete.select(0);
        }
    }
    function togglePalette(show, filter = '/') {
        showPalette = show;
        if (show) {
            updatePalette(filter);
            palette.show();
            screen.render();
        }
        else {
            palette.hide();
            screen.render();
        }
    }
    function toggleFileAutocomplete(show, query = '') {
        showFileAutocomplete = show;
        if (show && query) {
            updateFileAutocomplete(query);
            fileAutocomplete.show();
            screen.render();
        }
        else {
            fileAutocomplete.hide();
            screen.render();
        }
    }
    // Process input
    async function processInput(value) {
        if (!value.trim())
            return;
        // Add to command history
        commandHistory.unshift(value);
        if (commandHistory.length > 50)
            commandHistory.pop();
        historyIndex = -1;
        // Format input display
        const isCommand = value.startsWith('/');
        const inputDisplay = isCommand
            ? `{cyan-fg}❯{/cyan-fg} {bold}${value}{/bold}`
            : `{cyan-fg}❯{/cyan-fg} ${value}`;
        output.log(inputDisplay);
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
            // Determine spinner message based on input
            let spinnerMsg = 'Processing';
            if (trimmed.startsWith('/plan') || trimmed === '/p')
                spinnerMsg = 'Planning';
            else if (trimmed.startsWith('/generate') || trimmed === '/g')
                spinnerMsg = 'Generating';
            else if (trimmed.startsWith('/apply') || trimmed === '/a')
                spinnerMsg = 'Applying';
            else if (trimmed.startsWith('/do '))
                spinnerMsg = 'Executing';
            else if (trimmed.startsWith('/run '))
                spinnerMsg = 'Running';
            else if (trimmed.startsWith('/ask') || trimmed.startsWith('/commit'))
                spinnerMsg = 'Thinking';
            else if (!trimmed.startsWith('/'))
                spinnerMsg = 'Thinking';
            startSpinner(spinnerMsg);
            await (0, orchestrator_1.orchestrate)(value);
            stopSpinner();
        }
        catch (e) {
            stopSpinner();
            output.log(`{red-fg}✗ Error: ${e?.message || e}{/red-fg}`);
        }
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        // Update all UI elements
        updateContextLine();
        updateTips();
        updateStatusBar();
        updateModeIndicator();
        updatePlaceholder();
        // Rotate tip
        currentTip = (currentTip + 1) % WELCOME_TIPS.length;
        output.log('');
        screen.render();
    }
    // Input events
    input.on('focus', () => {
        updatePlaceholder();
        screen.render();
    });
    input.on('blur', () => {
        screen.render();
    });
    // Track palette selection index manually
    let paletteSelectedIndex = 0;
    let fileSelectedIndex = 0;
    // Screen-level key handling for arrow keys (works better than input keypress)
    screen.key(['up'], () => {
        if (showPalette) {
            paletteSelectedIndex = Math.max(0, paletteSelectedIndex - 1);
            palette.select(paletteSelectedIndex);
            screen.render();
            return;
        }
        if (showFileAutocomplete) {
            fileSelectedIndex = Math.max(0, fileSelectedIndex - 1);
            fileAutocomplete.select(fileSelectedIndex);
            screen.render();
            return;
        }
        // Command history navigation
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
            historyIndex++;
            input.setValue(commandHistory[historyIndex]);
            updatePlaceholder();
            screen.render();
        }
    });
    screen.key(['down'], () => {
        if (showPalette) {
            const maxIndex = Math.min(COMMANDS.length - 1, 9);
            paletteSelectedIndex = Math.min(maxIndex, paletteSelectedIndex + 1);
            palette.select(paletteSelectedIndex);
            screen.render();
            return;
        }
        if (showFileAutocomplete) {
            const maxIndex = Math.min(autocompleteFiles.length - 1, 9);
            fileSelectedIndex = Math.min(maxIndex, fileSelectedIndex + 1);
            fileAutocomplete.select(fileSelectedIndex);
            screen.render();
            return;
        }
        // Command history navigation (go back to newer)
        if (historyIndex > 0) {
            historyIndex--;
            input.setValue(commandHistory[historyIndex]);
            updatePlaceholder();
            screen.render();
        }
        else if (historyIndex === 0) {
            historyIndex = -1;
            input.setValue('');
            updatePlaceholder();
            screen.render();
        }
    });
    // Tab completion
    screen.key(['tab'], () => {
        if (showPalette) {
            const filter = (input.getValue() || '').replace(/^\//, '').toLowerCase();
            const filtered = COMMANDS.filter(c => c.name.startsWith(filter) || c.description.toLowerCase().includes(filter));
            if (filtered[paletteSelectedIndex]) {
                const cmd = filtered[paletteSelectedIndex];
                input.setValue('/' + cmd.name + ' ');
                togglePalette(false);
                paletteSelectedIndex = 0;
                updatePlaceholder();
                input.focus();
                screen.render();
            }
            return;
        }
        if (showFileAutocomplete && autocompleteFiles.length > 0) {
            const selectedFile = autocompleteFiles[fileSelectedIndex];
            if (selectedFile) {
                const currentVal = input.getValue() || '';
                const parts = currentVal.split(' ');
                parts[parts.length - 1] = selectedFile;
                input.setValue(parts.join(' '));
                toggleFileAutocomplete(false);
                fileSelectedIndex = 0;
                updatePlaceholder();
                input.focus();
                screen.render();
            }
        }
    });
    // Manual keypress handling for other keys
    input.on('keypress', (ch, key) => {
        if (!key) {
            updatePlaceholder();
            screen.render();
            return;
        }
        if (key.name === 'escape') {
            if (showPalette) {
                togglePalette(false);
                paletteSelectedIndex = 0;
            }
            if (showFileAutocomplete) {
                toggleFileAutocomplete(false);
                fileSelectedIndex = 0;
            }
            screen.render();
            return;
        }
        // Check input content on next tick to see if we should show palette
        setImmediate(() => {
            const val = input.getValue();
            updatePlaceholder();
            if (val && val.startsWith('/')) {
                toggleFileAutocomplete(false);
                fileSelectedIndex = 0;
                // Reset palette selection when filter changes
                paletteSelectedIndex = 0;
                togglePalette(true, val);
                // Check for file commands that need autocomplete
                const fileCommands = ['/open ', '/read ', '/cat ', '/close '];
                for (const cmd of fileCommands) {
                    if (val.startsWith(cmd)) {
                        const query = val.substring(cmd.length);
                        if (query.length > 0) {
                            togglePalette(false);
                            paletteSelectedIndex = 0;
                            toggleFileAutocomplete(true, query);
                        }
                        break;
                    }
                }
            }
            else {
                if (showPalette) {
                    togglePalette(false);
                    paletteSelectedIndex = 0;
                }
                if (showFileAutocomplete) {
                    toggleFileAutocomplete(false);
                    fileSelectedIndex = 0;
                }
            }
            screen.render();
        });
    });
    // Submit handler
    input.on('submit', async (value) => {
        const inputValue = value || input.getValue() || '';
        if (showPalette && inputValue.startsWith('/')) {
            const filter = inputValue.replace(/^\//, '').toLowerCase();
            const filteredCommands = COMMANDS.filter(c => c.name.startsWith(filter) || c.description.toLowerCase().includes(filter));
            if (filteredCommands[paletteSelectedIndex]) {
                const cmd = filteredCommands[paletteSelectedIndex];
                const needsArgs = ['mode', 'model', 'open', 'read', 'cat', 'close', 'do', 'run', 'ask', 'fix', 'exec', 'search'].includes(cmd.name);
                if (needsArgs && !inputValue.includes(' ')) {
                    input.setValue('/' + cmd.name + ' ');
                    togglePalette(false);
                    paletteSelectedIndex = 0;
                    input.focus();
                    updatePlaceholder();
                    screen.render();
                    return;
                }
            }
        }
        // Handle file autocomplete selection
        if (showFileAutocomplete && autocompleteFiles.length > 0) {
            const selectedFile = autocompleteFiles[fileSelectedIndex];
            if (selectedFile) {
                const currentVal = inputValue;
                const parts = currentVal.split(' ');
                parts[parts.length - 1] = selectedFile;
                const newValue = parts.join(' ');
                input.clearValue();
                toggleFileAutocomplete(false);
                togglePalette(false);
                fileSelectedIndex = 0;
                paletteSelectedIndex = 0;
                updatePlaceholder();
                screen.render();
                if (newValue && newValue.trim()) {
                    await processInput(newValue);
                }
                input.focus();
                updatePlaceholder();
                screen.render();
                return;
            }
        }
        // Clear input and palette before processing
        input.clearValue();
        togglePalette(false);
        toggleFileAutocomplete(false);
        paletteSelectedIndex = 0;
        fileSelectedIndex = 0;
        updatePlaceholder();
        screen.render();
        // Process the input
        if (inputValue && inputValue.trim()) {
            await processInput(inputValue);
        }
        // Refocus input for next command
        input.focus();
        updatePlaceholder();
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
        stopMascotAnimation();
        onExit?.();
        return process.exit(0);
    });
    // Quick action shortcuts
    screen.key(['C-d'], async () => {
        // Quick /do - need to prompt for task
        input.setValue('/do ');
        input.focus();
        updatePlaceholder();
        screen.render();
    });
    screen.key(['C-r'], async () => {
        // Quick /run
        input.setValue('/run ');
        input.focus();
        updatePlaceholder();
        screen.render();
    });
    screen.key(['C-p'], async () => {
        // Quick /plan
        if (screen.focused === input && !input.getValue()) {
            input.clearValue();
            togglePalette(false);
            updatePlaceholder();
            screen.render();
            await processInput('/plan');
            input.focus();
            updatePlaceholder();
            screen.render();
        }
    });
    screen.key(['C-g'], async () => {
        // Quick /generate
        if (screen.focused === input && !input.getValue()) {
            input.clearValue();
            togglePalette(false);
            updatePlaceholder();
            screen.render();
            await processInput('/generate');
            input.focus();
            updatePlaceholder();
            screen.render();
        }
    });
    screen.key(['C-z'], async () => {
        // Quick /undo
        if (screen.focused === input && !input.getValue()) {
            input.clearValue();
            togglePalette(false);
            updatePlaceholder();
            screen.render();
            await processInput('/undo');
            input.focus();
            updatePlaceholder();
            screen.render();
        }
    });
    screen.key(['C-a'], async () => {
        // Quick /ask
        input.setValue('/ask ');
        input.focus();
        updatePlaceholder();
        screen.render();
    });
    screen.key(['C-f'], async () => {
        // Quick /fix
        input.setValue('/fix ');
        input.focus();
        updatePlaceholder();
        screen.render();
    });
    screen.key(['q'], () => {
        // Only quit if not focused on input
        if (screen.focused !== input) {
            stopMascotAnimation();
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
    // Cleanup on exit
    process.on('exit', () => {
        stopMascotAnimation();
    });
    screen.render();
}
//# sourceMappingURL=tui.js.map