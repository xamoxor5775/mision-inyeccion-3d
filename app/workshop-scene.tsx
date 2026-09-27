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
  onNearbyChange: (id: string | null) => void;
  onNavigationChange: (info: { label: string; distance: number; angle: number } | null) => void;
};

type Target = {
  id: string;
  root: THREE.Group;
  marker: THREE.Mesh;
  steps: number[];
};

function material(color: number, roughness = 0.65, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.72 });
}

function surfaceTexture(kind: "concrete" | "wall" | "rubber") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  const base = kind === "concrete" ? "#8d9699" : kind === "wall" ? "#d8dddc" : "#20272b";
  context.fillStyle = base;
  context.fillRect(0, 0, 512, 512);

  let seed = kind === "concrete" ? 41 : kind === "wall" ? 73 : 97;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let index = 0; index < 2400; index++) {
    const shade = kind === "wall" ? 160 + Math.floor(random() * 72) : 72 + Math.floor(random() * 92);
    const alpha = kind === "rubber" ? 0.08 : 0.045 + random() * 0.06;
    context.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
    const size = 0.6 + random() * (kind === "concrete" ? 3.2 : 1.8);
    context.fillRect(random() * 512, random() * 512, size, size);
  }
  if (kind === "concrete") {
    for (let index = 0; index < 14; index++) {
      const x = random() * 512;
      const y = random() * 512;
      const radius = 12 + random() * 52;
      const stain = context.createRadialGradient(x, y, 0, x, y, radius);
      stain.addColorStop(0, "rgba(45,54,58,.10)");
      stain.addColorStop(1, "rgba(45,54,58,0)");
      context.fillStyle = stain;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function wallSign(
  parent: THREE.Object3D,
  title: string,
  subtitle: string,
  position: [number, number, number],
  size: [number, number],
  rotationY = 0,
  accent = "#2d93b5",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#163a5c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accent;
  context.fillRect(0, 0, 22, canvas.height);
  context.fillStyle = "#f4f8fa";
  context.font = "700 72px Arial";
  context.fillText(title, 70, 132);
  context.fillStyle = "#bfd3df";
  context.font = "500 34px Arial";
  context.fillText(subtitle, 72, 220);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.52, metalness: 0.12 }),
  );
  sign.position.set(...position);
  sign.rotation.y = rotationY;
  parent.add(sign);
  return sign;
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

function makeToolCart(parent: THREE.Object3D, position: [number, number, number], color = 0xb52f2c) {
  const cart = new THREE.Group();
  box(cart, [1.18, 1.05, 0.62], [0, 0.68, 0], color, 0.38, 0.38);
  box(cart, [1.25, 0.1, 0.69], [0, 1.24, 0], 0x202b32, 0.35, 0.45);
  for (let y = 0.37; y < 1.05; y += 0.2) {
    box(cart, [1.05, 0.035, 0.025], [0, y, 0.324], 0xd7dde0, 0.25, 0.75);
  }
  for (const x of [-0.48, 0.48]) {
    for (const z of [-0.23, 0.23]) {
      const caster = cylinder(cart, 0.1, 0.06, [x, 0.11, z], 0x151a1d, 14);
      caster.rotation.z = Math.PI / 2;
    }
  }
  box(cart, [0.55, 0.06, 0.06], [0.83, 1.13, 0], 0x313b40, 0.32, 0.72);
  cart.position.set(...position);
  parent.add(cart);
  return cart;
}

function makeTireStack(parent: THREE.Object3D, position: [number, number, number], count = 3) {
  const stack = new THREE.Group();
  for (let index = 0; index < count; index++) {
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(0.43, 0.16, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0x171d20, roughness: 0.92, metalness: 0.02 }),
    );
    tire.rotation.x = Math.PI / 2;
    tire.position.y = 0.18 + index * 0.28;
    tire.castShadow = true;
    stack.add(tire);
  }
  stack.position.set(...position);
  parent.add(stack);
}

function makeWorkbench(parent: THREE.Object3D, position: [number, number, number], rotationY = 0) {
  const bench = new THREE.Group();
  box(bench, [3.6, 0.16, 0.9], [0, 1.02, 0], 0x343d42, 0.42, 0.68);
  for (const x of [-1.55, 1.55]) {
    for (const z of [-0.32, 0.32]) box(bench, [0.12, 1.9, 0.12], [x, 0.48, z], 0x27343b, 0.45, 0.65);
  }
  const pegboard = box(bench, [3.55, 1.75, 0.12], [0, 2.0, -0.38], 0x274653, 0.76, 0.22);
  for (let x = -1.45; x <= 1.45; x += 0.37) {
    for (let y = 1.38; y <= 2.55; y += 0.29) {
      const hole = cylinder(bench, 0.018, 0.025, [x, y, -0.305], 0x111a1f, 8);
      hole.rotation.x = Math.PI / 2;
    }
  }
  for (let index = 0; index < 9; index++) {
    const tool = box(bench, [0.055, 0.55 + (index % 3) * 0.08, 0.05], [-1.35 + index * 0.33, 2.03, -0.27], index % 2 ? 0xd8a63d : 0xcf4b3e, 0.45, 0.35);
    tool.rotation.z = (index - 4) * 0.025;
  }
  pegboard.receiveShadow = true;
  bench.position.set(...position);
  bench.rotation.y = rotationY;
  parent.add(bench);
  return bench;
}

function makeAirCompressor(parent: THREE.Object3D, position: [number, number, number]) {
  const compressor = new THREE.Group();
  const tank = cylinder(compressor, 0.43, 1.65, [0, 0.62, 0], 0x2d6f8d, 28);
  tank.rotation.z = Math.PI / 2;
  box(compressor, [0.68, 0.52, 0.54], [0, 1.17, 0], 0x202a30, 0.48, 0.48);
  cylinder(compressor, 0.08, 0.2, [-0.16, 1.52, 0], 0xd4dadd, 16);
  cylinder(compressor, 0.08, 0.2, [0.16, 1.52, 0], 0xd4dadd, 16);
  const hose = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.035, 8, 36, Math.PI * 1.7),
    material(0xe2b53c, 0.58),
  );
  hose.position.set(0.78, 1.22, 0);
  hose.rotation.y = Math.PI / 2;
  compressor.add(hose);
  compressor.position.set(...position);
  parent.add(compressor);
}

function makeAmbientWorker(
  parent: THREE.Object3D,
  position: [number, number, number],
  rotationY: number,
  pose: "bench" | "engine" | "lift" | "walk",
  phase: number,
) {
  const worker = new THREE.Group();
  const uniform = material(0x173b5e, 0.72, 0.04);
  const skin = material(phase % 2 ? 0xb87550 : 0xd59a72, 0.78);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.62, 8, 14), uniform);
  torso.position.y = 1.42;
  worker.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 15), skin);
  head.position.y = 2.12;
  worker.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), material(0x241b18, 0.88));
  hair.position.y = 2.19;
  worker.add(hair);
  box(worker, [0.6, 0.055, 0.08], [0, 1.53, 0.23], 0xc4d1d4, 0.42, 0.32);
  const arms: THREE.Mesh[] = [];
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.58, 5, 10), uniform);
    arm.position.set(side * 0.37, 1.43, 0);
    worker.add(arm);
    arms.push(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.7, 5, 10), uniform);
    leg.position.set(side * 0.14, 0.58, 0);
    worker.add(leg);
    legs.push(leg);
    box(worker, [0.22, 0.16, 0.38], [side * 0.14, 0.12, 0.08], 0x14191d, 0.88, 0.05);
    box(worker, [0.2, 0.04, 0.07], [side * 0.14, 0.5, 0.12], 0xc4d1d4, 0.5, 0.25);
  }
  if (pose === "bench" || pose === "engine") {
    torso.rotation.x = 0.12;
    arms[0].rotation.x = -0.95;
    arms[1].rotation.x = -1.15;
  } else if (pose === "lift") {
    arms[0].rotation.x = -2.2;
    arms[1].rotation.x = -2.0;
  } else {
    arms[0].rotation.x = 0.45;
    arms[1].rotation.x = -0.45;
    legs[0].rotation.x = -0.35;
    legs[1].rotation.x = 0.35;
  }
  worker.position.set(...position);
  worker.rotation.y = rotationY;
  worker.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  parent.add(worker);
  return { worker, arms, legs, pose, phase };
}

function makeBackgroundVehicle(
  parent: THREE.Object3D,
  position: [number, number, number],
  rotationY: number,
  color: number,
  lifted = false,
) {
  const vehicle = new THREE.Group();
  const bodyMaterial = material(color, 0.25, 0.58);
  const dark = material(0x172026, 0.72, 0.08);
  const baseHeight = lifted ? 2.55 : 0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.68, 1.82), bodyMaterial);
  body.position.y = baseHeight + 0.83;
  body.castShadow = true;
  vehicle.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.18, 0.7, 1.56),
    new THREE.MeshPhysicalMaterial({ color: 0x203746, roughness: 0.12, metalness: 0.18, transmission: 0.12 }),
  );
  cabin.position.set(-0.28, baseHeight + 1.44, 0);
  cabin.castShadow = true;
  vehicle.add(cabin);
  box(vehicle, [4.5, 0.18, 1.95], [0, baseHeight + 0.48, 0], 0x20292e, 0.55, 0.16);
  for (const x of [-1.38, 1.38]) {
    for (const z of [-0.91, 0.91]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.27, 24), dark);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(x, baseHeight + 0.43, z);
      tire.castShadow = true;
      vehicle.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.285, 18), material(0xb8c2c8, 0.23, 0.82));
      rim.rotation.x = Math.PI / 2;
      rim.position.copy(tire.position);
      vehicle.add(rim);
    }
  }
  if (lifted) {
    for (const z of [-1.42, 1.42]) {
      box(vehicle, [0.42, 5.6, 0.42], [0, 2.8, z], 0x175f96, 0.34, 0.42);
      box(vehicle, [1.65, 0.16, 0.32], [0.72, 2.32, z], 0xe4ad2f, 0.42, 0.38);
    }
  } else {
    const hood = box(vehicle, [1.62, 0.12, 1.72], [2.18, 1.72, 0], color, 0.25, 0.58);
    hood.rotation.z = -0.68;
    box(vehicle, [1.38, 0.3, 1.2], [1.48, 1.17, 0], 0x29343a, 0.58, 0.28);
  }
  vehicle.position.set(...position);
  vehicle.rotation.y = rotationY;
  parent.add(vehicle);
  return vehicle;
}

function makePartsShelf(parent: THREE.Object3D, position: [number, number, number], rotationY = 0) {
  const shelf = new THREE.Group();
  for (const x of [-1.35, 1.35]) box(shelf, [0.12, 3.4, 0.9], [x, 1.7, 0], 0x354750, 0.52, 0.52);
  for (const y of [0.25, 1.18, 2.1, 3.08]) box(shelf, [2.82, 0.11, 0.96], [0, y, 0], 0x4e626b, 0.52, 0.48);
  for (let index = 0; index < 6; index++) {
    const row = index < 3 ? 0.64 : 1.56;
    const x = -0.92 + (index % 3) * 0.9;
    box(shelf, [0.62, 0.52, 0.66], [x, row, 0], index % 2 ? 0x8c969a : 0xb9a05d, 0.84, 0.05);
  }
  for (const x of [-0.78, 0, 0.78]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 10, 24), material(0x171d20, 0.92));
    tire.position.set(x, 2.55, 0);
    shelf.add(tire);
  }
  shelf.position.set(...position);
  shelf.rotation.y = rotationY;
  parent.add(shelf);
  return shelf;
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
  box(car, [0.2, 0.42, 1.58], [2.38, 0.83, 0], 0x202b31, 0.42, 0.4);
  for (const z of [-0.62, 0.62]) {
    box(car, [0.12, 0.22, 0.42], [2.5, 1.02, z], 0xe8f5f7, 0.1, 0.25);
    const lamp = new THREE.PointLight(0xf4f0cd, 0.35, 2.1);
    lamp.position.set(2.58, 1.03, z);
    car.add(lamp);
  }
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
      for (let spokeIndex = 0; spokeIndex < 5; spokeIndex++) {
        const spoke = box(car, [0.05, 0.27, 0.035], [x, 0.49, z + (z > 0 ? 0.165 : -0.165)], 0xdbe2e4, 0.2, 0.85);
        spoke.rotation.x = Math.PI / 2;
        spoke.rotation.y = spokeIndex * (Math.PI / 5);
      }
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
  box(avatar, [0.72, 0.055, 0.5], [0, 1.53, -0.08], 0xc7d3d7, 0.46, 0.24);
  box(avatar, [0.46, 0.018, 0.03], [0, 1.35, -0.26], 0x0c233d, 0.72);
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
    box(avatar, [0.24, 0.17, 0.4], [side * 0.2, 0.11, 0.08], 0x11181e, 0.9, 0.03);
    box(avatar, [0.23, 0.045, 0.08], [side * 0.2, 0.47, -0.1], 0xc7d3d7, 0.52, 0.2);
  }
  avatar.position.set(-1.6, 0, 5.8);
  avatar.rotation.y = -0.45;
  avatar.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  scene.add(avatar);
  return { avatar, arms, legs };
}

function makeNpc(scene: THREE.Scene) {
  const npc = new THREE.Group();
  const texture = new THREE.TextureLoader().load("/assets/mateo-tecnico.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  const technician = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.025, depthWrite: false }));
  technician.scale.set(1.55, 2.78, 1);
  technician.position.y = 1.39;
  npc.add(technician);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 28),
    new THREE.MeshBasicMaterial({ color: 0x15232a, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, 0.46, 1);
  shadow.position.y = 0.025;
  npc.add(shadow);
  npc.position.set(-1.9, 0, -2.8);
  scene.add(npc);
  return { npc, arm: technician };
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
  } else if (id === "scanner") {
    box(group, [0.48, 0.12, 0.68], [0, 0, 0], 0xc43b34, 0.45);
    box(group, [0.34, 0.03, 0.32], [0, 0.075, -0.08], 0x8ed8ef, 0.18, 0.2);
  } else if (id === "multimeter") {
    box(group, [0.44, 0.13, 0.62], [0, 0, 0], 0xe5b735, 0.45);
    box(group, [0.3, 0.025, 0.2], [0, 0.08, -0.13], 0x91cad3, 0.18);
    cylinder(group, 0.09, 0.04, [0, 0.1, 0.13], 0x28333c, 14);
  } else if (id === "hammer") {
    box(group, [0.13, 0.13, 0.78], [0, 0, 0], 0xd5a16b);
    box(group, [0.62, 0.22, 0.22], [0, 0, -0.37], 0x343c43, 0.38, 0.35);
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
  onNearbyChange,
  onNavigationChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ active, currentStep, helpLevel, engineRunning, completedTargets, actionPulse, resetToken });
  const nearbyCallbackRef = useRef(onNearbyChange);
  const navigationCallbackRef = useRef(onNavigationChange);
  stateRef.current = { active, currentStep, helpLevel, engineRunning, completedTargets, actionPulse, resetToken };
  nearbyCallbackRef.current = onNearbyChange;
  navigationCallbackRef.current = onNavigationChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const panoramaTexture = new THREE.TextureLoader().load("/assets/taller-inmersivo-panorama.png");
    panoramaTexture.mapping = THREE.EquirectangularReflectionMapping;
    panoramaTexture.colorSpace = THREE.SRGBColorSpace;
    panoramaTexture.minFilter = THREE.LinearMipmapLinearFilter;
    scene.background = panoramaTexture;
    scene.environment = panoramaTexture;
    scene.environmentIntensity = 0.36;
    scene.fog = new THREE.Fog(0x9dafb8, 30, 55);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8f4f8, 0x343b3e, 1.72));
    const sun = new THREE.DirectionalLight(0xfff0d2, 3.7);
    sun.position.set(9, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    scene.add(sun);
    for (const x of [-11, -5.5, 0, 5.5, 11]) {
      const light = new THREE.RectAreaLight(0xe3f7ff, 5.6, 3.4, 0.32);
      light.position.set(x, 6.65, -1.4);
      light.rotation.x = -Math.PI / 2;
      scene.add(light);
      box(scene, [3.4, 0.08, 0.32], [x, 6.63, -1.4], 0xf6fbff, 0.13, 0.22);
    }

    const wallTexture = surfaceTexture("wall");
    wallTexture.repeat.set(8, 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 25),
      new THREE.ShadowMaterial({ color: 0x15232a, opacity: 0.16, transparent: true }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const floorGrid = new THREE.GridHelper(34, 34, 0x7d929d, 0x9fadb4);
    floorGrid.material.opacity = 0.12;
    floorGrid.material.transparent = true;
    floorGrid.visible = false;
    scene.add(floorGrid);
    for (const z of [-4.15, 2.15]) {
      box(scene, [13.5, 0.025, 0.12], [1.4, 0.025, z], 0xe9b62f, 0.56, 0.18);
      for (const x of [-5.3, 8.1]) box(scene, [0.12, 0.028, 6.4], [x, 0.028, z + 3.15], 0xe9b62f, 0.56, 0.18);
    }
    const structuralShell = new THREE.Group();
    structuralShell.visible = false;
    scene.add(structuralShell);
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xe0e3e1, roughness: 0.86, metalness: 0.02 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(34, 7.5, 0.35), wallMaterial);
    backWall.position.set(0, 3.75, -10.4);
    backWall.receiveShadow = true;
    structuralShell.add(backWall);
    for (const x of [-16.8, 16.8]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7.5, 25), wallMaterial);
      sideWall.position.set(x, 3.75, 0);
      sideWall.receiveShadow = true;
      structuralShell.add(sideWall);
    }

    for (const x of [-12.6, -7.55, -2.5, 2.55, 7.6, 12.65]) {
      box(structuralShell, [4.35, 2.0, 0.12], [x, 5.75, -10.16], 0x9fc4d3, 0.12, 0.22);
      box(structuralShell, [0.1, 2.08, 0.15], [x - 2.17, 5.75, -10.05], 0x3d535d, 0.35, 0.72);
      box(structuralShell, [4.45, 0.1, 0.15], [x, 4.72, -10.05], 0x3d535d, 0.35, 0.72);
    }
    for (const z of [-8.8, -3.2, 2.4, 8]) {
      box(structuralShell, [33.5, 0.22, 0.28], [0, 7.15, z], 0x344953, 0.44, 0.68);
      for (const x of [-12, -6, 0, 6, 12]) box(structuralShell, [0.16, 0.16, 5.6], [x, 7.02, z + 2.8], 0x53676f, 0.54, 0.62);
    }

    wallSign(scene, "MECÁNICA AUTOMOTRIZ", "Diagnostica · Mantiene · Soluciona", [-10.7, 4.0, -10.15], [8.2, 2.15], 0, "#efb132");
    wallSign(scene, "DIAGNÓSTICO", "Scanner · Señales · Evidencia", [-15.98, 4.2, -4.4], [4.7, 1.35], Math.PI / 2, "#2da8c2");
    wallSign(scene, "SEGURIDAD", "EPP · Orden · Prevención", [15.98, 4.2, -4.4], [4.7, 1.35], -Math.PI / 2, "#e4ad2f");

    for (const x of [-9.8, -6.9, 8.7, 11.6]) {
      box(scene, [2.2, 1.15, 0.9], [x, 0.58, -7.5], 0xc93232, 0.5);
      box(scene, [2.4, 0.14, 1.05], [x, 1.21, -7.5], 0x263443, 0.35);
      for (let y = 0.35; y < 1.1; y += 0.25) box(scene, [1.8, 0.04, 0.02], [x, y, -7.03], 0xdce6e9);
    }
    box(scene, [3.8, 2.55, 0.45], [-11.1, 1.27, -3.0], 0x315d70);
    for (let i = 0; i < 8; i++) box(scene, [0.08, 0.9, 0.08], [-12.4 + i * 0.38, 1.55, -2.72], i % 2 ? 0xf2bd40 : 0xb7c4ca);
    box(scene, [4.1, 2.8, 0.22], [10.15, 1.4, -9.95], 0xf6fafb);
    box(scene, [3.4, 1.2, 0.8], [10.15, 0.6, -8.15], 0x596f7b);

    makeWorkbench(scene, [-12.2, 0, -8.95]);
    makePartsShelf(scene, [13.6, 0, -8.85]);
    makeAirCompressor(scene, [14.35, 0, -5.8]);
    makeToolCart(scene, [-7.1, 0, 3.7], 0xb52f2c);
    makeToolCart(scene, [8.1, 0, 4.45], 0x1f3039);
    makeTireStack(scene, [-14.6, 0, -6.9], 4);
    makeTireStack(scene, [14.35, 0, 7.3], 3);
    makeBackgroundVehicle(scene, [-9.6, 0, 4.65], 0.05, 0x8b959b, false);
    makeBackgroundVehicle(scene, [10.2, 0, 3.4], -0.08, 0x4f6874, true);

    const ambientWorkers = [
      makeAmbientWorker(scene, [-11.8, 0, -7.35], Math.PI, "bench", 0.2),
      makeAmbientWorker(scene, [-7.15, 0, 3.5], -1.25, "engine", 1.3),
      makeAmbientWorker(scene, [11.95, 0, 2.15], 0.42, "lift", 2.1),
      makeAmbientWorker(scene, [7.3, 0, 8.1], -2.45, "walk", 3.2),
    ];
    ambientWorkers.forEach(({ worker }) => { worker.visible = false; });

    for (const [x, z, color] of [
      [-14.8, 5.2, 0x314d58],
      [-14.8, 3.9, 0x6d7c82],
      [14.8, 5.1, 0x314d58],
    ] as Array<[number, number, number]>) {
      box(scene, [0.85, 1.05, 0.78], [x, 0.53, z], color, 0.68, 0.2);
      box(scene, [0.7, 0.04, 0.64], [x, 1.08, z], 0x1d282e, 0.5, 0.46);
    }

    for (const z of [-3.55, 1.15]) {
      box(scene, [0.48, 5.9, 0.48], [0.25, 2.95, z], 0x1464a5, 0.35);
      box(scene, [1.8, 0.18, 0.5], [1.1, 0.55, z], 0x154f82, 0.4);
    }
    const { statusLight } = makeCar(scene);
    const { npc, arm: npcArm } = makeNpc(scene);
    const { avatar, arms, legs } = makeAvatar(scene);
    avatar.visible = false;

    const targets: Target[] = [];
    const npcTarget = addTarget(targets, "npc", [-1.9, 0, -2.8], [1], "Mateo · Técnico");
    npcTarget.children[1].position.y = 2.9;
    scene.add(npcTarget);
    const vehicleTarget = addTarget(targets, "vehicle", [0.05, 0, 1.65], [1], "Vehículo");
    scene.add(vehicleTarget);

    const toolPositions: Record<string, [number, number, number]> = {
      goggles: [-12.15, 1.55, -1.85],
      gloves: [-10.65, 1.45, -1.85],
      scanner: [-9.8, 1.42, -7.3],
      multimeter: [-6.9, 1.42, -7.3],
      hammer: [-8.35, 1.42, -7.3],
    };
    for (const [id, position] of Object.entries(toolPositions)) {
      const target = addTarget(targets, id, [position[0], 0, position[2]], [2], id === "scanner" ? "Scanner OBD-II" : id === "multimeter" ? "Multímetro" : id === "hammer" ? "Martillo" : id === "goggles" ? "Lentes" : "Guantes");
      const model = makeToolModel(id);
      model.position.set(0, position[1], 0);
      target.add(model);
      scene.add(target);
    }

    const manualTarget = addTarget(targets, "manual", [10.2, 0, -7.45], [3], "Manual de servicio");
    box(manualTarget, [0.85, 0.12, 0.65], [0, 1.33, 0], 0x1769ac, 0.5);
    box(manualTarget, [0.72, 0.02, 0.52], [0, 1.405, 0], 0xf4f6f2, 0.8);
    scene.add(manualTarget);
    const obdTarget = addTarget(targets, "obd", [0.0, 0, 0.65], [3, 5], "Puerto OBD-II");
    box(obdTarget, [0.32, 0.22, 0.16], [0, 0.82, 0], 0x26333d, 0.45);
    scene.add(obdTarget);
    const ckpTarget = addTarget(targets, "ckp_sensor", [6.35, 0, -0.25], [3], "Sensor CKP");
    cylinder(ckpTarget, 0.16, 0.52, [0, 0.72, 0], 0x2b333a, 16).rotation.z = Math.PI / 2;
    scene.add(ckpTarget);

    const fuelTarget = addTarget(targets, "fuel_pump", [0.15, 0, -3.95], [4], "Bomba de combustible", 0xec6e50);
    cylinder(fuelTarget, 0.25, 0.55, [0, 0.68, 0], 0x4d606c, 18);
    scene.add(fuelTarget);
    const ecuTarget = addTarget(targets, "ecu", [5.7, 0, -3.65], [4], "Unidad de control", 0xec6e50);
    box(ecuTarget, [0.78, 0.38, 0.54], [0, 0.72, 0], 0x88969d, 0.3, 0.55);
    scene.add(ecuTarget);
    const connectorTarget = addTarget(targets, "ckp_connector", [6.45, 0, 0.75], [4], "Conector CKP", 0x2cab6f);
    box(connectorTarget, [0.42, 0.3, 0.34], [0, 0.75, 0], 0x2b333a, 0.45);
    box(connectorTarget, [0.18, 0.18, 0.2], [0.28, 0.75, 0], 0x2cab6f, 0.45);
    scene.add(connectorTarget);
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
      new THREE.Box2(new THREE.Vector2(-12.1, 2.6), new THREE.Vector2(-6.8, 6.7)),
      new THREE.Box2(new THREE.Vector2(7.5, 1.2), new THREE.Vector2(12.9, 5.8)),
      new THREE.Box2(new THREE.Vector2(-13.9, -9.7), new THREE.Vector2(-10.2, -7.7)),
      new THREE.Box2(new THREE.Vector2(12.0, -9.6), new THREE.Vector2(15.1, -7.5)),
    ];
    const collides = (x: number, z: number) => obstacles.some((area) => area.containsPoint(new THREE.Vector2(x, z)));

    const keys = new Set<string>();
    let orbitYaw = 0.03;
    let orbitPitch = 0.08;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastNearby: string | null = null;
    let lastNavigationKey = "";
    let lastPulse = actionPulse;
    let focusUntil = 0;
    let lastReset = resetToken;
    const onKeyDown = (event: KeyboardEvent) => keys.add(event.code);
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      orbitYaw -= (event.clientX - lastX) * 0.006;
      orbitPitch = THREE.MathUtils.clamp(orbitPitch + (event.clientY - lastY) * 0.004, -0.12, 0.58);
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
        orbitYaw = 0.03;
        orbitPitch = 0.08;
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
          direction.normalize();
          const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.3 : 3.15;
          const nextX = THREE.MathUtils.clamp(avatar.position.x + direction.x * speed * dt, -15.4, 15.4);
          const nextZ = THREE.MathUtils.clamp(avatar.position.z + direction.z * speed * dt, -9.25, 11.2);
          if (!collides(nextX, avatar.position.z)) avatar.position.x = nextX;
          if (!collides(avatar.position.x, nextZ)) avatar.position.z = nextZ;
          avatar.rotation.y = Math.atan2(direction.x, direction.z);
        }
      }
      const crouching = keys.has("KeyC");
      avatar.scale.y = THREE.MathUtils.lerp(avatar.scale.y, crouching ? 0.72 : 1, 1 - Math.pow(0.005, dt));
      const stride = moving ? Math.sin(time * (keys.has("ShiftLeft") ? 13 : 9)) * 0.58 : Math.sin(time * 2) * 0.025;
      arms[0].rotation.x = stride;
      arms[1].rotation.x = -stride;
      legs[0].rotation.x = -stride;
      legs[1].rotation.x = stride;
      if (performance.now() < focusUntil) arms[1].rotation.x = -1.15;
      npc.rotation.y = Math.sin(time * 0.5) * 0.08 + 0.4;
      npcArm.rotation.z = Math.sin(time * 0.8) * 0.004;
      npcArm.position.y = 1.39 + Math.sin(time * 1.15) * 0.008;
      for (const worker of ambientWorkers) {
        const motion = Math.sin(time * 1.35 + worker.phase) * 0.075;
        if (worker.pose === "walk") {
          worker.arms[0].rotation.x = 0.45 + motion * 3;
          worker.arms[1].rotation.x = -0.45 - motion * 3;
          worker.legs[0].rotation.x = -0.35 - motion * 2.5;
          worker.legs[1].rotation.x = 0.35 + motion * 2.5;
          worker.worker.position.x += Math.sin(time * 0.5 + worker.phase) * 0.0008;
        } else {
          worker.arms[0].rotation.z = motion;
          worker.arms[1].rotation.z = -motion;
        }
      }

      let nearest: Target | null = null;
      let nearestDistance = 2.25;
      for (const target of targets) {
        const engineCondition = target.id !== "obd" || game.currentStep !== 5 || game.engineRunning;
        const available = target.steps.includes(game.currentStep) && engineCondition;
        target.root.visible = available;
        if (!available || !game.active) continue;
        const distance = Math.hypot(avatar.position.x - target.root.position.x, avatar.position.z - target.root.position.z);
        const targetLabel = target.root.children.find((child) => child.userData.label);
        const guided = game.currentStep <= 2;
        const supported = game.currentStep === 3;
        target.marker.visible = guided || distance < (supported ? 5.2 : 3.2) || game.helpLevel >= (supported ? 2 : 3);
        if (targetLabel) {
          targetLabel.visible = guided
            ? distance < 6.5 || game.helpLevel >= 1
            : supported
              ? distance < 4.2 || game.helpLevel >= 3
              : distance < 2.8 || game.helpLevel >= 4;
        }
        if (distance < nearestDistance) {
          nearest = target;
          nearestDistance = distance;
        }
        const basePulse = guided ? 0.1 : supported ? 0.055 : 0.025;
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
      if (game.currentStep === 1) {
        const remainingContext = targets.find((target) => target.steps.includes(1) && !game.completedTargets.includes(target.id));
        if (remainingContext) {
          destination = {
            label: remainingContext.id === "npc" ? "Mateo · Técnico" : "Vehículo",
            x: remainingContext.root.position.x,
            z: remainingContext.root.position.z,
          };
        }
      }
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
      const cameraHeight = crouching ? 1.28 : 1.72;
      desired.set(
        avatar.position.x + Math.sin(orbitYaw) * (closeFocus ? 0.08 : 0),
        cameraHeight,
        avatar.position.z + Math.cos(orbitYaw) * (closeFocus ? 0.08 : 0),
      );
      cameraTarget.set(
        avatar.position.x - Math.sin(orbitYaw) * (closeFocus ? 4.8 : 4),
        cameraHeight + orbitPitch * 2.25,
        avatar.position.z - Math.cos(orbitYaw) * (closeFocus ? 4.8 : 4),
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
      wallTexture.dispose();
      panoramaTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((entry) => entry.dispose());
        }
        if (object instanceof THREE.Sprite) object.material.map?.dispose();
      });
    };
  }, []);

  return <div className="workshop-canvas" ref={hostRef} aria-label="Taller automotriz 3D navegable" />;
}
