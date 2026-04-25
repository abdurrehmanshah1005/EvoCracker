// ========================
// Zustand Game Store — Central game state management
// ========================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BiomeType, AlgorithmType, AlertState } from '@utils/constants';
import type { DungeonData } from '@game/world/DungeonGenerator';
import type { Genome, PlayerProfile, GenerationStats } from '@ai/evolution/GeneticAlgorithm';

// --- Game State ---
export type GameScreen =
  | 'mainMenu'
  | 'mapSelect'
  | 'characterSelect'
  | 'playing'
  | 'algorithmLab'
  | 'gachaDefense'
  | 'gacha'
  | 'settings'
  | 'leaderboard'
  | 'evolution'
  | 'gameOver';

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

export interface PlayerPathPoint {
  x: number;
  y: number;
  t: number;
}

export interface PlayerStrategyRun {
  iteration: number;
  floorReached: number;
  score: number;
  result: 'died' | 'manualExit' | 'floorClear';
  path: PlayerPathPoint[];
  uniqueTilesVisited: number;
  actions: {
    attacks: number;
    itemsUsed: number;
    kills: number;
    damageTaken: number;
  };
  difficultyAtRun: number;
  profileSnapshot: PlayerProfile;
  timestamp: number;
}

export interface IterationLearningPayload {
  run: Omit<PlayerStrategyRun, 'timestamp'>;
  profile: PlayerProfile;
  evolvedPopulation: Genome[];
  stats: GenerationStats;
  nextDifficulty: number;
}

export interface MapInfo {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  layoutPath: string;
  isProcedural: boolean;
}

interface GameState {
  // Screen
  currentScreen: GameScreen;
  setScreen: (screen: GameScreen) => void;

  // Map selection
  selectedMap: string;
  setSelectedMap: (mapId: string) => void;

  // Character selection
  selectedCharacter: number;
  setSelectedCharacter: (index: number) => void;

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
  setPlayerMaxHealth: (maxHealth: number) => void;
  addScore: (points: number) => void;

  // Evolution + learning
  generation: number;
  population: Genome[];
  playerProfile: PlayerProfile | null;
  generationHistory: GenerationStats[];
  iteration: number;
  baseDifficulty: number;
  currentDifficulty: number;
  playerRuns: PlayerStrategyRun[];
  setPopulation: (pop: Genome[]) => void;
  setPlayerProfile: (profile: PlayerProfile) => void;
  addGenerationStats: (stats: GenerationStats) => void;
  completeIterationLearning: (payload: IterationLearningPayload) => void;
  resetLearning: () => void;

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

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      // Screen
      currentScreen: 'mainMenu',
      setScreen: (screen) => set({ currentScreen: screen }),

      // Map selection
      selectedMap: 'crypt',
      setSelectedMap: (mapId) => set({ selectedMap: mapId }),

      // Character selection
      selectedCharacter: 0,
      setSelectedCharacter: (index) => set({ selectedCharacter: index }),

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
      setPlayerMaxHealth: (maxHealth) => set({ playerMaxHealth: maxHealth }),
      addScore: (points) => set((s) => ({ playerScore: s.playerScore + points })),

      // Evolution + learning
      generation: 0,
      population: [],
      playerProfile: null,
      generationHistory: [],
      iteration: 1,
      baseDifficulty: 1,
      currentDifficulty: 1,
      playerRuns: [],
      setPopulation: (pop) => set({ population: pop }),
      setPlayerProfile: (profile) => set({ playerProfile: profile }),
      addGenerationStats: (stats) =>
        set((s) => ({
          generationHistory: [...s.generationHistory, stats],
          generation: stats.generation,
        })),
      completeIterationLearning: ({ run, profile, evolvedPopulation, stats, nextDifficulty }) =>
        set((s) => ({
          playerRuns: [...s.playerRuns, { ...run, timestamp: Date.now() }],
          playerProfile: profile,
          population: evolvedPopulation,
          generationHistory: [...s.generationHistory, stats],
          generation: stats.generation,
          currentDifficulty: Math.max(s.baseDifficulty, nextDifficulty),
          iteration: s.iteration + 1,
          isPlaying: false,
        })),
      resetLearning: () =>
        set((s) => ({
          generation: 0,
          population: [],
          playerProfile: null,
          generationHistory: [],
          iteration: 1,
          currentDifficulty: s.baseDifficulty,
          playerRuns: [],
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
      resetGame: () =>
        set({
          currentFloor: 1,
          currentBiome: BiomeType.DUNGEON,
          playerHealth: 100,
          playerScore: 0,
          generation: 0,
          population: [],
          generationHistory: [],
          playerProfile: null,
          iteration: 1,
          currentDifficulty: 1,
          playerRuns: [],
          dungeonData: null,
          isPlaying: false,
          isPaused: false,
          currentScreen: 'mainMenu',
          selectedMap: 'crypt',
        }),
    }),
    {
      name: 'evocracker-learning-store',
      partialize: (state) => ({
        generation: state.generation,
        population: state.population,
        playerProfile: state.playerProfile,
        generationHistory: state.generationHistory,
        iteration: state.iteration,
        baseDifficulty: state.baseDifficulty,
        currentDifficulty: state.currentDifficulty,
        playerRuns: state.playerRuns,
      }),
    }
  )
);
