import { useGameStore } from '@store/gameStore';

export function AlgorithmLabScreen() {
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      background: 'var(--bg-void)',
    }}>
      <h1 className="fantasy-font gold-text glow-gold" style={{ fontSize: '2.5rem' }}>
        🧪 Algorithm Lab
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '500px', textAlign: 'center' }}>
        A sandbox environment to observe, compare, and experiment with AI search algorithms.
        Select enemies, assign algorithms, and watch them work in real-time.
      </p>
      <p className="pixel-font" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
        Coming in Phase 5...
      </p>
      <button
        className="btn btn-pixel"
        onClick={() => setScreen('mainMenu')}
      >
        ← Back to Menu
      </button>
    </div>
  );
}
