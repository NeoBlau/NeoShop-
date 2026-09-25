import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  earliestCompletion,
  streetQuests,
  type Mission,
  type MissionStep,
  type PromoCodeView,
} from '@3dsfera/shared';
import { missionsApi } from '../missions/api.js';

/**
 * A quest carried out on a main location.
 *
 * The server's contract is the same one the room missions use — steps reported
 * in order, a floor under how fast the whole thing may be finished, one code
 * per run — so this file talks to the same endpoints and adds no new trust.
 * What is different is where the objectives come from: not a script the page
 * plays, but things the buyer is observed doing while they walk about. Metres
 * covered, frontages come near, vendors got talking, products switched on.
 *
 * All of that is watched in the browser, which means a determined person can
 * fake it. That is true of the room missions too and the answer is the same:
 * the pace floor stops a loop in the console from minting discount codes, and
 * proving that somebody really walked a hundred metres is not a thing a web
 * page can do. The prize is seven per cent off a desk lamp.
 */

export interface QuestProgress {
  /** How far through the current objective, 0 to 1. */
  fraction: number;
  /** A short "2 of 3" for the objective that needs one. */
  tally: { done: number; needed: number } | null;
}

export interface StreetQuest {
  quest: Mission | null;
  /** The objective on screen, or null once they are all done. */
  step: MissionStep | null;
  /** Index of that objective, so the panel can say "2 of 4". */
  index: number;
  progress: QuestProgress;
  /** Set once the run is finished and the server has issued the code. */
  promo: PromoCodeView | null;
  /** True while the completion is in flight, and after a failure, so the panel can say why. */
  error: string | null;
  /** Whether the buyer has this quest open. Starting is deliberate. */
  active: boolean;
  start: () => void;
  give: () => void;
  /** The last objective's "why it mattered" line, shown briefly after it lands. */
  justDone: MissionStep | null;
}

/** What the world reports while somebody walks around it. */
export interface QuestSignals {
  /** Metres walked in this location since the quest started. */
  metres: number;
  /** Pavilion ids whose frontage has been stood near. */
  frontages: ReadonlySet<string>;
  /** Pavilion ids whose vendor has been opened. */
  vendors: ReadonlySet<string>;
  /** Product ids an action has been played on. */
  demos: ReadonlySet<string>;
  /** Landmarks reached, by name. */
  landmarks: ReadonlySet<string>;
}

export const NO_SIGNALS: QuestSignals = {
  metres: 0,
  frontages: new Set(),
  vendors: new Set(),
  demos: new Set(),
  landmarks: new Set(),
};

/** How far through one objective the signals say the buyer is. */
function measure(step: MissionStep, signals: QuestSignals, since: QuestSignals): QuestProgress {
  const grown = (now: ReadonlySet<string>, before: ReadonlySet<string>): number => {
    let count = 0;
    for (const entry of now) if (!before.has(entry)) count += 1;
    return count;
  };

  switch (step.goal.kind) {
    case 'stroll': {
      const walked = Math.max(0, signals.metres - since.metres);
      return { fraction: Math.min(1, walked / step.goal.metres), tally: null };
    }
    case 'frontages': {
      const done = grown(signals.frontages, since.frontages);
      return {
        fraction: Math.min(1, done / step.goal.count),
        tally: { done: Math.min(done, step.goal.count), needed: step.goal.count },
      };
    }
    case 'vendors': {
      const done = grown(signals.vendors, since.vendors);
      return {
        fraction: Math.min(1, done / step.goal.count),
        tally: { done: Math.min(done, step.goal.count), needed: step.goal.count },
      };
    }
    case 'demos': {
      const done = grown(signals.demos, since.demos);
      return {
        fraction: Math.min(1, done / step.goal.count),
        tally: { done: Math.min(done, step.goal.count), needed: step.goal.count },
      };
    }
    case 'landmark':
      return { fraction: signals.landmarks.has(step.goal.landmark) ? 1 : 0, tally: null };
    // A room mission's objectives cannot be met by walking about, and a street
    // quest should not carry one. Nought rather than an exception: a quest
    // authored wrongly stalls, it does not break the world.
    default:
      return { fraction: 0, tally: null };
  }
}

/** A snapshot, so an objective counts only what happened after it started. */
function snapshot(signals: QuestSignals): QuestSignals {
  return {
    metres: signals.metres,
    frontages: new Set(signals.frontages),
    vendors: new Set(signals.vendors),
    demos: new Set(signals.demos),
    landmarks: new Set(signals.landmarks),
  };
}

export function useStreetQuest(location: string | null, signals: QuestSignals): StreetQuest {
  // One quest per location: the first one it offers. More than one at a time
  // turns a showroom into a checklist.
  const quest = useMemo(
    () => (location === null ? null : (streetQuests(location)[0] ?? null)),
    [location],
  );

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [promo, setPromo] = useState<PromoCodeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<MissionStep | null>(null);

  const since = useRef<QuestSignals>(NO_SIGNALS);
  const startedAt = useRef(0);
  // Guards against the double-fire a fast objective can cause: two frames can
  // both see the same set grow before the state update lands.
  const reporting = useRef(false);

  useEffect(() => {
    setActive(false);
    setIndex(0);
    setPromo(null);
    setError(null);
    setJustDone(null);
  }, [quest]);

  const step = active && quest ? (quest.steps[index] ?? null) : null;

  const progress = useMemo(
    () => (step ? measure(step, signals, since.current) : { fraction: 0, tally: null }),
    [step, signals],
  );

  const start = useCallback(() => {
    if (!quest) return;

    since.current = snapshot(signals);
    startedAt.current = Date.now();
    setActive(true);
    setIndex(0);
    setPromo(null);
    setError(null);
    setJustDone(null);

    void missionsApi.start(quest.id).catch((cause: unknown) => {
      // A quest that cannot be registered is one that cannot pay out, and
      // saying so now is better than at the end of a walk.
      console.error('The quest could not be started', cause);
      setError('quest.startFailed');
      setActive(false);
    });
  }, [quest, signals]);

  const give = useCallback(() => {
    setActive(false);
    setJustDone(null);
  }, []);

  // One objective at a time, reported when its own progress reaches one.
  useEffect(() => {
    if (!quest || !step || progress.fraction < 1 || reporting.current) return;

    reporting.current = true;
    const done = step;
    const last = index + 1 >= quest.steps.length;

    void missionsApi
      .step(quest.id, step.id)
      .then(async () => {
        setJustDone(done);
        since.current = snapshot(signals);
        setIndex(index + 1);

        if (!last) return;

        // The server refuses a completion that arrives faster than half the
        // script's own time. Rather than let that surface as an error after a
        // genuine walk, wait out whatever is left.
        const wait = earliestCompletion(quest) - (Date.now() - startedAt.current);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 250));

        const completion = await missionsApi.complete(quest.id);
        setPromo(completion.promo);
      })
      .catch((cause: unknown) => {
        console.error('The quest step was refused', cause);
        setError('quest.stepFailed');
      })
      .finally(() => {
        reporting.current = false;
      });
  }, [quest, step, progress.fraction, index, signals]);

  return { quest, step, index, progress, promo, error, active, start, give, justDone };
}
