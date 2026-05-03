# Phase 2: The Setup (Calibration Round)

This document explains how EvoCracker handles Phase 2, collecting initial telemetry to classify the player's baseline playstyle before evolving the first generation of AI agents.

## Phase 2 Deliverable Summary

- Implemented a dedicated no-enemy calibration pass on first run.
- Captured raw telemetry suitable for later classification and GA adaptation.
- Added a clean transition from calibration into evolved combat runs.

## Verification Checklist

- [x] Calibration captures keystrokes, movement, and zone dwell.
- [x] Profile preprocessing is defined before classification.
- [x] Exit and transition behavior is explicitly documented.

## 1. What is the Calibration Round?
Since EvoCracker uses real-time player data rather than a pre-existing dataset, it requires initial data to train Generation 1 enemies. We've introduced a **Calibration Round** that occurs on **Floor 1, Iteration 1**. 

During this round:
- **No Enemies Spawn:** The player is free to explore the environment safely.
- **Telemetry is Active:** The engine records every movement, keystroke, and decision the player makes.
- **Faster Traversal:** Calibration applies a temporary player speed boost so the setup phase is quick instead of feeling like a slow empty level.
- **Goal:** To establish a baseline profile of whether the player naturally explores every room (`explorer`), rushes straight to the exit (`rusher`), or uses stealth/hiding mechanics frequently (`stayer`).

## 2. Telemetry Recorded
The `GameScreen` continuously monitors and records the following metrics into a `PlayerProfile`:
- **Total Moves & Time Moving:** How long the player is actively traversing the map.
- **Raw Keystrokes:** Key down/up events are stored with timestamps, then cleaned into per-key counts.
- **Movement Coordinates:** Tile coordinates are sampled with timestamps and capped before persistence to keep the stored telemetry compact.
- **Zone Dwell Time:** Time is accumulated for map zones such as spawn, center, exit, hazard, treasure, and slow-terrain zones.
- **Path Straightness:** The ratio of direct displacement to the actual distance traveled.
- **Exploration Rate:** The number of unique grid tiles visited versus the total grid size.
- **Stealth & Hiding:** Time spent in stealth states (e.g. using items like Ghost Cloak) or lingering in safe zones.
- **Combat Stats (Later floors):** Attack frequency, flee frequency, and items used.

## 3. Exiting the Calibration Round
The game engine supports map-specific physical boundaries that act as the exit trigger for the Calibration Round.

When the player steps on these boundaries or the marked exit tile, the round ends immediately and triggers `finalizeLearning()`. Defeating enemies is no longer required for completion; combat is now pressure during the route to the exit.

## 4. Preprocessing and Classification
The raw telemetry is cleaned before classification:
- Duplicate-long telemetry is capped to recent samples so persisted runs stay lightweight.
- Key events become `keystrokeCounts`.
- Zone timers produce a `dominantZone`.
- Movement coordinates are converted into average speed, path straightness, and exploration rate.

The processed profile is then passed to `classifyPlaystyle()` (located in `GeneticAlgorithm.ts`). It computes a score for five distinct labels:
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
