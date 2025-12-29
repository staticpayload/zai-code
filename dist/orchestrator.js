"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrate = orchestrate;
const commands_1 = require("./commands");
const session_1 = require("./session");
const ui_1 = require("./ui");
const runtime_1 = require("./runtime");
const auth_1 = require("./auth");
const mode_prompts_1 = require("./mode_prompts");
const apply_1 = require("./apply");
// Helper to extract meaningful text from API response
function extractTextFromResponse(response) {
    if (typeof response === 'string') {
        // Strip markdown code blocks
        let text = response;
        text = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '');
        // Try to parse as JSON and extract explanation
        try {
            const parsed = JSON.parse(text);
            if (parsed.explanation)
                return parsed.explanation;
            if (parsed.output)
                return parsed.output;
            if (parsed.message)
                return parsed.message;
            if (parsed.summary)
                return parsed.summary;
            if (parsed.status === 'error' && parsed.explanation)
                return parsed.explanation;
        }
        catch {
            // Not JSON, return as-is
        }
        return text.trim();
    }
    if (typeof response === 'object' && response !== null) {
        const obj = response;
        if (obj.explanation)
            return String(obj.explanation);
        if (obj.output)
            return String(obj.output);
        if (obj.message)
            return String(obj.message);
        if (obj.summary)
            return String(obj.summary);
        return JSON.stringify(response, null, 2);
    }
    return String(response);
}
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
async function handleAskQuestion(input) {
    try {
        let apiKey;
        try {
            apiKey = await (0, auth_1.ensureAuthenticated)();
        }
        catch (authError) {
            console.log((0, ui_1.error)(`Authentication required: ${authError?.message || 'Run zcode auth'}`));
            return { handled: true };
        }
        if (!apiKey) {
            console.log((0, ui_1.error)('No API key configured. Run "zcode auth" to set up.'));
            return { handled: true };
        }
        const session = (0, session_1.getSession)();
        const mode = (0, session_1.getMode)();
        const modePrompt = (0, mode_prompts_1.buildSystemPrompt)(mode, session.workingDirectory);
        const instruction = `${modePrompt}

User input: ${input}

Respond directly and concisely.`;
        console.log((0, ui_1.dim)('Thinking...'));
        const result = await (0, runtime_1.execute)({ instruction, enforceSchema: false }, apiKey);
        if (result.success && result.output) {
            const text = extractTextFromResponse(result.output);
            console.log(text);
        }
        else {
            console.log((0, ui_1.error)(`Failed: ${result.error || 'Unknown error'}`));
        }
        return { handled: true };
    }
    catch (e) {
        console.log((0, ui_1.error)(`Error: ${e?.message || e}`));
        return { handled: true };
    }
}
// Handle auto execution - plan, generate, and apply in one go
async function handleAutoExecute(input) {
    try {
        let apiKey;
        try {
            apiKey = await (0, auth_1.ensureAuthenticated)();
        }
        catch (authError) {
            console.log((0, ui_1.error)(`Authentication required: ${authError?.message || 'Run zcode auth'}`));
            return { handled: true };
        }
        if (!apiKey) {
            console.log((0, ui_1.error)('No API key configured. Run "zcode auth" to set up.'));
            return { handled: true };
        }
        const session = (0, session_1.getSession)();
        const modePrompt = (0, mode_prompts_1.buildSystemPrompt)('auto', session.workingDirectory);
        console.log((0, ui_1.info)('Executing autonomously...'));
        const instruction = `${modePrompt}

Task: ${input}

Execute this task. If it requires code changes, provide the file operations.
If it's a question, answer it directly.
Be decisive and complete the task.`;
        const result = await (0, runtime_1.execute)({ instruction }, apiKey);
        if (result.success && result.output) {
            const response = result.output;
            // Check if there are file operations
            if (response.files && response.files.length > 0) {
                console.log((0, ui_1.success)(`Applying ${response.files.length} file(s)...`));
                for (const file of response.files) {
                    try {
                        const result = (0, apply_1.applyFileOperation)(file.operation, file.path, file.content);
                        if (result.success) {
                            console.log((0, ui_1.success)(`${file.operation}: ${file.path}`));
                        }
                        else {
                            console.log((0, ui_1.error)(`Failed ${file.path}: ${result.error}`));
                        }
                    }
                    catch (e) {
                        console.log((0, ui_1.error)(`Failed ${file.path}: ${e?.message}`));
                    }
                }
            }
            // Show output
            const text = extractTextFromResponse(result.output);
            if (text && text !== '{}') {
                console.log('');
                console.log(text);
            }
        }
        else {
            console.log((0, ui_1.error)(`Failed: ${result.error || 'Unknown error'}`));
        }
        return { handled: true };
    }
    catch (e) {
        console.log((0, ui_1.error)(`Error: ${e?.message || e}`));
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
        case 'auto_execute':
            return handleAutoExecute(input);
        case 'capture_intent':
            (0, session_1.setIntent)(input);
            (0, session_1.setIntentType)(intent);
            // Provide clear feedback about what was captured
            const intentLabel = intent.toLowerCase().replace('_', ' ');
            console.log(`Task captured: "${input.substring(0, 60)}${input.length > 60 ? '...' : ''}"`);
            console.log(`Type: ${intentLabel}`);
            console.log('');
            console.log((0, ui_1.hint)('Type /plan to create execution plan'));
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