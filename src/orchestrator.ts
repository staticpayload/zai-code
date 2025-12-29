import { parseInput, executeCommand, ParsedCommand } from './commands';
import { getSession, setIntent, getIntent, IntentType, setIntentType, getMode, setPendingActions } from './session';
import { hint, dim, error, success, info } from './ui';
import { execute, ResponseSchema } from './runtime';
import { ensureAuthenticated } from './auth';
import { buildSystemPrompt } from './mode_prompts';
import { applyFileOperation } from './apply';

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

Execute this task completely. If it requires code changes, provide the file operations with full file content.
If it's a question, answer it directly.
Be decisive and thorough.`;

    const result = await execute({ instruction }, apiKey);

    if (result.success && result.output) {
      const response = result.output as ResponseSchema;

      // Check if there are file operations
      if (response.files && response.files.length > 0) {
        console.log(success(`Applying ${response.files.length} file(s)...`));

        let applied = 0;
        let failed = 0;
        
        for (const file of response.files) {
          try {
            const opResult = applyFileOperation(file.operation, file.path, file.content, {
              basePath: session.workingDirectory
            });
            if (opResult.success) {
              console.log(success(`  ${file.operation}: ${file.path}`));
              applied++;
            } else {
              console.log(error(`  Failed ${file.path}: ${opResult.error}`));
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

      // Show output/explanation
      if (response.output) {
        console.log('');
        console.log(response.output);
      } else if (response.error) {
        console.log(error(response.error));
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
