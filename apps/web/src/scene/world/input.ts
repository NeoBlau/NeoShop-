import { create } from 'zustand';

/**
 * Movement input, shared between the DOM and the render loop.
 *
 * The touch joystick is an HTML element and the camera lives in the render
 * loop; a tiny store is the seam between them. Values are read every frame, so
 * they are written as plain numbers and never trigger a React render on their
 * own — the loop polls, it does not subscribe.
 */
export interface InputState {
  /** -1..1 on each axis. Forward is +y, right is +x. */
  move: { x: number; y: number };
  /** Look delta accumulated since the last frame, in radians. */
  look: { x: number; y: number };
  sprint: boolean;
  pointerLocked: boolean;
  setMove: (x: number, y: number) => void;
  addLook: (x: number, y: number) => void;
  consumeLook: () => { x: number; y: number };
  setSprint: (sprint: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  reset: () => void;
}

export const useInput = create<InputState>((set, get) => ({
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  sprint: false,
  pointerLocked: false,

  setMove: (x, y) => {
    const state = get();
    if (state.move.x === x && state.move.y === y) return;
    // Mutated in place: this is polled by the frame loop, and a new object per
    // keystroke would allocate for nothing.
    state.move.x = x;
    state.move.y = y;
  },

  addLook: (x, y) => {
    const state = get();
    state.look.x += x;
    state.look.y += y;
  },

  consumeLook: () => {
    const state = get();
    const delta = { x: state.look.x, y: state.look.y };
    state.look.x = 0;
    state.look.y = 0;
    return delta;
  },

  setSprint: (sprint) => set({ sprint }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),

  reset: () => {
    const state = get();
    state.move.x = 0;
    state.move.y = 0;
    state.look.x = 0;
    state.look.y = 0;
    set({ sprint: false, pointerLocked: false });
  },
}));

/** Maps a keyboard event to a movement axis. Exported so it can be tested. */
export const KEY_BINDINGS: Record<string, { axis: 'x' | 'y'; value: number }> = {
  KeyW: { axis: 'y', value: 1 },
  ArrowUp: { axis: 'y', value: 1 },
  KeyS: { axis: 'y', value: -1 },
  ArrowDown: { axis: 'y', value: -1 },
  KeyA: { axis: 'x', value: -1 },
  ArrowLeft: { axis: 'x', value: -1 },
  KeyD: { axis: 'x', value: 1 },
  ArrowRight: { axis: 'x', value: 1 },
};

/**
 * Resolves the set of held keys into one movement vector.
 *
 * Opposite keys cancel, and diagonals are normalised — otherwise walking
 * north-east is 41% faster than walking north, which players feel immediately
 * even if they cannot name it.
 */
export function movementFromKeys(held: Set<string>): { x: number; y: number } {
  let x = 0;
  let y = 0;

  for (const code of held) {
    const binding = KEY_BINDINGS[code];
    if (!binding) continue;
    if (binding.axis === 'x') x += binding.value;
    else y += binding.value;
  }

  x = Math.max(-1, Math.min(1, x));
  y = Math.max(-1, Math.min(1, y));

  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}
