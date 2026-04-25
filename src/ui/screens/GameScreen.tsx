// ========================
// GameScreen — REWRITTEN with working combat, enemy AI, clear visuals,
// and fixed React StrictMode support
// ========================

import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle, Sprite, AnimatedSprite } from 'pixi.js';
import { useGameStore } from '@store/gameStore';
import { InputManager } from '@core/InputManager';
import { Camera } from '@core/Camera';
import { Grid } from '@ai/pathfinding/Grid';
import { generateDungeon, getBiomeForFloor, type TiledLayerData } from '@game/world/DungeonGenerator';
import { TILE_SIZE, TileType, GRID_COLS, GRID_ROWS, ALGORITHM_COLORS, AlertState, EnemyType } from '@utils/constants';
import { AIAnalyticsPanel } from '@ui/analytics/AIAnalyticsPanel';
import { PlayerHUD } from '@ui/hud/PlayerHUD';
import { createPlayerSprite, initSpriteAssets, CHARACTER_DEFS, createCharacterEnemySprite } from '@core/SpriteFactory';
import { createEnemy, getEnemyTypesForFloor } from '@game/entities/enemies/Archetypes';
import { updateVision } from '@game/systems/VisionSystem';
import { createDefaultItemLoadout, updateItems, type PlayerState } from '@game/entities/items/ItemSystem';
import { createRandomGenome } from '@ai/evolution/GeneticAlgorithm';
import { EventBus, GameEvents } from '@core/EventBus';
import type { EnemyBase } from '@game/entities/enemies/EnemyBase';
import { randomInt } from '@utils/random';
import { loadTileset, isTilesetLoaded, getTileTexture, getWallTexture, loadItemAnimations, getTiledTileTexture, isTiledTilesetLoaded, getTiledTileAnimation, stripTiledFlipFlags } from '@core/DungeonTilesetLoader';

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

type InteractiveAnimKind = 'chest' | 'spear';

interface InteractiveTileAnim {
  key: string;
  tileX: number;
  tileY: number;
  kind: InteractiveAnimKind;
  sprite: AnimatedSprite;
  isActive: boolean;
  hasBeenOpened: boolean;
  hasTriggeredDamage: boolean;
  isWaveTrap: boolean;
  waveOffsetMs: number;
  spearGroupId: number;
  holdMs: number;
}

interface TrapdoorTileAnim {
  key: string;
  tileX: number;
  tileY: number;
  sprite: AnimatedSprite;
  isCollapsed: boolean;
}

interface TilemapAnimRuntime {
  interactive: InteractiveTileAnim[];
  trapdoors: TrapdoorTileAnim[];
  waveTimeMs: number;
  nonWaveActiveGroupId: number;
  nonWaveGroupHoldMs: number;
  nonWaveGroupDamaged: boolean;
}

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

  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadedRef = useRef(false);
  const [notification, setNotification] = useState<string | null>(null);
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

  // Store action refs — these never change identity, but using refs
  // prevents initGame from being recreated when other state changes
  const storeActionsRef = useRef({
    toggleAnalytics: useGameStore.getState().toggleAnalytics,
    setDungeonData: useGameStore.getState().setDungeonData,
    setFps: useGameStore.getState().setFps,
    setEnemyAnalytics: useGameStore.getState().setEnemyAnalytics,
    setPlayerHealth: useGameStore.getState().setPlayerHealth,
    addScore: useGameStore.getState().addScore,
    setScreen: useGameStore.getState().setScreen,
    togglePause: useGameStore.getState().togglePause,
  });

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

    // Reset death/pause state
    playerDeadRef.current = false;
    isPausedRef.current = false;
    floorClearedRef.current = false;
    trapdoorDeathPendingRef.current = false;
    trapdoorDeathTimerRef.current = 0;
    trapdoorReturnPendingRef.current = false;
    trapdoorReturnTimerRef.current = 0;

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
        zoom: 1.0,
        deadzoneWidth: 0,
        deadzoneHeight: 0
      });
      cameraRef.current = camera;

      const input = InputManager.getInstance();
      input.init();

      // ── Load pixel-art assets ──────────────────────────────────────
      await loadTileset();
      if (signal.aborted) return;

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

      // ── Render tilemap ────────────────────────────────────────────
      const tilemapAnimRuntime = renderTilemap(
        worldContainer,
        dungeon.tiles,
        dungeon.width,
        dungeon.height,
        dungeon.tiledLayers,
        dungeon.tiledFirstGid,
      );
      markWaveSpearChunkNearExit(tilemapAnimRuntime, dungeon.exitPoint.x, dungeon.exitPoint.y);
      renderMarkers(worldContainer, dungeon);

      // ── Player ────────────────────────────────────────────────────
      const playerSprite = createPlayerSprite(selectedCharacter);
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
      playerRef.current.health = 100;
      playerRef.current.kills = 0;

      playerSprite.container.x = playerRef.current.pixelX;
      playerSprite.container.y = playerRef.current.pixelY;
      camera.snapTo(playerRef.current.pixelX, playerRef.current.pixelY);

      // ── Spawn enemies ─────────────────────────────────────────────
      // Use remaining character sprites as enemies + original archetypes
      const otherCharIndices = CHARACTER_DEFS
        .map((_, i) => i)
        .filter((i) => i !== selectedCharacter);

      const enemyTypes = getEnemyTypesForFloor(currentFloor);
      const maxEnemies = Math.min(dungeon.enemySpawnPoints.length, 6 + currentFloor * 3);
      const spawnPts = dungeon.enemySpawnPoints.slice(0, maxEnemies);

      // Spawn character-based enemies first (one per remaining character)
      let spawnIdx = 0;
      for (let ci = 0; ci < otherCharIndices.length && spawnIdx < spawnPts.length; ci++, spawnIdx++) {
        const pt = spawnPts[spawnIdx];
        const charIndex = otherCharIndices[ci];
        const type = enemyTypes[randomInt(0, enemyTypes.length - 1)];
        const genome = createRandomGenome(Math.max(0, currentFloor - 1));
        const enemy = createEnemy(type, pt.x, pt.y, genome);
        // Replace the enemy's sprite with a character sprite
        enemy.container.removeChildren();
        const charSprite = createCharacterEnemySprite(charIndex);
        for (const child of [...charSprite.container.children]) {
          enemy.container.addChild(child);
        }
        enemy.gameSprite = charSprite;
        enemy.container.zIndex = 10;
        worldContainer.addChild(enemy.container);
        enemiesRef.current.push(enemy);
      }

      // Spawn remaining enemies as normal archetypes
      for (; spawnIdx < spawnPts.length; spawnIdx++) {
        const pt = spawnPts[spawnIdx];
        const type = enemyTypes[randomInt(0, enemyTypes.length - 1)];
        const genome = createRandomGenome(Math.max(0, currentFloor - 1));
        const enemy = createEnemy(type, pt.x, pt.y, genome);
        enemy.container.zIndex = 10;
        worldContainer.addChild(enemy.container);
        enemiesRef.current.push(enemy);
      }

      showNotification(`Floor ${dungeon.floor} — ${dungeon.biome.toUpperCase()} — ${spawnPts.length} enemies!`);

      // ── Events ────────────────────────────────────────────────────
      const bus = EventBus.getInstance();
      const unsubNotif = bus.on(GameEvents.NOTIFICATION, (data: unknown) => {
        const d = data as { msg: string };
        showNotification(d.msg);
      });

      isLoadedRef.current = true;
      setIsLoaded(true);

      // ── Staggered path timers per enemy ───────────────────────────
      const pathTimers = new Map<string, number>();
      const PATH_INTERVAL = 0.6;

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
            storeActionsRef.current.setScreen('mainMenu');
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
            showNotification('💀 You died! Game Over');
            trapdoorReturnPendingRef.current = true;
            trapdoorReturnTimerRef.current = 1.5;
          }
          input.endFrame();
          return;
        }

        // ── PAUSE / DEATH CHECK ─────────────────────────────────
        if (input.isKeyJustPressed('escape')) {
          isPausedRef.current = !isPausedRef.current;
          storeActionsRef.current.togglePause();
        }
        if (isPausedRef.current || playerDeadRef.current) {
          input.endFrame();
          return;
        }

        // ── PLAYER MOVEMENT ───────────────────────────────────────
        const moveVec = input.getMovementVector();
        const moveX = moveVec.x;
        const moveY = moveVec.y;
        const moveSpeed = (p.state.isInvisible ? 200 : 160) * dtSeconds;

        if (moveX !== 0 || moveY !== 0) {
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
          const trapdoor = getTrapdoorAt(tilemapAnimRuntime, p.tileX, p.tileY);
          if (trapdoor && !trapdoor.isCollapsed) {
            triggerTrapdoorCollapseGroup(tilemapAnimRuntime, trapdoor);
            trapdoorDeathPendingRef.current = true;
            trapdoorDeathTimerRef.current = 0.75;
            showNotification('🕳️ Trapdoor opened!');
            input.endFrame();
            return;
          }

          p.attackCooldown = 0.4;
          playerAttackAnimTimer = 0.4;
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
          }
        }

        // ── VISION SYSTEM ──────────────────────────────────────────
        updateVision(
          enemiesRef.current, p.tileX, p.tileY,
          p.state.isInvisible || p.state.isHiding, grid, dt
        );

        // ── ENEMY AI + MOVEMENT ────────────────────────────────────
        for (const enemy of enemiesRef.current) {
          if (!enemy.isAlive) continue;

          let timer = pathTimers.get(enemy.id) ?? 0;
          timer -= dt;
          pathTimers.set(enemy.id, timer);

          if (timer <= 0) {
            pathTimers.set(enemy.id, PATH_INTERVAL + Math.random() * 0.3);

            let targetX = enemy.homeX;
            let targetY = enemy.homeY;

            if (enemy.alertState === AlertState.CHASING || enemy.alertState === AlertState.ALERT) {
              targetX = enemy.blackboard.lastKnownPlayerX >= 0
                ? enemy.blackboard.lastKnownPlayerX : p.tileX;
              targetY = enemy.blackboard.lastKnownPlayerY >= 0
                ? enemy.blackboard.lastKnownPlayerY : p.tileY;
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
              if (!enemy.patrolTarget || (enemy.tileX === enemy.patrolTarget.x && enemy.tileY === enemy.patrolTarget.y)) {
                enemy.patrolTarget = enemy.getPatrolTarget(grid);
              }
              if (enemy.patrolTarget) {
                targetX = enemy.patrolTarget.x;
                targetY = enemy.patrolTarget.y;
              }
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
              storeActionsRef.current.setPlayerHealth(p.health);

              p.sprite!.setTint?.(0xff4444);
              setTimeout(() => { p.sprite!.setTint?.(0xffffff); }, 200);

              if (p.health <= 0) {
                playerDeadRef.current = true;
                showNotification('💀 You died! Game Over');
                setTimeout(() => storeActionsRef.current.setScreen('mainMenu'), 2000);
              }
            }
          }
        }

        // ── REMOVE DEAD ENEMIES ────────────────────────────────────
        enemiesRef.current = enemiesRef.current.filter((e) => e.isAlive);

        // ── CHECK FLOOR COMPLETE ───────────────────────────────────
        if (isLoadedRef.current && enemiesRef.current.length === 0 && spawnPts.length > 0 && !floorClearedRef.current) {
          floorClearedRef.current = true;
          showNotification(`✅ Floor ${dungeon.floor} cleared! Find the exit (green glow)`);
          if (p.tileX === dungeon.exitPoint.x && p.tileY === dungeon.exitPoint.y) {
            showNotification('🚪 Next floor!');
          }
        }

        // ── TRAP DAMAGE ────────────────────────────────────────────
        const playerTile = dungeon.tiles[p.tileY]?.[p.tileX];
        const playerOnInteractiveSpear = isPlayerOnInteractiveSpear(tilemapAnimRuntime, p.tileX, p.tileY);
        if (playerTile === TileType.FLOOR_TRAP && !playerOnInteractiveSpear) {
          p.health = Math.max(0, p.health - 15 * dt);
          storeActionsRef.current.setPlayerHealth(Math.round(p.health));
          for (const enemy of enemiesRef.current) {
            if (enemy.tileX === p.tileX && enemy.tileY === p.tileY) {
              enemy.stun(1);
            }
          }
        }

        updateInteractiveTileAnimations(tilemapAnimRuntime, p.tileX, p.tileY, dtSeconds, (damage) => {
          p.health = Math.max(0, p.health - damage);
          storeActionsRef.current.setPlayerHealth(Math.round(p.health));
          if (p.health <= 0 && !playerDeadRef.current) {
            playerDeadRef.current = true;
            showNotification('💀 You died! Game Over');
            setTimeout(() => storeActionsRef.current.setScreen('mainMenu'), 2000);
          }
        });

        // ── ANALYTICS ──────────────────────────────────────────────
        if (analyticsTimer > 0.5) {
          analyticsTimer = 0;
          storeActionsRef.current.setEnemyAnalytics(
            enemiesRef.current.slice(0, 15).map((e) => e.getAnalyticsSnapshot())
          );
        }

        // ── DEBUG OVERLAYS ─────────────────────────────────────────
        drawDebugOverlays(debugOverlay, enemiesRef.current, p.tileX, p.tileY, showPathsRef.current, showFOVRef.current);

        // ── CAMERA ─────────────────────────────────────────────────
        camera.follow(p.pixelX, p.pixelY, dt);
        worldContainer.scale.set(camera.config.zoom);
        worldContainer.x = -camera.x * camera.config.zoom;
        worldContainer.y = -camera.y * camera.config.zoom;

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
  }, [currentFloor, selectedCharacter, selectedMap, showNotification]);

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

      {isLoaded && <PlayerHUD items={playerRef.current.items} />}
      {analyticsEnabled && <AIAnalyticsPanel />}

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
        }}>
          <div style={{ fontSize: '2rem', color: 'var(--gold)', marginBottom: '16px' }}>⏸ PAUSED</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Press <span style={{ color: '#88ff88' }}>Escape</span> to resume</div>
          <button
            className="btn btn-pixel"
            style={{ marginTop: '24px' }}
            onClick={() => storeActionsRef.current.setScreen('mainMenu')}
          >
            ← Main Menu
          </button>
        </div>
      )}

      {!isLoaded && (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">Generating dungeon...</div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TILEMAP RENDERER
// ══════════════════════════════════════════════════════════════════════

function renderTilemap(
  container: Container,
  tiles: number[][],
  w: number,
  h: number,
  tiledLayers?: TiledLayerData[],
  tiledFirstGid?: number,
): TilemapAnimRuntime {
  const runtime: TilemapAnimRuntime = {
    interactive: [],
    trapdoors: [],
    waveTimeMs: 0,
    nonWaveActiveGroupId: -1,
    nonWaveGroupHoldMs: 0,
    nonWaveGroupDamaged: false,
  };

  const tileContainer = new Container();
  tileContainer.label = 'tiles';
  tileContainer.zIndex = 0;

  // ── Tiled JSON map mode: render each layer using GID-based textures ──
  if (tiledLayers && tiledLayers.length > 0 && isTiledTilesetLoaded()) {
    const firstGid = tiledFirstGid ?? 1;

    for (const layer of tiledLayers) {
      const layerContainer = new Container();
      layerContainer.label = layer.name;

      for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
          const idx = y * layer.width + x;
          const rawGid = layer.data[idx];
          if (rawGid === 0) continue; // Empty tile in this layer

          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;

          // Check for Tiled animation on this tile
          const animFrames = getTiledTileAnimation(rawGid);
          if (animFrames && animFrames.length >= 2) {
            const cleanGid = stripTiledFlipFlags(rawGid);
            const animSprite = new AnimatedSprite(animFrames);
            animSprite.anchor.set(0.5);
            animSprite.x = px + TILE_SIZE / 2;
            animSprite.y = py + TILE_SIZE / 2;
            animSprite.width = TILE_SIZE;
            animSprite.height = TILE_SIZE;
            applyTiledFlipFlags(animSprite, rawGid);

            if (WOODEN_TRAPDOOR_ANIM_GIDS.has(cleanGid)) {
              // Slow down wooden trapdoor animation.
              animSprite.animationSpeed = 0.6;
            }

            const key = `${x},${y}`;
            if (CHEST_ANIM_GIDS.has(cleanGid)) {
              // Chest: play opening once, then stay open while player remains nearby.
              animSprite.loop = false;
              animSprite.gotoAndStop(0);
              runtime.interactive.push({
                key,
                tileX: x,
                tileY: y,
                kind: 'chest',
                sprite: animSprite,
                isActive: false,
                hasBeenOpened: false,
                hasTriggeredDamage: false,
                isWaveTrap: false,
                waveOffsetMs: 0,
                spearGroupId: -1,
                holdMs: 0,
              });
            } else if (SPEAR_TRAP_ANIM_GIDS.has(cleanGid)) {
              // Spear trap: play once after trigger; reset when player leaves tile.
              animSprite.loop = false;
              animSprite.gotoAndStop(0);
              runtime.interactive.push({
                key,
                tileX: x,
                tileY: y,
                kind: 'spear',
                sprite: animSprite,
                isActive: false,
                hasBeenOpened: false,
                hasTriggeredDamage: false,
                isWaveTrap: false,
                waveOffsetMs: 0,
                spearGroupId: -1,
                holdMs: 0,
              });
            } else if (WOODEN_TRAPDOOR_ANIM_GIDS.has(cleanGid)) {
              // Trapdoor stays closed until the player attacks while standing on it.
              animSprite.loop = false;
              animSprite.gotoAndStop(0);
              runtime.trapdoors.push({
                key,
                tileX: x,
                tileY: y,
                sprite: animSprite,
                isCollapsed: false,
              });
            } else {
              // Keep ambient animations globally synchronized.
              animSprite.loop = true;
              animSprite.gotoAndPlay(0);
            }

            layerContainer.addChild(animSprite);
          } else {
            const tex = getTiledTileTexture(rawGid, firstGid);
            if (tex) {
              const sprite = new Sprite(tex);
              sprite.anchor.set(0.5);
              sprite.x = px + TILE_SIZE / 2;
              sprite.y = py + TILE_SIZE / 2;
              sprite.width = TILE_SIZE;
              sprite.height = TILE_SIZE;
              applyTiledFlipFlags(sprite, rawGid);
              layerContainer.addChild(sprite);
            }
          }
        }
      }

      tileContainer.addChild(layerContainer);
    }

    container.addChild(tileContainer);
    return runtime;
  }

  // ── Legacy mode: render using TileType → tileset_v2.png mapping ──
  const useSpritesheet = isTilesetLoaded();

  if (useSpritesheet) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = tiles[y][x] as TileType;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        let tex: ReturnType<typeof getTileTexture>;

        if (tile === TileType.WALL) {
          tex = getWallTexture(x, y, tiles, w, h);
        } else {
          tex = getTileTexture(tile, x, y);
        }

        if (tex) {
          const sprite = new Sprite(tex);
          sprite.x = px;
          sprite.y = py;
          sprite.width = TILE_SIZE;
          sprite.height = TILE_SIZE;
          tileContainer.addChild(sprite);
        } else {
          const g = new Graphics();
          const color = TILE_COLORS[tile] ?? 0x0a0a0a;
          g.rect(px, py, TILE_SIZE, TILE_SIZE);
          g.fill({ color });
          tileContainer.addChild(g);
        }
      }
    }
  } else {
    const g = new Graphics();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = tiles[y][x] as TileType;
        const color = TILE_COLORS[tile] ?? 0x0a0a0a;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        g.rect(px, py, TILE_SIZE, TILE_SIZE);
        g.fill({ color });

        if (tile === TileType.WALL) {
          if (y + 1 < h && tiles[y + 1][x] !== TileType.WALL) {
            g.rect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
            g.fill({ color: WALL_TOP });
          }
          if (y > 0 && tiles[y - 1][x] !== TileType.WALL) {
            g.rect(px, py, TILE_SIZE, 2);
            g.fill({ color: 0x222238 });
          }
        }

        if (tile !== TileType.WALL) {
          g.rect(px, py, TILE_SIZE, 1);
          g.fill({ color: FLOOR_GRID_LINE, alpha: 0.4 });
          g.rect(px, py, 1, TILE_SIZE);
          g.fill({ color: FLOOR_GRID_LINE, alpha: 0.4 });
        }

        if (tile === TileType.FLOOR_TRAP) {
          g.moveTo(px + 4, py + 4);
          g.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE - 4);
          g.stroke({ color: 0xff2222, width: 2, alpha: 0.5 });
          g.moveTo(px + TILE_SIZE - 4, py + 4);
          g.lineTo(px + 4, py + TILE_SIZE - 4);
          g.stroke({ color: 0xff2222, width: 2, alpha: 0.5 });
        }

        if (tile === TileType.FLOOR_WATER) {
          g.rect(px + 4, py + 12, TILE_SIZE - 8, 2);
          g.fill({ color: 0x3388cc, alpha: 0.4 });
          g.rect(px + 10, py + 22, TILE_SIZE - 20, 2);
          g.fill({ color: 0x3388cc, alpha: 0.3 });
        }

        if (tile === TileType.FLOOR_MUD) {
          g.circle(px + 10, py + 14, 4);
          g.fill({ color: 0x4a3410, alpha: 0.4 });
          g.circle(px + 22, py + 20, 3);
          g.fill({ color: 0x4a3410, alpha: 0.3 });
        }
      }
    }
    tileContainer.addChild(g);
  }

  container.addChild(tileContainer);
  return runtime;
}

function applyTiledFlipFlags(sprite: Sprite | AnimatedSprite, rawGid: number) {
  const gid = rawGid >>> 0;
  const flipH = (gid & FLIPPED_HORIZONTALLY_FLAG) !== 0;
  const flipV = (gid & FLIPPED_VERTICALLY_FLAG) !== 0;
  const flipD = (gid & FLIPPED_DIAGONALLY_FLAG) !== 0;

  // Reset transform baseline first.
  sprite.rotation = 0;
  const baseScaleX = Math.abs(sprite.scale.x);
  const baseScaleY = Math.abs(sprite.scale.y);
  let sx = 1;
  let sy = 1;
  let rot = 0;

  // Tiled orthogonal flip decoding, including diagonal flag.
  if (flipD) {
    if (flipH && flipV) {
      rot = Math.PI / 2;
      sx = -1;
    } else if (flipH) {
      rot = Math.PI / 2;
    } else if (flipV) {
      rot = -Math.PI / 2;
    } else {
      rot = -Math.PI / 2;
      sx = -1;
    }
  } else {
    sx = flipH ? -1 : 1;
    sy = flipV ? -1 : 1;
  }

  sprite.scale.set(baseScaleX * sx, baseScaleY * sy);
  sprite.rotation = rot;
}

function updateInteractiveTileAnimations(
  runtime: TilemapAnimRuntime,
  playerTileX: number,
  playerTileY: number,
  dtSeconds: number,
  onSpearTrapHit: (damage: number) => void,
) {
  if (runtime.interactive.length === 0) return;

  const dtMs = dtSeconds * 1000;
  runtime.waveTimeMs += dtMs;

  const NON_WAVE_TRIGGER_MS = 500;
  const WAVE_PERIOD_MS = 1200;
  const WAVE_ACTIVE_MS = 350;

  const standingOnNonWaveSpear = runtime.interactive.find((tile) => (
    tile.kind === 'spear' &&
    !tile.isWaveTrap &&
    tile.tileX === playerTileX &&
    tile.tileY === playerTileY
  ));
  const activeNonWaveGroupId = standingOnNonWaveSpear?.spearGroupId ?? -1;

  if (activeNonWaveGroupId >= 0) {
    if (runtime.nonWaveActiveGroupId === activeNonWaveGroupId) {
      runtime.nonWaveGroupHoldMs += dtMs;
    } else {
      runtime.nonWaveActiveGroupId = activeNonWaveGroupId;
      runtime.nonWaveGroupHoldMs = dtMs;
      runtime.nonWaveGroupDamaged = false;
    }
  } else {
    runtime.nonWaveActiveGroupId = -1;
    runtime.nonWaveGroupHoldMs = 0;
    runtime.nonWaveGroupDamaged = false;
  }

  const nonWavePrimed =
    runtime.nonWaveActiveGroupId >= 0 &&
    runtime.nonWaveGroupHoldMs >= NON_WAVE_TRIGGER_MS;

  for (const tile of runtime.interactive) {
    if (tile.kind === 'chest') {
      if (tile.hasBeenOpened) {
        tile.isActive = false;
        continue;
      }

      const dx = tile.tileX - playerTileX;
      const dy = tile.tileY - playerTileY;
      const near = Math.sqrt(dx * dx + dy * dy) <= 1.5;

      if (near) {
        if (!tile.isActive) {
          tile.isActive = true;
          tile.hasBeenOpened = true;
          tile.sprite.gotoAndPlay(0);
        }
      }
      continue;
    }

    // Non-wave spear traps animate as a connected nearby group.
    if (tile.spearGroupId >= 0 && !tile.isWaveTrap) {
      const shouldBeActive =
        nonWavePrimed &&
        activeNonWaveGroupId >= 0 &&
        tile.spearGroupId === activeNonWaveGroupId;

      if (shouldBeActive) {
        if (!tile.isActive) {
          tile.isActive = true;
          tile.sprite.gotoAndPlay(0);
        }
      } else {
        tile.holdMs = 0;
        tile.hasTriggeredDamage = false;
        if (tile.isActive) {
          tile.isActive = false;
          tile.sprite.gotoAndStop(0);
        }
      }
      continue;
    }

    // Spear trap
    if (tile.isWaveTrap) {
      const phase = (runtime.waveTimeMs + tile.waveOffsetMs) % WAVE_PERIOD_MS;
      const isWaveActive = phase < WAVE_ACTIVE_MS;

      if (isWaveActive && !tile.isActive) {
        tile.isActive = true;
        tile.sprite.gotoAndPlay(0);
      } else if (!isWaveActive && tile.isActive) {
        tile.isActive = false;
        tile.hasTriggeredDamage = false;
        tile.sprite.gotoAndStop(0);
      }

      const standingOnTrap = tile.tileX === playerTileX && tile.tileY === playerTileY;
      if (isWaveActive && standingOnTrap && !tile.hasTriggeredDamage) {
        tile.hasTriggeredDamage = true;
        onSpearTrapHit(999);
      }
      continue;
    }
  }

  if (nonWavePrimed && activeNonWaveGroupId >= 0 && !runtime.nonWaveGroupDamaged) {
    runtime.nonWaveGroupDamaged = true;
    onSpearTrapHit(5);
  }
}

function isPlayerOnInteractiveSpear(
  runtime: TilemapAnimRuntime,
  playerTileX: number,
  playerTileY: number,
): boolean {
  return runtime.interactive.some((tile) => (
    tile.kind === 'spear' && tile.tileX === playerTileX && tile.tileY === playerTileY
  ));
}

function getTrapdoorAt(
  runtime: TilemapAnimRuntime,
  playerTileX: number,
  playerTileY: number,
): TrapdoorTileAnim | null {
  return runtime.trapdoors.find((tile) => (
    tile.tileX === playerTileX && tile.tileY === playerTileY
  )) ?? null;
}

function triggerTrapdoorCollapse(tile: TrapdoorTileAnim) {
  tile.isCollapsed = true;
  tile.sprite.loop = false;
  tile.sprite.gotoAndPlay(0);

  const openFrame = Math.max(0, tile.sprite.totalFrames - 1);
  tile.sprite.onFrameChange = (currentFrame) => {
    if (currentFrame >= openFrame) {
      tile.sprite.gotoAndStop(openFrame);
      tile.sprite.onFrameChange = undefined;
    }
  };
}

function triggerTrapdoorCollapseGroup(runtime: TilemapAnimRuntime, seed: TrapdoorTileAnim) {
  const byKey = new Map<string, TrapdoorTileAnim>();
  for (const tile of runtime.trapdoors) {
    byKey.set(tile.key, tile);
  }

  const stack: TrapdoorTileAnim[] = [seed];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    if (!current.isCollapsed) {
      triggerTrapdoorCollapse(current);
    }

    const neighbors = [
      `${current.tileX + 1},${current.tileY}`,
      `${current.tileX - 1},${current.tileY}`,
      `${current.tileX},${current.tileY + 1}`,
      `${current.tileX},${current.tileY - 1}`,
    ];

    for (const key of neighbors) {
      const n = byKey.get(key);
      if (n && !visited.has(key)) {
        stack.push(n);
      }
    }
  }
}

function markWaveSpearChunkNearExit(
  runtime: TilemapAnimRuntime,
  exitTileX: number,
  exitTileY: number,
) {
  const spearTiles = runtime.interactive.filter((tile) => tile.kind === 'spear');
  if (spearTiles.length < 2) return;

  const byKey = new Map<string, InteractiveTileAnim>();
  for (const tile of spearTiles) {
    byKey.set(tile.key, tile);
  }

  const visited = new Set<string>();
  const components: InteractiveTileAnim[][] = [];

  for (const start of spearTiles) {
    if (visited.has(start.key)) continue;

    const stack: InteractiveTileAnim[] = [start];
    const component: InteractiveTileAnim[] = [];
    visited.add(start.key);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);

      const neighbors = [
        `${current.tileX + 1},${current.tileY}`,
        `${current.tileX - 1},${current.tileY}`,
        `${current.tileX},${current.tileY + 1}`,
        `${current.tileX},${current.tileY - 1}`,
      ];

      for (const key of neighbors) {
        const n = byKey.get(key);
        if (!n || visited.has(key)) continue;
        visited.add(key);
        stack.push(n);
      }
    }

    components.push(component);
  }

  if (components.length === 0) return;

  for (let i = 0; i < components.length; i++) {
    for (const tile of components[i]) {
      tile.spearGroupId = i;
    }
  }

  const candidates = components.filter((c) => c.length >= 3);
  if (candidates.length === 0) return;

  // Skip components touching the exit tile vicinity (e.g. the single spear near exit).
  const safeCandidates = candidates.filter((c) => (
    !c.some((t) => Math.abs(t.tileX - exitTileX) <= 1 && Math.abs(t.tileY - exitTileY) <= 1)
  ));

  const pool = safeCandidates.length > 0 ? safeCandidates : candidates;

  // Prefer the most right-side spear group near the new right-side exit.
  let selected = pool[0];
  let selectedAvgX = pool[0].reduce((sum, t) => sum + t.tileX, 0) / pool[0].length;

  for (let i = 1; i < pool.length; i++) {
    const c = pool[i];
    const avgX = c.reduce((sum, t) => sum + t.tileX, 0) / c.length;
    if (avgX > selectedAvgX) {
      selected = c;
      selectedAvgX = avgX;
    }
  }

  const maxX = Math.max(...selected.map((t) => t.tileX));
  for (const tile of selected) {
    tile.isWaveTrap = true;
    tile.waveOffsetMs = (maxX - tile.tileX) * 120;
    tile.sprite.gotoAndStop(0);
  }
}

// ══════════════════════════════════════════════════════════════════════
// MARKERS
// ══════════════════════════════════════════════════════════════════════

function renderMarkers(container: Container, dungeon: Awaited<ReturnType<typeof generateDungeon>>) {
  const exit = new Graphics();
  exit.circle(dungeon.exitPoint.x * TILE_SIZE + 16, dungeon.exitPoint.y * TILE_SIZE + 16, 14);
  exit.fill({ color: 0x22ff66, alpha: 0.25 });
  exit.circle(dungeon.exitPoint.x * TILE_SIZE + 16, dungeon.exitPoint.y * TILE_SIZE + 16, 8);
  exit.fill({ color: 0x22ff66, alpha: 0.5 });
  exit.zIndex = 3;
  container.addChild(exit);

  const exitLabel = new Text({
    text: 'EXIT',
    style: new TextStyle({ fontFamily: 'Press Start 2P', fontSize: 7, fill: 0x22ff66 }),
  });
  exitLabel.x = dungeon.exitPoint.x * TILE_SIZE + 4;
  exitLabel.y = dungeon.exitPoint.y * TILE_SIZE - 10;
  exitLabel.zIndex = 20;
  container.addChild(exitLabel);

  for (const pt of dungeon.treasurePoints) {
    const gem = new Graphics();
    gem.star(pt.x * TILE_SIZE + 16, pt.y * TILE_SIZE + 16, 5, 6, 12);
    gem.fill({ color: 0xffd700 });
    gem.zIndex = 3;
    container.addChild(gem);
  }

  const style = new TextStyle({ fontFamily: 'Press Start 2P', fontSize: 9, fill: 0xc8a850 });
  const lbl = new Text({ text: `Floor ${dungeon.floor} — ${dungeon.biome.toUpperCase()}`, style });
  lbl.x = dungeon.spawnPoint.x * TILE_SIZE - 60;
  lbl.y = dungeon.spawnPoint.y * TILE_SIZE - 30;
  lbl.zIndex = 20;
  container.addChild(lbl);
}

// ══════════════════════════════════════════════════════════════════════
// DEBUG OVERLAYS
// ══════════════════════════════════════════════════════════════════════

function drawDebugOverlays(
  g: Graphics,
  enemies: EnemyBase[],
  _playerTileX: number,
  _playerTileY: number,
  showPaths: boolean,
  showFOV: boolean,
) {
  g.clear();

  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;

    const algoColor = ALGORITHM_COLORS[enemy.getActiveAlgorithm()];

    const alertColors: Record<string, number> = {
      [AlertState.IDLE]: 0x44dd44,
      [AlertState.SUSPICIOUS]: 0xffaa00,
      [AlertState.ALERT]: 0xff8800,
      [AlertState.CHASING]: 0xff2222,
      [AlertState.FLEEING]: 0x4488ff,
    };
    const alertColor = alertColors[enemy.alertState] ?? 0xffffff;
    g.circle(enemy.pixelX, enemy.pixelY - 22, 3);
    g.fill({ color: alertColor });

    if (showPaths && enemy.currentPath.length > 0) {
      const visiblePath = enemy.currentPath.slice(enemy.pathIndex);
      if (visiblePath.length > 0) {
        g.moveTo(enemy.pixelX, enemy.pixelY);
        for (const pt of visiblePath) {
          g.lineTo(pt.x * TILE_SIZE + TILE_SIZE / 2, pt.y * TILE_SIZE + TILE_SIZE / 2);
        }
        g.stroke({ color: algoColor, width: 2, alpha: 0.5 });

        const last = visiblePath[visiblePath.length - 1];
        g.circle(last.x * TILE_SIZE + TILE_SIZE / 2, last.y * TILE_SIZE + TILE_SIZE / 2, 4);
        g.fill({ color: algoColor, alpha: 0.5 });
      }
    }

    if (showFOV) {
      g.circle(enemy.pixelX, enemy.pixelY, enemy.visionRange * TILE_SIZE);
      g.fill({ color: algoColor, alpha: enemy.alertState === AlertState.CHASING ? 0.08 : 0.03 });
      g.stroke({ color: algoColor, width: 1, alpha: 0.15 });
    }
  }
}
function addScore(arg0: number) {
  throw new Error('Function not implemented.');
}

