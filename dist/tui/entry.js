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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTUI = startTUI;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const App_1 = require("./App");
const orchestrator_1 = require("../orchestrator");
const session_1 = require("../session");
const workspace_model_1 = require("../workspace_model");
const auth_1 = require("../auth");
const path = __importStar(require("path"));
// Capture console.log output for TUI
let pendingOutput = [];
const originalLog = console.log;
function captureLog(type) {
    return (...args) => {
        const text = args.map(a => String(a)).join(' ');
        pendingOutput.push({ type, text });
    };
}
// Process input and return output lines
async function processInput(input) {
    pendingOutput = [];
    // Temporarily override console.log
    console.log = captureLog('plain');
    try {
        await (0, orchestrator_1.orchestrate)(input);
    }
    catch (e) {
        pendingOutput.push({ type: 'error', text: String(e) });
    }
    // Restore console.log
    console.log = originalLog;
    return pendingOutput;
}
async function startTUI() {
    await (0, auth_1.ensureAuthenticated)();
    const session = (0, session_1.getSession)();
    const ws = (0, workspace_model_1.getWorkspace)(session.workingDirectory);
    // Restore session
    ws.restoreState();
    const projectName = path.basename(session.workingDirectory);
    const { waitUntilExit } = (0, ink_1.render)(react_1.default.createElement(App_1.App, { projectName: projectName, workingDirectory: session.workingDirectory, onCommand: processInput, onExit: () => {
            ws.saveState();
        } }));
    await waitUntilExit();
}
//# sourceMappingURL=entry.js.map