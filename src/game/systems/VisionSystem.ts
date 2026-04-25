// ========================
// VisionSystem — Raycasting FOV for each enemy
// Determines what each enemy can see and updates alert states
// ========================

import { TILE_SIZE } from '@utils/constants';
import type { Grid } from '@ai/pathfinding/Grid';
import type { EnemyBase } from '@game/entities/enemies/EnemyBase';
import { AlertState } from '@utils/constants';
import { EventBus, GameEvents } from '@core/EventBus';

const RAY_STEP = 0.3; // Tiles per step along ray

/**
 * Cast a ray from (fromX, fromY) toward (toX, toY).
 * Returns true if there is clear line of sight.
 */
export function hasLineOfSight(
  grid: Grid,
  fromTileX: number,
  fromTileY: number,
  toTileX: number,
  toTileY: number
): boolean {
  const dx = toTileX - fromTileX;
  const dy = toTileY - fromTileY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return true;

  const stepX = (dx / dist) * RAY_STEP;
  const stepY = (dy / dist) * RAY_STEP;
  const steps = Math.ceil(dist / RAY_STEP);

  let rx = fromTileX;
  let ry = fromTileY;

  for (let i = 0; i < steps; i++) {
    rx += stepX;
    ry += stepY;
    const node = grid.getNode(Math.round(rx), Math.round(ry));
    if (!node || !node.walkable) return false;
  }
  return true;
}

/**
 * Update vision for all enemies each frame.
 * Sets playerVisible on blackboard, triggers alert state changes.
 */
export function updateVision(
  enemies: EnemyBase[],
  playerTileX: number,
  playerTileY: number,
  playerIsHiding: boolean,
  grid: Grid,
  dt: number
): void {
  const bus = EventBus.getInstance();

  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;

    const dx = playerTileX - enemy.tileX;
    const dy = playerTileY - enemy.tileY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Stealth radius: if player hiding, reduce effective vision range
    const effectiveRange = playerIsHiding
      ? enemy.visionRange * 0.4
      : enemy.visionRange;

    const playerInRange = dist <= effectiveRange;
    const hasLOS = playerInRange && hasLineOfSight(grid, enemy.tileX, enemy.tileY, playerTileX, playerTileY);

    const wasVisible = enemy.blackboard.playerVisible;
    enemy.blackboard.playerVisible = hasLOS;

    if (hasLOS) {
      enemy.performance.timePlayerVisible += dt;
      enemy.blackboard.lastKnownPlayerX = playerTileX;
      enemy.blackboard.lastKnownPlayerY = playerTileY;
      enemy.blackboard.alertTimer = 5 + enemy.genome.persistence * 8;

      // Deterministic escalation makes enemies react consistently when player is seen.
      if (enemy.alertState !== AlertState.CHASING) {
        const wasIdle = enemy.alertState === AlertState.IDLE || enemy.alertState === AlertState.SUSPICIOUS;
        enemy.alertState = AlertState.CHASING;
        if (wasIdle) {
          enemy.performance.playerDetections++;
          bus.emit(GameEvents.ENEMY_ALERT_CHANGE, {
            enemyId: enemy.id,
            newState: AlertState.CHASING,
          });
        }
      }
    } else {
      // Lost sight
      if (wasVisible && enemy.alertState === AlertState.CHASING) {
        enemy.alertState = AlertState.ALERT; // Continue searching briefly
        enemy.blackboard.alertTimer = 5 + enemy.genome.persistence * 8; // Search duration
      }

      // Cool down alert timer
      if (enemy.blackboard.alertTimer > 0) {
        enemy.blackboard.alertTimer -= dt;
        if (enemy.alertState !== AlertState.FLEEING && enemy.alertState !== AlertState.ALERT) {
          enemy.alertState = AlertState.ALERT;
        }
        if (enemy.blackboard.alertTimer <= 0 && enemy.alertState !== AlertState.FLEEING) {
          enemy.alertState = AlertState.IDLE;
          enemy.blackboard.lastKnownPlayerX = -1;
          enemy.blackboard.lastKnownPlayerY = -1;
        }
      } else if (enemy.alertState !== AlertState.FLEEING) {
        enemy.alertState = AlertState.IDLE;
      }
    }
  }
}

/**
 * Get all tiles visible from a position within a given range.
 * Used for fog-of-war and the analytics FOV overlay.
 */
export function getVisibleTiles(
  grid: Grid,
  fromX: number,
  fromY: number,
  range: number
): Set<string> {
  const visible = new Set<string>();
  const angles = 360;

  for (let a = 0; a < angles; a++) {
    const rad = (a / angles) * Math.PI * 2;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    let rx = fromX;
    let ry = fromY;

    for (let step = 0; step < range; step += RAY_STEP) {
      rx += dx * RAY_STEP;
      ry += dy * RAY_STEP;
      const tx = Math.round(rx);
      const ty = Math.round(ry);
      const node = grid.getNode(tx, ty);
      if (!node || !node.walkable) break;
      visible.add(`${tx},${ty}`);
    }
  }

  return visible;
}
