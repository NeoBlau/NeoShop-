import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GlbParseError, inspectModel, validateModel } from './glb.js';
import { UPLOAD_LIMITS } from './limits.js';

/**
 * The fixtures are the demo catalogue itself: the same five files the seed
 * loads, so a change that breaks real models breaks this suite.
 */
const ASSETS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/api/prisma/seed-assets',
);

const read = (file: string): Uint8Array => new Uint8Array(readFileSync(path.join(ASSETS, file)));

describe('inspectModel on real GLB files', () => {
  /**
   * The antenna is deliberately not pinned to a triangle count or a clip
   * length. There are two of it: the procedural stand-in a clean checkout
   * generates, and the supplier's own model that `make ingest` writes over it
   * when the source is in `assets/incoming`. Both are the antenna, both are
   * what the seed loads, and a test that only passes on one of them is a test
   * that fails on somebody's machine for being set up properly.
   *
   * What is asserted is what does not depend on which: it parses, it has
   * geometry, it has a material, and it carries the three clips the product
   * listing sells it on — which is the promise that actually matters, and the
   * one `apps/api/test/mission-assets.test.ts` holds the missions to.
   */
  it('reads geometry, materials and clips out of the antenna', () => {
    const inspection = inspectModel(read('antenna-orbita.glb'));

    expect(inspection.container).toBe('glb');
    expect(inspection.version).toBe(2);
    expect(inspection.triangles).toBeGreaterThan(0);
    expect(inspection.materials).toBeGreaterThan(0);
    expect(inspection.animations.map((clip) => clip.name)).toEqual([
      'deploy',
      'track_signal',
      'fold',
    ]);
  });

  it('reports clip durations in whole hundredths, not float32 noise', () => {
    const inspection = inspectModel(read('antenna-orbita.glb'));
    const deploy = inspection.animations.find((clip) => clip.name === 'deploy');

    expect(deploy?.duration).toBeGreaterThan(1);
    // The point of the test: a time accessor holds float32, so the last
    // keyframe of a 2.6 second clip reads back as 2.5999999046325684 unless
    // something rounds it. Whatever the clip's length, it is a clean figure.
    expect(deploy?.duration).toBe(Math.round((deploy?.duration ?? 0) * 100) / 100);
    expect(deploy?.channels).toBeGreaterThan(0);
  });

  it('counts a mesh drawn by several nodes once per node', () => {
    const inspection = inspectModel(read('inspection-drone.glb'));

    expect(inspection.drawnTriangles).toBeGreaterThanOrEqual(inspection.triangles);
    expect(inspection.nodes).toBeGreaterThan(inspection.meshes - 1);
  });

  it('finds no external references in a self-contained GLB', () => {
    for (const file of ['robot-vacuum.glb', 'recliner-chair.glb', 'desk-lamp.glb']) {
      expect(inspectModel(read(file)).hasExternalResources).toBe(false);
    }
  });
});

describe('inspectModel rejects what is not a model', () => {
  it('rejects arbitrary text', () => {
    expect(() => inspectModel(new TextEncoder().encode('just a note'))).toThrowError(GlbParseError);
  });

  it('rejects a PNG regardless of what it is named', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    try {
      inspectModel(png);
      expect.unreachable('a PNG is not a model');
    } catch (error) {
      expect((error as GlbParseError).code).toBe('not_a_model');
    }
  });

  it('rejects a truncated GLB instead of reading past the end', () => {
    const truncated = read('antenna-orbita.glb').subarray(0, 48);
    try {
      inspectModel(truncated);
      expect.unreachable('a truncated file must not parse');
    } catch (error) {
      expect((error as GlbParseError).code).toBe('truncated');
    }
  });

  it('rejects JSON that is not glTF', () => {
    const json = new TextEncoder().encode(JSON.stringify({ hello: 'world' }));
    try {
      inspectModel(json);
      expect.unreachable('arbitrary JSON is not a model');
    } catch (error) {
      expect((error as GlbParseError).code).toBe('not_a_model');
    }
  });

  it('accepts a .gltf document with an asset block', () => {
    const document = {
      asset: { version: '2.0' },
      meshes: [{ primitives: [{ mode: 4, indices: 0, attributes: { POSITION: 1 }, material: 0 }] }],
      accessors: [{ count: 36 }, { count: 24 }],
      materials: [{}],
      nodes: [{ mesh: 0 }],
    };

    const inspection = inspectModel(new TextEncoder().encode(JSON.stringify(document)));
    expect(inspection.container).toBe('gltf');
    expect(inspection.triangles).toBe(12);
  });
});

describe('validateModel budget', () => {
  const base = inspectModel(read('robot-vacuum.glb'));

  it('passes a model that is within every limit', () => {
    const verdict = validateModel(base);
    expect(verdict.errors).toEqual([]);
  });

  it('blocks a model past the triangle ceiling', () => {
    const verdict = validateModel({ ...base, triangles: UPLOAD_LIMITS.triangleMax + 1 });
    expect(verdict.errors.map((issue) => issue.code)).toContain('too_many_triangles');
  });

  it('only warns between the recommendation and the ceiling', () => {
    const verdict = validateModel({ ...base, triangles: UPLOAD_LIMITS.triangleWarn + 1 });
    expect(verdict.errors).toEqual([]);
    expect(verdict.warnings.map((issue) => issue.code)).toContain('triangles_high');
  });

  it('blocks a model that references files it does not carry', () => {
    const verdict = validateModel({ ...base, hasExternalResources: true });
    expect(verdict.errors.map((issue) => issue.code)).toContain('external_resources');
  });

  it('warns about placeholder clip names', () => {
    const verdict = validateModel({
      ...base,
      animations: [{ index: 0, name: 'Take 001', duration: 2, channels: 1 }],
    });
    expect(verdict.warnings.map((issue) => issue.code)).toContain('unnamed_animations');
  });

  it('warns when a model has no animation at all', () => {
    const verdict = validateModel({ ...base, animations: [] });
    expect(verdict.warnings.map((issue) => issue.code)).toContain('no_animations');
  });

  it('blocks a file with no geometry', () => {
    const verdict = validateModel({ ...base, triangles: 0 });
    expect(verdict.errors.map((issue) => issue.code)).toContain('no_geometry');
  });
});
