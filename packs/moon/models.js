// 月球包的 5 个新模型：气闸 / 月球车 / 太阳能阵列 / 居住舱 / 旗。
// 零贴图、零外部素材，全部用图元拼；材质只写 store 里的名字，由月球包的 surfaceMap
// 重映射到月面表面（solar_panel → solar，漆面 → paint 等）。
import * as THREE from 'three';
import { PropBuilder, box, bevelBox, cyl, sphere, lathe } from '../../src/geo.js';
import { HALF_PI, boxSpan, scaledTorus, tubeSpan } from '../../src/propKit.js';
import { defaultMaterials } from '../../src/materials.js';

// 材质名（store 里的 key）
const M = {
  hull: 'paint_white',   // 白漆舱体
  panel: 'aluminium',    // 铝板 / 加强环
  frame: 'steel_galv',   // 支架 / 杆件
  bright: 'paint_white', // 真空里金属会发黑，支架用漆面才看得见形状
  grey: 'paint_grey',    // 涂料灰：比金属亮，做腿/管/箱
  dark: 'steel_dark',    // 底架 / 灯座
  plate: 'diamond_plate',// 踏面 / 垫板
  tire: 'rubber',        // 轮胎 / 密封垫
  glass: 'glass',        // 舷窗
  solar: 'solar_panel',  // 太阳能板（月球包映射到 solar 表面）
  cloth: 'paint_white',  // 旗面
};
const AMBER = 0xff8a3d;

// ---------------------------------------------------------------------------
// 气闸：基座 + 圆筒 + 穹顶 + 门框/门板/舷窗/转轮 + 3 级台阶 + 警示灯
export function createAirlock(opts = {}) {
  const mats = opts.materials || defaultMaterials;
  const b = new PropBuilder(mats, 'airlock', opts.seed ?? 11);
  const R = 1.2;           // 筒体半径
  const sill = 0.42;       // 门槛高（人抬腿上车的高度）
  const bodyH = 2.5;
  const topY = 0.16 + bodyH;
  const dw = 1.0, dh = 1.95;      // 门洞
  const cy = sill + dh / 2;
  const zf = R - 0.03;            // 门面：略陷进筒壁

  // 基座 + 筒身 + 穹顶
  b.add(M.plate, cyl(R + 0.24, R + 0.34, 0.16, 24, false, 'bottom'), null, 0.85);
  b.add(M.hull, cyl(R, R, bodyH, 24, false, 'bottom'), { p: [0, 0.16, 0] }, 1);
  b.add(M.hull, lathe([[R, 0], [R * 0.97, 0.16], [R * 0.8, 0.3], [R * 0.5, 0.4], [0, 0.45]], 24),
    { p: [0, topY, 0] }, 0.97);

  // 两道加强环 + 4 根竖向加强筋
  for (const y of [1.02, 1.98]) {
    b.add(M.panel, cyl(R + 0.045, R + 0.045, 0.085, 24, true), { p: [0, y, 0] }, 0.94);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * HALF_PI + 0.79;
    b.add(M.panel, box(0.09, bodyH - 0.2, 0.06),
      { p: [Math.sin(a) * (R - 0.01), 0.16 + bodyH / 2, Math.cos(a) * (R - 0.01)], r: [0, a, 0] }, 0.9);
  }

  // 门框（上梁 + 两根立柱）
  b.add(M.frame, bevelBox(dw + 0.26, 0.13, 0.2, 0.02), { p: [0, sill + dh + 0.065, zf] }, 0.95);
  for (const s of [-1, 1]) {
    b.add(M.frame, bevelBox(0.13, dh, 0.2, 0.02), { p: [s * (dw + 0.065), cy, zf] }, 0.95);
    b.add(M.dark, bevelBox(0.06, 0.16, 0.05, 0.01), { p: [s * (dw / 2 + 0.04), cy + 0.62, zf + 0.05] }, 0.7);
  }

  // 门板 + 舷窗 + 转轮 + 键盘
  b.add(M.hull, bevelBox(dw, dh, 0.08, 0.03), { p: [0, cy, zf - 0.05] }, 0.97);
  b.add(M.dark, cyl(0.235, 0.235, 0.05, 16), { p: [0, cy + 0.36, zf - 0.005], r: [HALF_PI, 0, 0] }, 0.85);
  b.add(M.glass, cyl(0.2, 0.2, 0.03, 16), { p: [0, cy + 0.36, zf + 0.015], r: [HALF_PI, 0, 0] }, 1);
  b.add(M.frame, scaledTorus(0.16, 0.022, 6, 14), { p: [0, cy - 0.52, zf + 0.02] }, 0.95);
  for (let i = 0; i < 3; i++) {
    b.add(M.frame, box(0.3, 0.02, 0.02), { p: [0, cy - 0.52, zf + 0.02], r: [0, 0, i * (Math.PI / 3)] }, 0.9);
  }
  b.add(M.dark, bevelBox(0.16, 0.22, 0.07, 0.01), { p: [dw / 2 + 0.2, cy + 0.18, zf + 0.03] }, 0.8);
  for (let i = 0; i < 3; i++) {
    b.add(mats.emissive(0x63d7ff, 1.6), box(0.08, 0.012, 0.012),
      { p: [dw / 2 + 0.2, cy + 0.1 + i * 0.05, zf + 0.07] }, 1, { raw: true, cast: false });
  }

  // 警示灯：门楣一盏 + 穹顶旋转灯
  b.add(M.dark, bevelBox(0.24, 0.12, 0.18, 0.02), { p: [0, sill + dh + 0.2, zf + 0.06] }, 0.8);
  b.add(mats.emissive(AMBER, 2.2), box(0.17, 0.07, 0.1), { p: [0, sill + dh + 0.2, zf + 0.13] }, 1, { raw: true, cast: false });
  b.add(M.dark, cyl(0.13, 0.15, 0.09, 12), { p: [0, topY + 0.42, 0] }, 0.8);
  b.add(mats.emissive(AMBER, 2.6), sphere(0.105, 12, 8), { p: [0, topY + 0.53, 0] }, 1, { raw: true, cast: false });

  // 3 级台阶 + 两侧斜梁
  for (let i = 0; i < 3; i++) {
    b.add(M.plate, bevelBox(1.1, 0.055, 0.32, 0.015), { p: [0, sill - 0.03 - i * 0.14, R + 0.38 + i * 0.32] }, 0.92);
  }
  for (const s of [-1, 1]) {
    b.add(M.dark, boxSpan([s * 0.62, 0.01, R + 1.36], [s * 0.62, sill - 0.01, R + 0.2], 0.05, 0.14), null, 0.85);
  }

  return b.finish({
    grime: 0.5,
    surface: 'metal',
    size: [3.1, 3.35, 4.15],
    colliders: [
      { min: [-R - 0.34, 0, -R - 0.34], max: [R + 0.34, 3.2, R + 0.34], surface: 'metal' },
      { min: [-0.62, 0, R], max: [0.62, 0.45, R + 1.4], surface: 'metal' },
    ],
  });
}

// 轮子：轮轴沿 Z，胎面带小块（4 个轮子共用）
function addWheel(b, x, y, z, r = 0.42, w = 0.3, treads = 9) {
  const rot = [HALF_PI, 0, 0];
  b.add(M.tire, cyl(r, r, w, 14), { p: [x, y, z], r: rot }, 0.93);
  b.add(M.frame, cyl(r * 0.46, r * 0.46, w + 0.03, 10), { p: [x, y, z], r: rot }, 0.9);
  b.add(M.dark, cyl(r * 0.15, r * 0.15, w + 0.07, 8), { p: [x, y, z], r: rot }, 0.7);
  for (let i = 0; i < treads; i++) {
    const a = (i / treads) * Math.PI * 2;
    b.add(M.tire, box(0.11, 0.045, w * 0.94),
      { p: [x + Math.cos(a) * (r - 0.005), y + Math.sin(a) * (r - 0.005), z], r: [0, 0, a] }, 0.87);
  }
}

// ---------------------------------------------------------------------------
// 月球车：底盘 + 4 轮 + 座椅 + 小太阳能板 + 天线
export function createRover(opts = {}) {
  const mats = opts.materials || defaultMaterials;
  const b = new PropBuilder(mats, 'rover', opts.seed ?? 5);
  const r = 0.42;             // 轮半径
  const axle = 0.86;          // 半轴距 / 半轮距

  // 车架：两根纵梁 + 两道横梁 + 甲板
  for (const s of [-1, 1]) b.add(M.dark, bevelBox(2.5, 0.16, 0.16, 0.02), { p: [0, 0.66, s * 0.5] }, 0.7);
  for (const x of [-axle, axle]) b.add(M.dark, bevelBox(0.14, 0.12, 1.12, 0.02), { p: [x, 0.66, 0] }, 0.7);
  b.add(M.plate, bevelBox(2.34, 0.06, 1.12, 0.012), { p: [0, 0.76, 0] }, 0.9);

  // 4 个轮 + 摆臂
  for (const x of [-axle, axle]) {
    for (const s of [-1, 1]) {
      b.add(M.frame, boxSpan([x, 0.62, s * 0.42], [x, r, s * 0.82], 0.09, 0.09), null, 0.85);
      addWheel(b, x, r, s * axle, r, 0.3, 9);
    }
  }

  // 前部设备箱 + 控制台
  b.add(M.hull, bevelBox(0.95, 0.34, 1.02, 0.05), { p: [0.72, 0.97, 0] }, 1);
  b.add(M.dark, bevelBox(0.56, 0.06, 0.78, 0.015), { p: [0.64, 1.17, 0], r: [0, 0, -0.28] }, 0.8);
  for (const s of [-1, 1]) {
    b.add(mats.emissive(0x9fe8c0, 1.4), box(0.1, 0.012, 0.06), { p: [0.6, 1.2, s * 0.16], r: [0, 0, -0.28] }, 1, { raw: true, cast: false });
  }
  b.add(M.frame, tubeSpan([0.72, 1.2, 0.34], [0.72, 1.34, 0.34], 0.014, 6, true), null, 0.9);  // 操纵杆

  // 座椅（底垫 + 靠背 + 两侧扶手）
  b.add(M.dark, bevelBox(0.66, 0.14, 0.58, 0.03), { p: [-0.62, 0.87, 0] }, 0.8);
  b.add(M.tire, box(0.58, 0.07, 0.5), { p: [-0.62, 0.97, 0] }, 1);
  b.add(M.tire, box(0.12, 0.6, 0.5), { p: [-0.94, 1.24, 0], r: [0, 0, -0.18] }, 1);
  for (const s of [-1, 1]) {
    b.add(M.frame, boxSpan([-0.58, 0.8, s * 0.3], [-0.92, 1.08, s * 0.3], 0.04, 0.04), null, 0.8);
  }

  // 座椅后的小太阳能板 + 支撑
  b.add(M.solar, bevelBox(0.92, 0.045, 0.86, 0.01), { p: [-0.7, 1.62, 0], r: [0.34, 0, 0] }, 1);
  for (const s of [-1, 1]) {
    b.add(M.frame, boxSpan([-0.7, 1.02, s * 0.3], [-0.7, 1.52, s * 0.26], 0.05, 0.05), null, 0.85);
  }

  // 天线：桅杆 + 小抛物面 + 鞭状天线
  b.add(M.frame, cyl(0.022, 0.028, 1.1, 8, false, 'bottom'), { p: [-1.12, 0.82, 0.34] }, 0.9);
  b.add(M.frame, cyl(0.02, 0.17, 0.14, 12, true), { p: [-1.12, 1.92, 0.34], r: [0.55, 0, 0] }, 0.85);
  b.add(M.panel, cyl(0.006, 0.012, 0.55, 6, false, 'bottom'), { p: [-1.12, 1.92, 0.34] }, 0.8);

  // 前保险杠 + 两只头灯
  b.add(M.frame, bevelBox(0.1, 0.14, 1.0, 0.03), { p: [1.3, 0.72, 0] }, 0.9);
  for (const s of [-1, 1]) {
    b.add(M.dark, bevelBox(0.09, 0.11, 0.22, 0.02), { p: [1.26, 0.95, s * 0.34] }, 0.8);
    b.add(mats.emissive(0xfff0d0, 1.6), box(0.03, 0.06, 0.16), { p: [1.31, 0.95, s * 0.34] }, 1, { raw: true, cast: false });
  }

  return b.finish({
    grime: 0.5,
    surface: 'metal',
    size: [2.7, 2.55, 2.1],
    colliders: [
      { min: [-1.31, 0, -0.62], max: [1.35, 1.35, 0.62], surface: 'metal' },
      { min: [-1.02, 0, -1.02], max: [-0.7, 0.85, 1.02], surface: 'rubber' },
      { min: [0.7, 0, -1.02], max: [1.02, 0.85, 1.02], surface: 'rubber' },
    ],
  });
}

// ---------------------------------------------------------------------------
// 太阳能阵列：3 块倾斜板 + A 字支架 + 汇流箱
export function createSolarArray(opts = {}) {
  const mats = opts.materials || defaultMaterials;
  const b = new PropBuilder(mats, 'solar_array', opts.seed ?? 9);
  const tilt = 0.62;          // 约 35°：月面太阳低，板要立起来
  const pw = 2.3, pd = 1.9;   // 单块板尺寸
  const py = 1.05;            // 板中心高
  // 板面下方的点：本地 (0, -0.02, lz) 经倾斜后的世界坐标
  const under = (x, lz) => [x, py - 0.02 * Math.cos(tilt) - lz * Math.sin(tilt), -0.02 * Math.sin(tilt) + lz * Math.cos(tilt)];

  for (const x of [-2.5, 0, 2.5]) {
    b.push({ p: [x, py, 0], r: [tilt, 0, 0] });
    b.add(M.solar, box(pw - 0.08, 0.045, pd - 0.08), null, 1);
    for (const s of [-1, 1]) {
      b.add(M.bright, bevelBox(pw, 0.075, 0.075, 0.012), { p: [0, 0.02, s * (pd / 2 - 0.037)] }, 0.95);
      b.add(M.bright, bevelBox(0.075, 0.075, pd, 0.012), { p: [s * (pw / 2 - 0.037), 0.02, 0] }, 0.95);
      b.add(M.grey, box(pw - 0.2, 0.05, 0.06), { p: [0, -0.05, s * 0.55] }, 0.8);
    }
    b.pop();
    // 前后两对 A 字腿 + 垫板
    for (const lz of [-0.62, 0.62]) {
      const u = under(x, lz);
      for (const s of [-1, 1]) {
        b.add(M.grey, boxSpan([x + s * 0.42, 0.03, u[2] + 0.16], u, 0.07, 0.07), null, 0.9);
        b.add(M.dark, bevelBox(0.3, 0.05, 0.3, 0.01), { p: [x + s * 0.42, 0.025, u[2] + 0.16] }, 0.8);
      }
    }
  }

  // 汇流管 + 汇流箱
  b.add(M.grey, tubeSpan([-3.85, 0.62, 0.62], [3.85, 0.62, 0.62], 0.055, 8), null, 0.75);
  b.add(M.grey, bevelBox(0.42, 0.46, 0.28, 0.03), { p: [0, 0.23, 1.32] }, 0.8);
  b.add(mats.emissive(0x7fe3a0, 1.2), box(0.05, 0.05, 0.012), { p: [0.13, 0.33, 1.465] }, 1, { raw: true, cast: false });

  return b.finish({
    grime: 0.45,
    surface: 'metal',
    size: [7.7, 1.65, 2.25],
    colliders: [
      { min: [-3.75, 0, -0.78], max: [3.75, 1.6, 0.78], surface: 'metal' },
      { min: [-0.25, 0, 1.05], max: [0.25, 0.5, 1.47], surface: 'metal' },
    ],
  });
}

// ---------------------------------------------------------------------------
// 居住舱：带肋圆筒 + 舷窗 + 对接环（轴向沿 X）
export function createHabitat(opts = {}) {
  const mats = opts.materials || defaultMaterials;
  const b = new PropBuilder(mats, 'habitat', opts.seed ?? 4);
  const R = 1.05, L = 7.0, cy = 1.42;

  // 底橇 + 3 个鞍座
  for (const s of [-1, 1]) b.add(M.dark, bevelBox(4.8, 0.16, 0.3, 0.02), { p: [0, 0.08, s * 0.56] }, 0.8);
  for (const x of [-2.4, 0, 2.4]) b.add(M.frame, bevelBox(0.34, 0.32, 1.5, 0.03), { p: [x, 0.26, 0] }, 0.85);

  // 筒身 + 两端穹顶
  b.add(M.hull, cyl(R, R, L, 22), { p: [0, cy, 0], r: [0, 0, HALF_PI] }, 1);
  for (const s of [-1, 1]) {
    b.add(M.hull, lathe([[R, 0], [R * 0.97, 0.16], [R * 0.82, 0.3], [R * 0.55, 0.4], [0, 0.46]], 22),
      { p: [s * (L / 2 - 0.02), cy, 0], r: [0, 0, s * -HALF_PI] }, 0.98);
  }

  // 12 道加强肋
  for (let i = 0; i < 12; i++) {
    b.add(M.panel, cyl(R + 0.045, R + 0.045, 0.07, 22, true), { p: [-3.02 + i * 0.55, cy, 0], r: [0, 0, HALF_PI] }, 0.94);
  }

  // 两侧各 4 个舷窗
  for (const s of [-1, 1]) {
    for (const x of [-2.3, -0.75, 0.8, 2.35]) {
      b.add(M.panel, cyl(0.22, 0.22, 0.1, 14), { p: [x, cy + 0.1, s * (R - 0.02)], r: [HALF_PI, 0, 0] }, 0.95);
      b.add(M.glass, cyl(0.165, 0.165, 0.04, 14), { p: [x, cy + 0.1, s * (R + 0.03)], r: [HALF_PI, 0, 0] }, 1);
    }
  }

  // +X 端对接环：环 + 舱门 + 一圈螺栓
  b.add(M.frame, cyl(0.62, 0.62, 0.22, 18, true), { p: [L / 2 + 0.36, cy, 0], r: [0, 0, -HALF_PI] }, 0.95);
  b.add(M.dark, cyl(0.56, 0.56, 0.05, 18), { p: [L / 2 + 0.46, cy, 0], r: [0, 0, -HALF_PI] }, 0.7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.add(M.frame, cyl(0.028, 0.028, 0.05, 6),
      { p: [L / 2 + 0.48, cy + Math.sin(a) * 0.52, Math.cos(a) * 0.52], r: [0, 0, -HALF_PI] }, 0.85);
  }

  // 顶部舱门 + 两侧扶手
  b.add(M.panel, cyl(0.42, 0.46, 0.12, 16), { p: [1.6, cy + R - 0.02, 0] }, 0.95);
  b.add(M.dark, cyl(0.2, 0.2, 0.03, 12), { p: [1.6, cy + R + 0.05, 0] }, 0.7);
  for (const s of [-1, 1]) {
    b.add(M.frame, tubeSpan([1.9, cy + R - 0.06, s * 0.34], [1.9, cy + R + 0.2, s * 0.34], 0.022, 6, true), null, 0.85);
  }

  return b.finish({
    grime: 0.45,
    surface: 'metal',
    size: [8.0, 2.7, 2.2],
    colliders: [
      { min: [-3.5, 0, -1.05], max: [3.5, 2.5, 1.05], surface: 'metal' },
      { min: [3.5, 0, -0.65], max: [4.0, 2.1, 0.65], surface: 'metal' },
    ],
  });
}

// 旗面：低模网格，顶边挂杆、越往下起伏越大（月面没风，只是布挂着的形状）
function clothGeo(w, h, uSeg = 12, vSeg = 5, phase = 0) {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= vSeg; j++) {
    const v = j / vSeg;                       // 0 = 底边，1 = 顶边
    for (let i = 0; i <= uSeg; i++) {
      const u = i / uSeg;
      const sag = 0.04 * Math.sin(Math.PI * u) * (1 - v);                                  // 下沿下垂
      const wave = 0.07 * Math.sin(u * 5.4 + phase) * (1 - v) * (1 - v)
        + 0.02 * Math.sin(u * 11 + phase * 2) * (1 - v);                                  // 轻微起伏
      pos.push(u * w, -h * (1 - v) - sag, wave);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < vSeg; j++) {
    for (let i = 0; i < uSeg; i++) {
      const a = j * (uSeg + 1) + i, c = a + 1, d = a + uSeg + 1, e = d + 1;
      idx.push(a, c, d, c, e, d);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// 旗：底座 + 旗杆 + 顶部横杆 + 低模布面
export function createFlag(opts = {}) {
  const mats = opts.materials || defaultMaterials;
  const b = new PropBuilder(mats, 'flag', opts.seed ?? 3);
  const H = 3.0;              // 杆高（含底座）
  const cw = 1.42, ch = 0.9;  // 布面
  const topY = H + 0.16;      // 横杆高度

  // 底座：垫板 + 配重块，杆脚有 3 根斜撑（真空里金属发黑，杆用漆面才看得见）
  b.add(M.plate, cyl(0.26, 0.32, 0.1, 14, false, 'bottom'), null, 0.8);
  b.add(M.dark, cyl(0.1, 0.13, 0.16, 12, false, 'bottom'), { p: [0, 0.1, 0] }, 0.85);
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + 0.4;
    b.add(M.grey, boxSpan([0, 0.06, 0], [Math.cos(a) * 0.42, 0.62, Math.sin(a) * 0.42], 0.035, 0.035), null, 0.85);
  }

  // 旗杆（略锥）+ 顶球
  b.add(M.bright, cyl(0.026, 0.04, H - 0.16, 12, false, 'bottom'), { p: [0, 0.16, 0] }, 0.95);
  b.add(M.grey, sphere(0.05, 10, 8), { p: [0, topY + 0.06, 0] }, 1);

  // 顶部横杆：让布面在真空里也能展开
  b.add(M.bright, tubeSpan([0, topY, 0], [cw + 0.06, topY, 0], 0.017, 8, true, 0.012), null, 0.95);

  // 布面（双面材质，薄片）：左侧三分之一染红，读起来更像一面旗
  const cloth = b.mats.get(M.cloth, { vertexColors: true, doubleSide: true });
  b.add(cloth, clothGeo(cw, ch, 12, 5, (opts.seed ?? 3) * 0.7), { p: [0.04, topY - 0.01, 0] },
    (x) => (x < 0.52 ? [0.62, 0.11, 0.1] : [0.96, 0.96, 0.95]));

  return b.finish({
    grime: 0.15,
    surface: 'fabric',
    size: [1.85, 3.3, 0.75],
    colliders: [
      { min: [-0.1, 0, -0.1], max: [0.1, topY, 0.1], surface: 'metal' },
      { min: [-0.32, 0, -0.32], max: [0.32, 0.2, 0.32], surface: 'metal' },
    ],
  });
}

// ---------------------------------------------------------------------------
export const MOON_MODEL_NAMES = ['airlock', 'rover', 'solar_array', 'habitat', 'flag'];

const FACTORIES = {
  airlock: createAirlock,
  rover: createRover,
  solar_array: createSolarArray,
  habitat: createHabitat,
  flag: createFlag,
};

export function createMoonModel(name, opts = {}) {
  const f = FACTORIES[name];
  if (!f) throw new Error(`[yardkit/moon] unknown model "${name}"`);
  return f(opts);
}
