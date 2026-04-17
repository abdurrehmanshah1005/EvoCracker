// ========================
// Hill Climbing — Local Search Optimization
// Enemy: Archer (seeks highest "vantage score" tile for line-of-sight)
// Time: O(neighbors per step)  |  Space: O(1)
// Complete: No (can get stuck at local maxima)  |  Optimal: No
// ========================

import type { Grid, PathResult } from '../Grid';

export interface VantageScorer {
  (x: number, y: number, grid: Grid): number;
}

/**
 * Default vantage score: prefers tiles with more open space around them
 * (better line of sight) and higher "elevation" (further from walls)
 */
export function defaultVantageScore(x: number, y: number, grid: Grid): number {
  let score = 0;
  const range = 5;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      const node = grid.getNode(nx, ny);
      if (node && node.walkable) {
        score += 1; // Open space is good
      }
    }
  }

  // Bonus: distance from walls (center of rooms is better)
  let minWallDist = range;
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      const node = grid.getNode(nx, ny);
      if (node && !node.walkable) {
        const dist = Math.abs(dx) + Math.abs(dy);
        minWallDist = Math.min(minWallDist, dist);
      }
    }
  }
  score += minWallDist * 3;

  return score;
}

/**
 * Vantage score that also factors in distance to a target
 * (Archer wants good LOS AND to be close enough to shoot)
 */
export function targetedVantageScore(
  x: number,
  y: number,
  grid: Grid,
  targetX: number,
  targetY: number,
  attackRange: number
): number {
  let score = defaultVantageScore(x, y, grid);

  // Distance penalty: too far from target is bad
  const dist = Math.abs(x - targetX) + Math.abs(y - targetY);
  if (dist <= attackRange) {
    score += 20; // Big bonus for being in attack range
  } else {
    score -= (dist - attackRange) * 2; // Penalty for being out of range
  }

  // Line of sight check (simple — walk tiles toward target)
  let hasLOS = true;
  const steps = Math.max(Math.abs(targetX - x), Math.abs(targetY - y));
  for (let i = 1; i < steps; i++) {
    const sx = Math.round(x + (targetX - x) * (i / steps));
    const sy = Math.round(y + (targetY - y) * (i / steps));
    const node = grid.getNode(sx, sy);
    if (node && !node.walkable) {
      hasLOS = false;
      break;
    }
  }
  if (hasLOS) score += 15;

  return score;
}

export function hillClimbing(
  grid: Grid,
  startX: number,
  startY: number,
  scorer: VantageScorer = defaultVantageScore,
  maxSteps = 20
): PathResult {
  const t0 = performance.now();
  grid.resetSearchState();

  const start = grid.getNode(startX, startY);
  if (!start || !start.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'HillClimbing', expansionOrder: [] };
  }

  const path: { x: number; y: number }[] = [{ x: startX, y: startY }];
  const expansionOrder: PathResult['expansionOrder'] = [];
  let currentX = startX;
  let currentY = startY;
  let currentScore = scorer(currentX, currentY, grid);
  let nodesExpanded = 0;

  for (let step = 0; step < maxSteps; step++) {
    const currentNode = grid.getNode(currentX, currentY)!;
    const neighbors = grid.getNeighbors4(currentNode);
    nodesExpanded += neighbors.length;

    let bestNeighbor: { x: number; y: number } | null = null;
    let bestScore = currentScore;

    for (const neighbor of neighbors) {
      const score = scorer(neighbor.x, neighbor.y, grid);
      expansionOrder.push({ x: neighbor.x, y: neighbor.y, step: nodesExpanded, cost: score });

      if (score > bestScore) {
        bestScore = score;
        bestNeighbor = { x: neighbor.x, y: neighbor.y };
      }
    }

    // If no improvement found — stuck at local maximum
    if (!bestNeighbor) break;

    currentX = bestNeighbor.x;
    currentY = bestNeighbor.y;
    currentScore = bestScore;
    path.push({ x: currentX, y: currentY });
  }

  return {
    path,
    nodesExpanded,
    nodesVisited: nodesExpanded,
    timeMs: performance.now() - t0,
    success: path.length > 1,
    algorithm: 'HillClimbing',
    expansionOrder,
  };
}
