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
exports.WORKSPACE_STATE_FILE = exports.Workspace = void 0;
exports.getWorkspace = getWorkspace;
exports.resetWorkspace = resetWorkspace;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const session_1 = require("./session");
const context_builder_1 = require("./context/context_builder");
// Workspace state file location
const WORKSPACE_STATE_FILE = '.zai/workspace.json';
exports.WORKSPACE_STATE_FILE = WORKSPACE_STATE_FILE;
// Workspace model - authoritative state
class Workspace {
    constructor(rootPath) {
        this.fileTree = null;
        this.fileIndex = [];
        this.rootPath = rootPath || process.cwd();
    }
    // Get root path
    getRoot() {
        return this.rootPath;
    }
    // Index the file tree
    indexFileTree(maxDepth = 5) {
        const buildTree = (dirPath, depth) => {
            const name = path.basename(dirPath) || dirPath;
            const relativePath = path.relative(this.rootPath, dirPath);
            const node = {
                name,
                path: relativePath || '.',
                type: 'directory',
                children: [],
            };
            if (depth >= maxDepth)
                return node;
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage']);
                for (const entry of entries) {
                    if (entry.name.startsWith('.') && entry.name !== '.zai')
                        continue;
                    if (skipDirs.has(entry.name))
                        continue;
                    const fullPath = path.join(dirPath, entry.name);
                    const relPath = path.relative(this.rootPath, fullPath);
                    if (entry.isDirectory()) {
                        node.children.push(buildTree(fullPath, depth + 1));
                    }
                    else if (entry.isFile()) {
                        try {
                            const stats = fs.statSync(fullPath);
                            node.children.push({
                                name: entry.name,
                                path: relPath,
                                type: 'file',
                                size: stats.size,
                                extension: path.extname(entry.name),
                            });
                        }
                        catch {
                            // Skip files we can't stat
                        }
                    }
                }
                // Sort: directories first, then files
                node.children.sort((a, b) => {
                    if (a.type !== b.type)
                        return a.type === 'directory' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });
            }
            catch {
                // Skip directories we can't read
            }
            return node;
        };
        this.fileTree = buildTree(this.rootPath, 0);
        this.fileIndex = (0, context_builder_1.indexWorkspace)(this.rootPath);
        return this.fileTree;
    }
    // Get file tree
    getFileTree() {
        return this.fileTree;
    }
    // Get file index
    getFileIndex() {
        return this.fileIndex;
    }
    // Get current state from session
    getCurrentState() {
        const session = (0, session_1.getSession)();
        return {
            version: 1,
            workingDirectory: session.workingDirectory,
            mode: session.mode,
            openFiles: session.openFiles,
            currentIntent: session.currentIntent,
            intentType: session.intentType,
            lastPlan: session.lastPlan,
            lastDiff: session.lastDiff,
            pendingActions: session.pendingActions,
            dryRun: session.dryRun,
            lastUpdated: new Date().toISOString(),
        };
    }
    // Save workspace state to disk
    saveState() {
        const state = this.getCurrentState();
        const statePath = path.join(this.rootPath, WORKSPACE_STATE_FILE);
        const stateDir = path.dirname(statePath);
        try {
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
        }
        catch {
            // Fail silently - state persistence is optional
        }
    }
    // Load workspace state from disk
    loadState() {
        const statePath = path.join(this.rootPath, WORKSPACE_STATE_FILE);
        try {
            if (!fs.existsSync(statePath)) {
                return null;
            }
            const content = fs.readFileSync(statePath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    // Restore session from saved state
    restoreState() {
        const state = this.loadState();
        if (!state)
            return false;
        try {
            // Restore mode
            (0, session_1.setMode)(state.mode);
            // Restore open files
            (0, session_1.clearOpenFiles)();
            for (const file of state.openFiles) {
                (0, session_1.addOpenFile)(file);
            }
            // Restore intent
            if (state.currentIntent) {
                (0, session_1.setIntent)(state.currentIntent);
            }
            if (state.intentType) {
                (0, session_1.setIntentType)(state.intentType);
            }
            // Restore plan and diff
            if (state.lastPlan) {
                (0, session_1.setLastPlan)(state.lastPlan);
            }
            if (state.lastDiff) {
                (0, session_1.setLastDiff)(state.lastDiff);
            }
            if (state.pendingActions) {
                (0, session_1.setPendingActions)(state.pendingActions);
            }
            return true;
        }
        catch {
            return false;
        }
    }
    // Clear saved state
    clearState() {
        const statePath = path.join(this.rootPath, WORKSPACE_STATE_FILE);
        try {
            if (fs.existsSync(statePath)) {
                fs.unlinkSync(statePath);
            }
        }
        catch {
            // Fail silently
        }
    }
    // Print file tree summary
    printTreeSummary() {
        if (!this.fileTree) {
            this.indexFileTree();
        }
        const countNodes = (node) => {
            if (node.type === 'file') {
                return { files: 1, dirs: 0 };
            }
            let files = 0;
            let dirs = 1;
            for (const child of node.children || []) {
                const counts = countNodes(child);
                files += counts.files;
                dirs += counts.dirs;
            }
            return { files, dirs };
        };
        const counts = countNodes(this.fileTree);
        return `Workspace: ${counts.dirs} directories, ${counts.files} files`;
    }
}
exports.Workspace = Workspace;
// Global workspace instance
let currentWorkspace = null;
// Get or create workspace
function getWorkspace(rootPath) {
    if (!currentWorkspace) {
        currentWorkspace = new Workspace(rootPath);
    }
    return currentWorkspace;
}
// Reset workspace
function resetWorkspace() {
    currentWorkspace = null;
}
//# sourceMappingURL=workspace_model.js.map