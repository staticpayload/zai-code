"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputBox = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const InputBox = ({ value, onChange, onSubmit, onSlash, placeholder = 'Type / for commands...', mode = 'edit', state = 'ready', }) => {
    (0, ink_1.useInput)((input, key) => {
        if (key.return) {
            onSubmit(value);
            return;
        }
        if (key.backspace || key.delete) {
            onChange(value.slice(0, -1));
            return;
        }
        if (key.escape) {
            onChange('');
            return;
        }
        // Regular character
        if (input && !key.ctrl && !key.meta) {
            const newValue = value + input;
            onChange(newValue);
            // Trigger command palette on /
            if (input === '/' && value === '') {
                onSlash();
            }
        }
    });
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "row", borderStyle: "round", borderColor: "gray", paddingX: 1 },
        react_1.default.createElement(ink_1.Text, { color: "cyan" }, mode),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, ":"),
        react_1.default.createElement(ink_1.Text, null, state),
        react_1.default.createElement(ink_1.Text, { bold: true, color: "white" }, "> "),
        value ? (react_1.default.createElement(ink_1.Text, null, value)) : (react_1.default.createElement(ink_1.Text, { dimColor: true }, placeholder)),
        react_1.default.createElement(ink_1.Text, { backgroundColor: "white" }, " ")));
};
exports.InputBox = InputBox;
//# sourceMappingURL=InputBox.js.map