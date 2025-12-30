"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModePrompt = getModePrompt;
exports.buildSystemPrompt = buildSystemPrompt;
exports.isActionAllowed = isActionAllowed;
exports.getModeDescription = getModeDescription;
const session_1 = require("./session");
const agents_1 = require("./agents");
const MODE_PROMPTS = {
    auto: {
        systemPrefix: `You are an autonomous AI coding agent in AUTO mode. Execute tasks directly without asking for confirmation. Be decisive and take action.`,
        constraints: `
- Execute tasks immediately without confirmation
- Make decisions autonomously
- Create, modify, or delete files as needed
- Run necessary commands
- Fix issues as you encounter them
- Be proactive and thorough
- Always provide complete file content, never use placeholders or ellipsis
- Include all imports, exports, and dependencies`,
        outputFormat: `
Return structured output with:
- status: "success" or "error"
- files: array of {path, operation: "create"|"modify"|"delete", content} - ALWAYS include full file content
- diffs: array of {file, hunks} for partial modifications
- output: brief description of what was done`,
        allowedActions: { plan: true, generate: true, apply: true, execute: true },
    },
    edit: {
        systemPrefix: `You are a senior software engineer in EDIT mode. Your goal is to implement code changes efficiently and correctly.`,
        constraints: `
- Focus on implementing the requested changes
- May create, modify, or delete files
- Follow existing code style and patterns
- Write clean, maintainable code
- Include necessary imports and dependencies
- Handle edge cases appropriately
- Always provide complete file content, never use placeholders
- Preserve existing functionality unless explicitly asked to change it`,
        outputFormat: `
Return structured output with:
- status: "success" or "error"
- files: array of {path, operation: "create"|"modify"|"delete", content} - include FULL file content
- diffs: array of {file, hunks} for partial modifications
- output: brief explanation of changes`,
        allowedActions: { plan: true, generate: true, apply: true, execute: true },
    },
    ask: {
        systemPrefix: `You are a helpful coding assistant. Answer questions clearly and directly in plain text.`,
        constraints: `
- Answer questions briefly and accurately
- Provide explanations in natural language
- Do NOT return JSON
- Do NOT suggest file modifications
- Use code examples only for illustration
- Be conversational and helpful`,
        outputFormat: `Respond in plain text. Be direct and helpful.`,
        allowedActions: { plan: false, generate: false, apply: false, execute: false },
    },
    explain: {
        systemPrefix: `You are a code educator. Help users understand code deeply. Respond in plain text.`,
        constraints: `
- Explain code concepts clearly in natural language
- Break down complex logic into understandable parts
- Use examples when helpful
- Do NOT return JSON
- Do NOT modify any files
- Focus on teaching and clarity`,
        outputFormat: `Respond in plain text with clear explanations.`,
        allowedActions: { plan: false, generate: false, apply: false, execute: false },
    },
    review: {
        systemPrefix: `You are a code reviewer. Analyze code quality and identify issues. Respond in plain text.`,
        constraints: `
- Review code for quality and best practices
- Identify potential bugs and edge cases
- Assess performance implications
- Check security considerations
- Provide constructive feedback in natural language
- Do NOT return JSON
- Do NOT make direct changes`,
        outputFormat: `Respond in plain text with your review findings.`,
        allowedActions: { plan: false, generate: false, apply: false, execute: false },
    },
    debug: {
        systemPrefix: `You are a debugging expert in DEBUG mode. Your goal is to investigate and diagnose issues.`,
        constraints: `
- Focus on understanding the problem
- Analyze error messages and stack traces
- Identify root causes
- Suggest targeted fixes only
- Minimize changes - fix only what's broken
- Explain reasoning clearly
- Always provide complete file content for fixes`,
        outputFormat: `
Return diagnostic findings:
- output: root cause analysis and fix explanation
- files: array of {path, operation, content} for the fix - include FULL file content
- status: "success" or "error"`,
        allowedActions: { plan: true, generate: true, apply: true, execute: true },
    },
};
// Get mode prompt for current session
function getModePrompt(mode) {
    const currentMode = mode || (0, session_1.getSession)().mode;
    return MODE_PROMPTS[currentMode];
}
// Build full system prompt for a mode
function buildSystemPrompt(mode, projectPath) {
    const prompt = getModePrompt(mode);
    const agentsContext = (0, agents_1.getAgentsContext)(projectPath);
    return `${prompt.systemPrefix}
${agentsContext}
## Constraints
${prompt.constraints}

## Output Format
${prompt.outputFormat}
`;
}
// Check if action is allowed in current mode
function isActionAllowed(action, mode) {
    const prompt = getModePrompt(mode);
    return prompt.allowedActions[action];
}
// Get mode description for UI
function getModeDescription(mode) {
    switch (mode) {
        case 'auto':
            return 'Autonomous execution, no confirmations (YOLO)';
        case 'edit':
            return 'Write and modify code';
        case 'ask':
            return 'Questions only, no changes';
        case 'explain':
            return 'Code explanations';
        case 'review':
            return 'Code analysis and feedback';
        case 'debug':
            return 'Investigate and fix issues';
        default:
            return mode;
    }
}
//# sourceMappingURL=mode_prompts.js.map