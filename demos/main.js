import * as THREE from 'three';
import { createMaterial, bakeAverage, NAMES } from '../src/materials/materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';

const PALETTE = { zenith: 0x2a3742, horizon: 0xc08a54, sun: 0xffc48c, cloud: 0x77707a, fog: 0xa5846a };

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 400);
scene.add(camera);

const sunDir = new THREE.Vector3(-0.55, 0.35, 0.75).normalize();
const sun = new THREE.DirectionalLight(0xffd8b0, 6.0);
sun.position.copy(sunDir).multiplyScalar(40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -6, near: 1, far: 100 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0x9db2c9, 0x3a2f24, 0.55));

const sky = createSky(sunDir, PALETTE);
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.environmentIntensity = 2.6;
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.010);

// 先把每个材质的平均色烘出来（远处退化用）
const AVG = {};
for (const n of NAMES) AVG[n] = bakeAverage(renderer, n);

// 地面：混凝土（顺便验证 flat 大面）
const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), createMaterial('concrete', { tile: 2.5, avg: AVG.concrete }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// 展台：每个材质一组（块 / 球 / 板）

const cols = 9;
const spacing = 1.25;
const items = [];
const geoBox = new THREE.BoxGeometry(0.62, 0.62, 0.62, 2, 2, 2);
const geoSphere = new THREE.SphereGeometry(0.36, 48, 32);
const geoPlate = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 40);

NAMES.forEach((name, i) => {
  const row = Math.floor(i / cols);
  const col = i % cols;
  const x = (col - (cols - 1) / 2) * spacing;
  const z = -row * spacing - 0.6;
  const y = row === 0 ? 0.31 : row === 1 ? 0.36 : 0.07;   // 坐在“地面”上，不悬空

  const mat = createMaterial(name, { seed: i * 7, avg: AVG[name] });
  const mesh = new THREE.Mesh(row === 0 ? geoBox : row === 1 ? geoSphere : geoPlate, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = name;
  document.body.appendChild(label);
  items.push({ name, mesh, label });
});

const post = createPost(renderer, { quality: 'high' });

const cam = { pos: new THREE.Vector3(0.0, 2.35, 6.6), look: new THREE.Vector3(0, 0.45, -1.15) };
camera.position.copy(cam.pos);
camera.lookAt(cam.look);

let drag = false, px = 0, py = 0;
canvas.addEventListener('mousedown', (e) => { drag = true; px = e.clientX; py = e.clientY; });
addEventListener('mouseup', () => { drag = false; });
addEventListener('mousemove', (e) => {
  if (!drag) return;
  const dx = (e.clientX - px) / innerWidth, dy = (e.clientY - py) / innerHeight;
  px = e.clientX; py = e.clientY;
  cam.pos.sub(cam.look).applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx * 2.2);
  cam.pos.y = Math.max(0.4, Math.min(12, cam.pos.y + dy * 4));
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  const v = new THREE.Vector3();
  for (const it of items) {
    v.copy(it.mesh.position).project(camera);
    const x = (v.x * 0.5 + 0.5) * innerWidth;
    const y = (-v.y * 0.5 + 0.5) * innerHeight - 34;
    it.label.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    it.label.style.opacity = v.z < 1 ? '0.75' : '0';
  }
  post.uniforms.uTime.value = t;
  post.render(scene, camera, t);
  requestAnimationFrame(tick);
}
tick();

window.__gallery = {
  ready: true,
  names: NAMES,
  stats: () => {
    const s = post.lastStats;
    return { calls: s.calls, tris: s.tris };
  },
  view(px2, py2, pz2, lx, ly, lz) {
    cam.pos.set(px2, py2, pz2);
    cam.look.set(lx ?? 0, ly ?? 0.5, lz ?? -2.2);
  }
};
