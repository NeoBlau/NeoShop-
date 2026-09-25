import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { LocationManifest } from '../../features/world/useLocationData.js';

/**
 * What the world tells a street quest.
 *
 * Three of the five signals a quest can ask about are only knowable inside the
 * canvas: how far somebody has walked, which frontages they have come near,
 * and whether they have reached a landmark. The other two — which vendors they
 * got talking and which products they switched on — are already clicks the page
 * handles, so they are not here.
 *
 * Nothing is reported per frame. Distance is accumulated and handed over every
 * couple of metres, and the sets are reported once each: a quest panel that
 * re-renders sixty times a second to move a progress bar is a quest panel that
 * costs more than the scene it sits on.
 */

/** Metres of walking between reports. */
const REPORT_EVERY = 2;
/** How close counts as having come to a frontage. */
const NEAR_FRONTAGE = 8;
/** How close counts as having reached a landmark. */
const NEAR_LANDMARK = 4;

export interface QuestLandmark {
  name: string;
  position: [number, number, number];
}

export function QuestSensors({
  anchors,
  pavilionIds,
  landmarks,
  onWalked,
  onNearFrontage,
  onLandmark,
}: {
  anchors: LocationManifest['anchors'];
  /** The pavilion on each anchor, in the order the scene placed them. */
  pavilionIds: readonly string[];
  landmarks: readonly QuestLandmark[];
  onWalked: (metres: number) => void;
  onNearFrontage: (pavilionId: string) => void;
  onLandmark: (name: string) => void;
}) {
  const previous = useRef<Vector3 | null>(null);
  const walked = useRef(0);
  const unreported = useRef(0);
  const seenFrontages = useRef(new Set<string>());
  const seenLandmarks = useRef(new Set<string>());

  useFrame(({ camera }) => {
    const here = camera.position;

    const last = previous.current;
    if (last) {
      // Horizontal only: a buyer walking up a slope has not covered the
      // hypotenuse as far as anybody's legs are concerned.
      const moved = Math.hypot(here.x - last.x, here.z - last.z);
      walked.current += moved;
      unreported.current += moved;

      if (unreported.current >= REPORT_EVERY) {
        unreported.current = 0;
        onWalked(walked.current);
      }
    }

    previous.current = (last ?? new Vector3()).copy(here);

    for (const [index, id] of pavilionIds.entries()) {
      if (seenFrontages.current.has(id)) continue;

      const anchor = anchors[index % Math.max(1, anchors.length)];
      if (!anchor) continue;

      const from = Math.hypot(here.x - anchor.stand[0], here.z - anchor.stand[2]);
      if (from <= NEAR_FRONTAGE) {
        seenFrontages.current.add(id);
        onNearFrontage(id);
      }
    }

    for (const landmark of landmarks) {
      if (seenLandmarks.current.has(landmark.name)) continue;

      const from = Math.hypot(here.x - landmark.position[0], here.z - landmark.position[2]);
      if (from <= NEAR_LANDMARK) {
        seenLandmarks.current.add(landmark.name);
        onLandmark(landmark.name);
      }
    }
  });

  return null;
}
