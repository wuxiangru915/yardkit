// 治愈主题包的模型：圆角大、细节少、颜色暖。全部走 PropBuilder + 现有图元，
// 尺寸按米，finish() 给出 size 与碰撞盒。
//
// 约定：
//   opts = { seed, materials, color }
//   color 走 kit 的 resolveColor（'white' | 'teal' | 'red' | ...），只影响「漆面」部件
//   材质名一律用 store 里已存在的 preset 名，包本身不新增材质名。
import { bevelBox, box, cyl, sphere, lathe, PropBuilder } from '../../src/geo.js';
import { scaledTorus, tubeSpan } from '../../src/propKit.js';
import { resolveColor } from '../../src/propUtils.js';
import { defaultMaterials } from '../../src/materials.js';

const WOOD = 'wood_pallet';
const DARK = 'wood_dark';
const CERAMIC = 'ceramic';
const LEAF = 'paint_green';
const WEAVE = 'cardboard';
const GLASS = 'glass';

const paintOf = (o) => resolveColor(o.color, 'white');

// 书脊配色（乘在「白漆」材质上，所以是顶点色而不是新材质）
const BOOK_TINTS = [
  [0.90, 0.46, 0.42], [0.54, 0.64, 0.76], [0.94, 0.86, 0.62], [0.58, 0.68, 0.52],
  [0.76, 0.60, 0.46], [0.48, 0.50, 0.60], [0.92, 0.74, 0.62], [0.68, 0.56, 0.66],
];

// —— 椅子 0.45 × 0.9 × 0.5 ——
function buildChair(mats, o) {
  const b = new PropBuilder(mats, 'cozy_chair', o.seed || 0);
  const [paint, mul] = paintOf(o);

  // 座垫（大倒角）+ 下面一圈木框
  b.add(paint, bevelBox(0.45, 0.06, 0.46, 0.026), { p: [0, 0.42, 0] }, mul);
  b.add(WOOD, bevelBox(0.43, 0.035, 0.44, 0.014), { p: [0, 0.375, 0] }, 0.96);

  // 四条腿：上粗下细、微微外撇
  for (const [x, z] of [[-0.175, -0.19], [0.175, -0.19], [-0.175, 0.19], [0.175, 0.19]]) {
    b.add(WOOD, tubeSpan([x * 1.08, 0, z * 1.08], [x * 0.9, 0.37, z * 0.9], 0.015, 7, true, 0.023), null, 0.94);
  }

  // 靠背：两根立柱 + 两条横档（后仰一点点）
  for (const x of [-0.175, 0.175]) {
    b.add(WOOD, tubeSpan([x, 0.42, -0.20], [x * 0.94, 0.9, -0.245], 0.017, 7, true, 0.021), null, 0.94);
  }
  for (const [y, w, z] of [[0.70, 0.40, -0.222], [0.845, 0.35, -0.238]]) {
    b.add(paint, bevelBox(w, 0.075, 0.034, 0.016), { p: [0, y, z], r: [-0.07, 0, 0] }, mul);
  }

  return b.finish({
    grime: 0.18,
    size: [0.45, 0.9, 0.5],
    colliders: [{ min: [-0.235, 0, -0.26], max: [0.235, 0.9, 0.24], surface: 'wood' }],
  });
}

// —— 桌子 1.2 × 0.75 × 0.8 ——
function buildTable(mats, o) {
  const b = new PropBuilder(mats, 'cozy_table', o.seed || 0);
  const [paint, mul] = paintOf(o);

  b.add(WOOD, bevelBox(1.2, 0.055, 0.8, 0.022), { p: [0, 0.722, 0] }, 1.0);
  // 桌面下的一圈裙板
  b.add(paint, bevelBox(1.08, 0.07, 0.68, 0.03), { p: [0, 0.665, 0] }, mul);
  // 四条小腿（上下等粗、只做大倒角）——比工业桌子少 4 根横撑
  for (const [x, z] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) {
    b.add(WOOD, tubeSpan([x * 1.05, 0, z * 1.1], [x, 0.64, z], 0.026, 8, true, 0.034), null, 0.93);
  }

  return b.finish({
    grime: 0.16,
    size: [1.2, 0.75, 0.8],
    colliders: [{ min: [-0.6, 0, -0.4], max: [0.6, 0.75, 0.4], surface: 'wood' }],
  });
}

// —— 茶杯（含碟）0.09 × 0.1 × 0.09 ——
function buildTeacup(mats, o) {
  const b = new PropBuilder(mats, 'cozy_teacup', o.seed || 0);
  const [, mul] = paintOf(o);

  // 碟子
  b.add(CERAMIC, lathe([[0.0, 0.0], [0.040, 0.0], [0.044, 0.004], [0.043, 0.008], [0.030, 0.008], [0.0, 0.006]], 20), null, mul);
  // 杯身（外壁 + 收进去的内壁，一个 lathe 就够）
  b.add(CERAMIC, lathe([
    [0.0, 0.006], [0.019, 0.006], [0.025, 0.014], [0.031, 0.050],
    [0.035, 0.090], [0.037, 0.098], [0.0345, 0.099], [0.031, 0.090],
    [0.025, 0.040], [0.015, 0.016], [0.0, 0.015],
  ], 20), null, mul);
  // 把手：一段圆弧
  b.add(CERAMIC, scaledTorus(0.017, 0.005, 5, 10, Math.PI * 1.35), { p: [0.036, 0.062, 0], r: [0, 0, -1.15] }, mul);
  // 咖啡/茶：一小片深色
  b.add(DARK, cyl(0.0305, 0.0305, 0.002, 18), { p: [0, 0.088, 0] }, 0.85);

  return b.finish({
    grime: 0.1,
    size: [0.09, 0.1, 0.09],
    colliders: [{ min: [-0.045, 0, -0.045], max: [0.045, 0.1, 0.045], surface: 'ceramic' }],
  });
}

// —— 书架 0.9 × 1.8 × 0.32 ——
function buildBookshelf(mats, o) {
  const b = new PropBuilder(mats, 'cozy_bookshelf', o.seed || 0);
  const rng = b.rng;
  const [paint, mul] = paintOf(o);

  // 两块侧板 + 顶/底板 + 背板
  for (const x of [-0.435, 0.435]) b.add(WOOD, bevelBox(0.03, 1.8, 0.32, 0.01), { p: [x, 0.9, 0] }, 0.96);
  for (const y of [0.015, 1.785]) b.add(WOOD, bevelBox(0.9, 0.03, 0.32, 0.01), { p: [0, y, 0] }, 1.0);
  b.add(paint, bevelBox(0.88, 1.78, 0.014, 0.006), { p: [0, 0.9, -0.152] }, mul);
  // 三层隔板
  for (const y of [0.46, 0.90, 1.34]) b.add(WOOD, bevelBox(0.84, 0.022, 0.30, 0.008), { p: [0, y, 0.004] }, 0.98);

  // 书：一排排歪歪扭扭的方块（颜色走顶点色）
  for (const y0 of [0.045, 0.475, 0.915]) {
    let x = -0.395;
    while (x < 0.36) {
      const w = rng.range(0.018, 0.042);
      const h = rng.range(0.18, 0.28);
      const d = rng.range(0.15, 0.21);
      const lean = rng() < 0.10 ? rng.range(-0.10, 0.10) : 0;
      b.add(paint, bevelBox(w, h, d, Math.min(0.006, w * 0.28)), {
        p: [x + w / 2, y0 + h / 2, 0.045], r: [0, 0, lean],
      }, rng.pick(BOOK_TINTS));
      x += w + rng.range(0.001, 0.005);
      if (rng() < 0.09) x += rng.range(0.02, 0.05);
    }
  }
  // 最上一层空着：平放两本、加一个小陶盆
  b.add(paint, bevelBox(0.24, 0.030, 0.17, 0.008), { p: [0.14, 1.372, 0.02], r: [0, 0.10, 0] }, BOOK_TINTS[2]);
  b.add(paint, bevelBox(0.21, 0.026, 0.15, 0.008), { p: [0.16, 1.400, 0.03], r: [0, -0.06, 0] }, BOOK_TINTS[5]);
  b.add(paint, lathe([[0.0, 0.0], [0.036, 0.0], [0.043, 0.006], [0.052, 0.088], [0.047, 0.098], [0.040, 0.090], [0.032, 0.012], [0.0, 0.010]], 14), { p: [-0.24, 1.355, 0.02] }, mul);
  for (const [dx, dz, r, s] of [[0.0, 0.0, 0.055, 1.18], [-0.035, 0.02, 0.042, 1.30], [0.03, -0.02, 0.045, 1.36]]) {
    b.add(LEAF, sphere(1, 8, 6, r, r * 0.85, r), { p: [-0.24 + dx, 1.46 + s * 0.02, 0.02 + dz] }, s);
  }

  return b.finish({
    grime: 0.16,
    size: [0.9, 1.8, 0.32],
    colliders: [{ min: [-0.45, 0, -0.16], max: [0.45, 1.8, 0.16], surface: 'wood' }],
  });
}

// —— 盆栽 0.4 × 0.7 × 0.4 ——
function buildPottedPlant(mats, o) {
  const b = new PropBuilder(mats, 'cozy_plant', o.seed || 0);
  const rng = b.rng;
  const [paint, mul] = paintOf(o);

  // 陶盆
  b.add(paint, lathe([
    [0.0, 0.0], [0.082, 0.0], [0.090, 0.005], [0.108, 0.175],
    [0.118, 0.20], [0.111, 0.215], [0.094, 0.205], [0.082, 0.024], [0.0, 0.02],
  ], 16), null, mul);
  // 土
  b.add(DARK, cyl(0.092, 0.092, 0.012, 14), { p: [0, 0.202, 0] }, 0.8);
  // 枝干
  b.add(DARK, tubeSpan([0, 0.19, 0], [-0.022, 0.42, 0.012], 0.010, 6, true, 0.006), null, 0.9);

  // 叶簇：一圈扁球，越靠上越亮（尺寸按 0.4×0.7×0.4 的包围盒排）
  const clusters = [
    [0.000, 0.440, 0.000, 0.135, 0.115, 0.130, 1.24],
    [-0.115, 0.335, 0.055, 0.085, 0.072, 0.082, 1.14],
    [0.105, 0.355, -0.060, 0.088, 0.075, 0.085, 1.18],
    [0.055, 0.455, 0.105, 0.078, 0.068, 0.095, 1.28],
    [-0.090, 0.470, -0.100, 0.076, 0.066, 0.095, 1.27],
    [0.000, 0.585, 0.010, 0.090, 0.078, 0.088, 1.34],
    [-0.040, 0.640, -0.030, 0.062, 0.058, 0.060, 1.38],
  ];
  for (const [x, y, z, rx, ry, rz, shade] of clusters) {
    b.add(LEAF, sphere(1, 9, 7, rx, ry, rz), { p: [x, y, z], r: [0, rng() * 3.14, rng() * 0.3] }, shade);
  }

  return b.finish({
    grime: 0.14,
    size: [0.4, 0.7, 0.4],
    colliders: [{ min: [-0.13, 0, -0.13], max: [0.13, 0.23, 0.13], surface: 'ceramic' }],
  });
}

// —— 地毯 1.8 × 0.02 × 1.2 ——
function buildRug(mats, o) {
  const b = new PropBuilder(mats, 'cozy_rug', o.seed || 0);

  // 毯面（浅边）+ 内场（陶土色）+ 两端流苏，全靠顶点色，不靠贴图
  b.add(WEAVE, bevelBox(1.8, 0.014, 1.2, 0.006), { p: [0, 0.007, 0] }, [0.88, 0.86, 0.84]);
  b.add(WEAVE, bevelBox(1.66, 0.006, 1.06, 0.003), { p: [0, 0.014, 0] }, [1.04, 0.76, 0.66]);
  // 两端的小流苏
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = -0.5 + i * 0.125;
      b.add(WEAVE, bevelBox(0.03, 0.006, 0.022, 0.002), { p: [sx * 0.912, 0.006, z] }, 1.03);
    }
  }

  return b.finish({
    grime: 0,
    size: [1.8, 0.02, 1.2],
    colliders: [{ min: [-0.91, 0, -0.6], max: [0.91, 0.02, 0.6], surface: 'fabric' }],
  });
}

// —— 灯笼 0.3 × 0.45 × 0.3 ——
function buildLantern(mats, o) {
  const b = new PropBuilder(mats, 'cozy_lantern', o.seed || 0);
  const [paint, mul] = paintOf(o);

  // 底座 + 顶盖（盖沿比身子宽一圈，像一顶草帽）
  b.add(paint, cyl(0.092, 0.108, 0.024, 16), { p: [0, 0.012, 0] }, mul);
  b.add(paint, cyl(0.010, 0.148, 0.085, 16), { p: [0, 0.325, 0] }, mul);
  b.add(paint, cyl(0.022, 0.014, 0.030, 12), { p: [0, 0.378, 0] }, mul);
  // 四根立柱
  for (const [x, z] of [[-0.078, -0.078], [0.078, -0.078], [-0.078, 0.078], [0.078, 0.078]]) {
    b.add(paint, bevelBox(0.016, 0.245, 0.016, 0.005), { p: [x, 0.150, z] }, mul);
  }
  // 玻璃：四片（用薄板而不是一个方盒，免得看到内壁）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.add(GLASS, box(0.140, 0.215, 0.004), { p: [Math.sin(a) * 0.074, 0.150, Math.cos(a) * 0.074], r: [0, a, 0] }, 1, { raw: true, cast: false });
  }
  // 灯芯（发光，交给后处理的 bloom）
  b.add(mats.emissive(0xffcf95, 2.4), sphere(0.030, 8, 6, 1, 1.35, 1), { p: [0, 0.120, 0] }, 1, { raw: true, cast: false });
  // 提手
  b.add(paint, scaledTorus(0.048, 0.007, 5, 12, Math.PI * 1.6), { p: [0, 0.396, 0] }, mul);

  return b.finish({
    grime: 0.12,
    size: [0.3, 0.45, 0.3],
    colliders: [{ min: [-0.15, 0, -0.15], max: [0.15, 0.42, 0.15], surface: 'metal' }],
  });
}

// —— 篱笆 1.8 × 1.1 × 0.08 ——
function buildFence(mats, o) {
  const b = new PropBuilder(mats, 'cozy_fence', o.seed || 0);
  const rng = b.rng;
  const [paint, mul] = paintOf(o);

  // 两根柱子（顶上一个小小的圆帽）
  for (const x of [-0.87, 0.87]) {
    b.add(WOOD, bevelBox(0.075, 1.1, 0.075, 0.018), { p: [x, 0.55, 0] }, 0.95);
    b.add(WOOD, sphere(0.043, 10, 8, 1, 0.7, 1), { p: [x, 1.1, 0] }, 1.02);
  }
  // 两根横档
  for (const y of [0.34, 0.82]) b.add(WOOD, bevelBox(1.72, 0.07, 0.028, 0.012), { p: [0, y, 0] }, 0.98);

  // 竖板条：等距、顶上一个圆头
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = -0.72 + (i * 1.44) / (n - 1);
    const h = 0.84 + rng.range(-0.03, 0.03);
    b.add(paint, bevelBox(0.062, h, 0.022, 0.011), { p: [x, 0.09 + h / 2, 0.022] }, mul);
    b.add(paint, cyl(0.031, 0.031, 0.022, 10), { p: [x, 0.09 + h, 0.022], r: [Math.PI / 2, 0, 0] }, mul);
  }

  return b.finish({
    grime: 0.18,
    size: [1.8, 1.1, 0.08],
    colliders: [{ min: [-0.9, 0, -0.05], max: [0.9, 1.1, 0.05], surface: 'wood' }],
  });
}

const BUILDERS = {
  chair: buildChair,
  table: buildTable,
  teacup: buildTeacup,
  bookshelf: buildBookshelf,
  potted_plant: buildPottedPlant,
  rug: buildRug,
  lantern: buildLantern,
  fence: buildFence,
};

export const COZY_MODEL_NAMES = Object.keys(BUILDERS);

export function createCozyModel(name, opts = {}) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`[yardkit/cozy] unknown model "${name}"`);
  return build(opts.materials || defaultMaterials, opts);
}

// 名字更像「模型」的别名，方便 demo 里按 createChair() 这样调用
export const createChair = (o = {}) => createCozyModel('chair', o);
export const createTable = (o = {}) => createCozyModel('table', o);
export const createTeacup = (o = {}) => createCozyModel('teacup', o);
export const createBookshelf = (o = {}) => createCozyModel('bookshelf', o);
export const createPottedPlant = (o = {}) => createCozyModel('potted_plant', o);
export const createRug = (o = {}) => createCozyModel('rug', o);
export const createLantern = (o = {}) => createCozyModel('lantern', o);
export const createFence = (o = {}) => createCozyModel('fence', o);
