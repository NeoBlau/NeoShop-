import { useEffect, useState } from 'react';
import type { NavigationGrid } from '../../scene/world/navigation.js';

/**
 * The location's own description of itself, written by the asset build.
 *
 * The geometry says what the street looks like; this says how it works — where
 * the pavement is, how high it is, where the shop fronts are, and where a
 * buyer arriving for the first time should be standing.
 */
export interface LocationAnchor {
  name: string;
  sign: [number, number, number];
  /** Where a supplier's display stands: on the pavement, facing the street. */
  stand: [number, number, number];
  /** Radians about Y. Zero looks down -Z, matching the renderer. */
  facing: number;
}

export interface LocationSource {
  title: string;
  author: string;
  licence: string;
  licenceUrl: string;
  origin: string;
}

export interface LocationManifest {
  source: LocationSource;
  levels: { level: number; file: string; triangles: number; bytes: number }[];
  navigation: {
    origin: [number, number];
    cell: number;
    width: number;
    height: number;
    groundBase: number;
    mask: string;
    ground: string;
  };
  spawn: { position: [number, number, number]; yaw: number };
  anchors: LocationAnchor[];
}

export interface LocationData {
  manifest: LocationManifest;
  grid: NavigationGrid;
}

const BASE = '/world/location';

async function loadLocation(signal: AbortSignal): Promise<LocationData> {
  const response = await fetch(`${BASE}/location.json`, { signal });
  if (!response.ok) throw new Error(`location.json: ${response.status}`);

  const manifest = (await response.json()) as LocationManifest;

  const [mask, ground] = await Promise.all(
    [manifest.navigation.mask, manifest.navigation.ground].map(async (file) => {
      const binary = await fetch(`${BASE}/${file}`, { signal });
      if (!binary.ok) throw new Error(`${file}: ${binary.status}`);
      return new Uint8Array(await binary.arrayBuffer());
    }),
  );

  if (!mask || !ground) throw new Error('The location map is incomplete');

  return {
    manifest,
    grid: {
      origin: manifest.navigation.origin,
      cell: manifest.navigation.cell,
      width: manifest.navigation.width,
      height: manifest.navigation.height,
      groundBase: manifest.navigation.groundBase,
      mask,
      ground,
    },
  };
}

/**
 * Loads the location description once.
 *
 * It is small — a manifest and two bitmaps — and every part of the scene needs
 * it before anything can be placed, so it is fetched ahead of the geometry
 * rather than suspended alongside it.
 */
export function useLocationData(): {
  location: LocationData | null;
  loading: boolean;
  failed: boolean;
} {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    loadLocation(controller.signal)
      .then((data) => {
        setLocation(data);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        // The location is an optional asset: `make assets` builds it, and a
        // checkout without it should still open the catalogue rather than a
        // stack trace.
        console.error('The location could not be loaded', cause);
        setFailed(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { location, loading, failed };
}
