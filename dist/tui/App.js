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
exports.App = void 0;
const react_1 = __importStar(require("react"));
const ink_1 = require("ink");
const Header_1 = require("./Header");
const OutputArea_1 = require("./OutputArea");
const InputBox_1 = require("./InputBox");
const CommandPalette_1 = require("./CommandPalette");
const session_1 = require("../session");
// Command definitions with descriptions
const COMMANDS = [
    { name: 'help', description: 'Show all commands' },
    { name: 'plan', description: 'Generate execution plan' },
    { name: 'generate', description: 'Create file changes' },
    { name: 'diff', description: 'Review pending changes' },
    { name: 'apply', description: 'Apply changes' },
    { name: 'undo', description: 'Rollback last operation' },
    { name: 'reset', description: 'Reset session state' },
    { name: 'exit', description: 'Exit zcode' },
    { name: 'mode', description: 'Set mode' },
    { name: 'dry-run', description: 'Toggle dry-run mode' },
    { name: 'profile', description: 'Manage profiles' },
    { name: 'settings', description: 'Open settings menu' },
    { name: 'context', description: 'Show current context' },
    { name: 'files', description: 'List open files' },
    { name: 'open', description: 'Add file to context' },
    { name: 'workspace', description: 'Show workspace info' },
    { name: 'git', description: 'Show git status' },
    { name: 'exec', description: 'Run shell command' },
    { name: 'history', description: 'View task history' },
    { name: 'doctor', description: 'System health check' },
    { name: 'decompose', description: 'Break task into steps' },
    { name: 'step', description: 'Plan current step' },
    { name: 'next', description: 'Complete and advance' },
    { name: 'skip', description: 'Skip current step' },
    { name: 'progress', description: 'Show task progress' },
];
const App = ({ projectName, workingDirectory, onCommand, onExit, }) => {
    const { exit } = (0, ink_1.useApp)();
    const [input, setInput] = (0, react_1.useState)('');
    const [output, setOutput] = (0, react_1.useState)([]);
    const [showPalette, setShowPalette] = (0, react_1.useState)(false);
    const [paletteIndex, setPaletteIndex] = (0, react_1.useState)(0);
    const [mode, setMode] = (0, react_1.useState)('edit');
    const [state, setState] = (0, react_1.useState)('ready');
    // Get session state
    const updateState = (0, react_1.useCallback)(() => {
        const session = (0, session_1.getSession)();
        setMode(session.mode);
        if (session.pendingActions || session.lastDiff) {
            setState('pending');
        }
        else if (session.lastPlan && session.lastPlan.length > 0) {
            setState('planned');
        }
        else {
            setState('ready');
        }
    }, []);
    const handleInputChange = (0, react_1.useCallback)((value) => {
        setInput(value);
        // Show palette when typing /
        if (value.startsWith('/')) {
            setShowPalette(true);
            setPaletteIndex(0);
        }
        else if (!value.includes('/')) {
            setShowPalette(false);
        }
    }, []);
    const handleSubmit = (0, react_1.useCallback)(async (value) => {
        if (!value.trim())
            return;
        // Handle exit
        if (value === '/exit' || value === 'exit' || value === 'quit') {
            onExit();
            exit();
            return;
        }
        setShowPalette(false);
        setInput('');
        // Add input to output
        setOutput(prev => [...prev, { type: 'dim', text: `> ${value}` }]);
        // Execute command
        try {
            const result = await onCommand(value);
            setOutput(prev => [...prev, ...result]);
        }
        catch (e) {
            setOutput(prev => [...prev, { type: 'error', text: String(e) }]);
        }
        updateState();
    }, [onCommand, onExit, exit, updateState]);
    const handleSlash = (0, react_1.useCallback)(() => {
        setShowPalette(true);
        setPaletteIndex(0);
    }, []);
    const handlePaletteSelect = (0, react_1.useCallback)((command) => {
        setInput(`/${command} `);
        setShowPalette(false);
        setPaletteIndex(0);
    }, []);
    const handlePaletteClose = (0, react_1.useCallback)(() => {
        setShowPalette(false);
        setPaletteIndex(0);
    }, []);
    const handlePaletteNavigate = (0, react_1.useCallback)((direction) => {
        const query = input.replace(/^\//, '').toLowerCase();
        const filtered = COMMANDS.filter(cmd => cmd.name.startsWith(query));
        const max = Math.min(filtered.length - 1, 7);
        if (direction === 'up') {
            setPaletteIndex(prev => Math.max(0, prev - 1));
        }
        else {
            setPaletteIndex(prev => Math.min(max, prev + 1));
        }
    }, [input]);
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", height: "100%" },
        react_1.default.createElement(Header_1.Header, { projectName: projectName, workingDirectory: workingDirectory }),
        react_1.default.createElement(OutputArea_1.OutputArea, { lines: output }),
        showPalette && (react_1.default.createElement(CommandPalette_1.CommandPalette, { commands: COMMANDS, filter: input, selectedIndex: paletteIndex, onSelect: handlePaletteSelect, onClose: handlePaletteClose, onNavigate: handlePaletteNavigate, visible: showPalette })),
        react_1.default.createElement(InputBox_1.InputBox, { value: input, onChange: handleInputChange, onSubmit: handleSubmit, onSlash: handleSlash, mode: mode, state: state })));
};
exports.App = App;
//# sourceMappingURL=App.js.map