// 用 createLevel() 搭一个小院子：几何 + 碰撞盒同时登记，道具/设施/集装箱全部走既有工厂。
import * as THREE from 'three';
import { createMaterial, bakeAverage, bakeSurfaces, NAMES } from '../materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';
import { createMaterialStore } from '../src/materials.js';
import { createLevel } from '../src/level.js';
import { createAutoQuality, pickTier, tierConfig, QUALITY_TIERS } from '../src/quality.js';

// ?q=auto|low|medium|high|ultra：auto 按 UA / GPU 字符串选档，显式档位则固定不降档。
const qParam = (new URLSearchParams(location.search).get('q') || 'auto').toLowerCase();
const tierName = QUALITY_TIERS[qParam] ? qParam : pickTier();
const tierCfg = tierConfig(tierName);

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // 之后由 createAutoQuality 接管
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 500);
const PALETTE = { zenith: 0x2a3742, horizon: 0xc08a54, sun: 0xffc48c, cloud: 0x77707a, fog: 0xa5846a };
const sunDir = new THREE.Vector3(-0.5, 0.42, 0.68).normalize();
const sun = new THREE.DirectionalLight(0xffd8b0, 5.4);
sun.position.copy(sunDir).multiplyScalar(40);
sun.castShadow = true;
sun.shadow.mapSize.set(tierCfg.shadow, tierCfg.shadow);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -10, near: 1, far: 120 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0x9db2c9, 0x3a2f24, 0.6));
const sky = createSky(sunDir, PALETTE);
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.environmentIntensity = 2.4;
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.011);

// flat 档不跑 GLSL，也就不需要逐材质烘平均色（那要 30 次小 RT 渲染）。
const AVG = {};
if (tierCfg.material !== 'flat') for (const n of NAMES) AVG[n] = bakeAverage(renderer, n);
// baked 档必须先把表面烘成贴图，否则 createMaterial 会回退 live（只警告一次）。
if (tierCfg.material === 'baked') bakeSurfaces(renderer, NAMES.map((name) => ({ name, size: 256 })));
const materials = createMaterialStore({ createMaterial, averages: AVG, tier: tierCfg.material });
const t = createLevel({ materials, seed: 4242 });

// 地面 + 围墙（slab 只摆几何，col 单独登记碰撞）
t.slab('concrete', -12, 0, -12, 12, 0.08, 12, {});
t.col(-12, -0.2, -12, 12, 0.08, 12, 'concrete', { noNav: false });
for (const [x0, z0, x1, z1] of [[-12, -12, 12, -11.6], [-12, 11.6, 12, 12], [-12, -12, -11.6, 12], [11.6, -12, 12, 12]]) {
  t.slab('concrete_dirty', x0, 0, z0, x1, 2.6, z1, {});
  t.col(x0, 0, z0, x1, 2.6, z1, 'concrete');
}

// 钢结构：楼梯 + 栈桥（自带金属地面标记）
t.stairs(-6, -4, 0, 0, {});
t.catwalk(-1, -4, 0, 2.6, {}, [true, true]);

// 集装箱堆 + 道具/设施
t.stack(4.5, -6.5, [[40, 'red', {}], [40, 'blue', {}]], 0.12, 1);
t.place('forklift', 2.0, 3.0, -0.9, { seed: 3 });
t.place('guard_booth', -8.5, 6.5, 0.4, { seed: 2 });
t.place('barrel', -3.2, 2.2, 0, { seed: 4, color: 'red' });
t.place('barrel', -2.5, 2.6, 0.6, { seed: 5 });
t.place('pallet_stack', -1.2, 3.0, 0.1, { seed: 6 });
t.place('crate_stack', 0.6, 2.6, -0.2, { seed: 7 });
t.place('shelf_rack', 6.4, 2.2, 0.5, { seed: 8 });
t.place('light_mast', -9.5, -6.0, 0, { seed: 9 });
t.place('jersey_barrier', -5.0, 7.5, 0.1, { seed: 10 });

const built = t.build();
scene.add(built.root);
document.getElementById('stats').textContent =
  `${built.stats.drawCalls} draw calls · ${(built.stats.tris / 1000).toFixed(0)}k tris · ${built.colliders.length} colliders`;

const post = createPost(renderer, { quality: tierCfg.post });
camera.position.set(-13.5, 7.2, 15.5);
camera.lookAt(1.5, 1.8, -1.5);

// 运行时画质：auto 也交给 createAutoQuality 自己选档（否则会被当成显式档位、不再降档）；
// 显式 q 档位默认只降 scale、不降档。HUD 实时显示。
const quality = createAutoQuality({ renderer, post, sun, tier: qParam === 'auto' ? 'auto' : tierName });
const qualityEl = document.getElementById('quality');
window.__scene = { ready: true, stats: built.stats, colliders: built.colliders.length, tier: quality.tier, scale: quality.scale };

const clock = new THREE.Clock();
let lastFrame = performance.now();
let fpsAvg = 60;
let hudAt = 0;
function tick() {
  const now = performance.now();
  const frameMs = Math.max(1, Math.min(now - lastFrame, 200));
  lastFrame = now;
  quality.update(frameMs);
  fpsAvg += (1000 / frameMs - fpsAvg) * 0.05;

  const time = clock.getElapsedTime();
  post.uniforms.uTime.value = time;
  post.render(scene, camera, time);

  if (now - hudAt > 500) {
    hudAt = now;
    qualityEl.textContent = `${quality.tier} · ${quality.scale.toFixed(2)} · ${fpsAvg.toFixed(0)} fps`;
    window.__scene.tier = quality.tier;
    window.__scene.scale = quality.scale;
  }
  requestAnimationFrame(tick);
}
tick();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  // 像素尺寸由 createAutoQuality 的 resize 监听统一处理
});
