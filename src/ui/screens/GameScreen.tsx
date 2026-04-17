// ========================
// GameScreen — Full game loop with enemies, vision, items, and overlays
// ========================

import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useGameStore } from '@store/gameStore';
import { InputManager } from '@core/InputManager';
import { Camera } from '@core/Camera';
import { Grid } from '@ai/pathfinding/Grid';
import { generateDungeon, getBiomeForFloor } from '@game/world/DungeonGenerator';
import { TILE_SIZE, TileType, GRID_COLS, GRID_ROWS, ALGORITHM_COLORS, AlertState } from '@utils/constants';
import { AIAnalyticsPanel } from '@ui/analytics/AIAnalyticsPanel';
import { PlayerHUD } from '@ui/hud/PlayerHUD';
import { createPlayerSprite } from '@core/SpriteFactory';
import { createEnemy, getEnemyTypesForFloor } from '@game/entities/enemies/Archetypes';
import { updateVision } from '@game/systems/VisionSystem';
import { createDefaultItemLoadout, updateItems, type PlayerState } from '@game/entities/items/ItemSystem';
import { createRandomGenome } from '@ai/evolution/GeneticAlgorithm';
import { EventBus, GameEvents } from '@core/EventBus';
import type { EnemyBase } from '@game/entities/enemies/EnemyBase';
import { lerp } from '@utils/math';
import { randomInt } from '@utils/random';

// Tile colors per biome/type
const TILE_COLORS: Record<number, number> = {
  [TileType.FLOOR_STONE]: 0x252535,
  [TileType.WALL]:        0x0d0d18,
  [TileType.FLOOR_MUD]:   0x3d2e14,
  [TileType.FLOOR_WATER]: 0x142540,
  [TileType.FLOOR_TRAP]:  0x4a1010,
  [TileType.DOOR]:        0x2e2e12,
  [TileType.STAIRS_DOWN]: 0x183018,
  [TileType.STAIRS_UP]:   0x181838,
  [TileType.TREASURE]:    0x4a3c10,
  [TileType.FLOOR_GRASS]: 0x142a14,
  [TileType.FLOOR_SAND]:  0x3a3a18,
  [TileType.BRIDGE]:      0x2a1e0e,
};

const WALL_TOP_COLOR = 0x161625;

export function GameScreen() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const enemiesRef = useRef<EnemyBase[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playerRef = useRef({
    tileX: 0, tileY: 0,
    pixelX: 0, pixelY: 0,
    sprite: null as ReturnType<typeof createPlayerSprite> | null,
    health: 100,
    maxHealth: 100,
    isHiding: false,
    items: createDefaultItemLoadout(),
    state: {
      tileX: 0, tileY: 0,
      isHiding: false,
      stealthLevel: 0.5,
      tilePenalty: 0,
      tilePenaltyTimer: 0,
      isInvisible: false,
      invisibleTimer: 0,
    } as PlayerState,
  });

  const overlayRef = useRef<Graphics | null>(null);

  const {
    currentFloor, analyticsEnabled, toggleAnalytics,
    setDungeonData, setFps, setEnemyAnalytics, setPlayerHealth,
    showPaths, showFOV, showGrid, playerHealth,
  } = useGameStore();

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  const initGame = useCallback(async () => {
    if (!canvasRef.current || appRef.current) return;

    const app = new Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x08080f,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    canvasRef.current.appendChild(app.canvas);
    appRef.current = app;

    const camera = new Camera({ viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
    cameraRef.current = camera;

    const input = InputManager.getInstance();
    input.init();

    // World + UI containers
    const worldContainer = new Container();
    worldContainer.label = 'world';
    worldContainer.sortableChildren = true;
    app.stage.addChild(worldContainer);

    const overlayContainer = new Container();
    overlayContainer.label = 'overlay';
    overlayContainer.zIndex = 50;
    worldContainer.addChild(overlayContainer);

    const overlay = new Graphics();
    overlayContainer.addChild(overlay);
    overlayRef.current = overlay;

    // Generate dungeon
    const biome = getBiomeForFloor(currentFloor);
    const dungeon = generateDungeon(GRID_COLS, GRID_ROWS, currentFloor, biome);
    setDungeonData(dungeon);

    camera.setWorldBounds(dungeon.width * TILE_SIZE, dungeon.height * TILE_SIZE);

    // Build pathfinding grid
    const grid = new Grid(dungeon.width, dungeon.height);
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        grid.setTile(x, y, dungeon.tiles[y][x]);
      }
    }
    gridRef.current = grid;

    // Render tilemap
    renderTilemap(worldContainer, dungeon.tiles, dungeon.width, dungeon.height);

    // Place special markers
    renderMarkers(worldContainer, dungeon);

    // Create player
    const playerSprite = createPlayerSprite();
    playerSprite.container.zIndex = 15;
    worldContainer.addChild(playerSprite.container);

    playerRef.current.tileX = dungeon.spawnPoint.x;
    playerRef.current.tileY = dungeon.spawnPoint.y;
    playerRef.current.pixelX = dungeon.spawnPoint.x * TILE_SIZE + TILE_SIZE / 2;
    playerRef.current.pixelY = dungeon.spawnPoint.y * TILE_SIZE + TILE_SIZE / 2;
    playerRef.current.sprite = playerSprite;
    playerRef.current.state.tileX = dungeon.spawnPoint.x;
    playerRef.current.state.tileY = dungeon.spawnPoint.y;

    playerSprite.container.x = playerRef.current.pixelX;
    playerSprite.container.y = playerRef.current.pixelY;

    camera.snapTo(playerRef.current.pixelX, playerRef.current.pixelY);

    // Spawn enemies
    const enemyTypes = getEnemyTypesForFloor(currentFloor);
    const spawnPts = dungeon.enemySpawnPoints.slice(0, Math.min(dungeon.enemySpawnPoints.length, 8 + currentFloor * 2));

    for (const pt of spawnPts) {
      const type = enemyTypes[randomInt(0, enemyTypes.length - 1)];
      const genome = createRandomGenome(Math.max(0, currentFloor - 1));
      const enemy = createEnemy(type, pt.x, pt.y, genome);
      enemy.container.zIndex = 10;
      worldContainer.addChild(enemy.container);
      enemiesRef.current.push(enemy);
    }

    // Event listeners
    const bus = EventBus.getInstance();
    const unsubNotif = bus.on(GameEvents.NOTIFICATION, (data: unknown) => {
      const d = data as { msg: string };
      showNotification(d.msg);
    });

    setIsLoaded(true);

    // Pathing request timer (staggered so not all enemies repath same frame)
    const pathTimers = new Map<string, number>();
    const PATH_INTERVAL = 0.4; // seconds between path requests per enemy

    let fpsCounter = 0;
    let fpsTimer = 0;
    let analyticsTimer = 0;

    app.ticker.add((ticker) => {
      const dt = ticker.deltaTime / 60;
      fpsCounter++; fpsTimer += dt; analyticsTimer += dt;

      if (fpsTimer >= 1) {
        setFps(Math.round(fpsCounter / fpsTimer));
        fpsCounter = 0; fpsTimer = 0;
      }

      // ── Player movement ───────────────────────────────────────────
      const moveVec = input.getMovementVector();
      const speed = (playerRef.current.state.isInvisible ? 180 : 150) * dt;

      if (moveVec.x !== 0 || moveVec.y !== 0) {
        const newPixelX = playerRef.current.pixelX + moveVec.x * speed;
        const newPixelY = playerRef.current.pixelY + moveVec.y * speed;

        const tileX = Math.floor(newPixelX / TILE_SIZE);
        const tileY = Math.floor(newPixelY / TILE_SIZE);

        const node = grid.getNode(tileX, tileY);
        if (node && node.walkable) {
          playerRef.current.pixelX = newPixelX;
          playerRef.current.pixelY = newPixelY;
          playerRef.current.tileX = tileX;
          playerRef.current.tileY = tileY;
          playerRef.current.state.tileX = tileX;
          playerRef.current.state.tileY = tileY;
        }
        playerRef.current.sprite?.setAnimation('walk');
        if (moveVec.x < 0) playerRef.current.sprite?.setFlipX(true);
        if (moveVec.x > 0) playerRef.current.sprite?.setFlipX(false);
      } else {
        playerRef.current.sprite?.setAnimation('idle');
      }

      playerRef.current.sprite!.container.x = playerRef.current.pixelX;
      playerRef.current.sprite!.container.y = playerRef.current.pixelY;

      // Ghost cloak visual
      playerRef.current.sprite?.setAlpha(playerRef.current.state.isInvisible ? 0.35 : 1);

      // ── Items ─────────────────────────────────────────────────────
      updateItems(playerRef.current.items, playerRef.current.state, dt);

      // Item use (keys 1-4)
      for (let i = 0; i < 4; i++) {
        if (input.isKeyJustPressed(String(i + 1))) {
          const item = playerRef.current.items[i];
          if (item && item.currentCooldown <= 0) {
            item.use(playerRef.current.state, enemiesRef.current, grid);
            item.currentCooldown = item.cooldown;
          }
        }
      }

      // ── Vision ───────────────────────────────────────────────────
      updateVision(
        enemiesRef.current,
        playerRef.current.tileX,
        playerRef.current.tileY,
        playerRef.current.state.isInvisible || playerRef.current.state.isHiding,
        grid,
        dt
      );

      // ── Enemy AI update ───────────────────────────────────────────
      for (const enemy of enemiesRef.current) {
        if (!enemy.isAlive) continue;

        // Staggered pathfinding requests
        const pTimer = (pathTimers.get(enemy.id) ?? 0) - dt;
        pathTimers.set(enemy.id, pTimer);

        if (pTimer <= 0) {
          pathTimers.set(enemy.id, PATH_INTERVAL + Math.random() * 0.2);

          // Decide target based on alert state
          let targetX = enemy.homeX;
          let targetY = enemy.homeY;

          if (enemy.alertState === AlertState.CHASING || enemy.alertState === AlertState.ALERT) {
            targetX = enemy.blackboard.lastKnownPlayerX >= 0
              ? enemy.blackboard.lastKnownPlayerX
              : enemy.homeX;
            targetY = enemy.blackboard.lastKnownPlayerY >= 0
              ? enemy.blackboard.lastKnownPlayerY
              : enemy.homeY;
          } else if (enemy.alertState === AlertState.FLEEING) {
            // Flee away from player
            const dx = enemy.tileX - playerRef.current.tileX;
            const dy = enemy.tileY - playerRef.current.tileY;
            targetX = Math.max(1, Math.min(dungeon.width - 2, enemy.tileX + dx * 5));
            targetY = Math.max(1, Math.min(dungeon.height - 2, enemy.tileY + dy * 5));
          }

          enemy.requestPath(grid, targetX, targetY);
        }

        enemy.update(dt, grid, playerRef.current.tileX, playerRef.current.tileY);

        // Damage player on contact
        const edx = Math.abs(enemy.tileX - playerRef.current.tileX);
        const edy = Math.abs(enemy.tileY - playerRef.current.tileY);
        if (edx <= 1 && edy <= 1 && !playerRef.current.state.isInvisible && enemy.attackTimer <= 0) {
          const dmg = enemy.attackDamage;
          enemy.attackTimer = enemy.attackCooldown;
          enemy.performance.damageDealt += dmg;
          const newHp = Math.max(0, playerRef.current.health - dmg);
          playerRef.current.health = newHp;
          setPlayerHealth(newHp);
        }
      }

      // Remove dead enemies
      const alive = enemiesRef.current.filter((e) => e.isAlive);
      enemiesRef.current = alive;

      // ── Analytics update ──────────────────────────────────────────
      if (analyticsTimer > 0.5) {
        analyticsTimer = 0;
        setEnemyAnalytics(
          enemiesRef.current.slice(0, 15).map((e) => e.getAnalyticsSnapshot())
        );
      }

      // ── Debug / Analytics Overlays ────────────────────────────────
      if (appRef.current) {
        drawOverlays(
          overlay,
          enemiesRef.current,
          playerRef.current.tileX,
          playerRef.current.tileY,
          showPaths,
          showFOV,
          showGrid,
          grid
        );
      }

      // ── Camera ────────────────────────────────────────────────────
      camera.follow(playerRef.current.pixelX, playerRef.current.pixelY, dt);
      worldContainer.x = -camera.x;
      worldContainer.y = -camera.y;

      const worldMouse = camera.screenToWorld(
        input.getState().mouse.x,
        input.getState().mouse.y
      );
      input.setWorldMouse(worldMouse.x, worldMouse.y);

      // Toggle keys
      if (input.isKeyJustPressed('`')) toggleAnalytics();

      // Escape = pause
      if (input.isKeyJustPressed('escape')) {
        bus.emit(GameEvents.GAME_PAUSE);
      }

      input.endFrame();
    });

    const onResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      camera.setViewport(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      unsubNotif();
      window.removeEventListener('resize', onResize);
      input.destroy();
      app.destroy(true);
      appRef.current = null;
      enemiesRef.current = [];
    };
  }, [currentFloor, setDungeonData, setFps, toggleAnalytics, setEnemyAnalytics, setPlayerHealth, showPaths, showFOV, showGrid, showNotification]);

  useEffect(() => {
    const cleanup = initGame();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [initGame]);

  return (
    <div className="game-screen">
      <div ref={canvasRef} className="game-canvas-wrapper" />

      {isLoaded && (
        <PlayerHUD items={playerRef.current.items} />
      )}

      {analyticsEnabled && <AIAnalyticsPanel />}

      {notification && (
        <div className="toast-container">
          <div className="toast toast-info">{notification}</div>
        </div>
      )}

      {!isLoaded && (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">Spawning enemies...</div>
        </div>
      )}
    </div>
  );
}

// ── Tilemap renderer ───────────────────────────────────────────────────

function renderTilemap(container: Container, tiles: number[][], w: number, h: number) {
  const g = new Graphics();
  g.label = 'tiles';
  g.zIndex = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tile = tiles[y][x] as TileType;
      const color = TILE_COLORS[tile] ?? 0x0a0a0a;
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      g.rect(px, py, TILE_SIZE, TILE_SIZE);
      g.fill({ color });

      // Wall top face (makes walls look 3D)
      if (tile === TileType.WALL) {
        if (y + 1 < h && tiles[y + 1][x] !== TileType.WALL) {
          g.rect(px, py + TILE_SIZE - 3, TILE_SIZE, 3);
          g.fill({ color: WALL_TOP_COLOR });
        }
      }

      // Tile accent lines (grid texture)
      if (tile !== TileType.WALL) {
        g.rect(px, py, TILE_SIZE, 1);
        g.fill({ color: 0xffffff, alpha: 0.015 });
        g.rect(px, py, 1, TILE_SIZE);
        g.fill({ color: 0xffffff, alpha: 0.015 });
      }

      // Water shimmer
      if (tile === TileType.FLOOR_WATER) {
        g.rect(px + 4, py + 10, TILE_SIZE - 8, 2);
        g.fill({ color: 0x2255aa, alpha: 0.3 });
        g.rect(px + 8, py + 18, TILE_SIZE - 16, 2);
        g.fill({ color: 0x2255aa, alpha: 0.2 });
      }
    }
  }

  container.addChild(g);
}

// ── Special markers ────────────────────────────────────────────────────

function renderMarkers(container: Container, dungeon: ReturnType<typeof generateDungeon>) {
  // Exit glow
  const exit = new Graphics();
  exit.circle(dungeon.exitPoint.x * TILE_SIZE + 16, dungeon.exitPoint.y * TILE_SIZE + 16, 12);
  exit.fill({ color: 0x44ff88, alpha: 0.25 });
  exit.zIndex = 3;
  container.addChild(exit);

  // Treasure stars
  for (const pt of dungeon.treasurePoints) {
    const gem = new Graphics();
    gem.star(pt.x * TILE_SIZE + 16, pt.y * TILE_SIZE + 16, 5, 7, 14);
    gem.fill({ color: 0xffd700 });
    gem.zIndex = 3;
    container.addChild(gem);
  }

  // Floor label
  const style = new TextStyle({ fontFamily: 'Press Start 2P', fontSize: 9, fill: 0xc8a850 });
  const lbl = new Text({ text: `Floor ${dungeon.floor} — ${dungeon.biome.toUpperCase()}`, style });
  lbl.x = dungeon.spawnPoint.x * TILE_SIZE - 50;
  lbl.y = dungeon.spawnPoint.y * TILE_SIZE - 28;
  lbl.zIndex = 20;
  container.addChild(lbl);
}

// ── Debug / Analytics Overlays ─────────────────────────────────────────

function drawOverlays(
  g: Graphics,
  enemies: EnemyBase[],
  playerTileX: number,
  playerTileY: number,
  showPaths: boolean,
  showFOV: boolean,
  showGrid: boolean,
  grid: Grid
) {
  g.clear();

  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;

    const algoColor = ALGORITHM_COLORS[enemy.getActiveAlgorithm()];

    // Path trail
    if (showPaths && enemy.currentPath.length > 0) {
      const visiblePath = enemy.currentPath.slice(enemy.pathIndex);
      if (visiblePath.length > 1) {
        g.moveTo(
          enemy.pixelX,
          enemy.pixelY
        );
        for (const pt of visiblePath) {
          g.lineTo(pt.x * TILE_SIZE + TILE_SIZE / 2, pt.y * TILE_SIZE + TILE_SIZE / 2);
        }
        g.stroke({ color: algoColor, width: 1.5, alpha: 0.5 });

        // Expanding ripple for BFS
        if (enemy.getActiveAlgorithm() === 'BFS' && enemy.alertState === AlertState.CHASING) {
          const px = enemy.pixelX;
          const py = enemy.pixelY;
          const r = (Date.now() % 1200) / 1200 * enemy.visionRange * TILE_SIZE;
          g.circle(px, py, r);
          g.stroke({ color: algoColor, width: 1, alpha: 0.25 - r / (enemy.visionRange * TILE_SIZE * 4) });
        }

        // A* "Fate Line" — gold beam directly to player
        if (enemy.getActiveAlgorithm() === 'AStar' && enemy.alertState === AlertState.CHASING) {
          const px = enemy.pixelX;
          const py = enemy.pixelY;
          const tx = playerTileX * TILE_SIZE + TILE_SIZE / 2;
          const ty = playerTileY * TILE_SIZE + TILE_SIZE / 2;
          g.moveTo(px, py);
          g.lineTo(tx, ty);
          g.stroke({ color: 0xffd700, width: 2, alpha: 0.35 });
        }
      }
    }

    // FOV cone
    if (showFOV) {
      const px = enemy.pixelX;
      const py = enemy.pixelY;
      const r = enemy.visionRange * TILE_SIZE;
      g.circle(px, py, r);
      const alertAlpha = enemy.alertState === AlertState.CHASING ? 0.12 : 0.05;
      g.fill({ color: algoColor, alpha: alertAlpha });

      // Alert state ring
      if (enemy.alertState !== AlertState.IDLE) {
        g.circle(px, py, 10);
        g.fill({ color: algoColor, alpha: 0.3 });
      }
    }
  }

  // Grid weight overlay
  if (showGrid) {
    const WEIGHT_COLORS: Record<number, number> = {
      1: 0x00ff00, 2: 0xaaff00, 3: 0xffaa00, 5: 0xff6600, 8: 0xff2200,
    };
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const node = grid.getNode(x, y);
        if (node && node.walkable && node.weight > 1) {
          const col = WEIGHT_COLORS[node.weight] ?? 0xff0000;
          g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.fill({ color: col, alpha: 0.25 });
        }
      }
    }
  }
}
