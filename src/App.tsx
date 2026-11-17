/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { SonHatEngine } from './game/engine';
import { GameSettings, HudSnapshot, WEAPON_SPECS, WeaponId } from './game/types';
import { MainMenu } from './components/MainMenu';
import { HudOverlay } from './components/HudOverlay';
import { PauseMenu } from './components/PauseMenu';
import { SupplyCrateModal } from './components/SupplyCrateModal';
import { GameOverModal } from './components/GameOverModal';
import { SettingsModal } from './components/SettingsModal';
import { HowToPlayModal } from './components/HowToPlayModal';

const SETTINGS_KEY = 'son_hat_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1.0,
  volume: 0.7,
  fov: 80,
};

function loadInitialSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : 1.0,
      volume: typeof parsed.volume === 'number' ? parsed.volume : 0.7,
      fov: typeof parsed.fov === 'number' ? parsed.fov : 80,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const INITIAL_HUD: HudSnapshot = {
  screen: 'menu',
  health: 100,
  maxHealth: 100,
  armor: 50,
  maxArmor: 100,
  wave: 1,
  score: 0,
  highScore: 0,
  remainingEnemies: 0,
  breakTimeLeft: 15,
  activeWeaponId: 'kuzgun',
  weapons: (['kuzgun', 'sessiz_ok', 'diken'] as WeaponId[]).map((id) => ({
    id,
    name: WEAPON_SPECS[id].name,
    slot: WEAPON_SPECS[id].slot,
    ammo: WEAPON_SPECS[id].baseMagSize,
    magSize: WEAPON_SPECS[id].baseMagSize,
    reserve: WEAPON_SPECS[id].startReserve,
    damage: WEAPON_SPECS[id].baseDamage,
    upgradeLevel: 0,
  })),
  isReloading: false,
  reloadProgress: 0,
  isAds: false,
  isCrouching: false,
  crosshairSpread: 0.014,
  hitmarker: 'none',
  headshotBannerKey: 0,
  damageFlash: 0,
  damageIndicators: [],
  killFeed: [],
  pointerLocked: false,
  stats: {
    wave: 1,
    score: 0,
    highScore: 0,
    kills: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    accuracy: 0,
    isNewHighScore: false,
  },
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SonHatEngine | null>(null);

  const [settings, setSettings] = useState<GameSettings>(loadInitialSettings);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new SonHatEngine(mount, settings, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSettingsChange = (next: GameSettings) => {
    setSettings(next);
    engineRef.current?.updateSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060913]">
      {/* Dedicated WebGL Mount Container (never re-created on React state updates) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Active Gameplay HUD */}
      {(hud.screen === 'playing' || hud.screen === 'break') && (
        <HudOverlay
          hud={hud}
          onRequestLock={() => engineRef.current?.requestPointerLock()}
        />
      )}

      {/* Main Menu */}
      {hud.screen === 'menu' && (
        <MainMenu
          highScore={hud.highScore}
          onPlay={() => engineRef.current?.startNewGame()}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
        />
      )}

      {/* Pause Menu (ESC) */}
      {hud.screen === 'paused' && !showSettings && (
        <PauseMenu
          onResume={() => engineRef.current?.resumeGame()}
          onOpenSettings={() => setShowSettings(true)}
          onMainMenu={() => engineRef.current?.returnToMenu()}
        />
      )}

      {/* Wave Break Supply Crate Shop */}
      {hud.screen === 'break' && (
        <SupplyCrateModal
          hud={hud}
          onBuyHeal={() => engineRef.current?.buyHeal()}
          onBuyAmmo={() => engineRef.current?.buyAmmo()}
          onBuyArmor={() => engineRef.current?.buyArmor()}
          onBuyUpgrade={(id) => engineRef.current?.buyWeaponUpgrade(id)}
          onSkipBreak={() => engineRef.current?.skipBreakToNextWave()}
        />
      )}

      {/* Game Over Screen */}
      {hud.screen === 'gameover' && (
        <GameOverModal
          stats={hud.stats}
          onRetry={() => engineRef.current?.startNewGame()}
          onMainMenu={() => engineRef.current?.returnToMenu()}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* How To Play Modal */}
      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}
    </div>
  );
}
