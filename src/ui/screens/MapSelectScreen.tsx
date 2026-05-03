// ========================
// MapSelectScreen — Choose your dungeon map before character select
// ========================

import { useCallback, useState, useEffect } from 'react';
import { useGameStore } from '@store/gameStore';
import type { MapInfo } from '@store/gameStore';

// Available maps — static registry
const AVAILABLE_MAPS: MapInfo[] = [
  {
    id: 'crypt',
    name: 'Crypt of Shadows',
    description: 'A dark underground crypt with winding corridors, treasure vaults, and deadly traps. Hand-crafted layout with strategic enemy placement.',
    thumbnail: '/assets/cryptofshadows.png',
    layoutPath: '/assets/maps/floor1_layout.png',
    isProcedural: false,
  },
  {
    id: 'forest_ruins',
    name: 'Lonely Lair',
    description: 'A lonely overgrown lair with open clearings, broken paths, and ruined stone corridors.',
    thumbnail: '/assets/lonelylair.png',
    layoutPath: '/assets/lonelylair.png',
    isProcedural: false,
  },
];

export { AVAILABLE_MAPS };

export function MapSelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const setSelectedMap = useGameStore((s) => s.setSelectedMap);
  const selectedMap = useGameStore((s) => s.selectedMap);

  const [selected, setSelected] = useState(selectedMap);

  const handleSelect = useCallback((mapId: string) => {
    setSelected(mapId);
  }, []);

  const handleConfirm = useCallback(() => {
    setSelectedMap(selected);
    setScreen('characterSelect');
  }, [selected, setSelectedMap, setScreen]);

  const handleBack = useCallback(() => {
    setScreen('mainMenu');
  }, [setScreen]);

  return (
    <div className="map-select-screen">
      {/* Background */}
      <div className="main-menu-bg" />

      {/* Content */}
      <div className="map-select-content">
        <h1 className="map-select-title">Choose Your Battleground</h1>
        <p className="map-select-subtitle">
          Each map offers a unique tactical challenge. Choose wisely.
        </p>

        {/* Map Grid */}
        <div className="map-grid">
          {AVAILABLE_MAPS.map((mapDef) => (
            <div
              key={mapDef.id}
              className={`map-card ${selected === mapDef.id ? 'map-card-selected' : ''}`}
              onClick={() => handleSelect(mapDef.id)}
            >
              {/* Preview */}
              <div className="map-preview">
                {mapDef.thumbnail ? (
                  <img
                    src={mapDef.thumbnail}
                    alt={mapDef.name}
                    className="map-preview-img"
                  />
                ) : (
                  <div className="map-preview-procedural">
                    <div className="procedural-icon">🎲</div>
                    <span>Procedural</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="map-info">
                <span className="map-name">{mapDef.name}</span>
                <span className="map-desc">{mapDef.description}</span>
                {mapDef.isProcedural && (
                  <span className="map-tag">∞ Infinite Variety</span>
                )}
              </div>

              {/* Selection indicator */}
              {selected === mapDef.id && (
                <div className="map-selected-badge">✦</div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="map-select-actions">
          <button className="btn btn-pixel" onClick={handleBack}>
            ← Back
          </button>
          <button className="btn btn-primary btn-pixel" onClick={handleConfirm}>
            ⚔️ Choose Champion →
          </button>
        </div>
      </div>
    </div>
  );
}
