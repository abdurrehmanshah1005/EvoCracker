// ========================
// AssetLoader — Centralized texture + audio loading
// Provides placeholder fallbacks when real assets are missing.
// ========================

import { Assets, Texture, Spritesheet, Rectangle } from 'pixi.js';
import { ASSET_MANIFEST, SPRITE_CONFIGS, type AnimationConfig } from './AssetManifest';

type BiomeKey = keyof typeof ASSET_MANIFEST.tilesets;
type EnemyKey = keyof typeof ASSET_MANIFEST.enemies;

interface LoadedSprite {
  textures: Record<string, Texture[]>; // animation name -> frames
  config: AnimationConfig;
}

class AssetLoaderClass {
  private loadedTextures = new Map<string, Texture>();
  private loadedSprites = new Map<string, LoadedSprite>();
  private loadedSpritesheets = new Map<string, Spritesheet>();
  private assetsAvailable = new Set<string>();

  /** Try to load a single texture, return null if file not found */
  private async tryLoadTexture(path: string): Promise<Texture | null> {
    try {
      const texture = await Assets.load(path);
      return texture as Texture;
    } catch {
      return null; // File not provided yet — use placeholder
    }
  }

  /** Probe which assets are actually available */
  async probeAssets(): Promise<void> {
    // Check a handful of known keys — non-blocking
    const checks = [
      ...Object.values(ASSET_MANIFEST.tilesets),
      ...Object.values(ASSET_MANIFEST.enemies),
    ];

    await Promise.allSettled(
      checks.map(async (path) => {
        try {
          await fetch('/' + path, { method: 'HEAD' });
          this.assetsAvailable.add(path);
        } catch {
          // Not available
        }
      })
    );
  }

  /** Load tileset texture for a biome */
  async getTilesetTexture(biome: BiomeKey): Promise<Texture | null> {
    const path = ASSET_MANIFEST.tilesets[biome];
    if (this.loadedTextures.has(path)) return this.loadedTextures.get(path)!;
    const texture = await this.tryLoadTexture(path);
    if (texture) this.loadedTextures.set(path, texture);
    return texture;
  }

  /** Load background texture for a biome */
  async getBackground(biome: string): Promise<Texture | null> {
    const manifest = ASSET_MANIFEST.backgrounds as Record<string, string>;
    const path = manifest[biome] ?? manifest.dungeon;
    if (this.loadedTextures.has(path)) return this.loadedTextures.get(path)!;
    const texture = await this.tryLoadTexture(path);
    if (texture) this.loadedTextures.set(path, texture);
    return texture;
  }

  /** Load enemy sprite sheet and parse animation frames */
  async getEnemySprite(enemyKey: EnemyKey): Promise<LoadedSprite | null> {
    if (this.loadedSprites.has(enemyKey)) return this.loadedSprites.get(enemyKey)!;

    const path = ASSET_MANIFEST.enemies[enemyKey];
    const texture = await this.tryLoadTexture(path);
    if (!texture) return null; // Will use placeholder Graphics

    const config = SPRITE_CONFIGS[enemyKey] ?? SPRITE_CONFIGS.default;
    const textures: Record<string, Texture[]> = {};

    for (const [animName, animDef] of Object.entries(config.animations)) {
      textures[animName] = [];
      for (let f = 0; f < animDef.frames; f++) {
        const frame = new Texture({
          source: texture.source,
          frame: new Rectangle(
            f * config.frameWidth,
            animDef.row * config.frameHeight,
            config.frameWidth,
            config.frameHeight
          ),
        });
        textures[animName].push(frame);
      }
    }

    const sprite = { textures, config };
    this.loadedSprites.set(enemyKey, sprite);
    return sprite;
  }

  /** Load player sprite */
  async getPlayerSprite(): Promise<LoadedSprite | null> {
    return this.getEnemySprite('slime' as EnemyKey); // Same pipeline, diff path
  }

  /** Check if an asset path is available (without loading it) */
  isAvailable(path: string): boolean {
    return this.assetsAvailable.has(path);
  }

  /** Preload all known available assets */
  async preloadAll(): Promise<void> {
    await this.probeAssets();
    // Only load what's actually there — non-blocking for missing assets
  }
}

export const AssetLoader = new AssetLoaderClass();
