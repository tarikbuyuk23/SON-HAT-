import React from 'react';
import { HudSnapshot, SUPPLY_COSTS, WeaponId } from '../game/types';

interface SupplyCrateModalProps {
  hud: HudSnapshot;
  onBuyHeal: () => void;
  onBuyAmmo: () => void;
  onBuyArmor: () => void;
  onBuyUpgrade: (weaponId: WeaponId) => void;
  onSkipBreak: () => void;
}

export const SupplyCrateModal: React.FC<SupplyCrateModalProps> = ({
  hud,
  onBuyHeal,
  onBuyAmmo,
  onBuyArmor,
  onBuyUpgrade,
  onSkipBreak,
}) => {
  const canHeal = hud.score >= SUPPLY_COSTS.heal && hud.health < hud.maxHealth;
  const canAmmo = hud.score >= SUPPLY_COSTS.ammo;
  const canArmor = hud.score >= SUPPLY_COSTS.armor && hud.armor < hud.maxArmor;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#060913]/82">
      <div className="w-full max-w-2xl bg-[#0b1222] border border-cyan-500/40 rounded-lg p-6 md:p-7">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800">
          <div>
            <div className="text-xs text-cyan-400 tracking-wide">
              Dalga {hud.wave} Temizlendi · Mola
            </div>
            <h2 className="font-[var(--font-display)] text-2xl md:text-3xl font-bold text-slate-100">
              TEDARİK KUTUSU
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-slate-400">Mevcut Puan</div>
              <div className="font-[var(--font-mono)] text-2xl font-bold text-orange-400 tabular-nums">
                {hud.score}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Kalan Süre</div>
              <div className="font-[var(--font-mono)] text-2xl font-bold text-cyan-400 tabular-nums">
                {hud.breakTimeLeft}s
              </div>
            </div>
          </div>
        </div>

        {/* Tactical Supplies */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <button
            onClick={onBuyHeal}
            disabled={!canHeal}
            className={`text-left p-4 rounded-md border transition-colors ${
              canHeal
                ? 'bg-[#101a30] hover:bg-[#172542] border-slate-700 cursor-pointer'
                : 'bg-[#090f1d] border-slate-800/70 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-semibold text-slate-100 text-sm">Can Yenileme</span>
              <span className="font-[var(--font-mono)] text-xs font-bold text-orange-400 tabular-nums">
                {SUPPLY_COSTS.heal} P
              </span>
            </div>
            <div className="text-xs text-slate-400">+50 Can ({hud.health}/{hud.maxHealth})</div>
          </button>

          <button
            onClick={onBuyArmor}
            disabled={!canArmor}
            className={`text-left p-4 rounded-md border transition-colors ${
              canArmor
                ? 'bg-[#101a30] hover:bg-[#172542] border-slate-700 cursor-pointer'
                : 'bg-[#090f1d] border-slate-800/70 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-semibold text-slate-100 text-sm">Zırh Takviyesi</span>
              <span className="font-[var(--font-mono)] text-xs font-bold text-orange-400 tabular-nums">
                {SUPPLY_COSTS.armor} P
              </span>
            </div>
            <div className="text-xs text-slate-400">+50 Zırh ({hud.armor}/{hud.maxArmor})</div>
          </button>

          <button
            onClick={onBuyAmmo}
            disabled={!canAmmo}
            className={`text-left p-4 rounded-md border transition-colors ${
              canAmmo
                ? 'bg-[#101a30] hover:bg-[#172542] border-slate-700 cursor-pointer'
                : 'bg-[#090f1d] border-slate-800/70 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-semibold text-slate-100 text-sm">Mermi Paketi</span>
              <span className="font-[var(--font-mono)] text-xs font-bold text-orange-400 tabular-nums">
                {SUPPLY_COSTS.ammo} P
              </span>
            </div>
            <div className="text-xs text-slate-400">Tüm silahlara tam cephane</div>
          </button>
        </div>

        {/* Weapon Upgrades */}
        <div className="mb-6">
          <div className="text-xs font-medium text-slate-400 mb-2.5">
            Silah Geliştirmeleri (Hasar +%10 · Şarjör +5)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {hud.weapons.map((w) => {
              const cost = SUPPLY_COSTS.upgradeBase + w.upgradeLevel * SUPPLY_COSTS.upgradeStep;
              const canUpgrade = hud.score >= cost;
              return (
                <button
                  key={w.id}
                  onClick={() => onBuyUpgrade(w.id)}
                  disabled={!canUpgrade}
                  className={`text-left p-4 rounded-md border transition-colors ${
                    canUpgrade
                      ? 'bg-[#101a30] hover:bg-[#172542] border-cyan-500/40 cursor-pointer'
                      : 'bg-[#090f1d] border-slate-800/70 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-[var(--font-display)] font-bold text-slate-100">
                      {w.name}
                    </span>
                    <span className="font-[var(--font-mono)] text-xs text-cyan-400">
                      Sv.{w.upgradeLevel + 1}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2 font-[var(--font-mono)] tabular-nums">
                    Hasar: {w.damage} · Şarjör: {w.magSize}
                  </div>
                  <div className="font-[var(--font-mono)] text-xs font-bold text-orange-400 tabular-nums">
                    Geliştir · {cost} P
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer action */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-800">
          <button
            onClick={onSkipBreak}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-slate-950 font-[var(--font-display)] font-bold text-sm tracking-wide rounded transition-colors cursor-pointer"
          >
            SONRAKİ DALGAYA GEÇ ({hud.wave + 1})
          </button>
        </div>
      </div>
    </div>
  );
};
