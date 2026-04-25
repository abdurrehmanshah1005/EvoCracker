// ========================
// EnemyBase — Core enemy entity with WORKING movement & AI
//
// MOVEMENT: Smooth sub-tile pixel interpolation.
//   - Each frame: lerp pixelX/Y toward current target tile
//   - When close enough to target, snap and advance pathIndex
//   - This gives smooth movement instead of teleporting tile-to-tile
// ========================

import { Container } from 'pixi.js';
import { EnemyType, AlgorithmType, AlertState, TILE_SIZE, ENEMY_DEFAULT_ALGORITHM } from '@utils/constants';
import { createEnemySprite, updateHealthBar, type GameSprite } from '@core/SpriteFactory';
import {
  BehaviorTree, Selector, Sequence, Condition, Action,
  createBlackboard, type Blackboard,
} from '@ai/behavior/BehaviorTree';
import { BTStatus } from '@utils/constants';
import { createRandomGenome, getPreferredAlgorithm, type Genome } from '@ai/evolution/GeneticAlgorithm';
import { findPath } from '@ai/pathfinding/AlgorithmRegistry';
import type { Grid } from '@ai/pathfinding/Grid';
import { lerp } from '@utils/math';
import { uuid } from '@utils/random';
import { randomInt } from '@utils/random';

export interface EnemyPerformanceLive {
  timePlayerVisible: number;
  damageDealt: number;
  playerDetections: number;
  survivalTime: number;
  tilesVisited: Set<string>;
  timeStuck: number;
}

export class EnemyBase {
  private static nextEntityId = 1;

  readonly id: string;
  readonly entityId: number;
  readonly type: EnemyType;

  // Position: tile coords are authoritative
  tileX: number;
  tileY: number;

  // Pixel position: smoothly lerps toward tile position
  pixelX: number;
  pixelY: number;

  homeX: number;
  homeY: number;

  // Stats
  health: number;
  maxHealth: number;
  speed: number;          // tiles per second (NOT pixels)
  visionRange: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;

  // AI
  genome: Genome;
  blackboard: Blackboard;
  behaviorTree: BehaviorTree;
  currentAlgorithm: AlgorithmType;
  alertState: AlertState;

  // Path following
  currentPath: { x: number; y: number }[] = [];
  pathIndex: number = 0;
  pathRequestPending: boolean = false;
  lastPathTarget: { x: number; y: number } | null = null;

  // Movement accumulator — tracks fractional tile progress
  private moveAccumulator: number = 0;

  // Patrol
  patrolTarget: { x: number; y: number } | null = null;
  patrolCooldown: number = 0;

  // Jamming
  isJammed: boolean = false;
  jamTimer: number = 0;

  // Rendering
  gameSprite: GameSprite;
  container: Container;
  facingRight: boolean = true;

  // Analytics
  nodesExpanded: number = 0;
  pathComputeTimeMs: number = 0;
  performance: EnemyPerformanceLive = {
    timePlayerVisible: 0,
    damageDealt: 0,
    playerDetections: 0,
    survivalTime: 0,
    tilesVisited: new Set(),
    timeStuck: 0,
  };

  isAlive: boolean = true;
  stunnedTimer: number = 0;
  private difficultyApplied = false;

  constructor(
    type: EnemyType,
    tileX: number,
    tileY: number,
    genome?: Genome,
    behaviorTree?: BehaviorTree
  ) {
    this.id = uuid();
    this.entityId = EnemyBase.nextEntityId++;
    this.type = type;
    this.tileX = tileX;
    this.tileY = tileY;
    this.homeX = tileX;
    this.homeY = tileY;
    this.pixelX = tileX * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.genome = genome ?? createRandomGenome(0);

    // Stats scaled from genome — reasonable values
    this.maxHealth = 30 + Math.round(this.genome.cautiousness * 70);
    this.health = this.maxHealth;
    this.speed = 1.5 + this.genome.speed * 3;     // 1.5–4.5 tiles/sec
    this.visionRange = 4 + this.genome.vision * 6; // 4–10 tiles
    this.attackDamage = 5 + Math.round(this.genome.aggression * 15);
    this.attackRange = 1.5;
    this.attackCooldown = 1.0;
    this.attackTimer = 0;

    this.currentAlgorithm = ENEMY_DEFAULT_ALGORITHM[type];
    this.alertState = AlertState.IDLE;

    this.blackboard = createBlackboard(0);
    this.blackboard.homeX = tileX;
    this.blackboard.homeY = tileY;
    this.blackboard.aggression = this.genome.aggression;
    this.blackboard.persistence = this.genome.persistence;
    this.blackboard.visionRange = this.visionRange;

    this.behaviorTree = behaviorTree ?? this.buildDefaultTree();

    this.gameSprite = createEnemySprite(type);
    this.container = this.gameSprite.container;
    this.container.x = this.pixelX;
    this.container.y = this.pixelY;
    this.container.zIndex = 5;
  }

  /** Scale core stats by iteration difficulty (applied once per instance). */
  applyDifficulty(multiplier: number): void {
    if (this.difficultyApplied) return;
    const m = Math.max(1, multiplier);
    this.maxHealth = Math.round(this.maxHealth * (1 + (m - 1) * 0.65));
    this.health = this.maxHealth;
    this.attackDamage = Math.round(this.attackDamage * (1 + (m - 1) * 0.55));
    this.speed *= 1 + (m - 1) * 0.2;
    this.visionRange *= 1 + (m - 1) * 0.2;
    this.blackboard.visionRange = this.visionRange;
    this.difficultyApplied = true;
  }

  /** Main update — called every frame */
  update(dt: number, grid: Grid, playerTileX: number, playerTileY: number): void {
    if (!this.isAlive) return;
    if (this.stunnedTimer > 0) { this.stunnedTimer -= dt; return; }

    this.performance.survivalTime += dt;
    this.performance.tilesVisited.add(`${this.tileX},${this.tileY}`);

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.isJammed) {
      this.jamTimer -= dt;
      if (this.jamTimer <= 0) this.isJammed = false;
    }

    // Update blackboard
    this.updateBlackboard(playerTileX, playerTileY);

    // Tick behavior tree (decides alert state)
    this.behaviorTree.tick(this.blackboard, dt);

    // Move along path
    this.followPath(dt, grid);

    // Smooth pixel interpolation toward current tile
    const targetPX = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const targetPY = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    const lerpSpeed = Math.min(1, dt * 10);
    this.pixelX = lerp(this.pixelX, targetPX, lerpSpeed);
    this.pixelY = lerp(this.pixelY, targetPY, lerpSpeed);

    // Update sprite
    this.container.x = this.pixelX;
    this.container.y = this.pixelY;

    // Face direction of movement
    const movDx = targetPX - this.pixelX;
    if (Math.abs(movDx) > 1) {
      this.facingRight = movDx > 0;
      this.gameSprite.setFlipX(!this.facingRight);
    }

    // Alert state visual tint
    if (this.alertState === AlertState.CHASING) {
      this.container.alpha = 1;
    } else if (this.alertState === AlertState.SUSPICIOUS || this.alertState === AlertState.ALERT) {
      this.container.alpha = 0.9;
    }

    // Health bar
    updateHealthBar(this.container, this.health / this.maxHealth);
  }

  /** FIXED: Proper tile-by-tile path following with time-based movement */
  private followPath(dt: number, grid: Grid): void {
    const isAttacking = this.attackTimer > Math.max(0, this.attackCooldown - 0.4);

    if (this.currentPath.length === 0 || this.pathIndex >= this.currentPath.length) {
      if (!isAttacking) this.gameSprite.setAnimation('idle');
      return;
    }

    if (!isAttacking) this.gameSprite.setAnimation('walk');

    // Accumulate movement budget (in tiles)
    this.moveAccumulator += this.speed * dt;

    // Consume accumulated tiles
    while (this.moveAccumulator >= 1 && this.pathIndex < this.currentPath.length) {
      const next = this.currentPath[this.pathIndex];
      if (!next) break;

      const node = grid.getNode(next.x, next.y);
      if (node && node.walkable) {
        this.tileX = next.x;
        this.tileY = next.y;
        this.pathIndex++;
        this.moveAccumulator -= 1;
      } else {
        // Path blocked — need reroute
        this.currentPath = [];
        this.moveAccumulator = 0;
        break;
      }
    }

    // Cap accumulator to prevent teleporting after lag
    if (this.moveAccumulator > 2) this.moveAccumulator = 0;
  }

  /** Request a new path */
  requestPath(grid: Grid, targetX: number, targetY: number): void {
    // Don't re-request same target with an active path
    if (
      this.lastPathTarget?.x === targetX &&
      this.lastPathTarget?.y === targetY &&
      this.currentPath.length > 0 &&
      this.pathIndex < this.currentPath.length
    ) return;

    this.lastPathTarget = { x: targetX, y: targetY };

    const algo = this.isJammed ? AlgorithmType.DFS : this.getActiveAlgorithm();

    const result = findPath({
      algorithm: algo,
      grid,
      startX: this.tileX,
      startY: this.tileY,
      goalX: targetX,
      goalY: targetY,
      depthLimit: Math.round(4 + this.genome.persistence * 12),
    });

    if (result.path.length > 1) {
      this.currentPath = result.path;
      this.pathIndex = 1; // Index 0 = current position
      this.moveAccumulator = 0;
    }

    this.nodesExpanded = result.nodesExpanded;
    this.pathComputeTimeMs = result.timeMs;
  }

  /** Get a random patrol destination near home */
  getPatrolTarget(grid: Grid): { x: number; y: number } | null {
    const radius = 6;
    for (let attempt = 0; attempt < 10; attempt++) {
      const rx = this.homeX + randomInt(-radius, radius);
      const ry = this.homeY + randomInt(-radius, radius);
      const node = grid.getNode(rx, ry);
      if (node && node.walkable) return { x: rx, y: ry };
    }
    return null;
  }

  getActiveAlgorithm(): AlgorithmType {
    if (this.isJammed) return AlgorithmType.DFS;
    switch (this.alertState) {
      case AlertState.FLEEING: return AlgorithmType.UCS;
      case AlertState.SUSPICIOUS: return AlgorithmType.BFS;
      case AlertState.CHASING:
      case AlertState.ALERT:
        return getPreferredAlgorithm(this.genome);
      default:
        return ENEMY_DEFAULT_ALGORITHM[this.type];
    }
  }

  applyJammer(duration: number): void {
    this.isJammed = true;
    this.jamTimer = duration;
    this.currentPath = [];
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.gameSprite.setTint?.(0xff4444);
    setTimeout(() => { if (this.isAlive) this.gameSprite.setTint?.(0xffffff); }, 150);
    if (this.health <= 0) this.die();
  }

  stun(duration: number): void {
    this.stunnedTimer = duration;
    this.currentPath = [];
  }

  die(): void {
    this.isAlive = false;
    // Set death animation — but guard against bad textures
    try {
      this.gameSprite.setAnimation('death');
    } catch {
      // If death anim textures are invalid, just keep current
    }
    this.gameSprite.setAlpha(0.5);
    // Simple delayed hide — no setInterval to avoid crashes on destroyed containers
    setTimeout(() => {
      try {
        this.gameSprite.setAlpha(0);
        this.container.visible = false;
      } catch {
        // Container may already be destroyed
      }
    }, 500);
  }

  private updateBlackboard(playerTileX: number, playerTileY: number): void {
    this.blackboard.posX = this.tileX;
    this.blackboard.posY = this.tileY;
    this.blackboard.health = this.health;
    this.blackboard.maxHealth = this.maxHealth;
    this.blackboard.playerX = playerTileX;
    this.blackboard.playerY = playerTileY;
    this.blackboard.alertState = this.alertState;
    this.blackboard.hasPath = this.currentPath.length > 0;
    this.blackboard.pathComplete = this.pathIndex >= this.currentPath.length;

    const dx = playerTileX - this.tileX;
    const dy = playerTileY - this.tileY;
    this.blackboard.distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      new Sequence('chase', [
        new Condition('playerClose', (bb: Blackboard) => bb.distanceToPlayer < this.visionRange),
        new Action('chasePlayer', (bb: Blackboard) => {
          this.alertState = AlertState.CHASING;
          bb.lastKnownPlayerX = bb.playerX;
          bb.lastKnownPlayerY = bb.playerY;
          return BTStatus.RUNNING;
        }),
      ]),
      new Action('patrol', (_bb: Blackboard) => {
        this.alertState = AlertState.IDLE;
        return BTStatus.RUNNING;
      }),
    ]);
    return new BehaviorTree(this.id, root);
  }

  getAnalyticsSnapshot() {
    return {
      entityId: this.entityId,
      enemyType: this.type,
      algorithm: this.getActiveAlgorithm(),
      alertState: this.alertState,
      genomeId: this.genome.id,
      generation: this.genome.generation,
      speedGene: this.genome.speed,
      visionGene: this.genome.vision,
      aggressionGene: this.genome.aggression,
      nodesExpanded: this.nodesExpanded,
      pathLength: this.currentPath.length,
      pathComputeTimeMs: this.pathComputeTimeMs,
      position: { x: this.tileX, y: this.tileY },
    };
  }
}
