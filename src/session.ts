import { ResponseSchema } from './runtime';
import { ExecResult } from './shell';

// Intent types for free-text input
export type IntentType =
  | 'QUESTION'    // explain, clarify, ask about code
  | 'CODE_EDIT'   // modify files, add features, implement
  | 'REFACTOR'    // structural change, rename, reorganize
  | 'DEBUG'       // fix error, resolve bug, troubleshoot
  | 'REVIEW'      // analyze, audit, check, inspect existing code
  | 'COMMAND';    // unclear intent, needs clarification

export const PLAN_SCHEMA = {
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

export type SessionMode = 'edit' | 'ask' | 'explain' | 'review' | 'debug' | 'auto';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'complete' | 'failed';
}

// Task step for multi-step execution
export interface TaskStep {
  id: string;
  description: string;
  status: 'pending' | 'planned' | 'generated' | 'applied' | 'skipped';
  plan?: PlanStep[];
  diff?: ResponseSchema;
}

export interface SessionState {
  // Open files in context
  openFiles: string[];

  // Last generated plan
  lastPlan: PlanStep[] | null;

  // Last generated diff from model
  lastDiff: ResponseSchema | null;

  // Pending actions to apply
  pendingActions: ResponseSchema | null;

  // Current mode
  mode: SessionMode;

  // Dry run flag - if true, don't apply changes
  dryRun: boolean;

  // Working directory
  workingDirectory: string;

  // Current intent (task to accomplish)
  currentIntent: string | null;

  // Classified intent type
  intentType: IntentType | null;

  // Last shell command execution result
  lastExecResult: ExecResult | null;

  // Multi-step task tracking
  taskSteps: TaskStep[];
  currentStepIndex: number;
}

// Get default mode from settings (lazy load to avoid circular dependency)
function getDefaultModeFromSettings(): SessionMode {
  try {
    // Dynamic import to avoid circular dependency
    const { getDefaultMode } = require('./settings');
    return getDefaultMode() as SessionMode;
  } catch {
    return 'edit';
  }
}

// Create a new session state
export function createSession(workingDirectory?: string): SessionState {
  return {
    openFiles: [],
    lastPlan: null,
    lastDiff: null,
    pendingActions: null,
    mode: getDefaultModeFromSettings(),
    dryRun: false,
    workingDirectory: workingDirectory || process.cwd(),
    currentIntent: null,
    intentType: null,
    lastExecResult: null,
    taskSteps: [],
    currentStepIndex: 0,
  };
}

// Global session instance
let currentSession: SessionState | null = null;

// Get or create the current session
export function getSession(): SessionState {
  if (!currentSession) {
    currentSession = createSession();
  }
  return currentSession;
}

// Initialize session with a specific working directory
export function initSession(workingDirectory: string): SessionState {
  currentSession = createSession(workingDirectory);
  return currentSession;
}

// Reset the session to initial state
export function resetSession(): void {
  const workingDir = currentSession?.workingDirectory;
  currentSession = createSession(workingDir);
}

// Session mutation helpers
export function addOpenFile(path: string): void {
  const session = getSession();
  if (!session.openFiles.includes(path)) {
    session.openFiles.push(path);
  }
}

export function removeOpenFile(path: string): void {
  const session = getSession();
  session.openFiles = session.openFiles.filter(f => f !== path);
}

export function clearOpenFiles(): void {
  getSession().openFiles = [];
}

export function setLastPlan(plan: PlanStep[] | null): void {
  getSession().lastPlan = plan;
}

export function setLastDiff(diff: ResponseSchema | null): void {
  getSession().lastDiff = diff;
}

export function setPendingActions(actions: ResponseSchema | null): void {
  getSession().pendingActions = actions;
}

export function setMode(mode: SessionMode): void {
  getSession().mode = mode;
}

export function setDryRun(enabled: boolean): void {
  getSession().dryRun = enabled;
}

export function getMode(): SessionMode {
  return getSession().mode;
}

export function isDryRun(): boolean {
  return getSession().dryRun;
}

export function setIntent(intent: string): void {
  getSession().currentIntent = intent;
}

export function getIntent(): string | null {
  return getSession().currentIntent;
}

export function clearIntent(): void {
  getSession().currentIntent = null;
}

export function setIntentType(type: IntentType): void {
  getSession().intentType = type;
}

export function getIntentType(): IntentType | null {
  return getSession().intentType;
}

export function setLastExecResult(result: ExecResult): void {
  getSession().lastExecResult = result;
}

export function getLastExecResult(): ExecResult | null {
  return getSession().lastExecResult;
}

// Multi-step task helpers
export function setTaskSteps(steps: TaskStep[]): void {
  const session = getSession();
  session.taskSteps = steps;
  session.currentStepIndex = 0;
}

export function getTaskSteps(): TaskStep[] {
  return getSession().taskSteps;
}

export function getCurrentStep(): TaskStep | null {
  const session = getSession();
  if (session.taskSteps.length === 0) return null;
  if (session.currentStepIndex >= session.taskSteps.length) return null;
  return session.taskSteps[session.currentStepIndex];
}

export function advanceStep(): TaskStep | null {
  const session = getSession();
  session.currentStepIndex++;
  return getCurrentStep();
}

export function updateStepStatus(stepId: string, status: TaskStep['status']): void {
  const session = getSession();
  const step = session.taskSteps.find(s => s.id === stepId);
  if (step) {
    step.status = status;
  }
}

export function getStepProgress(): { current: number; total: number; completed: number } {
  const session = getSession();
  const completed = session.taskSteps.filter(s => s.status === 'applied' || s.status === 'skipped').length;
  return {
    current: session.currentStepIndex + 1,
    total: session.taskSteps.length,
    completed,
  };
}
