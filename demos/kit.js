// 把 two 层合起来的验收 demo：几何全来自 geometry 入口，表面全部换成 30 个 GLSL 材质。
import * as THREE from 'three';
import { createMaterial, bakeAverage, NAMES } from '../materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';
import { createMaterialStore } from '../src/materials.js';
import { createProp } from '../src/props.js';
import { createFixture } from '../src/fixtures.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 500);
const PALETTE = { zenith: 0x2a3742, horizon: 0xc08a54, sun: 0xffc48c, cloud: 0x77707a, fog: 0xa5846a };
const sunDir = new THREE.Vector3(-0.55, 0.35, 0.75).normalize();
const sun = new THREE.DirectionalLight(0xffd8b0, 6.0);
sun.position.copy(sunDir).multiplyScalar(40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -8, near: 1, far: 100 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0x9db2c9, 0x3a2f24, 0.55));

const sky = createSky(sunDir, PALETTE);
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.environmentIntensity = 2.6;
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.014);

// 每个材质烘一次平均色，交给 store（远处退化成平均色）
const AVG = {};
for (const n of NAMES) AVG[n] = bakeAverage(renderer, n);
const materials = createMaterialStore({ createMaterial, averages: AVG });

// 地面：直接用 GLSL 混凝土
const floorMat = createMaterial('concrete', { tile: 2.5, avg: AVG.concrete });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// 道具/设施：材质来自 store（会自动桥接到 ./src/materials 的 GLSL 层）
const line = (name, make, x, z, opts = {}) => {
  const o = make(name, { ...opts, materials });
  o.position.set(x, 0, z);
  o.rotation.y = opts.yaw || 0;
  scene.add(o);
  return o;
};
line('barrel', createProp, -3.6, -1.2, { seed: 2, color: 'red' });
line('barrel', createProp, -2.9, -1.6, { seed: 3 });
line('pallet_stack', createProp, -1.5, -1.0, { seed: 5 });
line('crate_stack', createProp, 0.6, -1.4, { seed: 7 });
line('ibc_tote', createProp, 2.6, -1.2, { seed: 4 });
line('forklift', createProp, 5.4, -2.6, { seed: 1, yaw: -0.5 });
line('jersey_barrier', createFixture, -4.6, 1.6, { seed: 1, yaw: 0.15 });
line('guard_booth', createFixture, 3.4, 2.4, { seed: 2, yaw: -0.35 });
line('light_mast', createFixture, -6.4, -3.6);
line('shelf_rack', createFixture, 0.2, -5.2, { seed: 3, yaw: 0.4 });

const post = createPost(renderer, { quality: 'high' });
camera.position.set(-7.5, 3.1, 6.4);
camera.lookAt(1.2, 1.0, -1.6);

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  post.uniforms.uTime.value = t;
  post.render(scene, camera, t);
  requestAnimationFrame(tick);
}
tick();

window.__kit = { ready: true, materials: NAMES.length };
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight);
});
