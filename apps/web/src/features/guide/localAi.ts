import { useCallback, useEffect, useState } from 'react';

/**
 * Talking to a language model the buyer runs themselves.
 *
 * "Local" is the whole point and it is meant literally: the endpoint is a
 * server on their own machine — Ollama, LM Studio, llama.cpp — and the request
 * goes straight from their browser to it. Nothing passes through us, and there
 * is no key to hold, because the model belongs to the person asking.
 *
 * Which also means it is off by default and stays off until somebody puts an
 * address in. The guide answers from its script without one; a model is an
 * upgrade, not a dependency.
 *
 * The wire format is the OpenAI chat-completions shape, because every one of
 * those servers speaks it. It is not a call to OpenAI.
 */

const STORAGE_KEY = 'sfera.localAi';
/** What Ollama listens on out of the box. LM Studio uses 1234. */
export const SUGGESTED_ENDPOINT = 'http://127.0.0.1:11434/v1';
const TIMEOUT_MS = 60_000;

export interface LocalAi {
  /** The endpoint in use, or null when nobody has configured one. */
  endpoint: string | null;
  /** Which model the server offered. Null until it has been probed. */
  model: string | null;
  state: 'off' | 'checking' | 'ready' | 'unreachable';
  /** A translation key when the last attempt failed. */
  error: string | null;
  thinking: boolean;
  connect: (endpoint: string) => void;
  disconnect: () => void;
  /** Asks once. Returns the answer, or null if it could not be had. */
  ask: (brief: string, question: string) => Promise<string | null>;
}

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the address just has to be retyped.
    return null;
  }
}

function remember(endpoint: string | null): void {
  try {
    if (endpoint === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, endpoint);
  } catch {
    // Not remembering it is not worth telling anybody about.
  }
}

/** Trims the trailing slash, so the caller may paste either form. */
function normalise(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

interface ModelListing {
  data?: { id?: unknown }[];
}

interface Completion {
  choices?: { message?: { content?: unknown } }[];
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function useLocalAi(): LocalAi {
  const [endpoint, setEndpoint] = useState<string | null>(remembered);
  const [model, setModel] = useState<string | null>(null);
  const [state, setState] = useState<LocalAi['state']>(endpoint === null ? 'off' : 'checking');
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  // Probed once per address, because a model that is not there should be said
  // so before somebody types a question into a box that will never answer.
  useEffect(() => {
    if (endpoint === null) {
      setState('off');
      setModel(null);
      return;
    }

    let live = true;
    setState('checking');
    setError(null);

    void fetchJson(`${endpoint}/models`)
      .then((listing) => {
        if (!live) return;
        const first = (listing as ModelListing).data?.[0]?.id;
        setModel(typeof first === 'string' ? first : null);
        setState('ready');
      })
      .catch((cause: unknown) => {
        if (!live) return;
        // Almost always one of two things: nothing is listening, or the server
        // is listening and refusing the browser's origin. Both need the same
        // sentence from us, and the console keeps the detail.
        console.warn('The local model could not be reached', cause);
        setState('unreachable');
        setModel(null);
      });

    return () => {
      live = false;
    };
  }, [endpoint]);

  const connect = useCallback((next: string) => {
    const clean = normalise(next);
    if (clean === '') return;
    remember(clean);
    setEndpoint(clean);
  }, []);

  const disconnect = useCallback(() => {
    remember(null);
    setEndpoint(null);
    setError(null);
  }, []);

  const ask = useCallback(
    async (brief: string, question: string): Promise<string | null> => {
      if (endpoint === null) return null;

      setThinking(true);
      setError(null);

      try {
        const body = await fetchJson(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: model ?? 'local',
            // Low, because the job is to reword facts rather than to have
            // ideas about them.
            temperature: 0.2,
            max_tokens: 400,
            messages: [
              { role: 'system', content: brief },
              { role: 'user', content: question },
            ],
          }),
        });

        const answer = (body as Completion).choices?.[0]?.message?.content;
        if (typeof answer !== 'string' || answer.trim() === '') {
          setError('guide.aiEmpty');
          return null;
        }

        return answer.trim();
      } catch (cause: unknown) {
        console.warn('The local model did not answer', cause);
        setError('guide.aiFailed');
        return null;
      } finally {
        setThinking(false);
      }
    },
    [endpoint, model],
  );

  return { endpoint, model, state, error, thinking, connect, disconnect, ask };
}
