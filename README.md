# 🏰 Project AlchEx: The Summoner's Trial

> **An AI-first, web-based top-down 2D dungeon stealth/strategy game**  
> Built with React + Vite + PixiJS v8 + TypeScript  
> Core focus: Search Algorithms, Genetic Evolution, Behavior Trees

---

## What is this?

AlchEx is an **AI research project** wrapped in a game. Every enemy is powered by a real search algorithm. Between floors, a Genetic Algorithm evolves the enemy population to counter your playstyle. A real-time Analytics Overlay lets you watch the AI think.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:5173
```

**Controls:**
| Key | Action |
|-----|--------|
| `WASD` / Arrow Keys | Move |
| `` ` `` (backtick) | Toggle AI Analytics Overlay |
| `E` | Interact |
| `TAB` | Inventory |
| `ESC` | Pause |

---

## Project Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ Complete | Project scaffold, tooling, design system |
| **Phase 1** | ✅ Complete | Core engine — ECS, camera, input, tilemap, dungeon |
| **Phase 2** | ✅ Complete | AI algorithms — All 8 search algos + BT engine |
| **Phase 3** | ✅ Complete | Genetic evolution — Genome, GA, player profiler |
| **Phase 4** | ✅ Complete | Analytics overlay — 5-tab real-time AI dashboard |
| **Phase 5** | 🔲 Pending | Game content — enemies, items, modes, combat |
| **Phase 6** | 🔲 Pending | Visual polish — sprite sheets, animations, effects |
| **Phase 7** | 🔲 Pending | Supabase backend — genomes, leaderboard, auth |
| **Phase 8** | 🔲 Optional | Neural net stretch goal — Q-Learning, TF.js heuristic |

---

## Architecture

```
src/
├── ai/                    # 🧠 ALL AI SYSTEMS
│   ├── pathfinding/       # 8 search algorithms + grid + heuristics
│   ├── behavior/          # Behavior Tree engine (Selector/Sequence/Action)
│   └── evolution/         # Genetic Algorithm (Genome, GA, Player Profiler)
├── core/                  # Engine fundamentals
│   ├── ecs/               # Entity-Component-System (World.ts)
│   ├── Camera.ts
│   ├── InputManager.ts
│   └── EventBus.ts
├── game/                  # Game-specific logic
│   └── world/             # DungeonGenerator (BSP), TileMap
├── ui/                    # React UI
│   ├── screens/           # MainMenu, GameScreen, AlgorithmLab, Settings
│   ├── hud/               # PlayerHUD
│   └── analytics/         # AIAnalyticsPanel (5-tab real-time dashboard)
├── store/                 # Zustand global state
└── utils/                 # Constants, math, random, PriorityQueue
```

---

## AI Systems Implemented

### Search Algorithms (all from scratch)

| Algorithm | Enemy | Complexity | Status |
|-----------|-------|------------|--------|
| BFS | Slime | O(V+E) | ✅ |
| DFS | Bat | O(V+E) | ✅ |
| IDS | Inquisitor | O(b^d) | ✅ |
| DLS | Leashed Guard | O(b^ℓ) | ✅ |
| UCS | Royal Knight | O(V log V) | ✅ |
| A* | Assassin | O(E log V) | ✅ |
| Greedy BFS | Goblin | O(b^m) | ✅ |
| Hill Climbing | Archer | O(neighbors) | ✅ |

### Genetic Algorithm
- **Genome**: 11 genes — speed, vision, aggression, persistence, cautiousness, pack tendency, ambush tendency, patrol variance, + algorithm weights
- **Selection**: Tournament + Roulette Wheel + Elitism (top 10%)
- **Crossover**: Uniform + Weighted Average (fitness-proportional blending)
- **Mutation**: Gaussian (adaptive σ) + Algorithm Swap
- **Fitness**: `F = (visibility × 0.3) + (damage × 2.0) + (detections × 1.5) + (survival × 0.2) + (coverage × 0.4) - (stuck × 1.0) + (coop_kills × 2.5)`

### Behavior Trees
- **Nodes**: Selector (OR), Sequence (AND), Inverter, Repeater, Succeeder, Condition, Action, Wait
- **Blackboard**: Shared state per enemy entity
- **States**: IDLE → PATROL → INVESTIGATE → CHASE → FLEE

---

## Biomes (Multi-Level Support)

| Floor | Biome | Special Tiles |
|-------|-------|--------------|
| 1 | Dungeon | Stone, Mud, Traps |
| 2 | Cave | Water pools, narrow corridors |
| 3 | Forest | Grass, Sand |
| 4 | Castle | Stone halls, guard posts |
| 5 | Lake | Bridges, water |
| 6 | Ruins | Crumbling stone, traps |
| 7+ | Loops | Increasing difficulty |

---

## For Contributors (GitHub Handoff)

### Phase 5 — Next Up
**File to start:** `src/game/entities/enemies/EnemyBase.ts`

Tasks:
1. Create `EnemyBase` class wiring up `AIComponent`, `BehaviorTree`, and `Genome`
2. Implement 8 enemy archetypes in `src/game/entities/enemies/`
3. Wire pathfinding: enemy requests path → Algorithm Registry → Web Worker → update movement
4. Add `CombatSystem`, `VisionSystem`, `StealthSystem` in `src/game/systems/`
5. Add items in `src/game/entities/items/`

### Phase 6 — Art Assets
- Source free CC0 tilesets from itch.io (32×32 pixel art)
- Generate enemy sprites using AI image generation (walk, idle, attack, death frames)
- Import into PixiJS as spritesheets using `Assets.load()`

### Phase 7 — Supabase (Free Tier)
- Create project at supabase.com (completely free, no credit card)
- Copy SQL from `docs/SUPABASE_SCHEMA.sql`
- Add env vars to `.env`:
  ```
  VITE_SUPABASE_URL=your_url
  VITE_SUPABASE_ANON_KEY=your_key
  ```

---

## Tech Stack

| Tech | Version | Purpose |
|------|---------|---------|
| React | 19 | UI shell + analytics panels |
| Vite | 8 | Dev server + bundler |
| PixiJS | v8 | 2D game rendering |
| TypeScript | 5+ | Type safety |
| Zustand | Latest | Global state management |
| Howler.js | Latest | Sound effects + music |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/ai/pathfinding/AlgorithmRegistry.ts` | Strategy pattern — run any algorithm by type |
| `src/ai/pathfinding/algorithms/AStar.ts` | A* implementation with pluggable heuristic |
| `src/ai/evolution/GeneticAlgorithm.ts` | Full GA engine — selection, crossover, mutation |
| `src/ai/behavior/BehaviorTree.ts` | BT engine — all node types |
| `src/game/world/DungeonGenerator.ts` | BSP dungeon generation |
| `src/store/gameStore.ts` | Zustand state (screens, GA data, analytics) |
| `src/ui/analytics/AIAnalyticsPanel.tsx` | 5-tab real-time AI analytics overlay |

---

*Press `` ` `` in-game to open the AI Analytics panel.*
