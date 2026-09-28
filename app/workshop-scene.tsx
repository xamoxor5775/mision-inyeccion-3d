"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  active: boolean;
  currentStep: number;
  helpLevel: number;
  engineRunning: boolean;
  completedTargets: string[];
  actionPulse: number;
  resetToken: number;
  cameraSensitivity: number;
  reducedMotion: boolean;
  onNearbyChange: (id: string | null) => void;
  onNavigationChange: (info: { label: string; distance: number; angle: number } | null) => void;
  onTutorialAction: (action: "move" | "look") => void;
};

type Target = {
  id: string;
  root: THREE.Group;
  marker: THREE.Mesh;
  steps: number[];
};

function material(color: number, roughness = 0.65, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  roughness = 0.65,
  metalness = 0.05,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, roughness, metalness));
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
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
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

function makeCar(scene: THREE.Scene) {
  const car = new THREE.Group();
  const bodyMat = material(0xe7eaed, 0.24, 0.58);
  const darkMat = material(0x172332, 0.28, 0.2);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x173c56, roughness: 0.08, metalness: 0.2, transmission: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.76, 2.08), bodyMat);
  body.position.y = 0.83;
  body.castShadow = true;
  car.add(body);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.22, 2.14), darkMat);
  lower.position.y = 0.5;
  car.add(lower);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.82, 1.78), glassMat);
  cabin.position.set(-0.35, 1.5, 0);
  cabin.castShadow = true;
  car.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.13, 1.95), bodyMat);
  hood.position.set(2.62, 1.82, 0);
  hood.rotation.z = -0.59;
  car.add(hood);
  const engine = new THREE.Group();
  box(engine, [1.5, 0.35, 1.35], [0, 0, 0], 0x303942, 0.55, 0.25);
  box(engine, [0.72, 0.23, 0.7], [0.05, 0.28, 0.1], 0x17202a, 0.45, 0.3);
  for (let i = 0; i < 4; i++) cylinder(engine, 0.075, 0.75, [-0.25 + i * 0.18, 0.27, -0.3], 0xc4483f, 12).rotation.z = Math.PI / 2;
  engine.position.set(1.65, 1.22, 0);
  car.add(engine);
  for (const x of [-1.55, 1.55]) {
    for (const z of [-1.03, 1.03]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.29, 24), darkMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.49, z);
      wheel.castShadow = true;
      car.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.31, 18), material(0xb9c3ca, 0.22, 0.75));
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wheel.position);
      car.add(hub);
    }
  }
  const statusLight = new THREE.PointLight(0xe44848, 0.9, 2.8);
  statusLight.position.set(-1.25, 1.2, 0.88);
  car.add(statusLight);
  car.position.set(2.8, 0, -1.2);
  car.rotation.y = -0.16;
  scene.add(car);
  return { car, engine, statusLight };
}

function makeAvatar(scene: THREE.Scene) {
  const avatar = new THREE.Group();
  const uniform = material(0x102e52, 0.62);
  const skin = material(0xc98258, 0.72);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.72, 8, 14), uniform);
  torso.position.y = 1.34;
  avatar.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 22, 16), skin);
  head.position.y = 2.2;
  avatar.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), material(0x1b1412));
  hair.position.y = 2.27;
  avatar.add(hair);
  box(avatar, [0.62, 0.8, 0.26], [0, 1.42, 0.35], 0x141a20, 0.7);
  box(avatar, [0.78, 0.07, 0.5], [0, 1.5, -0.18], 0xe8403a, 0.5);
  const arms: THREE.Mesh[] = [];
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.66, 5, 10), uniform);
    arm.position.set(side * 0.5, 1.36, 0);
    avatar.add(arm);
    arms.push(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.72, 5, 10), uniform);
    leg.position.set(side * 0.2, 0.53, 0);
    avatar.add(leg);
    legs.push(leg);
  }
  avatar.position.set(-1.6, 0, 5.8);
  avatar.rotation.y = -0.45;
  avatar.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  scene.add(avatar);
  return { avatar, arms, legs };
}

function makeNpc(scene: THREE.Scene) {
  const npc = new THREE.Group();
  const uniform = material(0x174a78);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.78, 6, 12), uniform);
  body.position.y = 1.22;
  npc.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), material(0xb97954));
  head.position.y = 2.07;
  npc.add(head);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.58, 5, 10), uniform);
  arm.position.set(0.45, 1.28, 0);
  arm.rotation.z = -0.3;
  npc.add(arm);
  npc.position.set(-1.9, 0, -2.8);
  scene.add(npc);
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
  targets.push({ id, root, marker, steps });
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
  reducedMotion,
  onNearbyChange,
  onNavigationChange,
  onTutorialAction,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ active, currentStep, helpLevel, engineRunning, completedTargets, actionPulse, resetToken, cameraSensitivity, reducedMotion });
  const nearbyCallbackRef = useRef(onNearbyChange);
  const navigationCallbackRef = useRef(onNavigationChange);
  const tutorialCallbackRef = useRef(onTutorialAction);
  stateRef.current = { active, currentStep, helpLevel, engineRunning, completedTargets, actionPulse, resetToken, cameraSensitivity, reducedMotion };
  nearbyCallbackRef.current = onNearbyChange;
  navigationCallbackRef.current = onNavigationChange;
  tutorialCallbackRef.current = onTutorialAction;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcbdce7);
    scene.fog = new THREE.Fog(0xcbdce7, 25, 47);
    const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
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
    sun.shadow.mapSize.set(2048, 2048);
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

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 25), material(0xb8c1c6, 0.78));
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

    box(scene, [34, 7.5, 0.35], [0, 3.75, -10.4], 0xdde6e8);
    box(scene, [0.35, 7.5, 25], [-16.8, 3.75, 0], 0xd7e2e6);
    box(scene, [0.35, 7.5, 25], [16.8, 3.75, 0], 0xd7e2e6);
    makeCeilingSystem(scene);
    for (const x of [-13.2, -7.7, -2.2, 3.3, 8.8, 14.3]) {
      box(scene, [4.45, 1.2, 0.12], [x, 6.05, -10.17], 0x87aebc, 0.2, 0.22);
      box(scene, [4.1, 0.92, 0.04], [x, 6.05, -10.08], 0xb9d6df, 0.12, 0.12);
    }
    for (const x of [-16.45, 16.45]) {
      for (const z of [-7.5, -2.5, 2.5, 7.5]) box(scene, [0.16, 6.7, 0.48], [x, 3.35, z], 0x3f5866, 0.45, 0.48);
    }
    box(scene, [5.4, 4.3, 0.18], [-12.8, 2.15, -10.1], 0x425965, 0.55, 0.45);
    for (let i = 0; i < 4; i++) box(scene, [4.85, 0.1, 0.05], [-12.8, 0.55 + i * 0.95, -9.98], 0x94a7ad, 0.35, 0.5);
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
      box(scene, [2.2, 1.15, 0.9], [x, 0.58, -7.5], 0xc93232, 0.5);
      box(scene, [2.4, 0.14, 1.05], [x, 1.21, -7.5], 0x263443, 0.35);
      for (let y = 0.35; y < 1.1; y += 0.25) box(scene, [1.8, 0.04, 0.02], [x, y, -7.03], 0xdce6e9);
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
    const { avatar, arms, legs } = makeAvatar(scene);

    const targets: Target[] = [];
    const npcTarget = addTarget(targets, "npc", [-1.9, 0, -2.8], [1], "Mateo · Técnico");
    npcTarget.children[1].position.y = 2.9;
    scene.add(npcTarget);
    const vehicleTarget = addTarget(targets, "vehicle", [0.05, 0, 1.65], [1], "Vehículo");
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
    const compressionTarget = addTarget(targets, "compression_test", [0.0, 0, 0.65], [3, 5], "Prueba de compresión");
    cylinder(compressionTarget, 0.23, 0.1, [0, 0.92, 0], 0xd9e2e5, 20).rotation.x = Math.PI / 2;
    cylinder(compressionTarget, 0.045, 0.62, [0, 0.55, 0], 0x26333d, 12);
    scene.add(compressionTarget);
    const clearanceTarget = addTarget(targets, "valve_clearance", [6.35, 0, -0.25], [3], "Holgura de válvulas");
    for (let i = 0; i < 5; i++) box(clearanceTarget, [0.055, 0.025, 0.5], [(i - 2) * 0.05, 0.72 + i * 0.012, 0], 0xbcc6ca, 0.25, 0.75);
    scene.add(clearanceTarget);

    const injectorsTarget = addTarget(targets, "injectors", [0.15, 0, -3.95], [4], "Intervenir inyectores", 0xec6e50);
    for (let i = 0; i < 4; i++) cylinder(injectorsTarget, 0.07, 0.42, [-0.28 + i * 0.18, 0.75, 0], 0x4d606c, 12);
    scene.add(injectorsTarget);
    const gasketTarget = addTarget(targets, "head_gasket", [5.7, 0, -3.65], [4], "Desmontar culata", 0xec6e50);
    box(gasketTarget, [0.9, 0.22, 0.62], [0, 0.76, 0], 0x88969d, 0.3, 0.55);
    scene.add(gasketTarget);
    const adjustmentTarget = addTarget(targets, "valve_adjustment", [6.45, 0, 0.75], [4], "Ajustar válvulas", 0x2cab6f);
    box(adjustmentTarget, [0.65, 0.2, 0.42], [0, 0.75, 0], 0x394850, 0.45);
    for (let i = 0; i < 4; i++) cylinder(adjustmentTarget, 0.05, 0.28, [-0.23 + i * 0.15, 0.94, 0], 0x2cab6f, 10);
    scene.add(adjustmentTarget);
    const ignitionTarget = addTarget(targets, "ignition", [-0.05, 0, 1.75], [5], "Encendido");
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
      new THREE.Box2(new THREE.Vector2(0.15, -3.3), new THREE.Vector2(6.2, 1.25)),
      new THREE.Box2(new THREE.Vector2(-13.2, -3.5), new THREE.Vector2(-9.15, -2.35)),
      new THREE.Box2(new THREE.Vector2(-11.1, -8.2), new THREE.Vector2(-8.5, -6.8)),
      new THREE.Box2(new THREE.Vector2(-8.2, -8.2), new THREE.Vector2(-5.6, -6.8)),
      new THREE.Box2(new THREE.Vector2(7.4, -8.2), new THREE.Vector2(12.9, -6.8)),
    ];
    const collides = (x: number, z: number) => obstacles.some((area) => area.containsPoint(new THREE.Vector2(x, z)));

    const keys = new Set<string>();
    let orbitYaw = -0.38;
    let orbitPitch = 0.24;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastNearby: string | null = null;
    let lastNavigationKey = "";
    let lastPulse = actionPulse;
    let focusUntil = 0;
    let lastReset = resetToken;
    let moveReported = false;
    let lookReported = false;
    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (!moveReported && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.code)) {
        moveReported = true;
        tutorialCallbackRef.current("move");
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onPointerDown = (event: PointerEvent) => {
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
    const onPointerUp = () => { dragging = false; };
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
      }
      if (game.actionPulse !== lastPulse) {
        lastPulse = game.actionPulse;
        focusUntil = performance.now() + 900;
      }

      let moving = false;
      if (game.active) {
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
      if (velocity.lengthSq() > 0.0025) {
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
      arms[0].rotation.x = stride;
      arms[1].rotation.x = -stride;
      legs[0].rotation.x = -stride;
      legs[1].rotation.x = stride;
      if (performance.now() < focusUntil) arms[1].rotation.x = -1.15;
      npc.rotation.y = game.reducedMotion ? 0.4 : Math.sin(time * 0.5) * 0.08 + 0.4;
      npcArm.rotation.z = game.reducedMotion ? -0.3 : -0.3 + Math.sin(time * 1.7) * 0.09;

      let nearest: Target | null = null;
      let nearestDistance = 1.65;
      for (const target of targets) {
        const engineCondition = target.id !== "compression_test" || game.currentStep !== 5 || game.engineRunning;
        const available = target.steps.includes(game.currentStep) && engineCondition;
        target.root.visible = available;
        if (!available || !game.active) continue;
        const distance = Math.hypot(avatar.position.x - target.root.position.x, avatar.position.z - target.root.position.z);
        const targetLabel = target.root.children.find((child) => child.userData.label);
        const guided = game.currentStep <= 2;
        const supported = game.currentStep === 3;
        target.marker.visible = distance < 3 || game.helpLevel >= (guided ? 2 : supported ? 3 : 4);
        if (targetLabel) {
          targetLabel.visible = distance < 1.9 || game.helpLevel >= (guided ? 3 : supported ? 4 : 5);
        }
        if (distance < nearestDistance) {
          nearest = target;
          nearestDistance = distance;
        }
        const basePulse = guided ? 0.07 : supported ? 0.045 : 0.025;
        const pulse = 1 + Math.sin(time * 4.5) * basePulse + (game.helpLevel >= 3 ? 0.16 : 0);
        target.marker.scale.setScalar(pulse);
        const markerMaterial = target.marker.material as THREE.MeshBasicMaterial;
        markerMaterial.opacity = game.helpLevel >= 3 ? 0.96 : guided ? 0.78 : supported ? 0.56 : 0.38;
      }
      const nearbyId = nearest?.id ?? null;
      if (nearbyId !== lastNearby) {
        lastNearby = nearbyId;
        nearbyCallbackRef.current(nearbyId);
      }

      let destination: { label: string; x: number; z: number } | null = null;
      if (game.currentStep === 1) destination = { label: "Bahía de diagnóstico", x: -0.8, z: -0.8 };
      if (game.currentStep === 2) destination = { label: "Zona de preparación", x: -9.4, z: -4.8 };
      if (game.currentStep === 3) {
        const remaining = targets.filter((target) => target.steps.includes(3) && !game.completedTargets.includes(target.id));
        const closest = remaining.sort((a, b) => {
          const distanceA = Math.hypot(avatar.position.x - a.root.position.x, avatar.position.z - a.root.position.z);
          const distanceB = Math.hypot(avatar.position.x - b.root.position.x, avatar.position.z - b.root.position.z);
          return distanceA - distanceB;
        })[0];
        if (closest) destination = { label: "Punto de investigación", x: closest.root.position.x, z: closest.root.position.z };
      }
      if (game.currentStep === 4) destination = { label: "Área de procedimiento", x: 3.25, z: -2.1 };
      if (game.currentStep === 5) destination = game.engineRunning
        ? { label: "Punto de verificación", x: 0, z: 0.65 }
        : { label: "Puesto de encendido", x: -0.05, z: 1.75 };

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
    };
  }, []);

  return <div className="workshop-canvas" ref={hostRef} aria-label="Taller automotriz 3D navegable" />;
}
