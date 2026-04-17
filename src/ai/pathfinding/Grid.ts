// ========================
// Pathfinding Grid — The shared grid representation for all algorithms
// ========================

import { TileType, TILE_WEIGHTS } from '@utils/constants';

export interface GridNode {
  x: number;
  y: number;
  walkable: boolean;
  weight: number;
  tileType: TileType;
  // Per-search state (reset before each search)
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
  visited: boolean;
  inOpenSet: boolean;
  depth: number;
}

export interface PathResult {
  path: { x: number; y: number }[];
  nodesExpanded: number;
  nodesVisited: number;
  timeMs: number;
  success: boolean;
  algorithm: string;
  // Visualization data: visited nodes in order of expansion
  expansionOrder: { x: number; y: number; step: number; cost: number }[];
}

export class Grid {
  readonly width: number;
  readonly height: number;
  private nodes: GridNode[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.nodes = [];

    for (let y = 0; y < height; y++) {
      this.nodes[y] = [];
      for (let x = 0; x < width; x++) {
        this.nodes[y][x] = {
          x,
          y,
          walkable: true,
          weight: 1,
          tileType: TileType.FLOOR_STONE,
          g: Infinity,
          h: 0,
          f: Infinity,
          parent: null,
          visited: false,
          inOpenSet: false,
          depth: 0,
        };
      }
    }
  }

  /** Set tile data from tilemap */
  setTile(x: number, y: number, tileType: TileType): void {
    if (!this.inBounds(x, y)) return;
    const node = this.nodes[y][x];
    node.tileType = tileType;
    node.weight = TILE_WEIGHTS[tileType] ?? 1;
    node.walkable = node.weight < Infinity;
  }

  /** Get node at coordinates */
  getNode(x: number, y: number): GridNode | null {
    if (!this.inBounds(x, y)) return null;
    return this.nodes[y][x];
  }

  /** Check if coordinates are within bounds */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Get walkable neighbors (4-directional) */
  getNeighbors4(node: GridNode): GridNode[] {
    const neighbors: GridNode[] = [];
    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];

    for (const dir of dirs) {
      const nx = node.x + dir.x;
      const ny = node.y + dir.y;
      if (this.inBounds(nx, ny) && this.nodes[ny][nx].walkable) {
        neighbors.push(this.nodes[ny][nx]);
      }
    }

    return neighbors;
  }

  /** Get walkable neighbors (8-directional, diagonal costs √2) */
  getNeighbors8(node: GridNode): GridNode[] {
    const neighbors: GridNode[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = node.x + dx;
        const ny = node.y + dy;
        if (this.inBounds(nx, ny) && this.nodes[ny][nx].walkable) {
          // Prevent corner-cutting through walls
          if (dx !== 0 && dy !== 0) {
            if (!this.nodes[node.y][node.x + dx].walkable || !this.nodes[node.y + dy][node.x].walkable) {
              continue;
            }
          }
          neighbors.push(this.nodes[ny][nx]);
        }
      }
    }
    return neighbors;
  }

  /** Reset all search state (call before running any algorithm) */
  resetSearchState(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const node = this.nodes[y][x];
        node.g = Infinity;
        node.h = 0;
        node.f = Infinity;
        node.parent = null;
        node.visited = false;
        node.inOpenSet = false;
        node.depth = 0;
      }
    }
  }

  /** Reconstruct path from goal back to start */
  reconstructPath(goalNode: GridNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: GridNode | null = goalNode;
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path;
  }

  /** Create a lightweight copy of the grid for web worker transfer */
  serialize(): { width: number; height: number; tiles: number[][] } {
    const tiles: number[][] = [];
    for (let y = 0; y < this.height; y++) {
      tiles[y] = [];
      for (let x = 0; x < this.width; x++) {
        tiles[y][x] = this.nodes[y][x].tileType;
      }
    }
    return { width: this.width, height: this.height, tiles };
  }

  /** Restore grid from serialized data */
  static deserialize(data: { width: number; height: number; tiles: number[][] }): Grid {
    const grid = new Grid(data.width, data.height);
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        grid.setTile(x, y, data.tiles[y][x] as TileType);
      }
    }
    return grid;
  }
}
