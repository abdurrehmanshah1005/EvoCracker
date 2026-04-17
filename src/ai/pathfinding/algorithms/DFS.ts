// ========================
// DFS — Depth-First Search
// Enemy: Bat (deep long-range scouting through tunnels)
// Time: O(V + E)  |  Space: O(V) worst, O(d) typical (d = max depth)
// Complete: No (can loop without visited set)  |  Optimal: No
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';

export function dfs(grid: Grid, startX: number, startY: number, goalX: number, goalY: number): PathResult {
  const t0 = performance.now();
  grid.resetSearchState();

  const start = grid.getNode(startX, startY);
  const goal = grid.getNode(goalX, goalY);
  if (!start || !goal || !start.walkable || !goal.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'DFS', expansionOrder: [] };
  }

  const stack: GridNode[] = [start];
  start.visited = true;

  let nodesExpanded = 0;
  const expansionOrder: PathResult['expansionOrder'] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
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
        algorithm: 'DFS',
        expansionOrder,
      };
    }

    // Expand neighbors — push in reverse order so first neighbor is explored first
    const neighbors = grid.getNeighbors4(current);
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i];
      if (!neighbor.visited) {
        neighbor.visited = true;
        neighbor.parent = current;
        neighbor.g = current.g + 1;
        stack.push(neighbor);
      }
    }
  }

  return { path: [], nodesExpanded, nodesVisited: nodesExpanded, timeMs: performance.now() - t0, success: false, algorithm: 'DFS', expansionOrder };
}
