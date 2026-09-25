/**
 * Holds the missions and the product listings to what the models actually do.
 *
 * Every one of these is a promise made in TypeScript about a binary nobody
 * reads: a mission step says "play `deploy` for three and a half seconds", a
 * product card offers a button labelled "Развернуть антенну", and both are
 * strings until something opens the GLB. When they drift, nothing fails — the
 * scene reports the missing clip and moves the script on, the button plays
 * nothing — so the failure reaches the buyer as a mission that does not react
 * and a discount that never arrives, with no error anywhere.
 *
 * It has drifted. The stand-in vacuum carried `open_lid` while the listing and
 * the mission both asked for `brushes_spin`, and the way that was discovered
 * was somebody walking the loft.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_ZONES, MISSIONS, inspectModel, type Mission } from '@3dsfera/shared';
import { products, suppliers } from '../prisma/seed-data.js';

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prisma/seed-assets');

/** Clip name to duration in seconds, for one seeded product's model. */
function clipsOf(file: string): Map<string, number> {
  const bytes = new Uint8Array(readFileSync(path.join(ASSETS, file)));
  const clips = new Map<string, number>();
  for (const clip of inspectModel(bytes).animations) clips.set(clip.name, clip.duration ?? 0);
  return clips;
}

const models = new Map(products.map((product) => [product.slug, clipsOf(product.file)]));

describe('the models carry what the listings promise', () => {
  for (const product of products) {
    const clips = models.get(product.slug);

    it(`${product.slug} has every clip its buttons name`, () => {
      expect(clips).toBeDefined();
      for (const interaction of product.interactions) {
        if (interaction.type !== 'GLTF_ANIMATION') continue;
        expect(
          clips?.has(interaction.clipName ?? ''),
          `${product.file} has no clip "${interaction.clipName}" for the button "${interaction.label}"; ` +
            `it has ${[...(clips?.keys() ?? [])].join(', ')}`,
        ).toBe(true);
      }
    });

    it(`${product.slug} names a clip for every animation button`, () => {
      for (const interaction of product.interactions) {
        if (interaction.type !== 'GLTF_ANIMATION') continue;
        expect(
          interaction.clipName,
          `"${interaction.label}" is an animation with no clip`,
        ).toBeTruthy();
      }
    });
  }
});

describe('the missions ask for things that exist', () => {
  const played = (mission: Mission): string[] =>
    mission.steps.flatMap((step) => (step.goal.kind === 'play' ? [step.goal.clip] : []));

  for (const mission of MISSIONS) {
    it(`${mission.id} demonstrates a product the seed has`, () => {
      expect(
        models.has(mission.productSlug),
        `mission ${mission.id} is about "${mission.productSlug}", which nothing seeds`,
      ).toBe(true);
    });

    if (mission.where === 'zone') {
      it(`${mission.id} happens in a zone the build makes`, () => {
        expect(DEMO_ZONES as readonly string[]).toContain(mission.zone);
      });
    }

    it(`${mission.id} only plays clips the model carries`, () => {
      const clips = models.get(mission.productSlug);
      for (const clip of played(mission)) {
        expect(
          clips?.has(clip),
          `mission ${mission.id} plays "${clip}", which ${mission.productSlug} does not have; ` +
            `it has ${[...(clips?.keys() ?? [])].join(', ')}`,
        ).toBe(true);
      }
    });

    /**
     * The pace floor refuses a completion that arrives in under half the
     * script's declared running time, and a `play` step's declared seconds are
     * what it contributes to that. Declaring more than the clip actually runs
     * spends budget the buyer cannot earn back by watching: the step completes
     * when the clip ends, so the only way to make up the difference is to
     * stand still afterwards, and enough of those make a mission that is
     * finished correctly and refused anyway.
     *
     * A quarter of a second of grace, because a clip authored "about three
     * seconds" is allowed to be 2.95.
     */
    it(`${mission.id} declares no longer than its clips run`, () => {
      const clips = models.get(mission.productSlug);

      for (const step of mission.steps) {
        if (step.goal.kind !== 'play') continue;
        const duration = clips?.get(step.goal.clip);
        if (duration === undefined) continue; // the clip test above says so.

        expect(
          step.goal.seconds,
          `mission ${mission.id} step "${step.id}" allows ${step.goal.seconds}s for ` +
            `"${step.goal.clip}", which runs ${duration.toFixed(2)}s`,
        ).toBeLessThanOrEqual(duration + 0.25);
      }
    });
  }
});

/**
 * A street quest counts distinct frontages and distinct vendors, and the world
 * has as many frontages as the seed gives pavilions to.
 *
 * Two of these asked for more than exist. "Walk up to three frontages" on a
 * street with two of them is a step that cannot be completed however far you
 * walk, and the quest sits on it for ever with the discount behind it — the
 * same dead end as a mission naming a clip that is not there, with nothing on
 * screen to say so.
 */
describe('the street quests ask for no more than the street has', () => {
  const frontages = suppliers.filter((supplier) => supplier.pavilionTitle !== undefined).length;

  it('the seed builds at least one frontage', () => {
    expect(frontages).toBeGreaterThan(0);
  });

  for (const mission of MISSIONS) {
    if (mission.where !== 'street') continue;

    it(`${mission.id} is finishable on ${frontages} frontages`, () => {
      for (const step of mission.steps) {
        if (step.goal.kind !== 'frontages' && step.goal.kind !== 'vendors') continue;

        expect(
          step.goal.count,
          `quest ${mission.id} step "${step.id}" wants ${step.goal.count} ` +
            `${step.goal.kind}, and the seed builds ${frontages} pavilions`,
        ).toBeLessThanOrEqual(frontages);
      }
    });
  }
});
