# Phase 4: The Proof

This phase replaces traditional machine-learning accuracy scores with game-specific evidence that the AI adapts over time.

## 1. Evolution Evidence

The proof dashboard is implemented in `src/ui/analytics/AIAnalyticsPanel.tsx`.

The Evolution tab shows:
- Current generation.
- Average fitness.
- Maximum fitness.
- Minimum fitness.
- Median fitness through generation stats.
- Diversity index.
- Dominant algorithm.
- Total mutations.
- Fitness-over-generations bar chart.

These metrics come from `GenerationStats` in `src/ai/evolution/GeneticAlgorithm.ts`.

## 2. Enemy Improvement Criteria

Enemies are considered smarter when later generations show:
- Higher average fitness.
- Higher maximum fitness.
- Reduced stuck time.
- Better damage or detection output against the current player style.
- More suitable genes for the classified player profile.

Examples:
- Against a `rusher`, faster enemies and A*/Greedy BFS-biased genomes should become more common.
- Against a `stayer`, persistent searchers using BFS/IDS should become more common.
- Against an `explorer`, pack tendency and patrol coverage should increase.

## 3. Search Algorithm Comparative Analysis

The Algorithms tab now includes a Runtime Comparison section.

For each search algorithm, the dashboard reports:
- Average pathfinding time in milliseconds.
- Average nodes expanded.
- Whether there are active samples in the current run.

This satisfies the comparative analysis requirement by measuring actual in-game pathfinding calls instead of only listing theoretical complexity.

## 4. How to Demonstrate

Recommended evaluator flow:
1. Start the game.
2. Complete the calibration round by reaching the exit.
3. Open the AI panel with the backtick key.
4. Play through one or more enemy floors.
5. On the Evolution tab, show the fitness chart and generation stats.
6. On the Algorithms tab, show runtime comparison for BFS, DFS, IDS, DLS, UCS, A*, Greedy BFS, and Hill Climbing.

## 5. Remaining Report Material

For the final LaTeX report, capture screenshots of:
- The Evolution tab after at least one completed generation.
- The Algorithms tab runtime comparison.
- The Player tab showing cleaned telemetry and classified playstyle.
