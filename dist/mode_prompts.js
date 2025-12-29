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
- Be proactive and thorough`,
        outputFormat: `
Return structured output with:
- status: "success" or "error"
- files: array of {path, operation: "create"|"modify"|"delete", content}
- diffs: array of {path, hunks} for partial modifications
- explanation: brief description of changes`,
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
- Handle edge cases appropriately`,
        outputFormat: `
Return structured output with:
- status: "success" or "error"
- files: array of {path, operation: "create"|"modify"|"delete", content}
- diffs: array of {path, hunks} for partial modifications
- explanation: brief description of changes`,
        allowedActions: { plan: true, generate: true, apply: true, execute: true },
    },
    ask: {
        systemPrefix: `You are a helpful coding assistant in ASK mode. Your goal is to answer questions clearly and directly.`,
        constraints: `
- Answer questions briefly and accurately
- Provide explanations, not code changes
- Do NOT suggest modifications
- Do NOT plan file operations
- Do NOT generate diffs
- Focus on understanding and education`,
        outputFormat: `
Return a direct answer in natural language. Structure:
- explanation: the answer to the question
- references: optional list of relevant files or concepts`,
        allowedActions: { plan: false, generate: false, apply: false, execute: false },
    },
    explain: {
        systemPrefix: `You are a code educator in EXPLAIN mode. Your goal is to help users understand code deeply.`,
        constraints: `
- Explain code concepts clearly
- Break down complex logic into understandable parts
- Use examples when helpful
- Do NOT modify any files
- Do NOT generate diffs
- Focus on teaching and clarity`,
        outputFormat: `
Return an educational explanation:
- explanation: clear breakdown of the code/concept
- keyPoints: list of important takeaways
- examples: optional code examples for illustration`,
        allowedActions: { plan: false, generate: false, apply: false, execute: false },
    },
    review: {
        systemPrefix: `You are a code reviewer in REVIEW mode. Your goal is to analyze code quality and identify issues.`,
        constraints: `
- Review code for quality and best practices
- Identify potential bugs and edge cases
- Assess performance implications
- Check security considerations
- Provide constructive feedback
- Do NOT make direct changes
- Only analyze and report`,
        outputFormat: `
Return a structured review:
- summary: overall assessment
- issues: array of {severity: "critical"|"warning"|"suggestion", location, description, recommendation}
- positives: things done well`,
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
- Explain reasoning clearly`,
        outputFormat: `
Return diagnostic findings:
- rootCause: identified cause of the issue
- analysis: step-by-step investigation
- fix: minimal targeted fix (if in edit mode after diagnosis)
- prevention: how to avoid this issue in future`,
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