import React from 'react';

interface PauseMenuProps {
  onResume: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#060913]/82">
      <div className="w-full max-w-sm bg-[#0b1222] border border-slate-700/80 rounded-lg p-7 text-center">
        <div className="text-xs text-cyan-400 tracking-widest uppercase mb-1">
          Operasyon Beklemede
        </div>
        <h2 className="font-[var(--font-display)] text-3xl font-bold text-slate-100 mb-6">
          DURAKLATILDI
        </h2>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-sm rounded transition-colors cursor-pointer"
          >
            OYUNA DÖN
          </button>
          <button
            onClick={onOpenSettings}
            className="w-full py-3 bg-[#111b31] hover:bg-[#192746] border border-slate-700 text-slate-100 font-medium text-sm rounded transition-colors cursor-pointer"
          >
            AYARLAR
          </button>
          <button
            onClick={onMainMenu}
            className="w-full py-3 bg-transparent hover:bg-slate-800/70 border border-slate-700/80 text-slate-300 font-medium text-sm rounded transition-colors cursor-pointer"
          >
            ANA MENÜYE DÖN
          </button>
        </div>
      </div>
    </div>
  );
};
