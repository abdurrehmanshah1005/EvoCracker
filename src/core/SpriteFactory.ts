// ========================
// SpriteFactory — Creates PixiJS display objects for all game entities
//
// Loads character sprites from individual sprite sheets per character.
// Each character has a spritesheet with rows: idle, walk, attack.
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

// ── Character definitions ─────────────────────────────────────────────

export interface CharacterDef {
  name: string;
  key: string;        // asset key for loading
  sheet: string;      // path to sprite sheet PNG
  frameW: number;     // pixel width of each frame
  frameH: number;     // pixel height of each frame
  cols: number;       // number of columns in the sheet
  rows: number;       // number of rows in the sheet
  idleRow: number;    // row index for idle animation
  walkRow: number;    // row index for walk animation
  attackRow: number;  // row index for attack animation
  color: string;      // accent color for UI
  description: string;
  glowColor: number;  // hex glow color for in-game visibility
}

// The sprite sheets are roughly 1024x1024 with 8 columns × 3-5 rows.
// We divide evenly: width/8 per frame, height/rows per frame.
// We use a fixed frame count per animation: 8 frames across each row.
export const CHARACTER_DEFS: CharacterDef[] = [
  {
    name: 'Mega Knight',
    key: 'mega_knight',
    sheet: '/assets/characters/mega_knight.png',
    frameW: 0, frameH: 0, // computed at load time
    cols: 8, rows: 5,
    idleRow: 0, walkRow: 1, attackRow: 2,
    color: '#4488ff',
    description: 'Heavy armored warrior',
    glowColor: 0x4488ff,
  },
  {
    name: 'Akutagawa',
    key: 'akutagawa',
    sheet: '/assets/characters/akutagawa.png',
    frameW: 0, frameH: 0,
    cols: 8, rows: 3,
    idleRow: 0, walkRow: 1, attackRow: 2,
    color: '#aa44ff',
    description: 'Dark shadow master',
    glowColor: 0xaa44ff,
  },
  {
    name: 'Homelander',
    key: 'homelander',
    sheet: '/assets/characters/homelander.png',
    frameW: 0, frameH: 0,
    cols: 8, rows: 3,
    idleRow: 0, walkRow: 1, attackRow: 2,
    color: '#ff4444',
    description: 'Laser-eyed superman',
    glowColor: 0xff4444,
  },
  {
    name: 'Tung Tung Sahur',
    key: 'tungtung',
    sheet: '/assets/characters/tungtung.png',
    frameW: 0, frameH: 0,
    cols: 8, rows: 5,
    idleRow: 0, walkRow: 2, attackRow: 3,
    color: '#dd8844',
    description: 'Rhythmic stick fighter',
    glowColor: 0xdd8844,
  },
  {
    name: 'Kenpachi',
    key: 'kenpachi',
    sheet: '/assets/characters/kenpachi.png',
    frameW: 0, frameH: 0,
    cols: 6, rows: 3,
    idleRow: 0, walkRow: 1, attackRow: 2,
    color: '#44dd88',
    description: 'Wild sword demon',
    glowColor: 0x44dd88,
  },
];

// ── Asset cache ───────────────────────────────────────────────────────

interface CharAnimFrames {
  idle: Texture[];
  walk: Texture[];
  attack: Texture[];
}

const characterAnimCache = new Map<string, CharAnimFrames>();
const monsterTextureCache = new Map<string, Texture[]>();
let assetsInitialized = false;

// Kept for backward compat — old column-based defs removed
const CHAR_FRAME_SIZE = 16;

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
 * Remove background color from a sprite sheet image.
 * Samples the top-left corner pixel as the background color,
 * then makes all pixels within tolerance transparent.
 */
function removeBackground(img: HTMLImageElement, tolerance = 50): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = data.data;

  // Sample background color from top-left corner pixel
  const bgR = pixels[0];
  const bgG = pixels[1];
  const bgB = pixels[2];

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Check if pixel is similar to background color
    if (
      Math.abs(r - bgR) <= tolerance &&
      Math.abs(g - bgG) <= tolerance &&
      Math.abs(b - bgB) <= tolerance
    ) {
      pixels[i + 3] = 0; // Make transparent
    }
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Load an image and return it with background removed as a Texture.
 */
async function loadSpriteSheetWithBgRemoval(path: string): Promise<{ texture: Texture; img: HTMLImageElement } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cleanCanvas = removeBackground(img);
      const tex = Texture.from(cleanCanvas);
      tex.source.scaleMode = 'nearest';
      resolve({ texture: tex, img });
    };
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

/**
 * Initialize all sprite assets. Call once during game startup.
 */
export async function initSpriteAssets(): Promise<void> {
  if (assetsInitialized) return;

  // Load each character sprite sheet with background removal
  for (const charDef of CHARACTER_DEFS) {
    try {
      const result = await loadSpriteSheetWithBgRemoval(charDef.sheet);
      if (!result) {
        console.warn(`[SpriteFactory] Failed to load ${charDef.name} (${charDef.sheet})`);
        continue;
      }

      const { texture: sheet } = result;

      const imgW = sheet.width;
      const imgH = sheet.height;
      const fW = Math.floor(imgW / charDef.cols);
      const fH = Math.floor(imgH / charDef.rows);
      charDef.frameW = fW;
      charDef.frameH = fH;

      const extractRow = (row: number): Texture[] => {
        const frames: Texture[] = [];
        for (let col = 0; col < charDef.cols; col++) {
          frames.push(new Texture({
            source: sheet.source,
            frame: new Rectangle(col * fW, row * fH, fW, fH),
          }));
        }
        return frames;
      };

      characterAnimCache.set(charDef.key, {
        idle: extractRow(charDef.idleRow),
        walk: extractRow(charDef.walkRow),
        attack: extractRow(charDef.attackRow),
      });

      console.log(`[SpriteFactory] Loaded ${charDef.name}: ${imgW}x${imgH}, frame ${fW}x${fH} (bg removed)`);
    } catch (err) {
      console.warn(`[SpriteFactory] Failed to load ${charDef.name} (${charDef.sheet}):`, err);
    }
  }

  // Load monster/priest frames (unchanged)
  for (const [_enemyType, spriteInfo] of Object.entries(ENEMY_SPRITE_MAP)) {
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
 * Returns the first idle frame of each character.
 */
export function getCharacterPreviewTextures(): (Texture | null)[] {
  return CHARACTER_DEFS.map((def) => {
    const anims = characterAnimCache.get(def.key);
    return anims?.idle?.[0] ?? null;
  });
}

// ── Player Sprite ─────────────────────────────────────────────────────

export function createPlayerSprite(characterIndex?: number): GameSprite {
  const container = new Container();
  const charIdx = characterIndex ?? 0;
  const charDef = CHARACTER_DEFS[charIdx] ?? CHARACTER_DEFS[0];
  const anims = characterAnimCache.get(charDef.key);

  if (anims && anims.idle.length > 0) {
    // Glow ring behind the character for visibility
    const glow = new Graphics();
    glow.circle(0, 0, TILE_SIZE * 0.6);
    glow.fill({ color: charDef.glowColor, alpha: 0.2 });
    glow.circle(0, 0, TILE_SIZE * 0.4);
    glow.fill({ color: charDef.glowColor, alpha: 0.15 });
    glow.label = 'glow';
    container.addChild(glow);

    // Animated sprite from the idle row
    const anim = new AnimatedSprite(anims.idle);
    anim.animationSpeed = 0.1;
    anim.anchor.set(0.5);
    // Scale sprite to roughly 1.5 tiles for visibility
    const targetSize = TILE_SIZE * 1.5;
    const scale = targetSize / Math.max(charDef.frameW, charDef.frameH);
    anim.scale.set(scale);
    anim.play();
    container.addChild(anim);

    let currentAnim: AnimationState = 'idle';
    const baseScale = scale;

    return {
      container,
      setAnimation: (state) => {
        if (state === currentAnim) return;
        currentAnim = state;
        const targetFrames =
          state === 'walk' ? anims.walk :
          state === 'attack' ? anims.attack :
          anims.idle;

        if (targetFrames && targetFrames.length > 0) {
          anim.textures = targetFrames;
        }

        if (state === 'walk') {
          anim.animationSpeed = 0.15;
          anim.play();
        } else if (state === 'attack') {
          anim.animationSpeed = 0.25;
          anim.play();
        } else {
          anim.animationSpeed = 0.06;
          anim.play();
        }
      },
      setFlipX: (flip) => { anim.scale.x = flip ? -baseScale : baseScale; },
      setAlpha: (a) => { anim.alpha = a; glow.alpha = a * 0.3; },
      destroy: () => container.destroy({ children: true }),
      isPlaceholder: false,
    };
  }

  // Placeholder: Bright cyan circle with glow
  const g = new Graphics();
  // Glow ring
  g.circle(0, 0, TILE_SIZE * 0.7);
  g.fill({ color: charDef.glowColor, alpha: 0.2 });
  // Body
  g.circle(0, 0, TILE_SIZE * 0.45);
  g.fill({ color: charDef.glowColor });
  // Highlight
  g.circle(-3, -4, TILE_SIZE * 0.12);
  g.fill({ color: 0xffffff, alpha: 0.6 });
  // Outer ring
  g.circle(0, 0, TILE_SIZE * 0.55);
  g.stroke({ color: charDef.glowColor, width: 2, alpha: 0.5 });
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

// ── Character-based Enemy Sprite ─────────────────────────────────────
// Creates an enemy from one of the remaining character sprite sheets

export function createCharacterEnemySprite(characterIndex: number): GameSprite {
  const container = new Container();
  const charDef = CHARACTER_DEFS[characterIndex] ?? CHARACTER_DEFS[0];
  const anims = characterAnimCache.get(charDef.key);

  if (anims && anims.idle.length > 0) {
    const anim = new AnimatedSprite(anims.idle);
    anim.animationSpeed = 0.08;
    anim.anchor.set(0.5);
    const targetSize = TILE_SIZE * 1.3;
    const scale = targetSize / Math.max(charDef.frameW, charDef.frameH);
    anim.scale.set(scale);
    anim.play();
    // Slight red tint to distinguish enemies
    anim.tint = 0xff8888;
    container.addChild(anim);

    // Health bar
    const hpBg = new Graphics();
    hpBg.rect(-14, -TILE_SIZE * 0.8, 28, 5);
    hpBg.fill({ color: 0x111111 });
    const hpFill = new Graphics();
    hpFill.rect(-14, -TILE_SIZE * 0.8, 28, 5);
    hpFill.fill({ color: 0xff4444 });
    hpFill.label = 'hpFill';
    container.addChild(hpBg);
    container.addChild(hpFill);

    let currentAnim: AnimationState = 'idle';
    const baseScale = scale;

    return {
      container,
      setAnimation: (state) => {
        if (state === currentAnim) return;
        currentAnim = state;
        const targetFrames =
          state === 'walk' ? anims.walk :
          state === 'attack' ? anims.attack :
          anims.idle;
        if (targetFrames && targetFrames.length > 0) {
          anim.textures = targetFrames;
        }
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
      setFlipX: (flip) => { anim.scale.x = flip ? -baseScale : baseScale; },
      setAlpha: (a) => { container.alpha = a; },
      destroy: () => container.destroy({ children: true }),
      isPlaceholder: false,
    };
  }

  // Fallback placeholder
  return createEnemySprite(EnemyType.GOBLIN);
}

// ── Enemy Sprite (original system, kept as fallback) ─────────────────

const ENEMY_SHAPES: Record<string, (g: Graphics, color: number) => void> = {
  [EnemyType.SLIME]: (g, c) => {
    g.ellipse(0, 4, TILE_SIZE * 0.35, TILE_SIZE * 0.25);
    g.fill({ color: c });
    g.circle(0, 0, TILE_SIZE * 0.28);
    g.fill({ color: c });
    g.circle(-5, -2, 3);
    g.circle(5, -2, 3);
    g.fill({ color: 0x000000 });
  },
  [EnemyType.BAT]: (g, c) => {
    g.ellipse(-12, -4, 10, 6);
    g.ellipse(12, -4, 10, 6);
    g.fill({ color: c });
    g.circle(0, 0, TILE_SIZE * 0.2);
    g.fill({ color: c });
    g.poly([-3, 4, 3, 4, 0, 8]);
    g.fill({ color: c });
  },
  [EnemyType.INQUISITOR]: (g, c) => {
    g.rect(-8, -6, 16, 20);
    g.fill({ color: c });
    g.circle(0, -10, 8);
    g.fill({ color: c, alpha: 0.9 });
    g.circle(-3, -10, 2);
    g.circle(3, -10, 2);
    g.fill({ color: 0xff4444 });
  },
  [EnemyType.LEASHED_GUARD]: (g, c) => {
    g.rect(-9, -10, 18, 22);
    g.fill({ color: c });
    g.rect(-7, -6, 8, 12);
    g.fill({ color: 0x888888 });
    g.rect(-7, -12, 14, 8);
    g.fill({ color: c, alpha: 0.8 });
  },
  [EnemyType.ROYAL_KNIGHT]: (g, c) => {
    g.rect(-10, -12, 20, 26);
    g.fill({ color: c });
    g.poly([-10, -8, -16, 12, -8, 12]);
    g.fill({ color: 0xff4444 });
    g.rect(-7, -10, 14, 6);
    g.fill({ color: 0x000000, alpha: 0.6 });
  },
  [EnemyType.ASSASSIN]: (g, c) => {
    g.poly([0, -14, 8, -6, 6, 12, -6, 12, -8, -6]);
    g.fill({ color: c });
    g.rect(-5, -10, 10, 6);
    g.fill({ color: 0x333333 });
    g.rect(-4, -8, 3, 2);
    g.rect(1, -8, 3, 2);
    g.fill({ color: 0xff2222 });
  },
  [EnemyType.GOBLIN]: (g, c) => {
    g.circle(0, 2, TILE_SIZE * 0.28);
    g.fill({ color: c });
    g.circle(0, -6, TILE_SIZE * 0.22);
    g.fill({ color: c });
    g.poly([-10, -8, -6, -2, -4, -10]);
    g.fill({ color: c });
    g.poly([10, -8, 6, -2, 4, -10]);
    g.fill({ color: c });
    g.circle(-4, -7, 3);
    g.circle(4, -7, 3);
    g.fill({ color: 0xffff00 });
  },
  [EnemyType.ARCHER]: (g, c) => {
    g.rect(-6, -10, 12, 22);
    g.fill({ color: c });
    g.arc(10, 0, 8, -Math.PI * 0.5, Math.PI * 0.5);
    g.stroke({ color: 0x8B4513, width: 2 });
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
    const anim = new AnimatedSprite(frames);
    anim.animationSpeed = 0.08;
    anim.anchor.set(0.5);
    anim.scale.set(2);
    anim.play();
    container.addChild(anim);

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

  // Placeholder fallback
  const color = PLACEHOLDER_COLORS[(enemyType as unknown) as keyof typeof PLACEHOLDER_COLORS] ?? 0xffffff;
  const g = new Graphics();
  const drawFn = ENEMY_SHAPES[enemyType];
  if (drawFn) {
    drawFn(g, color);
  } else {
    g.rect(-10, -10, 20, 20);
    g.fill({ color });
  }

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
  hpFill.rect(-14, -TILE_SIZE * 0.8, 28 * Math.max(0, percent), 5);
  hpFill.fill({ color });
}
