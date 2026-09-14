/**
 * Auto Build entry point.
 *
 * Always resolves to a usable specification: an external provider is tried
 * first when configured, and the offline engine takes over on any failure.
 */
import { generateLocalSpec, detectNotation } from './local.js';
import { PROVIDERS } from './providers.js';
import { buildDiagrams, normalizeSpec } from './schema.js';

export async function generateModel({ prompt, notation = 'auto', complexity = 'medium', locale = 'ru', provider = 'local', settings = {}, signal }) {
  const text = String(prompt || '').trim();
  if (!text) throw new Error('empty prompt');
  const options = { notation, complexity, locale };

  const engine = PROVIDERS[provider] || PROVIDERS.local;
  if (engine.offline || !engine.generate) {
    const result = generateLocalSpec(text, options);
    return { ...result, provider: 'local' };
  }

  try {
    const raw = await engine.generate({ prompt: text, options, settings, signal });
    const spec = normalizeSpec(raw);
    if (notation !== 'auto') spec.notation = notation;
    return { spec, source: 'model', provider: engine.id };
  } catch (error) {
    const fallback = generateLocalSpec(text, options);
    return { ...fallback, provider: 'local', fallbackFrom: engine.id, error: error.message };
  }
}

export { buildDiagrams, detectNotation, generateLocalSpec };
export { PROVIDERS, providerList } from './providers.js';
