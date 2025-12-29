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
exports.logTask = logTask;
exports.getHistory = getHistory;
exports.getLastEntry = getLastEntry;
exports.clearHistory = clearHistory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const HISTORY_FILE = path.join(os.homedir(), '.zai', 'history.log');
const MAX_ENTRIES = 100;
function ensureHistoryDir() {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function logTask(entry) {
    ensureHistoryDir();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(HISTORY_FILE, line, 'utf-8');
    // Trim if too large
    try {
        const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length > MAX_ENTRIES) {
            const trimmed = lines.slice(-MAX_ENTRIES).join('\n') + '\n';
            fs.writeFileSync(HISTORY_FILE, trimmed, 'utf-8');
        }
    }
    catch {
        // Ignore
    }
}
function getHistory(limit) {
    try {
        if (!fs.existsSync(HISTORY_FILE))
            return [];
        const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l.length > 0);
        const entries = lines.map(l => {
            try {
                return JSON.parse(l);
            }
            catch {
                return null;
            }
        }).filter(Boolean);
        const reversed = entries.reverse();
        return limit ? reversed.slice(0, limit) : reversed;
    }
    catch {
        return [];
    }
}
function getLastEntry() {
    const entries = getHistory(1);
    return entries[0] || null;
}
function clearHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            fs.unlinkSync(HISTORY_FILE);
        }
    }
    catch {
        // Ignore
    }
}
//# sourceMappingURL=history.js.map