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
exports.MAX_REFINE_ITERATIONS = exports.MAX_PLAN_ITERATIONS = void 0;
exports.runPlannerLoop = runPlannerLoop;
exports.runGenerateLoop = runGenerateLoop;
const session_1 = require("./session");
const runtime_1 = require("./runtime");
const auth_1 = require("./auth");
const session_2 = require("./session");
const path = __importStar(require("path"));
const context_builder_1 = require("./context/context_builder");
const mode_prompts_1 = require("./mode_prompts");
// Planner configuration
const MAX_PLAN_ITERATIONS = 5;
exports.MAX_PLAN_ITERATIONS = MAX_PLAN_ITERATIONS;
const MAX_REFINE_ITERATIONS = 3;
exports.MAX_REFINE_ITERATIONS = MAX_REFINE_ITERATIONS;
// Check if plan is satisfactory (basic heuristics)
function isPlanSatisfactory(plan) {
    // Plan must have at least one step
    if (!plan || plan.length === 0) {
        return false;
    }
    // Each step must have a description
    return plan.every(step => step.description && step.description.trim().length > 0);
}
// Check if generated changes are valid
function areChangesValid(response) {
    // Must have either files or diffs
    const hasFiles = (response.files?.length ?? 0) > 0;
    const hasDiffs = (response.diffs?.length ?? 0) > 0;
    return hasFiles || hasDiffs;
}
// Run bounded planning loop
async function runPlannerLoop() {
    const session = (0, session_1.getSession)();
    const intent = (0, session_1.getIntent)();
    if (!intent) {
        return {
            success: false,
            iterations: 0,
            plan: null,
            message: 'No intent set. Enter a task first.',
            needsConfirmation: false,
        };
    }
    let apiKey;
    try {
        apiKey = await (0, auth_1.ensureAuthenticated)();
    }
    catch (e) {
        return {
            success: false,
            iterations: 0,
            plan: null,
            message: `Authentication failed: ${e?.message || e}`,
            needsConfirmation: false,
        };
    }
    if (!apiKey) {
        return {
            success: false,
            iterations: 0,
            plan: null,
            message: 'No API key configured. Run /doctor or zcode auth.',
            needsConfirmation: false,
        };
    }
    let iterations = 0;
    let currentPlan = null;
    // Build context from workspace
    const context = (0, context_builder_1.buildContext)(session.workingDirectory, intent, (0, session_1.getIntentType)() || 'COMMAND', session.openFiles.map(f => path.join(session.workingDirectory, f)));
    const filesContext = (0, context_builder_1.formatContextForModel)(context);
    // Bounded planning loop
    while (iterations < MAX_PLAN_ITERATIONS) {
        iterations++;
        const modeSystemPrompt = (0, mode_prompts_1.buildSystemPrompt)(session.mode, session.workingDirectory);
        const instruction = `${modeSystemPrompt}

Create a plan for the following task.

Task: ${intent}
Intent Type: ${(0, session_1.getIntentType)() || 'COMMAND'}

Working directory: ${session.workingDirectory}

${filesContext ? `Files in context:\n${filesContext}` : 'No files in context.'}

${currentPlan ? `Previous plan needs refinement:\n${currentPlan.map(s => `${s.id}. ${s.description}`).join('\n')}` : ''}

Output a plan with numbered steps. Each step should have an id, description, and optionally list affected files.`;
        const result = await (0, runtime_1.execute)({
            instruction,
            schema: session_2.PLAN_SCHEMA,
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
        const response = result.output;
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
                status: 'pending',
            }));
            // Check if plan is satisfactory
            if (isPlanSatisfactory(currentPlan)) {
                (0, session_1.setLastPlan)(currentPlan);
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
        (0, session_1.setLastPlan)(currentPlan);
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
async function runGenerateLoop() {
    const session = (0, session_1.getSession)();
    const intent = (0, session_1.getIntent)();
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
    let apiKey;
    try {
        apiKey = await (0, auth_1.ensureAuthenticated)();
    }
    catch (e) {
        return {
            success: false,
            iterations: 0,
            changes: null,
            message: `Authentication failed: ${e?.message || e}`,
            needsConfirmation: false,
        };
    }
    if (!apiKey) {
        return {
            success: false,
            iterations: 0,
            changes: null,
            message: 'No API key configured. Run /doctor or zcode auth.',
            needsConfirmation: false,
        };
    }
    let iterations = 0;
    let currentChanges = null;
    // Build context from workspace
    const context = (0, context_builder_1.buildContext)(session.workingDirectory, intent, (0, session_1.getIntentType)() || 'COMMAND', session.openFiles.map(f => path.join(session.workingDirectory, f)));
    const filesContext = (0, context_builder_1.formatContextForModel)(context);
    const planSummary = session.lastPlan.map(step => `${step.id}. ${step.description}`).join('\n');
    // Bounded generation loop
    while (iterations < MAX_REFINE_ITERATIONS) {
        iterations++;
        const modeSystemPrompt = (0, mode_prompts_1.buildSystemPrompt)(session.mode, session.workingDirectory);
        const instruction = `${modeSystemPrompt}

Execute the following plan and output file changes.

Task: ${intent}

Plan:
${planSummary}

Working directory: ${session.workingDirectory}

${filesContext ? `Files:\n${filesContext}` : ''}

${currentChanges ? 'Previous output was invalid. Output valid file operations.' : ''}

Output file operations with exact paths and content. Use status, files array (with path, operation, content), or diffs array.`;
        const result = await (0, runtime_1.execute)({
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
        const response = result.output;
        if (areChangesValid(response)) {
            (0, session_1.setLastDiff)(response);
            (0, session_1.setPendingActions)(response);
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
//# sourceMappingURL=planner.js.map