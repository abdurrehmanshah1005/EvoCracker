import { useCallback, useMemo } from 'react';
import { useGameStore } from '@store/gameStore';
import type { AliasKind } from '@store/gameStore';
import { ALIAS_DEFS, ALIAS_ORDER } from '@game/aliases/AliasDefs';

export function AliasShopScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const coinCount = useGameStore((s) => s.coinCount);
  const unlockedAliases = useGameStore((s) => s.unlockedAliases);
  const activeAlias = useGameStore((s) => s.activeAlias);
  const unlockAlias = useGameStore((s) => s.unlockAlias);
  const setActiveAlias = useGameStore((s) => s.setActiveAlias);
  const spendCoins = useGameStore((s) => s.spendCoins);

  const orderedAliases = useMemo(() => ALIAS_ORDER.map((kind) => ALIAS_DEFS[kind]), []);

  const handleBack = useCallback(() => {
    setScreen('mainMenu');
  }, [setScreen]);

  const handlePurchase = useCallback((kind: AliasKind) => {
    const def = ALIAS_DEFS[kind];
    if (coinCount < def.cost) return;
    spendCoins(def.cost);
    unlockAlias(kind);
    setActiveAlias(kind);
  }, [coinCount, spendCoins, unlockAlias, setActiveAlias]);

  const handleEquip = useCallback((kind: AliasKind) => {
    setActiveAlias(kind);
  }, [setActiveAlias]);

  return (
    <div className="alias-shop">
      <div className="main-menu-bg" />

      <div className="alias-shop-content">
        <div className="alias-shop-title">Alias Shop</div>
        <div className="alias-shop-subtitle">Spend coins to unlock special alias companions.</div>

        <div className="alias-shop-coins">Coins: {coinCount}</div>

        <div className="alias-card-grid">
          {orderedAliases.map((def) => {
            const isUnlocked = unlockedAliases.includes(def.kind);
            const isActive = activeAlias === def.kind;
            const canAfford = coinCount >= def.cost;

            return (
              <div key={def.kind} className={`alias-card ${isUnlocked ? 'unlocked' : ''}`}>
                <div className="alias-card-top">
                  <div className="alias-card-name">{def.name}</div>
                  <div className="alias-card-cost">{def.cost}c</div>
                </div>
                <div className="alias-card-desc">{def.description}</div>

                <div className="alias-card-actions">
                  {!isUnlocked ? (
                    <button
                      className="btn btn-pixel"
                      disabled={!canAfford}
                      onClick={() => handlePurchase(def.kind)}
                    >
                      {canAfford ? 'Unlock' : 'Need Coins'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-pixel"
                      onClick={() => handleEquip(def.kind)}
                      style={{ borderColor: isActive ? 'var(--green)' : undefined }}
                    >
                      {isActive ? 'Equipped' : 'Equip'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="alias-shop-footer">
          <button className="btn btn-pixel" onClick={handleBack}>
            ← Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
