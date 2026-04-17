// ========================
// UCS — Uniform Cost Search (Dijkstra's Algorithm)
// Enemy: Royal Knight (navigates weighted terrain optimally)
// Time: O(V log V + E)  |  Space: O(V)
// Complete: Yes  |  Optimal: Yes (weighted graphs)
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';
import { PriorityQueue } from '@utils/PriorityQueue';

export function ucs(grid: Grid, startX: number, startY: number, goalX: number, goalY: number): PathResult {
  const t0 = performance.now();
  grid.resetSearchState();

  const start = grid.getNode(startX, startY);
  const goal = grid.getNode(goalX, goalY);
  if (!start || !goal || !start.walkable || !goal.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'UCS', expansionOrder: [] };
  }

  // Priority queue sorted by cumulative cost (g)
  const openSet = new PriorityQueue<GridNode>((a, b) => a.g - b.g);
  start.g = 0;
  start.inOpenSet = true;
  openSet.push(start);

  let nodesExpanded = 0;
  const expansionOrder: PathResult['expansionOrder'] = [];

  while (!openSet.isEmpty) {
    const current = openSet.pop()!;
    current.inOpenSet = false;

    // Skip if already processed with a better cost
    if (current.visited) continue;
    current.visited = true;

    nodesExpanded++;
    expansionOrder.push({ x: current.x, y: current.y, step: nodesExpanded, cost: current.g });

    // Goal check
    if (current.x === goal.x && current.y === goal.y) {
      return {
        path: grid.reconstructPath(current),
        nodesExpanded,
        nodesVisited: nodesExpanded,
        timeMs: performance.now() - t0,
        success: true,
        algorithm: 'UCS',
        expansionOrder,
      };
    }

    // Expand neighbors with WEIGHTED edges
    for (const neighbor of grid.getNeighbors4(current)) {
      if (neighbor.visited) continue;

      const newCost = current.g + neighbor.weight;

      if (newCost < neighbor.g) {
        neighbor.g = newCost;
        neighbor.parent = current;
        openSet.push(neighbor); // May add duplicate, handled by visited check
      }
    }
  }

  return { path: [], nodesExpanded, nodesVisited: nodesExpanded, timeMs: performance.now() - t0, success: false, algorithm: 'UCS', expansionOrder };
}
