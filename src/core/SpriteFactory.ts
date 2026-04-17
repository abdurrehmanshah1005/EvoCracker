// ========================
// SpriteFactory — Creates PixiJS display objects for all game entities
//
// HOW ASSET REPLACEMENT WORKS:
// 1. SpriteFactory first tries to load a real sprite from AssetLoader
// 2. If not available, it draws a distinctive colored placeholder shape
// 3. The returned Container has the same interface either way
// 4. When you add real sprites: drop PNGs in /public/assets/, run dev server
//    — factory automatically uses them, zero code changes needed
//
// MOVEMENT NOTE:
// All physics/collision runs on the TILE GRID (see Grid.ts).
// Sprite position is purely cosmetic — the sprite follows the grid position.
// ========================

import { Container, Graphics, AnimatedSprite, Texture } from 'pixi.js';
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

// ── Player Sprite ─────────────────────────────────────────────────────

export function createPlayerSprite(textures?: Record<string, Texture[]>): GameSprite {
  const container = new Container();

  if (textures?.walk) {
    // Real sprite
    const anim = new AnimatedSprite(textures.walk);
    anim.animationSpeed = 0.15;
    anim.anchor.set(0.5);
    anim.play();
    container.addChild(anim);

    return {
      container,
      setAnimation: (state) => {
        if (textures[state]) {
          anim.textures = textures[state];
          anim.play();
        }
      },
      setFlipX: (flip) => { anim.scale.x = flip ? -1 : 1; },
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
  textures?: Record<string, Texture[]>
): GameSprite {
  const container = new Container();

  if (textures?.walk) {
    const anim = new AnimatedSprite(textures.idle ?? textures.walk);
    anim.animationSpeed = 0.1;
    anim.anchor.set(0.5);
    anim.play();
    container.addChild(anim);

    return {
      container,
      setAnimation: (state) => {
        const frames = textures[state] ?? textures.idle;
        if (frames) { anim.textures = frames; anim.play(); }
      },
      setFlipX: (flip) => { anim.scale.x = flip ? -1 : 1; },
      setAlpha: (a) => { anim.alpha = a; },
      destroy: () => container.destroy({ children: true }),
      isPlaceholder: false,
    };
  }

  // Placeholder
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

  let _flipped = false;
  let _anim: ReturnType<typeof setInterval> | null = null;
  let _scale = 1;

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
      if (state === 'walk') _scale = 1;
      if (state === 'attack') { g.tint = 0xffffff; }
      if (state === 'death') { container.alpha = 0.5; }
    },
    setFlipX: (flip) => {
      _flipped = flip;
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
