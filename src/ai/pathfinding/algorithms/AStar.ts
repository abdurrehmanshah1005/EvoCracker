// ========================
// A* Search — The Gold Standard
// Enemy: Assassin (optimal pursuit with heuristic guidance)
// Time: O(E log V)  |  Space: O(V)
// Complete: Yes  |  Optimal: Yes (with admissible heuristic)
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';
import type { HeuristicFn } from '../heuristics';
import { manhattan } from '../heuristics';
import { PriorityQueue } from '@utils/PriorityQueue';

export function aStar(
  grid: Grid,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  heuristic: HeuristicFn = manhattan
): PathResult {
  const t0 = performance.now();
  grid.resetSearchState();

  const start = grid.getNode(startX, startY);
  const goal = grid.getNode(goalX, goalY);
  if (!start || !goal || !start.walkable || !goal.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'A*', expansionOrder: [] };
  }

  // Priority queue sorted by f = g + h
  const openSet = new PriorityQueue<GridNode>((a, b) => a.f - b.f);
  start.g = 0;
  start.h = heuristic(start, goal);
  start.f = start.g + start.h;
  start.inOpenSet = true;
  openSet.push(start);

  let nodesExpanded = 0;
  const expansionOrder: PathResult['expansionOrder'] = [];

  while (!openSet.isEmpty) {
    const current = openSet.pop()!;
    current.inOpenSet = false;

    if (current.visited) continue;
    current.visited = true;

    nodesExpanded++;
    expansionOrder.push({ x: current.x, y: current.y, step: nodesExpanded, cost: current.f });

    // Goal check
    if (current.x === goal.x && current.y === goal.y) {
      return {
        path: grid.reconstructPath(current),
        nodesExpanded,
        nodesVisited: nodesExpanded,
        timeMs: performance.now() - t0,
        success: true,
        algorithm: 'A*',
        expansionOrder,
      };
    }

    // Expand neighbors
    for (const neighbor of grid.getNeighbors4(current)) {
      if (neighbor.visited) continue;

      const tentativeG = current.g + neighbor.weight;

      if (tentativeG < neighbor.g) {
        neighbor.parent = current;
        neighbor.g = tentativeG;
        neighbor.h = heuristic(neighbor, goal);
        neighbor.f = neighbor.g + neighbor.h;
        openSet.push(neighbor);
      }
    }
  }

  return { path: [], nodesExpanded, nodesVisited: nodesExpanded, timeMs: performance.now() - t0, success: false, algorithm: 'A*', expansionOrder };
}
