// ========================
// Algorithm Lab — Interactive Pathfinding Sandbox
// Draw walls, place start/goal, pick an algorithm, watch it work
// ========================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@store/gameStore';
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

export function AlgorithmLabScreen() {
  const setScreen = useGameStore((s) => s.setScreen);

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

  const runComparison = useCallback(() => {
    reset();
    const results: { algo: AlgorithmType; result: PathResult }[] = [];
    for (const algo of ALL_ALGOS) {
      const grid = buildGrid(cells);
      const res = runAlgorithm(algo, grid, startPos.x, startPos.y, goalPos.x, goalPos.y);
      results.push({ algo, result: res });
    }
    setComparison(results);
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
      </div>

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
    </div>
  );
}
