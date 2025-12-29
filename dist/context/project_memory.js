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
exports.loadProjectContext = loadProjectContext;
exports.saveProjectContext = saveProjectContext;
exports.getSystemPrompt = getSystemPrompt;
exports.hasProjectContext = hasProjectContext;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CONTEXT_FILE = '.zai/context.md';
// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `You are an expert AI coding assistant. You help developers write, debug, and improve code.

Guidelines:
- Write clean, maintainable, well-documented code
- Follow best practices for the language/framework being used
- Provide clear explanations when asked
- Be concise but thorough
- If unsure, say so rather than guessing

When providing code changes, use this JSON format:
{
  "status": "success",
  "files": [
    {
      "path": "relative/path/to/file",
      "operation": "create" | "modify" | "delete",
      "content": "full file content for create/modify"
    }
  ],
  "output": "Brief explanation of changes"
}`;
// Load project-specific context/rules
function loadProjectContext(workingDir) {
    const contextPath = path.join(workingDir, CONTEXT_FILE);
    try {
        if (fs.existsSync(contextPath)) {
            return fs.readFileSync(contextPath, 'utf-8');
        }
    }
    catch {
        // Ignore errors
    }
    return null;
}
// Save project context
function saveProjectContext(workingDir, content) {
    const contextPath = path.join(workingDir, CONTEXT_FILE);
    const dir = path.dirname(contextPath);
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(contextPath, content, 'utf-8');
        return true;
    }
    catch {
        return false;
    }
}
// Get full system prompt with project context
function getSystemPrompt(workingDir) {
    let prompt = DEFAULT_SYSTEM_PROMPT;
    if (workingDir) {
        const projectContext = loadProjectContext(workingDir);
        if (projectContext) {
            prompt += `\n\n--- Project Rules ---\n${projectContext}`;
        }
    }
    return prompt;
}
// Check if project has context file
function hasProjectContext(workingDir) {
    const contextPath = path.join(workingDir, CONTEXT_FILE);
    return fs.existsSync(contextPath);
}
//# sourceMappingURL=project_memory.js.map