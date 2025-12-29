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
exports.loadAgentsConfig = loadAgentsConfig;
exports.hasAgentsConfig = hasAgentsConfig;
exports.getAgentsContext = getAgentsContext;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const AGENTS_FILE = 'agents.md';
// Detect and read agents.md from project root
function loadAgentsConfig(projectPath) {
    const cwd = projectPath || process.cwd();
    const agentsPath = path.join(cwd, AGENTS_FILE);
    try {
        if (!fs.existsSync(agentsPath)) {
            return { exists: false, content: null, error: null };
        }
        const stats = fs.statSync(agentsPath);
        // Check if file is too large (>50KB)
        if (stats.size > 50 * 1024) {
            const content = fs.readFileSync(agentsPath, 'utf-8');
            // Summarize: take first 10KB
            const summarized = content.substring(0, 10000) + '\n\n[... truncated due to size ...]';
            return { exists: true, content: summarized, error: null };
        }
        const content = fs.readFileSync(agentsPath, 'utf-8');
        return { exists: true, content, error: null };
    }
    catch (e) {
        return { exists: true, content: null, error: `Failed to read agents.md: ${e}` };
    }
}
// Check if agents.md exists
function hasAgentsConfig(projectPath) {
    const cwd = projectPath || process.cwd();
    const agentsPath = path.join(cwd, AGENTS_FILE);
    return fs.existsSync(agentsPath);
}
// Get agents.md content for injection into system context
function getAgentsContext(projectPath) {
    const config = loadAgentsConfig(projectPath);
    if (!config.exists) {
        return '';
    }
    if (config.error) {
        return `[agents.md: ${config.error}]`;
    }
    if (!config.content) {
        return '';
    }
    return `\n\n--- User Agent Instructions (agents.md) ---\n${config.content}\n--- End Agent Instructions ---\n`;
}
//# sourceMappingURL=agents.js.map