// 一页看完整套库：30 个程序化表面 / 33 个模型 / 3 套自己拼的主题 + 后处理开关。
//
// 这个页面不新增任何资产，也不依赖任何"主题包"：材质来自内核 registry，模型来自
// props/fixtures/containers，三套主题全部只用库里的 30 个表面 + 天空色板 + 打光 + 后处理拼出来。
// 它想证明的就是那三句话：
//   1. 表面是算出来的，不是贴上去的（材质墙：30 个球，零图片）；
//   2. 模型是原语拼的，没有模型文件（转台：33 个工厂函数）；
//   3. 主题是一层配置（主题页：同一批几何，换 surfaceMap / 光 / 雾 / 后处理就是另一种风格）。
//      库里不提供现成主题 —— 第三页那三套就是"你自己做主题"的最短示范。

import * as THREE from 'three';
import { createMaterial, bakeAverage, surfaceNames, NAMES } from '../materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';
import { createPost } from '../src/materials/post.js';
import { createMaterialStore } from '../src/materials.js';
import { createProp, PROP_NAMES } from '../src/props.js';
import { createFixture, FIXTURE_NAMES } from '../src/fixtures.js';
import { createContainer } from '../src/containers.js';

// ---------------------------------------------------------------- 渲染器 / 相机
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // 主题包里的 shadow.radius 只在这档生效
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 600);
scene.fog = new THREE.FogExp2(0x1b232d, 0.006);

const post = createPost(renderer, { quality: 'high' });

// ---------------------------------------------------------------- 烘平均色
// 库里总共 30 个表面，全部烘一遍（远处退化用）；主题页只用到其中的 20 来个。
const ALL_SURFACES = surfaceNames();
const AVG = {};
for (const n of ALL_SURFACES) AVG[n] = bakeAverage(renderer, n);

// ---------------------------------------------------------------- 棚拍光（材质 / 模型两页用）
const studio = new THREE.Group();
scene.add(studio);

// 背景用深色天（衬托材质），反射环境单独用一张亮得多的天烘 —— 金属没有环境就是一片黑。
const STUDIO_PALETTE = { zenith: 0x0d1319, horizon: 0x222b35, sun: 0xd9e6f5, cloud: 0x151d26, fog: 0x0d1319 };
const STUDIO_SUN = new THREE.Vector3(0.25, 0.72, 0.62).normalize();
const studioSky = createSky(STUDIO_SUN, STUDIO_PALETTE);
studio.add(studioSky.mesh);
const studioEnv = bakeEnvironment(renderer, createSky(STUDIO_SUN, {
  zenith: 0x6d7c8c, horizon: 0xbcc9d6, sun: 0xffffff, cloud: 0x8e9aa8, fog: 0x6d7c8c,
}).mesh);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(9, 14, 11);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
Object.assign(keyLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -14, near: 1, far: 90 });
keyLight.shadow.bias = -0.0004;
keyLight.shadow.normalBias = 0.02;
const fillLight = new THREE.DirectionalLight(0xbcd2ff, 1.2);
fillLight.position.set(-12, 6, -9);
const studioHemi = new THREE.HemisphereLight(0xdfe9f5, 0x2a2622, 0.9);
studio.add(keyLight, keyLight.target, fillLight, studioHemi);

// ---------------------------------------------------------------- 材质墙（内核 30 个表面）
const materialsGroup = new THREE.Group();
scene.add(materialsGroup);

const wallMeshes = [];
const SPHERE = new THREE.SphereGeometry(0.46, 40, 26);

NAMES.forEach((name, i) => {
  const col = i % 6;
  const row = Math.floor(i / 6);
  const mat = createMaterial(name, { avg: AVG[name] });
  const mesh = new THREE.Mesh(SPHERE, mat);
  mesh.position.set((col - 2.5) * 1.45, (2 - row) * 1.32 + 0.15, 0);
  materialsGroup.add(mesh);
  wallMeshes.push(mesh);
});

// ---------------------------------------------------------------- 模型转台（19 道具 + 14 设施）
const industrial = createMaterialStore({ createMaterial, averages: AVG });

const modelsGroup = new THREE.Group();
scene.add(modelsGroup);

// 转台底盘：让阴影有落点，也让"转"看得出来
const disc = new THREE.Mesh(
  new THREE.CylinderGeometry(24, 24, 0.3, 72),
  createMaterial('concrete', { tile: 3, avg: AVG.concrete }),
);
disc.position.y = -0.15;
disc.receiveShadow = true;
modelsGroup.add(disc);

const ITEMS = [];
for (const name of PROP_NAMES) {
  const obj = createProp(name, { seed: 11, materials: industrial });
  obj.userData.ITEM = name;
  ITEMS.push({ name, kind: '道具', obj });
}
for (const name of FIXTURE_NAMES) {
  const obj = createFixture(name, { seed: 12, materials: industrial });
  obj.userData.ITEM = name;
  ITEMS.push({ name, kind: '设施', obj });
}

// 按占地（x/z 里的大者）排序，小的进内圈，大的进外圈 —— 保证互不穿插
ITEMS.forEach((it) => {
  const box = new THREE.Box3().setFromObject(it.obj);
  const size = box.getSize(new THREE.Vector3());
  it.foot = Math.max(size.x, size.z);
});
ITEMS.sort((a, b) => a.foot - b.foot);

function placeRing(list, radius) {
  list.forEach((it, i) => {
    const a = (i / list.length) * Math.PI * 2;
    it.obj.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    it.obj.rotation.y = Math.atan2(it.obj.position.x, it.obj.position.z);  // 正面朝外
    it.obj.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    modelsGroup.add(it.obj);
  });
}
placeRing(ITEMS.slice(0, 17), 9.5);
placeRing(ITEMS.slice(17), 18);

// ---------------------------------------------------------------- 主题：三套，全部只用库里的东西
// 一个"主题"就是四行配置：surfaceMap（哪些道具换哪张皮）+ 天空色板 + 打光 + 后处理数值。
// 这三套的差别逐层递进：
//   黄昏 —— 什么都不换，内核 30 个表面原样用；
//   沙漠 —— 只加一个 surfaceMap（一行换皮 40 多个道具）；
//   深夜 —— surfaceMap 不动，只改光、雾、后处理。

const DESERT_MAP = {
  // 所有水泥/沥青 → 沙地；所有漆面 → 锈（颜色由 preset 的 tint 带过来，红桶还是红的）
  concrete: 'sand', concrete_dirty: 'sand', concrete_painted: 'mud',
  asphalt: 'sand', floor_epoxy: 'sand', brick: 'mud',
  paint_white: 'sand', paint_grey: 'mud',
  paint_red: 'rust', paint_blue: 'rust', paint_green: 'rust',
  paint_yellow: 'rust', paint_orange: 'rust', paint_teal: 'rust',
  steel_dark: 'rust', steel_worn: 'rust', corrugated: 'sand', corrugated_roof: 'mud',
  cardboard: 'tarp', diamond_plate: 'rust',
};

function makeAtmosphere({ palette, sunDir, sunColor, sunIntensity, hemi, hemiSky, hemiGround, shadowExtent = 24, lamp = null }) {
  const group = new THREE.Group();
  const dir = new THREE.Vector3(...sunDir).normalize();
  const sky = createSky(dir, palette);
  group.add(sky.mesh);

  const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
  sun.position.copy(dir).multiplyScalar(50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: 160,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  group.add(sun, sun.target, new THREE.HemisphereLight(hemiSky, hemiGround, hemi));

  if (lamp) {
    const p = new THREE.PointLight(lamp.color, lamp.intensity, lamp.distance, 1.7);
    p.position.set(...lamp.position);
    group.add(p);
  }

  return { group, env: bakeEnvironment(renderer, sky.mesh), envIntensity: 1.0 };
}

const ATMOS = {
  dusk: makeAtmosphere({
    palette: { zenith: 0x2a3742, horizon: 0xc08a54, sun: 0xffc48c, cloud: 0x77707a, fog: 0x9a7756 },
    sunDir: [-0.55, 0.35, 0.75], sunColor: 0xffd8b0, sunIntensity: 6.0,
    hemi: 0.55, hemiSky: 0x9db2c9, hemiGround: 0x3a2f24,
  }),
  desert: makeAtmosphere({
    palette: { zenith: 0x7fa6c4, horizon: 0xe2c9a0, sun: 0xfff2cf, cloud: 0xd9cdb8, fog: 0xd8c3a2 },
    sunDir: [-0.35, 0.62, 0.70], sunColor: 0xfff0d2, sunIntensity: 5.2,
    hemi: 0.85, hemiSky: 0xcfe0ea, hemiGround: 0xa8865e,
  }),
  night: makeAtmosphere({
    palette: { zenith: 0x05070b, horizon: 0x1a1d24, sun: 0x6f86ad, cloud: 0x0a0d12, fog: 0x14161c },
    sunDir: [0.15, 0.34, -0.93], sunColor: 0x9ab4d6, sunIntensity: 1.5,
    hemi: 0.35, hemiSky: 0x2a3442, hemiGround: 0x14100e,
    lamp: { color: 0xffb066, intensity: 90, distance: 34, position: [0, 5.5, 1] },
  }),
};

// 同一批共享几何：三件道具 + 三件设施 + 一个集装箱 + 一根灯杆
function buildCluster(materials, groundMaterial) {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const put = (obj, x, z, ry = 0) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    obj.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    group.add(obj);
    return obj;
  };

  put(createProp('barrel', { seed: 2, color: 'red', materials }), -3.4, -0.8, 0.2);
  put(createProp('crate_stack', { seed: 7, materials }), -1.9, -0.1, 0.15);
  put(createProp('ibc_tote', { seed: 4, materials }), -0.3, -0.9, -0.2);
  put(createProp('pallet_stack', { seed: 5, materials }), -4.6, 1.0, 0.4);
  put(createFixture('jersey_barrier', { seed: 1, materials }), 2.8, -0.2, 0.15);
  put(createFixture('shelf_rack', { seed: 3, materials }), -5.4, -3.0, 0.35);
  put(createFixture('light_mast', { seed: 3, materials }), 5.8, -3.2, 0);
  put(createContainer('container40', { seed: 3, color: 'blue', wear: 0.3, materials }), 0.6, -6.4, 0.08);
  put(createContainer('container20', { seed: 6, color: 'orange', wear: 0.35, materials }), -6.4, 4.6, 0.25);
  put(createProp('pipe_stack', { seed: 5, materials }), 0.4, 4.6, 0.1);
  put(createProp('forklift', { seed: 1, materials }), 5.4, 4.2, -0.4);

  return group;
}

const THEMES = [
  {
    id: 'dusk',
    label: '工业黄昏',
    note: '内核 30 个表面，原样用',
    materials: industrial,
    ground: () => createMaterial('concrete', { tile: 6, avg: AVG.concrete }),
    fog: [0x9a7756, 0.018],
    look: { exposure: 1.18, bloom: 0.3, vignette: 0.42, grain: 0.028, sat: 1.1 },
  },
  {
    id: 'desert',
    label: '沙漠',
    note: '只加一个 surfaceMap：一行换掉 40 多个道具的皮',
    materials: createMaterialStore({ createMaterial, averages: AVG, surfaceMap: DESERT_MAP }),
    ground: () => createMaterial('sand', { tile: 3.5, bump: 1.6, avg: AVG.sand }),
    fog: [0xd8c3a2, 0.012],
    look: { exposure: 1.05, bloom: 0.2, vignette: 0.3, grain: 0.018, sat: 1.06 },
  },
  {
    id: 'night',
    label: '深夜工地',
    note: '表面不动：只改光、雾、后处理',
    materials: industrial,
    ground: () => createMaterial('concrete', { tile: 6, avg: AVG.concrete }),
    fog: [0x14161c, 0.03],
    look: { exposure: 0.62, bloom: 0.24, vignette: 0.72, grain: 0.07, sat: 0.85 },
  },
];

THEMES.forEach((theme) => {
  theme.atmosphere = ATMOS[theme.id];
  theme.group = buildCluster(theme.materials, theme.ground());
  theme.group.visible = false;
  scene.add(theme.group);
  scene.add(theme.atmosphere.group);
  theme.atmosphere.group.visible = false;
});

// ---------------------------------------------------------------- 相机 / 交互
const view = { yaw: 0.55, pitch: 0.34, radius: 40, target: new THREE.Vector3(0, 1.4, 0) };
let camMode = 'front';
let tab = 'materials';
let activeTheme = 0;
let usePost = true;

function applyCamera() {
  if (camMode === 'front') {
    camera.fov = 34;
    camera.position.set(0, 0.15, 14.6);
    camera.lookAt(0, 0.1, 0);
  } else {
    camera.fov = 42;
    const { yaw, pitch, radius, target } = view;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * radius,
      target.y + Math.sin(pitch) * radius,
      target.z + Math.cos(yaw) * Math.cos(pitch) * radius,
    );
    camera.lookAt(target);
  }
  camera.updateProjectionMatrix();
}

let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (camMode === 'front') return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (tab === 'models') hoverAt(e.clientX, e.clientY);
  if (!dragging) return;
  view.yaw -= (e.clientX - lastX) * 0.005;
  view.pitch = Math.max(0.02, Math.min(0.9, view.pitch + (e.clientY - lastY) * 0.003));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  if (camMode === 'front') return;
  e.preventDefault();
  view.radius = Math.max(8, Math.min(70, view.radius * (1 + Math.sign(e.deltaY) * 0.08)));
}, { passive: false });

// ---------------------------------------------------------------- 环境切换
function applyAtmosphere() {
  if (tab === 'themes') {
    const theme = THEMES[activeTheme];
    scene.environment = theme.atmosphere.env;
    scene.environmentIntensity = theme.atmosphere.envIntensity;
    scene.fog.color.setHex(theme.fog[0]);
    scene.fog.density = theme.fog[1];
    setLook(post, theme.look);
  } else {
    scene.environment = studioEnv;
    scene.environmentIntensity = 1.1;
    scene.fog.color.setHex(STUDIO_PALETTE.fog);
    scene.fog.density = 0.006;
    setLook(post, { exposure: 1.12, bloom: 0.26, vignette: 0.3, grain: 0.014, sat: 1.04 });
  }
}

function setLook(p, look) {
  p.uniforms.uExposure.value = look.exposure;
  p.uniforms.uBloom.value = look.bloom;
  p.uniforms.uVignette.value = look.vignette;
  p.uniforms.uGrain.value = look.grain;
  p.uniforms.uSat.value = look.sat;
}

// ---------------------------------------------------------------- 标签层（材质墙）
const labelLayer = document.getElementById('labels');
const labels = NAMES.map((name) => {
  const div = document.createElement('div');
  div.textContent = name;
  labelLayer.appendChild(div);
  return div;
});

const projected = new THREE.Vector3();
function updateLabels() {
  for (let i = 0; i < labels.length; i++) {
    const m = wallMeshes[i];
    projected.set(m.position.x, m.position.y - 0.68, m.position.z).project(camera);
    const x = (projected.x * 0.5 + 0.5) * innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * innerHeight;
    labels[i].style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    labels[i].style.opacity = projected.z < 1 ? '1' : '0';
  }
}

// ---------------------------------------------------------------- 悬停（模型转台）
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const hud = document.getElementById('hud');
let hoverName = '';

function hoverAt(px, py) {
  pointer.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(modelsGroup.children, true);
  let name = '';
  for (const hit of hits) {
    let node = hit.object;
    while (node && !node.userData.ITEM) node = node.parent;
    if (node) { name = node.userData.ITEM; break; }
  }
  if (name !== hoverName) {
    hoverName = name;
    drawHud();
  }
}

function drawHud() {
  if (tab === 'materials') {
    hud.innerHTML = `<b>${NAMES.length}</b> 个程序化表面 / 0 张贴图<br>全部由 GLSL 实时求值`;
  } else if (tab === 'models') {
    hud.innerHTML = hoverName
      ? `<b>${hoverName}</b><br>${ITEMS.length} 个模型 · 原语拼装`
      : `<b>${ITEMS.length}</b> 个模型 · 无模型文件<br>鼠标悬停看名字 · 拖动旋转`;
  } else {
    hud.innerHTML = `<b>${ALL_SURFACES.length}</b> 个表面 · 同一批几何<br>三套主题，全部自己拼`;
  }
}

// ---------------------------------------------------------------- 面板 / 标签页
const panel = document.getElementById('panel');
const tabButtons = [...document.querySelectorAll('nav button[data-tab]')];
const postButton = document.getElementById('post');

function drawPanel() {
  if (tab === 'materials') {
    panel.innerHTML = `
      <h3>01 · 材质墙</h3>
      <p>30 个表面全部是 <code>surf(vec2 uv)</code> 函数，没有一个图片文件。
      世界空间投影 + 屏幕空间凹凸，所以同一张贴图贴在任意大小的墙上都不会拉伸。</p>`;
  } else if (tab === 'models') {
    panel.innerHTML = `
      <h3>02 · 模型转台</h3>
      <p>19 个道具 + 14 个设施，全部由 <code>PropBuilder</code> 用原语拼出来。
      每个模型自带 <code>userData.size</code> 与碰撞盒，可以直接放进关卡。</p>`;
  } else {
    panel.innerHTML = `
      <h3>03 · 主题 = 四行配置</h3>
      <p>桶、木箱、吨桶、货架、集装箱的几何一行没改。
      一个主题就是 <code>surfaceMap</code> + 天空色板 + 打光 + 后处理数值 —— 库里不提供现成主题，
      这三套全部只用内核那 30 个表面拼出来，你可以照着再拼第四套。</p>
      <div class="row">${THEMES.map((s, i) => `
        <button data-skin="${i}" class="${i === activeTheme ? 'on' : ''}">${s.label}</button>`).join('')}
      </div>`;
    panel.querySelectorAll('button[data-skin]').forEach((btn) => {
      btn.addEventListener('click', () => selectTheme(Number(btn.dataset.skin)));
    });
  }
}

function setTab(name) {
  tab = name;
  tabButtons.forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  materialsGroup.visible = name === 'materials';
  modelsGroup.visible = name === 'models';
  studio.visible = name !== 'themes';
  THEMES.forEach((s, i) => {
    s.group.visible = name === 'themes' && i === activeTheme;
    s.atmosphere.group.visible = name === 'themes' && i === activeTheme;
  });
  labelLayer.style.display = name === 'materials' ? 'block' : 'none';

  camMode = name === 'materials' ? 'front' : 'orbit';
  if (name === 'models') { view.radius = 35; view.pitch = 0.42; view.target.y = 1.0; }
  if (name === 'themes') { view.radius = 22; view.pitch = 0.26; view.target.y = 1.2; }
  applyCamera();
  applyAtmosphere();
  drawPanel();
  drawHud();
  if (name === 'materials') updateLabels();
}

function selectTheme(i) {
  activeTheme = i;
  THEMES.forEach((s, k) => {
    s.group.visible = k === i;
    s.atmosphere.group.visible = k === i;
  });
  applyAtmosphere();
  panel.querySelectorAll('button[data-skin]').forEach((btn) => {
    btn.classList.toggle('on', Number(btn.dataset.skin) === i);
  });
  drawHud();
}

tabButtons.forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
postButton.addEventListener('click', () => {
  usePost = !usePost;
  postButton.classList.toggle('on', usePost);
});

// ---------------------------------------------------------------- 循环
let time = 0;
let frames = 0;
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (camMode === 'orbit' && !dragging) view.yaw += dt * 0.05;
  applyCamera();
  if (tab === 'materials') updateLabels();

  post.uniforms.uTime.value = time;
  if (usePost) post.render(scene, camera, time);
  else renderer.render(scene, camera);

  if (++frames === 2) document.getElementById('boot')?.remove();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight);
  if (tab === 'materials') updateLabels();
});

setTab('materials');
applyCamera();
tick();

window.__showcase = {
  ready: true,
  materials: NAMES.length,
  models: ITEMS.length,
  themes: THEMES.length,
  surfaces: ALL_SURFACES.length,
};
