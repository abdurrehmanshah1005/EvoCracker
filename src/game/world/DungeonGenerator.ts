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
export function generateDungeon(
  width: number,
  height: number,
  floor: number,
  biome: BiomeType = BiomeType.DUNGEON
): DungeonData {
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
