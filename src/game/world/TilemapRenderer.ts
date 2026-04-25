import { Container, Graphics, Text, TextStyle, Sprite, AnimatedSprite } from 'pixi.js';
import { TILE_SIZE, TileType, ALGORITHM_COLORS, AlertState } from '@utils/constants';
import { generateDungeon, type TiledLayerData } from '@game/world/DungeonGenerator';
import { getTileTexture, getWallTexture, getTiledTileTexture, isTiledTilesetLoaded, getTiledTileAnimation, stripTiledFlipFlags, isTilesetLoaded } from '@core/DungeonTilesetLoader';
import type { EnemyBase } from '@game/entities/enemies/EnemyBase';

const TEMP_EASY_GA_TEST_MODE = false;
const TILE_COLORS: Record<number, number> = { [TileType.FLOOR_STONE]: 0x3a3a52, [TileType.WALL]: 0x111118, [TileType.FLOOR_MUD]: 0x5a4420, [TileType.FLOOR_WATER]: 0x1a4070, [TileType.FLOOR_TRAP]: 0x6a1818, [TileType.DOOR]: 0x6a5a30, [TileType.STAIRS_DOWN]: 0x20aa50, [TileType.STAIRS_UP]: 0x3050aa, [TileType.TREASURE]: 0xaa8820, [TileType.FLOOR_GRASS]: 0x2a5a2a, [TileType.FLOOR_SAND]: 0x6a6a30, [TileType.BRIDGE]: 0x5a3a1a };
const WALL_TOP = 0x1a1a28;
const FLOOR_GRID_LINE = 0x2a2a40;
const CHEST_ANIM_GIDS = new Set<number>([626, 642]);
const SPEAR_TRAP_ANIM_GIDS = new Set<number>([255]);
const WOODEN_TRAPDOOR_ANIM_GIDS = new Set<number>([208, 209, 233, 234]);
const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;

export type InteractiveAnimKind = 'chest' | 'spear';

export interface InteractiveTileAnim {
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

export interface TrapdoorTileAnim {
  key: string;
  tileX: number;
  tileY: number;
  sprite: AnimatedSprite;
  isCollapsed: boolean;
}

export interface TilemapAnimRuntime {
  interactive: InteractiveTileAnim[];
  trapdoors: TrapdoorTileAnim[];
  waveTimeMs: number;
  nonWaveActiveGroupId: number;
  nonWaveGroupHoldMs: number;
  nonWaveGroupDamaged: boolean;
}


// ══════════════════════════════════════════════════════════════════════
// TILEMAP RENDERER
// ══════════════════════════════════════════════════════════════════════

export function renderTilemap(
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

export function applyTiledFlipFlags(sprite: Sprite | AnimatedSprite, rawGid: number) {
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

export function updateInteractiveTileAnimations(
  runtime: TilemapAnimRuntime,
  playerTileX: number,
  playerTileY: number,
  dtSeconds: number,
  difficultyMultiplier: number,
  onSpearTrapHit: (damage: number) => void,
) {
  if (runtime.interactive.length === 0) return;

  const dtMs = dtSeconds * 1000;
  runtime.waveTimeMs += dtMs;

  const difficulty = Math.max(1, difficultyMultiplier);
  const difficultyT = Math.min(1, (difficulty - 1) / 2);
  const testModeSlowFactor = TEMP_EASY_GA_TEST_MODE ? 3.1 : 1;

  // Base difficulty should be forgiving; higher difficulty speeds traps up.
  const NON_WAVE_TRIGGER_MS = Math.round((700 - 220 * difficultyT) * testModeSlowFactor);
  const WAVE_PERIOD_MS = Math.round((1900 - 700 * difficultyT) * testModeSlowFactor);
  const WAVE_ACTIVE_MS = Math.round((260 + 90 * difficultyT) * (TEMP_EASY_GA_TEST_MODE ? 0.7 : 1));

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

export function isPlayerOnInteractiveSpear(
  runtime: TilemapAnimRuntime,
  playerTileX: number,
  playerTileY: number,
): boolean {
  return runtime.interactive.some((tile) => (
    tile.kind === 'spear' && tile.tileX === playerTileX && tile.tileY === playerTileY
  ));
}

export function getTrapdoorAt(
  runtime: TilemapAnimRuntime,
  playerTileX: number,
  playerTileY: number,
): TrapdoorTileAnim | null {
  return runtime.trapdoors.find((tile) => (
    tile.tileX === playerTileX && tile.tileY === playerTileY
  )) ?? null;
}

export function triggerTrapdoorCollapse(tile: TrapdoorTileAnim) {
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

export function triggerTrapdoorCollapseGroup(runtime: TilemapAnimRuntime, seed: TrapdoorTileAnim) {
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

export function markWaveSpearChunkNearExit(
  runtime: TilemapAnimRuntime,
  exitTileX: number,
  exitTileY: number,
  difficultyMultiplier: number,
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

  const difficulty = Math.max(1, difficultyMultiplier);
  const difficultyT = Math.min(1, (difficulty - 1) / 2);
  const testModeWaveOffsetFactor = TEMP_EASY_GA_TEST_MODE ? 3.4 : 1;
  const perTileOffsetMs = Math.round((190 - 80 * difficultyT) * testModeWaveOffsetFactor);

  const maxX = Math.max(...selected.map((t) => t.tileX));
  for (const tile of selected) {
    tile.isWaveTrap = true;
    tile.waveOffsetMs = (maxX - tile.tileX) * perTileOffsetMs;
    tile.sprite.gotoAndStop(0);
  }
}

// ══════════════════════════════════════════════════════════════════════
// MARKERS
// ══════════════════════════════════════════════════════════════════════

export function renderMarkers(container: Container, dungeon: Awaited<ReturnType<typeof generateDungeon>>) {
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

export function drawDebugOverlays(
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

