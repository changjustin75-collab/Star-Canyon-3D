import * as THREE from 'three';
import type { ProceduralTextures } from './textures';

export interface FighterRig {
  group: THREE.Group;
  leftFlame: THREE.Mesh;
  rightFlame: THREE.Mesh;
  shieldShell: THREE.Mesh;
  thrusterLight: THREE.PointLight;
  leftMuzzle: THREE.Object3D;
  rightMuzzle: THREE.Object3D;
  wingtipLights: THREE.Mesh[];
}

export interface DefenseTowerRig {
  group: THREE.Group;
  turretHead: THREE.Group;
  coreMesh: THREE.Mesh;
  muzzleLeft: THREE.Object3D;
  muzzleRight: THREE.Object3D;
}

export interface EnergyRingRig {
  group: THREE.Group;
  innerRing: THREE.Mesh;
  fieldDisc: THREE.Mesh;
}

/**
 * Composite 12-part procedural Supersonic Starfighter (nose faces -Z).
 */
export function createFighterModel(
  textures: ProceduralTextures,
  isSoftwareGl: boolean
): FighterRig {
  const group = new THREE.Group();

  // Calibrated PBR materials with distinct roughness/metalness contrast
  const hullMat = new THREE.MeshStandardMaterial({
    map: textures.fighterHullMap,
    color: 0xe2e8f0,
    metalness: 0.78,
    roughness: 0.24,
  });

  const carbonTrimMat = new THREE.MeshStandardMaterial({
    color: 0x161d2e,
    metalness: 0.35,
    roughness: 0.68,
  });

  const accentCyanMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.6,
    metalness: 0.4,
    roughness: 0.2,
  });

  const accentAmberMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
    metalness: 0.5,
    roughness: 0.25,
  });

  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x082f49,
    emissive: 0x0369a1,
    emissiveIntensity: 0.22,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: isSoftwareGl ? 0.62 : 0.85,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.92,
    roughness: 0.32,
  });

  // 1. Primary sculpted fuselage body (extruded diamond profile)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(0, 0.36);
  bodyShape.lineTo(0.68, 0.04);
  bodyShape.lineTo(0.46, -0.26);
  bodyShape.lineTo(-0.46, -0.26);
  bodyShape.lineTo(-0.68, 0.04);
  bodyShape.closePath();

  const fuselageGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 3.1,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  fuselageGeo.translate(0, 0, -1.55);
  const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
  fuselage.castShadow = !isSoftwareGl;
  group.add(fuselage);

  // 2. Sharp supersonic nosecone + pitot sensor needle
  const noseGeo = new THREE.ConeGeometry(0.56, 2.2, 6);
  noseGeo.rotateX(-Math.PI / 2);
  noseGeo.scale(1.08, 0.58, 1);
  const nose = new THREE.Mesh(noseGeo, hullMat);
  nose.position.set(0, 0.02, -2.55);
  nose.castShadow = !isSoftwareGl;
  group.add(nose);

  const pitotGeo = new THREE.CylinderGeometry(0.015, 0.035, 0.85, 6);
  pitotGeo.rotateX(-Math.PI / 2);
  const pitot = new THREE.Mesh(pitotGeo, nozzleMat);
  pitot.position.set(0, 0.02, -3.95);
  group.add(pitot);

  // 3. Swept delta main wings (extruded with bevels)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.42, 1.0);
  wingShape.lineTo(3.25, 0.25);
  wingShape.lineTo(3.45, -0.35);
  wingShape.lineTo(1.75, -0.75);
  wingShape.lineTo(0.45, -1.5);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.04,
    bevelSegments: 1,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, hullMat);
  rightWing.position.set(0, -0.02, 0.35);
  rightWing.rotation.z = -0.06;
  rightWing.castShadow = !isSoftwareGl;
  group.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.x = -1;
  leftWing.rotation.z = 0.06;
  group.add(leftWing);

  // 4. Carbon wing armor strakes & forward canards
  const canardGeo = new THREE.BoxGeometry(1.15, 0.06, 0.42);
  const rightCanard = new THREE.Mesh(canardGeo, carbonTrimMat);
  rightCanard.position.set(0.82, 0.04, -1.45);
  rightCanard.rotation.y = -0.38;
  rightCanard.rotation.z = 0.12;
  group.add(rightCanard);

  const leftCanard = rightCanard.clone();
  leftCanard.position.x = -0.82;
  leftCanard.rotation.y = 0.38;
  leftCanard.rotation.z = -0.12;
  group.add(leftCanard);

  // 5. Dual canted vertical tail stabilizers
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.15, 0);
  finShape.lineTo(0.35, 1.15);
  finShape.lineTo(-0.18, 1.05);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  finGeo.rotateY(Math.PI / 2);

  const rightFin = new THREE.Mesh(finGeo, carbonTrimMat);
  rightFin.position.set(0.62, 0.18, 1.55);
  rightFin.rotation.z = -0.34;
  group.add(rightFin);

  const leftFin = new THREE.Mesh(finGeo, carbonTrimMat);
  leftFin.position.set(-0.69, 0.18, 1.55);
  leftFin.rotation.z = 0.34;
  group.add(leftFin);

  // 6. Tinted glass cockpit canopy + interior pilot deck
  const deckGeo = new THREE.BoxGeometry(0.56, 0.16, 1.25);
  const deck = new THREE.Mesh(deckGeo, carbonTrimMat);
  deck.position.set(0, 0.28, -0.58);
  group.add(deck);

  const canopyGeo = new THREE.SphereGeometry(0.48, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
  canopyGeo.scale(0.86, 0.85, 2.35);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.24, -0.52);
  canopy.renderOrder = 3;
  group.add(canopy);

  // 7. Twin wingtip plasma cannon pods & glowing muzzles
  const podGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.55, 8);
  podGeo.rotateX(Math.PI / 2);
  const barrelGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.72, 8);
  barrelGeo.rotateX(Math.PI / 2);

  const rightPod = new THREE.Mesh(podGeo, carbonTrimMat);
  rightPod.position.set(2.85, -0.14, 0.25);
  group.add(rightPod);
  const rightBarrel = new THREE.Mesh(barrelGeo, accentCyanMat);
  rightBarrel.position.set(2.85, -0.14, -0.78);
  group.add(rightBarrel);

  const leftPod = new THREE.Mesh(podGeo, carbonTrimMat);
  leftPod.position.set(-2.85, -0.14, 0.25);
  group.add(leftPod);
  const leftBarrel = new THREE.Mesh(barrelGeo, accentCyanMat);
  leftBarrel.position.set(-2.85, -0.14, -0.78);
  group.add(leftBarrel);

  const leftMuzzle = new THREE.Object3D();
  leftMuzzle.position.set(-2.85, -0.14, -1.2);
  group.add(leftMuzzle);

  const rightMuzzle = new THREE.Object3D();
  rightMuzzle.position.set(2.85, -0.14, -1.2);
  group.add(rightMuzzle);

  // 8. Glowing wingtip navigation accents
  const tipLightGeo = new THREE.BoxGeometry(0.14, 0.08, 0.65);
  const rightTipLight = new THREE.Mesh(tipLightGeo, accentCyanMat);
  rightTipLight.position.set(3.38, -0.15, 0.35);
  group.add(rightTipLight);

  const leftTipLight = new THREE.Mesh(tipLightGeo, accentAmberMat);
  leftTipLight.position.set(-3.38, -0.15, 0.35);
  group.add(leftTipLight);

  // 9. Twin recessed engine nacelles + exhaust rings
  const nacelleGeo = new THREE.CylinderGeometry(0.32, 0.26, 0.85, 12);
  nacelleGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.25, 0.04, 8, 18);

  const engineOffsets = [-0.46, 0.46];
  engineOffsets.forEach((ex) => {
    const nacelle = new THREE.Mesh(nacelleGeo, nozzleMat);
    nacelle.position.set(ex, -0.02, 1.72);
    group.add(nacelle);

    const glowRing = new THREE.Mesh(ringGeo, accentCyanMat);
    glowRing.position.set(ex, -0.02, 2.13);
    group.add(glowRing);
  });

  // 10. Animated dual plasma afterburner cones
  const flameGeo = new THREE.ConeGeometry(0.24, 2.4, 12, 1, true);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 1.2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const leftFlame = new THREE.Mesh(flameGeo, flameMat);
  leftFlame.position.set(-0.46, -0.02, 2.1);
  group.add(leftFlame);

  const rightFlame = new THREE.Mesh(flameGeo, flameMat);
  rightFlame.position.set(0.46, -0.02, 2.1);
  group.add(rightFlame);

  // 11. Barrel Roll Aegis Invulnerability Shield (hidden until Barrel Roll)
  const shieldGeo = new THREE.IcosahedronGeometry(3.85, 2);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    wireframe: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shieldShell = new THREE.Mesh(shieldGeo, shieldMat);
  shieldShell.scale.set(1.0, 0.55, 1.15);
  shieldShell.visible = false;
  shieldShell.renderOrder = 6;
  group.add(shieldShell);

  // 12. Dynamic thruster glow light
  const thrusterLight = new THREE.PointLight(0x38bdf8, 4.5, 18, 1.8);
  thrusterLight.position.set(0, -0.2, 2.6);
  group.add(thrusterLight);

  return {
    group,
    leftFlame,
    rightFlame,
    shieldShell,
    thrusterLight,
    leftMuzzle,
    rightMuzzle,
    wingtipLights: [leftTipLight, rightTipLight],
  };
}

/**
 * Composite 7-part Defense Tower anchored at bottom-center (y = 0).
 */
export function createDefenseTowerModel(
  sharedMaterials: {
    baseMat: THREE.MeshStandardMaterial;
    armorMat: THREE.MeshStandardMaterial;
    coreMat: THREE.MeshStandardMaterial;
    trimMat: THREE.MeshStandardMaterial;
  },
  heightScale = 1.0
): DefenseTowerRig {
  const group = new THREE.Group();

  // 1. Hexagonal armored base plinth (bottom sits flush at y = 0)
  const baseGeo = new THREE.CylinderGeometry(2.1, 2.75, 1.6, 6);
  baseGeo.translate(0, 0.8, 0);
  const base = new THREE.Mesh(baseGeo, sharedMaterials.baseMat);
  group.add(base);

  // 2. Tapered reinforced pylon column
  const colHeight = 6.2 * heightScale;
  const colGeo = new THREE.CylinderGeometry(1.15, 1.7, colHeight, 8);
  colGeo.translate(0, 1.6 + colHeight * 0.5, 0);
  const col = new THREE.Mesh(colGeo, sharedMaterials.armorMat);
  group.add(col);

  // 3. Structural collar ring
  const collarGeo = new THREE.CylinderGeometry(1.65, 1.55, 0.65, 8);
  const collar = new THREE.Mesh(collarGeo, sharedMaterials.trimMat);
  collar.position.y = 1.6 + colHeight - 0.3;
  group.add(collar);

  // 4. Rotating turret head group
  const turretHead = new THREE.Group();
  turretHead.position.y = 1.6 + colHeight + 0.9;

  const housingGeo = new THREE.BoxGeometry(2.3, 1.55, 2.4);
  const housing = new THREE.Mesh(housingGeo, sharedMaterials.armorMat);
  turretHead.add(housing);

  // 5. Glowing crimson energy reactor core (visual target lock-on point)
  const coreGeo = new THREE.OctahedronGeometry(0.95, 0);
  const coreMesh = new THREE.Mesh(coreGeo, sharedMaterials.coreMat);
  coreMesh.position.set(0, 1.25, 0);
  turretHead.add(coreMesh);

  // 6. Twin heavy plasma barrels pointing along +Z (toward approaching fighter)
  const barrelGeo = new THREE.CylinderGeometry(0.2, 0.25, 2.5, 8);
  barrelGeo.rotateX(Math.PI / 2);

  const leftBarrel = new THREE.Mesh(barrelGeo, sharedMaterials.baseMat);
  leftBarrel.position.set(-0.78, 0.05, 1.65);
  turretHead.add(leftBarrel);

  const rightBarrel = new THREE.Mesh(barrelGeo, sharedMaterials.baseMat);
  rightBarrel.position.set(0.78, 0.05, 1.65);
  turretHead.add(rightBarrel);

  // 7. Side armored shields
  const cheekGeo = new THREE.BoxGeometry(0.35, 1.3, 1.9);
  const leftCheek = new THREE.Mesh(cheekGeo, sharedMaterials.trimMat);
  leftCheek.position.set(-1.32, 0, 0.1);
  turretHead.add(leftCheek);

  const rightCheek = leftCheek.clone();
  rightCheek.position.x = 1.32;
  turretHead.add(rightCheek);

  const muzzleLeft = new THREE.Object3D();
  muzzleLeft.position.set(-0.78, 0.05, 2.95);
  turretHead.add(muzzleLeft);

  const muzzleRight = new THREE.Object3D();
  muzzleRight.position.set(0.78, 0.05, 2.95);
  turretHead.add(muzzleRight);

  group.add(turretHead);

  return { group, turretHead, coreMesh, muzzleLeft, muzzleRight };
}

/**
 * Composite 5-part Energy Boost Ring.
 */
export function createEnergyRingModel(shared: {
  frameMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshStandardMaterial;
  fieldMat: THREE.MeshBasicMaterial;
}): EnergyRingRig {
  const group = new THREE.Group();

  // Outer chamfered structural ring
  const outerGeo = new THREE.TorusGeometry(4.6, 0.32, 10, 28);
  const outer = new THREE.Mesh(outerGeo, shared.frameMat);
  group.add(outer);

  // Inner spinning glowing energy ring
  const innerGeo = new THREE.TorusGeometry(4.05, 0.16, 8, 24);
  const innerRing = new THREE.Mesh(innerGeo, shared.glowMat);
  group.add(innerRing);

  // 4 cardinal stabilizer brackets
  const bracketGeo = new THREE.BoxGeometry(0.55, 1.15, 0.72);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const bracket = new THREE.Mesh(bracketGeo, shared.frameMat);
    bracket.position.set(Math.cos(angle) * 4.85, Math.sin(angle) * 4.85, 0);
    bracket.rotation.z = angle + Math.PI / 2;
    group.add(bracket);
  }

  // Translucent energy warp membrane
  const discGeo = new THREE.CircleGeometry(3.85, 24);
  const fieldDisc = new THREE.Mesh(discGeo, shared.fieldMat);
  fieldDisc.renderOrder = 2;
  group.add(fieldDisc);

  return { group, innerRing, fieldDisc };
}

/**
 * Faceted displaced asteroid geometry for meteorite field.
 */
export function createAsteroidGeometry(seed: number, radius = 1.8): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const noise =
      0.78 +
      0.24 * Math.sin(vx * 2.1 + seed) * Math.cos(vy * 2.3 - seed * 0.7) +
      0.16 * Math.sin(vz * 3.1 + seed * 1.4);
    pos.setXYZ(i, vx * noise, vy * noise, vz * noise);
  }
  geo.computeVertexNormals();
  return geo;
}
