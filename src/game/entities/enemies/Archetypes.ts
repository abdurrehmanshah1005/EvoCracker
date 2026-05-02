// ========================
// Enemy Archetypes — 8 distinct AI personalities
// Each overrides buildDefaultTree() and has a unique special ability
// ========================

import { EnemyType, AlertState, TILE_SIZE, BTStatus } from '@utils/constants';
import {
  BehaviorTree,
  Selector, Sequence, Condition, Action, Wait,
  createBlackboard, type Blackboard,
} from '@ai/behavior/BehaviorTree';
import type { Genome } from '@ai/evolution/GeneticAlgorithm';
import { EnemyBase } from './EnemyBase';

// ── 1. SLIME — BFS searcher ──────────────────────────────────────────
export class Slime extends EnemyBase {
  private splitOnDeath = true;

  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.TOAD, tileX, tileY, genome);
    this.speed *= 0.7;       // Slow
    this.visionRange *= 0.8; // Short vision but wide BFS search
  }

  protected buildDefaultTree(): BehaviorTree {
    const bb = this.blackboard;
    const root = new Selector('root', [
      // If player very close — engulf
      new Sequence('engulf', [
        new Condition('playerAdjacent', (b: Blackboard) => b.distanceToPlayer < 1.5),
        new Action('attack', (_b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          return BTStatus.RUNNING;
        }),
      ]),
      // If player seen — BFS search
      new Sequence('bfsSearch', [
        new Condition('playerVisible', (b: Blackboard) => b.distanceToPlayer < this.visionRange),
        new Action('chaseBFS', (b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          b.lastKnownPlayerX = b.playerX;
          b.lastKnownPlayerY = b.playerY;
          return BTStatus.RUNNING;
        }),
      ]),
      // Idle — slow ooze patrol
      new Sequence('ooze', [
        new Wait('wait', 2.5),
        new Action('wander', (_b: Blackboard) => {
          this.alertState = AlertState.IDLE;
          return BTStatus.SUCCESS;
        }),
      ]),
    ]);
    return new BehaviorTree(this.id, root);
  }

  /** Special: Split into micro-slimes on death */
  die(): void {
    if (this.splitOnDeath && this.health <= 0) {
      this.splitOnDeath = false;
      // Emit split event — SpawnSystem listens
      import('@core/EventBus').then(({ EventBus, GameEvents }) => {
        EventBus.getInstance().emit(GameEvents.ENEMY_DEATH, {
          type: EnemyType.TOAD,
          tileX: this.tileX,
          tileY: this.tileY,
          split: true,
        });
      });
    }
    super.die();
  }
}

// ── 2. BAT — DFS scout ───────────────────────────────────────────────
export class Bat extends EnemyBase {
  private canFlyOverWall = true; // Special: can cross one wall tile
  private flyCharges = 2;

  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.GHOST, tileX, tileY, genome);
    this.speed *= 1.4;       // Fast
    this.attackDamage *= 0.7; // Weak
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      new Sequence('diveBomb', [
        new Condition('playerClose', (b: Blackboard) => b.distanceToPlayer < this.visionRange),
        new Action('chase', (_b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          return BTStatus.RUNNING;
        }),
      ]),
      new Sequence('deepScout', [
        new Action('dfsSweep', (_b: Blackboard) => {
          this.alertState = AlertState.SUSPICIOUS;
          return BTStatus.RUNNING;
        }),
        new Wait('pauseBetweenSweeps', 1.0),
      ]),
    ]);
    return new BehaviorTree(this.id, root);
  }
}

// ── 3. INQUISITOR — IDS methodical clearer ───────────────────────────
export class Inquisitor extends EnemyBase {
  public searchedRooms: Set<string> = new Set();
  private currentDepthLimit = 3;

  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.HEROINE, tileX, tileY, genome);
    this.speed *= 0.85;
    this.visionRange *= 1.2;
    this.attackDamage *= 1.5; // Strong melee
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      // If player spotted — IDS hunt
      new Sequence('idsHunt', [
        new Condition('alerted', (b: Blackboard) => b.distanceToPlayer < this.visionRange),
        new Action('interrogate', (b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          b.lastKnownPlayerX = b.playerX;
          b.lastKnownPlayerY = b.playerY;
          // Mark room as searched
          this.searchedRooms.add(`${Math.floor(b.posX / 8)},${Math.floor(b.posY / 8)}`);
          return BTStatus.RUNNING;
        }),
      ]),
      // Systematic room clearing with increasing depth
      new Sequence('systematicClear', [
        new Action('sweepRoom', (_b: Blackboard) => {
          this.alertState = AlertState.SUSPICIOUS;
          this.currentDepthLimit = Math.min(this.currentDepthLimit + 1, 15);
          return BTStatus.SUCCESS;
        }),
        new Wait('pause', 1.5),
      ]),
    ]);
    return new BehaviorTree(this.id, root);
  }
}

// ── 4. LEASHED GUARD — DLS patrol radius ─────────────────────────────
export class LeashedGuard extends EnemyBase {
  public leashRadius: number;

  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.OGRE, tileX, tileY, genome);
    this.leashRadius = 5 + Math.round(genome?.persistence ?? 0.5) * 5; // 5–10 tiles
    this.attackDamage *= 1.2;
    this.maxHealth = Math.round(this.maxHealth * 1.5);
    this.health = this.maxHealth;
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      // Return to post if pulled too far
      new Sequence('returnToPost', [
        new Condition('tooFar', (b: Blackboard) => {
          const dx = b.posX - this.homeX;
          const dy = b.posY - this.homeY;
          return Math.sqrt(dx*dx + dy*dy) > this.leashRadius;
        }),
        new Action('returnHome', (_b: Blackboard) => {
          this.alertState = AlertState.IDLE;
          return BTStatus.RUNNING;
        }),
      ]),
      // Chase if player inside patrol radius
      new Sequence('guardPost', [
        new Condition('playerInRadius', (b: Blackboard) => b.distanceToPlayer < this.visionRange),
        new Action('challenge', (_b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          return BTStatus.RUNNING;
        }),
      ]),
      // Patrol in small circle
      new Action('patrol', (_b: Blackboard) => {
        this.alertState = AlertState.IDLE;
        return BTStatus.RUNNING;
      }),
    ]);
    return new BehaviorTree(this.id, root);
  }
}

// ── 5. ROYAL KNIGHT — UCS weighted terrain ───────────────────────────
export class RoyalKnight extends EnemyBase {
  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.TERRIBLE_KNIGHT, tileX, tileY, genome);
    this.maxHealth = Math.round(this.maxHealth * 2);
    this.health = this.maxHealth;
    this.attackDamage *= 1.8;
    this.speed *= 0.75; // Slow but tanky
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      // Flee when very low health
      new Sequence('honorableRetreat', [
        new Condition('lowHp', (b: Blackboard) => b.health / b.maxHealth < 0.2),
        new Action('retreat', (_b: Blackboard) => {
          this.alertState = AlertState.FLEEING;
          return BTStatus.RUNNING;
        }),
      ]),
      // Hunt player with UCS (respects terrain costs)
      new Sequence('honorablyPursue', [
        new Condition('playerVisible', (b: Blackboard) => b.distanceToPlayer < this.visionRange),
        new Action('advance', (b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          b.lastKnownPlayerX = b.playerX;
          b.lastKnownPlayerY = b.playerY;
          return BTStatus.RUNNING;
        }),
      ]),
      // Patrol main hall
      new Action('marchPatrol', (_b: Blackboard) => {
        this.alertState = AlertState.IDLE;
        return BTStatus.RUNNING;
      }),
    ]);
    return new BehaviorTree(this.id, root);
  }
}

// ── 6. ASSASSIN — A* optimal chaser ─────────────────────────────────
export class Assassin extends EnemyBase {
  private dashCooldown = 0;
  private dashCharges = 3;

  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.WEREWOLF, tileX, tileY, genome);
    this.speed *= 1.3;
    this.maxHealth = Math.round(this.maxHealth * 0.7); // Fragile
    this.health = this.maxHealth;
    this.attackDamage *= 2.0; // High burst damage
  }

  update(dt: number, grid: import('@ai/pathfinding/Grid').Grid, playerX: number, playerY: number): void {
    super.update(dt, grid, playerX, playerY);
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
  }

  /** Special: Teleport 3 tiles closer when detecting player */
  dash(targetX: number, targetY: number, grid: import('@ai/pathfinding/Grid').Grid): void {
    if (this.dashCooldown > 0 || this.dashCharges <= 0) return;
    const dx = Math.sign(targetX - this.tileX);
    const dy = Math.sign(targetY - this.tileY);
    for (let i = 1; i <= 3; i++) {
      const nx = this.tileX + dx * i;
      const ny = this.tileY + dy * i;
      const node = grid.getNode(nx, ny);
      if (node && node.walkable) {
        this.tileX = nx;
        this.tileY = ny;
      } else break;
    }
    this.dashCooldown = 4;
    this.dashCharges--;
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      new Sequence('eliminate', [
        new Condition('detected', (b: Blackboard) => b.distanceToPlayer < this.visionRange),
        new Action('chase', (b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          b.lastKnownPlayerX = b.playerX;
          b.lastKnownPlayerY = b.playerY;
          return BTStatus.RUNNING;
        }),
      ]),
      new Sequence('stalk', [
        new Condition('hasPreviousContact', (b: Blackboard) => b.lastKnownPlayerX >= 0),
        new Action('moveToLastKnown', (b: Blackboard) => {
          this.alertState = AlertState.ALERT;
          return BTStatus.RUNNING;
        }),
        new Wait('wait', 3),
        new Action('resetContact', (b: Blackboard) => {
          b.lastKnownPlayerX = -1;
          return BTStatus.SUCCESS;
        }),
      ]),
      new Action('shadow', (_b: Blackboard) => {
        this.alertState = AlertState.IDLE;
        return BTStatus.RUNNING;
      }),
    ]);
    return new BehaviorTree(this.id, root);
  }
}

// ── 7. GOBLIN — Greedy BFS reckless charge ───────────────────────────
export class Goblin extends EnemyBase {
  private rageMode = false;
  private rageTimer = 0;

  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.FROGGY, tileX, tileY, genome);
    this.speed *= 1.2;
    this.maxHealth = Math.round(this.maxHealth * 0.6);
    this.health = this.maxHealth;
  }

  update(dt: number, grid: import('@ai/pathfinding/Grid').Grid, playerX: number, playerY: number): void {
    super.update(dt, grid, playerX, playerY);
    if (this.rageMode) {
      this.rageTimer -= dt;
      if (this.rageTimer <= 0) {
        this.rageMode = false;
        this.speed /= 2;
        this.container.tint = 0xffffff;
      }
    }
    // Enter rage when at 50% health
    if (!this.rageMode && this.health < this.maxHealth * 0.5) {
      this.enterRage();
    }
  }

  enterRage(): void {
    this.rageMode = true;
    this.rageTimer = 8;
    this.speed *= 2;
    this.container.tint = 0xff6644;
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      new Sequence('charge', [
        new Condition('playerSeen', (b: Blackboard) => b.distanceToPlayer < this.visionRange * 1.5),
        new Action('greedyCharge', (b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          b.lastKnownPlayerX = b.playerX;
          b.lastKnownPlayerY = b.playerY;
          return BTStatus.RUNNING;
        }),
      ]),
      new Sequence('wander', [
        new Action('randomWander', (_b: Blackboard) => {
          this.alertState = AlertState.IDLE;
          return BTStatus.RUNNING;
        }),
        new Wait('hyper', 0.5),
      ]),
    ]);
    return new BehaviorTree(this.id, root);
  }
}

// ── 8. ARCHER — Hill Climbing vantage seeker ─────────────────────────
export class Archer extends EnemyBase {
  private rangedRange = 5; // tiles (ranged) — renamed to avoid conflict with base attackRange
  private inPosition = false;

  constructor(tileX: number, tileY: number, genome?: Genome) {
    super(EnemyType.DEMON, tileX, tileY, genome);
    this.speed *= 0.7;
    this.attackDamage *= 0.8; // Lower per-hit, but ranged
  }

  protected buildDefaultTree(): BehaviorTree {
    const root = new Selector('root', [
      // Shoot if in range and has LOS
      new Sequence('shoot', [
        new Condition('inRange', (b: Blackboard) => b.distanceToPlayer < this.rangedRange && b.distanceToPlayer > 2),
        new Action('fire', (_b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          this.inPosition = true;
          return BTStatus.RUNNING;
        }),
      ]),
      // Seek better vantage (Hill Climbing)
      new Sequence('reposition', [
        new Action('seekVantage', (b: Blackboard) => {
          this.alertState = AlertState.CHASING;
          if (b.playerVisible) {
            b.lastKnownPlayerX = b.playerX;
            b.lastKnownPlayerY = b.playerY;
          }
          this.inPosition = false;
          return BTStatus.RUNNING;
        }),
        new Wait('settle', 1.5),
      ]),
      // Retreat if player too close
      new Sequence('retreat', [
        new Condition('tooClose', (b: Blackboard) => b.distanceToPlayer < 2),
        new Action('backAway', (_b: Blackboard) => {
          this.alertState = AlertState.FLEEING;
          return BTStatus.RUNNING;
        }),
      ]),
    ]);
    return new BehaviorTree(this.id, root);
  }
}

// ── Enemy Factory ─────────────────────────────────────────────────────

export function createEnemy(
  type: EnemyType,
  tileX: number,
  tileY: number,
  genome?: Genome
): EnemyBase {
  switch (type) {
    case EnemyType.TOAD:         return new Slime(tileX, tileY, genome);
    case EnemyType.GHOST:        return new Bat(tileX, tileY, genome);
    case EnemyType.HEROINE:      return new Inquisitor(tileX, tileY, genome);
    case EnemyType.OGRE:         return new LeashedGuard(tileX, tileY, genome);
    case EnemyType.TERRIBLE_KNIGHT: return new RoyalKnight(tileX, tileY, genome);
    case EnemyType.WEREWOLF:     return new Assassin(tileX, tileY, genome);
    case EnemyType.FROGGY:       return new Goblin(tileX, tileY, genome);
    case EnemyType.DEMON:        return new Archer(tileX, tileY, genome);
    default:                     return new Slime(tileX, tileY, genome);
  }
}

// Map floor number to which enemy types appear
// All 8 types are available from floor 1 to ensure variety and demonstrate all algorithms
export function getEnemyTypesForFloor(_floor: number): EnemyType[] {
  return Object.values(EnemyType);
}
