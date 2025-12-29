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
exports.STATE_PATH = exports.CONFIG_PATH = exports.CONFIG_DIR = void 0;
exports.ensureConfigDir = ensureConfigDir;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.loadState = loadState;
exports.saveState = saveState;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
exports.CONFIG_DIR = path.join(os.homedir(), '.zai');
exports.CONFIG_PATH = path.join(exports.CONFIG_DIR, 'config.json');
exports.STATE_PATH = path.join(exports.CONFIG_DIR, 'state.json');
const DEFAULT_CONFIG = {
    api: {
        baseUrl: 'https://api.z.ai/api/coding/paas/v4/',
    },
};
const DEFAULT_STATE = {
    initialized: false,
};
function ensureConfigDir() {
    if (!fs.existsSync(exports.CONFIG_DIR)) {
        fs.mkdirSync(exports.CONFIG_DIR, { mode: 0o755 });
    }
}
function loadConfig() {
    ensureConfigDir();
    if (!fs.existsSync(exports.CONFIG_PATH)) {
        saveConfig(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG };
    }
    try {
        const content = fs.readFileSync(exports.CONFIG_PATH, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        return { ...DEFAULT_CONFIG };
    }
}
function saveConfig(config) {
    ensureConfigDir();
    fs.writeFileSync(exports.CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
function loadState() {
    ensureConfigDir();
    if (!fs.existsSync(exports.STATE_PATH)) {
        saveState(DEFAULT_STATE);
        return { ...DEFAULT_STATE };
    }
    try {
        const content = fs.readFileSync(exports.STATE_PATH, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        return { ...DEFAULT_STATE };
    }
}
function saveState(state) {
    ensureConfigDir();
    fs.writeFileSync(exports.STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}
//# sourceMappingURL=config.js.map