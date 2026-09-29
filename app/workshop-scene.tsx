"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Props = {
  active: boolean;
  currentStep: number;
  helpLevel: number;
  engineRunning: boolean;
  completedTargets: string[];
  actionPulse: number;
  resetToken: number;
  cameraSensitivity: number;
  cameraResetToken: number;
  reducedMotion: boolean;
  focusTarget: string | null;
  approachToken: number;
  onTargetActivate: (id: string) => void;
  onNearbyChange: (id: string | null) => void;
  onNavigationChange: (info: { label: string; distance: number; angle: number } | null) => void;
  onTutorialAction: (action: "move" | "look") => void;
};

type Target = {
  id: string;
  label: string;
  root: THREE.Group;
  marker: THREE.Mesh;
  steps: number[];
};

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const boxGeometryCache = new Map<string, THREE.BoxGeometry>();
const cylinderGeometryCache = new Map<string, THREE.CylinderGeometry>();
const textureCache = new Map<string, THREE.CanvasTexture>();

type SurfaceTexture = "concrete" | "brushed-metal" | "rubber" | "paint";

function material(color: number, roughness = 0.65, metalness = 0.05) {
  const key = `${color}:${roughness}:${metalness}`;
  let cached = materialCache.get(key);
  if (!cached) {
    cached = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materialCache.set(key, cached);
  }
  return cached;
}

function proceduralTexture(surface: SurfaceTexture, repeat: [number, number]) {
  const key = `${surface}:${repeat.join(":")}`;
  let cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const noise = (seed: number) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };

  if (surface === "concrete") {
    context.fillStyle = "#aebbc0";
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1100; i++) {
      const alpha = 0.035 + noise(i * 3.1) * 0.09;
      context.fillStyle = `rgba(42,58,65,${alpha})`;
      const size = 1 + noise(i * 7.7) * 3;
      context.fillRect(noise(i * 1.7) * 256, noise(i * 2.4) * 256, size, size);
    }
    context.strokeStyle = "rgba(245,250,250,.13)";
    context.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      context.beginPath();
      context.moveTo(noise(i * 4.6) * 256, noise(i * 5.8) * 256);
      context.lineTo(noise(i * 8.2) * 256, noise(i * 9.1) * 256);
      context.stroke();
    }
  } else if (surface === "brushed-metal") {
    const gradient = context.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, "#667981");
    gradient.addColorStop(0.5, "#a7b7bc");
    gradient.addColorStop(1, "#52666f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 180; i++) {
      context.strokeStyle = `rgba(255,255,255,${0.04 + noise(i * 3.4) * 0.12})`;
      context.lineWidth = 0.5 + noise(i * 4.9);
      const y = noise(i * 1.8) * 256;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(256, y + (noise(i * 6.2) - 0.5) * 5);
      context.stroke();
    }
  } else if (surface === "rubber") {
    context.fillStyle = "#111a21";
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = "rgba(141,158,165,.2)";
    context.lineWidth = 5;
    for (let i = -256; i < 512; i += 28) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i + 120, 256);
      context.stroke();
    }
    context.strokeStyle = "rgba(0,0,0,.35)";
    context.lineWidth = 3;
    for (let i = -256; i < 512; i += 28) {
      context.beginPath();
      context.moveTo(i + 10, 0);
      context.lineTo(i + 130, 256);
      context.stroke();
    }
  } else {
    const gradient = context.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, "#f7fbfc");
    gradient.addColorStop(0.45, "#dfe9ed");
    gradient.addColorStop(1, "#b9ccd4");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = "rgba(255,255,255,.32)";
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(-20, 205);
    context.lineTo(205, -20);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  textureCache.set(key, texture);
  return texture;
}

function texturedMaterial(
  color: number,
  roughness: number,
  metalness: number,
  surface: SurfaceTexture,
  repeat: [number, number] = [1, 1],
) {
  const key = `${color}:${roughness}:${metalness}:${surface}:${repeat.join(":")}`;
  let cached = materialCache.get(key);
  if (!cached) {
    cached = new THREE.MeshStandardMaterial({
      color,
      map: proceduralTexture(surface, repeat),
      roughness,
      metalness,
    });
    materialCache.set(key, cached);
  }
  return cached;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  roughness = 0.65,
  metalness = 0.05,
  surface?: SurfaceTexture,
) {
  const geometryKey = size.join(":");
  let geometry = boxGeometryCache.get(geometryKey);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(...size);
    boxGeometryCache.set(geometryKey, geometry);
  }
  const mesh = new THREE.Mesh(geometry, surface ? texturedMaterial(color, roughness, metalness, surface) : material(color, roughness, metalness));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  position: [number, number, number],
  color: number,
  radialSegments = 20,
) {
  const geometryKey = `${radius}:${height}:${radialSegments}`;
  let geometry = cylinderGeometryCache.get(geometryKey);
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);
    cylinderGeometryCache.set(geometryKey, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function extrudedProfile(
  parent: THREE.Object3D,
  points: Array<[number, number]>,
  depth: number,
  position: [number, number, number],
  color: number,
  roughness = 0.65,
  metalness = 0.05,
  bevel = 0.05,
  surface?: SurfaceTexture,
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel * 0.72,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, surface ? texturedMaterial(color, roughness, metalness, surface) : material(color, roughness, metalness));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function detailBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  roughness = 0.45,
  metalness = 0.25,
  surface?: SurfaceTexture,
) {
  const mesh = box(parent, size, position, color, roughness, metalness, surface);
  mesh.userData.detail = true;
  return mesh;
}

function createLabel(text: string, color = "#0d528e") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 110;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(247,252,255,.96)";
  context.strokeStyle = "rgba(255,255,255,.95)";
  context.lineWidth = 7;
  context.beginPath();
  context.roundRect(8, 8, 496, 94, 22);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.font = "700 36px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(2.65, 0.58, 1);
  return sprite;
}

function createWallSign(text: string, accent = "#1b78a6") {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 180;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f3f7f8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accent;
  context.fillRect(0, 0, 22, canvas.height);
  context.fillStyle = "#173d58";
  context.font = "800 54px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 398, 90);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, 0.87),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 }),
  );
  sign.userData.disposeMap = texture;
  return sign;
}

function makeTireRack(scene: THREE.Scene, x: number, z: number) {
  const rack = new THREE.Group();
  box(rack, [3.2, 0.12, 0.65], [0, 0.32, 0], 0x364753, 0.42, 0.45);
  box(rack, [3.2, 0.12, 0.65], [0, 1.42, 0], 0x364753, 0.42, 0.45);
  for (const side of [-1, 1]) box(rack, [0.12, 2.15, 0.65], [side * 1.54, 1.08, 0], 0x364753, 0.42, 0.45);
  for (const y of [0.77, 1.86]) {
    for (let i = 0; i < 4; i++) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.14, 10, 24), material(0x20262b, 0.82));
      tire.position.set(-1.15 + i * 0.76, y, 0);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      rack.add(tire);
    }
  }
  rack.position.set(x, 0, z);
  scene.add(rack);
}

function makeToolWall(scene: THREE.Scene, x: number, z: number) {
  const wall = new THREE.Group();
  box(wall, [4.3, 2.35, 0.16], [0, 1.68, 0], 0x315d70, 0.72, 0.15);
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 12; column++) {
      cylinder(wall, 0.018, 0.02, [-1.88 + column * 0.34, 0.78 + row * 0.38, 0.1], 0x91aab5, 8).rotation.x = Math.PI / 2;
    }
  }
  for (let i = 0; i < 9; i++) {
    box(wall, [0.08, 0.78 - (i % 3) * 0.08, 0.07], [-1.65 + i * 0.4, 1.72, 0.16], i < 5 ? 0xd7dde0 : 0xe7a93b, 0.3, 0.65).rotation.z = i % 2 ? 0.08 : -0.08;
  }
  for (let i = 0; i < 4; i++) box(wall, [0.18, 0.62, 0.12], [-0.65 + i * 0.5, 0.92, 0.18], 0xc84c3f, 0.55);
  wall.position.set(x, 0, z);
  scene.add(wall);
}

function makeEngineStand(scene: THREE.Scene, x: number, z: number) {
  const stand = new THREE.Group();
  box(stand, [2.15, 0.16, 1.25], [0, 0.18, 0], 0x33444f, 0.45, 0.5);
  box(stand, [0.16, 1.45, 0.16], [-0.84, 0.83, 0], 0x33444f, 0.45, 0.5);
  box(stand, [0.55, 0.16, 0.9], [-0.58, 1.43, 0], 0x33444f, 0.45, 0.5);
  box(stand, [1.05, 0.72, 0.86], [0.12, 1.34, 0], 0x46535c, 0.52, 0.5);
  box(stand, [0.86, 0.28, 0.72], [0.1, 1.82, 0], 0x26343d, 0.44, 0.45);
  for (let i = 0; i < 4; i++) cylinder(stand, 0.085, 0.62, [-0.23 + i * 0.18, 1.98, 0], 0xb8c0c4, 12).rotation.z = Math.PI / 2;
  for (const px of [-0.82, 0.82]) for (const pz of [-0.45, 0.45]) cylinder(stand, 0.11, 0.09, [px, 0.08, pz], 0x1e252a, 14).rotation.z = Math.PI / 2;
  stand.position.set(x, 0, z);
  scene.add(stand);
}

function makeSafetyStation(scene: THREE.Scene, x: number, z: number) {
  const station = new THREE.Group();
  box(station, [1.9, 2.1, 0.15], [0, 1.45, 0], 0xf1f4f2, 0.75);
  box(station, [0.48, 0.48, 0.13], [-0.48, 1.88, 0.13], 0x2aa36c, 0.6);
  box(station, [0.11, 0.34, 0.16], [-0.48, 1.88, 0.21], 0xffffff, 0.7);
  box(station, [0.34, 0.11, 0.16], [-0.48, 1.88, 0.21], 0xffffff, 0.7);
  cylinder(station, 0.2, 0.78, [0.5, 0.78, 0.22], 0xd7453e, 18);
  box(station, [0.28, 0.17, 0.16], [0.5, 1.22, 0.22], 0x252f35, 0.5);
  station.position.set(x, 0, z);
  scene.add(station);
}

function makeDiagnosticStation(scene: THREE.Scene, x: number, z: number) {
  const station = new THREE.Group();
  box(station, [3.1, 0.16, 1.05], [0, 1.0, 0], 0x465760, 0.38, 0.52);
  for (const px of [-1.35, 1.35]) for (const pz of [-0.38, 0.38]) box(station, [0.14, 1, 0.14], [px, 0.5, pz], 0x33444d, 0.45, 0.5);
  box(station, [0.95, 0.08, 0.55], [-0.72, 1.28, 0], 0x20303a, 0.5, 0.35);
  box(station, [0.78, 0.46, 0.08], [-0.72, 1.55, -0.2], 0x2b91aa, 0.28, 0.25);
  box(station, [0.48, 0.13, 0.65], [0.55, 1.16, 0], 0xc7463e, 0.52);
  box(station, [0.32, 0.025, 0.28], [0.55, 1.24, -0.08], 0x8ccedd, 0.2, 0.15);
  const cable = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.025, 8, 24, Math.PI * 1.55),
    material(0x27343b, 0.7),
  );
  cable.position.set(1.02, 1.13, 0.2);
  cable.rotation.x = Math.PI / 2;
  station.add(cable);
  station.position.set(x, 0, z);
  scene.add(station);
}

function makeComponentDisplay(scene: THREE.Scene, x: number, z: number) {
  const display = new THREE.Group();
  box(display, [3.8, 2.5, 0.18], [0, 1.55, 0], 0x41545e, 0.65, 0.3);
  const brakeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.11, 28), material(0x9ca9ae, 0.28, 0.72));
  brakeDisc.rotation.x = Math.PI / 2;
  brakeDisc.position.set(-1.12, 1.72, 0.14);
  display.add(brakeDisc);
  cylinder(display, 0.18, 0.14, [-1.12, 1.72, 0.15], 0x485860, 18).rotation.x = Math.PI / 2;
  const spring = new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.045, 64, 8, 2, 5), material(0x246f91, 0.35, 0.45));
  spring.scale.set(0.72, 1.3, 0.72);
  spring.position.set(0.05, 1.72, 0.18);
  display.add(spring);
  box(display, [0.55, 0.72, 0.16], [1.15, 1.72, 0.14], 0x303d45, 0.5, 0.35);
  for (let i = 0; i < 4; i++) cylinder(display, 0.045, 0.4, [0.92 + i * 0.15, 1.74, 0.3], 0xb6c0c4, 10);
  display.position.set(x, 0, z);
  scene.add(display);
}

function makeCeilingSystem(scene: THREE.Scene) {
  for (const z of [-8.6, -3.1, 2.4, 7.9]) {
    box(scene, [32.6, 0.18, 0.24], [0, 7.05, z], 0x425762, 0.48, 0.55);
    for (const x of [-14, -8, -2, 4, 10, 14]) box(scene, [0.13, 0.72, 0.13], [x, 6.7, z], 0x526771, 0.48, 0.5);
  }
  for (const x of [-12, -4, 4, 12]) box(scene, [0.2, 0.2, 23], [x, 7.05, 0], 0x425762, 0.48, 0.55);
  const ductMat = material(0x819197, 0.42, 0.48);
  const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 24, 16), ductMat);
  duct.rotation.x = Math.PI / 2;
  duct.position.set(-13.8, 6.45, 0);
  scene.add(duct);
  for (const z of [-7, 0, 7]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.3, 14), ductMat);
    branch.rotation.z = Math.PI / 2;
    branch.position.set(-12.7, 6.45, z);
    scene.add(branch);
  }
}

function makeAulaTpWorkshopShell(scene: THREE.Scene) {
  const graphite = 0x344750;
  const seam = 0x253943;
  const aulaBlue = 0x167493;
  const warmTechnicalWhite = 0xdfe6e6;

  // Repeated panels establish a reusable Aula TP industrial architecture without changing the map.
  for (let i = 0; i < 7; i++) {
    const x = -14.4 + i * 4.8;
    box(scene, [4.62, 1.28, 0.08], [x, 0.64, -10.2], graphite, 0.76, 0.12, "brushed-metal");
    box(scene, [4.62, 0.11, 0.1], [x, 1.34, -10.15], aulaBlue, 0.48, 0.2);
    box(scene, [0.08, 3.55, 0.11], [x + 2.35, 3.05, -10.13], seam, 0.68, 0.2);
  }
  for (const side of [-1, 1]) {
    const x = side * 16.62;
    for (let i = 0; i < 5; i++) {
      const z = -8 + i * 4;
      box(scene, [0.08, 1.28, 3.82], [x, 0.64, z], graphite, 0.76, 0.12, "brushed-metal");
      box(scene, [0.1, 0.11, 3.82], [x - side * 0.05, 1.34, z], aulaBlue, 0.48, 0.2);
      box(scene, [0.11, 3.55, 0.08], [x - side * 0.04, 3.05, z + 1.96], seam, 0.68, 0.2);
    }
  }

  // Segmented vehicle access and a matching pedestrian service door.
  box(scene, [5.5, 4.45, 0.12], [-12.8, 2.23, -10.08], warmTechnicalWhite, 0.72, 0.15);
  for (let i = 0; i < 5; i++) box(scene, [5.18, 0.075, 0.04], [-12.8, 0.47 + i * 0.89, -9.99], 0x82959c, 0.45, 0.42);
  for (const x of [-14.35, -12.8, -11.25]) box(scene, [0.08, 0.48, 0.05], [x, 3.56, -9.98], 0x4d7787, 0.35, 0.35);
  box(scene, [1.45, 2.45, 0.13], [14.65, 1.23, -10.07], 0x294953, 0.65, 0.38);
  box(scene, [1.16, 0.48, 0.05], [14.65, 1.86, -9.98], 0x6a9eae, 0.2, 0.25);
  cylinder(scene, 0.055, 0.06, [14.15, 1.16, -9.96], 0xd6b34a, 12).rotation.x = Math.PI / 2;

  // Restrained safety identifiers make the structural rhythm readable at a distance.
  for (const x of [-15.9, -5.3, 5.3, 15.9]) {
    box(scene, [0.48, 0.75, 0.48], [x, 0.38, -9.75], 0xe0ad3e, 0.58, 0.16);
    box(scene, [0.5, 0.13, 0.5], [x, 0.78, -9.75], seam, 0.5, 0.3);
  }
}

function vehicleMeshBox(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const meshBox = new THREE.Box3();
  const size = new THREE.Vector3();
  const volumes: number[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshBox.setFromObject(object);
    meshBox.getSize(size);
    volumes.push(size.x * size.y * size.z);
  });
  volumes.sort((a, b) => a - b);
  const median = volumes[Math.floor(volumes.length / 2)] || 1;
  const box = new THREE.Box3();
  let started = false;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshBox.setFromObject(object);
    meshBox.getSize(size);
    const volume = size.x * size.y * size.z;
    if (volume < median * 0.015 || volume > median * 50) return;
    if (!started) {
      box.copy(meshBox);
      started = true;
    } else {
      box.union(meshBox);
    }
  });
  return started ? box : new THREE.Box3().setFromObject(root);
}

function fitWorkshopVehicle(model: THREE.Object3D) {
  // Technician is ~2.2 units tall. The bay car should read about 5.6 units long
  // and 1.4 units high, centered on the yellow diagnosis pad.
  const size = new THREE.Vector3();
  let box = vehicleMeshBox(model);
  box.getSize(size);
  if (size.z > size.x) model.rotation.y += Math.PI / 2;

  box = vehicleMeshBox(model);
  box.getSize(size);
  const length = Math.max(size.x, size.z, 0.01);
  const height = Math.max(size.y, 0.01);
  let scale = 5.55 / length;
  let nextHeight = height * scale;
  if (nextHeight < 1.28) scale *= 1.38 / nextHeight;
  nextHeight = height * scale;
  if (nextHeight > 1.52) scale *= 1.42 / nextHeight;
  model.scale.multiplyScalar(scale);

  box = vehicleMeshBox(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

function publicAssetPath(path: string) {
  const mountedPrefix = window.location.pathname.startsWith("/mision_laboral") ? "/mision_laboral" : "";
  return `${mountedPrefix}${path}`;
}

function makeCar(scene: THREE.Scene) {
  const car = new THREE.Group();
  const engine = new THREE.Group();
  const statusLight = new THREE.PointLight(0xe44848, 0.9, 2.8);
  statusLight.position.set(-2.35, 1.15, 0.85);
  car.add(statusLight);
  car.position.set(1.45, 0, -1.05);
  car.rotation.y = 0;
  scene.add(car);

  const loader = new GLTFLoader();
  loader.load(
    publicAssetPath("/models/ferrari-f40-lb.glb"),
    (gltf) => {
      const model = gltf.scene;
      model.name = "ferrari-f40-liberty-walk";
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const entry of materials) {
            if (entry instanceof THREE.MeshStandardMaterial || entry instanceof THREE.MeshPhysicalMaterial) {
              entry.envMapIntensity = 1.15;
            }
          }
        }
      });
      fitWorkshopVehicle(model);
      car.add(model);
    },
    undefined,
    () => {
      // If the GLB fails, keep a readable bay placeholder so the mission still works.
      extrudedProfile(car, [
        [-2.42, 0.06], [-2.48, 0.38], [-2.18, 0.62], [-1.55, 0.7],
        [-1.12, 1.02], [0.94, 1.04], [1.46, 0.73], [2.34, 0.64],
        [2.48, 0.38], [2.43, 0.06],
      ], 2.08, [0, 0.48, 0], 0xe7eaed, 0.24, 0.58, 0.08, "paint");
    },
  );
  return { car, engine, statusLight };
}

function restKenArms(model: THREE.Object3D) {
  // The source mesh is a T-pose. Both the polo sleeves and the arms stick
  // straight out, so folding only the arms leaves the sleeves raised like wings.
  // Drop sleeves and arms together from the shoulder seam.
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const pivotY = 1.45;
    const pivotX = 0.16;
    const drop = (88 * Math.PI) / 180;
    let changed = false;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const reach = Math.abs(x);
      if (reach < 0.18 || y < 1.28 || y > 1.58) continue;
      const side = Math.sign(x) || 1;
      const weight = reach >= 0.24 ? 1 : (reach - 0.18) / 0.06;
      const angle = -side * drop * weight;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const originX = side * pivotX;
      const localX = x - originX;
      const localY = y - pivotY;
      position.setXYZ(
        i,
        localX * cos - localY * sin + originX,
        localX * sin + localY * cos + pivotY,
        z,
      );
      changed = true;
    }
    if (!changed) return;
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  });
}

function fitWorkshopCharacter(model: THREE.Object3D) {
  // Match the previous technician: about 2.2 units tall, feet on the floor,
  // body centered on the movement origin. The mesh already faces +Z, which is
  // the direction the avatar walks.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = 2.2 / Math.max(size.y, 0.01);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fitted.min.y;
}

function makeAvatar(scene: THREE.Scene) {
  const avatar = new THREE.Group();
  avatar.position.set(-1.6, 0, 5.8);
  avatar.rotation.y = -0.45;
  scene.add(avatar);

  const loader = new GLTFLoader();
  loader.load(publicAssetPath("/models/ken-dreamhouse.glb"), (gltf) => {
    const model = gltf.scene;
    model.name = "ken-dreamhouse";
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    restKenArms(model);
    fitWorkshopCharacter(model);
    avatar.add(model);
  });
  return avatar;
}

function makeNpc(scene: THREE.Scene) {
  const npc = new THREE.Group();
  const fallback = new THREE.Group();
  const uniform = material(0x174a78);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.78, 6, 12), uniform);
  body.position.y = 1.22;
  fallback.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), material(0xb97954));
  head.position.y = 2.07;
  fallback.add(head);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.58, 5, 10), uniform);
  arm.position.set(0.45, 1.28, 0);
  arm.rotation.z = -0.3;
  fallback.add(arm);
  npc.add(fallback);
  npc.position.set(-1.9, 0, -2.8);
  scene.add(npc);

  const loader = new GLTFLoader();
  loader.load(publicAssetPath("/models/mechanic.glb"), (gltf) => {
    const model = gltf.scene;
    model.name = "mechanic-character";
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const entry of materials) {
        if (entry instanceof THREE.MeshStandardMaterial || entry instanceof THREE.MeshPhysicalMaterial) {
          entry.envMapIntensity = 1.05;
        }
      }
    });
    fitWorkshopCharacter(model);
    fallback.visible = false;
    npc.add(model);
  });
  return { npc, arm };
}

function makeToolModel(id: string) {
  const group = new THREE.Group();
  if (id === "goggles") {
    for (const x of [-0.19, 0.19]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 8, 20), material(0x79d7ea, 0.18, 0.35));
      lens.position.x = x;
      group.add(lens);
    }
    box(group, [0.12, 0.035, 0.035], [0, 0, 0], 0x173e65);
  } else if (id === "gloves") {
    box(group, [0.25, 0.1, 0.34], [-0.15, 0, 0], 0x1f8bb7);
    box(group, [0.25, 0.1, 0.34], [0.15, 0, 0.07], 0x1f8bb7);
  } else if (id === "compression_gauge") {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.09, 24), material(0xdfe7e9, 0.25, 0.4));
    dial.rotation.x = Math.PI / 2;
    group.add(dial);
    cylinder(group, 0.045, 0.75, [0, 0, 0.5], 0x24343e, 12);
    cylinder(group, 0.08, 0.2, [0, 0, 0.92], 0xb88a39, 12);
  } else if (id === "feeler_gauge") {
    for (let i = 0; i < 7; i++) {
      const blade = box(group, [0.07, 0.025, 0.72], [(i - 3) * 0.045, i * 0.015, 0], 0xc3ccd0, 0.22, 0.8);
      blade.rotation.y = (i - 3) * 0.08;
    }
    cylinder(group, 0.09, 0.12, [0, 0.07, -0.32], 0x2f3e46, 14);
  } else if (id === "torque_wrench") {
    box(group, [0.12, 0.12, 0.9], [0, 0, 0], 0xb9c3c7, 0.25, 0.72);
    cylinder(group, 0.12, 0.38, [0, 0, 0.48], 0x263944, 14);
    box(group, [0.32, 0.22, 0.2], [0, 0, -0.5], 0x4b5c65, 0.3, 0.6);
  }
  group.rotation.x = -Math.PI / 2;
  group.scale.setScalar(1.2);
  return group;
}

function addTarget(targets: Target[], id: string, position: [number, number, number], steps: number[], label: string, color = 0x2eb5d0) {
  const root = new THREE.Group();
  root.position.set(...position);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.58, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.035;
  root.add(marker);
  const labelSprite = createLabel(label, color === 0xec6e50 ? "#a73e2f" : "#0b5a8f");
  labelSprite.position.y = 2.65;
  labelSprite.userData.label = true;
  root.add(labelSprite);
  targets.push({ id, label, root, marker, steps });
  return root;
}

export default function WorkshopScene({
  active,
  currentStep,
  helpLevel,
  engineRunning,
  completedTargets,
  actionPulse,
  resetToken,
  cameraSensitivity,
  cameraResetToken,
  reducedMotion,
  focusTarget,
  approachToken,
  onTargetActivate,
  onNearbyChange,
  onNavigationChange,
  onTutorialAction,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ active, currentStep, helpLevel, engineRunning, completedTargets, actionPulse, resetToken, cameraSensitivity, cameraResetToken, reducedMotion, focusTarget, approachToken });
  const nearbyCallbackRef = useRef(onNearbyChange);
  const navigationCallbackRef = useRef(onNavigationChange);
  const tutorialCallbackRef = useRef(onTutorialAction);
  const interactCallbackRef = useRef(onTargetActivate);
  stateRef.current = { active, currentStep, helpLevel, engineRunning, completedTargets, actionPulse, resetToken, cameraSensitivity, cameraResetToken, reducedMotion, focusTarget, approachToken };
  nearbyCallbackRef.current = onNearbyChange;
  navigationCallbackRef.current = onNavigationChange;
  tutorialCallbackRef.current = onTutorialAction;
  interactCallbackRef.current = onTargetActivate;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcbdce7);
    scene.fog = new THREE.Fog(0xcbdce7, 25, 47);
    const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const maxPixelRatio = window.innerWidth <= 700 ? 1.1 : 1.4;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8f5ff, 0x46505a, 2.15));
    const sun = new THREE.DirectionalLight(0xfff4dc, 3.25);
    sun.position.set(6, 13, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    scene.add(sun);
    for (const x of [-10, -3, 4, 11]) {
      const light = new THREE.RectAreaLight(0xdaf4ff, 4.5, 3.2, 0.35);
      light.position.set(x, 6.5, -2);
      light.rotation.x = -Math.PI / 2;
      scene.add(light);
      box(scene, [3.2, 0.08, 0.34], [x, 6.48, -2], 0xf6fbff, 0.15, 0.2);
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 25), texturedMaterial(0xb8c1c6, 0.86, 0.02, "concrete", [7, 5]));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const floorGrid = new THREE.GridHelper(34, 34, 0x7d929d, 0x9fadb4);
    floorGrid.material.opacity = 0.19;
    floorGrid.material.transparent = true;
    scene.add(floorGrid);
    box(scene, [11.7, 0.014, 6.2], [1.45, 0.012, -1.0], 0x9eafb5, 0.62);
    box(scene, [6.2, 0.015, 5.4], [-11.4, 0.013, -5.0], 0x879ba4, 0.62);
    box(scene, [6.1, 0.015, 5.2], [11.6, 0.013, 6.3], 0x9aabb1, 0.62);
    for (const z of [-4.15, 2.15]) box(scene, [13.5, 0.018, 0.11], [1.4, 0.016, z], 0xf1c94d);
    for (const x of [-4.9, 7.7]) {
      box(scene, [0.11, 0.02, 5.9], [x, 0.018, -1.0], 0xf1c94d);
      box(scene, [0.58, 0.021, 0.13], [x, 0.019, 2.1], 0xf1c94d);
    }

    box(scene, [34, 7.5, 0.35], [0, 3.75, -10.4], 0xdfe5e4, 0.82);
    box(scene, [0.35, 7.5, 25], [-16.8, 3.75, 0], 0xd9e1e1, 0.82);
    box(scene, [0.35, 7.5, 25], [16.8, 3.75, 0], 0xd9e1e1, 0.82);
    makeAulaTpWorkshopShell(scene);
    makeCeilingSystem(scene);
    for (const x of [-13.2, -7.7, -2.2, 3.3, 8.8, 14.3]) {
      box(scene, [4.45, 1.2, 0.12], [x, 6.05, -10.17], 0x87aebc, 0.2, 0.22);
      box(scene, [4.1, 0.92, 0.04], [x, 6.05, -10.08], 0xb9d6df, 0.12, 0.12);
    }
    for (const x of [-16.45, 16.45]) {
      for (const z of [-7.5, -2.5, 2.5, 7.5]) box(scene, [0.16, 6.7, 0.48], [x, 3.35, z], 0x3f5866, 0.45, 0.48);
    }
    box(scene, [10, 1.45, 0.1], [2.5, 3.9, -10.18], 0x0a4e8d);
    box(scene, [8, 0.18, 0.12], [2.5, 3.1, -10.1], 0x24a6bb);
    const workshopSign = createLabel("MECÁNICA AUTOMOTRIZ", "#0d477c");
    workshopSign.position.set(2.5, 4.25, -10.05);
    workshopSign.scale.set(7, 1.35, 1);
    scene.add(workshopSign);

    const diagnosisSign = createWallSign("ZONA 02 · DIAGNÓSTICO");
    diagnosisSign.position.set(2.2, 5.35, -10.15);
    scene.add(diagnosisSign);
    const toolsSign = createWallSign("ZONA 03 · HERRAMIENTAS", "#d59a2b");
    toolsSign.position.set(-10.8, 5.2, -10.14);
    scene.add(toolsSign);
    const injectionSign = createWallSign("AJUSTE DE MOTORES", "#2b9b78");
    injectionSign.position.set(10.2, 3.35, -10.13);
    injectionSign.scale.set(0.92, 0.92, 0.92);
    scene.add(injectionSign);

    for (const x of [-9.8, -6.9, 8.7, 11.6]) {
      box(scene, [2.2, 1.15, 0.9], [x, 0.58, -7.5], 0x176f92, 0.5, 0.18);
      box(scene, [2.4, 0.14, 1.05], [x, 1.21, -7.5], 0x263443, 0.35);
      for (let y = 0.35; y < 1.1; y += 0.25) box(scene, [1.8, 0.04, 0.02], [x, y, -7.03], 0x9fc3cf);
      for (const px of [-0.82, 0.82]) cylinder(scene, 0.09, 0.08, [x + px, 0.08, -7.5], 0x202b31, 12).rotation.z = Math.PI / 2;
    }
    box(scene, [3.8, 2.55, 0.45], [-11.1, 1.27, -3.0], 0x315d70);
    for (let i = 0; i < 8; i++) box(scene, [0.08, 0.9, 0.08], [-12.4 + i * 0.38, 1.55, -2.72], i % 2 ? 0xf2bd40 : 0xb7c4ca);
    box(scene, [4.1, 2.8, 0.22], [10.15, 1.4, -9.95], 0xf6fafb);
    box(scene, [3.4, 1.2, 0.8], [10.15, 0.6, -8.15], 0x596f7b);

    makeToolWall(scene, -11.1, -2.78);
    makeTireRack(scene, 13.2, -7.75);
    makeEngineStand(scene, 11.9, 5.9);
    makeSafetyStation(scene, -15.95, -7.55);
    makeDiagnosticStation(scene, -13.2, 7.7);
    makeComponentDisplay(scene, 14.6, -2.4);

    // Compact support equipment keeps the circulation corridor around the mission vehicle clear.
    const compressor = new THREE.Group();
    cylinder(compressor, 0.52, 1.65, [0, 0.7, 0], 0x2f7086, 24).rotation.z = Math.PI / 2;
    box(compressor, [0.65, 0.48, 0.5], [-0.45, 1.32, 0], 0x374852, 0.5, 0.35);
    for (const px of [-0.62, 0.62]) cylinder(compressor, 0.15, 0.12, [px, 0.16, 0], 0x242b30, 14).rotation.z = Math.PI / 2;
    compressor.position.set(14.6, 0, 7.4);
    scene.add(compressor);

    const partsShelf = new THREE.Group();
    for (const y of [0.35, 1.12, 1.89, 2.66]) box(partsShelf, [3.5, 0.12, 0.82], [0, y, 0], 0x465760, 0.48, 0.42);
    for (const side of [-1, 1]) box(partsShelf, [0.14, 2.95, 0.82], [side * 1.68, 1.48, 0], 0x3c4d56, 0.48, 0.42);
    const partColors = [0x2b8fab, 0xd6a13d, 0x4f626c, 0xb6433d];
    for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) box(partsShelf, [0.62, 0.42, 0.58], [-1.16 + column * 0.77, 0.66 + row * 0.77, 0], partColors[(row + column) % partColors.length], 0.72);
    partsShelf.position.set(14.55, 0, 1.4);
    scene.add(partsShelf);

    const injectionBench = new THREE.Group();
    box(injectionBench, [3.2, 0.18, 1.05], [0, 1.03, 0], 0x5b6b72, 0.38, 0.48);
    for (const px of [-1.38, 1.38]) for (const pz of [-0.38, 0.38]) box(injectionBench, [0.14, 1.02, 0.14], [px, 0.51, pz], 0x3b4950, 0.45, 0.45);
    box(injectionBench, [2.25, 0.12, 0.32], [0, 1.22, 0], 0xb8c3c7, 0.4, 0.6);
    for (let i = 0; i < 4; i++) cylinder(injectionBench, 0.07, 0.38, [-0.58 + i * 0.38, 1.43, 0], 0x35505d, 12);
    box(injectionBench, [0.78, 0.52, 0.12], [0.95, 1.35, 0], 0x21769a, 0.48);
    injectionBench.position.set(9.7, 0, 8.65);
    scene.add(injectionBench);

    for (const z of [-3.55, 1.15]) {
      box(scene, [0.48, 5.9, 0.48], [0.25, 2.95, z], 0x1464a5, 0.35);
      box(scene, [1.8, 0.18, 0.5], [1.1, 0.55, z], 0x154f82, 0.4);
    }
    const { statusLight } = makeCar(scene);
    const { npc, arm: npcArm } = makeNpc(scene);
    const avatar = makeAvatar(scene);

    const targets: Target[] = [];
    const npcTarget = addTarget(targets, "npc", [-1.9, 0, -2.8], [1], "Mateo · Técnico");
    npcTarget.children[1].position.y = 2.9;
    scene.add(npcTarget);
    const vehicleTarget = addTarget(targets, "vehicle", [1.45, 0, 1.35], [1], "Inspeccionar vehículo");
    vehicleTarget.children[1].position.y = 2.15;
    scene.add(vehicleTarget);

    const toolPositions: Record<string, [number, number, number]> = {
      goggles: [-12.15, 1.55, -1.85],
      gloves: [-10.65, 1.45, -1.85],
      compression_gauge: [-9.8, 1.42, -7.3],
      feeler_gauge: [-6.9, 1.42, -7.3],
      torque_wrench: [-8.35, 1.42, -7.3],
    };
    for (const [id, position] of Object.entries(toolPositions)) {
      const target = addTarget(targets, id, [position[0], 0, position[2]], [2], id === "compression_gauge" ? "Compresímetro" : id === "feeler_gauge" ? "Juego de galgas" : id === "torque_wrench" ? "Llave dinamométrica" : id === "goggles" ? "Lentes" : "Guantes");
      const model = makeToolModel(id);
      model.position.set(0, position[1], 0);
      target.add(model);
      scene.add(target);
    }

    const manualTarget = addTarget(targets, "manual", [10.2, 0, -7.45], [3], "Manual de servicio");
    box(manualTarget, [0.85, 0.12, 0.65], [0, 1.33, 0], 0x1769ac, 0.5);
    box(manualTarget, [0.72, 0.02, 0.52], [0, 1.405, 0], 0xf4f6f2, 0.8);
    scene.add(manualTarget);
    const compressionTarget = addTarget(targets, "compression_test", [4.95, 0, 0.85], [3, 5], "Capó · compresión");
    cylinder(compressionTarget, 0.23, 0.1, [0, 0.92, 0], 0xd9e2e5, 20).rotation.x = Math.PI / 2;
    cylinder(compressionTarget, 0.045, 0.62, [0, 0.55, 0], 0x26333d, 12);
    scene.add(compressionTarget);
    const clearanceTarget = addTarget(targets, "valve_clearance", [4.95, 0, -2.25], [3], "Capó · holgura");
    for (let i = 0; i < 5; i++) box(clearanceTarget, [0.055, 0.025, 0.5], [(i - 2) * 0.05, 0.72 + i * 0.012, 0], 0xbcc6ca, 0.25, 0.75);
    scene.add(clearanceTarget);

    const injectorsTarget = addTarget(targets, "injectors", [4.9, 0, 0.9], [4], "Inyectores", 0xec6e50);
    for (let i = 0; i < 4; i++) cylinder(injectorsTarget, 0.07, 0.42, [-0.28 + i * 0.18, 0.75, 0], 0x4d606c, 12);
    scene.add(injectorsTarget);
    const gasketTarget = addTarget(targets, "head_gasket", [5.45, 0, -0.45], [4], "Culata", 0xec6e50);
    box(gasketTarget, [0.9, 0.22, 0.62], [0, 0.76, 0], 0x88969d, 0.3, 0.55);
    scene.add(gasketTarget);
    const adjustmentTarget = addTarget(targets, "valve_adjustment", [4.9, 0, -1.7], [4], "Ajustar válvulas", 0x2cab6f);
    box(adjustmentTarget, [0.65, 0.2, 0.42], [0, 0.75, 0], 0x394850, 0.45);
    for (let i = 0; i < 4; i++) cylinder(adjustmentTarget, 0.05, 0.28, [-0.23 + i * 0.15, 0.94, 0], 0x2cab6f, 10);
    scene.add(adjustmentTarget);
    const ignitionTarget = addTarget(targets, "ignition", [1.2, 0, -3.2], [5], "Cabina · encendido");
    box(ignitionTarget, [0.25, 0.25, 0.25], [0, 0.9, 0], 0xe0a93f, 0.35, 0.35);
    scene.add(ignitionTarget);

    const navigationWaypoint = new THREE.Group();
    const waypointRing = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.92, 36),
      new THREE.MeshBasicMaterial({ color: 0xf2b33f, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false }),
    );
    waypointRing.rotation.x = -Math.PI / 2;
    waypointRing.position.y = 0.045;
    navigationWaypoint.add(waypointRing);
    const waypointArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.55, 18),
      new THREE.MeshBasicMaterial({ color: 0xffcf55, transparent: true, opacity: 0.94, depthWrite: false }),
    );
    waypointArrow.position.y = 1.25;
    waypointArrow.rotation.z = Math.PI;
    navigationWaypoint.add(waypointArrow);
    navigationWaypoint.visible = false;
    scene.add(navigationWaypoint);

    const obstacles = [
      new THREE.Box2(new THREE.Vector2(-1.7, -2.55), new THREE.Vector2(4.6, 0.45)),
      new THREE.Box2(new THREE.Vector2(-13.2, -3.5), new THREE.Vector2(-9.15, -2.35)),
      new THREE.Box2(new THREE.Vector2(-11.1, -8.2), new THREE.Vector2(-8.5, -6.8)),
      new THREE.Box2(new THREE.Vector2(-8.2, -8.2), new THREE.Vector2(-5.6, -6.8)),
      new THREE.Box2(new THREE.Vector2(7.4, -8.2), new THREE.Vector2(12.9, -6.8)),
    ];
    const collides = (x: number, z: number) => obstacles.some((area) => area.containsPoint(new THREE.Vector2(x, z)));

    const pickMeshes: THREE.Mesh[] = [];
    for (const target of targets) {
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 2.15, 1.55),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.y = 1.05;
      hit.userData.pickId = target.id;
      target.root.add(hit);
      pickMeshes.push(hit);
    }
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickTarget = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickMeshes, false);
      const found = hits.find((entry) => entry.object.visible && entry.object.parent?.visible);
      const id = found?.object.userData.pickId;
      return typeof id === "string" ? id : null;
    };

    const keys = new Set<string>();
    let orbitYaw = -0.38;
    let orbitPitch = 0.24;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pressHit: string | null = null;
    let pressX = 0;
    let pressY = 0;
    let lastNearby: string | null = null;
    let lastNavigationKey = "";
    let lastPulse = actionPulse;
    let focusUntil = 0;
    let lastReset = resetToken;
    let lastCameraReset = cameraResetToken;
    let lastApproach = approachToken;
    let moveReported = false;
    let lookReported = false;
    let walk: { x: number; z: number; interactId: string | null } | null = null;
    const lookAt = (x: number, z: number) => {
      orbitYaw = Math.atan2(-(x - avatar.position.x), -(z - avatar.position.z));
      orbitPitch = 0.2;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (!moveReported && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.code)) {
        moveReported = true;
        tutorialCallbackRef.current("move");
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onPointerDown = (event: PointerEvent) => {
      const picked = stateRef.current.active ? pickTarget(event) : null;
      if (picked) {
        pressHit = picked;
        pressX = event.clientX;
        pressY = event.clientY;
        return;
      }
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const sensitivity = stateRef.current.cameraSensitivity;
      orbitYaw -= (event.clientX - lastX) * 0.006 * sensitivity;
      orbitPitch = THREE.MathUtils.clamp(orbitPitch + (event.clientY - lastY) * 0.004 * sensitivity, -0.12, 0.58);
      if (!lookReported && Math.abs(event.clientX - lastX) + Math.abs(event.clientY - lastY) > 3) {
        lookReported = true;
        tutorialCallbackRef.current("look");
      }
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pressHit && Math.hypot(event.clientX - pressX, event.clientY - pressY) < 12) {
        const id = pressHit;
        const target = targets.find((entry) => entry.id === id);
        if (target) {
          const focus = stateRef.current.focusTarget;
          const allowed = !focus || id === focus || focus === "hood" || stateRef.current.currentStep === 2;
          const distance = Math.hypot(avatar.position.x - target.root.position.x, avatar.position.z - target.root.position.z);
          if (allowed && distance > 2.6) walk = { x: target.root.position.x, z: target.root.position.z, interactId: id };
          else interactCallbackRef.current(id);
        }
      }
      pressHit = null;
      dragging = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    const direction = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    const desired = new THREE.Vector3();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const game = stateRef.current;

      if (game.resetToken !== lastReset) {
        lastReset = game.resetToken;
        avatar.position.set(-1.6, 0, 5.8);
        orbitYaw = -0.38;
        orbitPitch = 0.24;
        moveReported = false;
        lookReported = false;
        walk = null;
      }
      if (game.cameraResetToken !== lastCameraReset) {
        lastCameraReset = game.cameraResetToken;
        orbitYaw = avatar.rotation.y + Math.PI;
        orbitPitch = 0.24;
      }
      if (game.actionPulse !== lastPulse) {
        lastPulse = game.actionPulse;
        focusUntil = performance.now() + 900;
      }

      let moving = false;
      const manualMove = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].some((code) => keys.has(code));
      if (manualMove || !game.active) walk = null;
      if (walk && game.active) {
        const dx = walk.x - avatar.position.x;
        const dz = walk.z - avatar.position.z;
        const dist = Math.hypot(dx, dz);
        const arrive = () => {
          const arriveId = walk?.interactId ?? null;
          if (walk) lookAt(walk.x, walk.z);
          walk = null;
          velocity.set(0, 0, 0);
          if (arriveId) interactCallbackRef.current(arriveId);
        };
        if (dist < 1.15) {
          arrive();
        } else {
          moving = true;
          if (!moveReported) {
            moveReported = true;
            tutorialCallbackRef.current("move");
          }
          const step = Math.min(Math.max(dist - 0.9, 0), 4.4 * dt);
          const nx = THREE.MathUtils.clamp(avatar.position.x + (dx / dist) * step, -15.4, 15.4);
          const nz = THREE.MathUtils.clamp(avatar.position.z + (dz / dist) * step, -9.25, 11.2);
          if (!collides(nx, avatar.position.z)) avatar.position.x = nx;
          if (!collides(avatar.position.x, nz)) avatar.position.z = nz;
          const face = Math.atan2(dx, dz);
          avatar.rotation.y += Math.atan2(Math.sin(face - avatar.rotation.y), Math.cos(face - avatar.rotation.y)) * Math.min(1, dt * 10);
          const nextDist = Math.hypot(walk.x - avatar.position.x, walk.z - avatar.position.z);
          if (nextDist > dist - 0.01 && nextDist < 2.3) arrive();
        }
      } else if (game.active) {
        direction.set(0, 0, 0);
        forward.set(-Math.sin(orbitYaw), 0, -Math.cos(orbitYaw));
        right.set(Math.cos(orbitYaw), 0, -Math.sin(orbitYaw));
        if (keys.has("KeyW") || keys.has("ArrowUp")) direction.add(forward);
        if (keys.has("KeyS") || keys.has("ArrowDown")) direction.sub(forward);
        if (keys.has("KeyA") || keys.has("ArrowLeft")) direction.sub(right);
        if (keys.has("KeyD") || keys.has("ArrowRight")) direction.add(right);
        if (direction.lengthSq() > 0) {
          moving = true;
          if (!moveReported) {
            moveReported = true;
            tutorialCallbackRef.current("move");
          }
          direction.normalize();
          const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.3 : 3.15;
          const responsiveness = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.2 : 9.5;
          velocity.lerp(direction.multiplyScalar(speed), 1 - Math.exp(-responsiveness * dt));
        } else {
          velocity.multiplyScalar(Math.exp(-11 * dt));
        }
      } else {
        velocity.multiplyScalar(Math.exp(-14 * dt));
      }
      if (!walk && velocity.lengthSq() > 0.0025) {
        moving = true;
        const nextX = THREE.MathUtils.clamp(avatar.position.x + velocity.x * dt, -15.4, 15.4);
        const nextZ = THREE.MathUtils.clamp(avatar.position.z + velocity.z * dt, -9.25, 11.2);
        if (!collides(nextX, avatar.position.z)) avatar.position.x = nextX;
        else velocity.x = 0;
        if (!collides(avatar.position.x, nextZ)) avatar.position.z = nextZ;
        else velocity.z = 0;
        const targetRotation = Math.atan2(velocity.x, velocity.z);
        avatar.rotation.y += Math.atan2(Math.sin(targetRotation - avatar.rotation.y), Math.cos(targetRotation - avatar.rotation.y)) * Math.min(1, dt * 10);
      }
      const crouching = keys.has("KeyC") || keys.has("ControlLeft") || keys.has("ControlRight");
      avatar.scale.y = THREE.MathUtils.lerp(avatar.scale.y, crouching ? 0.72 : 1, 1 - Math.pow(0.005, dt));
      const stride = game.reducedMotion ? 0 : moving ? Math.sin(time * (keys.has("ShiftLeft") ? 13 : 9)) * 0.58 : Math.sin(time * 2) * 0.025;
      const bodyLift = game.reducedMotion || !moving ? 0 : Math.abs(Math.sin(time * (keys.has("ShiftLeft") ? 13 : 9))) * 0.035;
      avatar.position.y = THREE.MathUtils.lerp(avatar.position.y, bodyLift, 1 - Math.pow(0.02, dt));
      const inspecting = performance.now() < focusUntil;
      avatar.rotation.x = THREE.MathUtils.lerp(avatar.rotation.x, inspecting ? 0.22 : 0, 1 - Math.pow(0.02, dt));
      avatar.rotation.z = stride * 0.08;
      npc.rotation.y = game.reducedMotion ? 0.4 : Math.sin(time * 0.5) * 0.08 + 0.4;
      npcArm.rotation.z = game.reducedMotion ? -0.3 : -0.3 + Math.sin(time * 1.7) * 0.09;

      let nearest: Target | null = null;
      let nearestDistance = Infinity;
      for (const target of targets) {
        const engineCondition = target.id !== "compression_test" || game.currentStep !== 5 || game.engineRunning;
        const available = target.steps.includes(game.currentStep) && engineCondition;
        target.root.visible = available;
        if (!available || !game.active) continue;
        const distance = Math.hypot(avatar.position.x - target.root.position.x, avatar.position.z - target.root.position.z);
        const targetLabel = target.root.children.find((child) => child.userData.label);
        const choice = game.currentStep === 4 && target.steps.includes(4);
        const focused = choice || target.id === game.focusTarget;
        const reach = focused ? 2.7 : 1.55;
        const selectable = focused || game.currentStep === 2;
        target.marker.visible = focused || distance < 3.4;
        if (targetLabel) targetLabel.visible = focused || distance < 2.2;
        if (selectable && distance < reach && distance < nearestDistance) {
          nearest = target;
          nearestDistance = distance;
        }
        const pulse = 1 + Math.sin(time * 4.5) * (focused ? 0.12 : 0.04);
        target.marker.scale.setScalar(focused ? pulse * 1.35 : pulse);
        const markerMaterial = target.marker.material as THREE.MeshBasicMaterial;
        markerMaterial.opacity = focused ? 0.96 : 0.34;
      }
      const nearbyId = nearest?.id ?? null;
      if (nearbyId !== lastNearby) {
        lastNearby = nearbyId;
        nearbyCallbackRef.current(nearbyId);
      }

      let destination: { label: string; x: number; z: number } | null = null;
      if (game.focusTarget === "hood") {
        destination = { label: "Frente al capó", x: 5.55, z: -0.4 };
      } else if (game.focusTarget) {
        const focus = targets.find((target) => target.id === game.focusTarget);
        if (focus) destination = { label: focus.label, x: focus.root.position.x, z: focus.root.position.z };
      }
      if (game.approachToken !== lastApproach) {
        lastApproach = game.approachToken;
        if (destination) walk = { x: destination.x, z: destination.z, interactId: null };
      }

      navigationWaypoint.visible = Boolean(destination && game.currentStep > 0);
      if (destination) {
        navigationWaypoint.position.set(destination.x, 0, destination.z);
        const waypointPulse = 1 + Math.sin(time * 4) * 0.08;
        waypointRing.scale.setScalar(waypointPulse);
        waypointArrow.position.y = 1.25 + Math.sin(time * 3.2) * 0.12;
        const dx = destination.x - avatar.position.x;
        const dz = destination.z - avatar.position.z;
        const navigationDistance = Math.hypot(dx, dz);
        const navigationAngle = Math.atan2(dx, -dz) - orbitYaw;
        const roundedDistance = Math.max(0, Math.round(navigationDistance));
        const angleBucket = Math.round(navigationAngle * 10) / 10;
        const navigationKey = `${destination.label}:${roundedDistance}:${angleBucket}`;
        if (navigationKey !== lastNavigationKey) {
          lastNavigationKey = navigationKey;
          navigationCallbackRef.current({ label: destination.label, distance: roundedDistance, angle: navigationAngle });
        }
      } else if (lastNavigationKey) {
        lastNavigationKey = "";
        navigationCallbackRef.current(null);
      }

      statusLight.color.setHex(game.engineRunning ? 0x36d477 : 0xe44848);
      statusLight.intensity = game.engineRunning ? 1.4 + Math.sin(time * 10) * 0.12 : 0.85;
      const closeFocus = performance.now() < focusUntil;
      const distance = closeFocus ? 4.2 : 6.8;
      const cameraHeight = crouching ? 2.65 : 3.25;
      desired.set(
        avatar.position.x + Math.sin(orbitYaw) * distance,
        cameraHeight + orbitPitch * 4,
        avatar.position.z + Math.cos(orbitYaw) * distance,
      );
      desired.x = THREE.MathUtils.clamp(desired.x, -16.2, 16.2);
      desired.z = THREE.MathUtils.clamp(desired.z, -9.8, 11.8);
      if (collides(desired.x, desired.z)) {
        const safeDistance = closeFocus ? 2.8 : 4.1;
        desired.set(
          avatar.position.x + Math.sin(orbitYaw) * safeDistance,
          cameraHeight + orbitPitch * 3,
          avatar.position.z + Math.cos(orbitYaw) * safeDistance,
        );
      }
      const targetLead = closeFocus ? 0.75 : 2.05;
      cameraTarget.set(
        avatar.position.x - Math.sin(orbitYaw) * targetLead,
        crouching ? 0.92 : 1.3,
        avatar.position.z - Math.cos(orbitYaw) * targetLead,
      );
      camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      nearbyCallbackRef.current(null);
      navigationCallbackRef.current(null);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((entry) => {
            if ("map" in entry && entry.map instanceof THREE.Texture) entry.map.dispose();
            entry.dispose();
          });
        }
        if (object instanceof THREE.Sprite) object.material.map?.dispose();
      });
      materialCache.clear();
      boxGeometryCache.clear();
      cylinderGeometryCache.clear();
      textureCache.clear();
    };
  }, []);

  return <div className="workshop-canvas" ref={hostRef} aria-label="Taller automotriz 3D navegable" />;
}
