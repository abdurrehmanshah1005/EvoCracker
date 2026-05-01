// ========================
// Algorithm Registry — Strategy Pattern
// Maps algorithm types to their implementations
// ========================

import { AlgorithmType } from '@utils/constants';
import type { Grid, PathResult } from './Grid';
import type { HeuristicFn } from './heuristics';
import { manhattan } from './heuristics';
import { bfs } from './algorithms/BFS';
import { dfs } from './algorithms/DFS';
import { ids } from './algorithms/IDS';
import { dls } from './algorithms/DLS';
import { ucs } from './algorithms/UCS';
import { aStar } from './algorithms/AStar';
import { greedyBFS } from './algorithms/GreedyBFS';
import { hillClimbing, targetedVantageScore } from './algorithms/HillClimbing';

export interface PathfindingRequest {
  algorithm: AlgorithmType;
  grid: Grid;
  startX: number;
  startY: number;
  goalX: number;
  goalY: number;
  heuristic?: HeuristicFn;
  depthLimit?: number; // For DLS
}

/**
 * Run any pathfinding algorithm by type.
 * This is the Strategy Pattern entry point — enemies call this
 * with their genome's preferred algorithm.
 */
export function findPath(request: PathfindingRequest): PathResult {
  const { algorithm, grid, startX, startY, goalX, goalY, heuristic = manhattan, depthLimit = 15 } = request;

  switch (algorithm) {
    case AlgorithmType.BFS:
      return bfs(grid, startX, startY, goalX, goalY);

    case AlgorithmType.DFS:
      return dfs(grid, startX, startY, goalX, goalY);

    case AlgorithmType.IDS:
      return ids(grid, startX, startY, goalX, goalY);

    case AlgorithmType.DLS:
      return dls(grid, startX, startY, goalX, goalY, depthLimit);

    case AlgorithmType.UCS:
      return ucs(grid, startX, startY, goalX, goalY);

    case AlgorithmType.ASTAR:
      return aStar(grid, startX, startY, goalX, goalY, heuristic);

    case AlgorithmType.GREEDY_BFS:
      return greedyBFS(grid, startX, startY, goalX, goalY, heuristic);

    case AlgorithmType.HILL_CLIMBING:
      return hillClimbing(grid, startX, startY, (x, y, g) => targetedVantageScore(x, y, g, goalX, goalY, 5));

    default:
      console.warn(`[AlgorithmRegistry] Unknown algorithm: ${algorithm}, falling back to BFS`);
      return bfs(grid, startX, startY, goalX, goalY);
  }
}

/** Get human-readable description of an algorithm */
export function getAlgorithmInfo(type: AlgorithmType): {
  name: string;
  enemy: string;
  category: 'uninformed' | 'informed' | 'optimization';
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  optimal: boolean;
  complete: boolean;
} {
  const info: Record<AlgorithmType, ReturnType<typeof getAlgorithmInfo>> = {
    [AlgorithmType.BFS]: {
      name: 'Breadth-First Search',
      enemy: 'Mutant Toad',
      category: 'uninformed',
      description: 'Explores all nodes at current depth before moving deeper. Guarantees shortest path on unweighted graphs.',
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V)',
      optimal: true,
      complete: true,
    },
    [AlgorithmType.DFS]: {
      name: 'Depth-First Search',
      enemy: 'Ghost',
      category: 'uninformed',
      description: 'Explores as deep as possible before backtracking. Memory efficient but may not find shortest path.',
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V)',
      optimal: false,
      complete: true,
    },
    [AlgorithmType.IDS]: {
      name: 'Iterative Deepening Search',
      enemy: 'Bridge Heroine',
      category: 'uninformed',
      description: 'Combines BFS optimality with DFS space efficiency by running DFS with increasing depth limits.',
      timeComplexity: 'O(b^d)',
      spaceComplexity: 'O(d)',
      optimal: true,
      complete: true,
    },
    [AlgorithmType.DLS]: {
      name: 'Depth-Limited Search',
      enemy: 'Ogre',
      category: 'uninformed',
      description: 'DFS with a maximum depth. The guard stays within patrol radius of its post.',
      timeComplexity: 'O(b^ℓ)',
      spaceComplexity: 'O(ℓ)',
      optimal: false,
      complete: false,
    },
    [AlgorithmType.UCS]: {
      name: 'Uniform Cost Search',
      enemy: 'Terrible Knight',
      category: 'uninformed',
      description: 'Expands lowest-cost node first. Optimal on weighted graphs — respects terrain costs.',
      timeComplexity: 'O(V log V)',
      spaceComplexity: 'O(V)',
      optimal: true,
      complete: true,
    },
    [AlgorithmType.ASTAR]: {
      name: 'A* Search',
      enemy: 'WereWolf',
      category: 'informed',
      description: 'Uses heuristic to guide search toward goal. Optimal with admissible heuristic, faster than UCS.',
      timeComplexity: 'O(E log V)',
      spaceComplexity: 'O(V)',
      optimal: true,
      complete: true,
    },
    [AlgorithmType.GREEDY_BFS]: {
      name: 'Greedy Best-First Search',
      enemy: 'Sunny Froggy',
      category: 'informed',
      description: 'Expands node closest to goal (by heuristic). Fast but not optimal — charges straight at target.',
      timeComplexity: 'O(b^m)',
      spaceComplexity: 'O(b^m)',
      optimal: false,
      complete: false,
    },
    [AlgorithmType.HILL_CLIMBING]: {
      name: 'Hill Climbing',
      enemy: 'Demon',
      category: 'optimization',
      description: 'Greedy local search that moves to best neighbor. Seeks optimal vantage point for ranged attacks.',
      timeComplexity: 'O(neighbors)',
      spaceComplexity: 'O(1)',
      optimal: false,
      complete: false,
    },
  };

  return info[type];
}
