// ========================
// Procedural Dungeon Generator — BSP Tree Algorithm
// Generates rooms, corridors, and populates with entities
// ========================

import { TileType, BiomeType } from '@utils/constants';
import { randomInt, randomBool, shuffle } from '@utils/random';

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  type: 'normal' | 'spawn' | 'treasure' | 'boss' | 'start' | 'exit';
  connected: boolean;
}

export interface DungeonData {
  width: number;
  height: number;
  tiles: TileType[][];
  rooms: Room[];
  spawnPoint: { x: number; y: number };
  exitPoint: { x: number; y: number };
  treasurePoints: { x: number; y: number }[];
  enemySpawnPoints: { x: number; y: number }[];
  biome: BiomeType;
  floor: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left: BSPNode | null;
  right: BSPNode | null;
  room: Room | null;
}

const MIN_ROOM_SIZE = 5;
const MAX_ROOM_SIZE = 12;
const MIN_LEAF_SIZE = 8;

/** Generate a complete dungeon floor */
export async function generateDungeon(
  width: number,
  height: number,
  floor: number,
  biome: BiomeType = BiomeType.DUNGEON,
  mapId: string = 'crypt'
): Promise<DungeonData> {
  // Floor 1 with a specific map: load from PNG or handcrafted layout
  if (floor === 1 && mapId !== 'random') {
    // Determine which PNG to load based on mapId
    const mapPaths: Record<string, string[]> = {
      'crypt': ['/assets/maps/floor1.png', '/assets/maps/floor1_layout.png'],
      'forest_ruins': ['/assets/maps/forest_ruins.png'],
    };

    const paths = mapPaths[mapId] ?? mapPaths['crypt'];
    const fromPng = await generateFloorFromPngLayout(width, height, floor, biome, paths);
    if (fromPng) return fromPng;

    // Fallback to handcrafted only for crypt
    if (mapId === 'crypt') {
      const handcrafted = generateHandcraftedCryptMap(width, height, floor, biome);
      if (handcrafted) return handcrafted;
    }
  }

  // Initialize tile grid with walls
  const tiles: TileType[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = TileType.WALL;
    }
  }

  // BSP split
  const root: BSPNode = { x: 1, y: 1, width: width - 2, height: height - 2, left: null, right: null, room: null };
  const leaves: BSPNode[] = [];
  splitBSP(root, leaves);

  // Create rooms in leaves
  const rooms: Room[] = [];
  for (const leaf of leaves) {
    const room = createRoomInLeaf(leaf);
    if (room) {
      rooms.push(room);
      carveRoom(tiles, room, biome);
    }
  }

  // Connect rooms with corridors
  connectRooms(root, tiles, biome);

  // Add terrain variety based on biome
  addTerrainVariety(tiles, rooms, biome, width, height);

  // Assign special rooms
  shuffle(rooms);
  if (rooms.length >= 2) {
    rooms[0].type = 'start';
    rooms[rooms.length - 1].type = 'exit';
  }

  const treasureRooms = rooms.filter((_, i) => i > 0 && i < rooms.length - 1).slice(0, Math.min(3, Math.floor(rooms.length / 3)));
  treasureRooms.forEach((r) => (r.type = 'treasure'));

  // Place stairs
  const startRoom = rooms.find((r) => r.type === 'start') ?? rooms[0];
  const exitRoom = rooms.find((r) => r.type === 'exit') ?? rooms[rooms.length - 1];

  tiles[exitRoom.centerY][exitRoom.centerX] = TileType.STAIRS_DOWN;
  tiles[startRoom.centerY][startRoom.centerX] = TileType.STAIRS_UP;

  // Place treasures
  const treasurePoints: DungeonData['treasurePoints'] = [];
  for (const room of treasureRooms) {
    tiles[room.centerY][room.centerX] = TileType.TREASURE;
    treasurePoints.push({ x: room.centerX, y: room.centerY });
  }

  // Enemy spawn points: 1-3 per non-special room, scaling with floor
  const enemySpawnPoints: DungeonData['enemySpawnPoints'] = [];
  const enemyRooms = rooms.filter((r) => r.type === 'normal');
  for (const room of enemyRooms) {
    const count = Math.min(1 + Math.floor(floor / 3), 4);
    for (let i = 0; i < count; i++) {
      const ex = randomInt(room.x + 1, room.x + room.width - 2);
      const ey = randomInt(room.y + 1, room.y + room.height - 2);
      if (tiles[ey]?.[ex] === getFloorTile(biome)) {
        enemySpawnPoints.push({ x: ex, y: ey });
      }
    }
  }

  return {
    width,
    height,
    tiles,
    rooms,
    spawnPoint: { x: startRoom.centerX, y: startRoom.centerY },
    exitPoint: { x: exitRoom.centerX, y: exitRoom.centerY },
    treasurePoints,
    enemySpawnPoints,
    biome,
    floor,
  };
}

async function generateFloorFromPngLayout(
  width: number,
  height: number,
  floor: number,
  biome: BiomeType,
  layoutPaths: string[] = ['/assets/maps/floor1_layout.png']
): Promise<DungeonData | null> {
  if (typeof window === 'undefined') return null;

  try {
    let image: HTMLImageElement | null = null;

    for (const src of layoutPaths) {
      try {
        image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load layout: ${src}`));
          img.src = src;
        });
        break;
      } catch {
        // Try next layout path
      }
    }

    if (!image) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Preserve aspect ratio and center the map; empty margins stay wall.
    const scale = Math.min(width / image.width, height / image.height);
    const drawW = Math.max(1, Math.floor(image.width * scale));
    const drawH = Math.max(1, Math.floor(image.height * scale));
    const dx = Math.floor((width - drawW) / 2);
    const dy = Math.floor((height - drawH) / 2);
    ctx.drawImage(image, dx, dy, drawW, drawH);

    const data = ctx.getImageData(0, 0, width, height).data;
    return generateDungeonFromPngPixels(data, width, height, floor, biome);
  } catch {
    return null;
  }
}

function splitBSP(node: BSPNode, leaves: BSPNode[]): void {
  if (node.width < MIN_LEAF_SIZE * 2 && node.height < MIN_LEAF_SIZE * 2) {
    leaves.push(node);
    return;
  }

  // Decide split direction
  let splitH: boolean;
  if (node.width > node.height * 1.25) splitH = false;
  else if (node.height > node.width * 1.25) splitH = true;
  else splitH = randomBool();

  if (splitH) {
    if (node.height < MIN_LEAF_SIZE * 2) { leaves.push(node); return; }
    const split = randomInt(MIN_LEAF_SIZE, node.height - MIN_LEAF_SIZE);
    node.left = { x: node.x, y: node.y, width: node.width, height: split, left: null, right: null, room: null };
    node.right = { x: node.x, y: node.y + split, width: node.width, height: node.height - split, left: null, right: null, room: null };
  } else {
    if (node.width < MIN_LEAF_SIZE * 2) { leaves.push(node); return; }
    const split = randomInt(MIN_LEAF_SIZE, node.width - MIN_LEAF_SIZE);
    node.left = { x: node.x, y: node.y, width: split, height: node.height, left: null, right: null, room: null };
    node.right = { x: node.x + split, y: node.y, width: node.width - split, height: node.height, left: null, right: null, room: null };
  }

  splitBSP(node.left!, leaves);
  splitBSP(node.right!, leaves);
}

function createRoomInLeaf(leaf: BSPNode): Room | null {
  const w = randomInt(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, leaf.width - 2));
  const h = randomInt(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, leaf.height - 2));
  const x = randomInt(leaf.x + 1, leaf.x + leaf.width - w - 1);
  const y = randomInt(leaf.y + 1, leaf.y + leaf.height - h - 1);

  const room: Room = {
    x, y, width: w, height: h,
    centerX: Math.floor(x + w / 2),
    centerY: Math.floor(y + h / 2),
    type: 'normal',
    connected: false,
  };

  leaf.room = room;
  return room;
}

function carveRoom(tiles: TileType[][], room: Room, biome: BiomeType): void {
  const floor = getFloorTile(biome);
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
        tiles[y][x] = floor;
      }
    }
  }
}

function connectRooms(node: BSPNode, tiles: TileType[][], biome: BiomeType): void {
  if (!node.left || !node.right) return;

  connectRooms(node.left, tiles, biome);
  connectRooms(node.right, tiles, biome);

  const roomA = getRoom(node.left);
  const roomB = getRoom(node.right);

  if (roomA && roomB) {
    carveCorridor(tiles, roomA.centerX, roomA.centerY, roomB.centerX, roomB.centerY, biome);
  }
}

function getRoom(node: BSPNode): Room | null {
  if (node.room) return node.room;
  if (node.left) {
    const room = getRoom(node.left);
    if (room) return room;
  }
  if (node.right) return getRoom(node.right);
  return null;
}

function carveCorridor(tiles: TileType[][], x1: number, y1: number, x2: number, y2: number, biome: BiomeType): void {
  const floor = getFloorTile(biome);
  let x = x1;
  let y = y1;

  // L-shaped corridor
  if (randomBool()) {
    // Horizontal first, then vertical
    while (x !== x2) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) tiles[y][x] = floor;
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) tiles[y][x] = floor;
      y += y < y2 ? 1 : -1;
    }
  } else {
    // Vertical first, then horizontal
    while (y !== y2) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) tiles[y][x] = floor;
      y += y < y2 ? 1 : -1;
    }
    while (x !== x2) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) tiles[y][x] = floor;
      x += x < x2 ? 1 : -1;
    }
  }
  // Final tile
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) tiles[y][x] = floor;
}

function addTerrainVariety(tiles: TileType[][], rooms: Room[], biome: BiomeType, width: number, height: number): void {
  const floorTile = getFloorTile(biome);

  for (const room of rooms) {
    if (room.type !== 'normal') continue;

    // Randomly place mud/water/traps in some rooms
    const variety = randomInt(0, 10);

    if (variety <= 2 && biome !== BiomeType.CASTLE) {
      // Mud patches
      const patchCount = randomInt(2, 5);
      for (let p = 0; p < patchCount; p++) {
        const px = randomInt(room.x + 1, room.x + room.width - 2);
        const py = randomInt(room.y + 1, room.y + room.height - 2);
        if (py < height && px < width && tiles[py][px] === floorTile) {
          tiles[py][px] = TileType.FLOOR_MUD;
        }
      }
    } else if (variety === 3 && (biome === BiomeType.CAVE || biome === BiomeType.LAKE)) {
      // Water patches
      const patchCount = randomInt(3, 8);
      for (let p = 0; p < patchCount; p++) {
        const px = randomInt(room.x + 1, room.x + room.width - 2);
        const py = randomInt(room.y + 1, room.y + room.height - 2);
        if (py < height && px < width && tiles[py][px] === floorTile) {
          tiles[py][px] = TileType.FLOOR_WATER;
        }
      }
    } else if (variety === 4) {
      // Trap in corridor / room edge
      const tx = randomBool() ? room.x + 1 : room.x + room.width - 2;
      const ty = randomBool() ? room.y + 1 : room.y + room.height - 2;
      if (ty >= 0 && ty < height && tx >= 0 && tx < width && tiles[ty][tx] === floorTile) {
        tiles[ty][tx] = TileType.FLOOR_TRAP;
      }
    }
  }
}

function getFloorTile(biome: BiomeType): TileType {
  switch (biome) {
    case BiomeType.FOREST: return TileType.FLOOR_GRASS;
    case BiomeType.LAKE: return TileType.FLOOR_STONE;
    case BiomeType.CASTLE: return TileType.FLOOR_STONE;
    default: return TileType.FLOOR_STONE;
  }
}

/** Get biome for a given floor number */
export function getBiomeForFloor(floor: number): BiomeType {
  const biomes = [BiomeType.DUNGEON, BiomeType.CAVE, BiomeType.FOREST, BiomeType.CASTLE, BiomeType.LAKE, BiomeType.RUINS];
  return biomes[(floor - 1) % biomes.length];
}

/**
 * Build a dungeon directly from PNG pixel data.
 *
 * Recommended palette (with tolerance):
 * - Black/dark      -> wall
 * - White/gray      -> floor stone
 * - Red             -> spawn (stairs up)
 * - Green           -> exit (stairs down)
 * - Yellow          -> treasure
 * - Blue/Cyan       -> water
 * - Brown           -> mud
 * - Magenta         -> trap
 */
export function generateDungeonFromPngPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  floor: number,
  biome: BiomeType = BiomeType.DUNGEON
): DungeonData {
  const tiles: TileType[][] = [];
  const enemySpawnPoints: { x: number; y: number }[] = [];
  const treasurePoints: { x: number; y: number }[] = [];

  let spawnPoint: { x: number; y: number } | null = null;
  let exitPoint: { x: number; y: number } | null = null;

  const near = (c: RGB, t: RGB, tol = 70): boolean => (
    Math.abs(c.r - t.r) <= tol &&
    Math.abs(c.g - t.g) <= tol &&
    Math.abs(c.b - t.b) <= tol
  );

  const floorTile = getFloorTile(biome);

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      const a = pixels[i + 3] ?? 255;

      const color: RGB = { r, g, b };
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b);

      let tile: TileType = floorTile;

      if (a < 20 || luminance < 40 || near(color, { r: 0, g: 0, b: 0 }, 40)) {
        tile = TileType.WALL;
      } else if (near(color, { r: 255, g: 0, b: 0 })) {
        tile = TileType.STAIRS_UP;
        spawnPoint = { x, y };
      } else if (near(color, { r: 0, g: 255, b: 0 })) {
        tile = TileType.STAIRS_DOWN;
        exitPoint = { x, y };
      } else if (near(color, { r: 255, g: 255, b: 0 })) {
        tile = TileType.TREASURE;
        treasurePoints.push({ x, y });
      } else if (near(color, { r: 0, g: 120, b: 255 }) || near(color, { r: 0, g: 255, b: 255 })) {
        tile = TileType.FLOOR_WATER;
      } else if (near(color, { r: 120, g: 80, b: 40 })) {
        tile = TileType.FLOOR_MUD;
      } else if (near(color, { r: 255, g: 0, b: 255 })) {
        tile = TileType.FLOOR_TRAP;
      }

      tiles[y][x] = tile;
    }
  }

  // Fallback spawn/exit if not painted in PNG
  if (!spawnPoint) {
    outerSpawn:
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (tiles[y][x] !== TileType.WALL) {
          spawnPoint = { x, y };
          tiles[y][x] = TileType.STAIRS_UP;
          break outerSpawn;
        }
      }
    }
  }

  if (!exitPoint) {
    outerExit:
    for (let y = height - 2; y >= 1; y--) {
      for (let x = width - 2; x >= 1; x--) {
        if (tiles[y][x] !== TileType.WALL) {
          exitPoint = { x, y };
          tiles[y][x] = TileType.STAIRS_DOWN;
          break outerExit;
        }
      }
    }
  }

  // Auto-generate enemy spawns from walkable floor tiles
  for (let y = 2; y < height - 2; y += 3) {
    for (let x = 2; x < width - 2; x += 3) {
      const t = tiles[y][x];
      const walkable = t !== TileType.WALL && t !== TileType.STAIRS_UP && t !== TileType.STAIRS_DOWN && t !== TileType.TREASURE;
      if (!walkable) continue;
      if (spawnPoint && Math.abs(x - spawnPoint.x) + Math.abs(y - spawnPoint.y) < 5) continue;
      if (exitPoint && Math.abs(x - exitPoint.x) + Math.abs(y - exitPoint.y) < 4) continue;
      enemySpawnPoints.push({ x, y });
    }
  }

  // Minimal room metadata (single map-room + start/exit pseudo rooms)
  const rooms: Room[] = [
    {
      x: 1,
      y: 1,
      width: Math.max(1, width - 2),
      height: Math.max(1, height - 2),
      centerX: Math.floor(width / 2),
      centerY: Math.floor(height / 2),
      type: 'normal',
      connected: true,
    },
    {
      x: spawnPoint?.x ?? 1,
      y: spawnPoint?.y ?? 1,
      width: 1,
      height: 1,
      centerX: spawnPoint?.x ?? 1,
      centerY: spawnPoint?.y ?? 1,
      type: 'start',
      connected: true,
    },
    {
      x: exitPoint?.x ?? Math.max(1, width - 2),
      y: exitPoint?.y ?? Math.max(1, height - 2),
      width: 1,
      height: 1,
      centerX: exitPoint?.x ?? Math.max(1, width - 2),
      centerY: exitPoint?.y ?? Math.max(1, height - 2),
      type: 'exit',
      connected: true,
    },
  ];

  const finalSpawn = spawnPoint ?? { x: 1, y: 1 };
  const finalExit = exitPoint ?? { x: Math.max(1, width - 2), y: Math.max(1, height - 2) };

  return {
    width,
    height,
    tiles,
    rooms,
    spawnPoint: finalSpawn,
    exitPoint: finalExit,
    treasurePoints,
    enemySpawnPoints,
    biome,
    floor,
  };
}

function generateHandcraftedCryptMap(
  width: number,
  height: number,
  floor: number,
  biome: BiomeType
): DungeonData | null {
  // Floor 1: hand-authored crypt layout matching the provided reference image
  const MAP_W = 46;
  const MAP_H = 32;

  if (width < MAP_W || height < MAP_H) return null;

  const tiles: TileType[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = TileType.WALL;
    }
  }

  // Keep this map anchored near top-left (not centered), matching reference composition
  const ox = 1;
  const oy = 1;

  const carveRect = (x: number, y: number, w: number, h: number, tile: TileType = TileType.FLOOR_STONE) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const tx = ox + xx;
        const ty = oy + yy;
        if (ty >= 0 && ty < height && tx >= 0 && tx < width) {
          tiles[ty][tx] = tile;
        }
      }
    }
  };

  const carveH = (x1: number, x2: number, y: number, tile: TileType = TileType.FLOOR_STONE) => {
    const from = Math.min(x1, x2);
    const to = Math.max(x1, x2);
    for (let x = from; x <= to; x++) carveRect(x, y, 1, 1, tile);
  };

  const carveV = (x: number, y1: number, y2: number, tile: TileType = TileType.FLOOR_STONE) => {
    const from = Math.min(y1, y2);
    const to = Math.max(y1, y2);
    for (let y = from; y <= to; y++) carveRect(x, y, 1, 1, tile);
  };

  // ── Major rooms ────────────────────────────────────────────────
  carveRect(1, 2, 7, 7);      // Entrance room (top-left)
  carveRect(14, 2, 13, 6);    // Barracks (top-center-left)
  carveRect(28, 2, 7, 5);     // Library (top-center)
  carveRect(37, 2, 8, 6);     // Ossuary (top-right)

  carveRect(4, 12, 24, 7);    // Grand hall (mid-left)

  carveRect(1, 23, 9, 8);     // Fountain room (bottom-left)
  carveRect(10, 23, 14, 7);   // South archive (bottom-mid-left)

  // Bottom-middle looped corridor block (outer walk + inner wall island)
  carveRect(10, 25, 21, 6);
  carveRect(14, 26, 13, 3, TileType.WALL);

  carveRect(27, 24, 7, 6);    // South crypt (bottom-mid-right)
  carveRect(37, 13, 8, 8);    // Treasure chamber (mid-right)
  carveRect(37, 24, 8, 7);    // Exit chamber (bottom-right)

  // ── Corridors / vertical spines ────────────────────────────────
  carveRect(3, 9, 2, 4);      // Entrance down to west hall
  carveRect(2, 13, 3, 12);    // West vertical corridor

  carveRect(20, 8, 2, 4);     // Barracks to grand hall
  carveRect(31, 7, 2, 6);     // Library down connector
  carveRect(40, 8, 2, 5);     // Ossuary down connector

  carveRect(28, 15, 6, 2);    // Grand hall to right spine
  carveRect(31, 10, 3, 15);   // Right-side spine (pre-traps)

  carveRect(17, 19, 2, 5);    // Grand hall to south archive
  carveRect(30, 25, 7, 2);    // South crypt to exit wing
  carveRect(40, 21, 2, 4);    // Treasure to exit chamber

  // ── Dirt/mud worn paths (visual match) ─────────────────────────
  carveRect(14, 2, 6, 3, TileType.FLOOR_MUD);   // Barracks dirty corner
  carveRect(30, 7, 2, 3, TileType.FLOOR_MUD);
  carveRect(28, 17, 6, 2, TileType.FLOOR_MUD);
  carveRect(10, 25, 21, 6, TileType.FLOOR_MUD);
  carveRect(11, 23, 12, 2, TileType.FLOOR_MUD);

  // Re-open stone route around mud loop and connectors
  carveH(10, 30, 25);
  carveH(10, 30, 30);
  carveV(10, 25, 30);
  carveV(30, 25, 30);
  carveRect(24, 25, 4, 2);

  // ── Spike traps ────────────────────────────────────────────────
  carveRect(31, 18, 4, 2, TileType.FLOOR_TRAP); // right gauntlet (upper)
  carveRect(31, 20, 4, 2, TileType.FLOOR_TRAP); // right gauntlet (lower)
  carveRect(21, 29, 8, 1, TileType.FLOOR_TRAP); // bottom loop spikes

  // Points of interest
  const spawnPoint = { x: ox + 3, y: oy + 4 };
  const exitPoint = { x: ox + 41, y: oy + 27 };
  const treasurePoints = [
    { x: ox + 39, y: oy + 16 },
    { x: ox + 41, y: oy + 16 },
    { x: ox + 42, y: oy + 17 },
  ];

  tiles[spawnPoint.y][spawnPoint.x] = TileType.STAIRS_UP;
  tiles[exitPoint.y][exitPoint.x] = TileType.STAIRS_DOWN;
  for (const t of treasurePoints) tiles[t.y][t.x] = TileType.TREASURE;

  // Hand-authored enemy spawn points distributed per room/corridor
  const enemySpawnPoints = [
    { x: ox + 17, y: oy + 4 }, { x: ox + 24, y: oy + 4 },
    { x: ox + 30, y: oy + 4 },
    { x: ox + 39, y: oy + 4 }, { x: ox + 42, y: oy + 4 },
    { x: ox + 9, y: oy + 14 }, { x: ox + 16, y: oy + 15 }, { x: ox + 23, y: oy + 15 },
    { x: ox + 4, y: oy + 27 },
    { x: ox + 14, y: oy + 26 }, { x: ox + 19, y: oy + 27 },
    { x: ox + 29, y: oy + 27 },
    { x: ox + 38, y: oy + 15 },
  ];

  const mkRoom = (
    x: number,
    y: number,
    w: number,
    h: number,
    type: Room['type'] = 'normal'
  ): Room => ({
    x: ox + x,
    y: oy + y,
    width: w,
    height: h,
    centerX: ox + Math.floor(x + w / 2),
    centerY: oy + Math.floor(y + h / 2),
    type,
    connected: true,
  });

  const rooms: Room[] = [
    mkRoom(1, 2, 7, 7, 'start'),
    mkRoom(14, 2, 13, 6, 'normal'),
    mkRoom(28, 2, 7, 5, 'normal'),
    mkRoom(37, 2, 8, 6, 'normal'),
    mkRoom(4, 12, 24, 7, 'normal'),
    mkRoom(1, 23, 9, 8, 'normal'),
    mkRoom(10, 23, 14, 7, 'normal'),
    mkRoom(27, 24, 7, 6, 'normal'),
    mkRoom(37, 13, 8, 8, 'treasure'),
    mkRoom(37, 24, 8, 7, 'exit'),
  ];

  return {
    width,
    height,
    tiles,
    rooms,
    spawnPoint,
    exitPoint,
    treasurePoints,
    enemySpawnPoints,
    biome,
    floor,
  };
}
