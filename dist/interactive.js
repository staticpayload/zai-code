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
exports.startInteractive = startInteractive;
const readline = __importStar(require("readline"));
const orchestrator_1 = require("./orchestrator");
const session_1 = require("./session");
const ui_1 = require("./ui");
async function startInteractive(options) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const askQuestion = () => {
        const session = (0, session_1.getSession)();
        const currentPrompt = (0, ui_1.getPrompt)(session);
        rl.question(currentPrompt, async (input) => {
            const trimmed = input.trim();
            // Exit commands (handled before orchestrator for immediate response)
            if (trimmed === 'exit' || trimmed === 'quit' || trimmed === ':q') {
                rl.close();
                options?.onExit?.();
                return;
            }
            // Empty input - just re-prompt
            if (!trimmed) {
                askQuestion();
                return;
            }
            // Route ALL input through orchestrator
            try {
                await (0, orchestrator_1.orchestrate)(trimmed);
            }
            catch (error) {
                // Swallow errors, continue loop
            }
            // Continue loop
            askQuestion();
        });
    };
    // Handle Ctrl+C gracefully
    rl.on('close', () => {
        options?.onExit?.();
    });
    process.on('SIGINT', () => {
        rl.close();
    });
    askQuestion();
    return new Promise(() => { });
}
//# sourceMappingURL=interactive.js.map