# EvoCracker — Architecture Diagrams

This document contains UML architecture diagrams for the EvoCracker project, rendered using Mermaid syntax.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Browser["Browser Runtime"]
        subgraph UI["UI Layer - React"]
            MainMenu["MainMenu"]
            CharSelect["CharacterSelectScreen"]
            MapSelect["MapSelectScreen"]
            GameScreen["GameScreen"]
            AlgoLab["AlgorithmLabScreen"]
            Settings["SettingsScreen"]
            Leaderboard["LeaderboardScreen"]
        end

        subgraph HUD["HUD and Analytics - React Overlay"]
            PlayerHUD["PlayerHUD"]
            AIPanel["AIAnalyticsPanel"]
            MusicPlayer["MusicPlayer"]
        end

        subgraph Core["Core Engine"]
            EventBus["EventBus"]
            InputMgr["InputManager"]
            Camera["Camera"]
            SpriteFactory["SpriteFactory"]
            AssetLoader["AssetLoader"]
            TilesetLoader["DungeonTilesetLoader"]
        end

        subgraph ECS["Entity-Component-System"]
            World["World - Entity Manager"]
            Components["Components"]
            Systems["Systems"]
        end

        subgraph AI["AI Pipeline"]
            BT["BehaviorTree"]
            GA["GeneticAlgorithm"]
            Pathfinding["AlgorithmRegistry"]
            PFWorker["PathfindingWorker"]
        end

        subgraph Game["Game Layer"]
            DungeonGen["DungeonGenerator"]
            TilemapRenderer["TilemapRenderer"]
            EnemyBase["EnemyBase"]
            Archetypes["Archetypes - 8 types"]
            ItemSystem["ItemSystem"]
            VisionSystem["VisionSystem"]
        end

        subgraph Store["State Management"]
            Zustand["Zustand Store - gameStore"]
        end
    end

    subgraph Cloud["Cloud Backend"]
        Supabase["Supabase"]
        DB["PostgreSQL DB"]
    end

    UI -->|"actions"| Game
    UI -->|"subscribe"| Zustand
    Core -->|"events/input"| Game
    AI -->|"commands"| Game
    Game -->|"queries"| AI
    Game -->|"read/write"| Zustand
    AI -->|"read/write"| Zustand
    HUD -->|"subscribe"| Zustand
    Store -->|"sync"| Cloud
    Supabase --- DB
```

---

## 2. AI Subsystem — Class Diagram

```mermaid
classDiagram
    class Genome {
        +string id
        +number generation
        +number speed
        +number vision
        +number aggression
        +number persistence
        +number cautiousness
        +number packTendency
        +number ambushTendency
        +number patrolVariance
        +number[] algorithmWeights
        +number fitness
        +boolean alive
    }

    class PlayerProfile {
        +string playstyle
        +number averageSpeed
        +number explorationRate
        +number hidingFrequency
        +number engagementRate
        +number fleeFrequency
        +number pathStraightness
        +object rawKeystrokes
        +object movementCoordinates
        +object timeSpentInZones
        +object cleanedTelemetry
    }

    class GeneticAlgorithm {
        +createRandomGenome(gen) Genome
        +createPlayerProfile() PlayerProfile
        +classifyPlaystyle(profile) string
        +calculateFitness(metrics, genome, profile) number
        +evolvePopulation(pop, profile) Result
        +tournamentSelection(pop) Genome
        +rouletteSelection(pop) Genome
        +uniformCrossover(p1, p2) Genome
        +weightedAverageCrossover(p1, p2) Genome
        +mutateGenome(genome) Genome
        +applyPlaystyleBias(pop, profile) void
        +getPreferredAlgorithm(genome) AlgorithmType
    }

    class BehaviorTree {
        +BTNode root
        +Blackboard blackboard
        +tick() Status
    }

    class BTNode {
        <<abstract>>
        +tick(bb) Status
    }

    class Selector {
        +BTNode[] children
    }

    class Sequence {
        +BTNode[] children
    }

    class Condition {
        +Function check
    }

    class ActionNode {
        +Function action
    }

    class AlgorithmRegistry {
        +runAlgorithm(type, grid, start, goal) SearchResult
        +getAlgorithmInfo(type) AlgoInfo
    }

    class SearchResult {
        +GridCoord[] path
        +number nodesExpanded
        +number nodesVisited
        +number timeMs
        +boolean success
        +GridCoord[] expansionOrder
    }

    BTNode <|-- Selector
    BTNode <|-- Sequence
    BTNode <|-- Condition
    BTNode <|-- ActionNode
    BehaviorTree *-- BTNode
    GeneticAlgorithm ..> Genome : creates and evolves
    GeneticAlgorithm ..> PlayerProfile : classifies
    AlgorithmRegistry ..> SearchResult : returns
```

---

## 3. Game Entities — Class Diagram

```mermaid
classDiagram
    class EnemyBase {
        +number tileX
        +number tileY
        +number health
        +number maxHealth
        +number speed
        +number visionRange
        +number attackDamage
        +Genome genome
        +EnemyType type
        +AlertState alertState
        +Container container
        +GameSprite gameSprite
        +Performance performance
        +update(dt, playerPos, grid) void
        +requestPath(target) void
        +takeDamage(amount) void
        +applyDifficulty(level) void
        +getAnalyticsSnapshot() EnemyAnalyticsData
    }

    class Archetypes {
        +createEnemy(type, x, y, genome) EnemyBase
        +getEnemyTypesForFloor(floor) EnemyType[]
    }

    class ItemSystem {
        +createDefaultItemLoadout() Item[]
        +updateItems(player, dt) void
    }

    class VisionSystem {
        +updateVision(enemy, player, grid) void
    }

    class DungeonGenerator {
        +generateDungeon(w, h, floor, biome, mapId) DungeonData
        +getBiomeForFloor(floor) BiomeType
    }

    class DungeonData {
        +number[][] tiles
        +number width
        +number height
        +Point spawnPoint
        +Point exitPoint
        +Point[] enemySpawnPoints
        +Room[] rooms
        +BiomeType biome
        +TiledLayerData[] tiledLayers
    }

    class TilemapRenderer {
        +renderTilemap(container, tiles, w, h, layers, gid) TilemapAnimRuntime
        +updateInteractiveTileAnimations(runtime, dt) void
        +renderMarkers(container, dungeon) void
    }

    EnemyBase --> Archetypes : created by
    DungeonGenerator --> DungeonData : produces
    TilemapRenderer --> DungeonData : renders
    EnemyBase --> VisionSystem : uses
```

---

## 4. Core Engine — Class Diagram

```mermaid
classDiagram
    class EventBus {
        -Map listeners
        +on(event, callback) Unsubscribe
        +emit(event, data) void
        +getInstance() EventBus
    }

    class InputManager {
        -Set keysDown
        -Set keysJustPressed
        +init() void
        +isKeyDown(key) boolean
        +isKeyJustPressed(key) boolean
        +getMovementVector() Vec2
        +endFrame() void
        +getInstance() InputManager
    }

    class Camera {
        +number x
        +number y
        +number zoom
        +number viewportWidth
        +number viewportHeight
        +update(targetX, targetY, dt) void
        +snapTo(x, y) void
        +setWorldBounds(w, h) void
        +getVisibleBounds() Rect
        +screenToWorld(sx, sy) Point
        +worldToScreen(wx, wy) Point
    }

    class SpriteFactory {
        +initSpriteAssets() Promise
        +createPlayerSprite(charIndex) GameSprite
        +createCharacterEnemySprite(charIndex) GameSprite
    }

    class GameSprite {
        +Container container
        +setAnimation(name) void
        +setFlipX(flip) void
        +updateHealthBar(current, max) void
    }

    class World {
        +createEntity() number
        +addComponent(entity, type, data) void
        +removeComponent(entity, type) void
        +query(mask) Entity[]
        +destroyEntity(entity) void
    }

    class Grid {
        +number width
        +number height
        +setTile(x, y, type) void
        +getNode(x, y) GridNode
        +getNeighbors(node, diagonal) GridNode[]
        +serialize() SerializedGrid
    }

    SpriteFactory ..> GameSprite : creates
    World --> EventBus : emits events
```

---

## 5. Enemy AI — State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> PATROL : No threat detected
    PATROL --> IDLE : Patrol complete

    IDLE --> INVESTIGATE : Heard noise or lost sight
    PATROL --> INVESTIGATE : Heard noise or lost sight

    INVESTIGATE --> CHASE : Player detected via FOV raycast
    INVESTIGATE --> PATROL : Investigation timeout

    CHASE --> ATTACK : Player in attack range
    CHASE --> INVESTIGATE : Lost line of sight
    CHASE --> FLEE : Health below threshold

    ATTACK --> CHASE : Player moved out of range
    ATTACK --> FLEE : Health below threshold

    FLEE --> IDLE : Safe distance reached
    FLEE --> CHASE : Health recovered and high aggression

    note right of IDLE : Genome genes control thresholds\nAggression controls chase vs flee\nPersistence controls investigation duration\nCautiousness controls flee threshold\nPatrolVariance controls route randomness

    note right of CHASE : Pathfinding algorithm selected\nvia genome algorithmWeights\nusing weighted random sampling
```

---

## 6. Game Loop — Sequence Diagram (Single Frame)

```mermaid
sequenceDiagram
    participant Ticker as PixiJS Ticker
    participant Input as InputManager
    participant Player as PlayerSystem
    participant AI as AISystem and BehaviorTree
    participant PF as PathfindingClient
    participant Move as MovementSystem
    participant Combat as CombatSystem
    participant FOV as VisionSystem
    participant Render as RenderSystem
    participant Store as Zustand Store

    Ticker->>Input: Poll keyboard and mouse state
    Input->>Player: getMovementVector()
    Player->>Move: Update player target tile
    AI->>AI: Tick BehaviorTree for each enemy
    AI->>PF: requestPath(start, goal, algorithm)
    PF-->>AI: path result via Web Worker
    AI->>Move: Set enemy movement target
    Move->>Move: Lerp positions and collision check
    Move->>Combat: Check attack range overlaps
    Combat->>Combat: Apply damage and cooldowns
    Combat->>Store: setPlayerHealth() and addScore()
    FOV->>FOV: Raycast FOV per enemy
    FOV->>AI: Update enemy alertState
    Render->>Render: Sync sprite positions and animations
    Render->>Store: setFps() and setEnemyAnalytics()
```

---

## 7. Genetic Algorithm Evolution — Sequence Diagram

```mermaid
sequenceDiagram
    participant Player as Player
    participant Game as GameScreen
    participant Profiler as PlayerProfiler
    participant GA as GeneticAlgorithm
    participant Store as Zustand Store
    participant Supabase as SupabaseService

    Player->>Game: Reaches exit tile or Dies
    Game->>Profiler: Finalize telemetry
    Profiler->>Profiler: Clean keystrokes and zone time and path data
    Profiler->>Profiler: classifyPlaystyle() returns rusher stayer explorer fighter hybrid
    Game->>GA: calculateFitness() for each enemy genome
    GA->>GA: tournamentSelection() selects parents
    GA->>GA: uniformCrossover() creates children
    GA->>GA: mutateGenome() applies Gaussian mutation
    GA->>GA: applyPlaystyleBias() counters player style
    GA->>GA: computeGenerationStats()
    GA-->>Game: newPopulation and stats
    Game->>Store: completeIterationLearning(payload)
    Store->>Store: Persist to localStorage
    Game->>Supabase: updateLeaderboard()
    Game->>Supabase: logEvolutionRun()
    Game->>Supabase: saveEliteGenome() if fitness above 90
    Game->>Game: Respawn with evolved population
```

---

## 8. Screen Navigation Flow

```mermaid
flowchart LR
    A["MainMenu"] -->|"Play"| B["CharacterSelectScreen"]
    B -->|"Select and Continue"| C["MapSelectScreen"]
    C -->|"Select and Enter"| D["LoadingScreen"]
    D -->|"Assets loaded"| E["GameScreen"]
    E -->|"Floor 1 Iter 1"| F["Calibration Round\nNo enemies"]
    F -->|"Reach exit"| G["Calibration Overlay\n1.5s"]
    G -->|"Load Level 1"| H["Combat Floor\nEnemies spawned"]
    H -->|"Reach exit"| I["GA Evolution"]
    I -->|"Next iteration"| H
    H -->|"Player dies"| J["Death Screen"]
    J -->|"5s timeout"| A
    E -->|"Escape then Pause"| K["Pause Overlay"]
    K -->|"Main Menu"| A
    A -->|"Algorithm Lab"| L["AlgorithmLabScreen"]
    A -->|"Settings"| M["SettingsScreen"]
    A -->|"Leaderboard"| N["LeaderboardScreen"]
```
