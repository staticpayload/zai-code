import { getSession, getIntent, getIntentType, setLastPlan, setLastDiff, setPendingActions, PlanStep } from './session';
import { execute, ResponseSchema } from './runtime';
import { ensureAuthenticated } from './auth';
import { getFileContent } from './workspace';
import { PLAN_SCHEMA } from './session';
import { success, error } from './ui';
import * as path from 'path';
import { buildContext, formatContextForModel } from './context/context_builder';
import { buildSystemPrompt } from './mode_prompts';

// Planner configuration
const MAX_PLAN_ITERATIONS = 5;
const MAX_REFINE_ITERATIONS = 3;

export interface PlannerResult {
  success: boolean;
  iterations: number;
  plan: PlanStep[] | null;
  message: string;
  needsConfirmation: boolean;
}

export interface GenerateResult {
  success: boolean;
  iterations: number;
  changes: ResponseSchema | null;
  message: string;
  needsConfirmation: boolean;
}

// Check if plan is satisfactory (basic heuristics)
function isPlanSatisfactory(plan: PlanStep[]): boolean {
  // Plan must have at least one step
  if (!plan || plan.length === 0) {
    return false;
  }
  // Each step must have a description
  return plan.every(step => step.description && step.description.trim().length > 0);
}

// Check if generated changes are valid
function areChangesValid(response: ResponseSchema): boolean {
  // Must have either files or diffs
  const hasFiles = (response.files?.length ?? 0) > 0;
  const hasDiffs = (response.diffs?.length ?? 0) > 0;
  return hasFiles || hasDiffs;
}

// Run bounded planning loop
export async function runPlannerLoop(): Promise<PlannerResult> {
  const session = getSession();
  const intent = getIntent();

  if (!intent) {
    return {
      success: false,
      iterations: 0,
      plan: null,
      message: 'No intent set. Enter a task first.',
      needsConfirmation: false,
    };
  }

  const apiKey = await ensureAuthenticated();
  let iterations = 0;
  let currentPlan: PlanStep[] | null = null;

  // Build context from workspace
  const context = buildContext(
    session.workingDirectory,
    intent,
    getIntentType() || 'COMMAND',
    session.openFiles.map(f => path.join(session.workingDirectory, f))
  );
  const filesContext = formatContextForModel(context);

  // Bounded planning loop
  while (iterations < MAX_PLAN_ITERATIONS) {
    iterations++;

    const modeSystemPrompt = buildSystemPrompt(session.mode, session.workingDirectory);

    const instruction = `${modeSystemPrompt}

Create a plan for the following task.

Task: ${intent}
Intent Type: ${getIntentType() || 'COMMAND'}

Working directory: ${session.workingDirectory}

${filesContext ? `Files in context:\n${filesContext}` : 'No files in context.'}

${currentPlan ? `Previous plan needs refinement:\n${currentPlan.map(s => `${s.id}. ${s.description}`).join('\n')}` : ''}

Output a plan with numbered steps. Each step should have an id, description, and optionally list affected files.`;

    const result = await execute({
      instruction,
      schema: PLAN_SCHEMA,
      enforceSchema: true,
    }, apiKey);

    if (!result.success) {
      return {
        success: false,
        iterations,
        plan: null,
        message: `Planning failed: ${result.error}`,
        needsConfirmation: false,
      };
    }

    const response = result.output as { status: string; plan?: Array<{ id: string; description: string }>; error?: string };

    if (response.status === 'error') {
      return {
        success: false,
        iterations,
        plan: null,
        message: `Planning failed: ${response.error}`,
        needsConfirmation: false,
      };
    }

    if (response.plan) {
      currentPlan = response.plan.map(step => ({
        id: step.id,
        description: step.description,
        status: 'pending' as const,
      }));

      // Check if plan is satisfactory
      if (isPlanSatisfactory(currentPlan)) {
        setLastPlan(currentPlan);
        return {
          success: true,
          iterations,
          plan: currentPlan,
          message: `Plan generated in ${iterations} iteration(s).`,
          needsConfirmation: true,
        };
      }
    }

    // Plan not satisfactory, will refine in next iteration
    console.log(`Iteration ${iterations}: Refining plan...`);
  }

  // Max iterations reached
  if (currentPlan) {
    setLastPlan(currentPlan);
  }

  return {
    success: currentPlan !== null,
    iterations,
    plan: currentPlan,
    message: `Max iterations (${MAX_PLAN_ITERATIONS}) reached.`,
    needsConfirmation: currentPlan !== null,
  };
}

// Run bounded generation loop
export async function runGenerateLoop(): Promise<GenerateResult> {
  const session = getSession();
  const intent = getIntent();

  if (!intent) {
    return {
      success: false,
      iterations: 0,
      changes: null,
      message: 'No intent set. Enter a task first.',
      needsConfirmation: false,
    };
  }

  if (!session.lastPlan || session.lastPlan.length === 0) {
    return {
      success: false,
      iterations: 0,
      changes: null,
      message: 'No plan generated. Use /plan first.',
      needsConfirmation: false,
    };
  }

  const apiKey = await ensureAuthenticated();
  let iterations = 0;
  let currentChanges: ResponseSchema | null = null;

  // Build context from workspace
  const context = buildContext(
    session.workingDirectory,
    intent,
    getIntentType() || 'COMMAND',
    session.openFiles.map(f => path.join(session.workingDirectory, f))
  );
  const filesContext = formatContextForModel(context);

  const planSummary = session.lastPlan.map(step => `${step.id}. ${step.description}`).join('\n');

  // Bounded generation loop
  while (iterations < MAX_REFINE_ITERATIONS) {
    iterations++;

    const modeSystemPrompt = buildSystemPrompt(session.mode, session.workingDirectory);

    const instruction = `${modeSystemPrompt}

Execute the following plan and output file changes.

Task: ${intent}

Plan:
${planSummary}

Working directory: ${session.workingDirectory}

${filesContext ? `Files:\n${filesContext}` : ''}

${currentChanges ? 'Previous output was invalid. Output valid file operations.' : ''}

Output file operations with exact paths and content. Use status, files array (with path, operation, content), or diffs array.`;

    const result = await execute({
      instruction,
      enforceSchema: true,
    }, apiKey);

    if (!result.success) {
      return {
        success: false,
        iterations,
        changes: null,
        message: `Generation failed: ${result.error}`,
        needsConfirmation: false,
      };
    }

    const response = result.output as ResponseSchema;

    if (areChangesValid(response)) {
      setLastDiff(response);
      setPendingActions(response);
      return {
        success: true,
        iterations,
        changes: response,
        message: `Changes generated in ${iterations} iteration(s).`,
        needsConfirmation: true,
      };
    }

    currentChanges = response;
    console.log(`Iteration ${iterations}: Refining output...`);
  }

  // Max iterations reached
  return {
    success: false,
    iterations,
    changes: currentChanges,
    message: `Max iterations (${MAX_REFINE_ITERATIONS}) reached. No valid changes generated.`,
    needsConfirmation: false,
  };
}

// Export constants
export { MAX_PLAN_ITERATIONS, MAX_REFINE_ITERATIONS };
