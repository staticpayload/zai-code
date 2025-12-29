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
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.setNestedSetting = setNestedSetting;
exports.markFirstRunComplete = markFirstRunComplete;
exports.isFirstRun = isFirstRun;
exports.shouldShowColor = shouldShowColor;
exports.shouldShowLogo = shouldShowLogo;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const SETTINGS_FILE = path.join(os.homedir(), '.zai', 'settings.json');
const DEFAULT_SETTINGS = {
    ui: {
        asciiLogo: 'on',
        color: 'auto',
    },
    firstRun: true,
};
let cachedSettings = null;
function loadSettings() {
    if (cachedSettings)
        return cachedSettings;
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const parsed = JSON.parse(content);
            cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
            return cachedSettings;
        }
    }
    catch {
        // Fall through to defaults
    }
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
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
function setSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
}
function setNestedSetting(path, value) {
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
    // auto: check terminal
    return process.stdout.isTTY && process.env.TERM !== 'dumb';
}
function shouldShowLogo() {
    return loadSettings().ui.asciiLogo === 'on';
}
//# sourceMappingURL=settings.js.map