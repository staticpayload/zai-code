import * as blessed from 'blessed';
import { getSession } from './session';
import { orchestrate } from './orchestrator';
import { getAvailableCommands } from './commands';
import { getGitInfo } from './git';
import { getModel, ZAI_MODELS, shouldShowLogo, loadSettings, saveSettings, Settings, AVAILABLE_MODELS } from './settings';
import { getActiveProfileName } from './profiles';
import { getWorkspace } from './workspace_model';
import { hasAgentsConfig } from './agents';
import * as path from 'path';

export interface TUIOptions {
    projectName: string;
    restored?: boolean;
    onExit?: () => void;
}

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

export async function startTUI(options: TUIOptions): Promise<void> {
    const { projectName, restored, onExit } = options;
    const session = getSession();

    // Create screen with explicit color support
    const screen = blessed.screen({
        smartCSR: true,
        title: 'zai·code',
        fullUnicode: true,
        dockBorders: true,
        autoPadding: true,
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
        height: shouldShowLogo() ? 8 : 2,
        tags: true,
        content: shouldShowLogo() ? ASCII_LOGO : MINIMAL_LOGO,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
    });

    // Tips section
    const tips = blessed.box({
        top: shouldShowLogo() ? 8 : 2,
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
    const warningTop = shouldShowLogo() ? 12 : 6;
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
        warning.setContent('You are running in your home directory. It is recommended to run in a project-specific directory.');
        warning.show();
    } else if (!gitInfo.isRepo) {
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

    // Input textbox
    const input = blessed.textbox({
        parent: inputContainer,
        left: 3,
        top: 0,
        width: '100%-5',
        height: 1,
        inputOnFocus: true,
        style: {
            fg: theme.fg,
            bg: theme.bg,
        },
    });

    // Placeholder text
    const placeholder = blessed.text({
        parent: inputContainer,
        left: 3,
        top: 0,
        tags: true,
        content: `{gray-fg}Type your message or /command{/gray-fg}`,
        style: {
            fg: theme.gray,
            bg: theme.bg
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
            fg: theme.fg,
            bg: theme.bg,
        },
        padding: { left: 1, right: 1 },
    });

    // Update status bar
    function updateStatusBar() {
        const model = getModel();
        const mode = getSession().mode;
        const gitStatus = gitInfo.isRepo ? `${gitInfo.branch}${gitInfo.isDirty ? '*' : ''}` : 'no-git';

        const left = `{bold}[${mode}]{/bold}`;
        const center = `${gitStatus}`;
        const right = `{cyan-fg}${model}{/cyan-fg}`;

        const width = (screen.width as number) || 80;
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
    if (hasAgentsConfig(session.workingDirectory)) {
        output.log('{green-fg}agents.md detected and applied{/green-fg}');
    }

    // --- LOGIC ---

    let showPalette = false;

    function updatePalette(filter: string) {
        const query = filter.replace(/^\//, '').toLowerCase();
        const filtered = COMMANDS.filter(c => c.name.startsWith(query));
        palette.setItems(filtered.map(c => `{bold}/${c.name}{/bold}  {gray-fg}${c.description}{/gray-fg}`));

        // Reset selection to top on new filter
        if (filtered.length > 0) {
            palette.select(0);
        }
    }

    function togglePalette(show: boolean, filter: string = '/') {
        showPalette = show;
        if (show) {
            updatePalette(filter);
            palette.show();
            // CRITICAL: Do NOT focus palette. Keep input focused.
            screen.render();
        } else {
            palette.hide();
            screen.render();
        }
    }

    // Process input
    async function processInput(value: string) {
        if (!value.trim()) return;

        placeholder.hide();
        output.log(`{gray-fg}> ${value}{/gray-fg}`);

        const trimmed = value.trim();

        if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
            onExit?.();
            return process.exit(0);
        }

        if (trimmed === '/settings') {
            showSettingsMenu();
            return;
        }

        // Capture console.log
        const originalLog = console.log;
        console.log = (...args: unknown[]) => {
            output.log(args.map(a => String(a)).join(' '));
        };

        try {
            await orchestrate(value);
        } catch (e) {
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

    // Manual keypress handling for Palette interaction
    input.on('keypress', (ch, key) => {
        if (!key) return;

        if (key.name === 'escape') {
            if (showPalette) {
                togglePalette(false);
            }
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
        setTimeout(() => {
            const val = input.getValue();
            if (val.startsWith('/')) {
                togglePalette(true, val);
            } else {
                if (showPalette) togglePalette(false);
            }
        }, 0);
    });

    // Submit handler
    input.on('submit', async (value: string) => {
        if (showPalette) {
            const selectedIndex = (palette as any).selected;
            const filter = input.getValue().replace(/^\//, '').toLowerCase();
            // Logic duplication, but safe
            const filteredCommands = COMMANDS.filter(c => c.name.startsWith(filter));

            if (filteredCommands[selectedIndex]) {
                // Autocomplete
                const cmd = filteredCommands[selectedIndex];
                input.setValue('/' + cmd.name + ' ');
                togglePalette(false);
                input.screen.render();
                // Do not submit yet, let user type arguments
                return;
            }
        }

        input.clearValue();
        togglePalette(false);
        await processInput(value);
        input.focus();
    });

    // SETTINGS MODAL
    function showSettingsMenu() {
        const modal = blessed.box({
            parent: screen,
            top: 'center',
            left: 'center',
            width: '50%',
            height: '60%',
            border: { type: 'line' },
            label: ' Settings (Esc to save & exit) ',
            tags: true,
            style: {
                bg: 'black',
                fg: 'white',
                border: { fg: 'cyan' },
                label: { fg: 'cyan', bold: true }
            },
            draggable: true
        });

        // Current settings
        let currentSettings = loadSettings();
        const models = AVAILABLE_MODELS;

        // Flatten settings for list
        const getListItems = () => [
            `Model: ${currentSettings.model.current}`,
            `Color: ${currentSettings.ui.color}`,
            `Prompt: ${currentSettings.ui.promptStyle}`,
            `Confirm: ${currentSettings.execution.confirmationMode}`,
            `Shell Exec: ${currentSettings.execution.allowShellExec}`,
            `Debug Log: ${currentSettings.debug.logging}`
        ];

        const list = blessed.list({
            parent: modal,
            top: 1,
            left: 1,
            right: 1,
            bottom: 3,
            keys: true,
            vi: true,
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
            content: 'Enter: toggle/cycle  Esc: save',
            style: { fg: 'gray', bg: 'black' }
        });

        list.focus();
        screen.render();

        list.on('select', (item, index) => {
            // Basic cycling logic
            if (index === 0) { // Model
                const currIdx = models.indexOf(currentSettings.model.current);
                const nextIdx = (currIdx + 1) % models.length;
                currentSettings.model.current = models[nextIdx];
            } else if (index === 1) { // Color
                const vals = ['auto', 'on', 'off'];
                const currentVal = currentSettings.ui.color as string;
                const n = (vals.indexOf(currentVal) + 1) % 3;
                currentSettings.ui.color = vals[n] as any;
            } else if (index === 2) { // Prompt
                const v = currentSettings.ui.promptStyle === 'compact' ? 'verbose' : 'compact';
                currentSettings.ui.promptStyle = v;
            } else if (index === 3) { // Confirm
                const v = currentSettings.execution.confirmationMode === 'strict' ? 'normal' : 'strict';
                currentSettings.execution.confirmationMode = v;
            } else if (index === 4) { // Shell
                currentSettings.execution.allowShellExec = !currentSettings.execution.allowShellExec;
            } else if (index === 5) { // Debug
                currentSettings.debug.logging = !currentSettings.debug.logging;
            }

            // Update all items
            list.setItems(getListItems());
            list.select(index); // Keep selection
            screen.render();
        });

        list.key(['escape'], () => {
            saveSettings(currentSettings);
            updateStatusBar();
            modal.destroy();
            input.focus();
            screen.render();
            output.log('{green-fg}Settings saved.{/green-fg}');
        });
    }

    // Global Key Bindings
    screen.key(['C-c'], () => {
        onExit?.();
        return process.exit(0);
    });

    screen.render();
}
