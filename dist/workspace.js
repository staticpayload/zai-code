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
exports.collectWorkspace = collectWorkspace;
exports.getFileContent = getFileContent;
exports.buildContextString = buildContextString;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css', '.html'];
const DEFAULT_MAX_FILES = 100;
const DEFAULT_MAX_FILE_SIZE = 100 * 1024;
const IGNORED_DIRS = ['node_modules', '.git', '.svn', 'dist', 'build', 'out', 'target', 'vendor', '.venv', 'venv', '__pycache__', '.next', '.nuxt'];
function shouldIgnore(dirName) {
    return IGNORED_DIRS.includes(dirName);
}
function hasAllowedExtension(filePath, extensions) {
    const ext = path.extname(filePath).toLowerCase();
    return extensions.includes(ext);
}
function collectWorkspace(rootPath, options) {
    const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
    const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const extensions = options?.extensions ?? DEFAULT_EXTENSIONS;
    const files = [];
    function walkDirectory(dir) {
        if (files.length >= maxFiles) {
            return;
        }
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (files.length >= maxFiles) {
                    break;
                }
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!shouldIgnore(entry.name)) {
                        walkDirectory(fullPath);
                    }
                }
                else if (entry.isFile()) {
                    if (hasAllowedExtension(entry.name, extensions)) {
                        try {
                            const stats = fs.statSync(fullPath);
                            if (stats.size <= maxFileSize) {
                                const relativePath = path.relative(rootPath, fullPath);
                                files.push({ path: relativePath, size: stats.size });
                            }
                        }
                        catch {
                            // Skip files that can't be read
                        }
                    }
                }
            }
        }
        catch {
            // Skip directories that can't be read
        }
    }
    walkDirectory(rootPath);
    let gitStatus;
    try {
        const gitDir = path.join(rootPath, '.git');
        if (fs.existsSync(gitDir)) {
            gitStatus = 'git';
        }
    }
    catch {
        // Not a git repo or can't check
    }
    return {
        root: rootPath,
        files,
        gitStatus,
    };
}
function getFileContent(filePath, maxSize) {
    const max = maxSize ?? DEFAULT_MAX_FILE_SIZE;
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > max) {
            return null;
        }
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
function buildContextString(workspace, includeContent) {
    let result = `Working directory: ${workspace.root}\n`;
    result += `Files (${workspace.files.length}):\n`;
    for (const file of workspace.files) {
        result += `  - ${file.path}\n`;
    }
    if (workspace.gitStatus) {
        result += `\nGit repository: ${workspace.gitStatus}\n`;
    }
    return result;
}
//# sourceMappingURL=workspace.js.map