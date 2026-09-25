import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Mission, MissionStep, PromoCodeView } from '@3dsfera/shared';
import { missionsApi } from './api.js';

/**
 * The state machine a mission runs on.
 *
 * Kept out of the scene and out of the panel because both need it and neither
 * owns it: the room decides when the buyer is close enough, the panel decides
 * when a clip was played, and this decides what that means. Every step
 * advance is reported to the server, which refuses them out of order — so the
 * client cannot fix a mistake here by skipping ahead.
 */

export type RunnerPhase = 'idle' | 'intro' | 'running' | 'sending' | 'done' | 'failed';

export interface RunnerState {
  phase: RunnerPhase;
  /** Index of the step on screen; equal to the step count when finished. */
  index: number;
  step: MissionStep | null;
  /** The last completed step's payoff line, shown until the next prompt. */
  justDone: MissionStep | null;
  promo: PromoCodeView | null;
  error: string | null;
}

export interface Runner extends RunnerState {
  mission: Mission;
  begin: () => void;
  /** Reports the step on screen as done. Ignored if it is not the current one. */
  finishStep: (stepId: string) => void;
  reset: () => void;
}

export function useMissionRunner(mission: Mission): Runner {
  const [state, setState] = useState<RunnerState>({
    phase: 'idle',
    index: 0,
    step: null,
    justDone: null,
    promo: null,
    error: null,
  });

  // A step reported twice — a clip that fires its end event once per loop, a
  // double click — must not advance twice.
  const reporting = useRef<string | null>(null);

  const begin = useCallback(() => {
    setState((current) => ({ ...current, phase: 'intro', error: null }));

    void missionsApi
      .start(mission.id)
      .then((run) => {
        // A run resumed from an earlier visit picks up where it stopped rather
        // than making the buyer walk the whole thing again — and a finished one
        // comes back with the code it earned, which it used not to: the outro
        // appeared with an empty space under it where the discount should be.
        setState({
          phase: run.completedAt ? 'done' : 'running',
          index: Math.min(run.step, mission.steps.length),
          step: mission.steps[Math.min(run.step, mission.steps.length - 1)] ?? null,
          justDone: null,
          promo: run.promo,
          error: null,
        });
      })
      .catch((cause: unknown) => {
        setState((current) => ({
          ...current,
          phase: 'failed',
          error: cause instanceof Error ? cause.message : 'mission.startFailed',
        }));
      });
  }, [mission]);

  const finishStep = useCallback(
    (stepId: string) => {
      setState((current) => {
        if (current.phase !== 'running') return current;
        const expected = mission.steps[current.index];
        if (!expected || expected.id !== stepId || reporting.current === stepId) return current;

        reporting.current = stepId;

        void missionsApi
          .step(mission.id, stepId)
          .then((run) => {
            reporting.current = null;
            const next = Math.min(run.step, mission.steps.length);

            setState((inner) => ({
              ...inner,
              index: next,
              step: mission.steps[next] ?? null,
              justDone: expected,
            }));
          })
          .catch((cause: unknown) => {
            reporting.current = null;
            setState((inner) => ({
              ...inner,
              error: cause instanceof Error ? cause.message : 'mission.stepFailed',
            }));
          });

        return current;
      });
    },
    [mission],
  );

  // The last step reported means the mission is over; the code comes from the
  // server, which checks the pace before it issues one.
  useEffect(() => {
    if (state.phase !== 'running' || state.index < mission.steps.length) return;

    setState((current) => ({ ...current, phase: 'sending' }));

    void missionsApi
      .complete(mission.id)
      .then((result) => {
        setState((current) => ({ ...current, phase: 'done', promo: result.promo }));
      })
      .catch((cause: unknown) => {
        setState((current) => ({
          ...current,
          phase: 'failed',
          error: cause instanceof Error ? cause.message : 'mission.completeFailed',
        }));
      });
  }, [state.phase, state.index, mission]);

  const reset = useCallback(() => {
    reporting.current = null;
    setState({ phase: 'idle', index: 0, step: null, justDone: null, promo: null, error: null });
  }, []);

  return useMemo(
    () => ({ ...state, mission, begin, finishStep, reset }),
    [state, mission, begin, finishStep, reset],
  );
}
