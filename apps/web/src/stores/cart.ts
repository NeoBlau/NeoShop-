import { create } from 'zustand';
import type { Currency } from '@3dsfera/shared';

/**
 * The cart, kept on the device until checkout.
 *
 * A buyer who adds a product while walking the showroom has not signed in yet,
 * and asking them to before the cart works would lose most of them. Stage 4
 * hands this to the server at checkout; until then it survives a reload and
 * nothing more.
 */
export interface CartLine {
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: Currency;
  quantity: number;
  previewUrl: string | null;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: () => number;
  totalCents: () => number;
}

const STORAGE_KEY = 'sfera.cart';

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    // Blocked storage or a corrupted entry: an empty cart is the safe start.
    return [];
  }
}

function persist(lines: CartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode. The cart still works for this session.
  }
}

export const useCart = create<CartState>((set, get) => ({
  lines: load(),

  add: (line, quantity = 1) => {
    const lines = [...get().lines];
    const existing = lines.findIndex((entry) => entry.productId === line.productId);

    if (existing >= 0) {
      const current = lines[existing];
      if (current) lines[existing] = { ...current, quantity: current.quantity + quantity };
    } else {
      lines.push({ ...line, quantity });
    }

    persist(lines);
    set({ lines });
  },

  setQuantity: (productId, quantity) => {
    const lines = get()
      .lines.map((line) => (line.productId === productId ? { ...line, quantity } : line))
      .filter((line) => line.quantity > 0);

    persist(lines);
    set({ lines });
  },

  remove: (productId) => {
    const lines = get().lines.filter((line) => line.productId !== productId);
    persist(lines);
    set({ lines });
  },

  clear: () => {
    persist([]);
    set({ lines: [] });
  },

  count: () => get().lines.reduce((total, line) => total + line.quantity, 0),

  totalCents: () => get().lines.reduce((total, line) => total + line.priceCents * line.quantity, 0),
}));
