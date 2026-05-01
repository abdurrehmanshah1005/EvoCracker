# Phase 3: The Code

This phase documents the working AI logic used by EvoCracker: search algorithms, real-time behavior management, and the Genetic Algorithm loop.

## 1. Pathfinding Implementation

Pathfinding is implemented in `src/ai/pathfinding/` and routed through `AlgorithmRegistry.ts`.

Implemented algorithms:
- `BFS`: complete, unweighted breadth-first search.
- `DFS`: depth-first traversal for exploratory/non-optimal pursuit.
- `IDS`: iterative deepening search.
- `DLS`: depth-limited search with genome-driven depth limits.
- `UCS`: uniform-cost search using tile movement weights.
- `AStar`: heuristic pathfinding using `g + h`.
- `GreedyBFS`: heuristic-only best-first search.
- `HillClimbing`: local heuristic improvement for fast but incomplete movement.

Each algorithm returns:
- `path`: selected route as grid coordinates.
- `nodesExpanded`: search effort.
- `nodesVisited`: total visited count.
- `timeMs`: runtime for comparative analysis.
- `success`: whether a path was found.
- `expansionOrder`: visualization data for the algorithm lab/dashboard.

## 2. Real-Time State Management

Enemies are controlled by `EnemyBase.ts` and the Behavior Tree engine in `src/ai/behavior/BehaviorTree.ts`.

Runtime flow:
1. `VisionSystem.ts` updates whether the player is visible using raycast line-of-sight.
2. Enemy blackboards store player position, last known position, alert timers, health, and path state.
3. The Behavior Tree transitions the enemy between idle, suspicious, alert/chasing, and fleeing states.
4. `EnemyBase.requestPath()` asks the pathfinding client for a path to the current behavior target.
5. `EnemyBase.update()` follows the path, attacks on contact, tracks survival time, and logs search metrics.

## 3. Genetic Algorithm Loop

The Genetic Algorithm is implemented in `src/ai/evolution/GeneticAlgorithm.ts`.

Genome genes:
- `speed`
- `vision`
- `aggression`
- `persistence`
- `cautiousness`
- `packTendency`
- `ambushTendency`
- `patrolVariance`
- `algorithmWeights`

Evolution process:
1. Enemy performance is measured during a run.
2. `calculateFitness()` scores enemies using visibility, damage, detections, survival, area coverage, stuck time, and cooperative pressure.
3. `tournamentSelection()` or `rouletteSelection()` chooses parents.
4. `uniformCrossover()` or `weightedAverageCrossover()` creates children.
5. `mutateGenome()` applies Gaussian mutation to traits and algorithm weights.
6. `applyPlaystyleBias()` nudges the population based on the classified player style.
7. `computeGenerationStats()` produces dashboard metrics.

## 4. Algorithm Diversity

Enemy pursuit now uses weighted sampling from `algorithmWeights` instead of always choosing the highest weight. This keeps evolution meaningful while preventing every enemy from collapsing into the same algorithm after a few generations.

The strongest algorithms still become more likely, but weaker algorithms remain observable for analysis and comparison.
