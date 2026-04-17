// ========================
// BFS — Breadth-First Search
// Enemy: Slime (wide-area "ooze" pattern expansion)
// Time: O(V + E)  |  Space: O(V)
// Complete: Yes  |  Optimal: Yes (unweighted)
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';

export function bfs(grid: Grid, startX: number, startY: number, goalX: number, goalY: number): PathResult {
  const t0 = performance.now();
  grid.resetSearchState();

  const start = grid.getNode(startX, startY);
  const goal = grid.getNode(goalX, goalY);
  if (!start || !goal || !start.walkable || !goal.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'BFS', expansionOrder: [] };
  }

  const queue: GridNode[] = [start];
  start.visited = true;
  start.g = 0;

  let nodesExpanded = 0;
  const expansionOrder: PathResult['expansionOrder'] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
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
        algorithm: 'BFS',
        expansionOrder,
      };
    }

    // Expand neighbors (4-directional for BFS — uniform expansion pattern)
    for (const neighbor of grid.getNeighbors4(current)) {
      if (!neighbor.visited) {
        neighbor.visited = true;
        neighbor.parent = current;
        neighbor.g = current.g + 1;
        queue.push(neighbor);
      }
    }
  }

  return { path: [], nodesExpanded, nodesVisited: nodesExpanded, timeMs: performance.now() - t0, success: false, algorithm: 'BFS', expansionOrder };
}
