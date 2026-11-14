// 同一套 yardkit 素材，三种打光/后处理：
//   a = kit 现有 demo 的黄昏平光 + kit 自己的后处理
//   b = 3dviz-pro-max 的 night-lantern rig（月+半球补光+工矿灯点光），后处理仍用 kit 的
//   c = b 的灯光 + 3dviz 的 post-stack（bloom + vignette + ACES）
// 这个文件只在做对比时用；b/c 需要 `npm i -D postprocessing`。
import * as THREE from 'three';
import { createMaterial, bakeAverage, NAMES } from '../materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';
import { createMaterialStore } from '../src/materials.js';
import { createLevel } from '../src/level.js';
import { createNightLanternRig } from './_ab/lighting-night-lantern.js';

const mode = (new URLSearchParams(location.search).get('mode') || 'a').toLowerCase();
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 500);

const DUSK = { zenith: 0x2a3742, horizon: 0xc08a54, sun: 0xffc48c, cloud: 0x77707a, fog: 0xa5846a };
const NIGHT = { zenith: 0x0a1220, horizon: 0x1d2b38, sun: 0xb9c9ff, cloud: 0x2a3441, fog: 0x141d26 };

function kitPost() {
  const p = createPost(renderer, { quality: 'high' });
  return {
    render: (dt) => { p.uniforms.uTime.value = (p.uniforms.uTime.value || 0) + dt; p.render(scene, camera, p.uniforms.uTime.value); },
    setSize: (w, h) => p.setSize(w, h),
    kind: 'kit',
  };
}

const AVG = {};
for (const n of NAMES) AVG[n] = bakeAverage(renderer, n);
const materials = createMaterialStore({ createMaterial, averages: AVG });

// ---- 场景（三种模式完全一致）----
const t = createLevel({ materials, seed: 4242 });
t.slab('concrete', -12, 0, -12, 12, 0.08, 12, {});
t.col(-12, -0.2, -12, 12, 0.08, 12, 'concrete');
for (const [x0, z0, x1, z1] of [[-12, -12, 12, -11.6], [-12, 11.6, 12, 12], [-12, -12, -11.6, 12], [11.6, -12, 12, 12]]) {
  t.slab('concrete_dirty', x0, 0, z0, x1, 2.6, z1, {});
  t.col(x0, 0, z0, x1, 2.6, z1, 'concrete');
}
t.stairs(-6, -4, 0, 0, {});
t.catwalk(-1, -4, 0, 2.6, {}, [true, true]);
t.stack(4.5, -6.5, [[40, 'red', {}], [40, 'blue', {}]], 0.12, 1);
t.place('forklift', 2.0, 3.0, -0.9, { seed: 3 });
t.place('guard_booth', -8.5, 6.5, 0.4, { seed: 2 });
t.place('barrel', -3.2, 2.2, 0, { seed: 4, color: 'red' });
t.place('barrel', -2.5, 2.6, 0.6, { seed: 5 });
t.place('pallet_stack', -1.2, 3.0, 0.1, { seed: 6 });
t.place('crate_stack', 0.6, 2.6, -0.2, { seed: 7 });
t.place('shelf_rack', 6.4, 2.2, 0.5, { seed: 8 });
t.place('light_mast', -9.5, -6.0, 0, { seed: 9 });
t.place('light_mast', 7.5, -7.0, 0, { seed: 10 });
t.place('jersey_barrier', -5.0, 7.5, 0.1, { seed: 11 });
const built = t.build();
scene.add(built.root);

// ---- 固定机位（三种模式一致）----
camera.position.set(-9.6, 4.6, 12.4);
camera.lookAt(0.4, 1.35, -2.2);

let post;
if (mode === 'a') {
  const sky = createSky(new THREE.Vector3(-0.5, 0.42, 0.68).normalize(), DUSK);
  scene.add(sky.mesh);
  scene.environment = bakeEnvironment(renderer, sky.mesh);
  scene.environmentIntensity = 2.4;
  scene.fog = new THREE.FogExp2(DUSK.fog, 0.011);
  const sun = new THREE.DirectionalLight(0xffd8b0, 5.4);
  sun.position.copy(new THREE.Vector3(-0.5, 0.42, 0.68).normalize()).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -10, near: 1, far: 120 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x9db2c9, 0x3a2f24, 0.6));
  post = kitPost();
} else {
  const sky = createSky(new THREE.Vector3(0.35, 0.5, 0.6).normalize(), NIGHT);
  scene.add(sky.mesh);
  scene.environment = bakeEnvironment(renderer, sky.mesh);
  scene.environmentIntensity = 0.55;
  scene.fog = new THREE.FogExp2(NIGHT.fog, 0.016);

  const rig = createNightLanternRig(scene, { moonAzimuthDeg: -35, moonElevationDeg: 34 });
  const practicals = mode !== 'b';
  // 让月光投影，否则夜景没有形
  rig.moon.castShadow = true;
  rig.moon.shadow.mapSize.set(2048, 2048);
  Object.assign(rig.moon.shadow.camera, { left: -20, right: 20, top: 20, bottom: -12, near: 1, far: 140 });
  rig.moon.shadow.bias = -0.0004;
  rig.moon.shadow.normalBias = 0.02;

  // 用 kit 自己的灯杆当灯位，隐藏 rig 的球泡，只留它算好的点光
  for (const [x, z] of practicals ? [[-9.5, -6.0], [7.5, -7.0], [-2.0, 4.2], [3.6, 5.4]] : []) {
    const { mesh, light } = rig.createLantern([x, 0, z], {});
    mesh.visible = false;
    if (light) {
      light.position.set(x, 7.2, z);
      light.distance = 34;
      light.intensity = 420;
      light.decay = 2;
    }
  }

  if (mode === 'd') {
    const { createPostStack } = await import('./_ab/post-stack.js');
    post = createPostStack({
      renderer, scene, camera,
      bloom: { threshold: 0.9, strength: 0.75, radius: 0.7 },
      vignette: 0.4,
      toneMapping: { mode: 'ACESFilmic', exposure: 1.05 },
    });
    post.renderer = renderer;
  } else {
    post = kitPost();
  }
}

const LABELS = {
  a: ['A · kit 现有黄昏平光（基线）', 'kit 后处理'],
  b: ['B · 换成夜景，但只有月光 + 半球补光', '没有实用光源 —— 夜景的「暗」但不「亮」'],
  c: ['C · B + 3dviz night-lantern rig（4 盏工矿灯 + 月光投影）', '后处理仍是 kit 的'],
  d: ['D · C + 3dviz post-stack（bloom / 暗角 / ACES）', 'pmndrs postprocessing'],
};
document.getElementById('title').textContent = 'YARDKIT · LIGHTING ' + mode.toUpperCase();
document.getElementById('sub').textContent = (LABELS[mode] || ['?', ''])[0];

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  post.render(dt);
  requestAnimationFrame(tick);
}
tick();
window.__ab = { ready: true, mode, stats: built.stats, colliders: built.colliders.length };
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize?.(innerWidth, innerHeight);
});
