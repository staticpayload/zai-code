import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.zai');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const STATE_PATH = path.join(CONFIG_DIR, 'state.json');

const DEFAULT_CONFIG = {
  api: {
    baseUrl: 'https://api.z.ai/api/coding/paas/v4/',
  },
};

const DEFAULT_STATE = {
  initialized: false,
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { mode: 0o755 });
  }
}

export function loadConfig(): Record<string, unknown> {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Record<string, unknown>): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function loadState(): Record<string, unknown> {
  ensureConfigDir();
  if (!fs.existsSync(STATE_PATH)) {
    saveState(DEFAULT_STATE);
    return { ...DEFAULT_STATE };
  }
  try {
    const content = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: Record<string, unknown>): void {
  ensureConfigDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}
