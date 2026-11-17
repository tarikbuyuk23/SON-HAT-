import React from 'react';
import { GameSettings } from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onChange, onClose }) => {
  const handleReset = () => {
    onChange({ sensitivity: 1.0, volume: 0.7, fov: 80 });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#060913]/85">
      <div className="w-full max-w-md bg-[#0b1222] border border-slate-700/80 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-slate-100">
            AYARLAR
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-100 transition-colors cursor-pointer px-2 py-1"
          >
            Kapat
          </button>
        </div>

        <div className="space-y-6">
          {/* Mouse Sensitivity */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="sens-slider" className="text-slate-200 font-medium">
                Fare Hassasiyeti
              </label>
              <span className="font-[var(--font-mono)] text-cyan-400 tabular-nums">
                {settings.sensitivity.toFixed(2)}
              </span>
            </div>
            <input
              id="sens-slider"
              type="range"
              min={0.2}
              max={2.5}
              step={0.05}
              value={settings.sensitivity}
              onChange={(e) => onChange({ ...settings, sensitivity: Number(e.target.value) })}
              className="sonhat-slider w-full"
            />
          </div>

          {/* Master Volume */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="vol-slider" className="text-slate-200 font-medium">
                Ses Seviyesi
              </label>
              <span className="font-[var(--font-mono)] text-cyan-400 tabular-nums">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              id="vol-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) })}
              className="sonhat-slider w-full"
            />
          </div>

          {/* Field of View (FOV) */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="fov-slider" className="text-slate-200 font-medium">
                Görüş Açısı (FOV)
              </label>
              <span className="font-[var(--font-mono)] text-cyan-400 tabular-nums">
                {settings.fov}°
              </span>
            </div>
            <input
              id="fov-slider"
              type="range"
              min={70}
              max={110}
              step={1}
              value={settings.fov}
              onChange={(e) => onChange({ ...settings, fov: Number(e.target.value) })}
              className="sonhat-slider w-full"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-8 pt-4 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 rounded transition-colors cursor-pointer"
          >
            Varsayılana Sıfırla
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm rounded transition-colors cursor-pointer"
          >
            Kaydet ve Dön
          </button>
        </div>
      </div>
    </div>
  );
};
