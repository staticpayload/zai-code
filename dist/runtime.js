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
exports.RESPONSE_SCHEMA = void 0;
exports.validateSchema = validateSchema;
exports.execute = execute;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
const config_1 = require("./config");
const project_memory_1 = require("./context/project_memory");
const settings_1 = require("./settings");
exports.RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['success', 'error', 'partial'],
        },
        actions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string' },
                    target: { type: 'string' },
                    content: { type: 'string' },
                },
                required: ['type'],
            },
        },
        diffs: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    file: { type: 'string' },
                    hunks: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                start: { type: 'number' },
                                end: { type: 'number' },
                                content: { type: 'string' },
                            },
                            required: ['start', 'end', 'content'],
                        },
                    },
                },
                required: ['file', 'hunks'],
            },
        },
        files: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    path: { type: 'string' },
                    operation: { type: 'string', enum: ['create', 'modify', 'delete'] },
                    content: { type: 'string' },
                },
                required: ['path', 'operation'],
            },
        },
        output: { type: 'string' },
        error: { type: 'string' },
    },
    required: ['status'],
};
function validateSchema(data, schema) {
    const errors = [];
    const schemaObj = schema;
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Data must be an object'] };
    }
    const obj = data;
    // Check required fields
    if (schemaObj.required) {
        for (const requiredField of schemaObj.required) {
            if (!(requiredField in obj) || obj[requiredField] === undefined) {
                errors.push(`Missing required field: ${requiredField}`);
            }
        }
    }
    // Check field types
    if (schemaObj.properties) {
        for (const [fieldName, fieldSchema] of Object.entries(schemaObj.properties)) {
            if (!(fieldName in obj)) {
                continue; // Skip optional fields that aren't present
            }
            const value = obj[fieldName];
            const fieldDef = fieldSchema;
            // Check null/undefined
            if (value === null || value === undefined) {
                continue; // Allow null for optional fields
            }
            // Check type
            if (fieldDef.type) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== fieldDef.type) {
                    errors.push(`Field '${fieldName}' must be ${fieldDef.type}, got ${actualType}`);
                }
            }
            // Check enum values
            if (fieldDef.enum) {
                if (typeof value === 'string' && !fieldDef.enum.includes(value)) {
                    errors.push(`Field '${fieldName}' must be one of: ${fieldDef.enum.join(', ')}, got '${value}'`);
                }
            }
            // Check array items
            if (fieldDef.type === 'array' && fieldDef.items && Array.isArray(value)) {
                const itemsSchema = fieldDef.items;
                if (itemsSchema.properties) {
                    for (let i = 0; i < value.length; i++) {
                        const item = value[i];
                        if (!item || typeof item !== 'object') {
                            errors.push(`Array '${fieldName}[${i}]' must be an object`);
                            continue;
                        }
                        const itemObj = item;
                        // Check required fields in array items
                        if (itemsSchema.required) {
                            for (const reqField of itemsSchema.required) {
                                if (!(reqField in itemObj)) {
                                    errors.push(`Array '${fieldName}[${i}]' missing required field: ${reqField}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
function httpsPost(urlString, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new url_1.URL(urlString);
        const isHttps = parsedUrl.protocol === 'https:';
        const requestFn = isHttps ? https.request : http.request;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        if (options.body) {
            headers['Content-Length'] = Buffer.byteLength(options.body).toString();
        }
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'POST',
            headers,
        };
        const req = requestFn(requestOptions, (res) => {
            const chunks = [];
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                resolve({
                    statusCode: res.statusCode || 0,
                    headers: res.headers,
                    body,
                });
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;
async function makeRequest(url, anthropicRequest, apiKey) {
    try {
        const response = await httpsPost(url, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(anthropicRequest),
        });
        if (response.statusCode !== 200) {
            let errorMessage = `HTTP ${response.statusCode}`;
            try {
                const errorBody = JSON.parse(response.body);
                if (errorBody.error?.message) {
                    errorMessage = errorBody.error.message;
                }
            }
            catch {
                if (response.body) {
                    errorMessage = response.body;
                }
            }
            return { success: false, error: errorMessage };
        }
        const anthropicResponse = JSON.parse(response.body);
        if (anthropicResponse.error) {
            return { success: false, error: anthropicResponse.error.message };
        }
        return { success: true, data: anthropicResponse };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function extractOutputText(anthropicResponse) {
    if (anthropicResponse.content && anthropicResponse.content.length > 0) {
        const textBlock = anthropicResponse.content.find((block) => block.type === 'text');
        if (textBlock) {
            return textBlock.text;
        }
    }
    return '';
}
async function execute(request, apiKey) {
    const config = (0, config_1.loadConfig)();
    const baseUrl = config.api?.baseUrl || 'https://api.z.ai/api/paas/v4/';
    const url = baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`;
    const model = request.model || (0, settings_1.getModel)();
    const maxTokens = request.maxTokens || DEFAULT_MAX_TOKENS;
    const enforceSchema = request.enforceSchema !== false; // Default to true
    // Use provided schema or default to RESPONSE_SCHEMA
    const schemaToUse = request.schema ?? exports.RESPONSE_SCHEMA;
    // Get system prompt with project rules
    const baseSystemPrompt = (0, project_memory_1.getSystemPrompt)();
    // Build final system prompt
    let systemPrompt = baseSystemPrompt;
    if (request.context) {
        systemPrompt += '\n\n' + request.context;
    }
    if (request.schema) {
        const schemaInstruction = `Respond with valid JSON matching this schema: ${JSON.stringify(request.schema)}`;
        systemPrompt += '\n\n' + schemaInstruction;
    }
    async function attemptRequest(instruction, system) {
        const anthropicRequest = {
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: instruction }],
            system,
        };
        const result = await makeRequest(url, anthropicRequest, apiKey);
        if (!result.success || !result.data) {
            return { error: result.error };
        }
        const outputText = extractOutputText(result.data);
        let parsedData;
        try {
            parsedData = JSON.parse(outputText);
        }
        catch {
            return { error: 'Failed to parse response as JSON' };
        }
        return {
            parsedData,
            outputText,
            usage: result.data.usage,
        };
    }
    // Initial request
    const initialResult = await attemptRequest(request.instruction, systemPrompt);
    if (initialResult.error) {
        return {
            success: false,
            output: '',
            error: initialResult.error,
        };
    }
    // If schema enforcement is disabled, return the result
    if (!enforceSchema) {
        return {
            success: true,
            output: (initialResult.parsedData ?? initialResult.outputText ?? ''),
            usage: initialResult.usage
                ? {
                    inputTokens: initialResult.usage.input_tokens,
                    outputTokens: initialResult.usage.output_tokens,
                }
                : undefined,
        };
    }
    // Validate against schema
    const validation = validateSchema(initialResult.parsedData, schemaToUse);
    if (validation.valid) {
        return {
            success: true,
            output: (initialResult.parsedData ?? initialResult.outputText ?? ''),
            usage: initialResult.usage
                ? {
                    inputTokens: initialResult.usage.input_tokens,
                    outputTokens: initialResult.usage.output_tokens,
                }
                : undefined,
        };
    }
    // Retry with additional instruction
    const retryInstruction = `${request.instruction}\n\nPrevious response violated schema. Required fields: status (success|error|partial). Output valid JSON only.`;
    const retryResult = await attemptRequest(retryInstruction, systemPrompt);
    if (retryResult.error) {
        return {
            success: false,
            output: '',
            error: retryResult.error,
        };
    }
    const retryValidation = validateSchema(retryResult.parsedData, schemaToUse);
    if (retryValidation.valid) {
        return {
            success: true,
            output: (retryResult.parsedData ?? retryResult.outputText ?? ''),
            usage: retryResult.usage
                ? {
                    inputTokens: retryResult.usage.input_tokens,
                    outputTokens: retryResult.usage.output_tokens,
                }
                : undefined,
        };
    }
    // Fail hard after retry
    return {
        success: false,
        output: '',
        error: 'Schema violation after retry',
    };
}
//# sourceMappingURL=runtime.js.map