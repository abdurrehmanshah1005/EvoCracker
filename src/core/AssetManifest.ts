// ========================
// Asset Manifest — Single source of truth for ALL game assets
// When you provide real sprites, just update the paths here.
// Everything else stays the same.
// ========================

/**
 * ASSET REPLACEMENT GUIDE
 * ========================
 * 1. Place your asset files in /public/assets/ (any subfolder)
 * 2. Update the path for that key below
 * 3. For sprite sheets, also update the SPRITE_SHEET_CONFIG for that key
 * 4. Run the dev server — assets auto-load
 *
 * Asset format requirements:
 * - Sprites: PNG with transparency
 * - Tilemaps: PNG spritesheet (each tile = TILE_SIZE x TILE_SIZE px)
 * - Backgrounds: PNG or WEBP, any resolution
 *
 * Sprite sheet layout (default convention — override per asset):
 *   Row 0: Idle    (4 frames)
 *   Row 1: Walk    (8 frames)
 *   Row 2: Attack  (6 frames)
 *   Row 3: Death   (8 frames)
 *   Row 4: Special (4 frames)  — if applicable
 */

export const ASSET_MANIFEST = {
  // ── Tilesets (provide a spritesheet PNG) ──────────────────────────
  tilesets: {
    dungeon:  'assets/tilesets/dungeon.png',      // Stone floor, walls
    cave:     'assets/tilesets/cave.png',
    forest:   'assets/tilesets/forest.png',
    castle:   'assets/tilesets/castle.png',
    lake:     'assets/tilesets/lake.png',
    ruins:    'assets/tilesets/ruins.png',
  },

  // ── Backgrounds (full-screen image behind the tilemap) ────────────
  backgrounds: {
    dungeon:  'assets/backgrounds/dungeon_bg.png',
    cave:     'assets/backgrounds/cave_bg.png',
    forest:   'assets/backgrounds/forest_bg.png',
    castle:   'assets/backgrounds/castle_bg.png',
    lake:     'assets/backgrounds/lake_bg.png',
    ruins:    'assets/backgrounds/ruins_bg.png',
    mainMenu: 'assets/backgrounds/main_menu_bg.png',
  },

  // ── Player (sprite sheet rows: idle/walk/attack/death) ───────────
  player: {
    spritesheet: 'assets/characters/player.png',
    frameWidth: 32,
    frameHeight: 32,
  },

  // ── Enemy sprite sheets ───────────────────────────────────────────
  enemies: {
    slime:        'assets/characters/enemies/slime.png',
    bat:          'assets/characters/enemies/bat.png',
    inquisitor:   'assets/characters/enemies/inquisitor.png',
    leashedGuard: 'assets/characters/enemies/leashed_guard.png',
    royalKnight:  'assets/characters/enemies/royal_knight.png',
    assassin:     'assets/characters/enemies/assassin.png',
    goblin:       'assets/characters/enemies/goblin.png',
    archer:       'assets/characters/enemies/archer.png',
  },

  // ── Items (16x16 or 32x32 icons) ─────────────────────────────────
  items: {
    logicShroud:      'assets/items/logic_shroud.png',
    heuristicJammer:  'assets/items/heuristic_jammer.png',
    smokeBomb:        'assets/items/smoke_bomb.png',
    ghostCloak:       'assets/items/ghost_cloak.png',
    trapKit:          'assets/items/trap_kit.png',
    mutationSerum:    'assets/items/mutation_serum.png',
    algorithmCodex:   'assets/items/algorithm_codex.png',
  },

  // ── UI elements ───────────────────────────────────────────────────
  ui: {
    healthBarFill:  'assets/ui/health_fill.png',
    healthBarBg:    'assets/ui/health_bg.png',
    portrait_frame: 'assets/ui/portrait_frame.png',
    minimapBg:      'assets/ui/minimap.png',
    // Gacha
    gachaPortrait_common:    'assets/ui/gacha/portrait_common.png',
    gachaPortrait_rare:      'assets/ui/gacha/portrait_rare.png',
    gachaPortrait_legendary: 'assets/ui/gacha/portrait_legendary.png',
  },

  // ── Effects (particle textures) ───────────────────────────────────
  effects: {
    spark:    'assets/effects/spark.png',
    smoke:    'assets/effects/smoke.png',
    explosion:'assets/effects/explosion.png',
  },

  // ── Audio ─────────────────────────────────────────────────────────
  audio: {
    bgm_dungeon:  'assets/audio/bgm_dungeon.ogg',
    bgm_forest:   'assets/audio/bgm_forest.ogg',
    bgm_castle:   'assets/audio/bgm_castle.ogg',
    sfx_step:     'assets/audio/sfx_step.ogg',
    sfx_attack:   'assets/audio/sfx_attack.ogg',
    sfx_hurt:     'assets/audio/sfx_hurt.ogg',
    sfx_death:    'assets/audio/sfx_death.ogg',
    sfx_item:     'assets/audio/sfx_item.ogg',
    sfx_alert:    'assets/audio/sfx_alert.ogg',
    sfx_gacha:    'assets/audio/sfx_gacha.ogg',
  },
} as const;

// ── Sprite Sheet Animation Configs ───────────────────────────────────
// Defines frame layout for each animated sprite sheet

export interface AnimationConfig {
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, { row: number; frames: number; speed: number }>;
}

export const SPRITE_CONFIGS: Record<string, AnimationConfig> = {
  player: {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:   { row: 0, frames: 4, speed: 0.1 },
      walk:   { row: 1, frames: 8, speed: 0.15 },
      attack: { row: 2, frames: 6, speed: 0.2 },
      death:  { row: 3, frames: 8, speed: 0.12 },
    },
  },
  slime: {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:   { row: 0, frames: 4, speed: 0.08 },
      walk:   { row: 1, frames: 6, speed: 0.12 },
      attack: { row: 2, frames: 4, speed: 0.15 },
      death:  { row: 3, frames: 6, speed: 0.12 },
    },
  },
  bat: {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:   { row: 0, frames: 4, speed: 0.15 },
      walk:   { row: 1, frames: 6, speed: 0.2 },  // "walk" = flying
      attack: { row: 2, frames: 4, speed: 0.2 },
      death:  { row: 3, frames: 6, speed: 0.12 },
    },
  },
  // All other enemies use the same default layout
  default: {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:   { row: 0, frames: 4, speed: 0.1 },
      walk:   { row: 1, frames: 8, speed: 0.15 },
      attack: { row: 2, frames: 6, speed: 0.2 },
      death:  { row: 3, frames: 8, speed: 0.12 },
      special:{ row: 4, frames: 4, speed: 0.18 },
    },
  },
};

// ── Placeholder colors for when no asset is available ────────────────
// Each entry maps an enemy/item to a fallback color
export const PLACEHOLDER_COLORS = {
  player:       0x44ddff,
  slime:        0x44ff88,
  bat:          0x9944ff,
  inquisitor:   0xdddddd,
  leashedGuard: 0x8888ff,
  royalKnight:  0xffdd44,
  assassin:     0x222244,
  goblin:       0xff4444,
  archer:       0x88ff44,
  // Items
  logicShroud:     0x4488ff,
  heuristicJammer: 0xff8844,
  smokeBomb:       0x888888,
  ghostCloak:      0xccccff,
  trapKit:         0xff4444,
  mutationSerum:   0xaa44ff,
  algorithmCodex:  0xffd700,
} as const;
