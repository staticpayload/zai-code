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
exports.parseInput = parseInput;
exports.executeCommand = executeCommand;
exports.getAvailableCommands = getAvailableCommands;
const session_1 = require("./session");
const settings_1 = require("./settings");
const settings_menu_1 = require("./settings_menu");
const shell_1 = require("./shell");
const workspace_model_1 = require("./workspace_model");
const auth_1 = require("./auth");
const apply_1 = require("./apply");
const ui_1 = require("./ui");
const planner_1 = require("./planner");
const task_runner_1 = require("./task_runner");
const rollback_1 = require("./rollback");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
// Parse input to detect slash commands
function parseInput(input) {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
        return { isSlashCommand: false, rawInput: trimmed };
    }
    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);
    return {
        isSlashCommand: true,
        command,
        args,
        rawInput: trimmed,
    };
}
// Stub handlers for all commands
const handlers = {
    help: () => {
        console.log('Commands:');
        console.log('  /help      - Show this help');
        console.log('  /settings  - Configure UI settings');
        console.log('  /mode      - Set mode (edit, explain, review, debug)');
        console.log('  /reset     - Reset session state');
        console.log('  /context   - Show current context');
        console.log('  /files     - List open files');
        console.log('  /open      - Add file to context');
        console.log('  /plan      - Generate execution plan');
        console.log('  /generate  - Generate file changes');
        console.log('  /diff      - Review pending changes');
        console.log('  /apply     - Apply pending changes');
        console.log('  /undo      - Undo last file operation');
        console.log('  /history   - Show undo history');
        console.log('  /exec      - Execute shell command (allowlisted only)');
        console.log('  /workspace - Show workspace info');
        console.log('  /doctor    - Check system status');
        console.log('  /exit      - Exit interactive mode');
        console.log('');
        console.log('Multi-step task commands:');
        console.log('  /decompose - Break task into steps');
        console.log('  /step      - Plan current step');
        console.log('  /next      - Complete current step and advance');
        console.log('  /skip      - Skip current step');
        console.log('  /progress  - Show task progress');
    },
    reset: () => {
        (0, session_1.resetSession)();
        (0, rollback_1.clearUndoHistory)();
        console.log('Reset.');
    },
    settings: async (ctx) => {
        if (ctx.args.length === 0) {
            // Open interactive menu
            await (0, settings_menu_1.openSettingsMenu)();
            return;
        }
        // Quick set via command line
        const arg = ctx.args.join(' ');
        const match = arg.match(/^(\S+)\s*=\s*(\S+)$/);
        if (!match) {
            console.log('Usage: /settings [key = value]');
            console.log('Or run /settings to open interactive menu.');
            return;
        }
        const [, key, value] = match;
        const success = (0, settings_1.setNestedSetting)(key, value);
        if (success) {
            console.log(`Set ${key} = ${value}`);
        }
        else {
            console.log((0, ui_1.error)(`Invalid: ${key} = ${value}`));
        }
    },
    context: () => {
        const session = (0, session_1.getSession)();
        const ws = (0, workspace_model_1.getWorkspace)();
        console.log(`Workspace: ${ws.getRoot()}`);
        console.log(`Mode: ${session.mode}`);
        console.log(`Dry run: ${session.dryRun}`);
        console.log(`Open files: ${session.openFiles.length}`);
        console.log(`Intent: ${session.currentIntent || 'none'}`);
        console.log(`Intent type: ${session.intentType || 'none'}`);
        console.log(`Plan: ${session.lastPlan ? `${session.lastPlan.length} steps` : 'none'}`);
        console.log(`Pending: ${session.pendingActions ? 'yes' : 'no'}`);
    },
    files: () => {
        const session = (0, session_1.getSession)();
        if (session.openFiles.length === 0) {
            console.log('No open files');
        }
        else {
            session.openFiles.forEach(f => console.log(f));
        }
    },
    open: (ctx) => {
        const path = ctx.args[0];
        if (!path) {
            console.log('Usage: /open <path>');
            return;
        }
        (0, session_1.addOpenFile)(path);
        console.log(`Added: ${path}`);
    },
    mode: (ctx) => {
        const newMode = ctx.args[0]?.toLowerCase();
        const validModes = ['edit', 'explain', 'review', 'debug'];
        if (!newMode) {
            const session = (0, session_1.getSession)();
            console.log(`Current mode: ${session.mode}`);
            console.log('Available modes: edit, explain, review, debug');
            return;
        }
        if (!validModes.includes(newMode)) {
            console.log(`Invalid mode: ${newMode}`);
            console.log('Available modes: edit, explain, review, debug');
            return;
        }
        (0, session_1.setMode)(newMode);
        console.log((0, ui_1.success)(`Mode set to: ${newMode}`));
    },
    plan: async () => {
        console.log('Planning...');
        const result = await (0, planner_1.runPlannerLoop)();
        if (!result.success) {
            console.log((0, ui_1.error)(result.message));
            return;
        }
        console.log('Plan generated.');
        console.log(`Steps: ${result.plan?.length || 0}`);
        console.log('Use /generate to proceed.');
    },
    generate: async () => {
        console.log('Generating...');
        const result = await (0, planner_1.runGenerateLoop)();
        if (!result.success) {
            console.log((0, ui_1.error)(result.message));
            return;
        }
        console.log('Changes generated.');
        const fileCount = (result.changes?.files?.length || 0) + (result.changes?.diffs?.length || 0);
        console.log(`Files: ${fileCount}`);
        console.log('Use /diff to review.');
    },
    diff: () => {
        const session = (0, session_1.getSession)();
        // Check if there's a diff to display
        if (!session.lastDiff) {
            console.log('Nothing to review.');
            return;
        }
        const response = session.lastDiff;
        // Display file operations if present
        if (response.files && response.files.length > 0) {
            for (const file of response.files) {
                console.log(`--- ${file.operation}: ${file.path} ---`);
                if (file.content && file.operation !== 'delete') {
                    console.log(file.content);
                }
                console.log('');
            }
        }
        // Display diffs if present
        if (response.diffs && response.diffs.length > 0) {
            for (const diff of response.diffs) {
                console.log(`--- ${diff.file} ---`);
                for (const hunk of diff.hunks) {
                    console.log(`@@ -${hunk.start},${hunk.end - hunk.start + 1} @@`);
                    console.log(hunk.content);
                }
                console.log('');
            }
        }
        // If neither files nor diffs present
        if ((!response.files || response.files.length === 0) &&
            (!response.diffs || response.diffs.length === 0)) {
            console.log('No file changes in last response.');
            return;
        }
    },
    apply: () => {
        const session = (0, session_1.getSession)();
        // Check if there are pending actions
        if (!session.pendingActions) {
            // Also check lastDiff as fallback
            if (!session.lastDiff) {
                console.log('Nothing to apply.');
                return;
            }
            // Use lastDiff if no pendingActions
            session.pendingActions = session.lastDiff;
        }
        const actions = session.pendingActions;
        // Check if there are actual file operations
        if ((!actions.files || actions.files.length === 0) &&
            (!actions.diffs || actions.diffs.length === 0)) {
            console.log('No file changes to apply.');
            return;
        }
        // Check dry run mode
        if (session.dryRun) {
            console.log('Dry run mode. No changes applied.');
            return;
        }
        // Apply using the apply engine
        const result = (0, apply_1.applyResponse)(actions, {
            basePath: session.workingDirectory,
            dryRun: false,
        });
        if (!result.success) {
            for (const failed of result.failed) {
                console.log((0, ui_1.error)(`Failed: ${failed.path}: ${failed.error}`));
            }
            return;
        }
        // Clear pending actions after success
        (0, session_1.setPendingActions)(null);
        console.log('Applied.');
        console.log('Session clean.');
    },
    workspace: () => {
        const ws = (0, workspace_model_1.getWorkspace)();
        ws.indexFileTree();
        console.log(ws.printTreeSummary());
        console.log(`Root: ${ws.getRoot()}`);
    },
    doctor: async () => {
        console.log('System check...');
        console.log('');
        // Check 1: API key
        const hasKey = await (0, auth_1.hasValidCredentials)();
        console.log(`API key: ${hasKey ? (0, ui_1.success)('configured') : (0, ui_1.error)('missing')}`);
        // Check 2: Config directory
        const configExists = fs.existsSync(path.join(os.homedir(), '.zai'));
        console.log(`Config dir: ${configExists ? (0, ui_1.success)('exists') : (0, ui_1.error)('missing')}`);
        // Check 3: Working directory writable
        const session = (0, session_1.getSession)();
        let writable = false;
        try {
            const testFile = path.join(session.workingDirectory, '.zai-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            writable = true;
        }
        catch {
            writable = false;
        }
        console.log(`Workspace: ${writable ? (0, ui_1.success)('writable') : (0, ui_1.error)('read-only')}`);
        // Check 4: Node version
        const nodeVersion = process.version;
        const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
        console.log(`Node.js: ${major >= 18 ? (0, ui_1.success)(nodeVersion) : (0, ui_1.error)(`${nodeVersion} (requires 18+)`)}`);
        // Summary
        console.log('');
        const allGood = hasKey && configExists && writable && major >= 18;
        if (allGood) {
            console.log((0, ui_1.success)('All checks passed.'));
        }
        else {
            console.log((0, ui_1.error)('Some checks failed.'));
        }
    },
    exit: () => { process.exit(0); },
    exec: (ctx) => {
        const command = ctx.args.join(' ');
        if (!command) {
            console.log('Usage: /exec <command>');
            console.log('Allowed commands: ' + (0, shell_1.getAllowedCommands)().join(', '));
            return;
        }
        // Validate before execution
        const validation = (0, shell_1.validateCommand)(command);
        if (!validation.valid) {
            console.log((0, ui_1.error)(`Blocked: ${validation.error}`));
            return;
        }
        console.log(`Executing: ${command}`);
        const result = (0, shell_1.executeCommand)(command);
        // Store in session
        (0, session_1.setLastExecResult)(result);
        if (result.success) {
            if (result.stdout) {
                console.log(result.stdout);
            }
            console.log((0, ui_1.success)(`Exit code: ${result.exitCode}`));
        }
        else {
            if (result.stderr) {
                console.log(result.stderr);
            }
            console.log((0, ui_1.error)(`Failed: ${result.error || `Exit code ${result.exitCode}`}`));
        }
    },
    decompose: async () => {
        const intent = (0, session_1.getIntent)();
        if (!intent) {
            console.log('No intent set. Enter a task first.');
            return;
        }
        console.log('Decomposing task...');
        const result = await (0, task_runner_1.decomposeTask)();
        if (!result.success) {
            console.log((0, ui_1.error)(result.message));
            return;
        }
        console.log((0, ui_1.success)(result.message));
        console.log('');
        (0, task_runner_1.printProgress)();
        console.log('');
        console.log('Use /step to plan current step, or /next to advance.');
    },
    step: async () => {
        const step = (0, session_1.getCurrentStep)();
        if (!step) {
            console.log('No current step. Use /decompose first.');
            return;
        }
        console.log(`Planning step: ${step.description}`);
        const result = await (0, task_runner_1.planCurrentStep)();
        if (!result.success) {
            console.log((0, ui_1.error)(result.message));
            return;
        }
        console.log((0, ui_1.success)(result.message));
        console.log('Use /generate to create changes, then /diff and /apply.');
    },
    next: () => {
        const result = (0, task_runner_1.completeCurrentStep)();
        if (!result.success) {
            console.log((0, ui_1.error)(result.message));
            return;
        }
        console.log((0, ui_1.success)(result.message));
        if (result.hasMore) {
            (0, task_runner_1.printProgress)();
        }
    },
    skip: () => {
        const result = (0, task_runner_1.skipCurrentStep)();
        if (!result.success) {
            console.log((0, ui_1.error)(result.message));
            return;
        }
        console.log(result.message);
        if (result.hasMore) {
            (0, task_runner_1.printProgress)();
        }
    },
    progress: () => {
        (0, task_runner_1.printProgress)();
    },
    undo: (ctx) => {
        const count = ctx.args[0] ? parseInt(ctx.args[0], 10) : 1;
        if (isNaN(count) || count < 1) {
            console.log('Usage: /undo [count]');
            return;
        }
        if (count === 1) {
            const result = (0, rollback_1.undoLast)();
            if (result.success) {
                console.log((0, ui_1.success)(result.message));
            }
            else {
                console.log((0, ui_1.error)(result.message));
            }
        }
        else {
            const result = (0, rollback_1.undoN)(count);
            for (const msg of result.messages) {
                console.log(msg);
            }
            console.log((0, ui_1.success)(`Undone: ${result.undone} operation(s)`));
        }
    },
    history: () => {
        const entries = (0, rollback_1.getUndoHistory)();
        if (entries.length === 0) {
            console.log('No undo history.');
            return;
        }
        console.log(`Undo history (${entries.length} entries):`);
        // Show last 10 entries
        const recent = entries.slice(-10).reverse();
        for (let i = 0; i < recent.length; i++) {
            const entry = recent[i];
            const relativePath = path.relative(process.cwd(), entry.path);
            console.log(`  ${i + 1}. ${entry.operation}: ${relativePath}`);
        }
        if (entries.length > 10) {
            console.log(`  ... and ${entries.length - 10} more`);
        }
    },
};
// Execute a parsed slash command
async function executeCommand(parsed) {
    if (!parsed.isSlashCommand || !parsed.command) {
        return false;
    }
    const handler = handlers[parsed.command];
    if (!handler) {
        console.log(`Unknown command: /${parsed.command}`);
        return true;
    }
    await handler({ args: parsed.args || [], rawInput: parsed.rawInput });
    return true;
}
// Get list of available commands
function getAvailableCommands() {
    return Object.keys(handlers);
}
//# sourceMappingURL=commands.js.map