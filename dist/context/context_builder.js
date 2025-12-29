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
exports.MAX_FILES = exports.MAX_FILE_SIZE = exports.MAX_CONTEXT_TOKENS = void 0;
exports.indexWorkspace = indexWorkspace;
exports.scoreFileRelevance = scoreFileRelevance;
exports.summarizeFile = summarizeFile;
exports.buildContext = buildContext;
exports.formatContextForModel = formatContextForModel;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Context size limits
const MAX_CONTEXT_TOKENS = 50000; // Approximate max tokens
exports.MAX_CONTEXT_TOKENS = MAX_CONTEXT_TOKENS;
const MAX_FILE_SIZE = 50000; // Max bytes per file
exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
const MAX_FILES = 50; // Max files to include
exports.MAX_FILES = MAX_FILES;
const CHARS_PER_TOKEN = 4; // Approximate chars per token
// File extensions by priority
const EXTENSION_PRIORITY = {
    '.ts': 10,
    '.tsx': 10,
    '.js': 9,
    '.jsx': 9,
    '.py': 9,
    '.go': 9,
    '.rs': 9,
    '.java': 8,
    '.c': 8,
    '.cpp': 8,
    '.h': 7,
    '.hpp': 7,
    '.json': 6,
    '.yaml': 6,
    '.yml': 6,
    '.toml': 6,
    '.md': 5,
    '.txt': 4,
    '.css': 4,
    '.scss': 4,
    '.html': 4,
    '.sql': 5,
    '.sh': 5,
    '.bash': 5,
};
// Directories to always skip
const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    'out',
    'target',
    '__pycache__',
    '.cache',
    '.next',
    '.nuxt',
    'vendor',
    'coverage',
    '.nyc_output',
]);
// Files to always skip
const SKIP_FILES = new Set([
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'Gemfile.lock',
    'Cargo.lock',
    'go.sum',
]);
// Index workspace and return file list with metadata
function indexWorkspace(rootPath) {
    const files = [];
    function walk(dir, depth = 0) {
        if (depth > 10)
            return; // Max depth
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(rootPath, fullPath);
                if (entry.isDirectory()) {
                    if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                        walk(fullPath, depth + 1);
                    }
                }
                else if (entry.isFile()) {
                    if (SKIP_FILES.has(entry.name))
                        continue;
                    try {
                        const stats = fs.statSync(fullPath);
                        const ext = path.extname(entry.name).toLowerCase();
                        // Skip binary and very large files
                        if (stats.size > MAX_FILE_SIZE * 2)
                            continue;
                        const priority = EXTENSION_PRIORITY[ext] || 1;
                        // Score based on extension priority and inverse of depth
                        const score = priority * (10 - Math.min(depth, 9));
                        files.push({
                            path: relativePath,
                            score,
                            size: stats.size,
                            extension: ext,
                        });
                    }
                    catch {
                        // Skip files we can't stat
                    }
                }
            }
        }
        catch {
            // Skip directories we can't read
        }
    }
    walk(rootPath);
    return files;
}
// Score file relevance to a task
function scoreFileRelevance(file, intent, intentType) {
    let score = file.score;
    const intentLower = intent.toLowerCase();
    const pathLower = file.path.toLowerCase();
    // Boost if path contains words from intent
    const intentWords = intentLower.split(/\s+/).filter(w => w.length > 3);
    for (const word of intentWords) {
        if (pathLower.includes(word)) {
            score += 5;
        }
    }
    // Boost based on intent type
    switch (intentType) {
        case 'DEBUG':
            // Prefer test files and error-related files
            if (pathLower.includes('test') || pathLower.includes('spec')) {
                score += 3;
            }
            if (pathLower.includes('error') || pathLower.includes('exception')) {
                score += 3;
            }
            break;
        case 'REFACTOR':
            // Prefer main source files
            if (pathLower.includes('src/') || pathLower.includes('lib/')) {
                score += 3;
            }
            break;
        case 'REVIEW':
            // Prefer config and doc files
            if (file.extension === '.md' || file.extension === '.json') {
                score += 2;
            }
            break;
    }
    // Penalize very large files
    if (file.size > 10000) {
        score -= 2;
    }
    if (file.size > 30000) {
        score -= 3;
    }
    return score;
}
// Summarize a large file to fit in context
function summarizeFile(content, maxChars) {
    if (content.length <= maxChars) {
        return { summary: content, truncated: false };
    }
    // Include first portion and last portion
    const headSize = Math.floor(maxChars * 0.7);
    const tailSize = Math.floor(maxChars * 0.2);
    const head = content.slice(0, headSize);
    const tail = content.slice(-tailSize);
    const summary = `${head}\n\n... [${content.length - headSize - tailSize} chars truncated] ...\n\n${tail}`;
    return { summary, truncated: true };
}
// Build context for a task
function buildContext(rootPath, intent, intentType, additionalFiles = []) {
    // Index workspace
    const allFiles = indexWorkspace(rootPath);
    // Score files by relevance
    const scoredFiles = allFiles.map(f => ({
        ...f,
        relevanceScore: scoreFileRelevance(f, intent, intentType),
    }));
    // Sort by relevance score descending
    scoredFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    // Add additional files with high priority
    const additionalSet = new Set(additionalFiles.map(f => path.relative(rootPath, f)));
    // Select files within token budget
    const result = {
        files: [],
        totalTokens: 0,
        fileCount: 0,
        truncatedCount: 0,
    };
    const maxChars = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;
    let currentChars = 0;
    // First, add explicitly requested files
    for (const relPath of additionalSet) {
        const fullPath = path.join(rootPath, relPath);
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const { summary, truncated } = summarizeFile(content, Math.min(content.length, MAX_FILE_SIZE));
            if (currentChars + summary.length > maxChars)
                break;
            result.files.push({
                path: relPath,
                content: summary,
                truncated,
            });
            currentChars += summary.length;
            result.fileCount++;
            if (truncated)
                result.truncatedCount++;
        }
        catch {
            // Skip files we can't read
        }
    }
    // Then add scored files
    for (const file of scoredFiles) {
        if (result.fileCount >= MAX_FILES)
            break;
        if (currentChars >= maxChars)
            break;
        if (additionalSet.has(file.path))
            continue;
        const fullPath = path.join(rootPath, file.path);
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const maxFileChars = Math.min(MAX_FILE_SIZE, Math.floor((maxChars - currentChars) / 2) // Leave room for other files
            );
            const { summary, truncated } = summarizeFile(content, maxFileChars);
            if (currentChars + summary.length > maxChars)
                break;
            result.files.push({
                path: file.path,
                content: summary,
                truncated,
            });
            currentChars += summary.length;
            result.fileCount++;
            if (truncated)
                result.truncatedCount++;
        }
        catch {
            // Skip files we can't read
        }
    }
    result.totalTokens = Math.ceil(currentChars / CHARS_PER_TOKEN);
    return result;
}
// Format context for model input
function formatContextForModel(context) {
    if (context.files.length === 0) {
        return 'No files in context.';
    }
    let output = `Context: ${context.fileCount} files (~${context.totalTokens} tokens)`;
    if (context.truncatedCount > 0) {
        output += ` [${context.truncatedCount} truncated]`;
    }
    output += '\n\n';
    for (const file of context.files) {
        output += `--- ${file.path}${file.truncated ? ' [truncated]' : ''} ---\n`;
        output += file.content;
        output += '\n\n';
    }
    return output;
}
//# sourceMappingURL=context_builder.js.map