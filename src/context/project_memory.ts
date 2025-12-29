import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Memory file location (relative to working directory)
const MEMORY_FILE = '.zai/context.md';

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

// Get the full path to memory file
function getMemoryPath(workingDir?: string): string {
  const baseDir = workingDir || process.cwd();
  return path.join(baseDir, MEMORY_FILE);
}

// Ensure .zai directory exists
function ensureMemoryDir(workingDir?: string): boolean {
  const baseDir = workingDir || process.cwd();
  const zaiDir = path.join(baseDir, '.zai');
  try {
    if (!fs.existsSync(zaiDir)) {
      fs.mkdirSync(zaiDir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

// Load project context from .zai/context.md
export function loadProjectContext(workingDir?: string): string {
  try {
    const memoryPath = getMemoryPath(workingDir);
    if (fs.existsSync(memoryPath)) {
      return fs.readFileSync(memoryPath, 'utf-8');
    }
    return '';
  } catch {
    // Fail gracefully on permission errors
    return '';
  }
}

// Save project context to .zai/context.md
export function saveProjectContext(content: string, workingDir?: string): boolean {
  try {
    if (!ensureMemoryDir(workingDir)) {
      return false;
    }
    const memoryPath = getMemoryPath(workingDir);
    fs.writeFileSync(memoryPath, content, 'utf-8');
    return true;
  } catch {
    // Fail gracefully on permission errors
    return false;
  }
}

// Append a rule to project context
export function appendProjectRule(rule: string, workingDir?: string): boolean {
  const existing = loadProjectContext(workingDir);
  const newContent = existing ? `${existing}\n${rule}` : rule;
  return saveProjectContext(newContent, workingDir);
}

// Get the complete system prompt with project rules
export function getSystemPrompt(workingDir?: string): string {
  const projectContext = loadProjectContext(workingDir);
  const osInfo = `OS: ${process.platform} (${os.arch()})`;

  let systemPrompt = BASE_SYSTEM_PROMPT;
  systemPrompt += `\n\n${osInfo}`;

  if (projectContext.trim()) {
    systemPrompt += `\n\n<project_rules>\n${projectContext}\n</project_rules>`;
  }

  return systemPrompt;
}

// ProjectMemory interface implementation
export interface ProjectMemory {
  load(): Promise<string>;
  append(rule: string): Promise<void>;
  getSystemPrompt(): Promise<string>;
}

// Create a ProjectMemory instance for a working directory
export function createProjectMemory(workingDir?: string): ProjectMemory {
  return {
    async load(): Promise<string> {
      return loadProjectContext(workingDir);
    },
    async append(rule: string): Promise<void> {
      appendProjectRule(rule, workingDir);
    },
    async getSystemPrompt(): Promise<string> {
      return getSystemPrompt(workingDir);
    },
  };
}

// Export constants for external use
export { MEMORY_FILE, BASE_SYSTEM_PROMPT };
