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
exports.orchestrate = orchestrate;
const commands_1 = require("./commands");
const session_1 = require("./session");
const ui_1 = require("./ui");
const runtime_1 = require("./runtime");
const auth_1 = require("./auth");
const apply_1 = require("./apply");
// Analyze task to determine best execution strategy
function analyzeTask(input) {
    const lower = input.toLowerCase().trim();
    const words = lower.split(/\s+/);
    const wordCount = words.length;
    // CHAT - greetings, small talk
    const chatPatterns = [
        /^h+i+!*$/i, /^he+y+!*$/i, /^y+o+!*$/i,
        /^(hello|hola|howdy|greetings|sup|wassup)[\s!.,]*$/i,
        /^(good\s*(morning|afternoon|evening|night))[\s!.,]*$/i,
        /^(what'?s?\s*up|how\s*are\s*you)[\s!?.,]*$/i,
        /^(thanks|thank\s*you|thx|ty|bye|goodbye|ok|okay|sure|yes|no|yep|nope|yeah|nah|cool|nice|great|awesome|lol)[\s!.,]*$/i,
    ];
    if (chatPatterns.some(p => p.test(lower)) || (wordCount <= 3 && !lower.includes('create') && !lower.includes('make') && !lower.includes('add'))) {
        return { type: 'chat', complexity: 'trivial', needsPlan: false, confidence: 0.95, keywords: [] };
    }
    // QUESTION - explicit questions
    const questionPatterns = [
        /^(what|why|how|when|where|who|which|explain|clarify|describe|tell me|show me)/i,
        /\?$/,
        /^(is|are|can|could|would|should|do|does|did|has|have|will)\s/i,
    ];
    if (questionPatterns.some(p => p.test(lower))) {
        return { type: 'question', complexity: 'simple', needsPlan: false, confidence: 0.9, keywords: [] };
    }
    // Extract action keywords
    const actionKeywords = {
        create: ['create', 'make', 'new', 'add', 'generate', 'build', 'write', 'init', 'setup', 'scaffold'],
        modify: ['update', 'change', 'modify', 'edit', 'fix', 'improve', 'enhance', 'refactor', 'rename', 'move'],
        delete: ['delete', 'remove', 'clean', 'clear', 'drop'],
        debug: ['fix', 'debug', 'error', 'bug', 'issue', 'broken', 'failing', 'crash', 'problem', 'wrong', 'not working'],
        refactor: ['refactor', 'reorganize', 'restructure', 'extract', 'split', 'merge', 'consolidate', 'simplify', 'clean up'],
    };
    const foundKeywords = [];
    let taskType = 'simple_edit';
    for (const [category, keywords] of Object.entries(actionKeywords)) {
        for (const kw of keywords) {
            if (lower.includes(kw)) {
                foundKeywords.push(kw);
                if (category === 'debug')
                    taskType = 'debug';
                else if (category === 'refactor')
                    taskType = 'refactor';
            }
        }
    }
    // Complexity indicators
    const complexityIndicators = {
        simple: ['file', 'function', 'variable', 'class', 'method', 'component', 'test', 'readme', 'config'],
        medium: ['feature', 'module', 'service', 'api', 'endpoint', 'page', 'route', 'handler', 'middleware'],
        complex: ['system', 'architecture', 'database', 'migration', 'integration', 'authentication', 'authorization', 'deployment', 'infrastructure', 'full', 'complete', 'entire', 'whole', 'all'],
    };
    let complexity = 'simple';
    // Check for complexity indicators
    for (const kw of complexityIndicators.complex) {
        if (lower.includes(kw)) {
            complexity = 'complex';
            break;
        }
    }
    if (complexity === 'simple') {
        for (const kw of complexityIndicators.medium) {
            if (lower.includes(kw)) {
                complexity = 'medium';
                break;
            }
        }
    }
    // Word count affects complexity
    if (wordCount > 30)
        complexity = 'complex';
    else if (wordCount > 15 && complexity === 'simple')
        complexity = 'medium';
    // Multiple files mentioned = more complex
    const filePatterns = /\.(ts|js|py|rs|go|java|cpp|c|h|css|html|json|yaml|yml|md|txt|sql|sh|bash|zsh)/gi;
    const fileMatches = lower.match(filePatterns);
    if (fileMatches && fileMatches.length > 2) {
        complexity = complexity === 'simple' ? 'medium' : 'complex';
    }
    // "and" chains indicate complexity
    const andCount = (lower.match(/\band\b/g) || []).length;
    if (andCount >= 2) {
        complexity = complexity === 'simple' ? 'medium' : 'complex';
        taskType = 'complex_task';
    }
    // Determine if plan is needed
    const needsPlan = complexity === 'complex' || (complexity === 'medium' && wordCount > 20);
    return {
        type: taskType,
        complexity,
        needsPlan,
        confidence: foundKeywords.length > 0 ? 0.85 : 0.7,
        keywords: foundKeywords,
    };
}
// ============================================================================
// RESPONSE PARSING
// ============================================================================
function extractTextFromResponse(response) {
    if (typeof response === 'string') {
        let text = response;
        text = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '');
        try {
            const parsed = JSON.parse(text);
            if (parsed.explanation)
                return parsed.explanation;
            if (parsed.output)
                return parsed.output;
            if (parsed.message)
                return parsed.message;
        }
        catch { }
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
        return JSON.stringify(response, null, 2);
    }
    return String(response);
}
function parseFileOperations(response) {
    if (typeof response === 'string') {
        let text = response.trim();
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch)
            text = jsonMatch[1].trim();
        if (!text.startsWith('{')) {
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                text = text.substring(jsonStart, jsonEnd + 1);
            }
        }
        try {
            const parsed = JSON.parse(text);
            if (parsed.files && Array.isArray(parsed.files))
                return parsed;
            if (parsed.status)
                return parsed;
        }
        catch { }
    }
    if (typeof response === 'object' && response !== null) {
        const obj = response;
        if (obj.files && Array.isArray(obj.files))
            return obj;
        if (obj.status)
            return obj;
    }
    return null;
}
// ============================================================================
// EXECUTION HANDLERS
// ============================================================================
async function getApiKey() {
    try {
        return await (0, auth_1.ensureAuthenticated)();
    }
    catch {
        console.log((0, ui_1.error)('Authentication required. Run: zcode auth'));
        return null;
    }
}
// Handle casual chat
async function handleChat(input) {
    const apiKey = await getApiKey();
    if (!apiKey)
        return;
    const chatPrompt = `You are a friendly AI coding assistant. Respond naturally and briefly (1-2 sentences). Be warm and helpful. If the user wants to code, suggest they describe their task.`;
    const result = await (0, runtime_1.execute)({
        instruction: `${chatPrompt}\n\nUser: ${input}\n\nRespond briefly:`,
        enforceSchema: false
    }, apiKey);
    if (result.success && result.output) {
        console.log(extractTextFromResponse(result.output));
    }
    else {
        console.log("Hey! What would you like to build today?");
    }
}
// Handle questions
async function handleQuestion(input) {
    const apiKey = await getApiKey();
    if (!apiKey)
        return;
    const session = (0, session_1.getSession)();
    console.log((0, ui_1.dim)('Thinking...'));
    const result = await (0, runtime_1.execute)({
        instruction: `You are a helpful coding assistant. Answer this question clearly and concisely:\n\n${input}`,
        enforceSchema: false
    }, apiKey);
    if (result.success && result.output) {
        console.log(extractTextFromResponse(result.output));
    }
    else {
        console.log((0, ui_1.error)(result.error || 'Failed to get answer'));
    }
}
// Handle simple edits - direct execution
async function handleSimpleEdit(input) {
    const apiKey = await getApiKey();
    if (!apiKey)
        return;
    const session = (0, session_1.getSession)();
    console.log((0, ui_1.info)('⚡ Executing...'));
    const { buildContext, formatContextForModel } = await Promise.resolve().then(() => __importStar(require('./context/context_builder')));
    const context = buildContext(session.workingDirectory, input, 'CODE_EDIT', session.openFiles);
    const filesContext = formatContextForModel(context);
    const instruction = `You are an autonomous coding agent. Execute this task completely.

Task: ${input}
Working directory: ${session.workingDirectory}
${filesContext ? `\nRelevant files:\n${filesContext}` : ''}

RESPOND WITH JSON ONLY:
{
  "status": "success",
  "files": [{"path": "path/to/file", "operation": "create|modify|delete", "content": "full content"}],
  "output": "Brief explanation"
}

RULES:
- Create folders by creating files inside them (folders auto-create)
- Provide COMPLETE file content, never partial
- Only modify files directly related to the task`;
    const result = await (0, runtime_1.execute)({ instruction }, apiKey);
    if (result.success && result.output) {
        const response = parseFileOperations(result.output) ||
            (typeof result.output === 'object' ? result.output : null);
        if (response?.files?.length) {
            await applyFiles(response.files, session.workingDirectory, input);
            if (response.output)
                console.log('\n' + response.output);
        }
        else if (response?.output) {
            console.log(response.output);
        }
        else {
            const text = extractTextFromResponse(result.output);
            if (text && !text.startsWith('{'))
                console.log(text);
        }
    }
    else {
        console.log((0, ui_1.error)(result.error || 'Execution failed'));
    }
}
// Handle complex tasks - plan then execute
async function handleComplexTask(input) {
    const apiKey = await getApiKey();
    if (!apiKey)
        return;
    const session = (0, session_1.getSession)();
    (0, session_1.setIntent)(input);
    console.log((0, ui_1.info)('📋 Complex task detected - creating plan...'));
    const { buildContext, formatContextForModel } = await Promise.resolve().then(() => __importStar(require('./context/context_builder')));
    const context = buildContext(session.workingDirectory, input, 'CODE_EDIT', session.openFiles);
    const filesContext = formatContextForModel(context);
    // Step 1: Generate plan
    const planInstruction = `Create a step-by-step plan for this task.

Task: ${input}
Working directory: ${session.workingDirectory}
${filesContext ? `\nFiles:\n${filesContext}` : ''}

Respond with JSON:
{
  "status": "success",
  "plan": [
    {"id": "1", "description": "Step description", "files": ["affected/files"]}
  ],
  "output": "Plan summary"
}`;
    console.log((0, ui_1.dim)('Planning...'));
    const planResult = await (0, runtime_1.execute)({ instruction: planInstruction }, apiKey);
    if (!planResult.success) {
        console.log((0, ui_1.error)('Planning failed: ' + planResult.error));
        return;
    }
    const planResponse = parseFileOperations(planResult.output);
    const plan = planResponse?.plan;
    if (!plan || !Array.isArray(plan) || plan.length === 0) {
        console.log((0, ui_1.dim)('No plan generated, executing directly...'));
        return handleSimpleEdit(input);
    }
    // Show plan
    console.log((0, ui_1.success)(`Plan: ${plan.length} steps`));
    plan.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.description}`);
    });
    (0, session_1.setLastPlan)(plan.map((s) => ({ id: s.id, description: s.description, status: 'pending' })));
    // Step 2: Execute plan
    console.log('');
    console.log((0, ui_1.dim)('Executing plan...'));
    const executeInstruction = `Execute this plan and generate all file changes.

Task: ${input}

Plan:
${plan.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}

Working directory: ${session.workingDirectory}
${filesContext ? `\nFiles:\n${filesContext}` : ''}

Respond with JSON containing ALL file operations:
{
  "status": "success",
  "files": [{"path": "path/to/file", "operation": "create|modify|delete", "content": "COMPLETE content"}],
  "output": "Summary of changes"
}

IMPORTANT: Include COMPLETE file content for every file. Never use placeholders.`;
    const execResult = await (0, runtime_1.execute)({ instruction: executeInstruction }, apiKey);
    if (!execResult.success) {
        console.log((0, ui_1.error)('Execution failed: ' + execResult.error));
        return;
    }
    const execResponse = parseFileOperations(execResult.output) ||
        (typeof execResult.output === 'object' ? execResult.output : null);
    if (execResponse?.files?.length) {
        await applyFiles(execResponse.files, session.workingDirectory, input);
        if (execResponse.output)
            console.log('\n' + execResponse.output);
    }
    else if (execResponse?.output) {
        console.log(execResponse.output);
    }
    else {
        console.log((0, ui_1.dim)('No file changes generated.'));
    }
}
// Apply files helper
async function applyFiles(files, basePath, input) {
    if (!files || files.length === 0)
        return;
    // Safety filter
    const safeFiles = files.filter(file => {
        const p = file.path.toLowerCase();
        if (p.startsWith('src/') && !input.toLowerCase().includes('src')) {
            console.log((0, ui_1.dim)(`  Skipped ${file.path} (not in task scope)`));
            return false;
        }
        if (p.startsWith('/') || p.startsWith('..')) {
            console.log((0, ui_1.dim)(`  Skipped ${file.path} (outside project)`));
            return false;
        }
        return true;
    });
    if (safeFiles.length === 0)
        return;
    console.log((0, ui_1.success)(`Applying ${safeFiles.length} file(s)...`));
    let applied = 0, failed = 0;
    for (const file of safeFiles) {
        try {
            let filePath = file.path.startsWith('./') ? file.path.substring(2) : file.path;
            const result = (0, apply_1.applyFileOperation)(file.operation, filePath, file.content, { basePath });
            if (result.success) {
                console.log((0, ui_1.success)(`  ✓ ${file.operation}: ${filePath}`));
                applied++;
            }
            else {
                console.log((0, ui_1.error)(`  ✗ ${filePath}: ${result.error}`));
                failed++;
            }
        }
        catch (e) {
            console.log((0, ui_1.error)(`  ✗ ${file.path}: ${e?.message}`));
            failed++;
        }
    }
    console.log('');
    if (applied > 0)
        console.log((0, ui_1.success)(`Applied ${applied} file(s)`));
    if (failed > 0)
        console.log((0, ui_1.error)(`Failed ${failed} file(s)`));
    console.log((0, ui_1.hint)('/undo to rollback'));
}
async function orchestrate(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return { inputType: 'free_text', intent: 'COMMAND', workflow: 'ignore', handled: true };
    }
    // Handle slash commands
    const parsed = (0, commands_1.parseInput)(trimmed);
    if (parsed.isSlashCommand) {
        await (0, commands_1.executeCommand)(parsed);
        return { inputType: 'slash', intent: 'COMMAND', workflow: 'slash_command', handled: true };
    }
    // Analyze the task
    const analysis = analyzeTask(trimmed);
    // Route based on analysis
    switch (analysis.type) {
        case 'chat':
            await handleChat(trimmed);
            return { inputType: 'free_text', intent: 'QUESTION', workflow: 'chat', handled: true };
        case 'question':
            await handleQuestion(trimmed);
            return { inputType: 'free_text', intent: 'QUESTION', workflow: 'question', handled: true };
        case 'debug':
        case 'refactor':
        case 'simple_edit':
            if (analysis.needsPlan) {
                await handleComplexTask(trimmed);
            }
            else {
                await handleSimpleEdit(trimmed);
            }
            return { inputType: 'free_text', intent: 'CODE_EDIT', workflow: 'auto_execute', handled: true };
        case 'complex_task':
            await handleComplexTask(trimmed);
            return { inputType: 'free_text', intent: 'CODE_EDIT', workflow: 'planned_execute', handled: true };
        default:
            await handleSimpleEdit(trimmed);
            return { inputType: 'free_text', intent: 'CODE_EDIT', workflow: 'auto_execute', handled: true };
    }
}
//# sourceMappingURL=orchestrator.js.map