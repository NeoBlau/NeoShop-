/** Alignment, distribution and sizing helpers for the current selection. */
import { unionRect, rectOf } from '../core/geometry.js';

export function alignNodes(nodes, mode) {
  if (nodes.length < 2) return [];
  const bounds = unionRect(nodes.map(rectOf));
  const changes = [];
  for (const node of nodes) {
    let { x, y } = node;
    switch (mode) {
      case 'left':
        x = bounds.x;
        break;
      case 'right':
        x = bounds.x + bounds.w - node.w;
        break;
      case 'center':
        x = bounds.x + (bounds.w - node.w) / 2;
        break;
      case 'top':
        y = bounds.y;
        break;
      case 'bottom':
        y = bounds.y + bounds.h - node.h;
        break;
      case 'middle':
        y = bounds.y + (bounds.h - node.h) / 2;
        break;
      default:
        break;
    }
    if (x !== node.x || y !== node.y) changes.push({ id: node.id, x: Math.round(x), y: Math.round(y) });
  }
  return changes;
}

export function distributeNodes(nodes, axis) {
  if (nodes.length < 3) return [];
  const horizontal = axis === 'horizontal';
  const sorted = [...nodes].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startEdge = horizontal ? first.x + first.w : first.y + first.h;
  const endEdge = horizontal ? last.x : last.y;
  const inner = sorted.slice(1, -1);
  const totalSize = inner.reduce((acc, n) => acc + (horizontal ? n.w : n.h), 0);
  const gap = (endEdge - startEdge - totalSize) / (inner.length + 1);
  const changes = [];
  let cursor = startEdge + gap;
  for (const node of inner) {
    const value = Math.round(cursor);
    if (horizontal && node.x !== value) changes.push({ id: node.id, x: value, y: node.y });
    else if (!horizontal && node.y !== value) changes.push({ id: node.id, x: node.x, y: value });
    cursor += (horizontal ? node.w : node.h) + gap;
  }
  return changes;
}

export function equalizeSize(nodes, reference) {
  if (nodes.length < 2) return [];
  const model = reference || nodes[0];
  return nodes
    .filter((n) => n.id !== model.id && (n.w !== model.w || n.h !== model.h))
    .map((n) => ({ id: n.id, w: model.w, h: model.h }));
}
