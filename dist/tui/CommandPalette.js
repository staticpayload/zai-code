"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandPalette = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const CommandPalette = ({ commands, filter, selectedIndex, onSelect, onClose, onNavigate, visible, }) => {
    const query = filter.replace(/^\//, '').toLowerCase();
    const filtered = commands.filter(cmd => cmd.name.startsWith(query)).slice(0, 8);
    (0, ink_1.useInput)((input, key) => {
        if (!visible)
            return;
        if (key.escape) {
            onClose();
            return;
        }
        if (key.upArrow) {
            onNavigate('up');
            return;
        }
        if (key.downArrow) {
            onNavigate('down');
            return;
        }
        if (key.return && filtered.length > 0) {
            onSelect(filtered[selectedIndex]?.name || '');
            return;
        }
        if (key.tab && filtered.length > 0) {
            onSelect(filtered[selectedIndex]?.name || '');
            return;
        }
    });
    if (!visible || filtered.length === 0) {
        return null;
    }
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", marginBottom: 1, paddingX: 1 },
        react_1.default.createElement(ink_1.Text, { dimColor: true }, "Commands"),
        react_1.default.createElement(ink_1.Box, { flexDirection: "column" }, filtered.map((cmd, i) => (react_1.default.createElement(ink_1.Box, { key: cmd.name, flexDirection: "row" },
            react_1.default.createElement(ink_1.Text, { color: i === selectedIndex ? 'cyan' : undefined }, i === selectedIndex ? '▸ ' : '  '),
            react_1.default.createElement(ink_1.Text, { bold: i === selectedIndex, color: i === selectedIndex ? 'white' : 'gray' },
                "/",
                cmd.name.padEnd(14)),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, cmd.description))))),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, "\u2191\u2193 navigate \u00B7 Enter select \u00B7 Esc close")));
};
exports.CommandPalette = CommandPalette;
//# sourceMappingURL=CommandPalette.js.map