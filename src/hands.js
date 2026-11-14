// hands.js — first-person hand rig, extracted from Saltline.
//
// Source functions (all in /tmp/sl.pretty.js, module L29446–30560):
//   t0 / Eh / Un / xs / d0 / tn / ly / jl / di / Za   — digit table, limits, pose helpers
//   _h / Sh / ra / tr                                 — pose -> bone quaternion / joint solve
//   vs / mn                                           — capsule / box shape descriptors
//   Th                                                — transform shape descriptors by a matrix
//   tD / h5 / wh / Kl / Fr / Iu                       — analytic collider distance, per-joint clearance
//   Jl                                                — finger pose solver ("wrap until contact")
//   Lh                                                — mirror shape descriptors (left hand)
//   uD                                                — the glove's capsule/box bone list (60 primitives)
//   Ch / z1 / tc / nn                                 — grip profile generator + grip table
//   fS / hS / il / M5                                 — grip socket solvers
//   ca / dS                                           — grip point = pose fitted to collider shapes
//   Fh                                                — the skeleton + pose application (M())
//   WE / Rh                                           — the *render* SDF of the glove (per-group smin)
//   hy / BE / fD                                      — surface nets mesher (8 corners, 12 edges)
//   hD / Ql / g5 / dD / pD / My                       — bake: gradient projection, skin weights,
//                                                       weight relaxation, weld, skin attributes
//
// Faithfulness notes / deliberate deviations:
//  * All capsule/box descriptors, radii, blend weights (k), blend radii (R), digit metrics, pose
//    tables, grip profile constants and the grip table are copied verbatim (numbers untouched).
//  * createHand()'s default `surface:'sdf'` IS the game's pipeline: bakeHandSurface() ports fD()
//    (naive surface nets over the iso grid) and the assembly half of My() — bbox + padded iso axes
//    (hxy 34e-4, hzF 47e-4, hzP 6e-3, hzC 8e-3), 4-tap gradient projection (clamped to 12e-4),
//    SDF-gradient normals, per-shape -> per-bone skin weights (hD falloff / Ql top-4 / g5 bone
//    adjacency), 3 Laplacian relaxation passes, and the 25e-5 union-find weld. The result is ONE
//    connected SkinnedMesh on a 35-bone rig. `surface:'primitives'` keeps the earlier fallback
//    (one mesh per SDF primitive, rigidly parented) and is used by the tests for comparison.
//  * Differences from My() that remain:
//      - `mD()`'s forearm sleeve mesh (and the 2 sleeve capsules) is not baked: this module is the
//        hand only. Everything else in My()'s vertex loop is ported.
//      - `rest` / `hand` vertex attributes (the procedural shader's inputs, `armSurface()`) are not
//        emitted; per-vertex colours approximating armSurface()'s olive/tan/rubber zoning are
//        written into `color` instead (the same normal-y "palmar" test, from the SDF normal).
//      - My()'s module-level `d5` cache is replaced by an options-keyed Map cache
//        (`bakedHandGeometry`), so different `cell`/`smoothK` bakes can coexist.
//      - the iso seed / axis clamps are guarded (the source assumes the seed cell exists).
//  * uD() pushes 60 primitives; 58 are ported (HAND_PARTS). The 2 omitted are the forearm sleeve
//    capsules on the twist2 bone (`ku(l0.twist2, py, ...)`). The arm/IK system (createArm/Fh) is
//    not ported: bones[0..3] of the 35-slot rig are empty placeholders.
//  * Measured hand bbox: 14.9 x 6.9 x 19.9 cm (right, rest pose, baked surface).
//  * Uu() (finger IK onto one explicit point, uses FE) and pS/RD/R5 (mag-wrap search) are not
//    ported. Trigger pull uses TRIGGER_PULL exactly like the arm rig's setTrigger().
//  * Pose table `nn` has 10 entries in the source; all 10 are ported here (GRIP_POSES).
//    `di` (named pose table) has 5 entries in the source; all 5 are ported (POSES).

import * as THREE from 'three';
import { bevelBox } from './geo.js';

const { Vector3: V3, Quaternion: Quat, Matrix4: Mat4 } = THREE;

// ---------------------------------------------------------------------------
// digit table  (source: var t0)
// ---------------------------------------------------------------------------
export const DIGIT_NAMES = ['thumb', 'index', 'middle', 'ring', 'little'];
export const POSE_LEN = 20;

export const DIGITS = [
  { name: 'thumb', base: [-0.0235, -0.01, -0.02], dir: [-0.3, -0.05, -0.95], up: [-0.72, 0.69, 0], len: [0.044, 0.033, 0.029], rad: [0.015, 0.0122, 0.0112, 98e-4], wide: 1.15 },
  { name: 'index', base: [-0.0335, 15e-4, -0.096], yaw: 0.07, roll: -0.05, sgn: 1, len: [0.0405, 0.0235, 0.022], rad: [0.0102, 93e-4, 85e-4, 76e-4], wide: 1.12 },
  { name: 'middle', base: [-0.011, 35e-4, -0.101], yaw: 0.01, roll: 0, sgn: 1, len: [0.044, 0.0262, 0.0238], rad: [0.0104, 95e-4, 87e-4, 78e-4], wide: 1.12 },
  { name: 'ring', base: [0.0105, 2e-3, -0.0965], yaw: -0.06, roll: 0.05, sgn: -1, len: [0.0412, 0.0245, 0.0223], rad: [99e-4, 9e-3, 82e-4, 73e-4], wide: 1.12 },
  { name: 'little', base: [0.0305, -15e-4, -0.0875], yaw: -0.14, roll: 0.12, sgn: -1, len: [0.0325, 0.0188, 0.02], rad: [89e-4, 81e-4, 73e-4, 65e-4], wide: 1.12 },
];

const AXIS_X = new V3(1, 0, 0);
const AXIS_Y = new V3(0, 1, 0);
const AXIS_Z = new V3(0, 0, 1);
const THUMB_DIR = new V3(0.2, 0, 0.98).normalize();

export const ARM = { upper: 0.3, fore: 0.27 };

// source: Jz() — thumb first-phalanx rest orientation
function basisFromDirUp(dir, up, out = new Quat()) {
  const i = new V3(-dir[0], -dir[1], -dir[2]).normalize();
  const s = new V3(up[0], up[1], up[2]).cross(i).normalize();
  const o = new V3().crossVectors(i, s);
  return out.setFromRotationMatrix(new Mat4().makeBasis(s, o, i));
}

DIGITS[0].q0 = basisFromDirUp(DIGITS[0].dir, DIGITS[0].up);
for (let n = 1; n < 5; n++) DIGITS[n].qRoll = new Quat().setFromAxisAngle(AXIS_Z, DIGITS[n].roll);
for (const d of DIGITS) d.total = d.len[0] + d.len[1] + d.len[2];

// bone index map (source: l0)
export const BONE = {
  upperArm: 0, forearm: 1, twist1: 2, twist2: 3, hand: 4,
  digit: (n, e) => 5 + n * 3 + e,
  helper: (n, e) => 20 + n * 3 + e,
  count: 35,
};

// joint limits (source: xs / Qz / eD)
const THUMB_LIMITS = [[-0.25, 1.35], [-0.2, 1], [-0.35, 1.4], [-0.15, 1]];
const FINGER_LIMITS = [[-0.45, 1.6], [0, 1.95], [-0.1, 1.45], [-0.3, 0.4]];
export const LIMITS = { min: new Float32Array(POSE_LEN), max: new Float32Array(POSE_LEN) };
for (let n = 0; n < 5; n++) {
  for (let e = 0; e < 4; e++) {
    const t = (n ? FINGER_LIMITS : THUMB_LIMITS)[e];
    LIMITS.min[n * 4 + e] = t[0];
    LIMITS.max[n * 4 + e] = t[1];
  }
}
export const TRIGGER_PULL = [0.04, 0.22, 0.16, 0];
export const WRIST_LIMITS = { flex: [-1.22, 1.4], deviation: [-0.61, 0.35], twist: [-1.66, 1.66] };

// ---------------------------------------------------------------------------
// pose helpers  (source: d0 / tn / ly / LE / Za, jl / di)
// ---------------------------------------------------------------------------
export function makePose(spec = {}, base = null) {
  const t = new Float32Array(POSE_LEN);
  if (base) t.set(base);
  for (let i = 0; i < 5; i++) {
    const s = spec[DIGIT_NAMES[i]] || (i && spec.fingers);
    if (s) for (let o = 0; o < 4; o++) t[i * 4 + o] = s[o] || 0;
  }
  return t;
}

export function lerpPose(out, a, b, t) {
  for (let i = 0; i < POSE_LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

export function poseViolation(pose) {
  let e = 0;
  for (let t = 0; t < POSE_LEN; t++) e = Math.max(e, LIMITS.min[t] - pose[t], pose[t] - LIMITS.max[t]);
  return Math.max(0, e);
}

export function clampPose(pose) {
  let e = 0;
  for (let t = 0; t < POSE_LEN; t++) {
    const lo = LIMITS.min[t], hi = LIMITS.max[t];
    if (pose[t] < lo) { e = Math.max(e, lo - pose[t]); pose[t] = lo; } else if (pose[t] > hi) { e = Math.max(e, pose[t] - hi); pose[t] = hi; }
  }
  return e;
}

export const REST = makePose({ thumb: [0.34, 0.08, 0.14, 0.5], index: [0.14, 0.22, 0.12, 0.075], middle: [0.18, 0.26, 0.14, 0], ring: [0.22, 0.28, 0.15, 0.065], little: [0.26, 0.3, 0.16, 0.13] });

export const POSES = {
  rest: REST,
  relaxed: makePose({ thumb: [0.42, 0.14, 0.22, 0.34], index: [0.3, 0.44, 0.24, 0.03], middle: [0.4, 0.52, 0.28, 0], ring: [0.48, 0.56, 0.3, 0.02], little: [0.54, 0.58, 0.32, 0.06] }),
  open: makePose({ thumb: [0.2, -0.05, -0.05, 0.75], index: [-0.05, 0.04, 0.02, 0.12], middle: [-0.05, 0.04, 0.02, 0], ring: [-0.05, 0.04, 0.02, 0.1], little: [-0.05, 0.04, 0.02, 0.18] }),
  flat: makePose({ thumb: [0.05, 0, 0.02, 0.2], index: [0, 0.02, 0.01, -0.04], middle: [0, 0.02, 0.01, 0], ring: [0, 0.02, 0.01, -0.03], little: [0, 0.02, 0.01, -0.06] }),
  fist: makePose({ thumb: [0.98, 0.42, 0.62, 0.16], index: [1.4, 1.72, 1.02, -0.04], middle: [1.44, 1.74, 1.02, 0], ring: [1.46, 1.74, 1.02, -0.03], little: [1.48, 1.72, 1.02, -0.08] }),
};

export function resolvePose(pose) {
  if (typeof pose === 'string') {
    const e = POSES[pose];
    if (!e) throw new Error('hands: unknown pose "' + pose + '"');
    return e;
  }
  if (pose instanceof Float32Array) return pose;
  if (Array.isArray(pose)) return Float32Array.from(pose);
  return makePose(pose || {});
}

// ---------------------------------------------------------------------------
// shape descriptors + analytic distances  (source: vs / mn / tD / h5 / wh / Kl / Fr / Iu)
// ---------------------------------------------------------------------------
export function capsule(a, b, r) {
  return { type: 'capsule', a: [a[0], a[1], a[2]], b: [b[0], b[1], b[2]], r };
}

export function box(c, h, q = null, r = 0) {
  const s = q ? (q.isQuaternion ? q.clone() : new Quat(q[0], q[1], q[2], q[3])) : new Quat();
  return { type: 'box', c: [c[0], c[1], c[2]], h: [h[0], h[1], h[2]], q: [s.x, s.y, s.z, s.w], r };
}

const _v3 = new V3();
const _q = new Quat();

// source: Th
export function transformColliders(shapes, matrix) {
  const p = new V3(), q = new Quat(), sc = new V3();
  matrix.decompose(p, q, sc);
  return shapes.map((o) => (o.type === 'capsule'
    ? capsule(new V3(...o.a).applyMatrix4(matrix).toArray(), new V3(...o.b).applyMatrix4(matrix).toArray(), o.r)
    : box(new V3(...o.c).applyMatrix4(matrix).toArray(), o.h, q.clone().multiply(new Quat(o.q[0], o.q[1], o.q[2], o.q[3])), o.r)));
}

// source: Lh
export function mirrorColliders(shapes) {
  return shapes.map((e) => (e.type === 'capsule'
    ? capsule([-e.a[0], e.a[1], e.a[2]], [-e.b[0], e.b[1], e.b[2]], e.r)
    : box([-e.c[0], e.c[1], e.c[2]], e.h, [e.q[0], -e.q[1], -e.q[2], e.q[3]], e.r)));
}

// broad-phase data, as precomputed by the source's ku()/vo()
export function prepareShapes(shapes) {
  for (const s of shapes) {
    if (s.bc) continue;
    if (s.type === 'capsule') {
      const a = new V3(...s.a), b = new V3(...s.b);
      const len = a.distanceTo(b);
      s.bc = [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2];
      s.br = len / 2 + s.r;
      s.len3 = len;
      s.dir = b.clone().sub(a).normalize().toArray();
    } else {
      s.bc = s.c.slice();
      s.br = Math.max(s.h[0], s.h[1], s.h[2]);
      s.qv = new Quat(s.q[0], s.q[1], s.q[2], s.q[3]);
      s.qinv = s.qv.clone().invert();
    }
  }
  return shapes;
}

const _sp = new V3();

// source: tD — signed distance to one primitive
export function shapeDistance(s, x, y, z) {
  if (s.type === 'capsule') {
    const p = s.a, d = s.b;
    const mx = d[0] - p[0], my = d[1] - p[1], mz = d[2] - p[2];
    const yx = x - p[0], yy = y - p[1], yz = z - p[2];
    let t = (yx * mx + yy * my + yz * mz) / (mx * mx + my * my + mz * mz || 1e-12);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(yx - mx * t, yy - my * t, yz - mz * t) - s.r;
  }
  const q = s.qinv || new Quat(s.q[0], s.q[1], s.q[2], s.q[3]).invert();
  _sp.set(x - s.c[0], y - s.c[1], z - s.c[2]).applyQuaternion(q);
  const r = s.r, o = s.h;
  const u = Math.abs(_sp.x) - o[0] + r, f = Math.abs(_sp.y) - o[1] + r, hh = Math.abs(_sp.z) - o[2] + r;
  return Math.hypot(Math.max(u, 0), Math.max(f, 0), Math.max(hh, 0)) + Math.min(Math.max(u, f, hh), 0) - r;
}

// source: h5 with the source's sphere broad-phase (Rh)
export function shapesDistance(shapes, x, y, z) {
  let best = 1e9;
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    const bc = s.bc;
    if (bc) {
      const dx = x - bc[0], dy = y - bc[1], dz = z - bc[2];
      const bd = Math.sqrt(dx * dx + dy * dy + dz * dz) - s.br;
      if (bd > 0.03) { if (bd < best) best = bd; continue; }
    }
    const d = shapeDistance(s, x, y, z);
    if (d < best) best = d;
  }
  return best;
}

// source: Iu — polynomial smooth min
export const smin = (a, b, k) => {
  const h = k - Math.abs(a - b);
  return h <= 0 ? (a < b ? a : b) : (a < b ? a : b) - (h * h) / (4 * k);
};

// ---------------------------------------------------------------------------
// hand kinematics  (source: tr / _h / Sh / ra)
// ---------------------------------------------------------------------------
export function newPoseState() {
  return { q: Array.from({ length: 15 }, () => new Quat()), j: Array.from({ length: 20 }, () => new V3()) };
}

const _tmpQ = new Quat();
const _tmpQ2 = new Quat();

// source: _h
export function digitQuat(digit, phalanx, pose, out = new Quat()) {
  const s = DIGITS[digit], o = digit * 4;
  if (phalanx > 0) return out.setFromAxisAngle(AXIS_X, -pose[o + phalanx]);
  if (digit === 0) {
    return out.setFromAxisAngle(THUMB_DIR, pose[0])
      .multiply(_tmpQ.setFromAxisAngle(AXIS_Y, pose[3]))
      .multiply(s.q0);
  }
  return out.setFromAxisAngle(AXIS_Y, s.yaw + s.sgn * pose[o + 3])
    .multiply(s.qRoll)
    .multiply(_tmpQ.setFromAxisAngle(AXIS_X, -pose[o]));
}

// source: Sh
export function solveDigit(pose, digit, state) {
  const d = DIGITS[digit], q = state.q, j = state.j, r = digit * 3, a = digit * 4;
  digitQuat(digit, 0, pose, q[r]);
  q[r + 1].copy(q[r]).multiply(digitQuat(digit, 1, pose, _tmpQ2));
  q[r + 2].copy(q[r + 1]).multiply(digitQuat(digit, 2, pose, _tmpQ2));
  j[a].set(d.base[0], d.base[1], d.base[2]);
  for (let l = 0; l < 3; l++) j[a + l + 1].copy(j[a + l]).add(_v3.set(0, 0, -d.len[l]).applyQuaternion(q[r + l]));
  return state;
}

// source: ra
export function solveHand(pose, state = newPoseState()) {
  for (let t = 0; t < 5; t++) solveDigit(pose, t, state);
  return state;
}

const _BASE_STATE = solveHand(REST, newPoseState());
export const REST_JOINTS = _BASE_STATE.j; // rest joint positions (hand space)
const restQ = (n, e) => _BASE_STATE.q[n * 3 + e];
const restJ = (n, e) => _BASE_STATE.j[n * 4 + e];
const restAxis = (n, e, axis) => (axis === 0 ? AXIS_X : axis === 1 ? AXIS_Y : AXIS_Z).clone().applyQuaternion(restQ(n, e));

// source: f5 — point at `t` along a phalanx (used by the source's finger IK)
export function phalanxPoint(pose, digit, t, outState = _SC) {
  solveDigit(pose, digit, outState);
  const d = DIGITS[digit], o = digit * 4;
  return outState.j[o + 2].clone().lerp(outState.j[o + 3], t)
    .addScaledVector(new V3(0, -1, 0).applyQuaternion(outState.q[digit * 3 + 2]), d.rad[2] + (d.rad[3] - d.rad[2]) * t);
}
const _SC = newPoseState();

// ---------------------------------------------------------------------------
// per-joint clearance  (source: wh / Kl)
// ---------------------------------------------------------------------------
const S1 = 6;
const _whState = newPoseState();
const _whOut = [0, 0, 0];
const _clear = [0, 0, 0];

export function jointClearance(pose, digit, shapes, palm = null, selfShapes = null) {
  solveDigit(pose, digit, _whState);
  const d = DIGITS[digit], j = _whState.j, a = digit * 4;
  for (let l = 0; l < 3; l++) {
    let best = -1e9;
    if (!(digit === 0 && l === 0)) {
      const u = j[a + l], f = j[a + l + 1], rad = d.rad[l], radN = d.rad[l + 1];
      const taper = l === 2 ? radN / d.len[l] : 0;
      const usePalm = palm && l >= (digit === 0 ? 2 : 1);
      for (let x = 0; x < S1; x++) {
        const v = digit === 0 && l === 1 ? 0.35 + 0.65 * (x / (S1 - 1)) : x / (S1 - 1);
        const y = v * (1 - taper);
        const bx = u.x + (f.x - u.x) * y, by = u.y + (f.y - u.y) * y, bz = u.z + (f.z - u.z) * y;
        let M = shapesDistance(shapes, bx, by, bz);
        if (selfShapes) M = Math.min(M, shapesDistance(selfShapes, bx, by, bz));
        if (usePalm) M = Math.min(M, palm(bx, by, bz));
        const clearance = rad + (radN - rad) * v - M;
        if (clearance > best) best = clearance;
      }
    }
    _clear[l] = best;
  }
  _whOut[0] = _clear[0]; _whOut[1] = _clear[1]; _whOut[2] = _clear[2];
  return _whOut;
}

// source: Kl — deepest finger penetration into `shapes`
export function poseDepth(pose, shapes) {
  let depth = -1e9, digit = 0, phalanx = 0;
  for (let i = 0; i < 5; i++) {
    const s = jointClearance(pose, i, shapes);
    for (let o = 0; o < 3; o++) if (s[o] > depth) { depth = s[o]; digit = i; phalanx = o; }
  }
  return { depth, digit, phalanx };
}

// ---------------------------------------------------------------------------
// glove part list  (source: uD) — the SDF primitives, verbatim
// ---------------------------------------------------------------------------
export const GROUP = { hand: 0, thumb: 5, forearm: 6, guard: 7, sleeve: 8 };
const PALM_SKIP_GROUP = GROUP.thumb;

// Primitive records carry everything uD()'s ku()/vo() store: the render-SDF blend weight `k`,
// the blend radius `R`, the capsule end cuts `ta`/`tb`, the elliptical width `wide`, and (for the
// `surface:'primitives'` fallback) the bevel radius `round` used to approximate the ellipsoid.
const KU = (parts, bone, group, pos, quat, len, ra, rb, o = {}) => {
  parts.push({
    type: 'capsule', bone, group,
    o: [pos.x, pos.y, pos.z],
    quat: (quat || new Quat()).clone(),
    len, ra, rb, wide: o.wide || 1,
    k: o.k ?? 4e-3, R: o.R || 0.01, ta: o.ta || 0, tb: o.tb || 0,
    round: o.R || 0.01,
  });
};
const VO = (parts, bone, group, pos, half, quat, o = {}) => {
  parts.push({
    type: 'box', bone, group,
    o: [pos[0], pos[1], pos[2]],
    half, quat: (quat || new Quat()).clone(),
    k: o.k ?? 4e-3, R: o.R || 0.01,
    round: o.round ?? o.R ?? 0.01,
  });
};

const _uy = (n) => new Quat().setFromAxisAngle(AXIS_Y, n);

// Returns every glove part, exactly as uD() pushes it.  `bone` is a BONE index,
// `group` is the SDF smoothing group (0 hand, 5 thumb, 7 rubber guard).
export function buildHandParts() {
  const parts = [];
  const guard = [];
  let web = null;
  const hand = BONE.hand;

  for (let e = 1; e < 5; e++) {
    const t = DIGITS[e];
    const i = new V3(...t.base);
    const s = new V3(t.base[0] * 0.74 + 1e-3, 5e-4, -0.02);
    const o = i.clone().sub(s);
    const r = o.length() - 2e-3;
    o.normalize();
    const a = new Quat().setFromUnitVectors(new V3(0, 0, -1), o);
    KU(parts, hand, GROUP.hand, s, a, r, 0.0142, e === 4 ? 0.0112 : 0.0122, { k: 0.012, tb: 5e-3, R: 0.012 });
    VO(parts, BONE.helper(e, 0), GROUP.hand, [t.base[0], t.base[1] + 22e-4, t.base[2] + 1e-3], [0.0112, 0.0108, 0.0112].map((l) => l * (e === 4 ? 0.9 : 1)), null, { k: 6e-3 });
  }
  VO(parts, hand, GROUP.hand, [0, 5e-3, -0.056], [0.037, 9e-3, 0.046], null, { k: 0.012, R: 0.012 });
  VO(parts, hand, GROUP.hand, [0.0265, -98e-4, -0.047], [0.0135, 0.0108, 0.035], _uy(-0.1), { k: 0.01, R: 0.012 });
  VO(parts, hand, GROUP.hand, [5e-4, -68e-4, -0.084], [0.037, 78e-4, 0.014], _uy(-0.1), { k: 0.012, R: 0.012 });
  VO(parts, hand, GROUP.hand, [1e-3, 0, -0.014], [0.0305, 0.019, 0.024], null, { k: 0.012, R: 0.012 });
  for (let e = 1; e < 4; e++) {
    const t = DIGITS[e].base, i = DIGITS[e + 1].base;
    for (const s of [-1, 1]) {
      VO(parts, BONE.digit(s < 0 ? e : e + 1, 0), GROUP.hand, [(t[0] + i[0]) / 2 + s * 25e-4, (t[1] + i[1]) / 2 - 2e-3, (t[2] + i[2]) / 2 - 8e-3], [62e-4, 64e-4, 82e-4], null, { k: 6e-3, R: 0.012 });
    }
  }
  for (let e = 1; e < 5; e++) {
    const t = DIGITS[e], i = e === 4 ? 0.88 : 1;
    const s = [t.base[0], t.base[1] + 0.01, t.base[2] + 3e-3];
    const o = [0.0112 * i, 42e-4, 0.013 * i];
    VO(parts, BONE.helper(e, 0), GROUP.guard, s, o, _uy(t.yaw), { k: 4e-3, R: 0.012 });
    guard.push({ c: s, r: o, yaw: t.yaw });
    if (e < 4) {
      const r = DIGITS[e + 1];
      const a = new V3(s[0], s[1] - 12e-4, s[2] + 3e-3);
      const l = new V3(r.base[0], r.base[1] + 94e-4, r.base[2] + 6e-3);
      const c = l.clone().sub(a);
      const u = c.length();
      c.normalize();
      KU(parts, hand, GROUP.guard, a, new Quat().setFromUnitVectors(new V3(0, 0, -1), c), u, 42e-4, 42e-4, { k: 4e-3, R: 0.012 });
    }
  }
  for (let e = 1; e < 5; e++) {
    const t = DIGITS[e], i = t.rad, s = t.wide;
    for (let r = 0; r < 3; r++) {
      const a = r === 2, l = t.len[r] - (a ? i[3] : 0);
      KU(parts, BONE.digit(e, r), e, restJ(e, r), restQ(e, r), l, i[r], i[r + 1], { wide: s, k: 18e-4, ta: 5e-3, tb: a ? 0 : 5e-3 });
      if (r > 0) {
        const c = restJ(e, r).clone().addScaledVector(restAxis(e, r, 1), 12e-4);
        VO(parts, BONE.helper(e, r), e, c.toArray(), [i[r] * s * 0.95, i[r] * 0.95, i[r] * 1.05], restQ(e, r).clone(), { k: 2e-3 });
      }
    }
    const o = restJ(e, 2).clone().addScaledVector(restAxis(e, 2, 2), -t.len[2] * 0.56).addScaledVector(restAxis(e, 2, 1), -12e-4);
    VO(parts, BONE.digit(e, 2), e, o.toArray(), [i[3] * s * 1.04, i[3] * 0.98, t.len[2] * 0.4], restQ(e, 2).clone(), { k: 3e-3 });
  }
  {
    const e = DIGITS[0], t = e.rad, i = e.wide, s = BONE.digit(0, 0);
    KU(parts, s, GROUP.thumb, restJ(0, 0), restQ(0, 0), e.len[0], t[0], t[1] * 1.04, { wide: 1.06, k: 6e-3, ta: 6e-3, tb: 5e-3, R: 0.012 });
    const o = restJ(0, 0).clone().addScaledVector(restAxis(0, 0, 2), -0.02).addScaledVector(restAxis(0, 0, 1), -48e-4).add(new V3(55e-4, -3e-3, 0));
    VO(parts, s, GROUP.thumb, o.toArray(), [0.0158, 0.0122, 0.027], restQ(0, 0).clone(), { k: 0.01, R: 0.012 });
    {
      const a = restJ(0, 1).clone().addScaledVector(restAxis(0, 1, 2), -4e-3);
      const l = new V3(DIGITS[1].base[0], DIGITS[1].base[1] - 4e-3, DIGITS[1].base[2] + 0.02);
      const c = l.clone().sub(a);
      const u = c.length() / 2;
      c.normalize();
      const f = new V3(0.25, 1, 0).normalize();
      const h = new V3().crossVectors(c, f).normalize();
      if (h.z < 0) h.negate();
      const p = new V3().crossVectors(h, c);
      const d = new Quat().setFromRotationMatrix(new Mat4().makeBasis(c, p, h));
      const m = a.clone().add(l).multiplyScalar(0.5).addScaledVector(h, 75e-4);
      VO(parts, BONE.helper(0, 0), GROUP.thumb, m.toArray(), [u + 3e-3, 58e-4, 0.015], d, { k: 0.012, R: 0.014 });
      web = { c: m.toArray(), ab: c.toArray() };
    }
    VO(parts, BONE.helper(0, 0), GROUP.thumb, [e.base[0] + 2e-3, e.base[1], e.base[2] + 2e-3], [0.015, 0.014, 0.015], null, { k: 0.01, R: 0.012 });
    for (let a = 1; a < 3; a++) {
      const l = a === 2, c = e.len[a] - (l ? t[3] : 0);
      KU(parts, BONE.digit(0, a), GROUP.thumb, restJ(0, a), restQ(0, a), c, t[a], t[a + 1], { wide: l ? i * 1.03 : i, k: 2e-3, ta: 5e-3, tb: l ? 0 : 5e-3 });
      const u = restJ(0, a).clone().addScaledVector(restAxis(0, a, 1), 12e-4);
      VO(parts, BONE.helper(0, a), GROUP.thumb, u.toArray(), [t[a] * i * 0.95, t[a] * 0.96, t[a] * 1.06], restQ(0, a).clone(), { k: 2e-3 });
    }
    const r = restJ(0, 2).clone().addScaledVector(restAxis(0, 2, 2), -e.len[2] * 0.56).addScaledVector(restAxis(0, 2, 1), -14e-4);
    VO(parts, BONE.digit(0, 2), GROUP.thumb, r.toArray(), [t[3] * i * 1.1, t[3] * 0.98, e.len[2] * 0.4], restQ(0, 2).clone(), { k: 3e-3 });
  }
  return { parts, guard, web };
}

export const HAND_PARTS = buildHandParts();

// The game's palm SDF (Fr) is built from the hand-bone parts outside the thumb group.
const PALM_INDICES = HAND_PARTS.parts
  .map((p, i) => (p.bone === BONE.hand && p.group !== PALM_SKIP_GROUP ? i : -1))
  .filter((i) => i >= 0);

// ---------------------------------------------------------------------------
// render SDF (source: WE / Rh / Iu) — the SDF the game's glove isosurface is built from.
// NOTE this is NOT the same field as shapeDistance() above: tD() (collider distance) treats a
// `box` as a rounded box, while the glove's render field treats every `vo` primitive as an
// ELLIPSOID (the `yy` branch of WE: T*(T-1)/|grad| with T = |p/h|). Capsules are iq round cones.
// ---------------------------------------------------------------------------
export const SDF_GROUP_COUNT = 8;      // HE
const SDF_BROAD = 0.03;                // nD  — broad-phase cutoff (sphere bound is used past it)
const SDF_K_HAND_THUMB = 0.01;         // sD  — smin(zr[0], zr[5])
const SDF_K_FOREARM = 0.012;           // oD  — smin(..., zr[6])
const SDF_K_DIGITS = 65e-4;            // iD  — smin(..., digits)
const SDF_K_GUARD = 15e-4;             // rD  — smin(..., zr[7])

// source: hD — the per-shape skin/blend falloff
export const sdfFalloff = (n) => {
  if (n >= 1) return 0;
  if (n <= 0) return 1;
  const e = 1 - n;
  return e * e * (3 - 2 * e);
};

// Builds the flat tables the source precomputes from `zu` (VE/by/p5/m5/aa/pi/v5/C1) and returns
// { distance(x,y,z,out), shapeCount, parts, ... }.  `out` (optional) receives the per-shape
// distance (`.dist`) and the source's secondary value k1 (`.k1`), exactly like Rh(..., true).
export function createGloveField(parts = HAND_PARTS.parts, opts = {}) {
  const smoothK = opts.smoothK ?? 1;
  const ir = parts.length;
  const VE = new Uint8Array(ir), by = new Uint8Array(ir), p5 = new Uint8Array(ir);
  const m5 = new Float64Array(ir * 3), aa = new Float64Array(ir * 9), pi = new Float64Array(ir * 8);
  const v5 = new Float64Array(ir), C1 = new Float64Array(ir * 4);
  const R = new Float64Array(ir), grp = new Uint8Array(ir);

  parts.forEach((p, i) => {
    const m = new Mat4().makeRotationFromQuaternion(p.quat).elements;
    const zx = m[8], zy = m[9], zz = m[10];
    VE[i] = p.type === 'capsule' ? 0 : 1;
    grp[i] = p.group;
    p5[i] = p.bone;
    m5[i * 3] = p.o[0]; m5[i * 3 + 1] = p.o[1]; m5[i * 3 + 2] = p.o[2];
    aa[i * 9] = m[0]; aa[i * 9 + 1] = m[1]; aa[i * 9 + 2] = m[2];
    aa[i * 9 + 3] = m[4]; aa[i * 9 + 4] = m[5]; aa[i * 9 + 5] = m[6];
    aa[i * 9 + 6] = m[8]; aa[i * 9 + 7] = m[9]; aa[i * 9 + 8] = m[10];
    v5[i] = (p.k ?? 4e-3) * smoothK;
    R[i] = p.R ?? 0.01;
    if (p.type === 'capsule') {
      const b = (p.ra - p.rb) / p.len;
      C1[i * 4] = p.o[0] - zx * p.len * 0.5;
      C1[i * 4 + 1] = p.o[1] - zy * p.len * 0.5;
      C1[i * 4 + 2] = p.o[2] - zz * p.len * 0.5;
      C1[i * 4 + 3] = p.len * 0.5 + Math.max(p.ra, p.rb) * p.wide;
      pi[i * 8] = p.len;
      pi[i * 8 + 1] = p.ra;
      pi[i * 8 + 2] = p.rb;
      pi[i * 8 + 3] = 1 / p.wide;
      pi[i * 8 + 4] = b;
      pi[i * 8 + 5] = Math.sqrt(1 - b * b);
      pi[i * 8 + 6] = p.ta || 0;
      pi[i * 8 + 7] = p.tb || 0;
    } else {
      C1[i * 4] = p.o[0]; C1[i * 4 + 1] = p.o[1]; C1[i * 4 + 2] = p.o[2];
      C1[i * 4 + 3] = Math.max(p.half[0], p.half[1], p.half[2]);
      pi[i * 8] = 1 / p.half[0];
      pi[i * 8 + 1] = 1 / p.half[1];
      pi[i * 8 + 2] = 1 / p.half[2];
      pi[i * 8 + 3] = Math.min(p.half[0], p.half[1], p.half[2]);
    }
  });

  const acc = new Float64Array(SDF_GROUP_COUNT);
  let k1 = 0;

  // source: WE — one primitive, in its own frame
  function shape(i, x, y, z) {
    const o = i * 9, r = i * 8;
    const a = x - m5[i * 3], b = y - m5[i * 3 + 1], c = z - m5[i * 3 + 2];
    const u = a * aa[o] + b * aa[o + 1] + c * aa[o + 2];
    const f = a * aa[o + 3] + b * aa[o + 4] + c * aa[o + 5];
    const h = a * aa[o + 6] + b * aa[o + 7] + c * aa[o + 8];
    if (VE[i] === 0) {
      const E = pi[r], M = pi[r + 1], _u = u * pi[r + 3];
      const T = Math.sqrt(_u * _u + f * f), w = -h;
      const S = pi[r + 4], Rr = pi[r + 5], zz = w * Rr - T * S;
      const I = zz < 0
        ? Math.sqrt(T * T + w * w) - M
        : zz > Rr * E
          ? Math.sqrt(T * T + (w - E) * (w - E)) - pi[r + 2]
          : T * Rr + w * S - M;
      k1 = Math.max(I, pi[r + 6] - w, w - E + pi[r + 7]);
      return I;
    }
    const E = u * pi[r], M = f * pi[r + 1], _h = h * pi[r + 2];
    const T = Math.sqrt(E * E + M * M + _h * _h);
    if (T < 1e-9) { k1 = -pi[r + 3]; return k1; }
    const w = E * pi[r], S = M * pi[r + 1], Rr = _h * pi[r + 2];
    k1 = (T * (T - 1)) / Math.sqrt(w * w + S * S + Rr * Rr);
    return k1;
  }

  // source: Rh — the combined field, with the source's per-group smin order
  function distance(x, y, z, out = null) {
    for (let g = 0; g < SDF_GROUP_COUNT; g++) acc[g] = 1e9;
    for (let i = 0; i < ir; i++) {
      const dx = x - C1[i * 4], dy = y - C1[i * 4 + 1], dz = z - C1[i * 4 + 2];
      const bd = Math.sqrt(dx * dx + dy * dy + dz * dz) - C1[i * 4 + 3];
      let d;
      if (bd > SDF_BROAD) {
        d = bd;
        if (out) { out.dist[i] = bd; out.k1[i] = bd; }
      } else {
        d = shape(i, x, y, z);
        if (out) { out.dist[i] = d; out.k1[i] = k1; }
      }
      const g = grp[i];
      acc[g] = smin(acc[g], d, v5[i]);
    }
    let s = smin(acc[0], acc[5], SDF_K_HAND_THUMB);
    s = smin(s, acc[6], SDF_K_FOREARM);
    const dig = Math.min(acc[1], acc[2], acc[3], acc[4]);
    return smin(smin(s, dig, SDF_K_DIGITS), acc[7], SDF_K_GUARD);
  }

  return { distance, shape, shapeCount: ir, parts, groups: grp, bones: p5, k: v5, R, broad: C1 };
}

// The default field for the glove (used by palmDistance below and by createHand).
const GLOVE_FIELD = createGloveField(HAND_PARTS.parts);

// source: Fr — clearance of a point against the palm (used as the Jl self-collision term).
// The source smooth-mins the hand-bone shapes into two buckets (guard bars vs everything else)
// with each shape's own k, then takes the min.
export function palmDistance(x, y, z) {
  const f = GLOVE_FIELD;
  let i = 1e9, s = 1e9;
  for (const idx of PALM_INDICES) {
    const d = f.shape(idx, x, y, z);
    if (HAND_PARTS.parts[idx].group === GROUP.guard) s = smin(s, d, f.k[idx]);
    else i = smin(i, d, f.k[idx]);
  }
  return Math.min(i, s);
}

// the palm's SDF primitives (source: GE)
export function palmShapes() {
  return PALM_INDICES.map((i) => ({ ...HAND_PARTS.parts[i] }));
}

// ---------------------------------------------------------------------------
// glove isosurface bake (source: fD / My, i.e. naive surface nets + gradient relaxation)
// ---------------------------------------------------------------------------
// Corner table (source: hy) and edge table (source: BE), verbatim.
const SN_CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const SN_EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

// source: fy — a monotonically growing iso axis
function isoRange(a, b, step) {
  const out = [a];
  let guard = 0;
  while (out[out.length - 1] < b && guard++ < 1e7) {
    const v = out[out.length - 1];
    out.push(v + step(v));
  }
  return Float64Array.from(out);
}

// source: fD — one vertex per sign-changing cell, quads between neighbouring cells.
function surfaceNets(field, xs, ys, zs, seed) {
  const s = xs.length, o = ys.length, r = zs.length;
  const l = s, c = s * o, total = s * o * r;
  const f = new Float32Array(total).fill(NaN);
  const h = new Int32Array(total).fill(-1);
  const p = new Float64Array(8);
  const cmp = (w) => {
    let S = f[w];
    if (S !== S) {
      const iz = (w / c) | 0;
      const rest = w - iz * c;
      const iy = (rest / s) | 0;
      const ix = rest - iy * s;
      S = field.distance(xs[ix], ys[iy], zs[iz]);
      if (S === 0) S = 1e-9;
      f[w] = S;
    }
    return S;
  };
  const off = SN_CORNERS.map((w) => w[0] + w[1] * l + w[2] * c);
  let x = 0, v = 0, y = 0;
  while (x + 1 < s && xs[x + 1] < seed[0]) x++;
  while (v + 1 < o && ys[v + 1] < seed[1]) v++;
  while (y + 1 < r && zs[y + 1] < seed[2]) y++;
  for (; v < o - 2 && !(cmp(x + v * l + y * c) < 0 && cmp(x + (v + 1) * l + y * c) > 0);) v++;
  const b = [], g = [];
  const stack = [x + v * l + y * c];
  while (stack.length) {
    const w = stack.pop();
    if (h[w] !== -1) continue;
    const iz = (w / c) | 0;
    const rest = w - iz * c;
    const iy = (rest / s) | 0;
    const ix = rest - iy * s;
    if (ix < 0 || iy < 0 || iz < 0 || ix >= s - 1 || iy >= o - 1 || iz >= r - 1) { h[w] = -2; continue; }
    let mask = 0;
    for (let k = 0; k < 8; k++) { p[k] = cmp(w + off[k]); if (p[k] < 0) mask |= 1 << k; }
    if (mask === 0 || mask === 255) { h[w] = -2; continue; }
    let U = 0, V = 0, W = 0, A = 0;
    for (let k = 0; k < 12; k++) {
      const n0 = SN_EDGES[k][0], n1 = SN_EDGES[k][1];
      if (((mask >> n0) & 1) === ((mask >> n1) & 1)) continue;
      const t = p[n0] / (p[n0] - p[n1]);
      const c0 = SN_CORNERS[n0], c1 = SN_CORNERS[n1];
      U += xs[ix + c0[0]] + (xs[ix + c1[0]] - xs[ix + c0[0]]) * t;
      V += ys[iy + c0[1]] + (ys[iy + c1[1]] - ys[iy + c0[1]]) * t;
      W += zs[iz + c0[2]] + (zs[iz + c1[2]] - zs[iz + c0[2]]) * t;
      A++;
    }
    h[w] = g.length;
    g.push(w);
    b.push(U / A, V / A, W / A);
    const F = (a0, a1, a2, a3) => {
      const bit = (mask >> a0) & 1;
      return bit !== ((mask >> a1) & 1) || bit !== ((mask >> a2) & 1) || bit !== ((mask >> a3) & 1);
    };
    if (F(0, 2, 4, 6)) stack.push(w - 1);
    if (F(1, 3, 5, 7)) stack.push(w + 1);
    if (F(0, 1, 4, 5)) stack.push(w - l);
    if (F(2, 3, 6, 7)) stack.push(w + l);
    if (F(0, 1, 2, 3)) stack.push(w - c);
    if (F(4, 5, 6, 7)) stack.push(w + c);
  }
  const idx = [];
  const pos = b;
  const quad = (a0, a1, a2, a3, flip) => {
    if (a0 < 0 || a1 < 0 || a2 < 0 || a3 < 0) return;
    if (flip) { const t = a1; a1 = a3; a3 = t; }
    const d02 = (pos[a0 * 3] - pos[a2 * 3]) ** 2 + (pos[a0 * 3 + 1] - pos[a2 * 3 + 1]) ** 2 + (pos[a0 * 3 + 2] - pos[a2 * 3 + 2]) ** 2;
    const d13 = (pos[a1 * 3] - pos[a3 * 3]) ** 2 + (pos[a1 * 3 + 1] - pos[a3 * 3 + 1]) ** 2 + (pos[a1 * 3 + 2] - pos[a3 * 3 + 2]) ** 2;
    if (d02 <= d13) idx.push(a0, a1, a2, a0, a2, a3);
    else idx.push(a0, a1, a3, a1, a2, a3);
  };
  for (let k = 0; k < g.length; k++) {
    const w = g[k], S = f[w];
    if ((S < 0) !== (f[w + 1] < 0)) quad(h[w], h[w - l], h[w - l - c], h[w - c], S > 0);
    if ((S < 0) !== (f[w + l] < 0)) quad(h[w], h[w - 1], h[w - 1 - c], h[w - c], S < 0);
    if ((S < 0) !== (f[w + c] < 0)) quad(h[w], h[w - 1], h[w - 1 - l], h[w - l], S > 0);
  }
  return { pos, idx };
}

// source: g5 — the bone adjacency used when picking skin influences
const BONE_ADJ = (() => {
  const nr = BONE.count;
  const g = new Uint8Array(nr * nr);
  const set = (a, b) => { g[a * nr + b] = g[b * nr + a] = 1; };
  for (let e = 0; e < nr; e++) g[e * nr + e] = 1;
  set(BONE.hand, BONE.twist2);
  for (let e = 0; e < 5; e++) {
    const chain = [BONE.hand, BONE.helper(e, 0), BONE.digit(e, 0), BONE.helper(e, 1), BONE.digit(e, 1), BONE.helper(e, 2), BONE.digit(e, 2)];
    for (let i = 0; i < chain.length; i++) for (let j = i + 1; j <= i + 2 && j < chain.length; j++) set(chain[i], chain[j]);
    if (e > 0 && e < 4) for (const i of [BONE.helper(e, 0), BONE.digit(e, 0)]) for (const j of [BONE.helper(e + 1, 0), BONE.digit(e + 1, 0)]) set(i, j);
  }
  return g;
})();

export const BAKE_DEFAULTS = {
  hxy: 34e-4,      // source: n.hxy (x/y iso step)
  hzF: 47e-4,      // source: n.hzF (z step in front of the wrist)
  hzP: 6e-3,       // source: n.hzP (z step through the palm)
  hzC: 8e-3,       // source: n.hzC (z step behind the wrist)
  pad: 6e-3,       // source: the 6e-3 bbox padding in My()
  project: 12e-4,  // source: the 12e-4 projection clamp in My()
  relax: 3,        // source: n.relax ?? 3 skin relaxation passes
  smoothK: 1,      // multiplier on every primitive's blend k (1 = source-exact)
  seed: [0, 0, -0.05], // source: fD's inside seed
};

const _bakeCache = new Map();

// Bakes the glove isosurface. Pose independent: the surface is built from the primitives' rest
// transforms and is skinned to the bone rig, so the same geometry serves every pose.
// Returns a THREE.BufferGeometry with position/normal/color/skinIndex/skinWeight/index; the bake
// statistics are in geometry.userData.
export function bakeHandSurface(parts = HAND_PARTS.parts, opts = {}) {
  const o = { ...BAKE_DEFAULTS, ...opts };
  if (opts.cell != null) { o.hxy = opts.cell; }   // `cell` = shorthand for the isotropic step
  const t0 = performance.now();
  const field = createGloveField(parts, o);
  const ir = field.shapeCount;
  const nr = BONE.count;

  // source: the iso grid covers every primitive's broad-phase sphere, padded by 6 mm
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < ir; i++) {
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], field.broad[i * 4 + k] - field.broad[i * 4 + 3]);
      mx[k] = Math.max(mx[k], field.broad[i * 4 + k] + field.broad[i * 4 + 3]);
    }
  }
  const pad = o.pad;
  const xs = isoRange(mn[0] - pad, mx[0] + pad, () => o.hxy);
  const ys = isoRange(mn[1] - pad, mx[1] + pad, () => o.hxy);
  const zs = isoRange(mn[2] - pad, mx[2] + pad, (z) => (z < -0.022 ? o.hzF : z < 4e-3 ? o.hzP : o.hzC));

  const { pos, idx } = surfaceNets(field, xs, ys, zs, o.seed);
  const d = pos.length / 3;
  const nrm = new Float64Array(d * 3);
  const col = new Float32Array(d * 3);
  const si = new Uint16Array(d * 4);
  const sw = new Float32Array(d * 4);

  // ---- project onto the surface, gradient normal, skin weights (source: My's first loop) ----
  const x0 = o.project;
  const detail = { dist: new Float64Array(ir), k1: new Float64Array(ir) };
  const Ql = new Float64Array(nr);
  const topW = new Float64Array(4), topB = new Int32Array(4);
  const guard_ = GROUP.guard;
  for (let m = 0; m < d; m++) {
    let px = pos[m * 3], py = pos[m * 3 + 1], pz = pos[m * 3 + 2];
    const S = field.distance(px + x0, py - x0, pz - x0);
    const R = field.distance(px - x0, py - x0, pz + x0);
    const Zz = field.distance(px - x0, py + x0, pz - x0);
    const I = field.distance(px + x0, py + x0, pz + x0);
    let L = (S - R - Zz + I) / (4 * x0);
    let U = (-S - R + Zz + I) / (4 * x0);
    let K = (-S + R - Zz + I) / (4 * x0);
    const C = L * L + U * U + K * K || 1e-12;
    let F = -(((S + R + Zz + I) / 4)) / C;
    const H = Math.abs(F) * Math.sqrt(C);
    if (H > o.project) F *= o.project / H;
    px += L * F; py += U * F; pz += K * F;
    pos[m * 3] = px; pos[m * 3 + 1] = py; pos[m * 3 + 2] = pz;
    const N = Math.sqrt(C);
    L /= N; U /= N; K /= N;
    nrm[m * 3] = L; nrm[m * 3 + 1] = U; nrm[m * 3 + 2] = K;

    // per-shape weights -> per-bone weights (source: Rh(_, T, w, true) ... Ql[p5[G]])
    field.distance(px, py, pz, detail);
    Ql.fill(0);
    let Z = 0, Q = 1e9, guardW = 0, palmW = 0;
    for (let gI = 0; gI < ir; gI++) {
      const te = detail.k1[gI] / field.R[gI];
      const wgt = sdfFalloff(te);
      const bone = field.bones[gI];
      if (wgt > Ql[bone]) Ql[bone] = wgt;
      if (te < Q) { Q = te; Z = bone; }
      if (field.groups[gI] === guard_ && wgt > guardW) guardW = wgt;
      if (wgt > palmW) palmW = wgt;
    }
    if (Ql[Z] < 1e-4) Ql[Z] = 1e-4;
    let Wb = 0;
    for (let gI = 1; gI < nr; gI++) if (Ql[gI] > Ql[Wb]) Wb = gI;
    topW.fill(0); topB.fill(-1);
    for (let gI = 0; gI < nr; gI++) {
      const te = BONE_ADJ[Wb * nr + gI] ? Ql[gI] : 0;
      if (te <= topW[3]) continue;
      let k = 3;
      for (; k > 0 && te > topW[k - 1];) { topW[k] = topW[k - 1]; topB[k] = topB[k - 1]; k--; }
      topW[k] = te; topB[k] = gI;
    }
    const sum = topW[0] + topW[1] + topW[2] + topW[3] || 1;
    for (let k = 0; k < 4; k++) {
      si[m * 4 + k] = topB[k] < 0 ? 0 : topB[k];
      sw[m * 4 + k] = topW[k] / sum;
    }

    // vertex colour: approximate armSurface()'s zoning from the SDF normal and the guard weight
    const palmar = 1 - smoothstepNum(-0.06, 0.005, U);
    const gw = Math.min(1, guardW / (palmW || 1));
    const base = COLORS.olive, palm = COLORS.tan, rub = COLORS.rubber;
    const mixP = palmar * (1 - gw);
    col[m * 3] = base[0] + (palm[0] - base[0]) * mixP + (rub[0] - base[0]) * gw;
    col[m * 3 + 1] = base[1] + (palm[1] - base[1]) * mixP + (rub[1] - base[1]) * gw;
    col[m * 3 + 2] = base[2] + (palm[2] - base[2]) * mixP + (rub[2] - base[2]) * gw;
  }

  // ---- skin weight relaxation over the mesh adjacency (source: My's second block) ----
  if (o.relax > 0 && idx.length) {
    const neigh = Array.from({ length: d }, () => []);
    const seen = new Set();
    for (let w = 0; w < idx.length; w += 3) {
      for (let k = 0; k < 3; k++) {
        const a = idx[w + k], b = idx[w + ((k + 1) % 3)];
        const key = a < b ? a * d + b : b * d + a;
        if (seen.has(key)) continue;
        seen.add(key);
        neigh[a].push(b); neigh[b].push(a);
      }
    }
    const T = new Float64Array(nr);
    for (let pass = 0; pass < o.relax; pass++) {
      const S = si.slice(), R = sw.slice();
      for (let z = 0; z < d; z++) {
        T.fill(0);
        const nb = neigh[z], inv = 1 / (nb.length || 1);
        for (let k = 0; k < 4; k++) T[S[z * 4 + k]] += R[z * 4 + k];
        for (const nbs of nb) for (let k = 0; k < 4; k++) T[S[nbs * 4 + k]] += R[nbs * 4 + k] * inv;
        topW.fill(0); topB.fill(-1);
        for (let gI = 0; gI < nr; gI++) {
          const C2 = T[gI];
          if (C2 <= topW[3]) continue;
          let k = 3;
          for (; k > 0 && C2 > topW[k - 1];) { topW[k] = topW[k - 1]; topB[k] = topB[k - 1]; k--; }
          topW[k] = C2; topB[k] = gI;
        }
        const U2 = topW[0] + topW[1] + topW[2] + topW[3];
        for (let k = 0; k < 4; k++) {
          si[z * 4 + k] = topB[k] < 0 ? 0 : topB[k];
          sw[z * 4 + k] = topW[k] / (U2 || 1);
        }
      }
    }
  }

  // ---- weld coincident vertices + drop degenerate triangles (source: My's last block) ----
  const parent = new Int32Array(d);
  for (let i = 0; i < d; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  for (let w = 0; w < idx.length; w += 3) {
    for (let k = 0; k < 3; k++) {
      const a = find(idx[w + k]), b = find(idx[w + ((k + 1) % 3)]);
      if (a !== b && Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]) < 25e-5) {
        parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }
  const remap = new Int32Array(d).fill(-1);
  const keep = [];
  for (let i = 0; i < d; i++) if (find(i) === i) { remap[i] = keep.length; keep.push(i); }
  let index = new Uint32Array(idx.length);
  let tri = 0;
  for (let w = 0; w < idx.length; w += 3) {
    const a = remap[find(idx[w])], b = remap[find(idx[w + 1])], c = remap[find(idx[w + 2])];
    if (a === b || b === c || a === c) continue;
    index[tri++] = a; index[tri++] = b; index[tri++] = c;
  }
  index = index.subarray(0, tri * 3);
  const nv = keep.length;
  const position = new Float32Array(nv * 3);
  const normal = new Float32Array(nv * 3);
  const color = new Float32Array(nv * 3);
  const skinIndex = new Uint16Array(nv * 4);
  const skinWeight = new Float32Array(nv * 4);
  for (let i = 0; i < nv; i++) {
    const src = keep[i];
    for (let k = 0; k < 3; k++) {
      position[i * 3 + k] = pos[src * 3 + k];
      normal[i * 3 + k] = nrm[src * 3 + k];
      color[i * 3 + k] = col[src * 3 + k];
    }
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k] = si[src * 4 + k];
      skinWeight[i * 4 + k] = sw[src * 4 + k];
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.userData = {
    verts: nv, tris: index.length / 3, ms: performance.now() - t0,
    cell: [o.hxy, o.hzF, o.hzP, o.hzC], pad: o.pad, relax: o.relax, smoothK: o.smoothK,
    grid: [xs.length, ys.length, zs.length], welded: d - nv,
    source: 'fD/My surface nets + SDF gradient relaxation',
  };
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// source: qE — the mirrored copy used for the left hand
export function mirrorSurfaceGeometry(geo) {
  const g = geo.clone();
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  for (let i = 0; i < p.length; i += 3) { p[i] = -p[i]; n[i] = -n[i]; }
  const c = g.attributes.color.array;
  for (let i = 0; i < c.length; i += 3) { /* colours are symmetric */ }
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  g.index.needsUpdate = true;
  g.attributes.position.needsUpdate = true;
  g.attributes.normal.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const smoothstepNum = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// cached (opts-keyed) glove bake shared by every createHand() call
export function bakedHandGeometry(opts = {}) {
  const key = JSON.stringify([opts.cell ?? null, opts.hxy ?? null, opts.hzF ?? null, opts.hzP ?? null, opts.hzC ?? null, opts.pad ?? null, opts.relax ?? null, opts.smoothK ?? null, opts.project ?? null, opts.seed ?? null]);
  if (!_bakeCache.has(key)) _bakeCache.set(key, bakeHandSurface(HAND_PARTS.parts, opts));
  return _bakeCache.get(key);
}

// ---------------------------------------------------------------------------
// grip profiles  (source: Ch / z1 / tc / nn)
// ---------------------------------------------------------------------------
// source: Ch
export function gripFrame(p, dir, up) {
  const i = dir.clone().normalize();
  const s = up.clone().negate();
  s.addScaledVector(i, -s.dot(i)).normalize();
  const o = new V3().crossVectors(i, s);
  return { p: p.clone(), q: new Quat().setFromRotationMatrix(new Mat4().makeBasis(o, i, s)) };
}

// source: z1
function boxFromBasis(center, bx, by, bz, hx, hy, hz, round) {
  return box(center.toArray(), [hx, hy, hz], new Quat().setFromRotationMatrix(new Mat4().makeBasis(bx, by, bz)), round);
}

const _XE = new V3(0, 1, 0);

// source: tc — build a grip profile (colliders + frame) from a spec. Same numbers as the game.
export function gripProfile(spec) {
  const e = new V3(Math.cos(spec.tilt), 0, Math.sin(spec.tilt));
  const t = new V3(Math.sin(spec.tilt), 0, -Math.cos(spec.tilt));
  const i = new V3(...spec.web);
  const c = Math.cos(spec.roll), o = Math.sin(spec.roll);
  const r = t.clone().multiplyScalar(c).addScaledVector(_XE, -o);
  const a = t.clone().multiplyScalar(-o).addScaledVector(_XE, -c);
  const l = spec.roll >= 0 ? i.clone() : i.clone().addScaledVector(t, spec.depth).addScaledVector(r, -spec.depth);
  const pad = spec.pad || [0, 0, 0];
  l.addScaledVector(e, -(spec.drop || 0)).addScaledVector(a, pad[0]);
  const u = l.clone().addScaledVector(e, spec.len / 2 - 4e-3).addScaledVector(r, spec.depth / 2).addScaledVector(a, spec.width / 2);
  const f = a.clone().negate();
  const colliders = [boxFromBasis(u, e, f, r.clone().negate(), spec.len / 2, spec.width / 2, spec.depth / 2, spec.round)];
  if (spec.pad) {
    const y = spec.pad[2], b = spec.len - 4e-3 - y;
    colliders.push(boxFromBasis(
      l.clone().addScaledVector(e, y + b / 2).addScaledVector(r, (spec.depth + pad[1]) / 2).addScaledVector(a, (spec.width - pad[0]) / 2),
      e, f, r.clone().negate(), b / 2, (spec.width + pad[0]) / 2, (spec.depth + pad[1]) / 2, spec.round + 3e-3,
    ));
  }
  const p = e.clone().multiplyScalar(-Math.cos(spec.rake)).addScaledVector(r, -Math.sin(spec.rake));
  const d = r.clone().multiplyScalar(Math.cos(spec.rake)).addScaledVector(e, -Math.sin(spec.rake));
  const m = l.clone().addScaledVector(a, spec.width / 2).addScaledVector(e, -4e-3);
  const x = (y, b) => m.clone().addScaledVector(d, y).addScaledVector(p, b);
  colliders.push(boxFromBasis(x((spec.top[0] + spec.top[1]) / 2, spec.top[2] + spec.top[3] / 2), p.clone().negate(), f, d.clone().negate(), spec.top[3] / 2, spec.topW / 2, (spec.top[1] - spec.top[0]) / 2, 4e-3));
  colliders.push(capsule(x(spec.guard[0], spec.guard[2]).toArray(), x(spec.guard[1], spec.guard[2]).toArray(), 35e-4));
  const trig = x(spec.trigger[0], spec.trigger[1]);
  return {
    colliders,
    frame: gripFrame(m, p, d),
    trigger: [trig.clone().addScaledVector(a, -4e-3).toArray(), trig.clone().addScaledVector(a, 4e-3).toArray()],
    a: e, f: r, n: a,
  };
}

// the game's authored grip configs (var sc for the carbine, var ol for the pistol grip)
const CARBINE_GRIP_SPEC = { web: [-0.0335, -0.012, -0.045], tilt: 0.22, roll: -0.3, drop: 0.012, rake: 0.3, len: 0.094, width: 0.028, depth: 0.045, round: 9e-3, top: [0.012, 0.2, 5e-3, 0.04], topW: 0.034, guard: [0.036, 0.1, -0.024], trigger: [0.084, -0.01] };
const PISTOL_GRIP_SPEC = { web: [-0.0335, -0.012, -0.045], tilt: 0.16, roll: -0.2, drop: 8e-3, rake: 0.31, len: 0.1, width: 0.03, depth: 0.05, round: 0.011, top: [0.012, 0.15, 4e-3, 0.032], topW: 0.027, guard: [0.04, 0.096, -0.03], trigger: [0.082, -0.013] };
const PISTOL_SUPPORT_SPEC = { web: [-0.0335, -0.012, -0.029], tilt: -0.45, roll: 0, drop: 0.016, pad: [0.014, 0.017, 0.03], rake: 0.31, len: 0.1, width: 0.03, depth: 0.05, round: 0.014, top: [0.012, 0.15, 4e-3, 0.032], topW: 0.027, guard: [0.04, 0.096, -0.03], trigger: [0.082, -0.013] };

// the source's authored finger poses for the grip fits (var YE/el/gD/y5/b5/jE/wy/I1/KE ...)
// source: YE / gD / y5 / el — the authored finger poses the grip fits interpolate between
const FIT_STRAIGHT = [0.1, 1.62, 1.02, 0];          // YE
const FIT_MIDDLE_CURL = [0.1, 1.62, 1.02, -0.1];    // gD
const FIT_MIDDLE_FIT = [1.55, 1.78, 1.08, -0.1];    // y5
const FIT_LITTLE_FIT = [1.55, 1.78, 1.08, 0];       // el
const OPEN_FIT = makePose({ thumb: [1.3, 0, 0, 1], index: [-0.45, 0.1, 0.06, 0.36], middle: FIT_MIDDLE_CURL, ring: FIT_STRAIGHT, little: FIT_STRAIGHT });
const THUMB_FIT = [1.3, 0.55, 0.6, -0.1];
const INDEX_FIT = [0.8, 0.1, 0.06, 0.36];

const CARBINE_PROFILE = gripProfile(CARBINE_GRIP_SPEC);
const PISTOL_PROFILE = gripProfile(PISTOL_GRIP_SPEC);
const PISTOL_SUPPORT_PROFILE = gripProfile(PISTOL_SUPPORT_SPEC);

// ---------------------------------------------------------------------------
// grip table  (source: var nn — 10 entries, all ported)
// ---------------------------------------------------------------------------
const CHARGING_POSE = makePose({ thumb: [0.9, 0.2, 0.3, 0.6], index: [0.45, 0.55, 0.33, 0], middle: [0.45, 0.55, 0.33, 0], ring: [1.2, 1.45, 0.9, 0], little: [1.25, 1.45, 0.85, -0.04] });

const charging = (() => {
  const pose = CHARGING_POSE;
  const st = solveHand(pose, newPoseState());
  const t = st.j[5].clone().lerp(st.j[6], 0.62);
  const i = st.j[9].clone().lerp(st.j[10], 0.62);
  const s = new V3(0, -1, 0).applyQuaternion(st.q[4]);
  const o = t.clone().addScaledVector(s, DIGITS[1].rad[1] + 6e-3);
  const r = i.clone().addScaledVector(new V3(0, -1, 0).applyQuaternion(st.q[7]), DIGITS[2].rad[1] + 6e-3);
  const a = r.clone().sub(o).normalize();
  o.addScaledVector(a, -0.016);
  r.addScaledVector(a, 0.014);
  const l = o.clone().add(r).multiplyScalar(0.5);
  const c = new V3(0, 0, 1).applyQuaternion(st.q[4]).negate();
  return {
    colliders: [capsule(o.toArray(), r.toArray(), 5e-3)],
    frame: gripFrame(l, new V3().crossVectors(a, c), c.clone()),
    about: 'index and middle fingers hooked over an AR charging handle, the others folded. Frame: origin at the middle of the handle, +Y up, -Z muzzle (rack by moving the hand along +Z of the part).',
    fit: { digits: [1, 2], rest: makePose({ thumb: [0.25, 0.2, 0.3, 0.45], ring: [1.3, 1.55, 0.9, 0], little: [1.3, 1.5, 0.85, -0.04] }), from: makePose({ fingers: [0.3, 0.35, 0.2, 0] }), to: makePose({ fingers: [0.3, 1.8, 1.25, 0] }) },
  };
})();

const foregripEntry = (() => {
  const n = new V3(-0.05, -0.0315, -0.078);
  const e = new V3(0.042, -0.0315, -0.066);
  const t = n.clone().sub(e).normalize();
  const i = new V3(0.1, -0.5, -0.86);
  i.addScaledVector(t, -i.dot(t)).normalize();
  const s = new V3().crossVectors(i, t);
  return {
    colliders: [capsule(n.toArray(), e.toArray(), 0.0165), box([n.clone().addScaledVector(t, 0.03).x, n.clone().addScaledVector(t, 0.03).y, n.clone().addScaledVector(t, 0.03).z], [0.021, 0.022, 0.1], new Quat().setFromRotationMatrix(new Mat4().makeBasis(t, s, i)), 6e-3)],
    frame: gripFrame(n.clone().addScaledVector(t, 9e-3), t, i),
    about: 'fist round a vertical foregrip. Frame: origin at the top of the grip where it meets the handguard, +Y up along the grip, -Z muzzle (the hand may be turned about +Y freely).',
    fit: {
      from: makePose({ thumb: [1.25, 0, 0, 0.85], fingers: [-0.05, 0.04, 0.02, 0] }),
      to: makePose({ thumb: [1.25, 0.55, 0.7, -0.12], fingers: [1.5, 1.8, 1.1, -0.02] }),
    },
  };
})();

const handguardEntry = (() => {
  const n = new V3(0, -0.0375, -0.082);
  return {
    colliders: [box(n.toArray(), [0.09, 0.0225, 0.0225], null, 0.012)],
    frame: gripFrame(n, new V3(0, -1, 0), new V3(-1, 0, 0)),
    about: "support hand cupped under a ~45 mm handguard, fingers up the far side, thumb along the near side pointing at the muzzle. Frame: origin on the handguard's centre line under the middle of the palm, +Y up, -Z muzzle.",
    fit: {
      from: makePose({ thumb: [0.25, -0.1, -0.2, 1], fingers: [-0.05, 0.04, 0.02, 0.04] }),
      to: makePose({ thumb: [1.2, 0.3, 0.35, 1], fingers: [1.5, 1.6, 1, 0] }),
    },
  };
})();

const magCupEntry = (() => {
  const n = new V3(4e-3, -0.1035, -0.059);
  return {
    colliders: [box(n.toArray(), [0.012, 0.09, 0.031], null, 3e-3)],
    frame: gripFrame(new V3(4e-3, -0.0135, -0.059), new V3(0, -1, 0), new V3(0, 0, -1)),
    about: "palm up under a magazine base plate, fingers up its front face, thumb up its side. Frame: origin at the centre of the base plate, +Y along the magazine toward the gun, -Z the magazine's front (bullet noses).",
    fit: {
      from: makePose({ thumb: [0.9, 0, 0, 0.9], fingers: [0.2, 0.05, 0.02, 0] }),
      to: makePose({ thumb: [1.3, 0.3, 0.3, -0.1], index: [1.42, 0.3, 0.2, 0], middle: [1.6, 0.3, 0.2, 0], ring: [1.6, 0.3, 0.2, 0], little: [1.36, 0.34, 0.22, 0] }),
    },
  };
})();

const magPinchEntry = (() => {
  const e = new V3(0, Math.cos(0.95), Math.sin(0.95));
  const t = new V3(0, -Math.sin(0.95), Math.cos(0.95));
  const i = new V3(-6e-3, -0.05, -0.088);
  return {
    colliders: [box(i.toArray(), [0.09, 0.012, 0.031], new Quat().setFromRotationMatrix(new Mat4().makeBasis(new V3(1, 0, 0), e, t)), 3e-3)],
    frame: gripFrame(i, new V3(-1, 0, 0), t.clone().negate()),
    about: 'a magazine held by its flat sides between the thumb and the fingers. Frame: origin at the middle of the magazine body, +Y toward its feed lips, -Z its front.',
    fit: {
      from: makePose({ thumb: [0.55, -0.1, -0.2, 1], fingers: [0.35, 0.1, 0.05, 0] }),
      to: makePose({ thumb: [1.25, 0.5, 0.5, 0.1], fingers: [1.3, 1.1, 0.6, 0] }),
    },
  };
})();

const same = (prof, about, fit) => ({ colliders: prof.colliders, frame: prof.frame, trigger: prof.trigger, about, fit });

export const GRIP_POSES = {
  rifle_grip: same(CARBINE_PROFILE, 'firing hand on an AR-style pistol grip, index straight along the receiver. Frame: origin at the top rear of the grip (where the web of the thumb sits), +Y up, -Z muzzle.', {
    from: OPEN_FIT,
    to: makePose({ thumb: THUMB_FIT, index: INDEX_FIT, middle: FIT_MIDDLE_FIT, ring: FIT_LITTLE_FIT, little: FIT_LITTLE_FIT }),
  }),
  trigger: {
    ...same(CARBINE_PROFILE, 'same grip with the index pad on the trigger (colliders include the trigger as a thin bar). setTrigger(0..1) pulls.', {
      from: makePose({ index: [-0.25, 0.2, 0.1, 0.16] }, OPEN_FIT),
      to: makePose({ thumb: THUMB_FIT, index: [0.34, 1.6, 0.95, 0.2], middle: FIT_MIDDLE_FIT, ring: FIT_LITTLE_FIT, little: FIT_LITTLE_FIT }),
    }),
    colliders: CARBINE_PROFILE.colliders.concat([capsule(CARBINE_PROFILE.trigger[0], CARBINE_PROFILE.trigger[1], 32e-4)]),
  },
  pistol_grip: same(PISTOL_PROFILE, 'high firing grip on a service pistol, index straight along the frame. Frame: origin at the top of the backstrap under the beavertail, +Y up, -Z muzzle.', {
    from: OPEN_FIT,
    to: makePose({ thumb: [0.95, 0.18, 0.22, 0.3], index: INDEX_FIT, middle: FIT_MIDDLE_FIT, ring: FIT_LITTLE_FIT, little: FIT_LITTLE_FIT }),
  }),
  slide_stop: same(PISTOL_PROFILE, 'pistol_grip with the thumb pressing the slide stop down (the lever sits on the left of the frame above the trigger).', {
    from: OPEN_FIT,
    to: makePose({ thumb: [1.15, 0.52, 0.66, 0.34], index: INDEX_FIT, middle: FIT_MIDDLE_FIT, ring: FIT_LITTLE_FIT, little: FIT_LITTLE_FIT }),
  }),
  pistol_support: same(PISTOL_SUPPORT_PROFILE, "support hand wrapped over the firing hand's fingers (the grip shape is padded by those fingers), thumb forward along the frame. Frame: the SAME part frame as pistol_grip (the pistol's tang), so both hands take one frame.", {
    from: makePose({ thumb: [0, -0.1, -0.1, 0.7], fingers: [-0.2, 1.1, 0.6, 0] }),
    to: makePose({ thumb: [0.6, 0.2, 0.2, 0.7], fingers: FIT_LITTLE_FIT }),
  }),
  foregrip: foregripEntry,
  handguard: handguardEntry,
  mag_cup: magCupEntry,
  mag_pinch: magPinchEntry,
  charging_handle: charging,
};

export const GRIP_NAMES = Object.keys(GRIP_POSES);

// ---------------------------------------------------------------------------
// grip socket + fitting  (source: fS / hS / il / M5 / ca / dS)
// ---------------------------------------------------------------------------
export const ONE = new V3(1, 1, 1);

// source: fS
export function gripAxesQuat(fingers, back) {
  const b = new V3(fingers[0], fingers[1], fingers[2]).normalize().negate();
  const i = new V3(back[0], back[1], back[2]);
  i.addScaledVector(b, -i.dot(b)).normalize();
  return new Quat().setFromRotationMatrix(new Mat4().makeBasis(new V3().crossVectors(i, b), i, b));
}

// source: hS
export function gripOffset(side, quat, pos, offset) {
  return new V3(side === 'left' ? -offset[0] : offset[0], offset[1], offset[2]).applyQuaternion(quat).negate().add(new V3(pos[0], pos[1], pos[2]));
}

// source: il — hand socket for a part frame placed at (pos, quat)
export function handSocket(side, frame, pos, quat, out = new Quat()) {
  const s = typeof frame === 'string' ? GRIP_POSES[frame].frame : frame;
  const a = side === 'left';
  const p = new V3(pos[0], pos[1], pos[2]);
  const l = a ? new V3(-p.x, p.y, p.z) : p;
  const c = a ? new Quat(quat.x, -quat.y, -quat.z, quat.w) : quat;
  out.copy(c).multiply(new Quat().copy(s.q).invert());
  const o = new V3().copy(s.p).negate().applyQuaternion(out).add(l);
  if (a) { o.x = -o.x; out.y = -out.y; out.z = -out.z; }
  return { p: o, q: out };
}

// source: M5 — same socket, but the frame is authored in the part's own space
export function partSocket(side, gripName, partPos, partQuat, out = new Quat()) {
  const f = GRIP_POSES[gripName].frame;
  const inv = new Quat().copy(f.q).invert();
  if (side === 'right') {
    out.copy(partQuat).multiply(inv);
    const p = new V3().copy(f.p).negate().applyQuaternion(out).add(partPos);
    return { p, q: out };
  }
  const mp = new V3(-partPos.x, partPos.y, partPos.z);
  const mq = new Quat(partQuat.x, -partQuat.y, -partQuat.z, partQuat.w);
  out.copy(mq).multiply(inv);
  const p = new V3().copy(f.p).negate().applyQuaternion(out).add(mp);
  p.x = -p.x; out.y = -out.y; out.z = -out.z;
  return { p, q: out };
}

// source: Jl wrapper rS / fitGrip
export function fitGrip(shapes, opts = {}) {
  const o = opts.palm === undefined ? { ...opts, palm: palmDistance } : opts;
  return Jl(shapes, o);
}

// source: ca — a named grip point: hand transform + pose fitted to `shapes`
export function gripPoint(name, side, p, q, shapes, opts = {}) {
  const inv = new Mat4().compose(p, q, ONE).invert();
  let local = transformColliders(shapes, inv);
  if (side === 'left') local = mirrorColliders(local);
  prepareShapes(local);
  const pose = Jl(local, { palm: palmDistance, ...opts });
  return { name, side, p: p.clone(), q: q.clone(), pose, shapes: local, depth: poseDepth(pose, local).depth };
}

// source: dS — grip point plus extra shapes
export function gripPointExtra(base, name, fitOpts = {}, extra = null) {
  let shapes = base.shapes;
  if (extra) {
    const inv = new Mat4().compose(base.p, base.q, ONE).invert();
    let a = transformColliders(extra, inv);
    if (base.side === 'left') a = mirrorColliders(a);
    shapes = shapes.concat(a);
  }
  prepareShapes(shapes);
  const pose = Jl(shapes, { palm: palmDistance, ...fitOpts });
  return { ...base, name, pose, shapes, depth: poseDepth(pose, shapes).depth };
}

// ---------------------------------------------------------------------------
// finger pose solver  (source: Jl, verbatim)
// ---------------------------------------------------------------------------
const _selfState = newPoseState();
const _selfShapes = [];

export function Jl(shapes, opts = {}) {
  const from = resolvePose(opts.from || 'open');
  const to = resolvePose(opts.to || 'fist');
  const skin = opts.skin ?? 8e-4;
  const steps = opts.steps || 40;
  const palm = opts.palm || null;
  const out = opts.out || new Float32Array(POSE_LEN);
  out.set(resolvePose(opts.rest || from));
  const l = [0, 0, 0];
  const digits = opts.digits || [1, 2, 3, 4, 0];
  for (const c of digits) {
    let self = null;
    if (c === 0 && opts.self !== false) {
      solveHand(out, _selfState);
      self = _selfShapes;
      self.length = 0;
      for (let v = 1; v < 5; v++) {
        for (let y = 0; y < 3; y++) {
          const d = DIGITS[v];
          const g = _selfState.j[v * 4 + y], E = _selfState.j[v * 4 + y + 1];
          const tip = y === 2
            ? [E.x + (g.x - E.x) * d.rad[3] / d.len[2], E.y + (g.y - E.y) * d.rad[3] / d.len[2], E.z + (g.z - E.z) * d.rad[3] / d.len[2]]
            : [E.x, E.y, E.z];
          self.push(capsule([g.x, g.y, g.z], tip, (d.rad[y] + d.rad[y + 1]) / 2));
        }
      }
      prepareShapes(self);
    }
    const f = c * 4;
    const h = (v, y) => {
      for (let b = 0; b < 3; b++) {
        const g = b > y ? Math.min(1, l[b] + v / steps) : l[b];
        out[f + b] = from[f + b] + (to[f + b] - from[f + b]) * g;
        if (b === 0) out[f + 3] = from[f + 3] + (to[f + 3] - from[f + 3]) * g;
      }
    };
    const prev = [0, 0, 0];
    const probe = (v) => {
      const y = jointClearance(out, c, shapes, palm, self);
      let b = -1;
      for (let g = v + 1; g < 3; g++) if (y[g] + skin > 0 && y[g] > prev[g] + 1e-7) b = g;
      return b;
    };
    const snap = () => {
      const v = jointClearance(out, c, shapes, palm, self);
      prev[0] = v[0]; prev[1] = v[1]; prev[2] = v[2];
    };
    l[0] = l[1] = l[2] = 0;
    h(0, 2);
    snap();
    let x = -1;
    for (let v = 0; v < steps && x < 2; v++) {
      h(1, x);
      let y = probe(x);
      if (y < 0) {
        for (let E = x + 1; E < 3; E++) l[E] = Math.min(1, l[E] + 1 / steps);
        snap();
        continue;
      }
      let b = 0, g = 1;
      for (let E = 0; E < 10; E++) {
        const M = (b + g) / 2;
        h(M, x);
        const u = probe(x);
        if (u < 0) b = M; else { g = M; y = u; }
      }
      for (let E = x + 1; E < 3; E++) l[E] = Math.min(1, l[E] + b / steps);
      h(0, 2);
      snap();
      x = y;
      v--;
    }
    h(0, 2);
  }
  if (opts.hold) {
    for (let c = 0; c < 5; c++) {
      const u = opts.hold[DIGIT_NAMES[c]];
      if (u) for (let f = 0; f < 4; f++) out[c * 4 + f] = u[f];
    }
  }
  return out;
}

// source: mS — capsule outline of the fingers of a pose
export function fingerColliders(point, pose = point.pose, list = [1, 2, 3, 4]) {
  const st = solveHand(pose, newPoseState());
  const m = new Mat4().compose(point.p, point.q, ONE);
  const s = point.side === 'left' ? -1 : 1;
  const xf = (v) => new V3(v.x * s, v.y, v.z).applyMatrix4(m).toArray();
  const out = [];
  for (const l of list) {
    for (let c = 0; c < 3; c++) {
      const d = DIGITS[l];
      const f = st.j[l * 4 + c], h = st.j[l * 4 + c + 1];
      const p = c === 2 ? h.clone().lerp(f, d.rad[3] / d.len[2]) : h;
      out.push(capsule(xf(f), xf(p), (d.rad[c] + d.rad[c + 1]) / 2));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// glove mesh  (the SDF primitives as real meshes)
// ---------------------------------------------------------------------------
// source color palette (var Ay) — the glove's material zones
export const COLORS = {
  olive: [0.15, 0.156, 0.094], gusset: [0.066, 0.071, 0.05], tan: [0.33, 0.245, 0.14],
  tanDark: [0.235, 0.172, 0.1], rubber: [0.06, 0.062, 0.068], stitch: [0.5, 0.44, 0.3],
  cuff: [0.062, 0.066, 0.056], strap: [0.036, 0.038, 0.04], navy: [0.046, 0.068, 0.106],
};

export const SHAPE_MESH = 'SDF primitives (capsule/rounded box) as meshes — surface:"primitives" fallback';
export const SHAPE_SDF = 'single isosurface of the glove SDF, baked with surface nets (source: fD/My)';

// Tapered capsule along -Z from 0 to -len, radii ra -> rb, elliptical width `wide` on x.
function capsuleGeometry(len, ra, rb, wide = 1, radial = 12, cap = 4) {
  const rings = [];
  for (let i = cap; i >= 1; i--) {
    const a = (i / cap) * (Math.PI / 2);
    rings.push([ra * Math.cos(a), ra * Math.sin(a)]);
  }
  rings.push([ra, 0], [rb, -len]);
  for (let i = 1; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    rings.push([rb * Math.cos(a), -len - rb * Math.sin(a)]);
  }
  const pos = [], idx = [];
  for (let r = 0; r < rings.length; r++) {
    const [rad, z] = rings[r];
    for (let j = 0; j < radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      pos.push(Math.cos(phi) * rad * wide, Math.sin(phi) * rad, z);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < radial; j++) {
      const a = r * radial + j, b = r * radial + ((j + 1) % radial);
      const c = a + radial, d = b + radial;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function partColor(part) {
  if (part.group === GROUP.guard) return COLORS.rubber;
  if (part.group === GROUP.thumb) {
    if (part.type === 'box' && part.half[0] > 0.012 && part.half[1] > 0.01) return COLORS.tan;
    return COLORS.olive;
  }
  if (part.type === 'capsule') return COLORS.olive;
  if (part.half[0] > 0.03) return COLORS.tan;
  if (part.half[0] > 0.012) return COLORS.tanDark;
  return COLORS.gusset;
}

function partGeometry(part) {
  let g;
  if (part.type === 'capsule') g = capsuleGeometry(part.len, part.ra, part.rb, part.wide);
  else g = bevelBox(part.half[0] * 2, part.half[1] * 2, part.half[2] * 2, part.round);
  const c = partColor(part);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

const mirrorQuat = (q, out = new Quat()) => out.set(q.x, -q.y, -q.z, q.w);

// Rest-pose world transform of every bone in the right-hand frame (source: Fh's rest skeleton).
// uD() authors its primitives in exactly these frames, so a primitive's local transform relative
// to its bone is inv(boneRest) * partRest.
const REST_BONE_WORLD = (() => {
  const one = new V3(1, 1, 1);
  const out = new Map();
  out.set(BONE.hand, new Mat4());
  for (let e = 0; e < 5; e++) {
    let parent = out.get(BONE.hand);
    for (let F = 0; F < 3; F++) {
      const pos = F === 0 ? new V3(DIGITS[e].base[0], DIGITS[e].base[1], DIGITS[e].base[2]) : new V3(0, 0, -DIGITS[e].len[F - 1]);
      const world = new Mat4().multiplyMatrices(parent, new Mat4().compose(pos, digitQuat(e, F, REST), one));
      out.set(BONE.digit(e, F), world);
      out.set(BONE.helper(e, F), world);
      parent = world;
    }
  }
  return out;
})();

// local transform of a primitive relative to its bone, in the right-hand frame
function partLocalMatrix(part) {
  const world = REST_BONE_WORLD.get(part.bone);
  const partM = new Mat4().compose(new V3(part.o[0], part.o[1], part.o[2]), part.quat, new V3(1, 1, 1));
  return new Mat4().multiplyMatrices(new Mat4().copy(world).invert(), partM);
}
const HELPER_LAG = [0.16, 0.2, 0.2];

// ---------------------------------------------------------------------------
// createHand
// ---------------------------------------------------------------------------
export function createHand(side = 'right', opts = {}) {
  const s = side === 'left' ? -1 : 1;
  const surface = opts.surface || 'sdf';
  const root = new THREE.Group();
  root.name = `hand-${side}`;

  const material = opts.material || new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0.0,
  });
  material.name = material.name || 'yardkit_glove';

  const boneRoot = new THREE.Bone();
  boneRoot.name = 'hand';
  root.add(boneRoot);

  const digits = [];
  for (let e = 0; e < 5; e++) {
    digits.push([]);
    let parent = boneRoot;
    for (let F = 0; F < 3; F++) {
      const d = DIGITS[e];
      const bone = new THREE.Bone();
      bone.name = `${d.name}${F + 1}`;
      if (F === 0) bone.position.set(d.base[0] * s, d.base[1], d.base[2]);
      else bone.position.set(0, 0, -d.len[F - 1]);
      bone.quaternion.copy(digitQuat(e, F, REST));
      if (s < 0) { bone.quaternion.y = -bone.quaternion.y; bone.quaternion.z = -bone.quaternion.z; }
      parent.add(bone);
      const helper = new THREE.Bone();
      helper.name = `${d.name}Helper${F + 1}`;
      bone.add(helper);
      digits[e].push({ bone, helper, rest: bone.quaternion.clone() });
      parent = bone;
    }
  }

  const boneOf = (id) => {
    if (id === BONE.hand) return boneRoot;
    if (id >= 20) {
      const t = id - 20;
      return digits[t / 3 | 0][t % 3].helper;
    }
    const t = id - 5;
    return digits[t / 3 | 0][t % 3].bone;
  };

  const meshes = [];
  const geos = [];
  let skinned = null;
  let skeleton = null;

  if (surface === 'sdf') {
    // One connected surface, skinned to the 35-slot rig the source's fD/My bake writes into.
    // bones[0..3] (the arm chain the game has) stay empty: the hand-only part set never weights them.
    const fake = [];
    for (let i = 0; i < BONE.hand; i++) {
      const b = new THREE.Bone();
      b.name = ['upperArm', 'forearm', 'forearmTwist1', 'forearmTwist2'][i];
      root.add(b);
      fake.push(b);
    }
    const bones = new Array(BONE.count);
    for (let i = 0; i < BONE.hand; i++) bones[i] = fake[i];
    bones[BONE.hand] = boneRoot;
    for (let id = BONE.digit(0, 0); id < BONE.count; id++) bones[id] = boneOf(id);
    root.updateMatrixWorld(true);
    const base = bakedHandGeometry({ ...(opts.bake || {}), ...(opts.surfaceOptions || {}) });
    const geo = s < 0 ? mirrorSurfaceGeometry(base) : base.clone();
    geos.push(geo);
    skeleton = new THREE.Skeleton(bones);
    skinned = new THREE.SkinnedMesh(geo, material);
    skinned.name = `glove-surface-${side}`;
    skinned.castShadow = opts.castShadow ?? true;
    skinned.receiveShadow = opts.receiveShadow ?? true;
    skinned.frustumCulled = false;
    root.add(skinned);
    skinned.bind(skeleton);
    meshes.push(skinned);
  } else {
    const posTmp = new V3(), quatTmp = new Quat(), scaleTmp = new V3();
    for (const part of HAND_PARTS.parts) {
      const geo = partGeometry(part);
      geos.push(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `glove-${part.type}-${part.group}`;
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      mesh.frustumCulled = false;
      partLocalMatrix(part).decompose(posTmp, quatTmp, scaleTmp);
      // the left glove is the mirror image (source: qE): same geometry, mirrored placement
      mesh.position.set(s < 0 ? -posTmp.x : posTmp.x, posTmp.y, posTmp.z);
      if (s < 0) mirrorQuat(quatTmp, mesh.quaternion); else mesh.quaternion.copy(quatTmp);
      boneOf(part.bone).add(mesh);
      meshes.push(mesh);
    }
  }

  // ---- pose state ----
  const shown = new Float32Array(POSE_LEN);
  shown.set(resolvePose(opts.pose || 'relaxed'));
  const target = new Float32Array(POSE_LEN);
  target.set(shown);
  let trigger = 0, triggerShown = 0;
  const rate = opts.rate ?? 16;
  const state = newPoseState();
  const scaled = new Float32Array(POSE_LEN);
  const qTmp = new Quat(), qHelper = new Quat(), qLocal = new Quat(), qInv = new Quat(), vOffset = new V3();

  function applyPose(pose, trig) {
    for (let i = 0; i < POSE_LEN; i++) scaled[i] = pose[i];
    for (let a = 0; a < 4; a++) scaled[4 + a] += TRIGGER_PULL[a] * trig;
    clampPose(scaled);
    solveHand(scaled, state);
    for (let e = 0; e < 5; e++) {
      for (let F = 0; F < 3; F++) {
        const rec = digits[e][F];
        // source M(): the bone takes _h(A,F) — the LOCAL phalanx rotation, not the solved
        // cumulative hand-space quaternion in state.q.
        qTmp.copy(digitQuat(e, F, scaled));
        if (s < 0) { qTmp.y = -qTmp.y; qTmp.z = -qTmp.z; }   // source: x(_h(...)) for the left arm
        rec.bone.quaternion.copy(qTmp);
        // helper bone: source M() — slerp(rest, pose, 0.5) with a radial bend offset
        qHelper.copy(rec.rest).slerp(qTmp, 0.5);
        qLocal.copy(qTmp).invert().multiply(qHelper);
        rec.helper.quaternion.copy(qLocal);
        const delta = e === 0 && F === 0 ? 0 : scaled[e * 4 + F] - REST[e * 4 + F];
        const w = Math.sin(Math.min(Math.max(delta, 0), 2) * 0.5);
        vOffset.set(0, HELPER_LAG[F] * DIGITS[e].rad[F] * w * w, 0).applyQuaternion(qHelper);
        qInv.copy(qTmp).invert();
        rec.helper.position.copy(vOffset.applyQuaternion(qInv));
      }
    }
    if (skeleton) {
      root.updateMatrixWorld(true);
      skeleton.update();
    }
  }

  applyPose(shown, 0);

  function update(dt, poseArg) {
    if (poseArg !== undefined && poseArg !== null) {
      if (typeof poseArg === 'object' && !Array.isArray(poseArg) && !(poseArg instanceof Float32Array)) {
        if (poseArg.pose !== undefined) target.set(resolvePose(poseArg.pose));
        if (poseArg.trigger !== undefined) trigger = Math.min(1, Math.max(0, +poseArg.trigger || 0));
      } else {
        target.set(resolvePose(poseArg));
      }
    }
    const step = rate > 0 ? Math.min(1, Math.max(0, dt * rate)) : 1;
    lerpPose(shown, shown, target, step);
    triggerShown += (trigger - triggerShown) * step;
    applyPose(shown, triggerShown);
    return shown;
  }

  root.userData = {
    side,
    surface,
    bones: { hand: boneRoot, digits },
    meshes,
    mesh: meshes[0] || null,
    skeleton,
    stats: meshes[0] && meshes[0].geometry.userData,
    parts: HAND_PARTS.parts,
    shape: surface === 'sdf' ? SHAPE_SDF : SHAPE_MESH,
    get pose() { return shown; },
    get trigger() { return triggerShown; },
    setPose(name) { target.set(resolvePose(name)); return root; },
    setTrigger(v) { trigger = Math.min(1, Math.max(0, +v || 0)); return root; },
    update,
    dispose() {
      for (const g of geos) g.dispose();
      if (skeleton) skeleton.dispose();
      if (!opts.material) material.dispose();
      root.removeFromParent();
    },
  };

  return {
    root, update, mesh: meshes[0] || null, skeleton, surface, stats: root.userData.stats,
    setPose(name) { root.userData.setPose(name); return root; },
    setTrigger(v) { root.userData.setTrigger(v); return root; },
    get pose() { return shown; },
    dispose: root.userData.dispose,
  };
}

// ---------------------------------------------------------------------------
// createHandRig — both hands, ready to be attached to a camera / weapon
// ---------------------------------------------------------------------------
export function createHandRig(opts = {}) {
  const R = createHand('right', opts);
  const L = createHand('left', opts);
  const root = new THREE.Group();
  root.name = 'hand-rig';
  root.add(R.root, L.root);
  if (opts.pose) { R.setPose(opts.pose); L.setPose(opts.pose); }

  const update = (dt, state = {}) => {
    R.update(dt, state.right ?? state.R ?? state.pose);
    L.update(dt, state.left ?? state.L ?? state.pose);
    return root;
  };
  const setPose = (pose) => { R.setPose(pose); L.setPose(pose); return root; };

  root.userData = { R: R.root, L: L.root, hands: { R, L }, update, setPose, dispose() { R.dispose(); L.dispose(); } };
  return { root, R, L, hands: { R, L }, update, setPose, dispose: root.userData.dispose };
}

// lower-case aliases for the solvers (the source names are one/two letters)
export { Jl as solveFingerPose };
export const gripPoses = GRIP_POSES;

