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
  id: string;
  /** Broad kind, for the picker's own copy: a city street, the outdoors. */
  kind?: string;
  title?: { ru: string; en: string };
  blurb?: { ru: string; en: string };
  /**
   * The sky and the light. A path relative to the location's own directory, or
   * an absolute one when the HDRI is shared.
   */
  sky?: string;
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
  /** Where this location's files live, so geometry URLs need no guessing. */
  base: string;
  /** Absolute URL of its sky. */
  skyUrl: string;
}

const BASE = '/world/locations';
/** Used when a location's manifest predates the sky field. */
const FALLBACK_SKY = '/world/hdri/street.hdr';

export function locationBase(id: string): string {
  return `${BASE}/${id}`;
}

async function loadLocation(id: string, signal: AbortSignal): Promise<LocationData> {
  const base = locationBase(id);
  const response = await fetch(`${base}/location.json`, { signal });
  if (!response.ok) throw new Error(`location.json: ${response.status}`);

  const manifest = (await response.json()) as LocationManifest;

  const [mask, ground] = await Promise.all(
    [manifest.navigation.mask, manifest.navigation.ground].map(async (file) => {
      const binary = await fetch(`${base}/${file}`, { signal });
      if (!binary.ok) throw new Error(`${file}: ${binary.status}`);
      return new Uint8Array(await binary.arrayBuffer());
    }),
  );

  if (!mask || !ground) throw new Error('The location map is incomplete');

  const sky = manifest.sky ?? FALLBACK_SKY;

  return {
    manifest,
    base,
    skyUrl: sky.startsWith('/') ? sky : `${base}/${sky}`,
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
export function useLocationData(id: string | null): {
  location: LocationData | null;
  loading: boolean;
  failed: boolean;
} {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(id !== null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (id === null) {
      setLocation(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    loadLocation(id, controller.signal)
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
  }, [id]);

  return { location, loading, failed };
}

/**
 * Which locations this build has.
 *
 * Written by the location builds; an empty list means nobody ran them, which
 * is a checkout without assets rather than an error.
 */
export function useLocationIndex(): { ids: string[]; loading: boolean } {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`${BASE}/locations.json`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<string[]>) : []))
      .then((list) => {
        setIds(Array.isArray(list) ? list : []);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setIds([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { ids, loading };
}
