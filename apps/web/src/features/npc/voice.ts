import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Giving the staff a voice, and giving the buyer a microphone.
 *
 * Both sit on the Web Speech API, and the two halves are not equal. Speaking
 * is local, free and works offline — the operating system's own voices. Hearing
 * is not: in Chrome, `SpeechRecognition` streams the audio to Google's servers,
 * which is a thing a buyer has to agree to rather than discover. So the
 * microphone is off until asked for, says plainly where the audio goes, and
 * nothing depends on it — every line a vendor can be asked aloud is also a
 * button.
 *
 * Neither half is available everywhere. Both report that rather than pretending.
 */

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { transcript: string; confidence: number };
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  const holder = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return holder.SpeechRecognition ?? holder.webkitSpeechRecognition ?? null;
}

export interface Speaker {
  /** False when the browser has no speech synthesis at all. */
  available: boolean;
  speaking: boolean;
  say: (text: string, language: string) => void;
  hush: () => void;
}

/**
 * The staff's voice.
 *
 * One utterance at a time: a vendor who is asked a second question stops
 * mid-sentence and answers it, which is what a person does.
 */
export function useSpeaker(enabled: boolean): Speaker {
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voices = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setAvailable(true);

    const read = (): void => {
      voices.current = window.speechSynthesis.getVoices();
    };

    read();
    // Chrome fills the list asynchronously, and an empty list on first render
    // is the normal case rather than a fault.
    window.speechSynthesis.addEventListener('voiceschanged', read);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', read);
      window.speechSynthesis.cancel();
    };
  }, []);

  const hush = useCallback(() => {
    if (!available) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [available]);

  const say = useCallback(
    (text: string, language: string) => {
      if (!available || !enabled || text.trim() === '') return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      // A voice in the right language if the system has one; otherwise the
      // default, which will mangle the accent but still be understood.
      const match = voices.current.find((voice) => voice.lang.startsWith(language.slice(0, 2)));
      if (match) utterance.voice = match;
      // A shade slower than default: shop assistants do not gabble.
      utterance.rate = 0.96;
      utterance.pitch = 1;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [available, enabled],
  );

  useEffect(() => {
    if (!enabled) hush();
  }, [enabled, hush]);

  return { available, speaking, say, hush };
}

export interface Listener {
  /** False when the browser has no speech recognition. */
  available: boolean;
  listening: boolean;
  /** What was heard last, final or interim, for showing back to the buyer. */
  heard: string;
  error: string | null;
  start: (language: string) => void;
  stop: () => void;
}

/**
 * The buyer's microphone.
 *
 * Single-shot rather than continuous: one question, one answer, and the
 * recording stops. A microphone that stays open while somebody walks around a
 * showroom is not something to hand out by default.
 */
export function useListener(onHeard: (text: string) => void): Listener {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setAvailable(recognitionConstructor() !== null);
    return () => {
      recognition.current?.abort();
      recognition.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(
    (language: string) => {
      const Constructor = recognitionConstructor();
      if (!Constructor) {
        setError('npc.micUnavailable');
        return;
      }

      recognition.current?.abort();
      setHeard('');
      setError(null);

      const instance = new Constructor();
      instance.lang = language;
      instance.continuous = false;
      instance.interimResults = true;
      instance.maxAlternatives = 1;

      instance.onresult = (event) => {
        let text = '';
        let final = false;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          text += result[0]?.transcript ?? '';
          if (result.isFinal) final = true;
        }

        setHeard(text);
        if (final) {
          setListening(false);
          onHeard(text);
        }
      };

      instance.onerror = () => {
        // Denied permission, no network, no speech: all the same to the buyer,
        // who needs to be told to use the buttons instead.
        setError('npc.micFailed');
        setListening(false);
      };

      instance.onend = () => setListening(false);

      recognition.current = instance;
      setListening(true);
      instance.start();
    },
    [onHeard],
  );

  return { available, listening, heard, error, start, stop };
}
