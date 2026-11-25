/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AboutModal } from './components/AboutModal';
import { HudOverlay } from './components/HudOverlay';
import { SensorModal } from './components/SensorModal';
import { CanyonEngine, type CameraView, type HudSnapshot } from './game/CanyonEngine';
import {
  RabboniConnector,
  type RabboniConfig,
  type RabboniSource,
  type RabboniState,
} from './lib/rabboni-connector';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  score: 0,
  highScore: 0,
  distance: 0,
  speedKmh: 1296,
  hull: 100,
  combo: 1,
  ringsPassed: 0,
  towersDestroyed: 0,
  asteroidsDestroyed: 0,
  barrelRollReady: 1,
  barrelRollActive: false,
  boostAmount: 0,
  lowAltitudeBonus: false,
  rollInput: 0,
  pitchInput: 0,
  reticleX: 0,
  reticleY: 0,
  callout: null,
  damageFlash: 0,
  webglFallback: false,
};

const INITIAL_CONFIG: RabboniConfig = {
  gain: 1.1,
  threshold: 0.38,
  axis: 1,
  flipX: false,
  flipY: false,
  flipPush: false,
  gyroThreshold: 135,
};

const INITIAL_SENSOR_STATE: RabboniState = {
  source: 'manual',
  connected: false,
  fresh: false,
  calibrating: false,
  calibrated: false,
  statusMessage: '鍵盤／觸控模式',
  devices: [],
  selectedDeviceId: '',
  x: 0,
  y: 0,
  maxRotationRate: 0,
  linearAcceleration: 0,
  raw: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CanyonEngine | null>(null);
  const rabboniRef = useRef<RabboniConnector | null>(null);
  const configRef = useRef<RabboniConfig>(INITIAL_CONFIG);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [sensorState, setSensorState] = useState<RabboniState>(INITIAL_SENSOR_STATE);
  const [sensorConfig, setSensorConfig] = useState<RabboniConfig>(INITIAL_CONFIG);
  const [wsUrl, setWsUrl] = useState('ws://localhost:50500/rab');
  const [androidCode, setAndroidCode] = useState('');
  const [sensorError, setSensorError] = useState('');

  const [sensorModalOpen, setSensorModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraView, setCameraView] = useState<CameraView>('chase');
  const [autoFire, setAutoFire] = useState(true);
  const [dockOpen, setDockOpen] = useState(true);

  // Refs for real-time keyboard / touch input state
  const keysRef = useRef<Set<string>>(new Set());
  const pointerActiveRef = useRef(false);
  const pointerOriginRef = useRef({ x: 0, y: 0 });
  const pointerTiltRef = useRef({ roll: 0, pitch: 0 });
  const lastFlickAtRef = useRef(0);
  const lastSensorUiSyncRef = useRef(0);

  // Mount Three.js CanyonEngine once in an isolated ref container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;
    const engine = new CanyonEngine(mount, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Initialize Rabboni 6-axis Connector once
  useEffect(() => {
    const rabboni = new RabboniConnector({
      config: INITIAL_CONFIG,
      onStatusChange(state) {
        setSensorState(state);
      },
      onPacket(state) {
        const now = performance.now();
        // Throttle React UI state updates for live sensor gauges (~20Hz)
        if (now - lastSensorUiSyncRef.current >= 50) {
          lastSensorUiSyncRef.current = now;
          setSensorState(state);
        }

        // Feed live dual-axis tilt into 3D fighter when calibrated
        if (state.source !== 'manual' && state.calibrated && state.fresh && engineRef.current) {
          engineRef.current.setInput({
            roll: state.x,
            pitch: state.y,
          });

          // Quick wrist flick triggers Barrel Roll invulnerability
          const gyroLimit = configRef.current.gyroThreshold;
          if (
            (state.maxRotationRate >= gyroLimit || state.linearAcceleration >= 0.85) &&
            now - lastFlickAtRef.current > 650
          ) {
            const dir = Math.abs(state.x) > 0.15 ? Math.sign(state.x) : 1;
            if (engineRef.current.triggerBarrelRoll(dir)) {
              lastFlickAtRef.current = now;
            }
          }
        }
      },
      onGesture(_type, state) {
        const now = performance.now();
        if (state.calibrated && engineRef.current && now - lastFlickAtRef.current > 650) {
          const dir = Math.abs(state.x) > 0.15 ? Math.sign(state.x) : 1;
          if (engineRef.current.triggerBarrelRoll(dir)) {
            lastFlickAtRef.current = now;
          }
        }
      },
      onError(message) {
        setSensorError(message);
      },
    });

    rabboniRef.current = rabboni;

    const handlePageHide = () => rabboni.disconnect();
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      rabboni.disconnect();
      rabboniRef.current = null;
    };
  }, []);

  // Recompute manual keyboard + touch input
  const syncManualInput = useCallback(() => {
    const rabboni = rabboniRef.current;
    const sensorControlling =
      rabboni && rabboni.source !== 'manual' && rabboni.getState().calibrated && rabboni.isFresh();

    const keys = keysRef.current;
    let roll = pointerActiveRef.current ? pointerTiltRef.current.roll : 0;
    let pitch = pointerActiveRef.current ? pointerTiltRef.current.pitch : 0;

    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;

    const firing = keys.has('Space') || pointerActiveRef.current;

    if (engineRef.current) {
      if (sensorControlling) {
        engineRef.current.setInput({ firing });
      } else {
        engineRef.current.setInput({ roll, pitch, firing });
      }
    }
  }, []);

  // Global keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const code = e.code;
      if (
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyE' || code === 'KeyQ') {
        const dir = code === 'KeyQ' ? -1 : code === 'KeyE' ? 1 : undefined;
        engineRef.current?.triggerBarrelRoll(dir);
        return;
      }

      if (code === 'KeyP' || code === 'Escape') {
        if (sensorModalOpen) {
          setSensorModalOpen(false);
        } else if (aboutModalOpen) {
          setAboutModalOpen(false);
        } else {
          engineRef.current?.togglePause();
        }
        return;
      }

      if (code === 'KeyC') {
        setCameraView((prev) => {
          const next: CameraView = prev === 'chase' ? 'cockpit' : 'chase';
          engineRef.current?.setCameraView(next);
          return next;
        });
        return;
      }

      if (code === 'KeyH') {
        setDockOpen((prev) => !prev);
        return;
      }

      keysRef.current.add(code);
      syncManualInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      syncManualInput();
    };

    const onBlur = () => {
      keysRef.current.clear();
      pointerActiveRef.current = false;
      pointerTiltRef.current = { roll: 0, pitch: 0 };
      syncManualInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [aboutModalOpen, sensorModalOpen, syncManualInput]);

  // Pointer / Touch drag flight control directly on the 3D canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hud.phase !== 'playing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerActiveRef.current = true;
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
    pointerTiltRef.current = { roll: 0, pitch: 0 };
    engineRef.current?.fireManualBurst();
    syncManualInput();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current || hud.phase !== 'playing') return;
    const dx = (e.clientX - pointerOriginRef.current.x) / 95;
    const dy = (pointerOriginRef.current.y - e.clientY) / 85;
    pointerTiltRef.current = {
      roll: Math.max(-1, Math.min(1, dx)),
      pitch: Math.max(-1, Math.min(1, dy)),
    };
    syncManualInput();
  };

  const handlePointerUp = () => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    pointerTiltRef.current = { roll: 0, pitch: 0 };
    syncManualInput();
  };

  // Sensor & UI action handlers
  const handleSelectSource = (source: RabboniSource) => {
    setSensorError('');
    if (source === 'manual') {
      rabboniRef.current?.disconnect();
    } else if (rabboniRef.current) {
      rabboniRef.current.disconnect();
      rabboniRef.current.source = source;
      setSensorState({
        ...rabboniRef.current.getState(),
        source,
        statusMessage: source === 'desktop' ? '尚未連線電腦橋接' : '請輸入 Android 連線碼並連線',
      });
    }
  };

  const handleConnectDesktop = () => {
    setSensorError('');
    rabboniRef.current?.connectDesktop(wsUrl.trim() || 'ws://localhost:50500/rab');
  };

  const handleConnectAndroid = () => {
    if (!androidCode.trim()) return;
    setSensorError('');
    rabboniRef.current?.connectAndroid(androidCode.trim());
  };

  const handleDisconnect = () => {
    setSensorError('');
    rabboniRef.current?.disconnect();
  };

  const handleSelectDevice = (deviceId: string) => {
    rabboniRef.current?.selectDevice(deviceId);
  };

  const handleCalibrate = () => {
    setSensorError('');
    const ok = rabboniRef.current?.calibrate();
    if (!ok) {
      setSensorError('目前尚未收到感測器即時資料，請確認裝置已開啟並連線。');
    }
  };

  const handleUpdateConfig = (partial: Partial<RabboniConfig>) => {
    setSensorConfig((prev) => {
      const next = { ...prev, ...partial };
      configRef.current = next;
      rabboniRef.current?.setConfig(next);
      return next;
    });
  };

  const handleStart = () => {
    setSensorModalOpen(false);
    setAboutModalOpen(false);
    engineRef.current?.startGame();
  };

  const handleTogglePause = () => {
    engineRef.current?.togglePause();
  };

  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.sound.setMuted(next);
      return next;
    });
  };

  const handleToggleCamera = () => {
    setCameraView((prev) => {
      const next: CameraView = prev === 'chase' ? 'cockpit' : 'chase';
      engineRef.current?.setCameraView(next);
      return next;
    });
  };

  const handleToggleAutoFire = () => {
    setAutoFire((prev) => {
      const next = !prev;
      engineRef.current?.setAutoFire(next);
      return next;
    });
  };

  const handleBarrelRoll = () => {
    engineRef.current?.triggerBarrelRoll();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070a14]">
      {/* Dedicated Isolated 3D WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Graceful WebGL Fallback */}
      {hud.webglFallback && (
        <div className="fixed inset-0 z-10 flex items-center justify-center p-6 bg-gradient-to-b from-[#0a1024] to-[#070a14]">
          <div className="max-w-md text-center space-y-3 bg-[#0c1222] border border-slate-700/70 rounded-xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-100">
              WebGL 3D 渲染目前無法使用
            </h2>
            <p className="text-sm text-slate-400">
              請確認瀏覽器已開啟硬體加速與 WebGL 支援，再重新整理頁面以啟動星際峽谷戰機。
            </p>
          </div>
        </div>
      )}

      {/* Semantic DOM HUD Overlay */}
      <HudOverlay
        hud={hud}
        sensorState={sensorState}
        muted={muted}
        cameraView={cameraView}
        autoFire={autoFire}
        dockOpen={dockOpen}
        onStart={handleStart}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
        onToggleCamera={handleToggleCamera}
        onToggleAutoFire={handleToggleAutoFire}
        onToggleDock={() => setDockOpen((prev) => !prev)}
        onOpenSensor={() => setSensorModalOpen(true)}
        onOpenAbout={() => setAboutModalOpen(true)}
        onCalibrate={handleCalibrate}
        onBarrelRoll={handleBarrelRoll}
      />

      {/* Rabboni 6-Axis Sensor Connection & Calibration Modal */}
      <SensorModal
        open={sensorModalOpen}
        onClose={() => setSensorModalOpen(false)}
        sensorState={sensorState}
        config={sensorConfig}
        wsUrl={wsUrl}
        androidCode={androidCode}
        errorText={sensorError}
        onWsUrlChange={setWsUrl}
        onAndroidCodeChange={setAndroidCode}
        onSelectSource={handleSelectSource}
        onConnectDesktop={handleConnectDesktop}
        onConnectAndroid={handleConnectAndroid}
        onDisconnect={handleDisconnect}
        onSelectDevice={handleSelectDevice}
        onCalibrate={handleCalibrate}
        onUpdateConfig={handleUpdateConfig}
      />

      {/* About Modal with Required Attribution */}
      <AboutModal open={aboutModalOpen} onClose={() => setAboutModalOpen(false)} />
    </div>
  );
}
