# EvoCracker — Game Flow

## How the Player Starts

1. **Main Menu** → Player clicks **"Trial Mode"**.
2. **Map Select** → Pick one of two hand-crafted dungeon maps (Crypt of Shadows or Lonely Lair).
3. **Character Select** → Choose 1 of 8 characters. The remaining 7 characters become your enemies in the dungeon, each using a different pathfinding algorithm (BFS, DFS, A*, etc.).
4. **Allies Select** *(optional)* → If allies have been purchased with coins, pick up to 2 to fight alongside you.
5. **Loading Screen** → The engine initializes PixiJS, loads assets, generates the dungeon, builds the pathfinding grid, spawns enemies with genomes, and starts the game loop.

---

## Calibration Round (First Run Only)

On the very first run (Floor 1, Iteration 1), **no enemies spawn**. The player explores freely with boosted movement speed. This round exists so the system can build an initial behavioral profile before evolution begins.

### How Input Is Logged

The game loop runs at ~60 FPS. Each frame, the `InputManager` captures the current state of all pressed keys and the mouse position. The main loop reads `input.getMovementVector()` (WASD/arrows → a normalized direction) to move the player, then immediately logs that frame's data into a `runTracker` object. When the player's tile position changes, the new coordinate and a `performance.now()` timestamp are pushed onto the path array. Simultaneously, `input.getState().codesJustPressed` and `codesJustReleased` are iterated and each keycode is appended to the keystroke log with its timestamp. The player's current tile is also checked against a zone map (e.g., is this tile near the exit? near a trap? in the west quadrant?) and the matching zone's dwell time counter is incremented by `dt`. All of this happens whether enemies are present or not — so the calibration round captures a full behavioral fingerprint from pure exploration.

### What Gets Tracked

Every frame, the game records:

- **Movement path** — Every tile the player steps on is logged with a timestamp. This builds a coordinate trail used to calculate speed, path straightness (displacement ÷ total distance), and exploration coverage (unique tiles ÷ total tiles).
  *→ Used to determine if the player moves in straight lines (rusher) or wanders erratically (explorer). Erratic players cause enemies to evolve higher vision genes so they can reacquire the player after losing sight.*

- **Keystrokes** — Every key press and release is captured with its timestamp. High keystroke counts (APM) signal an aggressive or reactive player.
  *→ Players with high APM trigger speed and aggression boosts in the next enemy generation — the AI assumes a fast-inputting player needs faster enemies to keep up.*

- **Zone dwell time** — The map is divided into semantic zones (spawn area, exit zone, hazard tiles, treasure rooms, compass quadrants). Time spent in each zone is accumulated per-frame.
  *→ If a player lingers near treasure, enemies evolve higher ambush tendency. If they camp the exit, enemies develop pack behavior to group up near it. Each zone bias nudges different genes.*

- **Action counters** — Attacks, items used, kills, and damage taken are all tallied.
  *→ A high attack rate classifies the player as a "fighter," causing enemies to evolve more cautiousness and speed. Low engagement signals a stealth player, pushing enemies toward persistence and wider search patterns.*

When the player reaches the exit, this telemetry is packaged into a `PlayerProfile` and the system classifies a playstyle:

| Classification | Signal |
|---------------|--------|
| **Rusher** | High speed, straight paths, low stealth |
| **Stayer** | Frequent hiding, high stealth-to-rush ratio |
| **Explorer** | High tile coverage, wandering paths |
| **Fighter** | High attack rate, low flee frequency |
| **Hybrid** | No strong signal in any direction |

---

## How the AI Gets Smarter

### The Genome

Every enemy carries a **genome** — a set of 11 genes (values between 0 and 1) that control its behavior at runtime:

- `speed`, `vision`, `aggression`, `persistence`, `cautiousness`
- `packTendency`, `ambushTendency`, `patrolVariance`
- `algorithmWeights` — a probability distribution across all 8 pathfinding algorithms

These genes are not cosmetic. They directly scale the enemy's actual movement speed, detection range, chase duration, and which search algorithm it uses to pathfind toward the player.

### Fitness Evaluation

When a round ends (player dies or reaches the exit), **every enemy that spawned gets a fitness score** based on how well it performed:

```
Fitness = (time player was visible × 0.3)
        + (damage dealt to player × 2.0)
        + (times detected player  × 1.5)
        + (survival time          × 0.2)
        + (area covered           × 0.4)
        - (time stuck             × 1.0)
        + (cooperative kills      × 2.5)
```

This score is then multiplied by a **playstyle-adaptive bonus**. For example, if the player is classified as a "rusher," enemies with high `speed` genes get a fitness boost — rewarding the traits most effective against that playstyle.

### Evolution Between Rounds

The population of genomes goes through a standard Genetic Algorithm cycle:

1. **Elitism** — The top 10% of genomes survive unchanged into the next generation.
2. **Selection** — Parents are chosen via tournament selection (pick 3 random genomes, keep the fittest).
3. **Crossover** — Two parents produce a child by blending genes (either per-gene coin flip or fitness-weighted averaging).
4. **Mutation** — Each gene has a 15% chance of being nudged by Gaussian noise (σ = 0.2). Algorithm weights can also swap.
5. **Playstyle Bias** — Small directional nudges are applied based on the player's profile:
   - Rusher → enemies get faster, favor A* and Greedy BFS
   - Stayer → enemies get more persistent, favor BFS and IDS
   - Explorer → enemies develop higher pack tendency
   - Fighter → enemies get more cautious and slightly faster
   - High APM → enemies get speed and aggression boosts
   - Erratic movement → enemies get better vision

### Difficulty Scaling

After each round, the global difficulty multiplier increases:

```
nextDifficulty = currentDifficulty + 0.08 + (fitnessPerformance × 0.22)
```

This scales enemy stats (HP, damage, speed, vision) on top of the genome-driven improvements. The cap is x3.0.

### The Result

Each iteration, enemies spawn with the **evolved genomes** from the previous round. Over multiple runs, enemies progressively:
- Shift toward the pathfinding algorithms most effective against the player
- Develop gene combinations that counter the player's specific habits
- Coordinate better (pack tendency rises if the player struggles against groups)
- Cover more ground and detect the player faster

The AI Analytics panel (press `` ` ``) shows this evolution in real-time: fitness curves, gene averages, algorithm distribution shifts, and strength index growth across iterations.

---

## Round Lifecycle (Summary)

```
Main Menu → Map Select → Character Select → [Allies Select] → Loading
    ↓
Calibration Round (no enemies, telemetry only)
    ↓
Gameplay: Move, fight, collect, survive
    ↓
Round ends (exit reached OR player dies)
    ↓
Telemetry → Player Profile → Fitness Scoring → Genetic Algorithm → Evolved Population
    ↓
Next round spawns with evolved enemies + higher difficulty
    ↓
Repeat (population adapts more each cycle)
```
