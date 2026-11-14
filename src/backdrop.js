// 从 Saltline 的 Rw()（远景天际线）、kw()（backdrop 总装）与 bw()（灯组批次）抽取。
//   Rw()  → createSkyline()   港口对岸的低模天际线：仓库楼群 / 筒仓 / 塔吊 / 栈桥 / 堆场 / 灯塔
//   bw()  → createLamps()     灯组：光点闪烁批次（灯杆 / 泛光灯 / 警示灯）
//   kw()  → createBackdrop()  backdrop 总装：boat + crane + ship + skyline + lamps + gulls 的组合与动画
// 原函数的批处理 ho()、噪声 au()/Wl()、天气色 Cv()、颜色比例 Ng()、随机 Rv() 都在本文件里做忠实本地实现
// （它们和 geo.js 里的同名 helper 数值实现不同，混用会改变原游戏的顶点色/随机分布）。
import * as THREE from 'three';
import {
  MeshBatcher,
  applyVertexColor,
  beacon,
  beamBetween,
  cylAxis,
  mergeGeos,
  parabolaPoints,
  pipeBetween,
  pipeChain,
  railing,
  rangeBox,
  smoothstep,
} from './geo.js';
import { defaultMaterials } from './materials.js';
import { createBoat, createCrane, createDistantCrane, createSeagulls, createShip } from './vehicles.js';

// ============================================================================
// 1. Saltline 的随机 / 噪声 / 颜色 helper（Rv / Wl / au / Cv / Ng）
// ============================================================================

// Rv(n) 线性同余；与 geo.js 的 mulberry32 createRng 不是同一条序列
function lcgRng(seed) {
  let e = seed >>> 0;
  return () => ((e = (Math.imul(e, 1664525) + 1013904223) >>> 0), e / 4294967296);
}

// Wl(n, e, t)
function hashWl(x, y, z) {
  let i = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  i = Math.imul(i ^ (i >>> 13), 1274126177);
  return ((i ^ (i >>> 16)) >>> 0) / 4294967295;
}

// au(n, e, t) 三线性噪声
function noiseAu(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(
      lerp(hashWl(ix, iy, iz), hashWl(ix + 1, iy, iz), fx),
      lerp(hashWl(ix, iy + 1, iz), hashWl(ix + 1, iy + 1, iz), fx),
      fy
    ),
    lerp(
      lerp(hashWl(ix, iy, iz + 1), hashWl(ix + 1, iy, iz + 1), fx),
      lerp(hashWl(ix, iy + 1, iz + 1), hashWl(ix + 1, iy + 1, iz + 1), fx),
      fy
    ),
    fz
  );
}

const WHITE = [1, 1, 1];

// Cv(n, e, t, i, s)：世界空间天气/锈迹色
function weatherTintCv(x, y, z, base = WHITE, strength = 1) {
  const n1 = noiseAu(x * 0.31 + 11.3, y * 0.23 + 5.1, z * 0.31 + 3.7);
  const n2 = noiseAu(x * 1.7 + 40.2, 9.5, z * 1.7 + 17.9);
  const a = 1 - strength * (0.3 - 0.36 * n1);
  let r = base[0] * a, g = base[1] * a, b = base[2] * a;
  if (n2 > 0.68) {
    const f = Math.min(1, (n2 - 0.68) / 0.3) * 0.6 * strength * (0.35 + 0.65 * noiseAu(x * 0.9, y * 0.45, z * 0.9));
    r *= 1 + 0.45 * f;
    g *= 1 - 0.3 * f;
    b *= 1 - 0.6 * f;
  }
  return [r, g, b];
}

// Ng(n, e = 1)：按参考色（0xB9A1B6 一类）归一化的颜色比例
const TINT_REF = new THREE.Color(12172214);
function ratioColor(hex, k = 1) {
  const c = new THREE.Color(hex);
  return [(k * c.r) / TINT_REF.r, (k * c.g) / TINT_REF.g, (k * c.b) / TINT_REF.b];
}

// ============================================================================
// 2. 批处理 ho()：比 geo.js 的 MeshBatcher 多 remap / dz / minSize / tris
// ============================================================================

// po() 打过标记的「顶点色材质」集合
const vcMaterials = new WeakSet();

function paintMaterial(materials, name, opts = {}) {
  const mat = materials.get(name, { vertexColors: true, ...opts });
  vcMaterials.add(mat);
  return mat;
}

class SkylineBatcher {
  constructor() {
    this.buckets = new Map();
    this.tris = 0;
    this.remap = null;
    this.dz = 0;
    this.minSize = 0;
  }
  add(mat, geo, tint) {
    if (!geo) return;
    if (Array.isArray(geo)) {
      for (const g of geo) this.add(mat, g, tint);
      return;
    }
    if (this.remap) {
      const mapped = this.remap(mat, tint);
      if (!mapped) return;
      if (this.minSize) {
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        if (Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) < this.minSize) return;
      }
      mat = mapped[0];
      tint = mapped[1];
      if (this.dz) geo.translate(0, 0, this.dz);
    }
    if (vcMaterials.has(mat) && !geo.attributes.color) {
      applyVertexColor(geo, (x, y, z) => weatherTintCv(x, y, z, tint || WHITE));
    }
    let bucket = this.buckets.get(mat.uuid);
    if (!bucket) {
      bucket = { mat, geos: [] };
      this.buckets.set(mat.uuid, bucket);
    }
    bucket.geos.push(geo);
    this.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  }
  build({ cast = true, recv = true } = {}) {
    const group = new THREE.Group();
    for (const b of this.buckets.values()) {
      const geo = mergeGeos(b.geos);
      const mesh = new THREE.Mesh(geo, b.mat);
      const unlit = b.mat.isMeshBasicMaterial || b.mat.transparent;
      mesh.castShadow = cast && !unlit;
      mesh.receiveShadow = recv && !unlit;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}

// ============================================================================
// 3. 灯组批次 bw()：fract 占空比闪烁 shader
// ============================================================================

// 只合并 position / color / blink（mergeGeos 会丢掉自定义 attribute）
function mergeBlinkGeos(geos) {
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const blk = new Float32Array(count * 3);
  let offset = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, offset * 3);
    col.set(g.attributes.color.array, offset * 3);
    blk.set(g.attributes.blink.array, offset * 3);
    offset += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('blink', new THREE.BufferAttribute(blk, 3));
  return geo;
}

function createLampBatcher() {
  const uTime = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader =
      `attribute vec3 blink;\nuniform float uTime;\nvarying float vBlink;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
 float bph = fract(uTime / max(blink.x, 0.001) + blink.y);
 vBlink = blink.x <= 0.0 ? 1.0 : mix(0.02, 1.0, smoothstep(0.0, 0.06, bph) * (1.0 - smoothstep(blink.z, blink.z + 0.12, bph)));`
      );
    shader.fragmentShader =
      `varying float vBlink;\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
 diffuseColor.rgb *= vBlink;`
      );
  };
  mat.customProgramCacheKey = () => 'yardkit-blink';

  const geos = [];
  return {
    uTime,
    mat,
    add(geo, color, rate = 0, phase = 0, duty = 0.5) {
      if (!geo) return;
      const src = geo.index ? geo.toNonIndexed() : geo;
      const count = src.attributes.position.count;
      const cols = new Float32Array(count * 3);
      const blinks = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        cols[i * 3] = color[0];
        cols[i * 3 + 1] = color[1];
        cols[i * 3 + 2] = color[2];
        blinks[i * 3] = rate;
        blinks[i * 3 + 1] = phase;
        blinks[i * 3 + 2] = duty;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      g.setAttribute('blink', new THREE.BufferAttribute(blinks, 3));
      geos.push(g);
    },
    build() {
      if (!geos.length) return null;
      const mesh = new THREE.Mesh(mergeBlinkGeos(geos.splice(0)), mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.name = 'backdrop-lamps';
      return mesh;
    },
  };
}

// ============================================================================
// 4. 天际线常量（Rw 里的 Sw / Fg / E / M / _ / T / w / z / Aw / Tw）
// ============================================================================

const CONTAINER_COLORS = [
  8200729, 8200729, 6957596, 2047846, 2047846, 2307146, 2906692, 2906692, 11751962,
  9062946, 5922920, 5922920, 4146764, 2055523, 10121752, 8093308, 6962468, 6962468,
].map((hex) => ratioColor(hex));

const SHED_COLORS = [
  [0.6, 0.17, 0.13], [0.17, 0.29, 0.5], [0.2, 0.42, 0.3], [0.76, 0.35, 0.12], [0.78, 0.6, 0.16],
  [0.8, 0.81, 0.78], [0.4, 0.43, 0.47], [0.16, 0.42, 0.45], [0.55, 0.2, 0.15], [0.2, 0.3, 0.45],
];

const COL_STEEL = ratioColor(5922920, 0.85);
const COL_STEEL_DARK = [0.1, 0.1, 0.11];
const COL_MID = [0.36, 0.38, 0.4];
const COL_TOP = ratioColor(12159516, 0.5);
const COL_CAB = [0.5, 0.5, 0.48];
const COL_HULL = ratioColor(6172444, 0.7);
const COL_LAMP_WARM = [5.5, 4.3, 2.9];
const COL_LAMP_RED = [8, 0.45, 0.25];
const EAST_N = [0.866, -0.5, 0];

// Tw(n, e)：离岸边越远越亮
const distanceTone = (x, z) => 1 - 0.6 * smoothstep(38, 160, Math.hypot(x + 5, z));

// l(C, A, F, H, N)：世界空间做旧上色（近处几何用）
const _paintScratch = [0, 0, 0];
function paint(base, x, y, z, dist = 1) {
  const n1 = noiseAu(x * 0.23 + 1.3, y * 0.31, z * 0.23 + 7.7);
  const n2 = noiseAu(x * 1.9 + 4.1, 2.2, z * 1.9 + 9.3);
  const w = dist * (0.56 + 0.52 * n1) * (0.62 + 0.38 * smoothstep(0, 5, y));
  let r = base[0] * w, g = base[1] * w, b = base[2] * w;
  if (n2 > 0.62) {
    const rust = Math.min(1, (n2 - 0.62) / 0.3) * 0.55;
    r = r * (1 - rust) + 0.3 * rust * w;
    g = g * (1 - rust) + 0.15 * rust * w;
    b = b * (1 - rust) + 0.08 * rust * w;
  }
  _paintScratch[0] = r;
  _paintScratch[1] = g;
  _paintScratch[2] = b;
  return _paintScratch;
}

const paintPoints = (base, pts, dist) => pts.map((p) => paint(base, p[0], p[1], p[2], dist).slice());

// 场地灯杆 [x, z, 高度]（Rw 的 16 座 mast）
const LAMP_MASTS = [
  [-67.5, -22, 32], [-67.5, 31, 32], [-122, 4, 34], [-12.6, -53, 30], [-12.6, 51, 30],
  [-140, -84, 34], [-96, 96, 34], [0.2, -100, 30], [-52, -70, 28], [-55, 72, 28],
  [-84, -45, 34], [-84, 24, 34], [-25, -84, 30], [-28, 90, 30], [-120, 60, 34], [10.5, 49, 26],
];

// ============================================================================
// 5. createSkyline —— Rw()
// ============================================================================

export function createSkyline({ materials = defaultMaterials, seed = 90417, lamps = true } = {}) {
  const batcher = new SkylineBatcher();
  const paintMat = paintMaterial(materials, 'paint_white');
  const rng = lcgRng(seed);
  const lampSpecs = [];

  // c(C, A)：把几何塞进批处理；近处（bbox 中心 x < 31）按世界空间上色，远处用统一 tint
  function addGeo(geo, tint) {
    if (!geo) return;
    if (Array.isArray(geo)) {
      for (const g of geo) addGeo(g, tint);
      return;
    }
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    if (cx < 31) {
      const tone = distanceTone(cx, cz);
      applyVertexColor(geo, (x, y, z) => paint(tint, x, y, z, tone));
      batcher.add(paintMat, geo);
    } else {
      batcher.add(paintMat, geo, tint);
    }
  }

  // ---- 楼群立面四边形缓冲 (u/f/h/p) ----
  const QUAD_POS = [];
  const QUAD_NRM = [];
  const QUAD_UV = [];
  const QUAD_COL = [];

  // d(C, A, F)：四边形 + 法线 + 四角颜色
  function pushQuad(quad, normal, cols) {
    const e1x = quad[1][0] - quad[0][0], e1y = quad[1][1] - quad[0][1], e1z = quad[1][2] - quad[0][2];
    const e2x = quad[3][0] - quad[0][0], e2y = quad[3][1] - quad[0][1], e2z = quad[3][2] - quad[0][2];
    const flip = (e1y * e2z - e1z * e2y) * normal[0] + (e1z * e2x - e1x * e2z) * normal[1] + (e1x * e2y - e1y * e2x) * normal[2] < 0;
    for (const i of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      const p = quad[i];
      QUAD_POS.push(p[0], p[1], p[2]);
      QUAD_NRM.push(normal[0], normal[1], normal[2]);
      QUAD_COL.push(cols[i][0], cols[i][1], cols[i][2]);
      if (Math.abs(normal[0]) > 0.5) QUAD_UV.push(p[2], p[1]);
      else if (Math.abs(normal[1]) > 0.5) QUAD_UV.push(p[0], p[2]);
      else QUAD_UV.push(p[0], p[1]);
    }
  }

  // v(C, A, F, H, N, Z, Q, W, J)：楼体盒子，W 是可见面字符串
  function buildingBox(x0, y0, z0, x1, y1, z1, base, faces, dist) {
    for (const face of faces) {
      let quad, normal;
      if (face === 'E') {
        quad = [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]];
        normal = EAST_N;
      } else if (face === 'W') {
        quad = [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]];
        normal = [-1, 0, 0];
      } else if (face === 'S') {
        quad = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
        normal = [0, 0, 1];
      } else if (face === 'N') {
        quad = [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]];
        normal = [0, 0, -1];
      } else {
        quad = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
        normal = [0, 1, 0];
      }
      const cols = paintPoints(base, quad, face === 'T' ? dist * 0.8 : face === 'E' ? dist * 0.92 : dist);
      if (y0 < 0.1 && face !== 'T') {
        for (const k of [0, 1]) {
          cols[k][0] *= 0.62;
          cols[k][1] *= 0.62;
          cols[k][2] *= 0.62;
        }
      }
      pushQuad(quad, normal, cols);
    }
  }

  // y(C, A, F, opts)：沿岸集装箱垛（楼群剪影的主体）
  function blockRow(cols, from, to, { faceZ = 0, ribs = false, doorRows = 0, west = false } = {}) {
    const dir = Math.sign(to - from);
    const rows = [];
    for (let z = from, i = 1; dir > 0 ? z < to : z > to; z += dir * 2.62, i++) {
      if (i % 8 >= 1 && i % 8 <= 5) rows.push({ z, blk: Math.floor(i / 8), first: i === 1 });
    }
    const heights = rows.map((row) =>
      cols.map((col) => {
        const j = noiseAu(col * 0.04 + 3, 0.5, row.z * 0.05 + 7);
        let O = Math.round(0.2 + j * 5.4 + (rng() - 0.5) * 2.4);
        if (!row.first && rng() < 0.07) O = 0;
        return Math.max(row.first ? 2 : 0, Math.min(5, O));
      })
    );
    const at = (r, c) => (r >= 0 && r < rows.length && c >= 0 && c < cols.length ? heights[r][c] : 0);

    rows.forEach((row, ri) =>
      cols.forEach((col, ci) => {
        const stack = heights[ri][ci];
        const z = row.z;
        const tone = distanceTone(col, z);
        const nearYard = Math.max(Math.abs(col + 5) - 40, Math.abs(z) - 30) < 55;
        const contiguous = (a, b) =>
          a >= 0 && b >= 0 && a < cols.length && b < cols.length && Math.abs(cols[a] - cols[b]) < 12.8;

        for (let lvl = 0; lvl < stack; lvl++) {
          const pick = CONTAINER_COLORS[Math.floor(rng() * CONTAINER_COLORS.length)];
          const shade = 0.6 + rng() * 0.4;
          const col3 = [pick[0] * shade, pick[1] * shade, pick[2] * shade];
          const jitter = (rng() - 0.5) * 0.22;
          const yb = lvl * 2.6;
          const xa = col - 6.095 + jitter;
          const xb = col + 6.095 + jitter;
          const za = z - 1.22;
          const zb = z + 1.22;
          let faces = lvl === stack - 1 ? 'T' : '';
          for (const s of faceZ ? [faceZ] : [-1, 1]) {
            const rr = ri + s * dir;
            const hidden = rr >= 0 && rr < rows.length && rows[rr].blk === row.blk && Math.abs(rows[rr].z - z) < 2.7;
            if (!hidden || at(rr, ci) <= lvl) faces += s > 0 ? 'S' : 'N';
          }
          const eastOpen = !(contiguous(ci - 1, ci) && at(ri, ci - 1) > lvl);
          const westOpen = !west && !(contiguous(ci + 1, ci) && at(ri, ci + 1) > lvl);
          if (eastOpen) faces += 'E';
          if (westOpen) faces += 'W';
          buildingBox(xa, yb, za, xb, yb + 2.59, zb, col3, faces, tone);

          const dark = [col3[0] * 0.45, col3[1] * 0.45, col3[2] * 0.45];
          const ribSides = row.first
            ? faceZ
              ? [faceZ]
              : [-dir]
            : ci === 0 && west && Math.abs(z) < 42
              ? [-1, 1].filter((s) => faces.includes(s > 0 ? 'S' : 'N'))
              : [];

          if (ribs && nearYard && ribSides.length) {
            for (const side of ribSides) {
              const zFace = side > 0 ? zb : za;
              const zOut = zFace + side * 0.04;
              const yLo = lvl * 2.6 + 0.15;
              const yHi = lvl * 2.6 + 2.45;
              const ribCol = [col3[0] * 0.7, col3[1] * 0.7, col3[2] * 0.7];
              for (let x = xa + 0.24; x < xb - 0.3; x += 0.575) {
                let q = [[x, yLo, zFace], [x + 0.07, yLo, zOut], [x + 0.07, yHi, zOut], [x, yHi, zFace]];
                pushQuad(q, [-0.5, 0, side * 0.87], paintPoints(ribCol, q, tone));
                q = [[x + 0.07, yLo, zOut], [x + 0.2, yLo, zOut], [x + 0.2, yHi, zOut], [x + 0.07, yHi, zOut]];
                pushQuad(q, [0, 0, side], paintPoints(col3, q, tone));
                q = [[x + 0.2, yLo, zOut], [x + 0.27, yLo, zFace], [x + 0.27, yHi, zFace], [x + 0.2, yHi, zOut]];
                pushQuad(q, [0.42, -0.52, side * 0.74], paintPoints(ribCol, q, tone));
              }
              for (const [yLo2, yHi2] of [[lvl * 2.6, yLo], [yHi, lvl * 2.6 + 2.59]]) {
                const zEdge = zFace + side * 0.05;
                let q = [[xa, yLo2, zEdge], [xb, yLo2, zEdge], [xb, yHi2, zEdge], [xa, yHi2, zEdge]];
                pushQuad(q, [0, 0, side], paintPoints(dark, q, tone));
                q = [[xa, yHi2, zFace], [xb, yHi2, zFace], [xb, yHi2, zEdge], [xa, yHi2, zEdge]];
                pushQuad(q, [0, yLo2 === lvl * 2.6 ? 1 : -1, 0], paintPoints(dark, q, tone));
              }
            }
          }

          if (eastOpen && ci === 0 && ri < doorRows) {
            const doorX = xb + 0.03;
            const doorX2 = xb + 0.055;
            const yLo = lvl * 2.6 + 0.02;
            const yHi = lvl * 2.6 + 2.57;
            const doorCol = [col3[0] * 0.55, col3[1] * 0.55, col3[2] * 0.55];
            const frameCol = [0.34, 0.35, 0.36];
            const gapCol = [0.05, 0.05, 0.055];
            const plate = (x, z0, z1, ya, yb2, base) => {
              const q = [[x, ya, z1], [x, ya, z0], [x, yb2, z0], [x, yb2, z1]];
              const cols2 = paintPoints(base, q, tone);
              if (lvl * 2.6 < 0.1 && ya < 0.3) {
                for (const k of [0, 1]) {
                  cols2[k][0] *= 0.62;
                  cols2[k][1] *= 0.62;
                  cols2[k][2] *= 0.62;
                }
              }
              pushQuad(q, EAST_N, cols2);
            };
            plate(doorX, za, za + 0.13, yLo, yHi, doorCol);
            plate(doorX, zb - 0.13, zb, yLo, yHi, doorCol);
            plate(doorX, za + 0.13, zb - 0.13, lvl * 2.6, lvl * 2.6 + 0.15, doorCol);
            plate(doorX, za + 0.13, zb - 0.13, lvl * 2.6 + 2.44, lvl * 2.6 + 2.59, doorCol);
            plate(doorX, z - 0.018, z + 0.018, lvl * 2.6 + 0.15, lvl * 2.6 + 2.44, gapCol);
            for (const dz of [-0.8, -0.32, 0.32, 0.8]) {
              plate(doorX2, z + dz - 0.024, z + dz + 0.024, lvl * 2.6 + 0.1, lvl * 2.6 + 2.5, frameCol);
              if (ri < 8) {
                for (const dy of [0.32, 2.2]) plate(doorX2 + 0.01, z + dz - 0.07, z + dz + 0.07, lvl * 2.6 + dy, lvl * 2.6 + dy + 0.09, frameCol);
              }
            }
            if (ri < 8) {
              for (const dz of [-0.56, 0.56]) plate(doorX2 + 0.01, z + dz - 0.1, z + dz + 0.1, lvl * 2.6 + 1.02, lvl * 2.6 + 1.1, frameCol);
            }
          }
        }
      })
    );
  }

  const WARE_COLS = [-48.6, -61.2, -73.8, -90.5, -103.1, -115.7, -132, -144.6];
  const WEST_COLS = [6.3, -6.3, -18.9, -31.5];
  blockRow(WARE_COLS, -4.9, -112, { ribs: true, doorRows: 15, west: true });
  blockRow(WARE_COLS, 14.9, 112, { ribs: true, doorRows: 15, west: true });
  blockRow(WEST_COLS, -36.4, -110, { faceZ: 1, ribs: true, doorRows: 12 });
  blockRow(WEST_COLS, 33.9, 110, { faceZ: -1, ribs: true, doorRows: 12 });

  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUAD_POS), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(QUAD_NRM), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(QUAD_UV), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(QUAD_COL), 3));
    batcher.add(paintMat, geo);
  }

  const STEEL = COL_STEEL;
  const DARK = COL_STEEL_DARK;
  const MID = COL_MID;
  const TOP = COL_TOP;
  const CAB = COL_CAB;

  // S(C, A, F, H, N)：岸边装卸桥/筒仓
  function terminalLoader(C, A, base, H, N) {
    const Q = base;
    const W = [Q[0] * 0.7, Q[1] * 0.7, Q[2] * 0.7];
    for (const side of [-1, 1]) {
      const az = A + side * 9.5;
      for (const e of [-1, 1]) {
        const ax = C + e * 7.5;
        addGeo(rangeBox(ax - 1.5, 0.05, az - 0.28, ax + 1.5, 0.8, az + 0.28), DARK);
        addGeo(rangeBox(ax - 0.36, 0.8, az - 0.36, ax + 0.36, 19.1, az + 0.36), Q);
        addGeo(rangeBox(ax - 0.4, 6.9, az - 0.4, ax + 0.4, 7, az + 0.4), W);
        addGeo(rangeBox(ax - 0.4, 13, az - 0.4, ax + 0.4, 13.1, az + 0.4), W);
        addGeo(beamBetween([ax, 14.6, az], [ax - e * 3.2, 19.1, az], 0.3, 0.3), Q);
      }
      addGeo(rangeBox(C - 9.3, 0.8, az - 0.4, C + 9.3, 1.7, az + 0.4), Q);
      addGeo(rangeBox(C - 8, 19.1, az - 0.45, C + 8, 20.2, az + 0.45), Q);
      addGeo(rangeBox(C - 2.4, 1.7, az - 0.5, C + 0.8, 3.9, az + 0.5), CAB);
    }
    for (const side of [-1, 1]) {
      const ax = C + side * 3.3;
      const z0 = A - 9.5 - 5.6;
      const z1 = A + 9.5 + 5.6;
      addGeo(rangeBox(ax - 0.45, 20.2, z0, ax + 0.45, 21.9, z1), Q);
      for (let z = z0 + 4.4; z < z1; z += 4.4) addGeo(rangeBox(ax - 0.48, 20.15, z - 0.03, ax + 0.48, 21.95, z + 0.03), W);
      addGeo(rangeBox(ax + side * 0.45, 21, z0, ax + side * 1.3, 21.05, z1), MID);
      railing({ add: (_mat, geo, tint) => addGeo(geo, tint) }, null, [[ax + side * 1.27, 21.05, z0], [ax + side * 1.27, 21.05, z1]], { post: 3.3, r: 0.035, mid: false, tint: TOP });
      addGeo(pipeBetween([ax, 20.2, A - 9.5 + 0.5], [ax, 20.2, A + 9.5 - 0.5], 0.05, 0.05, 4), DARK);
    }
    for (const z of [A - 9.5 - 5.4, A + 9.5 + 5.4]) addGeo(rangeBox(C - 3.3, 20.4, z - 0.25, C + 3.3, 21.7, z + 0.25), Q);

    const J = A + H;
    addGeo(rangeBox(C - 4, 21.9, J - 2.3, C + 4, 22.5, J + 2.3), TOP);
    addGeo(rangeBox(C - 2.6, 22.5, J - 1.7, C + 1.4, 24.5, J + 1.7), CAB);
    addGeo(rangeBox(C + 1.8, 22.5, J - 0.9, C + 3.4, 23.3, J + 0.9), DARK);
    addGeo(rangeBox(C + 4.3, 17.2, J - 1, C + 6.1, 19.5, J + 1), CAB);
    addGeo(rangeBox(C + 4.4, 18.2, J - 1.02, C + 6.12, 19.2, J + 1.02), [0.08, 0.1, 0.12]);
    for (const dz of [-0.9, 0.9]) addGeo(rangeBox(C + 4.9, 19.5, J + dz - 0.06, C + 5.05, 21.9, J + dz + 0.06), TOP);

    const G = 21.9 - N;
    for (const dx of [-2.2, 2.2]) {
      for (const dz of [-0.8, 0.8]) addGeo(pipeBetween([C + dx, 21.9, J + dz], [C + dx, G, J + dz], 0.03, 0.03, 4), DARK);
    }
    addGeo(rangeBox(C - 6.1, G - 0.4, J - 1.22, C + 6.1, G, J + 1.22), TOP);
    addGeo(rangeBox(C - 2.4, G, J - 0.9, C + 2.4, G + 0.5, J + 0.9), TOP);

    {
      const lx = C - 7.5 - 0.5;
      const lz = A - 9.5;
      let y = 1.7;
      for (let k = 0; k < 6; k++) {
        const zA = lz + (k % 2 ? 1.9 : -1.9);
        const zB = lz + (k % 2 ? -1.9 : 1.9);
        const yTop = Math.min(20.2, y + 3.1);
        addGeo(beamBetween([lx, y, zA], [lx, yTop, zB], 0.6, 0.07), MID);
        addGeo(pipeBetween([lx - 0.3, y + 1, zA], [lx - 0.3, yTop + 1, zB], 0.03, 0.03, 4), TOP);
        addGeo(rangeBox(lx - 0.35, yTop - 0.04, zB - 0.5, lx + 0.35, yTop, zB + 0.5), MID);
        y = yTop;
      }
      for (const dz of [-2.4, 2.4]) addGeo(rangeBox(lx - 0.3, 1.7, lz + dz - 0.05, lx - 0.2, 20.2, lz + dz + 0.05), W);
      addGeo(cylAxis(1.25, 1.25, 0.5, 'z', C + 7.5 + 1, 3.3, A + 9.5 + 0.9, 12), TOP);
      addGeo(cylAxis(0.5, 0.5, 0.6, 'z', C + 7.5 + 1, 3.3, A + 9.5 + 0.9, 8), DARK);
      for (const dz of [-0.2, 0.2]) addGeo(pipeBetween([C + 7.5 + 0.45, 1.7, A - 9.5 + dz], [C + 7.5 + 0.45, 20.2, A - 9.5 + dz], 0.022, 0.022, 4), MID);
    }

    lampSpecs.push({ p: [C, 24.9, J], r: 0.3, color: COL_LAMP_RED, rate: 3.1, phase: rng(), duty: 0.4 });
    lampSpecs.push({ p: [C - 3.3, 20, A - 4], r: 0.24, color: COL_LAMP_WARM, rate: 0, phase: 0, duty: 0.5 });
    lampSpecs.push({ p: [C + 3.3, 20, A + 4], r: 0.24, color: COL_LAMP_WARM, rate: 0, phase: 0, duty: 0.5 });
  }

  terminalLoader(-61, -52.06, STEEL, -3, 4.5);
  terminalLoader(-61, 41.1, COL_HULL, 5, 9);
  terminalLoader(-103, -10.14, COL_HULL, 2, 3);
  terminalLoader(-6, -62.6, STEEL, -6, 7);
  terminalLoader(-12, 60.1, STEEL, 4, 5);

  // 场地灯杆：灯杆 + 灯头进天际线，警示光点进灯组
  for (const [C, A, F] of LAMP_MASTS) {
    addGeo(cylAxis(0.14, 0.3, F, 'y', C, F / 2, A, 6), MID);
    addGeo(cylAxis(1.5, 1.5, 0.18, 'y', C, F - 0.5, A, 8), DARK);
    for (const [dx, dz] of [[-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4]]) {
      addGeo(rangeBox(C + dx - 0.25, F - 0.95, A + dz - 0.25, C + dx + 0.25, F - 0.6, A + dz + 0.25), DARK);
      lampSpecs.push({ p: [C + dx, F - 1.05, A + dz], r: 0.2, color: COL_LAMP_WARM, rate: 0, phase: 0, duty: 0.5 });
    }
  }

  // 烟囱 / 火炬塔（三角桁架）
  for (const [C, A, F] of [[-158, -30, 62], [-76, -128, 48], [-150, 104, 54]]) {
    const legs = [[-1.1, -0.638], [1.1, -0.638], [0, 1.265]];
    for (const [lx, lz] of legs) addGeo(pipeBetween([C + lx, 0, A + lz], [C + lx * 0.3, F, A + lz * 0.3], 0.07, 0.07, 4), [0.42, 0.14, 0.1]);
    for (let y = 3, k = 0; y < F; y += 6, k++) {
      for (let w = 0; w < 3; w++) {
        const p = legs[w];
        const q = legs[(w + 1) % 3];
        const t0 = 1 - (0.7 * y) / F;
        const t1 = 1 - (0.7 * Math.min(F, y + 6)) / F;
        addGeo(
          pipeBetween([C + p[0] * t0, y, A + p[1] * t0], [C + q[0] * t1, Math.min(F, y + 6), A + q[1] * t1], 0.04, 0.04, 3),
          k % 2 ? CAB : [0.42, 0.14, 0.1]
        );
      }
    }
    for (const a of [0.5, 2.6, 4.7]) addGeo(pipeBetween([C, F * 0.72, A], [C + Math.cos(a) * F * 0.5, 0, A + Math.sin(a) * F * 0.5], 0.025, 0.025, 3), DARK);
    addGeo(pipeBetween([C, F, A], [C, F + 5, A], 0.04, 0.04, 3), DARK);
    addGeo(rangeBox(C - 0.9, F * 0.8, A - 0.25, C + 0.9, F * 0.8 + 1.6, A + 0.25), CAB);
    lampSpecs.push({ p: [C, F + 0.4, A], r: 0.35, color: COL_LAMP_RED, rate: 2.4, phase: rng(), duty: 0.45 });
    lampSpecs.push({ p: [C, F * 0.55, A], r: 0.28, color: COL_LAMP_RED, rate: 0, phase: 0, duty: 0.5 });
  }

  // 堆场龙门吊（仓库大门）
  for (const [C, A, F] of [[-178, -70, 90], [-182, 40, 110], [-60, -150, 70], [-70, 150, 80]]) {
    const along = Math.abs(A) > 120;
    const box2 = (z0, y0, w0, z1, y1, w1, base) =>
      addGeo(along ? rangeBox(C + z0, y0, A + w0, C + z1, y1, A + w1) : rangeBox(C + w0, y0, A + z0, C + w1, y1, A + z1), base);
    box2(-F / 2, 0, -16, F / 2, 9.5, 16, [0.2, 0.22, 0.24]);
    box2(-F / 2, 9.5, -16.4, F / 2, 9.9, 16.4, [0.12, 0.12, 0.13]);
    box2(-F / 2, 9.9, -10, F / 2, 12.2, 10, [0.17, 0.18, 0.2]);
    box2(-F / 2 + 4, 12.2, -1.2, F / 2 - 4, 13.3, 1.2, [0.13, 0.13, 0.14]);
    for (let z = -F / 2 + 6; z < F / 2 - 5; z += 12) {
      box2(z - 0.25, 0, -16.2, z + 0.25, 9.5, 16.2, [0.13, 0.14, 0.15]);
      if ((z | 0) % 3 === 0) box2(z + 2, 0, -16.1, z + 8, 6.2, 16.1, [0.06, 0.06, 0.07]);
    }
  }

  // 港口正前方的装卸桥复制体：Dg(n, e, { into: t, mat: i, dz: 66 })
  {
    const crane = createCrane({ materials, animate: false, centered: false });
    const structure = crane.root.children[0];
    const remap = new Map([
      [materials.get('paint_grey', { vertexColors: true }).uuid, [0.2, 0.25, 0.31]],
      [materials.get('paint_yellow', { vertexColors: true }).uuid, [0.72, 0.52, 0.12]],
      [materials.get('paint_white', { vertexColors: true }).uuid, [0.78, 0.78, 0.76]],
      [materials.get('paint_red', { vertexColors: true }).uuid, [0.5, 0.14, 0.1]],
      [materials.get('steel_galv').uuid, [0.5, 0.52, 0.54]],
      [materials.get('steel_dark').uuid, [0.1, 0.1, 0.11]],
      [materials.get('hazard_stripes').uuid, [0.7, 0.5, 0.1]],
    ]);
    batcher.remap = (mat) => {
      const tint = remap.get(mat.uuid);
      return tint ? [paintMat, tint] : null;
    };
    batcher.dz = 66;
    batcher.minSize = 2.6;
    for (const child of structure.children) {
      if (!child.isMesh) continue;
      batcher.add(child.material, child.geometry.clone());
    }
    batcher.remap = null;
    batcher.dz = 0;
    batcher.minSize = 0;
  }

  // 远景塔吊（Mw）+ 塔顶红色航空灯
  [
    [-132, 1.15, true, [0.14, 0.17, 0.21]],
    [-186, 1.25, false, [0.14, 0.17, 0.21]],
    [-252, 1.35, true, [0.26, 0.12, 0.06]],
    [-336, 1.4, false, [0.26, 0.12, 0.06]],
    [128, 1.2, false, [0.14, 0.17, 0.21]],
    [182, 1.3, true, [0.24, 0.25, 0.27]],
    [250, 1.4, false, [0.24, 0.25, 0.27]],
    [330, 1.45, true, [0.26, 0.12, 0.06]],
  ].forEach(([z, scale, up, tint], i) => {
    // Mw：几何平移到 (23.5, 0, z)，缩放已经烘进几何
    const distant = createDistantCrane({ materials, scale, boomUp: up, tint });
    const geo = distant.root.children[0].geometry.clone();
    geo.translate(23.5, 0, z);
    batcher.add(paintMat, geo, tint);
    const beaconPos = up ? [23.5 + 10.5 * scale, 52.6 * scale, z] : [23.5 + 4.1 * scale, 31 * scale, z];
    lampSpecs.push({
      p: beaconPos,
      r: 0.45 * scale,
      color: COL_LAMP_RED,
      rate: 2.6 + (i % 3) * 0.35,
      phase: i * 0.37,
      duty: 0.45,
    });
  });
  addGeo(rangeBox(-230, -1.6, -384, 30, -0.12, 425), [0.24, 0.24, 0.25]);

  // L(C, A, F, H, N, Z, Q)：岸边仓库
  function harbourShed(x0, x1, z0, z1, yTop, roofBase, peakRatio) {
    addGeo(rangeBox(x0, -1.6, z0, x1, yTop, z1), roofBase);
    addGeo(rangeBox(x0, -1.6, z0, x1, 0.8, z1 + 0.2), [0.42, 0.14, 0.1]);
    const len = z1 - z0;
    const ridge = z0 + len * peakRatio;
    addGeo(rangeBox(x0 + 2, yTop, ridge - 7, x1 - 2, yTop + 17, ridge + 7), [0.72, 0.73, 0.7]);
    addGeo(rangeBox((x0 + x1) / 2 - 3, yTop + 17, ridge - 5, (x0 + x1) / 2 + 3, yTop + 24, ridge + 1), [0.2, 0.3, 0.45]);
    for (let z = z0 + 12; z < z1 - 12; z += 13.2) {
      if (Math.abs(z + 6 - ridge) < 14) continue;
      const h = 2.6 * (2 + Math.floor(rng() * 4));
      const c1 = SHED_COLORS[Math.floor(rng() * SHED_COLORS.length)];
      addGeo(rangeBox(x0 + 1, yTop, z, (x0 + x1) / 2 - 0.2, yTop + h, z + 12.2), c1);
      const c2 = SHED_COLORS[Math.floor(rng() * SHED_COLORS.length)];
      addGeo(rangeBox((x0 + x1) / 2 + 0.2, yTop, z, x1 - 1, yTop + h - 2.6 * Math.floor(rng() * 2), z + 12.2), c2);
    }
    lampSpecs.push({ p: [(x0 + x1) / 2, yTop + 26, ridge], r: 0.4, color: [5, 4.6, 3.8], rate: 0, phase: 0, duty: 0.5 });
  }

  harbourShed(34, 62, 140, 345, 11, [0.1, 0.13, 0.2], 0.78);
  harbourShed(34, 58, -360, -205, 10, [0.2, 0.08, 0.07], 0.2);
  harbourShed(470, 500, -190, -40, 9, [0.12, 0.14, 0.17], 0.8);
  harbourShed(600, 626, 160, 300, 9, [0.16, 0.12, 0.1], 0.2);

  // 码头岸线堆放的集装箱
  for (let z = 340; z > -66; z -= 12.5) {
    const x = 398 + Math.sin(z * 0.013) * 14 + (rng() - 0.5) * 3;
    const geo = rangeBox(-6 - rng() * 2, -1.6, -7, 6 + rng() * 2, 2.2 + rng() * 1.2, 7);
    geo.rotateY((rng() - 0.5) * 0.5);
    geo.translate(x, 0, z);
    addGeo(geo, [0.2, 0.21, 0.22]);
  }

  // 灯塔
  {
    addGeo(cylAxis(5, 6, 3.6, 'y', 399, 0.2, -72, 10), [0.3, 0.3, 0.3]);
    addGeo(cylAxis(1.7, 2.3, 6, 'y', 399, 5, -72, 10), [0.85, 0.85, 0.82]);
    addGeo(cylAxis(1.5, 1.7, 4, 'y', 399, 10, -72, 10), [0.62, 0.14, 0.1]);
    addGeo(cylAxis(1.3, 1.5, 4, 'y', 399, 14, -72, 10), [0.85, 0.85, 0.82]);
    addGeo(cylAxis(2, 2, 0.3, 'y', 399, 16.1, -72, 10), [0.3, 0.3, 0.32]);
    addGeo(cylAxis(0.2, 1.3, 1.2, 'y', 399, 18.9, -72, 8), [0.25, 0.25, 0.27]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * 6.283;
      addGeo(
        rangeBox(399 + Math.cos(a) * 1.1 - 0.06, 16.2, -72 + Math.sin(a) * 1.1 - 0.06, 399 + Math.cos(a) * 1.1 + 0.06, 18.3, -72 + Math.sin(a) * 1.1 + 0.06),
        [0.25, 0.25, 0.27]
      );
    }
    lampSpecs.push({ p: [399, 17.25, -72], r: 0.85, color: [16, 15, 11], rate: 6, phase: 0, duty: 0.09 });
  }

  // 防波堤 + 集装箱码头
  const U = 300;
  addGeo(rangeBox(U - 330, -1.6, -520, U + 330, 2.2, -430), [0.16, 0.17, 0.18]);
  for (const [x, z, w, h] of [
    [-150, -452, 17, 15], [-112, -458, 17, 15], [-76, -450, 13, 18], [20, -455, 20, 14],
    [64, -462, 20, 14], [104, -452, 14, 19], [136, -462, 14, 19], [210, -456, 22, 12],
  ]) {
    addGeo(cylAxis(w, w, h, 'y', U + x, 2.2 + h / 2, z, 14), [0.62, 0.63, 0.62]);
    addGeo(cylAxis(w * 0.2, w, h * 0.12, 'y', U + x, 2.2 + h * 1.06, z, 14), [0.52, 0.53, 0.53]);
  }
  for (const [x, z, h2, w2] of [[-32, -470, 96, 3.2], [168, -475, 70, 2.6]]) {
    addGeo(cylAxis(w2 * 0.62, w2, h2, 'y', U + x, 2.2 + h2 / 2, z, 10), [0.5, 0.5, 0.5]);
    for (const f of [0.82, 0.94]) addGeo(cylAxis(w2 * 0.66, w2 * 0.7, h2 * 0.05, 'y', U + x, 2.2 + h2 * f, z, 10), [0.6, 0.15, 0.1]);
    lampSpecs.push({ p: [U + x, 3.2 + h2, z], r: 0.9, color: COL_LAMP_RED, rate: 2.2, phase: rng(), duty: 0.5 });
    lampSpecs.push({ p: [U + x + w2, 2.2 + h2 * 0.55, z], r: 0.7, color: COL_LAMP_RED, rate: 2.2, phase: rng(), duty: 0.5 });
  }
  for (const [x, z, w2, h2, d2] of [
    [-230, -455, 70, 16, 30], [-10, -445, 30, 22, 18], [0, -452, 8, 44, 8],
    [-18, -450, 5, 36, 5], [270, -450, 60, 12, 30], [150, -448, 26, 28, 14],
  ]) {
    addGeo(rangeBox(U + x - w2 / 2, 2.2, z - d2 / 2, U + x + w2 / 2, 2.2 + h2, z + d2 / 2), [0.34, 0.36, 0.38]);
  }
  for (let i = 0; i < 26; i++) {
    lampSpecs.push({
      p: [U - 300 + rng() * 600, 6 + rng() * 26, -436 + rng() * 6],
      r: 0.55,
      color: rng() > 0.3 ? COL_LAMP_WARM : [3, 3.4, 3.8],
      rate: 0,
      phase: 0,
      duty: 0.5,
    });
  }

  const group = batcher.build({ cast: false, recv: false });
  group.name = 'skyline';
  group.userData.lampSpecs = lampSpecs;
  group.userData.tris = Math.round(batcher.tris);

  if (lamps) {
    const built = buildLampMesh(lampSpecs);
    if (built) {
      group.add(built.group);
      group.userData.lampGroup = built.group;
      group.userData.uTime = built.uTime;
    }
  }
  return group;
}

// ============================================================================
// 6. 灯组
// ============================================================================

function buildLampMesh(specs) {
  const batcher = createLampBatcher();
  for (const s of specs) {
    batcher.add(beacon(s.p[0], s.p[1], s.p[2], s.r), s.color, s.rate, s.phase, s.duty);
  }
  const mesh = batcher.build();
  if (!mesh) return null;
  const group = new THREE.Group();
  group.name = 'lamps';
  group.add(mesh);
  return { group, uTime: batcher.uTime };
}

let _defaultLampSpecs = null;
function defaultLampSpecs(materials) {
  if (!_defaultLampSpecs) _defaultLampSpecs = createSkyline({ materials, lamps: false }).userData.lampSpecs;
  return _defaultLampSpecs;
}

function floodlightMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x121210,
    emissive: 0xffe6bc,
    emissiveIntensity: 3,
    roughness: 1,
    metalness: 0,
  });
}

// 灯杆 + 灯头（与 Rw 的 mast 循环同尺寸）+ 泛光灯发光片 + 警示光点
export function createLamps({ materials = defaultMaterials, specs = null, posts = specs === null } = {}) {
  const group = new THREE.Group();
  group.name = 'lamps';

  let uTime = { value: 0 };
  const lampSpecs = specs || defaultLampSpecs(materials);
  const built = buildLampMesh(lampSpecs);
  if (built) {
    group.add(built.group);
    uTime = built.uTime;
  }

  if (posts) {
    const paintMat = paintMaterial(materials, 'paint_white');
    const batch = new MeshBatcher();
    const lensMat = floodlightMaterial();
    const lens = new MeshBatcher();
    for (const [x, z, h] of LAMP_MASTS) {
      batch.add(paintMat, paintPostGeo(cylAxis(0.14, 0.3, h, 'y', x, h / 2, z, 6), [0.36, 0.38, 0.4]));
      batch.add(paintMat, paintPostGeo(cylAxis(1.5, 1.5, 0.18, 'y', x, h - 0.5, z, 8), [0.1, 0.1, 0.11]));
      lens.add(lensMat, cylAxis(1.2, 1.2, 0.06, 'y', x, h - 0.62, z, 12));
    }
    const postGrp = batch.build({ cast: false, recv: false });
    postGrp.name = 'lamp-posts';
    group.add(postGrp);
    group.add(lens.build({ cast: false, recv: false }));
  }

  group.userData.uTime = uTime;
  return group;
}

// 与 Rw 的 c() 同一条近场上色路径（bbox 中心 + Tw 衰减）
function paintPostGeo(geo, base) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const tone = distanceTone(cx, cz);
  applyVertexColor(geo, (x, y, z) => paint(base, x, y, z, tone));
  return geo;
}

// ============================================================================
// 7. colliders（Dg 的吊机包围盒 + ww 的船体包围盒 + 系泊橡皮护舷）
// ============================================================================

function craneColliders() {
  const out = [];
  for (const x of [18.5, 28.5]) {
    for (const z of [-5.4, 5.4]) {
      out.push({ min: [x - 0.5, 0, z - 2.7], max: [x + 0.5, 1.5, z + 2.7], surface: 'metal' });
      out.push({ min: [x - 0.62, 0, z - 0.62], max: [x + 0.62, 24, z + 0.62], surface: 'metal' });
    }
  }
  return out;
}

const SHIP_COLLIDERS = [
  { min: [33, -5, -72], max: [49, 15, -17.5] },
  { min: [34.9, -5, -17.5], max: [47.1, 15.5, -13] },
  { min: [37.7, -5, -13], max: [44.3, 16, -9.3] },
  { min: [33.8, 13, -66.5], max: [48.2, 24.4, -53] },
];

// ============================================================================
// 8. createBackdrop —— kw()
// ============================================================================

const asPart = (value, factory) => {
  if (value === false || value === null) return null;
  if (value === undefined) return factory();
  if (value.isObject3D) return { root: value };
  return value;
};

export function createBackdrop({
  boat: boatIn,
  crane: craneIn,
  ship: shipIn,
  skyline: skylineIn,
  lamps: lampsIn,
  gulls: gullsIn,
  showcase = false,
  materials = defaultMaterials,
} = {}) {
  const root = new THREE.Group();
  root.name = 'backdrop';

  const boat = asPart(boatIn, () => createBoat({ materials, animate: false }));
  const boatBase = new THREE.Vector3(31.5, -1.6, 21);
  if (showcase) boatBase.set(24, 0.34, 15);
  if (boat) {
    boat.root.position.copy(boatBase);
    boat.root.rotation.y = -Math.PI / 2;
    root.add(boat.root);
  }

  if (boat && !showcase) {
    const rope = new MeshBatcher();
    const ropeMat = materials.get('rope');
    rope.add(ropeMat, pipeChain(parabolaPoints([3.2, 0.95, 0.05], [4.6, 2.12, 2.3], 0.22, 7), 0.016, 5));
    rope.add(ropeMat, pipeChain(parabolaPoints([-3.25, 0.82, 0.95], [-4.6, 2.12, 2.3], 0.2, 7), 0.016, 5));
    boat.root.add(rope.build({ cast: false, recv: false }));
  }

  const crane = asPart(craneIn, () => createCrane({ materials, animate: false }));
  if (crane) root.add(crane.root);

  const ship = asPart(shipIn, () => createShip({ materials, animate: false }));
  if (ship) root.add(ship.root);

  const skyline =
    skylineIn === undefined
      ? createSkyline({ materials, lamps: false })
      : skylineIn && skylineIn.isObject3D
        ? skylineIn
        : skylineIn || null;
  if (skyline) root.add(skyline);

  let lamps = null;
  if (lampsIn === undefined) {
    // 复用 skyline 自带的灯组，避免重复叠一份光点
    const ud = skyline && skyline.userData;
    if (ud && ud.lampGroup) lamps = ud.lampGroup;
    else if (ud && ud.lampSpecs) lamps = createLamps({ materials, specs: ud.lampSpecs, posts: false });
    else lamps = createLamps({ materials });
  } else if (lampsIn) {
    lamps = lampsIn.isObject3D ? lampsIn : lampsIn.root || null;
  }
  const gulls = asPart(gullsIn, () => ((crane || skyline) && createSeagulls({ count: 12, animate: true })) || null);
  if (gulls) root.add(gulls.root || gulls);

  // 与原游戏一致：灯组最后挂进 backdrop
  if (lamps && !lamps.parent) root.add(lamps);

  const colliders = [];
  if (crane) for (const b of craneColliders()) colliders.push(b);
  if (ship) for (const b of SHIP_COLLIDERS) colliders.push({ min: b.min.slice(), max: b.max.slice(), surface: 'metal' });
  if (boat && !showcase) colliders.push({ min: [30.25, -1.7, 17.4], max: [32.8, -0.7, 24.6], surface: 'rubber' });

  let tris = 0;
  let drawCalls = 0;
  root.traverse((o) => {
    if (o.isMesh) {
      drawCalls++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });

  let time = 0;
  function update(dt = 0.016) {
    time += dt;
    const v = time;
    if (lamps && lamps.userData && lamps.userData.uTime) lamps.userData.uTime.value = v;
    if (skyline && skyline.userData && skyline.userData.uTime) skyline.userData.uTime.value = v;

    // 各自模块的眨眼/浮标动画（boat/crane/ship/gulls 的 update 只驱动自己的灯与局部动作）
    if (boat && boat.update) boat.update(dt, v);
    if (crane && crane.update) crane.update(dt, v);
    if (ship && ship.update) ship.update(dt, v);
    if (gulls && gulls.update) gulls.update(dt, v);

    if (crane && crane.spreader) {
      crane.spreader.rotation.x = 0.012 * Math.sin(v * 0.52) + 4e-3 * Math.sin(v * 1.31 + 1);
      crane.spreader.rotation.z = 9e-3 * Math.sin(v * 0.41 + 1.1);
    }
    if (ship && ship.radar) ship.radar.rotation.y = v * 1.9;
    if (boat) {
      boat.root.position.y = boatBase.y + (showcase ? 0 : 0.05 * Math.sin(v * 1.15) + 0.025 * Math.sin(v * 2.3 + 1.3));
      const hull = boat.hullGrp || boat.root;
      hull.rotation.x = 0.05 * Math.sin(v * 0.9 + 0.4) + 0.016 * Math.sin(v * 2.1);
      hull.rotation.z = 0.02 * Math.sin(v * 1.3 + 2);
    }
  }
  update(0);

  return {
    update,
    root,
    boat: boat ? boat.root : new THREE.Group(),
    crane: crane ? crane.root : null,
    ship: ship ? ship.root : null,
    skyline: skyline || null,
    gulls,
    lamps,
    colliders,
    spreader: crane ? crane.spreader || null : null,
    boatBase,
    extractionPoint: new THREE.Vector3(30, 0, 20),
    shipName: 'KITTIWAKE',
    craneId: 'YARDKIT 04',
    stats: { tris: Math.round(tris), drawCalls },
  };
}
