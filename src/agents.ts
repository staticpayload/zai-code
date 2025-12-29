import * as fs from 'fs';
import * as path from 'path';

const AGENTS_FILE = 'agents.md';

export interface AgentsConfig {
    exists: boolean;
    content: string | null;
    error: string | null;
}

// Detect and read agents.md from project root
export function loadAgentsConfig(projectPath?: string): AgentsConfig {
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
    } catch (e) {
        return { exists: true, content: null, error: `Failed to read agents.md: ${e}` };
    }
}

// Check if agents.md exists
export function hasAgentsConfig(projectPath?: string): boolean {
    const cwd = projectPath || process.cwd();
    const agentsPath = path.join(cwd, AGENTS_FILE);
    return fs.existsSync(agentsPath);
}

// Get agents.md content for injection into system context
export function getAgentsContext(projectPath?: string): string {
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
