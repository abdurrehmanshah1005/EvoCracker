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
  setTint: (tint: number) => void;
  destroy: () => void;
  isPlaceholder: boolean;
}

// ── Character definitions ─────────────────────────────────────────────

/**
 * Defines a rectangular pixel region within a sprite sheet
 * for extracting animation frames.
 */
export interface AnimRegion {
  y: number;       // top Y coordinate of the frame row
  h: number;       // height of each frame in this row
  cols: number;    // number of frames (columns) in this row
  frameW: number;  // width of each frame
}

/**
 * Optional per-animation custom pixel regions.
 * Used for sprite sheets that have non-uniform row heights
 * (e.g. text labels between rows, multi-row attacks).
 */
export interface CustomAnimRegions {
  idle: AnimRegion | AnimRegion[];    // single row or multiple rows
  walk: AnimRegion | AnimRegion[];    // single row or multiple rows
  attack: AnimRegion | AnimRegion[];  // single row or multiple rows (e.g. 16-frame attack across 2 rows)
}

/**
 * Defines separate sprite sheets for each animation state.
 * Used for characters whose assets come as individual strip images per animation.
 */
export interface SeparateSheets {
  idle: { path: string; cols: number; frameW: number; frameH: number };
  walk: { path: string; cols: number; frameW: number; frameH: number };
  attack: { path: string; cols: number; frameW: number; frameH: number };
  death?: { path: string; cols: number; frameW: number; frameH: number };
  special?: { path: string; cols: number; frameW: number; frameH: number };
}

export interface CharacterDef {
  name: string;
  key: string;        // asset key for loading
  sheet: string;      // path to sprite sheet PNG (main/preview sheet)
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
  customRegions?: CustomAnimRegions;  // optional pixel-level frame regions
  separateSheets?: SeparateSheets;    // optional separate sprite sheets per animation
  flipDefault?: boolean;  // true if sprite faces left by default (invert flip logic)
  customScale?: number;   // optional multiplier for base scaling
}

// The sprite sheets are roughly 1024x1024 with 8 columns × 3-5 rows.
// We divide evenly: width/8 per frame, height/rows per frame.
// We use a fixed frame count per animation: 8 frames across each row.
export const CHARACTER_DEFS: CharacterDef[] = [
  {
    name: 'Ghost',
    key: 'ghost',
    sheet: '/assets/characters/Ghost-Files/Spritesheets/ghost-Idle.png', // preview sheet
    frameW: 64, frameH: 80,
    cols: 7, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#44ddee',
    description: 'Spectral haunter',
    glowColor: 0x44ddee,
    flipDefault: true,  // ghost sprites face left by default
    separateSheets: {
      idle:    { path: '/assets/characters/Ghost-Files/Spritesheets/ghost-Idle.png',    cols: 7, frameW: 64, frameH: 80 },
      walk:    { path: '/assets/characters/Ghost-Files/Spritesheets/ghost-Chase.png',   cols: 4, frameW: 64, frameH: 80 },
      attack:  { path: '/assets/characters/Ghost-Files/Spritesheets/ghost-Shriek.png',  cols: 4, frameW: 64, frameH: 80 },
      death:   { path: '/assets/characters/Ghost-Files/Spritesheets/ghost-Vanish.png',  cols: 7, frameW: 64, frameH: 80 },
      special: { path: '/assets/characters/Ghost-Files/Spritesheets/ghost-Appear.png',  cols: 6, frameW: 64, frameH: 80 },
    },
  },
  {
    name: 'Bridge Heroine',
    key: 'heroine',
    sheet: '/assets/characters/Bridge Heroine/Heroine base/Spritesheets/idle.png',
    frameW: 128, frameH: 64,
    cols: 4, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#ff6688',
    description: 'Swift blade dancer',
    glowColor: 0xff6688,
    customScale: 1.5,
    separateSheets: {
      idle:    { path: '/assets/characters/Bridge Heroine/Heroine base/Spritesheets/idle.png',   cols: 4, frameW: 128, frameH: 64 },
      walk:    { path: '/assets/characters/Bridge Heroine/Heroine base/Spritesheets/run.png',    cols: 7, frameW: 128, frameH: 64 },
      attack:  { path: '/assets/characters/Bridge Heroine/Heroine base/Spritesheets/attack.png', cols: 5, frameW: 128, frameH: 64 },
      special: { path: '/assets/characters/Bridge Heroine/Heroine base/Spritesheets/jump.png',   cols: 4, frameW: 128, frameH: 64 },
    },
  },
  {
    name: 'Ogre',
    key: 'ogre',
    sheet: '/assets/characters/Ogre/Spritesheets/ogre-idle.png',
    frameW: 144, frameH: 80,
    cols: 4, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#88aa44',
    description: 'Hulking brute',
    glowColor: 0x88aa44,
    flipDefault: true,
    separateSheets: {
      idle:    { path: '/assets/characters/Ogre/Spritesheets/ogre-idle.png',   cols: 4, frameW: 144, frameH: 80 },
      walk:    { path: '/assets/characters/Ogre/Spritesheets/ogre-walk.png',   cols: 6, frameW: 144, frameH: 80 },
      attack:  { path: '/assets/characters/Ogre/Spritesheets/ogre-attack.png', cols: 7, frameW: 144, frameH: 80 },
      special: { path: '/assets/characters/Ogre/Spritesheets/ogre-idle-unarmed.png', cols: 4, frameW: 144, frameH: 80 },
    },
  },
  {
    name: 'Terrible Knight',
    key: 'knight',
    sheet: '/assets/characters/Terrible Knight/Spritesheets/player-Idle.png',
    frameW: 128, frameH: 96,
    cols: 4, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#dd4466',
    description: 'Fallen dark knight',
    glowColor: 0xdd4466,
    customScale: 1.5,
    separateSheets: {
      idle:    { path: '/assets/characters/Terrible Knight/Spritesheets/player-Idle.png',         cols: 4, frameW: 128, frameH: 96 },
      walk:    { path: '/assets/characters/Terrible Knight/Spritesheets/player-Run.png',          cols: 12, frameW: 128, frameH: 96 },
      attack:  { path: '/assets/characters/Terrible Knight/Spritesheets/player-Sword Slash.png',  cols: 6, frameW: 128, frameH: 96 },
      death:   { path: '/assets/characters/Terrible Knight/Spritesheets/player-Hurt.png',         cols: 3, frameW: 128, frameH: 96 },
      special: { path: '/assets/characters/Terrible Knight/Spritesheets/player-AirSwordSlash.png', cols: 6, frameW: 128, frameH: 96 },
    },
  },
  {
    name: 'WereWolf',
    key: 'werewolf',
    sheet: '/assets/characters/WereWolf/Spritesheets/werewolf-idle.png',
    frameW: 96, frameH: 76,
    cols: 5, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#8866aa',
    description: 'Savage beast',
    glowColor: 0x8866aa,
    separateSheets: {
      idle:    { path: '/assets/characters/WereWolf/Spritesheets/werewolf-idle.png', cols: 5, frameW: 96, frameH: 76 },
      walk:    { path: '/assets/characters/WereWolf/Spritesheets/werewolf-run.png',  cols: 6, frameW: 96, frameH: 76 },
      attack:  { path: '/assets/characters/WereWolf/Spritesheets/werewolf-run.png',  cols: 6, frameW: 96, frameH: 76 }, // no attack sheet, reuse run
      special: { path: '/assets/characters/WereWolf/Spritesheets/werewolf-jump.png', cols: 2, frameW: 96, frameH: 76 },
    },
  },
  {
    name: 'Demon',
    key: 'demon',
    sheet: '/assets/characters/demon-Files/Spritesheets/demon-idle.png',
    frameW: 160, frameH: 144,
    cols: 6, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#cc3366',
    description: 'Winged infernal lord',
    glowColor: 0xcc3366,
    flipDefault: true,  // demon sprites face left by default
    separateSheets: {
      idle:    { path: '/assets/characters/demon-Files/Spritesheets/demon-idle.png',             cols: 6, frameW: 160, frameH: 144 },
      walk:    { path: '/assets/characters/demon-Files/Spritesheets/demon-idle.png',             cols: 6, frameW: 160, frameH: 144 }, // no walk sheet, reuse idle
      attack:  { path: '/assets/characters/demon-Files/Spritesheets/demon-attack-no-breath.png', cols: 8, frameW: 192, frameH: 176 },
      special: { path: '/assets/characters/demon-Files/Spritesheets/breath-fire.png',            cols: 5, frameW: 160, frameH: 96 },
    },
  },
  {
    name: 'Mutant Toad',
    key: 'toad',
    sheet: '/assets/characters/mutant-toad/Spritesheets/mutant-toad-idle.png',
    frameW: 80, frameH: 64,
    cols: 4, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#44cc88',
    description: 'Toxic leaping beast',
    glowColor: 0x44cc88,
    separateSheets: {
      idle:    { path: '/assets/characters/mutant-toad/Spritesheets/mutant-toad-idle.png',   cols: 4, frameW: 80, frameH: 64 },
      walk:    { path: '/assets/characters/mutant-toad/Spritesheets/mutant-toad-jump.png',   cols: 4, frameW: 80, frameH: 64 }, // toad hops to move
      attack:  { path: '/assets/characters/mutant-toad/Spritesheets/mutant-toad-attack.png', cols: 3, frameW: 80, frameH: 64 },
      special: { path: '/assets/characters/mutant-toad/Spritesheets/mutant-toad-jump.png',   cols: 4, frameW: 80, frameH: 64 },
    },
  },
  {
    name: 'Dragon',
    key: 'dragon',
    sheet: '/assets/characters/Grotto-escape-2-boss-dragon/spritesheets/idle.png',
    frameW: 144, frameH: 64,
    cols: 6, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#cc4422',
    description: 'Ancient fire wyrm',
    glowColor: 0xcc4422,
    flipDefault: true,
    separateSheets: {
      idle:    { path: '/assets/characters/Grotto-escape-2-boss-dragon/spritesheets/idle.png',   cols: 6, frameW: 144, frameH: 64 },
      walk:    { path: '/assets/characters/Grotto-escape-2-boss-dragon/spritesheets/idle.png',   cols: 6, frameW: 144, frameH: 64 }, // no walk sheet
      attack:  { path: '/assets/characters/Grotto-escape-2-boss-dragon/spritesheets/breath.png', cols: 7, frameW: 144, frameH: 64 },
      special: { path: '/assets/characters/Grotto-escape-2-boss-dragon/spritesheets/tail.png',   cols: 8, frameW: 144, frameH: 64 },
    },
  },
  {
    name: 'Lizzard',
    key: 'lizzard',
    sheet: '/assets/characters/Grotto-escape-2-lizzard/spritesheets/idle.png',
    frameW: 64, frameH: 32,
    cols: 4, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#33aa55',
    description: 'Slithering beast',
    glowColor: 0x33aa55,
    separateSheets: {
      idle:    { path: '/assets/characters/Grotto-escape-2-lizzard/spritesheets/idle.png',   cols: 4, frameW: 64, frameH: 32 },
      walk:    { path: '/assets/characters/Grotto-escape-2-lizzard/spritesheets/walk.png',   cols: 6, frameW: 64, frameH: 32 },
      attack:  { path: '/assets/characters/Grotto-escape-2-lizzard/spritesheets/tongue.png', cols: 5, frameW: 64, frameH: 32 },
      death:   { path: '/assets/characters/Grotto-escape-2-lizzard/spritesheets/hurt.png',   cols: 3, frameW: 64, frameH: 32 },
      special: { path: '/assets/characters/Grotto-escape-2-lizzard/spritesheets/jump.png',   cols: 5, frameW: 64, frameH: 32 },
    },
  },
  {
    name: 'Space Marine',
    key: 'spacemarine',
    sheet: '/assets/characters/space-marine-lite/spritesheets/idle.png',
    frameW: 75, frameH: 48,
    cols: 4, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#00ccff',
    description: 'Future warrior',
    glowColor: 0x00ccff,
    separateSheets: {
      idle:    { path: '/assets/characters/space-marine-lite/spritesheets/idle.png',   cols: 4, frameW: 75, frameH: 48 },
      walk:    { path: '/assets/characters/space-marine-lite/spritesheets/run.png',    cols: 10, frameW: 75, frameH: 48 },
      attack:  { path: '/assets/characters/space-marine-lite/spritesheets/shoot.png',  cols: 2, frameW: 75, frameH: 48 },
      death:   { path: '/assets/characters/space-marine-lite/spritesheets/hurt.png',   cols: 3, frameW: 75, frameH: 48 },
      special: { path: '/assets/characters/space-marine-lite/spritesheets/jump.png',   cols: 5, frameW: 75, frameH: 48 },
    },
  },
  {
    name: 'Sunny Froggy',
    key: 'froggy',
    sheet: '/assets/characters/sunny-froggy/Spritesheets/sunny-froggy-taunting.png',
    frameW: 53, frameH: 42,
    cols: 4, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#ffff33',
    description: 'Bouncing hopper',
    glowColor: 0xffff33,
    flipDefault: true,
    separateSheets: {
      idle:    { path: '/assets/characters/sunny-froggy/Spritesheets/sunny-froggy-taunting.png', cols: 4, frameW: 53, frameH: 42 },
      walk:    { path: '/assets/characters/sunny-froggy/Spritesheets/sunny-froggy-walk.png',     cols: 10, frameW: 42, frameH: 38 },
      attack:  { path: '/assets/characters/sunny-froggy/Spritesheets/sunny-froggy-jump.png',     cols: 5, frameW: 42, frameH: 48 },
      special: { path: '/assets/characters/sunny-froggy/Spritesheets/sunny-froggy-jump.png',     cols: 5, frameW: 42, frameH: 48 },
    },
  },
  {
    name: 'Sunny Mushroom',
    key: 'mushroom',
    sheet: '/assets/characters/sunny-mushroom/spritesheets/sunny-mushroom-walk.png',
    frameW: 41, frameH: 30,
    cols: 10, rows: 1,
    idleRow: 0, walkRow: 0, attackRow: 0,
    color: '#ff9933',
    description: 'Toxic fungus',
    glowColor: 0xff9933,
    separateSheets: {
      idle:    { path: '/assets/characters/sunny-mushroom/spritesheets/sunny-mushroom-walk.png',   cols: 10, frameW: 41, frameH: 30 },
      walk:    { path: '/assets/characters/sunny-mushroom/spritesheets/sunny-mushroom-walk.png',   cols: 10, frameW: 41, frameH: 30 },
      attack:  { path: '/assets/characters/sunny-mushroom/spritesheets/sunny-mushroom-breath.png', cols: 10, frameW: 63, frameH: 37 },
      special: { path: '/assets/characters/sunny-mushroom/spritesheets/gas-alone.png',             cols: 6, frameW: 63, frameH: 37 },
    },
  },
];

// ── Asset cache ───────────────────────────────────────────────────────

interface CharAnimFrames {
  idle: Texture[];
  walk: Texture[];
  attack: Texture[];
  death?: Texture[];
  special?: Texture[];
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

  // If the top-left corner pixel is already transparent, the image has proper alpha.
  // Skip bg removal to avoid stripping dark-colored sprites.
  const topLeftAlpha = pixels[3];
  if (topLeftAlpha < 10) {
    console.log('[removeBackground] Sheet already has alpha transparency, skipping bg removal');
    return canvas;
  }

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
      // ── Separate sheets loading (one spritesheet per animation) ──
      if (charDef.separateSheets) {
        const sheets = charDef.separateSheets;

        /**
         * Load a single horizontal strip spritesheet and extract frames.
         * Each strip has `cols` frames of `frameW x frameH` side by side.
         */
        const loadStrip = async (info: { path: string; cols: number; frameW: number; frameH: number }): Promise<Texture[]> => {
          const result = await loadSpriteSheetWithBgRemoval(info.path);
          if (!result) return [];
          const { texture: stripTex } = result;
          const frames: Texture[] = [];
          for (let col = 0; col < info.cols; col++) {
            frames.push(new Texture({
              source: stripTex.source,
              frame: new Rectangle(col * info.frameW, 0, info.frameW, info.frameH),
            }));
          }
          return frames;
        };

        const idleFrames = await loadStrip(sheets.idle);
        const walkFrames = await loadStrip(sheets.walk);
        const attackFrames = await loadStrip(sheets.attack);
        const deathFrames = sheets.death ? await loadStrip(sheets.death) : undefined;
        const specialFrames = sheets.special ? await loadStrip(sheets.special) : undefined;

        charDef.frameW = sheets.idle.frameW;
        charDef.frameH = sheets.idle.frameH;

        characterAnimCache.set(charDef.key, {
          idle: idleFrames,
          walk: walkFrames,
          attack: attackFrames,
          death: deathFrames,
          special: specialFrames,
        });

        console.log(
          `[SpriteFactory] Loaded ${charDef.name} (separate sheets): ` +
          `idle=${idleFrames.length}f, walk=${walkFrames.length}f, attack=${attackFrames.length}f` +
          (deathFrames ? `, death=${deathFrames.length}f` : '') +
          (specialFrames ? `, special=${specialFrames.length}f` : '')
        );
        continue;
      }

      const result = await loadSpriteSheetWithBgRemoval(charDef.sheet);
      if (!result) {
        console.warn(`[SpriteFactory] Failed to load ${charDef.name} (${charDef.sheet})`);
        continue;
      }

      const { texture: sheet } = result;
      const imgW = sheet.width;
      const imgH = sheet.height;

      // ── Custom region extraction (non-uniform sprite sheets) ──
      if (charDef.customRegions) {
        const regions = charDef.customRegions;

        /**
         * Extract frames from one or more AnimRegion definitions.
         * Each region defines a horizontal strip of frames at a specific Y offset.
         * Multiple regions are concatenated (e.g. a 16-frame attack across 2 rows).
         */
        const extractFromRegions = (regionDef: AnimRegion | AnimRegion[]): Texture[] => {
          const regionArray = Array.isArray(regionDef) ? regionDef : [regionDef];
          const frames: Texture[] = [];
          for (const region of regionArray) {
            for (let col = 0; col < region.cols; col++) {
              frames.push(new Texture({
                source: sheet.source,
                frame: new Rectangle(col * region.frameW, region.y, region.frameW, region.h),
              }));
            }
          }
          return frames;
        };

        const idleFrames = extractFromRegions(regions.idle);
        const walkFrames = extractFromRegions(regions.walk);
        const attackFrames = extractFromRegions(regions.attack);

        // Set frameW/frameH from the idle row for scaling purposes
        const firstRegion = Array.isArray(regions.idle) ? regions.idle[0] : regions.idle;
        charDef.frameW = firstRegion.frameW;
        charDef.frameH = firstRegion.h;

        characterAnimCache.set(charDef.key, {
          idle: idleFrames,
          walk: walkFrames,
          attack: attackFrames,
        });

        console.log(
          `[SpriteFactory] Loaded ${charDef.name} (custom regions): ${imgW}x${imgH}, ` +
          `idle=${idleFrames.length}f, walk=${walkFrames.length}f, attack=${attackFrames.length}f`
        );
        continue;
      }

      // ── Standard uniform grid extraction ──
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
    // Scale sprite to roughly 3.5 tiles for visibility
    const targetSize = TILE_SIZE * 3.5 * (charDef.customScale || 1);
    const scale = targetSize / Math.max(charDef.frameW, charDef.frameH);
    anim.scale.set(charDef.flipDefault ? -scale : scale, scale);
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
          state === 'death' ? (anims.death ?? anims.idle) :
          state === 'special' ? (anims.special ?? anims.idle) :
          anims.idle;

        if (targetFrames && targetFrames.length > 0) {
          anim.textures = targetFrames;
        }

        if (state === 'walk') {
          anim.animationSpeed = 0.15;
          anim.play();
        } else if (state === 'attack') {
          anim.animationSpeed = 0.25;
          anim.gotoAndPlay(0);
        } else if (state === 'death') {
          anim.animationSpeed = 0.12;
          anim.loop = false;
          anim.gotoAndPlay(0);
        } else if (state === 'special') {
          anim.animationSpeed = 0.15;
          anim.loop = false;
          anim.gotoAndPlay(0);
        } else {
          anim.animationSpeed = 0.06;
          anim.loop = true;
          anim.play();
        }
      },
      setFlipX: (flip) => {
        // If flipDefault, invert the logic (sprite faces left by default)
        const flipped = charDef.flipDefault ? !flip : flip;
        anim.scale.x = flipped ? -baseScale : baseScale;
      },
      setAlpha: (a) => { anim.alpha = a; glow.alpha = a * 0.3; },
      setTint: (tint) => { anim.tint = tint; },
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
    setTint: (tint) => { g.tint = tint; },
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
    const targetSize = TILE_SIZE * 3.5 * (charDef.customScale || 1);
    const scale = targetSize / Math.max(charDef.frameW, charDef.frameH);
    anim.scale.set(charDef.flipDefault ? -scale : scale, scale);
    anim.play();
    // Slight red tint to distinguish enemies
    anim.tint = 0xff8888;
    container.addChild(anim);

    // Health bar — positioned above the larger sprite
    const hpBg = new Graphics();
    hpBg.rect(-16, -TILE_SIZE * 1.2, 32, 5);
    hpBg.fill({ color: 0x111111 });
    const hpFill = new Graphics();
    hpFill.rect(-16, -TILE_SIZE * 1.2, 32, 5);
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
          state === 'death' ? (anims.death ?? anims.idle) :
          state === 'special' ? (anims.special ?? anims.idle) :
          anims.idle;
        if (targetFrames && targetFrames.length > 0) {
          anim.textures = targetFrames;
        }
        if (state === 'walk') {
          anim.animationSpeed = 0.12;
          anim.play();
        } else if (state === 'attack') {
          anim.animationSpeed = 0.2;
          anim.gotoAndPlay(0);
        } else if (state === 'death') {
          anim.animationSpeed = 0.12;
          anim.loop = false;
          anim.gotoAndPlay(0);
          // Fade out when death animation completes
          anim.onComplete = () => { container.alpha = 0.3; };
        } else if (state === 'special') {
          anim.animationSpeed = 0.15;
          anim.loop = false;
          anim.gotoAndPlay(0);
        } else {
          anim.animationSpeed = 0.08;
          anim.loop = true;
          anim.play();
        }
      },
      setFlipX: (flip) => {
        const flipped = charDef.flipDefault ? !flip : flip;
        anim.scale.x = flipped ? -baseScale : baseScale;
      },
      setAlpha: (a) => { container.alpha = a; },
      setTint: (tint) => { anim.tint = tint; },
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
      setTint: (tint) => { anim.tint = tint; },
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
    setTint: (tint) => { g.tint = tint; },
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
  hpFill.rect(-16, -TILE_SIZE * 1.2, 32 * Math.max(0, percent), 5);
  hpFill.fill({ color });
}
