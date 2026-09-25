import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The street's sound bed.
 *
 * A single looping element rather than positional audio: what a pavement sounds
 * like does not change meaningfully over twenty metres, and one <audio> costs
 * nothing next to a Web Audio graph per shop front.
 *
 * Two things browsers insist on, and both are handled here: sound may not start
 * without a gesture from the person, and a bed that arrives at full volume in
 * one frame is startling. So the first attempt is made on mount, a refused one
 * is retried on the first click or keypress, and whichever wins fades in.
 */

const SOURCE = '/world/audio/street.wav';
const STORAGE_KEY = 'sfera.ambience';
/** Loud enough to notice on laptop speakers, quiet enough to talk over. */
const VOLUME = 0.28;
const FADE_MS = 1200;

function storedPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Private mode or blocked storage: sound on is the intended default.
    return true;
  }
}

function remember(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Not worth surfacing: the preference simply does not survive the tab.
  }
}

export interface Ambience {
  on: boolean;
  toggle: () => void;
}

export function useAmbience(active: boolean): Ambience {
  const [on, setOn] = useState(storedPreference);
  const audio = useRef<HTMLAudioElement | null>(null);
  const fade = useRef<number | null>(null);

  const stopFade = useCallback(() => {
    if (fade.current !== null) cancelAnimationFrame(fade.current);
    fade.current = null;
  }, []);

  useEffect(() => {
    if (!active || !on) return;

    const element = audio.current ?? new Audio(SOURCE);
    audio.current = element;
    element.loop = true;
    element.preload = 'auto';
    element.volume = 0;

    let cancelled = false;

    const fadeIn = (): void => {
      const started = performance.now();
      const step = (): void => {
        if (cancelled) return;
        const progress = Math.min(1, (performance.now() - started) / FADE_MS);
        element.volume = VOLUME * progress;
        if (progress < 1) fade.current = requestAnimationFrame(step);
      };
      step();
    };

    const attempt = (): void => {
      void element
        .play()
        .then(() => {
          if (!cancelled) fadeIn();
        })
        .catch(() => {
          // Refused for want of a gesture. Not an error worth showing — the
          // listeners below pick it up the moment the person does anything.
        });
    };

    const onGesture = (): void => attempt();

    attempt();
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });

    return () => {
      cancelled = true;
      stopFade();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      element.pause();
    };
  }, [active, on, stopFade]);

  // Leaving the world stops the sound; nothing about a checkout form wants a
  // street under it.
  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [],
  );

  const toggle = useCallback(() => {
    setOn((previous) => {
      const next = !previous;
      remember(next);
      return next;
    });
  }, []);

  return { on, toggle };
}
