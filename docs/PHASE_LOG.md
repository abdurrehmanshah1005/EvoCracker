# Phase Completion Log

Track what was done in each phase, by whom, and when.
Anyone picking this up from GitHub should read this first.

## Evaluator Phase Map

These are the current deliverables using the evaluator's phase wording:

- **Phase 1: The Plan** — documented in `docs/PHASE_1_DOCUMENTATION.md`.
- **Phase 2: The Setup** — documented in `docs/PHASE_2_SETUP.md`; calibration records keystrokes, movement coordinates, and zone dwell time.
- **Phase 3: The Code** — documented in `docs/PHASE_3_CODE.md`; covers pathfinding, Behavior Trees, and the GA loop.
- **Phase 4: The Proof** — documented in `docs/PHASE_4_PROOF.md`; covers fitness graphs and pathfinding runtime comparison.
- **Phase 5: The Game** — documented in `docs/PHASE_5_GAME.md`; covers the playable web app, dashboard, and hosting checklist.
- **Phase 6: The Report** — documented in `docs/PHASE_6_REPORT.tex`; contains architectural updates and bug resolutions.

---

## ✅ Phase 0 — Project Scaffold & Tooling
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- Initialized Vite + React + TypeScript project
- Installed: `pixi.js`, `@pixi/react`, `@pixi/tilemap`, `zustand`, `howler`, `react-router-dom`, `@vitejs/plugin-react`
- Configured TypeScript strict mode + path aliases (`@/`, `@core/`, `@ai/`, `@game/`, `@ui/`, `@store/`, `@utils/`)
- Created complete folder structure (see README.md)
- Set up design system (`src/styles/index.css`) — dark fantasy palette, typography, animations
- Google Fonts: Inter (UI), Press Start 2P (pixel headers), Cinzel (fantasy titles)

### Files created
- `vite.config.ts` — Vite + React + path aliases + web worker support
- `tsconfig.json` — TypeScript strict + JSX + path aliases
- `index.html` — Google Fonts, meta tags
- `src/main.tsx` — React entry point
- `src/App.tsx` — Screen router (Zustand-driven)
- `src/styles/index.css` — Full design system

---

## ✅ Phase 1 — Core Game Engine
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- **ECS Framework** (`src/core/ecs/World.ts`) — Entity, Component types, System base class, World with queries, deferred destruction
- **EventBus** (`src/core/EventBus.ts`) — Pub/sub singleton with typed game event constants
- **InputManager** (`src/core/InputManager.ts`) — WASD + arrow keys, mouse tracking, movement vector, end-frame cleanup
- **Camera** (`src/core/Camera.ts`) — Smooth lerp follow, deadzone, world bounds clamping, screen↔world↔tile coordinate conversions, viewport culling
- **DungeonGenerator** (`src/game/world/DungeonGenerator.ts`) — BSP tree procedural generation, 6 biomes (dungeon, cave, forest, castle, lake, ruins), L-shaped corridors, terrain variety (mud/water/traps), entity placement
- **GameScreen** (`src/ui/screens/GameScreen.tsx`) — PixiJS Application init, tilemap rendering, player movement + collision, camera follow, analytics toggle
- **PlayerHUD** (`src/ui/hud/PlayerHUD.tsx`) — Health bar, floor info, score, FPS, generation display

### Files created
- `src/core/ecs/World.ts`
- `src/core/EventBus.ts`
- `src/core/InputManager.ts`
- `src/core/Camera.ts`
- `src/game/world/DungeonGenerator.ts`
- `src/ui/screens/GameScreen.tsx`
- `src/ui/hud/PlayerHUD.tsx`
- `src/ui/screens/AlgorithmLabScreen.tsx` (placeholder)
- `src/ui/screens/SettingsScreen.tsx`

---

## ✅ Phase 2 — AI Algorithm Suite
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- Built ALL 8 search algorithms completely from scratch (no pathfinding libraries)
- Every algorithm captures `expansionOrder` list for real-time visualization
- **Grid** (`src/ai/pathfinding/Grid.ts`) — GridNode with full search state, 4/8-directional neighbors, serialization for web workers
- **Heuristics** (`src/ai/pathfinding/heuristics.ts`) — Manhattan, Euclidean, Octile, Chebyshev, Zero, Anti-Manhattan (for Scroll of Confusion item)
- **BFS** — Queue-based, Slime's "ooze" pattern
- **DFS** — Stack-based with visited set, Bat's tunnel scouting
- **IDS** — Recursive DLS with increasing depth, Inquisitor's room-clearing
- **DLS** — Depth-limited stack, Leashed Guard's patrol radius
- **UCS** — Binary heap priority queue, Royal Knight's weighted terrain navigation
- **A\*** — Binary heap + pluggable heuristic, Assassin's optimal pursuit
- **Greedy BFS** — h-only priority, Goblin's reckless charge
- **Hill Climbing** — Local vantage score optimization, Archer's positioning
- **AlgorithmRegistry** — Strategy pattern entry point + academic info per algorithm
- **Behavior Tree** (`src/ai/behavior/BehaviorTree.ts`) — Selector, Sequence, Inverter, Repeater, Succeeder, Condition, Action, Wait nodes + Blackboard

### Files created
- `src/ai/pathfinding/Grid.ts`
- `src/ai/pathfinding/heuristics.ts`
- `src/ai/pathfinding/algorithms/BFS.ts`
- `src/ai/pathfinding/algorithms/DFS.ts`
- `src/ai/pathfinding/algorithms/IDS.ts`
- `src/ai/pathfinding/algorithms/DLS.ts`
- `src/ai/pathfinding/algorithms/UCS.ts`
- `src/ai/pathfinding/algorithms/AStar.ts`
- `src/ai/pathfinding/algorithms/GreedyBFS.ts`
- `src/ai/pathfinding/algorithms/HillClimbing.ts`
- `src/ai/pathfinding/AlgorithmRegistry.ts`
- `src/ai/behavior/BehaviorTree.ts`
- `src/utils/PriorityQueue.ts` (binary heap — used by UCS, A*, Greedy BFS)

---

## ✅ Phase 3 — Genetic Evolution System ("The Cracker")
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- **Genome** — 11 genes (speed, vision, aggression, persistence, cautiousness, packTendency, ambushTendency, patrolVariance, algorithmWeights[8])
- **PlayerProfiler** — Tracks speed, stealth ratio, exploration rate, combat patterns; classifies into rusher/stayer/explorer/fighter/hybrid
- **Fitness Function** — Multi-factor weighted formula with playstyle-adaptive bonuses
- **Selection** — Tournament, Roulette Wheel, Elitism (top 10% survive unchanged)
- **Crossover** — Uniform (per-gene coin flip) and Weighted Average (fitness-proportional blending)
- **Mutation** — Gaussian noise with adaptive σ, Algorithm Swap mutation
- **Playstyle Bias** — Evolution steers toward countering the player's specific playstyle
- **Generation Stats** — avg/max/min/median fitness, diversity index, dominant algorithm, gene averages

### Files created
- `src/ai/evolution/GeneticAlgorithm.ts`

---

## ✅ Phase 4 — AI Analytics Overlay (Phases 0-4 bundled)
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- **AIAnalyticsPanel** — Slide-in right panel, toggleable with backtick `` ` `` key
- **Tab 1 (Algorithms)** — All 8 algorithms with academic info: time/space complexity, optimality, completeness, enemy archetype, description; active enemy list
- **Tab 2 (Genomes)** — Per-genome chromosome bar visualization with gene values 0-100%
- **Tab 3 (Evolution)** — Generation stats, fitness min/max/avg, diversity index, dominant algorithm, mini bar chart of fitness over generations
- **Tab 4 (Player)** — Playstyle classification, behavioral metrics radar-style bars
- **Tab 5 (Performance)** — FPS, enemy count, renderer info

### Files created
- `src/ui/analytics/AIAnalyticsPanel.tsx`
- `src/store/gameStore.ts` (Zustand — all game state)
- `src/utils/constants.ts` (all enums, algorithm colors)
- `src/utils/math.ts`
- `src/utils/random.ts`
- `src/ui/screens/MainMenu.tsx` (animated particle background)

---

## ✅ Phase 5 — Game Content & Modes
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- **Enemy Archetypes** (`src/game/entities/enemies/Archetypes.ts`) — Implemented all 8 archetypes (Slime, Bat, etc.) with custom AI behaviors.
- **Combat System** — Integrated health, damage, and death logic.
- **Vision System** (`src/game/systems/VisionSystem.ts`) — Raycasting-based FOV and alert states.
- **Items** (`src/game/entities/items/ItemSystem.ts`) — Fully functional items (Smoke Bomb, Ghost Cloak, etc.) that affect AI logic.
- **Trial Mode** — Floor progression, difficulty scaling, and between-floor evolution.

---

## ✅ Phase 6 — Visual Polish & Assets
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- **Asset Integration** — Loaded and integrated the 2D Pixel Dungeon Asset Pack.
- **Animated Sprites** — Replaced all Graphics placeholders with high-quality animated sprites for player and all enemies.
- **Feedback Effects** — Added exclamation mark alerts and "startle" jumps when enemies detect the player.

---

## ✅ Phase 7 — Supabase Backend
**Status:** COMPLETE  
**Date:** April 2026

### What was done
- **Supabase Integration** — Installed `@supabase/supabase-js` and configured the client.
- **Leaderboard** — Global leaderboard with real-time updates for high scores and floor reached.
- **Evolution Logging** — Every generation's stats and elite genomes are automatically logged for research analysis.
- **Auth/Profile** — Anonymous player profiling to track progress across sessions.

---

## 🔲 Phase 8 — Neural Net (Stretch Goal)
**Status:** OPTIONAL

- Q-Learning agent in `src/ai/rl/QLearningAgent.ts`
- TF.js heuristic in `src/ai/rl/NeuralHeuristic.ts`
- Comparison in Algorithm Lab sandbox mode
