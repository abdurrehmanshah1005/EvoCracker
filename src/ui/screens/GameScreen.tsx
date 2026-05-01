// ========================
// GameScreen — REWRITTEN with working combat, enemy AI, clear visuals,
// and fixed React StrictMode support
// ========================

import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle, Sprite, AnimatedSprite } from 'pixi.js';
import { useGameStore, type IterationProofData } from '@store/gameStore';
import { InputManager } from '@core/InputManager';
import { Camera } from '@core/Camera';
import { Grid } from '@ai/pathfinding/Grid';
import { PathfindingClient } from '@ai/worker/PathfindingClient';
import { SupabaseService } from '@services/SupabaseService';
import { generateDungeon, getBiomeForFloor, type TiledLayerData } from '@game/world/DungeonGenerator';
import { TILE_SIZE, TileType, GRID_COLS, GRID_ROWS, ALGORITHM_COLORS, AlertState, EnemyType, AlgorithmType } from '@utils/constants';
import { AIAnalyticsPanel } from '@ui/analytics/AIAnalyticsPanel';
import { PlayerHUD } from '@ui/hud/PlayerHUD';
import { createPlayerSprite, initSpriteAssets, CHARACTER_DEFS, createCharacterEnemySprite } from '@core/SpriteFactory';
import { createEnemy, getEnemyTypesForFloor } from '@game/entities/enemies/Archetypes';
import { updateVision } from '@game/systems/VisionSystem';
import { createDefaultItemLoadout, updateItems, type PlayerState } from '@game/entities/items/ItemSystem';
import {
  createRandomGenome,
  createPlayerProfile,
  classifyPlaystyle,
  calculateFitness,
  evolvePopulation,
  getPreferredAlgorithm,
  type Genome,
  type PlayerProfile,
} from '@ai/evolution/GeneticAlgorithm';
import { EventBus, GameEvents } from '@core/EventBus';
import type { EnemyBase } from '@game/entities/enemies/EnemyBase';
import { randomInt } from '@utils/random';
import { loadTileset, isTilesetLoaded, getTileTexture, getWallTexture, loadItemAnimations, getTiledTileTexture, isTiledTilesetLoaded, getTiledTileAnimation, stripTiledFlipFlags } from '@core/DungeonTilesetLoader';

const MAX_INTELLIGENCE_RUNS = 1;

// Temporary balancing mode for validating GA evolution without getting stuck on run 1.
const TEMP_EASY_GA_TEST_MODE = false;
const EASY_PLAYER_HEALTH = 260;
const EASY_PLAYER_ATTACK_DAMAGE = 36;
const EASY_PLAYER_ATTACK_COOLDOWN = 0.32;
const EASY_PLAYER_MOVE_SPEED = 260;
const EASY_ENEMY_DAMAGE_SCALE = 0.45;
const EASY_ENEMY_SPEED_SCALE = 0.75;
const EASY_ENEMY_VISION_SCALE = 0.82;
const EASY_ENEMY_HEALTH_SCALE = 0.62;
const LARGE_MAP_ID = 'forest_ruins';
const LARGE_MAP_CAMERA_ZOOM = 0.82;
const LARGE_MAP_CHARACTER_SCALE = 1.08;
const LARGE_MAP_PLAYER_SPEED_MULTIPLIER = 1.12;
const LARGE_MAP_ENEMY_SPEED_MULTIPLIER = 1.08;
const CALIBRATION_PLAYER_SPEED_MULTIPLIER = 1.45;
const SPRINT_SPEED_MULTIPLIER = 1.55;
const SPRINT_DRAIN_PER_SECOND = 0.34;
const SPRINT_RECHARGE_DELAY_SECONDS = 30;

const PROOF_GENE_KEYS = [
  'speed',
  'vision',
  'aggression',
  'persistence',
  'cautiousness',
  'packTendency',
  'ambushTendency',
  'patrolVariance',
] as const;

function averageGenomeGenes(genomes: Genome[]): Record<string, number> {
  const averages: Record<string, number> = {};
  for (const gene of PROOF_GENE_KEYS) {
    averages[gene] = genomes.length
      ? genomes.reduce((sum, genome) => sum + genome[gene], 0) / genomes.length
      : 0;
  }
  return averages;
}

function averageGenomeFitness(genomes: Genome[]): number {
  return genomes.length
    ? genomes.reduce((sum, genome) => sum + (genome.fitness || 0), 0) / genomes.length
    : 0;
}

function calculateStrengthIndex(genes: Record<string, number>, difficulty: number): number {
  const geneScore =
    (genes.speed || 0) * 20
    + (genes.vision || 0) * 18
    + (genes.aggression || 0) * 18
    + (genes.persistence || 0) * 16
    + (genes.cautiousness || 0) * 10
    + (genes.packTendency || 0) * 8
    + (genes.ambushTendency || 0) * 5
    + (genes.patrolVariance || 0) * 5;

  return geneScore * Math.max(1, difficulty);
}

function averageEnemyMetric(enemies: EnemyBase[], read: (enemy: EnemyBase) => number): number {
  return enemies.length ? enemies.reduce((sum, enemy) => sum + read(enemy), 0) / enemies.length : 0;
}

function enemyTypeForCharacterName(name: string): EnemyType | null {
  const normalized = name.toLowerCase();
  return (Object.values(EnemyType).find((type) => type.toLowerCase() === normalized) as EnemyType | undefined) ?? null;
}

// ===== TILE COLORS — High contrast ==========================
const TILE_COLORS: Record<number, number> = {
  [TileType.FLOOR_STONE]: 0x3a3a52,
  [TileType.WALL]: 0x111118,
  [TileType.FLOOR_MUD]: 0x5a4420,
  [TileType.FLOOR_WATER]: 0x1a4070,
  [TileType.FLOOR_TRAP]: 0x6a1818,
  [TileType.DOOR]: 0x6a5a30,
  [TileType.STAIRS_DOWN]: 0x20aa50,
  [TileType.STAIRS_UP]: 0x3050aa,
  [TileType.TREASURE]: 0xaa8820,
  [TileType.FLOOR_GRASS]: 0x2a5a2a,
  [TileType.FLOOR_SAND]: 0x6a6a30,
  [TileType.BRIDGE]: 0x5a3a1a,
};

const WALL_TOP = 0x1a1a28;
const FLOOR_GRID_LINE = 0x2a2a40;

const CHEST_ANIM_GIDS = new Set<number>([626, 642]);
const SPEAR_TRAP_ANIM_GIDS = new Set<number>([255]);
const WOODEN_TRAPDOOR_ANIM_GIDS = new Set<number>([208, 209, 233, 234]);

const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;

import {
  type InteractiveAnimKind,
  type InteractiveTileAnim,
  type TrapdoorTileAnim,
  type TilemapAnimRuntime,
  renderTilemap,
  updateInteractiveTileAnimations,
  isPlayerOnInteractiveSpear,
  getTrapdoorAt,
  triggerTrapdoorCollapseGroup,
  markWaveSpearChunkNearExit,
  renderMarkers,
  drawDebugOverlays,
} from '@game/world/TilemapRenderer';

export function GameScreen() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const enemiesRef = useRef<EnemyBase[]>([]);
  const cleanupFnRef = useRef<(() => void) | null>(null);
  const playerDeadRef = useRef(false);
  const isPausedRef = useRef(false);
  const trapdoorDeathPendingRef = useRef(false);
  const trapdoorDeathTimerRef = useRef(0);
  const trapdoorReturnPendingRef = useRef(false);
  const trapdoorReturnTimerRef = useRef(0);
  const floorClearedRef = useRef(false);
  const floorAdvancePendingRef = useRef(false);
  const allSpawnedEnemiesRef = useRef<EnemyBase[]>([]);
  const evolvingPopulationRef = useRef<Genome[]>([]);
  const intelligenceRunRef = useRef(1);
  const generationRef = useRef(0);
  const playerVelocityRef = useRef({ x: 0, y: 0 });
  const prevPlayerTileRef = useRef({ x: 0, y: 0 });
  const sprintEnergyRef = useRef(1);
  const sprintRechargeTimerRef = useRef(0);
  const sprintHudTimerRef = useRef(0);
  const runStartTimeRef = useRef(0);
  const learningCommittedRef = useRef(false);
  const playerProfileRef = useRef<PlayerProfile>(createPlayerProfile());
  const runTrackerRef = useRef({
    path: [] as { x: number; y: number; t: number }[],
    keystrokes: [] as { code: string; key: string; type: 'down' | 'up'; t: number }[],
    visited: new Set<string>(),
    zoneTime: {} as Record<string, number>,
    attacks: 0,
    itemsUsed: 0,
    kills: 0,
    damageTaken: 0,
    startTs: 0,
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [runSeed, setRunSeed] = useState(0);
  const [intelligenceRun, setIntelligenceRun] = useState(1);
  const isLoadedRef = useRef(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isDead, setIsDead] = useState(false);
  const [showCalibrationLoading, setShowCalibrationLoading] = useState(false);
  const [sprintEnergy, setSprintEnergy] = useState(1);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Player state ref
  const playerRef = useRef({
    tileX: 0, tileY: 0,
    pixelX: 0, pixelY: 0,
    sprite: null as ReturnType<typeof createPlayerSprite> | null,
    health: 500, maxHealth: 500,
    attackCooldown: 0,
    attackDamage: 20,
    attackRange: 2,
    items: createDefaultItemLoadout(),
    kills: 0,
    state: {
      tileX: 0, tileY: 0,
      isHiding: false, stealthLevel: 0.5,
      tilePenalty: 0, tilePenaltyTimer: 0,
      isInvisible: false, invisibleTimer: 0,
    } as PlayerState,
  });

  const attackVisualRef = useRef<Graphics | null>(null);

  // Use individual selectors to avoid full-store subscription re-renders
  const currentFloor = useGameStore((s) => s.currentFloor);
  const analyticsEnabled = useGameStore((s) => s.analyticsEnabled);
  const isPaused = useGameStore((s) => s.isPaused);
  const selectedCharacter = useGameStore((s) => s.selectedCharacter);
  const selectedMap = useGameStore((s) => s.selectedMap);
  const currentDifficulty = useGameStore((s) => s.currentDifficulty);
  const iteration = useGameStore((s) => s.iteration);
  const learnedPopulation = useGameStore((s) => s.population);

  // Store action refs — these never change identity, but using refs
  // prevents initGame from being recreated when other state changes
  const storeActionsRef = useRef({
    toggleAnalytics: useGameStore.getState().toggleAnalytics,
    setDungeonData: useGameStore.getState().setDungeonData,
    setFps: useGameStore.getState().setFps,
    setEnemyAnalytics: useGameStore.getState().setEnemyAnalytics,
    setPlayerHealth: useGameStore.getState().setPlayerHealth,
    setPlayerMaxHealth: useGameStore.getState().setPlayerMaxHealth,
    addScore: useGameStore.getState().addScore,
    setScreen: useGameStore.getState().setScreen,
    togglePause: useGameStore.getState().togglePause,
    setPaused: useGameStore.getState().setPaused,
    nextFloor: useGameStore.getState().nextFloor,
    setPopulation: useGameStore.getState().setPopulation,
    setPlayerProfile: useGameStore.getState().setPlayerProfile,
    addGenerationStats: useGameStore.getState().addGenerationStats,
    completeIterationLearning: useGameStore.getState().completeIterationLearning,
  });

  const returnToMainMenu = useCallback(() => {
    isPausedRef.current = false;
    storeActionsRef.current.setPaused(false);
    storeActionsRef.current.setScreen('mainMenu');
  }, []);

  // Use refs for values used in the game loop so they don't cause re-init
  const showPathsRef = useRef(useGameStore.getState().showPaths);
  const showFOVRef = useRef(useGameStore.getState().showFOV);
  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      showPathsRef.current = s.showPaths;
      showFOVRef.current = s.showFOV;
    });
    return unsub;
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  const initGame = useCallback(async (signal: AbortSignal) => {
    if (!canvasRef.current) return;
    const isLargeMap = selectedMap === LARGE_MAP_ID;

    // Reset death/pause state
    playerDeadRef.current = false;
    isPausedRef.current = false;
    storeActionsRef.current.setPaused(false);
    floorClearedRef.current = false;
    floorAdvancePendingRef.current = false;
    trapdoorDeathPendingRef.current = false;
    trapdoorDeathTimerRef.current = 0;
    trapdoorReturnPendingRef.current = false;
    trapdoorReturnTimerRef.current = 0;
    allSpawnedEnemiesRef.current = [];
    setIsDead(false);
    playerVelocityRef.current = { x: 0, y: 0 };
    prevPlayerTileRef.current = { x: 0, y: 0 };
    sprintEnergyRef.current = 1;
    sprintRechargeTimerRef.current = 0;
    sprintHudTimerRef.current = 0;
    setSprintEnergy(1);
    runStartTimeRef.current = performance.now();
    learningCommittedRef.current = false;
    intelligenceRunRef.current = iteration;
    generationRef.current = useGameStore.getState().generation;
    playerProfileRef.current = createPlayerProfile();
    runTrackerRef.current = {
      path: [],
      keystrokes: [],
      visited: new Set<string>(),
      zoneTime: {},
      attacks: 0,
      itemsUsed: 0,
      kills: 0,
      damageTaken: 0,
      startTs: performance.now(),
    };

    // Initialize player profile in Supabase
    const username = useGameStore.getState().username;
    SupabaseService.initializePlayer(username);

    // ── Clean up any previous instance (React StrictMode fix) ────
    if (appRef.current) {
      try { appRef.current.destroy(true); } catch { /* already destroyed */ }
      appRef.current = null;
    }
    // Clear canvas children
    if (canvasRef.current) {
      while (canvasRef.current.firstChild) {
        canvasRef.current.removeChild(canvasRef.current.firstChild);
      }
    }

    try {
      const app = new Application();
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x060610,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: 'webgl'
      });

      if (signal.aborted) {
        try { app.destroy(true); } catch { /* ignore */ }
        return;
      }

      canvasRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Auto-focus canvas so keyboard events work immediately
      canvasRef.current.tabIndex = 0;
      canvasRef.current.style.outline = 'none';
      canvasRef.current.focus();

      const camera = new Camera({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        zoom: isLargeMap ? LARGE_MAP_CAMERA_ZOOM : 1.0,
        deadzoneWidth: 0,
        deadzoneHeight: 0
      });
      cameraRef.current = camera;

      const input = InputManager.getInstance();
      input.init();

      // ── Load pixel-art assets ──────────────────────────────────────
      await initSpriteAssets();
      if (signal.aborted) return;

      const itemAnims = await loadItemAnimations();
      if (signal.aborted) return;

      // ── Containers ─────────────────────────────────────────────────
      const worldContainer = new Container();
      worldContainer.label = 'world';
      worldContainer.sortableChildren = true;
      app.stage.addChild(worldContainer);

      const debugOverlay = new Graphics();
      debugOverlay.zIndex = 50;
      worldContainer.addChild(debugOverlay);

      const attackLayer = new Graphics();
      attackLayer.zIndex = 45;
      worldContainer.addChild(attackLayer);
      attackVisualRef.current = attackLayer;

      // ── Generate dungeon ──────────────────────────────────────────
      const biome = getBiomeForFloor(currentFloor);
      const dungeon = await generateDungeon(GRID_COLS, GRID_ROWS, currentFloor, biome, selectedMap);
      if (signal.aborted) return;

      await loadTileset(dungeon.tiledTilesets ?? []);
      if (signal.aborted) return;

      storeActionsRef.current.setDungeonData(dungeon);
      camera.setWorldBounds(dungeon.width * TILE_SIZE, dungeon.height * TILE_SIZE);

      // ── Pathfinding grid ──────────────────────────────────────────
      const grid = new Grid(dungeon.width, dungeon.height);
      for (let y = 0; y < dungeon.height; y++) {
        for (let x = 0; x < dungeon.width; x++) {
          grid.setTile(x, y, dungeon.tiles[y][x]);
        }
      }
      gridRef.current = grid;
      PathfindingClient.getInstance().setGrid(grid.serialize());

      // ── Render tilemap ────────────────────────────────────────────
      const tilemapAnimRuntime = renderTilemap(
        worldContainer,
        dungeon.tiles,
        dungeon.width,
        dungeon.height,
        dungeon.tiledLayers,
        dungeon.tiledFirstGid,
      );
      markWaveSpearChunkNearExit(tilemapAnimRuntime, dungeon.exitPoint.x, dungeon.exitPoint.y, currentDifficulty);
      renderMarkers(worldContainer, dungeon);

      const getTelemetryZone = (tileX: number, tileY: number): string => {
        const tile = dungeon.tiles[tileY]?.[tileX];
        if (tile === TileType.FLOOR_TRAP) return 'hazard';
        if (tile === TileType.TREASURE) return 'treasure';
        if (tile === TileType.FLOOR_WATER || tile === TileType.FLOOR_MUD) return 'slowTerrain';
        if (Math.abs(tileX - dungeon.exitPoint.x) + Math.abs(tileY - dungeon.exitPoint.y) <= 5) return 'exitZone';
        if (Math.abs(tileX - dungeon.spawnPoint.x) + Math.abs(tileY - dungeon.spawnPoint.y) <= 5) return 'spawnZone';
        if (tileX < dungeon.width / 3) return 'west';
        if (tileX > dungeon.width * 2 / 3) return 'east';
        if (tileY < dungeon.height / 3) return 'north';
        if (tileY > dungeon.height * 2 / 3) return 'south';
        return 'center';
      };

      // ── Player ────────────────────────────────────────────────────
      const playerSprite = createPlayerSprite(selectedCharacter);
      if (isLargeMap) {
        playerSprite.container.scale.set(LARGE_MAP_CHARACTER_SCALE);
      }
      playerSprite.container.zIndex = 15;
      worldContainer.addChild(playerSprite.container);

      const spawnX = dungeon.spawnPoint.x;
      const spawnY = dungeon.spawnPoint.y;
      playerRef.current.tileX = spawnX;
      playerRef.current.tileY = spawnY;
      playerRef.current.pixelX = spawnX * TILE_SIZE + TILE_SIZE / 2;
      playerRef.current.pixelY = spawnY * TILE_SIZE + TILE_SIZE / 2;
      playerRef.current.sprite = playerSprite;
      playerRef.current.state.tileX = spawnX;
      playerRef.current.state.tileY = spawnY;
      playerRef.current.health = TEMP_EASY_GA_TEST_MODE ? EASY_PLAYER_HEALTH : 100;
      playerRef.current.maxHealth = TEMP_EASY_GA_TEST_MODE ? EASY_PLAYER_HEALTH : 100;
      playerRef.current.attackDamage = TEMP_EASY_GA_TEST_MODE ? EASY_PLAYER_ATTACK_DAMAGE : 20;
      playerRef.current.kills = 0;

      storeActionsRef.current.setPlayerHealth(playerRef.current.health);
      storeActionsRef.current.setPlayerMaxHealth(playerRef.current.maxHealth);

      playerSprite.container.x = playerRef.current.pixelX;
      playerSprite.container.y = playerRef.current.pixelY;
      camera.snapTo(playerRef.current.pixelX, playerRef.current.pixelY);
      prevPlayerTileRef.current = { x: spawnX, y: spawnY };
      runTrackerRef.current.visited.add(`${spawnX},${spawnY}`);
      runTrackerRef.current.path.push({ x: spawnX, y: spawnY, t: 0 });

      // ── Spawn enemies ─────────────────────────────────────────────
      // Use remaining character sprites as enemies + original archetypes
      const otherCharIndices = CHARACTER_DEFS
        .map((_, i) => i)
        .filter((i) => i !== selectedCharacter);

      const enemyTypes = getEnemyTypesForFloor(currentFloor);
      const characterEnemyOptions = otherCharIndices
        .map((characterIndex) => ({
          characterIndex,
          enemyType: enemyTypeForCharacterName(CHARACTER_DEFS[characterIndex].name),
        }))
        .filter((option): option is { characterIndex: number; enemyType: EnemyType } =>
          option.enemyType !== null && enemyTypes.includes(option.enemyType)
        );
      const isCalibrationRound = currentFloor === 1 && intelligenceRunRef.current === 1;

      const baseEnemyCap = TEMP_EASY_GA_TEST_MODE
        ? 3 + currentFloor
        : 6 + currentFloor * 3;
      let maxEnemies = Math.min(dungeon.enemySpawnPoints.length, baseEnemyCap);
      if (isCalibrationRound) {
        maxEnemies = 0;
        floorClearedRef.current = true;
      }
      
      const spawnPts = dungeon.enemySpawnPoints.slice(0, maxEnemies);
      const challengeTier = Math.max(0, intelligenceRunRef.current - 1);

      const applyTempEasyTuning = (enemy: EnemyBase) => {
        if (!TEMP_EASY_GA_TEST_MODE) return;

        // Keep run 2/3 noticeably tougher while still easier than full difficulty.
        const runScale = 1 + challengeTier * 0.18;
        enemy.attackDamage = Math.max(2, Math.round(enemy.attackDamage * EASY_ENEMY_DAMAGE_SCALE * runScale));
        enemy.speed = Math.max(0.9, enemy.speed * EASY_ENEMY_SPEED_SCALE * runScale);
        enemy.visionRange = Math.max(3, enemy.visionRange * EASY_ENEMY_VISION_SCALE * runScale);
        enemy.maxHealth = Math.max(14, Math.round(enemy.maxHealth * EASY_ENEMY_HEALTH_SCALE * runScale));
        enemy.health = enemy.maxHealth;
      };

      const basePopulation = learnedPopulation.length > 0
        ? learnedPopulation
        : evolvingPopulationRef.current;

      const nextGenome = (spawnIndex: number): Genome => {
        const fromPopulation = basePopulation[spawnIndex % Math.max(1, basePopulation.length)];
        const base = fromPopulation ? { ...fromPopulation } : createRandomGenome(Math.max(0, currentFloor - 1) + challengeTier);

        base.generation = Math.max(base.generation, generationRef.current);
        base.fitness = 0;
        base.alive = true;
        base.id = `${base.id}-${Date.now()}-${spawnIndex}`;

        // Increase pressure each rerun so enemies become noticeably sharper.
        base.speed = Math.min(1, base.speed + challengeTier * 0.08);
        base.vision = Math.min(1, base.vision + challengeTier * 0.1);
        base.persistence = Math.min(1, base.persistence + challengeTier * 0.12);
        base.aggression = Math.min(1, base.aggression + challengeTier * 0.08);
        base.algorithmWeights.AStar *= 1 + challengeTier * 0.25;
        base.algorithmWeights.GreedyBFS *= 1 + challengeTier * 0.15;

        return base;
      };

      // Spawn character-based enemies first (one per remaining character)
      let spawnIdx = 0;
      for (let ci = 0; ci < characterEnemyOptions.length && spawnIdx < spawnPts.length; ci++, spawnIdx++) {
        const pt = spawnPts[spawnIdx];
        const { characterIndex: charIndex, enemyType: type } = characterEnemyOptions[ci];
        const genome = nextGenome(spawnIdx);
        const enemy = createEnemy(type, pt.x, pt.y, genome);
        enemy.applyDifficulty(currentDifficulty);
        applyTempEasyTuning(enemy);
        if (isLargeMap) {
          enemy.speed *= LARGE_MAP_ENEMY_SPEED_MULTIPLIER;
        }
        // Replace the enemy's sprite with a character sprite
        enemy.container.removeChildren();
        const charSprite = createCharacterEnemySprite(charIndex);
        if (isLargeMap) {
          charSprite.container.scale.set(LARGE_MAP_CHARACTER_SCALE);
        }
        for (const child of [...charSprite.container.children]) {
          enemy.container.addChild(child);
        }
        enemy.gameSprite = charSprite;
        enemy.container.zIndex = 10;
        worldContainer.addChild(enemy.container);
        enemiesRef.current.push(enemy);
        allSpawnedEnemiesRef.current.push(enemy);
      }

      // Spawn remaining enemies as normal archetypes — round-robin through
      // all 8 enemy types to guarantee variety on every floor.
      for (; spawnIdx < spawnPts.length; spawnIdx++) {
        const pt = spawnPts[spawnIdx];
        const type = enemyTypes[spawnIdx % enemyTypes.length];
        const genome = nextGenome(spawnIdx);
        const enemy = createEnemy(type, pt.x, pt.y, genome);
        enemy.applyDifficulty(currentDifficulty);
        applyTempEasyTuning(enemy);
        if (isLargeMap) {
          enemy.speed *= LARGE_MAP_ENEMY_SPEED_MULTIPLIER;
          enemy.container.scale.set(LARGE_MAP_CHARACTER_SCALE);
        }
        enemy.container.zIndex = 10;
        worldContainer.addChild(enemy.container);
        enemiesRef.current.push(enemy);
        allSpawnedEnemiesRef.current.push(enemy);
      }

      if (isCalibrationRound) {
        showNotification(`CALIBRATION ROUND — Explore to determine your playstyle!`);
      } else {
        const modePrefix = TEMP_EASY_GA_TEST_MODE ? 'TEST EASY MODE — ' : '';
        showNotification(`${modePrefix}Floor ${dungeon.floor} — Iteration ${intelligenceRunRef.current} — ${spawnPts.length} enemies!`);
      }

      const finalizeLearning = (result: 'died' | 'manualExit' | 'floorClear') => {
        if (learningCommittedRef.current) return;
        learningCommittedRef.current = true;

        const runDuration = Math.max(1, (performance.now() - runStartTimeRef.current) / 1000);
        const profile = { ...playerProfileRef.current };
        const path = runTrackerRef.current.path;
        const uniqueTiles = runTrackerRef.current.visited.size;
        const totalTiles = dungeon.width * dungeon.height;
        const keystrokeCounts = runTrackerRef.current.keystrokes.reduce<Record<string, number>>((counts, event) => {
          if (event.type === 'down') counts[event.code] = (counts[event.code] ?? 0) + 1;
          return counts;
        }, {});
        const zoneEntries = Object.entries(runTrackerRef.current.zoneTime);
        const dominantZone = zoneEntries.length > 0
          ? zoneEntries.reduce((best, entry) => entry[1] > best[1] ? entry : best)[0]
          : 'unknown';

        const start = path[0] ?? { x: playerRef.current.tileX, y: playerRef.current.tileY };
        const end = path[path.length - 1] ?? start;
        const displacement = Math.hypot(end.x - start.x, end.y - start.y);
        const traveled = Math.max(1, path.slice(1).reduce((distance, point, index) => {
          const prev = path[index];
          return distance + Math.hypot(point.x - prev.x, point.y - prev.y);
        }, 0));

        profile.totalTiles = totalTiles;
        profile.tilesExplored = uniqueTiles;
        profile.averageSpeed = Math.min(1, traveled / Math.max(1, runDuration) / 8);
        profile.explorationRate = uniqueTiles / Math.max(1, totalTiles);
        profile.hidingFrequency = profile.totalHides / Math.max(1, runDuration);
        profile.averageHideDuration = profile.timeSpentHiding / Math.max(1, profile.totalHides);
        profile.engagementRate = runTrackerRef.current.attacks / Math.max(1, runDuration);
        profile.fleeFrequency = profile.totalFlees / Math.max(1, runDuration);
        profile.stealthToRushRatio = Math.min(1, profile.timeSpentHiding / Math.max(1, profile.timeSpentHiding + profile.timeSpentMoving));
        profile.pathStraightness = Math.min(1, displacement / traveled);
        profile.rawKeystrokes = runTrackerRef.current.keystrokes.slice(-500);
        profile.movementCoordinates = path.slice(-500);
        profile.timeSpentInZones = { ...runTrackerRef.current.zoneTime };
        profile.cleanedTelemetry = {
          keystrokeCounts,
          dominantZone,
          totalSamples: path.length + runTrackerRef.current.keystrokes.length,
        };
        profile.playstyle = classifyPlaystyle(profile);

        const trainingPool = allSpawnedEnemiesRef.current.filter((e) => e.genome);
        for (const enemy of trainingPool) {
          enemy.genome.fitness = calculateFitness({
            timePlayerVisible: enemy.performance.timePlayerVisible,
            damageDealt: enemy.performance.damageDealt,
            playerDetections: enemy.performance.playerDetections,
            survivalTime: enemy.performance.survivalTime,
            areaCovered: enemy.performance.tilesVisited.size,
            timeStuck: enemy.performance.timeStuck,
            cooperativeKills: 0,
          }, enemy.genome, profile);
        }

        const sourcePopulation = trainingPool.map((e) => e.genome);
        while (sourcePopulation.length < 8) {
          sourcePopulation.push(createRandomGenome(Math.max(0, generationRef.current)));
        }

        const { newPopulation, stats } = evolvePopulation(sourcePopulation, profile);
        evolvingPopulationRef.current = newPopulation;
        generationRef.current = stats.generation;

        const pressure = Math.min(1, stats.avgFitness / 80);
        const nextDifficulty = Math.min(3, Math.max(1, currentDifficulty + 0.08 + pressure * 0.22));
        const beforeGenes = averageGenomeGenes(sourcePopulation);
        const afterGenes = averageGenomeGenes(newPopulation);
        const roundFitnesses = sourcePopulation.map((genome) => genome.fitness || 0);
        const algorithmDistribution = Object.fromEntries(
          Object.values(AlgorithmType).map((algorithm) => [algorithm, 0])
        ) as Record<AlgorithmType, number>;
        for (const genome of newPopulation) {
          const algorithm = getPreferredAlgorithm(genome);
          algorithmDistribution[algorithm] += 1;
        }
        const proof: Omit<IterationProofData, 'timestamp'> = {
          iteration,
          floorReached: currentFloor,
          generationBefore: Math.max(0, stats.generation - 1),
          generationAfter: stats.generation,
          result,
          score: useGameStore.getState().playerScore,
          enemyCount: trainingPool.length,
          playstyle: profile.playstyle,
          difficultyBefore: currentDifficulty,
          difficultyAfter: nextDifficulty,
          beforeStrengthIndex: calculateStrengthIndex(beforeGenes, currentDifficulty),
          afterStrengthIndex: calculateStrengthIndex(afterGenes, nextDifficulty),
          beforeAvgFitness: averageGenomeFitness(sourcePopulation),
          roundAvgFitness: roundFitnesses.length
            ? roundFitnesses.reduce((sum, fitness) => sum + fitness, 0) / roundFitnesses.length
            : 0,
          roundMaxFitness: roundFitnesses.length ? Math.max(...roundFitnesses) : 0,
          beforeGenes,
          afterGenes,
          avgPathTimeMs: averageEnemyMetric(trainingPool, (enemy) => enemy.pathComputeTimeMs),
          avgNodesExpanded: averageEnemyMetric(trainingPool, (enemy) => enemy.nodesExpanded),
          avgDamageDealt: averageEnemyMetric(trainingPool, (enemy) => enemy.performance.damageDealt),
          avgDetections: averageEnemyMetric(trainingPool, (enemy) => enemy.performance.playerDetections),
          avgSurvivalTime: averageEnemyMetric(trainingPool, (enemy) => enemy.performance.survivalTime),
          avgAreaCovered: averageEnemyMetric(trainingPool, (enemy) => enemy.performance.tilesVisited.size),
          dominantAlgorithm: stats.dominantAlgorithm,
          algorithmDistribution,
        };

        storeActionsRef.current.completeIterationLearning({
          run: {
            iteration,
            floorReached: currentFloor,
            score: useGameStore.getState().playerScore,
            result,
            path,
            keystrokes: runTrackerRef.current.keystrokes.slice(-500),
            timeSpentInZones: { ...runTrackerRef.current.zoneTime },
            uniqueTilesVisited: uniqueTiles,
            actions: {
              attacks: runTrackerRef.current.attacks,
              itemsUsed: runTrackerRef.current.itemsUsed,
              kills: runTrackerRef.current.kills,
              damageTaken: Math.round(runTrackerRef.current.damageTaken),
            },
            difficultyAtRun: currentDifficulty,
            profileSnapshot: profile,
          },
          profile,
          evolvedPopulation: newPopulation,
          stats,
          nextDifficulty,
          proof,
        });

        // --- Supabase Integration ---
        // 1. Update leaderboard
        SupabaseService.updateLeaderboard(useGameStore.getState().playerScore, currentFloor);

        // 2. Log evolution run
        SupabaseService.logEvolutionRun({
          floor: currentFloor,
          generation: stats.generation,
          avgFitness: stats.avgFitness,
          maxFitness: stats.maxFitness,
          minFitness: stats.minFitness,
          diversity: stats.diversityIndex,
          dominantAlgo: stats.dominantAlgorithm,
          popSize: newPopulation.length,
          playstyle: profile.playstyle,
          geneAverages: stats.avgGenes
        });

        // 3. Save elite genomes (if fitness > 90)
        const elite = newPopulation.sort((a, b) => (b.fitness || 0) - (a.fitness || 0))[0];
        if (elite && (elite.fitness || 0) > 90) {
          SupabaseService.saveEliteGenome(elite, 'Elite', elite.fitness || 0, currentFloor);
        }
      };

      // ── Events ────────────────────────────────────────────────────
      const bus = EventBus.getInstance();
      const unsubNotif = bus.on(GameEvents.NOTIFICATION, (data: unknown) => {
        const d = data as { msg: string };
        showNotification(d.msg);
      });

      console.error("DEBUG: End of initGame reached, calling setIsLoaded(true)");
      isLoadedRef.current = true;
      setIsLoaded(true);

      // ── Staggered path timers per enemy ───────────────────────────
      const pathTimers = new Map<string, number>();
      const BASE_PATH_INTERVAL = 0.6;

      let fpsCounter = 0;
      let fpsTimer = 0;
      let analyticsTimer = 0;
      let attackVisualTimer = 0;
      let playerAttackAnimTimer = 0;

      // ══════════════════════════════════════════════════════════════
      // GAME LOOP
      // ══════════════════════════════════════════════════════════════
      app.ticker.add((ticker) => {
        let dt = ticker.deltaTime / 60;
        let dtSeconds = ticker.deltaMS / 1000;
        const p = playerRef.current;

        // Clamp delta time to prevent massive physics jumps on first frame or lag spikes
        if (dt > 0.1) dt = 0.1;
        if (dtSeconds > 0.1) dtSeconds = 0.1;

        fpsCounter++; fpsTimer += dt; analyticsTimer += dt;

        if (fpsTimer >= 1) {
          storeActionsRef.current.setFps(Math.round(fpsCounter / fpsTimer));
          fpsCounter = 0; fpsTimer = 0;
        }

        // ── Trapdoor death → menu transition timer ───────────────
        if (trapdoorReturnPendingRef.current) {
          trapdoorReturnTimerRef.current -= dtSeconds;
          if (trapdoorReturnTimerRef.current <= 0) {
            trapdoorReturnPendingRef.current = false;
            returnToMainMenu();
          }
          input.endFrame();
          return;
        }

        // ── Trapdoor fall pause → death ───────────────────────────
        if (trapdoorDeathPendingRef.current) {
          trapdoorDeathTimerRef.current -= dtSeconds;
          if (trapdoorDeathTimerRef.current <= 0) {
            trapdoorDeathPendingRef.current = false;
            p.health = 0;
            storeActionsRef.current.setPlayerHealth(0);
            playerDeadRef.current = true;
            setIsDead(true);
            // Replace with grave sprite
            import('pixi.js').then(({ Sprite, Texture }) => {
              p.sprite?.container.removeChildren();
              const graveSprite = new Sprite(Texture.from('/assets/grave.png'));
              graveSprite.anchor.set(0.5);
              p.sprite?.container.addChild(graveSprite);
            });
            trapdoorReturnPendingRef.current = true;
            trapdoorReturnTimerRef.current = 3.5;
          }
          input.endFrame();
          return;
        }

        // ── PAUSE / DEATH CHECK ─────────────────────────────────
        if (input.isKeyJustPressed('escape')) {
          isPausedRef.current = !isPausedRef.current;
          storeActionsRef.current.togglePause();
        }
        // Toggle analytics during pause with backtick
        if (isPausedRef.current && input.isCodeJustPressed('Backquote')) {
          storeActionsRef.current.toggleAnalytics();
        }
        if (isPausedRef.current || playerDeadRef.current) {
          // Still update analytics snapshot while paused
          analyticsTimer += dt;
          if (analyticsTimer > 0.5) {
            analyticsTimer = 0;
            const liveEnemies = enemiesRef.current.filter((e) => e.isAlive);
            storeActionsRef.current.setEnemyAnalytics(
              liveEnemies.slice(0, 15).map((e) => e.getAnalyticsSnapshot())
            );
          }
          input.endFrame();
          return;
        }

        // ── PLAYER MOVEMENT ───────────────────────────────────────
        const inputState = input.getState();
        const elapsedMsForTelemetry = performance.now() - runTrackerRef.current.startTs;
        for (const code of inputState.codesJustPressed) {
          runTrackerRef.current.keystrokes.push({ code, key: code, type: 'down', t: elapsedMsForTelemetry });
        }
        for (const code of inputState.codesJustReleased) {
          runTrackerRef.current.keystrokes.push({ code, key: code, type: 'up', t: elapsedMsForTelemetry });
        }
        if (runTrackerRef.current.keystrokes.length > 1000) {
          runTrackerRef.current.keystrokes.splice(0, runTrackerRef.current.keystrokes.length - 1000);
        }

        const zone = getTelemetryZone(p.tileX, p.tileY);
        runTrackerRef.current.zoneTime[zone] = (runTrackerRef.current.zoneTime[zone] ?? 0) + dtSeconds;

        const moveVec = input.getMovementVector();
        const moveX = moveVec.x;
        const moveY = moveVec.y;
        const isMoving = moveX !== 0 || moveY !== 0;
        const wantsSprint = input.isCodeDown('ShiftLeft') || input.isCodeDown('ShiftRight');
        const canSprint = isMoving && wantsSprint && sprintEnergyRef.current > 0 && sprintRechargeTimerRef.current <= 0;
        if (canSprint) {
          sprintEnergyRef.current = Math.max(0, sprintEnergyRef.current - SPRINT_DRAIN_PER_SECOND * dtSeconds);
          if (sprintEnergyRef.current <= 0) {
            sprintRechargeTimerRef.current = SPRINT_RECHARGE_DELAY_SECONDS;
          }
        } else if (sprintRechargeTimerRef.current > 0) {
          sprintRechargeTimerRef.current = Math.max(0, sprintRechargeTimerRef.current - dtSeconds);
          if (sprintRechargeTimerRef.current <= 0) {
            sprintEnergyRef.current = 1;
          }
        }
        sprintHudTimerRef.current += dtSeconds;
        if (sprintHudTimerRef.current >= 0.08) {
          sprintHudTimerRef.current = 0;
          setSprintEnergy(sprintEnergyRef.current);
        }

        const calibrationSpeedBoost = isCalibrationRound ? CALIBRATION_PLAYER_SPEED_MULTIPLIER : 1;
        const basePlayerMoveSpeed = (TEMP_EASY_GA_TEST_MODE ? EASY_PLAYER_MOVE_SPEED : 160)
          * (isLargeMap ? LARGE_MAP_PLAYER_SPEED_MULTIPLIER : 1)
          * calibrationSpeedBoost;
        const sprintBoost = canSprint ? SPRINT_SPEED_MULTIPLIER : 1;
        const moveSpeed = (p.state.isInvisible ? basePlayerMoveSpeed + 40 : basePlayerMoveSpeed) * sprintBoost * dtSeconds;

        if (isMoving) {
          const nextX = p.pixelX + moveX * moveSpeed;
          const nextY = p.pixelY + moveY * moveSpeed;

          const xTile = Math.floor(nextX / TILE_SIZE);
          const yTileForX = Math.floor(p.pixelY / TILE_SIZE);
          const xNode = grid.getNode(xTile, yTileForX);
          if (xNode && xNode.walkable) {
            p.pixelX = nextX;
          }

          const xTileForY = Math.floor(p.pixelX / TILE_SIZE);
          const yTile = Math.floor(nextY / TILE_SIZE);
          const yNode = grid.getNode(xTileForY, yTile);
          if (yNode && yNode.walkable) {
            p.pixelY = nextY;
          }

          p.tileX = Math.floor(p.pixelX / TILE_SIZE);
          p.tileY = Math.floor(p.pixelY / TILE_SIZE);
          p.state.tileX = p.tileX;
          p.state.tileY = p.tileY;

          const elapsedMs = performance.now() - runTrackerRef.current.startTs;
          const lastPoint = runTrackerRef.current.path[runTrackerRef.current.path.length - 1];
          if (!lastPoint || lastPoint.x !== p.tileX || lastPoint.y !== p.tileY) {
            runTrackerRef.current.path.push({ x: p.tileX, y: p.tileY, t: elapsedMs });
            if (runTrackerRef.current.path.length > 2000) {
              runTrackerRef.current.path.shift();
            }
          }
          runTrackerRef.current.visited.add(`${p.tileX},${p.tileY}`);

          playerProfileRef.current.totalMoves += 1;
          playerProfileRef.current.timeSpentMoving += dtSeconds;

          const prev = prevPlayerTileRef.current;
          const dtx = p.tileX - prev.x;
          const dty = p.tileY - prev.y;
          playerVelocityRef.current.x = playerVelocityRef.current.x * 0.65 + dtx * 0.35;
          playerVelocityRef.current.y = playerVelocityRef.current.y * 0.65 + dty * 0.35;
          prevPlayerTileRef.current = { x: p.tileX, y: p.tileY };

          if (playerAttackAnimTimer <= 0) p.sprite?.setAnimation('walk');
          if (moveX < 0) p.sprite?.setFlipX(true);
          if (moveX > 0) p.sprite?.setFlipX(false);
        } else {
          if (playerAttackAnimTimer <= 0) p.sprite?.setAnimation('idle');
        }

        if (playerAttackAnimTimer > 0) playerAttackAnimTimer -= dtSeconds;
        p.sprite!.container.x = p.pixelX;
        p.sprite!.container.y = p.pixelY;
        p.sprite?.setAlpha(p.state.isInvisible ? 0.3 : 1);

        // ── Pulsing glow on player ─────────────────────────────────
        const glowChild = p.sprite?.container.getChildByLabel('glow') as Graphics | null;
        if (glowChild) {
          const pulse = 0.8 + Math.sin(Date.now() * 0.004) * 0.2;
          glowChild.scale.set(pulse);
        }

        // ── PLAYER ATTACK (Space) ──────────────────────────────────
        if (p.attackCooldown > 0) p.attackCooldown -= dtSeconds;

        if (input.isCodeJustPressed('Space') && p.attackCooldown <= 0) {
          runTrackerRef.current.attacks += 1;
          playerProfileRef.current.totalFights += 1;
          const trapdoor = getTrapdoorAt(tilemapAnimRuntime, p.tileX, p.tileY);
          if (trapdoor && !trapdoor.isCollapsed) {
            triggerTrapdoorCollapseGroup(tilemapAnimRuntime, trapdoor);
            trapdoorDeathPendingRef.current = true;
            trapdoorDeathTimerRef.current = 0.75;
            showNotification('🕳️ Trapdoor opened!');
            input.endFrame();
            return;
          }

          p.attackCooldown = TEMP_EASY_GA_TEST_MODE ? EASY_PLAYER_ATTACK_COOLDOWN : 0.4;
          playerAttackAnimTimer = TEMP_EASY_GA_TEST_MODE ? EASY_PLAYER_ATTACK_COOLDOWN : 0.4;
          p.sprite?.setAnimation('attack');

          let hitCount = 0;
          for (const enemy of enemiesRef.current) {
            if (!enemy.isAlive) continue;
            const dx = enemy.tileX - p.tileX;
            const dy = enemy.tileY - p.tileY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= p.attackRange) {
              enemy.takeDamage(p.attackDamage);
              hitCount++;
              if (!enemy.isAlive) {
                p.kills++;
                runTrackerRef.current.kills += 1;
                storeActionsRef.current.addScore(100 + currentFloor * 50);
                showNotification(`⚔️ Killed ${enemy.type}! +${100 + currentFloor * 50} pts`);
              }
            }
          }

          attackVisualTimer = 0.2;
          attackLayer.clear();
          attackLayer.circle(p.pixelX, p.pixelY, p.attackRange * TILE_SIZE);
          attackLayer.stroke({ color: hitCount > 0 ? 0xff4444 : 0x44ddff, width: 2, alpha: 0.6 });
          attackLayer.circle(p.pixelX, p.pixelY, 8);
          attackLayer.fill({ color: 0xffffff, alpha: 0.4 });
        }

        if (attackVisualTimer > 0) {
          attackVisualTimer -= dt;
          if (attackVisualTimer <= 0) attackLayer.clear();
        }

        // ── ITEMS ──────────────────────────────────────────────────
        updateItems(p.items, p.state, dt);
        const itemCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
        for (let i = 0; i < itemCodes.length; i++) {
          if (!input.isCodeJustPressed(itemCodes[i])) continue;
          const item = p.items[i];
          if (item && item.currentCooldown <= 0) {
            item.use(p.state, enemiesRef.current, grid);
            item.currentCooldown = item.cooldown;
            runTrackerRef.current.itemsUsed += 1;
          }
        }

        // ── VISION SYSTEM ──────────────────────────────────────────
        updateVision(
          enemiesRef.current, p.tileX, p.tileY,
          p.state.isInvisible || p.state.isHiding, grid, dt
        );

        if (p.state.isHiding || p.state.isInvisible) {
          playerProfileRef.current.totalHides += 1;
          playerProfileRef.current.timeSpentHiding += dtSeconds;
        }

        // ── ENEMY AI + MOVEMENT ────────────────────────────────────
        for (const enemy of enemiesRef.current) {
          if (!enemy.isAlive) continue;

          let timer = pathTimers.get(enemy.id) ?? 0;
          timer -= dt;
          pathTimers.set(enemy.id, timer);

          if (timer <= 0) {
            const isPursuing = enemy.alertState === AlertState.CHASING || enemy.alertState === AlertState.ALERT;
            // Force pursuit interval to be slow (1.5s) so we can actually see DLS/IDS run their paths
            // instead of vibrating from high-frequency partial path recalculations.
            const pursuitInterval = 1.5; 
            const nextInterval = isPursuing ? pursuitInterval : BASE_PATH_INTERVAL + Math.random() * 0.3;
            pathTimers.set(enemy.id, nextInterval);

            let targetX = enemy.homeX;
            let targetY = enemy.homeY;

            if (isPursuing) {
              if (enemy.blackboard.playerVisible) {
                const predictionScale = 2 + intelligenceRunRef.current;
                const predictedX = p.tileX + Math.round(playerVelocityRef.current.x * predictionScale);
                const predictedY = p.tileY + Math.round(playerVelocityRef.current.y * predictionScale);

                const pNode = grid.getNode(predictedX, predictedY);
                if (pNode && pNode.walkable) {
                  targetX = Math.max(1, Math.min(dungeon.width - 2, predictedX));
                  targetY = Math.max(1, Math.min(dungeon.height - 2, predictedY));
                } else {
                  targetX = p.tileX;
                  targetY = p.tileY;
                }
              } else {
                const knownX = enemy.blackboard.lastKnownPlayerX >= 0
                  ? enemy.blackboard.lastKnownPlayerX
                  : p.tileX;
                const knownY = enemy.blackboard.lastKnownPlayerY >= 0
                  ? enemy.blackboard.lastKnownPlayerY
                  : p.tileY;

                targetX = Math.max(1, Math.min(dungeon.width - 2, knownX));
                targetY = Math.max(1, Math.min(dungeon.height - 2, knownY));
              }
            } else if (enemy.alertState === AlertState.SUSPICIOUS) {
              targetX = enemy.blackboard.lastKnownPlayerX >= 0
                ? enemy.blackboard.lastKnownPlayerX : enemy.homeX;
              targetY = enemy.blackboard.lastKnownPlayerY >= 0
                ? enemy.blackboard.lastKnownPlayerY : enemy.homeY;
            } else if (enemy.alertState === AlertState.FLEEING) {
              const fdx = enemy.tileX - p.tileX;
              const fdy = enemy.tileY - p.tileY;
              targetX = Math.max(1, Math.min(dungeon.width - 2, enemy.tileX + fdx * 4));
              targetY = Math.max(1, Math.min(dungeon.height - 2, enemy.tileY + fdy * 4));
            } else {
              // DEBUG/TESTING OVERRIDE: Force enemies to path to player even when not alerted
              // so the user can observe the algorithms without high-frequency pursuit logic.
              targetX = p.tileX;
              targetY = p.tileY;
              
              // Clear patrol target so they don't get stuck in patrol state
              enemy.patrolTarget = null;
            }

            enemy.requestPath(grid, targetX, targetY);
          }

          enemy.update(dt, grid, p.tileX, p.tileY);

          // ── Enemy attacks player on contact ──────────────────────
          if (!p.state.isInvisible && enemy.attackTimer <= 0) {
            const edx = enemy.tileX - p.tileX;
            const edy = enemy.tileY - p.tileY;
            const edist = Math.sqrt(edx * edx + edy * edy);
            if (edist <= 1.5) {
              enemy.attackTimer = enemy.attackCooldown;
              enemy.gameSprite.setAnimation('attack');
              const dmg = enemy.attackDamage;
              enemy.performance.damageDealt += dmg;
              p.health = Math.max(0, p.health - dmg);
              runTrackerRef.current.damageTaken += dmg;
              storeActionsRef.current.setPlayerHealth(p.health);

              p.sprite!.setTint?.(0xff4444);
              setTimeout(() => { p.sprite!.setTint?.(0xffffff); }, 200);

              if (p.health <= 0) {
                finalizeLearning('died');
                playerDeadRef.current = true;
                setIsDead(true);
                // Replace with grave sprite
                import('pixi.js').then(({ Sprite, Texture }) => {
                  p.sprite?.container.removeChildren();
                  const graveSprite = new Sprite(Texture.from('/assets/grave.png'));
                  graveSprite.anchor.set(0.5);
                  p.sprite?.container.addChild(graveSprite);
                });
                setTimeout(returnToMainMenu, 3500);
              }
            }
          }
        }

        // ── REMOVE DEAD ENEMIES ────────────────────────────────────
        enemiesRef.current = enemiesRef.current.filter((e) => e.isAlive);

        // ── CHECK FLOOR COMPLETE ───────────────────────────────────
        if (isLoadedRef.current && enemiesRef.current.length === 0 && spawnPts.length > 0 && !floorClearedRef.current) {
          floorClearedRef.current = true;
          showNotification(`Exit is open. Reach the green glow to finish the round.`);
        }

        // ── EXIT / PROGRESSION ────────────────────────────────────
        const isGrinmap2 = selectedMap === LARGE_MAP_ID;
        let atExit = false;
        if (isGrinmap2) {
          atExit = p.tileY >= dungeon.height - 4; // Bottom edge
        } else {
          atExit = p.tileX >= dungeon.width - 4;  // Right edge
        }
        atExit = atExit || (p.tileX === dungeon.exitPoint.x && p.tileY === dungeon.exitPoint.y);

        if (
          !floorAdvancePendingRef.current &&
          atExit
        ) {
          floorAdvancePendingRef.current = true;

          finalizeLearning('floorClear');

          intelligenceRunRef.current = iteration + 1;
          setIntelligenceRun(iteration + 1);

          if (isCalibrationRound) {
            setShowCalibrationLoading(true);
            storeActionsRef.current.nextFloor();
            setTimeout(() => {
              setShowCalibrationLoading(false);
            }, 1500);
          } else {
            showNotification('🏆 Learning complete for this iteration. Advancing floor with evolved enemies!');
            setTimeout(() => {
              storeActionsRef.current.nextFloor();
            }, 700);
          }
        }

        // ── TRAP DAMAGE ────────────────────────────────────────────
        const playerTile = dungeon.tiles[p.tileY]?.[p.tileX];
        const playerOnInteractiveSpear = isPlayerOnInteractiveSpear(tilemapAnimRuntime, p.tileX, p.tileY);
        if (playerTile === TileType.FLOOR_TRAP && !playerOnInteractiveSpear) {
          const trapDmg = 15 * dt;
          p.health = Math.max(0, p.health - trapDmg);
          runTrackerRef.current.damageTaken += trapDmg;
          storeActionsRef.current.setPlayerHealth(Math.round(p.health));
          for (const enemy of enemiesRef.current) {
            if (enemy.tileX === p.tileX && enemy.tileY === p.tileY) {
              enemy.stun(1);
            }
          }
        }

        updateInteractiveTileAnimations(tilemapAnimRuntime, p.tileX, p.tileY, dtSeconds, currentDifficulty, (damage) => {
          p.health = Math.max(0, p.health - damage);
          runTrackerRef.current.damageTaken += damage;
          storeActionsRef.current.setPlayerHealth(Math.round(p.health));
          if (p.health <= 0 && !playerDeadRef.current) {
            finalizeLearning('died');
            playerDeadRef.current = true;
            setIsDead(true);
            // Replace with grave sprite
            import('pixi.js').then(({ Sprite, Texture }) => {
              p.sprite?.container.removeChildren();
              const graveSprite = new Sprite(Texture.from('/assets/grave.png'));
              graveSprite.anchor.set(0.5);
              p.sprite?.container.addChild(graveSprite);
            });
            setTimeout(returnToMainMenu, 3500);
          }
        });

        // ── ANALYTICS (update even during pause so panel stays live) ──
        if (analyticsTimer > 0.5) {
          analyticsTimer = 0;
          const liveEnemies = enemiesRef.current.filter((e) => e.isAlive);
          storeActionsRef.current.setEnemyAnalytics(
            liveEnemies.slice(0, 15).map((e) => e.getAnalyticsSnapshot())
          );
        }

        // ── DEBUG OVERLAYS ─────────────────────────────────────────
        drawDebugOverlays(debugOverlay, enemiesRef.current, p.tileX, p.tileY, showPathsRef.current, showFOVRef.current);

        // ── CAMERA ─────────────────────────────────────────────────
        camera.follow(p.pixelX, p.pixelY, dt);
        worldContainer.scale.set(camera.config.zoom);
        worldContainer.x = -camera.x * camera.config.zoom;
        worldContainer.y = -camera.y * camera.config.zoom;

        // ── CULLING ────────────────────────────────────────────────
        if (tilemapAnimRuntime.chunks) {
          const padding = 32;
          const viewLeft = camera.x - padding;
          const viewTop = camera.y - padding;
          const viewRight = camera.x + (camera.config.viewportWidth / camera.config.zoom) + padding;
          const viewBottom = camera.y + (camera.config.viewportHeight / camera.config.zoom) + padding;

          for (const chunk of tilemapAnimRuntime.chunks) {
            chunk.container.visible = !(
              chunk.bounds.right < viewLeft ||
              chunk.bounds.left > viewRight ||
              chunk.bounds.bottom < viewTop ||
              chunk.bounds.top > viewBottom
            );
          }
        }

        const worldMouse = camera.screenToWorld(input.getState().mouse.x, input.getState().mouse.y);
        input.setWorldMouse(worldMouse.x, worldMouse.y);

        // ── HOTKEYS ────────────────────────────────────────────────
        if (input.isCodeJustPressed('Backquote')) storeActionsRef.current.toggleAnalytics();

        input.endFrame();
      });

      // ── Resize ────────────────────────────────────────────────────
      const onResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        camera.setViewport(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', onResize);

      // Return cleanup function
      const cleanup = () => {
        isPausedRef.current = false;
        storeActionsRef.current.setPaused(false);
        unsubNotif();
        window.removeEventListener('resize', onResize);
        input.destroy();
        try { app.destroy(true); } catch { /* already destroyed */ }
        appRef.current = null;
        enemiesRef.current = [];
        isLoadedRef.current = false;
        setIsLoaded(false);
      };

      return cleanup;
    } catch (e) {
      console.error("GameScreen initialization failed:", e);
      showNotification(`Game failed to load: ${e}`);
    }
    // Only re-init when floor, character, or map changes
  }, [currentFloor, selectedCharacter, selectedMap, showNotification, runSeed, intelligenceRun]);

  // ── Effect: init game with proper StrictMode cleanup ────────────
  useEffect(() => {
    const abortController = new AbortController();

    initGame(abortController.signal).then((cleanup) => {
      if (abortController.signal.aborted) {
        // Component unmounted before init finished — clean up immediately
        cleanup?.();
      } else {
        cleanupFnRef.current = cleanup ?? null;
      }
    });

    return () => {
      abortController.abort();
      if (cleanupFnRef.current) {
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
    };
  }, [initGame]);

  return (
    <div className="game-screen">
      <div ref={canvasRef} className="game-canvas-wrapper" />

      {isLoaded && <PlayerHUD items={playerRef.current.items} sprintEnergy={sprintEnergy} />}

      {showCalibrationLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#4ade80', fontFamily: 'var(--font-pixel)', marginBottom: '1rem' }}>Calibration Round Completed</h2>
          <p style={{ fontSize: '1.5rem', color: 'white', fontFamily: 'var(--font-pixel)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>Loading Level 1...</p>
        </div>
      )}

      {/* Analytics panel — always rendered when enabled, even during pause */}
      {analyticsEnabled && (
        <div style={{ zIndex: 120, position: 'relative' }}>
          <AIAnalyticsPanel />
        </div>
      )}

      {notification && (
        <div className="toast-container">
          <div className="toast toast-info">{notification}</div>
        </div>
      )}

      {/* Controls hint overlay */}
      {isLoaded && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '16px',
          background: 'rgba(10,10,18,0.7)', padding: '8px 14px',
          borderRadius: '8px', fontSize: '0.65rem', fontFamily: 'var(--font-pixel)',
          color: 'var(--text-muted)', lineHeight: '1.8', zIndex: 11,
          border: '1px solid rgba(200,168,80,0.15)',
        }}>
          <span style={{ color: '#44ddff' }}>WASD</span> Move &nbsp;
          <span style={{ color: '#44ddff' }}>Shift</span> Sprint &nbsp;
          <span style={{ color: '#ff4466' }}>Space</span> Attack &nbsp;
          <span style={{ color: '#ffd700' }}>1-4</span> Items &nbsp;
          <span style={{ color: '#aa66ff' }}>`</span> AI Panel &nbsp;
          <span style={{ color: '#88ff88' }}>Esc</span> Pause
        </div>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(6,6,16,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 100, fontFamily: 'var(--font-pixel)',
          pointerEvents: 'none',
        }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--gold)', marginBottom: '16px' }}>⏸ PAUSED</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Press <span style={{ color: '#88ff88' }}>Escape</span> to resume</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn btn-pixel"
                onClick={returnToMainMenu}
              >
                ← Main Menu
              </button>
              <button
                className="btn btn-pixel"
                style={{ borderColor: analyticsEnabled ? 'var(--purple-light)' : 'var(--border-subtle)' }}
                onClick={() => storeActionsRef.current.toggleAnalytics()}
              >
                {analyticsEnabled ? '🧠 Hide Analytics' : '🧠 Show Analytics'}
              </button>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              <span style={{ color: '#aa66ff' }}>`</span> Toggle AI Panel
            </div>
          </div>
        </div>
      )}

      {/* Death Overlay */}
      {isDead && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
          animation: 'fadeIn 2s ease-out forwards'
        }}>
          <img src="/assets/You Died.png" alt="You Died" style={{ maxWidth: '80%', maxHeight: '50%' }} />
          <div style={{ color: '#ff4444', marginTop: '30px', fontFamily: 'var(--font-pixel)' }}>
            Stand proud... you were strong.
          </div>
        </div>
      )}

      {!isLoaded && !showCalibrationLoading && (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">Generating dungeon...</div>
        </div>
      )}
    </div>
  );
}
