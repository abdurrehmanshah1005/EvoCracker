// ========================
// Greedy Best-First Search
// Enemy: Enraged Goblin (bee-lines toward player, ignores path cost)
// Time: O(b^m) worst case  |  Space: O(b^m)
// Complete: No (can loop in infinite spaces)  |  Optimal: No
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';
import type { HeuristicFn } from '../heuristics';
import { manhattan } from '../heuristics';
import { PriorityQueue } from '@utils/PriorityQueue';

export function greedyBFS(
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
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'GreedyBFS', expansionOrder: [] };
  }

  // Priority queue sorted by h only (ignores g — this is what makes it "greedy")
  const openSet = new PriorityQueue<GridNode>((a, b) => a.h - b.h);
  start.g = 0;
  start.h = heuristic(start, goal);
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
    expansionOrder.push({ x: current.x, y: current.y, step: nodesExpanded, cost: current.h });

    // Goal check
    if (current.x === goal.x && current.y === goal.y) {
      return {
        path: grid.reconstructPath(current),
        nodesExpanded,
        nodesVisited: nodesExpanded,
        timeMs: performance.now() - t0,
        success: true,
        algorithm: 'GreedyBFS',
        expansionOrder,
      };
    }

    for (const neighbor of grid.getNeighbors4(current)) {
      if (!neighbor.visited && !neighbor.inOpenSet) {
        neighbor.parent = current;
        neighbor.g = current.g + 1;
        neighbor.h = heuristic(neighbor, goal);
        neighbor.inOpenSet = true;
        openSet.push(neighbor);
      }
    }
  }

  return { path: [], nodesExpanded, nodesVisited: nodesExpanded, timeMs: performance.now() - t0, success: false, algorithm: 'GreedyBFS', expansionOrder };
}
