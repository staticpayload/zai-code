#!/usr/bin/env node

import { startTUI } from './tui';
import { ensureAuthenticated, runOnboarding } from './auth';
import { execute, ResponseSchema } from './runtime';
import { applyResponse } from './apply';
import { collectWorkspace, buildContextString } from './workspace';
import { getSession } from './session';
import { getWorkspace } from './workspace_model';
import { markFirstRunComplete, isFirstRun } from './settings';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

type CommandHandler = () => void | Promise<void>;

interface Commands {
  [name: string]: CommandHandler;
}

async function handleDefault(): Promise<void> {
  await ensureAuthenticated();

  const session = getSession();
  const ws = getWorkspace(session.workingDirectory);

  // Restore previous session
  const restored = ws.restoreState();

  // Mark first run complete
  if (isFirstRun()) {
    markFirstRunComplete();
  }

  // Launch blessed TUI
  await startTUI({
    projectName: path.basename(session.workingDirectory),
    restored,
    onExit: () => {
      ws.saveState();
    },
  });
}

async function handleRun(): Promise<void> {
  const apiKey = await ensureAuthenticated();

  console.log('Z.ai runtime engaged');

  const cwd = process.cwd();
  const workspace = collectWorkspace(cwd);
  const contextString = buildContextString(workspace, false);

  console.log('Workspace analyzed');

  const instruction = process.argv.slice(3).join(' ');

  if (!instruction) {
    console.log('No instruction provided');
    process.exit(1);
  }

  const result = await execute(
    {
      instruction,
      context: `Working directory: ${cwd}\n\n${contextString}`,
    },
    apiKey
  );

  if (!result.success) {
    console.log(`Error: ${result.error}`);
    process.exit(1);
  }

  const response = result.output as ResponseSchema;
  if (response.files || response.diffs) {
    const applyResult = applyResponse(response, { basePath: cwd });
    if (!applyResult.success) {
      for (const failed of applyResult.failed) {
        console.log(`Failed: ${failed.path}: ${failed.error}`);
      }
      process.exit(1);
    }
  }

  console.log('Execution complete');
}

async function handleAuth(): Promise<void> {
  await runOnboarding();
  console.log("Re-authentication complete");
}

async function handleDoctor(): Promise<void> {
  const { runDiagnostics, formatDiagnostics } = await import('./doctor');
  const results = await runDiagnostics();
  console.log(formatDiagnostics(results));
}

function handleHelp(): void {
  console.log(`
zai·code - Z.ai-native AI code editor

Usage:
  zcode                 Launch interactive TUI
  zcode run <task>      Execute a task directly
  zcode auth            Configure API key
  zcode doctor          System health check
  zcode --help, -h      Show this help

Interactive Commands:
  /help                 Show all commands
  /plan                 Generate execution plan
  /generate             Create file changes
  /diff                 Review pending changes
  /apply                Apply changes
  /undo                 Rollback last operation
  /settings             Open settings menu
  /exit                 Exit zcode

Modes:
  /mode edit            Write and modify code (default)
  /mode ask             Questions only, no changes
  /mode review          Code analysis and feedback
  /mode debug           Investigate and fix issues

Environment:
  Z_KEY                 Z.ai API key (or use 'zcode auth')

More info: https://github.com/staticpayload/zai-code
`);
}

function handleVersion(): void {
  const pkg = require('../package.json');
  console.log(`zai-code v${pkg.version}`);
}

const commands: Commands = {
  run: handleRun,
  auth: handleAuth,
  doctor: handleDoctor,
  help: handleHelp,
  '--help': handleHelp,
  '-h': handleHelp,
  version: handleVersion,
  '--version': handleVersion,
  '-v': handleVersion,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await handleDefault();
    return;
  }

  const command = args[0];
  const handler = commands[command];

  if (handler) {
    await handler();
  } else {
    console.log(`Unknown command: ${command}`);
    console.log(`Run 'zcode --help' for usage information.`);
  }
}

main();
