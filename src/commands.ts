import {
  getSession,
  resetSession,
  addOpenFile,
  removeOpenFile,
  clearOpenFiles,
  setMode,
  getIntent,
  setIntent,
  clearIntent,
  setLastPlan,
  setLastDiff,
  setPendingActions,
  setLastExecResult,
  PLAN_SCHEMA,
  PlanStep,
  SessionMode,
  getCurrentStep,
  getStepProgress,
  setDryRun,
  isDryRun,
} from './session';
import { loadSettings, setNestedSetting, hasProjectSettings, getModel, setModel, ZAI_MODELS, AVAILABLE_MODELS } from './settings';
import { getGitInfo } from './git';
import { listProfiles, applyProfile, getActiveProfileName } from './profiles';
import { getHistory as getTaskHistory, getLastEntry, clearHistory, logTask, HistoryEntry } from './history';
import { openSettingsMenu } from './settings_menu';
import { executeCommand as execShellCommand, validateCommand, getAllowedCommands, ExecResult } from './shell';
import { getWorkspace } from './workspace_model';
import { ensureAuthenticated, hasValidCredentials } from './auth';
import { execute, ResponseSchema } from './runtime';
import { getFileContent, collectWorkspace } from './workspace';
import { applyResponse } from './apply';
import { success, error, info, hint, dim } from './ui';
import * as theme from './theme';
import { runPlannerLoop, runGenerateLoop } from './planner';
import { decomposeTask, planCurrentStep, printProgress, completeCurrentStep, skipCurrentStep } from './task_runner';
import { undoLast, undoN, getUndoHistory, clearUndoHistory, getUndoCount } from './rollback';
import { buildSystemPrompt } from './mode_prompts';
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
  help: (ctx) => {
    const topic = ctx.args[0]?.toLowerCase();
    
    if (topic === 'modes') {
      console.log('');
      console.log(info('Available Modes:'));
      console.log('');
      console.log('  auto    ⚡ YOLO mode: execute tasks directly without confirmation');
      console.log('  edit    ✏️  Default: plan → generate → review → apply workflow');
      console.log('  ask     ❓ Read-only: answer questions, no file changes');
      console.log('  explain 📖 Read-only: explain code concepts');
      console.log('  review  👁  Read-only: code review and analysis');
      console.log('  debug   🔧 Investigate and fix issues');
      console.log('');
      console.log(hint('/mode <name> to switch'));
      return;
    }
    
    if (topic === 'workflow') {
      console.log('');
      console.log(info('Standard Workflow:'));
      console.log('');
      console.log('  1. Type a task (e.g., "add error handling to auth.ts")');
      console.log('  2. /plan    - Generate execution plan');
      console.log('  3. /generate - Create file changes');
      console.log('  4. /diff    - Review changes');
      console.log('  5. /apply   - Apply changes');
      console.log('  6. /undo    - Rollback if needed');
      console.log('');
      console.log(info('Quick Workflow:'));
      console.log('');
      console.log('  /do <task>  - Plan + generate in one step');
      console.log('  /run <task> - Plan + generate + apply (YOLO)');
      console.log('');
      return;
    }
    
    if (topic === 'shortcuts') {
      console.log('');
      console.log(info('Keyboard Shortcuts:'));
      console.log('');
      console.log('  Ctrl+D    /do <task>   - Quick execute');
      console.log('  Ctrl+R    /run <task>  - Auto mode run');
      console.log('  Ctrl+P    /plan        - Generate plan');
      console.log('  Ctrl+G    /generate    - Create changes');
      console.log('  Ctrl+Z    /undo        - Rollback');
      console.log('  Ctrl+A    /ask <q>     - Quick question');
      console.log('  Ctrl+F    /fix <desc>  - Quick debug');
      console.log('  Ctrl+C    Exit');
      console.log('');
      console.log(info('Command Aliases:'));
      console.log('');
      console.log('  /h = /help    /p = /plan    /g = /generate');
      console.log('  /d = /diff    /a = /apply   /u = /undo');
      console.log('  /s = /status  /c = /context /f = /files');
      console.log('');
      return;
    }

    if (topic === 'quick') {
      console.log('');
      console.log(info('Quick Commands:'));
      console.log('');
      console.log('  /do <task>   Plan + generate in one step');
      console.log('               Example: /do add input validation to login form');
      console.log('');
      console.log('  /run <task>  Plan + generate + apply automatically');
      console.log('               Example: /run fix the typo in README.md');
      console.log('');
      console.log('  /ask <q>     Quick question without changing mode');
      console.log('               Example: /ask what does this function do?');
      console.log('');
      console.log('  /fix <desc>  Quick debug mode task');
      console.log('               Example: /fix login button not working');
      console.log('');
      console.log('  /commit      Generate AI commit message');
      console.log('               Example: /commit (auto) or /commit feat: add login');
      console.log('');
      return;
    }
    
    // Default help
    console.log('');
    console.log(info('zai·code Commands'));
    console.log('');
    console.log(dim('Quick Actions:'));
    console.log('  /do <task>     Plan + generate in one step');
    console.log('  /run <task>    Plan + generate + apply (YOLO)');
    console.log('  /ask <q>       Quick question');
    console.log('  /fix <desc>    Quick debug task');
    console.log('');
    console.log(dim('Workflow:'));
    console.log('  /plan          Generate execution plan');
    console.log('  /generate      Create file changes');
    console.log('  /diff [full]   Review pending changes');
    console.log('  /apply [-f]    Apply changes');
    console.log('  /undo [n]      Rollback operations');
    console.log('  /retry         Retry last failed operation');
    console.log('  /clear         Clear current task');
    console.log('');
    console.log(dim('Files:'));
    console.log('  /open <path>   Add file to context');
    console.log('  /close <path>  Remove from context');
    console.log('  /files         List open files');
    console.log('  /search <q>    Search files');
    console.log('  /read <path>   View file contents');
    console.log('  /tree [depth]  Show file tree');
    console.log('');
    console.log(dim('Modes & Settings:'));
    console.log('  /mode [name]   Set mode (edit/ask/auto/debug/review/explain)');
    console.log('  /model [id]    Select AI model');
    console.log('  /settings      Open settings menu');
    console.log('  /dry-run       Toggle dry-run mode');
    console.log('');
    console.log(dim('Git:'));
    console.log('  /git [cmd]     Git operations (status/log/diff/stash/pop)');
    console.log('  /commit [msg]  AI-powered commit');
    console.log('');
    console.log(dim('System:'));
    console.log('  /status        Show session status');
    console.log('  /doctor        System health check');
    console.log('  /version       Show version');
    console.log('  /reset         Reset session');
    console.log('  /exit          Exit zcode');
    console.log('');
    console.log(hint('/help <topic> for details: modes, workflow, shortcuts, quick'));
  },
  
  // Quick execute - plan + generate in one step
  do: async (ctx) => {
    const task = ctx.args.join(' ');
    if (!task) {
      console.log('Usage: /do <task>');
      console.log('Example: /do add input validation to login form');
      return;
    }
    
    // Set intent
    setIntent(task);
    console.log(info(`Task: ${task}`));
    
    // Plan
    console.log(dim('Planning...'));
    const planResult = await runPlannerLoop();
    if (!planResult.success) {
      console.log(error(planResult.message));
      return;
    }
    console.log(success(`Plan: ${planResult.plan?.length || 0} steps`));
    
    // Generate
    console.log(dim('Generating...'));
    const genResult = await runGenerateLoop();
    if (!genResult.success) {
      console.log(error(genResult.message));
      return;
    }
    
    const fileCount = (genResult.changes?.files?.length || 0) + (genResult.changes?.diffs?.length || 0);
    console.log(success(`Generated ${fileCount} file change(s)`));
    console.log(hint('/diff to review, /apply to execute'));
  },
  
  // Full auto run - plan + generate + apply
  run: async (ctx) => {
    const task = ctx.args.join(' ');
    if (!task) {
      console.log('Usage: /run <task>');
      console.log('Warning: This will apply changes automatically!');
      return;
    }
    
    const session = getSession();
    if (session.dryRun) {
      console.log(error('Dry-run mode enabled. Use /dry-run off first.'));
      return;
    }
    
    // Set intent
    setIntent(task);
    console.log(info(`Task: ${task}`));
    
    // Plan
    console.log(dim('Planning...'));
    const planResult = await runPlannerLoop();
    if (!planResult.success) {
      console.log(error(planResult.message));
      return;
    }
    console.log(success(`Plan: ${planResult.plan?.length || 0} steps`));
    
    // Generate
    console.log(dim('Generating...'));
    const genResult = await runGenerateLoop();
    if (!genResult.success) {
      console.log(error(genResult.message));
      return;
    }
    
    // Apply
    console.log(dim('Applying...'));
    const actions = session.pendingActions;
    if (!actions || ((!actions.files || actions.files.length === 0) && (!actions.diffs || actions.diffs.length === 0))) {
      console.log('No changes to apply.');
      return;
    }
    
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
    
    setPendingActions(null);
    console.log(success(`Applied ${result.applied.length} change(s)`));
    console.log(hint('/undo to rollback'));
  },
  
  // Retry last failed operation
  retry: async () => {
    const session = getSession();
    
    if (session.lastPlan && session.lastPlan.length > 0 && !session.lastDiff) {
      // Have plan but no diff - retry generate
      console.log(dim('Retrying generation...'));
      const result = await runGenerateLoop();
      if (result.success) {
        console.log(success('Generation succeeded on retry'));
        console.log(hint('/diff to review'));
      } else {
        console.log(error(result.message));
      }
      return;
    }
    
    if (getIntent() && (!session.lastPlan || session.lastPlan.length === 0)) {
      // Have intent but no plan - retry plan
      console.log(dim('Retrying planning...'));
      const result = await runPlannerLoop();
      if (result.success) {
        console.log(success('Planning succeeded on retry'));
        console.log(hint('/generate to create changes'));
      } else {
        console.log(error(result.message));
      }
      return;
    }
    
    console.log('Nothing to retry.');
  },
  
  // Clear current task
  clear: () => {
    clearIntent();
    setLastPlan(null);
    setLastDiff(null);
    setPendingActions(null);
    console.log('Task cleared.');
  },
  
  // Close/remove file from context
  close: (ctx) => {
    const filePath = ctx.args[0];
    if (!filePath) {
      console.log('Usage: /close <path> or /close all');
      return;
    }
    
    if (filePath === 'all') {
      clearOpenFiles();
      console.log('All files removed from context.');
      return;
    }
    
    removeOpenFile(filePath);
    console.log(`Removed: ${filePath}`);
  },
  
  // Search files in workspace
  search: (ctx) => {
    const query = ctx.args.join(' ');
    if (!query) {
      console.log('Usage: /search <pattern>');
      return;
    }
    
    const session = getSession();
    const ws = getWorkspace(session.workingDirectory);
    ws.indexFileTree();
    const files = ws.getFileIndex();
    
    const pattern = query.toLowerCase();
    const matches = files.filter(f => f.path.toLowerCase().includes(pattern));
    
    if (matches.length === 0) {
      console.log(`No files matching "${query}"`);
      return;
    }
    
    console.log(`Found ${matches.length} file(s):`);
    for (const m of matches.slice(0, 20)) {
      console.log(`  ${m.path}`);
    }
    if (matches.length > 20) {
      console.log(dim(`  ... and ${matches.length - 20} more`));
    }
  },
  
  // Quick ask without changing mode
  'ask-quick': async (ctx) => {
    const question = ctx.args.join(' ');
    if (!question) {
      console.log('Usage: /ask <question>');
      return;
    }
    
    let apiKey: string;
    try {
      apiKey = await ensureAuthenticated();
      if (!apiKey) {
        console.log(error('No API key configured.'));
        return;
      }
    } catch (e: any) {
      console.log(error(`Auth failed: ${e?.message}`));
      return;
    }
    
    const session = getSession();
    const modePrompt = buildSystemPrompt('ask', session.workingDirectory);
    
    console.log(dim('Thinking...'));
    const result = await execute({
      instruction: `${modePrompt}\n\nQuestion: ${question}\n\nAnswer concisely.`,
      enforceSchema: false,
    }, apiKey);
    
    if (result.success && result.output) {
      const text = typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2);
      console.log(text);
    } else {
      console.log(error(result.error || 'Failed'));
    }
  },
  
  // Quick fix/debug
  fix: async (ctx) => {
    const description = ctx.args.join(' ');
    if (!description) {
      console.log('Usage: /fix <problem description>');
      return;
    }
    
    setMode('debug');
    setIntent(`Fix: ${description}`);
    console.log(info(`Debug task: ${description}`));
    console.log(hint('/plan to start debugging'));
  },
  
  // Save session to disk
  save: () => {
    const session = getSession();
    const ws = getWorkspace(session.workingDirectory);
    const saved = ws.saveState();
    if (saved) {
      console.log(success('Session saved to .zai/workspace.json'));
    } else {
      console.log(error('Failed to save session'));
    }
  },
  
  // Load session from disk
  load: () => {
    const session = getSession();
    const ws = getWorkspace(session.workingDirectory);
    const restored = ws.restoreState();
    if (restored) {
      console.log(success('Session restored'));
      console.log(`Mode: ${session.mode}`);
      console.log(`Intent: ${session.currentIntent || 'none'}`);
      console.log(`Files: ${session.openFiles.length}`);
    } else {
      console.log('No saved session found.');
    }
  },
  
  // Git commit helper
  commit: async (ctx) => {
    const message = ctx.args.join(' ');
    const session = getSession();
    const gitInfo = getGitInfo(session.workingDirectory);
    
    if (!gitInfo.isRepo) {
      console.log(error('Not a git repository.'));
      return;
    }
    
    if (!gitInfo.isDirty) {
      console.log('Nothing to commit (working tree clean).');
      return;
    }
    
    if (!message) {
      // Generate commit message
      let apiKey: string;
      try {
        apiKey = await ensureAuthenticated();
        if (!apiKey) {
          console.log('Usage: /commit <message>');
          return;
        }
      } catch {
        console.log('Usage: /commit <message>');
        return;
      }
      
      console.log(dim('Generating commit message...'));
      
      // Get git diff
      const { execSync } = require('child_process');
      let diff = '';
      try {
        diff = execSync('git diff --staged', { cwd: session.workingDirectory, encoding: 'utf-8', maxBuffer: 50000 });
        if (!diff) {
          diff = execSync('git diff', { cwd: session.workingDirectory, encoding: 'utf-8', maxBuffer: 50000 });
        }
      } catch {
        console.log(error('Failed to get git diff'));
        return;
      }
      
      if (!diff) {
        console.log('No changes to commit.');
        return;
      }
      
      const result = await execute({
        instruction: `Generate a concise git commit message for these changes. Use conventional commit format (feat/fix/docs/refactor/etc). Output ONLY the commit message, nothing else.\n\nDiff:\n${diff.substring(0, 5000)}`,
        enforceSchema: false,
      }, apiKey);
      
      if (result.success && result.output) {
        const msg = typeof result.output === 'string' ? result.output.trim() : String(result.output);
        console.log(`Suggested: ${msg}`);
        console.log(hint(`/commit ${msg}`));
      } else {
        console.log('Usage: /commit <message>');
      }
      return;
    }
    
    // Execute commit
    const { execSync } = require('child_process');
    try {
      execSync('git add -A', { cwd: session.workingDirectory, stdio: 'pipe' });
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: session.workingDirectory, stdio: 'pipe' });
      console.log(success(`Committed: ${message}`));
    } catch (e: any) {
      console.log(error(`Commit failed: ${e?.message || e}`));
    }
  },
  
  // Version info
  version: () => {
    try {
      const pkg = require('../package.json');
      console.log(`zai-code v${pkg.version}`);
      console.log(`Node.js ${process.version}`);
      console.log(`Platform: ${process.platform} ${process.arch}`);
    } catch {
      console.log('zai-code');
    }
  },
  
  // Status - comprehensive overview
  status: () => {
    const session = getSession();
    const gitInfo = getGitInfo(session.workingDirectory);
    const undoCount = getUndoCount();
    
    console.log('');
    console.log(info('Session Status'));
    console.log('');
    
    // Mode with icon
    const modeIcons: Record<string, string> = {
      'auto': '⚡', 'edit': '✏️', 'ask': '❓', 'debug': '🔧', 'review': '👁', 'explain': '📖'
    };
    const modeIcon = modeIcons[session.mode] || '';
    console.log(`  Mode:      ${modeIcon} ${session.mode}${session.dryRun ? ' (dry-run)' : ''}`);
    console.log(`  Model:     ${getModel()}`);
    console.log(`  Directory: ${session.workingDirectory}`);
    console.log('');
    
    // Git status
    if (gitInfo.isRepo) {
      const status = gitInfo.isDirty ? `${gitInfo.uncommittedFiles} uncommitted` : 'clean';
      console.log(`  Git:       ${gitInfo.branch}${gitInfo.isDirty ? '*' : ''} (${status})`);
    } else {
      console.log('  Git:       not a repository');
    }
    console.log('');
    
    // Session state
    console.log(`  Files:     ${session.openFiles.length} in context`);
    
    // Current task
    if (session.currentIntent) {
      const truncated = session.currentIntent.length > 50 
        ? session.currentIntent.substring(0, 50) + '...' 
        : session.currentIntent;
      console.log(`  Task:      ${truncated}`);
    } else {
      console.log(`  Task:      none`);
    }
    
    // Plan status
    if (session.lastPlan && session.lastPlan.length > 0) {
      console.log(`  Plan:      ${session.lastPlan.length} step(s)`);
    } else {
      console.log(`  Plan:      none`);
    }
    
    // Pending changes
    if (session.pendingActions) {
      const fileCount = (session.pendingActions.files?.length || 0);
      const diffCount = (session.pendingActions.diffs?.length || 0);
      console.log(`  Pending:   ${fileCount + diffCount} change(s)`);
    } else {
      console.log(`  Pending:   none`);
    }
    
    console.log(`  Undo:      ${undoCount} operation(s) in stack`);
    console.log('');
    
    // Suggestions based on state
    if (session.pendingActions || session.lastDiff) {
      console.log(hint('/diff to review, /apply to execute'));
    } else if (session.lastPlan && session.lastPlan.length > 0) {
      console.log(hint('/generate to create changes'));
    } else if (session.currentIntent) {
      console.log(hint('/plan to create execution plan'));
    } else {
      console.log(hint('Type a task to get started'));
    }
  },
  
  // YOLO mode shortcut
  yolo: () => {
    setMode('auto');
    console.log(success('⚡ YOLO mode activated!'));
    console.log(dim('Tasks will execute directly without confirmation.'));
    console.log(hint('Type a task or use /run <task>'));
  },
  
  // Quick mode switches
  edit: () => {
    setMode('edit');
    console.log(success('Edit mode activated'));
    console.log(hint('Type a task, then /plan → /generate → /diff → /apply'));
  },
  
  debug: () => {
    setMode('debug');
    console.log(success('🔧 Debug mode activated'));
    console.log(hint('Describe the bug or use /fix <description>'));
  },
  
  review: () => {
    setMode('review');
    console.log(success('👁 Review mode activated'));
    console.log(hint('Ask for code review or analysis'));
  },
  
  explain: () => {
    setMode('explain');
    console.log(success('📖 Explain mode activated'));
    console.log(hint('Ask about code concepts'));
  },
  reset: () => {
    resetSession();
    clearUndoHistory();
    console.log('Reset.');
  },
  settings: async (ctx) => {
    if (ctx.args.length === 0) {
      // Open interactive menu
      await openSettingsMenu();
      return;
    }

    // Check for --project flag
    if (ctx.args[0] === '--project') {
      if (hasProjectSettings()) {
        console.log('Project settings active: .zai/settings.json');
      } else {
        console.log('No project settings. Using global settings.');
      }
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
    const success = setNestedSetting(key, value);

    if (success) {
      console.log(`Set ${key} = ${value}`);
    } else {
      console.log(error(`Invalid: ${key} = ${value}`));
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
    const filePath = ctx.args[0];
    if (!filePath) {
      console.log('Usage: /open <path>');
      return;
    }
    
    const session = getSession();
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(session.workingDirectory, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(error(`File not found: ${filePath}`));
      return;
    }
    
    addOpenFile(filePath);
    console.log(success(`Added to context: ${filePath}`));
  },
  
  // Read/view file contents
  read: (ctx) => {
    const filePath = ctx.args[0];
    if (!filePath) {
      console.log('Usage: /read <path> [lines]');
      return;
    }
    
    const session = getSession();
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(session.workingDirectory, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(error(`File not found: ${filePath}`));
      return;
    }
    
    const maxLines = ctx.args[1] ? parseInt(ctx.args[1], 10) : 50;
    const content = getFileContent(fullPath, 100000);
    
    if (!content) {
      console.log(error('File too large or unreadable'));
      return;
    }
    
    const lines = content.split('\n');
    const displayLines = lines.slice(0, maxLines);
    
    console.log(dim(`--- ${filePath} (${lines.length} lines) ---`));
    displayLines.forEach((line, i) => {
      console.log(`${String(i + 1).padStart(4)} | ${line}`);
    });
    
    if (lines.length > maxLines) {
      console.log(dim(`... ${lines.length - maxLines} more lines`));
    }
  },
  
  // Cat file (alias for read, full content)
  cat: (ctx) => {
    const filePath = ctx.args[0];
    if (!filePath) {
      console.log('Usage: /cat <path>');
      return;
    }
    
    const session = getSession();
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(session.workingDirectory, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(error(`File not found: ${filePath}`));
      return;
    }
    
    const content = getFileContent(fullPath, 500000);
    
    if (!content) {
      console.log(error('File too large or unreadable'));
      return;
    }
    
    console.log(content);
  },
  mode: (ctx) => {
    const newMode = ctx.args[0]?.toLowerCase();
    const validModes = ['auto', 'edit', 'ask', 'explain', 'review', 'debug'];

    if (!newMode) {
      const session = getSession();
      console.log(`Current mode: ${session.mode}`);
      console.log('Available modes: auto (YOLO), edit, ask, explain, review, debug');
      return;
    }

    if (!validModes.includes(newMode)) {
      console.log(`Invalid mode: ${newMode}`);
      console.log('Available modes: auto (YOLO), edit, ask, explain, review, debug');
      return;
    }

    setMode(newMode as SessionMode);
    if (newMode === 'auto') {
      console.log(success('YOLO mode enabled - executing tasks directly without confirmations'));
    } else {
      console.log(success(`Mode set to: ${newMode}`));
    }
  },
  ask: () => {
    setMode('ask');
    console.log(success('Switched to ask mode (read-only, questions only)'));
    console.log(hint('Type your question. Use /mode edit to switch back.'));
  },
  model: (ctx) => {
    const subcommand = ctx.args[0]?.toLowerCase();
    const currentModel = getModel();

    // /model - show current
    if (!subcommand) {
      console.log(`Current model: ${currentModel}`);
      return;
    }

    // /model list - show all
    if (subcommand === 'list') {
      console.log('Available models:');
      for (const m of ZAI_MODELS) {
        const marker = m.id === currentModel ? '*' : ' ';
        console.log(`  ${marker} ${m.id.padEnd(10)} (${m.description})`);
      }
      console.log('');
      console.log(`Current: ${currentModel}`);
      return;
    }

    // /model set <id> - change model
    if (subcommand === 'set') {
      const modelId = ctx.args[1];
      if (!modelId) {
        console.log('Usage: /model set <model-id>');
        console.log('Run /model list to see available models.');
        return;
      }

      if (!AVAILABLE_MODELS.includes(modelId)) {
        console.log(error(`Invalid model: ${modelId}`));
        console.log('Run /model list to see available models.');
        return;
      }

      setModel(modelId);
      console.log(success(`Model set: ${modelId}`));
      return;
    }

    // Unknown subcommand
    console.log('Usage: /model [list | set <model-id>]');
  },
  plan: async () => {
    const intent = getIntent();
    if (!intent) {
      console.log(error('No task set. Type a task first, then use /plan.'));
      console.log(hint('Example: "add error handling to auth.ts"'));
      return;
    }
    
    console.log(info(`Planning: ${intent.substring(0, 50)}${intent.length > 50 ? '...' : ''}`));
    
    try {
      const result = await runPlannerLoop();

      if (!result.success) {
        console.log(error(result.message));
        return;
      }

      console.log(success('Plan generated.'));
      if (result.plan && result.plan.length > 0) {
        console.log(`Steps (${result.plan.length}):`);
        for (const step of result.plan) {
          console.log(`  ${step.id}. ${step.description}`);
        }
      }
      console.log(hint('/generate to create changes'));
    } catch (e: any) {
      console.log(error(`Planning failed: ${e?.message || e}`));
    }
  },
  generate: async () => {
    const session = getSession();
    if (!session.lastPlan || session.lastPlan.length === 0) {
      console.log(error('No plan exists. Use /plan first.'));
      return;
    }
    
    console.log(info('Generating changes...'));
    
    try {
      const result = await runGenerateLoop();

      if (!result.success) {
        console.log(error(result.message));
        return;
      }

      console.log(success('Changes generated.'));
      const fileCount = (result.changes?.files?.length || 0) + (result.changes?.diffs?.length || 0);
      if (fileCount > 0) {
        console.log(`Files affected: ${fileCount}`);
        if (result.changes?.files) {
          for (const f of result.changes.files) {
            console.log(`  ${f.operation}: ${f.path}`);
          }
        }
      }
      console.log(hint('/diff to review, /apply to execute'));
    } catch (e: any) {
      console.log(error(`Generation failed: ${e?.message || e}`));
    }
  },
  diff: (ctx) => {
    const session = getSession();

    // Check if there's a diff to display
    if (!session.lastDiff) {
      console.log('Nothing to review.');
      return;
    }

    const response = session.lastDiff;
    const showFull = ctx.args[0] === 'full';

    // Display file operations if present
    if (response.files && response.files.length > 0) {
      for (const file of response.files) {
        const opColor = file.operation === 'create' ? '\x1b[32m' : 
                        file.operation === 'delete' ? '\x1b[31m' : '\x1b[33m';
        const reset = '\x1b[0m';
        
        console.log(`${opColor}--- ${file.operation.toUpperCase()}: ${file.path} ---${reset}`);
        
        if (file.content && file.operation !== 'delete') {
          const lines = file.content.split('\n');
          const maxLines = showFull ? lines.length : 50;
          
          for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
            const lineNum = String(i + 1).padStart(4);
            const prefix = file.operation === 'create' ? '\x1b[32m+' : ' ';
            console.log(`${prefix}${lineNum} | ${lines[i]}${reset}`);
          }
          
          if (lines.length > maxLines) {
            console.log(dim(`... ${lines.length - maxLines} more lines (use /diff full to see all)`));
          }
        }
        console.log('');
      }
    }

    // Display diffs if present
    if (response.diffs && response.diffs.length > 0) {
      for (const diff of response.diffs) {
        console.log(`\x1b[33m--- MODIFY: ${diff.file} ---\x1b[0m`);
        for (const hunk of diff.hunks) {
          console.log(`\x1b[36m@@ lines ${hunk.start}-${hunk.end} @@\x1b[0m`);
          const lines = hunk.content.split('\n');
          for (const line of lines) {
            if (line.startsWith('+')) {
              console.log(`\x1b[32m${line}\x1b[0m`);
            } else if (line.startsWith('-')) {
              console.log(`\x1b[31m${line}\x1b[0m`);
            } else {
              console.log(line);
            }
          }
        }
        console.log('');
      }
    }

    // Summary
    const fileCount = (response.files?.length || 0);
    const diffCount = (response.diffs?.length || 0);
    
    if (fileCount === 0 && diffCount === 0) {
      console.log('No file changes in last response.');
      return;
    }
    
    console.log(dim(`Total: ${fileCount} file operation(s), ${diffCount} diff(s)`));
    console.log(hint('/apply to execute changes'));
  },
  apply: (ctx) => {
    const session = getSession();
    const force = ctx.args[0] === '--force' || ctx.args[0] === '-f';

    // Check dry run mode
    if (session.dryRun && !force) {
      console.log(error('Dry-run mode. Apply blocked.'));
      console.log(hint('/dry-run off or /apply --force'));
      return;
    }

    // Warn on dirty git
    const gitInfo = getGitInfo(session.workingDirectory);
    if (gitInfo.isRepo && gitInfo.isDirty && !force) {
      console.log(info('Warning: uncommitted git changes exist.'));
      console.log(hint('Consider committing first, or use /apply --force'));
    }

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
    const fileCount = (actions.files?.length || 0);
    const diffCount = (actions.diffs?.length || 0);
    
    if (fileCount === 0 && diffCount === 0) {
      console.log('No file changes to apply.');
      return;
    }

    console.log(info(`Applying ${fileCount + diffCount} change(s)...`));

    // Apply using the apply engine
    const result = applyResponse(actions, {
      basePath: session.workingDirectory,
      dryRun: false,
    });

    // Show results
    for (const applied of result.applied) {
      console.log(success(`  ${applied}`));
    }
    
    for (const failed of result.failed) {
      console.log(error(`  Failed: ${failed.path}: ${failed.error}`));
    }

    if (!result.success) {
      console.log(error(`\nSome operations failed. Use /undo to rollback.`));
      return;
    }

    // Clear pending actions after success
    setPendingActions(null);
    setLastDiff(null);
    clearIntent();
    setLastPlan(null);

    console.log('');
    console.log(success(`Applied ${result.applied.length} change(s) successfully.`));
    console.log(hint('/undo to rollback'));
    
    // Log to history
    if (session.currentIntent) {
      logTask({
        timestamp: new Date().toISOString(),
        intent: session.currentIntent,
        intentType: session.intentType || 'COMMAND',
        mode: session.mode,
        model: getModel(),
        filesCount: result.applied.length,
        outcome: 'success',
      });
    }
  },
  workspace: () => {
    const ws = getWorkspace();
    ws.indexFileTree();
    console.log(ws.printTreeSummary());
    console.log(`Root: ${ws.getRoot()}`);
  },
  
  // Tree view of workspace
  tree: (ctx) => {
    const maxDepth = ctx.args[0] ? parseInt(ctx.args[0], 10) : 3;
    const session = getSession();
    const ws = getWorkspace(session.workingDirectory);
    const tree = ws.indexFileTree(maxDepth);
    
    function printTree(node: any, prefix: string = '', isLast: boolean = true): void {
      const connector = isLast ? '└── ' : '├── ';
      const extension = isLast ? '    ' : '│   ';
      
      if (node.path !== '.') {
        const icon = node.type === 'directory' ? '📁' : '📄';
        console.log(`${prefix}${connector}${icon} ${node.name}`);
      }
      
      if (node.children) {
        const children = node.children;
        children.forEach((child: any, index: number) => {
          const childIsLast = index === children.length - 1;
          const newPrefix = node.path === '.' ? '' : prefix + extension;
          printTree(child, newPrefix, childIsLast);
        });
      }
    }
    
    console.log(dim(`${session.workingDirectory}`));
    printTree(tree);
  },
  
  // List files matching pattern
  ls: (ctx) => {
    const pattern = ctx.args[0] || '.';
    const session = getSession();
    const targetPath = path.isAbsolute(pattern) ? pattern : path.join(session.workingDirectory, pattern);
    
    try {
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        const entries = fs.readdirSync(targetPath, { withFileTypes: true });
        for (const entry of entries) {
          const icon = entry.isDirectory() ? '📁' : '📄';
          const size = entry.isFile() ? ` (${fs.statSync(path.join(targetPath, entry.name)).size} bytes)` : '';
          console.log(`${icon} ${entry.name}${size}`);
        }
      } else {
        console.log(`${pattern}: ${stats.size} bytes`);
      }
    } catch (e: any) {
      console.log(error(`Cannot access: ${pattern}`));
    }
  },
  doctor: async () => {
    const { runDiagnostics, formatDiagnostics } = await import('./doctor');
    const results = await runDiagnostics();
    console.log(formatDiagnostics(results));
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
    console.log(hint('/step'));
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
    console.log(hint('/generate'));
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
  history: (ctx) => {
    const subcommand = ctx.args[0];

    if (subcommand === 'clear') {
      clearHistory();
      console.log('History cleared.');
      return;
    }

    if (subcommand === 'last') {
      const last = getLastEntry();
      if (!last) {
        console.log('No history.');
        return;
      }
      console.log(`${last.timestamp}`);
      console.log(`  Intent: ${last.intent}`);
      console.log(`  Type: ${last.intentType}`);
      console.log(`  Outcome: ${last.outcome}`);
      return;
    }

    const entries = getTaskHistory(10);
    if (entries.length === 0) {
      console.log('No history.');
      return;
    }

    console.log('Recent tasks:');
    for (const e of entries) {
      const ts = e.timestamp.split('T')[0];
      const outcome = e.outcome === 'success' ? '+' : e.outcome === 'failed' ? 'x' : '-';
      console.log(`  [${outcome}] ${ts} ${e.intent.substring(0, 40)}`);
    }
  },
  'undo-history': () => {
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
  profile: (ctx) => {
    const subcommand = ctx.args[0];

    if (!subcommand || subcommand === 'list') {
      const profiles = listProfiles();
      const active = getActiveProfileName();
      console.log('Profiles:');
      for (const p of profiles) {
        const marker = p.name === active ? '*' : ' ';
        console.log(`  ${marker} ${p.name} - ${p.description}`);
      }
      return;
    }

    if (subcommand === 'set') {
      const name = ctx.args[1];
      if (!name) {
        console.log('Usage: /profile set <name>');
        return;
      }
      if (applyProfile(name)) {
        console.log(success(`Profile set: ${name}`));
      } else {
        console.log(error(`Unknown profile: ${name}`));
      }
      return;
    }

    console.log('Usage: /profile [list | set <name>]');
  },
  'dry-run': (ctx) => {
    const arg = ctx.args[0]?.toLowerCase();

    if (!arg) {
      const current = isDryRun();
      console.log(`Dry-run: ${current ? 'on' : 'off'}`);
      return;
    }

    if (arg === 'on') {
      setDryRun(true);
      console.log('Dry-run enabled. Apply will be blocked.');
    } else if (arg === 'off') {
      setDryRun(false);
      console.log('Dry-run disabled.');
    } else {
      console.log('Usage: /dry-run [on | off]');
    }
  },
  git: (ctx) => {
    const session = getSession();
    const gitInfo = getGitInfo(session.workingDirectory);
    const subcommand = ctx.args[0];

    if (!gitInfo.isRepo) {
      console.log('Not a git repository.');
      return;
    }

    // /git status (default)
    if (!subcommand || subcommand === 'status') {
      console.log(`Repository: ${gitInfo.repoName}`);
      console.log(`Branch: ${gitInfo.branch}`);
      console.log(`Status: ${gitInfo.isDirty ? 'dirty' : 'clean'}`);
      if (gitInfo.uncommittedFiles > 0) {
        console.log(`Uncommitted files: ${gitInfo.uncommittedFiles}`);
        
        // Show changed files
        try {
          const { execSync } = require('child_process');
          const status = execSync('git status --porcelain', { 
            cwd: session.workingDirectory, 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          const lines = status.trim().split('\n').filter((l: string) => l);
          for (const line of lines.slice(0, 10)) {
            const status = line.substring(0, 2);
            const file = line.substring(3);
            const statusColor = status.includes('M') ? '\x1b[33m' : 
                               status.includes('A') ? '\x1b[32m' :
                               status.includes('D') ? '\x1b[31m' : '\x1b[36m';
            console.log(`  ${statusColor}${status}\x1b[0m ${file}`);
          }
          if (lines.length > 10) {
            console.log(dim(`  ... and ${lines.length - 10} more`));
          }
        } catch {
          // Ignore
        }
      }
      return;
    }

    // /git log
    if (subcommand === 'log') {
      try {
        const { execSync } = require('child_process');
        const log = execSync('git log --oneline -10', { 
          cwd: session.workingDirectory, 
          encoding: 'utf-8' 
        });
        console.log('Recent commits:');
        console.log(log);
      } catch (e: any) {
        console.log(error('Failed to get git log'));
      }
      return;
    }

    // /git diff
    if (subcommand === 'diff') {
      try {
        const { execSync } = require('child_process');
        const diff = execSync('git diff --stat', { 
          cwd: session.workingDirectory, 
          encoding: 'utf-8' 
        });
        if (diff.trim()) {
          console.log(diff);
        } else {
          console.log('No unstaged changes.');
        }
      } catch (e: any) {
        console.log(error('Failed to get git diff'));
      }
      return;
    }

    // /git stash
    if (subcommand === 'stash') {
      try {
        const { execSync } = require('child_process');
        execSync('git stash', { cwd: session.workingDirectory, stdio: 'pipe' });
        console.log(success('Changes stashed'));
      } catch (e: any) {
        console.log(error('Failed to stash'));
      }
      return;
    }

    // /git pop
    if (subcommand === 'pop') {
      try {
        const { execSync } = require('child_process');
        execSync('git stash pop', { cwd: session.workingDirectory, stdio: 'pipe' });
        console.log(success('Stash popped'));
      } catch (e: any) {
        console.log(error('Failed to pop stash'));
      }
      return;
    }

    console.log('Usage: /git [status|log|diff|stash|pop]');
  },
  
  // Create new file
  touch: (ctx) => {
    const filePath = ctx.args[0];
    if (!filePath) {
      console.log('Usage: /touch <path>');
      return;
    }
    
    const session = getSession();
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(session.workingDirectory, filePath);
    
    if (fs.existsSync(fullPath)) {
      console.log(error(`File already exists: ${filePath}`));
      return;
    }
    
    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, '', 'utf-8');
      console.log(success(`Created: ${filePath}`));
      addOpenFile(filePath);
    } catch (e: any) {
      console.log(error(`Failed to create: ${e?.message}`));
    }
  },
  
  // Make directory
  mkdir: (ctx) => {
    const dirPath = ctx.args[0];
    if (!dirPath) {
      console.log('Usage: /mkdir <path>');
      return;
    }
    
    const session = getSession();
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(session.workingDirectory, dirPath);
    
    if (fs.existsSync(fullPath)) {
      console.log(error(`Already exists: ${dirPath}`));
      return;
    }
    
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(success(`Created directory: ${dirPath}`));
    } catch (e: any) {
      console.log(error(`Failed to create: ${e?.message}`));
    }
  },
  
  // What now - contextual suggestions
  whatnow: () => {
    const session = getSession();
    const gitInfo = getGitInfo(session.workingDirectory);
    
    console.log('');
    console.log(info('What to do next:'));
    console.log('');
    
    // Based on current state
    if (session.pendingActions || session.lastDiff) {
      const count = (session.pendingActions?.files?.length || 0) + (session.pendingActions?.diffs?.length || 0);
      console.log(`  You have ${count} pending change(s).`);
      console.log('');
      console.log('  /diff       Review the changes');
      console.log('  /diff full  See full file contents');
      console.log('  /apply      Apply the changes');
      console.log('  /apply -f   Force apply (skip warnings)');
      console.log('  /clear      Discard and start over');
      console.log('');
    } else if (session.lastPlan && session.lastPlan.length > 0) {
      console.log(`  You have a plan with ${session.lastPlan.length} step(s).`);
      console.log('');
      console.log('  /generate   Create file changes from plan');
      console.log('  /plan       Regenerate the plan');
      console.log('  /clear      Discard and start over');
      console.log('');
    } else if (session.currentIntent) {
      console.log(`  Task: "${session.currentIntent.substring(0, 50)}..."`);
      console.log('');
      console.log('  /plan       Create execution plan');
      console.log('  /do         Plan + generate in one step');
      console.log('  /run        Plan + generate + apply (YOLO)');
      console.log('  /clear      Clear task and start over');
      console.log('');
    } else {
      console.log('  No active task. Here are some ideas:');
      console.log('');
      console.log('  Type a task naturally:');
      console.log('    "add error handling to auth.ts"');
      console.log('    "create a new React component for user profile"');
      console.log('    "fix the bug in the login function"');
      console.log('');
      console.log('  Or use quick commands:');
      console.log('    /do <task>   Plan + generate');
      console.log('    /run <task>  Full auto execution');
      console.log('    /ask <q>     Ask a question');
      console.log('    /fix <desc>  Debug an issue');
      console.log('');
    }
    
    // Git suggestions
    if (gitInfo.isRepo && gitInfo.isDirty) {
      console.log(dim(`  Git: ${gitInfo.uncommittedFiles} uncommitted file(s)`));
      console.log('  /commit     Generate AI commit message');
      console.log('  /git stash  Stash changes');
      console.log('');
    }
    
    // Mode suggestion
    if (session.mode === 'edit') {
      console.log(dim('  Tip: Use /yolo for autonomous execution'));
    }
  },
  
  // Alias for whatnow
  whatsnext: () => {
    handlers.whatnow({ args: [], rawInput: '/whatnow' });
  },
  
  // Quick examples
  examples: () => {
    console.log('');
    console.log(info('Example Tasks:'));
    console.log('');
    console.log(dim('Code Generation:'));
    console.log('  "create a REST API endpoint for user registration"');
    console.log('  "add a new React component for displaying user cards"');
    console.log('  "implement a binary search function in TypeScript"');
    console.log('');
    console.log(dim('Bug Fixes:'));
    console.log('  "fix the null pointer exception in auth.ts line 42"');
    console.log('  "the login button doesn\'t work, fix it"');
    console.log('  "users can\'t logout, investigate and fix"');
    console.log('');
    console.log(dim('Refactoring:'));
    console.log('  "refactor the database module to use async/await"');
    console.log('  "split the UserService into smaller modules"');
    console.log('  "add TypeScript types to the utils folder"');
    console.log('');
    console.log(dim('Documentation:'));
    console.log('  "add JSDoc comments to all exported functions"');
    console.log('  "create a README for the project"');
    console.log('  "document the API endpoints"');
    console.log('');
    console.log(hint('Just type naturally - zai·code understands context'));
  },
};

// Command aliases for convenience
const COMMAND_ALIASES: Record<string, string> = {
  // Single letter shortcuts
  'h': 'help',
  '?': 'help',
  'q': 'exit',
  'quit': 'exit',
  's': 'status',
  'p': 'plan',
  'g': 'generate',
  'd': 'diff',
  'a': 'apply',
  'u': 'undo',
  'c': 'context',
  'f': 'files',
  'm': 'mode',
  'r': 'run',
  'x': 'exec',
  'o': 'open',
  't': 'tree',
  'v': 'version',
  
  // Word aliases
  'gen': 'generate',
  'show': 'diff',
  'view': 'read',
  'cat': 'read',
  'ls': 'tree',
  'list': 'files',
  'add': 'open',
  'rm': 'close',
  'remove': 'close',
  'find': 'search',
  'grep': 'search',
  'auto': 'yolo',
  'quick': 'do',
  'execute': 'run',
  'rollback': 'undo',
  'revert': 'undo',
  'info': 'status',
  'state': 'status',
  'check': 'doctor',
  'health': 'doctor',
  'cfg': 'settings',
  'config': 'settings',
  'prefs': 'settings',
  'preferences': 'settings',
};

// Execute a parsed slash command
export async function executeCommand(parsed: ParsedCommand): Promise<boolean> {
  if (!parsed.isSlashCommand || !parsed.command) {
    return false;
  }

  // Resolve alias
  const command = COMMAND_ALIASES[parsed.command] || parsed.command;

  const handler = handlers[command];
  if (!handler) {
    // Check for partial match
    const matches = Object.keys(handlers).filter(h => h.startsWith(parsed.command!));
    if (matches.length === 1) {
      await handlers[matches[0]]({ args: parsed.args || [], rawInput: parsed.rawInput });
      return true;
    } else if (matches.length > 1) {
      console.log(`Ambiguous command: /${parsed.command}`);
      console.log(`Did you mean: ${matches.map(m => '/' + m).join(', ')}?`);
      return true;
    }
    
    console.log(`Unknown command: /${parsed.command}`);
    console.log(dim('Run /help for available commands'));
    return true;
  }

  await handler({ args: parsed.args || [], rawInput: parsed.rawInput });
  return true;
}

// Get list of available commands
export function getAvailableCommands(): string[] {
  return Object.keys(handlers);
}
