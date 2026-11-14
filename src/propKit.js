// 道具层用到的低层几何/工具函数（原本散落在 Saltline 主程序里的匿名 helper）。
// 与 geo.js / propUtils.js 的关系：这里只放「道具专用、别处用不到」的那几个。
import * as THREE from 'three';
import { box, bevelBox, cyl, plane } from './geo.js';

export const HALF_PI = Math.PI / 2;

// 贴花朝向（+Z/-Z/+X/-X）
export const AXIS_ROT = {
  pz: [0, 0, 0],
  nz: [0, Math.PI, 0],
  px: [0, Math.PI / 2, 0],
  nx: [0, -Math.PI / 2, 0],
};

// 整数哈希 → [0,1)，与 value noise 配套（noise3 用同一套哈希）
export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 顺时针多边形反转为逆时针（挤出面朝外）
export function ensureCCW(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area < 0 ? pts.slice().reverse() : pts;
}

// 同名几何体的浅克隆缓存（同一桶/托板/锥桶按种子复用）
const cloneCache = new Map();
export function memoClone(key, make) {
  let g = cloneCache.get(key);
  if (!g) { g = make(); cloneCache.set(key, g); }
  return g.clone(true);
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);

// 就地平移/旋转几何体
export function placeGeo(geo, x = 0, y = 0, z = 0, rot = null) {
  if (rot) _e.set(rot[0], rot[1], rot[2]), _q.setFromEuler(_e);
  else _q.identity();
  _p.set(x, y, z);
  geo.applyMatrix4(new THREE.Matrix4().compose(_p, _q, _one));
  return geo;
}

// 只生成变换矩阵（不作用于几何体）
export function placeMatrix(x = 0, y = 0, z = 0, rot = null) {
  if (rot) _e.set(rot[0], rot[1], rot[2]), _q.setFromEuler(_e);
  else _q.identity();
  _p.set(x, y, z);
  return new THREE.Matrix4().compose(_p, _q, _one);
}

// 平面网格，UV 按世界尺寸铺（不随尺寸缩放）
export function scaledPlane(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

export function scaledSphere(r, ws = 8, hs = 6) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * Math.PI * r);
  return g;
}

export function scaledTorus(R, r, tubSeg = 6, radialSeg = 12, arc = Math.PI * 2) {
  const g = new THREE.TorusGeometry(R, r, tubSeg, radialSeg, arc);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * arc * R, uv.getY(i) * 2 * Math.PI * r);
  return g;
}

export function sphereSlice(r, ws = 10, hs = 6, phiLen = Math.PI * 2, phiStart = 0, thetaLen = Math.PI) {
  return new THREE.SphereGeometry(r, ws, hs, 0, phiLen, phiStart, thetaLen);
}

// 两点之间的方截面杆件（带倒角）
export function boxSpan(a, b, w, d, bevel = 6e-3, squash = false) {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  dir.normalize();
  const g = squash ? box(w, len, d) : bevelBox(w, len, d, bevel);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const mid = new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, _one));
  return g;
}

// 两点之间的圆截面杆件。签名同 Saltline 的 V0(a, b, r, seg, caps, r2)：
// 第 5 个参数是「是否封口」（默认不封），第 6 个才是另一端半径。
export function tubeSpan(a, b, r, seg = 6, caps = false, r2 = r) {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  dir.normalize();
  const g = cyl(r2, r, len, seg, !caps);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const mid = new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, _one));
  return g;
}

export { plane };
