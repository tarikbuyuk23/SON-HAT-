import React from 'react';
import { HudSnapshot } from '../game/types';

interface HudOverlayProps {
  hud: HudSnapshot;
  onRequestLock: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({ hud, onRequestLock }) => {
  const activeWeapon = hud.weapons.find((w) => w.id === hud.activeWeaponId) || hud.weapons[0];
  const spreadPx = Math.round(8 + hud.crosshairSpread * 520);
  const isSniperScoped = hud.activeWeaponId === 'sessiz_ok' && hud.isAds && !hud.isReloading;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Damage Red Screen-Edge Vignette */}
      {hud.damageFlash > 0.01 && (
        <div
          className="absolute inset-0 transition-opacity duration-75"
          style={{
            opacity: hud.damageFlash * 0.85,
            background:
              'radial-gradient(circle at center, transparent 48%, rgba(220, 38, 38, 0.55) 88%, rgba(185, 28, 28, 0.85) 100%)',
          }}
        />
      )}

      {/* Directional Damage Indicators around Screen Center */}
      {hud.damageIndicators.map((ind) => {
        const deg = (ind.angle * 180) / Math.PI;
        const opacity = Math.max(0, ind.ttl / ind.maxTtl);
        return (
          <div
            key={ind.id}
            className="absolute left-1/2 top-1/2 w-56 h-56 -ml-28 -mt-28"
            style={{
              transform: `rotate(${deg}deg)`,
              opacity,
            }}
          >
            <div className="mx-auto w-14 h-2.5 rounded-sm bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
          </div>
        );
      })}

      {/* Sniper Scope Overlay ("Sessiz Ok" ADS) */}
      {isSniperScoped && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at center, transparent 27%, rgba(4, 7, 15, 0.96) 28.5%)',
          }}
        >
          <div className="relative w-[54vh] h-[54vh] rounded-full border border-cyan-400/40">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-300/45" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-300/45" />
            <div className="absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-orange-500" />
          </div>
        </div>
      )}

      {/* Center Dynamic Crosshair */}
      {!isSniperScoped && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Center dot */}
          <div className="w-1 h-1 rounded-full bg-cyan-300/90" />
          {/* Top tick */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-slate-100/90"
            style={{ bottom: `${spreadPx}px` }}
          />
          {/* Bottom tick */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-slate-100/90"
            style={{ top: `${spreadPx}px` }}
          />
          {/* Left tick */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-slate-100/90"
            style={{ right: `${spreadPx}px` }}
          />
          {/* Right tick */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-slate-100/90"
            style={{ left: `${spreadPx}px` }}
          />
        </div>
      )}

      {/* Hitmarker "X" */}
      {hud.hitmarker !== 'none' && (
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <g
            stroke={hud.hitmarker === 'head' ? '#f97316' : '#f8fafc'}
            strokeWidth={hud.hitmarker === 'head' ? '2.8' : '2.2'}
            strokeLinecap="round"
          >
            <line x1="7" y1="7" x2="13" y2="13" />
            <line x1="29" y1="7" x2="23" y2="13" />
            <line x1="7" y1="29" x2="13" y2="23" />
            <line x1="29" y1="29" x2="23" y2="23" />
          </g>
        </svg>
      )}

      {/* "KAFADAN!" Popup */}
      {hud.headshotBannerKey > 0 && (
        <div
          key={hud.headshotBannerKey}
          className="animate-headshot absolute left-1/2 top-[43%] font-[var(--font-display)] text-base font-bold tracking-wider text-orange-400"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.85)' }}
        >
          KAFADAN!
        </div>
      )}

      {/* Reload Progress Indicator */}
      {hud.isReloading && (
        <div className="absolute left-1/2 top-[57%] -translate-x-1/2 w-36">
          <div className="text-center text-[11px] font-medium tracking-wider text-cyan-300 mb-1">
            ŞARJÖR DEĞİŞTİRİLİYOR
          </div>
          <div className="h-1.5 w-full bg-slate-900/90 border border-slate-700/70 rounded-sm overflow-hidden">
            <div
              className="h-full bg-cyan-400"
              style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Status Cluster: Wave, Score, Remaining Enemies */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-6 px-5 py-2.5 bg-[#080d1a]/88 border border-slate-700/60 rounded-md">
        <div className="text-center">
          <div className="text-[11px] text-slate-400 tracking-wide">Dalga</div>
          <div className="font-[var(--font-mono)] text-xl font-bold text-cyan-400 tabular-nums leading-tight">
            {hud.wave}
          </div>
        </div>
        <div className="h-7 w-px bg-slate-700/70" />
        <div className="text-center">
          <div className="text-[11px] text-slate-400 tracking-wide">Puan</div>
          <div className="font-[var(--font-mono)] text-xl font-bold text-slate-100 tabular-nums leading-tight">
            {hud.score}
          </div>
        </div>
        <div className="h-7 w-px bg-slate-700/70" />
        {hud.screen === 'break' ? (
          <div className="text-center">
            <div className="text-[11px] text-orange-400 tracking-wide">Mola</div>
            <div className="font-[var(--font-mono)] text-xl font-bold text-orange-400 tabular-nums leading-tight">
              {hud.breakTimeLeft}s
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-[11px] text-slate-400 tracking-wide">Kalan Düşman</div>
            <div className="font-[var(--font-mono)] text-xl font-bold text-orange-400 tabular-nums leading-tight">
              {hud.remainingEnemies}
            </div>
          </div>
        )}
      </div>

      {/* Top-Right Kill Feed */}
      <div className="absolute top-4 right-5 flex flex-col items-end gap-1.5 max-w-xs">
        {hud.killFeed.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#080d1a]/88 border border-slate-700/60 rounded text-xs text-slate-200"
          >
            <span className="text-cyan-300 font-medium">{entry.weaponName}</span>
            <span className="text-slate-500">·</span>
            {entry.headshot && (
              <>
                <span className="text-orange-400 font-semibold">Kafadan</span>
                <span className="text-slate-500">·</span>
              </>
            )}
            <span className="text-slate-200">{entry.enemyName}</span>
          </div>
        ))}
      </div>

      {/* Bottom-Left: Health & Armor Bars */}
      <div className="absolute bottom-5 left-5 w-64 px-4 py-3 bg-[#080d1a]/88 border border-slate-700/60 rounded-md">
        {/* Armor */}
        <div className="mb-2.5">
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span className="text-cyan-300 font-medium">Zırh</span>
            <span className="font-[var(--font-mono)] text-sm font-bold text-cyan-300 tabular-nums">
              {hud.armor}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-sm overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-[width] duration-100"
              style={{ width: `${Math.min(100, (hud.armor / hud.maxArmor) * 100)}%` }}
            />
          </div>
        </div>

        {/* Health */}
        <div>
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span className={hud.health <= 30 ? 'text-red-400 font-semibold' : 'text-slate-200 font-medium'}>
              Can
            </span>
            <span
              className={`font-[var(--font-mono)] text-lg font-bold tabular-nums leading-none ${
                hud.health <= 30 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {hud.health}
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-900 rounded-sm overflow-hidden">
            <div
              className={`h-full transition-[width] duration-100 ${
                hud.health <= 30 ? 'bg-red-500' : 'bg-orange-500'
              }`}
              style={{ width: `${Math.min(100, (hud.health / hud.maxHealth) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom-Right: Ammo & Weapon Slots */}
      <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2">
        <div className="px-4 py-3 bg-[#080d1a]/88 border border-slate-700/60 rounded-md min-w-[210px]">
          <div className="flex items-center justify-between gap-4 mb-1">
            <span className="font-[var(--font-display)] text-sm font-bold text-slate-100 tracking-wide">
              {activeWeapon.name}
            </span>
            {activeWeapon.upgradeLevel > 0 && (
              <span className="font-[var(--font-mono)] text-xs text-orange-400">
                Sv.{activeWeapon.upgradeLevel + 1}
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-end gap-1.5">
            <span
              className={`font-[var(--font-mono)] text-3xl font-bold tabular-nums leading-none ${
                activeWeapon.ammo === 0 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {activeWeapon.ammo}
            </span>
            <span className="font-[var(--font-mono)] text-sm text-slate-400 tabular-nums">
              / {activeWeapon.reserve}
            </span>
          </div>
        </div>

        {/* Weapon Slot Indicators (1-2-3) */}
        <div className="flex items-center gap-1.5">
          {hud.weapons.map((w) => {
            const active = w.id === hud.activeWeaponId;
            return (
              <div
                key={w.id}
                className={`px-2.5 py-1 rounded text-xs font-medium border ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-[#080d1a]/80 border-slate-700/60 text-slate-400'
                }`}
              >
                <span className="font-[var(--font-mono)] mr-1.5">{w.slot}</span>
                {w.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pointer Unlock Prompt during active play */}
      {hud.screen === 'playing' && !hud.pointerLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-[#060913]/45">
          <button
            onClick={onRequestLock}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold rounded-md transition-colors cursor-pointer"
          >
            Nişangâhı Kilitlemek İçin Tıklayın
          </button>
        </div>
      )}
    </div>
  );
};
