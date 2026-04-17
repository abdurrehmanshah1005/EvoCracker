// ========================
// Behavior Tree Engine
// High-level decision layer managing enemy AI states
// ========================

import { BTStatus } from '@utils/constants';

// --- Blackboard: shared data for BT nodes ---
export interface Blackboard {
  // Entity data
  entityId: number;
  posX: number;
  posY: number;
  health: number;
  maxHealth: number;

  // Target data
  playerVisible: boolean;
  playerX: number;
  playerY: number;
  lastKnownPlayerX: number;
  lastKnownPlayerY: number;
  distanceToPlayer: number;

  // State
  alertState: string;
  alertTimer: number;
  heardNoise: boolean;
  noiseX: number;
  noiseY: number;

  // Patrol
  homeX: number;
  homeY: number;
  patrolPoints: { x: number; y: number }[];
  patrolIndex: number;

  // Path
  hasPath: boolean;
  pathComplete: boolean;

  // Genome-driven
  aggression: number;
  persistence: number;
  visionRange: number;

  // Generic data store
  data: Record<string, unknown>;
}

export function createBlackboard(entityId: number): Blackboard {
  return {
    entityId,
    posX: 0, posY: 0,
    health: 100, maxHealth: 100,
    playerVisible: false,
    playerX: 0, playerY: 0,
    lastKnownPlayerX: -1, lastKnownPlayerY: -1,
    distanceToPlayer: Infinity,
    alertState: 'idle',
    alertTimer: 0,
    heardNoise: false,
    noiseX: 0, noiseY: 0,
    homeX: 0, homeY: 0,
    patrolPoints: [],
    patrolIndex: 0,
    hasPath: false,
    pathComplete: false,
    aggression: 0.5,
    persistence: 0.5,
    visionRange: 6,
    data: {},
  };
}

// --- BT Node base ---
export abstract class BTNode {
  abstract name: string;
  abstract tick(blackboard: Blackboard, dt: number): BTStatus;
}

// --- Composite nodes ---

/** Selector (OR): tries children in order, succeeds when first child succeeds */
export class Selector extends BTNode {
  name: string;
  children: BTNode[];

  constructor(name: string, children: BTNode[]) {
    super();
    this.name = name;
    this.children = children;
  }

  tick(blackboard: Blackboard, dt: number): BTStatus {
    for (const child of this.children) {
      const status = child.tick(blackboard, dt);
      if (status !== BTStatus.FAILURE) {
        return status; // SUCCESS or RUNNING
      }
    }
    return BTStatus.FAILURE;
  }
}

/** Sequence (AND): tries children in order, fails when first child fails */
export class Sequence extends BTNode {
  name: string;
  children: BTNode[];

  constructor(name: string, children: BTNode[]) {
    super();
    this.name = name;
    this.children = children;
  }

  tick(blackboard: Blackboard, dt: number): BTStatus {
    for (const child of this.children) {
      const status = child.tick(blackboard, dt);
      if (status !== BTStatus.SUCCESS) {
        return status; // FAILURE or RUNNING
      }
    }
    return BTStatus.SUCCESS;
  }
}

// --- Decorator nodes ---

/** Inverter: flips SUCCESS ↔ FAILURE */
export class Inverter extends BTNode {
  name: string;
  child: BTNode;

  constructor(name: string, child: BTNode) {
    super();
    this.name = name;
    this.child = child;
  }

  tick(blackboard: Blackboard, dt: number): BTStatus {
    const status = this.child.tick(blackboard, dt);
    if (status === BTStatus.SUCCESS) return BTStatus.FAILURE;
    if (status === BTStatus.FAILURE) return BTStatus.SUCCESS;
    return BTStatus.RUNNING;
  }
}

/** Repeater: repeats child N times (or until failure) */
export class Repeater extends BTNode {
  name: string;
  child: BTNode;
  maxRepeats: number;

  constructor(name: string, child: BTNode, maxRepeats = Infinity) {
    super();
    this.name = name;
    this.child = child;
    this.maxRepeats = maxRepeats;
  }

  tick(blackboard: Blackboard, dt: number): BTStatus {
    for (let i = 0; i < this.maxRepeats; i++) {
      const status = this.child.tick(blackboard, dt);
      if (status === BTStatus.FAILURE) return BTStatus.FAILURE;
      if (status === BTStatus.RUNNING) return BTStatus.RUNNING;
    }
    return BTStatus.SUCCESS;
  }
}

/** Succeeder: always returns SUCCESS regardless of child */
export class Succeeder extends BTNode {
  name: string;
  child: BTNode;

  constructor(name: string, child: BTNode) {
    super();
    this.name = name;
    this.child = child;
  }

  tick(blackboard: Blackboard, dt: number): BTStatus {
    this.child.tick(blackboard, dt);
    return BTStatus.SUCCESS;
  }
}

// --- Leaf nodes ---

/** Condition: checks a predicate against the blackboard */
export class Condition extends BTNode {
  name: string;
  private predicate: (bb: Blackboard) => boolean;

  constructor(name: string, predicate: (bb: Blackboard) => boolean) {
    super();
    this.name = name;
    this.predicate = predicate;
  }

  tick(blackboard: Blackboard): BTStatus {
    return this.predicate(blackboard) ? BTStatus.SUCCESS : BTStatus.FAILURE;
  }
}

/** Action: performs an action, returns status */
export class Action extends BTNode {
  name: string;
  private execute: (bb: Blackboard, dt: number) => BTStatus;

  constructor(name: string, execute: (bb: Blackboard, dt: number) => BTStatus) {
    super();
    this.name = name;
    this.execute = execute;
  }

  tick(blackboard: Blackboard, dt: number): BTStatus {
    return this.execute(blackboard, dt);
  }
}

/** Wait: pauses for a duration then succeeds */
export class Wait extends BTNode {
  name: string;
  private duration: number;
  private elapsed = 0;

  constructor(name: string, duration: number) {
    super();
    this.name = name;
    this.duration = duration;
  }

  tick(_blackboard: Blackboard, dt: number): BTStatus {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.elapsed = 0;
      return BTStatus.SUCCESS;
    }
    return BTStatus.RUNNING;
  }
}

// --- Behavior Tree wrapper ---
export class BehaviorTree {
  readonly id: string;
  readonly root: BTNode;

  constructor(id: string, root: BTNode) {
    this.id = id;
    this.root = root;
  }

  tick(blackboard: Blackboard, dt: number): BTStatus {
    return this.root.tick(blackboard, dt);
  }

  /** Get the name of the currently active leaf node (for debug display) */
  getActiveNodeName(): string {
    // This is a simplified version — a full implementation would
    // track the last-ticked leaf node
    return this.root.name;
  }
}
