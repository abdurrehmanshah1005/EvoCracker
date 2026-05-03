import { CHARACTER_DEFS } from '@core/SpriteFactory';
import { ENEMY_DEFAULT_ALGORITHM, EnemyType } from '@utils/constants';

export type AllyRole = 'decoy' | 'fighter';

export const MAX_SELECTED_ALLIES = 2;

const FIGHTER_ALLY_NAMES = new Set([
  'Knight',
  'Barbarian',
  'Warrior',
  'Assassin',
  'Necromancer',
  'Terrible Knight',
  'WereWolf',
  'Demon',
  'Dragon',
  'Space Marine',
]);

export function getAllyCost(characterIndex: number): 5 | 10 {
  const name = CHARACTER_DEFS[characterIndex]?.name ?? '';
  return FIGHTER_ALLY_NAMES.has(name) ? 10 : 5;
}

export function getAllyRole(characterIndex: number): AllyRole {
  return getAllyCost(characterIndex) === 10 ? 'fighter' : 'decoy';
}

export function getAllyDescription(characterIndex: number): string {
  return getAllyRole(characterIndex) === 'fighter'
    ? 'Uses enemy-style pathfinding and attacks hostile enemies.'
    : 'Uses enemy-style pathfinding as a decoy but does not attack.';
}

/** Map character name → EnemyType → default algorithm label for UI display */
export function getCharacterAlgoLabel(characterIndex: number): string {
  const name = CHARACTER_DEFS[characterIndex]?.name ?? '';
  // Try to find a matching EnemyType
  const matchedType = Object.values(EnemyType).find(
    (t) => t.toLowerCase() === name.toLowerCase()
  ) as EnemyType | undefined;
  if (matchedType) {
    const algo = ENEMY_DEFAULT_ALGORITHM[matchedType];
    return algo ?? '';
  }
  return '';
}
