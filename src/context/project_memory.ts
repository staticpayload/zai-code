import * as fs from 'fs';
import * as path from 'path';

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
export function loadProjectContext(workingDir: string): string | null {
  const contextPath = path.join(workingDir, CONTEXT_FILE);
  
  try {
    if (fs.existsSync(contextPath)) {
      return fs.readFileSync(contextPath, 'utf-8');
    }
  } catch {
    // Ignore errors
  }
  
  return null;
}

// Save project context
export function saveProjectContext(workingDir: string, content: string): boolean {
  const contextPath = path.join(workingDir, CONTEXT_FILE);
  const dir = path.dirname(contextPath);
  
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(contextPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// Get full system prompt with project context
export function getSystemPrompt(workingDir?: string): string {
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
export function hasProjectContext(workingDir: string): boolean {
  const contextPath = path.join(workingDir, CONTEXT_FILE);
  return fs.existsSync(contextPath);
}
