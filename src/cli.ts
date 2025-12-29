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
  const { hasValidCredentials } = await import('./auth');
  const hasKey = await hasValidCredentials();

  console.log('System check...');
  console.log('');
  console.log(`API key: ${hasKey ? 'configured' : 'not configured'}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}`);

  const configExists = fs.existsSync(path.join(os.homedir(), '.zai'));
  console.log(`Config dir: ${configExists ? 'exists' : 'missing'}`);

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
  console.log(`Workspace: ${writable ? 'writable' : 'read-only'}`);

  console.log('');
  const allGood = hasKey && configExists && writable;
  if (allGood) {
    console.log('All checks passed.');
  } else {
    console.log('Some checks failed.');
  }
}

const commands: Commands = {
  run: handleRun,
  auth: handleAuth,
  doctor: handleDoctor,
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
  }
}

main();
