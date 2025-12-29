"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrate = orchestrate;
const commands_1 = require("./commands");
const session_1 = require("./session");
// Classify free text intent (rule-based, no model calls)
function classifyIntent(input) {
    const lower = input.toLowerCase().trim();
    // QUESTION patterns - explain, clarify, what/why/how questions
    const questionPatterns = [
        /^(what|why|how|when|where|who|explain|clarify|describe|tell me)/i,
        /\?$/,
        /^(is|are|can|could|would|should|do|does|did|has|have|will)\s/i,
        /(what is|what are|what does|how does|how do|how to|why does|why is)/i,
    ];
    if (questionPatterns.some(p => p.test(lower))) {
        return 'QUESTION';
    }
    // DEBUG patterns - fix, debug, error, bug, issue, broken, failing
    const debugPatterns = [
        /(fix|debug|error|bug|issue|broken|failing|crash|exception|problem|wrong|doesn'?t work|not working)/i,
        /(resolve|troubleshoot|diagnose|investigate)/i,
    ];
    if (debugPatterns.some(p => p.test(lower))) {
        return 'DEBUG';
    }
    // REFACTOR patterns - refactor, rename, reorganize, extract, move, restructure
    const refactorPatterns = [
        /(refactor|rename|reorganize|restructure|extract|move|split|merge|consolidate)/i,
        /(clean up|cleanup|simplify|optimize|improve structure)/i,
    ];
    if (refactorPatterns.some(p => p.test(lower))) {
        return 'REFACTOR';
    }
    // REVIEW patterns - review, analyze, audit, check, inspect, look at
    const reviewPatterns = [
        /(review|analyze|audit|check|inspect|examine|assess|evaluate)/i,
        /(look at|understand|read|show me)/i,
    ];
    if (reviewPatterns.some(p => p.test(lower))) {
        return 'REVIEW';
    }
    // CODE_EDIT patterns - add, create, implement, update, change, modify, write
    const codeEditPatterns = [
        /(add|create|implement|update|change|modify|write|build|make|generate)/i,
        /(new|feature|function|component|class|method|file|module)/i,
        /(edit|insert|append|remove|delete|replace)/i,
    ];
    if (codeEditPatterns.some(p => p.test(lower))) {
        return 'CODE_EDIT';
    }
    // Default: COMMAND (unclear, may need clarification)
    return 'COMMAND';
}
// Determine workflow based on intent
function determineWorkflow(intent, hasExistingIntent) {
    // All intent types map to capture_intent for now
    // The intent type is stored separately for later use
    return 'capture_intent';
}
// Handle the workflow
async function handleWorkflow(workflow, input, parsed, intent) {
    switch (workflow) {
        case 'slash_command':
            await (0, commands_1.executeCommand)(parsed);
            return { handled: true };
        case 'capture_intent':
            (0, session_1.setIntent)(input);
            (0, session_1.setIntentType)(intent);
            console.log(`Intent: ${intent}`);
            console.log('Use /plan to proceed.');
            return { handled: true };
        case 'append_context':
            const existing = (0, session_1.getIntent)();
            if (existing) {
                (0, session_1.setIntent)(`${existing}\n\nClarification: ${input}`);
                return { handled: true, message: 'Context appended to intent.' };
            }
            (0, session_1.setIntent)(input);
            return { handled: true, message: 'Intent recorded. Use /plan to proceed.' };
        case 'confirm_action':
            const session = (0, session_1.getSession)();
            if (session.pendingActions) {
                // There are pending actions - user might want to apply
                return { handled: true, message: 'Pending changes exist. Use /apply to execute or /diff to review.' };
            }
            return { handled: true, message: 'Nothing to confirm.' };
        case 'ignore':
            return { handled: true, message: 'Cancelled.' };
        default:
            return { handled: false };
    }
}
// Main orchestration entry point
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
    // Parse input
    const parsed = (0, commands_1.parseInput)(trimmed);
    // Slash commands bypass intent detection
    if (parsed.isSlashCommand) {
        await (0, commands_1.executeCommand)(parsed);
        return {
            inputType: 'slash',
            intent: 'COMMAND', // Not classified for slash commands
            workflow: 'slash_command',
            handled: true,
        };
    }
    // Free text goes through intent classification
    const intent = classifyIntent(trimmed);
    const hasExistingIntent = (0, session_1.getIntent)() !== null;
    const workflow = determineWorkflow(intent, hasExistingIntent);
    // Execute workflow
    const result = await handleWorkflow(workflow, trimmed, parsed, intent);
    // Print message if any
    if (result.message) {
        console.log(result.message);
    }
    return {
        inputType: 'free_text',
        intent,
        workflow,
        handled: result.handled,
        message: result.message,
    };
}
//# sourceMappingURL=orchestrator.js.map