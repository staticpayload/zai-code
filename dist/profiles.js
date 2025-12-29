"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILT_IN_PROFILES = void 0;
exports.getProfile = getProfile;
exports.listProfiles = listProfiles;
exports.applyProfile = applyProfile;
exports.getActiveProfileName = getActiveProfileName;
const settings_1 = require("./settings");
exports.BUILT_IN_PROFILES = [
    {
        name: 'safe',
        description: 'Conservative settings, strict confirmation',
        settings: {
            model: 'glm-4.7',
            contextScope: 'open',
            confirmationMode: 'strict',
            maxPlanIterations: 3,
        },
    },
    {
        name: 'balanced',
        description: 'Default settings for typical use',
        settings: {
            model: 'glm-4.7',
            contextScope: 'touched',
            confirmationMode: 'strict',
            maxPlanIterations: 5,
        },
    },
    {
        name: 'fast',
        description: 'Faster execution, less confirmation',
        settings: {
            model: 'glm-4.5',
            contextScope: 'open',
            confirmationMode: 'normal',
            maxPlanIterations: 3,
        },
    },
];
function getProfile(name) {
    return exports.BUILT_IN_PROFILES.find(p => p.name === name) || null;
}
function listProfiles() {
    return exports.BUILT_IN_PROFILES;
}
function applyProfile(name) {
    const profile = getProfile(name);
    if (!profile)
        return false;
    const settings = (0, settings_1.loadSettings)();
    if (profile.settings.model) {
        settings.model.current = profile.settings.model;
    }
    if (profile.settings.contextScope) {
        settings.context.scope = profile.settings.contextScope;
    }
    if (profile.settings.confirmationMode) {
        settings.execution.confirmationMode = profile.settings.confirmationMode;
    }
    if (profile.settings.maxPlanIterations !== undefined) {
        settings.execution.maxPlanIterations = profile.settings.maxPlanIterations;
    }
    (0, settings_1.saveSettings)(settings);
    return true;
}
function getActiveProfileName() {
    const settings = (0, settings_1.loadSettings)();
    for (const profile of exports.BUILT_IN_PROFILES) {
        const s = profile.settings;
        if ((!s.model || settings.model.current === s.model) &&
            (!s.contextScope || settings.context.scope === s.contextScope) &&
            (!s.confirmationMode || settings.execution.confirmationMode === s.confirmationMode) &&
            (s.maxPlanIterations === undefined || settings.execution.maxPlanIterations === s.maxPlanIterations)) {
            return profile.name;
        }
    }
    return 'custom';
}
//# sourceMappingURL=profiles.js.map