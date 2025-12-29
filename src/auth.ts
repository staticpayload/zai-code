import * as keytar from 'keytar';
import * as readline from 'readline';
import { RequestOptions } from 'https';
import { loadConfig } from './config';

const SERVICE_NAME = 'zai-code';
const ACCOUNT_NAME = 'api-key';

async function httpsGet(url: string, headers: Record<string, string>): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options: RequestOptions = {
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

export async function getApiKey(): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  } catch (error) {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
}

export async function deleteApiKey(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}

export async function hasValidCredentials(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.length > 0;
}

export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const config = loadConfig() as { api: { baseUrl: string } };
    const response = await httpsGet(`${config.api.baseUrl}/models`, {
      Authorization: `Bearer ${key}`,
    });
    return response.statusCode >= 200 && response.statusCode < 300;
  } catch {
    return false;
  }
}

export async function promptForApiKey(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Use readline with muted input for hidden password
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write('Enter API key: ');

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let key = '';

    const onData = (char: string) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        // Enter or Ctrl-D
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        rl.close();
        resolve(key);
      } else if (char === '\u0003') {
        // Ctrl-C
        stdout.write('\n');
        process.exit(0);
      } else if (char === '\u007f') {
        // Backspace
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
  while (true) {
    console.log('Z.ai API key required');
    const key = await promptForApiKey();

    if (await validateApiKey(key)) {
      await setApiKey(key);
      console.log('Authentication successful');
      return;
    } else {
      console.log('Invalid API key');
    }
  }
}

export async function ensureAuthenticated(): Promise<string> {
  if (await hasValidCredentials()) {
    const key = await getApiKey();
    return key as string;
  }

  await runOnboarding();

  const key = await getApiKey();
  return key as string;
}
