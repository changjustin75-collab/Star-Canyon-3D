import * as THREE from 'three';

export interface ProceduralTextures {
  canyonFloorMap: THREE.CanvasTexture;
  canyonFloorEmissive: THREE.CanvasTexture;
  canyonCliffMap: THREE.CanvasTexture;
  canyonCliffEmissive: THREE.CanvasTexture;
  fighterHullMap: THREE.CanvasTexture;
  asteroidMap: THREE.CanvasTexture;
  glowSprite: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  // 1. Canyon Floor Albedo + Emissive Neon Conduit Grid
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fCtx = floorCanvas.getContext('2d')!;
  fCtx.fillStyle = '#0e1322';
  fCtx.fillRect(0, 0, 512, 512);

  // Dark basalt rock grain
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const s = 1 + Math.random() * 3;
    const shade = 14 + Math.floor(Math.random() * 18);
    fCtx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 18})`;
    fCtx.fillRect(x, y, s, s);
  }

  // Subtle recessed architectural canyon floor plating
  fCtx.strokeStyle = '#1c2842';
  fCtx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    fCtx.beginPath();
    fCtx.moveTo(i, 0);
    fCtx.lineTo(i, 512);
    fCtx.stroke();
    fCtx.beginPath();
    fCtx.moveTo(0, i);
    fCtx.lineTo(512, i);
    fCtx.stroke();
  }

  const floorEmissiveCanvas = document.createElement('canvas');
  floorEmissiveCanvas.width = 512;
  floorEmissiveCanvas.height = 512;
  const feCtx = floorEmissiveCanvas.getContext('2d')!;
  feCtx.fillStyle = '#000000';
  feCtx.fillRect(0, 0, 512, 512);

  // Cyan guide rails along the central canyon trench + transverse pulse bars
  feCtx.strokeStyle = '#0891b2';
  feCtx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    feCtx.beginPath();
    feCtx.moveTo(0, i);
    feCtx.lineTo(512, i);
    feCtx.stroke();
  }
  // Longitudinal neon runway strips
  feCtx.fillStyle = '#06b6d4';
  feCtx.fillRect(92, 0, 5, 512);
  feCtx.fillRect(415, 0, 5, 512);
  feCtx.fillStyle = '#f59e0b';
  for (let y = 16; y < 512; y += 64) {
    feCtx.fillRect(253, y, 6, 26);
  }

  const canyonFloorMap = new THREE.CanvasTexture(floorCanvas);
  canyonFloorMap.colorSpace = THREE.SRGBColorSpace;
  canyonFloorMap.wrapS = THREE.RepeatWrapping;
  canyonFloorMap.wrapT = THREE.RepeatWrapping;
  canyonFloorMap.repeat.set(3, 6);
  canyonFloorMap.anisotropy = maxAnisotropy;

  const canyonFloorEmissive = new THREE.CanvasTexture(floorEmissiveCanvas);
  canyonFloorEmissive.colorSpace = THREE.SRGBColorSpace;
  canyonFloorEmissive.wrapS = THREE.RepeatWrapping;
  canyonFloorEmissive.wrapT = THREE.RepeatWrapping;
  canyonFloorEmissive.repeat.set(3, 6);
  canyonFloorEmissive.anisotropy = maxAnisotropy;

  // 2. Stratified Canyon Cliff Texture + Emissive Mineral Veins
  const cliffCanvas = document.createElement('canvas');
  cliffCanvas.width = 512;
  cliffCanvas.height = 512;
  const cCtx = cliffCanvas.getContext('2d')!;
  cCtx.fillStyle = '#14192a';
  cCtx.fillRect(0, 0, 512, 512);

  const strataColors = ['#181f35', '#212944', '#131726', '#282d4a', '#1b2038'];
  let yPos = 0;
  while (yPos < 512) {
    const h = 14 + Math.floor(Math.random() * 28);
    cCtx.fillStyle = strataColors[Math.floor(Math.random() * strataColors.length)];
    cCtx.fillRect(0, yPos, 512, h);
    cCtx.fillStyle = 'rgba(0,0,0,0.35)';
    cCtx.fillRect(0, yPos, 512, 2);
    yPos += h;
  }
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    cCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.18)';
    cCtx.fillRect(x, y, 2 + Math.random() * 6, 2);
  }

  const cliffEmissiveCanvas = document.createElement('canvas');
  cliffEmissiveCanvas.width = 512;
  cliffEmissiveCanvas.height = 512;
  const ceCtx = cliffEmissiveCanvas.getContext('2d')!;
  ceCtx.fillStyle = '#000000';
  ceCtx.fillRect(0, 0, 512, 512);

  // Luminous neon strata seams along canyon cliff faces
  const veinHeights = [96, 210, 340, 445];
  veinHeights.forEach((vy, i) => {
    const grad = ceCtx.createLinearGradient(0, vy - 5, 0, vy + 5);
    const col = i % 2 === 0 ? '#06b6d4' : '#f59e0b';
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.5, col);
    grad.addColorStop(1, '#000000');
    ceCtx.fillStyle = grad;
    ceCtx.fillRect(0, vy - 4, 512, 8);
  });

  const canyonCliffMap = new THREE.CanvasTexture(cliffCanvas);
  canyonCliffMap.colorSpace = THREE.SRGBColorSpace;
  canyonCliffMap.wrapS = THREE.RepeatWrapping;
  canyonCliffMap.wrapT = THREE.RepeatWrapping;
  canyonCliffMap.repeat.set(2, 1);
  canyonCliffMap.anisotropy = maxAnisotropy;

  const canyonCliffEmissive = new THREE.CanvasTexture(cliffEmissiveCanvas);
  canyonCliffEmissive.colorSpace = THREE.SRGBColorSpace;
  canyonCliffEmissive.wrapS = THREE.RepeatWrapping;
  canyonCliffEmissive.wrapT = THREE.RepeatWrapping;
  canyonCliffEmissive.repeat.set(2, 1);
  canyonCliffEmissive.anisotropy = maxAnisotropy;

  // 3. Brushed Titanium Fighter Hull Panels
  const hullCanvas = document.createElement('canvas');
  hullCanvas.width = 512;
  hullCanvas.height = 512;
  const hCtx = hullCanvas.getContext('2d')!;
  hCtx.fillStyle = '#cfd8e3';
  hCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 2) {
    hCtx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
    hCtx.fillRect(0, y, 512, 1);
  }
  hCtx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
  hCtx.lineWidth = 2;
  for (let i = 64; i < 512; i += 128) {
    hCtx.strokeRect(i - 54, 24, 108, 464);
  }
  // Subtle racing accent stripe
  hCtx.fillStyle = '#0ea5e9';
  hCtx.fillRect(244, 0, 24, 512);
  hCtx.fillStyle = '#f59e0b';
  hCtx.fillRect(236, 0, 5, 512);
  hCtx.fillRect(271, 0, 5, 512);

  const fighterHullMap = new THREE.CanvasTexture(hullCanvas);
  fighterHullMap.colorSpace = THREE.SRGBColorSpace;
  fighterHullMap.anisotropy = maxAnisotropy;

  // 4. Cratered Asteroid Surface
  const astCanvas = document.createElement('canvas');
  astCanvas.width = 256;
  astCanvas.height = 256;
  const aCtx = astCanvas.getContext('2d')!;
  aCtx.fillStyle = '#4b4754';
  aCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 65; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 4 + Math.random() * 18;
    const g = aCtx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, '#2a2733');
    g.addColorStop(0.75, '#3b3644');
    g.addColorStop(1, '#5e5a68');
    aCtx.fillStyle = g;
    aCtx.beginPath();
    aCtx.arc(x, y, r, 0, Math.PI * 2);
    aCtx.fill();
  }
  const asteroidMap = new THREE.CanvasTexture(astCanvas);
  asteroidMap.colorSpace = THREE.SRGBColorSpace;
  asteroidMap.wrapS = THREE.RepeatWrapping;
  asteroidMap.wrapT = THREE.RepeatWrapping;
  asteroidMap.anisotropy = maxAnisotropy;

  // 5. Soft Radial Glow Sprite (for particles / thrusters / stars)
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const gCtx = glowCanvas.getContext('2d')!;
  const grad = gCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, 'rgba(200,245,255,0.8)');
  grad.addColorStop(0.65, 'rgba(56,189,248,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  gCtx.fillStyle = grad;
  gCtx.fillRect(0, 0, 128, 128);
  const glowSprite = new THREE.CanvasTexture(glowCanvas);
  glowSprite.colorSpace = THREE.SRGBColorSpace;

  return {
    canyonFloorMap,
    canyonFloorEmissive,
    canyonCliffMap,
    canyonCliffEmissive,
    fighterHullMap,
    asteroidMap,
    glowSprite,
    dispose() {
      canyonFloorMap.dispose();
      canyonFloorEmissive.dispose();
      canyonCliffMap.dispose();
      canyonCliffEmissive.dispose();
      fighterHullMap.dispose();
      asteroidMap.dispose();
      glowSprite.dispose();
    },
  };
}
