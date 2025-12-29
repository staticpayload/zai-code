export interface ResponseSchema {
    status: 'success' | 'error' | 'partial';
    actions?: Array<{
        type: string;
        target?: string;
        content?: string;
    }>;
    diffs?: Array<{
        file: string;
        hunks: Array<{
            start: number;
            end: number;
            content: string;
        }>;
    }>;
    files?: Array<{
        path: string;
        operation: 'create' | 'modify' | 'delete';
        content?: string;
    }>;
    output?: string;
    error?: string;
}
export declare const RESPONSE_SCHEMA: {
    type: string;
    properties: {
        status: {
            type: string;
            enum: string[];
        };
        actions: {
            type: string;
            items: {
                type: string;
                properties: {
                    type: {
                        type: string;
                    };
                    target: {
                        type: string;
                    };
                    content: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
        diffs: {
            type: string;
            items: {
                type: string;
                properties: {
                    file: {
                        type: string;
                    };
                    hunks: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                start: {
                                    type: string;
                                };
                                end: {
                                    type: string;
                                };
                                content: {
                                    type: string;
                                };
                            };
                            required: string[];
                        };
                    };
                };
                required: string[];
            };
        };
        files: {
            type: string;
            items: {
                type: string;
                properties: {
                    path: {
                        type: string;
                    };
                    operation: {
                        type: string;
                        enum: string[];
                    };
                    content: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
        output: {
            type: string;
        };
        error: {
            type: string;
        };
    };
    required: string[];
};
export interface ExecutionRequest {
    instruction: string;
    schema?: object;
    context?: string;
    model?: string;
    maxTokens?: number;
    enforceSchema?: boolean;
}
export interface ExecutionResponse {
    success: boolean;
    output: string | object;
    error?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}
interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validateSchema(data: unknown, schema: object): ValidationResult;
export declare function execute(request: ExecutionRequest, apiKey: string): Promise<ExecutionResponse>;
export {};
//# sourceMappingURL=runtime.d.ts.map