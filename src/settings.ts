import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SETTINGS_FILE = path.join(os.homedir(), '.zai', 'settings.json');

export interface Settings {
  ui: {
    asciiLogo: 'on' | 'off';
    color: 'auto' | 'on' | 'off';
  };
  firstRun: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  ui: {
    asciiLogo: 'on',
    color: 'auto',
  },
  firstRun: true,
};

let cachedSettings: Settings | null = null;

export function loadSettings(): Settings {
  if (cachedSettings) return cachedSettings;

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content) as Partial<Settings>;
      cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
      return cachedSettings;
    }
  } catch {
    // Fall through to defaults
  }

  cachedSettings = { ...DEFAULT_SETTINGS };
  return cachedSettings;
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

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}

export function setNestedSetting(path: string, value: string): boolean {
  const settings = loadSettings();
  const parts = path.split('.');

  if (parts[0] === 'ui') {
    if (parts[1] === 'asciiLogo' && (value === 'on' || value === 'off')) {
      settings.ui.asciiLogo = value;
      saveSettings(settings);
      return true;
    }
    if (parts[1] === 'color' && (value === 'auto' || value === 'on' || value === 'off')) {
      settings.ui.color = value;
      saveSettings(settings);
      return true;
    }
  }

  return false;
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
  // auto: check terminal
  return process.stdout.isTTY && process.env.TERM !== 'dumb';
}

export function shouldShowLogo(): boolean {
  return loadSettings().ui.asciiLogo === 'on';
}
