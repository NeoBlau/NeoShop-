/**
 * Model providers.
 *
 * The application never depends on any of them: the built-in offline engine is
 * always available and is used as a fallback when an external call fails.
 * Adding a provider means adding one entry to PROVIDERS.
 */
import { SPEC_DOC } from './schema.js';

export const SYSTEM_PROMPT = `You are a business process modelling assistant inside the FiberModeler editor.
Return ONLY a JSON object describing the requested model - no prose, no markdown fences.
Schema:
${SPEC_DOC}

Rules:
- BPMN: every process starts with a start event and ends with at least one end event; a gateway must have at least two outgoing flows, each with a label; use precise element types (userTask, serviceTask, sendTask, receiveTask, manualTask, businessRuleTask, scriptTask, exclusiveGateway, parallelGateway, startMessageEvent, endEvent ...).
- BPMN: put each participant in its own lane when the description names roles.
- IDEF0: give the context function plus 3-6 sub functions; every function needs at least one control and one output; arrows are short noun phrases.
- Keep labels in the language of the user's description.
- Use short ids (n1, n2 ...) and reference them in edges.`;

export function buildUserPrompt(prompt, { notation = 'auto', complexity = 'medium', locale = 'ru' } = {}) {
  const detail = { simple: '4-6 elements', medium: '7-12 elements', detailed: '13-20 elements' }[complexity] || '7-12 elements';
  const target = notation === 'auto' ? 'choose BPMN for a workflow, IDEF0 for a function/system decomposition' : `use ${notation}`;
  return `Model this process: ${prompt}\n\nNotation: ${target}. Level of detail: ${detail}. Answer language: ${locale}.`;
}

/** Extracts a JSON object from a model answer (tolerates fences and prose). */
export function parseModelJson(textValue) {
  const text = String(textValue || '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model did not return JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

async function postJson(url, headers, body, signal) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
  }
  return response.json();
}

export const PROVIDERS = {
  local: {
    id: 'local',
    label: { en: 'Built-in (offline)', ru: 'Встроенный (офлайн)' },
    needsKey: false,
    offline: true,
  },

  claude: {
    id: 'claude',
    label: { en: 'Claude (Anthropic)', ru: 'Claude (Anthropic)' },
    needsKey: true,
    defaultModel: 'claude-opus-5',
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    async generate({ prompt, options, settings, signal }) {
      const apiKey = settings.apiKey;
      if (!apiKey) throw new Error('API key is not set');
      const data = await postJson(
        settings.endpoint || this.defaultEndpoint,
        {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // required for calls made directly from a browser page
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        {
          model: settings.model || this.defaultModel,
          max_tokens: 8000,
          thinking: { type: 'adaptive' },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserPrompt(prompt, options) }],
        },
        signal
      );
      const text = (data.content || [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      return parseModelJson(text);
    },
  },

  openai: {
    id: 'openai',
    label: { en: 'OpenAI', ru: 'OpenAI' },
    needsKey: true,
    defaultModel: 'gpt-4o-mini',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    async generate({ prompt, options, settings, signal }) {
      if (!settings.apiKey) throw new Error('API key is not set');
      const data = await postJson(
        settings.endpoint || this.defaultEndpoint,
        { authorization: `Bearer ${settings.apiKey}` },
        {
          model: settings.model || this.defaultModel,
          temperature: Number(settings.temperature ?? 0.2),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(prompt, options) },
          ],
        },
        signal
      );
      return parseModelJson(data.choices?.[0]?.message?.content);
    },
  },

  ollama: {
    id: 'ollama',
    label: { en: 'Ollama (local LLM)', ru: 'Ollama (локальная модель)' },
    needsKey: false,
    defaultModel: 'llama3.1',
    defaultEndpoint: 'http://localhost:11434/api/chat',
    async generate({ prompt, options, settings, signal }) {
      const data = await postJson(
        settings.endpoint || this.defaultEndpoint,
        {},
        {
          model: settings.model || this.defaultModel,
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(prompt, options) },
          ],
        },
        signal
      );
      return parseModelJson(data.message?.content ?? data.response);
    },
  },

  custom: {
    id: 'custom',
    label: { en: 'Custom endpoint', ru: 'Свой endpoint' },
    needsKey: false,
    defaultEndpoint: '',
    async generate({ prompt, options, settings, signal }) {
      if (!settings.endpoint) throw new Error('Endpoint is not set');
      const data = await postJson(
        settings.endpoint,
        settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {},
        { model: settings.model || '', system: SYSTEM_PROMPT, prompt: buildUserPrompt(prompt, options) },
        signal
      );
      if (typeof data === 'object' && (data.nodes || data.functions || data.context)) return data;
      return parseModelJson(data.content ?? data.text ?? data.output ?? JSON.stringify(data));
    },
  },
};

export function providerList() {
  return Object.values(PROVIDERS);
}
