import React from 'react';
import { Sliders, Wifi, Smartphone, Keyboard, X, Compass } from 'lucide-react';
import type { RabboniConfig, RabboniSource, RabboniState } from '../lib/rabboni-connector';
import { MotionCompass, type GestureFeedback } from './MotionCompass';

interface SensorModalProps {
  open: boolean;
  onClose: () => void;
  sensorState: RabboniState;
  config: RabboniConfig;
  activeGesture: GestureFeedback | null;
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
  activeGesture,
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#04060d]/80"
      role="dialog"
      aria-modal="true"
      aria-label="體感與控制器設定"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0c1222] border border-slate-700/70 rounded-xl shadow-2xl overflow-hidden"
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
        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
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

          {/* Full Live 6-Axis Motion Compass (Crosshair Radar + Push/Pull + One-Click Axis Fix) */}
          <MotionCompass
            variant="full"
            sensorState={sensorState}
            config={config}
            activeGesture={activeGesture}
            onUpdateConfig={onUpdateConfig}
          />
        </div>
      </div>
    </div>
  );
};
