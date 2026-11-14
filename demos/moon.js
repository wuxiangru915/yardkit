// 对照实验：同一份 yardkit 几何，只换「主题层」（材质 + 天空 + 灯光）。
//   a = 不换：工业黄昏，同一批箱子/管道/叉车
//   b = 换：月球包（月壤/月岩/隔热金箔/太阳能板 + 黑天空 + 硬太阳）
// 目标不是做一个完整的月球游戏，而是回答：这套资产能不能被「主题化」而不改模型。
import * as THREE from 'three';
import { createMaterial, bakeAverage, surfaceNames } from '../materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';
import { createMaterialStore } from '../src/materials.js';
import { createLevel } from '../src/level.js';
import { createContainer } from '../src/containers.js';
import { createProp } from '../src/props.js';
import { createFixture } from '../src/fixtures.js';
import { createHand } from '../src/hands.js';
import { pipeBetween, cyl } from '../src/geo.js';
import { installMoonPack, createMoonSky, createMoonEnvironment, createMoonLighting, createMoonModel } from '../packs/moon/index.js';

const mode = (new URLSearchParams(location.search).get('mode') || 'a').toLowerCase();
const moon = installMoonPack();
// b / c 用同一套月球主题层（a 保持工业黄昏）
const moonTheme = mode === 'b' || mode === 'c';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 3000);

const DUSK = { zenith: 0x2a3742, horizon: 0xc08a54, sun: 0xffc48c, cloud: 0x77707a, fog: 0xa5846a };

// 材质：a 用 kit 默认映射，b 用月球包的 surfaceMap + 低磨损
const AVG = {};
for (const n of [...new Set([...surfaceNames()])]) AVG[n] = bakeAverage(renderer, n);
const materials = moonTheme
  ? createMaterialStore({ createMaterial: moon.createMaterial, averages: AVG, surfaceMap: moon.surfaceMap })
  : createMaterialStore({ createMaterial, averages: AVG });

// ---------- 场景（两种模式完全一样）----------
const groundMat = moonTheme
  ? moon.createMaterial('regolith', { tile: 8, bump: 2.2, avg: AVG.regolith })
  : createMaterial('concrete', { tile: 4, avg: AVG.concrete });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const t = createLevel({ materials, seed: 2026 });
// 基地：集装箱当舱段，白/灰为主
const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
put(createContainer('container40', { seed: 2, color: 'white', wear: 0.15, materials }), -5.5, 0, -7.5, 0.12);
put(createContainer('container20', { seed: 4, color: 'grey', wear: 0.2, materials }), -1.2, 0, -8.2, -0.08);
put(createContainer('container20', { seed: 5, color: 'white', wear: 0.1, materials }), -1.0, 2.59, -8.1, 0.05);

// 设备
put(createProp('generator', { seed: 3, materials }), 3.4, 0, -3.2, -0.3);
put(createProp('gas_cylinders', { seed: 2, materials }), 1.6, 0, -5.4, 0.5);
put(createProp('pipe_stack', { seed: 7, materials }), 5.6, 0, -6.6, 1.2);
put(createProp('crate_stack', { seed: 9, materials }), -8.4, 0, -2.2, 0.2);
put(createProp('crate_wood', { seed: 6, materials }), -7.0, 0, -1.2, -0.4);
put(createProp('pallet_stack', { seed: 4, materials }), -2.6, 0, -1.6, 0.1);
put(createProp('ibc_tote', { seed: 8, materials }), 0.6, 0, -1.9, 0.3);
put(createProp('tarp_cargo', { seed: 11, materials }), 2.2, 0, -0.6, 0.6);
put(createProp('forklift', { seed: 1, materials }), 6.4, 0, 0.4, -1.1);
put(createProp('barrel', { seed: 2, color: 'grey', materials }), -4.2, 0, -0.4);
put(createProp('traffic_cone', { seed: 5, materials }), 0.2, 0, 1.2);

// 结构与天线
t.stairs(-9.0, 1.6, -0.35, 0, {});
t.catwalk(-6.4, 1.2, -0.35, 2.6, {}, [true, true]);
put(createFixture('light_mast', { seed: 3, materials }), -10.6, 0, -3.2);
put(createFixture('light_mast', { seed: 4, materials }), 8.0, 0, -2.4);
put(createFixture('fence_panel', { seed: 6, materials }), 8.6, 0, 3.2, Math.PI / 2);
put(createFixture('bollard_post', { seed: 1, materials }), 3.0, 0, 2.2);
const built = t.build();
scene.add(built.root);

// c：月球包 + 5 个新模型（只在 c 里加，a/b 保持对照实验原样）
const yardModels = [];
if (mode === 'c') {
  const yard = [
    ['rover', -1.2, 3.6, -2.5],
    ['flag', 1.8, 2.6, -0.55],
    ['airlock', 0.0, -3.9, -0.4],
    ['solar_array', -5.6, -4.1, 0.1],
    ['habitat', 7.0, -11.2, -0.35],
  ];
  yard.forEach(([name, x, z, ry], i) => {
    const o = createMoonModel(name, { seed: 2026 + i, materials });
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    scene.add(o);
    yardModels.push(o);
  });
}

// 宇航员的手（同一个 mesh；b 里换成白色手套材质）
const gloveMat = moonTheme
  ? new THREE.MeshStandardMaterial({ color: 0xe9edf0, roughness: 0.62, metalness: 0.03 })
  : undefined;
const hand = createHand('right', gloveMat ? { material: gloveMat } : {});
hand.root.position.set(0.34, -0.2, -0.6);
hand.root.rotation.set(0.05, -0.28, 0.1);
camera.add(hand.root);

// 手本身没有小臂（hands.js 的已知缺口），这里用两个图元补一段袖子，
// 两种模式同一份几何，只换材质：b = 宇航服，a = 工作服。
const sleeveMat = moonTheme
  ? new THREE.MeshStandardMaterial({ color: 0xd9dde1, roughness: 0.85, metalness: 0.02 })
  : new THREE.MeshStandardMaterial({ color: 0x4a4f45, roughness: 0.95, metalness: 0.02 });
const cuffMat = moonTheme
  ? new THREE.MeshStandardMaterial({ color: 0xb9c2c9, roughness: 0.45, metalness: 0.55 })
  : new THREE.MeshStandardMaterial({ color: 0x2c2f2a, roughness: 0.8, metalness: 0.2 });
const wrist = new THREE.Vector3(0.34, -0.21, -0.57);
const elbow = new THREE.Vector3(0.62, -0.72, -0.34);
const sleeve = new THREE.Mesh(pipeBetween(wrist, elbow, 0.075, 0.062, 12, true), sleeveMat);
const cuff = new THREE.Mesh(cyl(0.078, 0.078, 0.05, 12), cuffMat);
cuff.position.copy(wrist).lerp(elbow, 0.06);
cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), elbow.clone().sub(wrist).normalize());
sleeve.frustumCulled = false;
cuff.frustumCulled = false;
camera.add(sleeve, cuff);
scene.add(camera);

// ---------- 主题层：天空 / 灯光 / 雾 ----------
if (moonTheme) {
  scene.background = new THREE.Color(0x000000);
  const sky = createMoonSky({});
  if (sky.earth) sky.earth.position.set(150, 130, -520);
  scene.add(sky.group);
  createMoonLighting(scene, {});
  scene.environment = createMoonEnvironment(renderer);
  scene.environmentIntensity = 0.5;
} else {
  const sky = createSky(new THREE.Vector3(-0.5, 0.42, 0.68).normalize(), DUSK);
  scene.add(sky.mesh);
  scene.environment = bakeEnvironment(renderer, sky.mesh);
  scene.environmentIntensity = 2.2;
  scene.fog = new THREE.FogExp2(DUSK.fog, 0.012);
  const sun = new THREE.DirectionalLight(0xffd8b0, 5.2);
  sun.position.set(-18, 16, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -12, near: 1, far: 120 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x9db2c9, 0x3a2f24, 0.65));
}

const post = createPost(renderer, { quality: 'high' });
camera.position.set(-8.2, 1.62, 9.4);
camera.lookAt(0.6, 1.5, -4.2);

document.getElementById('title').textContent = 'YARDKIT · MOON ' + mode.toUpperCase();
document.getElementById('sub').textContent = moonTheme
  ? (mode === 'c'
    ? 'C · 月球包 + 5 个新模型'
    : 'B · 主题层换成月球包：月壤 + 黑天空 + 硬太阳 + 白手套')
  : 'A · 不换主题：同一批资产，工业黄昏';

let time = 0;
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  hand.update(dt, {});
  post.uniforms.uTime.value = time;
  post.render(scene, camera, time);
  requestAnimationFrame(tick);
}
tick();
window.__moon = { ready: true, mode, surfaces: moon.surfaces.length, colliders: built.colliders.length, models: yardModels.length };
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight);
});
