// ========================
// ECS — Entity Component System
// Lightweight custom implementation
// ========================

import { generateId } from '@utils/math';

// --- Entity ---
export type EntityId = number;

// --- Component ---
export interface Component {
  type: string;
}

// All component types the ECS knows about
export interface PositionComponent extends Component {
  type: 'position';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  tileX: number;
  tileY: number;
}

export interface VelocityComponent extends Component {
  type: 'velocity';
  vx: number;
  vy: number;
  speed: number;      // Base speed in pixels/sec
  friction: number;    // 0-1, applied per frame
}

export interface SpriteComponent extends Component {
  type: 'sprite';
  textureKey: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  visible: boolean;
  alpha: number;
  tint: number;
  zIndex: number;
  // Animation
  animationState: string;
  animationFrame: number;
  animationSpeed: number;      // Frames per second
  animationTimer: number;
  flipX: boolean;
}

export interface HealthComponent extends Component {
  type: 'health';
  current: number;
  max: number;
  armor: number;
  invincibleTimer: number;     // Seconds of invincibility remaining
}

export interface VisionComponent extends Component {
  type: 'vision';
  range: number;               // Tiles
  coneAngle: number;           // Radians (0 = full circle)
  direction: number;           // Radians
  detectedEntities: EntityId[];
}

export interface ColliderComponent extends Component {
  type: 'collider';
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  isTrigger: boolean;          // Trigger = no physics, just events
  layer: 'player' | 'enemy' | 'item' | 'projectile' | 'interactable';
}

export interface AIComponent extends Component {
  type: 'ai';
  enemyType: string;
  alertState: string;
  alertTimer: number;
  currentPath: { x: number; y: number }[];
  pathIndex: number;
  targetEntity: EntityId | null;
  lastKnownPlayerPos: { x: number; y: number } | null;
  homePosition: { x: number; y: number };
  genomeId: string;
  currentAlgorithm: string;
  nodesExpanded: number;
  pathComputeTime: number;
  behaviorTreeId: string;
}

export interface PlayerComponent extends Component {
  type: 'player';
  isHiding: boolean;
  hideTimer: number;
  stealthLevel: number;       // 0-1, lower = harder to detect
  itemSlots: (string | null)[];
  activeItemIndex: number;
  score: number;
  floorsCleared: number;
}

export interface InteractableComponent extends Component {
  type: 'interactable';
  interactType: 'treasure' | 'door' | 'trap' | 'shrine' | 'stairs';
  isActive: boolean;
  data: Record<string, unknown>;
}

export interface ParticleEmitterComponent extends Component {
  type: 'particleEmitter';
  particles: Array<{
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number; color: number; alpha: number;
  }>;
  emitting: boolean;
  rate: number;
  maxParticles: number;
}

// Union of all component types
export type ComponentTypes =
  | PositionComponent
  | VelocityComponent
  | SpriteComponent
  | HealthComponent
  | VisionComponent
  | ColliderComponent
  | AIComponent
  | PlayerComponent
  | InteractableComponent
  | ParticleEmitterComponent;

// Map of component type strings to their actual types
export interface ComponentTypeMap {
  position: PositionComponent;
  velocity: VelocityComponent;
  sprite: SpriteComponent;
  health: HealthComponent;
  vision: VisionComponent;
  collider: ColliderComponent;
  ai: AIComponent;
  player: PlayerComponent;
  interactable: InteractableComponent;
  particleEmitter: ParticleEmitterComponent;
}

// --- System ---
export abstract class System {
  abstract readonly name: string;
  abstract readonly requiredComponents: string[];
  enabled = true;

  abstract update(dt: number, world: World): void;
}

// --- World ---
export class World {
  private entities = new Map<EntityId, Map<string, ComponentTypes>>();
  private systems: System[] = [];
  private entitiesToDestroy: EntityId[] = [];

  /** Create a new entity and return its ID */
  createEntity(): EntityId {
    const id = generateId();
    this.entities.set(id, new Map());
    return id;
  }

  /** Mark entity for destruction (processed at end of frame) */
  destroyEntity(id: EntityId): void {
    this.entitiesToDestroy.push(id);
  }

  /** Actually remove destroyed entities */
  processDestructions(): void {
    for (const id of this.entitiesToDestroy) {
      this.entities.delete(id);
    }
    this.entitiesToDestroy = [];
  }

  /** Check if entity exists */
  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  /** Add component to entity */
  addComponent<K extends keyof ComponentTypeMap>(
    entityId: EntityId,
    component: ComponentTypeMap[K]
  ): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.set(component.type, component);
    }
  }

  /** Remove component from entity */
  removeComponent(entityId: EntityId, componentType: string): void {
    this.entities.get(entityId)?.delete(componentType);
  }

  /** Get a specific component from an entity */
  getComponent<K extends keyof ComponentTypeMap>(
    entityId: EntityId,
    componentType: K
  ): ComponentTypeMap[K] | undefined {
    return this.entities.get(entityId)?.get(componentType) as ComponentTypeMap[K] | undefined;
  }

  /** Check if entity has a component */
  hasComponent(entityId: EntityId, componentType: string): boolean {
    return this.entities.get(entityId)?.has(componentType) ?? false;
  }

  /** Get all entities that have ALL specified components */
  query(...componentTypes: (keyof ComponentTypeMap)[]): EntityId[] {
    const result: EntityId[] = [];
    for (const [id, components] of this.entities) {
      if (componentTypes.every((type) => components.has(type))) {
        result.push(id);
      }
    }
    return result;
  }

  /** Get all entity IDs */
  getAllEntities(): EntityId[] {
    return Array.from(this.entities.keys());
  }

  /** Register a system */
  addSystem(system: System): void {
    this.systems.push(system);
  }

  /** Remove a system by name */
  removeSystem(name: string): void {
    this.systems = this.systems.filter((s) => s.name !== name);
  }

  /** Get a system by name */
  getSystem<T extends System>(name: string): T | undefined {
    return this.systems.find((s) => s.name === name) as T | undefined;
  }

  /** Run all systems */
  update(dt: number): void {
    for (const system of this.systems) {
      if (system.enabled) {
        system.update(dt, this);
      }
    }
    this.processDestructions();
  }

  /** Remove all entities and systems */
  clear(): void {
    this.entities.clear();
    this.systems = [];
    this.entitiesToDestroy = [];
  }

  /** Get entity count */
  get entityCount(): number {
    return this.entities.size;
  }
}
