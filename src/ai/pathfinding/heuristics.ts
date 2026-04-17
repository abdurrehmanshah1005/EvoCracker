// ========================
// Heuristic Functions for Informed Search
// ========================

import type { GridNode } from './Grid';

export type HeuristicFn = (a: GridNode, b: GridNode) => number;

/**
 * Manhattan Distance
 * Best for: 4-directional grid movement
 * Admissible: Yes (never overestimates for 4-dir)
 * Time: O(1)
 */
export function manhattan(a: GridNode, b: GridNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Euclidean Distance
 * Best for: Free movement or when diagonal movement costs √2
 * Admissible: Yes (straight-line is always shortest)
 * Time: O(1)
 */
export function euclidean(a: GridNode, b: GridNode): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Octile Distance
 * Best for: 8-directional movement where diagonal = √2
 * Admissible: Yes
 * Time: O(1)
 */
export function octile(a: GridNode, b: GridNode): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Chebyshev Distance
 * Best for: 8-directional movement where diagonal = 1
 * Admissible: Yes for uniform diagonal cost
 * Time: O(1)
 */
export function chebyshev(a: GridNode, b: GridNode): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Zero Heuristic (turns A* into UCS/Dijkstra)
 * Useful for: Testing, ensuring completeness
 * Admissible: Trivially yes
 */
export function zero(): number {
  return 0;
}

/**
 * Anti-Heuristic (deliberately wrong — for "Scroll of Confusion" item)
 * Sends the enemy in the WRONG direction
 */
export function antiManhattan(a: GridNode, b: GridNode): number {
  const dist = manhattan(a, b);
  // Invert: high distance = low cost, pushing enemy away from target
  return Math.max(0, 100 - dist);
}

// Registry for easy lookup
export const HEURISTICS: Record<string, HeuristicFn> = {
  manhattan,
  euclidean,
  octile,
  chebyshev,
  zero,
  antiManhattan,
};
