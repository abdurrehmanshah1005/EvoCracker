// ========================
// Math utilities
// ========================

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Distance between two points */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** Manhattan distance */
export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/** Normalize angle to [0, 2π] */
export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
}

/** Angle between two points */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Check if point is inside rectangle */
export function pointInRect(
  px: number, py: number,
  rx: number, ry: number,
  rw: number, rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/** Smooth step (cubic Hermite interpolation) */
export function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Map value from one range to another */
export function mapRange(
  value: number,
  inMin: number, inMax: number,
  outMin: number, outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/** Generate a unique ID */
let _idCounter = 0;
export function generateId(): number {
  return ++_idCounter;
}

/** Reset ID counter (for testing) */
export function resetIdCounter(): void {
  _idCounter = 0;
}
