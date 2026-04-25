import { useGameStore } from '@store/gameStore';

export function SettingsScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const {
    showFOV,
    showGrid,
    showPaths,
    toggleShowFOV,
    toggleShowGrid,
    toggleShowPaths,
    debugMode,
    toggleDebug,
    resetLearning,
    generation,
    iteration,
    currentDifficulty,
    playerRuns,
  } = useGameStore();

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'var(--bg-void)',
      paddingTop: '64px',
      paddingBottom: '24px',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      <div className="settings-panel">
        <h1 className="fantasy-font gold-text glow-gold" style={{ fontSize: '2rem', marginBottom: '32px', textAlign: 'center' }}>
          ⚙️ Settings
        </h1>

        {/* AI Debug Settings */}
        <div className="settings-group">
          <div className="settings-group-title">AI Debug Overlays</div>

          <div className="settings-row">
            <span className="settings-label">Debug Mode</span>
            <div className={`toggle ${debugMode ? 'active' : ''}`} onClick={toggleDebug} />
          </div>

          <div className="settings-row">
            <span className="settings-label">Show FOV Cones</span>
            <div className={`toggle ${showFOV ? 'active' : ''}`} onClick={toggleShowFOV} />
          </div>

          <div className="settings-row">
            <span className="settings-label">Show Grid Weights</span>
            <div className={`toggle ${showGrid ? 'active' : ''}`} onClick={toggleShowGrid} />
          </div>

          <div className="settings-row">
            <span className="settings-label">Show Path Trails</span>
            <div className={`toggle ${showPaths ? 'active' : ''}`} onClick={toggleShowPaths} />
          </div>
        </div>

        {/* Genetic Algorithm Settings */}
        <div className="settings-group">
          <div className="settings-group-title">Genetic Algorithm</div>

          <div className="settings-row">
            <span className="settings-label">Current Iteration</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{iteration}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Current Generation</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{generation}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Adaptive Difficulty</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>x{currentDifficulty.toFixed(2)}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Stored Player Runs</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{playerRuns.length}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Population Size</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>20</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Mutation Rate</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>15%</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Elitism Rate</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>10%</span>
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">Learning Controls</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Reset player path history, strategy profile, learned enemy population, and adaptive difficulty.
          </div>
          <button
            className="btn"
            onClick={resetLearning}
            style={{ width: '100%', borderColor: 'var(--red)', color: 'var(--red)' }}
          >
            Reset AI Learning
          </button>
        </div>

        {/* Info */}
        <div className="settings-group">
          <div className="settings-group-title">About</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--gold)' }}>AlchEx: The Summoner's Trial</strong>
            <br />
            An AI research project demonstrating search algorithms,
            genetic evolution, and adaptive enemy behavior.
            <br /><br />
            Press <code style={{ color: 'var(--purple-light)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '3px' }}>` (backtick)</code> during gameplay
            to toggle the AI Analytics overlay.
          </div>
        </div>

        <button
          className="btn btn-pixel"
          onClick={() => setScreen('mainMenu')}
          style={{ width: '100%', marginTop: '16px' }}
        >
          ← Back to Menu
        </button>
      </div>
    </div>
  );
}
