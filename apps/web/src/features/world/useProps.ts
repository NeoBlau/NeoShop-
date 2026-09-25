import { useEffect, useState } from 'react';

/**
 * Street props — things that stand on the pavement but are not for sale.
 *
 * Optional, like the zones: `make props` builds them from assets nobody is
 * obliged to have, and a street without them is a street, not an error.
 */

export interface PropEntry {
  model: string;
  width: number | null;
  title: string;
  author: string;
  licence: string;
  url: string;
}

const BASE = '/world/props';

export function propUrl(model: string): string {
  return `${BASE}/${model}`;
}

export function useProps(): { props: Record<string, PropEntry>; loading: boolean } {
  const [props, setProps] = useState<Record<string, PropEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`${BASE}/props.json`, { signal: controller.signal })
      .then((response) =>
        response.ok ? (response.json() as Promise<Record<string, PropEntry>>) : {},
      )
      .then((entries: Record<string, PropEntry>) => {
        setProps(entries as Record<string, PropEntry>);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setProps({});
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { props, loading };
}
