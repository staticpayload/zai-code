import {
  getSession,
  TaskStep,
  setTaskSteps,
  getCurrentStep,
  advanceStep,
  updateStepStatus,
  getStepProgress,
  getIntent,
  getIntentType,
  setLastPlan,
  setPendingActions,
  PlanStep,
} from './session';
import { execute, ResponseSchema } from './runtime';
import { ensureAuthenticated } from './auth';
import { buildContext, formatContextForModel } from './context/context_builder';
import { success, error, info, dim } from './ui';
import * as path from 'path';

// Task decomposition schema
const TASK_DECOMPOSITION_SCHEMA = {
  type: 'object',
  required: ['status', 'steps'],
  properties: {
    status: { type: 'string', enum: ['success', 'error'] },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'description'],
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          dependencies: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    error: { type: 'string' },
  },
} as const;

// Plan response schema
const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['status', 'plan'],
  properties: {
    status: { type: 'string', enum: ['success', 'error'] },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'description'],
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    error: { type: 'string' },
  },
} as const;

// Decompose a large task into steps
export async function decomposeTask(): Promise<{ success: boolean; steps: TaskStep[]; message: string }> {
  const session = getSession();
  const intent = getIntent();

  if (!intent) {
    return { success: false, steps: [], message: 'No intent set.' };
  }

  let apiKey: string;
  try {
    apiKey = await ensureAuthenticated();
    if (!apiKey) {
      return { success: false, steps: [], message: 'No API key configured. Run zcode auth.' };
    }
  } catch (e: any) {
    return { success: false, steps: [], message: `Authentication failed: ${e?.message || e}` };
  }

  // Build context
  const context = buildContext(
    session.workingDirectory,
    intent,
    getIntentType() || 'COMMAND',
    session.openFiles.map(f => path.isAbsolute(f) ? f : path.join(session.workingDirectory, f))
  );
  const filesContext = formatContextForModel(context);

  const instruction = `Break down this task into discrete, sequential steps.
Each step should be a single, focused unit of work.

Task: ${intent}
Mode: ${session.mode}
Working directory: ${session.workingDirectory}

${filesContext}

Output 2-5 steps. Each step should have an id (step1, step2, ...) and a clear description.
Order steps by dependency - prerequisites first.`;

  const result = await execute({
    instruction,
    schema: TASK_DECOMPOSITION_SCHEMA,
    enforceSchema: true,
  }, apiKey);

  if (!result.success) {
    return { success: false, steps: [], message: `Decomposition failed: ${result.error}` };
  }

  const response = result.output as { status: string; steps?: Array<{ id: string; description: string }>; error?: string };

  if (response.status === 'error' || !response.steps) {
    return { success: false, steps: [], message: `Decomposition failed: ${response.error}` };
  }

  const taskSteps: TaskStep[] = response.steps.map(s => ({
    id: s.id,
    description: s.description,
    status: 'pending' as const,
  }));

  setTaskSteps(taskSteps);

  return { success: true, steps: taskSteps, message: `Task decomposed into ${taskSteps.length} steps.` };
}

// Plan current step
export async function planCurrentStep(): Promise<{ success: boolean; message: string }> {
  const step = getCurrentStep();

  if (!step) {
    return { success: false, message: 'No current step. Use /decompose first.' };
  }

  const session = getSession();
  
  let apiKey: string;
  try {
    apiKey = await ensureAuthenticated();
    if (!apiKey) {
      return { success: false, message: 'No API key configured. Run zcode auth.' };
    }
  } catch (e: any) {
    return { success: false, message: `Authentication failed: ${e?.message || e}` };
  }

  const context = buildContext(
    session.workingDirectory,
    step.description,
    getIntentType() || 'COMMAND',
    session.openFiles.map(f => path.isAbsolute(f) ? f : path.join(session.workingDirectory, f))
  );
  const filesContext = formatContextForModel(context);

  const instruction = `Create a plan for this step:

Step: ${step.description}
Overall task: ${getIntent()}
Mode: ${session.mode}

${filesContext}

Output a detailed plan for this step only.`;

  const result = await execute({
    instruction,
    schema: PLAN_RESPONSE_SCHEMA,
    enforceSchema: true,
  }, apiKey);

  if (!result.success) {
    return { success: false, message: `Planning failed: ${result.error}` };
  }

  const response = result.output as { status: string; plan?: Array<{ id: string; description: string }>; error?: string };

  if (response.status === 'error' || !response.plan) {
    return { success: false, message: `Planning failed: ${response.error}` };
  }

  step.plan = response.plan.map(p => ({
    id: p.id,
    description: p.description,
    status: 'pending' as const,
  }));

  setLastPlan(step.plan);
  updateStepStatus(step.id, 'planned');

  return { success: true, message: `Step ${step.id} planned.` };
}

// Print step progress
export function printProgress(): void {
  const session = getSession();
  const progress = getStepProgress();

  if (session.taskSteps.length === 0) {
    console.log('No task decomposed.');
    return;
  }

  console.log(`Progress: Step ${progress.current}/${progress.total} (${progress.completed} completed)`);
  console.log('');

  for (let i = 0; i < session.taskSteps.length; i++) {
    const step = session.taskSteps[i];
    const isCurrent = i === session.currentStepIndex;
    const marker = step.status === 'applied' ? '[x]'
      : step.status === 'skipped' ? '[-]'
      : isCurrent ? '[>]'
      : '[ ]';
    const prefix = step.status === 'applied' || step.status === 'skipped'
      ? dim(marker)
      : isCurrent
      ? info(marker)
      : dim(marker);
    console.log(`${prefix} ${step.id}: ${step.description}`);
  }
}

// Mark current step complete and advance
export function completeCurrentStep(): { success: boolean; hasMore: boolean; message: string } {
  const step = getCurrentStep();

  if (!step) {
    return { success: false, hasMore: false, message: 'No current step.' };
  }

  updateStepStatus(step.id, 'applied');
  const nextStep = advanceStep();

  if (nextStep) {
    return {
      success: true,
      hasMore: true,
      message: `Step ${step.id} complete. Next: ${nextStep.description}`,
    };
  }

  return { success: true, hasMore: false, message: 'All steps complete.' };
}

// Skip current step
export function skipCurrentStep(): { success: boolean; hasMore: boolean; message: string } {
  const step = getCurrentStep();

  if (!step) {
    return { success: false, hasMore: false, message: 'No current step.' };
  }

  updateStepStatus(step.id, 'skipped');
  const nextStep = advanceStep();

  if (nextStep) {
    return {
      success: true,
      hasMore: true,
      message: `Step ${step.id} skipped. Next: ${nextStep.description}`,
    };
  }

  return { success: true, hasMore: false, message: 'All steps complete.' };
}
