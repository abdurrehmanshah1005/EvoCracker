// ========================
// Project AlchEx — Constants
// ========================

// Grid & Tiles
export const TILE_SIZE = 32;
export const GRID_COLS = 50;
export const GRID_ROWS = 40;

// Tile Types
export enum TileType {
  FLOOR_STONE = 0,
  WALL = 1,
  FLOOR_MUD = 2,
  FLOOR_WATER = 3,
  FLOOR_TRAP = 4,
  DOOR = 5,
  STAIRS_DOWN = 6,
  STAIRS_UP = 7,
  TREASURE = 8,
  FLOOR_GRASS = 9,
  FLOOR_SAND = 10,
  BRIDGE = 11,
}

// Tile movement weights
export const TILE_WEIGHTS: Record<TileType, number> = {
  [TileType.FLOOR_STONE]: 1,
  [TileType.WALL]: Infinity,
  [TileType.FLOOR_MUD]: 3,
  [TileType.FLOOR_WATER]: 5,
  [TileType.FLOOR_TRAP]: 8,
  [TileType.DOOR]: 1,
  [TileType.STAIRS_DOWN]: 1,
  [TileType.STAIRS_UP]: 1,
  [TileType.TREASURE]: 1,
  [TileType.FLOOR_GRASS]: 1.5,
  [TileType.FLOOR_SAND]: 2,
  [TileType.BRIDGE]: 1,
};

// Biome types for different level themes
export enum BiomeType {
  DUNGEON = 'dungeon',
  CASTLE = 'castle',
  FOREST = 'forest',
  LAKE = 'lake',
  CAVE = 'cave',
  RUINS = 'ruins',
}

// Alert States
export enum AlertState {
  IDLE = 'idle',
  SUSPICIOUS = 'suspicious',
  ALERT = 'alert',
  CHASING = 'chasing',
  FLEEING = 'fleeing',
}

// Algorithm Types
export enum AlgorithmType {
  BFS = 'BFS',
  DFS = 'DFS',
  IDS = 'IDS',
  DLS = 'DLS',
  UCS = 'UCS',
  ASTAR = 'AStar',
  GREEDY_BFS = 'GreedyBFS',
  HILL_CLIMBING = 'HillClimbing',
}

// Algorithm Visualization Colors (hex)
export const ALGORITHM_COLORS: Record<AlgorithmType, number> = {
  [AlgorithmType.BFS]: 0x4488ff,       // Blue
  [AlgorithmType.DFS]: 0xaa44ff,       // Purple
  [AlgorithmType.IDS]: 0x6644ff,       // Blue-Purple
  [AlgorithmType.DLS]: 0xffcc00,       // Yellow
  [AlgorithmType.UCS]: 0x44dd66,       // Green
  [AlgorithmType.ASTAR]: 0xffd700,     // Gold
  [AlgorithmType.GREEDY_BFS]: 0xff4444, // Red
  [AlgorithmType.HILL_CLIMBING]: 0xff8800, // Orange
};

// Enemy Types
export enum EnemyType {
  TOAD = 'Mutant Toad',
  GHOST = 'Ghost',
  HEROINE = 'Bridge Heroine',
  OGRE = 'Ogre',
  TERRIBLE_KNIGHT = 'Terrible Knight',
  WEREWOLF = 'WereWolf',
  FROGGY = 'Sunny Froggy',
  DEMON = 'Demon',
  MUMMY = 'Mummy',
  BOMBER = 'Bomber',
  KNIGHT = 'Knight',
  BARBARIAN = 'Barbarian',
  WARRIOR = 'Warrior',
  ASSASSIN = 'Assassin',
  NECROMANCER = 'Necromancer',
  DRAGON = 'Dragon',
  LIZARD = 'Lizard',
  SPACE_MARINE = 'Space Marine',
  SUNNY_MUSHROOM = 'Sunny Mushroom',
}

// Enemy ➜ Default Algorithm mapping
export const ENEMY_DEFAULT_ALGORITHM: Record<EnemyType, AlgorithmType> = {
  [EnemyType.TOAD]: AlgorithmType.BFS,
  [EnemyType.GHOST]: AlgorithmType.DFS,
  [EnemyType.HEROINE]: AlgorithmType.IDS,
  [EnemyType.OGRE]: AlgorithmType.DLS,
  [EnemyType.TERRIBLE_KNIGHT]: AlgorithmType.UCS,
  [EnemyType.WEREWOLF]: AlgorithmType.ASTAR,
  [EnemyType.FROGGY]: AlgorithmType.GREEDY_BFS,
  [EnemyType.DEMON]: AlgorithmType.HILL_CLIMBING,
  [EnemyType.MUMMY]: AlgorithmType.BFS,
  [EnemyType.BOMBER]: AlgorithmType.GREEDY_BFS,
  [EnemyType.KNIGHT]: AlgorithmType.UCS,
  [EnemyType.BARBARIAN]: AlgorithmType.DLS,
  [EnemyType.WARRIOR]: AlgorithmType.IDS,
  [EnemyType.ASSASSIN]: AlgorithmType.ASTAR,
  [EnemyType.NECROMANCER]: AlgorithmType.HILL_CLIMBING,
  [EnemyType.DRAGON]: AlgorithmType.UCS,
  [EnemyType.LIZARD]: AlgorithmType.GREEDY_BFS,
  [EnemyType.SPACE_MARINE]: AlgorithmType.ASTAR,
  [EnemyType.SUNNY_MUSHROOM]: AlgorithmType.HILL_CLIMBING,
};

// Behavior Tree node status
export enum BTStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  RUNNING = 'running',
}

// Directions for grid movement
export const DIRECTIONS_4 = [
  { x: 0, y: -1 }, // Up
  { x: 1, y: 0 },  // Right
  { x: 0, y: 1 },  // Down
  { x: -1, y: 0 }, // Left
];

export const DIRECTIONS_8 = [
  ...DIRECTIONS_4,
  { x: 1, y: -1 },  // Up-Right
  { x: 1, y: 1 },   // Down-Right
  { x: -1, y: 1 },  // Down-Left
  { x: -1, y: -1 }, // Up-Left
];

// Player defaults
export const PLAYER_SPEED = 3; // tiles per second
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_VISION_RANGE = 8; // tiles

// Game settings
export const TARGET_FPS = 60;
export const ANALYTICS_UPDATE_INTERVAL = 500; // ms
