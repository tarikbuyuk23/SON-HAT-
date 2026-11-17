import React from 'react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#060913]/85">
      <div className="w-full max-w-2xl bg-[#0b1222] border border-slate-700/80 rounded-lg p-6 md:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-slate-100">
            NASIL OYNANIR
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-100 transition-colors cursor-pointer px-2 py-1"
          >
            Kapat
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
          <div>
            <h3 className="font-[var(--font-display)] text-base font-bold text-cyan-400 mb-2">
              Kontroller
            </h3>
            <ul className="space-y-1.5">
              <li className="flex justify-between">
                <span className="text-slate-400">Hareket</span>
                <span className="font-[var(--font-mono)] text-slate-100">W A S D</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Koşma / Çömelme</span>
                <span className="font-[var(--font-mono)] text-slate-100">Shift / Ctrl (C)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Zıplama</span>
                <span className="font-[var(--font-mono)] text-slate-100">Space</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Ateş / Nişan (ADS)</span>
                <span className="font-[var(--font-mono)] text-slate-100">Sol / Sağ Tık</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Şarjör Değiştir</span>
                <span className="font-[var(--font-mono)] text-slate-100">R</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Silah Değiştir</span>
                <span className="font-[var(--font-mono)] text-slate-100">1-2-3 / Tekerlek</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Duraklat</span>
                <span className="font-[var(--font-mono)] text-slate-100">ESC</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-[var(--font-display)] text-base font-bold text-orange-400 mb-2">
              Cephanelik
            </h3>
            <ul className="space-y-2">
              <li>
                <div className="font-semibold text-slate-100">1. Kuzgun (Taarruz Tüfeği)</div>
                <div className="text-xs text-slate-400">Tam otomatik, 30 mermi şarjör, dengeli hasar ve geri tepme.</div>
              </li>
              <li>
                <div className="font-semibold text-slate-100">2. Sessiz Ok (Keskin Nişancı)</div>
                <div className="text-xs text-slate-400">Tek atış, 5 mermi şarjör, yüksek hasar ve güçlü dürbün yakınlaştırması.</div>
              </li>
              <li>
                <div className="font-semibold text-slate-100">3. Diken (Taktik Tabanca)</div>
                <div className="text-xs text-slate-400">Yarı otomatik, 12 mermi şarjör, çok hızlı şarjör değiştirme.</div>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 pt-4 border-t border-slate-800 space-y-2">
            <h3 className="font-[var(--font-display)] text-base font-bold text-slate-100">
              Taktiksel İpuçları
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Düşman robotların kafasına isabet ettirmek <span className="text-orange-400 font-semibold">2 kat hasar</span> verir ve ekstra puan kazandırır.
              Her dalga temizlendikten sonra açılan 15 saniyelik molada <span className="text-cyan-400 font-semibold">Tedarik Kutusu</span> menüsünden
              can, zırh, mermi veya silah geliştirmesi (+%10 hasar, +5 şarjör) satın alabilirsin.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold text-sm rounded transition-colors cursor-pointer"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
};
