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
exports.AVAILABLE_MODELS = exports.ZAI_MODELS = void 0;
exports.loadSettings = loadSettings;
exports.clearSettingsCache = clearSettingsCache;
exports.saveSettings = saveSettings;
exports.getSetting = getSetting;
exports.getModel = getModel;
exports.setModel = setModel;
exports.markFirstRunComplete = markFirstRunComplete;
exports.isFirstRun = isFirstRun;
exports.shouldShowColor = shouldShowColor;
exports.shouldShowLogo = shouldShowLogo;
exports.getDefaultMode = getDefaultMode;
exports.setDefaultMode = setDefaultMode;
exports.setAsciiLogo = setAsciiLogo;
exports.setNestedSetting = setNestedSetting;
exports.loadProjectSettings = loadProjectSettings;
exports.getEffectiveSettings = getEffectiveSettings;
exports.saveProjectSettings = saveProjectSettings;
exports.hasProjectSettings = hasProjectSettings;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const SETTINGS_FILE = path.join(os.homedir(), '.zai', 'settings.json');
const PROJECT_SETTINGS_FILE = '.zai/settings.json';
exports.ZAI_MODELS = [
    { id: 'glm-4.7', name: 'GLM-4.7', description: 'Flagship model (Sonnet/Opus tier)' },
    { id: 'glm-4.5-air', name: 'GLM-4.5-Air', description: 'Fast & efficient (Haiku tier)' },
];
const DEFAULT_SETTINGS = {
    model: {
        current: 'glm-4.7',
    },
    ui: {
        asciiLogo: 'on',
        color: 'auto',
        promptStyle: 'compact',
    },
    execution: {
        defaultMode: 'edit',
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
exports.AVAILABLE_MODELS = exports.ZAI_MODELS.map(m => m.id);
let cachedSettings = null;
function loadSettings() {
    if (cachedSettings)
        return cachedSettings;
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const loaded = JSON.parse(content);
            // Deep merge with defaults to ensure all fields exist
            cachedSettings = deepMerge(structuredClone(DEFAULT_SETTINGS), loaded);
            return cachedSettings;
        }
    }
    catch {
        // Fall through to defaults
    }
    cachedSettings = structuredClone(DEFAULT_SETTINGS);
    return cachedSettings;
}
// Clear cached settings (useful for testing or reloading)
function clearSettingsCache() {
    cachedSettings = null;
}
function deepMerge(defaults, overrides) {
    const result = { ...defaults };
    for (const key in overrides) {
        if (overrides[key] !== null && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
            result[key] = deepMerge(defaults[key], overrides[key]);
        }
        else if (overrides[key] !== undefined) {
            result[key] = overrides[key];
        }
    }
    return result;
}
function saveSettings(settings) {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    cachedSettings = settings;
}
function getSetting(key) {
    return loadSettings()[key];
}
// Default model - ONLY valid option if stored model is invalid
const DEFAULT_MODEL = 'glm-4.7';
function getModel() {
    const stored = loadSettings().model.current;
    // CRITICAL: Validate model is a valid glm-* model
    if (!exports.AVAILABLE_MODELS.includes(stored)) {
        // Invalid model stored - reset to default and save
        console.warn(`Invalid model "${stored}" found in settings. Resetting to ${DEFAULT_MODEL}.`);
        setModel(DEFAULT_MODEL);
        return DEFAULT_MODEL;
    }
    return stored;
}
function setModel(model) {
    // CRITICAL: Only allow valid glm-* models
    if (!exports.AVAILABLE_MODELS.includes(model)) {
        throw new Error(`Invalid model: ${model}. Valid models: ${exports.AVAILABLE_MODELS.join(', ')}`);
    }
    const settings = loadSettings();
    settings.model.current = model;
    saveSettings(settings);
}
function markFirstRunComplete() {
    const settings = loadSettings();
    settings.firstRun = false;
    saveSettings(settings);
}
function isFirstRun() {
    return loadSettings().firstRun;
}
function shouldShowColor() {
    const settings = loadSettings();
    if (settings.ui.color === 'off')
        return false;
    if (settings.ui.color === 'on')
        return true;
    return process.stdout.isTTY && process.env.TERM !== 'dumb';
}
function shouldShowLogo() {
    return loadSettings().ui.asciiLogo === 'on';
}
function getDefaultMode() {
    return loadSettings().execution.defaultMode || 'edit';
}
function setDefaultMode(mode) {
    const settings = loadSettings();
    settings.execution.defaultMode = mode;
    saveSettings(settings);
}
function setAsciiLogo(enabled) {
    const settings = loadSettings();
    settings.ui.asciiLogo = enabled ? 'on' : 'off';
    saveSettings(settings);
}
function setNestedSetting(path, value) {
    const settings = loadSettings();
    const parts = path.split('.');
    // Handle all nested settings
    try {
        let obj = settings;
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
            if (!obj)
                return false;
        }
        const key = parts[parts.length - 1];
        // Type coercion
        if (value === 'true')
            obj[key] = true;
        else if (value === 'false')
            obj[key] = false;
        else if (!isNaN(Number(value)))
            obj[key] = Number(value);
        else
            obj[key] = value;
        saveSettings(settings);
        return true;
    }
    catch {
        return false;
    }
}
// Load project settings from current directory if exists
function loadProjectSettings(projectPath) {
    const cwd = projectPath || process.cwd();
    const projectSettingsPath = path.join(cwd, PROJECT_SETTINGS_FILE);
    try {
        if (fs.existsSync(projectSettingsPath)) {
            const content = fs.readFileSync(projectSettingsPath, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch {
        // Ignore
    }
    return null;
}
// Get effective settings (project overrides global)
function getEffectiveSettings(projectPath) {
    const globalSettings = loadSettings();
    const projectSettings = loadProjectSettings(projectPath);
    if (!projectSettings) {
        return globalSettings;
    }
    return deepMerge(globalSettings, projectSettings);
}
// Save project settings
function saveProjectSettings(settings, projectPath) {
    const cwd = projectPath || process.cwd();
    const dir = path.join(cwd, '.zai');
    const settingsPath = path.join(dir, 'settings.json');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}
// Check if project settings exist
function hasProjectSettings(projectPath) {
    const cwd = projectPath || process.cwd();
    const projectSettingsPath = path.join(cwd, PROJECT_SETTINGS_FILE);
    return fs.existsSync(projectSettingsPath);
}
//# sourceMappingURL=settings.js.map