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

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
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
            {proofHistory.length > 0 ? (
              <MiniMetricGraph
                type={graphType}
                values={graphValues}
                labels={graphLabels}
                color={selectedGraphMetric.color}
                height={230}
              />
            ) : (
              <div className="lab-empty-graph">
                Complete an iteration in-game to populate enemy improvement graphs.
              </div>
            )}
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

          {proofHistory.length > 0 && (
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
          )}
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
