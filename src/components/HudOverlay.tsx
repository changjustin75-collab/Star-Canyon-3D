import React from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Info,
  Eye,
  Compass,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Crosshair,
} from 'lucide-react';
import type { CameraView, HudSnapshot } from '../game/CanyonEngine';
import type { RabboniConfig, RabboniState } from '../lib/rabboni-connector';
import { MotionCompass, type GestureFeedback } from './MotionCompass';

interface HudOverlayProps {
  hud: HudSnapshot;
  sensorState: RabboniState;
  sensorConfig: RabboniConfig;
  activeGesture: GestureFeedback | null;
  muted: boolean;
  cameraView: CameraView;
  autoFire: boolean;
  dockOpen: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleAutoFire: () => void;
  onToggleDock: () => void;
  onOpenSensor: () => void;
  onOpenAbout: () => void;
  onCalibrate: () => void;
  onBarrelRoll: () => void;
  onUpdateConfig: (partial: Partial<RabboniConfig>) => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  sensorState,
  sensorConfig,
  activeGesture,
  muted,
  cameraView,
  autoFire,
  dockOpen,
  onStart,
  onTogglePause,
  onToggleMute,
  onToggleCamera,
  onToggleAutoFire,
  onToggleDock,
  onOpenSensor,
  onOpenAbout,
  onCalibrate,
  onBarrelRoll,
  onUpdateConfig,
}) => {
  const sensorConnected = sensorState.source !== 'manual' && (sensorState.connected || sensorState.fresh);
  const sourceLabel =
    sensorState.source === 'desktop'
      ? '電腦橋接'
      : sensorState.source === 'android'
      ? 'Android App'
      : '鍵盤／觸控';

  const hullColor =
    hud.hull > 55 ? 'bg-cyan-400' : hud.hull > 25 ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* Damage Red Vignette Flash */}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle, transparent 48%, rgba(244, 63, 94, ${
              hud.damageFlash * 0.55
            }) 100%)`,
          }}
        />
      )}

      {/* TOP BAR */}
      <header className="relative z-20 flex items-center justify-between gap-4 px-4 sm:px-6 py-3 pointer-events-auto">
        {/* Left Zone: Brand or Flight Score & Hull */}
        <div className="flex items-center gap-5 min-w-0">
          <div className="font-display text-base sm:text-lg font-bold tracking-wider text-slate-100 whitespace-nowrap shrink-0">
            STAR CANYON 3D
          </div>

          {hud.phase !== 'title' && (
            <div className="hidden sm:flex items-center gap-5 text-xs text-slate-300 bg-[#080d1a]/85 border border-slate-700/60 rounded-lg px-4 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-slate-400">分數</span>
                <span className="font-mono-num text-base font-bold text-cyan-300">
                  {hud.score.toLocaleString()}
                </span>
                {hud.combo > 1 && (
                  <span className="font-mono-num text-amber-400 font-bold">x{hud.combo}</span>
                )}
              </div>

              <span className="text-slate-700" aria-hidden="true">
                /
              </span>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">護盾</span>
                <div className="w-24 h-2 rounded bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${hullColor}`}
                    style={{ width: `${hud.hull}%` }}
                  />
                </div>
                <span className="font-mono-num text-slate-200 w-9 text-right">{hud.hull}%</span>
              </div>

              <span className="text-slate-700" aria-hidden="true">
                /
              </span>

              <div className="flex items-baseline gap-1.5">
                <span className="font-mono-num text-sm font-bold text-slate-100">
                  {hud.speedKmh}
                </span>
                <span className="text-slate-400">km/h</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Zone: Clean Single-Line Action Menu */}
        <nav className="flex items-center gap-1.5 sm:gap-2 bg-[#080d1a]/85 border border-slate-700/60 rounded-lg p-1 shrink-0">
          <button
            type="button"
            onClick={onOpenSensor}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-cyan-300 hover:bg-slate-800/70 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{sourceLabel}</span>
          </button>

          <button
            type="button"
            onClick={onToggleCamera}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="切換視角 (C)"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>{cameraView === 'chase' ? '追尾視角' : '座艙視角'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 rounded-md transition-colors cursor-pointer shrink-0"
            aria-label={muted ? '開啟音效' : '靜音'}
            title={muted ? '開啟音效' : '靜音'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {(hud.phase === 'playing' || hud.phase === 'paused') && (
            <button
              type="button"
              onClick={onTogglePause}
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 rounded-md transition-colors cursor-pointer shrink-0"
              aria-label={hud.phase === 'paused' ? '繼續遊戲' : '暫停遊戲'}
              title="暫停 / 繼續 (P)"
            >
              {hud.phase === 'paused' ? (
                <Play className="w-4 h-4 text-cyan-400" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAbout}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>關於</span>
          </button>
        </nav>
      </header>

      {/* Mobile Compact Flight Telemetry Strip */}
      {hud.phase !== 'title' && (
        <div className="sm:hidden flex items-center justify-between px-4 py-1.5 mx-4 bg-[#080d1a]/85 border border-slate-700/60 rounded-lg text-xs">
          <div className="font-mono-num font-bold text-cyan-300">
            {hud.score.toLocaleString()} {hud.combo > 1 ? `x${hud.combo}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded bg-slate-800 overflow-hidden">
              <div className={`h-full ${hullColor}`} style={{ width: `${hud.hull}%` }} />
            </div>
            <span className="font-mono-num text-slate-200">{hud.hull}%</span>
          </div>
          <div className="font-mono-num text-slate-300">{hud.speedKmh} km/h</div>
        </div>
      )}

      {/* CENTER FLIGHT RETICLE, CORNER COMPASS & CALLOUT (Unobstructed during active flight) */}
      {hud.phase === 'playing' && (
        <>
          {/* Compact Top-Left 6-Axis Motion Compass when Rabboni Sensor is Connected */}
          {sensorConnected && (
            <div className="fixed top-20 sm:top-16 left-4 sm:left-6 z-20 pointer-events-none">
              <MotionCompass
                variant="compact"
                sensorState={sensorState}
                config={sensorConfig}
                activeGesture={activeGesture}
              />
            </div>
          )}

          {/* Dynamic Targeting Crosshair */}
          <div
            className="fixed left-1/2 top-1/2 pointer-events-none transition-transform duration-75"
            style={{
              transform: `translate(calc(-50% + ${hud.reticleX * 34}vw), calc(-50% - ${
                hud.reticleY * 34
              }vh))`,
            }}
          >
            <div
              className={`relative w-11 h-11 flex items-center justify-center transition-transform duration-100 ${
                hud.barrelRollActive ? 'scale-125' : 'scale-100'
              }`}
              style={{ transform: `rotate(${-hud.rollInput * 28}deg)` }}
            >
              <div
                className={`w-7 h-7 rounded-full border ${
                  hud.barrelRollActive
                    ? 'border-amber-400'
                    : hud.boostAmount > 0.2
                    ? 'border-cyan-300'
                    : 'border-cyan-400/70'
                }`}
              />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-cyan-300" />
              <div className="absolute -left-2.5 w-2 h-px bg-cyan-400/80" />
              <div className="absolute -right-2.5 w-2 h-px bg-cyan-400/80" />
            </div>
          </div>

          {/* Flight Event Callout */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1.5">
            {hud.callout && (
              <div
                key={hud.callout.id}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-display font-bold tracking-wider bg-[#080d1a]/88 border ${
                  hud.callout.tone === 'amber'
                    ? 'text-amber-300 border-amber-500/45'
                    : hud.callout.tone === 'rose'
                    ? 'text-rose-300 border-rose-500/45'
                    : 'text-cyan-300 border-cyan-500/45'
                }`}
              >
                {hud.callout.text}
              </div>
            )}
            {hud.lowAltitudeBonus && (
              <div className="text-[11px] font-mono-num tracking-wider text-amber-300/90">
                貼地超低空高速加成 +SPEED
              </div>
            )}
          </div>
        </>
      )}

      {/* TITLE SCREEN OVERLAY */}
      {hud.phase === 'title' && (
        <main className="relative z-20 flex-1 flex items-center justify-center px-4 overflow-y-auto pointer-events-none">
          <div
            className={`w-full pointer-events-auto grid gap-4 items-center ${
              sensorConnected ? 'max-w-5xl lg:grid-cols-[1fr_1.08fr]' : 'max-w-lg grid-cols-1'
            }`}
          >
            <div className="w-full text-center space-y-6 bg-[#080d1a]/84 border border-slate-700/60 rounded-2xl px-6 sm:px-9 py-8 shadow-2xl">
              <div className="space-y-2.5">
                <div className="text-xs font-mono-num tracking-widest text-cyan-400">
                  SUPERSONIC 6-AXIS MOTION FLIGHT
                </div>
                <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white [text-wrap:balance]">
                  星際峽谷戰機
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  貼地飛越霓虹峽谷與隕石陣，穿越能量環啟動超音速加速，鎖定並擊毀防禦塔。
                </p>
              </div>

              {/* Clean unboxed flight mechanic metadata */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span>左右傾斜翻滾閃避</span>
                <span aria-hidden="true">·</span>
                <span>前後傾角爬升俯衝</span>
                <span aria-hidden="true">·</span>
                <span>快速甩動桶滾無敵</span>
              </div>

              {hud.highScore > 0 && (
                <div className="text-xs text-slate-400">
                  最高航行紀錄{' '}
                  <span className="font-mono-num text-amber-300 font-bold ml-1">
                    {hud.highScore.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onStart}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl font-display font-bold text-base tracking-wide bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                >
                  開始出擊
                </button>
                <button
                  type="button"
                  onClick={onOpenSensor}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-medium bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {sensorConnected ? '感測器與方向儀設定' : '連線 Rabboni 感測器'}
                </button>
              </div>
            </div>

            {/* Pre-Game Live 6-Axis Compass Verification Panel when Sensor is Connected */}
            {sensorConnected && (
              <div className="w-full bg-[#080d1a]/88 border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300 font-medium">
                    開飛前握姿確認 · <span className="text-cyan-300">{sensorState.statusMessage}</span>
                  </span>
                  <button
                    type="button"
                    onClick={onCalibrate}
                    disabled={!sensorState.fresh}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>{sensorState.calibrating ? '校正中…' : '校正中央握姿'}</span>
                  </button>
                </div>
                <MotionCompass
                  variant="full"
                  sensorState={sensorState}
                  config={sensorConfig}
                  activeGesture={activeGesture}
                  onUpdateConfig={onUpdateConfig}
                />
              </div>
            )}
          </div>
        </main>
      )}

      {/* PAUSED OVERLAY */}
      {hud.phase === 'paused' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#04060d]/70 pointer-events-auto">
          <div className="w-full max-w-sm bg-[#0c1222] border border-slate-700/70 rounded-xl p-6 text-center space-y-5 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">航行已暫停</h2>
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#080d1a] border border-slate-800 rounded-lg p-3.5">
              <div>
                <div className="text-slate-400">目前分數</div>
                <div className="font-mono-num text-base font-bold text-cyan-300 mt-0.5">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-slate-400">飛行距離</div>
                <div className="font-mono-num text-base font-bold text-slate-100 mt-0.5">
                  {hud.distance.toLocaleString()} m
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="w-full py-2.5 rounded-lg font-display font-bold text-sm bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors cursor-pointer"
              >
                繼續飛行
              </button>
              <button
                type="button"
                onClick={onStart}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                重新開始
              </button>
              <button
                type="button"
                onClick={onOpenAbout}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-transparent hover:bg-slate-800/70 border border-slate-700/80 text-slate-300 transition-colors cursor-pointer"
              >
                關於
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER OVERLAY */}
      {hud.phase === 'gameover' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#04060d]/75 pointer-events-auto">
          <div className="w-full max-w-md bg-[#0c1222] border border-slate-700/70 rounded-2xl p-7 text-center space-y-6 shadow-2xl">
            <div className="space-y-1">
              <div className="text-xs font-mono-num tracking-widest text-rose-400">
                MISSION TERMINATED
              </div>
              <h2 className="font-display text-3xl font-bold text-white">護盾耗盡</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left bg-[#080d1a] border border-slate-800 rounded-xl p-4">
              <div>
                <div className="text-xs text-slate-400">最終分數</div>
                <div className="font-mono-num text-xl font-bold text-cyan-300">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">最高紀錄</div>
                <div className="font-mono-num text-xl font-bold text-amber-300">
                  {hud.highScore.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">能量環穿越</div>
                <div className="font-mono-num text-base font-bold text-slate-100">
                  {hud.ringsPassed}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">擊毀防禦塔 / 隕石</div>
                <div className="font-mono-num text-base font-bold text-slate-100">
                  {hud.towersDestroyed} / {hud.asteroidsDestroyed}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onStart}
                className="flex-1 py-3 rounded-xl font-display font-bold text-sm bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors cursor-pointer"
              >
                再次出擊
              </button>
              <button
                type="button"
                onClick={onOpenSensor}
                className="px-4 py-3 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                體感設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM CONTROL DOCK */}
      <footer className="relative z-20 flex flex-col items-center pb-3 px-3 pointer-events-none">
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 mb-1 rounded-t-lg bg-[#080d1a]/88 border border-b-0 border-slate-700/60 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="隱藏或展開底部控制列 (H)"
        >
          {dockOpen ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>收合控制列</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>展開控制列</span>
            </>
          )}
        </button>

        {dockOpen && (
          <div className="pointer-events-auto w-full max-w-[780px] flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3.5 py-2.5 rounded-xl bg-[#080d1a]/90 border border-slate-700/70 shadow-xl text-xs">
            {/* Barrel Roll Trigger + Readiness Meter */}
            <button
              type="button"
              onClick={onBarrelRoll}
              disabled={hud.phase !== 'playing' || hud.barrelRollReady < 0.99}
              className={`relative overflow-hidden flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hud.barrelRollActive
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : hud.barrelRollReady >= 0.99 && hud.phase === 'playing'
                  ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200 hover:bg-cyan-500/30'
                  : 'bg-slate-900/90 border-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-cyan-400/15 pointer-events-none"
                style={{ width: `${Math.round(hud.barrelRollReady * 100)}%` }}
              />
              <RotateCw className="w-3.5 h-3.5 relative z-10 shrink-0" />
              <span className="relative z-10">
                {hud.barrelRollActive
                  ? '桶滾無敵中'
                  : hud.barrelRollReady >= 0.99
                  ? '桶滾閃避 (Shift)'
                  : `充能 ${Math.round(hud.barrelRollReady * 100)}%`}
              </span>
            </button>

            {/* Quick Calibrate when Rabboni active */}
            {sensorState.source !== 'manual' && (
              <button
                type="button"
                onClick={onCalibrate}
                disabled={!sensorState.fresh}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 border border-amber-500/40 text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span>{sensorState.calibrating ? '校正中…' : '校正中央握姿'}</span>
              </button>
            )}

            {/* Auto-Fire Toggle */}
            <button
              type="button"
              onClick={onToggleAutoFire}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                autoFire
                  ? 'bg-slate-800/90 border-cyan-500/40 text-cyan-200'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" />
              <span>{autoFire ? '自動鎖定開火：開' : '自動鎖定開火：關'}</span>
            </button>

            {/* Live Compact Attitude Readout */}
            <div className="hidden md:flex items-center gap-3 text-slate-400 font-mono-num ml-auto">
              <span>ROLL {hud.rollInput >= 0 ? '+' : ''}{hud.rollInput.toFixed(2)}</span>
              <span aria-hidden="true">·</span>
              <span>PITCH {hud.pitchInput >= 0 ? '+' : ''}{hud.pitchInput.toFixed(2)}</span>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};
