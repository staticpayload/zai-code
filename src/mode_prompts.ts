import { SessionMode, getSession } from './session';
import { getAgentsContext } from './agents';

// Mode-specific system prompts
export interface ModePrompt {
    systemPrefix: string;
    constraints: string;
    outputFormat: string;
    allowedActions: {
        plan: boolean;
        generate: boolean;
        apply: boolean;
        execute: boolean;
    };
}

const MODE_PROMPTS: Record<SessionMode, ModePrompt> = {
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
        systemPrefix: `You are a helpful coding assistant in ASK mode. Your goal is to answer questions clearly and directly.`,
        constraints: `
- Answer questions briefly and accurately
- Provide explanations, not code changes
- Do NOT suggest modifications
- Do NOT plan file operations
- Do NOT generate diffs
- Focus on understanding and education
- Use code examples only for illustration`,
        outputFormat: `
Return a direct answer in natural language. Structure:
- output: the answer to the question
- status: "success"`,
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
- output: clear breakdown of the code/concept
- status: "success"`,
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
- output: overall assessment with issues and recommendations
- status: "success"`,
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
export function getModePrompt(mode?: SessionMode): ModePrompt {
    const currentMode = mode || getSession().mode;
    return MODE_PROMPTS[currentMode];
}

// Build full system prompt for a mode
export function buildSystemPrompt(mode?: SessionMode, projectPath?: string): string {
    const prompt = getModePrompt(mode);
    const agentsContext = getAgentsContext(projectPath);

    return `${prompt.systemPrefix}
${agentsContext}
## Constraints
${prompt.constraints}

## Output Format
${prompt.outputFormat}
`;
}

// Check if action is allowed in current mode
export function isActionAllowed(action: keyof ModePrompt['allowedActions'], mode?: SessionMode): boolean {
    const prompt = getModePrompt(mode);
    return prompt.allowedActions[action];
}

// Get mode description for UI
export function getModeDescription(mode: SessionMode): string {
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
