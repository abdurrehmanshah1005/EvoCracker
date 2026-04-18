// ========================
// SpriteFactory — Creates PixiJS display objects for all game entities
//
// Loads real pixel-art sprites from the 2D Pixel Dungeon Asset Pack.
// Falls back to placeholder Graphics if textures fail to load.
//
// MOVEMENT NOTE:
// All physics/collision runs on the TILE GRID (see Grid.ts).
// Sprite position is purely cosmetic — the sprite follows the grid position.
// ========================

import { Container, Graphics, AnimatedSprite, Sprite, Texture, Assets, Rectangle } from 'pixi.js';
import { TILE_SIZE, EnemyType } from '@utils/constants';
import { PLACEHOLDER_COLORS } from './AssetManifest';

export type AnimationState = 'idle' | 'walk' | 'attack' | 'death' | 'special';

export interface GameSprite {
  container: Container;
  setAnimation: (state: AnimationState) => void;
  setFlipX: (flip: boolean) => void;
  setAlpha: (alpha: number) => void;
  destroy: () => void;
  isPlaceholder: boolean;
}

// ── Asset cache ───────────────────────────────────────────────────────

const characterTextureCache = new Map<string, Texture[]>();
const monsterTextureCache = new Map<string, Texture[]>();
let assetsInitialized = false;

// Character spritesheet layout:
// characters.png = 112×64 → 7 columns × 4 rows of 16×16
// Each column is a character variant. Rows are animation frames.
// characters_2.png = 112×32 → 7 columns × 2 rows of 16×16

const CHAR_FRAME_SIZE = 16;
const CHAR_COLS = 7;

// Character definitions from the spritesheet
// We'll use columns as different character classes
export interface CharacterDef {
  name: string;
  sheet: 'characters' | 'characters_2';
  col: number;   // Column in the spritesheet
  rows: number;  // Number of frame rows available
  color: string; // Preview color for UI
  description: string;
}

export const CHARACTER_DEFS: CharacterDef[] = [
  { name: 'Knight',    sheet: 'characters', col: 0, rows: 4, color: '#4488ff', description: 'Armored warrior' },
  { name: 'Wizard',    sheet: 'characters', col: 1, rows: 4, color: '#aa44ff', description: 'Arcane spellcaster' },
  { name: 'Rogue',     sheet: 'characters', col: 2, rows: 4, color: '#44dd88', description: 'Swift and stealthy' },
  { name: 'Cleric',    sheet: 'characters', col: 3, rows: 4, color: '#ffdd44', description: 'Holy healer' },
  { name: 'Ranger',    sheet: 'characters', col: 4, rows: 4, color: '#44ddff', description: 'Master of ranged combat' },
  { name: 'Barbarian', sheet: 'characters', col: 5, rows: 4, color: '#ff6644', description: 'Brutal berserker' },
];

// Enemy type → monster/priest sprite mapping
const ENEMY_SPRITE_MAP: Record<EnemyType, { folder: string; prefix: string }> = {
  [EnemyType.SLIME]:         { folder: 'monsters/skull',      prefix: 'skull_v1' },
  [EnemyType.BAT]:           { folder: 'priests/priest3',     prefix: 'priest3_v1' },
  [EnemyType.GOBLIN]:        { folder: 'monsters/skeleton1',  prefix: 'skeleton_v1' },
  [EnemyType.ARCHER]:        { folder: 'monsters/skeleton2',  prefix: 'skeleton_v2' },
  [EnemyType.INQUISITOR]:    { folder: 'priests/priest1',     prefix: 'priest1_v1' },
  [EnemyType.LEASHED_GUARD]: { folder: 'priests/priest2',     prefix: 'priest2_v1' },
  [EnemyType.ROYAL_KNIGHT]:  { folder: 'monsters/vampire',    prefix: 'vampire_v1' },
  [EnemyType.ASSASSIN]:      { folder: 'monsters/skeleton2',  prefix: 'skeleton_v2' },
};

/**
 * Initialize all sprite assets. Call once during game startup.
 */
export async function initSpriteAssets(): Promise<void> {
  if (assetsInitialized) return;

  // Load character spritesheets
  try {
    const charSheet = await Assets.load('assets/dungeon-pack/characters.png') as Texture;
    charSheet.source.scaleMode = 'nearest';

    // Parse each character column into frames
    for (const charDef of CHARACTER_DEFS) {
      const frames: Texture[] = [];
      for (let row = 0; row < charDef.rows; row++) {
        const frame = new Texture({
          source: charSheet.source,
          frame: new Rectangle(
            charDef.col * CHAR_FRAME_SIZE,
            row * CHAR_FRAME_SIZE,
            CHAR_FRAME_SIZE,
            CHAR_FRAME_SIZE
          ),
        });
        frames.push(frame);
      }
      characterTextureCache.set(`char_${charDef.col}`, frames);
    }
  } catch {
    console.warn('[SpriteFactory] Character spritesheet not loaded — using placeholders');
  }

  // Load monster/priest frames
  for (const [enemyType, spriteInfo] of Object.entries(ENEMY_SPRITE_MAP)) {
    const cacheKey = `${spriteInfo.folder}`;
    if (monsterTextureCache.has(cacheKey)) continue;

    const frames: Texture[] = [];
    for (let i = 1; i <= 4; i++) {
      try {
        const tex = await Assets.load(`assets/dungeon-pack/${spriteInfo.folder}/${spriteInfo.prefix}_${i}.png`) as Texture;
        tex.source.scaleMode = 'nearest';
        frames.push(tex);
      } catch {
        // Frame not found
      }
    }
    if (frames.length > 0) {
      monsterTextureCache.set(cacheKey, frames);
    }
  }

  assetsInitialized = true;
}

/**
 * Get character preview textures for the selection screen.
 * Returns the first frame of each character.
 */
export function getCharacterPreviewTextures(): (Texture | null)[] {
  return CHARACTER_DEFS.map((def) => {
    const frames = characterTextureCache.get(`char_${def.col}`);
    return frames?.[0] ?? null;
  });
}

// ── Player Sprite ─────────────────────────────────────────────────────

export function createPlayerSprite(characterIndex?: number): GameSprite {
  const container = new Container();
  const charIdx = characterIndex ?? 0;
  const frames = characterTextureCache.get(`char_${charIdx}`);

  if (frames && frames.length > 0) {
    // Real sprite from asset pack
    const anim = new AnimatedSprite(frames);
    anim.animationSpeed = 0.1;
    anim.anchor.set(0.5);
    anim.scale.set(2); // 16px → 32px
    anim.play();
    container.addChild(anim);

    let currentAnim: AnimationState = 'idle';

    return {
      container,
      setAnimation: (state) => {
        if (state === currentAnim) return;
        currentAnim = state;
        if (state === 'walk') {
          anim.animationSpeed = 0.15;
          anim.play();
        } else if (state === 'attack') {
          anim.animationSpeed = 0.25;
          anim.play();
        } else {
          // idle — slow animation
          anim.animationSpeed = 0.06;
          anim.play();
        }
      },
      setFlipX: (flip) => { anim.scale.x = flip ? -2 : 2; },
      setAlpha: (a) => { anim.alpha = a; },
      destroy: () => container.destroy({ children: true }),
      isPlaceholder: false,
    };
  }

  // Placeholder: Cyan circle with inner diamond
  const g = new Graphics();
  // Body
  g.circle(0, 0, TILE_SIZE * 0.35);
  g.fill({ color: PLACEHOLDER_COLORS.player });
  // Highlight
  g.circle(-3, -4, TILE_SIZE * 0.1);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  // Glow ring
  g.circle(0, 0, TILE_SIZE * 0.45);
  g.stroke({ color: PLACEHOLDER_COLORS.player, width: 1, alpha: 0.3 });
  container.addChild(g);

  return {
    container,
    setAnimation: () => {},
    setFlipX: (flip) => { g.scale.x = flip ? -1 : 1; },
    setAlpha: (a) => { container.alpha = a; },
    destroy: () => container.destroy({ children: true }),
    isPlaceholder: true,
  };
}

// ── Enemy Sprite ─────────────────────────────────────────────────────

const ENEMY_SHAPES: Record<string, (g: Graphics, color: number) => void> = {
  [EnemyType.SLIME]: (g, c) => {
    // Jelly blob shape
    g.ellipse(0, 4, TILE_SIZE * 0.35, TILE_SIZE * 0.25);
    g.fill({ color: c });
    g.circle(0, 0, TILE_SIZE * 0.28);
    g.fill({ color: c });
    // Eyes
    g.circle(-5, -2, 3);
    g.circle(5, -2, 3);
    g.fill({ color: 0x000000 });
  },
  [EnemyType.BAT]: (g, c) => {
    // Wings + body
    g.ellipse(-12, -4, 10, 6);
    g.ellipse(12, -4, 10, 6);
    g.fill({ color: c });
    g.circle(0, 0, TILE_SIZE * 0.2);
    g.fill({ color: c });
    g.poly([-3, 4, 3, 4, 0, 8]);
    g.fill({ color: c });
  },
  [EnemyType.INQUISITOR]: (g, c) => {
    // Robed figure
    g.rect(-8, -6, 16, 20);
    g.fill({ color: c });
    // Hood
    g.circle(0, -10, 8);
    g.fill({ color: c, alpha: 0.9 });
    // Eyes (glowing)
    g.circle(-3, -10, 2);
    g.circle(3, -10, 2);
    g.fill({ color: 0xff4444 });
  },
  [EnemyType.LEASHED_GUARD]: (g, c) => {
    // Shield + body
    g.rect(-9, -10, 18, 22);
    g.fill({ color: c });
    // Shield
    g.rect(-7, -6, 8, 12);
    g.fill({ color: 0x888888 });
    // Helm
    g.rect(-7, -12, 14, 8);
    g.fill({ color: c, alpha: 0.8 });
  },
  [EnemyType.ROYAL_KNIGHT]: (g, c) => {
    // Full plate
    g.rect(-10, -12, 20, 26);
    g.fill({ color: c });
    // Cape
    g.poly([-10, -8, -16, 12, -8, 12]);
    g.fill({ color: 0xff4444 });
    // Visor
    g.rect(-7, -10, 14, 6);
    g.fill({ color: 0x000000, alpha: 0.6 });
  },
  [EnemyType.ASSASSIN]: (g, c) => {
    // Slim hooded figure
    g.poly([0, -14, 8, -6, 6, 12, -6, 12, -8, -6]);
    g.fill({ color: c });
    // Mask
    g.rect(-5, -10, 10, 6);
    g.fill({ color: 0x333333 });
    // Eyes
    g.rect(-4, -8, 3, 2);
    g.rect(1, -8, 3, 2);
    g.fill({ color: 0xff2222 });
  },
  [EnemyType.GOBLIN]: (g, c) => {
    // Small stocky body
    g.circle(0, 2, TILE_SIZE * 0.28);
    g.fill({ color: c });
    // Head (bigger than body)
    g.circle(0, -6, TILE_SIZE * 0.22);
    g.fill({ color: c });
    // Ears
    g.poly([-10, -8, -6, -2, -4, -10]);
    g.fill({ color: c });
    g.poly([10, -8, 6, -2, 4, -10]);
    g.fill({ color: c });
    // Eyes (angry)
    g.circle(-4, -7, 3);
    g.circle(4, -7, 3);
    g.fill({ color: 0xffff00 });
  },
  [EnemyType.ARCHER]: (g, c) => {
    // Standing figure with bow
    g.rect(-6, -10, 12, 22);
    g.fill({ color: c });
    // Bow
    g.arc(10, 0, 8, -Math.PI * 0.5, Math.PI * 0.5);
    g.stroke({ color: 0x8B4513, width: 2 });
    // Arrow
    g.rect(4, -1, 10, 2);
    g.fill({ color: 0x8B4513 });
    g.poly([14, -3, 18, 0, 14, 3]);
    g.fill({ color: 0xcccccc });
  },
};

export function createEnemySprite(
  enemyType: EnemyType,
  _textures?: Record<string, Texture[]>
): GameSprite {
  const container = new Container();

  // Try to load real sprite from asset pack
  const spriteInfo = ENEMY_SPRITE_MAP[enemyType];
  const cacheKey = spriteInfo?.folder;
  const frames = cacheKey ? monsterTextureCache.get(cacheKey) : undefined;

  if (frames && frames.length > 0) {
    // Real animated sprite
    const anim = new AnimatedSprite(frames);
    anim.animationSpeed = 0.08;
    anim.anchor.set(0.5);
    anim.scale.set(2); // 16px → 32px
    anim.play();
    container.addChild(anim);

    // Health bar above sprite
    const hpBg = new Graphics();
    hpBg.rect(-12, -20, 24, 4);
    hpBg.fill({ color: 0x111111 });
    const hpFill = new Graphics();
    hpFill.rect(-12, -20, 24, 4);
    hpFill.fill({ color: 0xff4444 });
    hpFill.label = 'hpFill';
    container.addChild(hpBg);
    container.addChild(hpFill);

    return {
      container,
      setAnimation: (state) => {
        if (state === 'walk') {
          anim.animationSpeed = 0.12;
          anim.play();
        } else if (state === 'attack') {
          anim.animationSpeed = 0.2;
          anim.play();
        } else if (state === 'death') {
          anim.stop();
          container.alpha = 0.5;
        } else {
          anim.animationSpeed = 0.08;
          anim.play();
        }
      },
      setFlipX: (flip) => { anim.scale.x = flip ? -2 : 2; },
      setAlpha: (a) => { container.alpha = a; },
      destroy: () => container.destroy({ children: true }),
      isPlaceholder: false,
    };
  }

  // Placeholder fallback (same as before)
  const color = PLACEHOLDER_COLORS[(enemyType as unknown) as keyof typeof PLACEHOLDER_COLORS] ?? 0xffffff;
  const g = new Graphics();
  const drawFn = ENEMY_SHAPES[enemyType];
  if (drawFn) {
    drawFn(g, color);
  } else {
    g.rect(-10, -10, 20, 20);
    g.fill({ color });
  }

  // Health bar above sprite
  const hpBg = new Graphics();
  hpBg.rect(-12, -20, 24, 4);
  hpBg.fill({ color: 0x111111 });
  const hpFill = new Graphics();
  hpFill.rect(-12, -20, 24, 4);
  hpFill.fill({ color: 0xff4444 });
  hpFill.label = 'hpFill';

  container.addChild(g);
  container.addChild(hpBg);
  container.addChild(hpFill);

  let _anim: ReturnType<typeof setInterval> | null = null;

  // Idle bob animation for placeholder
  let _t = Math.random() * Math.PI * 2;
  const tick = () => {
    _t += 0.05;
    g.y = Math.sin(_t) * 2;
  };
  _anim = setInterval(tick, 1000 / 30);

  return {
    container,
    setAnimation: (state) => {
      if (state === 'walk') { /* no-op for placeholder */ }
      if (state === 'attack') { g.tint = 0xffffff; }
      if (state === 'death') { container.alpha = 0.5; }
    },
    setFlipX: (flip) => {
      g.scale.x = flip ? -1 : 1;
    },
    setAlpha: (a) => { container.alpha = a; },
    destroy: () => {
      if (_anim) clearInterval(_anim);
      container.destroy({ children: true });
    },
    isPlaceholder: true,
  };
}

// ── Update enemy health bar ───────────────────────────────────────────

export function updateHealthBar(container: Container, percent: number): void {
  const hpFill = container.getChildByLabel('hpFill') as Graphics | null;
  if (!hpFill) return;
  hpFill.clear();
  const color = percent > 0.6 ? 0x44dd44 : percent > 0.3 ? 0xffaa00 : 0xff2222;
  hpFill.rect(-12, -20, 24 * Math.max(0, percent), 4);
  hpFill.fill({ color });
}
