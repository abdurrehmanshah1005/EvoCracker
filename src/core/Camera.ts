// ========================
// Camera — Viewport with smooth follow, deadzone, and world bounds
// ========================

import { lerp, clamp } from '@utils/math';
import { TILE_SIZE } from '@utils/constants';

export interface CameraConfig {
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  followSpeed: number;     // 0-1, higher = snappier
  deadzoneWidth: number;   // Pixels - player can move this far before camera follows
  deadzoneHeight: number;
  zoom: number;
}

export class Camera {
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;

  config: CameraConfig;

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = {
      viewportWidth: 800,
      viewportHeight: 600,
      worldWidth: 50 * TILE_SIZE,
      worldHeight: 40 * TILE_SIZE,
      followSpeed: 0.15,
      deadzoneWidth: 60,
      deadzoneHeight: 40,
      zoom: 1,
      ...config,
    };
  }

  /** Update camera to follow a target position — always centering on target */
  follow(targetWorldX: number, targetWorldY: number, dt: number): void {
    // Always center on target (no deadzone)
    this.targetX = targetWorldX - this.config.viewportWidth / (2 * this.config.zoom);
    this.targetY = targetWorldY - this.config.viewportHeight / (2 * this.config.zoom);


    // Smooth lerp toward target
    const speed = 1 - Math.pow(1 - this.config.followSpeed, dt * 60);
    this.x = lerp(this.x, this.targetX, speed);
    this.y = lerp(this.y, this.targetY, speed);

    // Clamp to world bounds
    const maxX = this.config.worldWidth - this.config.viewportWidth / this.config.zoom;
    const maxY = this.config.worldHeight - this.config.viewportHeight / this.config.zoom;

    if (maxX < 0) {
      this.x = maxX / 2;
    } else {
      this.x = clamp(this.x, 0, maxX);
    }

    if (maxY < 0) {
      this.y = maxY / 2;
    } else {
      this.y = clamp(this.y, 0, maxY);
    }
  }

  /** Snap camera to target instantly */
  snapTo(worldX: number, worldY: number): void {
    this.x = worldX - this.config.viewportWidth / (2 * this.config.zoom);
    this.y = worldY - this.config.viewportHeight / (2 * this.config.zoom);

    // Clamp within world bounds
    const maxX = this.config.worldWidth - this.config.viewportWidth / this.config.zoom;
    const maxY = this.config.worldHeight - this.config.viewportHeight / this.config.zoom;
    if (maxX < 0) { this.x = maxX / 2; } else { this.x = clamp(this.x, 0, maxX); }
    if (maxY < 0) { this.y = maxY / 2; } else { this.y = clamp(this.y, 0, maxY); }

    this.targetX = this.x;
    this.targetY = this.y;
  }

  /** Convert screen coordinates to world coordinates */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX / this.config.zoom + this.x,
      y: screenY / this.config.zoom + this.y,
    };
  }

  /** Convert world coordinates to screen coordinates */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.config.zoom,
      y: (worldY - this.y) * this.config.zoom,
    };
  }

  /** Convert screen position to grid tile coordinates */
  screenToTile(screenX: number, screenY: number): { col: number; row: number } {
    const world = this.screenToWorld(screenX, screenY);
    return {
      col: Math.floor(world.x / TILE_SIZE),
      row: Math.floor(world.y / TILE_SIZE),
    };
  }

  /** Get visible tile bounds for culling */
  getVisibleBounds(): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    const vw = this.config.viewportWidth / this.config.zoom;
    const vh = this.config.viewportHeight / this.config.zoom;

    return {
      minCol: Math.max(0, Math.floor(this.x / TILE_SIZE) - 1),
      maxCol: Math.min(
        Math.ceil(this.config.worldWidth / TILE_SIZE),
        Math.ceil((this.x + vw) / TILE_SIZE) + 1
      ),
      minRow: Math.max(0, Math.floor(this.y / TILE_SIZE) - 1),
      maxRow: Math.min(
        Math.ceil(this.config.worldHeight / TILE_SIZE),
        Math.ceil((this.y + vh) / TILE_SIZE) + 1
      ),
    };
  }

  /** Update viewport dimensions (on resize) */
  setViewport(width: number, height: number): void {
    this.config.viewportWidth = width;
    this.config.viewportHeight = height;
  }

  /** Set world bounds (on floor change) */
  setWorldBounds(width: number, height: number): void {
    this.config.worldWidth = width;
    this.config.worldHeight = height;
  }

  /** Set zoom level */
  setZoom(zoom: number): void {
    this.config.zoom = clamp(zoom, 0.5, 3);
  }
}
