import { useGameStore, type EnemyAnalyticsData } from '@store/gameStore';
import { AlgorithmType, ALGORITHM_COLORS } from '@utils/constants';
import { getAlgorithmInfo } from '@ai/pathfinding/AlgorithmRegistry';
import type { Genome, GenerationStats, PlayerProfile } from '@ai/evolution/GeneticAlgorithm';

const TABS = ['Algorithms', 'Genomes', 'Evolution', 'Player', 'Performance'];

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
    playerProfile,
    playerRuns,
    currentDifficulty,
    iteration,
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
        {analyticsTab === 2 && <EvolutionDashboardTab history={generationHistory} generation={generation} />}
        {analyticsTab === 3 && <PlayerProfileTab profile={playerProfile} />}
        {analyticsTab === 4 && (
          <PerformanceTab
            fps={fps}
            enemyCount={enemyAnalytics.length}
            currentDifficulty={currentDifficulty}
            runsStored={playerRuns.length}
            iteration={iteration}
          />
        )}
      </div>
    </div>
  );
}

// --- Tab: Algorithm Monitor ---
function AlgorithmMonitorTab({ enemyAnalytics }: { enemyAnalytics: EnemyAnalyticsData[] }) {
  // Show all algorithm types with their info
  const allAlgos = Object.values(AlgorithmType);

  return (
    <>
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
          <div className="analytics-section-title">Active Enemies ({enemyAnalytics.length})</div>
          {enemyAnalytics.map((enemy) => (
            <div key={enemy.entityId} className="enemy-card">
              <div className="enemy-card-header">
                <span className="enemy-card-name">{enemy.enemyType}</span>
                <span className="enemy-card-algo">{enemy.algorithm}</span>
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
  generation,
}: {
  history: GenerationStats[];
  generation: number;
}) {
  const latest = history[history.length - 1];

  return (
    <div className="analytics-section">
      <div className="analytics-section-title">Evolution Progress</div>
      <div className="analytics-stat">
        <span className="analytics-stat-label">Current Generation</span>
        <span className="analytics-stat-value" style={{ color: 'var(--gold)' }}>{generation}</span>
      </div>

      {latest ? (
        <>
          <div className="analytics-stat">
            <span className="analytics-stat-label">Avg Fitness</span>
            <span className="analytics-stat-value">{latest.avgFitness.toFixed(2)}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-label">Max Fitness</span>
            <span className="analytics-stat-value" style={{ color: 'var(--green)' }}>{latest.maxFitness.toFixed(2)}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-label">Min Fitness</span>
            <span className="analytics-stat-value" style={{ color: 'var(--red)' }}>{latest.minFitness.toFixed(2)}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-label">Diversity Index</span>
            <span className="analytics-stat-value">{latest.diversityIndex.toFixed(3)}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-label">Dominant Algorithm</span>
            <span className="analytics-stat-value" style={{ color: 'var(--purple-light)' }}>{latest.dominantAlgorithm}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-label">Total Mutations</span>
            <span className="analytics-stat-value">{latest.totalMutations}</span>
          </div>

          {/* Fitness over generations mini chart */}
          {history.length > 1 && (
            <div style={{ marginTop: '16px' }}>
              <div className="analytics-section-title">Fitness Over Generations</div>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                height: '60px',
                padding: '4px 0',
              }}>
                {history.map((gen, i) => {
                  const maxAll = Math.max(...history.map((g) => g.maxFitness), 1);
                  const height = (gen.avgFitness / maxAll) * 100;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${height}%`,
                        background: 'var(--purple)',
                        borderRadius: '2px 2px 0 0',
                        minWidth: '4px',
                        opacity: 0.6 + (i / history.length) * 0.4,
                      }}
                      title={`Gen ${gen.generation}: avg=${gen.avgFitness.toFixed(1)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          Complete a floor to see evolution data.
        </p>
      )}
    </div>
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
    </div>
  );
}

// --- Tab: Performance ---
function PerformanceTab({
  fps,
  enemyCount,
  currentDifficulty,
  runsStored,
  iteration,
}: {
  fps: number;
  enemyCount: number;
  currentDifficulty: number;
  runsStored: number;
  iteration: number;
}) {
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
        <span className="analytics-stat-value">Main Thread</span>
      </div>
    </div>
  );
}
