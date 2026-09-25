import { create } from 'zustand';
import { bill, etaMinutes, type FoodChoice } from '@3dsfera/shared';

/**
 * The tray, and the order once it is placed.
 *
 * Kept on the device, like the product cart: someone building a lunch order
 * should not have to sign in to do it, and the order itself is a simulation —
 * nothing is charged and no kitchen is told. When the counter is wired to a
 * real one, `place` is where that call goes, and everything else here stays.
 */

export interface PlacedOrder {
  /** What was ordered, frozen at the moment of placing. */
  choices: FoodChoice[];
  /** Epoch milliseconds. */
  placedAt: number;
  etaMinutes: number;
  address: string;
  totalCents: number;
  /** Shown on the tracking screen and the receipt. */
  number: string;
}

interface TrayState {
  choices: FoodChoice[];
  order: PlacedOrder | null;
  add: (choice: FoodChoice) => void;
  setQuantity: (index: number, quantity: number) => void;
  remove: (index: number) => void;
  clear: () => void;
  place: (address: string) => PlacedOrder;
  forget: () => void;
  count: () => number;
}

const TRAY_KEY = 'sfera.food.tray';
const ORDER_KEY = 'sfera.food.order';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Blocked storage or a corrupted entry: start clean rather than crash the
    // page someone is standing in front of.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: the tray still works for this session.
  }
}

/**
 * Two lines are the same line when the item, the size and the extras match.
 * Adding large fries to a tray that already has small ones must not silently
 * turn one into the other.
 */
function sameChoice(a: FoodChoice, b: FoodChoice): boolean {
  const extrasA = [...(a.extraIds ?? [])].sort().join(',');
  const extrasB = [...(b.extraIds ?? [])].sort().join(',');
  return a.itemId === b.itemId && (a.sizeId ?? '') === (b.sizeId ?? '') && extrasA === extrasB;
}

/** Four letters and two digits: readable over a counter, unique enough for a day. */
function orderNumber(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let index = 0; index < 4; index += 1) {
    code += letters[Math.floor(Math.random() * letters.length)] ?? 'X';
  }
  return `${code}-${String(Math.floor(Math.random() * 90) + 10)}`;
}

export const useTray = create<TrayState>((set, get) => ({
  choices: read<FoodChoice[]>(TRAY_KEY, []),
  order: read<PlacedOrder | null>(ORDER_KEY, null),

  add: (choice) => {
    const choices = [...get().choices];
    const existing = choices.findIndex((entry) => sameChoice(entry, choice));

    if (existing >= 0) {
      const current = choices[existing];
      if (current) {
        choices[existing] = { ...current, quantity: current.quantity + choice.quantity };
      }
    } else {
      choices.push(choice);
    }

    write(TRAY_KEY, choices);
    set({ choices });
  },

  setQuantity: (index, quantity) => {
    const choices = get()
      .choices.map((choice, position) => (position === index ? { ...choice, quantity } : choice))
      .filter((choice) => choice.quantity > 0);

    write(TRAY_KEY, choices);
    set({ choices });
  },

  remove: (index) => {
    const choices = get().choices.filter((_, position) => position !== index);
    write(TRAY_KEY, choices);
    set({ choices });
  },

  clear: () => {
    write(TRAY_KEY, []);
    set({ choices: [] });
  },

  place: (address) => {
    const choices = get().choices;
    const total = bill(choices);
    const order: PlacedOrder = {
      choices,
      placedAt: Date.now(),
      etaMinutes: etaMinutes(total),
      address,
      totalCents: total.totalCents,
      number: orderNumber(),
    };

    write(ORDER_KEY, order);
    write(TRAY_KEY, []);
    set({ order, choices: [] });
    return order;
  },

  forget: () => {
    write(ORDER_KEY, null);
    set({ order: null });
  },

  count: () => get().choices.reduce((total, choice) => total + choice.quantity, 0),
}));
