"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputArea = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const OutputArea = ({ lines, maxLines = 20 }) => {
    const visibleLines = lines.slice(-maxLines);
    const getColor = (type) => {
        switch (type) {
            case 'success': return 'green';
            case 'error': return 'red';
            case 'info': return 'cyan';
            default: return undefined;
        }
    };
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", flexGrow: 1, paddingX: 1, overflow: "hidden" }, visibleLines.length === 0 ? (react_1.default.createElement(ink_1.Text, { dimColor: true }, "Type / for commands, or enter a task")) : (visibleLines.map((line, i) => (react_1.default.createElement(ink_1.Box, { key: i },
        line.type === 'success' && react_1.default.createElement(ink_1.Text, { color: "green" }, "\u2713 "),
        line.type === 'error' && react_1.default.createElement(ink_1.Text, { color: "red" }, "\u2717 "),
        line.type === 'info' && react_1.default.createElement(ink_1.Text, { color: "cyan" }, "\u2192 "),
        react_1.default.createElement(ink_1.Text, { color: getColor(line.type), dimColor: line.type === 'dim' }, line.text)))))));
};
exports.OutputArea = OutputArea;
//# sourceMappingURL=OutputArea.js.map