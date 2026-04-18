// ========================
// DungeonTilesetLoader — Loads pixel-art tileset and parses into tile textures
//
// The tileset is a 160×160 PNG containing 10×10 grid of 16×16 tiles.
// This module maps each TileType to specific tile(s) on the spritesheet.
// ========================

import { Assets, Texture, Rectangle } from 'pixi.js';
import { TileType } from '@utils/constants';

const TILE_PX = 16; // Source tile size in the spritesheet
const TILESET_PATH = 'assets/dungeon-pack/tileset.png';

// ── Tileset coordinate map ──────────────────────────────────────────
// Each entry is [col, row] in the 10×10 grid (0-indexed)
// Mapped by examining the Dungeon_Tileset.png layout:
//
// Row 0: top-wall variants (left-corner, mid, right-corner, column-top, etc.)
// Row 1: mid-wall + side-wall pieces
// Row 2: bottom-wall + floor transitions
// Row 3: floor variants (stone, alt-stone)
// Row 4: decorative floor (cracks, patterns)
// Row 5-6: items/objects on the tileset
// Row 7-9: more decorative tiles, doors, stairs, etc.

interface TileRegion {
  col: number;
  row: number;
}

// Map TileType → position(s) on the spritesheet
const TILE_MAP: Record<number, TileRegion[]> = {
  // Floors — pick from floor region
  [TileType.FLOOR_STONE]: [
    { col: 1, row: 3 },  // Main stone floor
    { col: 2, row: 3 },  // Alt stone floor
  ],
  [TileType.WALL]: [
    { col: 0, row: 0 },  // Default wall face
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

// Wall auto-tile pieces — for smarter wall rendering
const WALL_TILES = {
  top:        { col: 1, row: 0 },  // Top wall edge
  topLeft:    { col: 0, row: 0 },  // Top-left corner
  topRight:   { col: 2, row: 0 },  // Top-right corner
  mid:        { col: 1, row: 1 },  // Middle wall (fully surrounded)
  midLeft:    { col: 0, row: 1 },  // Left wall edge
  midRight:   { col: 2, row: 1 },  // Right wall edge
  bottom:     { col: 1, row: 2 },  // Bottom wall edge (floor transition)
  bottomLeft: { col: 0, row: 2 },  // Bottom-left corner
  bottomRight:{ col: 2, row: 2 },  // Bottom-right corner
  single:     { col: 3, row: 1 },  // Standalone pillar/column
  face:       { col: 1, row: 1 },  // Default wall face
};

let tilesetTexture: Texture | null = null;
const textureCache = new Map<string, Texture>();

/**
 * Load the tileset spritesheet. Call once during game init.
 */
export async function loadTileset(): Promise<boolean> {
  try {
    tilesetTexture = await Assets.load(TILESET_PATH) as Texture;
    // Set nearest-neighbor scaling for crisp pixels
    tilesetTexture.source.scaleMode = 'nearest';
    return true;
  } catch {
    console.warn('[DungeonTilesetLoader] Tileset not found, using fallback colors');
    return false;
  }
}

/**
 * Check if tileset is loaded
 */
export function isTilesetLoaded(): boolean {
  return tilesetTexture !== null;
}

/**
 * Extract a texture from the tileset at the given grid position
 */
function extractTile(col: number, row: number): Texture {
  const key = `${col}_${row}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  if (!tilesetTexture) throw new Error('Tileset not loaded');

  const tex = new Texture({
    source: tilesetTexture.source,
    frame: new Rectangle(col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX),
  });

  textureCache.set(key, tex);
  return tex;
}

/**
 * Get the tile texture for a given TileType.
 * For tiles with multiple variants, picks one based on position hash for variety.
 */
export function getTileTexture(tileType: TileType, x: number, y: number): Texture | null {
  if (!tilesetTexture) return null;

  const regions = TILE_MAP[tileType];
  if (!regions || regions.length === 0) return null;

  // Use position hash to pick variant for visual variety
  const variantIndex = (x * 7 + y * 13) % regions.length;
  const region = regions[variantIndex];

  return extractTile(region.col, region.row);
}

/**
 * Get the appropriate wall texture based on neighboring wall tiles.
 * This enables auto-tiling — walls look different based on context.
 */
export function getWallTexture(
  x: number, y: number,
  tiles: number[][], w: number, h: number
): Texture | null {
  if (!tilesetTexture) return null;

  const isWall = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true; // Out of bounds = wall
    return tiles[ty][tx] === TileType.WALL;
  };

  const up = isWall(x, y - 1);
  const down = isWall(x, y + 1);
  const left = isWall(x - 1, y);
  const right = isWall(x + 1, y);

  let tile: TileRegion;

  // Determine wall piece based on neighbors
  if (!down && up && left && right) {
    tile = WALL_TILES.bottom;       // Bottom edge — floor below
  } else if (!down && up && !left && right) {
    tile = WALL_TILES.bottomLeft;
  } else if (!down && up && left && !right) {
    tile = WALL_TILES.bottomRight;
  } else if (down && !up && left && right) {
    tile = WALL_TILES.top;          // Top edge — floor above
  } else if (down && !up && !left && right) {
    tile = WALL_TILES.topLeft;
  } else if (down && !up && left && !right) {
    tile = WALL_TILES.topRight;
  } else if (up && down && !left && right) {
    tile = WALL_TILES.midLeft;
  } else if (up && down && left && !right) {
    tile = WALL_TILES.midRight;
  } else if (!up && !down && !left && !right) {
    tile = WALL_TILES.single;       // Standalone pillar
  } else {
    tile = WALL_TILES.mid;          // Fully surrounded
  }

  return extractTile(tile.col, tile.row);
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
