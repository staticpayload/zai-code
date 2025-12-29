"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrate = orchestrate;
const commands_1 = require("./commands");
const session_1 = require("./session");
const ui_1 = require("./ui");
const runtime_1 = require("./runtime");
const auth_1 = require("./auth");
const agents_1 = require("./agents");
// Intent classification (rule-based, no model)
function classifyIntent(input) {
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
function determineWorkflow(intent, hasExistingIntent) {
    const mode = (0, session_1.getMode)();
    // In ask mode, treat all input as questions
    if (mode === 'ask') {
        return 'ask_question';
    }
    return 'capture_intent';
}
// Handle question in ask mode (read-only, direct answer)
async function handleAskQuestion(input) {
    try {
        const apiKey = await (0, auth_1.ensureAuthenticated)();
        const session = (0, session_1.getSession)();
        const agentsContext = (0, agents_1.getAgentsContext)(session.workingDirectory);
        const instruction = `You are in READ-ONLY mode. Answer this question briefly and directly. 
Do NOT suggest code changes. Do NOT plan modifications. Just explain.
${agentsContext}
Question: ${input}`;
        const result = await (0, runtime_1.execute)({ instruction }, apiKey);
        if (result.success && result.output) {
            const response = result.output;
            console.log(response.explanation || response.message || 'No answer available.');
        }
        else {
            console.log((0, ui_1.error)(`Failed: ${result.error}`));
        }
        return { handled: true };
    }
    catch (e) {
        console.log((0, ui_1.error)(`Error: ${e}`));
        return { handled: true };
    }
}
// Handle workflow
async function handleWorkflow(workflow, input, parsed, intent) {
    switch (workflow) {
        case 'slash_command':
            await (0, commands_1.executeCommand)(parsed);
            return { handled: true };
        case 'ask_question':
            return handleAskQuestion(input);
        case 'capture_intent':
            (0, session_1.setIntent)(input);
            (0, session_1.setIntentType)(intent);
            // Clear, minimal output with next action
            const intentLabel = intent.toLowerCase().replace('_', ' ');
            console.log(`${(0, ui_1.dim)('intent:')} ${intentLabel}`);
            console.log((0, ui_1.hint)('/plan'));
            return { handled: true };
        case 'append_context':
            const existing = (0, session_1.getIntent)();
            if (existing) {
                (0, session_1.setIntent)(`${existing}\n\nClarification: ${input}`);
                console.log((0, ui_1.dim)('Context updated.'));
                console.log((0, ui_1.hint)('/plan'));
                return { handled: true };
            }
            (0, session_1.setIntent)(input);
            console.log((0, ui_1.dim)('Intent captured.'));
            console.log((0, ui_1.hint)('/plan'));
            return { handled: true };
        case 'confirm_action':
            const session = (0, session_1.getSession)();
            if (session.pendingActions) {
                console.log((0, ui_1.hint)('/diff or /apply'));
                return { handled: true };
            }
            console.log((0, ui_1.dim)('Nothing pending.'));
            return { handled: true };
        case 'ignore':
            return { handled: true };
        default:
            return { handled: false };
    }
}
// Main orchestration entry
async function orchestrate(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return {
            inputType: 'free_text',
            intent: 'COMMAND',
            workflow: 'ignore',
            handled: true,
        };
    }
    const parsed = (0, commands_1.parseInput)(trimmed);
    // Slash commands
    if (parsed.isSlashCommand) {
        await (0, commands_1.executeCommand)(parsed);
        return {
            inputType: 'slash',
            intent: 'COMMAND',
            workflow: 'slash_command',
            handled: true,
        };
    }
    // Free text - classify and capture
    const intent = classifyIntent(trimmed);
    const hasExistingIntent = (0, session_1.getIntent)() !== null;
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
//# sourceMappingURL=orchestrator.js.map