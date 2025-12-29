import { parseInput, executeCommand, ParsedCommand } from './commands';
import { getSession, setIntent, getIntent, IntentType, setIntentType, getMode, setPendingActions, setMode } from './session';
import { hint, dim, error, success, info } from './ui';
import { execute, ResponseSchema } from './runtime';
import { ensureAuthenticated } from './auth';
import { buildSystemPrompt } from './mode_prompts';
import { applyFileOperation } from './apply';
import * as path from 'path';

// Helper to extract meaningful text from API response
function extractTextFromResponse(response: unknown): string {
  if (typeof response === 'string') {
    // Strip markdown code blocks
    let text = response;
    text = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '');

    // Try to parse as JSON and extract explanation
    try {
      const parsed = JSON.parse(text);
      if (parsed.explanation) return parsed.explanation;
      if (parsed.output) return parsed.output;
      if (parsed.message) return parsed.message;
      if (parsed.summary) return parsed.summary;
      if (parsed.status === 'error' && parsed.explanation) return parsed.explanation;
    } catch {
      // Not JSON, return as-is
    }
    return text.trim();
  }

  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;
    if (obj.explanation) return String(obj.explanation);
    if (obj.output) return String(obj.output);
    if (obj.message) return String(obj.message);
    if (obj.summary) return String(obj.summary);
    return JSON.stringify(response, null, 2);
  }

  return String(response);
}

// Try to parse file operations from response
function parseFileOperations(response: unknown): ResponseSchema | null {
  if (typeof response === 'string') {
    // Try to extract JSON from markdown code blocks
    let text = response;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      text = jsonMatch[1];
    }
    
    try {
      const parsed = JSON.parse(text);
      if (parsed.files && Array.isArray(parsed.files)) {
        return parsed as ResponseSchema;
      }
      if (parsed.status) {
        return parsed as ResponseSchema;
      }
    } catch {
      // Not valid JSON
    }
  }
  
  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;
    if (obj.files && Array.isArray(obj.files)) {
      return obj as unknown as ResponseSchema;
    }
    if (obj.status) {
      return obj as unknown as ResponseSchema;
    }
  }
  
  return null;
}

// Workflow types
export type WorkflowType =
  | 'slash_command'
  | 'capture_intent'
  | 'ask_question'
  | 'chat'
  | 'append_context'
  | 'confirm_action'
  | 'auto_execute'
  | 'ignore';

export interface OrchestrationResult {
  inputType: 'slash' | 'free_text';
  intent: IntentType;
  workflow: WorkflowType;
  handled: boolean;
  message?: string;
}

// Check if input is casual chat (greetings, small talk)
function isCasualChat(input: string): boolean {
  const lower = input.toLowerCase().trim();
  
  // Very short inputs (1-4 chars) that look like greetings
  if (lower.length <= 4) {
    const shortGreetings = ['hi', 'hii', 'hey', 'yo', 'sup', 'ok', 'yes', 'no', 'yep', 'nah', 'bye', 'thx', 'ty'];
    if (shortGreetings.some(g => lower.startsWith(g))) {
      return true;
    }
  }
  
  const casualPatterns = [
    /^h+i+!*$/i,  // hi, hii, hiii, etc
    /^he+y+!*$/i, // hey, heyy, heyyy
    /^y+o+!*$/i,  // yo, yoo, yooo
    /^(hello|hola|howdy|greetings)[\s!.,]*$/i,
    /^(good\s*(morning|afternoon|evening|night))[\s!.,]*$/i,
    /^(what'?s?\s*up|how\s*are\s*you|how'?s?\s*it\s*going)[\s!?.,]*$/i,
    /^(thanks|thank\s*you|thx|ty)[\s!.,]*$/i,
    /^(bye|goodbye|see\s*ya|later|cya)[\s!.,]*$/i,
    /^(ok|okay|sure|yes|no|yep|nope|yeah|nah)[\s!.,]*$/i,
    /^(cool|nice|great|awesome|perfect|lol|lmao)[\s!.,]*$/i,
    /^(sup|wassup|wazzup)[\s!.,]*$/i,
  ];
  
  return casualPatterns.some(pattern => pattern.test(lower));
}

// Check if input is a short simple question
function isSimpleQuestion(input: string): boolean {
  const lower = input.toLowerCase().trim();
  // Short questions that don't need code context
  if (input.length < 50 && /\?$/.test(input)) {
    return true;
  }
  // Direct questions
  if (/^(what|why|how|when|where|who|can you|could you|would you|will you)\s/i.test(lower)) {
    return true;
  }
  return false;
}

// Intent classification (rule-based, no model)
function classifyIntent(input: string): IntentType {
  const lower = input.toLowerCase().trim();

  // CASUAL CHAT - handle separately
  if (isCasualChat(input)) {
    return 'QUESTION'; // Route to chat handler
  }

  // QUESTION - explicit questions
  if (/^(what|why|how|when|where|who|explain|clarify|describe|tell me)/i.test(lower) ||
    /\?$/.test(lower) ||
    /^(is|are|can|could|would|should|do|does|did|has|have|will)\s/i.test(lower)) {
    return 'QUESTION';
  }

  // DEBUG
  if (/(fix|debug|error|bug|issue|broken|failing|crash|exception|problem|wrong|doesn'?t work|not working)/i.test(lower)) {
    return 'DEBUG';
  }

  // REFACTOR
  if (/(refactor|rename|reorganize|restructure|extract|move|split|merge|consolidate|clean up|cleanup|simplify)/i.test(lower)) {
    return 'REFACTOR';
  }

  // REVIEW
  if (/(review|analyze|audit|check|inspect|examine|assess|evaluate|look at|understand|read|show me)/i.test(lower)) {
    return 'REVIEW';
  }

  // CODE_EDIT - file operations
  if (/(add|create|implement|update|change|modify|write|build|make|generate|new|feature|function|component|edit|insert|append|remove|delete|replace|file|folder|directory)/i.test(lower)) {
    return 'CODE_EDIT';
  }

  // Default to QUESTION for short inputs, CODE_EDIT for longer ones
  if (input.length < 30) {
    return 'QUESTION';
  }

  return 'CODE_EDIT';
}

// Determine workflow based on mode and intent
function determineWorkflow(intent: IntentType, input: string): WorkflowType {
  const mode = getMode();

  // Casual chat always goes to chat handler
  if (isCasualChat(input)) {
    return 'chat';
  }

  // Simple questions go to ask handler
  if (isSimpleQuestion(input) && intent === 'QUESTION') {
    return 'ask_question';
  }

  // Read-only modes route to ask_question workflow
  if (mode === 'ask' || mode === 'explain' || mode === 'review') {
    return 'ask_question';
  }

  // Auto mode - execute directly without manual steps
  if (mode === 'auto') {
    return 'auto_execute';
  }

  // Questions in edit mode still get answered
  if (intent === 'QUESTION') {
    return 'ask_question';
  }

  return 'capture_intent';
}

// Handle question/explain/review in read-only modes
async function handleAskQuestion(input: string): Promise<{ handled: boolean; message?: string }> {
  try {
    let apiKey: string;
    try {
      apiKey = await ensureAuthenticated();
    } catch (authError: any) {
      console.log(error(`Authentication required: ${authError?.message || 'Run zcode auth'}`));
      return { handled: true };
    }

    if (!apiKey) {
      console.log(error('No API key configured. Run "zcode auth" to set up.'));
      return { handled: true };
    }

    const session = getSession();
    const mode = getMode();
    const modePrompt = buildSystemPrompt(mode, session.workingDirectory);

    const instruction = `${modePrompt}

User input: ${input}

Respond directly and concisely.`;

    console.log(dim('Thinking...'));
    const result = await execute({ instruction, enforceSchema: false }, apiKey);

    if (result.success && result.output) {
      const text = extractTextFromResponse(result.output);
      console.log(text);
    } else {
      console.log(error(`Failed: ${result.error || 'Unknown error'}`));
    }

    return { handled: true };
  } catch (e: any) {
    console.log(error(`Error: ${e?.message || e}`));
    return { handled: true };
  }
}

// Handle auto execution - plan, generate, and apply in one go
async function handleAutoExecute(input: string): Promise<{ handled: boolean; message?: string }> {
  // SAFETY: Check if this looks like a real coding task
  // If input is too short or vague, don't execute file operations
  const looksLikeTask = input.length > 10 && 
    /(create|add|implement|build|make|write|update|modify|fix|change|delete|remove|refactor)/i.test(input);
  
  if (!looksLikeTask) {
    // Treat as a question instead
    console.log(dim('Input too vague for auto mode. Treating as question...'));
    return handleAskQuestion(input);
  }

  try {
    let apiKey: string;
    try {
      apiKey = await ensureAuthenticated();
    } catch (authError: any) {
      console.log(error(`Authentication required: ${authError?.message || 'Run zcode auth'}`));
      return { handled: true };
    }

    if (!apiKey) {
      console.log(error('No API key configured. Run "zcode auth" to set up.'));
      return { handled: true };
    }

    const session = getSession();
    const modePrompt = buildSystemPrompt('auto', session.workingDirectory);

    console.log(info('Executing autonomously...'));

    // Build context from workspace for better results
    const { buildContext, formatContextForModel } = await import('./context/context_builder');
    const context = buildContext(
      session.workingDirectory,
      input,
      'CODE_EDIT',
      session.openFiles.map(f => require('path').join(session.workingDirectory, f))
    );
    const filesContext = formatContextForModel(context);

    const instruction = `${modePrompt}

Task: ${input}

Working directory: ${session.workingDirectory}

${filesContext ? `Relevant files:\n${filesContext}` : ''}

IMPORTANT RULES:
1. Only create/modify files that are DIRECTLY related to the user's task
2. NEVER create files in src/ unless explicitly asked to modify source code
3. For project files, use the .zai/ folder for any internal/temporary files
4. If the task is unclear, respond with just an explanation - don't create files

Execute this task completely. For file operations, respond with JSON:
{
  "status": "success",
  "files": [
    {"path": "relative/path/to/file.ext", "operation": "create", "content": "full file content here"}
  ],
  "output": "Brief explanation of what was done"
}

For questions or explanations (no file changes needed), respond with:
{
  "status": "success", 
  "output": "Your response here"
}

Be decisive but careful. Only modify files when the task clearly requires it.`;

    const result = await execute({ instruction }, apiKey);

    if (result.success && result.output) {
      // Try to parse as ResponseSchema first
      let response = parseFileOperations(result.output);
      
      // If direct parsing failed, try the output object
      if (!response && typeof result.output === 'object') {
        response = result.output as ResponseSchema;
      }

      // Check if there are file operations
      if (response && response.files && response.files.length > 0) {
        // SAFETY: Filter out suspicious file operations
        const safeFiles = response.files.filter(file => {
          const filePath = file.path.toLowerCase();
          // Block creating files in src/ unless task explicitly mentions it
          if (filePath.startsWith('src/') && !input.toLowerCase().includes('src')) {
            console.log(dim(`  Skipped ${file.path} (not in task scope)`));
            return false;
          }
          // Block creating files outside project
          if (filePath.startsWith('/') || filePath.startsWith('..')) {
            console.log(dim(`  Skipped ${file.path} (outside project)`));
            return false;
          }
          return true;
        });

        if (safeFiles.length > 0) {
          console.log(success(`Applying ${safeFiles.length} file(s)...`));

          let applied = 0;
          let failed = 0;
          
          for (const file of safeFiles) {
            try {
              // Normalize the path
              let filePath = file.path;
              if (filePath.startsWith('./')) {
                filePath = filePath.substring(2);
              }
              
              const opResult = applyFileOperation(file.operation, filePath, file.content, {
                basePath: session.workingDirectory
              });
              if (opResult.success) {
                console.log(success(`  ${file.operation}: ${filePath}`));
                applied++;
              } else {
                console.log(error(`  Failed ${filePath}: ${opResult.error}`));
                failed++;
              }
            } catch (e: any) {
              console.log(error(`  Failed ${file.path}: ${e?.message}`));
              failed++;
            }
          }
          
          console.log('');
          if (applied > 0) {
            console.log(success(`Applied ${applied} file(s)`));
          }
          if (failed > 0) {
            console.log(error(`Failed ${failed} file(s)`));
          }
          console.log(hint('/undo to rollback'));
        }
      }

      // Show output/explanation
      if (response && response.output) {
        console.log('');
        console.log(response.output);
      } else if (response && response.error) {
        console.log(error(response.error));
      } else if (!response) {
        // No structured response, show raw output
        const text = extractTextFromResponse(result.output);
        if (text) {
          console.log(text);
        }
      }
    } else {
      console.log(error(`Failed: ${result.error || 'Unknown error'}`));
    }

    return { handled: true };
  } catch (e: any) {
    console.log(error(`Error: ${e?.message || e}`));
    return { handled: true };
  }
}

// Handle workflow
async function handleWorkflow(
  workflow: WorkflowType,
  input: string,
  parsed: ParsedCommand,
  intent: IntentType
): Promise<{ handled: boolean; message?: string }> {
  switch (workflow) {
    case 'slash_command':
      await executeCommand(parsed);
      return { handled: true };

    case 'chat':
      return handleChat(input);

    case 'ask_question':
      return handleAskQuestion(input);

    case 'auto_execute':
      return handleAutoExecute(input);

    case 'capture_intent':
      setIntent(input);
      setIntentType(intent);
      // Provide clear feedback about what was captured
      const intentLabel = intent.toLowerCase().replace('_', ' ');
      console.log(`Task captured: "${input.substring(0, 60)}${input.length > 60 ? '...' : ''}"`);
      console.log(`Type: ${intentLabel}`);
      console.log('');
      console.log(hint('Type /plan to create execution plan'));
      return { handled: true };

    case 'append_context':
      const existing = getIntent();
      if (existing) {
        setIntent(`${existing}\n\nClarification: ${input}`);
        console.log(dim('Context updated.'));
        console.log(hint('/plan'));
        return { handled: true };
      }
      setIntent(input);
      console.log(dim('Intent captured.'));
      console.log(hint('/plan'));
      return { handled: true };

    case 'confirm_action':
      const session = getSession();
      if (session.pendingActions) {
        console.log(hint('/diff or /apply'));
        return { handled: true };
      }
      console.log(dim('Nothing pending.'));
      return { handled: true };

    case 'ignore':
      return { handled: true };

    default:
      return { handled: false };
  }
}

// Handle casual chat - greetings, small talk
async function handleChat(input: string): Promise<{ handled: boolean; message?: string }> {
  try {
    let apiKey: string;
    try {
      apiKey = await ensureAuthenticated();
    } catch (authError: any) {
      console.log(error(`Authentication required: ${authError?.message || 'Run zcode auth'}`));
      return { handled: true };
    }

    if (!apiKey) {
      console.log(error('No API key configured. Run "zcode auth" to set up.'));
      return { handled: true };
    }

    // Simple chat prompt - no code context needed
    const chatPrompt = `You are a friendly AI coding assistant. Respond naturally and briefly to casual conversation.
Keep responses short (1-2 sentences). Be warm and helpful.
If the user seems to want to start coding, suggest they describe their task.`;

    const instruction = `${chatPrompt}

User: ${input}

Respond briefly and naturally:`;

    console.log(dim('...'));
    const result = await execute({ instruction, enforceSchema: false }, apiKey);

    if (result.success && result.output) {
      const text = extractTextFromResponse(result.output);
      console.log(text);
    } else {
      // Fallback for chat errors - just be friendly
      const greetings: Record<string, string> = {
        'hi': 'Hey! What would you like to build today?',
        'hello': 'Hello! Ready to code something awesome?',
        'hey': 'Hey there! What can I help you with?',
        'yo': 'Yo! What are we building?',
        'sup': 'Not much! What are you working on?',
        'thanks': 'You\'re welcome! Need anything else?',
        'thank you': 'Happy to help! What\'s next?',
        'bye': 'See you! Happy coding!',
        'ok': 'Great! Let me know if you need anything.',
        'cool': 'Awesome! What\'s next?',
      };
      
      const lower = input.toLowerCase().trim().replace(/[!.,?]/g, '');
      const response = greetings[lower] || 'Hey! Describe what you\'d like to build.';
      console.log(response);
    }

    return { handled: true };
  } catch (e: any) {
    // Fallback on any error
    console.log('Hey! What would you like to build today?');
    return { handled: true };
  }
}

// Main orchestration entry
export async function orchestrate(input: string): Promise<OrchestrationResult> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      inputType: 'free_text',
      intent: 'COMMAND',
      workflow: 'ignore',
      handled: true,
    };
  }

  const parsed = parseInput(trimmed);

  // Slash commands
  if (parsed.isSlashCommand) {
    await executeCommand(parsed);
    return {
      inputType: 'slash',
      intent: 'COMMAND',
      workflow: 'slash_command',
      handled: true,
    };
  }

  // Free text - classify and route
  const intent = classifyIntent(trimmed);
  const workflow = determineWorkflow(intent, trimmed);

  const result = await handleWorkflow(workflow, trimmed, parsed, intent);

  return {
    inputType: 'free_text',
    intent,
    workflow,
    handled: result.handled,
    message: result.message,
  };
}
