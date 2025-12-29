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
exports.rollbackState = void 0;
exports.createBackup = createBackup;
exports.undoLast = undoLast;
exports.undoN = undoN;
exports.getUndoHistory = getUndoHistory;
exports.getUndoCount = getUndoCount;
exports.hasUndoHistory = hasUndoHistory;
exports.clearUndoHistory = clearUndoHistory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const session_1 = require("./session");
// Global rollback state
let rollbackState = {
    entries: [],
    maxEntries: 50,
};
exports.rollbackState = rollbackState;
// Create backup before applying changes
function createBackup(filePath, operation) {
    const session = (0, session_1.getSession)();
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(session.workingDirectory, filePath);
    let originalContent = null;
    try {
        if (fs.existsSync(absolutePath)) {
            originalContent = fs.readFileSync(absolutePath, 'utf-8');
        }
    }
    catch {
        // File doesn't exist or can't be read
    }
    const entry = {
        path: absolutePath,
        operation,
        originalContent,
        timestamp: new Date().toISOString(),
    };
    // Add to stack
    rollbackState.entries.push(entry);
    // Limit stack size
    if (rollbackState.entries.length > rollbackState.maxEntries) {
        rollbackState.entries.shift();
    }
}
// Undo last operation
function undoLast() {
    if (rollbackState.entries.length === 0) {
        return { success: false, message: 'Nothing to undo.' };
    }
    const entry = rollbackState.entries.pop();
    try {
        switch (entry.operation) {
            case 'create':
                // File was created, delete it
                if (entry.originalContent === null) {
                    if (fs.existsSync(entry.path)) {
                        fs.unlinkSync(entry.path);
                        // Clean up empty parent directories
                        const dir = path.dirname(entry.path);
                        try {
                            const dirContents = fs.readdirSync(dir);
                            if (dirContents.length === 0) {
                                fs.rmdirSync(dir);
                            }
                        }
                        catch {
                            // Ignore cleanup errors
                        }
                    }
                    return { success: true, message: `Deleted: ${entry.path}`, entry };
                }
                // File existed before, restore original
                const createDir = path.dirname(entry.path);
                if (!fs.existsSync(createDir)) {
                    fs.mkdirSync(createDir, { recursive: true });
                }
                fs.writeFileSync(entry.path, entry.originalContent, 'utf-8');
                return { success: true, message: `Restored: ${entry.path}`, entry };
            case 'modify':
                // Restore original content
                if (entry.originalContent !== null) {
                    const modifyDir = path.dirname(entry.path);
                    if (!fs.existsSync(modifyDir)) {
                        fs.mkdirSync(modifyDir, { recursive: true });
                    }
                    fs.writeFileSync(entry.path, entry.originalContent, 'utf-8');
                    return { success: true, message: `Restored: ${entry.path}`, entry };
                }
                return { success: false, message: `No backup content for: ${entry.path}` };
            case 'delete':
                // File was deleted, restore it
                if (entry.originalContent !== null) {
                    const deleteDir = path.dirname(entry.path);
                    if (!fs.existsSync(deleteDir)) {
                        fs.mkdirSync(deleteDir, { recursive: true });
                    }
                    fs.writeFileSync(entry.path, entry.originalContent, 'utf-8');
                    return { success: true, message: `Restored: ${entry.path}`, entry };
                }
                return { success: false, message: `Cannot restore deleted file (no backup): ${entry.path}` };
            default:
                return { success: false, message: `Unknown operation: ${entry.operation}` };
        }
    }
    catch (err) {
        // Re-add entry if undo failed
        rollbackState.entries.push(entry);
        return { success: false, message: `Undo failed: ${err?.message || String(err)}` };
    }
}
// Undo multiple operations
function undoN(count) {
    const messages = [];
    let undone = 0;
    for (let i = 0; i < count; i++) {
        const result = undoLast();
        if (!result.success) {
            messages.push(result.message);
            break;
        }
        messages.push(result.message);
        undone++;
    }
    return { success: undone > 0, undone, messages };
}
// Get undo history
function getUndoHistory() {
    return [...rollbackState.entries];
}
// Get pending undo count
function getUndoCount() {
    return rollbackState.entries.length;
}
// Check if there are pending undos
function hasUndoHistory() {
    return rollbackState.entries.length > 0;
}
// Clear undo history
function clearUndoHistory() {
    rollbackState.entries = [];
}
//# sourceMappingURL=rollback.js.map