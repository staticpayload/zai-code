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
exports.getGitInfo = getGitInfo;
exports.formatGitStatus = formatGitStatus;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
function getGitInfo(cwd) {
    const result = {
        isRepo: false,
        branch: null,
        isDirty: false,
        uncommittedFiles: 0,
        repoName: null,
    };
    try {
        // Check if git repo
        (0, child_process_1.execSync)('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
        result.isRepo = true;
        // Get repo name from remote or folder
        try {
            const remote = (0, child_process_1.execSync)('git remote get-url origin', { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim();
            const match = remote.match(/\/([^\/]+?)(\.git)?$/);
            result.repoName = match ? match[1] : path.basename(cwd);
        }
        catch {
            result.repoName = path.basename(cwd);
        }
        // Get branch
        try {
            result.branch = (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim();
        }
        catch {
            result.branch = 'unknown';
        }
        // Check dirty state
        try {
            const status = (0, child_process_1.execSync)('git status --porcelain', { cwd, stdio: 'pipe', encoding: 'utf-8' });
            const lines = status.trim().split('\n').filter(l => l.length > 0);
            result.uncommittedFiles = lines.length;
            result.isDirty = lines.length > 0;
        }
        catch {
            // Ignore
        }
    }
    catch {
        // Not a git repo
    }
    return result;
}
function formatGitStatus(info) {
    if (!info.isRepo)
        return 'no git';
    const dirty = info.isDirty ? '*' : '';
    return `${info.repoName || 'repo'}:${info.branch}${dirty}`;
}
//# sourceMappingURL=git.js.map