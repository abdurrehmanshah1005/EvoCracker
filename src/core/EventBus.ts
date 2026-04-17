// ========================
// EventBus — Pub/Sub system for decoupled communication
// ========================

type EventCallback = (...args: unknown[]) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /** Subscribe to an event */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /** Subscribe to an event, auto-remove after first fire */
  once(event: string, callback: EventCallback): () => void {
    const wrapper: EventCallback = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  /** Unsubscribe from an event */
  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  /** Emit an event to all listeners */
  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    });
  }

  /** Remove all listeners for an event (or all events) */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Game event type constants
export const GameEvents = {
  // Player events
  PLAYER_MOVE: 'player:move',
  PLAYER_DAMAGE: 'player:damage',
  PLAYER_DEATH: 'player:death',
  PLAYER_HIDE: 'player:hide',
  PLAYER_USE_ITEM: 'player:useItem',

  // Enemy events
  ENEMY_SPAWN: 'enemy:spawn',
  ENEMY_DEATH: 'enemy:death',
  ENEMY_ALERT_CHANGE: 'enemy:alertChange',
  ENEMY_ALGORITHM_SWITCH: 'enemy:algorithmSwitch',
  ENEMY_PATH_FOUND: 'enemy:pathFound',

  // Evolution events
  EVOLUTION_START: 'evolution:start',
  EVOLUTION_COMPLETE: 'evolution:complete',
  GENERATION_UPDATE: 'evolution:generationUpdate',
  GENOME_MUTATED: 'evolution:genomeMutated',

  // Game flow events
  FLOOR_START: 'game:floorStart',
  FLOOR_COMPLETE: 'game:floorComplete',
  GAME_OVER: 'game:gameOver',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',

  // Analytics events
  ANALYTICS_TOGGLE: 'analytics:toggle',
  ANALYTICS_UPDATE: 'analytics:update',

  // UI events
  SCREEN_CHANGE: 'ui:screenChange',
  NOTIFICATION: 'ui:notification',
} as const;
