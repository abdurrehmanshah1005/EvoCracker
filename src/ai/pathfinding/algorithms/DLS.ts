// ========================
// DLS — Depth-Limited Search
// Enemy: Leashed Guard (stays within patrol radius of treasure/post)
// Time: O(b^ℓ)  |  Space: O(ℓ)  (ℓ = depth limit)
// Complete: No (goal may be beyond limit)  |  Optimal: No
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';

export function dls(
  grid: Grid,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  depthLimit: number
): PathResult {
  const t0 = performance.now();
  grid.resetSearchState();

  const start = grid.getNode(startX, startY);
  const goal = grid.getNode(goalX, goalY);
  if (!start || !goal || !start.walkable || !goal.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'DLS', expansionOrder: [] };
  }

  const stack: GridNode[] = [start];
  start.visited = true;
  start.g = 0;
  start.depth = 0;

  let nodesExpanded = 0;
  const expansionOrder: PathResult['expansionOrder'] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    nodesExpanded++;
    expansionOrder.push({ x: current.x, y: current.y, step: nodesExpanded, cost: current.depth });

    // Goal check
    if (current.x === goal.x && current.y === goal.y) {
      return {
        path: grid.reconstructPath(current),
        nodesExpanded,
        nodesVisited: nodesExpanded,
        timeMs: performance.now() - t0,
        success: true,
        algorithm: 'DLS',
        expansionOrder,
      };
    }

    // Don't expand beyond depth limit
    if (current.depth >= depthLimit) continue;

    // Expand neighbors
    const neighbors = grid.getNeighbors4(current);
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i];
      if (!neighbor.visited) {
        neighbor.visited = true;
        neighbor.parent = current;
        neighbor.g = current.g + 1;
        neighbor.depth = current.depth + 1;
        stack.push(neighbor);
      }
    }
  }

  return { path: [], nodesExpanded, nodesVisited: nodesExpanded, timeMs: performance.now() - t0, success: false, algorithm: 'DLS', expansionOrder };
}
