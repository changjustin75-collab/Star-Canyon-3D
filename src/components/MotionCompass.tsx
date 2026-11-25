import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { RabboniConfig, RabboniState } from '../lib/rabboni-connector';

export interface GestureFeedback {
  type: 'push' | 'pull';
  id: number;
}

interface MotionCompassProps {
  variant: 'full' | 'compact';
  sensorState: RabboniState;
  config: RabboniConfig;
  activeGesture: GestureFeedback | null;
  onUpdateConfig?: (partial: Partial<RabboniConfig>) => void;
}

function describeDirection(x: number, y: number): string {
  const dead = 0.16;
  const horiz = x < -dead ? '左傾 ←' : x > dead ? '右傾 →' : '';
  const vert = y > dead ? '爬升 ↑' : y < -dead ? '俯衝 ↓' : '';
  if (!horiz && !vert) return '中央水平';
  if (horiz && vert) return `${horiz} · ${vert}`;
  return horiz || vert;
}

export const MotionCompass: React.FC<MotionCompassProps> = ({
  variant,
  sensorState,
  config,
  activeGesture,
  onUpdateConfig,
}) => {
  const x = sensorState.x;
  const y = sensorState.y;
  const maxRot = sensorState.maxRotationRate;
  const linAcc = sensorState.linearAcceleration;

  const upActive = y > 0.16;
  const downActive = y < -0.16;
  const leftActive = x < -0.16;
  const rightActive = x > 0.16;

  const isPush = activeGesture?.type === 'push';
  const isPull = activeGesture?.type === 'pull';

  const accMax = Math.max(1.2, config.threshold * 2.2);
  const accPct = Math.min(100, (linAcc / accMax) * 100);
  const accThreshPct = Math.min(96, (config.threshold / accMax) * 100);

  const gyroMax = Math.max(240, config.gyroThreshold * 1.4);
  const gyroPct = Math.min(100, (maxRot / gyroMax) * 100);
  const gyroThreshPct = Math.min(96, (config.gyroThreshold / gyroMax) * 100);

  // SVG vector endpoint in a 100x100 radar viewBox (center = 50,50; radius = 34)
  const mag = Math.min(1, Math.hypot(x, y));
  const vx = 50 + x * 34;
  const vy = 50 - y * 34;
  const headingDeg = mag > 0.08 ? (Math.atan2(x, y) * 180) / Math.PI : 0;
  const dirLabel = describeDirection(x, y);

  if (variant === 'compact') {
    return (
      <div
        className="w-[152px] rounded-xl bg-[#080d1a]/88 border border-slate-700/70 p-2.5 text-slate-200 shadow-lg select-none"
        aria-label="即時六軸方向儀"
      >
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
          <span className="font-medium text-slate-300">六軸方向儀</span>
          <span className="font-mono-num text-cyan-300">{Math.round(maxRot)}°/s</span>
        </div>

        {/* Mini Crosshair Radar */}
        <div className="relative mx-auto w-[104px] h-[104px]">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="38" fill="#0b1224" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="20" fill="none" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="12" y1="50" x2="88" y2="50" stroke="#1e293b" strokeWidth="1" />
            <line x1="50" y1="12" x2="50" y2="88" stroke="#1e293b" strokeWidth="1" />

            {/* 4-Way Direction Arrows */}
            <text
              x="50"
              y="10"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={upActive ? '#22d3ee' : '#475569'}
            >
              ↑
            </text>
            <text
              x="50"
              y="98"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={downActive ? '#22d3ee' : '#475569'}
            >
              ↓
            </text>
            <text
              x="6"
              y="53.5"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={leftActive ? '#22d3ee' : '#475569'}
            >
              ←
            </text>
            <text
              x="94"
              y="53.5"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={rightActive ? '#22d3ee' : '#475569'}
            >
              →
            </text>

            {/* Vector Line */}
            <line
              x1="50"
              y1="50"
              x2={vx}
              y2={vy}
              stroke={mag > 0.16 ? '#22d3ee' : '#64748b'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Fighter Chevron Marker */}
            <g transform={`translate(${vx}, ${vy}) rotate(${headingDeg})`}>
              <polygon
                points="0,-6.5 5,5 0,2.2 -5,5"
                fill={mag > 0.16 ? '#38bdf8' : '#94a3b8'}
                stroke="#ffffff"
                strokeWidth="0.9"
              />
            </g>
          </svg>
        </div>

        {/* Compact Telemetry & Push/Pull Status */}
        <div className="mt-1.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400">
            <span>
              ({x >= 0 ? '+' : ''}
              {x.toFixed(1)}, {y >= 0 ? '+' : ''}
              {y.toFixed(1)})
            </span>
            <span>{linAcc.toFixed(2)}g</span>
          </div>

          <div
            className={`text-center text-[10px] font-bold py-1 rounded border transition-colors ${
              isPush
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : isPull
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-[#0b1224] border-slate-800 text-slate-400'
            }`}
          >
            {isPush ? '▲ 前推 PUSH' : isPull ? '▼ 後拉 PULL' : dirLabel}
          </div>
        </div>
      </div>
    );
  }

  // FULL VARIANT — Complete 6-Axis Direction & Thrust Calibration Instrument
  return (
    <div className="rounded-xl bg-[#080d1a] border border-slate-800 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-100">即時六軸方向儀</div>
        <div className="text-xs font-mono-num text-slate-300">
          座標 ({x >= 0 ? '+' : ''}
          {x.toFixed(2)}, {y >= 0 ? '+' : ''}
          {y.toFixed(2)}) · <span className="text-cyan-300">{dirLabel}</span>
        </div>
      </div>

      {/* Main Radar + Thrust / Gyro Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-[164px_1fr] gap-4 items-center">
        {/* 2D Crosshair Radar */}
        <div className="relative mx-auto w-[160px] h-[160px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Radar Rings */}
            <circle cx="50" cy="50" r="36" fill="#0b1224" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="22" fill="none" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
            <circle cx="50" cy="50" r="8" fill="none" stroke="#1e293b" strokeWidth="1" />
            <line x1="14" y1="50" x2="86" y2="50" stroke="#1e293b" strokeWidth="1" />
            <line x1="50" y1="14" x2="50" y2="86" stroke="#1e293b" strokeWidth="1" />

            {/* 4-Way Quadrant Glow Arcs */}
            {upActive && (
              <path d="M 32 19 A 36 36 0 0 1 68 19" fill="none" stroke="#22d3ee" strokeWidth="2.6" strokeLinecap="round" />
            )}
            {downActive && (
              <path d="M 32 81 A 36 36 0 0 0 68 81" fill="none" stroke="#22d3ee" strokeWidth="2.6" strokeLinecap="round" />
            )}
            {leftActive && (
              <path d="M 19 32 A 36 36 0 0 0 19 68" fill="none" stroke="#22d3ee" strokeWidth="2.6" strokeLinecap="round" />
            )}
            {rightActive && (
              <path d="M 81 32 A 36 36 0 0 1 81 68" fill="none" stroke="#22d3ee" strokeWidth="2.6" strokeLinecap="round" />
            )}

            {/* 4-Way Direction Labels */}
            <text
              x="50"
              y="10"
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={upActive ? '#22d3ee' : '#64748b'}
            >
              ↑ 爬升
            </text>
            <text
              x="50"
              y="97"
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={downActive ? '#22d3ee' : '#64748b'}
            >
              ↓ 俯衝
            </text>
            <text
              x="6"
              y="53"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={leftActive ? '#22d3ee' : '#64748b'}
            >
              ←
            </text>
            <text
              x="94"
              y="53"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={rightActive ? '#22d3ee' : '#64748b'}
            >
              →
            </text>

            {/* Aiming Vector */}
            <line
              x1="50"
              y1="50"
              x2={vx}
              y2={vy}
              stroke={mag > 0.16 ? '#22d3ee' : '#64748b'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Starfighter Pointer Icon */}
            <g transform={`translate(${vx}, ${vy}) rotate(${headingDeg})`}>
              <polygon
                points="0,-7.5 6,5.5 0,2.4 -6,5.5"
                fill={mag > 0.16 ? '#38bdf8' : '#94a3b8'}
                stroke="#ffffff"
                strokeWidth="1"
              />
            </g>
          </svg>
        </div>

        {/* Right Side: Push/Pull Indicators + Linear Acc & Gyro Bars */}
        <div className="space-y-3">
          {/* Push / Pull High-Contrast Confirmation Indicators */}
          <div className="grid grid-cols-2 gap-2">
            <div
              className={`px-3 py-2 rounded-lg border text-center text-xs font-bold tracking-wide transition-colors ${
                isPush
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-[#0c1222] border-slate-800 text-slate-500'
              }`}
            >
              ▲ 前推 PUSH
            </div>
            <div
              className={`px-3 py-2 rounded-lg border text-center text-xs font-bold tracking-wide transition-colors ${
                isPull
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-[#0c1222] border-slate-800 text-slate-500'
              }`}
            >
              ▼ 後拉 PULL
            </div>
          </div>

          {/* Linear Acceleration Thrust Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">線性加速度推力</span>
              <span className="font-mono-num text-slate-200">
                {linAcc.toFixed(2)} g / 門檻 {config.threshold.toFixed(2)} g
              </span>
            </div>
            <div className="relative h-2.5 rounded bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  linAcc >= config.threshold ? 'bg-emerald-400' : 'bg-cyan-500'
                }`}
                style={{ width: `${accPct}%` }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-amber-300"
                style={{ left: `${accThreshPct}%` }}
                title={`推拉門檻 ${config.threshold.toFixed(2)} g`}
              />
            </div>
          </div>

          {/* Gyro Angular Velocity Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">陀螺儀角速度（甩動桶滾）</span>
              <span className="font-mono-num text-cyan-300">
                {Math.round(maxRot)}°/s / 門檻 {config.gyroThreshold}°/s
              </span>
            </div>
            <div className="relative h-2.5 rounded bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  maxRot >= config.gyroThreshold ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${gyroPct}%` }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-rose-400"
                style={{ left: `${gyroThreshPct}%` }}
                title={`桶滾角速度門檻 ${config.gyroThreshold}°/s`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* One-Click Axis & Direction Inversion Fixes + Advanced Tuning */}
      {onUpdateConfig && (
        <div className="pt-3 border-t border-slate-800/90 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => onUpdateConfig({ axis: config.axis === 1 ? 0 : 1 })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0c1222] border border-slate-700 text-slate-200 hover:border-cyan-400/70 hover:text-cyan-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>主軸向：{config.axis === 1 ? 'Y 軸前後 / X 軸左右' : 'X 軸前後 / Y 軸左右'}</span>
            </button>

            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={config.flipX}
                onChange={(e) => onUpdateConfig({ flipX: e.target.checked })}
                className="accent-cyan-400"
              />
              <span>反轉左右</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={config.flipY}
                onChange={(e) => onUpdateConfig({ flipY: e.target.checked })}
                className="accent-cyan-400"
              />
              <span>反轉上下</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={config.flipPush}
                onChange={(e) => onUpdateConfig({ flipPush: e.target.checked })}
                className="accent-emerald-400"
              />
              <span>反轉推拉</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>傾斜靈敏度</span>
                <span className="font-mono-num text-cyan-300">{config.gain.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={config.gain}
                onChange={(e) => onUpdateConfig({ gain: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>推拉門檻 (g)</span>
                <span className="font-mono-num text-emerald-300">{config.threshold.toFixed(2)} g</span>
              </div>
              <input
                type="range"
                min="0.18"
                max="0.85"
                step="0.02"
                value={config.threshold}
                onChange={(e) => onUpdateConfig({ threshold: parseFloat(e.target.value) })}
                className="w-full accent-emerald-400"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>甩動桶滾門檻</span>
                <span className="font-mono-num text-amber-300">{config.gyroThreshold}°/s</span>
              </div>
              <input
                type="range"
                min="80"
                max="240"
                step="5"
                value={config.gyroThreshold}
                onChange={(e) => onUpdateConfig({ gyroThreshold: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-400"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
