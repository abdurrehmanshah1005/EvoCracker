// ========================
// IDS — Iterative Deepening Search
// Enemy: Bridge Heroine (methodical room-clearing, increasing depth each pass)
// Complete: Yes  |  Optimal: Yes (unweighted)
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';

export function ids(grid: Grid, startX: number, startY: number, goalX: number, goalY: number, maxDepth = 100): PathResult {
  const t0 = performance.now();
  const start = grid.getNode(startX, startY);
  const goal = grid.getNode(goalX, goalY);
  if (!start || !goal || !start.walkable || !goal.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'IDS', expansionOrder: [] };
  }

  let totalNodesExpanded = 0;
  const expansionOrder: PathResult['expansionOrder'] = [];

  let closestNode: GridNode | null = null;
  let minH = Infinity;

  for (let depth = 0; depth <= maxDepth; depth++) {
    grid.resetSearchState();
    
    const stack: GridNode[] = [start];
    const visitedDepth = new Map<GridNode, number>();
    visitedDepth.set(start, 0);

    start.g = 0;
    start.depth = 0;

    while (stack.length > 0) {
      const current = stack.pop()!;
      totalNodesExpanded++;
      expansionOrder.push({ x: current.x, y: current.y, step: totalNodesExpanded, cost: current.depth });

      if (current !== start) {
        const h = Math.abs(current.x - goal.x) + Math.abs(current.y - goal.y);
        if (h < minH) {
          minH = h;
          closestNode = current;
        }
      }

      if (current.x === goal.x && current.y === goal.y) {
        return {
          path: grid.reconstructPath(current),
          nodesExpanded: totalNodesExpanded,
          nodesVisited: visitedDepth.size,
          timeMs: performance.now() - t0,
          success: true,
          algorithm: 'IDS',
          expansionOrder,
        };
      }

      if (current.depth >= depth) continue;

      const neighbors = grid.getNeighbors4(current);
      for (let i = neighbors.length - 1; i >= 0; i--) {
        const neighbor = neighbors[i];
        const nextDepth = current.depth + 1;
        
        const prevDepth = visitedDepth.get(neighbor) ?? Infinity;
        if (nextDepth < prevDepth) {
          visitedDepth.set(neighbor, nextDepth);
          neighbor.parent = current;
          neighbor.g = nextDepth;
          neighbor.depth = nextDepth;
          stack.push(neighbor);
        }
      }
    }
    
    // Failsafe to prevent complete freezing on impossible maps
    if (totalNodesExpanded > 10000) break;
  }

  const partialPath = closestNode ? grid.reconstructPath(closestNode) : [];
  return {
    path: partialPath,
    nodesExpanded: totalNodesExpanded,
    nodesVisited: totalNodesExpanded,
    timeMs: performance.now() - t0,
    success: false,
    algorithm: 'IDS',
    expansionOrder,
  };
}
