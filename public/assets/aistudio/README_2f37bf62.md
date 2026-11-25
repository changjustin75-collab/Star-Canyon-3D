# Rabboni 跨專案連線模組（Zero-Dependency Kit）

本目錄中的 `rabboni-connector.js` 為**零外部相依**的標準 ES Module，可直接複製到任何網頁專案（純 HTML/JS、Vite、React、Vue、Three.js、Canvas 2D）中使用，完整相容 `MotionPlay-Single-Sensor-Games` 的連線與校正規格。

---

## 支援的連線方式

1. **Rabboni 電腦橋接**：`ws://localhost:50500/rab`
   - 自動探索多顆感測器，超過 2 秒未收到封包自動移除離線裝置。
2. **MotionPlay Android App 網頁連線**：`http://127.0.0.1:50501/frames`
   - 透過 `Authorization: Bearer <連線碼>` 輪詢（每 30ms），含 `targetAddressSpace: 'loopback'` 與 `ageMs <= 500ms` 驗證。
3. **6 軸互補濾波與 700ms 靜止校正（`MotionControl`）**
   - 靜止校正自動估算重力向量與陀螺儀三軸零偏（bias）。
   - 輸出穩定、不漂移的傾斜控制量 `x`（左右 `-1 ~ +1`）、`y`（上下 `-1 ~ +1`）、角速度最大值 `maxRotationRate`，以及前推 `push`／後拉 `pull` 手勢事件。

---

## 快速整合範例（純 HTML / JS 或 React 通用）

```js
import { RabboniConnector } from './rabboni-connector.js';

const rabboni = new RabboniConnector({
  config: {
    gain: 1.0,          // 傾斜靈敏度 (0.5 ~ 2.0)
    threshold: 0.38,    // 推拉觸發門檻 (g)
    axis: 1,            // 1 = Y 軸前後、X 軸左右；0 = X 軸前後、Y 軸左右
    flipX: false,       // 反轉左右
    flipY: false,       // 反轉上下
    flipPush: false,    // 反轉推拉方向
  },
  onStatusChange(state) {
    console.log('連線狀態：', state.statusMessage, '已發現裝置：', state.devices);
  },
  onPacket(state) {
    // 遊戲主迴圈或即時讀值：
    // state.x (-1 ~ 1), state.y (-1 ~ 1), state.maxRotationRate (°/s)
  },
  onGesture(type) {
    // type 為 'push'（前推）或 'pull'（後拉）
    if (type === 'push') console.log('觸發前推動作！');
  },
  onError(message) {
    console.warn('連線失敗：', message);
  },
});

// 1. 連線原廠電腦橋接：
rabboni.connectDesktop();

// 或 2. 連線 Android App（傳入 App 顯示的連線碼）：
// rabboni.connectAndroid('你的連線碼');

// 3. 收到資料後，請玩家握穩並執行靜止校正（約 0.7 秒完成）：
// rabboni.calibrate();

// 4. 離開頁面時自動關閉連線：
window.addEventListener('pagehide', () => rabboni.disconnect());
```

---

## 在 AI Studio 開新專案時的快速提示詞

將 `rabboni-connector.js` 上傳為新專案的附件後，直接在提示詞加入以下一段即可無痛沿用：

> 請使用附件的 `rabboni-connector.js` 作為本專案的 Rabboni 6 軸感測器連線與姿態校正核心，提供「鍵盤／觸控」、「Rabboni 電腦橋接（ws://localhost:50500/rab）」與「MotionPlay Android App（127.0.0.1:50501 + 連線碼）」切換、裝置選擇下拉選單、以及「校正中央握姿」按鈕。

## 在 選單中加入"關於"，內容註明："<a href="https://rabboni.teachthinking.uk/">MotionPlay</a> © 2026 張世杰老師 <a href="https://sipp.com.tw/#playchip">Rabboni 感測器 · 矽譜科技</a>"