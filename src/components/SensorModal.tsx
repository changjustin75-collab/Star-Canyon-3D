import React from 'react';
import { Sliders, Wifi, Smartphone, Keyboard, RotateCcw, X, Compass } from 'lucide-react';
import type { RabboniConfig, RabboniSource, RabboniState } from '../lib/rabboni-connector';

interface SensorModalProps {
  open: boolean;
  onClose: () => void;
  sensorState: RabboniState;
  config: RabboniConfig;
  wsUrl: string;
  androidCode: string;
  errorText: string;
  onWsUrlChange: (url: string) => void;
  onAndroidCodeChange: (code: string) => void;
  onSelectSource: (source: RabboniSource) => void;
  onConnectDesktop: () => void;
  onConnectAndroid: () => void;
  onDisconnect: () => void;
  onSelectDevice: (deviceId: string) => void;
  onCalibrate: () => void;
  onUpdateConfig: (partial: Partial<RabboniConfig>) => void;
}

export const SensorModal: React.FC<SensorModalProps> = ({
  open,
  onClose,
  sensorState,
  config,
  wsUrl,
  androidCode,
  errorText,
  onWsUrlChange,
  onAndroidCodeChange,
  onSelectSource,
  onConnectDesktop,
  onConnectAndroid,
  onDisconnect,
  onSelectDevice,
  onCalibrate,
  onUpdateConfig,
}) => {
  if (!open) return null;

  const activeSource = sensorState.source;
  const gyroPct = Math.min(100, (sensorState.maxRotationRate / Math.max(40, config.gyroThreshold)) * 100);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#04060d]/80"
      role="dialog"
      aria-modal="true"
      aria-label="體感與控制器設定"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0c1222] border border-slate-700/70 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-cyan-400 shrink-0" />
            <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
              操控與 Rabboni 六軸感測器設定
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="關閉設定視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Input Mode Segmented Control */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">操控來源切換</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#070b15] rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onSelectSource('manual')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeSource === 'manual'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 shrink-0" />
                <span>鍵盤／觸控</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectSource('desktop')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeSource === 'desktop'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span>Rabboni 電腦橋接</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectSource('android')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeSource === 'android'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>Android App</span>
              </button>
            </div>
          </div>

          {/* Connection Form for Desktop or Android */}
          {activeSource === 'manual' && (
            <div className="p-4 rounded-lg bg-[#080d1a] border border-slate-800/90 text-sm text-slate-300 space-y-2">
              <p className="font-medium text-slate-100">鍵盤與觸控操作說明</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>左右滾轉閃避：A / D 或 ← / →</div>
                <div>爬升與俯衝：W / S 或 ↑ / ↓</div>
                <div>桶滾無敵閃避：Shift / E / Q</div>
                <div>手動雷射射擊：Space 或點擊畫面</div>
              </div>
              <p className="text-xs text-slate-400 pt-1">
                行動裝置或平板可直接於畫面拖曳虛擬飛行搖桿，並點擊底部「桶滾閃避」按鈕。
              </p>
            </div>
          )}

          {activeSource === 'desktop' && (
            <div className="space-y-3 p-4 rounded-lg bg-[#080d1a] border border-slate-800/90">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e) => onWsUrlChange(e.target.value)}
                  placeholder="ws://localhost:50500/rab"
                  className="flex-1 px-3 py-2 text-sm font-mono-num bg-[#0c1222] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                />
                {sensorState.connected ? (
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    中斷連線
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onConnectDesktop}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    連線電腦橋接
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                請先啟動 Rabboni 原廠桌面橋接程式（預設埠號 50500），並開啟感測器電源。
              </p>
            </div>
          )}

          {activeSource === 'android' && (
            <div className="space-y-3 p-4 rounded-lg bg-[#080d1a] border border-slate-800/90">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={androidCode}
                  onChange={(e) => onAndroidCodeChange(e.target.value)}
                  placeholder="輸入 MotionPlay App 連線碼"
                  className="flex-1 px-3 py-2 text-sm font-mono-num bg-[#0c1222] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
                />
                {sensorState.connected ? (
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    中斷連線
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onConnectAndroid}
                    disabled={!androidCode.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    連線 Android
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                連線位址為 http://127.0.0.1:50501/frames，請先於 MotionPlay Android App 開啟網頁連線。
              </p>
            </div>
          )}

          {/* Status & Error */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
            <div className="text-slate-300">
              目前狀態：<span className="text-cyan-300 font-medium">{sensorState.statusMessage}</span>
            </div>
            {sensorState.calibrated && sensorState.fresh && (
              <span className="text-emerald-400 font-medium">姿態基準已鎖定</span>
            )}
          </div>

          {errorText && (
            <div className="px-3.5 py-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
              {errorText}
            </div>
          )}

          {/* Device Selector & Neutral Calibration */}
          {activeSource !== 'manual' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">選擇感測器裝置</label>
                <select
                  value={sensorState.selectedDeviceId}
                  onChange={(e) => onSelectDevice(e.target.value)}
                  disabled={sensorState.devices.length === 0}
                  className="w-full px-3 py-2 text-sm bg-[#080d1a] border border-slate-700 rounded-lg text-slate-100 disabled:opacity-50 focus:outline-none focus:border-cyan-400"
                >
                  {sensorState.devices.length === 0 ? (
                    <option value="">尚未偵測到感測器</option>
                  ) : (
                    sensorState.devices.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.name} ({dev.deviceId})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">靜止校正（約 0.7 秒）</label>
                <button
                  type="button"
                  onClick={onCalibrate}
                  disabled={!sensorState.fresh}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 transition-colors cursor-pointer"
                >
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>{sensorState.calibrating ? '保持靜止校正中…' : '校正中央握姿'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Live 6-Axis Telemetry Preview when Connected */}
          {activeSource !== 'manual' && (
            <div className="p-4 rounded-lg bg-[#080d1a] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>即時雙軸傾角與甩動角速度</span>
                <span className="font-mono-num text-slate-300">
                  Roll {sensorState.x.toFixed(2)} · Pitch {sensorState.y.toFixed(2)} ·{' '}
                  {Math.round(sensorState.maxRotationRate)}°/s
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                {/* 2D Tilt Pad */}
                <div className="relative h-24 rounded-lg bg-[#0c1222] border border-slate-800 overflow-hidden">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-slate-700/70" />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-slate-700/70" />
                  <div
                    className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full bg-cyan-400 border-2 border-white transition-transform duration-75"
                    style={{
                      left: `${50 + sensorState.x * 42}%`,
                      top: `${50 - sensorState.y * 42}%`,
                    }}
                  />
                </div>

                {/* Gyro Flick Meter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">桶滾甩動觸發計</span>
                    <span className="font-mono-num text-cyan-300">
                      {Math.round(sensorState.maxRotationRate)} / {config.gyroThreshold}°/s
                    </span>
                  </div>
                  <div className="h-2.5 rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        gyroPct >= 100 ? 'bg-amber-400' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${gyroPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    左右傾角翻滾閃避、前後傾角爬升俯衝；快速甩動手腕達門檻即觸發桶滾無敵閃避。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sensitivity & Axis Tuning */}
          {activeSource !== 'manual' && (
            <div className="space-y-3 pt-1 border-t border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <label className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>傾斜靈敏度 (Gain)</span>
                    <span className="font-mono-num text-cyan-300">{config.gain.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="2.0"
                    step="0.1"
                    value={config.gain}
                    onChange={(e) => onUpdateConfig({ gain: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </label>

                <label className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>桶滾甩動門檻 (°/s)</span>
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

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.flipX}
                    onChange={(e) => onUpdateConfig({ flipX: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>反轉左右滾轉</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.flipY}
                    onChange={(e) => onUpdateConfig({ flipY: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>反轉前後俯仰</span>
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ axis: config.axis === 1 ? 0 : 1 })}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:border-cyan-500/60 hover:text-cyan-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>握持軸向：{config.axis === 1 ? 'Y 前後 / X 左右' : 'X 前後 / Y 左右'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
