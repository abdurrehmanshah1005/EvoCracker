// ========================
// GameScreen — REWRITTEN with working combat, enemy AI, and clear visuals
// ========================

import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle, Sprite, AnimatedSprite } from 'pixi.js';
import { useGameStore } from '@store/gameStore';
import { InputManager } from '@core/InputManager';
import { Camera } from '@core/Camera';
import { Grid } from '@ai/pathfinding/Grid';
import { generateDungeon, getBiomeForFloor } from '@game/world/DungeonGenerator';
import { TILE_SIZE, TileType, GRID_COLS, GRID_ROWS, ALGORITHM_COLORS, AlertState, EnemyType } from '@utils/constants';
import { AIAnalyticsPanel } from '@ui/analytics/AIAnalyticsPanel';
import { PlayerHUD } from '@ui/hud/PlayerHUD';
import { createPlayerSprite, initSpriteAssets } from '@core/SpriteFactory';
import { createEnemy, getEnemyTypesForFloor } from '@game/entities/enemies/Archetypes';
import { updateVision } from '@game/systems/VisionSystem';
import { createDefaultItemLoadout, updateItems, type PlayerState } from '@game/entities/items/ItemSystem';
import { createRandomGenome } from '@ai/evolution/GeneticAlgorithm';
import { EventBus, GameEvents } from '@core/EventBus';
import type { EnemyBase } from '@game/entities/enemies/EnemyBase';
import { randomInt } from '@utils/random';
import { loadTileset, isTilesetLoaded, getTileTexture, getWallTexture, loadItemAnimations } from '@core/DungeonTilesetLoader';

// ===== MUCH BETTER TILE COLORS — High contrast ==========================
const TILE_COLORS: Record<number, number> = {
  [TileType.FLOOR_STONE]: 0x3a3a52,   // Visible grey-purple floor
  [TileType.WALL]:        0x111118,    // Very dark walls
  [TileType.FLOOR_MUD]:   0x5a4420,    // Clearly brown mud
  [TileType.FLOOR_WATER]: 0x1a4070,    // Blue water
  [TileType.FLOOR_TRAP]:  0x6a1818,    // Red-tinted trap
  [TileType.DOOR]:        0x6a5a30,    // Gold-ish door
  [TileType.STAIRS_DOWN]: 0x20aa50,    // Bright green exit
  [TileType.STAIRS_UP]:   0x3050aa,    // Blue entry
  [TileType.TREASURE]:    0xaa8820,    // Gold treasure
  [TileType.FLOOR_GRASS]: 0x2a5a2a,    // Green grass
  [TileType.FLOOR_SAND]:  0x6a6a30,    // Sandy yellow
  [TileType.BRIDGE]:      0x5a3a1a,    // Brown wood
};

// Wall top face for 3D depth
const WALL_TOP = 0x1a1a28;
// Floor border for grid visibility
const FLOOR_GRID_LINE = 0x2a2a40;

export function GameScreen() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const enemiesRef = useRef<EnemyBase[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Player state ref
  const playerRef = useRef({
    tileX: 0, tileY: 0,
    pixelX: 0, pixelY: 0,
    sprite: null as ReturnType<typeof createPlayerSprite> | null,
    health: 100, maxHealth: 100,
    attackCooldown: 0,
    attackDamage: 20,
    attackRange: 2, // tiles
    items: createDefaultItemLoadout(),
    kills: 0,
    state: {
      tileX: 0, tileY: 0,
      isHiding: false, stealthLevel: 0.5,
      tilePenalty: 0, tilePenaltyTimer: 0,
      isInvisible: false, invisibleTimer: 0,
    } as PlayerState,
  });

  // Attack visual ref
  const attackVisualRef = useRef<Graphics | null>(null);

  const {
    currentFloor, analyticsEnabled, toggleAnalytics,
    setDungeonData, setFps, setEnemyAnalytics, setPlayerHealth, addScore,
    showPaths, showFOV,
    setScreen, selectedCharacter,
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
      backgroundColor: 0x060610,
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

    // ── Load pixel-art assets ──────────────────────────────────────
    await loadTileset();
    await initSpriteAssets();
    const itemAnims = await loadItemAnimations();

    // ── Containers ─────────────────────────────────────────────────
    const worldContainer = new Container();
    worldContainer.label = 'world';
    worldContainer.sortableChildren = true;
    app.stage.addChild(worldContainer);

    // Overlay for debug drawings (paths, FOV, attack)
    const debugOverlay = new Graphics();
    debugOverlay.zIndex = 50;
    worldContainer.addChild(debugOverlay);

    // Attack visual layer
    const attackLayer = new Graphics();
    attackLayer.zIndex = 45;
    worldContainer.addChild(attackLayer);
    attackVisualRef.current = attackLayer;

    // ── Generate dungeon ──────────────────────────────────────────
    const biome = getBiomeForFloor(currentFloor);
    const dungeon = generateDungeon(GRID_COLS, GRID_ROWS, currentFloor, biome);
    setDungeonData(dungeon);
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
    renderTilemap(worldContainer, dungeon.tiles, dungeon.width, dungeon.height);
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
    const enemyTypes = getEnemyTypesForFloor(currentFloor);
    const maxEnemies = Math.min(dungeon.enemySpawnPoints.length, 6 + currentFloor * 3);
    const spawnPts = dungeon.enemySpawnPoints.slice(0, maxEnemies);

    for (const pt of spawnPts) {
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

    setIsLoaded(true);

    // ── Staggered path timers per enemy ───────────────────────────
    const pathTimers = new Map<string, number>();
    const PATH_INTERVAL = 0.6; // seconds between repath for each enemy

    let fpsCounter = 0;
    let fpsTimer = 0;
    let analyticsTimer = 0;
    let attackVisualTimer = 0;

    // ══════════════════════════════════════════════════════════════
    // GAME LOOP
    // ══════════════════════════════════════════════════════════════
    app.ticker.add((ticker) => {
      const dt = ticker.deltaTime / 60; // seconds
      fpsCounter++; fpsTimer += dt; analyticsTimer += dt;

      // FPS
      if (fpsTimer >= 1) {
        setFps(Math.round(fpsCounter / fpsTimer));
        fpsCounter = 0; fpsTimer = 0;
      }

      // ── PLAYER MOVEMENT ───────────────────────────────────────
      const p = playerRef.current;
      const moveVec = input.getMovementVector();
      const moveSpeed = (p.state.isInvisible ? 200 : 160) * dt;

      if (moveVec.x !== 0 || moveVec.y !== 0) {
        const newX = p.pixelX + moveVec.x * moveSpeed;
        const newY = p.pixelY + moveVec.y * moveSpeed;
        const ntx = Math.floor(newX / TILE_SIZE);
        const nty = Math.floor(newY / TILE_SIZE);
        const node = grid.getNode(ntx, nty);

        if (node && node.walkable) {
          p.pixelX = newX;
          p.pixelY = newY;
          p.tileX = ntx;
          p.tileY = nty;
          p.state.tileX = ntx;
          p.state.tileY = nty;
        }

        p.sprite?.setAnimation('walk');
        if (moveVec.x < 0) p.sprite?.setFlipX(true);
        if (moveVec.x > 0) p.sprite?.setFlipX(false);
      } else {
        p.sprite?.setAnimation('idle');
      }

      p.sprite!.container.x = p.pixelX;
      p.sprite!.container.y = p.pixelY;
      p.sprite?.setAlpha(p.state.isInvisible ? 0.3 : 1);

      // ── PLAYER ATTACK (E key or Space) ─────────────────────────
      if (p.attackCooldown > 0) p.attackCooldown -= dt;

      if ((input.isKeyJustPressed('e') || input.isKeyJustPressed(' ')) && p.attackCooldown <= 0) {
        p.attackCooldown = 0.4;
        p.sprite?.setAnimation('attack');

        // Find enemies in attack range
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
              addScore(100 + currentFloor * 50);
              showNotification(`⚔️ Killed ${enemy.type}! +${100 + currentFloor * 50} pts`);
            }
          }
        }

        // Attack visual — circle slash
        attackVisualTimer = 0.2;
        attackLayer.clear();
        attackLayer.circle(p.pixelX, p.pixelY, p.attackRange * TILE_SIZE);
        attackLayer.stroke({ color: hitCount > 0 ? 0xff4444 : 0x44ddff, width: 2, alpha: 0.6 });
        attackLayer.circle(p.pixelX, p.pixelY, 8);
        attackLayer.fill({ color: 0xffffff, alpha: 0.4 });
      }

      // Fade attack visual
      if (attackVisualTimer > 0) {
        attackVisualTimer -= dt;
        if (attackVisualTimer <= 0) attackLayer.clear();
      }

      // ── ITEMS ──────────────────────────────────────────────────
      updateItems(p.items, p.state, dt);
      for (let i = 0; i < 4; i++) {
        if (input.isKeyJustPressed(String(i + 1))) {
          const item = p.items[i];
          if (item && item.currentCooldown <= 0) {
            item.use(p.state, enemiesRef.current, grid);
            item.currentCooldown = item.cooldown;
          }
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

        // Staggered pathing
        let timer = pathTimers.get(enemy.id) ?? 0;
        timer -= dt;
        pathTimers.set(enemy.id, timer);

        if (timer <= 0) {
          pathTimers.set(enemy.id, PATH_INTERVAL + Math.random() * 0.3);

          // Decide target based on alert state
          let targetX = enemy.homeX;
          let targetY = enemy.homeY;

          if (enemy.alertState === AlertState.CHASING || enemy.alertState === AlertState.ALERT) {
            // Chase player or last-known position
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
            // IDLE — Random patrol near home
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

        // Update enemy (moves along path, lerps position)
        enemy.update(dt, grid, p.tileX, p.tileY);

        // ── Enemy attacks player on contact ──────────────────────
        if (!p.state.isInvisible && enemy.attackTimer <= 0) {
          const edx = enemy.tileX - p.tileX;
          const edy = enemy.tileY - p.tileY;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist <= 1.5) {
            enemy.attackTimer = enemy.attackCooldown;
            const dmg = enemy.attackDamage;
            enemy.performance.damageDealt += dmg;
            p.health = Math.max(0, p.health - dmg);
            setPlayerHealth(p.health);

            // Damage flash on player
            p.sprite!.container.tint = 0xff4444;
            setTimeout(() => { p.sprite!.container.tint = 0xffffff; }, 200);

            if (p.health <= 0) {
              showNotification('💀 You died! Game Over');
              setTimeout(() => setScreen('mainMenu'), 2000);
            }
          }
        }
      }

      // ── REMOVE DEAD ENEMIES ────────────────────────────────────
      enemiesRef.current = enemiesRef.current.filter((e) => e.isAlive);

      // ── CHECK FLOOR COMPLETE (all enemies dead) ────────────────
      if (isLoaded && enemiesRef.current.length === 0 && spawnPts.length > 0) {
        showNotification(`✅ Floor ${dungeon.floor} cleared! Find the exit (green glow)`);
        // Check if player is on exit
        if (p.tileX === dungeon.exitPoint.x && p.tileY === dungeon.exitPoint.y) {
          showNotification('🚪 Next floor!');
          // In a real implementation you'd regenerate here
        }
      }

      // ── TRAP DAMAGE ────────────────────────────────────────────
      const playerTile = dungeon.tiles[p.tileY]?.[p.tileX];
      if (playerTile === TileType.FLOOR_TRAP) {
        p.health = Math.max(0, p.health - 15 * dt);
        setPlayerHealth(Math.round(p.health));
        // Stun nearby enemies too
        for (const enemy of enemiesRef.current) {
          if (enemy.tileX === p.tileX && enemy.tileY === p.tileY) {
            enemy.stun(1);
          }
        }
      }

      // ── ANALYTICS ──────────────────────────────────────────────
      if (analyticsTimer > 0.5) {
        analyticsTimer = 0;
        setEnemyAnalytics(
          enemiesRef.current.slice(0, 15).map((e) => e.getAnalyticsSnapshot())
        );
      }

      // ── DEBUG OVERLAYS ─────────────────────────────────────────
      drawDebugOverlays(debugOverlay, enemiesRef.current, p.tileX, p.tileY, showPaths, showFOV);

      // ── CAMERA ─────────────────────────────────────────────────
      camera.follow(p.pixelX, p.pixelY, dt);
      worldContainer.x = -camera.x;
      worldContainer.y = -camera.y;

      const worldMouse = camera.screenToWorld(input.getState().mouse.x, input.getState().mouse.y);
      input.setWorldMouse(worldMouse.x, worldMouse.y);

      // ── HOTKEYS ────────────────────────────────────────────────
      if (input.isKeyJustPressed('`')) toggleAnalytics();
      if (input.isKeyJustPressed('escape')) setScreen('mainMenu');

      input.endFrame();
    });

    // ── Resize ────────────────────────────────────────────────────
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
  }, [currentFloor, setDungeonData, setFps, toggleAnalytics, setEnemyAnalytics, setPlayerHealth, showPaths, showFOV, showNotification, addScore, setScreen, selectedCharacter]);

  useEffect(() => {
    const cleanup = initGame();
    return () => { cleanup.then((fn) => fn?.()); };
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
          <span style={{ color: '#ff4466' }}>E/Space</span> Attack &nbsp;
          <span style={{ color: '#ffd700' }}>1-4</span> Items &nbsp;
          <span style={{ color: '#aa66ff' }}>`</span> AI Panel
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
// TILEMAP RENDERER — Uses pixel-art tileset when available
// ══════════════════════════════════════════════════════════════════════

function renderTilemap(container: Container, tiles: number[][], w: number, h: number) {
  const tileContainer = new Container();
  tileContainer.label = 'tiles';
  tileContainer.zIndex = 0;

  const useSpritesheet = isTilesetLoaded();

  if (useSpritesheet) {
    // ── REAL SPRITE TILES ──────────────────────────────────────────
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
          // Fallback for unmapped tiles
          const g = new Graphics();
          const color = TILE_COLORS[tile] ?? 0x0a0a0a;
          g.rect(px, py, TILE_SIZE, TILE_SIZE);
          g.fill({ color });
          tileContainer.addChild(g);
        }
      }
    }
  } else {
    // ── FALLBACK: Graphics-based colored tiles ─────────────────────
    const g = new Graphics();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = tiles[y][x] as TileType;
        const color = TILE_COLORS[tile] ?? 0x0a0a0a;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        g.rect(px, py, TILE_SIZE, TILE_SIZE);
        g.fill({ color });

        // Wall 3D depth
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

        // Floor grid lines
        if (tile !== TileType.WALL) {
          g.rect(px, py, TILE_SIZE, 1);
          g.fill({ color: FLOOR_GRID_LINE, alpha: 0.4 });
          g.rect(px, py, 1, TILE_SIZE);
          g.fill({ color: FLOOR_GRID_LINE, alpha: 0.4 });
        }

        // Trap warning pattern
        if (tile === TileType.FLOOR_TRAP) {
          g.moveTo(px + 4, py + 4);
          g.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE - 4);
          g.stroke({ color: 0xff2222, width: 2, alpha: 0.5 });
          g.moveTo(px + TILE_SIZE - 4, py + 4);
          g.lineTo(px + 4, py + TILE_SIZE - 4);
          g.stroke({ color: 0xff2222, width: 2, alpha: 0.5 });
        }

        // Water shimmer
        if (tile === TileType.FLOOR_WATER) {
          g.rect(px + 4, py + 12, TILE_SIZE - 8, 2);
          g.fill({ color: 0x3388cc, alpha: 0.4 });
          g.rect(px + 10, py + 22, TILE_SIZE - 20, 2);
          g.fill({ color: 0x3388cc, alpha: 0.3 });
        }

        // Mud splotch
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
}

// ══════════════════════════════════════════════════════════════════════
// MARKERS — Exit, treasure, floor label (with pixel-art sprites)
// ══════════════════════════════════════════════════════════════════════

function renderMarkers(container: Container, dungeon: ReturnType<typeof generateDungeon>) {
  // Exit — pulsing green glow + label
  const exit = new Graphics();
  exit.circle(dungeon.exitPoint.x * TILE_SIZE + 16, dungeon.exitPoint.y * TILE_SIZE + 16, 14);
  exit.fill({ color: 0x22ff66, alpha: 0.25 });
  exit.circle(dungeon.exitPoint.x * TILE_SIZE + 16, dungeon.exitPoint.y * TILE_SIZE + 16, 8);
  exit.fill({ color: 0x22ff66, alpha: 0.5 });
  exit.zIndex = 3;
  container.addChild(exit);

  // Stairs text
  const exitLabel = new Text({
    text: 'EXIT',
    style: new TextStyle({ fontFamily: 'Press Start 2P', fontSize: 7, fill: 0x22ff66 }),
  });
  exitLabel.x = dungeon.exitPoint.x * TILE_SIZE + 4;
  exitLabel.y = dungeon.exitPoint.y * TILE_SIZE - 10;
  exitLabel.zIndex = 20;
  container.addChild(exitLabel);

  // Treasure — golden diamonds (kept as fallback; real chest sprites loaded async separately)
  for (const pt of dungeon.treasurePoints) {
    const gem = new Graphics();
    gem.star(pt.x * TILE_SIZE + 16, pt.y * TILE_SIZE + 16, 5, 6, 12);
    gem.fill({ color: 0xffd700 });
    gem.zIndex = 3;
    container.addChild(gem);
  }

  // Floor label at spawn
  const style = new TextStyle({ fontFamily: 'Press Start 2P', fontSize: 9, fill: 0xc8a850 });
  const lbl = new Text({ text: `Floor ${dungeon.floor} — ${dungeon.biome.toUpperCase()}`, style });
  lbl.x = dungeon.spawnPoint.x * TILE_SIZE - 60;
  lbl.y = dungeon.spawnPoint.y * TILE_SIZE - 30;
  lbl.zIndex = 20;
  container.addChild(lbl);
}

// ══════════════════════════════════════════════════════════════════════
// DEBUG OVERLAYS — paths, FOV cones, alert indicators
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

    // Alert state indicator — floating colored dot above enemy
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

    // Path trail
    if (showPaths && enemy.currentPath.length > 0) {
      const visiblePath = enemy.currentPath.slice(enemy.pathIndex);
      if (visiblePath.length > 0) {
        g.moveTo(enemy.pixelX, enemy.pixelY);
        for (const pt of visiblePath) {
          g.lineTo(pt.x * TILE_SIZE + TILE_SIZE / 2, pt.y * TILE_SIZE + TILE_SIZE / 2);
        }
        g.stroke({ color: algoColor, width: 2, alpha: 0.5 });

        // Endpoint marker
        const last = visiblePath[visiblePath.length - 1];
        g.circle(last.x * TILE_SIZE + TILE_SIZE / 2, last.y * TILE_SIZE + TILE_SIZE / 2, 4);
        g.fill({ color: algoColor, alpha: 0.5 });
      }
    }

    // FOV range circle
    if (showFOV) {
      g.circle(enemy.pixelX, enemy.pixelY, enemy.visionRange * TILE_SIZE);
      g.fill({ color: algoColor, alpha: enemy.alertState === AlertState.CHASING ? 0.08 : 0.03 });
      g.stroke({ color: algoColor, width: 1, alpha: 0.15 });
    }
  }
}
