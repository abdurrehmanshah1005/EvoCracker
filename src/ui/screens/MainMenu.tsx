import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@store/gameStore';
import type { GameScreen } from '@store/gameStore';

/**
 * MainMenu — The first screen the player sees.
 * Stunning dark fantasy aesthetic with animated particles.
 */
export function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);

  const handleMenuClick = useCallback((screen: GameScreen) => {
    setScreen(screen);
  }, [setScreen]);

  return (
    <div className="main-menu">
      {/* Background gradient */}
      <div className="main-menu-bg" />

      {/* Content */}
      <div className="main-menu-content">
        {/* Decorative rune */}
        <div style={{
          animation: 'float 4s ease-in-out infinite',
          marginBottom: '-20px',
        }}>
          <img 
            src="/assets/Fire-Skull-Files/Previews/fire-skull.gif" 
            alt="Fire Skull" 
            style={{ width: '120px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255, 0, 0, 0.5))' }}
          />
        </div>

        {/* Title */}
        <h1 className="main-menu-title">
          <span className="title-evo">Evo</span><span className="title-cracker">Cracker</span>
        </h1>

        {/* Subtitle */}
        <p className="main-menu-subtitle">
          Evolve. Mutate. Crack.
        </p>

        {/* Divider */}
        <div style={{
          width: '200px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--gold-dark), transparent)',
          margin: '8px 0',
        }} />

        {/* Menu Buttons */}
        <div className="main-menu-buttons">
          <button
            className="btn btn-primary btn-pixel"
            onClick={() => handleMenuClick('mapSelect')}
          >
            ⚔️ Trial Mode
          </button>

          <button
            className="btn btn-purple btn-pixel"
            onClick={() => handleMenuClick('algorithmLab')}
          >
            🧪 Algorithm Lab
          </button>

          <button
            className="btn btn-pixel"
            onClick={() => handleMenuClick('alliesShop')}
          >
            Allies
          </button>

          <button
            className="btn btn-pixel"
            onClick={() => handleMenuClick('settings')}
          >
            ⚙️ Settings
          </button>


        </div>

        {/* Version */}
        <div className="main-menu-version" style={{ marginTop: '16px' }}>
          v0.1.0 — AI Research Build
        </div>
      </div>

      {/* Footer */}
      <div className="main-menu-footer">
        Press <span className="gold-text">[`]</span> during gameplay to toggle AI Analytics
      </div>
    </div>
  );
}
