import type { AliasKind } from '@store/gameStore';

export interface AliasDef {
  kind: AliasKind;
  name: string;
  cost: number;
  description: string;
  color: number;
}

export const ALIAS_ORDER: AliasKind[] = ['guide', 'swift', 'striker', 'aegis'];

export const ALIAS_DEFS: Record<AliasKind, AliasDef> = {
  guide: {
    kind: 'guide',
    name: 'Guiding Wisp',
    cost: 8,
    description: 'Points toward the exit while you explore.',
    color: 0x66ccff,
  },
  swift: {
    kind: 'swift',
    name: 'Swift Wisp',
    cost: 16,
    description: 'Increases movement speed by 12%.',
    color: 0x88ff66,
  },
  striker: {
    kind: 'striker',
    name: 'Striker Wisp',
    cost: 26,
    description: 'Strikes with you when you attack.',
    color: 0xff8844,
  },
  aegis: {
    kind: 'aegis',
    name: 'Aegis Wisp',
    cost: 38,
    description: 'Reduces incoming damage by 15%.',
    color: 0xffcc44,
  },
};

export const ALIAS_SHOP_MIN_FLOOR = 2;
export const ALIAS_SWIFT_MULTIPLIER = 1.12;
export const ALIAS_AEGIS_REDUCTION = 0.15;
export const ALIAS_STRIKER_DAMAGE = 12;
export const ALIAS_STRIKER_RANGE = 3.25;

export function getAliasMinCost(): number {
  return Math.min(...ALIAS_ORDER.map((kind) => ALIAS_DEFS[kind].cost));
}
