# Phase 2: The Setup (Calibration Round)

This document explains how EvoCracker handles Phase 2, collecting initial telemetry to classify the player's baseline playstyle before evolving the first generation of AI agents.

## 1. What is the Calibration Round?
Since EvoCracker uses real-time player data rather than a pre-existing dataset, it requires initial data to train Generation 1 enemies. We've introduced a **Calibration Round** that occurs on **Floor 1, Iteration 1**. 

During this round:
- **No Enemies Spawn:** The player is free to explore the environment safely.
- **Telemetry is Active:** The engine records every movement, keystroke, and decision the player makes.
- **Goal:** To establish a baseline profile of whether the player naturally explores every room (`explorer`), rushes straight to the exit (`rusher`), or uses stealth/hiding mechanics frequently (`stayer`).

## 2. Telemetry Recorded
The `GameScreen` continuously monitors and records the following metrics into a `PlayerProfile`:
- **Total Moves & Time Moving:** How long the player is actively traversing the map.
- **Path Straightness:** The ratio of direct displacement to the actual distance traveled.
- **Exploration Rate:** The number of unique grid tiles visited versus the total grid size.
- **Stealth & Hiding:** Time spent in stealth states (e.g. using items like Ghost Cloak) or lingering in safe zones.
- **Combat Stats (Later floors):** Attack frequency, flee frequency, and items used.

## 3. Exiting the Calibration Round
The game engine supports map-specific physical boundaries that act as the exit trigger for the Calibration Round. For example:
- **Battleground 1 (`grinmap.json`):** The rightmost edge of the map (the wooden gates).
- **Battleground 2 (`grinmap2.json`):** The bottom edge of the map (the golden line).

When the player steps on these boundaries, the game registers that the floor is cleared and triggers `finalizeLearning()`.

## 4. Preprocessing and Classification
The raw telemetry is processed in the `classifyPlaystyle()` function (located in `GeneticAlgorithm.ts`). It computes a score for five distinct labels:
- `rusher`: High speed, straight paths, low stealth.
- `stayer`: High stealth duration, high hiding frequency.
- `explorer`: High exploration rate (unique tiles), non-straight paths.
- `fighter`: High engagement rate, low flee frequency (mostly applicable after calibration).
- `hybrid`: If the scores are closely balanced.

## 5. The Transition & Result
Upon exiting the Calibration Round, the player is presented with a 1.5-second full-screen overlay stating: **"Calibration Round Completed. Loading Level 1..."** 

Behind the scenes, the engine:
1. Locks in the classified player profile.
2. Applies a **Playstyle-Adaptive Bias** to Generation 1 (e.g., if the player is a `rusher`, enemies will spawn with higher speed and an `A*` algorithm bias).
3. Smoothly reloads the exact same Tiled Battleground map (now internally on Floor 2).

When the 1.5-second loading screen disappears, the player seamlessly begins Iteration 2 (Level 1), and the newly evolved Generation 1 enemies instantly spawn on the map.
