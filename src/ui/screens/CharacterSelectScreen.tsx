// ========================
// CharacterSelectScreen — Pick your character before entering the dungeon
// ========================

import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { CHARACTER_DEFS } from '@core/SpriteFactory';

// Character preview: we extract sprites from the character spritesheet using CSS
// The spritesheet (characters.png) is 112×64, with 7 columns × 4 rows of 16×16 frames
// Each column = a different character class

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
          Each warrior walks a different path through the dungeon
        </p>

        {/* Character Grid */}
        <div className="character-grid">
          {CHARACTER_DEFS.map((charDef, index) => (
            <div
              key={charDef.name}
              className={`character-card ${selected === index ? 'character-card-selected' : ''}`}
              onClick={() => handleSelect(index)}
              style={{
                '--char-color': charDef.color,
              } as React.CSSProperties}
            >
              {/* Preview using CSS sprite from the spritesheet */}
              <div className="character-preview">
                <div
                  className="character-sprite"
                  style={{
                    width: 16,
                    height: 16,
                    backgroundImage: `url(/assets/dungeon-pack/characters.png)`,
                    backgroundPosition: `-${charDef.col * 16}px 0px`,
                    backgroundSize: '112px 64px',
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'pixelated',
                    transform: 'scale(3)',
                  }}
                />
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
