import * as THREE from 'three';
import { createMaterial, bakeAverage, NAMES } from '../src/materials/materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';

// 同一个材质库、同一套管线，只换色板与光比 —— 就是"治愈系"
const DAY = {
  zenith: 0x3a83c4, horizon: 0xbdd9ec, sun: 0xfff2d2,
  cloud: 0xffffff, fog: 0xcfe0ea
};

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);

const sunDir = new THREE.Vector3(-0.55, 0.30, 0.78).normalize();   // 太阳更高 = 柔和
const sun = new THREE.DirectionalLight(0xfff2da, 3.6);
sun.position.copy(sunDir).multiplyScalar(40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xa8c8e6, 0x8a7a52, 0.22));

const sky = createSky(sunDir, DAY);
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.environmentIntensity = 0.85;
scene.fog = new THREE.FogExp2(DAY.fog, 0.0075);

// —— 三种新材质 ——
const avg = {
  grass: bakeAverage(renderer, 'grass'),
  mud: bakeAverage(renderer, 'mud'),
  sand: bakeAverage(renderer, 'sand'),
  wood: bakeAverage(renderer, 'wood')
};
const matGrass = createMaterial('grass', { tile: 1.6, bump: 3.0, avg: avg.grass });
const matMud = createMaterial('mud', { tile: 2.2, bump: 3.0, avg: avg.mud });
const matSand = createMaterial('sand', { tile: 1.1, bump: 2.0, avg: avg.sand });
const matWood = createMaterial('wood', { tile: 1.0, tint: 0xa8865e, avg: avg.wood });

// —— 草地 ——
const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140, 1, 1), matGrass);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// —— 泥路（沿曲线的带状网格）——
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-26, 0, 12), new THREE.Vector3(-10, 0, 8),
  new THREE.Vector3(2, 0, 2), new THREE.Vector3(10, 0, -8),
  new THREE.Vector3(14, 0, -22), new THREE.Vector3(8, 0, -36)
], false, 'catmullrom', 0.5);
{
  const N = 160, W = 2.6, pos = [], idx = [], nrm = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = path.getPointAt(u), t = path.getTangentAt(u);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    pos.push(p.x - n.x * W, 0.02, p.z - n.z * W, p.x + n.x * W, 0.02, p.z + n.z * W);
    nrm.push(0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  const road = new THREE.Mesh(g, matMud);
  road.receiveShadow = true;
  scene.add(road);
}

// —— 沙地：路边一片椭圆 ——
{
  const g = new THREE.CircleGeometry(4.4, 40);
  const m = new THREE.Mesh(g, matSand);
  m.rotation.x = -Math.PI / 2;
  m.position.set(7.4, 0.03, -4.4);
  m.scale.set(1.0, 1.35, 1);
  m.receiveShadow = true;
  scene.add(m);
}

// —— 石头 / 草丛 / 栅栏 ——
const stoneMat = createMaterial('concrete', { tile: 1.5, tint: 0xb9c0bb });
for (const [x, z, s] of [[-4, 4, 1.0], [3.5, -1.5, 0.7], [9, 2.5, 0.55], [-9, -3, 0.8]]) {
  const g = new THREE.SphereGeometry(s * 0.5, 20, 14);
  g.scale(1, 0.62, 0.85);
  const m = new THREE.Mesh(g, stoneMat);
  m.position.set(x, s * 0.22, z);
  m.rotation.y = x * 0.7;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
const tuftMat = createMaterial('grass', { tile: 0.5, tint: 0x9fbf72, avg: avg.grass });
for (let i = 0; i < 26; i++) {
  const a = (i / 26) * Math.PI * 2 + Math.sin(i * 2.1) * 0.9;
  const r = 4.5 + (i % 6) * 1.6;
  const s2 = 0.22 + (i % 4) * 0.08;
  const g = new THREE.SphereGeometry(s2, 10, 7);
  g.scale(1.0, 0.55, 0.9);
  const m = new THREE.Mesh(g, tuftMat);
  m.position.set(Math.cos(a) * r + 1.5, s2 * 0.35, Math.sin(a) * r * 0.9);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
for (let i = 0; i < 9; i++) {
  const g = new THREE.BoxGeometry(0.14, 1.1, 0.14);
  const m = new THREE.Mesh(g, matWood);
  m.position.set(-14 + i * 2.4, 0.55, 15 + Math.sin(i * 0.8) * 0.5);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}

const post = createPost(renderer, { quality: 'high' });
post.uniforms.uVignette.value = 0.22;   // 治愈系：暗角小
post.uniforms.uGrain.value = 0.012;     // 颗粒轻
post.uniforms.uSat.value = 1.18;        // 饱和度略高
post.uniforms.uExposure.value = 0.95;
post.uniforms.uBloom.value = 0.20;

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  const a = Math.sin(t * 0.07) * 0.5;
  camera.position.set(0.1 + a * 1.6, 1.62 + Math.sin(t * 0.45) * 0.03, 5.4);
  camera.lookAt(4.6, 0.30, -3.0);
  sun.position.copy(sunDir).multiplyScalar(40).add(new THREE.Vector3(0, 0, 0));
  post.uniforms.uTime.value = t;
  post.render(scene, camera, t);
  requestAnimationFrame(tick);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight);
});
tick();
window.__cozy = { ready: true, stats: () => post.lastStats, materials: NAMES.slice(-3) };
