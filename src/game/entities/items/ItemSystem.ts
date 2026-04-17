// ========================
// Item System — Active items the player can use
// Each item affects enemy AI in a specific way
// ========================

import { EventBus, GameEvents } from '@core/EventBus';
import { AlgorithmType } from '@utils/constants';
import type { EnemyBase } from '@game/entities/enemies/EnemyBase';
import type { Grid } from '@ai/pathfinding/Grid';
import { TileType } from '@utils/constants';

export interface Item {
  id: string;
  name: string;
  description: string;
  icon: string;        // Emoji fallback (replaced by sprite later)
  cooldown: number;    // Seconds
  currentCooldown: number;
  use: (player: PlayerState, enemies: EnemyBase[], grid: Grid) => void;
}

export interface PlayerState {
  tileX: number;
  tileY: number;
  isHiding: boolean;
  stealthLevel: number;
  tilePenalty: number;       // Extra weight added to player's tile (Logic Shroud)
  tilePenaltyTimer: number;
  isInvisible: boolean;
  invisibleTimer: number;
}

// Radius helpers
function enemiesInRadius(
  enemies: EnemyBase[],
  cx: number,
  cy: number,
  radius: number
): EnemyBase[] {
  return enemies.filter((e) => {
    const dx = e.tileX - cx;
    const dy = e.tileY - cy;
    return Math.sqrt(dx * dx + dy * dy) <= radius && e.isAlive;
  });
}

// ── Item Definitions ──────────────────────────────────────────────────

export function createLogicShroud(): Item {
  return {
    id: 'logicShroud',
    name: 'Logic Shroud',
    description: 'Adds +10 weight to your tile — A* and UCS enemies route around you',
    icon: '🔵',
    cooldown: 8,
    currentCooldown: 0,
    use: (player, _enemies, _grid) => {
      player.tilePenalty = 10;
      player.tilePenaltyTimer = 6;
      EventBus.getInstance().emit(GameEvents.NOTIFICATION, {
        msg: 'Logic Shroud active — enemies confused!',
        type: 'info',
      });
    },
  };
}

export function createHeuristicJammer(): Item {
  return {
    id: 'heuristicJammer',
    name: 'Heuristic Jammer',
    description: 'Nearest enemy loses A* and is forced to use DFS for 10s',
    icon: '🔴',
    cooldown: 12,
    currentCooldown: 0,
    use: (player, enemies, _grid) => {
      const nearest = enemies
        .filter((e) => e.isAlive)
        .sort((a, b) => {
          const da = Math.abs(a.tileX - player.tileX) + Math.abs(a.tileY - player.tileY);
          const db = Math.abs(b.tileX - player.tileX) + Math.abs(b.tileY - player.tileY);
          return da - db;
        })[0];

      if (nearest) {
        nearest.applyJammer(10);
        EventBus.getInstance().emit(GameEvents.NOTIFICATION, {
          msg: `${nearest.type} jammed — now using DFS!`,
          type: 'warning',
        });
      }
    },
  };
}

export function createSmokeBomb(): Item {
  return {
    id: 'smokeBomb',
    name: 'Smoke Bomb',
    description: 'Blinds all enemies in 4-tile radius for 5s',
    icon: '💨',
    cooldown: 15,
    currentCooldown: 0,
    use: (player, enemies, _grid) => {
      const inRadius = enemiesInRadius(enemies, player.tileX, player.tileY, 4);
      for (const e of inRadius) {
        e.blackboard.playerVisible = false;
        e.blackboard.visionRange = 0;
        // Restore vision after 5s
        setTimeout(() => {
          if (e.isAlive) e.blackboard.visionRange = e.visionRange;
        }, 5000);
      }
      EventBus.getInstance().emit(GameEvents.NOTIFICATION, {
        msg: `Smoke blinded ${inRadius.length} enemies!`,
        type: 'success',
      });
    },
  };
}

export function createGhostCloak(): Item {
  return {
    id: 'ghostCloak',
    name: 'Ghost Cloak',
    description: 'You become invisible for 8s — enemies cannot detect you',
    icon: '👻',
    cooldown: 20,
    currentCooldown: 0,
    use: (player, enemies, _grid) => {
      player.isInvisible = true;
      player.invisibleTimer = 8;
      // Force all enemies to lose sight
      for (const e of enemies) {
        if (e.isAlive) {
          e.blackboard.playerVisible = false;
        }
      }
      EventBus.getInstance().emit(GameEvents.NOTIFICATION, {
        msg: 'Ghost Cloak active — 8s of invisibility!',
        type: 'success',
      });
    },
  };
}

export function createMutationSerum(): Item {
  return {
    id: 'mutationSerum',
    name: 'Mutation Serum',
    description: 'Randomizes the genome of a nearby enemy — unpredictable results!',
    icon: '🧪',
    cooldown: 25,
    currentCooldown: 0,
    use: (player, enemies, _grid) => {
      const nearest = enemies
        .filter((e) => e.isAlive)
        .sort((a, b) => {
          const da = Math.abs(a.tileX - player.tileX) + Math.abs(a.tileY - player.tileY);
          const db = Math.abs(b.tileX - player.tileX) + Math.abs(b.tileY - player.tileY);
          return da - db;
        })[0];

      if (nearest) {
        import('@ai/evolution/GeneticAlgorithm').then(({ createRandomGenome }) => {
          nearest.genome = createRandomGenome(nearest.genome.generation);
          nearest.genome.mutations.push('SERUM_APPLIED');
        });
        EventBus.getInstance().emit(GameEvents.GENOME_MUTATED, { enemyId: nearest.id });
        EventBus.getInstance().emit(GameEvents.NOTIFICATION, {
          msg: `${nearest.type}'s genome mutated!`,
          type: 'warning',
        });
      }
    },
  };
}

export function createTrapKit(): Item {
  return {
    id: 'trapKit',
    name: 'Trap Kit',
    description: 'Place a bear trap on a tile — stuns any enemy that steps on it',
    icon: '⚙️',
    cooldown: 10,
    currentCooldown: 0,
    use: (player, _enemies, grid) => {
      // Place trap at player's current tile
      grid.setTile(player.tileX, player.tileY, TileType.FLOOR_TRAP);
      EventBus.getInstance().emit(GameEvents.NOTIFICATION, {
        msg: 'Trap placed!',
        type: 'info',
      });
    },
  };
}

// ── Item update tick (handles cooldowns + player state timers) ────────

export function updateItems(items: Item[], player: PlayerState, dt: number): void {
  for (const item of items) {
    if (item.currentCooldown > 0) item.currentCooldown -= dt;
  }

  // Player state timers
  if (player.tilePenaltyTimer > 0) {
    player.tilePenaltyTimer -= dt;
    if (player.tilePenaltyTimer <= 0) player.tilePenalty = 0;
  }

  if (player.invisibleTimer > 0) {
    player.invisibleTimer -= dt;
    if (player.invisibleTimer <= 0) player.isInvisible = false;
  }
}

// ── Default item loadout ──────────────────────────────────────────────

export function createDefaultItemLoadout(): Item[] {
  return [
    createLogicShroud(),
    createHeuristicJammer(),
    createSmokeBomb(),
    createGhostCloak(),
  ];
}
