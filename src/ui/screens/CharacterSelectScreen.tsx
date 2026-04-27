// ========================
// CharacterSelectScreen — Pick your character before entering the dungeon
// ========================

import { useCallback, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { CHARACTER_DEFS } from '@core/SpriteFactory';

export function CharacterSelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const setSelectedCharacter = useGameStore((s) => s.setSelectedCharacter);
  const selectedCharacter = useGameStore((s) => s.selectedCharacter);

  const [selected, setSelected] = useState(selectedCharacter);

  const handleSelect = useCallback((index: number) => {
    setSelected(index);
  }, []);

  const handleConfirm = useCallback(() => {
    setSelectedCharacter(selected);
    setScreen('playing');
  }, [selected, setSelectedCharacter, setScreen]);

  const handleBack = useCallback(() => {
    setScreen('mainMenu');
  }, [setScreen]);

  return (
    <div className="character-select-screen">
      {/* Background */}
      <div className="main-menu-bg" />

      {/* Content */}
      <div className="character-select-content">
        <h1 className="character-select-title">Choose Your Champion</h1>
        <p className="character-select-subtitle">
          Each warrior walks a different path through the dungeon. The rest become your enemies!
        </p>

        {/* Character Grid */}
        <div className="character-grid">
          {CHARACTER_DEFS.map((charDef, index) => (
            <div
              key={charDef.key}
              className={`character-card ${selected === index ? 'character-card-selected' : ''}`}
              onClick={() => handleSelect(index)}
              style={{
                '--char-color': charDef.color,
              } as React.CSSProperties}
            >
              {/* Preview using the character sprite sheet or custom icon */}
              <div className="character-preview">
                {charDef.icon ? (
                  <img
                    src={charDef.icon}
                    alt={charDef.name}
                    style={{
                      width: '64px',
                      height: '64px',
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                    }}
                  />
                ) : (() => {
                  const fW = charDef.frameW || 64;
                  const fH = charDef.frameH || 64;
                  const displaySize = 64;
                  const scale = displaySize / Math.max(fW, fH);
                  return (
                    <div
                      className="character-sprite"
                      style={{
                        width: displaySize,
                        height: displaySize,
                        backgroundImage: `url(${charDef.sheet})`,
                        backgroundPosition: '0px 0px',
                        backgroundSize: `${charDef.cols * fW * scale}px ${fH * scale}px`,
                        backgroundRepeat: 'no-repeat',
                        imageRendering: 'pixelated',
                      }}
                    />
                  );
                })()}
              </div>

              {/* Info */}
              <div className="character-info">
                <span className="character-name" style={{ color: charDef.color }}>
                  {charDef.name}
                </span>
                <span className="character-desc">{charDef.description}</span>
              </div>

              {/* Selection indicator */}
              {selected === index && (
                <div className="character-selected-badge">✦</div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="character-select-actions">
          <button className="btn btn-pixel" onClick={handleBack}>
            ← Back
          </button>
          <button className="btn btn-primary btn-pixel" onClick={handleConfirm}>
            ⚔️ Enter the Dungeon
          </button>
        </div>
      </div>
    </div>
  );
}
