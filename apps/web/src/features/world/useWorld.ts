import { useEffect, useRef, useState } from 'react';
import type { WorldResponse } from '@3dsfera/shared';
import { ApiError } from '../../api/client.js';
import { worldApi } from './api.js';

interface WorldState {
  world: WorldResponse | null;
  loading: boolean;
  errorCode: string | null;
}

export function useWorld(): WorldState {
  const [state, setState] = useState<WorldState>({
    world: null,
    loading: true,
    errorCode: null,
  });

  useEffect(() => {
    let cancelled = false;

    worldApi
      .load()
      .then((world) => {
        if (!cancelled) setState({ world, loading: false, errorCode: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          world: null,
          loading: false,
          errorCode: error instanceof ApiError ? error.code : 'ERR_INTERNAL',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Reports a product view at most once per session per product.
 *
 * Counting every panel opening would turn a buyer who compares two products
 * back and forth into twenty views, which makes the supplier's conversion
 * number meaningless.
 */
export function useViewReporter(): (productId: string) => void {
  const reported = useRef(new Set<string>());

  return (productId: string) => {
    if (reported.current.has(productId)) return;
    reported.current.add(productId);
    void worldApi.recordView(productId);
  };
}
