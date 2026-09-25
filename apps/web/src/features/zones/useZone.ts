import { useEffect, useState } from 'react';
import type { NavigationGrid } from '../../scene/world/navigation.js';

/**
 * A demo zone: one room, its map, and the two places that matter in it.
 *
 * Written by `make zones`, loaded the same way the street's manifest is — a
 * small JSON and two bitmaps, fetched before the geometry so that everything
 * placed in the room knows where the floor is.
 */

export interface ZoneCredit {
  title: string;
  author: string;
  licence: string;
  url: string;
}

export interface ZoneManifest {
  id: string;
  title: { ru: string; en: string; it: string };
  credit: ZoneCredit;
  model: string;
  triangles: number;
  bytes: number;
  bounds: { lo: [number, number, number]; hi: [number, number, number] };
  navigation: {
    origin: [number, number];
    cell: number;
    width: number;
    height: number;
    groundBase: number;
    mask: string;
    ground: string;
  };
  /** Where the buyer arrives, facing the stage. */
  spawn: { position: [number, number, number]; yaw: number };
  /** Where the product stands, facing the arrival point. */
  stage: { position: [number, number, number]; yaw: number };
  eyeHeight: number;
}

export interface ZoneData {
  manifest: ZoneManifest;
  grid: NavigationGrid;
  /** Absolute URL of the room's geometry. */
  modelUrl: string;
}

const BASE = '/world/zones';

export function zoneModelUrl(id: string, model: string): string {
  return `${BASE}/${id}/${model}`;
}

async function loadZone(id: string, signal: AbortSignal): Promise<ZoneData> {
  const response = await fetch(`${BASE}/${id}/zone.json`, { signal });
  if (!response.ok) throw new Error(`zone ${id}: ${response.status}`);

  const manifest = (await response.json()) as ZoneManifest;

  const [mask, ground] = await Promise.all(
    [manifest.navigation.mask, manifest.navigation.ground].map(async (file) => {
      const binary = await fetch(`${BASE}/${id}/${file}`, { signal });
      if (!binary.ok) throw new Error(`${file}: ${binary.status}`);
      return new Uint8Array(await binary.arrayBuffer());
    }),
  );

  if (!mask || !ground) throw new Error(`The map of zone ${id} is incomplete`);

  return {
    manifest,
    modelUrl: zoneModelUrl(id, manifest.model),
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

/** The zones this build actually has, so a mission can be offered or not. */
export function useZoneIndex(): { zones: string[]; loading: boolean } {
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`${BASE}/zones.json`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<string[]>) : []))
      .then((list) => {
        setZones(Array.isArray(list) ? list : []);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // Zones are an optional asset, like the location: a checkout without
        // them offers no missions rather than failing to open.
        setZones([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { zones, loading };
}

export function useZone(id: string | null): {
  zone: ZoneData | null;
  loading: boolean;
  failed: boolean;
} {
  const [zone, setZone] = useState<ZoneData | null>(null);
  const [loading, setLoading] = useState(id !== null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (id === null) {
      setZone(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    loadZone(id, controller.signal)
      .then((data) => {
        setZone(data);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error(`The zone ${id} could not be loaded`, cause);
        setFailed(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  return { zone, loading, failed };
}
