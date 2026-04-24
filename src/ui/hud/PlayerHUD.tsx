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

        <div className="hud-info" style={{ opacity: 0.4, fontSize: '0.5rem', position: 'fixed', bottom: '0px', right: '0px', padding: '10px' }}>
          WASD: Move &nbsp; 1-4: Items
        </div>
      </div>
    </div>
  );
}
