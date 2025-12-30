import { parseInput, executeCommand, ParsedCommand } from './commands';
import { getSession, setIntent, getIntent, IntentType, setIntentType, getMode, setPendingActions, setMode, setLastPlan, setLastDiff } from './session';
import { hint, dim, error, success, info } from './ui';
import { execute, ResponseSchema } from './runtime';
import { ensureAuthenticated } from './auth';
import { buildSystemPrompt } from './mode_prompts';
import { applyFileOperation, applyResponse } from './apply';

// ============================================================================
// INTELLIGENT TASK ANALYSIS
// ============================================================================

interface TaskAnalysis {
  type: 'chat' | 'question' | 'simple_edit' | 'complex_task' | 'debug' | 'refactor';
  complexity: 'trivial' | 'simple' | 'medium' | 'complex';
  needsPlan: boolean;
  confidence: number;
  keywords: string[];
}

// Analyze task to determine best execution strategy
function analyzeTask(input: string): TaskAnalysis {
  const lower = input.toLowerCase().trim();
  const words = lower.split(/\s+/);
  const wordCount = words.length;
  
  // CHAT - greetings, small talk
  const chatPatterns = [
    /^h+i+!*$/i, /^he+y+!*$/i, /^y+o+!*$/i,
    /^(hello|hola|howdy|greetings|sup|wassup)[\s!.,]*$/i,
    /^(good\s*(morning|afternoon|evening|night))[\s!.,]*$/i,
    /^(what'?s?\s*up|how\s*are\s*you)[\s!?.,]*$/i,
    /^(thanks|thank\s*you|thx|ty|bye|goodbye|ok|okay|sure|yes|no|yep|nope|yeah|nah|cool|nice|great|awesome|lol)[\s!.,]*$/i,
  ];
  
  if (chatPatterns.some(p => p.test(lower)) || (wordCount <= 3 && !lower.includes('create') && !lower.includes('make') && !lower.includes('add'))) {
    return { type: 'chat', complexity: 'trivial', needsPlan: false, confidence: 0.95, keywords: [] };
  }
  
  // QUESTION - explicit questions
  const questionPatterns = [
    /^(what|why|how|when|where|who|which|explain|clarify|describe|tell me|show me)/i,
    /\?$/,
    /^(is|are|can|could|would|should|do|does|did|has|have|will)\s/i,
  ];
  
  if (questionPatterns.some(p => p.test(lower))) {
    return { type: 'question', complexity: 'simple', needsPlan: false, confidence: 0.9, keywords: [] };
  }
  
  // Extract action keywords
  const actionKeywords = {
    create: ['create', 'make', 'new', 'add', 'generate', 'build', 'write', 'init', 'setup', 'scaffold'],
    modify: ['update', 'change', 'modify', 'edit', 'fix', 'improve', 'enhance', 'refactor', 'rename', 'move'],
    delete: ['delete', 'remove', 'clean', 'clear', 'drop'],
    debug: ['fix', 'debug', 'error', 'bug', 'issue', 'broken', 'failing', 'crash', 'problem', 'wrong', 'not working'],
    refactor: ['refactor', 'reorganize', 'restructure', 'extract', 'split', 'merge', 'consolidate', 'simplify', 'clean up'],
  };
  
  const foundKeywords: string[] = [];
  let taskType: TaskAnalysis['type'] = 'simple_edit';
  
  for (const [category, keywords] of Object.entries(actionKeywords)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        foundKeywords.push(kw);
        if (category === 'debug') taskType = 'debug';
        else if (category === 'refactor') taskType = 'refactor';
      }
    }
  }
  
  // Complexity indicators
  const complexityIndicators = {
    simple: ['file', 'function', 'variable', 'class', 'method', 'component', 'test', 'readme', 'config'],
    medium: ['feature', 'module', 'service', 'api', 'endpoint', 'page', 'route', 'handler', 'middleware'],
    complex: ['system', 'architecture', 'database', 'migration', 'integration', 'authentication', 'authorization', 'deployment', 'infrastructure', 'full', 'complete', 'entire', 'whole', 'all'],
  };
  
  let complexity: TaskAnalysis['complexity'] = 'simple';
  
  // Check for complexity indicators
  for (const kw of complexityIndicators.complex) {
    if (lower.includes(kw)) {
      complexity = 'complex';
      break;
    }
  }
  if (complexity === 'simple') {
    for (const kw of complexityIndicators.medium) {
      if (lower.includes(kw)) {
        complexity = 'medium';
        break;
      }
    }
  }
  
  // Word count affects complexity
  if (wordCount > 30) complexity = 'complex';
  else if (wordCount > 15 && complexity === 'simple') complexity = 'medium';
  
  // Multiple files mentioned = more complex
  const filePatterns = /\.(ts|js|py|rs|go|java|cpp|c|h|css|html|json|yaml|yml|md|txt|sql|sh|bash|zsh)/gi;
  const fileMatches = lower.match(filePatterns);
  if (fileMatches && fileMatches.length > 2) {
    complexity = complexity === 'simple' ? 'medium' : 'complex';
  }
  
  // "and" chains indicate complexity
  const andCount = (lower.match(/\band\b/g) || []).length;
  if (andCount >= 2) {
    complexity = complexity === 'simple' ? 'medium' : 'complex';
    taskType = 'complex_task';
  }
  
  // Determine if plan is needed
  const needsPlan = complexity === 'complex' || (complexity === 'medium' && wordCount > 20);
  
  return {
    type: taskType,
    complexity,
    needsPlan,
    confidence: foundKeywords.length > 0 ? 0.85 : 0.7,
    keywords: foundKeywords,
  };
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

function extractTextFromResponse(response: unknown): string {
  if (typeof response === 'string') {
    let text = response;
    text = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '');
    try {
      const parsed = JSON.parse(text);
      if (parsed.explanation) return parsed.explanation;
      if (parsed.output) return parsed.output;
      if (parsed.message) return parsed.message;
    } catch { }
    return text.trim();
  }
  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;
    if (obj.explanation) return String(obj.explanation);
    if (obj.output) return String(obj.output);
    if (obj.message) return String(obj.message);
    return JSON.stringify(response, null, 2);
  }
  return String(response);
}

function parseFileOperations(response: unknown): ResponseSchema | null {
  if (typeof response === 'string') {
    let text = response.trim();
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) text = jsonMatch[1].trim();
    if (!text.startsWith('{')) {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        text = text.substring(jsonStart, jsonEnd + 1);
      }
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed.files && Array.isArray(parsed.files)) return parsed as ResponseSchema;
      if (parsed.status) return parsed as ResponseSchema;
    } catch { }
  }
  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;
    if (obj.files && Array.isArray(obj.files)) return obj as unknown as ResponseSchema;
    if (obj.status) return obj as unknown as ResponseSchema;
  }
  return null;
}

// ============================================================================
// EXECUTION HANDLERS
// ============================================================================

async function getApiKey(): Promise<string | null> {
  try {
    return await ensureAuthenticated();
  } catch {
    console.log(error('Authentication required. Run: zcode auth'));
    return null;
  }
}

// Handle casual chat
async function handleChat(input: string): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  const chatPrompt = `You are a friendly AI coding assistant. Respond naturally and briefly (1-2 sentences). Be warm and helpful. If the user wants to code, suggest they describe their task.`;
  
  const result = await execute({ 
    instruction: `${chatPrompt}\n\nUser: ${input}\n\nRespond briefly:`,
    enforceSchema: false 
  }, apiKey);

  if (result.success && result.output) {
    console.log(extractTextFromResponse(result.output));
  } else {
    console.log("Hey! What would you like to build today?");
  }
}

// Handle questions
async function handleQuestion(input: string): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  const session = getSession();
  console.log(dim('Thinking...'));
  
  const result = await execute({
    instruction: `You are a helpful coding assistant. Answer this question clearly and concisely:\n\n${input}`,
    enforceSchema: false
  }, apiKey);

  if (result.success && result.output) {
    console.log(extractTextFromResponse(result.output));
  } else {
    console.log(error(result.error || 'Failed to get answer'));
  }
}

// Handle simple edits - direct execution
async function handleSimpleEdit(input: string): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  const session = getSession();
  console.log(info('⚡ Executing...'));

  const { buildContext, formatContextForModel } = await import('./context/context_builder');
  const context = buildContext(session.workingDirectory, input, 'CODE_EDIT', session.openFiles);
  const filesContext = formatContextForModel(context);

  const instruction = `You are an autonomous coding agent. Execute this task completely.

Task: ${input}
Working directory: ${session.workingDirectory}
${filesContext ? `\nRelevant files:\n${filesContext}` : ''}

RESPOND WITH JSON ONLY:
{
  "status": "success",
  "files": [{"path": "path/to/file", "operation": "create|modify|delete", "content": "full content"}],
  "output": "Brief explanation"
}

RULES:
- Create folders by creating files inside them (folders auto-create)
- Provide COMPLETE file content, never partial
- Only modify files directly related to the task`;

  const result = await execute({ instruction }, apiKey);

  if (result.success && result.output) {
    const response = parseFileOperations(result.output) || 
                     (typeof result.output === 'object' ? result.output as ResponseSchema : null);

    if (response?.files?.length) {
      await applyFiles(response.files, session.workingDirectory, input);
      if (response.output) console.log('\n' + response.output);
    } else if (response?.output) {
      console.log(response.output);
    } else {
      const text = extractTextFromResponse(result.output);
      if (text && !text.startsWith('{')) console.log(text);
    }
  } else {
    console.log(error(result.error || 'Execution failed'));
  }
}

// Handle complex tasks - plan then execute
async function handleComplexTask(input: string): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  const session = getSession();
  setIntent(input);
  
  console.log(info('📋 Complex task detected - creating plan...'));

  const { buildContext, formatContextForModel } = await import('./context/context_builder');
  const context = buildContext(session.workingDirectory, input, 'CODE_EDIT', session.openFiles);
  const filesContext = formatContextForModel(context);

  // Step 1: Generate plan
  const planInstruction = `Create a step-by-step plan for this task.

Task: ${input}
Working directory: ${session.workingDirectory}
${filesContext ? `\nFiles:\n${filesContext}` : ''}

Respond with JSON:
{
  "status": "success",
  "plan": [
    {"id": "1", "description": "Step description", "files": ["affected/files"]}
  ],
  "output": "Plan summary"
}`;

  console.log(dim('Planning...'));
  const planResult = await execute({ instruction: planInstruction }, apiKey);

  if (!planResult.success) {
    console.log(error('Planning failed: ' + planResult.error));
    return;
  }

  const planResponse = parseFileOperations(planResult.output);
  const plan = (planResponse as any)?.plan;
  
  if (!plan || !Array.isArray(plan) || plan.length === 0) {
    console.log(dim('No plan generated, executing directly...'));
    return handleSimpleEdit(input);
  }

  // Show plan
  console.log(success(`Plan: ${plan.length} steps`));
  plan.forEach((step: any, i: number) => {
    console.log(`  ${i + 1}. ${step.description}`);
  });
  
  setLastPlan(plan.map((s: any) => ({ id: s.id, description: s.description, status: 'pending' as const })));

  // Step 2: Execute plan
  console.log('');
  console.log(dim('Executing plan...'));

  const executeInstruction = `Execute this plan and generate all file changes.

Task: ${input}

Plan:
${plan.map((s: any, i: number) => `${i + 1}. ${s.description}`).join('\n')}

Working directory: ${session.workingDirectory}
${filesContext ? `\nFiles:\n${filesContext}` : ''}

Respond with JSON containing ALL file operations:
{
  "status": "success",
  "files": [{"path": "path/to/file", "operation": "create|modify|delete", "content": "COMPLETE content"}],
  "output": "Summary of changes"
}

IMPORTANT: Include COMPLETE file content for every file. Never use placeholders.`;

  const execResult = await execute({ instruction: executeInstruction }, apiKey);

  if (!execResult.success) {
    console.log(error('Execution failed: ' + execResult.error));
    return;
  }

  const execResponse = parseFileOperations(execResult.output) ||
                       (typeof execResult.output === 'object' ? execResult.output as ResponseSchema : null);

  if (execResponse?.files?.length) {
    await applyFiles(execResponse.files, session.workingDirectory, input);
    if (execResponse.output) console.log('\n' + execResponse.output);
  } else if (execResponse?.output) {
    console.log(execResponse.output);
  } else {
    console.log(dim('No file changes generated.'));
  }
}

// Apply files helper
async function applyFiles(files: ResponseSchema['files'], basePath: string, input: string): Promise<void> {
  if (!files || files.length === 0) return;

  // Safety filter
  const safeFiles = files.filter(file => {
    const p = file.path.toLowerCase();
    if (p.startsWith('src/') && !input.toLowerCase().includes('src')) {
      console.log(dim(`  Skipped ${file.path} (not in task scope)`));
      return false;
    }
    if (p.startsWith('/') || p.startsWith('..')) {
      console.log(dim(`  Skipped ${file.path} (outside project)`));
      return false;
    }
    return true;
  });

  if (safeFiles.length === 0) return;

  console.log(success(`Applying ${safeFiles.length} file(s)...`));
  
  let applied = 0, failed = 0;
  
  for (const file of safeFiles) {
    try {
      let filePath = file.path.startsWith('./') ? file.path.substring(2) : file.path;
      const result = applyFileOperation(file.operation, filePath, file.content, { basePath });
      
      if (result.success) {
        console.log(success(`  ✓ ${file.operation}: ${filePath}`));
        applied++;
      } else {
        console.log(error(`  ✗ ${filePath}: ${result.error}`));
        failed++;
      }
    } catch (e: any) {
      console.log(error(`  ✗ ${file.path}: ${e?.message}`));
      failed++;
    }
  }

  console.log('');
  if (applied > 0) console.log(success(`Applied ${applied} file(s)`));
  if (failed > 0) console.log(error(`Failed ${failed} file(s)`));
  console.log(hint('/undo to rollback'));
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export interface OrchestrationResult {
  inputType: 'slash' | 'free_text';
  intent: IntentType;
  workflow: string;
  handled: boolean;
  message?: string;
}

export async function orchestrate(input: string): Promise<OrchestrationResult> {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { inputType: 'free_text', intent: 'COMMAND', workflow: 'ignore', handled: true };
  }

  // Handle slash commands
  const parsed = parseInput(trimmed);
  if (parsed.isSlashCommand) {
    await executeCommand(parsed);
    return { inputType: 'slash', intent: 'COMMAND', workflow: 'slash_command', handled: true };
  }

  // Analyze the task
  const analysis = analyzeTask(trimmed);
  
  // Route based on analysis
  switch (analysis.type) {
    case 'chat':
      await handleChat(trimmed);
      return { inputType: 'free_text', intent: 'QUESTION', workflow: 'chat', handled: true };
      
    case 'question':
      await handleQuestion(trimmed);
      return { inputType: 'free_text', intent: 'QUESTION', workflow: 'question', handled: true };
      
    case 'debug':
    case 'refactor':
    case 'simple_edit':
      if (analysis.needsPlan) {
        await handleComplexTask(trimmed);
      } else {
        await handleSimpleEdit(trimmed);
      }
      return { inputType: 'free_text', intent: 'CODE_EDIT', workflow: 'auto_execute', handled: true };
      
    case 'complex_task':
      await handleComplexTask(trimmed);
      return { inputType: 'free_text', intent: 'CODE_EDIT', workflow: 'planned_execute', handled: true };
      
    default:
      await handleSimpleEdit(trimmed);
      return { inputType: 'free_text', intent: 'CODE_EDIT', workflow: 'auto_execute', handled: true };
  }
}

// Legacy exports for compatibility
export type WorkflowType = 'slash_command' | 'capture_intent' | 'ask_question' | 'chat' | 'append_context' | 'confirm_action' | 'auto_execute' | 'ignore';
