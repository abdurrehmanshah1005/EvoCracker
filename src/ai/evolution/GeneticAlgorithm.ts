// ========================
// Genetic Algorithm — The Cracker Evolutionary System
// Enemies evolve and adapt to the player's playstyle
// ========================

import { AlgorithmType } from '@utils/constants';
import { uuid, randomFloat, randomGaussian, randomInt, randomBool } from '@utils/random';
import { clamp } from '@utils/math';

// --- Genome Definition ---
export interface Genome {
  id: string;
  generation: number;

  // Core genes (0.0 → 1.0)
  speed: number;
  vision: number;
  aggression: number;
  persistence: number;
  cautiousness: number;

  // Algorithm preference weights (will be normalized)
  algorithmWeights: Record<AlgorithmType, number>;

  // Behavior modifiers
  packTendency: number;
  ambushTendency: number;
  patrolVariance: number;

  // Metadata
  fitness: number;
  parentIds: [string, string] | null;
  mutations: string[];
  alive: boolean;
}

/** Create a random genome for generation 0 */
export function createRandomGenome(generation = 0): Genome {
  return {
    id: uuid(),
    generation,
    speed: randomFloat(0.2, 0.8),
    vision: randomFloat(0.3, 0.9),
    aggression: randomFloat(0.1, 0.9),
    persistence: randomFloat(0.2, 0.8),
    cautiousness: randomFloat(0.2, 0.7),
    algorithmWeights: {
      [AlgorithmType.BFS]: randomFloat(0.1, 1),
      [AlgorithmType.DFS]: randomFloat(0.1, 1),
      [AlgorithmType.IDS]: randomFloat(0.1, 1),
      [AlgorithmType.DLS]: randomFloat(0.1, 1),
      [AlgorithmType.UCS]: randomFloat(0.1, 1),
      [AlgorithmType.ASTAR]: randomFloat(0.1, 1),
      [AlgorithmType.GREEDY_BFS]: randomFloat(0.1, 1),
      [AlgorithmType.HILL_CLIMBING]: randomFloat(0.1, 1),
    },
    packTendency: randomFloat(0, 1),
    ambushTendency: randomFloat(0, 1),
    patrolVariance: randomFloat(0, 1),
    fitness: 0,
    parentIds: null,
    mutations: [],
    alive: true,
  };
}

/** Get the preferred algorithm from genome weights */
export function getPreferredAlgorithm(genome: Genome): AlgorithmType {
  const types = Object.keys(genome.algorithmWeights) as AlgorithmType[];
  let best = types[0];
  let bestWeight = genome.algorithmWeights[best] ?? 0;

  for (let i = 1; i < types.length; i++) {
    const t = types[i];
    const w = genome.algorithmWeights[t] ?? 0;
    if (w > bestWeight) {
      best = t;
      bestWeight = w;
    }
  }

  return best;
}

/** Sample an algorithm from genome weights so evolution remains visible without collapsing to one choice. */
export function sampleAlgorithmFromGenome(genome: Genome, explorationRate = 0.08): AlgorithmType {
  const types = Object.keys(genome.algorithmWeights) as AlgorithmType[];
  if (types.length === 0) return AlgorithmType.BFS;

  if (Math.random() < explorationRate) {
    return types[randomInt(0, types.length - 1)];
  }

  const totalWeight = types.reduce((sum, type) => sum + Math.max(0.01, genome.algorithmWeights[type] ?? 0), 0);
  let spin = Math.random() * totalWeight;

  for (const type of types) {
    spin -= Math.max(0.01, genome.algorithmWeights[type] ?? 0);
    if (spin <= 0) return type;
  }

  return getPreferredAlgorithm(genome);
}

// --- Player Profile (drives fitness evaluation) ---
export interface RawKeystroke {
  code: string;
  key: string;
  type: 'down' | 'up';
  t: number;
}

export interface MovementCoordinate {
  x: number;
  y: number;
  t: number;
}

export interface PlayerProfile {
  averageSpeed: number;
  pathStraightness: number;
  explorationRate: number;
  hidingFrequency: number;
  averageHideDuration: number;
  stealthToRushRatio: number;
  engagementRate: number;
  fleeFrequency: number;
  playstyle: 'rusher' | 'stayer' | 'explorer' | 'fighter' | 'hybrid';

  // Raw tracking data
  totalMoves: number;
  totalHides: number;
  totalFights: number;
  totalFlees: number;
  tilesExplored: number;
  totalTiles: number;
  timeSpentHiding: number;
  timeSpentMoving: number;

  rawKeystrokes: RawKeystroke[];
  movementCoordinates: MovementCoordinate[];
  timeSpentInZones: Record<string, number>;
  cleanedTelemetry: {
    keystrokeCounts: Record<string, number>;
    dominantZone: string;
    totalSamples: number;
  };
}

export function createPlayerProfile(): PlayerProfile {
  return {
    averageSpeed: 0, pathStraightness: 0, explorationRate: 0,
    hidingFrequency: 0, averageHideDuration: 0, stealthToRushRatio: 0.5,
    engagementRate: 0, fleeFrequency: 0, playstyle: 'hybrid',
    totalMoves: 0, totalHides: 0, totalFights: 0, totalFlees: 0,
    tilesExplored: 0, totalTiles: 1, timeSpentHiding: 0, timeSpentMoving: 0,
    rawKeystrokes: [],
    movementCoordinates: [],
    timeSpentInZones: {},
    cleanedTelemetry: {
      keystrokeCounts: {},
      dominantZone: 'unknown',
      totalSamples: 0,
    },
  };
}

/** Classify player based on tracked behavior */
export function classifyPlaystyle(profile: PlayerProfile): PlayerProfile['playstyle'] {
  const rushScore = profile.averageSpeed * 0.4 + profile.pathStraightness * 0.3 + (1 - profile.stealthToRushRatio) * 0.3;
  const stayScore = profile.hidingFrequency * 0.3 + profile.stealthToRushRatio * 0.4 + profile.averageHideDuration * 0.3;
  const exploreScore = profile.explorationRate * 0.6 + profile.pathStraightness * 0.2 + (1 - profile.hidingFrequency) * 0.2;
  const fightScore = profile.engagementRate * 0.5 + (1 - profile.fleeFrequency) * 0.3 + (1 - profile.stealthToRushRatio) * 0.2;

  const scores = { rusher: rushScore, stayer: stayScore, explorer: exploreScore, fighter: fightScore };
  const maxLabel = (Object.keys(scores) as (keyof typeof scores)[]).reduce((a, b) => scores[a] > scores[b] ? a : b);

  // If no strong signal, classify as hybrid
  const maxVal = scores[maxLabel];
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 4;
  if (maxVal - avg < 0.1) return 'hybrid';

  return maxLabel;
}

// --- Fitness Function ---
export interface EnemyPerformance {
  timePlayerVisible: number;    // Seconds player was in vision
  damageDealt: number;
  playerDetections: number;     // Times successfully detected player
  survivalTime: number;         // Seconds alive
  areaCovered: number;          // Unique tiles visited
  timeStuck: number;            // Seconds unable to move
  cooperativeKills: number;     // Kills assisted by other enemies
}

export function calculateFitness(
  performance: EnemyPerformance,
  genome: Genome,
  playerProfile: PlayerProfile
): number {
  let fitness =
    performance.timePlayerVisible * 0.3
    + performance.damageDealt * 2.0
    + performance.playerDetections * 1.5
    + performance.survivalTime * 0.2
    + performance.areaCovered * 0.4
    - performance.timeStuck * 1.0
    + performance.cooperativeKills * 2.5;

  // Playstyle-adaptive bonuses
  switch (playerProfile.playstyle) {
    case 'stayer':
      fitness *= 1 + genome.persistence * 0.5;
      break;
    case 'rusher':
      fitness *= 1 + genome.speed * 0.5;
      break;
    case 'explorer':
      fitness *= 1 + genome.packTendency * 0.4;
      break;
    case 'fighter':
      fitness *= 1 + genome.cautiousness * 0.3;
      break;
    case 'hybrid':
      fitness *= 1.1; // Small general bonus
      break;
  }

  return Math.max(0, fitness);
}

// --- Selection ---
export function tournamentSelection(population: Genome[], tournamentSize = 3): Genome {
  let best: Genome | null = null;
  for (let i = 0; i < tournamentSize; i++) {
    const idx = randomInt(0, population.length - 1);
    if (!best || population[idx].fitness > best.fitness) {
      best = population[idx];
    }
  }
  return best!;
}

export function rouletteSelection(population: Genome[]): Genome {
  const totalFitness = population.reduce((sum, g) => sum + g.fitness, 0);
  if (totalFitness === 0) return population[randomInt(0, population.length - 1)];

  let spin = randomFloat(0, totalFitness);
  for (const genome of population) {
    spin -= genome.fitness;
    if (spin <= 0) return genome;
  }
  return population[population.length - 1];
}

// --- Crossover ---
export function uniformCrossover(parent1: Genome, parent2: Genome, generation: number): Genome {
  const child: Genome = {
    id: uuid(),
    generation,
    speed: randomBool() ? parent1.speed : parent2.speed,
    vision: randomBool() ? parent1.vision : parent2.vision,
    aggression: randomBool() ? parent1.aggression : parent2.aggression,
    persistence: randomBool() ? parent1.persistence : parent2.persistence,
    cautiousness: randomBool() ? parent1.cautiousness : parent2.cautiousness,
    algorithmWeights: {} as Genome['algorithmWeights'],
    packTendency: randomBool() ? parent1.packTendency : parent2.packTendency,
    ambushTendency: randomBool() ? parent1.ambushTendency : parent2.ambushTendency,
    patrolVariance: randomBool() ? parent1.patrolVariance : parent2.patrolVariance,
    fitness: 0,
    parentIds: [parent1.id, parent2.id],
    mutations: [],
    alive: true,
  };

  // Crossover algorithm weights
  for (const algo of Object.keys(parent1.algorithmWeights) as AlgorithmType[]) {
    child.algorithmWeights[algo] = randomBool()
      ? parent1.algorithmWeights[algo]
      : parent2.algorithmWeights[algo];
  }

  return child;
}

export function weightedAverageCrossover(parent1: Genome, parent2: Genome, generation: number): Genome {
  const total = parent1.fitness + parent2.fitness;
  const w1 = total > 0 ? parent1.fitness / total : 0.5;
  const w2 = 1 - w1;

  const blend = (a: number, b: number) => a * w1 + b * w2;

  const child: Genome = {
    id: uuid(),
    generation,
    speed: blend(parent1.speed, parent2.speed),
    vision: blend(parent1.vision, parent2.vision),
    aggression: blend(parent1.aggression, parent2.aggression),
    persistence: blend(parent1.persistence, parent2.persistence),
    cautiousness: blend(parent1.cautiousness, parent2.cautiousness),
    algorithmWeights: {} as Genome['algorithmWeights'],
    packTendency: blend(parent1.packTendency, parent2.packTendency),
    ambushTendency: blend(parent1.ambushTendency, parent2.ambushTendency),
    patrolVariance: blend(parent1.patrolVariance, parent2.patrolVariance),
    fitness: 0,
    parentIds: [parent1.id, parent2.id],
    mutations: [],
    alive: true,
  };

  for (const algo of Object.keys(parent1.algorithmWeights) as AlgorithmType[]) {
    child.algorithmWeights[algo] = blend(
      parent1.algorithmWeights[algo],
      parent2.algorithmWeights[algo]
    );
  }

  return child;
}

// --- Mutation ---
export function mutateGenome(
  genome: Genome,
  mutationRate = 0.15,
  mutationStrength = 0.2
): Genome {
  const mutated = { ...genome, mutations: [...genome.mutations] };

  const maybeSet = (gene: keyof Genome, value: number) => {
    if (randomBool(mutationRate)) {
      const noise = randomGaussian(0, mutationStrength);
      const newVal = clamp(value + noise, 0, 1);
      (mutated as Record<string, unknown>)[gene] = newVal;
      mutated.mutations.push(`${gene}: ${value.toFixed(3)} → ${newVal.toFixed(3)}`);
    }
  };

  maybeSet('speed', genome.speed);
  maybeSet('vision', genome.vision);
  maybeSet('aggression', genome.aggression);
  maybeSet('persistence', genome.persistence);
  maybeSet('cautiousness', genome.cautiousness);
  maybeSet('packTendency', genome.packTendency);
  maybeSet('ambushTendency', genome.ambushTendency);
  maybeSet('patrolVariance', genome.patrolVariance);

  // Mutate algorithm weights
  const algos = Object.keys(genome.algorithmWeights) as AlgorithmType[];
  for (const algo of algos) {
    if (randomBool(mutationRate)) {
      const old = genome.algorithmWeights[algo];
      const noise = randomGaussian(0, mutationStrength * 0.5);
      mutated.algorithmWeights[algo] = clamp(old + noise, 0.05, 2);
      mutated.mutations.push(`algo_${algo}: ${old.toFixed(3)} → ${mutated.algorithmWeights[algo].toFixed(3)}`);
    }
  }

  return mutated;
}

// --- Evolution Loop ---
export interface EvolutionConfig {
  populationSize: number;
  elitismRate: number;          // Top N% survive unchanged
  mutationRate: number;
  mutationStrength: number;
  tournamentSize: number;
  crossoverMethod: 'uniform' | 'weightedAverage';
  selectionMethod: 'tournament' | 'roulette';
}

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  populationSize: 20,
  elitismRate: 0.1,
  mutationRate: 0.15,
  mutationStrength: 0.2,
  tournamentSize: 3,
  crossoverMethod: 'weightedAverage',
  selectionMethod: 'tournament',
};

export interface GenerationStats {
  generation: number;
  avgFitness: number;
  maxFitness: number;
  minFitness: number;
  medianFitness: number;
  diversityIndex: number;
  dominantAlgorithm: AlgorithmType;
  avgGenes: Record<string, number>;
  populationSize: number;
  eliteSurvivors: number;
  totalMutations: number;
}

/**
 * Run one generation of evolution.
 * Called between dungeon floors.
 */
export function evolvePopulation(
  population: Genome[],
  playerProfile: PlayerProfile,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG
): { newPopulation: Genome[]; stats: GenerationStats } {
  // Sort by fitness (descending)
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const generation = (sorted[0]?.generation ?? 0) + 1;

  // Elitism: keep top performers unchanged
  const eliteCount = Math.max(1, Math.floor(sorted.length * config.elitismRate));
  const elites = sorted.slice(0, eliteCount).map((g) => ({
    ...g,
    generation,
    mutations: [],
    alive: true,
  }));

  // Breed new population
  const newPopulation: Genome[] = [...elites];
  const select = config.selectionMethod === 'tournament'
    ? () => tournamentSelection(sorted, config.tournamentSize)
    : () => rouletteSelection(sorted);

  const crossover = config.crossoverMethod === 'uniform'
    ? uniformCrossover
    : weightedAverageCrossover;

  while (newPopulation.length < config.populationSize) {
    const parent1 = select();
    const parent2 = select();
    let child = crossover(parent1, parent2, generation);
    child = mutateGenome(child, config.mutationRate, config.mutationStrength);

    // Adaptive bias based on player profile
    child = applyPlaystyleBias(child, playerProfile);

    newPopulation.push(child);
  }

  // Compute stats
  const stats = computeGenerationStats(newPopulation, generation, eliteCount);

  return { newPopulation, stats };
}

/** Apply small biases based on what the player does */
function applyPlaystyleBias(genome: Genome, profile: PlayerProfile): Genome {
  const biased = { ...genome };

  switch (profile.playstyle) {
    case 'rusher':
      biased.speed = clamp(biased.speed + 0.05, 0, 1);
      biased.algorithmWeights[AlgorithmType.ASTAR] *= 1.2;
      biased.algorithmWeights[AlgorithmType.GREEDY_BFS] *= 1.1;
      break;
    case 'stayer':
      biased.persistence = clamp(biased.persistence + 0.05, 0, 1);
      biased.algorithmWeights[AlgorithmType.BFS] *= 1.2;
      biased.algorithmWeights[AlgorithmType.IDS] *= 1.2;
      break;
    case 'explorer':
      biased.packTendency = clamp(biased.packTendency + 0.05, 0, 1);
      biased.algorithmWeights[AlgorithmType.DLS] *= 1.2;
      break;
    case 'fighter':
      biased.cautiousness = clamp(biased.cautiousness + 0.05, 0, 1);
      biased.speed = clamp(biased.speed + 0.03, 0, 1);
      break;
  }

  return biased;
}

function computeGenerationStats(
  population: Genome[],
  generation: number,
  eliteCount: number
): GenerationStats {
  const fitnesses = population.map((g) => g.fitness).sort((a, b) => a - b);
  const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
  const medianFitness = fitnesses[Math.floor(fitnesses.length / 2)];

  // Diversity: average pairwise gene distance
  let totalDist = 0;
  let pairs = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      totalDist += genomeDistance(population[i], population[j]);
      pairs++;
    }
  }
  const diversityIndex = pairs > 0 ? totalDist / pairs : 0;

  // Dominant algorithm
  const algoCounts = new Map<AlgorithmType, number>();
  for (const genome of population) {
    const pref = getPreferredAlgorithm(genome);
    algoCounts.set(pref, (algoCounts.get(pref) ?? 0) + 1);
  }
  let dominantAlgorithm = AlgorithmType.BFS;
  let maxCount = 0;
  for (const [algo, count] of algoCounts) {
    if (count > maxCount) { maxCount = count; dominantAlgorithm = algo; }
  }

  // Average genes
  const avgGenes: Record<string, number> = {};
  const geneNames = ['speed', 'vision', 'aggression', 'persistence', 'cautiousness', 'packTendency', 'ambushTendency', 'patrolVariance'];
  for (const gene of geneNames) {
    avgGenes[gene] = population.reduce((sum, g) => sum + ((g as unknown) as Record<string, number>)[gene], 0) / population.length;
  }

  const totalMutations = population.reduce((sum, g) => sum + g.mutations.length, 0);

  return {
    generation,
    avgFitness,
    maxFitness: fitnesses[fitnesses.length - 1],
    minFitness: fitnesses[0],
    medianFitness,
    diversityIndex,
    dominantAlgorithm,
    avgGenes,
    populationSize: population.length,
    eliteSurvivors: eliteCount,
    totalMutations,
  };
}

function genomeDistance(a: Genome, b: Genome): number {
  return (
    Math.abs(a.speed - b.speed) +
    Math.abs(a.vision - b.vision) +
    Math.abs(a.aggression - b.aggression) +
    Math.abs(a.persistence - b.persistence) +
    Math.abs(a.cautiousness - b.cautiousness)
  ) / 5;
}
