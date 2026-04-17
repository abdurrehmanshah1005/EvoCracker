// ========================
// Zustand Game Store — Central game state management
// ========================

import { create } from 'zustand';
import { BiomeType, AlgorithmType, AlertState } from '@utils/constants';
import type { DungeonData } from '@game/world/DungeonGenerator';
import type { Genome, PlayerProfile, GenerationStats } from '@ai/evolution/GeneticAlgorithm';

// --- Game State ---
export type GameScreen = 'mainMenu' | 'playing' | 'algorithmLab' | 'gachaDefense' | 'gacha' | 'settings' | 'leaderboard' | 'evolution' | 'gameOver';

export interface EnemyAnalyticsData {
  entityId: number;
  enemyType: string;
  algorithm: AlgorithmType;
  alertState: AlertState;
  genomeId: string;
  nodesExpanded: number;
  pathLength: number;
  pathComputeTimeMs: number;
  position: { x: number; y: number };
}

interface GameState {
  // Screen
  currentScreen: GameScreen;
  setScreen: (screen: GameScreen) => void;

  // Game state
  isPaused: boolean;
  togglePause: () => void;
  isPlaying: boolean;
  setPlaying: (playing: boolean) => void;

  // Floor / level
  currentFloor: number;
  currentBiome: BiomeType;
  dungeonData: DungeonData | null;
  setDungeonData: (data: DungeonData) => void;
  nextFloor: () => void;

  // Player state
  playerHealth: number;
  playerMaxHealth: number;
  playerScore: number;
  playerItems: (string | null)[];
  setPlayerHealth: (health: number) => void;
  addScore: (points: number) => void;

  // Evolution
  generation: number;
  population: Genome[];
  playerProfile: PlayerProfile | null;
  generationHistory: GenerationStats[];
  setPopulation: (pop: Genome[]) => void;
  setPlayerProfile: (profile: PlayerProfile) => void;
  addGenerationStats: (stats: GenerationStats) => void;

  // Analytics
  analyticsEnabled: boolean;
  toggleAnalytics: () => void;
  analyticsTab: number;
  setAnalyticsTab: (tab: number) => void;
  enemyAnalytics: EnemyAnalyticsData[];
  setEnemyAnalytics: (data: EnemyAnalyticsData[]) => void;

  // FPS
  fps: number;
  setFps: (fps: number) => void;

  // Debug
  debugMode: boolean;
  toggleDebug: () => void;
  showFOV: boolean;
  showGrid: boolean;
  showPaths: boolean;
  toggleShowFOV: () => void;
  toggleShowGrid: () => void;
  toggleShowPaths: () => void;

  // Reset
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  // Screen
  currentScreen: 'mainMenu',
  setScreen: (screen) => set({ currentScreen: screen }),

  // Game state
  isPaused: false,
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  isPlaying: false,
  setPlaying: (playing) => set({ isPlaying: playing }),

  // Floor
  currentFloor: 1,
  currentBiome: BiomeType.DUNGEON,
  dungeonData: null,
  setDungeonData: (data) => set({ dungeonData: data, currentBiome: data.biome }),
  nextFloor: () => set((s) => ({ currentFloor: s.currentFloor + 1 })),

  // Player
  playerHealth: 100,
  playerMaxHealth: 100,
  playerScore: 0,
  playerItems: [null, null, null, null],
  setPlayerHealth: (health) => set({ playerHealth: health }),
  addScore: (points) => set((s) => ({ playerScore: s.playerScore + points })),

  // Evolution
  generation: 0,
  population: [],
  playerProfile: null,
  generationHistory: [],
  setPopulation: (pop) => set({ population: pop }),
  setPlayerProfile: (profile) => set({ playerProfile: profile }),
  addGenerationStats: (stats) => set((s) => ({
    generationHistory: [...s.generationHistory, stats],
    generation: stats.generation,
  })),

  // Analytics
  analyticsEnabled: false,
  toggleAnalytics: () => set((s) => ({ analyticsEnabled: !s.analyticsEnabled })),
  analyticsTab: 0,
  setAnalyticsTab: (tab) => set({ analyticsTab: tab }),
  enemyAnalytics: [],
  setEnemyAnalytics: (data) => set({ enemyAnalytics: data }),

  // FPS
  fps: 60,
  setFps: (fps) => set({ fps }),

  // Debug
  debugMode: false,
  toggleDebug: () => set((s) => ({ debugMode: !s.debugMode })),
  showFOV: false,
  showGrid: false,
  showPaths: true,
  toggleShowFOV: () => set((s) => ({ showFOV: !s.showFOV })),
  toggleShowGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleShowPaths: () => set((s) => ({ showPaths: !s.showPaths })),

  // Reset
  resetGame: () => set({
    currentFloor: 1,
    currentBiome: BiomeType.DUNGEON,
    playerHealth: 100,
    playerScore: 0,
    generation: 0,
    population: [],
    generationHistory: [],
    dungeonData: null,
    isPlaying: false,
    isPaused: false,
    currentScreen: 'mainMenu',
  }),
}));
