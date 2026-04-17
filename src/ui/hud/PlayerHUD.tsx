import { useGameStore } from '@store/gameStore';
import type { Item } from '@game/entities/items/ItemSystem';

interface PlayerHUDProps {
  items?: Item[];
}

export function PlayerHUD({ items = [] }: PlayerHUDProps) {
  const {
    playerHealth, playerMaxHealth, playerScore,
    currentFloor, currentBiome, fps,
    analyticsEnabled, generation, population,
  } = useGameStore();

  const healthPercent = (playerHealth / playerMaxHealth) * 100;
  const isLow = healthPercent < 30;

  return (
    <div className="hud">
      {/* Left side */}
      <div className="hud-left">
        {/* Health bar */}
        <div className="hud-bar">
          <span className="hud-bar-label" style={{ color: 'var(--red)' }}>HP</span>
          <div className="hud-bar-track">
            <div
              className={`hud-bar-fill health ${isLow ? 'low' : ''}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
          <span className="hud-bar-value">{playerHealth}/{playerMaxHealth}</span>
        </div>

        {/* Floor info */}
        <div className="hud-info">
          Floor <span className="value">{currentFloor}</span>
          &nbsp;—&nbsp;
          <span style={{ color: 'var(--purple-light)', textTransform: 'capitalize' }}>{currentBiome}</span>
        </div>

        {/* Score */}
        <div className="hud-info">
          Score: <span className="value">{playerScore.toLocaleString()}</span>
        </div>
      </div>

      {/* Center — Item hotbar */}
      {items.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 11,
        }}>
          {items.slice(0, 4).map((item, i) => {
            const ready = item.currentCooldown <= 0;
            const cdPercent = ready ? 0 : (item.currentCooldown / item.cooldown) * 100;

            return (
              <div
                key={item.id}
                title={`[${i + 1}] ${item.name}: ${item.description}`}
                style={{
                  width: '52px',
                  height: '52px',
                  background: ready ? 'var(--bg-card)' : 'var(--bg-void)',
                  border: `2px solid ${ready ? 'var(--gold)' : 'var(--text-muted)'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: ready ? 'pointer' : 'not-allowed',
                  opacity: ready ? 1 : 0.6,
                  transition: 'all 0.2s',
                  boxShadow: ready ? 'var(--shadow-gold)' : 'none',
                }}
              >
                {/* Cooldown overlay */}
                {!ready && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `conic-gradient(rgba(0,0,0,0.6) ${cdPercent * 3.6}deg, transparent 0deg)`,
                    borderRadius: '6px',
                    zIndex: 1,
                  }} />
                )}

                {/* Icon */}
                <span style={{ fontSize: '1.4rem', zIndex: 2 }}>{item.icon}</span>

                {/* Hotkey */}
                <span style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.4rem',
                  color: 'var(--text-muted)',
                  zIndex: 2,
                }}>
                  [{i + 1}]
                </span>

                {/* Cooldown timer */}
                {!ready && (
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '4px',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.4rem',
                    color: 'var(--gold)',
                    zIndex: 3,
                  }}>
                    {Math.ceil(item.currentCooldown)}s
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Right side */}
      <div className="hud-right">
        <div className="hud-info">
          FPS: <span className="value" style={{
            color: fps >= 55 ? 'var(--green)' : fps >= 30 ? 'var(--yellow)' : 'var(--red)',
          }}>{fps}</span>
        </div>

        <div className="hud-info">
          Gen <span className="value">{generation}</span> &nbsp;
          Pop <span className="value">{population.length}</span>
        </div>

        <div className="hud-info" style={{ opacity: 0.5, fontSize: '0.55rem' }}>
          {analyticsEnabled
            ? '[ AI OVERLAY ON ]'
            : '[ ` toggle AI ]'}
        </div>

        <div className="hud-info" style={{ opacity: 0.4, fontSize: '0.5rem' }}>
          WASD: Move &nbsp; 1-4: Items
        </div>
      </div>
    </div>
  );
}
