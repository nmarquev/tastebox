// Runtime-overridable AI model settings, persisted to a JSON file so changes
// survive restarts and can be edited from the UI without redeploying.
// Env vars act as defaults/fallbacks.
import './env';
import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(__dirname, '../../config/ai-settings.json');

const ENV_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ENV_VISION_MODEL = process.env.OPENAI_VISION_MODEL || ENV_MODEL;

interface StoredAiSettings {
  model?: string;
  visionModel?: string;
}

let cache: StoredAiSettings | null = null;

function load(): StoredAiSettings {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    cache = {};
  }
  return cache!;
}

export function getModel(): string {
  return load().model || ENV_MODEL;
}

export function getVisionModel(): string {
  const s = load();
  return s.visionModel || s.model || ENV_VISION_MODEL;
}

// Effective settings plus where each value comes from (override vs env default).
export function getAiSettings() {
  const s = load();
  return {
    model: getModel(),
    visionModel: getVisionModel(),
    defaults: { model: ENV_MODEL, visionModel: ENV_VISION_MODEL },
    overridden: {
      model: Boolean(s.model),
      visionModel: Boolean(s.visionModel),
    },
  };
}

// Patch settings. Passing an empty string clears the override (reverts to env default).
export function updateAiSettings(patch: { model?: string; visionModel?: string }) {
  const current = { ...load() };

  if (patch.model !== undefined) {
    const v = patch.model.trim();
    if (v) current.model = v;
    else delete current.model;
  }
  if (patch.visionModel !== undefined) {
    const v = patch.visionModel.trim();
    if (v) current.visionModel = v;
    else delete current.visionModel;
  }

  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(current, null, 2));
  cache = current;
  return getAiSettings();
}
