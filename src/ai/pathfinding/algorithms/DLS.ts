// ========================
// DLS — Depth-Limited Search
// Enemy: Leashed Guard (stays within patrol radius of post)
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
  // Track the minimum depth at which we visited a node
  const visitedDepth = new Map<GridNode, number>();
  visitedDepth.set(start, 0);

  start.g = 0;
  start.depth = 0;

  let nodesExpanded = 0;
  const expansionOrder: PathResult['expansionOrder'] = [];

  let closestNode: GridNode | null = null;
  let minH = Infinity;

  while (stack.length > 0) {
    const current = stack.pop()!;
    nodesExpanded++;
    expansionOrder.push({ x: current.x, y: current.y, step: nodesExpanded, cost: current.depth });

    // Update closest node
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
        nodesExpanded,
        nodesVisited: visitedDepth.size,
        timeMs: performance.now() - t0,
        success: true,
        algorithm: 'DLS',
        expansionOrder,
      };
    }

    if (current.depth >= depthLimit) continue;

    const neighbors = grid.getNeighbors4(current);
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i];
      const nextDepth = current.depth + 1;
      
      const prevDepth = visitedDepth.get(neighbor) ?? Infinity;
      // Allow revisit if we found a shorter path to this node
      if (nextDepth < prevDepth) {
        visitedDepth.set(neighbor, nextDepth);
        neighbor.parent = current;
        neighbor.g = nextDepth;
        neighbor.depth = nextDepth;
        stack.push(neighbor);
      }
    }
  }

  // If goal not reached within depth limit, return path to closest node found
  const partialPath = closestNode ? grid.reconstructPath(closestNode) : [];
  return { path: partialPath, nodesExpanded, nodesVisited: nodesExpanded, timeMs: performance.now() - t0, success: false, algorithm: 'DLS', expansionOrder };
}
