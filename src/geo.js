import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Deterministic Mulberry32 PRNG matching Saltline's su()
export function createRng(seed = 1337) {
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  rng.fork = () => createRng(Math.floor(rng() * 4294967296));
  return rng;
}

function hash3(ix, iy, iz) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function noise3(x, y = 0, z = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx),
         lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy),
    lerp(lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx),
         lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy),
    fz
  );
}

// World-space grime tint helper (matches Saltline's Cv() weather/rust tint)
export function weatherTint(x, y, z, base = [1, 1, 1], strength = 1) {
  const n1 = noise3(x * 0.31 + 11.3, y * 0.23 + 5.1, z * 0.31 + 3.7);
  const n2 = noise3(x * 1.7 + 40.2, 9.5, z * 1.7 + 17.9);
  const a = 1 - strength * (0.3 - 0.36 * n1);
  let r = base[0] * a, g = base[1] * a, b = base[2] * a;
  if (n2 > 0.68) {
    const f = Math.min(1, (n2 - 0.68) / 0.3) * 0.6 * strength * (0.35 + 0.65 * noise3(x * 0.9, y * 0.45, z * 0.9));
    r *= 1 + 0.45 * f;
    g *= 1 - 0.3 * f;
    b *= 1 - 0.6 * f;
  }
  return [r, g, b];
}

// --- Primitives ---

export function box(w, h, d, anchor = 'center') {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (nx > 0.5) uv.setXY(i, z, y);
    else if (ny > 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  if (anchor === 'bottom') g.translate(0, h / 2, 0);
  return g;
}

const _tmpV = new THREE.Vector3();
export function bevelBox(w, h, d, r = 0.02, anchor = 'center') {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  if (r <= 1e-4) return box(w, h, d, anchor);
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const snap = (v, lim) => (Math.abs(v) > lim - 1e-5 ? Math.sign(v) * lim : Math.sign(v) * (lim - r));
  for (let i = 0; i < pos.count; i++) {
    let x = snap(pos.getX(i), hw);
    let y = snap(pos.getY(i), hh);
    let z = snap(pos.getZ(i), hd);
    const cx = clamp(x, -(hw - r), hw - r);
    const cy = clamp(y, -(hh - r), hh - r);
    const cz = clamp(z, -(hd - r), hd - r);
    _tmpV.set(x - cx, y - cy, z - cz);
    if (_tmpV.lengthSq() > 1e-10) {
      _tmpV.normalize();
      const hits = (Math.abs(x) > hw - 1e-5 ? 1 : 0) + (Math.abs(y) > hh - 1e-5 ? 1 : 0) + (Math.abs(z) > hd - 1e-5 ? 1 : 0);
      if (hits >= 2) {
        x = cx + _tmpV.x * r;
        y = cy + _tmpV.y * r;
        z = cz + _tmpV.z * r;
        nrm.setXYZ(i, _tmpV.x, _tmpV.y, _tmpV.z);
      }
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

export function cyl(rTop, rBot, h, seg = 16, openEnded = false, anchor = 'center') {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, openEnded);
  const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
  const circum = Math.PI * (rTop + rBot);
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(nrm.getY(i)) > 0.9) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else uv.setXY(i, uv.getX(i) * circum, pos.getY(i));
  }
  if (anchor === 'bottom') g.translate(0, h / 2, 0);
  return g;
}

export function sphere(r, ws = 14, hs = 10, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  return g;
}

export function tube(points, r = 0.03, radialSeg = 8, closed = false, tension = 0.5) {
  const vecs = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
  const curve = new THREE.CatmullRomCurve3(vecs, closed, 'catmullrom', tension);
  const len = curve.getLength();
  const segs = Math.max(2, Math.min(400, Math.ceil(len / Math.max(0.08, r * 3))));
  const g = new THREE.TubeGeometry(curve, segs, r, radialSeg, closed);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * len, uv.getY(i) * Math.PI * 2 * r);
  }
  return g;
}

export function lathe(profile, seg = 16) {
  const pts = profile.map((p) => new THREE.Vector2(p[0], p[1]));
  return new THREE.LatheGeometry(pts, seg);
}

export function plane(w, h) {
  return new THREE.PlaneGeometry(w, h);
}

export function rangeBox(x0, y0, z0, x1, y1, z1, bevel = 0) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = bevel > 0 ? bevelBox(w, h, d, bevel) : box(w, h, d);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export function cylAxis(rTop, rBot, h, axis, x, y, z, seg = 12, openEnded = false) {
  const g = cyl(rTop, rBot, h, seg, openEnded);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

const _pA = new THREE.Vector3(), _pB = new THREE.Vector3(), _pQ = new THREE.Quaternion();
const _pUp = new THREE.Vector3(0, 1, 0), _pM = new THREE.Matrix4(), _pOne = new THREE.Vector3(1, 1, 1);
const toV3 = (v, out = new THREE.Vector3()) => (v.isVector3 ? out.copy(v) : out.set(v[0], v[1], v[2]));

export function pipeBetween(a, b, rTop, rBot = rTop, seg = 8, openEnded = false) {
  toV3(a, _pA);
  toV3(b, _pB);
  const dist = _pA.distanceTo(_pB);
  if (dist < 1e-5) return null;
  const g = cyl(rTop, rBot, dist, seg, openEnded);
  _pQ.setFromUnitVectors(_pUp, _pB.clone().sub(_pA).normalize());
  _pM.compose(_pA.clone().add(_pB).multiplyScalar(0.5), _pQ, _pOne);
  g.applyMatrix4(_pM);
  return g;
}

export function beamBetween(a, b, w, d, bevel = 0) {
  toV3(a, _pA);
  toV3(b, _pB);
  const len = _pA.distanceTo(_pB);
  if (len < 1e-5) return null;
  const dir = _pB.clone().sub(_pA).multiplyScalar(1 / len);
  const right = new THREE.Vector3().crossVectors(dir, _pUp);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  else right.normalize();
  const fwd = new THREE.Vector3().crossVectors(right, dir);
  const g = bevel > 0 ? bevelBox(w, len, d, bevel) : box(w, len, d);
  _pM.makeBasis(right, dir, fwd).setPosition((_pA.x + _pB.x) / 2, (_pA.y + _pB.y) / 2, (_pA.z + _pB.z) / 2);
  g.applyMatrix4(_pM);
  return g;
}

export function pipeChain(pts, r = 0.03, seg = 5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const g = pipeBetween(pts[i], pts[i + 1], r, r, seg);
    if (g) out.push(g);
  }
  return out;
}

export function parabolaPoints(a, b, sag = 1, steps = 10) {
  const va = toV3(a), vb = toV3(b), pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = new THREE.Vector3().lerpVectors(va, vb, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

export function signQuad(w, h, x, y, z, ry = 0, rx = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

export function railing(batcher, mat, pts, { h = 1.1, post = 2.2, r = 0.022, tint = null, mid = true } = {}) {
  const vecs = pts.map((p) => toV3(p));
  for (let i = 0; i < vecs.length - 1; i++) {
    const c = vecs[i], u = vecs[i + 1];
    const dist = c.distanceTo(u);
    const n = Math.max(1, Math.round(dist / post));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const p = new THREE.Vector3().lerpVectors(c, u, k / n);
      batcher.add(mat, pipeBetween(p, [p.x, p.y + h, p.z], r, r, 4), tint);
    }
    batcher.add(mat, pipeBetween([c.x, c.y + h, c.z], [u.x, u.y + h, u.z], r * 1.15, r * 1.15, 5), tint);
    if (mid) {
      batcher.add(mat, pipeBetween([c.x, c.y + h * 0.5, c.z], [u.x, u.y + h * 0.5, u.z], r * 0.9, r * 0.9, 4), tint);
    }
  }
}

export function beacon(x, y, z, r = 0.12) {
  const g = new THREE.OctahedronGeometry(r, 0);
  g.translate(x, y, z);
  return g;
}

export function createBlinkBatcher() {
  const uTime = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = `attribute vec3 blink;\nuniform float uTime;\nvarying float vBlink;\n` +
      shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float ph = uTime * blink.x + blink.y;
        vBlink = blink.x > 0.0 ? smoothstep(0.0, 0.06, sin(ph) + (1.0 - blink.z * 2.0)) : 1.0;
      `);
    shader.fragmentShader = `varying float vBlink;\n` +
      shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= vBlink;
      `);
  };
  mat.customProgramCacheKey = () => 'yardkit-blink';
  const geos = [];
  return {
    uTime,
    mat,
    add(geo, color, rate = 0, phase = 0, duty = 0.5) {
      if (!geo) return;
      const ni = geo.index ? geo.toNonIndexed() : geo;
      const count = ni.attributes.position.count;
      const cols = new Float32Array(count * 3);
      const blinks = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        cols[i * 3] = color[0]; cols[i * 3 + 1] = color[1]; cols[i * 3 + 2] = color[2];
        blinks[i * 3] = rate; blinks[i * 3 + 1] = phase; blinks[i * 3 + 2] = duty;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', ni.attributes.position);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      g.setAttribute('blink', new THREE.BufferAttribute(blinks, 3));
      geos.push(g);
    },
    build() {
      if (!geos.length) return null;
      const mesh = new THREE.Mesh(mergeGeometries(geos.splice(0), false), mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return mesh;
    },
  };
}

const _xfM = new THREE.Matrix4(), _xfQ = new THREE.Quaternion(), _xfE = new THREE.Euler();
const _xfP = new THREE.Vector3(), _xfS = new THREE.Vector3();

export function xform(geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  _xfE.set(r[0], r[1], r[2]);
  _xfQ.setFromEuler(_xfE);
  _xfP.set(p[0], p[1], p[2]);
  if (typeof s === 'number') _xfS.set(s, s, s);
  else _xfS.set(s[0], s[1], s[2]);
  _xfM.compose(_xfP, _xfQ, _xfS);
  geo.applyMatrix4(_xfM);
  return geo;
}

// 顶点色：col 可以是 RGB 数组、单个数（三通道同乘）或 (x,y,z) => 数组/数 的函数。
// 语义是「乘进已有颜色」，没有 color 属性时先铺白 —— 与 Saltline 的 Nk 一致。
export function applyVertexColor(geo, col) {
  const pos = geo.attributes.position;
  const count = pos.count;
  if (!geo.attributes.color) {
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  }
  if (col === 1 || col == null) return geo;
  const arr = geo.attributes.color.array;
  for (let i = 0; i < count; i++) {
    const c = typeof col === 'function' ? col(pos.getX(i), pos.getY(i), pos.getZ(i)) : col;
    if (typeof c === 'number') {
      arr[i * 3] *= c; arr[i * 3 + 1] *= c; arr[i * 3 + 2] *= c;
    } else if (c) {
      arr[i * 3] *= c[0]; arr[i * 3 + 1] *= c[1]; arr[i * 3 + 2] *= c[2];
    }
  }
  return geo;
}

export function mergeGeos(geos) {
  const valid = geos.filter(Boolean).map((g) => {
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  if (!valid.length) return new THREE.BufferGeometry();
  const hasColor = valid.some((g) => g.attributes.color);
  const cleaned = valid.map((g) => {
    if (hasColor && !g.attributes.color) {
      const c = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    }
    return g;
  });
  const allIndexed = cleaned.every((g) => g.index);
  const noneIndexed = cleaned.every((g) => !g.index);
  const ready = allIndexed || noneIndexed ? cleaned : cleaned.map((g) => (g.index ? g.toNonIndexed() : g));
  return mergeGeometries(ready, false) || new THREE.BufferGeometry();
}

// --- CAD / Gunsmith & Rigging Primitives ---

export function smoothNormalsCrease(geo, creaseDeg = 50) {
  const pos = geo.attributes.position.array;
  const vertCount = pos.length / 3;
  const triCount = vertCount / 3;
  const fNorms = new Float32Array(triCount * 3);
  const fAreas = new Float32Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    fNorms[t * 3] = nx / len;
    fNorms[t * 3 + 1] = ny / len;
    fNorms[t * 3 + 2] = nz / len;
    fAreas[t] = len;
  }
  const cosMax = Math.cos((creaseDeg * Math.PI) / 180);
  const buckets = new Map();
  const scale = 50000;
  for (let v = 0; v < vertCount; v++) {
    const key =
      (Math.round(pos[v * 3] * scale) + 65536) * 17179869184 +
      (Math.round(pos[v * 3 + 1] * scale) + 65536) * 131072 +
      (Math.round(pos[v * 3 + 2] * scale) + 65536);
    let list = buckets.get(key);
    if (!list) { list = []; buckets.set(key, list); }
    list.push(v);
  }
  const out = new Float32Array(vertCount * 3);
  for (const list of buckets.values()) {
    for (const v of list) {
      const t = (v / 3) | 0;
      const dx = fNorms[t * 3], dy = fNorms[t * 3 + 1], dz = fNorms[t * 3 + 2];
      let sx = 0, sy = 0, sz = 0;
      for (const o of list) {
        const ot = (o / 3) | 0;
        if (dx * fNorms[ot * 3] + dy * fNorms[ot * 3 + 1] + dz * fNorms[ot * 3 + 2] >= cosMax) {
          const w = fAreas[ot];
          sx += fNorms[ot * 3] * w;
          sy += fNorms[ot * 3 + 1] * w;
          sz += fNorms[ot * 3 + 2] * w;
        }
      }
      const glen = Math.hypot(sx, sy, sz);
      if (glen > 1e-20) {
        out[v * 3] = sx / glen; out[v * 3 + 1] = sy / glen; out[v * 3 + 2] = sz / glen;
      } else {
        out[v * 3] = dx; out[v * 3 + 1] = dy; out[v * 3 + 2] = dz;
      }
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

export function prepCadGeo(geo, color, opts = {}) {
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  const pos = nonIdx.attributes.position.array;
  const nrm = nonIdx.attributes.normal ? nonIdx.attributes.normal.array : null;
  const cleanPos = [], cleanNrm = [];
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    if (Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) >= 1e-11) {
      for (let k = 0; k < 9; k++) {
        cleanPos.push(pos[i + k]);
        if (nrm) cleanNrm.push(nrm[i + k]);
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cleanPos), 3));
  if (opts.keepN && nrm) out.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cleanNrm), 3));
  else smoothNormalsCrease(out, opts.crease || 50);

  const count = cleanPos.length / 3;
  const colArr = new Float32Array(count * 3);
  const uvArr = new Float32Array(count * 2);
  const fn = out.attributes.normal.array;
  for (let i = 0; i < count; i++) {
    const shade = opts.ao ? 1 - opts.ao * 0.25 : 1;
    // Slight directional ambient highlight so hard surfaces read crisply
    const nShade = 0.88 + 0.12 * (fn[i * 3 + 1] * 0.5 + 0.5);
    colArr[i * 3] = color[0] * shade * nShade;
    colArr[i * 3 + 1] = color[1] * shade * nShade;
    colArr[i * 3 + 2] = color[2] * shade * nShade;
    uvArr[i * 2] = cleanPos[i * 3] + cleanPos[i * 3 + 2];
    uvArr[i * 2 + 1] = cleanPos[i * 3 + 1];
  }
  out.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  return out;
}

export function roundPoly2D(pts, radius, steps = 2) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
    let r = typeof radius === 'number' ? radius : radius[i] || 0;
    const ux = prev[0] - p[0], uy = prev[1] - p[1];
    const vx = next[0] - p[0], vy = next[1] - p[1];
    const du = Math.hypot(ux, uy), dv = Math.hypot(vx, vy);
    const ang = du > 1e-9 && dv > 1e-9
      ? Math.acos(clamp((ux * vx + uy * vy) / (du * dv), -1, 1))
      : Math.PI;
    if (r <= 0 || ang > 3.05) {
      for (let k = 0; k <= steps; k++) out.push([p[0], p[1]]);
      continue;
    }
    let t = r / Math.tan(ang / 2);
    const maxT = 0.45 * Math.min(du, dv);
    if (t > maxT) { t = maxT; r = t * Math.tan(ang / 2); }
    const bx = ux / du + vx / dv, by = uy / du + vy / dv;
    const bl = Math.hypot(bx, by);
    const d = r / Math.sin(ang / 2);
    const cx = p[0] + (bx / bl) * d, cy = p[1] + (by / bl) * d;
    const a0 = Math.atan2(p[1] + (uy / du) * t - cy, p[0] + (ux / du) * t - cx);
    let da = Math.atan2(p[1] + (vy / dv) * t - cy, p[0] + (vx / dv) * t - cx) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (da * k) / steps;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return out;
}

const dedupe2D = (pts) => pts.filter((p, i) => {
  const prev = pts[(i + pts.length - 1) % pts.length];
  return Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-7;
});

export function extrudeProfile(pts, depth, bevel, holes, bs = 1) {
  const shape = new THREE.Shape();
  dedupe2D(pts).forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
  shape.closePath();
  if (holes) {
    for (const h of holes) {
      shape.holes.push(new THREE.Path(dedupe2D(h).map((p) => new THREE.Vector2(p[0], p[1]))));
    }
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: bs || 1,
    steps: 1,
    curveSegments: 6,
  });
}

export function extrudeX(pts, x0, x1, bevel, color, opts = {}) {
  const g = prepCadGeo(extrudeProfile(pts, x1 - x0, bevel, opts.holes, opts.bs), color, opts);
  g.translate(0, 0, x0 + bevel);
  g.rotateY(Math.PI / 2);
  return g;
}

export function extrudeZ(pts, z0, z1, bevel, color, opts = {}) {
  const g = prepCadGeo(extrudeProfile(pts, z1 - z0, bevel, opts.holes, opts.bs), color, opts);
  g.translate(0, 0, -z1 + bevel);
  return g;
}

export function latheSection(profile, seg, color, opts = {}) {
  const segNorms = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const dx = profile[i + 1][0] - profile[i][0];
    const dy = profile[i + 1][1] - profile[i][1];
    const len = Math.hypot(dx, dy);
    segNorms.push(len < 1e-8 ? null : { nr: dy / len, nf: -dx / len, len });
  }
  const cosMax = Math.cos(((opts.crease || 50) * Math.PI) / 180);
  const ox = opts.ox || 0, oy = opts.oy || 0;
  const smooth = (i, j) => {
    const a = segNorms[i];
    const b = j >= 0 && j < segNorms.length ? segNorms[j] : null;
    let nr = a.nr * a.len, nf = a.nf * a.len;
    if (b && a.nr * b.nr + a.nf * b.nf >= cosMax) {
      nr += b.nr * b.len;
      nf += b.nf * b.len;
    }
    const len = Math.hypot(nr, nf);
    return [nr / len, nf / len];
  };
  const pos = [], nrm = [], idx = [];
  let base = 0;
  for (let i = 0; i < segNorms.length; i++) {
    if (!segNorms[i]) continue;
    let p = i - 1, q = i + 1;
    while (p >= 0 && !segNorms[p]) p--;
    while (q < segNorms.length && !segNorms[q]) q++;
    const na = smooth(i, p), nb = smooth(i, q);
    const [ra, za] = profile[i], [rb, zb] = profile[i + 1];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      pos.push(ox + ra * c, oy + ra * sn, -za, ox + rb * c, oy + rb * sn, -zb);
      nrm.push(na[0] * c, na[0] * sn, -na[1], nb[0] * c, nb[0] * sn, -nb[1]);
    }
    for (let s = 0; s < seg; s++) {
      const v0 = base + s * 2, v1 = v0 + 2, v2 = v0 + 1, v3 = v0 + 3;
      idx.push(v0, v2, v1, v1, v2, v3);
    }
    base += (seg + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return prepCadGeo(g, color, { keepN: true, ...opts });
}

export function loftSections(sections, color, opts = {}) {
  const n = sections[0].length, m = sections.length;
  const caps = opts.caps || [true, true];
  const avg = (ring) => {
    let x = 0, y = 0, z = 0;
    for (const p of ring) { x += p[0]; y += p[1]; z += p[2]; }
    return [x / n, y / n, z / n];
  };
  const centers = sections.map(avg);
  let vol = 0;
  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < n; j++) {
      const p = sections[i][j], q = sections[i][(j + 1) % n], r = sections[i + 1][j];
      const ax = q[0] - p[0], ay = q[1] - p[1], az = q[2] - p[2];
      const bx = r[0] - p[0], by = r[1] - p[1], bz = r[2] - p[2];
      vol += (ay * bz - az * by) * (p[0] - centers[i][0]) +
             (az * bx - ax * bz) * (p[1] - centers[i][1]) +
             (ax * by - ay * bx) * (p[2] - centers[i][2]);
    }
  }
  const pos = [];
  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < n; j++) {
      const p0 = sections[i][j], p1 = sections[i][(j + 1) % n];
      const p2 = sections[i + 1][(j + 1) % n], p3 = sections[i + 1][j];
      if (vol >= 0) pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
      else pos.push(...p0, ...p2, ...p1, ...p0, ...p3, ...p2);
    }
  }
  for (const end of [0, 1]) {
    if (!caps[end]) continue;
    const ring = sections[end ? m - 1 : 0];
    const c0 = centers[end ? m - 1 : 0], c1 = centers[end ? m - 2 : 1];
    const dir = [c0[0] - c1[0], c0[1] - c1[1], c0[2] - c1[2]];
    const ax = Math.abs(dir[0]), ay = Math.abs(dir[1]), az = Math.abs(dir[2]);
    const u = ax > ay && ax > az ? 1 : 0;
    const v = (ay > ax && ay > az) || u === 1 ? 2 : 1;
    const idxMap = [], vecs = [];
    ring.forEach((p, idx) => {
      const prev = ring[(idx + n - 1) % n];
      if (Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) > 1e-7) {
        idxMap.push(idx);
        vecs.push(new THREE.Vector2(p[u], p[v]));
      }
    });
    for (const tri of THREE.ShapeUtils.triangulateShape(vecs, [])) {
      const a = ring[idxMap[tri[0]]], b = ring[idxMap[tri[1]]], c = ring[idxMap[tri[2]]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const dot = (uy * vz - uz * vy) * dir[0] + (uz * vx - ux * vz) * dir[1] + (ux * vy - uy * vx) * dir[2];
      if (dot >= 0) pos.push(...a, ...b, ...c);
      else pos.push(...a, ...c, ...b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return prepCadGeo(g, color, opts);
}

// --- Batchers & Builders ---

// Static Geometry Batcher (used by Crane, Ship, Boat)
export class MeshBatcher {
  constructor() {
    this.buckets = new Map();
  }
  add(mat, geo, tint = null) {
    if (!geo) return;
    if (Array.isArray(geo)) {
      for (const g of geo) this.add(mat, g, tint);
      return;
    }
    if (tint) applyVertexColor(geo, (x, y, z) => weatherTint(x, y, z, tint, 0.85));
    let bucket = this.buckets.get(mat.uuid);
    if (!bucket) { bucket = { mat, geos: [] }; this.buckets.set(mat.uuid, bucket); }
    bucket.geos.push(geo);
  }
  build({ cast = true, recv = true } = {}) {
    const group = new THREE.Group();
    for (const b of this.buckets.values()) {
      const geo = mergeGeos(b.geos);
      const mesh = new THREE.Mesh(geo, b.mat);
      const isTrans = b.mat.isMeshBasicMaterial || b.mat.transparent;
      mesh.castShadow = cast && !isTrans;
      mesh.receiveShadow = recv && !isTrans;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}

// Skinned Rig Builder (used by Hound Mech & Gull Drone)
export class RigBuilder {
  constructor() {
    this.bones = [];
    this.index = {};
    this.slots = {};
    this.order = [];
  }
  bone(name, parentName, x = 0, y = 0, z = 0) {
    const p = parentName ? this.bones[this.index[parentName]] : null;
    if (parentName && !p) throw new Error(`RigBuilder: unknown parent bone "${parentName}"`);
    const b = {
      name,
      parent: p ? p.i : -1,
      local: [x, y, z],
      world: [x + (p ? p.world[0] : 0), y + (p ? p.world[1] : 0), z + (p ? p.world[2] : 0)],
      i: this.bones.length,
    };
    this.index[name] = b.i;
    this.bones.push(b);
    return b;
  }
  add(slot, boneName, geo, color = [1, 1, 1], shadeNormals = true) {
    const b = this.bones[this.index[boneName]];
    if (!b) throw new Error(`RigBuilder: unknown bone "${boneName}"`);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    for (const k of Object.keys(geo.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    }
    const count = geo.attributes.position.count;
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    geo.translate(b.world[0], b.world[1], b.world[2]);
    const colArr = new Float32Array(count * 3);
    const skinIdx = new Uint16Array(count * 4);
    const skinW = new Float32Array(count * 4);
    const nrm = geo.attributes.normal;
    for (let i = 0; i < count; i++) {
      const shade = shadeNormals ? 0.74 + 0.26 * (nrm.getY(i) * 0.5 + 0.5) : 1;
      colArr[i * 3] = color[0] * shade;
      colArr[i * 3 + 1] = color[1] * shade;
      colArr[i * 3 + 2] = color[2] * shade;
      skinIdx[i * 4] = b.i;
      skinW[i * 4] = 1;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIdx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinW, 4));
    if (!this.slots[slot]) { this.slots[slot] = []; this.order.push(slot); }
    this.slots[slot].push(geo);
    return geo;
  }
  build(slotOrder) {
    const slots = (slotOrder || this.order).filter((s) => this.slots[s] && this.slots[s].length);
    const mergedPerSlot = slots.map((s) => {
      const list = this.slots[s];
      const nonIdx = list.some((g) => !g.index) ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
      const m = mergeGeometries(nonIdx, false);
      return m.index ? m.toNonIndexed() : m;
    });
    const geometry = mergeGeometries(mergedPerSlot, true);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return { geometry, slots, bones: this.bones, tris: geometry.attributes.position.count / 3 };
  }
}

export function instantiateRig(rigDef, materials, { castShadow = true, receiveShadow = true, radius = 1.5, center = [0, 0.5, 0], extra = null } = {}) {
  const bones = rigDef.bones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.position.set(b.local[0], b.local[1], b.local[2]);
    return bone;
  });
  rigDef.bones.forEach((b, i) => { if (b.parent >= 0) bones[b.parent].add(bones[i]); });
  const group = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(rigDef.geometry, rigDef.slots.map((s) => materials[s]));
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  group.add(mesh);
  rigDef.bones.forEach((b, i) => { if (b.parent < 0) mesh.add(bones[i]); });
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), radius);
  mesh.boundingBox = new THREE.Box3(
    new THREE.Vector3(center[0] - radius, center[1] - radius, center[2] - radius),
    new THREE.Vector3(center[0] + radius, center[1] + radius, center[2] + radius)
  );
  const boneMap = {};
  bones.forEach((b) => { boneMap[b.name] = b; });
  const out = { group, mesh, bones: boneMap, skeleton, extraMesh: null };
  if (extra) {
    const em = new THREE.SkinnedMesh(extra.def.geometry, extra.def.slots.map((s) => materials[s]));
    em.castShadow = false;
    em.receiveShadow = false;
    em.renderOrder = 5;
    group.add(em);
    em.updateMatrixWorld(true);
    em.bind(skeleton, mesh.bindMatrix);
    em.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), extra.radius || radius);
    em.boundingBox = new THREE.Box3().setFromCenterAndSize(
      em.boundingSphere.center,
      new THREE.Vector3(1, 1, 1).multiplyScalar(2 * (extra.radius || radius))
    );
    out.extraMesh = em;
  }
  return out;
}

// Prop Builder with matrix stack + grime pass (used by industrial props)
// 沿弧面铺开的贴花条（圆柱面上的标识），用于桶身/管身这类曲面
export function arcDecalGeo(radius, arcWidth, height, seg = 4) {
  const pos = [], nrm = [], uvs = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg - 0.5) * (arcWidth / radius);
    const s = Math.sin(a), c = Math.cos(a);
    pos.push(radius * s, -height / 2, radius * c, radius * s, height / 2, radius * c);
    nrm.push(s, 0, c, s, 0, c);
    uvs.push(i / seg, 0, i / seg, 1);
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2;
    idx.push(k, k + 2, k + 3, k, k + 3, k + 1);
  }
  return geoFromArrays(pos, nrm, uvs, idx);
}

export function geoFromArrays(pos, nrm, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (idx) g.setIndex(idx);
  if (!nrm) g.computeVertexNormals();
  return g;
}

export class PropBuilder {
  constructor(mats, name = 'prop', seed = 1) {
    this.mats = mats;
    this.name = name;
    this.seed = Math.abs(seed | 0);
    this.rng = createRng((this.seed + 1) * 7919 + name.length * 131);
    this.buckets = new Map();
    this.stack = [new THREE.Matrix4()];
  }
  // 取材质时默认开顶点色（道具靠顶点色做磨损/脏污）
  mat(name, opts) { return this.mats.get(name, { vertexColors: true, ...(opts || {}) }); }
  // 与 Saltline 的 Wn.label(text, opts, maxWidth, height, xf) 同签名
  label(text, opts, maxWidth, h, xf) {
    const info = this.mats.label(text, opts || {});
    const aspect = info.aspect || 1;
    const w = maxWidth ? Math.min(maxWidth, h * aspect) : h * aspect;
    return this.add(info.material, plane(w, w / aspect), xf, 1, { raw: true, cast: false });
  }
  decal(info, h, xf) {
    return this.add(info.material, plane(h * (info.aspect || 1), h), xf, 1, { raw: true, cast: false });
  }
  // 曲面贴花：贴到半径 radius 的圆柱面上，弧宽 = 高度 × 宽高比
  cdecal(info, radius, h, xf, wOverride) {
    const g = arcDecalGeo(radius, wOverride || h * (info.aspect || 1), h);
    return this.add(info.material, g, xf, 1, { raw: true, cast: false });
  }
  push(xf) {
    _xfE.set((xf.r && xf.r[0]) || 0, (xf.r && xf.r[1]) || 0, (xf.r && xf.r[2]) || 0);
    _xfQ.setFromEuler(_xfE);
    _xfP.set((xf.p && xf.p[0]) || 0, (xf.p && xf.p[1]) || 0, (xf.p && xf.p[2]) || 0);
    if (typeof xf.s === 'number') _xfS.set(xf.s, xf.s, xf.s);
    else if (xf.s) _xfS.set(xf.s[0], xf.s[1], xf.s[2]);
    else _xfS.set(1, 1, 1);
    const local = new THREE.Matrix4().compose(_xfP, _xfQ, _xfS);
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(local));
    return this;
  }
  pop() {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }
  add(matOrName, geo, xf = null, col = 1, { raw = false, cast = true } = {}) {
    if (!geo) return geo;
    const mat = typeof matOrName === 'string' ? this.mats.get(matOrName, { vertexColors: true }) : matOrName;
    if (xf) xform(geo, xf);
    geo.applyMatrix4(this.stack[this.stack.length - 1]);
    if (!raw) {
      const pos = geo.attributes.position;
      let colAttr = geo.attributes.color;
      if (!colAttr) {
        colAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3);
        geo.setAttribute('color', colAttr);
      }
      if (col !== 1 && col != null) applyVertexColor(geo, col);
    }
    const key = mat.uuid + (cast ? ':c' : ':n');
    let b = this.buckets.get(key);
    if (!b) { b = { mat, geos: [], raw, cast }; this.buckets.set(key, b); }
    b.geos.push(geo);
    return geo;
  }
  finish({ grime = 0.8, size = null, colliders = null, surface = null } = {}) {
    const group = new THREE.Group();
    group.name = this.name;
    const s = this.seed * 3.71;
    for (const b of this.buckets.values()) {
      const geo = mergeGeos(b.geos);
      if (!b.raw && grime > 0 && geo.attributes.color) {
        const pos = geo.attributes.position, nrm = geo.attributes.normal, col = geo.attributes.color.array;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nrm.getY(i);
          const n1 = noise3(x * 1.9 + s, y * 1.9, z * 1.9 + 5.3);
          const n2 = noise3(x * 9 + 2.1, y * 9 + s, z * 9);
          let f = (0.84 + 0.16 * n1) * (0.93 + 0.07 * n2) * (0.78 + 0.22 * clamp(ny * 0.6 + 0.62, 0, 1));
          const dirt = clamp(1 - y / 0.2, 0, 1);
          f *= 1 - 0.35 * dirt * dirt * (0.55 + 0.45 * n2);
          f = 1 + (f - 1) * grime;
          col[i * 3] *= f;
          col[i * 3 + 1] *= f * (1 - 0.04 * dirt * grime);
          col[i * 3 + 2] *= f * (1 - 0.1 * dirt * grime);
        }
      }
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.buckets.clear();
    // 尺寸 / 碰撞盒（游戏里来自 Yi 规格表，供物理与导航复用）
    const dims = size || [1, 1, 1];
    group.userData.size = dims;
    group.userData.colliders = colliders || [{
      min: [-dims[0] / 2, 0, -dims[2] / 2],
      max: [dims[0] / 2, dims[1], dims[2] / 2],
      surface: surface || 'metal',
    }];
    return group;
  }
}
