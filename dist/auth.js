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
exports.getApiKey = getApiKey;
exports.setApiKey = setApiKey;
exports.deleteApiKey = deleteApiKey;
exports.hasValidCredentials = hasValidCredentials;
exports.validateApiKey = validateApiKey;
exports.promptForApiKey = promptForApiKey;
exports.runOnboarding = runOnboarding;
exports.ensureAuthenticated = ensureAuthenticated;
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const config_1 = require("./config");
const ENV_VAR_NAME = 'Z_KEY';
const AUTH_FILE = path.join(os.homedir(), '.zai', 'auth.json');
// Ensure .zai directory exists
function ensureAuthDir() {
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { mode: 0o700, recursive: true });
    }
}
// Get API key from environment or file
async function getApiKey() {
    // 1. Check env var first
    const envKey = process.env[ENV_VAR_NAME];
    if (envKey && envKey.trim().length > 0) {
        return envKey.trim();
    }
    // 2. Fall back to auth file
    try {
        if (fs.existsSync(AUTH_FILE)) {
            const content = fs.readFileSync(AUTH_FILE, 'utf-8');
            const data = JSON.parse(content);
            if (data.apiKey && data.apiKey.length > 0) {
                return data.apiKey;
            }
        }
    }
    catch {
        // Fall through
    }
    return null;
}
// Save API key to file
async function setApiKey(key) {
    ensureAuthDir();
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ apiKey: key }, null, 2), { mode: 0o600 });
}
// Delete saved API key
async function deleteApiKey() {
    if (fs.existsSync(AUTH_FILE)) {
        fs.unlinkSync(AUTH_FILE);
    }
}
async function hasValidCredentials() {
    const key = await getApiKey();
    return key !== null && key.length > 0;
}
async function httpsGet(url, headers) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                ...headers,
                'User-Agent': 'zai-cli',
            },
        };
        const req = require('https').request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, data });
            });
        });
        req.on('error', reject);
        req.end();
    });
}
async function validateApiKey(key) {
    if (!key || key.trim().length === 0) {
        return false;
    }
    try {
        const config = (0, config_1.loadConfig)();
        // Z.ai (Zhipu AI) international coding API
        const baseUrl = config.api?.baseUrl || 'https://api.z.ai/api/coding/paas/v4/';
        const modelsUrl = baseUrl.endsWith('/') ? `${baseUrl}models` : `${baseUrl}/models`;
        const response = await httpsGet(modelsUrl, {
            'Authorization': `Bearer ${key}`,
        });
        return response.statusCode >= 200 && response.statusCode < 300;
    }
    catch {
        // Skip validation if network fails - assume key is valid
        return true;
    }
}
async function promptForApiKey() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const stdin = process.stdin;
        const stdout = process.stdout;
        stdout.write('Enter Z.ai API key (Z_KEY): ');
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        let key = '';
        const onData = (char) => {
            if (char === '\r' || char === '\n' || char === '\u0004') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', onData);
                stdout.write('\n');
                rl.close();
                resolve(key);
            }
            else if (char === '\u0003') {
                stdout.write('\n');
                process.exit(0);
            }
            else if (char === '\u007f') {
                if (key.length > 0) {
                    key = key.slice(0, -1);
                }
            }
            else {
                key += char;
            }
        };
        stdin.on('data', onData);
    });
}
async function runOnboarding() {
    console.log('');
    console.log('Z.ai API key required.');
    console.log('');
    while (true) {
        const key = await promptForApiKey();
        if (key.trim().length === 0) {
            console.log('API key cannot be empty.');
            continue;
        }
        const trimmedKey = key.trim();
        // Save to file
        await setApiKey(trimmedKey);
        console.log('✓ Saved to ~/.zai/auth.json');
        // Platform-specific shell profile setup
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            // On Windows, guide user to set environment variable
            console.log('');
            console.log('To set Z_KEY permanently on Windows:');
            console.log('  1. Open System Properties > Environment Variables');
            console.log('  2. Add new User variable: Z_KEY');
            console.log(`  3. Value: ${trimmedKey.substring(0, 8)}...`);
            console.log('');
            console.log('Or run in PowerShell (current session only):');
            console.log(`  $env:Z_KEY="${trimmedKey}"`);
            console.log('');
        }
        else {
            // Unix-like systems - try to add to shell profile
            const shellProfiles = [
                path.join(os.homedir(), '.zshrc'),
                path.join(os.homedir(), '.bashrc'),
                path.join(os.homedir(), '.bash_profile'),
            ];
            const exportLine = `export Z_KEY="${trimmedKey}"`;
            let updated = false;
            for (const shellProfile of shellProfiles) {
                try {
                    if (fs.existsSync(shellProfile)) {
                        let content = fs.readFileSync(shellProfile, 'utf-8');
                        // Check if already exists
                        if (content.includes('export Z_KEY=')) {
                            content = content.replace(/export Z_KEY=.*$/m, exportLine);
                        }
                        else {
                            content = content.trimEnd() + '\n\n# Z.ai CLI\n' + exportLine + '\n';
                        }
                        fs.writeFileSync(shellProfile, content);
                        console.log(`✓ Added Z_KEY to ${path.basename(shellProfile)}`);
                        console.log('');
                        console.log('Run this to activate:');
                        console.log(`  source ${shellProfile}`);
                        console.log('');
                        updated = true;
                        break;
                    }
                }
                catch {
                    // Try next profile
                }
            }
            if (!updated) {
                console.log('Set Z_KEY in your shell profile:');
                console.log(`  export Z_KEY="${trimmedKey}"`);
                console.log('');
            }
        }
        return;
    }
}
async function ensureAuthenticated() {
    const key = await getApiKey();
    if (key) {
        return key;
    }
    await runOnboarding();
    const newKey = await getApiKey();
    if (!newKey) {
        console.error('Authentication failed.');
        process.exit(1);
    }
    return newKey;
}
//# sourceMappingURL=auth.js.map