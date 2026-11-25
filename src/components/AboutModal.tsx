import React from 'react';
import { Info, X } from 'lucide-react';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#04060d]/80"
      role="dialog"
      aria-modal="true"
      aria-label="關於星際峽谷戰機"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0c1222] border border-slate-700/70 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-cyan-400 shrink-0" />
            <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
              關於
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="關閉關於視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-300 leading-relaxed">
          <div className="p-4 rounded-lg bg-[#080d1a] border border-slate-800 text-sm text-slate-200 text-center leading-relaxed">
            <a
              href="https://rabboni.teachthinking.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition-colors font-medium"
            >
              MotionPlay
            </a>{' '}
            © 2026 張世杰老師{' '}
            <a
              href="https://sipp.com.tw/#playchip"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors font-medium"
            >
              Rabboni 感測器 · 矽譜科技
            </a>
          </div>

          <p className="text-slate-200 font-medium">
            星際峽谷戰機（Star Canyon 3D）是一款支援 Rabboni 六軸體感感測器的超音速 3D 飛行射擊遊戲。
          </p>

          <div className="space-y-2 text-xs text-slate-400 border-t border-slate-800 pt-3">
            <p>
              <strong className="text-slate-200">雙軸傾角操控：</strong>
              左右傾斜進行翻滾閃避（Roll），前後傾角控制戰機爬升與貼地俯衝（Pitch）。
            </p>
            <p>
              <strong className="text-slate-200">桶滾無敵閃避：</strong>
              快速甩動感測器（或按 Shift / E / Q）啟動 360° 桶滾，展開能量護盾震碎隕石並反彈防禦塔砲火。
            </p>
            <p>
              <strong className="text-slate-200">能量環與防禦塔：</strong>
              穿越霓虹能量環觸發超音速加速與連擊倍率，鎖定並擊毀峽谷防禦塔以獲取高分。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
