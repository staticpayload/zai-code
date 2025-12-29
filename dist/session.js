"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_SCHEMA = void 0;
exports.createSession = createSession;
exports.getSession = getSession;
exports.resetSession = resetSession;
exports.addOpenFile = addOpenFile;
exports.removeOpenFile = removeOpenFile;
exports.clearOpenFiles = clearOpenFiles;
exports.setLastPlan = setLastPlan;
exports.setLastDiff = setLastDiff;
exports.setPendingActions = setPendingActions;
exports.setMode = setMode;
exports.setDryRun = setDryRun;
exports.getMode = getMode;
exports.isDryRun = isDryRun;
exports.setIntent = setIntent;
exports.getIntent = getIntent;
exports.clearIntent = clearIntent;
exports.setIntentType = setIntentType;
exports.getIntentType = getIntentType;
exports.setLastExecResult = setLastExecResult;
exports.getLastExecResult = getLastExecResult;
exports.setTaskSteps = setTaskSteps;
exports.getTaskSteps = getTaskSteps;
exports.getCurrentStep = getCurrentStep;
exports.advanceStep = advanceStep;
exports.updateStepStatus = updateStepStatus;
exports.getStepProgress = getStepProgress;
exports.PLAN_SCHEMA = {
    type: 'object',
    required: ['status', 'plan'],
    properties: {
        status: { type: 'string', enum: ['success', 'error'] },
        plan: {
            type: 'array',
            items: {
                type: 'object',
                required: ['id', 'description'],
                properties: {
                    id: { type: 'string' },
                    description: { type: 'string' },
                    files: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        error: { type: 'string' },
    },
};
// Create a new session state
function createSession(workingDirectory) {
    return {
        openFiles: [],
        lastPlan: null,
        lastDiff: null,
        pendingActions: null,
        mode: 'edit',
        dryRun: false,
        workingDirectory: workingDirectory || process.cwd(),
        currentIntent: null,
        intentType: null,
        lastExecResult: null,
        taskSteps: [],
        currentStepIndex: 0,
    };
}
// Global session instance
let currentSession = null;
// Get or create the current session
function getSession() {
    if (!currentSession) {
        currentSession = createSession();
    }
    return currentSession;
}
// Reset the session to initial state
function resetSession() {
    currentSession = createSession(currentSession?.workingDirectory);
}
// Session mutation helpers
function addOpenFile(path) {
    const session = getSession();
    if (!session.openFiles.includes(path)) {
        session.openFiles.push(path);
    }
}
function removeOpenFile(path) {
    const session = getSession();
    session.openFiles = session.openFiles.filter(f => f !== path);
}
function clearOpenFiles() {
    getSession().openFiles = [];
}
function setLastPlan(plan) {
    getSession().lastPlan = plan;
}
function setLastDiff(diff) {
    getSession().lastDiff = diff;
}
function setPendingActions(actions) {
    getSession().pendingActions = actions;
}
function setMode(mode) {
    getSession().mode = mode;
}
function setDryRun(enabled) {
    getSession().dryRun = enabled;
}
function getMode() {
    return getSession().mode;
}
function isDryRun() {
    return getSession().dryRun;
}
function setIntent(intent) {
    getSession().currentIntent = intent;
}
function getIntent() {
    return getSession().currentIntent;
}
function clearIntent() {
    getSession().currentIntent = null;
}
function setIntentType(type) {
    getSession().intentType = type;
}
function getIntentType() {
    return getSession().intentType;
}
function setLastExecResult(result) {
    getSession().lastExecResult = result;
}
function getLastExecResult() {
    return getSession().lastExecResult;
}
// Multi-step task helpers
function setTaskSteps(steps) {
    const session = getSession();
    session.taskSteps = steps;
    session.currentStepIndex = 0;
}
function getTaskSteps() {
    return getSession().taskSteps;
}
function getCurrentStep() {
    const session = getSession();
    if (session.taskSteps.length === 0)
        return null;
    if (session.currentStepIndex >= session.taskSteps.length)
        return null;
    return session.taskSteps[session.currentStepIndex];
}
function advanceStep() {
    const session = getSession();
    session.currentStepIndex++;
    return getCurrentStep();
}
function updateStepStatus(stepId, status) {
    const session = getSession();
    const step = session.taskSteps.find(s => s.id === stepId);
    if (step) {
        step.status = status;
    }
}
function getStepProgress() {
    const session = getSession();
    const completed = session.taskSteps.filter(s => s.status === 'applied' || s.status === 'skipped').length;
    return {
        current: session.currentStepIndex + 1,
        total: session.taskSteps.length,
        completed,
    };
}
//# sourceMappingURL=session.js.map