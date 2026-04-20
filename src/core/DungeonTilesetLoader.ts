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

// ── Tiled map tileset (dungeon_tileset.png) — used for JSON map floors ──
const TILED_TILESET_PATH = 'assets/dungeon-pack/dungeon_tileset.png';

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

// ── State ───────────────────────────────────────────────────────────
let legacyTilesetTexture: Texture | null = null;
let tiledTilesetTexture: Texture | null = null;
let tiledTilesetColumns = 0;
let tiledTilePx = 32; // Tiled maps typically use 32×32

const legacyTextureCache = new Map<string, Texture>();
const tiledTextureCache = new Map<number, Texture>();
let tilesetLoadRevision = 0;

function getCacheBustedPath(basePath: string): string {
  if (import.meta.env.DEV) {
    return `${basePath}?v=${tilesetLoadRevision}`;
  }
  return basePath;
}

/**
 * Load the legacy tileset spritesheet (tileset_v2.png). Call once during game init.
 */
export async function loadTileset(): Promise<boolean> {
  tilesetLoadRevision += 1;
  legacyTextureCache.clear();
  tiledTextureCache.clear();
  legacyTilesetTexture = null;
  tiledTilesetTexture = null;

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

  // Load Tiled map tileset (dungeon_tileset.png)
  try {
    const loadPath = getCacheBustedPath(TILED_TILESET_PATH);
    tiledTilesetTexture = await Assets.load(loadPath) as Texture;
    tiledTilesetTexture.source.scaleMode = 'nearest';
    // Calculate columns from the image width and the tile size (32px)
    tiledTilePx = 32;
    tiledTilesetColumns = Math.max(1, Math.floor(tiledTilesetTexture.width / tiledTilePx));
    console.info(`[DungeonTilesetLoader] Loaded Tiled tileset: ${TILED_TILESET_PATH} (${tiledTilesetTexture.width}x${tiledTilesetTexture.height}, ${tiledTilesetColumns} cols)`);
    tiledOk = true;
  } catch {
    console.warn('[DungeonTilesetLoader] dungeon_tileset.png not found');
  }

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
  return tiledTilesetTexture !== null;
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
const FLIPPED_VERTICALLY_FLAG   = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG   = 0x20000000;
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
  if (!tiledTilesetTexture) return null;

  const cleanGid = stripTiledFlipFlags(rawGid);
  if (cleanGid === 0) return null; // Empty tile

  const tileIndex = cleanGid - firstGid;
  if (tileIndex < 0) return null;

  if (tiledTextureCache.has(tileIndex)) return tiledTextureCache.get(tileIndex)!;

  const col = tileIndex % tiledTilesetColumns;
  const row = Math.floor(tileIndex / tiledTilesetColumns);

  // Bounds check
  const maxRow = Math.floor(tiledTilesetTexture.height / tiledTilePx);
  if (row >= maxRow || col >= tiledTilesetColumns) return null;

  const tex = new Texture({
    source: tiledTilesetTexture.source,
    frame: new Rectangle(col * tiledTilePx, row * tiledTilePx, tiledTilePx, tiledTilePx),
  });

  tiledTextureCache.set(tileIndex, tex);
  return tex;
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
