export type RabboniSource = 'manual' | 'desktop' | 'android';

export interface RabboniConfig {
  gain: number;
  threshold: number;
  axis: 0 | 1;
  flipX: boolean;
  flipY: boolean;
  flipPush: boolean;
  gyroThreshold: number;
}

export interface RabboniPacket {
  deviceId: string;
  name: string;
  acc: [number, number, number];
  gyr: [number, number, number];
  count: number[];
  trigger: boolean;
  receivedAt: number;
}

export interface RabboniDeviceSummary {
  deviceId: string;
  name: string;
}

export interface RabboniState {
  source: RabboniSource;
  connected: boolean;
  fresh: boolean;
  calibrating: boolean;
  calibrated: boolean;
  statusMessage: string;
  devices: RabboniDeviceSummary[];
  selectedDeviceId: string;
  x: number;
  y: number;
  maxRotationRate: number;
  linearAcceleration: number;
  raw: RabboniPacket | null;
}

export interface RabboniConnectorOptions {
  config?: Partial<RabboniConfig>;
  onStatusChange?: (state: RabboniState) => void;
  onPacket?: (state: RabboniState) => void;
  onGesture?: (type: 'push' | 'pull', state: RabboniState) => void;
  onError?: (message: string) => void;
}

export declare function wallTime(): number;
export declare function parseRabboniPacket(raw: unknown): RabboniPacket | null;

export declare class MotionControl {
  neutral: [number, number, number] | null;
  calibration: {
    since: number | null;
    acc: [number, number, number];
    gyr: [number, number, number];
    count: number;
  } | null;
  gravity: [number, number, number];
  gravityScale: number;
  bias: [number, number, number];
  x: number;
  y: number;
  maxRotationRate: number;
  linearAcceleration: number;
  calibrate(): void;
  sample(packet: RabboniPacket, settings: RabboniConfig): number;
}

export declare class RabboniConnector {
  config: RabboniConfig;
  source: RabboniSource;
  selectedDeviceId: string;
  statusMessage: string;
  motion: MotionControl;
  constructor(options?: RabboniConnectorOptions);
  isFresh(): boolean;
  getState(): RabboniState;
  setConfig(partial: Partial<RabboniConfig>): void;
  selectDevice(deviceId: string): void;
  calibrate(): boolean;
  connectDesktop(wsUrl?: string): void;
  connectAndroid(code: string): void;
  disconnect(): void;
}
