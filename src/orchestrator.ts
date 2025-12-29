import { parseInput, executeCommand, ParsedCommand } from './commands';
import { getSession, setIntent, getIntent, IntentType, setIntentType, getMode } from './session';
import { hint, dim, error } from './ui';
import { execute } from './runtime';
import { ensureAuthenticated } from './auth';
import { getAgentsContext } from './agents';

// Workflow types
export type WorkflowType =
  | 'slash_command'
  | 'capture_intent'
  | 'ask_question'
  | 'append_context'
  | 'confirm_action'
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

  // In ask mode, treat all input as questions
  if (mode === 'ask') {
    return 'ask_question';
  }

  return 'capture_intent';
}

// Handle question in ask mode (read-only, direct answer)
async function handleAskQuestion(input: string): Promise<{ handled: boolean; message?: string }> {
  try {
    const apiKey = await ensureAuthenticated();
    const session = getSession();
    const agentsContext = getAgentsContext(session.workingDirectory);

    const instruction = `You are in READ-ONLY mode. Answer this question briefly and directly. 
Do NOT suggest code changes. Do NOT plan modifications. Just explain.
${agentsContext}
Question: ${input}`;

    const result = await execute({ instruction }, apiKey);

    if (result.success && result.output) {
      const response = result.output as { explanation?: string; message?: string };
      console.log(response.explanation || response.message || 'No answer available.');
    } else {
      console.log(error(`Failed: ${result.error}`));
    }

    return { handled: true };
  } catch (e) {
    console.log(error(`Error: ${e}`));
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

    case 'capture_intent':
      setIntent(input);
      setIntentType(intent);
      // Clear, minimal output with next action
      const intentLabel = intent.toLowerCase().replace('_', ' ');
      console.log(`${dim('intent:')} ${intentLabel}`);
      console.log(hint('/plan'));
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
