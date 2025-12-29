import {
  getSession,
  resetSession,
  addOpenFile,
  setMode,
  getIntent,
  setLastPlan,
  setLastDiff,
  setPendingActions,
  setLastExecResult,
  PLAN_SCHEMA,
  PlanStep,
  SessionMode,
  getCurrentStep,
  getStepProgress,
} from './session';
import { loadSettings, setNestedSetting } from './settings';
import { executeCommand as execShellCommand, validateCommand, getAllowedCommands, ExecResult } from './shell';
import { getWorkspace } from './workspace_model';
import { ensureAuthenticated, hasValidCredentials } from './auth';
import { execute, ResponseSchema } from './runtime';
import { getFileContent } from './workspace';
import { applyResponse } from './apply';
import { success, error, info, hint } from './ui';
import { runPlannerLoop, runGenerateLoop } from './planner';
import { decomposeTask, planCurrentStep, printProgress, completeCurrentStep, skipCurrentStep } from './task_runner';
import { undoLast, undoN, getUndoHistory, clearUndoHistory } from './rollback';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface CommandContext {
  args: string[];
  rawInput: string;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void> | void;

export interface ParsedCommand {
  isSlashCommand: boolean;
  command?: string;
  args?: string[];
  rawInput: string;
}

// Parse input to detect slash commands
export function parseInput(input: string): ParsedCommand {
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
const handlers: Record<string, CommandHandler> = {
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
    resetSession();
    clearUndoHistory();
    console.log('Reset.');
  },
  settings: (ctx) => {
    const settings = loadSettings();

    if (ctx.args.length === 0) {
      // Show current settings
      console.log('Settings:');
      console.log(`  ui.asciiLogo = ${settings.ui.asciiLogo}`);
      console.log(`  ui.color = ${settings.ui.color}`);
      return;
    }

    // Parse key=value
    const arg = ctx.args.join(' ');
    const match = arg.match(/^(\S+)\s*=\s*(\S+)$/);

    if (!match) {
      console.log('Usage: /settings [key = value]');
      console.log('Keys: ui.asciiLogo, ui.color');
      return;
    }

    const [, key, value] = match;
    const success = setNestedSetting(key, value);

    if (success) {
      console.log(`Set ${key} = ${value}`);
    } else {
      console.log(error(`Invalid setting: ${key} = ${value}`));
      console.log('Valid: ui.asciiLogo = on|off, ui.color = auto|on|off');
    }
  },
  context: () => {
    const session = getSession();
    const ws = getWorkspace();
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
    const session = getSession();
    if (session.openFiles.length === 0) {
      console.log('No open files');
    } else {
      session.openFiles.forEach(f => console.log(f));
    }
  },
  open: (ctx) => {
    const path = ctx.args[0];
    if (!path) {
      console.log('Usage: /open <path>');
      return;
    }
    addOpenFile(path);
    console.log(`Added: ${path}`);
  },
  mode: (ctx) => {
    const newMode = ctx.args[0]?.toLowerCase();
    const validModes = ['edit', 'explain', 'review', 'debug'];

    if (!newMode) {
      const session = getSession();
      console.log(`Current mode: ${session.mode}`);
      console.log('Available modes: edit, explain, review, debug');
      return;
    }

    if (!validModes.includes(newMode)) {
      console.log(`Invalid mode: ${newMode}`);
      console.log('Available modes: edit, explain, review, debug');
      return;
    }

    setMode(newMode as SessionMode);
    console.log(success(`Mode set to: ${newMode}`));
  },
  plan: async () => {
    console.log('Planning...');
    const result = await runPlannerLoop();

    if (!result.success) {
      console.log(error(result.message));
      return;
    }

    console.log('Plan generated.');
    console.log(`Steps: ${result.plan?.length || 0}`);
    console.log('Use /generate to proceed.');
  },
  generate: async () => {
    console.log('Generating...');
    const result = await runGenerateLoop();

    if (!result.success) {
      console.log(error(result.message));
      return;
    }

    console.log('Changes generated.');
    const fileCount = (result.changes?.files?.length || 0) + (result.changes?.diffs?.length || 0);
    console.log(`Files: ${fileCount}`);
    console.log('Use /diff to review.');
  },
  diff: () => {
  const session = getSession();

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
    const session = getSession();

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
    const result = applyResponse(actions, {
      basePath: session.workingDirectory,
      dryRun: false,
    });

    if (!result.success) {
      for (const failed of result.failed) {
        console.log(error(`Failed: ${failed.path}: ${failed.error}`));
      }
      return;
    }

    // Clear pending actions after success
    setPendingActions(null);

    console.log('Applied.');
    console.log('Session clean.');
  },
  workspace: () => {
    const ws = getWorkspace();
    ws.indexFileTree();
    console.log(ws.printTreeSummary());
    console.log(`Root: ${ws.getRoot()}`);
  },
  doctor: async () => {
  console.log('System check...');
  console.log('');

  // Check 1: API key
  const hasKey = await hasValidCredentials();
  console.log(`API key: ${hasKey ? success('configured') : error('missing')}`);

  // Check 2: Config directory
  const configExists = fs.existsSync(path.join(os.homedir(), '.zai'));
  console.log(`Config dir: ${configExists ? success('exists') : error('missing')}`);

  // Check 3: Working directory writable
  const session = getSession();
  let writable = false;
  try {
    const testFile = path.join(session.workingDirectory, '.zai-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    writable = true;
  } catch {
    writable = false;
  }
  console.log(`Workspace: ${writable ? success('writable') : error('read-only')}`);

  // Check 4: Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  console.log(`Node.js: ${major >= 18 ? success(nodeVersion) : error(`${nodeVersion} (requires 18+)`)}`);

  // Summary
  console.log('');
  const allGood = hasKey && configExists && writable && major >= 18;
  if (allGood) {
    console.log(success('All checks passed.'));
  } else {
    console.log(error('Some checks failed.'));
  }
},
  exit: () => { process.exit(0); },
  exec: (ctx) => {
    const command = ctx.args.join(' ');

    if (!command) {
      console.log('Usage: /exec <command>');
      console.log('Allowed commands: ' + getAllowedCommands().join(', '));
      return;
    }

    // Validate before execution
    const validation = validateCommand(command);
    if (!validation.valid) {
      console.log(error(`Blocked: ${validation.error}`));
      return;
    }

    console.log(`Executing: ${command}`);
    const result = execShellCommand(command);

    // Store in session
    setLastExecResult(result);

    if (result.success) {
      if (result.stdout) {
        console.log(result.stdout);
      }
      console.log(success(`Exit code: ${result.exitCode}`));
    } else {
      if (result.stderr) {
        console.log(result.stderr);
      }
      console.log(error(`Failed: ${result.error || `Exit code ${result.exitCode}`}`));
    }
  },
  decompose: async () => {
    const intent = getIntent();
    if (!intent) {
      console.log('No intent set. Enter a task first.');
      return;
    }

    console.log('Decomposing task...');
    const result = await decomposeTask();

    if (!result.success) {
      console.log(error(result.message));
      return;
    }

    console.log(success(result.message));
    console.log('');
    printProgress();
    console.log('');
    console.log('Use /step to plan current step, or /next to advance.');
  },
  step: async () => {
    const step = getCurrentStep();
    if (!step) {
      console.log('No current step. Use /decompose first.');
      return;
    }

    console.log(`Planning step: ${step.description}`);
    const result = await planCurrentStep();

    if (!result.success) {
      console.log(error(result.message));
      return;
    }

    console.log(success(result.message));
    console.log('Use /generate to create changes, then /diff and /apply.');
  },
  next: () => {
    const result = completeCurrentStep();

    if (!result.success) {
      console.log(error(result.message));
      return;
    }

    console.log(success(result.message));

    if (result.hasMore) {
      printProgress();
    }
  },
  skip: () => {
    const result = skipCurrentStep();

    if (!result.success) {
      console.log(error(result.message));
      return;
    }

    console.log(result.message);

    if (result.hasMore) {
      printProgress();
    }
  },
  progress: () => {
    printProgress();
  },
  undo: (ctx) => {
    const count = ctx.args[0] ? parseInt(ctx.args[0], 10) : 1;

    if (isNaN(count) || count < 1) {
      console.log('Usage: /undo [count]');
      return;
    }

    if (count === 1) {
      const result = undoLast();
      if (result.success) {
        console.log(success(result.message));
      } else {
        console.log(error(result.message));
      }
    } else {
      const result = undoN(count);
      for (const msg of result.messages) {
        console.log(msg);
      }
      console.log(success(`Undone: ${result.undone} operation(s)`));
    }
  },
  history: () => {
    const entries = getUndoHistory();

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
export async function executeCommand(parsed: ParsedCommand): Promise<boolean> {
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
export function getAvailableCommands(): string[] {
  return Object.keys(handlers);
}
