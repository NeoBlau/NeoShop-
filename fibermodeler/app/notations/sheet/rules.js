/**
 * Worksheet rules.
 *
 * Worksheets have no connections - a card's meaning is its place on the board -
 * so the only rule that matters is containment: a card dropped on a matrix
 * board becomes the board's child and travels with it.
 */
import { SHEET_TYPES } from './types.js';

export function canConnect() {
  return { ok: false, reason: 'noConnections' };
}

export function defaultEdgeType() {
  return null;
}

export function sidesFor() {
  return { sourceSide: null, targetSide: null };
}

export function containerAt(diagram, rectangle, exclude = new Set()) {
  let best = null;
  for (const node of diagram.nodes) {
    if (exclude.has(node.id)) continue;
    if (!SHEET_TYPES[node.type]?.container) continue;
    const cx = rectangle.x + rectangle.w / 2;
    const cy = rectangle.y + rectangle.h / 2;
    const inside = cx >= node.x && cx <= node.x + node.w && cy >= node.y && cy <= node.y + node.h;
    if (!inside) continue;
    if (!best || node.w * node.h < best.w * best.h) best = node;
  }
  return best;
}
