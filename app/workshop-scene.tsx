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
    for (const z of [-4.15, 2.15]) box(scene, [13.5, 0.018, 0.11], [1.4, 0.016, z], 0xf1c94d);

    box(scene, [34, 7.5, 0.35], [0, 3.75, -10.4], 0xdde6e8);
    box(scene, [0.35, 7.5, 25], [-16.8, 3.75, 0], 0xd7e2e6);
    box(scene, [0.35, 7.5, 25], [16.8, 3.75, 0], 0xd7e2e6);
    box(scene, [10, 1.45, 0.1], [2.5, 3.9, -10.18], 0x0a4e8d);
    box(scene, [8, 0.18, 0.12], [2.5, 3.1, -10.1], 0x24a6bb);
    const workshopSign = createLabel("MECÁNICA AUTOMOTRIZ", "#0d477c");
    workshopSign.position.set(2.5, 4.25, -10.05);
    workshopSign.scale.set(7, 1.35, 1);
    scene.add(workshopSign);

    for (const x of [-9.8, -6.9, 8.7, 11.6]) {
      box(scene, [2.2, 1.15, 0.9], [x, 0.58, -7.5], 0xc93232, 0.5);
      box(scene, [2.4, 0.14, 1.05], [x, 1.21, -7.5], 0x263443, 0.35);
      for (let y = 0.35; y < 1.1; y += 0.25) box(scene, [1.8, 0.04, 0.02], [x, y, -7.03], 0xdce6e9);
    }
    box(scene, [3.8, 2.55, 0.45], [-11.1, 1.27, -3.0], 0x315d70);
    for (let i = 0; i < 8; i++) box(scene, [0.08, 0.9, 0.08], [-12.4 + i * 0.38, 1.55, -2.72], i % 2 ? 0xf2bd40 : 0xb7c4ca);
    box(scene, [4.1, 2.8, 0.22], [10.15, 1.4, -9.95], 0xf6fafb);
    box(scene, [3.4, 1.2, 0.8], [10.15, 0.6, -8.15], 0x596f7b);

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
        orbitYaw = -0.38;
        orbitPitch = 0.24;
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
      npcArm.rotation.z = -0.3 + Math.sin(time * 1.7) * 0.09;

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
          materials.forEach((entry) => entry.dispose());
        }
        if (object instanceof THREE.Sprite) object.material.map?.dispose();
      });
    };
  }, []);

  return <div className="workshop-canvas" ref={hostRef} aria-label="Taller automotriz 3D navegable" />;
}
