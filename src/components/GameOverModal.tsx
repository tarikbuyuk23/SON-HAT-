import React from 'react';
import { GameStats } from '../game/types';

interface GameOverModalProps {
  stats: GameStats;
  onRetry: () => void;
  onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  onRetry,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#060913]/88">
      <div className="w-full max-w-lg bg-[#0b1222] border border-red-500/45 rounded-lg p-7 md:p-8">
        <div className="text-xs font-semibold text-red-400 tracking-widest uppercase mb-1">
          Sinyal Kesildi
        </div>
        <h2 className="font-[var(--font-display)] text-3xl md:text-4xl font-bold text-slate-100 mb-2">
          OPERASYON BAŞARISIZ
        </h2>
        {stats.isNewHighScore && (
          <div className="text-sm font-semibold text-orange-400 mb-5">
            Yeni En Yüksek Skor Rekoru!
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 my-6">
          <div className="p-3.5 bg-[#0f172a] border border-slate-800 rounded">
            <div className="text-xs text-slate-400 mb-1">Ulaşılan Dalga</div>
            <div className="font-[var(--font-mono)] text-2xl font-bold text-cyan-400 tabular-nums">
              {stats.wave}
            </div>
          </div>
          <div className="p-3.5 bg-[#0f172a] border border-slate-800 rounded">
            <div className="text-xs text-slate-400 mb-1">Toplam Öldürme</div>
            <div className="font-[var(--font-mono)] text-2xl font-bold text-slate-100 tabular-nums">
              {stats.kills}
            </div>
          </div>
          <div className="p-3.5 bg-[#0f172a] border border-slate-800 rounded">
            <div className="text-xs text-slate-400 mb-1">İsabet Oranı</div>
            <div className="font-[var(--font-mono)] text-2xl font-bold text-slate-100 tabular-nums">
              %{stats.accuracy}
            </div>
          </div>
          <div className="p-3.5 bg-[#0f172a] border border-slate-800 rounded">
            <div className="text-xs text-slate-400 mb-1">Kafadan Vuruş</div>
            <div className="font-[var(--font-mono)] text-2xl font-bold text-orange-400 tabular-nums">
              {stats.headshots}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] border border-slate-800 rounded mb-6">
          <div>
            <div className="text-xs text-slate-400">Toplam Puan</div>
            <div className="font-[var(--font-mono)] text-xl font-bold text-slate-100 tabular-nums">
              {stats.score}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">En Yüksek Skor</div>
            <div className="font-[var(--font-mono)] text-xl font-bold text-orange-400 tabular-nums">
              {stats.highScore}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRetry}
            className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-[var(--font-display)] font-bold text-base tracking-wide rounded transition-colors cursor-pointer"
          >
            TEKRAR DENE
          </button>
          <button
            onClick={onMainMenu}
            className="px-6 py-3.5 bg-[#111b31] hover:bg-[#192746] border border-slate-700 text-slate-200 font-medium text-sm rounded transition-colors cursor-pointer"
          >
            ANA MENÜ
          </button>
        </div>
      </div>
    </div>
  );
};
