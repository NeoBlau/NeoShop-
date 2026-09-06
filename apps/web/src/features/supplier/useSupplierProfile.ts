import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client.js';
import { supplierApi, type SupplierProfile } from './api.js';

interface ProfileState {
  profile: SupplierProfile | null;
  loading: boolean;
  errorCode: string | null;
}

/** Loads the signed-in supplier's company profile once, on mount. */
export function useSupplierProfile(): ProfileState {
  const [state, setState] = useState<ProfileState>({
    profile: null,
    loading: true,
    errorCode: null,
  });

  useEffect(() => {
    let cancelled = false;

    supplierApi
      .profile()
      .then(({ supplier }) => {
        if (!cancelled) setState({ profile: supplier, loading: false, errorCode: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = error instanceof ApiError ? error.code : 'ERR_INTERNAL';
        setState({ profile: null, loading: false, errorCode: code });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
