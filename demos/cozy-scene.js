// 治愈包演示：一个小院 —— 木地板 + 矮墙 + 8 个包内模型 + 2 个 kit 道具（走 surfaceMap 变皮肤）。
// 全部零贴图，内核（src/）一行没改。
import * as THREE from 'three';
import { bakeAverage } from '../materials.js';
import { bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';
import { createMaterialStore } from '../src/materials.js';
import { createLevel } from '../src/level.js';
import { createProp } from '../src/props.js';
import {
  installCozyPack, createCozySky, createCozyLighting,
  createCozyModel, COZY_MODEL_NAMES,
} from '../packs/cozy/index.js';

// ---------- 渲染器 ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;      // PCF（不是 PCFSoft）才会吃 shadow.radius
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 600);

// ---------- 主题层 ----------
const cozy = installCozyPack({ wear: 0.15 });

// 只烘这座院子会用到的平均色（远处淡出用），别把 35 个表面全编一遍
const AVG = {};
for (const n of cozy.surfaces) AVG[n] = bakeAverage(renderer, n);
const materials = createMaterialStore({
  createMaterial: cozy.createMaterial,
  surfaceMap: cozy.surfaceMap,
  averages: AVG,
});

const sky = createCozySky({ fogDensity: 0.005 });
sky.attach(scene);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.environmentIntensity = 0.62;

createCozyLighting(scene, { sunIntensity: 2.5, hemi: 1.0, fill: 0.18 });

// ---------- 小院：草地 + 木地板 + 矮墙 + 窗 ----------
// 草坪：不直接用 kit 的 grass（它带泥斑和草叶细节，远景会变噪），
// 而是把 plaster 上成大片的草绿 —— 低对比、没有脏斑，正好当远处的「软背景」
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  cozy.createMaterial('plaster', { tint: 0xa9bd85, tile: 3.2, bump: 0.8, avg: AVG.plaster }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 墙与地板不走 store：直接建一张更暖的材质（store 的 tint 来自 kit 的 preset，偏冷）
const wallMat = cozy.createMaterial('plaster', { tint: 0xfaf0e0, avg: AVG.plaster });
const plankMat = cozy.createMaterial('painted_wood', { tint: 0xc09a68, avg: AVG.painted_wood });
const bushMat = cozy.createMaterial('foliage', { tint: 0x9cb87c, avg: AVG.foliage });

const level = createLevel({ materials, seed: 2026 });

// 木地板平台（比草地高 14cm）：真板一条条铺，靠 5cm 缝形成板缝
for (let i = 0; i < 12; i++) {
  level.box(plankMat, 7.32, 0.14, 0.56, 0, 0.07, -3.38 + i * 0.6, { bevel: 0.02 });
}
level.col(-3.6, -0.1, -3.6, 3.6, 0.14, 3.6, 'wood');

// 矮墙（背 + 左）：奶白抹灰 + 木压顶
level.slab(wallMat, -3.6, 0, -3.95, 3.6, 0.86, -3.62, { bevel: 0.03 });
level.slab('wood_pallet', -3.72, 0.86, -4.05, 3.72, 0.94, -3.52, { bevel: 0.02 });
level.col(-3.72, -0.1, -4.05, 3.72, 0.94, -3.52, 'concrete');
level.slab(wallMat, -3.95, 0, -3.62, -3.62, 0.86, 2.6, { bevel: 0.03 });
level.slab('wood_pallet', -4.05, 0.86, -3.62, -3.52, 0.94, 2.6, { bevel: 0.02 });
level.col(-4.05, -0.1, -3.62, -3.52, 0.94, 2.6, 'concrete');

// 墙上的窗：木框 + 一层暖光 + 玻璃（玻璃是 kit 的透明材质，不走 surfaceMap）
const WIN = { x0: -2.06, x1: -1.04, y0: 0.30, y1: 0.92, z: -3.62 };
level.slab('wood_dark', WIN.x0, WIN.y0, WIN.z, WIN.x1, WIN.y0 + 0.06, WIN.z + 0.05, { bevel: 0.008 });
level.slab('wood_dark', WIN.x0, WIN.y1 - 0.06, WIN.z, WIN.x1, WIN.y1, WIN.z + 0.05, { bevel: 0.008 });
level.slab('wood_dark', WIN.x0, WIN.y0, WIN.z, WIN.x0 + 0.06, WIN.y1, WIN.z + 0.05, { bevel: 0.008 });
level.slab('wood_dark', WIN.x1 - 0.06, WIN.y0, WIN.z, WIN.x1, WIN.y1, WIN.z + 0.05, { bevel: 0.008 });
level.slab('wood_dark', (WIN.x0 + WIN.x1) / 2 - 0.03, WIN.y0, WIN.z, (WIN.x0 + WIN.x1) / 2 + 0.03, WIN.y1, WIN.z + 0.04, { bevel: 0.006 });
level.quad(materials.emissive(0xffd7a2, 1.8), (WIN.x1 - WIN.x0) - 0.12, (WIN.y1 - WIN.y0) - 0.12,
  (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WIN.z + 0.006, 'z+');
level.quad(materials.get('glass'), (WIN.x1 - WIN.x0) - 0.12, (WIN.y1 - WIN.y0) - 0.12,
  (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WIN.z + 0.045, 'z+');

const built = level.build();
scene.add(built.root);

// ---------- 包内模型 + kit 道具 ----------
// 摆位助手：同时把模型自带的碰撞盒折算成世界坐标交给关卡（内核那套 col 约定照用）
const placed = [];
function put(obj, x, z, yaw = 0, y = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = yaw;
  obj.updateMatrixWorld(true);
  scene.add(obj);
  for (const c of obj.userData.colliders || []) {
    const box = new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max));
    box.applyMatrix4(obj.matrixWorld);
    level.col(box.min.toArray(), box.max.toArray(), c.surface || 'wood');
  }
  placed.push({ name: obj.name, x, y, z, yaw });
  return obj;
}

const DECK = 0.14;
const TABLE_TOP = DECK + 0.75;

put(createCozyModel('rug', { seed: 2, materials }), -0.1, 0.5, 0.04, DECK + 0.005);
put(createCozyModel('table', { seed: 3, materials, color: 'white' }), -0.1, 0.45, 0);
put(createCozyModel('teacup', { seed: 4, materials }), -0.46, 0.30, 0.6, TABLE_TOP);
put(createCozyModel('lantern', { seed: 5, materials, color: 'teal' }), 0.22, 0.62, 0.2, TABLE_TOP);
put(createCozyModel('chair', { seed: 6, materials, color: 'white' }), -1.45, 0.95, 1.30, DECK);
put(createCozyModel('chair', { seed: 8, materials, color: 'teal' }), 1.05, 0.05, -1.85, DECK);
put(createCozyModel('bookshelf', { seed: 9, materials }), -2.55, -3.34, 0, DECK);
put(createCozyModel('potted_plant', { seed: 10, materials }), -3.16, -2.52, 0.4, DECK);
put(createCozyModel('fence', { seed: 11, materials, color: 'white' }), 4.35, -0.5, Math.PI / 2, 0);
put(createCozyModel('fence', { seed: 12, materials, color: 'white' }), 4.35, 1.3, Math.PI / 2, 0);

// kit 的道具：材质名照旧，靠 surfaceMap 变成刷漆木 / 织物
const kitProps = [
  put(createProp('pallet', { seed: 3, materials }), 2.62, -2.45, 0.22, DECK),
  put(createProp('cardboard_boxes', { seed: 2, materials }), -2.45, 2.30, 0.55, DECK),
];

// 院子外面的圆灌木（两个球就够，给草坪一点层次）
for (const [x, z, r] of [[4.9, -2.6, 0.62], [5.6, 3.1, 0.46], [-5.1, 3.3, 0.58], [-4.7, -2.9, 0.40]]) {
  const g = new THREE.SphereGeometry(r, 12, 9);
  g.scale(1, 0.78, 1);
  const m = new THREE.Mesh(g, bushMat);
  m.position.set(x, r * 0.62, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}

// ---------- 后处理：低强度 bloom ----------
const post = createPost(renderer, { quality: 'high' });
post.uniforms.uBloom.value = 0.16;
post.uniforms.uVignette.value = 0.22;
post.uniforms.uGrain.value = 0.010;
post.uniforms.uSat.value = 1.09;
post.uniforms.uExposure.value = 0.94;

camera.position.set(5.3, 2.15, 6.3);
camera.lookAt(0.0, 1.05, -0.8);

// ---------- HUD ----------
document.getElementById('sub').textContent =
  `${COZY_MODEL_NAMES.length} cozy models + ${kitProps.length} kit props · ` +
  `${built.colliders.length} colliders · ${built.stats.tris.toLocaleString()} tris`;
const tagBox = document.getElementById('tags');
for (const t of ['plaster', 'painted_wood', 'ceramic', 'weave', 'foliage']) {
  const i = document.createElement('i');
  i.textContent = t;
  tagBox.appendChild(i);
}

// ---------- 循环 ----------
const clock = new THREE.Clock();
let time = 0;
function tick() {
  time += Math.min(clock.getDelta(), 0.05);
  post.uniforms.uTime.value = time;
  post.render(scene, camera, time);
  requestAnimationFrame(tick);
}
tick();

window.__cozyCamera = camera;
window.__cozyRenderer = renderer;
window.__cozyScene = {
  ready: true,
  surfaces: cozy.surfaces,
  surfaceMap: Object.keys(cozy.surfaceMap).length,
  models: COZY_MODEL_NAMES,
  colliders: built.colliders.length,
  placed: placed.length,
  tris: built.stats.tris,
  stats: () => post.lastStats,
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight);
});
