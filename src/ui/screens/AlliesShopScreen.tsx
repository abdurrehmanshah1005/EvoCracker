import { useCallback } from 'react';
import { useGameStore } from '@store/gameStore';
import { CHARACTER_DEFS } from '@core/SpriteFactory';
import { getAllyCost, getAllyDescription, getAllyRole, getCharacterAlgoLabel } from '@game/allies/AllyDefs';

export function AlliesShopScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const coinCount = useGameStore((s) => s.coinCount);
  const unlockedAllies = useGameStore((s) => s.unlockedAllies);
  const unlockAlly = useGameStore((s) => s.unlockAlly);
  const spendCoins = useGameStore((s) => s.spendCoins);

  const handleBack = useCallback(() => {
    setScreen('mainMenu');
  }, [setScreen]);

  const handlePurchase = useCallback((characterIndex: number) => {
    const cost = getAllyCost(characterIndex);
    if (coinCount < cost) return;
    spendCoins(cost);
    unlockAlly(characterIndex);
  }, [coinCount, spendCoins, unlockAlly]);

  return (
    <div className="alias-shop">
      <div className="main-menu-bg" />

      <div className="alias-shop-content">
        <div className="alias-shop-title">Allies</div>
        <div className="alias-shop-subtitle">
          Purchase playable characters as match allies. Select them after choosing your champion.
        </div>

        <div className="alias-shop-coins">Coins: {coinCount}</div>

        <div className="alias-card-grid">
          {CHARACTER_DEFS.map((charDef, index) => {
            const isUnlocked = unlockedAllies.includes(index);
            const cost = getAllyCost(index);
            const canAfford = coinCount >= cost;
            const role = getAllyRole(index);
            const fW = charDef.frameW || 64;
            const fH = charDef.frameH || 64;
            const displaySize = 46;
            const scale = displaySize / Math.max(fW, fH);

            return (
              <div key={charDef.key} className={`alias-card ${isUnlocked ? 'unlocked' : ''}`}>
                <div className="character-preview" style={{ alignSelf: 'center' }}>
                  {charDef.icon ? (
                    <img
                      src={charDef.icon}
                      alt={charDef.name}
                      style={{ width: '46px', height: '46px', objectFit: 'contain', imageRendering: 'pixelated' }}
                    />
                  ) : (
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
                  )}
                </div>

                <div className="alias-card-top">
                  <div className="alias-card-name">{charDef.name}{getCharacterAlgoLabel(index) ? ` (${getCharacterAlgoLabel(index)})` : ''}</div>
                  <div className="alias-card-cost">{cost}c</div>
                </div>
                <div className="alias-card-desc">
                  {role === 'fighter' ? 'Fighter' : 'Decoy'} - {getAllyDescription(index)}
                </div>

                <div className="alias-card-actions">
                  <button
                    className="btn btn-pixel"
                    disabled={isUnlocked || !canAfford}
                    onClick={() => handlePurchase(index)}
                  >
                    {isUnlocked ? 'Purchased' : canAfford ? 'Purchase' : 'Need Coins'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="alias-shop-footer">
          <button className="btn btn-pixel" onClick={handleBack}>
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
