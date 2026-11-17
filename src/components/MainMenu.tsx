import React from 'react';

interface MainMenuProps {
  highScore: number;
  onPlay: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  highScore,
  onPlay,
  onOpenSettings,
  onOpenHowToPlay,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-8 md:p-14 bg-gradient-to-r from-[#060913]/92 via-[#060913]/65 to-transparent">
      {/* Top quiet high-score readout */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400 tracking-wide">
          Sektör 07 · Terk Edilmiş Sanayi Bölgesi
        </div>
        <div className="text-xs text-slate-300 font-[var(--font-mono)] tabular-nums">
          En Yüksek Skor: <span className="text-orange-400 font-bold">{highScore}</span>
        </div>
      </div>

      {/* Main Title Lockup & Actions */}
      <div className="max-w-lg my-auto">
        <div className="flex items-center gap-3.5 mb-3">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="2" y="2" width="36" height="36" rx="4" fill="#0c1426" stroke="#22d3ee" strokeWidth="2" />
            <path d="M11 20 H16 M24 20 H29 M20 11 V16 M20 24 V29" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="20" cy="20" r="2.2" fill="#22d3ee" />
          </svg>
          <span className="text-xs font-medium tracking-widest text-cyan-400 uppercase">
            Taktiksel Savunma Operasyonu
          </span>
        </div>

        <h1
          className="font-[var(--font-display)] text-6xl md:text-7xl font-bold tracking-tight text-slate-50 leading-none mb-4"
          style={{ textWrap: 'balance' }}
        >
          SON HAT
        </h1>

        <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-md">
          Gece çöktü, sanayi bölgesi otonom robot birliklerinin kontrolüne geçti.
          Mevzini koru, dalgaları püskürt ve hayatta kal.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={onPlay}
            className="px-8 py-3.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-[var(--font-display)] text-lg font-bold tracking-wide rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            OYNA
          </button>
          <button
            onClick={onOpenSettings}
            className="px-6 py-3.5 bg-[#0e172a] hover:bg-[#16223b] border border-slate-700 text-slate-100 font-medium text-sm rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            AYARLAR
          </button>
          <button
            onClick={onOpenHowToPlay}
            className="px-6 py-3.5 bg-[#0e172a] hover:bg-[#16223b] border border-slate-700 text-slate-100 font-medium text-sm rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            NASIL OYNANIR
          </button>
        </div>
      </div>

      {/* Flat single-line control hint */}
      <div className="text-xs text-slate-400 tracking-wide">
        WASD Hareket · Shift Koşma · Ctrl Çömelme · Space Zıplama · Sol/Sağ Tık Ateş/Nişan · R Şarjör · 1-2-3 Silah · ESC Duraklat
      </div>
    </div>
  );
};
