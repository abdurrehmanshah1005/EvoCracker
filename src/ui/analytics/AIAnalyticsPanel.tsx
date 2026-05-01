import { useGameStore, type EnemyAnalyticsData, type IterationProofData } from '@store/gameStore';
import { AlgorithmType, ALGORITHM_COLORS } from '@utils/constants';
import { getAlgorithmInfo } from '@ai/pathfinding/AlgorithmRegistry';
import type { Genome, GenerationStats, PlayerProfile } from '@ai/evolution/GeneticAlgorithm';

const TABS = ['Live AI', 'Genomes', 'Evolution', 'Player', 'Pathfinding', 'Performance'];
const GENE_LABELS: Record<string, string> = {
  speed: 'Speed',
  vision: 'Vision',
  aggression: 'Aggression',
  persistence: 'Persistence',
  cautiousness: 'Caution',
  packTendency: 'Pack',
  ambushTendency: 'Ambush',
  patrolVariance: 'Patrol',
};

export function AIAnalyticsPanel() {
  const {
    analyticsTab,
    setAnalyticsTab,
    toggleAnalytics,
    enemyAnalytics,
    fps,
    generation,
    population,
    generationHistory,
    iterationProofHistory,
    autoShowIterationGraphs,
    toggleAutoShowIterationGraphs,
    playerProfile,
    playerRuns,
    currentDifficulty,
    iteration,
    showPaths,
    showFOV,
    showGrid,
    toggleShowPaths,
    toggleShowFOV,
    toggleShowGrid,
  } = useGameStore();

  return (
    <div className="analytics-panel">
      {/* Header */}
      <div className="analytics-header">
        <span className="analytics-title">🧠 AI ANALYTICS</span>
        <button
          className="btn"
          style={{ padding: '4px 12px', fontSize: '0.7rem' }}
          onClick={toggleAnalytics}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="analytics-tabs">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`analytics-tab ${analyticsTab === i ? 'active' : ''}`}
            onClick={() => setAnalyticsTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="analytics-content">
        {analyticsTab === 0 && <AlgorithmMonitorTab enemyAnalytics={enemyAnalytics} />}
        {analyticsTab === 1 && <GenomeInspectorTab population={population} />}
        {analyticsTab === 2 && (
          <EvolutionDashboardTab
            history={generationHistory}
            proofHistory={iterationProofHistory}
            generation={generation}
            autoShowIterationGraphs={autoShowIterationGraphs}
            onToggleAutoShow={toggleAutoShowIterationGraphs}
          />
        )}
        {analyticsTab === 3 && <PlayerProfileTab profile={playerProfile} />}
        {analyticsTab === 4 && (
          <PathfindingTab
            enemyAnalytics={enemyAnalytics}
            showPaths={showPaths}
            showFOV={showFOV}
            showGrid={showGrid}
            toggleShowPaths={toggleShowPaths}
            toggleShowFOV={toggleShowFOV}
            toggleShowGrid={toggleShowGrid}
          />
        )}
        {analyticsTab === 5 && (
          <PerformanceTab
            fps={fps}
            enemyCount={enemyAnalytics.length}
            currentDifficulty={currentDifficulty}
            runsStored={playerRuns.length}
            iteration={iteration}
            enemyAnalytics={enemyAnalytics}
          />
        )}
      </div>
    </div>
  );
}

function formatDelta(value: number, digits = 1): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function MiniBarChart({
  values,
  labels,
  color = 'var(--purple)',
  height = 72,
  valueFormatter = (value: number) => value.toFixed(1),
}: {
  values: number[];
  labels?: string[];
  color?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="mini-chart" style={{ height }}>
      {values.map((value, i) => {
        const barHeight = Math.max(4, (value / max) * 100);
        return (
          <div
            key={`${labels?.[i] ?? i}-${i}`}
            className="mini-chart-bar"
            style={{ height: `${barHeight}%`, background: color }}
            title={`${labels?.[i] ?? i + 1}: ${valueFormatter(value)}`}
          />
        );
      })}
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`metric-pill ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// --- Tab: Algorithm Monitor ---
function AlgorithmMonitorTab({ enemyAnalytics }: { enemyAnalytics: EnemyAnalyticsData[] }) {
  const allAlgos = Object.values(AlgorithmType);
  const avgGeneration = average(enemyAnalytics.map((enemy) => enemy.generation));
  const avgSpeed = average(enemyAnalytics.map((enemy) => enemy.speed));
  const avgVision = average(enemyAnalytics.map((enemy) => enemy.visionRange));
  const avgDamage = average(enemyAnalytics.map((enemy) => enemy.attackDamage));
  const avgFitness = average(enemyAnalytics.map((enemy) => enemy.fitness));
  const totalDetections = enemyAnalytics.reduce((sum, enemy) => sum + enemy.playerDetections, 0);
  const totalDamage = enemyAnalytics.reduce((sum, enemy) => sum + enemy.damageDealt, 0);
  const runtimeByAlgorithm = allAlgos.map((algo) => {
    const samples = enemyAnalytics.filter((enemy) => enemy.algorithm === algo);
    const avgPathTime = samples.length
      ? samples.reduce((sum, enemy) => sum + enemy.pathComputeTimeMs, 0) / samples.length
      : 0;
    const avgNodes = samples.length
      ? samples.reduce((sum, enemy) => sum + enemy.nodesExpanded, 0) / samples.length
      : 0;
    return { algo, samples: samples.length, avgPathTime, avgNodes };
  });

  return (
    <>
      <div className="analytics-section">
        <div className="analytics-section-title">Live Enemy Generations</div>
        <div className="metric-grid">
          <MetricPill label="Active" value={enemyAnalytics.length.toString()} />
          <MetricPill label="Avg Gen" value={avgGeneration.toFixed(1)} />
          <MetricPill label="Avg Speed" value={avgSpeed.toFixed(2)} />
          <MetricPill label="Avg Vision" value={avgVision.toFixed(1)} />
          <MetricPill label="Avg Damage" value={avgDamage.toFixed(1)} />
          <MetricPill label="Avg Fitness" value={avgFitness.toFixed(1)} />
          <MetricPill label="Detections" value={totalDetections.toFixed(0)} tone={totalDetections > 0 ? 'warn' : undefined} />
          <MetricPill label="Damage Done" value={totalDamage.toFixed(0)} tone={totalDamage > 0 ? 'bad' : undefined} />
        </div>
      </div>

      {enemyAnalytics.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Gene Averages</div>
          <GenomeBar label="Speed" value={average(enemyAnalytics.map((enemy) => enemy.speedGene))} color="var(--cyan)" />
          <GenomeBar label="Vision" value={average(enemyAnalytics.map((enemy) => enemy.visionGene))} color="var(--blue)" />
          <GenomeBar label="Aggression" value={average(enemyAnalytics.map((enemy) => enemy.aggressionGene))} color="var(--red)" />
          <GenomeBar label="Persistence" value={average(enemyAnalytics.map((enemy) => enemy.persistenceGene))} color="var(--orange)" />
          <GenomeBar label="Caution" value={average(enemyAnalytics.map((enemy) => enemy.cautiousnessGene))} color="var(--yellow)" />
          <GenomeBar label="Pack" value={average(enemyAnalytics.map((enemy) => enemy.packTendencyGene))} color="var(--purple)" />
          <GenomeBar label="Ambush" value={average(enemyAnalytics.map((enemy) => enemy.ambushTendencyGene))} color="var(--green)" />
        </div>
      )}

      <div className="analytics-section">
        <div className="analytics-section-title">Algorithm Reference</div>
        {allAlgos.map((algo) => {
          const info = getAlgorithmInfo(algo);
          const color = ALGORITHM_COLORS[algo];
          const hexColor = '#' + color.toString(16).padStart(6, '0');

          return (
            <div key={algo} className="enemy-card">
              <div className="enemy-card-header">
                <span className="enemy-card-name">{info.enemy}</span>
                <span
                  className="enemy-card-algo"
                  style={{ background: hexColor + '30', color: hexColor, border: `1px solid ${hexColor}50` }}
                >
                  {info.name}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {info.description}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.65rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Time: <span style={{ color: 'var(--cyan)' }}>{info.timeComplexity}</span>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Space: <span style={{ color: 'var(--cyan)' }}>{info.spaceComplexity}</span>
                </span>
                <span style={{ color: info.optimal ? 'var(--green)' : 'var(--red)' }}>
                  {info.optimal ? '✓ Optimal' : '✗ Suboptimal'}
                </span>
                <span style={{ color: info.complete ? 'var(--green)' : 'var(--red)' }}>
                  {info.complete ? '✓ Complete' : '✗ Incomplete'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {enemyAnalytics.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Runtime Comparison</div>
          {runtimeByAlgorithm.map(({ algo, samples, avgPathTime, avgNodes }) => {
            const color = '#' + ALGORITHM_COLORS[algo].toString(16).padStart(6, '0');
            return (
              <div key={algo} className="analytics-stat">
                <span className="analytics-stat-label" style={{ color }}>{algo}</span>
                <span className="analytics-stat-value">
                  {samples > 0 ? `${avgPathTime.toFixed(2)}ms / ${avgNodes.toFixed(0)} nodes` : 'no samples'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {enemyAnalytics.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Active Enemies ({enemyAnalytics.length})</div>
          {enemyAnalytics.map((enemy) => (
            <div key={enemy.entityId} className="enemy-card">
              <div className="enemy-card-header">
                <span className="enemy-card-name">{enemy.enemyType} G{enemy.generation}</span>
                <span className="enemy-card-algo">{enemy.algorithm}</span>
              </div>
              <div className="metric-grid compact">
                <MetricPill label="HP" value={`${enemy.health}/${enemy.maxHealth}`} />
                <MetricPill label="Speed" value={enemy.speed.toFixed(2)} />
                <MetricPill label="Vision" value={enemy.visionRange.toFixed(1)} />
                <MetricPill label="Dmg" value={enemy.attackDamage.toFixed(0)} />
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Alert</span>
                <span className="analytics-stat-value">{enemy.alertState}</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Nodes Expanded</span>
                <span className="analytics-stat-value">{enemy.nodesExpanded}</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Path Time</span>
                <span className="analytics-stat-value">{enemy.pathComputeTimeMs.toFixed(2)}ms</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Path Progress</span>
                <span className="analytics-stat-value">
                  {enemy.pathIndex}/{enemy.pathLength} ({(enemy.pathProgress * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Combat Metrics</span>
                <span className="analytics-stat-value">
                  {enemy.playerDetections} det / {enemy.damageDealt.toFixed(0)} dmg / {enemy.areaCovered} tiles
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// --- Tab: Genome Inspector ---
function GenomeInspectorTab({ population }: { population: Genome[] }) {
  if (population.length === 0) {
    return (
      <div className="analytics-section">
        <div className="analytics-section-title">No Active Population</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Start Trial Mode to see the genetic population evolve.
        </p>
      </div>
    );
  }

  return (
    <div className="analytics-section">
      <div className="analytics-section-title">Population ({population.length})</div>
      {population.slice(0, 10).map((genome) => (
        <div key={genome.id} className="enemy-card">
          <div className="enemy-card-header">
            <span className="enemy-card-name">Gen {genome.generation}</span>
            <span className="analytics-stat-value" style={{ color: 'var(--gold)' }}>
              Fitness: {genome.fitness.toFixed(1)}
            </span>
          </div>
          <GenomeBar label="Speed" value={genome.speed} color="var(--cyan)" />
          <GenomeBar label="Vision" value={genome.vision} color="var(--blue)" />
          <GenomeBar label="Aggression" value={genome.aggression} color="var(--red)" />
          <GenomeBar label="Persistence" value={genome.persistence} color="var(--orange)" />
          <GenomeBar label="Cautiousness" value={genome.cautiousness} color="var(--yellow)" />
          <GenomeBar label="Pack" value={genome.packTendency} color="var(--purple)" />
          {genome.mutations.length > 0 && (
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Mutations: {genome.mutations.slice(0, 3).join(', ')}
              {genome.mutations.length > 3 && ` +${genome.mutations.length - 3} more`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GenomeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="genome-bar">
      <span className="genome-bar-label">{label}</span>
      <div className="genome-bar-track">
        <div
          className="genome-bar-fill"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="genome-bar-value">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

// --- Tab: Evolution Dashboard ---
function EvolutionDashboardTab({
  history,
  proofHistory,
  generation,
  autoShowIterationGraphs,
  onToggleAutoShow,
}: {
  history: GenerationStats[];
  proofHistory: IterationProofData[];
  generation: number;
  autoShowIterationGraphs: boolean;
  onToggleAutoShow: () => void;
}) {
  const latest = history[history.length - 1];
  const latestProof = proofHistory[proofHistory.length - 1];
  const strengthValues = proofHistory.map((proof) => proof.afterStrengthIndex);
  const strengthLabels = proofHistory.map((proof) => `Iter ${proof.iteration}`);
  const avgFitnessValues = proofHistory.map((proof) => proof.roundAvgFitness);
  const pathValues = proofHistory.map((proof) => proof.avgPathTimeMs);

  return (
    <>
      <div className="analytics-section">
        <div className="analytics-section-title">Evolution Progress</div>
        <label className="analytics-toggle-row">
          <span>Show graphs after each iteration</span>
          <input type="checkbox" checked={autoShowIterationGraphs} onChange={onToggleAutoShow} />
        </label>
        <div className="analytics-stat">
          <span className="analytics-stat-label">Current Generation</span>
          <span className="analytics-stat-value" style={{ color: 'var(--gold)' }}>{generation}</span>
        </div>

        {latest ? (
          <>
            <div className="metric-grid">
              <MetricPill label="Avg Fitness" value={latest.avgFitness.toFixed(2)} />
              <MetricPill label="Max Fitness" value={latest.maxFitness.toFixed(2)} tone="good" />
              <MetricPill label="Min Fitness" value={latest.minFitness.toFixed(2)} tone="bad" />
              <MetricPill label="Median" value={latest.medianFitness.toFixed(2)} />
              <MetricPill label="Diversity" value={latest.diversityIndex.toFixed(3)} />
              <MetricPill label="Mutations" value={latest.totalMutations.toString()} />
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat-label">Dominant Algorithm</span>
              <span className="analytics-stat-value" style={{ color: 'var(--purple-light)' }}>{latest.dominantAlgorithm}</span>
            </div>
          </>
        ) : (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Complete a floor to see evolution data.
          </p>
        )}
      </div>

      {latestProof && (
        <div className="analytics-section">
          <div className="analytics-section-title">Latest Iteration Proof</div>
          <div className="metric-grid">
            <MetricPill label="Iteration" value={latestProof.iteration.toString()} />
            <MetricPill label="Gen" value={`${latestProof.generationBefore}->${latestProof.generationAfter}`} />
            <MetricPill
              label="Strength"
              value={`${latestProof.beforeStrengthIndex.toFixed(1)}->${latestProof.afterStrengthIndex.toFixed(1)}`}
              tone={latestProof.afterStrengthIndex >= latestProof.beforeStrengthIndex ? 'good' : 'warn'}
            />
            <MetricPill
              label="Delta"
              value={formatDelta(latestProof.afterStrengthIndex - latestProof.beforeStrengthIndex)}
              tone={latestProof.afterStrengthIndex >= latestProof.beforeStrengthIndex ? 'good' : 'warn'}
            />
            <MetricPill label="Difficulty" value={`x${latestProof.difficultyBefore.toFixed(2)}->x${latestProof.difficultyAfter.toFixed(2)}`} />
            <MetricPill label="Playstyle" value={latestProof.playstyle} />
          </div>

          <div className="analytics-section-title" style={{ marginTop: '14px' }}>Before vs Evolved Genes</div>
          {Object.keys(GENE_LABELS).map((gene) => {
            const before = latestProof.beforeGenes[gene] ?? 0;
            const after = latestProof.afterGenes[gene] ?? 0;
            const delta = after - before;
            return (
              <div key={gene} className="gene-delta-row">
                <span>{GENE_LABELS[gene]}</span>
                <div className="gene-delta-bars">
                  <div className="gene-delta-track before">
                    <div style={{ width: `${before * 100}%` }} />
                  </div>
                  <div className="gene-delta-track after">
                    <div style={{ width: `${after * 100}%` }} />
                  </div>
                </div>
                <strong className={delta >= 0 ? 'positive' : 'negative'}>{formatDelta(delta, 2)}</strong>
              </div>
            );
          })}
        </div>
      )}

      {proofHistory.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">After Each Iteration</div>
          <div className="chart-caption">Enemy Strength Index</div>
          <MiniBarChart values={strengthValues} labels={strengthLabels} color="var(--green)" />
          <div className="chart-caption">Round Fitness</div>
          <MiniBarChart values={avgFitnessValues} labels={strengthLabels} color="var(--gold)" />
          <div className="chart-caption">Pathfinding Time</div>
          <MiniBarChart values={pathValues} labels={strengthLabels} color="var(--cyan)" valueFormatter={(value) => `${value.toFixed(2)}ms`} />
        </div>
      )}

      {proofHistory.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Iteration Records</div>
          {proofHistory.slice(-6).reverse().map((proof) => (
            <div key={`${proof.iteration}-${proof.timestamp}`} className="enemy-card">
              <div className="enemy-card-header">
                <span className="enemy-card-name">Iteration {proof.iteration}</span>
                <span className="enemy-card-algo">Gen {proof.generationAfter}</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Strength Increase</span>
                <span className="analytics-stat-value" style={{ color: 'var(--green)' }}>
                  {formatDelta(proof.afterStrengthIndex - proof.beforeStrengthIndex)}
                </span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Avg / Max Fitness</span>
                <span className="analytics-stat-value">{proof.roundAvgFitness.toFixed(1)} / {proof.roundMaxFitness.toFixed(1)}</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Pathfinding</span>
                <span className="analytics-stat-value">{proof.avgPathTimeMs.toFixed(2)}ms / {proof.avgNodesExpanded.toFixed(0)} nodes</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Enemy Metrics</span>
                <span className="analytics-stat-value">{proof.avgDetections.toFixed(1)} det / {proof.avgDamageDealt.toFixed(1)} dmg</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 1 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Generation Fitness</div>
          <MiniBarChart
            values={history.map((gen) => gen.avgFitness)}
            labels={history.map((gen) => `Gen ${gen.generation}`)}
            color="var(--purple)"
          />
        </div>
      )}
    </>
  );
}

// --- Tab: Player Profile ---
function PlayerProfileTab({ profile }: { profile: PlayerProfile | null }) {
  if (!profile) {
    return (
      <div className="analytics-section">
        <div className="analytics-section-title">Player Profile</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Play to build your profile. The AI watches your every move...
        </p>
      </div>
    );
  }

  return (
    <div className="analytics-section">
      <div className="analytics-section-title">Player Profile</div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Playstyle</span>
        <span className="analytics-stat-value" style={{ color: 'var(--gold)', textTransform: 'uppercase' }}>
          {profile.playstyle}
        </span>
      </div>
      <GenomeBar label="Speed" value={profile.averageSpeed} color="var(--cyan)" />
      <GenomeBar label="Stealth" value={profile.stealthToRushRatio} color="var(--purple)" />
      <GenomeBar label="Exploration" value={profile.explorationRate} color="var(--green)" />
      <GenomeBar label="Combat" value={profile.engagementRate} color="var(--red)" />
      <div className="analytics-stat">
        <span className="analytics-stat-label">Tiles Explored</span>
        <span className="analytics-stat-value">{profile.tilesExplored}/{profile.totalTiles}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Dominant Zone</span>
        <span className="analytics-stat-value">{profile.cleanedTelemetry.dominantZone}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Raw Key Events</span>
        <span className="analytics-stat-value">{profile.rawKeystrokes.length}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Movement Samples</span>
        <span className="analytics-stat-value">{profile.movementCoordinates.length}</span>
      </div>
    </div>
  );
}

// --- Tab: Pathfinding ---
function PathfindingTab({
  enemyAnalytics,
  showPaths,
  showFOV,
  showGrid,
  toggleShowPaths,
  toggleShowFOV,
  toggleShowGrid,
}: {
  enemyAnalytics: EnemyAnalyticsData[];
  showPaths: boolean;
  showFOV: boolean;
  showGrid: boolean;
  toggleShowPaths: () => void;
  toggleShowFOV: () => void;
  toggleShowGrid: () => void;
}) {
  const activePaths = enemyAnalytics.filter((enemy) => enemy.pathLength > 0);
  const pendingPaths = enemyAnalytics.filter((enemy) => enemy.pathRequestPending);
  const avgPathTime = average(enemyAnalytics.map((enemy) => enemy.pathComputeTimeMs));
  const avgNodes = average(enemyAnalytics.map((enemy) => enemy.nodesExpanded));
  const avgPathLength = average(activePaths.map((enemy) => enemy.pathLength));
  const allAlgos = Object.values(AlgorithmType);

  return (
    <>
      <div className="analytics-section">
        <div className="analytics-section-title">Pathfinding Controls</div>
        <label className="analytics-toggle-row">
          <span>Draw enemy paths</span>
          <input type="checkbox" checked={showPaths} onChange={toggleShowPaths} />
        </label>
        <label className="analytics-toggle-row">
          <span>Draw field of view</span>
          <input type="checkbox" checked={showFOV} onChange={toggleShowFOV} />
        </label>
        <label className="analytics-toggle-row">
          <span>Draw tile grid</span>
          <input type="checkbox" checked={showGrid} onChange={toggleShowGrid} />
        </label>
      </div>

      <div className="analytics-section">
        <div className="analytics-section-title">Route Metrics</div>
        <div className="metric-grid">
          <MetricPill label="Active Paths" value={activePaths.length.toString()} />
          <MetricPill label="Pending" value={pendingPaths.length.toString()} tone={pendingPaths.length > 0 ? 'warn' : undefined} />
          <MetricPill label="Avg Time" value={`${avgPathTime.toFixed(2)}ms`} />
          <MetricPill label="Avg Nodes" value={avgNodes.toFixed(0)} />
          <MetricPill label="Avg Length" value={avgPathLength.toFixed(1)} />
          <MetricPill label="Worker" value="Async" />
        </div>
      </div>

      <div className="analytics-section">
        <div className="analytics-section-title">Algorithm Load</div>
        {allAlgos.map((algo) => {
          const samples = enemyAnalytics.filter((enemy) => enemy.algorithm === algo);
          const color = '#' + ALGORITHM_COLORS[algo].toString(16).padStart(6, '0');
          return (
            <div key={algo} className="analytics-stat">
              <span className="analytics-stat-label" style={{ color }}>{algo}</span>
              <span className="analytics-stat-value">
                {samples.length} enemies / {average(samples.map((enemy) => enemy.nodesExpanded)).toFixed(0)} nodes
              </span>
            </div>
          );
        })}
      </div>

      {enemyAnalytics.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Enemy Routes</div>
          {enemyAnalytics.map((enemy) => (
            <div key={enemy.entityId} className="enemy-card">
              <div className="enemy-card-header">
                <span className="enemy-card-name">{enemy.enemyType} #{enemy.entityId}</span>
                <span className="enemy-card-algo">{enemy.pathRequestPending ? 'pending' : enemy.algorithm}</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Position to Target</span>
                <span className="analytics-stat-value">
                  {enemy.position.x},{enemy.position.y} to {enemy.target ? `${enemy.target.x},${enemy.target.y}` : 'none'}
                </span>
              </div>
              <div className="path-progress-track">
                <div style={{ width: `${enemy.pathProgress * 100}%` }} />
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Path</span>
                <span className="analytics-stat-value">{enemy.pathIndex}/{enemy.pathLength} tiles</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-label">Search Cost</span>
                <span className="analytics-stat-value">{enemy.pathComputeTimeMs.toFixed(2)}ms / {enemy.nodesExpanded} nodes</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// --- Tab: Performance ---
function PerformanceTab({
  fps,
  enemyCount,
  currentDifficulty,
  runsStored,
  iteration,
  enemyAnalytics,
}: {
  fps: number;
  enemyCount: number;
  currentDifficulty: number;
  runsStored: number;
  iteration: number;
  enemyAnalytics: EnemyAnalyticsData[];
}) {
  const avgSurvival = average(enemyAnalytics.map((enemy) => enemy.survivalTime));
  const avgArea = average(enemyAnalytics.map((enemy) => enemy.areaCovered));
  const totalPathTime = enemyAnalytics.reduce((sum, enemy) => sum + enemy.pathComputeTimeMs, 0);
  const totalNodes = enemyAnalytics.reduce((sum, enemy) => sum + enemy.nodesExpanded, 0);

  return (
    <div className="analytics-section">
      <div className="analytics-section-title">Performance Metrics</div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">FPS</span>
        <span className="analytics-stat-value" style={{
          color: fps >= 55 ? 'var(--green)' : fps >= 30 ? 'var(--yellow)' : 'var(--red)',
        }}>
          {fps}
        </span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Active Enemies</span>
        <span className="analytics-stat-value">{enemyCount}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Iteration</span>
        <span className="analytics-stat-value">{iteration}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Adaptive Difficulty</span>
        <span className="analytics-stat-value">x{currentDifficulty.toFixed(2)}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Stored Strategy Runs</span>
        <span className="analytics-stat-value">{runsStored}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Renderer</span>
        <span className="analytics-stat-value">PixiJS v8 (WebGPU/WebGL)</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Pathfinding</span>
        <span className="analytics-stat-value">Async Worker</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Total Path Time</span>
        <span className="analytics-stat-value">{totalPathTime.toFixed(2)}ms</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Total Nodes Expanded</span>
        <span className="analytics-stat-value">{totalNodes}</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Avg Enemy Survival</span>
        <span className="analytics-stat-value">{avgSurvival.toFixed(1)}s</span>
      </div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Avg Area Covered</span>
        <span className="analytics-stat-value">{avgArea.toFixed(1)} tiles</span>
      </div>
    </div>
  );
}
