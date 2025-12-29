import { loadSettings, saveSettings, Settings } from './settings';

export interface Profile {
  name: string;
  description: string;
  settings: Partial<{
    model: string;
    contextScope: 'open' | 'touched' | 'full';
    confirmationMode: 'strict' | 'normal';
    maxPlanIterations: number;
  }>;
}

export const BUILT_IN_PROFILES: Profile[] = [
  {
    name: 'quality',
    description: 'Best quality, flagship model',
    settings: {
      model: 'glm-4.7',
      contextScope: 'touched',
      confirmationMode: 'strict',
      maxPlanIterations: 5,
    },
  },
  {
    name: 'fast',
    description: 'Fast & efficient responses',
    settings: {
      model: 'glm-4.5-air',
      contextScope: 'open',
      confirmationMode: 'normal',
      maxPlanIterations: 3,
    },
  },
];

export function getProfile(name: string): Profile | null {
  return BUILT_IN_PROFILES.find(p => p.name === name) || null;
}

export function listProfiles(): Profile[] {
  return BUILT_IN_PROFILES;
}

export function applyProfile(name: string): boolean {
  const profile = getProfile(name);
  if (!profile) return false;

  const settings = loadSettings();

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

  saveSettings(settings);
  return true;
}

export function getActiveProfileName(): string | null {
  const settings = loadSettings();

  for (const profile of BUILT_IN_PROFILES) {
    const s = profile.settings;
    if (
      (!s.model || settings.model.current === s.model) &&
      (!s.contextScope || settings.context.scope === s.contextScope) &&
      (!s.confirmationMode || settings.execution.confirmationMode === s.confirmationMode) &&
      (s.maxPlanIterations === undefined || settings.execution.maxPlanIterations === s.maxPlanIterations)
    ) {
      return profile.name;
    }
  }

  return 'custom';
}
