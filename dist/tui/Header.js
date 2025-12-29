"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Header = void 0;
const react_1 = __importDefault(require("react"));
const ink_1 = require("ink");
const git_1 = require("../git");
const settings_1 = require("../settings");
const profiles_1 = require("../profiles");
const Header = ({ projectName, workingDirectory }) => {
    const gitInfo = (0, git_1.getGitInfo)(workingDirectory);
    const model = (0, settings_1.getModel)().split('-').slice(1, 3).join('-');
    const profile = (0, profiles_1.getActiveProfileName)() || 'custom';
    const gitStatus = gitInfo.isRepo
        ? `${gitInfo.branch || 'unknown'}${gitInfo.isDirty ? '*' : ''}`
        : 'no-git';
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "row", justifyContent: "space-between", paddingX: 1, borderStyle: "single", borderBottom: true },
        react_1.default.createElement(ink_1.Box, null,
            react_1.default.createElement(ink_1.Text, { bold: true, color: "cyan" }, "zai"),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "\u00B7code"),
            react_1.default.createElement(ink_1.Text, null, " "),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, projectName)),
        react_1.default.createElement(ink_1.Box, null,
            react_1.default.createElement(ink_1.Text, { dimColor: true }, gitStatus),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, " \u00B7 "),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, model),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, " \u00B7 "),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, profile))));
};
exports.Header = Header;
//# sourceMappingURL=Header.js.map