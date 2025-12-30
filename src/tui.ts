import * as blessed from 'blessed';
import { getSession, getIntent } from './session';
import { orchestrate } from './orchestrator';
import { getAvailableCommands } from './commands';
import { getGitInfo } from './git';
import { getModel, ZAI_MODELS, shouldShowLogo, loadSettings, saveSettings, Settings, AVAILABLE_MODELS } from './settings';
import { getActiveProfileName } from './profiles';
import { getWorkspace } from './workspace_model';
import { hasAgentsConfig } from './agents';
import * as path from 'path';
import * as fs from 'fs';

export interface TUIOptions {
    projectName: string;
    restored?: boolean;
    onExit?: () => void;
}

// Command definitions - Claude Code style with categories and shortcuts
interface Command {
    name: string;
    description: string;
    category: 'quick' | 'workflow' | 'files' | 'modes' | 'git' | 'system';
    shortcut?: string;
    icon: string;
    alias?: string[];
}

const COMMANDS: Command[] = [
    // Quick actions (most used)
    { name: 'do', description: 'Plan + generate in one step', category: 'quick', shortcut: '^D', icon: '>', alias: ['quick'] },
    { name: 'run', description: 'Full auto: plan > generate > apply', category: 'quick', shortcut: '^R', icon: '>>', alias: ['yolo', 'auto'] },
    { name: 'ask', description: 'Quick question (no file changes)', category: 'quick', shortcut: '^A', icon: '?', alias: ['q', 'question'] },
    { name: 'fix', description: 'Debug and fix an issue', category: 'quick', shortcut: '^F', icon: '*', alias: ['debug', 'bug'] },
    
    // Workflow
    { name: 'plan', description: 'Generate execution plan', category: 'workflow', shortcut: '^P', icon: '#', alias: ['p'] },
    { name: 'generate', description: 'Create file changes from plan', category: 'workflow', shortcut: '^G', icon: '+', alias: ['g', 'gen'] },
    { name: 'diff', description: 'Review pending changes', category: 'workflow', icon: '~', alias: ['d', 'changes'] },
    { name: 'apply', description: 'Apply pending changes', category: 'workflow', icon: '!', alias: ['a', 'exec'] },
    { name: 'undo', description: 'Rollback last operation', category: 'workflow', shortcut: '^Z', icon: '<', alias: ['u', 'rollback'] },
    { name: 'retry', description: 'Retry last failed operation', category: 'workflow', icon: '@', alias: ['again'] },
    { name: 'clear', description: 'Clear current task', category: 'workflow', icon: 'x', alias: ['reset-task'] },
    
    // Files
    { name: 'open', description: 'Add file to context', category: 'files', icon: '+', alias: ['add', 'include'] },
    { name: 'close', description: 'Remove file from context', category: 'files', icon: '-', alias: ['remove', 'exclude'] },
    { name: 'files', description: 'List files in context', category: 'files', icon: '.', alias: ['f', 'context'] },
    { name: 'search', description: 'Search files in workspace', category: 'files', icon: '/', alias: ['find', 'grep'] },
    { name: 'read', description: 'View file contents', category: 'files', icon: '>', alias: ['cat', 'view'] },
    { name: 'tree', description: 'Show directory tree', category: 'files', icon: '|', alias: ['ls', 'dir'] },
    
    // Modes
    { name: 'mode', description: 'Switch mode (auto/edit/ask/debug)', category: 'modes', icon: '=', alias: ['m'] },
    { name: 'model', description: 'Select AI model', category: 'modes', icon: '%', alias: ['llm'] },
    { name: 'dry-run', description: 'Toggle dry-run (preview only)', category: 'modes', icon: '~', alias: ['preview', 'test'] },
    
    // Git
    { name: 'git', description: 'Git operations (status/log/diff)', category: 'git', icon: 'g', alias: ['g'] },
    { name: 'commit', description: 'AI-powered commit message', category: 'git', icon: 'c', alias: ['ci', 'save'] },
    
    // System
    { name: 'help', description: 'Show all commands', category: 'system', icon: '?', alias: ['h', '?'] },
    { name: 'settings', description: 'Open settings panel', category: 'system', shortcut: 'F2', icon: '*', alias: ['config', 'prefs'] },
    { name: 'status', description: 'Show session status', category: 'system', icon: 'i', alias: ['s', 'info'] },
    { name: 'doctor', description: 'System health check', category: 'system', icon: '+', alias: ['health'] },
    { name: 'version', description: 'Show version info', category: 'system', icon: 'v', alias: ['v'] },
    { name: 'reset', description: 'Reset entire session', category: 'system', icon: 'r', alias: ['restart'] },
    { name: 'exit', description: 'Exit zcode', category: 'system', shortcut: '^C', icon: 'q', alias: ['quit', 'q!'] },
];

// Category labels and colors
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
    quick: { label: '[Quick]', color: 'magenta' },
    workflow: { label: '[Workflow]', color: 'cyan' },
    files: { label: '[Files]', color: 'green' },
    modes: { label: '[Modes]', color: 'yellow' },
    git: { label: '[Git]', color: 'blue' },
    system: { label: '[System]', color: 'gray' },
};

// Smart suggestions based on context
function getSmartSuggestions(): string[] {
    const session = getSession();
    const suggestions: string[] = [];
    
    // Based on current state
    if (session.pendingActions || session.lastDiff) {
        suggestions.push('/diff - Review changes');
        suggestions.push('/apply - Apply changes');
    } else if (session.lastPlan && session.lastPlan.length > 0) {
        suggestions.push('/generate - Create changes');
    } else if (session.currentIntent) {
        suggestions.push('/plan - Create plan');
    }
    
    // Based on mode
    if (session.mode === 'edit' && !session.currentIntent) {
        suggestions.push('Type a task to get started');
    }
    
    // Git suggestions
    const gitInfo = getGitInfo(session.workingDirectory);
    if (gitInfo.isRepo && gitInfo.isDirty) {
        suggestions.push('/commit - Commit changes');
    }
    
    return suggestions.slice(0, 3);
}

// Spinner frames for loading animation
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROGRESS_CHARS = ['▱', '▰'];

// Get contextual placeholder based on mode
function getPlaceholder(): string {
    const session = getSession();
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
            if (session.pendingActions) return '/apply to execute, /diff to review';
            if (session.lastPlan?.length) return '/generate to create changes';
            if (session.currentIntent) return '/plan to create execution plan';
            return 'Describe what you want to build...';
    }
}

// Recent commands history
const commandHistory: string[] = [];
let historyIndex = -1;

// Big ASCII Logo
const ASCII_LOGO = `{bold}{cyan-fg}
 ███████╗ █████╗ ██╗     ██████╗ ██████╗ ██████╗ ███████╗
 ╚══███╔╝██╔══██╗██║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
   ███╔╝ ███████║██║    ██║     ██║   ██║██║  ██║█████╗  
  ███╔╝  ██╔══██║██║    ██║     ██║   ██║██║  ██║██╔══╝  
 ███████╗██║  ██║██║    ╚██████╗╚██████╔╝██████╔╝███████╗
 ╚══════╝╚═╝  ╚═╝╚═╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝{/cyan-fg}{/bold}
                    {gray-fg}AI-native code editor v1.6.0{/gray-fg}`;

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
const HEADER_WITH_MASCOT = `{bold}{cyan-fg}zai{/cyan-fg}{blue-fg}·{/blue-fg}{cyan-fg}code{/cyan-fg}{/bold} {gray-fg}v1.6.0{/gray-fg}`;

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

export async function startTUI(options: TUIOptions): Promise<void> {
    const { projectName, restored, onExit } = options;
    const session = getSession();

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
    let spinnerInterval: NodeJS.Timeout | null = null;
    let spinnerFrame = 0;
    let isProcessing = false;
    let currentTip = Math.floor(Math.random() * WELCOME_TIPS.length);

    // Header with ASCII logo
    const header = blessed.box({
        top: 0,
        left: 0,
        width: '100%',
        height: shouldShowLogo() ? 9 : 2,
        tags: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
    });

    // Update header with logo
    function updateHeader() {
        if (shouldShowLogo()) {
            header.setContent(ASCII_LOGO);
            header.height = 9;
        } else {
            header.setContent(MINIMAL_LOGO);
            header.height = 2;
        }
    }

    // Initialize header
    updateHeader();

    // Quick actions bar - keyboard shortcuts
    const quickActions = blessed.box({
        top: shouldShowLogo() ? 9 : 2,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        content: '{gray-fg}↑↓{/gray-fg} navigate  {gray-fg}Tab{/gray-fg} complete  {gray-fg}Enter{/gray-fg} select  {gray-fg}Esc{/gray-fg} close  {gray-fg}Shift+Tab{/gray-fg} mode',
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1 },
    });

    // Context/status line
    const contextTop = shouldShowLogo() ? 10 : 3;
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
        const gitInfo = getGitInfo(session.workingDirectory);
        const model = getModel();
        const mode = session.mode;
        const intent = getIntent();
        const fileCount = session.openFiles.length;
        
        let parts: string[] = [];
        parts.push(`{bold}${projectName}{/bold}`);
        
        if (gitInfo.isRepo) {
            const dirty = gitInfo.isDirty ? '{yellow-fg}*{/yellow-fg}' : '';
            parts.push(`{gray-fg}git:{/gray-fg}${gitInfo.branch}${dirty}`);
        }
        
        const modeColors: Record<string, string> = {
            'auto': 'magenta', 'edit': 'cyan', 'ask': 'green',
            'debug': 'red', 'review': 'yellow', 'explain': 'blue'
        };
        const modeColor = modeColors[mode] || 'cyan';
        parts.push(`{${modeColor}-fg}${mode}{/${modeColor}-fg}`);
        parts.push(`{gray-fg}${model}{/gray-fg}`);
        
        if (fileCount > 0) parts.push(`{gray-fg}${fileCount} file(s){/gray-fg}`);
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
            tips.setContent(`{gray-fg}> ${smartSuggestions.join('  |  ')}{/gray-fg}`);
        } else {
            tips.setContent(`{gray-fg}> ${WELCOME_TIPS[currentTip]}{/gray-fg}`);
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
    const gitInfo = getGitInfo(session.workingDirectory);
    if (session.workingDirectory === require('os').homedir()) {
        warning.setContent('{yellow-fg}⚠{/yellow-fg} Running in home directory. Consider using a project directory.');
        warning.show();
    } else if (!gitInfo.isRepo) {
        warning.setContent('{yellow-fg}⚠{/yellow-fg} Not a git repository. Changes cannot be tracked.');
        warning.show();
    }

    // Main output area - SCROLLABLE with mouse and keyboard
    const outputTop = warning.hidden ? warningTop : warningTop + 3;
    const output = blessed.log({
        top: outputTop,
        left: 0,
        width: '100%',
        height: `100%-${outputTop + 6}`,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
        vi: true,
        scrollbar: {
            ch: '█',
            track: {
                bg: theme.bg,
            },
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

    function startSpinner(message: string = 'Processing') {
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
        const modeColors: Record<string, string> = {
            'auto': 'magenta', 'edit': 'cyan', 'ask': 'green',
            'debug': 'red', 'review': 'yellow', 'explain': 'blue'
        };
        const color = modeColors[mode] || 'cyan';
        const icons: Record<string, string> = {
            'auto': '>', 'edit': '>', 'ask': '?', 'debug': '*', 'review': '#', 'explain': '~'
        };
        const icon = icons[mode] || '>';
        modeIndicator.setContent(`{bold}{${color}-fg}${icon}{/${color}-fg}{/bold}`);
    }

    // Placeholder text - positioned behind input, same location
    const placeholder = blessed.text({
        parent: inputContainer,
        left: 3,
        top: 0,
        width: '100%-5',
        tags: true,
        style: {
            fg: 'gray',
            bg: theme.bg,
        },
    });

    // Input textbox - keys: false to prevent double input
    const input = blessed.textbox({
        parent: inputContainer,
        left: 3,
        top: 0,
        width: '100%-5',
        height: 1,
        inputOnFocus: true,
        keys: false,
        mouse: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
            transparent: true,  // Allow placeholder to show through when empty
        },
    });

    function updatePlaceholder() {
        const val = input.getValue() || '';
        if (val.length === 0) {
            placeholder.setContent(getPlaceholder());
            placeholder.show();
        } else {
            placeholder.hide();
        }
        screen.render();
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
        const model = getModel();
        const mode = getSession().mode;
        const gitStatus = gitInfo.isRepo ? `${gitInfo.branch}${gitInfo.isDirty ? '*' : ''}` : 'no-git';
        const dryRun = session.dryRun ? ' {yellow-fg}[DRY]{/yellow-fg}' : '';

        // State indicator
        let state = '{green-fg}ready{/green-fg}';
        if (session.pendingActions || session.lastDiff) {
            state = '{yellow-fg}pending{/yellow-fg}';
        } else if (session.lastPlan && session.lastPlan.length > 0) {
            state = '{cyan-fg}planned{/cyan-fg}';
        } else if (session.currentIntent) {
            state = '{blue-fg}intent{/blue-fg}';
        }

        const left = `{bold}[${mode}]{/bold} ${state}${dryRun}`;
        const center = `${gitStatus}`;
        const right = `{cyan-fg}${model}{/cyan-fg} {gray-fg}/help{/gray-fg}`;

        const width = (screen.width as number) || 80;
        const padding = Math.max(0, Math.floor((width - 50) / 2));

        statusBar.setContent(`${left}${' '.repeat(padding)}${center}${' '.repeat(padding)}${right}`);
    }

    // Command palette - Claude Code style with categories
    const palette = blessed.box({
        bottom: 5,
        left: 1,
        width: 60,
        height: 16,
        tags: true,
        border: {
            type: 'line',
        },
        label: ' {bold}Commands{/bold} {gray-fg}(up/down, Tab, Esc){/gray-fg} ',
        style: {
            fg: theme.fg,
            bg: theme.bg,
            border: {
                fg: theme.highlight,
                bg: theme.bg
            },
        },
        hidden: true,
    });
    
    // Palette content area (scrollable)
    const paletteList = blessed.box({
        parent: palette,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: '|',
            style: { fg: 'cyan' },
        },
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
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
    } else {
        output.log('{cyan-fg}Welcome to zai·code!{/cyan-fg} {gray-fg}Type a task or /help{/gray-fg}');
    }

    // agents.md notice
    if (hasAgentsConfig(session.workingDirectory)) {
        output.log('{green-fg}✓{/green-fg} agents.md detected');
    }
    output.log('');

    // --- LOGIC ---

    let showPalette = false;
    let showFileAutocomplete = false;
    let autocompleteFiles: string[] = [];

    function updatePalette(filter: string) {
        const query = filter.replace(/^\//, '').toLowerCase();
        
        // Filter commands by name, description, or aliases
        filteredCommandsCache = COMMANDS.filter(c => {
            if (c.name.startsWith(query)) return true;
            if (c.description.toLowerCase().includes(query)) return true;
            if (c.alias?.some(a => a.startsWith(query))) return true;
            return false;
        }).slice(0, 20);
        
        // Build palette content with categories
        let content = '';
        let currentCategory = '';
        let itemIndex = 0;
        let selectedLineIndex = 0;
        let lineCount = 0;
        
        for (const cmd of filteredCommandsCache) {
            // Add category header if changed
            if (cmd.category !== currentCategory) {
                currentCategory = cmd.category;
                const catInfo = CATEGORY_INFO[cmd.category];
                if (content) content += '\n';
                content += `{${catInfo.color}-fg}${catInfo.label}{/${catInfo.color}-fg}\n`;
                lineCount += 2;
            }
            
            // Track which line the selected item is on
            if (itemIndex === paletteSelectedIndex) {
                selectedLineIndex = lineCount;
            }
            
            // Format command line
            const isSelected = itemIndex === paletteSelectedIndex;
            const shortcut = cmd.shortcut ? `{gray-fg}${cmd.shortcut}{/gray-fg}` : '';
            const cmdName = `/${cmd.name}`;
            
            if (isSelected) {
                content += `{blue-bg}{white-fg}{bold} ${cmd.icon} ${cmdName.padEnd(12)} ${cmd.description.padEnd(28)} ${shortcut}{/bold}{/white-fg}{/blue-bg}\n`;
            } else {
                content += `  {cyan-fg}${cmd.icon}{/cyan-fg} {bold}${cmdName}{/bold}${' '.repeat(Math.max(0, 12 - cmdName.length))} {gray-fg}${cmd.description}{/gray-fg} ${shortcut}\n`;
            }
            itemIndex++;
            lineCount++;
        }
        
        if (filteredCommandsCache.length === 0) {
            content = '{gray-fg}  No matching commands{/gray-fg}';
        }
        
        paletteList.setContent(content);
        
        // Scroll to keep selected item visible
        const visibleHeight = (palette.height as number) - 2; // account for border
        if (selectedLineIndex >= visibleHeight) {
            paletteList.setScroll(selectedLineIndex - visibleHeight + 3);
        } else {
            paletteList.setScroll(0);
        }
        
        if (filteredCommandsCache.length > 0 && paletteSelectedIndex >= filteredCommandsCache.length) {
            paletteSelectedIndex = 0;
        }
    }

    function updateFileAutocomplete(query: string) {
        const ws = getWorkspace(session.workingDirectory);
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

    function togglePalette(show: boolean, filter: string = '/') {
        showPalette = show;
        if (show) {
            paletteSelectedIndex = 0;  // Reset selection when opening
            updatePalette(filter);
            palette.show();
            screen.render();
        } else {
            palette.hide();
            screen.render();
        }
    }

    function toggleFileAutocomplete(show: boolean, query: string = '') {
        showFileAutocomplete = show;
        if (show && query) {
            updateFileAutocomplete(query);
            fileAutocomplete.show();
            screen.render();
        } else {
            fileAutocomplete.hide();
            screen.render();
        }
    }

    // Process input
    async function processInput(value: string) {
        if (!value.trim()) return;

        // Add to command history
        commandHistory.unshift(value);
        if (commandHistory.length > 50) commandHistory.pop();
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
        
        console.log = (...args: unknown[]) => {
            const msg = args.map(a => String(a)).join(' ');
            output.log(msg);
            screen.render();
        };
        console.error = (...args: unknown[]) => {
            const msg = args.map(a => String(a)).join(' ');
            output.log(`{red-fg}${msg}{/red-fg}`);
            screen.render();
        };
        console.warn = (...args: unknown[]) => {
            const msg = args.map(a => String(a)).join(' ');
            output.log(`{yellow-fg}${msg}{/yellow-fg}`);
            screen.render();
        };

        try {
            // Determine spinner message based on input
            let spinnerMsg = 'Processing';
            if (trimmed.startsWith('/plan') || trimmed === '/p') spinnerMsg = 'Planning';
            else if (trimmed.startsWith('/generate') || trimmed === '/g') spinnerMsg = 'Generating';
            else if (trimmed.startsWith('/apply') || trimmed === '/a') spinnerMsg = 'Applying';
            else if (trimmed.startsWith('/do ')) spinnerMsg = 'Executing';
            else if (trimmed.startsWith('/run ')) spinnerMsg = 'Running';
            else if (trimmed.startsWith('/ask') || trimmed.startsWith('/commit')) spinnerMsg = 'Thinking';
            else if (!trimmed.startsWith('/')) spinnerMsg = 'Thinking';
            
            startSpinner(spinnerMsg);
            await orchestrate(value);
            stopSpinner();
        } catch (e: any) {
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
    let filteredCommandsCache: typeof COMMANDS = [];

    // Screen-level key handling for arrow keys
    screen.key(['up'], () => {
        // Settings takes priority
        if (settingsOpen) {
            settingsSelectedIndex = Math.max(0, settingsSelectedIndex - 1);
            renderSettingsContent();
            return;
        }
        if (showPalette && filteredCommandsCache.length > 0) {
            paletteSelectedIndex = Math.max(0, paletteSelectedIndex - 1);
            updatePalette(input.getValue() || '/');
            screen.render();
            return;
        }
        if (showFileAutocomplete && autocompleteFiles.length > 0) {
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
        // Settings takes priority
        if (settingsOpen) {
            settingsSelectedIndex = Math.min(settingsItems.length - 1, settingsSelectedIndex + 1);
            renderSettingsContent();
            return;
        }
        if (showPalette && filteredCommandsCache.length > 0) {
            const maxIndex = filteredCommandsCache.length - 1;
            paletteSelectedIndex = Math.min(maxIndex, paletteSelectedIndex + 1);
            updatePalette(input.getValue() || '/');
            screen.render();
            return;
        }
        if (showFileAutocomplete && autocompleteFiles.length > 0) {
            const maxIndex = autocompleteFiles.length - 1;
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
        } else if (historyIndex === 0) {
            historyIndex = -1;
            input.setValue('');
            updatePlaceholder();
            screen.render();
        }
    });
    
    // Enter key for settings
    screen.key(['enter'], () => {
        if (settingsOpen) {
            cycleSettingValue();
            return;
        }
    });
    
    // Escape key for settings
    screen.key(['escape'], () => {
        if (settingsOpen) {
            closeSettingsModal();
            return;
        }
        // Also close palette/autocomplete
        if (showPalette) {
            togglePalette(false);
            paletteSelectedIndex = 0;
        }
        if (showFileAutocomplete) {
            toggleFileAutocomplete(false);
            fileSelectedIndex = 0;
        }
        screen.render();
    });

    // Tab completion
    screen.key(['tab'], () => {
        if (showPalette && filteredCommandsCache.length > 0) {
            if (filteredCommandsCache[paletteSelectedIndex]) {
                const cmd = filteredCommandsCache[paletteSelectedIndex];
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
            // Character typed - check on next tick
            setImmediate(() => {
                updatePlaceholder();
                screen.render();
            });
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
            const val = input.getValue() || '';
            updatePlaceholder();
            
            if (val.startsWith('/')) {
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
            } else {
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
    input.on('submit', async (value: string) => {
        const inputValue = value || input.getValue() || '';
        
        // Check for /settings FIRST before palette handling
        if (inputValue.trim() === '/settings') {
            input.clearValue();
            togglePalette(false);
            paletteSelectedIndex = 0;
            updatePlaceholder();
            screen.render();
            showSettingsMenu();
            return;
        }
        
        if (showPalette && inputValue.startsWith('/') && filteredCommandsCache.length > 0) {
            if (filteredCommandsCache[paletteSelectedIndex]) {
                const cmd = filteredCommandsCache[paletteSelectedIndex];
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

    // SETTINGS MODAL - Screen-level key interception, input stays active
    let settingsOpen = false;
    let settingsSelectedIndex = 0;
    let settingsModal: any = null;
    let settingsContent: any = null;
    let currentSettingsData: any = null;
    
    const settingsItems = [
        { key: 'model', label: 'AI Model' },
        { key: 'defaultMode', label: 'Default Mode' },
        { key: 'asciiLogo', label: 'ASCII Logo' },
        { key: 'color', label: 'Color Theme' },
        { key: 'promptStyle', label: 'Prompt Style' },
        { key: 'confirmMode', label: 'Confirm Mode' },
        { key: 'shellExec', label: 'Shell Exec' },
        { key: 'debugLog', label: 'Debug Logging' },
    ];
    
    function getSettingValue(key: string): string {
        if (!currentSettingsData) return '';
        switch (key) {
            case 'model': return currentSettingsData.model.current;
            case 'defaultMode': return currentSettingsData.execution.defaultMode || 'auto';
            case 'asciiLogo': return currentSettingsData.ui.asciiLogo;
            case 'color': return currentSettingsData.ui.color;
            case 'promptStyle': return currentSettingsData.ui.promptStyle;
            case 'confirmMode': return currentSettingsData.execution.confirmationMode;
            case 'shellExec': return currentSettingsData.execution.allowShellExec ? 'on' : 'off';
            case 'debugLog': return currentSettingsData.debug.logging ? 'on' : 'off';
            default: return '';
        }
    }
    
    function renderSettingsContent() {
        if (!settingsContent) return;
        
        let lines: string[] = [];
        for (let i = 0; i < settingsItems.length; i++) {
            const item = settingsItems[i];
            const value = getSettingValue(item.key);
            const isSelected = i === settingsSelectedIndex;
            
            const label = item.label.padEnd(16);
            const val = String(value).padEnd(12);
            
            if (isSelected) {
                lines.push(`{blue-bg}{white-fg}{bold} > ${label} ${val} {/bold}{/white-fg}{/blue-bg}`);
            } else {
                lines.push(`   {gray-fg}${label}{/gray-fg} {cyan-fg}${val}{/cyan-fg}`);
            }
        }
        
        settingsContent.setContent(lines.join('\n'));
        screen.render();
    }
    
    function cycleSettingValue() {
        if (!currentSettingsData) return;
        const item = settingsItems[settingsSelectedIndex];
        const models = AVAILABLE_MODELS;
        const modes: Array<'edit' | 'auto' | 'ask' | 'debug' | 'review' | 'explain'> = ['edit', 'auto', 'ask', 'debug', 'review', 'explain'];
        
        switch (item.key) {
            case 'model':
                const currModelIdx = models.indexOf(currentSettingsData.model.current);
                currentSettingsData.model.current = models[(currModelIdx + 1) % models.length];
                break;
            case 'defaultMode':
                const currMode = currentSettingsData.execution.defaultMode || 'auto';
                const currModeIdx = modes.indexOf(currMode as any);
                currentSettingsData.execution.defaultMode = modes[(currModeIdx + 1) % modes.length];
                break;
            case 'asciiLogo':
                currentSettingsData.ui.asciiLogo = currentSettingsData.ui.asciiLogo === 'on' ? 'off' : 'on';
                break;
            case 'color':
                const colors: Array<'auto' | 'on' | 'off'> = ['auto', 'on', 'off'];
                const currColorIdx = colors.indexOf(currentSettingsData.ui.color);
                currentSettingsData.ui.color = colors[(currColorIdx + 1) % colors.length];
                break;
            case 'promptStyle':
                currentSettingsData.ui.promptStyle = currentSettingsData.ui.promptStyle === 'compact' ? 'verbose' : 'compact';
                break;
            case 'confirmMode':
                currentSettingsData.execution.confirmationMode = currentSettingsData.execution.confirmationMode === 'strict' ? 'normal' : 'strict';
                break;
            case 'shellExec':
                currentSettingsData.execution.allowShellExec = !currentSettingsData.execution.allowShellExec;
                break;
            case 'debugLog':
                currentSettingsData.debug.logging = !currentSettingsData.debug.logging;
                break;
        }
        
        renderSettingsContent();
    }
    
    function closeSettingsModal() {
        if (!settingsOpen) return;
        settingsOpen = false;
        
        // Save settings
        if (currentSettingsData) {
            saveSettings(currentSettingsData);
        }
        
        // Update UI elements
        updateHeader();
        updateStatusBar();
        updateModeIndicator();
        
        // Remove modal
        if (settingsModal) {
            screen.remove(settingsModal);
            settingsModal = null;
            settingsContent = null;
        }
        
        screen.render();
        output.log('{green-fg}+ Settings saved{/green-fg}');
    }
    
    function showSettingsMenu() {
        if (settingsOpen) return;
        settingsOpen = true;
        settingsSelectedIndex = 0;
        currentSettingsData = loadSettings();
        
        // Create modal (doesn't steal focus)
        settingsModal = blessed.box({
            parent: screen,
            top: 'center',
            left: 'center',
            width: 50,
            height: 14,
            border: { type: 'line' },
            label: ' {bold}Settings{/bold} {gray-fg}(up/down, Enter, Esc){/gray-fg} ',
            tags: true,
            style: {
                bg: 'black',
                fg: 'white',
                border: { fg: 'cyan' },
            },
        });

        settingsContent = blessed.box({
            parent: settingsModal,
            top: 1,
            left: 1,
            right: 1,
            bottom: 1,
            tags: true,
            style: { fg: 'white', bg: 'black' },
        });

        renderSettingsContent();
        screen.render();
    }

    // Mode cycling with Shift+Tab
    const MODES: Array<'edit' | 'auto' | 'ask' | 'debug' | 'review' | 'explain'> = ['edit', 'auto', 'ask', 'debug', 'review', 'explain'];
    let currentModeIndex = MODES.indexOf(session.mode as any) || 0;

    function cycleMode(direction: 1 | -1 = 1) {
        currentModeIndex = (currentModeIndex + direction + MODES.length) % MODES.length;
        const newMode = MODES[currentModeIndex];
        session.mode = newMode;
        
        output.log(`{cyan-fg}Mode: ${newMode}{/cyan-fg}`);
        
        updateContextLine();
        updateStatusBar();
        updateModeIndicator();
        updatePlaceholder();
        screen.render();
    }

    // Shift+Tab to cycle modes - try multiple key names for compatibility
    screen.key(['S-tab', 'shift-tab'], () => {
        cycleMode(1);
    });
    
    // Also bind to backtick as alternative mode switcher
    screen.key(['`'], () => {
        cycleMode(1);
    });

    // Global Key Bindings
    screen.key(['C-c'], () => {
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

    // Settings shortcut - Ctrl+, or F2
    screen.key(['f2'], () => {
        if (!settingsOpen) {
            showSettingsMenu();
        }
    });

    screen.key(['q'], () => {
        // Only quit if not focused on input
        if (screen.focused !== input) {
            onExit?.();
            return process.exit(0);
        }
    });

    // Handle errors gracefully
    screen.on('warning', (msg: string) => {
        // Suppress blessed warnings
    });

    process.on('uncaughtException', (err) => {
        output.log(`{red-fg}Error: ${err.message}{/red-fg}`);
        screen.render();
    });

    // Cleanup on exit
    process.on('exit', () => {
        // Cleanup if needed
    });

    screen.render();
}
