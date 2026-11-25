/**
 * Rabboni Web Connector — Standalone Zero-Dependency ES Module
 * ----------------------------------------------------------------------------
 * Compatible with:
 *   1. Official Rabboni Desktop Bridge (ws://localhost:50500/rab)
 *   2. MotionPlay Android App Bridge (http://127.0.0.1:50501/frames + Bearer code)
 *   3. Custom WebSocket Bridge (MotionPlay JSON or flat {ax,ay,az,gx,gy,gz})
 *   4. Web Bluetooth Direct Fallback (Chrome / Edge)
 *
 * Works in plain HTML (<script type="module">), React, Vue, Vite, or Three.js.
 */

const RAD = Math.PI / 180;
const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const normalized = (v, length = norm(v)) => {
  const safe = length || 1;
  return [v[0] / safe, v[1] / safe, v[2] / safe];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const wallTime = () => performance.timeOrigin + performance.now();

/**
 * Parse a MotionPlay / Rabboni JSON packet.
 * Expected format: { deviceId, name?, acc: [ax, ay, az], gyr: [gx, gy, gz], count?, trigger? }
 */
export function parseRabboniPacket(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const isTriple = (v) =>
    Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
  if (!data || !isTriple(data.acc) || !isTriple(data.gyr)) return null;

  const deviceId =
    typeof data.deviceId === 'string'
      ? data.deviceId.trim()
      : Number.isSafeInteger(data.deviceId) && data.deviceId >= 0
      ? String(data.deviceId)
      : '';
  if (!deviceId) return null;

  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : deviceId;
  const count =
    Array.isArray(data.count) && data.count.every((n) => typeof n === 'number' && Number.isFinite(n))
      ? data.count
      : [];

  return {
    deviceId,
    name,
    acc: [data.acc[0], data.acc[1], data.acc[2]],
    gyr: [data.gyr[0], data.gyr[1], data.gyr[2]],
    count,
    trigger: data.trigger === true,
    receivedAt: Date.now(),
  };
}

/**
 * Connect to official Rabboni Desktop Bridge (default ws://localhost:50500/rab).
 */
export function createDirectRabboniStream(wsUrl = 'ws://localhost:50500/rab') {
  const devices = new Map();
  let socket = null;
  let expiry;
  let connectingTimeout;
  let closed = false;
  const keepAliveMs = 2000;

  const stream = {
    close() {
      closed = true;
      clearTimeout(connectingTimeout);
      clearInterval(expiry);
      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        socket.close();
      }
    },
  };

  function emit() {
    stream.onmessage?.({
      data: JSON.stringify({ source: 'rabboni', state: 'open', packets: [...devices.values()] }),
    });
  }

  function failure() {
    if (closed) return;
    stream.close();
    stream.onerror?.();
    stream.onclose?.();
  }

  try {
    socket = new WebSocket(wsUrl);
  } catch {
    queueMicrotask(failure);
    return stream;
  }

  connectingTimeout = setTimeout(failure, 30000);
  socket.addEventListener('open', () => {
    if (closed) return;
    clearTimeout(connectingTimeout);
    emit();
    expiry = setInterval(() => {
      const cutoff = wallTime() - keepAliveMs;
      let changed = false;
      for (const [id, pkt] of devices) {
        if (pkt.receivedAt >= cutoff) continue;
        devices.delete(id);
        changed = true;
      }
      if (changed) emit();
    }, 250);
  });

  socket.addEventListener('message', ({ data }) => {
    if (closed || typeof data !== 'string') return;
    const packet = parseRabboniPacket(data);
    if (!packet) return;
    packet.receivedAt = Math.max(wallTime(), (devices.get(packet.deviceId)?.receivedAt ?? 0) + 0.001);
    devices.set(packet.deviceId, packet);
    emit();
  });

  socket.addEventListener('error', failure);
  socket.addEventListener('close', failure);
  return stream;
}

/**
 * Connect to MotionPlay Android App local HTTP bridge (http://127.0.0.1:50501/frames).
 */
export function createAndroidRabboniStream(code, fetchFrames = fetch) {
  const seen = new Map();
  let closed = false;
  let next;
  let timeout;
  let request;

  const stream = {
    close() {
      closed = true;
      clearTimeout(next);
      clearTimeout(timeout);
      request?.abort();
    },
  };

  async function poll() {
    request = new AbortController();
    timeout = setTimeout(() => request.abort(), 2800);
    try {
      const response = await fetchFrames('http://127.0.0.1:50501/frames', {
        headers: { Authorization: 'Bearer ' + code },
        signal: request.signal,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        targetAddressSpace: 'loopback',
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401 ? '連線碼錯誤或已更新。' : 'Android App 沒有提供感測資料。'
        );
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Android 資料格式不符。');
      if (closed) return;

      const packets = [];
      const now = wallTime();
      const active = new Set();
      for (const item of data.slice(0, 4)) {
        const packet = parseRabboniPacket(item);
        if (
          !packet ||
          !Number.isFinite(item.sample) ||
          !Number.isFinite(item.ageMs) ||
          item.ageMs < 0 ||
          item.ageMs > 500
        ) {
          continue;
        }
        const prev = seen.get(packet.deviceId);
        packet.receivedAt =
          prev?.sample === item.sample
            ? prev.at
            : Math.max(now - item.ageMs, (prev?.at ?? 0) + 0.001);
        active.add(packet.deviceId);
        seen.set(packet.deviceId, { sample: item.sample, at: packet.receivedAt });
        packets.push(packet);
      }
      for (const id of seen.keys()) {
        if (!active.has(id)) seen.delete(id);
      }
      stream.onmessage?.({
        data: JSON.stringify({ source: 'rabboni', state: 'open', packets }),
      });
      if (!closed) next = setTimeout(poll, 30);
    } catch (error) {
      if (closed) return;
      stream.failure =
        error instanceof TypeError || error?.name === 'AbortError'
          ? '連不到 Android App。請確認已開啟網頁連線，並允許瀏覽器存取本機。'
          : error?.message || 'Android App 連線失敗。';
      stream.close();
      stream.onerror?.();
      stream.onclose?.();
    } finally {
      clearTimeout(timeout);
    }
  }

  next = setTimeout(poll, 0);
  return stream;
}

/**
 * Complementary-filter 6-axis motion controller.
 * Performs 700ms stationary calibration and computes drift-free tilt (x, y) + push/pull gestures.
 */
export class MotionControl {
  neutral = null;
  calibration = null;
  gravity = [0, 0, 1];
  gravityScale = 1;
  bias = [0, 0, 0];
  x = 0;
  y = 0;
  maxRotationRate = 0;
  linearAcceleration = 0;

  #lastSample = -Infinity;
  #gestureAt = -Infinity;
  #quietAt = null;
  #armed = false;

  calibrate() {
    this.neutral = null;
    this.calibration = { since: null, acc: [0, 0, 0], gyr: [0, 0, 0], count: 0 };
    this.x = 0;
    this.y = 0;
    this.#armed = false;
    this.#quietAt = null;
    this.#gestureAt = -Infinity;
  }

  sample(packet, settings) {
    const { acc, gyr, receivedAt: time } = packet;
    if (!(time > this.#lastSample)) return 0;
    const gap = time - this.#lastSample;
    this.#lastSample = time;
    const length = norm(acc);

    if (this.calibration) {
      if (gap > 250 || length < 0.75 || length > 1.25 || norm(gyr) > 22) {
        this.calibrate();
        return 0;
      }
      let c = this.calibration;
      if (c.count && dot(normalized(acc, length), normalized(c.acc)) < 0.992) {
        this.calibrate();
        c = this.calibration;
      }
      c.since ??= time;
      c.count++;
      for (let i = 0; i < 3; i++) {
        c.acc[i] += acc[i];
        c.gyr[i] += gyr[i];
      }
      if (c.count >= 8 && time - c.since >= 700) {
        this.gravityScale = norm(c.acc) / c.count;
        this.gravity = normalized(c.acc);
        this.neutral = [...this.gravity];
        this.bias = c.gyr.map((v) => v / c.count);
        this.calibration = null;
      }
      return 0;
    }

    if (!this.neutral) return 0;
    if (gap > 250) {
      this.#armed = false;
      this.#quietAt = null;
    }

    const dt = Math.min(gap / 1000, 0.08);
    const [gx, gy, gz] = this.gravity;
    const angularRate = gyr.map((v, i) => v - this.bias[i]);
    this.maxRotationRate = Math.max(...angularRate.map(Math.abs));
    const [wx, wy, wz] = angularRate.map((v) => v * RAD);

    const prediction = normalized([
      gx + (gy * wz - gz * wy) * dt,
      gy + (gz * wx - gx * wz) * dt,
      gz + (gx * wy - gy * wx) * dt,
    ]);
    const residual = acc.map((v, i) => v - prediction[i] * this.gravityScale);
    const error = norm(residual);
    this.linearAcceleration = error;

    const alpha =
      Math.abs(length - this.gravityScale) < 0.16 && error < 0.29 ? 1 - Math.exp(-dt * 3.6) : 0;
    this.gravity = alpha
      ? normalized(prediction.map((v, i) => v + (acc[i] / length - v) * alpha))
      : prediction;

    const tilt = (axis, flip) => {
      const angle =
        Math.asin(clamp(this.gravity[axis], -1, 1)) - Math.asin(clamp(this.neutral[axis], -1, 1));
      const usable = Math.sign(angle) * Math.max(0, Math.abs(angle) - 3 * RAD);
      return clamp((usable * settings.gain) / (25 * RAD), -1, 1) * (flip ? -1 : 1);
    };

    this.x = tilt(1 - settings.axis, settings.flipX);
    this.y = tilt(settings.axis, settings.flipY);

    const forward = residual[settings.axis] * (settings.flipPush ? -1 : 1);
    const quiet = Math.abs(forward) < settings.threshold * 0.43 && error < 0.3;
    this.#quietAt = quiet ? this.#quietAt ?? time : null;
    if (this.#quietAt !== null && time - this.#quietAt >= 180 && time - this.#gestureAt >= 540) {
      this.#armed = true;
    }
    if (!this.#armed || Math.abs(forward) < settings.threshold || Math.abs(forward) < 0.67 * error) {
      return 0;
    }
    this.#armed = false;
    this.#quietAt = null;
    this.#gestureAt = time;
    return Math.sign(forward);
  }
}

/**
 * High-level game-agnostic Rabboni connector for rapid reuse across projects.
 */
export class RabboniConnector {
  constructor(options = {}) {
    this.config = {
      gain: 1.0,
      threshold: 0.38,
      axis: 1,
      flipX: false,
      flipY: false,
      flipPush: false,
      gyroThreshold: 85,
      ...(options.config || {}),
    };
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onPacket = options.onPacket || (() => {});
    this.onGesture = options.onGesture || (() => {});
    this.onError = options.onError || (() => {});

    this.source = 'manual';
    this.devices = new Map();
    this.selectedDeviceId = '';
    this.lastPacket = null;
    this.motion = new MotionControl();
    this.transport = null;
    this.statusMessage = '鍵盤／觸控模式';
  }

  isFresh() {
    return !!this.lastPacket && wallTime() - this.lastPacket.receivedAt <= 500;
  }

  getState() {
    return {
      source: this.source,
      connected: !!this.transport,
      fresh: this.isFresh(),
      calibrating: !!this.motion.calibration,
      calibrated: !!this.motion.neutral,
      statusMessage: this.statusMessage,
      devices: [...this.devices.values()].map((d) => ({ deviceId: d.deviceId, name: d.name })),
      selectedDeviceId: this.selectedDeviceId,
      x: this.motion.x,
      y: this.motion.y,
      maxRotationRate: this.motion.maxRotationRate,
      linearAcceleration: this.motion.linearAcceleration,
      raw: this.lastPacket,
    };
  }

  setConfig(partial) {
    this.config = { ...this.config, ...partial };
  }

  selectDevice(deviceId) {
    this.selectedDeviceId = deviceId;
    this.motion = new MotionControl();
    this.lastPacket = this.devices.get(deviceId) || null;
    this.#emitStatus();
  }

  calibrate() {
    if (!this.isFresh()) return false;
    this.motion.calibrate();
    this.statusMessage = '請保持不動 · 校正中';
    this.#emitStatus();
    return true;
  }

  connectDesktop(wsUrl = 'ws://localhost:50500/rab') {
    this.disconnect();
    this.source = 'desktop';
    this.#attachStream(createDirectRabboniStream(wsUrl));
  }

  connectAndroid(code) {
    this.disconnect();
    this.source = 'android';
    this.#attachStream(createAndroidRabboniStream(code.trim()));
  }

  disconnect() {
    this.transport?.close();
    this.transport = null;
    this.devices.clear();
    this.selectedDeviceId = '';
    this.lastPacket = null;
    this.motion = new MotionControl();
    this.source = 'manual';
    this.statusMessage = '鍵盤／觸控模式';
    this.#emitStatus();
  }

  #emitStatus() {
    this.onStatusChange(this.getState());
  }

  #attachStream(stream) {
    this.transport = stream;
    this.statusMessage = '正在連線…';
    this.#emitStatus();

    stream.onmessage = ({ data }) => {
      if (this.transport !== stream) return;
      const { packets } = JSON.parse(data);
      this.devices = new Map(packets.map((p) => [p.deviceId, p]));

      if (!this.selectedDeviceId && this.devices.size > 0) {
        this.selectedDeviceId = this.devices.keys().next().value;
        this.motion = new MotionControl();
      }

      const pkt = this.devices.get(this.selectedDeviceId);
      if (pkt && (!this.lastPacket || pkt.receivedAt > this.lastPacket.receivedAt)) {
        const wasCalibrated = !!this.motion.neutral;
        this.lastPacket = pkt;
        const pulse = this.motion.sample(pkt, this.config);

        if (this.motion.calibration) this.statusMessage = '請保持不動 · 校正中';
        else if (this.motion.neutral) this.statusMessage = '六軸資料更新中 · 已就緒';
        else this.statusMessage = '已收到六軸資料 · 請校正中央握姿';

        if (!wasCalibrated && this.motion.neutral) this.#emitStatus();

        const state = this.getState();
        this.onPacket(state);
        if (pulse !== 0) {
          this.onGesture(pulse > 0 ? 'push' : 'pull', state);
        }
      } else {
        this.statusMessage = this.devices.size
          ? '請選擇一顆感測器'
          : '橋接已連線 · 等待裝置資料';
        this.#emitStatus();
      }
    };

    stream.onerror = () => {
      if (this.transport !== stream) return;
      const reason = stream.failure || '無法連上 Rabboni 橋接，請確認程式已啟動。';
      this.transport = null;
      this.statusMessage = reason;
      this.onError(reason);
      this.#emitStatus();
    };
  }
}
