// ========================
// EnemyBase — Base class for all enemy entities
// Wires together: AIComponent, BehaviorTree, Genome, Pathfinding, Sprite
//
// MOVEMENT EXPLAINED:
// - Grid coordinates (tileX, tileY) are the "truth" position
// - World pixel position = tileX * TILE_SIZE + TILE_SIZE/2
// - Sprite lerps smoothly toward pixel position each frame
// - Collision is checked against Grid.getNode().walkable — NOT sprite bounds
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

export interface EnemyPerformanceLive {
  timePlayerVisible: number;
  damageDealt: number;
  playerDetections: number;
  survivalTime: number;
  tilesVisited: Set<string>;
  timeStuck: number;
}

export class EnemyBase {
  readonly id: string;
  readonly type: EnemyType;

  // Position (tile coordinates — the authoritative position)
  tileX: number;
  tileY: number;

  // Pixel position (lerped toward tile pos for smooth motion)
  pixelX: number;
  pixelY: number;

  homeX: number;
  homeY: number;

  // Stats (scaled by genome)
  health: number;
  maxHealth: number;
  speed: number;       // pixels per second
  visionRange: number; // tiles
  attackDamage: number;
  attackRange: number; // tiles
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

  // Jamming (from Heuristic Jammer item)
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

  constructor(
    type: EnemyType,
    tileX: number,
    tileY: number,
    genome?: Genome,
    behaviorTree?: BehaviorTree
  ) {
    this.id = uuid();
    this.type = type;
    this.tileX = tileX;
    this.tileY = tileY;
    this.homeX = tileX;
    this.homeY = tileY;
    this.pixelX = tileX * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = tileY * TILE_SIZE + TILE_SIZE / 2;

    // Use provided genome or create random one
    this.genome = genome ?? createRandomGenome(0);

    // Scale stats from genome
    this.maxHealth = 50 + Math.round(this.genome.speed * 50);
    this.health = this.maxHealth;
    this.speed = 60 + this.genome.speed * 120;     // 60–180 px/s
    this.visionRange = 3 + this.genome.vision * 7; // 3–10 tiles
    this.attackDamage = 8 + Math.round(this.genome.aggression * 24);
    this.attackRange = 1.5;
    this.attackCooldown = 1.5 - this.genome.aggression * 0.5;
    this.attackTimer = 0;

    // AI state
    this.currentAlgorithm = ENEMY_DEFAULT_ALGORITHM[type];
    this.alertState = AlertState.IDLE;

    // Blackboard
    this.blackboard = createBlackboard(0);
    this.blackboard.homeX = tileX;
    this.blackboard.homeY = tileY;
    this.blackboard.aggression = this.genome.aggression;
    this.blackboard.persistence = this.genome.persistence;
    this.blackboard.visionRange = this.visionRange;

    // Behavior tree
    this.behaviorTree = behaviorTree ?? this.buildDefaultTree();

    // Sprite
    this.gameSprite = createEnemySprite(type);
    this.container = this.gameSprite.container;
    this.container.x = this.pixelX;
    this.container.y = this.pixelY;
    this.container.zIndex = 5;
  }

  /** Main update called every frame */
  update(dt: number, grid: Grid, playerTileX: number, playerTileY: number): void {
    if (!this.isAlive) return;

    this.performance.survivalTime += dt;
    this.performance.tilesVisited.add(`${this.tileX},${this.tileY}`);

    // Update timers
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.isJammed) {
      this.jamTimer -= dt;
      if (this.jamTimer <= 0) this.isJammed = false;
    }

    // Update blackboard
    this.updateBlackboard(playerTileX, playerTileY);

    // Tick behavior tree
    this.behaviorTree.tick(this.blackboard, dt);

    // Follow path
    this.followPath(dt, grid);

    // Lerp pixel position toward tile position
    const targetX = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const targetY = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    this.pixelX = lerp(this.pixelX, targetX, Math.min(1, dt * 12));
    this.pixelY = lerp(this.pixelY, targetY, Math.min(1, dt * 12));

    // Update sprite
    this.container.x = this.pixelX;
    this.container.y = this.pixelY;

    // Facing direction
    if (targetX < this.pixelX - 2) {
      this.facingRight = false;
      this.gameSprite.setFlipX(true);
    } else if (targetX > this.pixelX + 2) {
      this.facingRight = true;
      this.gameSprite.setFlipX(false);
    }

    // Update health bar
    updateHealthBar(this.container, this.health / this.maxHealth);
  }

  /** Request a new path to target using current algorithm */
  requestPath(grid: Grid, targetX: number, targetY: number): void {
    if (this.pathRequestPending) return;
    if (
      this.lastPathTarget?.x === targetX &&
      this.lastPathTarget?.y === targetY &&
      this.currentPath.length > 0
    ) return; // Same target, keep current path

    this.pathRequestPending = true;
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

    this.currentPath = result.path;
    this.pathIndex = 1; // Skip first node (current position)
    this.nodesExpanded = result.nodesExpanded;
    this.pathComputeTimeMs = result.timeMs;
    this.pathRequestPending = false;
  }

  /** Move along the current path */
  private followPath(dt: number, grid: Grid): void {
    if (this.currentPath.length === 0 || this.pathIndex >= this.currentPath.length) return;

    const nextNode = this.currentPath[this.pathIndex];
    if (!nextNode) return;

    // Move tile-by-tile based on speed
    const dx = nextNode.x - this.tileX;
    const dy = nextNode.y - this.tileY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const tilesPerSecond = this.speed / TILE_SIZE;
    if (dist < tilesPerSecond * dt + 0.01) {
      // Arrived at next tile
      const node = grid.getNode(nextNode.x, nextNode.y);
      if (node && node.walkable) {
        this.tileX = nextNode.x;
        this.tileY = nextNode.y;
        this.pathIndex++;
      } else {
        // Path blocked — clear it so we reroute next frame
        this.currentPath = [];
      }
    }
  }

  /** Get current effective algorithm (respects jammer) */
  getActiveAlgorithm(): AlgorithmType {
    if (this.isJammed) return AlgorithmType.DFS;

    // Alert state can override genome preference
    switch (this.alertState) {
      case AlertState.FLEEING:
        return AlgorithmType.UCS; // Cheapest escape route
      case AlertState.SUSPICIOUS:
        return AlgorithmType.BFS; // Search area
      case AlertState.CHASING:
      case AlertState.ALERT:
        return getPreferredAlgorithm(this.genome); // Genome decides
      default:
        return ENEMY_DEFAULT_ALGORITHM[this.type];
    }
  }

  /** Apply the Heuristic Jammer item effect */
  applyJammer(duration: number): void {
    this.isJammed = true;
    this.jamTimer = duration;
    this.currentPath = []; // Force reroute with DFS
  }

  /** Take damage */
  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.die();
  }

  /** Die */
  die(): void {
    this.isAlive = false;
    this.gameSprite.setAnimation('death');
    // Fade out over 0.5s
    let t = 0;
    const interval = setInterval(() => {
      t += 0.05;
      this.gameSprite.setAlpha(1 - t * 2);
      if (t >= 0.5) {
        clearInterval(interval);
        this.container.destroy({ children: true });
      }
    }, 16);
  }

  /** Update blackboard from world state */
  private updateBlackboard(playerTileX: number, playerTileY: number): void {
    this.blackboard.posX = this.tileX;
    this.blackboard.posY = this.tileY;
    this.blackboard.health = this.health;
    this.blackboard.maxHealth = this.maxHealth;
    this.blackboard.playerX = playerTileX;
    this.blackboard.playerY = playerTileY;
    this.blackboard.alertState = this.alertState;
    this.blackboard.hasPath = this.currentPath.length > 0;

    const dx = playerTileX - this.tileX;
    const dy = playerTileY - this.tileY;
    this.blackboard.distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
  }

  /** Build a default behavior tree (overridden by each archetype) */
  protected buildDefaultTree(): BehaviorTree {
    // Simple: if player visible → chase, else patrol
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

  /** Get analytics snapshot for the overlay panel */
  getAnalyticsSnapshot() {
    return {
      entityId: 0,
      enemyType: this.type,
      algorithm: this.getActiveAlgorithm(),
      alertState: this.alertState,
      genomeId: this.genome.id,
      nodesExpanded: this.nodesExpanded,
      pathLength: this.currentPath.length,
      pathComputeTimeMs: this.pathComputeTimeMs,
      position: { x: this.tileX, y: this.tileY },
    };
  }
}
