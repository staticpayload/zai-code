declare const MEMORY_FILE = ".zai/context.md";
declare const BASE_SYSTEM_PROMPT = "You are an execution engine. Follow these rules exactly:\n\nRULES:\n- Output ONLY what is explicitly requested\n- No explanations unless requested\n- No apologies or acknowledgments\n- No conversational language\n- No first-person references\n- No preamble or postamble\n- No markdown formatting unless requested\n- Raw output only\n\nBEHAVIOR:\n- Execute instructions literally\n- Be deterministic and consistent\n- If a schema is provided, output valid JSON matching that schema exactly\n- If output format is specified, follow it precisely\n\nVIOLATIONS:\n- Do not say \"I\", \"I'll\", \"I can\", \"Sure\", \"Certainly\", \"Of course\"\n- Do not say \"Here is\", \"Here's\", \"Let me\"\n- Do not apologize or explain limitations\n- Do not add commentary or suggestions unless requested";
export declare function loadProjectContext(workingDir?: string): string;
export declare function saveProjectContext(content: string, workingDir?: string): boolean;
export declare function appendProjectRule(rule: string, workingDir?: string): boolean;
export declare function getSystemPrompt(workingDir?: string): string;
export interface ProjectMemory {
    load(): Promise<string>;
    append(rule: string): Promise<void>;
    getSystemPrompt(): Promise<string>;
}
export declare function createProjectMemory(workingDir?: string): ProjectMemory;
export { MEMORY_FILE, BASE_SYSTEM_PROMPT };
//# sourceMappingURL=project_memory.d.ts.map