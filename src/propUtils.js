import * as THREE from 'three';
import {
  box,
  bevelBox,
  cyl,
  sphere,
  tube,
  lathe,
  pipeBetween,
  beamBetween,
  xform,
  applyVertexColor,
  mergeGeos,
  createRng,
  noise3,
  clamp,
  smoothstep,
} from './geo.js';

export { createRng, noise3, clamp, smoothstep, sphere, tube, lathe, pipeBetween, beamBetween };

export const mixRgb = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function noise2(x, y) {
  return noise3(x, y, 0);
}

export function flatUVPlane(w, h, u0 = 0, v0 = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + u0, pos.getY(i) + v0);
  return g;
}

export function flatUVBox(w, h, d, anchor = 'center') {
  return box(w, h, d, anchor);
}

export function chamferBox(w, h, d, r = 0.008, anchor = 'center') {
  return r > 0 ? bevelBox(w, h, d, r, anchor) : box(w, h, d, anchor);
}

export function segBox(w, h, d, r = 0.03, sw = 3, sh = 3, sd = 3, anchor = 'center') {
  const g = new THREE.BoxGeometry(w, h, d, sw, sh, sd);
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  r = Math.min(r, hw * 0.95, hh * 0.95, hd * 0.95);
  const snap = (v, half, s) => {
    if (Math.abs(v) > half - 1e-6 || s < 3) return v;
    const step = (2 * half) / s;
    return (v * (half - r)) / (half - step);
  };
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let x = snap(pos.getX(i), hw, sw);
    let y = snap(pos.getY(i), hh, sh);
    let z = snap(pos.getZ(i), hd, sd);
    const cx = clamp(x, -(hw - r), hw - r);
    const cy = clamp(y, -(hh - r), hh - r);
    const cz = clamp(z, -(hd - r), hd - r);
    tmp.set(x - cx, y - cy, z - cz);
    const hits = (Math.abs(x) > hw - 1e-5 ? 1 : 0) + (Math.abs(y) > hh - 1e-5 ? 1 : 0) + (Math.abs(z) > hd - 1e-5 ? 1 : 0);
    if (hits >= 2 && tmp.lengthSq() > 1e-12) {
      tmp.normalize();
      x = cx + tmp.x * r;
      y = cy + tmp.y * r;
      z = cz + tmp.z * r;
      nrm.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    pos.setXYZ(i, x, y, z);
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    if (nx >= ny && nx >= nz) uv.setXY(i, z, y);
    else if (ny >= nx && ny >= nz) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  if (anchor === 'bottom') g.translate(0, h / 2, 0);
  return g;
}

export function deformGeo(geo, fn) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

export function recomputeSmoothNormals(geo) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const count = pos.count;
  const map = new Map();
  const keys = new Array(count);
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    keys[i] = k;
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const triN = idx ? idx.count : count;
  for (let i = 0; i < triN; i += 3) {
    const i0 = idx ? idx.getX(i) : i;
    const i1 = idx ? idx.getX(i + 1) : i + 1;
    const i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1).sub(a);
    c.fromBufferAttribute(pos, i2).sub(a);
    b.cross(c);
    for (const k of [i0, i1, i2]) {
      let acc = map.get(keys[k]);
      if (!acc) { acc = [0, 0, 0]; map.set(keys[k], acc); }
      acc[0] += b.x; acc[1] += b.y; acc[2] += b.z;
    }
  }
  const nrm = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = map.get(keys[i]) || [0, 1, 0];
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    nrm[i * 3] = v[0] / len;
    nrm[i * 3 + 1] = v[1] / len;
    nrm[i * 3 + 2] = v[2] / len;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geo;
}

export function invertGeo(geo) {
  if (geo.index) {
    const arr = geo.index.array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = t;
    }
  } else {
    for (const k of Object.keys(geo.attributes)) {
      const attr = geo.attributes[k], sz = attr.itemSize, arr = attr.array;
      for (let i = 0; i < attr.count; i += 3) {
        for (let s = 0; s < sz; s++) {
          const i1 = (i + 1) * sz + s, i2 = (i + 2) * sz + s;
          const t = arr[i1]; arr[i1] = arr[i2]; arr[i2] = t;
        }
      }
    }
  }
  const nrm = geo.attributes.normal.array;
  for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i];
  return geo;
}

export function dropBoxGroup(geo, groupIdx) {
  const grp = geo.groups[groupIdx];
  if (!grp || !geo.index) return geo;
  const idx = Array.from(geo.index.array);
  idx.splice(grp.start, grp.count);
  geo.setIndex(idx);
  for (const g of geo.groups) if (g.start > grp.start) g.start -= grp.count;
  grp.count = 0;
  return geo;
}

export function latheGeo(pts, seg = 16) {
  const g = lathe(pts, seg);
  return g;
}

export function uvTorus(R, r, radialSeg = 6, tubSeg = 12, arc = Math.PI * 2) {
  const g = new THREE.TorusGeometry(R, r, radialSeg, tubSeg, arc);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * arc * R, uv.getY(i) * 2 * Math.PI * r);
  return g;
}

export function uvSphere(r, ws = 8, hs = 6) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * Math.PI * r);
  return g;
}

export function curvedDecalGeo(radius, arcWidth, height, seg = 6) {
  const pos = [], nrm = [], uvs = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = ((i / seg - 0.5) * arcWidth) / radius;
    const sn = Math.sin(a), cs = Math.cos(a);
    pos.push(radius * sn, -height / 2, radius * cs, radius * sn, height / 2, radius * cs);
    nrm.push(sn, 0, cs, sn, 0, cs);
    uvs.push(i / seg, 0, i / seg, 1);
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2;
    idx.push(k, k + 2, k + 3, k, k + 3, k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

export function extrude2DPoly(pts, depth, { soft = 0.6, caps = true } = {}) {
  const n = pts.length;
  const pos = [], nrm = [], uvs = [], idx = [];
  const edgeN = [], dists = [0];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    edgeN.push([dy / len, -dx / len]);
    total += len;
    dists.push(total);
  }
  const vertN = (eIdx, adjIdx) => {
    const a = edgeN[eIdx], b = edgeN[(adjIdx + n) % n];
    if (a[0] * b[0] + a[1] * b[1] > Math.cos(soft)) {
      const sx = a[0] + b[0], sy = a[1] + b[1];
      const len = Math.hypot(sx, sy) || 1;
      return [sx / len, sy / len];
    }
    return a;
  };
  const hz = depth / 2;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const na = vertN(i, i - 1), nb = vertN(i, i + 1);
    const k = pos.length / 3;
    pos.push(a[0], a[1], hz, a[0], a[1], -hz, b[0], b[1], -hz, b[0], b[1], hz);
    nrm.push(na[0], na[1], 0, na[0], na[1], 0, nb[0], nb[1], 0, nb[0], nb[1], 0);
    uvs.push(dists[i], hz, dists[i], -hz, dists[i + 1], -hz, dists[i + 1], hz);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  if (caps) {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const s of [1, -1]) {
      const base = pos.length / 3;
      for (const p of pts) {
        pos.push(p[0], p[1], s * hz);
        nrm.push(0, 0, s);
        uvs.push(p[0], p[1]);
      }
      for (const t of tris) {
        if (s > 0) idx.push(base + t[0], base + t[1], base + t[2]);
        else idx.push(base + t[0], base + t[2], base + t[1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

export function strapRibbon(pts, wVec, twoSided = true) {
  const n = pts.length;
  const pos = [], uvs = [], idx = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    pos.push(
      pts[i][0] - wVec[0], pts[i][1] - wVec[1], pts[i][2] - wVec[2],
      pts[i][0] + wVec[0], pts[i][1] + wVec[1], pts[i][2] + wVec[2]
    );
    uvs.push(acc, 0, acc, Math.hypot(wVec[0], wVec[1], wVec[2]) * 2);
  }
  for (let i = 0; i < n - 1; i++) {
    const k = i * 2;
    idx.push(k, k + 1, k + 3, k, k + 3, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!twoSided) return g;
  const back = g.clone();
  const bi = back.index.array;
  for (let i = 0; i < bi.length; i += 3) { const t = bi[i + 1]; bi[i + 1] = bi[i + 2]; bi[i + 2] = t; }
  const bn = back.attributes.normal.array;
  for (let i = 0; i < bn.length; i++) bn[i] = -bn[i];
  return mergeGeos([g, back]);
}

export function roundedCornerPlate(w, h, rSeg = 5) {
  const rad = Math.min(w, h) / 2;
  const ox = w / 2 - rad, oy = h / 2 - rad;
  const pts = [];
  for (let q = 0; q < 4; q++) {
    for (let i = 0; i <= rSeg; i++) {
      const a = ((q + i / rSeg) * Math.PI) / 2;
      pts.push([Math.cos(a) * rad + (q === 0 || q === 3 ? ox : -ox), Math.sin(a) * rad + (q < 2 ? oy : -oy)]);
    }
  }
  const pos = [], uvs = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    pos.push(0, 0, 0, a[0], a[1], 0, b[0], b[1], 0);
    uvs.push(0.5, 0.5, a[0] / w + 0.5, a[1] / h + 0.5, b[0] / w + 0.5, b[1] / h + 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

export function corrugationSteps(x0, x1, pitch, depth, flat, slope, phase = x0) {
  const trough = pitch - flat - 2 * slope;
  const stops = [0, flat, flat + slope, flat + slope + trough];
  const xs = [x0];
  const i0 = Math.floor((x0 - phase) / pitch) - 1;
  const i1 = Math.ceil((x1 - phase) / pitch) + 1;
  for (let i = i0; i <= i1; i++) {
    for (const s of stops) {
      const x = phase + i * pitch + s;
      if (x > x0 + 1e-4 && x < x1 - 1e-4) xs.push(x);
    }
  }
  xs.push(x1);
  const evalY = (t) => {
    let o = t % pitch;
    if (o < 0) o += pitch;
    if (o <= flat) return 0;
    if (o < flat + slope) return (-depth * (o - flat)) / slope;
    if (o <= flat + slope + trough) return -depth;
    return -depth * (1 - (o - flat - slope - trough) / slope);
  };
  return xs.map((x) => [x, evalY(x - phase)]);
}

function orientSweepTriangles(pos, uvs, startIdx, endIdx, center, inward) {
  let vol = 0;
  for (let i = startIdx; i < endIdx; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    vol +=
      nx * ((pos[i] + pos[i + 3] + pos[i + 6]) / 3 - center[0]) +
      ny * ((pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3 - center[1]) +
      nz * ((pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3 - center[2]);
  }
  if ((vol < 0) !== !!inward) {
    for (let i = startIdx; i < endIdx; i += 9) {
      for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
      const ui = (i / 3) * 2;
      for (let k = 0; k < 2; k++) { const t = uvs[ui + 2 + k]; uvs[ui + 2 + k] = uvs[ui + 4 + k]; uvs[ui + 4 + k] = t; }
    }
  }
}

export function sweepProfile(profile, pathVals, mapFn, { closed = false, center = null, inward = false, caps = false } = {}) {
  const pos = [], uvs = [];
  const n = profile.length, segs = closed ? n : n - 1;
  const dists = [0];
  for (let i = 0; i < segs; i++) {
    const a = profile[i], b = profile[(i + 1) % n];
    dists.push(dists[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  for (let pi = 0; pi < pathVals.length - 1; pi++) {
    const v0 = pathVals[pi], v1 = pathVals[pi + 1];
    for (let i = 0; i < segs; i++) {
      const a = profile[i], b = profile[(i + 1) % n];
      const m0 = mapFn(a[0], a[1], v0, pi);
      const m1 = mapFn(b[0], b[1], v0, pi);
      const m2 = mapFn(b[0], b[1], v1, pi + 1);
      const m3 = mapFn(a[0], a[1], v1, pi + 1);
      pos.push(...m0, ...m1, ...m2, ...m0, ...m2, ...m3);
      uvs.push(dists[i], v0, dists[i + 1], v0, dists[i + 1], v1, dists[i], v0, dists[i + 1], v1, dists[i], v1);
    }
  }
  const endIdx = pos.length;
  let ctr = center;
  if (!ctr) {
    ctr = [0, 0, 0];
    for (let i = 0; i < endIdx; i += 3) { ctr[0] += pos[i]; ctr[1] += pos[i + 1]; ctr[2] += pos[i + 2]; }
    const inv = 3 / (endIdx || 3);
    ctr[0] *= inv; ctr[1] *= inv; ctr[2] *= inv;
  }
  orientSweepTriangles(pos, uvs, 0, endIdx, ctr, inward);
  if (caps && closed) {
    let cx = 0, cy = 0;
    for (const p of profile) { cx += p[0]; cy += p[1]; }
    cx /= n; cy /= n;
    for (const ei of [0, pathVals.length - 1]) {
      const cs = pos.length, ev = pathVals[ei], cp = mapFn(cx, cy, ev, ei);
      for (let i = 0; i < n; i++) {
        const a = profile[i], b = profile[(i + 1) % n];
        pos.push(...cp, ...mapFn(a[0], a[1], ev, ei), ...mapFn(b[0], b[1], ev, ei));
        uvs.push(cx, cy, a[0], a[1], b[0], b[1]);
      }
      orientSweepTriangles(pos, uvs, cs, pos.length, ctr, inward);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

export function tireProfileGeo(rOut, width, rIn, seg = 20) {
  const rim = rOut - rIn, lip = Math.min(0.011, rim * 0.08);
  const prof = [
    [rIn, width * 0.18], [rIn + rim * 0.45, width * 0.035], [rOut - rim * 0.2, width * 0.02],
    [rOut - rim * 0.06, width * 0.07], [rOut, width * 0.17], [rOut, width * 0.17],
    [rOut, width * 0.355], [rOut - lip, width * 0.385], [rOut, width * 0.415],
    [rOut, width * 0.585], [rOut - lip, width * 0.615], [rOut, width * 0.645],
    [rOut, width * 0.83], [rOut, width * 0.83], [rOut - rim * 0.06, width * 0.93],
    [rOut - rim * 0.2, width * 0.98], [rIn + rim * 0.45, width * 0.965], [rIn, width * 0.82],
    [rIn, width * 0.82], [rIn, width * 0.18],
  ];
  const g = latheGeo(prof, seg);
  const uv = g.attributes.uv, lens = [0];
  for (let i = 1; i < prof.length; i++) lens.push(lens[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const mid = (lens[8] + lens[9]) / 2, h1 = mid - lens[4], h2 = lens[4] - lens[0];
  const repU = Math.max(1, Math.round((2 * Math.PI * rOut) / 0.5)) * 0.5;
  for (let i = 0; i < prof.length; i++) {
    const d = i >= prof.length - 2 ? -(h1 + h2) : lens[i] - mid;
    const ad = Math.abs(d);
    const v = Math.sign(d) * (ad <= h1 + 1e-6 ? (ad / h1) * 0.126 : 0.126 + Math.min(1, (ad - h1) / h2) * 0.022);
    for (let s = 0; s <= seg; s++) uv.setXY(i * (seg + 1) + s, (s / seg) * repU, v);
  }
  return g;
}

const COLOR_MAP = {
  red: ['paint_red', 1],
  blue: ['paint_blue', 1],
  green: ['paint_green', 1],
  yellow: ['paint_yellow', 1],
  orange: ['paint_orange', 1],
  white: ['paint_white', 1],
  grey: ['paint_grey', 1],
  teal: ['paint_teal', 1],
  rust: ['steel_rust', 1],
  black: ['paint_grey', [0.2, 0.2, 0.22]],
  olive: ['paint_green', [0.75, 0.8, 0.45]],
};
export const resolveColor = (c, def = 'blue') => COLOR_MAP[c] || COLOR_MAP[def];

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

// PartBuilder closely matching Saltline's On builder for architectural & container structures
export class PartBuilder {
  constructor(mats) {
    this.mats = mats;
    this.buckets = new Map();
    this.stack = [];
    this.cur = null;
    this.defCol = new Map();
  }
  M(name, opts) { return this.mats.get(name, opts); }
  push(xf) {
    this.stack.push(this.cur);
    const m = xf.isMatrix4 ? xf.clone() : composeXF(xf);
    this.cur = this.cur ? this.cur.clone().multiply(m) : m;
    return this;
  }
  pushEuler(x = 0, y = 0, z = 0, r = null) {
    if (r) _q.setFromEuler(_e.set(r[0], r[1], r[2]));
    else _q.identity();
    return this.push(new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s));
  }
  pop() {
    this.cur = this.stack.pop() || null;
    return this;
  }
  add(matOrKey, geo, col = null, noCast = false) {
    if (!geo) return null;
    if (this.cur) geo.applyMatrix4(this.cur);
    const c = col || this.defCol.get(matOrKey);
    if (c) applyVertexColor(geo, c);
    let b = this.buckets.get(matOrKey);
    if (!b) { b = { mat: matOrKey, geos: [], cast: !noCast }; this.buckets.set(matOrKey, b); }
    b.geos.push(geo);
    return geo;
  }
  box(mat, w, h, d, x = 0, y = 0, z = 0, opts = {}) {
    const g = opts.r === 0 ? box(w, h, d) : bevelBox(w, h, d, opts.r ?? Math.min(0.012, Math.min(w, h, d) * 0.25));
    if (opts.rot) _e.set(opts.rot[0], opts.rot[1], opts.rot[2]), _q.setFromEuler(_e);
    else _q.identity();
    g.applyMatrix4(_m4.compose(_p.set(x, y, z), _q, _s));
    return this.add(mat, g, opts.col);
  }
  cyl(mat, rt, rb, h, x = 0, y = 0, z = 0, opts = {}) {
    let g = cyl(rt, rb, h, opts.seg || 12, !!opts.open);
    if (opts.flat) {
      g = g.index ? g.toNonIndexed() : g;
      g.computeVertexNormals();
    }
    if (opts.rot) _e.set(opts.rot[0], opts.rot[1], opts.rot[2]), _q.setFromEuler(_e);
    else _q.identity();
    g.applyMatrix4(_m4.compose(_p.set(x, y, z), _q, _s));
    return this.add(mat, g, opts.col);
  }
  tube(mat, pts, r = 0.02, opts = {}) {
    return this.add(mat, tube(pts, r, opts.seg || 6, false, opts.tension ?? 0.5), opts.col);
  }
  bar(mat, a, b, r, opts = {}) {
    const g = pipeBetween(a, b, opts.r2 ?? r, r, opts.seg || 6, !opts.caps);
    return this.add(mat, g, opts.col);
  }
  beam(mat, a, b, w, d, opts = {}) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    if (len < 1e-5) return null;
    dir.multiplyScalar(1 / len);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, dir);
    if (opts.twist) q.multiply(new THREE.Quaternion().setFromAxisAngle(_up, opts.twist));
    const g = opts.r === 0 ? box(w, len, d) : bevelBox(w, len, d, opts.r || Math.min(w, d) * 0.2);
    g.applyMatrix4(_m4.compose(va.add(vb).multiplyScalar(0.5), q, _s));
    return this.add(mat, g, opts.col);
  }
  decal(info, h, x, y, z, rot = null, wOverride = null) {
    const g = new THREE.PlaneGeometry(wOverride || h * (info.aspect || 1), h);
    if (rot) _e.set(rot[0], rot[1], rot[2]), _q.setFromEuler(_e);
    else _q.identity();
    g.applyMatrix4(_m4.compose(_p.set(x, y, z), _q, _s));
    return this.add(info.material, g, null, true);
  }
  xf(geo, x = 0, y = 0, z = 0, rot = null) {
    return xform(geo, { p: [x, y, z], r: rot || [0, 0, 0] });
  }
  toGroup(matRemap = null) {
    const grp = new THREE.Group();
    for (const b of this.buckets.values()) {
      const mat = (matRemap && matRemap.get(b.mat)) || b.mat;
      const m = new THREE.Mesh(mergeGeos(b.geos), mat);
      m.castShadow = b.cast;
      m.receiveShadow = true;
      grp.add(m);
    }
    return grp;
  }
}

function composeXF({ p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  const e = new THREE.Euler(r[0], r[1], r[2]);
  const q = new THREE.Quaternion().setFromEuler(e);
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), q, sc);
}
