// 独立的月球基地 demo：只演示「月球包 + 几个模型」，不承担 A/B 对照的功能。
// 资产全部来自 yardkit；月球感来自 packs/moon（表面 / 天空 / 硬光 / 5 个模型）。
import * as THREE from 'three';
import { bakeAverage, surfaceNames } from '../materials.js';
import { createPost } from '../src/materials/post.js';
import { createMaterialStore } from '../src/materials.js';
import { createContainer } from '../src/containers.js';
import { createProp } from '../src/props.js';
import { createFixture } from '../src/fixtures.js';
import {
  installMoonPack, createMoonSky, createMoonEnvironment, createMoonLighting, createMoonModel,
} from '../packs/moon/index.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ---------- 月球主题层 ----------
const moon = installMoonPack();
const AVG = {};
for (const n of surfaceNames()) AVG[n] = bakeAverage(renderer, n);
const materials = createMaterialStore({
  createMaterial: moon.createMaterial,
  averages: AVG,
  surfaceMap: moon.surfaceMap,
});

const sky = createMoonSky({});
sky.earth.position.set(120, 92, -520);
scene.add(sky.group);
createMoonLighting(scene, {});
scene.environment = createMoonEnvironment(renderer);
scene.environmentIntensity = 0.5;

// ---------- 地面 ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(320, 320),
  moon.createMaterial('regolith', { tile: 8, bump: 2.2, avg: AVG.regolith }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------- 基地：5 个月球模型 + 几个复用道具 ----------
const colliders = [];
function put(obj, x, z, ry = 0) {
  obj.position.set(x, 0, z);
  obj.rotation.y = ry;
  obj.updateMatrixWorld(true);
  scene.add(obj);
  for (const c of obj.userData.colliders || []) {
    const box = new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max));
    box.applyMatrix4(obj.matrixWorld);
    colliders.push(box);
  }
  return obj;
}

// 舱段与气闸在深处，太阳能阵列在右侧迎着太阳，月球车在近处
put(createMoonModel('habitat', { seed: 1, materials }), -7.8, -8.8, 0.1);
put(createMoonModel('airlock', { seed: 2, materials }), -3.2, -6.2, 0.0);
put(createMoonModel('solar_array', { seed: 3, materials }), 8.6, -3.4, -0.55);
put(createMoonModel('rover', { seed: 4, materials }), 0.8, 2.2, -2.4);
put(createMoonModel('flag', { seed: 5, materials }), -5.6, -3.4, 0.5);

// 复用工具箱的工业道具当"货舱配套"：月壤 + 低磨损之下它们自己就变成了基地物资
put(createContainer('container40', { seed: 3, color: 'white', wear: 0.12, materials }), 3.6, -10.6, 0.28);
put(createContainer('container20', { seed: 6, color: 'grey', wear: 0.15, materials }), 8.4, -7.4, -0.3);
put(createProp('gas_cylinders', { seed: 2, materials }), -4.8, -4.7, 0.4);
put(createProp('ibc_tote', { seed: 8, materials }), -2.0, -8.0, 0.2);
put(createProp('crate_stack', { seed: 9, materials }), 1.4, -5.0, 0.3);
put(createFixture('light_mast', { seed: 3, materials }), -10.4, -2.0, 0);

// ---------- 后处理 ----------
const post = createPost(renderer, { quality: 'high' });
post.uniforms.uBloom.value = 0.22;
post.uniforms.uVignette.value = 0.28;
post.uniforms.uGrain.value = 0.008;
post.uniforms.uSat.value = 1.02;
post.uniforms.uExposure.value = 1.0;

// ---------- 相机：慢慢绕圈，可拖动 / 滚动 ----------
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 3000);
const view = { yaw: 0.14, pitch: 0.17, radius: 20, target: new THREE.Vector3(0, 1.6, -4.0), auto: true };
let dragging = false, lastX = 0, lastY = 0;

canvas.addEventListener('pointerdown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  view.yaw -= (e.clientX - lastX) * 0.005;
  view.pitch = Math.max(0.02, Math.min(0.75, view.pitch + (e.clientY - lastY) * 0.003));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.radius = Math.max(9, Math.min(46, view.radius * (1 + Math.sign(e.deltaY) * 0.08)));
}, { passive: false });

function updateCamera(dt) {
  if (!dragging) view.yaw += dt * 0.045; // 闲着的时候自己转
  const { yaw, pitch, radius, target } = view;
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * radius,
    target.y + Math.sin(pitch) * radius,
    target.z + Math.cos(yaw) * Math.cos(pitch) * radius,
  );
  camera.lookAt(target);
}
updateCamera(0);

document.getElementById('sub').textContent =
  `月壤 + 黑天空 + 硬太阳 · 5 个月球模型 + 复用道具 · ${colliders.length} 个碰撞盒`;

// ---------- 循环 ----------
const clock = new THREE.Clock();
let time = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  updateCamera(dt);
  post.uniforms.uTime.value = time;
  post.render(scene, camera, time);
  requestAnimationFrame(tick);
}
tick();

window.__moonScene = { ready: true, colliders: colliders.length, surfaces: moon.surfaces.length };
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight);
});
