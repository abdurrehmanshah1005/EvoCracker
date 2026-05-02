import { useGameStore } from '@store/gameStore';
import { AVAILABLE_MAPS } from '@ui/screens/MapSelectScreen';
import type { Item } from '@game/entities/items/ItemSystem';

interface PlayerHUDProps {
  items?: Item[];
  sprintEnergy?: number;
}

export function PlayerHUD({ items = [], sprintEnergy = 1 }: PlayerHUDProps) {
  const {
    playerHealth, playerMaxHealth, playerScore, coinCount,
    fps,
    analyticsEnabled, generation, population, currentDifficulty, iteration,
    selectedMap,
    activeAlly,
  } = useGameStore();

  const mapDef = AVAILABLE_MAPS.find((m) => m.id === selectedMap);
  const mapName = mapDef?.name ?? 'Unknown Battleground';

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

        <div className="hud-bar">
          <span className="hud-bar-label" style={{ color: 'var(--cyan)' }}>SP</span>
          <div className="hud-bar-track">
            <div
              className="hud-bar-fill sprint"
              style={{ width: `${Math.round(sprintEnergy * 100)}%` }}
            />
          </div>
          <span className="hud-bar-value">{Math.round(sprintEnergy * 100)}%</span>
        </div>

        {/* Battleground & Iteration info */}
        <div className="hud-info">
          <span style={{ color: 'var(--gold)' }}>{mapName}</span>
          &nbsp;—&nbsp;
          Itr <span className="value">{iteration}</span>
        </div>

        {/* Score */}
        <div className="hud-info">
          Score: <span className="value">{playerScore.toLocaleString()}</span>
        </div>

        <div className="hud-info">
          Coins: <span className="value">{coinCount.toLocaleString()}</span>
        </div>

        <div className="hud-info">
          Ally: <span className="value">{activeAlly ? activeAlly.toUpperCase() : 'NONE'}</span>
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

        <div className="hud-info">
          Iter <span className="value">{iteration}</span> &nbsp;
          Diff <span className="value" style={{ color: 'var(--orange)' }}>x{currentDifficulty.toFixed(2)}</span>
        </div>

        <div className="hud-info" style={{ opacity: 0.5, fontSize: '0.55rem' }}>
          {analyticsEnabled
            ? '[ AI OVERLAY ON ]'
            : '[ ` toggle AI ]'}
        </div>

        <div className="hud-info" style={{ opacity: 0.4, fontSize: '0.5rem', position: 'fixed', bottom: '0px', right: '0px', padding: '10px' }}>
          WASD: Move &nbsp; Shift: Sprint &nbsp; 1-4: Items
        </div>
      </div>
    </div>
  );
}
