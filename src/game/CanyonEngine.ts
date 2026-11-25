import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import {
  createAsteroidGeometry,
  createDefenseTowerModel,
  createEnergyRingModel,
  createFighterModel,
  type DefenseTowerRig,
  type EnergyRingRig,
  type FighterRig,
} from './models';
import { createProceduralTextures, type ProceduralTextures } from './textures';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type CameraView = 'chase' | 'cockpit';

export interface FlightInput {
  roll: number; // -1 (left) .. +1 (right)
  pitch: number; // -1 (dive) .. +1 (climb)
  firing: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  distance: number;
  speedKmh: number;
  hull: number; // 0..100
  combo: number;
  ringsPassed: number;
  towersDestroyed: number;
  asteroidsDestroyed: number;
  barrelRollReady: number; // 0..1
  barrelRollActive: boolean;
  boostAmount: number; // 0..1
  lowAltitudeBonus: boolean;
  rollInput: number; // -1..1
  pitchInput: number; // -1..1
  reticleX: number; // -1..1 screen NDC hint
  reticleY: number; // -1..1 screen NDC hint
  callout: { text: string; tone: 'cyan' | 'amber' | 'rose'; id: number } | null;
  damageFlash: number; // 0..1
  webglFallback: boolean;
}

interface CanyonSegment {
  group: THREE.Group;
  z: number;
}

interface RingEntity {
  rig: EnergyRingRig;
  x: number;
  y: number;
  z: number;
  passed: boolean;
  active: boolean;
}

interface TowerEntity {
  rig: DefenseTowerRig;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  active: boolean;
  hitFlash: number;
}

interface AsteroidEntity {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  radius: number;
  hp: number;
  rotVel: THREE.Vector3;
  driftX: number;
  active: boolean;
}

interface ProjectileEntity {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  isEnemy: boolean;
  life: number;
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

// Reusable module-scoped math helpers (zero GC inside animation loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _colorTmp = new THREE.Color();

const HIGH_SCORE_KEY = 'star_canyon_3d_highscore_v1';
const SEGMENT_LEN = 54;
const SEGMENT_COUNT = 9;
const CANYON_HALF_WIDTH = 14.5;
const FLIGHT_MAX_X = 12.2;
const FLIGHT_MIN_Y = 1.65;
const FLIGHT_MAX_Y = 14.8;

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class CanyonEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: HudSnapshot) => void;
  public sound: SoundEngine;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private textures: ProceduralTextures | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private fighter!: FighterRig;
  private canyonSegments: CanyonSegment[] = [];
  private rings: RingEntity[] = [];
  private towers: TowerEntity[] = [];
  private asteroids: AsteroidEntity[] = [];
  private projectiles: ProjectileEntity[] = [];

  // Particle system (explosions + boost sparks + ground-skim trails)
  private readonly maxParticles = 240;
  private particles: Particle[] = [];
  private particlePositions = new Float32Array(240 * 3);
  private particleColors = new Float32Array(240 * 3);
  private particleGeo!: THREE.BufferGeometry;
  private particleSystem!: THREE.Points;

  // Starfield / speed streaks
  private speedLines!: THREE.LineSegments;
  private speedLinePositions!: Float32Array;
  private readonly speedLineCount = 90;

  // Game state
  private phase: GamePhase = 'title';
  private cameraView: CameraView = 'chase';
  private autoFire = true;

  private score = 0;
  private highScore = 0;
  private distance = 0;
  private hull = 100;
  private combo = 1;
  private comboTimer = 0;
  private ringsPassed = 0;
  private towersDestroyed = 0;
  private asteroidsDestroyed = 0;

  // Fighter kinematics
  private shipX = 0;
  private shipY = 5.4;
  private shipVx = 0;
  private shipVy = 0;
  private shipRoll = 0;
  private shipPitch = 0;
  private baseSpeed = 68;
  private currentSpeed = 68;
  private boostTimer = 0;
  private invulnTimer = 0;
  private damageFlash = 0;
  private cameraShake = 0;

  // Barrel Roll state
  private barrelRollTimer = 0;
  private readonly barrelRollDuration = 0.62;
  private barrelRollCooldown = 0;
  private readonly barrelRollCooldownMax = 1.55;
  private barrelRollDir = 1;

  // Weapons
  private fireCooldown = 0;
  private nextSpawnZ = -110;
  private waveIndex = 0;

  // Input state
  private targetInput: FlightInput = { roll: 0, pitch: 0, firing: false };
  private smoothedRoll = 0;
  private smoothedPitch = 0;

  // Callout notification
  private callout: HudSnapshot['callout'] = null;
  private calloutId = 0;
  private calloutTimer = 0;

  // Shared materials & geometries for disposal
  private sharedDisposables: Array<{ dispose: () => void }> = [];

  // Loop & lifecycle
  private frameId = 0;
  private lastTickTime = 0;
  private hudEmitAccum = 0;
  private disposed = false;
  private contextLost = false;
  private webglFallback = false;

  constructor(container: HTMLElement, onHudUpdate: (hud: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.sound = new SoundEngine();

    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      if (saved) this.highScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      // ignore storage errors
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a14);
    this.scene.fog = new THREE.FogExp2(0x080d1c, 0.0052);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(66, width / height, 0.25, 420);
    this.camera.position.set(0, 7.2, 11.5);

    this.initRenderer(width, height);
    if (!this.webglFallback) {
      this.buildEnvironmentAndLights();
      this.buildSkyBackdrop();
      this.buildCanyon();
      this.buildFighter();
      this.buildEntityPools();
      this.buildParticlesAndSpeedLines();

      if (!this.isSoftwareGl && this.renderer) {
        this.renderer.compile(this.scene, this.camera);
      }
      this.spawnInitialCourse();
    }

    window.addEventListener('resize', this.handleResize);
    this.lastTickTime = performance.now();
    this.emitHud();
    if (!this.webglFallback) {
      this.scheduleNextFrame(true);
    }
  }

  private initRenderer(width: number, height: number) {
    this.isSoftwareGl = detectSoftwareWebGL();
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !this.isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false);
      renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);

      this.container.appendChild(renderer.domElement);
      this.renderer = renderer;

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      this.textures = createProceduralTextures(maxAniso);
    } catch {
      this.webglFallback = true;
    }
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = () => {
    this.contextLost = false;
    this.lastTickTime = performance.now();
  };

  private buildEnvironmentAndLights() {
    if (!this.renderer) return;

    // Mandatory procedural RoomEnvironment for metallic PBR reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // Warm/Cool 3-point atmospheric canyon rig
    const hemi = new THREE.HemisphereLight(0x67e8f9, 0x1e1b4b, 0.95);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(32, 56, 24);
    keyLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 5;
      keyLight.shadow.camera.far = 150;
      keyLight.shadow.camera.left = -28;
      keyLight.shadow.camera.right = 28;
      keyLight.shadow.camera.top = 28;
      keyLight.shadow.camera.bottom = -28;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Cool cyan canyon rim backlight from the horizon
    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.35);
    rimLight.position.set(-22, 18, -80);
    this.scene.add(rimLight);
  }

  private buildSkyBackdrop() {
    // Distant starfield dome
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.46;
      const r = 240 + Math.random() * 110;
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      starPositions[i * 3 + 1] = Math.cos(phi) * r * 0.72 + 12;
      starPositions[i * 3 + 2] = -Math.abs(Math.sin(phi) * Math.sin(theta) * r) - 20;

      const tint = Math.random();
      if (tint < 0.25) _colorTmp.setHex(0x67e8f9);
      else if (tint < 0.45) _colorTmp.setHex(0xfde68a);
      else _colorTmp.setHex(0xe2e8f0);
      starColors[i * 3] = _colorTmp.r;
      starColors[i * 3 + 1] = _colorTmp.g;
      starColors[i * 3 + 2] = _colorTmp.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: false,
    });
    this.sharedDisposables.push(starGeo, starMat);
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Distant ringed gas giant on the horizon (purely atmospheric focal anchor)
    const planetGroup = new THREE.Group();
    planetGroup.position.set(-48, 72, -310);

    const planetGeo = new THREE.SphereGeometry(28, 28, 20);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.45,
      roughness: 0.75,
      metalness: 0.1,
      fog: false,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planetGroup.add(planet);

    const ringGeo = new THREE.RingGeometry(36, 54, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      fog: false,
    });
    const planetRing = new THREE.Mesh(ringGeo, ringMat);
    planetRing.rotation.x = Math.PI * 0.42;
    planetRing.rotation.y = 0.28;
    planetGroup.add(planetRing);

    this.sharedDisposables.push(planetGeo, planetMat, ringGeo, ringMat);
    this.scene.add(planetGroup);
  }

  private buildCanyon() {
    if (!this.textures) return;

    const floorMat = new THREE.MeshStandardMaterial({
      map: this.textures.canyonFloorMap,
      emissive: 0xffffff,
      emissiveMap: this.textures.canyonFloorEmissive,
      emissiveIntensity: 0.9,
      roughness: 0.72,
      metalness: 0.22,
    });

    const cliffMat = new THREE.MeshStandardMaterial({
      map: this.textures.canyonCliffMap,
      emissive: 0xffffff,
      emissiveMap: this.textures.canyonCliffEmissive,
      emissiveIntensity: 0.65,
      roughness: 0.85,
      metalness: 0.14,
      flatShading: true,
    });

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.5,
    });

    const floorGeo = new THREE.PlaneGeometry(140, SEGMENT_LEN, 14, 4);
    floorGeo.rotateX(-Math.PI / 2);
    // Sculpt natural outer mesas rising gently outside the canyon floor
    const fPos = floorGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const fx = fPos.getX(i);
      const distOut = Math.max(0, Math.abs(fx) - CANYON_HALF_WIDTH);
      if (distOut > 0) {
        fPos.setY(i, Math.min(28, distOut * 0.55));
      }
    }
    floorGeo.computeVertexNormals();

    // Multi-tiered terraced canyon cliffs on both sides
    const lowerCliffGeo = new THREE.BoxGeometry(16, 17, SEGMENT_LEN, 2, 3, 4);
    this.roughenCliffGeometry(lowerCliffGeo, 1.8);
    const upperCliffGeo = new THREE.BoxGeometry(26, 26, SEGMENT_LEN, 2, 3, 4);
    this.roughenCliffGeometry(upperCliffGeo, 2.8);
    const railGeo = new THREE.BoxGeometry(0.32, 0.35, SEGMENT_LEN);

    this.sharedDisposables.push(floorMat, cliffMat, railMat, floorGeo, lowerCliffGeo, upperCliffGeo, railGeo);

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const group = new THREE.Group();

      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.receiveShadow = !this.isSoftwareGl;
      group.add(floor);

      // Left & right terraced cliffs
      [-1, 1].forEach((side) => {
        const lower = new THREE.Mesh(lowerCliffGeo, cliffMat);
        lower.position.set(side * (CANYON_HALF_WIDTH + 8.5), 8.2, 0);
        group.add(lower);

        const upper = new THREE.Mesh(upperCliffGeo, cliffMat);
        upper.position.set(side * (CANYON_HALF_WIDTH + 21.5), 18.0, 0);
        group.add(upper);

        // Luminous canyon conduit guide rail along the floor base
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(side * (CANYON_HALF_WIDTH - 0.6), 0.25, 0);
        group.add(rail);
      });

      const z = 30 - i * SEGMENT_LEN;
      group.position.z = z;
      this.scene.add(group);
      this.canyonSegments.push({ group, z });
    }
  }

  private roughenCliffGeometry(geo: THREE.BufferGeometry, amplitude: number) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Keep seam ends (z = ±SEGMENT_LEN/2) flush so segments tile seamlessly!
      const edgeFactor = Math.abs(z) > SEGMENT_LEN * 0.46 ? 0 : 1;
      const dx = Math.sin(y * 0.35 + z * 0.14) * amplitude * edgeFactor;
      const dy = Math.cos(x * 0.2 + z * 0.12) * (amplitude * 0.35) * edgeFactor;
      pos.setXYZ(i, x + dx, y + dy, z);
    }
    geo.computeVertexNormals();
  }

  private buildFighter() {
    if (!this.textures) return;
    this.fighter = createFighterModel(this.textures, this.isSoftwareGl);
    this.fighter.group.position.set(this.shipX, this.shipY, 0);
    this.scene.add(this.fighter.group);
  }

  private buildEntityPools() {
    if (!this.textures) return;

    // Shared materials for rings
    const ringFrameMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });
    const ringGlowMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.3,
    });
    const ringFieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sharedDisposables.push(ringFrameMat, ringGlowMat, ringFieldMat);

    for (let i = 0; i < 8; i++) {
      const rig = createEnergyRingModel({
        frameMat: ringFrameMat,
        glowMat: ringGlowMat,
        fieldMat: ringFieldMat,
      });
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.rings.push({ rig, x: 0, y: 6, z: -200, passed: false, active: false });
    }

    // Shared materials for Defense Towers
    const towerMats = {
      baseMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.42 }),
      armorMat: new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.35 }),
      coreMat: new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xef4444,
        emissiveIntensity: 2.4,
        roughness: 0.18,
        metalness: 0.2,
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        metalness: 0.6,
        roughness: 0.35,
      }),
    };
    this.sharedDisposables.push(towerMats.baseMat, towerMats.armorMat, towerMats.coreMat, towerMats.trimMat);

    for (let i = 0; i < 8; i++) {
      const rig = createDefenseTowerModel(towerMats, 0.9 + (i % 3) * 0.22);
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.towers.push({
        rig,
        x: 0,
        y: 0,
        z: -200,
        hp: 3,
        maxHp: 3,
        fireCooldown: 1.5,
        active: false,
        hitFlash: 0,
      });
    }

    // Shared Asteroid pool (3 distinct procedural faceted geometries)
    const astGeos = [
      createAsteroidGeometry(1.1, 1.85),
      createAsteroidGeometry(4.7, 2.25),
      createAsteroidGeometry(9.3, 1.55),
    ];
    const astMat = new THREE.MeshStandardMaterial({
      map: this.textures.asteroidMap,
      color: 0x94a3b8,
      roughness: 0.88,
      metalness: 0.18,
      flatShading: true,
    });
    this.sharedDisposables.push(...astGeos, astMat);

    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(astGeos[i % astGeos.length], astMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.asteroids.push({
        mesh,
        x: 0,
        y: 6,
        z: -200,
        radius: 1.85,
        hp: 2,
        rotVel: new THREE.Vector3(0.6, 0.8, 0.4),
        driftX: 0,
        active: false,
      });
    }

    // Projectile pool (player cyan laser bolts + enemy crimson plasma orbs)
    const playerBoltGeo = new THREE.CylinderGeometry(0.11, 0.11, 4.4, 6);
    playerBoltGeo.rotateX(Math.PI / 2);
    const playerBoltMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      blending: THREE.AdditiveBlending,
    });

    const enemyOrbGeo = new THREE.SphereGeometry(0.62, 10, 8);
    const enemyOrbMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
    });
    this.sharedDisposables.push(playerBoltGeo, playerBoltMat, enemyOrbGeo, enemyOrbMat);

    for (let i = 0; i < 36; i++) {
      const isEnemy = i >= 24;
      const mesh = new THREE.Mesh(isEnemy ? enemyOrbGeo : playerBoltGeo, isEnemy ? enemyOrbMat : playerBoltMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        isEnemy,
        life: 0,
        active: false,
      });
    }
  }

  private buildParticlesAndSpeedLines() {
    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    const pMat = new THREE.PointsMaterial({
      size: 1.8,
      map: this.textures?.glowSprite ?? null,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particleSystem = new THREE.Points(this.particleGeo, pMat);
    this.particleSystem.frustumCulled = false;
    this.sharedDisposables.push(this.particleGeo, pMat);
    this.scene.add(this.particleSystem);

    // Supersonic wind / speed streak lines
    this.speedLinePositions = new Float32Array(this.speedLineCount * 6);
    for (let i = 0; i < this.speedLineCount; i++) {
      this.resetSpeedLine(i, -Math.random() * 140);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.speedLinePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    this.speedLines = new THREE.LineSegments(lineGeo, lineMat);
    this.speedLines.frustumCulled = false;
    this.sharedDisposables.push(lineGeo, lineMat);
    this.scene.add(this.speedLines);
  }

  private resetSpeedLine(idx: number, zStart: number) {
    const angle = Math.random() * Math.PI * 2;
    const rad = 8 + Math.random() * 14;
    const x = Math.cos(angle) * rad;
    const y = Math.max(1.0, 7 + Math.sin(angle) * rad * 0.65);
    const len = 5 + Math.random() * 9;
    const base = idx * 6;
    this.speedLinePositions[base] = x;
    this.speedLinePositions[base + 1] = y;
    this.speedLinePositions[base + 2] = zStart;
    this.speedLinePositions[base + 3] = x;
    this.speedLinePositions[base + 4] = y;
    this.speedLinePositions[base + 5] = zStart - len;
  }

  private spawnInitialCourse() {
    this.clearEntities();
    this.nextSpawnZ = -110;
    this.waveIndex = 0;
    while (this.nextSpawnZ > -380) {
      this.spawnWave(this.nextSpawnZ);
      this.nextSpawnZ -= 68;
    }
  }

  private clearEntities() {
    this.rings.forEach((r) => {
      r.active = false;
      r.rig.group.visible = false;
    });
    this.towers.forEach((t) => {
      t.active = false;
      t.rig.group.visible = false;
    });
    this.asteroids.forEach((a) => {
      a.active = false;
      a.mesh.visible = false;
    });
    this.projectiles.forEach((p) => {
      p.active = false;
      p.mesh.visible = false;
    });
  }

  private spawnWave(zPos: number) {
    this.waveIndex++;
    const difficulty = Math.min(1, this.distance / 5500);

    // 1. Always spawn a rhythmic Energy Ring along varied Roll/Pitch trajectories
    const ring = this.rings.find((r) => !r.active);
    if (ring) {
      const rx = Math.sin(this.waveIndex * 1.35) * 8.2 + (Math.random() - 0.5) * 2.4;
      const ry = 4.6 + ((Math.cos(this.waveIndex * 0.95) + 1) * 0.5) * 7.2;
      ring.x = THREE.MathUtils.clamp(rx, -8.8, 8.8);
      ring.y = THREE.MathUtils.clamp(ry, 4.2, 12.2);
      ring.z = zPos;
      ring.passed = false;
      ring.active = true;
      ring.rig.group.position.set(ring.x, ring.y, ring.z);
      ring.rig.group.visible = true;
      ring.rig.fieldDisc.visible = true;
    }

    // 2. Spawn Defense Tower on canyon floor (offset from the ring corridor)
    if (this.waveIndex % 2 === 1 || Math.random() < 0.45 + difficulty * 0.35) {
      const tower = this.towers.find((t) => !t.active);
      if (tower) {
        const side = this.waveIndex % 2 === 0 ? -1 : 1;
        const tx = side * (4.5 + Math.random() * 5.8);
        tower.x = tx;
        tower.y = 0; // grounded flush on canyon floor
        tower.z = zPos - 26;
        tower.hp = 3;
        tower.maxHp = 3;
        tower.fireCooldown = 0.7 + Math.random() * 0.9;
        tower.hitFlash = 0;
        tower.active = true;
        tower.rig.group.position.set(tower.x, 0, tower.z);
        tower.rig.group.visible = true;
      }
    }

    // 3. Spawn Asteroid cluster drifting across the canyon
    const asteroidCount = 2 + Math.floor(difficulty * 2.5);
    for (let k = 0; k < asteroidCount; k++) {
      const ast = this.asteroids.find((a) => !a.active);
      if (!ast) break;
      const ax = (Math.random() - 0.5) * 21;
      const ay = 2.6 + Math.random() * 11.4;
      const az = zPos - 14 - Math.random() * 44;
      // Avoid blocking directly inside the energy ring center
      if (ring && Math.hypot(ax - ring.x, ay - ring.y) < 5.2 && Math.abs(az - ring.z) < 12) {
        continue;
      }
      const scale = 0.72 + Math.random() * 0.75;
      ast.x = ax;
      ast.y = ay;
      ast.z = az;
      ast.radius = 1.75 * scale;
      ast.hp = 2;
      ast.driftX = (Math.random() - 0.5) * (1.2 + difficulty * 2.4);
      ast.rotVel.set(
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.2
      );
      ast.mesh.scale.setScalar(scale);
      ast.mesh.position.set(ax, ay, az);
      ast.mesh.visible = true;
      ast.active = true;
    }
  }

  // --- Public Controls API ---

  public setInput(input: Partial<FlightInput>) {
    if (input.roll !== undefined) this.targetInput.roll = THREE.MathUtils.clamp(input.roll, -1, 1);
    if (input.pitch !== undefined) this.targetInput.pitch = THREE.MathUtils.clamp(input.pitch, -1, 1);
    if (input.firing !== undefined) this.targetInput.firing = input.firing;
  }

  public setAutoFire(enabled: boolean) {
    this.autoFire = enabled;
  }

  public setCameraView(view: CameraView) {
    this.cameraView = view;
  }

  public startGame() {
    this.sound.unlock();
    this.phase = 'playing';
    this.score = 0;
    this.distance = 0;
    this.hull = 100;
    this.combo = 1;
    this.comboTimer = 0;
    this.ringsPassed = 0;
    this.towersDestroyed = 0;
    this.asteroidsDestroyed = 0;
    this.shipX = 0;
    this.shipY = 5.4;
    this.shipVx = 0;
    this.shipVy = 0;
    this.shipRoll = 0;
    this.shipPitch = 0;
    this.baseSpeed = 72;
    this.currentSpeed = 72;
    this.boostTimer = 0;
    this.invulnTimer = 0.8;
    this.damageFlash = 0;
    this.barrelRollTimer = 0;
    this.barrelRollCooldown = 0;
    this.callout = null;
    this.spawnInitialCourse();
    this.showCallout('戰機升空 · 穿越能量環加速', 'cyan');
    this.emitHud();
  }

  public togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.sound.updateEngine(false, 0, 0);
      this.emitHud();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.lastTickTime = performance.now();
      this.emitHud();
    }
  }

  public returnToTitle() {
    this.phase = 'title';
    this.sound.updateEngine(false, 0, 0);
    this.emitHud();
  }

  public triggerBarrelRoll(direction?: number): boolean {
    if (this.phase !== 'playing') return false;
    if (this.barrelRollTimer > 0 || this.barrelRollCooldown > 0) return false;

    this.barrelRollTimer = this.barrelRollDuration;
    this.barrelRollCooldown = this.barrelRollCooldownMax;
    this.barrelRollDir =
      direction && direction !== 0
        ? Math.sign(direction)
        : Math.abs(this.smoothedRoll) > 0.15
        ? Math.sign(this.smoothedRoll)
        : 1;
    // Brief lateral burst in roll direction
    this.shipVx += this.barrelRollDir * 14;
    this.sound.playBarrelRoll();
    this.showCallout('桶滾無敵閃避 BARREL ROLL', 'cyan');
    this.emitHud();
    return true;
  }

  public fireManualBurst() {
    if (this.phase !== 'playing') return;
    if (this.fireCooldown <= 0) {
      this.spawnPlayerLasers();
      this.fireCooldown = 0.14;
    }
  }

  private showCallout(text: string, tone: 'cyan' | 'amber' | 'rose') {
    this.calloutId++;
    this.callout = { text, tone, id: this.calloutId };
    this.calloutTimer = 1.6;
  }

  // --- Core Simulation Tick ---

  private scheduleNextFrame(immediate = false) {
    if (this.disposed) return;
    if (this.isSoftwareGl && !immediate && this.renderer) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void) {
    if (!this.renderer || this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick() {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTickTime) / 1000));
    this.lastTickTime = now;

    if (!this.contextLost && this.renderer) {
      if (this.phase === 'title') {
        this.updateAttractMode(dt, now * 0.001);
      } else if (this.phase === 'playing') {
        this.updatePlaying(dt, now * 0.001);
      } else if (this.phase === 'gameover') {
        this.updateParticles(dt);
        this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 5, dt);
      }

      this.renderer.render(this.scene, this.camera);
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }

    this.scheduleNextFrame(false);
  }

  private updateAttractMode(dt: number, t: number) {
    const cruiseSpeed = 52;
    this.scrollCanyon(dt, cruiseSpeed);
    this.updateSpeedLines(dt, cruiseSpeed, 0.25);

    this.shipX = Math.sin(t * 0.65) * 5.2;
    this.shipY = 5.8 + Math.sin(t * 1.1) * 1.8;
    const bank = -Math.cos(t * 0.65) * 0.34;
    const pitch = Math.cos(t * 1.1) * 0.14;

    this.fighter.group.position.set(this.shipX, this.shipY, 0);
    this.fighter.group.rotation.set(pitch, 0, bank);
    this.animateFighterFX(t, 0.2, false);

    // Cinematic patrolling camera
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.shipX * 0.55, 3, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.shipY + 2.4, 3, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 11.4, 3, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 66, 4, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.shipX * 0.7, this.shipY + 0.6, -34);

    // Rotate active rings gently in background
    for (const r of this.rings) {
      if (!r.active) continue;
      r.z += cruiseSpeed * dt;
      r.rig.group.position.z = r.z;
      r.rig.innerRing.rotation.z += dt * 1.8;
      if (r.z > 24) {
        r.z -= 400;
        r.rig.group.position.z = r.z;
      }
    }
  }

  private updatePlaying(dt: number, t: number) {
    // 1. Smoothly damp pilot inputs
    this.smoothedRoll = THREE.MathUtils.damp(this.smoothedRoll, this.targetInput.roll, 11, dt);
    this.smoothedPitch = THREE.MathUtils.damp(this.smoothedPitch, this.targetInput.pitch, 11, dt);

    // Timers
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.6);
    if (this.cameraShake > 0) this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 8, dt);
    if (this.barrelRollCooldown > 0) this.barrelRollCooldown = Math.max(0, this.barrelRollCooldown - dt);
    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) this.callout = null;
    }
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // 2. Progressive supersonic speed + Energy Ring Afterburner Boost + Low-Altitude Skim
    const lowAlt = this.shipY < 3.6;
    this.baseSpeed = Math.min(118, 72 + this.distance * 0.0055);
    const boostRatio = Math.min(1, this.boostTimer / 2.2);
    const targetSpeed = this.baseSpeed + boostRatio * 46 + (lowAlt ? 8 : 0);
    this.currentSpeed = THREE.MathUtils.damp(this.currentSpeed, targetSpeed, 5, dt);

    const forwardStep = this.currentSpeed * dt;
    this.distance += forwardStep;
    this.score += Math.round(forwardStep * (lowAlt ? 1.5 : 0.85) * this.combo * 0.18);

    // Low-altitude ground-effect sparks
    if (lowAlt && Math.random() < 0.45) {
      this.spawnParticle(
        this.shipX + (Math.random() - 0.5) * 4.5,
        0.35,
        1.2,
        (Math.random() - 0.5) * 3,
        1.2 + Math.random() * 2.2,
        14,
        0x38bdf8,
        0.35
      );
    }

    // 3. Fighter dual-axis flight physics (Roll -> lateral strafe, Pitch -> climb/dive)
    const targetVx = this.smoothedRoll * 26;
    const targetVy = this.smoothedPitch * 19;
    this.shipVx = THREE.MathUtils.damp(this.shipVx, targetVx, 8.5, dt);
    this.shipVy = THREE.MathUtils.damp(this.shipVy, targetVy, 8.5, dt);

    this.shipX = THREE.MathUtils.clamp(this.shipX + this.shipVx * dt, -FLIGHT_MAX_X, FLIGHT_MAX_X);
    this.shipY = THREE.MathUtils.clamp(this.shipY + this.shipVy * dt, FLIGHT_MIN_Y, FLIGHT_MAX_Y);

    // Compute banking & pitch angles + Barrel Roll 360° axial spin
    let barrelRollAngle = 0;
    const barrelActive = this.barrelRollTimer > 0;
    if (barrelActive) {
      this.barrelRollTimer = Math.max(0, this.barrelRollTimer - dt);
      const progress = 1 - this.barrelRollTimer / this.barrelRollDuration;
      // Smooth ease-in-out full 360° roll
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      barrelRollAngle = -this.barrelRollDir * eased * Math.PI * 2;
    }

    this.shipRoll = THREE.MathUtils.damp(this.shipRoll, -this.smoothedRoll * 0.68, 12, dt);
    this.shipPitch = THREE.MathUtils.damp(this.shipPitch, this.smoothedPitch * 0.42, 12, dt);

    this.fighter.group.position.set(this.shipX, this.shipY, 0);
    this.fighter.group.rotation.set(this.shipPitch, -this.smoothedRoll * 0.12, this.shipRoll + barrelRollAngle);
    this.fighter.group.visible = this.cameraView === 'chase';
    this.animateFighterFX(t, boostRatio, barrelActive);

    // 4. Camera choreography (chase vs cockpit + FOV warp on boost + dynamic banking)
    const shakeX = (Math.random() - 0.5) * this.cameraShake;
    const shakeY = (Math.random() - 0.5) * this.cameraShake;

    if (this.cameraView === 'chase') {
      const camTargetX = this.shipX * 0.68 + shakeX;
      const camTargetY = this.shipY + 2.55 + shakeY;
      const camTargetZ = 10.2 + boostRatio * 1.4;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camTargetX, 7.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camTargetY, 7.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camTargetZ, 6, dt);
      this.camera.lookAt(this.shipX * 0.92, this.shipY + 0.5 + this.smoothedPitch * 2.2, -48);
      this.camera.rotation.z += -this.smoothedRoll * 0.085;
    } else {
      // Cockpit 1st-person view
      this.camera.position.set(this.shipX + shakeX * 0.4, this.shipY + 0.45 + shakeY * 0.4, -0.8);
      this.camera.lookAt(this.shipX + this.smoothedRoll * 4, this.shipY + this.smoothedPitch * 7, -65);
      this.camera.rotation.z = this.shipRoll * 0.42 + (barrelActive ? barrelRollAngle * 0.25 : 0);
    }

    const desiredFov = 66 + boostRatio * 16 + (this.currentSpeed - 72) * 0.1;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 6, dt);
    this.camera.updateProjectionMatrix();

    // 5. Weapons (auto-fire when target in corridor or continuous autoFire + manual fire)
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    const shouldFire = this.targetInput.firing || (this.autoFire && this.hasForwardTarget());
    if (shouldFire && this.fireCooldown <= 0) {
      this.spawnPlayerLasers();
      this.fireCooldown = this.targetInput.firing ? 0.145 : 0.185;
    }

    // 6. Scroll world, spawn waves, update entities & collisions
    this.scrollCanyon(dt, this.currentSpeed);
    this.updateSpeedLines(dt, this.currentSpeed, boostRatio);

    this.nextSpawnZ += forwardStep;
    while (this.nextSpawnZ > -370) {
      this.spawnWave(this.nextSpawnZ - 370);
      this.nextSpawnZ -= Math.max(52, 68 - this.distance * 0.0022);
    }

    this.updateRings(dt, forwardStep);
    this.updateTowers(dt, forwardStep, t);
    this.updateAsteroids(dt, forwardStep, barrelActive);
    this.updateProjectiles(dt, forwardStep, barrelActive);
    this.updateParticles(dt);

    // 7. Update engine hum
    this.sound.updateEngine(true, (this.currentSpeed - 65) / 80, boostRatio);

    // 8. Check Game Over
    if (this.hull <= 0) {
      this.hull = 0;
      this.phase = 'gameover';
      this.sound.updateEngine(false, 0, 0);
      this.sound.playExplosion(true);
      this.spawnExplosion(this.shipX, this.shipY, 0, 0xf59e0b, 38);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
        } catch {
          // ignore
        }
      }
      this.emitHud();
    }
  }

  private hasForwardTarget(): boolean {
    for (const t of this.towers) {
      if (!t.active || t.z > -8 || t.z < -175) continue;
      if (Math.abs(t.x - this.shipX) < 8.5) return true;
    }
    for (const a of this.asteroids) {
      if (!a.active || a.z > -6 || a.z < -150) continue;
      if (Math.hypot(a.x - this.shipX, a.y - this.shipY) < 6.8) return true;
    }
    return false;
  }

  private spawnPlayerLasers() {
    // Gentle forward aim-assist toward nearest target in reticle cone
    let aimX = this.shipX;
    let aimY = this.shipY;
    let aimZ = -90;
    let bestScore = 10;

    for (const t of this.towers) {
      if (!t.active || t.z > -10 || t.z < -170) continue;
      const targetY = 7.4;
      const dist = Math.hypot(t.x - this.shipX, targetY - this.shipY);
      if (dist < bestScore) {
        bestScore = dist;
        aimX = t.x;
        aimY = targetY;
        aimZ = t.z;
      }
    }
    for (const a of this.asteroids) {
      if (!a.active || a.z > -10 || a.z < -155) continue;
      const dist = Math.hypot(a.x - this.shipX, a.y - this.shipY);
      if (dist < bestScore) {
        bestScore = dist;
        aimX = a.x;
        aimY = a.y;
        aimZ = a.z;
      }
    }

    const muzzles = [this.fighter.leftMuzzle, this.fighter.rightMuzzle];
    let fired = false;
    for (const muzzle of muzzles) {
      const bolt = this.projectiles.find((p) => !p.active && !p.isEnemy);
      if (!bolt) continue;
      muzzle.getWorldPosition(_vecA);
      _vecB.set(aimX, aimY, aimZ).sub(_vecA).normalize().multiplyScalar(225);

      bolt.x = _vecA.x;
      bolt.y = _vecA.y;
      bolt.z = _vecA.z;
      bolt.vx = _vecB.x;
      bolt.vy = _vecB.y;
      bolt.vz = _vecB.z;
      bolt.life = 1.25;
      bolt.active = true;
      bolt.mesh.position.set(bolt.x, bolt.y, bolt.z);
      bolt.mesh.visible = true;
      fired = true;
    }
    if (fired) this.sound.playLaser();
  }

  private animateFighterFX(t: number, boostRatio: number, barrelActive: boolean) {
    const flicker = 0.85 + Math.sin(t * 48) * 0.15;
    const flameLen = (0.95 + boostRatio * 1.45) * flicker;
    const flameRadius = 0.85 + boostRatio * 0.45;
    this.fighter.leftFlame.scale.set(flameRadius, flameRadius, flameLen);
    this.fighter.rightFlame.scale.set(flameRadius, flameRadius, flameLen);

    const flameMat = this.fighter.leftFlame.material as THREE.MeshBasicMaterial;
    flameMat.color.setHex(boostRatio > 0.2 ? 0xf59e0b : 0x38bdf8);

    this.fighter.thrusterLight.intensity = 4.2 + boostRatio * 5.5;
    this.fighter.thrusterLight.color.setHex(boostRatio > 0.2 ? 0xfbbf24 : 0x38bdf8);

    // Barrel Roll holographic Aegis shield
    this.fighter.shieldShell.visible = barrelActive;
    if (barrelActive) {
      const mat = this.fighter.shieldShell.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.58;
      this.fighter.shieldShell.rotation.y += 0.16;
      this.fighter.shieldShell.rotation.x += 0.08;
    }
  }

  private scrollCanyon(dt: number, speed: number) {
    const dz = speed * dt;
    let farthestZ = Infinity;
    for (const seg of this.canyonSegments) {
      seg.z += dz;
      if (seg.z < farthestZ) farthestZ = seg.z;
    }
    for (const seg of this.canyonSegments) {
      if (seg.z > 58) {
        farthestZ -= SEGMENT_LEN;
        seg.z = farthestZ;
      }
      seg.group.position.z = seg.z;
    }
  }

  private updateSpeedLines(dt: number, speed: number, boostRatio: number) {
    const lineMat = this.speedLines.material as THREE.LineBasicMaterial;
    lineMat.opacity = 0.18 + boostRatio * 0.45;
    const dz = speed * (1.45 + boostRatio * 0.9) * dt;
    for (let i = 0; i < this.speedLineCount; i++) {
      const base = i * 6;
      this.speedLinePositions[base + 2] += dz;
      this.speedLinePositions[base + 5] += dz;
      if (this.speedLinePositions[base + 5] > 18) {
        this.resetSpeedLine(i, -135 - Math.random() * 40);
      }
    }
    (this.speedLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateRings(dt: number, forwardStep: number) {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.z += forwardStep;
      r.rig.group.position.z = r.z;
      r.rig.innerRing.rotation.z += dt * 2.4;

      // Check fighter passing through energy ring plane
      if (!r.passed && r.z >= -2.5 && r.z <= 4.2) {
        const dist = Math.hypot(this.shipX - r.x, this.shipY - r.y);
        if (dist < 4.75) {
          r.passed = true;
          r.rig.fieldDisc.visible = false;
          this.ringsPassed++;
          this.combo = Math.min(8, this.combo + 1);
          this.comboTimer = 6.5;
          this.boostTimer = 2.4;
          this.hull = Math.min(100, this.hull + 5);
          const pts = 250 * this.combo;
          this.score += pts;
          this.sound.playRingBoost(this.combo);
          this.spawnExplosion(r.x, r.y, 0, 0x22d3ee, 22);
          this.showCallout(`能量加速 x${this.combo} · +${pts}`, 'cyan');
        }
      }

      if (r.z > 24) {
        r.active = false;
        r.rig.group.visible = false;
      }
    }
  }

  private updateTowers(dt: number, forwardStep: number, t: number) {
    for (const tower of this.towers) {
      if (!tower.active) continue;
      tower.z += forwardStep;
      tower.rig.group.position.z = tower.z;
      tower.rig.coreMesh.rotation.y = t * 2.6;

      if (tower.hitFlash > 0) {
        tower.hitFlash = Math.max(0, tower.hitFlash - dt * 6);
        const s = 1 + tower.hitFlash * 0.25;
        tower.rig.coreMesh.scale.setScalar(s);
      } else {
        tower.rig.coreMesh.scale.setScalar(1);
      }

      // Track the fighter with turret head
      if (tower.z < -8 && tower.z > -190) {
        const dx = this.shipX - tower.x;
        const dz = -tower.z;
        tower.rig.turretHead.rotation.y = Math.atan2(dx, dz);

        // Fire plasma orb toward fighter
        tower.fireCooldown -= dt;
        if (tower.fireCooldown <= 0 && tower.z < -38 && tower.z > -165) {
          this.fireTowerOrb(tower);
          tower.fireCooldown = Math.max(0.85, 1.75 - this.distance * 0.00012);
        }
      }

      // Collision with fighter body
      if (Math.abs(tower.z) < 3.4 && Math.abs(this.shipX - tower.x) < 3.3 && this.shipY < 9.5) {
        this.damageFighter(24, tower.x, this.shipY, '防禦塔擦撞');
        this.destroyTower(tower, false);
      }

      if (tower.z > 26) {
        tower.active = false;
        tower.rig.group.visible = false;
      }
    }
  }

  private fireTowerOrb(tower: TowerEntity) {
    const orb = this.projectiles.find((p) => !p.active && p.isEnemy);
    if (!orb) return;
    tower.rig.muzzleLeft.getWorldPosition(_vecA);
    // Aim slightly ahead of fighter's current position
    _vecB.set(this.shipX, this.shipY, 0).sub(_vecA).normalize();
    const speed = 42 + this.currentSpeed * 0.35;

    orb.x = _vecA.x;
    orb.y = _vecA.y;
    orb.z = _vecA.z;
    orb.vx = _vecB.x * speed;
    orb.vy = _vecB.y * speed;
    orb.vz = _vecB.z * speed;
    orb.life = 3.2;
    orb.active = true;
    orb.mesh.position.set(orb.x, orb.y, orb.z);
    orb.mesh.visible = true;
  }

  private destroyTower(tower: TowerEntity, awardScore: boolean) {
    tower.active = false;
    tower.rig.group.visible = false;
    this.spawnExplosion(tower.x, 6.8, tower.z, 0xf97316, 30);
    this.sound.playExplosion(true);
    this.cameraShake = Math.max(this.cameraShake, 0.55);
    if (awardScore) {
      this.towersDestroyed++;
      const pts = 400 * this.combo;
      this.score += pts;
      this.comboTimer = Math.max(this.comboTimer, 4.5);
      this.showCallout(`擊毀防禦塔 · +${pts}`, 'amber');
    }
  }

  private updateAsteroids(dt: number, forwardStep: number, barrelActive: boolean) {
    for (const ast of this.asteroids) {
      if (!ast.active) continue;
      ast.z += forwardStep;
      ast.x += ast.driftX * dt;
      if (Math.abs(ast.x) > FLIGHT_MAX_X) ast.driftX *= -1;

      ast.mesh.position.set(ast.x, ast.y, ast.z);
      ast.mesh.rotation.x += ast.rotVel.x * dt;
      ast.mesh.rotation.y += ast.rotVel.y * dt;
      ast.mesh.rotation.z += ast.rotVel.z * dt;

      // Fighter collision check
      if (Math.abs(ast.z) < ast.radius + 1.8) {
        const dist = Math.hypot(this.shipX - ast.x, this.shipY - ast.y);
        if (dist < ast.radius + 1.75) {
          if (barrelActive) {
            // Barrel Roll smashes right through asteroids!
            ast.active = false;
            ast.mesh.visible = false;
            this.asteroidsDestroyed++;
            const pts = 200 * this.combo;
            this.score += pts;
            this.sound.playDeflect();
            this.spawnExplosion(ast.x, ast.y, ast.z, 0x38bdf8, 22);
            this.showCallout(`桶滾震碎隕石 · +${pts}`, 'cyan');
          } else {
            ast.active = false;
            ast.mesh.visible = false;
            this.spawnExplosion(ast.x, ast.y, ast.z, 0xf43f5e, 18);
            this.damageFighter(18, ast.x, ast.y, '隕石撞擊');
          }
        }
      }

      if (ast.z > 24) {
        ast.active = false;
        ast.mesh.visible = false;
      }
    }
  }

  private updateProjectiles(dt: number, forwardStep: number, barrelActive: boolean) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt + (p.isEnemy ? forwardStep * 0.45 : 0);
      p.mesh.position.set(p.x, p.y, p.z);

      if (p.life <= 0 || p.z < -260 || p.z > 28) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (!p.isEnemy) {
        // Player bolt hits Defense Towers
        let hit = false;
        for (const t of this.towers) {
          if (!t.active) continue;
          if (Math.abs(p.z - t.z) < 4.8 && Math.abs(p.x - t.x) < 3.4 && p.y >= 1.2 && p.y <= 11.2) {
            t.hp -= 1;
            t.hitFlash = 1;
            hit = true;
            this.spawnExplosion(p.x, p.y, p.z, 0x38bdf8, 7);
            if (t.hp <= 0) {
              this.destroyTower(t, true);
            }
            break;
          }
        }
        // Player bolt hits Asteroids
        if (!hit) {
          for (const a of this.asteroids) {
            if (!a.active) continue;
            if (Math.abs(p.z - a.z) < a.radius + 3.0) {
              const dist = Math.hypot(p.x - a.x, p.y - a.y);
              if (dist < a.radius + 1.15) {
                a.hp -= 1;
                hit = true;
                this.spawnExplosion(p.x, p.y, p.z, 0xfbbf24, 8);
                if (a.hp <= 0) {
                  a.active = false;
                  a.mesh.visible = false;
                  this.asteroidsDestroyed++;
                  this.score += 150 * this.combo;
                  this.sound.playExplosion(false);
                  this.spawnExplosion(a.x, a.y, a.z, 0xf59e0b, 18);
                }
                break;
              }
            }
          }
        }
        if (hit) {
          p.active = false;
          p.mesh.visible = false;
        }
      } else {
        // Enemy plasma orb hits Fighter
        if (Math.abs(p.z) < 2.6) {
          const dist = Math.hypot(p.x - this.shipX, p.y - this.shipY);
          if (dist < (barrelActive ? 4.4 : 2.35)) {
            if (barrelActive) {
              // Deflect enemy plasma!
              p.isEnemy = false;
              p.vx = -p.vx * 1.6;
              p.vy = -p.vy * 1.6;
              p.vz = -180;
              p.life = 1.0;
              this.score += 150 * this.combo;
              this.sound.playDeflect();
              this.spawnExplosion(p.x, p.y, p.z, 0x22d3ee, 14);
              this.showCallout(`護盾反彈砲火 · +${150 * this.combo}`, 'cyan');
            } else {
              p.active = false;
              p.mesh.visible = false;
              this.damageFighter(14, p.x, p.y, '防禦塔砲火命中');
            }
          }
        }
      }
    }
  }

  private damageFighter(amount: number, x: number, y: number, reason: string) {
    if (this.invulnTimer > 0 || this.barrelRollTimer > 0) return;
    this.hull = Math.max(0, this.hull - amount);
    this.combo = 1;
    this.invulnTimer = 0.75;
    this.damageFlash = 1.0;
    this.cameraShake = 0.9;
    this.sound.playHullDamage();
    this.spawnExplosion(x, y, 0, 0xf43f5e, 16);
    this.showCallout(`${reason} · 護盾 -${amount}%`, 'rose');
  }

  private spawnExplosion(x: number, y: number, z: number, hexColor: number, count: number) {
    for (let i = 0; i < count; i++) {
      const speed = 6 + Math.random() * 24;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.spawnParticle(
        x,
        y,
        z,
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        i % 3 === 0 ? 0xffffff : hexColor,
        0.35 + Math.random() * 0.45
      );
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    hexColor: number,
    maxLife: number
  ) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push({
      x,
      y,
      z,
      vx,
      vy,
      vz,
      life: maxLife,
      maxLife,
      color: new THREE.Color(hexColor),
      size: 1,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vz *= 0.96;
    }

    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        const fade = p.life / p.maxLife;
        this.particlePositions[i * 3] = p.x;
        this.particlePositions[i * 3 + 1] = p.y;
        this.particlePositions[i * 3 + 2] = p.z;
        this.particleColors[i * 3] = p.color.r * fade;
        this.particleColors[i * 3 + 1] = p.color.g * fade;
        this.particleColors[i * 3 + 2] = p.color.b * fade;
      } else {
        this.particlePositions[i * 3] = 0;
        this.particlePositions[i * 3 + 1] = -999;
        this.particlePositions[i * 3 + 2] = 0;
      }
    }
    (this.particleGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.particleGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitHud() {
    // Project a point 75m directly ahead of the fighter to screen NDC for the HUD reticle
    let reticleX = 0;
    let reticleY = 0;
    if (!this.webglFallback) {
      _vecC.set(this.shipX, this.shipY, -75).project(this.camera);
      reticleX = THREE.MathUtils.clamp(_vecC.x, -0.75, 0.75);
      reticleY = THREE.MathUtils.clamp(_vecC.y, -0.65, 0.65);
    }

    const ready =
      this.barrelRollCooldown <= 0
        ? 1
        : Math.max(0, 1 - this.barrelRollCooldown / this.barrelRollCooldownMax);

    this.onHudUpdate({
      phase: this.phase,
      score: this.score,
      highScore: Math.max(this.highScore, this.score),
      distance: Math.floor(this.distance),
      speedKmh: Math.round(this.currentSpeed * 18.5),
      hull: Math.round(this.hull),
      combo: this.combo,
      ringsPassed: this.ringsPassed,
      towersDestroyed: this.towersDestroyed,
      asteroidsDestroyed: this.asteroidsDestroyed,
      barrelRollReady: ready,
      barrelRollActive: this.barrelRollTimer > 0,
      boostAmount: Math.min(1, this.boostTimer / 2.2),
      lowAltitudeBonus: this.phase === 'playing' && this.shipY < 3.6,
      rollInput: this.smoothedRoll,
      pitchInput: this.smoothedPitch,
      reticleX,
      reticleY,
      callout: this.callout,
      damageFlash: this.damageFlash,
      webglFallback: this.webglFallback,
    });
  }

  private handleResize = () => {
    if (!this.renderer || this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.sound.dispose();

    this.sharedDisposables.forEach((d) => d.dispose());
    this.textures?.dispose();
    this.envRT?.dispose();

    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
  }
}
