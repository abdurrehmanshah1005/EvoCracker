import { useCallback } from 'react';
import { useGameStore } from '@store/gameStore';
import { CHARACTER_DEFS } from '@core/SpriteFactory';
import { getAllyDescription, getAllyRole, getCharacterAlgoLabel, MAX_SELECTED_ALLIES } from '@game/allies/AllyDefs';

export function AlliesSelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const selectedCharacter = useGameStore((s) => s.selectedCharacter);
  const unlockedAllies = useGameStore((s) => s.unlockedAllies);
  const selectedAllies = useGameStore((s) => s.selectedAllies);
  const toggleSelectedAlly = useGameStore((s) => s.toggleSelectedAlly);

  const availableAllies = unlockedAllies.filter((idx) => idx !== selectedCharacter);

  const handleBack = useCallback(() => {
    setScreen('characterSelect');
  }, [setScreen]);

  const handleStart = useCallback(() => {
    setScreen('playing');
  }, [setScreen]);

  return (
    <div className="character-select-screen">
      <div className="main-menu-bg" />

      <div className="character-select-content">
        <h1 className="character-select-title">Choose Allies</h1>
        <p className="character-select-subtitle">
          Pick up to {MAX_SELECTED_ALLIES}. Decoys distract enemies; fighters attack them.
        </p>

        <div className="character-grid">
          {availableAllies.map((index) => {
            const charDef = CHARACTER_DEFS[index];
            const isSelected = selectedAllies.includes(index);
            const disabled = !isSelected && selectedAllies.length >= MAX_SELECTED_ALLIES;
            const role = getAllyRole(index);

            return (
              <div
                key={charDef.key}
                className={`character-card ${isSelected ? 'character-card-selected' : ''}`}
                onClick={() => !disabled && toggleSelectedAlly(index)}
                style={{
                  '--char-color': charDef.color,
                  opacity: disabled ? 0.45 : 1,
                } as React.CSSProperties}
              >
                <div className="character-preview">
                  {charDef.icon ? (
                    <img
                      src={charDef.icon}
                      alt={charDef.name}
                      style={{ width: '50px', height: '50px', objectFit: 'contain', imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div
                      className="character-sprite"
                      style={{
                        width: 50,
                        height: 50,
                        backgroundImage: `url(${charDef.sheet})`,
                        backgroundPosition: '0px 0px',
                        backgroundSize: `${charDef.cols * (charDef.frameW || 64)}px ${charDef.frameH || 64}px`,
                        backgroundRepeat: 'no-repeat',
                        imageRendering: 'pixelated',
                      }}
                    />
                  )}
                </div>

                <div className="character-info">
                  <span className="character-name" style={{ color: charDef.color }}>
                    {charDef.name}{getCharacterAlgoLabel(index) ? ` (${getCharacterAlgoLabel(index)})` : ''}
                  </span>
                  <span className="character-desc">{role.toUpperCase()} - {getAllyDescription(index)}</span>
                </div>

                {isSelected && <div className="character-selected-badge">*</div>}
              </div>
            );
          })}
        </div>

        {availableAllies.length === 0 && (
          <p className="character-select-subtitle">No purchased allies available for this champion yet.</p>
        )}

        <div className="character-select-actions">
          <button className="btn btn-pixel" onClick={handleBack}>
            Back
          </button>
          <button className="btn btn-primary btn-pixel" onClick={handleStart}>
            Start Match
          </button>
        </div>
      </div>
    </div>
  );
}
