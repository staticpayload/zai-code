import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from './config';

const ENV_VAR_NAME = 'Z_KEY';
const AUTH_FILE = path.join(os.homedir(), '.zai', 'auth.json');

// Ensure .zai directory exists
function ensureAuthDir(): void {
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

// Get API key from environment or file
export async function getApiKey(): Promise<string | null> {
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
  } catch {
    // Fall through
  }

  return null;
}

// Save API key to file
export async function setApiKey(key: string): Promise<void> {
  ensureAuthDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ apiKey: key }, null, 2), { mode: 0o600 });
}

// Delete saved API key
export async function deleteApiKey(): Promise<void> {
  if (fs.existsSync(AUTH_FILE)) {
    fs.unlinkSync(AUTH_FILE);
  }
}

export async function hasValidCredentials(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.length > 0;
}

async function httpsGet(url: string, headers: Record<string, string>): Promise<{ statusCode: number; data: string }> {
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

    const req = require('https').request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: string) => {
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

export async function validateApiKey(key: string): Promise<boolean> {
  if (!key || key.trim().length === 0) {
    return false;
  }
  
  try {
    const config = loadConfig() as { api?: { baseUrl?: string } };
    // Z.ai (Zhipu AI) international coding API
    const baseUrl = config.api?.baseUrl || 'https://api.z.ai/api/coding/paas/v4/';
    const modelsUrl = baseUrl.endsWith('/') ? `${baseUrl}models` : `${baseUrl}/models`;
    const response = await httpsGet(modelsUrl, {
      'Authorization': `Bearer ${key}`,
    });
    return response.statusCode >= 200 && response.statusCode < 300;
  } catch {
    // Skip validation if network fails - assume key is valid
    return true;
  }
}

export async function promptForApiKey(): Promise<string> {
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

    const onData = (char: string) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        rl.close();
        resolve(key);
      } else if (char === '\u0003') {
        stdout.write('\n');
        process.exit(0);
      } else if (char === '\u007f') {
        if (key.length > 0) {
          key = key.slice(0, -1);
        }
      } else {
        key += char;
      }
    };

    stdin.on('data', onData);
  });
}

export async function runOnboarding(): Promise<void> {
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
    } else {
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
            } else {
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
        } catch {
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

export async function ensureAuthenticated(): Promise<string> {
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
