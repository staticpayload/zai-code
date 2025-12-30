import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { loadConfig } from './config';
import { getSystemPrompt } from './context/project_memory';
import { getModel } from './settings';

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

export const RESPONSE_SCHEMA = {
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

export function validateSchema(data: unknown, schema: object): ValidationResult {
  const errors: string[] = [];
  const schemaObj = schema as typeof RESPONSE_SCHEMA;

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be an object'] };
  }

  const obj = data as Record<string, unknown>;

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
      const fieldDef = fieldSchema as { type?: string; enum?: string[]; items?: unknown };

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
        const itemsSchema = fieldDef.items as { properties?: Record<string, unknown>; required?: string[] };
        if (itemsSchema.properties) {
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (!item || typeof item !== 'object') {
              errors.push(`Array '${fieldName}[${i}]' must be an object`);
              continue;
            }

            const itemObj = item as Record<string, unknown>;

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

interface HttpsPostOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface HttpsPostResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function httpsPost(
  urlString: string,
  options: HttpsPostOptions = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<HttpsPostResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'zai-code/1.0',
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
      timeout,
    };

    const req = requestFn(requestOptions, (res) => {
      const chunks: Buffer[] = [];

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
      reject(new Error(`Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

interface ChatMessage {
  role: string;
  content: string;
}

// OpenAI-compatible request format (used by Zhipu)
interface ChatRequest {
  model: string;
  max_tokens: number;
  messages: ChatMessage[];
}

// OpenAI-compatible response format
interface ChatResponse {
  id?: string;
  choices?: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

const DEFAULT_MODEL = 'glm-4.7';
const DEFAULT_MAX_TOKENS = 8192;
const REQUEST_TIMEOUT = 120000; // 120 seconds for longer operations

async function makeRequest(
  url: string,
  chatRequest: ChatRequest,
  apiKey: string,
  retries: number = 2
): Promise<{ success: boolean; data?: ChatResponse; error?: string }> {
  let lastError: string = '';
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await httpsPost(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatRequest),
      });

      if (response.statusCode === 429) {
        // Rate limited - wait and retry
        const retryAfterHeader = response.headers['retry-after'];
        const retryAfter = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : 5;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, (isNaN(retryAfter) ? 5 : retryAfter) * 1000));
          continue;
        }
        return { success: false, error: 'Rate limited. Please try again later.' };
      }

      if (response.statusCode === 401) {
        return { success: false, error: 'Invalid API key. Run "zcode auth" to reconfigure.' };
      }

      if (response.statusCode === 403) {
        return { success: false, error: 'Access forbidden. Check your API key permissions.' };
      }

      if (response.statusCode >= 500 && attempt < retries) {
        // Server error - retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }

      if (response.statusCode !== 200) {
        let errorMessage = `HTTP ${response.statusCode}`;
        try {
          const errorBody = JSON.parse(response.body) as ChatResponse;
          if (errorBody.error?.message) {
            errorMessage = errorBody.error.message;
          }
        } catch {
          if (response.body) {
            errorMessage = response.body.substring(0, 500);
          }
        }
        return { success: false, error: errorMessage };
      }

      let chatResponse: ChatResponse;
      try {
        chatResponse = JSON.parse(response.body) as ChatResponse;
      } catch (parseError) {
        return { success: false, error: 'Invalid JSON response from API' };
      }

      if (chatResponse.error) {
        return { success: false, error: chatResponse.error.message };
      }

      return { success: true, data: chatResponse };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      
      // Network errors - retry with exponential backoff
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  
  return { success: false, error: lastError || 'Request failed after retries' };
}

function extractOutputText(chatResponse: ChatResponse): string {
  if (chatResponse.choices && chatResponse.choices.length > 0) {
    return chatResponse.choices[0].message?.content || '';
  }
  return '';
}

export async function execute(
  request: ExecutionRequest,
  apiKey: string
): Promise<ExecutionResponse> {
  const config = loadConfig();
  // Z.ai (Zhipu AI) international coding API
  const baseUrl = (config.api as { baseUrl?: string })?.baseUrl || 'https://api.z.ai/api/coding/paas/v4/';
  const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

  const model = request.model || getModel();
  const maxTokens = request.maxTokens || DEFAULT_MAX_TOKENS;
  const enforceSchema = request.enforceSchema !== false; // Default to true

  // Use provided schema or default to RESPONSE_SCHEMA
  const schemaToUse = request.schema ?? RESPONSE_SCHEMA;

  // Get system prompt with project rules
  const baseSystemPrompt = getSystemPrompt();

  // Build final system prompt
  let systemPrompt = baseSystemPrompt;
  if (request.context) {
    systemPrompt += '\n\n' + request.context;
  }
  if (request.schema) {
    const schemaInstruction = `Respond with valid JSON matching this schema: ${JSON.stringify(request.schema)}`;
    systemPrompt += '\n\n' + schemaInstruction;
  }

  async function attemptRequest(
    instruction: string,
    system: string
  ): Promise<{ parsedData?: unknown; outputText?: string; error?: string; usage?: ChatResponse['usage'] }> {
    // OpenAI format: system prompt as first message
    const chatRequest: ChatRequest = {
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: instruction }
      ],
    };

    const result = await makeRequest(url, chatRequest, apiKey);
    if (!result.success || !result.data) {
      return { error: result.error };
    }

    const outputText = extractOutputText(result.data);
    let parsedData: unknown;

    // Strip markdown code blocks before parsing
    let textToParse = outputText.trim();
    const jsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      textToParse = jsonMatch[1].trim();
    }

    try {
      parsedData = JSON.parse(textToParse);
    } catch {
      // Return raw text if not JSON
      return {
        parsedData: { status: 'success', output: outputText },
        outputText,
        usage: result.data.usage
      };
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
      output: (initialResult.parsedData ?? initialResult.outputText ?? '') as string | object,
      usage: initialResult.usage
        ? {
          inputTokens: initialResult.usage.prompt_tokens,
          outputTokens: initialResult.usage.completion_tokens,
        }
        : undefined,
    };
  }

  // Validate against schema
  const validation = validateSchema(initialResult.parsedData, schemaToUse);

  if (validation.valid) {
    return {
      success: true,
      output: (initialResult.parsedData ?? initialResult.outputText ?? '') as string | object,
      usage: initialResult.usage
        ? {
          inputTokens: initialResult.usage.prompt_tokens,
          outputTokens: initialResult.usage.completion_tokens,
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
      output: (retryResult.parsedData ?? retryResult.outputText ?? '') as string | object,
      usage: retryResult.usage
        ? {
          inputTokens: retryResult.usage.prompt_tokens,
          outputTokens: retryResult.usage.completion_tokens,
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
