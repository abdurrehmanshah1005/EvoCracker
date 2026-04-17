// ========================
// IDS — Iterative Deepening Search
// Enemy: Inquisitor (methodical room-clearing, increasing depth each pass)
// Time: O(b^d)  |  Space: O(d)  (d = depth of shallowest goal)
// Complete: Yes  |  Optimal: Yes (unweighted)
// Combines BFS completeness with DFS space efficiency
// ========================

import type { Grid, GridNode, PathResult } from '../Grid';

/**
 * Depth-Limited Search helper
 * Returns: 'found' | 'cutoff' | 'failure'
 */
function depthLimitedSearch(
  grid: Grid,
  node: GridNode,
  goalX: number,
  goalY: number,
  limit: number,
  expansionOrder: PathResult['expansionOrder'],
  counter: { expanded: number }
): 'found' | 'cutoff' | 'failure' {
  counter.expanded++;
  expansionOrder.push({ x: node.x, y: node.y, step: counter.expanded, cost: node.depth });

  if (node.x === goalX && node.y === goalY) return 'found';
  if (node.depth >= limit) return 'cutoff';

  let anyCutoff = false;

  for (const neighbor of grid.getNeighbors4(node)) {
    if (!neighbor.visited) {
      neighbor.visited = true;
      neighbor.parent = node;
      neighbor.depth = node.depth + 1;
      neighbor.g = node.g + 1;

      const result = depthLimitedSearch(grid, neighbor, goalX, goalY, limit, expansionOrder, counter);

      if (result === 'found') return 'found';
      if (result === 'cutoff') anyCutoff = true;

      // Unvisit for next iteration (IDS needs to re-explore)
      neighbor.visited = false;
      neighbor.parent = null;
    }
  }

  return anyCutoff ? 'cutoff' : 'failure';
}

export function ids(grid: Grid, startX: number, startY: number, goalX: number, goalY: number, maxDepth = 100): PathResult {
  const t0 = performance.now();
  const expansionOrder: PathResult['expansionOrder'] = [];
  const counter = { expanded: 0 };

  const start = grid.getNode(startX, startY);
  const goal = grid.getNode(goalX, goalY);
  if (!start || !goal || !start.walkable || !goal.walkable) {
    return { path: [], nodesExpanded: 0, nodesVisited: 0, timeMs: performance.now() - t0, success: false, algorithm: 'IDS', expansionOrder: [] };
  }

  for (let depth = 0; depth <= maxDepth; depth++) {
    // Reset grid for each depth iteration
    grid.resetSearchState();
    start.visited = true;
    start.g = 0;
    start.depth = 0;

    const result = depthLimitedSearch(grid, start, goalX, goalY, depth, expansionOrder, counter);

    if (result === 'found') {
      const goalNode = grid.getNode(goalX, goalY)!;
      return {
        path: grid.reconstructPath(goalNode),
        nodesExpanded: counter.expanded,
        nodesVisited: counter.expanded,
        timeMs: performance.now() - t0,
        success: true,
        algorithm: 'IDS',
        expansionOrder,
      };
    }

    if (result === 'failure') break; // No more nodes to explore
  }

  return {
    path: [],
    nodesExpanded: counter.expanded,
    nodesVisited: counter.expanded,
    timeMs: performance.now() - t0,
    success: false,
    algorithm: 'IDS',
    expansionOrder,
  };
}
