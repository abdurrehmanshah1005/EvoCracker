// ========================
// DungeonTilesetLoader — Loads pixel-art tileset and parses into tile textures
//
// Supports two modes:
// 1. Tiled JSON map mode: renders tiles by GID from dungeon_tileset.png
// 2. Legacy mode: maps TileType enum to grid positions on tileset_v2.png
// ========================

import { Assets, Texture, Rectangle } from 'pixi.js';
import { TileType } from '@utils/constants';

// ── Legacy tileset (tileset_v2.png) — used for procedurally generated floors ──
const LEGACY_TILE_COLUMNS = 8;
let legacyTilePx = 16;
const LEGACY_TILESET_PATH = 'assets/dungeon-pack/tileset_v2.png';

// ── Tiled map tilesets — used for JSON map floors ──
// Primary tileset (dungeon_tileset.png) and secondary tilesets (e.g. Chest.png)
const TILED_TILESET_PATH = 'assets/dungeon-pack/dungeon_tileset.png';
const CHEST_TILESET_PATH = 'assets/dungeon-pack/Chest.png';

// ── Tileset coordinate map for legacy mode ──────────────────────────
interface TileRegion {
  col: number;
  row: number;
}

// Map TileType → position(s) on the legacy spritesheet
const TILE_MAP: Record<number, TileRegion[]> = {
  // Floors — pick from floor region
  [TileType.FLOOR_STONE]: [
    { col: 1, row: 0 },  // Path
  ],
  [TileType.WALL]: [
    { col: 4, row: 0 },
    { col: 5, row: 0 },
    { col: 6, row: 0 },
    { col: 7, row: 0 },
  ],
  [TileType.FLOOR_MUD]: [
    { col: 3, row: 3 },  // Darker floor variant as mud
  ],
  [TileType.FLOOR_WATER]: [
    { col: 4, row: 5 },  // Water-ish tile
  ],
  [TileType.FLOOR_TRAP]: [
    { col: 1, row: 3 },  // Base floor (peaks overlay added separately)
  ],
  [TileType.DOOR]: [
    { col: 4, row: 7 },  // Door tile
  ],
  [TileType.STAIRS_DOWN]: [
    { col: 3, row: 7 },  // Stairs down
  ],
  [TileType.STAIRS_UP]: [
    { col: 2, row: 7 },  // Stairs up
  ],
  [TileType.TREASURE]: [
    { col: 1, row: 3 },  // Base floor (chest overlay added separately)
  ],
  [TileType.FLOOR_GRASS]: [
    { col: 1, row: 4 },  // Floor variant as grass
  ],
  [TileType.FLOOR_SAND]: [
    { col: 2, row: 4 },  // Floor variant as sand
  ],
  [TileType.BRIDGE]: [
    { col: 3, row: 4 },  // Bridge-like floor
  ],
};

// ── Multi-tileset entry for Tiled maps ──────────────────────────────
export interface TiledTilesetEntry {
  firstGid: number;
  texture: Texture;
  columns: number;
  tilePx: number;
  sourceKey: string;
}

// ── Tiled animation frame definition ────────────────────────────────
export interface TiledAnimFrame {
  /** Local tile ID within the tileset */
  tileId: number;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface TiledAnimDef {
  /** The local tile ID that has the animation */
  localTileId: number;
  /** The firstGid of the tileset this animation belongs to */
  firstGid: number;
  /** Animation frames */
  frames: TiledAnimFrame[];
}

export interface TiledTilesetConfig {
  firstGid: number;
  imagePath: string;
  tileWidth?: number;
  source?: string;
}


// ── Animation data parsed from TSX tileset files ────────────────────
const DUNGEON_TILESET_ANIMS: { localId: number; frames: TiledAnimFrame[] }[] = [
  { localId: 207, frames: [{ tileId: 207, durationMs: 200 }, { tileId: 157, durationMs: 100 }] },
  { localId: 208, frames: [{ tileId: 208, durationMs: 200 }, { tileId: 158, durationMs: 100 }] },
  { localId: 232, frames: [{ tileId: 232, durationMs: 200 }, { tileId: 182, durationMs: 100 }] },
  { localId: 233, frames: [{ tileId: 233, durationMs: 200 }, { tileId: 183, durationMs: 100 }] },
  { localId: 254, frames: [
    { tileId: 254, durationMs: 100 }, { tileId: 229, durationMs: 100 },
    { tileId: 229, durationMs: 100 },
    { tileId: 254, durationMs: 300 },
  ]},
];

const CHEST_TILESET_ANIMS: { localId: number; frames: TiledAnimFrame[] }[] = [
  { localId: 0,  frames: [{ tileId: 16, durationMs: 200 }, { tileId: 22, durationMs: 500 }] },
  { localId: 16, frames: [
    { tileId: 16, durationMs: 500 }, { tileId: 22, durationMs: 500 },
    { tileId: 16, durationMs: 100 },
  ]},
];

const VELMORA_TRAP_TILESET_ANIMS: { localId: number; frames: TiledAnimFrame[] }[] = [
  { localId: 0, frames: [
    { tileId: 0, durationMs: 110 },
    { tileId: 1, durationMs: 110 },
    { tileId: 2, durationMs: 110 },
    { tileId: 3, durationMs: 500 },
    { tileId: 2, durationMs: 110 },
    { tileId: 1, durationMs: 110 },
    { tileId: 0, durationMs: 110 },
  ]},
];

const VELMORA_DOOR_TILESET_ANIMS: { localId: number; frames: TiledAnimFrame[] }[] = [
  { localId: 73, frames: [
    { tileId: 73, durationMs: 110 },
    { tileId: 77, durationMs: 110 },
    { tileId: 81, durationMs: 110 },
    { tileId: 85, durationMs: 110 },
    { tileId: 87, durationMs: 500 },
    { tileId: 85, durationMs: 110 },
    { tileId: 81, durationMs: 110 },
    { tileId: 77, durationMs: 110 },
    { tileId: 73, durationMs: 110 },
  ]},
];

const DUNGEON_TILESET_SOURCE_KEYS = new Set<string>(['dungeon2', 'dungeon_tileset']);
const CHEST_TILESET_SOURCE_KEYS = new Set<string>(['chest']);
const VELMORA_TRAP_TILESET_SOURCE_KEYS = new Set<string>(['velmorarealms-traps_free']);
const VELMORA_DOOR_TILESET_SOURCE_KEYS = new Set<string>(['velmorarealms-doors_free']);
const CHEST_LOCAL_IDS = new Set<number>([0, 16]);
const DUNGEON_SPEAR_TRAP_LOCAL_IDS = new Set<number>([254]);
const VELMORA_SPEAR_TRAP_LOCAL_IDS = new Set<number>([0]);
const WOODEN_TRAPDOOR_LOCAL_IDS = new Set<number>([207, 208, 232, 233]);
const GATE_LOCAL_IDS = new Set<number>([73]);

/**
 * Map from global GID → animation definition.
 * Built once during loadTileset().
 */
const animationMap = new Map<number, TiledAnimDef>();
const chestAnimGids = new Set<number>();
const spearTrapGids = new Set<number>();
const woodenTrapdoorGids = new Set<number>();
const gateAnimGids = new Set<number>();

// ── State ───────────────────────────────────────────────────────────
let legacyTilesetTexture: Texture | null = null;
let tiledTilesetTexture: Texture | null = null;
let tiledTilesetColumns = 0;
let tiledTilePx = 16; // Tiled maps use 16×16 tiles

/** All loaded Tiled tilesets, sorted by firstGid ascending */
let tiledTilesets: TiledTilesetEntry[] = [];

const legacyTextureCache = new Map<string, Texture>();
const tiledTextureCache = new Map<number, Texture>();
let tilesetLoadRevision = 0;

function getCacheBustedPath(basePath: string): string {
  if (import.meta.env.DEV) {
    return `${basePath}?v=${tilesetLoadRevision}`;
  }
  return basePath;
}

function normalizeTilesetSourceKey(source: string): string {
  const normalized = source.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() ?? normalized;
  return filename.replace(/\.[^.]+$/, '').toLowerCase();
}

function registerTileRoleGids(entry: TiledTilesetEntry) {
  if (CHEST_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    for (const localId of CHEST_LOCAL_IDS) {
      chestAnimGids.add(entry.firstGid + localId);
    }
  }

  if (DUNGEON_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    for (const localId of DUNGEON_SPEAR_TRAP_LOCAL_IDS) {
      spearTrapGids.add(entry.firstGid + localId);
    }
    for (const localId of WOODEN_TRAPDOOR_LOCAL_IDS) {
      woodenTrapdoorGids.add(entry.firstGid + localId);
    }
  }

  if (VELMORA_TRAP_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    for (const localId of VELMORA_SPEAR_TRAP_LOCAL_IDS) {
      spearTrapGids.add(entry.firstGid + localId);
    }
  }

  if (VELMORA_DOOR_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    for (const localId of GATE_LOCAL_IDS) {
      gateAnimGids.add(entry.firstGid + localId);
    }
  }
}

function registerTilesetAnimations(entry: TiledTilesetEntry) {
  let animationDefs: { localId: number; frames: TiledAnimFrame[] }[] | null = null;

  if (DUNGEON_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    animationDefs = DUNGEON_TILESET_ANIMS;
  } else if (CHEST_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    animationDefs = CHEST_TILESET_ANIMS;
  } else if (VELMORA_TRAP_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    animationDefs = VELMORA_TRAP_TILESET_ANIMS;
  } else if (VELMORA_DOOR_TILESET_SOURCE_KEYS.has(entry.sourceKey)) {
    animationDefs = VELMORA_DOOR_TILESET_ANIMS;
  }

  if (!animationDefs) return;

  for (const anim of animationDefs) {
    const globalGid = anim.localId + entry.firstGid;
    animationMap.set(globalGid, {
      localTileId: anim.localId,
      firstGid: entry.firstGid,
      frames: anim.frames,
    });
  }
}

/**
 * Load the legacy tileset spritesheet (tileset_v2.png). Call once during game init.
 */
export async function loadTileset(tiledTilesetConfigs: TiledTilesetConfig[] = []): Promise<boolean> {
  tilesetLoadRevision += 1;
  legacyTextureCache.clear();
  tiledTextureCache.clear();
  legacyTilesetTexture = null;
  tiledTilesetTexture = null;
  tiledTilesets = [];
  animationMap.clear();
  chestAnimGids.clear();
  spearTrapGids.clear();
  woodenTrapdoorGids.clear();
  gateAnimGids.clear();

  let legacyOk = false;
  let tiledOk = false;

  // Load legacy tileset
  try {
    const loadPath = getCacheBustedPath(LEGACY_TILESET_PATH);
    legacyTilesetTexture = await Assets.load(loadPath) as Texture;
    legacyTilesetTexture.source.scaleMode = 'nearest';
    const loadedWidth = legacyTilesetTexture.width;
    legacyTilePx = Math.max(1, Math.floor(loadedWidth / LEGACY_TILE_COLUMNS));
    console.info(`[DungeonTilesetLoader] Loaded legacy tileset: ${LEGACY_TILESET_PATH}`);
    legacyOk = true;
  } catch {
    console.warn('[DungeonTilesetLoader] tileset_v2.png not found, using fallback colors');
  }

  const configs = tiledTilesetConfigs.length > 0
    ? tiledTilesetConfigs
    : [
        { firstGid: 1, imagePath: TILED_TILESET_PATH, tileWidth: 16, source: 'dungeon2.tsx' },
        { firstGid: 626, imagePath: CHEST_TILESET_PATH, tileWidth: 16, source: 'Chest.tsx' },
      ];

  for (const config of configs) {
    try {
      const loadPath = getCacheBustedPath(config.imagePath);
      const texture = await Assets.load(loadPath) as Texture;
      texture.source.scaleMode = 'nearest';

      const tilePx = Math.max(1, config.tileWidth ?? 16);
      const columns = Math.max(1, Math.floor(texture.width / tilePx));
      const sourceKey = normalizeTilesetSourceKey(config.source ?? config.imagePath);
      const entry: TiledTilesetEntry = {
        firstGid: config.firstGid,
        texture,
        columns,
        tilePx,
        sourceKey,
      };

      if (!tiledTilesetTexture) {
        tiledTilesetTexture = texture;
        tiledTilePx = tilePx;
        tiledTilesetColumns = columns;
      }

      tiledTilesets.push(entry);
      registerTilesetAnimations(entry);
      registerTileRoleGids(entry);
      tiledOk = true;

      console.info(`[DungeonTilesetLoader] Loaded Tiled tileset: ${config.imagePath} (firstgid=${config.firstGid}, ${texture.width}x${texture.height}, ${columns} cols)`);
    } catch {
      console.warn(`[DungeonTilesetLoader] Failed to load Tiled tileset: ${config.imagePath}`);
    }
  }

  // Sort tilesets by firstGid ascending for proper GID resolution
  tiledTilesets.sort((a, b) => a.firstGid - b.firstGid);
  console.info(`[DungeonTilesetLoader] Built animation map: ${animationMap.size} animated tiles`);

  return legacyOk || tiledOk;
}

/**
 * Check if any tileset is loaded
 */
export function isTilesetLoaded(): boolean {
  return legacyTilesetTexture !== null || tiledTilesetTexture !== null;
}

/**
 * Check if the Tiled map tileset is loaded
 */
export function isTiledTilesetLoaded(): boolean {
  return tiledTilesets.length > 0;
}

// ── Legacy tileset extraction ───────────────────────────────────────

function extractLegacyTile(col: number, row: number): Texture {
  const key = `legacy_${col}_${row}`;
  if (legacyTextureCache.has(key)) return legacyTextureCache.get(key)!;
  if (!legacyTilesetTexture) throw new Error('Legacy tileset not loaded');

  const tex = new Texture({
    source: legacyTilesetTexture.source,
    frame: new Rectangle(col * legacyTilePx, row * legacyTilePx, legacyTilePx, legacyTilePx),
  });

  legacyTextureCache.set(key, tex);
  return tex;
}

export function getTileTexture(tileType: TileType, x: number, y: number): Texture | null {
  if (!legacyTilesetTexture) return null;

  const regions = TILE_MAP[tileType];
  if (!regions || regions.length === 0) return null;

  // Use position hash to pick variant for visual variety
  const variantIndex = (x * 7 + y * 13) % regions.length;
  const region = regions[variantIndex];

  return extractLegacyTile(region.col, region.row);
}

export function getWallTexture(
  x: number, y: number,
  tiles: number[][], w: number, h: number
): Texture | null {
  if (!legacyTilesetTexture) return null;

  const regions = TILE_MAP[TileType.WALL];
  if (!regions || regions.length === 0) return null;

  const variantIndex = (x * 7 + y * 13) % regions.length;
  const region = regions[variantIndex];

  return extractLegacyTile(region.col, region.row);
}

// ── Tiled map tileset extraction (by GID) ───────────────────────────

/**
 * Tiled encodes flip flags in the upper bits of tile GIDs.
 * Strip them to get the raw tile index.
 */
const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
const GID_MASK = ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);

export function stripTiledFlipFlags(gid: number): number {
  // JS bitwise ops work on signed 32-bit ints, so use unsigned right shift to handle
  return (gid & GID_MASK) >>> 0;
}

/**
 * Get a texture for a Tiled map tile GID. Handles flip flags and firstgid offset.
 * @param rawGid The raw GID from the Tiled JSON data array (may include flip flags)
 * @param firstGid The firstgid from the tileset definition in the JSON (typically 1)
 * @returns Texture for the tile, or null if GID is 0 (empty) or tileset not loaded
 */
export function getTiledTileTexture(rawGid: number, firstGid: number = 1): Texture | null {
  const cleanGid = stripTiledFlipFlags(rawGid);
  if (cleanGid === 0) return null; // Empty tile

  // Use a unique cache key based on the clean GID (globally unique across tilesets)
  if (tiledTextureCache.has(cleanGid)) return tiledTextureCache.get(cleanGid)!;

  // ── Multi-tileset resolution: find the tileset this GID belongs to ──
  // The correct tileset is the one with the highest firstGid that is still ≤ cleanGid
  if (tiledTilesets.length > 0) {
    let matchedTileset: TiledTilesetEntry | null = null;
    for (let i = tiledTilesets.length - 1; i >= 0; i--) {
      if (cleanGid >= tiledTilesets[i].firstGid) {
        matchedTileset = tiledTilesets[i];
        break;
      }
    }

    if (!matchedTileset) return null;

    const tileIndex = cleanGid - matchedTileset.firstGid;
    const col = tileIndex % matchedTileset.columns;
    const row = Math.floor(tileIndex / matchedTileset.columns);

    // Bounds check
    const maxRow = Math.floor(matchedTileset.texture.height / matchedTileset.tilePx);
    if (row >= maxRow || col >= matchedTileset.columns) return null;

    const tex = new Texture({
      source: matchedTileset.texture.source,
      frame: new Rectangle(
        col * matchedTileset.tilePx,
        row * matchedTileset.tilePx,
        matchedTileset.tilePx,
        matchedTileset.tilePx
      ),
    });

    tiledTextureCache.set(cleanGid, tex);
    return tex;
  }

  // Fallback: single tileset mode (backwards compatibility)
  if (!tiledTilesetTexture) return null;

  const tileIndex = cleanGid - firstGid;
  if (tileIndex < 0) return null;

  const col = tileIndex % tiledTilesetColumns;
  const row = Math.floor(tileIndex / tiledTilesetColumns);

  const maxRow = Math.floor(tiledTilesetTexture.height / tiledTilePx);
  if (row >= maxRow || col >= tiledTilesetColumns) return null;

  const tex = new Texture({
    source: tiledTilesetTexture.source,
    frame: new Rectangle(col * tiledTilePx, row * tiledTilePx, tiledTilePx, tiledTilePx),
  });

  tiledTextureCache.set(cleanGid, tex);
  return tex;
}

/**
 * Check if a tile GID has animation frames defined in the Tiled tileset.
 * @param rawGid Raw GID from the Tiled data (may include flip flags)
 * @returns Array of FrameObjects ({texture, time}) for AnimatedSprite, or null if not animated
 */
export function getTiledTileAnimation(rawGid: number): { texture: Texture; time: number }[] | null {
  const cleanGid = stripTiledFlipFlags(rawGid);
  if (cleanGid === 0) return null;

  const animDef = animationMap.get(cleanGid);
  if (!animDef) return null;

  const frameObjects: { texture: Texture; time: number }[] = [];

  for (const frame of animDef.frames) {
    // Convert local tileId to global GID
    const frameGid = frame.tileId + animDef.firstGid;
    const tex = getTiledTileTexture(frameGid);
    if (tex) {
      frameObjects.push({ texture: tex, time: frame.durationMs });
    }
  }

  if (frameObjects.length < 2) return null; // Need at least 2 frames for animation

  return frameObjects;
}

export function isChestTileGid(rawGid: number): boolean {
  return chestAnimGids.has(stripTiledFlipFlags(rawGid));
}

export function isSpearTrapTileGid(rawGid: number): boolean {
  return spearTrapGids.has(stripTiledFlipFlags(rawGid));
}

export function isWoodenTrapdoorTileGid(rawGid: number): boolean {
  return woodenTrapdoorGids.has(stripTiledFlipFlags(rawGid));
}

export function isGateTileGid(rawGid: number): boolean {
  return gateAnimGids.has(stripTiledFlipFlags(rawGid));
}

// ── Animated item frame loaders ─────────────────────────────────────

/**
 * Load a set of animation frames from individual PNG files.
 * Returns array of Textures for AnimatedSprite use.
 */
export async function loadAnimationFrames(
  basePath: string,
  prefix: string,
  count: number
): Promise<Texture[]> {
  const frames: Texture[] = [];
  for (let i = 1; i <= count; i++) {
    try {
      const tex = await Assets.load(`${basePath}/${prefix}_${i}.png`) as Texture;
      tex.source.scaleMode = 'nearest';
      frames.push(tex);
    } catch {
      // Frame not found — skip
    }
  }
  return frames;
}

/**
 * Load all dungeon-pack item animations. Call once during init.
 */
export async function loadItemAnimations(): Promise<{
  torch: Texture[];
  chest: Texture[];
  peaks: Texture[];
  coin: Texture[];
}> {
  const [torch, chest, peaks, coin] = await Promise.all([
    loadAnimationFrames('assets/dungeon-pack/items/torch', 'torch', 4),
    loadAnimationFrames('assets/dungeon-pack/items/chest', 'chest', 4),
    loadAnimationFrames('assets/dungeon-pack/items/peaks', 'peaks', 4),
    loadAnimationFrames('assets/dungeon-pack/items/coin', 'coin', 4),
  ]);

  return { torch, chest, peaks, coin };
}
