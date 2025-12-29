"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.decomposeTask = decomposeTask;
exports.planCurrentStep = planCurrentStep;
exports.printProgress = printProgress;
exports.completeCurrentStep = completeCurrentStep;
exports.skipCurrentStep = skipCurrentStep;
const session_1 = require("./session");
const runtime_1 = require("./runtime");
const auth_1 = require("./auth");
const context_builder_1 = require("./context/context_builder");
const ui_1 = require("./ui");
const path = __importStar(require("path"));
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
};
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
};
// Decompose a large task into steps
async function decomposeTask() {
    const session = (0, session_1.getSession)();
    const intent = (0, session_1.getIntent)();
    if (!intent) {
        return { success: false, steps: [], message: 'No intent set.' };
    }
    const apiKey = await (0, auth_1.ensureAuthenticated)();
    // Build context
    const context = (0, context_builder_1.buildContext)(session.workingDirectory, intent, (0, session_1.getIntentType)() || 'COMMAND', session.openFiles.map(f => path.isAbsolute(f) ? f : path.join(session.workingDirectory, f)));
    const filesContext = (0, context_builder_1.formatContextForModel)(context);
    const instruction = `Break down this task into discrete, sequential steps.
Each step should be a single, focused unit of work.

Task: ${intent}
Mode: ${session.mode}
Working directory: ${session.workingDirectory}

${filesContext}

Output 2-5 steps. Each step should have an id (step1, step2, ...) and a clear description.
Order steps by dependency - prerequisites first.`;
    const result = await (0, runtime_1.execute)({
        instruction,
        schema: TASK_DECOMPOSITION_SCHEMA,
        enforceSchema: true,
    }, apiKey);
    if (!result.success) {
        return { success: false, steps: [], message: `Decomposition failed: ${result.error}` };
    }
    const response = result.output;
    if (response.status === 'error' || !response.steps) {
        return { success: false, steps: [], message: `Decomposition failed: ${response.error}` };
    }
    const taskSteps = response.steps.map(s => ({
        id: s.id,
        description: s.description,
        status: 'pending',
    }));
    (0, session_1.setTaskSteps)(taskSteps);
    return { success: true, steps: taskSteps, message: `Task decomposed into ${taskSteps.length} steps.` };
}
// Plan current step
async function planCurrentStep() {
    const step = (0, session_1.getCurrentStep)();
    if (!step) {
        return { success: false, message: 'No current step. Use /decompose first.' };
    }
    const session = (0, session_1.getSession)();
    const apiKey = await (0, auth_1.ensureAuthenticated)();
    const context = (0, context_builder_1.buildContext)(session.workingDirectory, step.description, (0, session_1.getIntentType)() || 'COMMAND', session.openFiles.map(f => path.isAbsolute(f) ? f : path.join(session.workingDirectory, f)));
    const filesContext = (0, context_builder_1.formatContextForModel)(context);
    const instruction = `Create a plan for this step:

Step: ${step.description}
Overall task: ${(0, session_1.getIntent)()}
Mode: ${session.mode}

${filesContext}

Output a detailed plan for this step only.`;
    const result = await (0, runtime_1.execute)({
        instruction,
        schema: PLAN_RESPONSE_SCHEMA,
        enforceSchema: true,
    }, apiKey);
    if (!result.success) {
        return { success: false, message: `Planning failed: ${result.error}` };
    }
    const response = result.output;
    if (response.status === 'error' || !response.plan) {
        return { success: false, message: `Planning failed: ${response.error}` };
    }
    step.plan = response.plan.map(p => ({
        id: p.id,
        description: p.description,
        status: 'pending',
    }));
    (0, session_1.setLastPlan)(step.plan);
    (0, session_1.updateStepStatus)(step.id, 'planned');
    return { success: true, message: `Step ${step.id} planned.` };
}
// Print step progress
function printProgress() {
    const session = (0, session_1.getSession)();
    const progress = (0, session_1.getStepProgress)();
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
            ? (0, ui_1.dim)(marker)
            : isCurrent
                ? (0, ui_1.info)(marker)
                : (0, ui_1.dim)(marker);
        console.log(`${prefix} ${step.id}: ${step.description}`);
    }
}
// Mark current step complete and advance
function completeCurrentStep() {
    const step = (0, session_1.getCurrentStep)();
    if (!step) {
        return { success: false, hasMore: false, message: 'No current step.' };
    }
    (0, session_1.updateStepStatus)(step.id, 'applied');
    const nextStep = (0, session_1.advanceStep)();
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
function skipCurrentStep() {
    const step = (0, session_1.getCurrentStep)();
    if (!step) {
        return { success: false, hasMore: false, message: 'No current step.' };
    }
    (0, session_1.updateStepStatus)(step.id, 'skipped');
    const nextStep = (0, session_1.advanceStep)();
    if (nextStep) {
        return {
            success: true,
            hasMore: true,
            message: `Step ${step.id} skipped. Next: ${nextStep.description}`,
        };
    }
    return { success: true, hasMore: false, message: 'All steps complete.' };
}
//# sourceMappingURL=task_runner.js.map