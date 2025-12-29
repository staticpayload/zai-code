#!/usr/bin/env node
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
const tui_1 = require("./tui");
const auth_1 = require("./auth");
const runtime_1 = require("./runtime");
const apply_1 = require("./apply");
const workspace_1 = require("./workspace");
const session_1 = require("./session");
const workspace_model_1 = require("./workspace_model");
const settings_1 = require("./settings");
const path = __importStar(require("path"));
async function handleDefault() {
    await (0, auth_1.ensureAuthenticated)();
    const session = (0, session_1.getSession)();
    const ws = (0, workspace_model_1.getWorkspace)(session.workingDirectory);
    // Restore previous session
    const restored = ws.restoreState();
    // Mark first run complete
    if ((0, settings_1.isFirstRun)()) {
        (0, settings_1.markFirstRunComplete)();
    }
    // Launch blessed TUI
    await (0, tui_1.startTUI)({
        projectName: path.basename(session.workingDirectory),
        restored,
        onExit: () => {
            ws.saveState();
        },
    });
}
async function handleRun() {
    const apiKey = await (0, auth_1.ensureAuthenticated)();
    console.log('Z.ai runtime engaged');
    const cwd = process.cwd();
    const workspace = (0, workspace_1.collectWorkspace)(cwd);
    const contextString = (0, workspace_1.buildContextString)(workspace, false);
    console.log('Workspace analyzed');
    const instruction = process.argv.slice(3).join(' ');
    if (!instruction) {
        console.log('No instruction provided');
        process.exit(1);
    }
    const result = await (0, runtime_1.execute)({
        instruction,
        context: `Working directory: ${cwd}\n\n${contextString}`,
    }, apiKey);
    if (!result.success) {
        console.log(`Error: ${result.error}`);
        process.exit(1);
    }
    const response = result.output;
    if (response.files || response.diffs) {
        const applyResult = (0, apply_1.applyResponse)(response, { basePath: cwd });
        if (!applyResult.success) {
            for (const failed of applyResult.failed) {
                console.log(`Failed: ${failed.path}: ${failed.error}`);
            }
            process.exit(1);
        }
    }
    console.log('Execution complete');
}
async function handleAuth() {
    await (0, auth_1.runOnboarding)();
    console.log("Re-authentication complete");
}
async function handleDoctor() {
    const { runDiagnostics, formatDiagnostics } = await Promise.resolve().then(() => __importStar(require('./doctor')));
    const results = await runDiagnostics();
    console.log(formatDiagnostics(results));
}
function handleHelp() {
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
function handleVersion() {
    const pkg = require('../package.json');
    console.log(`zai-code v${pkg.version}`);
}
const commands = {
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
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        await handleDefault();
        return;
    }
    const command = args[0];
    const handler = commands[command];
    if (handler) {
        await handler();
    }
    else {
        console.log(`Unknown command: ${command}`);
        console.log(`Run 'zcode --help' for usage information.`);
    }
}
main();
//# sourceMappingURL=cli.js.map