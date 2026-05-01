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
  generation: number;
  fitness: number;
  health: number;
  maxHealth: number;
  speed: number;
  visionRange: number;
  attackDamage: number;
  speedGene: number;
  visionGene: number;
  aggressionGene: number;
  persistenceGene: number;
  cautiousnessGene: number;
  packTendencyGene: number;
  ambushTendencyGene: number;
  patrolVarianceGene: number;
  nodesExpanded: number;
  pathLength: number;
  pathIndex: number;
  pathProgress: number;
  pathComputeTimeMs: number;
  pathRequestPending: boolean;
  target: { x: number; y: number } | null;
  timePlayerVisible: number;
  damageDealt: number;
  playerDetections: number;
  survivalTime: number;
  areaCovered: number;
  timeStuck: number;
  position: { x: number; y: number };
}

export interface IterationProofData {
  iteration: number;
  floorReached: number;
  generationBefore: number;
  generationAfter: number;
  result: PlayerStrategyRun['result'];
  score: number;
  enemyCount: number;
  timestamp: number;
  playstyle: PlayerProfile['playstyle'];
  difficultyBefore: number;
  difficultyAfter: number;
  beforeStrengthIndex: number;
  afterStrengthIndex: number;
  beforeAvgFitness: number;
  roundAvgFitness: number;
  roundMaxFitness: number;
  beforeGenes: Record<string, number>;
  afterGenes: Record<string, number>;
  avgPathTimeMs: number;
  avgNodesExpanded: number;
  avgDamageDealt: number;
  avgDetections: number;
  avgSurvivalTime: number;
  avgAreaCovered: number;
  dominantAlgorithm: AlgorithmType;
  algorithmDistribution: Record<AlgorithmType, number>;
}

export interface PlayerPathPoint {
  x: number;
  y: number;
  t: number;
}

export interface PlayerKeystroke {
  code: string;
  key: string;
  type: 'down' | 'up';
  t: number;
}

export interface PlayerStrategyRun {
  iteration: number;
  floorReached: number;
  score: number;
  result: 'died' | 'manualExit' | 'floorClear';
  path: PlayerPathPoint[];
  keystrokes: PlayerKeystroke[];
  timeSpentInZones: Record<string, number>;
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
  proof: Omit<IterationProofData, 'timestamp'>;
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
  setPaused: (paused: boolean) => void;
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
  iterationProofHistory: IterationProofData[];
  autoShowIterationGraphs: boolean;
  setPopulation: (pop: Genome[]) => void;
  setPlayerProfile: (profile: PlayerProfile) => void;
  addGenerationStats: (stats: GenerationStats) => void;
  completeIterationLearning: (payload: IterationLearningPayload) => void;
  toggleAutoShowIterationGraphs: () => void;
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

  // Profile
  username: string;
  setUsername: (name: string) => void;
  playerPlaystyle: string;
  setPlayerPlaystyle: (style: string) => void;

  // Audio
  musicEnabled: boolean;
  toggleMusic: () => void;
  currentTrack: number;
  setTrack: (track: number) => void;
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
      setPaused: (paused) => set({ isPaused: paused }),
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
      iterationProofHistory: [],
      autoShowIterationGraphs: true,
      setPopulation: (pop) => set({ population: pop }),
      setPlayerProfile: (profile) => set({ playerProfile: profile }),
      addGenerationStats: (stats) =>
        set((s) => ({
          generationHistory: [...s.generationHistory, stats],
          generation: stats.generation,
        })),
      completeIterationLearning: ({ run, profile, evolvedPopulation, stats, nextDifficulty, proof }) =>
        set((s) => ({
          playerRuns: [...s.playerRuns, { ...run, timestamp: Date.now() }],
          playerProfile: profile,
          population: evolvedPopulation,
          generationHistory: [...s.generationHistory, stats],
          generation: stats.generation,
          currentDifficulty: Math.max(s.baseDifficulty, nextDifficulty),
          iteration: s.iteration + 1,
          iterationProofHistory: [...s.iterationProofHistory, { ...proof, timestamp: Date.now() }],
          analyticsEnabled: s.autoShowIterationGraphs ? true : s.analyticsEnabled,
          analyticsTab: s.autoShowIterationGraphs ? 2 : s.analyticsTab,
          isPlaying: false,
        })),
      toggleAutoShowIterationGraphs: () => set((s) => ({ autoShowIterationGraphs: !s.autoShowIterationGraphs })),
      resetLearning: () =>
        set((s) => ({
          generation: 0,
          population: [],
          playerProfile: null,
          generationHistory: [],
          iteration: 1,
          currentDifficulty: s.baseDifficulty,
          playerRuns: [],
          iterationProofHistory: [],
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
          iterationProofHistory: [],
          dungeonData: null,
          isPlaying: false,
          isPaused: false,
          currentScreen: 'mainMenu',
          selectedMap: 'crypt',
        }),

      // Profile
      username: 'Anonymous',
      setUsername: (name) => set({ username: name }),
      playerPlaystyle: 'unknown',
      setPlayerPlaystyle: (style) => set({ playerPlaystyle: style }),

      // Audio
      musicEnabled: true,
      toggleMusic: () => set((s) => ({ musicEnabled: !s.musicEnabled })),
      currentTrack: 1,
      setTrack: (track) => set({ currentTrack: track }),
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
        iterationProofHistory: state.iterationProofHistory,
        autoShowIterationGraphs: state.autoShowIterationGraphs,
        musicEnabled: state.musicEnabled,
        currentTrack: state.currentTrack,
      }),
    }
  )
);
