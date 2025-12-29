import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SETTINGS_FILE = path.join(os.homedir(), '.zai', 'settings.json');
const PROJECT_SETTINGS_FILE = '.zai/settings.json';

export interface Settings {
  model: {
    current: string;
  };
  ui: {
    asciiLogo: 'on' | 'off';
    color: 'auto' | 'on' | 'off';
    promptStyle: 'compact' | 'verbose';
  };
  execution: {
    confirmationMode: 'strict' | 'normal';
    maxPlanIterations: number;
    allowShellExec: boolean;
  };
  context: {
    scope: 'open' | 'touched' | 'full';
    maxTokens: number;
  };
  debug: {
    logging: boolean;
    errorDetail: 'brief' | 'full';
    dumpState: boolean;
  };
  firstRun: boolean;
}

// Z.ai model definitions (Anthropic-compatible API)
export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
}

export const ZAI_MODELS: ModelDefinition[] = [
  { id: 'glm-4.7', name: 'GLM-4.7', description: 'Flagship model (Sonnet/Opus tier)' },
  { id: 'glm-4.5-air', name: 'GLM-4.5-Air', description: 'Fast & efficient (Haiku tier)' },
];

const DEFAULT_SETTINGS: Settings = {
  model: {
    current: 'glm-4.7',
  },
  ui: {
    asciiLogo: 'on',
    color: 'auto',
    promptStyle: 'compact',
  },
  execution: {
    confirmationMode: 'strict',
    maxPlanIterations: 5,
    allowShellExec: false,
  },
  context: {
    scope: 'open',
    maxTokens: 50000,
  },
  debug: {
    logging: false,
    errorDetail: 'brief',
    dumpState: false,
  },
  firstRun: true,
};

// Available model IDs
export const AVAILABLE_MODELS = ZAI_MODELS.map(m => m.id);

let cachedSettings: Settings | null = null;

export function loadSettings(): Settings {
  if (cachedSettings) return cachedSettings;

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const loaded = JSON.parse(content);
      // Deep merge with defaults to ensure all fields exist
      cachedSettings = deepMerge(structuredClone(DEFAULT_SETTINGS), loaded);
      return cachedSettings;
    }
  } catch {
    // Fall through to defaults
  }

  cachedSettings = structuredClone(DEFAULT_SETTINGS);
  return cachedSettings;
}

// Clear cached settings (useful for testing or reloading)
export function clearSettingsCache(): void {
  cachedSettings = null;
}

function deepMerge<T>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults };
  for (const key in overrides) {
    if (overrides[key] !== null && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      (result as any)[key] = deepMerge((defaults as any)[key], overrides[key] as any);
    } else if (overrides[key] !== undefined) {
      (result as any)[key] = overrides[key];
    }
  }
  return result;
}

export function saveSettings(settings: Settings): void {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  cachedSettings = settings;
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return loadSettings()[key];
}

// Default model - ONLY valid option if stored model is invalid
const DEFAULT_MODEL = 'glm-4.7';

export function getModel(): string {
  const stored = loadSettings().model.current;

  // CRITICAL: Validate model is a valid glm-* model
  if (!AVAILABLE_MODELS.includes(stored)) {
    // Invalid model stored - reset to default and save
    console.warn(`Invalid model "${stored}" found in settings. Resetting to ${DEFAULT_MODEL}.`);
    setModel(DEFAULT_MODEL);
    return DEFAULT_MODEL;
  }

  return stored;
}

export function setModel(model: string): void {
  // CRITICAL: Only allow valid glm-* models
  if (!AVAILABLE_MODELS.includes(model)) {
    throw new Error(`Invalid model: ${model}. Valid models: ${AVAILABLE_MODELS.join(', ')}`);
  }

  const settings = loadSettings();
  settings.model.current = model;
  saveSettings(settings);
}

export function markFirstRunComplete(): void {
  const settings = loadSettings();
  settings.firstRun = false;
  saveSettings(settings);
}

export function isFirstRun(): boolean {
  return loadSettings().firstRun;
}

export function shouldShowColor(): boolean {
  const settings = loadSettings();
  if (settings.ui.color === 'off') return false;
  if (settings.ui.color === 'on') return true;
  return process.stdout.isTTY && process.env.TERM !== 'dumb';
}

export function shouldShowLogo(): boolean {
  return loadSettings().ui.asciiLogo === 'on';
}

export function setNestedSetting(path: string, value: string): boolean {
  const settings = loadSettings();
  const parts = path.split('.');

  // Handle all nested settings
  try {
    let obj: any = settings;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (!obj) return false;
    }
    const key = parts[parts.length - 1];

    // Type coercion
    if (value === 'true') obj[key] = true;
    else if (value === 'false') obj[key] = false;
    else if (!isNaN(Number(value))) obj[key] = Number(value);
    else obj[key] = value;

    saveSettings(settings);
    return true;
  } catch {
    return false;
  }
}

// Load project settings from current directory if exists
export function loadProjectSettings(projectPath?: string): Partial<Settings> | null {
  const cwd = projectPath || process.cwd();
  const projectSettingsPath = path.join(cwd, PROJECT_SETTINGS_FILE);

  try {
    if (fs.existsSync(projectSettingsPath)) {
      const content = fs.readFileSync(projectSettingsPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore
  }

  return null;
}

// Get effective settings (project overrides global)
export function getEffectiveSettings(projectPath?: string): Settings {
  const globalSettings = loadSettings();
  const projectSettings = loadProjectSettings(projectPath);

  if (!projectSettings) {
    return globalSettings;
  }

  return deepMerge(globalSettings, projectSettings);
}

// Save project settings
export function saveProjectSettings(settings: Partial<Settings>, projectPath?: string): void {
  const cwd = projectPath || process.cwd();
  const dir = path.join(cwd, '.zai');
  const settingsPath = path.join(dir, 'settings.json');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// Check if project settings exist
export function hasProjectSettings(projectPath?: string): boolean {
  const cwd = projectPath || process.cwd();
  const projectSettingsPath = path.join(cwd, PROJECT_SETTINGS_FILE);
  return fs.existsSync(projectSettingsPath);
}
