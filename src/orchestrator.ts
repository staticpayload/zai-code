import { parseInput, executeCommand, ParsedCommand } from './commands';
import { getSession, setIntent, getIntent, IntentType, setIntentType, getMode, setPendingActions } from './session';
import { hint, dim, error, success, info } from './ui';
import { execute, ResponseSchema } from './runtime';
import { ensureAuthenticated } from './auth';
import { buildSystemPrompt } from './mode_prompts';
import { applyFileOperation } from './apply';

// Workflow types
export type WorkflowType =
  | 'slash_command'
  | 'capture_intent'
  | 'ask_question'
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

// Intent classification (rule-based, no model)
function classifyIntent(input: string): IntentType {
  const lower = input.toLowerCase().trim();

  // QUESTION
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

  // CODE_EDIT
  if (/(add|create|implement|update|change|modify|write|build|make|generate|new|feature|function|component|edit|insert|append|remove|delete|replace)/i.test(lower)) {
    return 'CODE_EDIT';
  }

  return 'COMMAND';
}

// Determine workflow based on mode
function determineWorkflow(intent: IntentType, hasExistingIntent: boolean): WorkflowType {
  const mode = getMode();

  // Read-only modes route to ask_question workflow
  if (mode === 'ask' || mode === 'explain' || mode === 'review') {
    return 'ask_question';
  }

  // Auto mode - execute directly without manual steps
  if (mode === 'auto') {
    return 'auto_execute';
  }

  // Questions always go to ask workflow regardless of mode
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
      const response = result.output;
      
      // Handle string response
      if (typeof response === 'string') {
        console.log(response);
      } else if (typeof response === 'object') {
        const obj = response as { explanation?: string; message?: string; summary?: string; output?: string; issues?: unknown[] };
        
        // Try various output fields
        if (obj.output) {
          console.log(obj.output);
        } else if (obj.explanation) {
          console.log(obj.explanation);
        } else if (obj.summary) {
          console.log(obj.summary);
          if (obj.issues && Array.isArray(obj.issues)) {
            for (const issue of obj.issues as Array<{ severity?: string; description?: string }>) {
              console.log(`  [${issue.severity || 'note'}] ${issue.description || ''}`);
            }
          }
        } else if (obj.message) {
          console.log(obj.message);
        } else {
          console.log(JSON.stringify(response, null, 2));
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

// Handle auto execution - plan, generate, and apply in one go
async function handleAutoExecute(input: string): Promise<{ handled: boolean; message?: string }> {
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

    const instruction = `${modePrompt}

Task: ${input}

Execute this task. If it requires code changes, provide the file operations.
If it's a question, answer it directly.
Be decisive and complete the task.`;

    const result = await execute({ instruction }, apiKey);

    if (result.success && result.output) {
      const response = result.output as ResponseSchema;
      
      // Check if there are file operations
      if (response.files && response.files.length > 0) {
        console.log(success(`Applying ${response.files.length} file(s)...`));
        
        for (const file of response.files) {
          try {
            const result = applyFileOperation(file.operation, file.path, file.content);
            if (result.success) {
              console.log(success(`${file.operation}: ${file.path}`));
            } else {
              console.log(error(`Failed ${file.path}: ${result.error}`));
            }
          } catch (e: any) {
            console.log(error(`Failed ${file.path}: ${e?.message}`));
          }
        }
      }
      
      // Show output
      if (response.output) {
        console.log('');
        console.log(response.output);
      } else if (typeof response === 'string') {
        console.log(response);
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

  // Free text - classify and capture
  const intent = classifyIntent(trimmed);
  const hasExistingIntent = getIntent() !== null;
  const workflow = determineWorkflow(intent, hasExistingIntent);

  const result = await handleWorkflow(workflow, trimmed, parsed, intent);

  return {
    inputType: 'free_text',
    intent,
    workflow,
    handled: result.handled,
    message: result.message,
  };
}
