// ========================
// Algorithm Lab — Interactive Pathfinding Sandbox
// Draw walls, place start/goal, pick an algorithm, watch it work
// ========================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore, type IterationProofData } from '@store/gameStore';
import { AlgorithmType } from '@utils/constants';
import { getAlgorithmInfo } from '@ai/pathfinding/AlgorithmRegistry';
import { Grid } from '@ai/pathfinding/Grid';
import { TileType } from '@utils/constants';
import { bfs } from '@ai/pathfinding/algorithms/BFS';
import { dfs } from '@ai/pathfinding/algorithms/DFS';
import { ids } from '@ai/pathfinding/algorithms/IDS';
import { dls } from '@ai/pathfinding/algorithms/DLS';
import { ucs } from '@ai/pathfinding/algorithms/UCS';
import { aStar } from '@ai/pathfinding/algorithms/AStar';
import { greedyBFS } from '@ai/pathfinding/algorithms/GreedyBFS';
import { hillClimbing } from '@ai/pathfinding/algorithms/HillClimbing';
import { manhattan } from '@ai/pathfinding/heuristics';
import type { PathResult } from '@ai/pathfinding/Grid';

const COLS = 30;
const ROWS = 20;
const CELL = 28;

type CellState = 'empty' | 'wall' | 'start' | 'goal';
type DrawMode = 'wall' | 'erase' | 'start' | 'goal';
type LabView = 'sandbox' | 'graphs';
type LabGraphType = 'line' | 'bar' | 'area' | 'radar';

const GRAPH_METRICS: {
  key: string;
  label: string;
  color: string;
  read: (proof: IterationProofData) => number;
  suffix?: string;
}[] = [
  { key: 'strength', label: 'Enemy Strength', color: '#44dd88', read: (proof) => proof.afterStrengthIndex },
  { key: 'strengthDelta', label: 'Strength Gain', color: '#88ffaa', read: (proof) => proof.afterStrengthIndex - proof.beforeStrengthIndex },
  { key: 'fitness', label: 'Avg Fitness', color: '#c8a850', read: (proof) => proof.roundAvgFitness },
  { key: 'maxFitness', label: 'Max Fitness', color: '#e8d080', read: (proof) => proof.roundMaxFitness },
  { key: 'difficulty', label: 'Difficulty', color: '#ff8844', read: (proof) => proof.difficultyAfter, suffix: 'x' },
  { key: 'pathTime', label: 'Path Time', color: '#44ddff', read: (proof) => proof.avgPathTimeMs, suffix: 'ms' },
  { key: 'nodes', label: 'Nodes Expanded', color: '#4488ff', read: (proof) => proof.avgNodesExpanded },
  { key: 'damage', label: 'Damage Dealt', color: '#ff4466', read: (proof) => proof.avgDamageDealt },
  { key: 'detections', label: 'Detections', color: '#aa44ff', read: (proof) => proof.avgDetections },
  { key: 'survival', label: 'Survival Time', color: '#44dd66', read: (proof) => proof.avgSurvivalTime, suffix: 's' },
  { key: 'area', label: 'Area Covered', color: '#ffcc00', read: (proof) => proof.avgAreaCovered },
];

const ALGO_CSS_COLORS: Record<AlgorithmType, string> = {
  [AlgorithmType.BFS]: '#4488ff',
  [AlgorithmType.DFS]: '#aa44ff',
  [AlgorithmType.IDS]: '#6644ff',
  [AlgorithmType.DLS]: '#ffcc00',
  [AlgorithmType.UCS]: '#44dd66',
  [AlgorithmType.ASTAR]: '#ffd700',
  [AlgorithmType.GREEDY_BFS]: '#ff4444',
  [AlgorithmType.HILL_CLIMBING]: '#ff8800',
};

function runAlgorithm(algo: AlgorithmType, grid: Grid, sx: number, sy: number, gx: number, gy: number): PathResult {
  switch (algo) {
    case AlgorithmType.BFS: return bfs(grid, sx, sy, gx, gy);
    case AlgorithmType.DFS: return dfs(grid, sx, sy, gx, gy);
    case AlgorithmType.IDS: return ids(grid, sx, sy, gx, gy);
    case AlgorithmType.DLS: return dls(grid, sx, sy, gx, gy, 15);
    case AlgorithmType.UCS: return ucs(grid, sx, sy, gx, gy);
    case AlgorithmType.ASTAR: return aStar(grid, sx, sy, gx, gy, manhattan);
    case AlgorithmType.GREEDY_BFS: return greedyBFS(grid, sx, sy, gx, gy, manhattan);
    case AlgorithmType.HILL_CLIMBING: return hillClimbing(grid, sx, sy); // no goal — finds best local vantage
    default: return bfs(grid, sx, sy, gx, gy);
  }
}

function buildGrid(cells: CellState[][]): Grid {
  const grid = new Grid(COLS, ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      grid.setTile(x, y, cells[y][x] === 'wall' ? TileType.WALL : TileType.FLOOR_STONE);
    }
  }
  return grid;
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill('empty') as CellState[]);
}

const ALL_ALGOS = Object.values(AlgorithmType);

function formatGraphValue(value: number, suffix = ''): string {
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)}${suffix}`;
}

function getProofSeries(proofHistory: IterationProofData[], metricKey: string): number[] {
  const metric = GRAPH_METRICS.find((item) => item.key === metricKey) ?? GRAPH_METRICS[0];
  return proofHistory.map(metric.read);
}

function MiniMetricGraph({
  type,
  values,
  labels,
  color,
  height = 180,
}: {
  type: LabGraphType;
  values: number[];
  labels: string[];
  color: string;
  height?: number;
}) {
  const width = 520;
  const padding = 28;
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = values.length <= 1
      ? width / 2
      : padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    return { x, y, value, label: labels[index] };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length > 0
    ? `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : '';

  if (type === 'radar') {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.34;
    const radarMax = Math.max(...values, 1);
    const radarPoints = values.map((value, index) => {
      const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
      const r = (value / radarMax) * radius;
      return {
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r,
        axisX: centerX + Math.cos(angle) * radius,
        axisY: centerY + Math.sin(angle) * radius,
        label: labels[index],
        value,
      };
    });
    const polygon = radarPoints.map((point) => `${point.x},${point.y}`).join(' ');

    return (
      <svg className="lab-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle key={scale} cx={centerX} cy={centerY} r={radius * scale} fill="none" stroke="rgba(255,255,255,0.08)" />
        ))}
        {radarPoints.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <line x1={centerX} y1={centerY} x2={point.axisX} y2={point.axisY} stroke="rgba(255,255,255,0.08)" />
            <text x={point.axisX} y={point.axisY} fill="var(--text-muted)" fontSize="9" textAnchor="middle">{point.label}</text>
          </g>
        ))}
        <polygon points={polygon} fill={`${color}45`} stroke={color} strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg className="lab-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
      {type === 'bar' && points.map((point, index) => {
        const barWidth = Math.max(12, (width - padding * 2) / Math.max(1, points.length) - 8);
        const zeroY = height - padding - ((0 - min) / span) * (height - padding * 2);
        const barTop = Math.min(point.y, zeroY);
        const barHeight = Math.max(2, Math.abs(zeroY - point.y));
        return (
          <rect
            key={`${point.label}-${index}`}
            x={point.x - barWidth / 2}
            y={barTop}
            width={barWidth}
            height={barHeight}
            rx="3"
            fill={color}
            opacity="0.82"
          />
        );
      })}
      {type === 'area' && <path d={areaPath} fill={`${color}35`} stroke="none" />}
      {(type === 'line' || type === 'area') && <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />}
      {(type === 'line' || type === 'area') && points.map((point, index) => (
        <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" fill={color} />
      ))}
      {points.map((point, index) => (
        <text key={`${point.label}-label-${index}`} x={point.x} y={height - 8} fill="var(--text-muted)" fontSize="9" textAnchor="middle">
          {point.label.replace('Iter ', 'I')}
        </text>
      ))}
      <text x={padding} y={18} fill="var(--text-muted)" fontSize="10">{formatGraphValue(max)}</text>
      <text x={padding} y={height - padding - 4} fill="var(--text-muted)" fontSize="10">{formatGraphValue(min)}</text>
    </svg>
  );
}

// --- Intelligence Composite Score ---
// Weighted aggregate of all smartness indicators (0-100 normalized)
function computeIntelligenceScore(proof: IterationProofData): number {
  const strengthNorm = Math.min(1, proof.afterStrengthIndex / 200);
  const fitnessNorm = Math.min(1, proof.roundAvgFitness / 100);
  const detectionsNorm = Math.min(1, proof.avgDetections / 20);
  const damageNorm = Math.min(1, proof.avgDamageDealt / 200);
  const survivalNorm = Math.min(1, proof.avgSurvivalTime / 120);
  const areaNorm = Math.min(1, proof.avgAreaCovered / 500);
  const pathEfficiency = proof.avgNodesExpanded > 0
    ? Math.min(1, 10 / Math.max(1, proof.avgNodesExpanded))
    : 0;

  return (
    strengthNorm * 25 +
    fitnessNorm * 15 +
    detectionsNorm * 15 +
    damageNorm * 15 +
    survivalNorm * 10 +
    areaNorm * 10 +
    pathEfficiency * 10
  );
}

function computeGrowthRate(values: number[]): { rate: number; trend: 'rising' | 'falling' | 'stable' } {
  if (values.length < 2) return { rate: 0, trend: 'stable' };
  const recent = values.slice(-Math.min(4, values.length));
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === 0) return { rate: 0, trend: 'stable' };
  const rate = ((last - first) / first) * 100;
  const trend = rate > 3 ? 'rising' : rate < -3 ? 'falling' : 'stable';
  return { rate, trend };
}

function computeMovingAverage(values: number[], windowSize: number = 3): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

// --- Multi-line Gene Evolution Chart ---
function GeneEvolutionChart({
  proofHistory,
  height = 240,
}: {
  proofHistory: IterationProofData[];
  height?: number;
}) {
  const width = 560;
  const padding = 32;
  const geneLabels = ['speed', 'vision', 'aggression', 'persistence', 'cautiousness', 'pack', 'ambush', 'patrol'];
  const geneKeys = ['speed', 'vision', 'aggression', 'persistence', 'cautiousness', 'packTendency', 'ambushTendency', 'patrolVariance'];
  const geneColors = ['#44ddff', '#4488ff', '#ff4466', '#ff8844', '#ffcc44', '#aa44ff', '#44dd66', '#f472b6'];
  const labels = proofHistory.map((p) => `I${p.iteration}`);

  const allValues: number[] = [];
  const series: { label: string; color: string; points: { x: number; y: number }[] }[] = [];

  geneKeys.forEach((key, gi) => {
    const values = proofHistory.map((proof) => {
      const geneRecord = proof.afterGenes as Record<string, number>;
      return (geneRecord[key] ?? 0) * 100;
    });
    allValues.push(...values);
    const points = values.map((v, i) => {
      const x = values.length <= 1 ? width / 2 : padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = allValues.length ? 0 : 0;
      return { x, y: 0, rawY: v, label: labels[i] };
    });
    series.push({ label: geneLabels[gi], color: geneColors[gi], points: points as { x: number; y: number }[] });
  });

  const min = Math.min(0, ...allValues);
  const max = Math.max(100, ...allValues);
  const span = Math.max(1, max - min);

  // Fill in actual y values
  series.forEach((s) => {
    const keyIndex = series.indexOf(s);
    s.points = proofHistory.map((proof, i) => {
      const geneRecord = proof.afterGenes as Record<string, number>;
      const v = (geneRecord[geneKeys[keyIndex]] ?? 0) * 100;
      const x = proofHistory.length <= 1 ? width / 2 : padding + (i / (proofHistory.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / span) * (height - padding * 2);
      return { x, y, rawY: v, label: labels[i] } as { x: number; y: number };
    });
  });

  if (proofHistory.length === 0) {
    return <div className="lab-empty-graph">Complete iterations to see gene evolution.</div>;
  }

  return (
    <svg className="lab-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gene evolution chart">
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = height - padding - ((tick - min) / span) * (height - padding * 2);
        return (
          <g key={tick}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x={padding - 2} y={y + 3} fill="var(--text-muted)" fontSize="8" textAnchor="end">{tick}%</text>
          </g>
        );
      })}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />

      {/* Legend */}
      {series.slice(0, 5).map((s, i) => (
        <g key={s.label}>
          <rect x={padding + i * 75} y={6} width={10} height={10} rx="2" fill={s.color} opacity="0.9" />
          <text x={padding + i * 75 + 14} y={15} fill="var(--text-muted)" fontSize="9">{s.label}</text>
        </g>
      ))}
      {series.slice(5).map((s, i) => (
        <g key={s.label}>
          <rect x={padding + i * 75} y={18} width={10} height={10} rx="2" fill={s.color} opacity="0.9" />
          <text x={padding + i * 75 + 14} y={27} fill="var(--text-muted)" fontSize="9">{s.label}</text>
        </g>
      ))}

      {/* Lines */}
      {series.map((s) => {
        const pathD = s.points.length > 1
          ? `M ${s.points.map((p) => `${p.x} ${p.y}`).join(' L ')}`
          : s.points.length === 1
            ? `M ${s.points[0].x} ${s.points[0].y} L ${s.points[0].x} ${s.points[0].y}`
            : '';
        return (
          <g key={s.label}>
            <path d={pathD} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" opacity="0.85" />
            {s.points.map((p, i) => (
              <circle
                key={`${s.label}-${i}`}
                cx={p.x}
                cy={p.y}
                r="3"
                fill={s.color}
                stroke="var(--bg-void)"
                strokeWidth="0.8"
              />
            ))}
          </g>
        );
      })}

      {/* X-axis labels */}
      {labels.map((label, i) => {
        const x = proofHistory.length <= 1 ? width / 2 : padding + (i / (proofHistory.length - 1)) * (width - padding * 2);
        return (
          <text key={label} x={x} y={height - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">{label}</text>
        );
      })}
    </svg>
  );
}

// --- Delta Gains Bar Chart ---
function DeltaGainsChart({
  proofHistory,
  height = 200,
}: {
  proofHistory: IterationProofData[];
  height?: number;
}) {
  const width = 560;
  const padding = 28;
  const deltas = proofHistory.map((proof) => proof.afterStrengthIndex - proof.beforeStrengthIndex);
  const labels = proofHistory.map((p) => `I${p.iteration}`);
  const max = Math.max(1, ...deltas, 0);
  const min = Math.min(0, ...deltas);

  if (proofHistory.length === 0) {
    return <div className="lab-empty-graph">No data yet.</div>;
  }

  const zeroY = height - padding - ((0 - min) / Math.max(1, max - min)) * (height - padding * 2);

  return (
    <svg className="lab-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Delta gains chart">
      {/* Zero line */}
      <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" />
      <text x={padding} y={zeroY - 4} fill="var(--text-muted)" fontSize="8">0</text>

      {deltas.map((delta, i) => {
        const barWidth = Math.max(14, (width - padding * 2) / Math.max(1, deltas.length) - 6);
        const x = deltas.length <= 1
          ? width / 2 - barWidth / 2
          : padding + (i / (deltas.length - 1)) * (width - padding * 2) - barWidth / 2;
        const span = Math.max(1, max - min);
        const barHeight = Math.max(4, (Math.abs(delta) / span) * (height - padding * 2));
        const barY = delta >= 0 ? zeroY - barHeight : zeroY;
        const color = delta >= 0 ? '#44dd88' : '#ff4466';
        const glowColor = delta >= 0 ? 'rgba(68,221,136,0.3)' : 'rgba(255,68,102,0.3)';

        return (
          <g key={i}>
            <rect x={x - 2} y={barY} width={2} height={barHeight} fill={glowColor} opacity="0.5" />
            <rect x={x} y={barY} width={barWidth} height={barHeight} rx="3" fill={color} opacity="0.85" />
            <text
              x={x + barWidth / 2}
              y={delta >= 0 ? barY - 5 : barY + barHeight + 14}
              fill={color}
              fontSize="9"
              fontWeight="700"
              textAnchor="middle"
            >
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
            </text>
            <text x={x + barWidth / 2} y={height - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">
              {labels[i]}
            </text>
          </g>
        );
      })}

      <text x={padding} y={16} fill="var(--text-muted)" fontSize="10">
        Strength Δ {formatGraphValue(max)}
      </text>
    </svg>
  );
}

// --- Algorithm Distribution Shift Chart ---
function AlgorithmDistributionChart({
  proofHistory,
  height = 220,
}: {
  proofHistory: IterationProofData[];
  height?: number;
}) {
  const width = 560;
  const padding = 28;
  const algoColors: Record<string, string> = {
    BFS: '#4488ff',
    DFS: '#aa44ff',
    IDS: '#6644ff',
    DLS: '#ffcc00',
    UCS: '#44dd66',
    ASTAR: '#ffd700',
    GREEDY_BFS: '#ff4444',
    HILL_CLIMBING: '#ff8800',
  };

  const algoKeys = Object.keys(algoColors);
  const labels = proofHistory.map((p) => `I${p.iteration}`);

  // Build stacked area data
  const stacks = algoKeys.map((algo) => {
    const values = proofHistory.map((proof) => {
      const dist = proof.algorithmDistribution as Record<string, number>;
      return ((dist[algo] ?? 0) / Math.max(1, proof.enemyCount)) * 100;
    });
    return { algo, color: algoColors[algo], values };
  });

  if (proofHistory.length === 0) {
    return <div className="lab-empty-graph">No data yet.</div>;
  }

  // Draw normalized stacked bars
  const barWidth = Math.max(16, (width - padding * 2) / Math.max(1, proofHistory.length) - 6);

  return (
    <svg className="lab-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Algorithm distribution">
      {/* Legend */}
      {algoKeys.slice(0, 4).map((algo, i) => (
        <g key={algo}>
          <rect x={padding + i * 100} y={6} width={10} height={10} rx="2" fill={algoColors[algo]} opacity="0.85" />
          <text x={padding + i * 100 + 14} y={15} fill="var(--text-muted)" fontSize="8">{algo}</text>
        </g>
      ))}
      {algoKeys.slice(4).map((algo, i) => (
        <g key={algo}>
          <rect x={padding + i * 100} y={18} width={10} height={10} rx="2" fill={algoColors[algo]} opacity="0.85" />
          <text x={padding + i * 100 + 14} y={27} fill="var(--text-muted)" fontSize="8">{algo}</text>
        </g>
      ))}

      {/* Bars */}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
      <line x1={padding} y1={30} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
      <text x={padding - 2} y={38} fill="var(--text-muted)" fontSize="8" textAnchor="end">100%</text>
      <text x={padding - 2} y={height - padding + 10} fill="var(--text-muted)" fontSize="8" textAnchor="end">0%</text>

      {proofHistory.map((_, i) => {
        const x = proofHistory.length <= 1
          ? width / 2 - barWidth / 2
          : padding + (i / (proofHistory.length - 1)) * (width - padding * 2) - barWidth / 2;
        let yOffset = height - padding;

        // Calculate total for this iteration
        const total = stacks.reduce((sum, s) => sum + s.values[i], 0);
        const scale = total > 0 ? (height - padding - 30) / total : 0;

        return (
          <g key={i}>
            {stacks.map((stack) => {
              const chunkHeight = stack.values[i] * scale;
              yOffset -= Math.max(0, chunkHeight);
              return chunkHeight > 0 ? (
                <rect
                  key={stack.algo}
                  x={x}
                  y={yOffset}
                  width={barWidth}
                  height={Math.max(1, chunkHeight)}
                  fill={stack.color}
                  opacity="0.8"
                  rx="1"
                />
              ) : null;
            })}
            <text x={x + barWidth / 2} y={height - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- Intelligence Trend Card ---
function IntelligenceTrendCard({
  proofHistory,
}: {
  proofHistory: IterationProofData[];
}) {
  const scores = proofHistory.map(computeIntelligenceScore);
  const labels = proofHistory.map((p) => `I${p.iteration}`);
  const latest = scores[scores.length - 1];
  const first = scores[0];
  const growth = computeGrowthRate(scores);
  const ma = computeMovingAverage(scores, 3);

  const width = 560;
  const height = 200;
  const padding = 28;
  const min = Math.max(0, Math.min(...scores) - 5);
  const max = Math.min(100, Math.max(...scores) + 5);
  const span = Math.max(1, max - min);

  const points = scores.map((v, i) => {
    const x = scores.length <= 1 ? width / 2 : padding + (i / (scores.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / span) * (height - padding * 2);
    return { x, y, v };
  });

  const maPoints = ma.map((v, i) => {
    const x = scores.length <= 1 ? width / 2 : padding + (i / (scores.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / span) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points.length > 1
    ? `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';
  const maPath = maPoints.length > 1
    ? `M ${maPoints.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : '';

  const trendIcon = growth.trend === 'rising' ? '↑' : growth.trend === 'falling' ? '↓' : '→';
  const trendColor = growth.trend === 'rising' ? '#44dd88' : growth.trend === 'falling' ? '#ff4466' : '#ffcc44';

  return (
    <div className="lab-card" style={{ border: `1px solid ${trendColor}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="lab-card-title">🧠 Intelligence Composite</div>
          <div className="lab-muted">Weighted aggregate of all enemy smartness indicators</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-pixel)', color: '#44dd88' }}>
            {latest?.toFixed(1) ?? '—'}<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/100</span>
          </div>
          <div style={{ fontSize: '0.58rem', fontFamily: 'var(--font-pixel2)', color: trendColor, marginTop: 2 }}>
            {trendIcon} {growth.rate.toFixed(1)}% {growth.trend}
          </div>
        </div>
      </div>

      {scores.length > 0 ? (
        <svg className="lab-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Intelligence trend">
          {/* Target zone (60-100 is smart) */}
          <rect
            x={padding}
            y={padding}
            width={width - padding * 2}
            height={height - padding * 2 - ((60 - min) / span) * (height - padding * 2)} 
            fill="rgba(68,221,136,0.04)"
            rx="4"
          />
          <text x={width - padding} y={padding + 12} fill="rgba(68,221,136,0.3)" fontSize="8" textAnchor="end">Smart Zone</text>

          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />

          {/* Area fill */}
          <path d={areaPath} fill="rgba(68,221,136,0.08)" stroke="none" />

          {/* Moving average line */}
          <path d={maPath} fill="none" stroke="rgba(255,204,68,0.6)" strokeWidth="2" strokeDasharray="5 3" />

          {/* Main line */}
          <path d={linePath} fill="none" stroke="#44dd88" strokeWidth="3" strokeLinejoin="round" />

          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill="#44dd88" stroke="var(--bg-void)" strokeWidth="1.5" />
              <text x={p.x} y={p.y - 8} fill="#44dd88" fontSize="9" fontWeight="700" textAnchor="middle">
                {p.v.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Labels */}
          {labels.map((label, i) => {
            const x = scores.length <= 1 ? width / 2 : padding + (i / (scores.length - 1)) * (width - padding * 2);
            return (
              <text key={label} x={x} y={height - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">{label}</text>
            );
          })}

          <text x={padding} y={16} fill="var(--text-muted)" fontSize="10">{formatGraphValue(max)}</text>
          <text x={padding} y={height - padding - 4} fill="var(--text-muted)" fontSize="10">{formatGraphValue(min)}</text>
        </svg>
      ) : (
        <div className="lab-empty-graph" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🧪</div>
            <p>Complete game iterations to track enemy intelligence evolution</p>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
              Each iteration runs the genetic algorithm → enemies get smarter
            </p>
          </div>
        </div>
      )}

      {/* Mini stat row */}
      {scores.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
          <div className="lab-metric-card">
            <span>First Score</span>
            <strong style={{ color: 'var(--text-secondary)' }}>{first?.toFixed(1)}</strong>
          </div>
          <div className="lab-metric-card">
            <span>Latest Score</span>
            <strong style={{ color: '#44dd88' }}>{latest?.toFixed(1)}</strong>
          </div>
          <div className="lab-metric-card">
            <span>Total Gain</span>
            <strong style={{ color: growth.trend === 'rising' ? '#44dd88' : '#ff4466' }}>
              {scores.length >= 2 ? `${((latest ?? 0) >= (first ?? 0) ? '+' : '') + ((latest ?? 0) - (first ?? 0)).toFixed(1)}` : '—'}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Strength Index Before vs After ---
function BeforeAfterStrengthChart({
  proofHistory,
  height = 240,
}: {
  proofHistory: IterationProofData[];
  height?: number;
}) {
  const width = 560;
  const padding = 28;
  const labels = proofHistory.map((p) => `I${p.iteration}`);
  const before = proofHistory.map((p) => p.beforeStrengthIndex);
  const after = proofHistory.map((p) => p.afterStrengthIndex);
  const allVals = [...before, ...after];
  const min = Math.max(0, Math.min(...allVals) - 5);
  const max = Math.max(...allVals) + 5;
  const span = Math.max(1, max - min);

  if (proofHistory.length === 0) return <div className="lab-empty-graph">No data yet.</div>;

  const barWidth = Math.max(6, (width - padding * 2) / Math.max(1, proofHistory.length) / 3);
  const groupWidth = barWidth * 2 + 3;

  return (
    <svg className="lab-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Before vs after strength">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />

      {/* Legend */}
      <g>
        <rect x={width - padding - 120} y={6} width={10} height={10} rx="2" fill="rgba(255,68,102,0.6)" />
        <text x={width - padding - 106} y={15} fill="var(--text-muted)" fontSize="8">Before</text>
      </g>
      <g>
        <rect x={width - padding - 60} y={6} width={10} height={10} rx="2" fill="#44dd88" />
        <text x={width - padding - 46} y={15} fill="var(--text-muted)" fontSize="8">After</text>
      </g>

      {/* Y-axis ticks */}
      {[min, (min + max) / 2, max].map((tick, ti) => {
        const tickY = height - padding - ((tick - min) / span) * (height - padding * 2);
        return (
          <text key={ti} x={padding - 4} y={tickY + 3} fill="var(--text-muted)" fontSize="8" textAnchor="end">
            {tick.toFixed(0)}
          </text>
        );
      })}

      {/* Grouped bars */}
      {proofHistory.map((_, i) => {
        const centerX = proofHistory.length <= 1
          ? width / 2
          : padding + (i / (proofHistory.length - 1)) * (width - padding * 2);
        const beforeY = height - padding - ((before[i] - min) / span) * (height - padding * 2);
        const afterY = height - padding - ((after[i] - min) / span) * (height - padding * 2);

        return (
          <g key={i}>
            <rect
              x={centerX - groupWidth / 2}
              y={Math.min(beforeY, height - padding)}
              width={barWidth}
              height={Math.max(2, height - padding - Math.min(beforeY, height - padding))}
              fill="rgba(255,68,102,0.5)"
              rx="2"
            />
            <rect
              x={centerX - groupWidth / 2 + barWidth + 3}
              y={Math.min(afterY, height - padding)}
              width={barWidth}
              height={Math.max(2, height - padding - Math.min(afterY, height - padding))}
              fill="#44dd88"
              rx="2"
            />
            <text x={centerX} y={height - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- LabEnemyGraphs: Main graph panel ---
function LabEnemyGraphs({
  proofHistory,
  enemyAnalytics,
  population,
  generation,
  graphType,
  selectedMetric,
  onGraphTypeChange,
  onMetricChange,
}: {
  proofHistory: IterationProofData[];
  enemyAnalytics: ReturnType<typeof useGameStore.getState>['enemyAnalytics'];
  population: ReturnType<typeof useGameStore.getState>['population'];
  generation: number;
  graphType: LabGraphType;
  selectedMetric: string;
  onGraphTypeChange: (type: LabGraphType) => void;
  onMetricChange: (metric: string) => void;
}) {
  const selectedGraphMetric = GRAPH_METRICS.find((metric) => metric.key === selectedMetric) ?? GRAPH_METRICS[0];
  const graphValues = getProofSeries(proofHistory, selectedMetric);
  const graphLabels = proofHistory.map((proof) => `Iter ${proof.iteration}`);
  const latestProof = proofHistory[proofHistory.length - 1];
  const enemyNameCounts = enemyAnalytics.reduce<Record<string, number>>((counts, enemy) => {
    counts[enemy.enemyType] = (counts[enemy.enemyType] ?? 0) + 1;
    return counts;
  }, {});
  const avgPopulationFitness = population.length
    ? population.reduce((sum, genome) => sum + (genome.fitness || 0), 0) / population.length
    : 0;

  // If no iterations yet, show motivating empty state
  if (proofHistory.length === 0) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: '3rem' }}>📊</div>
        <h3 style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75rem', color: 'var(--gold)', textAlign: 'center' }}>
          Enemy Intelligence Evolution Graphs
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textAlign: 'center', maxWidth: 420 }}>
          Each time you complete a floors in the game, the genetic algorithm runs.<br />
          Graphs here will <strong style={{ color: '#44dd88' }}>prove enemies get smarter</strong> over time.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 340, marginTop: 8 }}>
          {[
            { icon: '🧬', label: 'Gene Evolution', desc: '7 genes improving each iteration' },
            { icon: '🧠', label: 'Intelligence Score', desc: 'Composite smartness 0→100' },
            { icon: '📈', label: 'Strength Gains', desc: 'Before vs after per iteration' },
            { icon: '🗺️', label: 'Algorithm Shift', desc: 'Smarter pathfinding takeover' },
          ].map((item) => (
            <div key={item.icon} className="lab-metric-card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
              <strong style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)' }}>{item.label}</strong>
              <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      {/* Top stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          ['Completed Iterations', proofHistory.length],
          ['Current Generation', generation],
          ['Population', population.length],
          ['Avg Pop Fitness', avgPopulationFitness.toFixed(1)],
        ].map(([label, value]) => (
          <div key={String(label)} className="lab-metric-card">
            <span>{label}</span>
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>

      {/* Main graph area: stacked with intelligence trend FIRST, then gene evolution, then side-by-side */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Intelligence Composite Score - most prominent */}
        <IntelligenceTrendCard proofHistory={proofHistory} />

        {/* Gene evolution chart */}
        <div className="lab-card">
          <div className="lab-card-title">🧬 Gene Evolution Over Iterations</div>
          <div className="lab-muted">Enemy genes (%) adapting through natural selection</div>
          <GeneEvolutionChart proofHistory={proofHistory} height={250} />
        </div>

        {/* Side-by-side: Strength Before/After and Delta Gains */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="lab-card">
            <div className="lab-card-title">⚖️ Strength Before vs After</div>
            <div className="lab-muted">Proof each iteration improves enemies</div>
            <BeforeAfterStrengthChart proofHistory={proofHistory} height={260} />
          </div>

          <div className="lab-card">
            <div className="lab-card-title">📈 Strength Gain per Iteration</div>
            <div className="lab-muted">Delta improvements in enemy strength</div>
            <DeltaGainsChart proofHistory={proofHistory} height={260} />
          </div>
        </div>

        {/* Algorithm distribution shift */}
        <div className="lab-card">
          <div className="lab-card-title">🗺️ Algorithm Distribution Shift</div>
          <div className="lab-muted">How enemy pathfinding preferences change as they evolve</div>
          <AlgorithmDistributionChart proofHistory={proofHistory} height={260} />
        </div>

        {/* Original metric graph + controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="lab-card">
              <div className="lab-card-title">Graph Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['line', 'bar', 'area', 'radar'] as LabGraphType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => onGraphTypeChange(type)}
                    className="lab-chip"
                    data-active={graphType === type}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-card">
              <div className="lab-card-title">Metric</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {GRAPH_METRICS.map((metric) => (
                  <button
                    key={metric.key}
                    onClick={() => onMetricChange(metric.key)}
                    className="lab-chip"
                    data-active={selectedMetric === metric.key}
                    style={{ borderColor: selectedMetric === metric.key ? metric.color : undefined, color: selectedMetric === metric.key ? metric.color : undefined }}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-card">
              <div className="lab-card-title">Live Enemy Names</div>
              {Object.keys(enemyNameCounts).length > 0 ? (
                Object.entries(enemyNameCounts).map(([name, count]) => (
                  <div key={name} className="lab-stat-row">
                    <span>{name}</span>
                    <strong>{count}</strong>
                  </div>
                ))
              ) : (
                <p className="lab-muted">Start a game floor to see the exact spawned enemies here.</p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="lab-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <div className="lab-card-title">{selectedGraphMetric.label}</div>
                  <div className="lab-muted">Real values captured after each completed iteration</div>
                </div>
                <div style={{ color: selectedGraphMetric.color, fontFamily: 'var(--font-pixel)', fontSize: '0.55rem', textTransform: 'uppercase' }}>
                  {graphType} graph
                </div>
              </div>
              <MiniMetricGraph
                type={graphType}
                values={graphValues}
                labels={graphLabels}
                color={selectedGraphMetric.color}
                height={230}
              />
            </div>

            {latestProof && (
              <div className="lab-card">
                <div className="lab-card-title">Latest Before vs After</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {[
                    ['Strength', `${latestProof.beforeStrengthIndex.toFixed(1)} -> ${latestProof.afterStrengthIndex.toFixed(1)}`],
                    ['Fitness', `${latestProof.roundAvgFitness.toFixed(1)} avg / ${latestProof.roundMaxFitness.toFixed(1)} max`],
                    ['Difficulty', `x${latestProof.difficultyBefore.toFixed(2)} -> x${latestProof.difficultyAfter.toFixed(2)}`],
                    ['Pathfinding', `${latestProof.avgPathTimeMs.toFixed(2)}ms / ${latestProof.avgNodesExpanded.toFixed(0)} nodes`],
                    ['Combat', `${latestProof.avgDetections.toFixed(1)} det / ${latestProof.avgDamageDealt.toFixed(1)} dmg`],
                    ['Dominant Algo', latestProof.dominantAlgorithm],
                  ].map(([label, value]) => (
                    <div key={label} className="lab-metric-card">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="lab-card">
              <div className="lab-card-title">All Metrics Snapshot</div>
              <div className="lab-metric-grid">
                {GRAPH_METRICS.map((metric) => (
                  <div key={metric.key}>
                    <span>{metric.label}</span>
                    <MiniMetricGraph
                      type="line"
                      values={getProofSeries(proofHistory, metric.key)}
                      labels={graphLabels}
                      color={metric.color}
                      height={92}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlgorithmLabScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const iterationProofHistory = useGameStore((s) => s.iterationProofHistory);
  const enemyAnalytics = useGameStore((s) => s.enemyAnalytics);
  const population = useGameStore((s) => s.population);
  const generation = useGameStore((s) => s.generation);

  const [cells, setCells] = useState<CellState[][]>(() => {
    const c = makeEmptyCells();
    c[10][2] = 'start';
    c[10][27] = 'goal';
    return c;
  });

  const [startPos, setStartPos] = useState({ x: 2, y: 10 });
  const [goalPos, setGoalPos] = useState({ x: 27, y: 10 });
  const [drawMode, setDrawMode] = useState<DrawMode>('wall');
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>(AlgorithmType.ASTAR);
  const [animSpeed, setAnimSpeed] = useState(30); // ms per step
  const [labView, setLabView] = useState<LabView>('sandbox');
  const [graphType, setGraphType] = useState<LabGraphType>('line');
  const [selectedMetric, setSelectedMetric] = useState(GRAPH_METRICS[0].key);

  // Visualization state
  const [visitedCells, setVisitedCells] = useState<{ x: number; y: number; step: number }[]>([]);
  const [pathCells, setPathCells] = useState<{ x: number; y: number }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PathResult | null>(null);
  const [comparison, setComparison] = useState<{ algo: AlgorithmType; result: PathResult }[] | null>(null);

  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDrawing = useRef(false);
  const lastDrawn = useRef<string>('');

  // Stop any running animation
  const stopAnim = useCallback(() => {
    if (animRef.current) clearTimeout(animRef.current);
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    stopAnim();
    setVisitedCells([]);
    setPathCells([]);
    setResult(null);
    setComparison(null);
  }, [stopAnim]);

  const clearWalls = useCallback(() => {
    reset();
    setCells((prev) => {
      const next = prev.map((row) => row.map((c) => (c === 'wall' ? 'empty' : c)));
      return next;
    });
  }, [reset]);

  const generateMaze = useCallback(() => {
    reset();
    const c = makeEmptyCells();
    c[startPos.y][startPos.x] = 'start';
    c[goalPos.y][goalPos.x] = 'goal';
    // Simple random wall maze
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (c[y][x] !== 'empty') continue;
        if (Math.random() < 0.28) c[y][x] = 'wall';
      }
    }
    setCells(c);
  }, [reset, startPos, goalPos]);

  const runVisualization = useCallback(() => {
    reset();
    const grid = buildGrid(cells);
    const res = runAlgorithm(selectedAlgo, grid, startPos.x, startPos.y, goalPos.x, goalPos.y);
    setResult(res);

    const expansion = res.expansionOrder;
    const path = res.path;

    let step = 0;
    setIsRunning(true);

    const tick = () => {
      if (step < expansion.length) {
        setVisitedCells(expansion.slice(0, step + 1));
        step++;
        animRef.current = setTimeout(tick, animSpeed);
      } else {
        // Show final path
        setPathCells(path);
        setIsRunning(false);
      }
    };
    animRef.current = setTimeout(tick, animSpeed);
  }, [cells, selectedAlgo, startPos, goalPos, animSpeed, reset]);

  const runComparison = useCallback(async () => {
    reset();
    setIsRunning(true);
    const results: { algo: AlgorithmType; result: PathResult }[] = [];
    
    for (const algo of ALL_ALGOS) {
      // Yield to the main thread before running each algorithm
      await new Promise(resolve => setTimeout(resolve, 10));
      const grid = buildGrid(cells);
      const res = runAlgorithm(algo, grid, startPos.x, startPos.y, goalPos.x, goalPos.y);
      results.push({ algo, result: res });
    }
    
    setComparison(results);
    setIsRunning(false);
  }, [cells, startPos, goalPos, reset]);

  // Cell interaction
  const applyDraw = useCallback((x: number, y: number) => {
    const key = `${x},${y}`;
    if (lastDrawn.current === key) return;
    lastDrawn.current = key;
    reset();
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      if (drawMode === 'start') {
        next[startPos.y][startPos.x] = 'empty';
        next[y][x] = 'start';
        setStartPos({ x, y });
      } else if (drawMode === 'goal') {
        next[goalPos.y][goalPos.x] = 'empty';
        next[y][x] = 'goal';
        setGoalPos({ x, y });
      } else if (drawMode === 'wall') {
        if (next[y][x] === 'empty') next[y][x] = 'wall';
      } else {
        if (next[y][x] === 'wall') next[y][x] = 'empty';
      }
      return next;
    });
  }, [drawMode, startPos, goalPos, reset]);

  const getCellColor = useCallback((x: number, y: number, cell: CellState): string => {
    if (cell === 'start') return '#44ff88';
    if (cell === 'goal') return '#ff4466';
    if (cell === 'wall') return '#2a2a3a';
    const onPath = pathCells.some((p) => p.x === x && p.y === y);
    if (onPath) return ALGO_CSS_COLORS[selectedAlgo];
    const visited = visitedCells.find((v) => v.x === x && v.y === y);
    if (visited) return `${ALGO_CSS_COLORS[selectedAlgo]}44`;
    return '#14141e';
  }, [pathCells, visitedCells, selectedAlgo]);

  const algoInfo = getAlgorithmInfo(selectedAlgo);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-void)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <button className="btn btn-pixel" style={{ fontSize: '0.6rem', padding: '6px 14px' }} onClick={() => setScreen('mainMenu')}>← Back</button>
        <h1 className="fantasy-font gold-text" style={{ fontSize: '1.4rem', margin: 0 }}>🧪 Algorithm Lab</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Draw walls · Place start/goal · Watch algorithms find the path</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {(['sandbox', 'graphs'] as LabView[]).map((view) => (
            <button
              key={view}
              className="btn btn-pixel"
              onClick={() => setLabView(view)}
              style={{
                fontSize: '0.58rem',
                padding: '6px 12px',
                borderColor: labView === view ? 'var(--gold)' : 'var(--border-subtle)',
                color: labView === view ? 'var(--gold)' : 'var(--text-secondary)',
              }}
            >
              {view === 'sandbox' ? 'Sandbox' : 'Enemy Graphs'}
            </button>
          ))}
        </div>
      </div>

      {labView === 'graphs' ? (
        <LabEnemyGraphs
          proofHistory={iterationProofHistory}
          enemyAnalytics={enemyAnalytics}
          population={population}
          generation={generation}
          graphType={graphType}
          selectedMetric={selectedMetric}
          onGraphTypeChange={setGraphType}
          onMetricChange={setSelectedMetric}
        />
      ) : (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Controls */}
        <div style={{ width: 260, borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>

          {/* Draw Mode */}
          <div>
            <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--purple-light)', marginBottom: 8 }}>DRAW MODE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['wall', 'erase', 'start', 'goal'] as DrawMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDrawMode(mode)}
                  style={{
                    padding: '7px 4px', fontSize: '0.65rem', border: `2px solid ${drawMode === mode ? 'var(--gold)' : 'var(--border-subtle)'}`,
                    background: drawMode === mode ? 'rgba(200,168,80,0.15)' : 'var(--bg-card)',
                    color: drawMode === mode ? 'var(--gold)' : 'var(--text-secondary)',
                    borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 150ms',
                  }}
                >
                  {mode === 'wall' ? '🧱 Wall' : mode === 'erase' ? '🧹 Erase' : mode === 'start' ? '🟢 Start' : '🔴 Goal'}
                </button>
              ))}
            </div>
          </div>

          {/* Algorithm */}
          <div>
            <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--purple-light)', marginBottom: 8 }}>ALGORITHM</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ALL_ALGOS.map((algo) => {
                const info = getAlgorithmInfo(algo);
                const color = ALGO_CSS_COLORS[algo];
                return (
                  <button
                    key={algo}
                    onClick={() => { setSelectedAlgo(algo); reset(); }}
                    style={{
                      padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8,
                      border: `2px solid ${selectedAlgo === algo ? color : 'var(--border-subtle)'}`,
                      background: selectedAlgo === algo ? `${color}18` : 'var(--bg-card)',
                      color: selectedAlgo === algo ? color : 'var(--text-secondary)',
                      borderRadius: 4, cursor: 'pointer', textAlign: 'left', fontSize: '0.7rem', transition: 'all 150ms',
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {info.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed */}
          <div>
            <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--purple-light)', marginBottom: 8 }}>
              SPEED — {animSpeed}ms/step
            </div>
            <input
              type="range" min={5} max={200} step={5} value={animSpeed}
              onChange={(e) => setAnimSpeed(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--gold)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
              <span>Fast</span><span>Slow</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              className="btn btn-pixel"
              onClick={runVisualization}
              disabled={isRunning}
              style={{ fontSize: '0.65rem', padding: '10px', background: isRunning ? 'rgba(200,168,80,0.05)' : undefined }}
            >
              {isRunning ? '⏳ Running...' : '▶ Run'}
            </button>
            {isRunning && (
              <button className="btn btn-pixel" onClick={stopAnim} style={{ fontSize: '0.65rem', padding: '8px' }}>
                ⏹ Stop
              </button>
            )}
            <button className="btn btn-pixel" onClick={reset} style={{ fontSize: '0.65rem', padding: '8px' }}>
              🔄 Reset Viz
            </button>
            <button className="btn btn-pixel" onClick={clearWalls} style={{ fontSize: '0.65rem', padding: '8px' }}>
              🧹 Clear Walls
            </button>
            <button className="btn btn-pixel" onClick={generateMaze} style={{ fontSize: '0.65rem', padding: '8px' }}>
              🎲 Random Maze
            </button>
            <button className="btn btn-pixel" onClick={runComparison} style={{ fontSize: '0.65rem', padding: '8px', borderColor: 'var(--purple-dark)', color: 'var(--purple-light)' }}>
              📊 Compare All
            </button>
          </div>

          {/* Result Stats */}
          {result && !comparison && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--gold)', marginBottom: 8 }}>RESULT</div>
              {[
                ['Status', result.success ? '✅ Found' : '❌ No Path'],
                ['Path Length', result.path.length > 0 ? `${result.path.length} tiles` : '—'],
                ['Nodes Expanded', result.nodesExpanded],
                ['Time', `${result.timeMs.toFixed(2)}ms`],
              ].map(([label, val]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.7rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Algo info */}
          <div style={{ background: 'var(--bg-card)', border: `1px solid ${ALGO_CSS_COLORS[selectedAlgo]}44`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: ALGO_CSS_COLORS[selectedAlgo], marginBottom: 6 }}>{algoInfo.name}</div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{algoInfo.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[
                ['Time', algoInfo.timeComplexity],
                ['Space', algoInfo.spaceComplexity],
                ['Optimal', algoInfo.optimal ? '✅' : '❌'],
                ['Complete', algoInfo.complete ? '✅' : '❌'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg-void)', borderRadius: 4, padding: '3px 7px', fontSize: '0.6rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-pixel2)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 16 }}>
          {comparison ? (
            // Comparison table
            <div style={{ width: '100%', maxWidth: 900 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="fantasy-font" style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>Algorithm Comparison</h2>
                <button className="btn btn-pixel" onClick={() => setComparison(null)} style={{ fontSize: '0.6rem', padding: '6px 14px' }}>← Back to Grid</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {comparison.map(({ algo, result: r }) => {
                  const info = getAlgorithmInfo(algo);
                  const color = ALGO_CSS_COLORS[algo];
                  return (
                    <div key={algo} style={{ background: 'var(--bg-card)', border: `2px solid ${color}55`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color }}>{info.name}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {[
                          ['Found', r.success ? '✅ Yes' : '❌ No'],
                          ['Path', r.path.length > 0 ? `${r.path.length}t` : '—'],
                          ['Nodes', r.nodesExpanded],
                          ['Time', `${r.timeMs.toFixed(2)}ms`],
                          ['Optimal', info.optimal ? '✅' : '❌'],
                          ['Complete', info.complete ? '✅' : '❌'],
                        ].map(([lbl, val]) => (
                          <div key={String(lbl)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => { setComparison(null); setSelectedAlgo(algo); setTimeout(runVisualization, 50); }}
                        style={{ marginTop: 10, width: '100%', padding: '5px', fontSize: '0.6rem', border: `1px solid ${color}`, background: `${color}18`, color, borderRadius: 4, cursor: 'pointer' }}
                      >
                        Visualize →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Grid
            <div>
              <div style={{ marginBottom: 8, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { color: '#44ff88', label: 'Start' },
                  { color: '#ff4466', label: 'Goal' },
                  { color: '#2a2a3a', label: 'Wall' },
                  { color: `${ALGO_CSS_COLORS[selectedAlgo]}44`, label: 'Visited' },
                  { color: ALGO_CSS_COLORS[selectedAlgo], label: 'Path' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: 'inline-block' }} />
                    {label}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
                  gap: 1,
                  background: 'var(--border-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  userSelect: 'none',
                  cursor: 'crosshair',
                }}
                onMouseLeave={() => { isDrawing.current = false; lastDrawn.current = ''; }}
              >
                {cells.map((row, y) =>
                  row.map((cell, x) => {
                    const bg = getCellColor(x, y, cell);
                    return (
                      <div
                        key={`${x}-${y}`}
                        style={{
                          width: CELL, height: CELL,
                          background: bg,
                          transition: 'background 80ms',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: cell === 'start' ? 12 : cell === 'goal' ? 12 : 0,
                        }}
                        onMouseDown={() => { isDrawing.current = true; applyDraw(x, y); }}
                        onMouseUp={() => { isDrawing.current = false; lastDrawn.current = ''; }}
                        onMouseEnter={() => { if (isDrawing.current) applyDraw(x, y); }}
                      >
                        {cell === 'start' ? '▶' : cell === 'goal' ? '★' : ''}
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                {COLS} × {ROWS} grid · Click or drag to draw · {visitedCells.length > 0 && `${visitedCells.length} nodes explored`}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
