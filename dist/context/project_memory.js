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
exports.BASE_SYSTEM_PROMPT = exports.MEMORY_FILE = void 0;
exports.loadProjectContext = loadProjectContext;
exports.saveProjectContext = saveProjectContext;
exports.appendProjectRule = appendProjectRule;
exports.getSystemPrompt = getSystemPrompt;
exports.createProjectMemory = createProjectMemory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Memory file location (relative to working directory)
const MEMORY_FILE = '.zai/context.md';
exports.MEMORY_FILE = MEMORY_FILE;
// Base system prompt (deterministic execution engine)
const BASE_SYSTEM_PROMPT = `You are an execution engine. Follow these rules exactly:

RULES:
- Output ONLY what is explicitly requested
- No explanations unless requested
- No apologies or acknowledgments
- No conversational language
- No first-person references
- No preamble or postamble
- No markdown formatting unless requested
- Raw output only

BEHAVIOR:
- Execute instructions literally
- Be deterministic and consistent
- If a schema is provided, output valid JSON matching that schema exactly
- If output format is specified, follow it precisely

VIOLATIONS:
- Do not say "I", "I'll", "I can", "Sure", "Certainly", "Of course"
- Do not say "Here is", "Here's", "Let me"
- Do not apologize or explain limitations
- Do not add commentary or suggestions unless requested`;
exports.BASE_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;
// Get the full path to memory file
function getMemoryPath(workingDir) {
    const baseDir = workingDir || process.cwd();
    return path.join(baseDir, MEMORY_FILE);
}
// Ensure .zai directory exists
function ensureMemoryDir(workingDir) {
    const baseDir = workingDir || process.cwd();
    const zaiDir = path.join(baseDir, '.zai');
    if (!fs.existsSync(zaiDir)) {
        fs.mkdirSync(zaiDir, { recursive: true });
    }
}
// Load project context from .zai/context.md
function loadProjectContext(workingDir) {
    try {
        const memoryPath = getMemoryPath(workingDir);
        if (fs.existsSync(memoryPath)) {
            return fs.readFileSync(memoryPath, 'utf-8');
        }
        return '';
    }
    catch {
        // Fail gracefully on permission errors
        return '';
    }
}
// Save project context to .zai/context.md
function saveProjectContext(content, workingDir) {
    try {
        ensureMemoryDir(workingDir);
        const memoryPath = getMemoryPath(workingDir);
        fs.writeFileSync(memoryPath, content, 'utf-8');
    }
    catch {
        // Fail gracefully on permission errors
    }
}
// Append a rule to project context
function appendProjectRule(rule, workingDir) {
    const existing = loadProjectContext(workingDir);
    const newContent = existing ? `${existing}\n${rule}` : rule;
    saveProjectContext(newContent, workingDir);
}
// Get the complete system prompt with project rules
function getSystemPrompt(workingDir) {
    const projectContext = loadProjectContext(workingDir);
    const osInfo = `OS: ${process.platform} (${os.arch()})`;
    let systemPrompt = BASE_SYSTEM_PROMPT;
    systemPrompt += `\n\n${osInfo}`;
    if (projectContext.trim()) {
        systemPrompt += `\n\n<project_rules>\n${projectContext}\n</project_rules>`;
    }
    return systemPrompt;
}
// Create a ProjectMemory instance for a working directory
function createProjectMemory(workingDir) {
    return {
        async load() {
            return loadProjectContext(workingDir);
        },
        async append(rule) {
            appendProjectRule(rule, workingDir);
        },
        async getSystemPrompt() {
            return getSystemPrompt(workingDir);
        },
    };
}
//# sourceMappingURL=project_memory.js.map