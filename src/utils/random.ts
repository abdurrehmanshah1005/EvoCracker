// ========================
// Random utilities for GA and procedural generation
// ========================

/** Random float in range [min, max) */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Random integer in range [min, max] inclusive */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random boolean with given probability of true */
export function randomBool(probability = 0.5): boolean {
  return Math.random() < probability;
}

/** Pick random element from array */
export function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Shuffle array in place (Fisher-Yates) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Gaussian random (Box-Muller transform) */
export function randomGaussian(mean = 0, stdDev = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + stdDev * normal;
}

/** Weighted random selection — returns index */
export function weightedRandomIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i;
  }
  return weights.length - 1;
}

/** Weighted random selection — returns element */
export function weightedRandom<T>(items: T[], weights: number[]): T {
  return items[weightedRandomIndex(weights)];
}

/** Generate a UUID v4 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
