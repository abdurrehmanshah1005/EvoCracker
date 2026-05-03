# Phase 4: AI Evolution Proof & Algorithm Comparative Analysis

This phase replaces traditional static machine-learning accuracy scores with dynamic, real-time evidence proving that the AI agents actively adapt, mutate, and get smarter over time in response to the player's behavior.

## Phase 4 Deliverable Summary

- Replaced static ``accuracy'' framing with measurable live evolution evidence.
- Connected enemy runtime telemetry directly to dashboard proof views.
- Added comparative algorithm runtime metrics for transparent benchmarking.

## Verification Checklist

- [x] Evolution evidence uses live runtime values, not synthetic filler data.
- [x] Comparative pathfinding metrics are measurable in active sessions.
- [x] Demonstration flow is reproducible for evaluator review.

## 1. Replacing ML Accuracy Scores with Evolution Graphs

In a standard ML environment, accuracy scores (like F1 or precision) prove intelligence. In *EvoCracker*, intelligence is proven through **Emergent Fitness and Genetic Shifts**, which are visualized live in the `AI Analytics Panel` (accessible via the backtick \` key).

The **Evolution Dashboard** proves the enemies get smarter by showing:
- **Generation Fitness Charts:** A bar chart tracking the average, median, and max fitness of the population across dungeon floors. A steady upward trend proves the Genetic Algorithm is successfully weeding out weak enemies.
- **Gene Averages:** We visualize the specific genetic traits (Speed, Vision, Aggression, Caution, Pack Tendency, Ambush, Patrol) mutating. For example:
  - If a player rushes, the population's *Speed* and *Aggression* graphs will rise over generations as slow enemies are killed off.
  - If a player hides often, the *Vision* and *Persistence* graphs will spike as enemies adapt to search longer.
- **Iteration Proof:** Instead of rigged difficulty multipliers, the stats are extracted 100% authentically from the living enemies. The "Strength Index" Delta shows exactly how much stronger the current generation's genome is compared to the baseline.

## 2. Authentic Telemetry Extraction

To ensure the graphs are not "filler" data, the metrics are pulled directly from the living AI agents via the `getAnalyticsSnapshot()` method in `EnemyBase.ts` twice a second.
- We pull exact physical states (current health, speed).
- We pull genetic weights (0.0 to 1.0).
- We pull living performance data (how much damage this specific entity has dealt, how many unique tiles it has explored, and how long it has been stuck).

## 3. Search Algorithm Comparative Analysis

Because enemies genetically evolve their preferred pathfinding algorithms (A*, BFS, DFS, IDS, DLS, UCS, Greedy BFS), we must benchmark their performance.

The **Pathfinding Tab** in the Analytics Dashboard provides a live comparative analysis of the active search algorithms in the dungeon:
- **Average Compute Time (ms):** Measures the real-time JavaScript execution cost of calculating a route to the player.
- **Average Nodes Expanded:** Measures the memory and search-space efficiency of the algorithm. (e.g., A* will predictably expand fewer nodes than BFS in open spaces).

### Why this proves intelligence:
By tracking `nodesExpanded` and `pathComputeTimeMs`, we can physically prove that as enemies evolve higher intelligence (e.g., mutating to prefer `A*` or `Greedy BFS` over `DLS`), their pathfinding becomes demonstrably faster and more memory-efficient on the comparative analysis graphs.

## 4. How to Demonstrate

**Recommended Evaluator Flow:**
1. Start the game and complete a floor.
2. Open the AI panel with the backtick (\`) key.
3. Open the **Player** tab to show that the AI has classified the player's playstyle based on raw keystrokes, movement samples, and dominant zones.
4. Open the **Evolution** tab to display the fitness chart climbing over multiple generations, proving the enemies are learning.
5. Open the **Pathfinding** tab to show the real-time runtime comparison (Compute Time vs. Nodes Expanded) between the active search algorithms on the grid.
