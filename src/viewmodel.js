// viewmodel.js — first-person viewmodel (weapon + hands on the grips + pose/recoil/reload),
// extracted from Saltline.
//
// Source functions (/tmp/sl.pretty.js):
//   wS()  L30723  the viewmodel-pac9 assembly      -> this file's pac9 viewmodel
//   zS()  L31006  the viewmodel-pac4 assembly      -> this file's pac4 viewmodel
//   zD()  L30705  carbine grip sizing/socket table -> GRIPS.pac9 below
//   ND()  L30968  pistol grip sizing/socket table  -> GRIPS.pac4 below
//   ID()/FD()     the geometry measurements those two use (via gi/Bu/gS) — the numbers they
//                 produce for the kit's PAC-9 / PAC-4 meshes are baked into GRIPS (the source's
//                 own measurement regions are noted there)
//   bh    L29435  weapon motion table (rifle/pistol: pivot, ADS, recoil springs)
//   ft / It       reload timelines (2.24 s / 1.50 s, empty 2.72 s / 1.90 s)
//   Uy / Xy       view tables (hip/ADS poses); entry 0 "close" is the default pose
//   en()  L29415  the damped spring integrator (ported verbatim)
//   D.parts()     bolt/slide cycling
//
// Not ported (game runtime): the per-frame weapon motion state machine (idle breathing, walk/run
// gait, sway/look lag, air/land, wall push, sprint pose, equip), the arm IK + forearm sleeve
// (createArm/Fh — this kit has no skinned arm mesh, so each hand is parented to its grip socket
// exactly like the game's `hands-studio` static poses), M1()/ME() (engraving decals and holo lens,
// already part of createPAC9/createPAC4), and the trigger-finger IK (Uu/FE) — the trigger is
// animated with TRIGGER_PULL like the arm rig's setTrigger().
//
// The weapon geometry is NOT rebuilt here: createPAC9()/createPAC4() from weapons.js are reused and
// only their bolt/slide and magazine are animated (source: D.parts / D.reload).

import * as THREE from 'three';
import { createPAC9, createPAC4, PAC9_SPECS, PAC4_SPECS } from './weapons.js';
import {
  createHand, box, handSocket, gripPoint, fingerColliders, GRIP_POSES,
} from './hands.js';

const { Vector3: V3, Quaternion: Quat, Matrix4: Mat4, Euler, Group } = THREE;

// ---------------------------------------------------------------------------
// motion data  (source: bh.rifle / bh.pistol, trimmed to what a viewmodel needs)
// ---------------------------------------------------------------------------
export const MOTION = {
  rifle: {
    pivot: [0, -0.035, 0.3],
    ads: { pos: 0.22, rot: 0.05, z: 0.75 },
    recoil: {
      back: 0.82, rise: 1.5, yaw: 0.95, roll: 1.7, up: 0.11, side: 0.09, first: 1.4,
      adsBack: 0.75, adsRot: 0.1, adsPos: 0.9,
      spr: { kZ: [44, 0.55], kP: [36, 0.5], kY: [30, 0.45], kR: [31, 0.42], kX: [40, 0.5], kU: [40, 0.5] },
    },
  },
  pistol: {
    pivot: [0, -0.085, 0.075],
    ads: { pos: 0.14, rot: 0.06, z: 0.75 },
    recoil: {
      back: 0.55, rise: 6.4, yaw: 1.3, roll: 2.3, up: 0.2, side: 0.1, first: 1,
      adsBack: 0.8, adsRot: 0.42, adsPos: 0.8,
      spr: { kZ: [56, 0.55], kP: [50, 0.5], kY: [38, 0.48], kR: [38, 0.45], kX: [46, 0.5], kU: [46, 0.5] },
    },
  },
};

// source: Uy[0] / Xy[0] — the "close" view: hip pose in camera space, plus the ADS pose
// (Ly: ADS = { p: [0, -sightY, t], r: [0, 0, 0] } with t the view's z distance).
export const VIEWS = {
  pac9: { hip: { p: [0.1, -0.109, -0.219], r: [-0.045, 0.035, 0.09] }, sightY: 0.069, adsZ: -0.1065 },
  pac4: { hip: { p: [0.075, -0.071, -0.343], r: [0.01, 0.08, 0.1] }, sightY: 0.0165, adsZ: -0.44 },
};

// source: ft (carbine reload) / It (pistol reload)
export const RELOAD_TIMES = {
  pac9: { tac: 2.24, empty: 2.72, atMag: 0.36, magout: 0.4, clear: 0.52, away: 0.74, swap: 0.8, rise: 0.86, align: 1.1, insert: 1.15, windup: 1.385, magin: 1.44, rebound: 1.5, regrip: 1.54, tugDown: 1.6, tugUp: 1.66, swapBack: 1.75, atHandle: 1.84, tacBack: 1.89, tacRelease: 1.905, tacBolt: 1.93, back: 1.96, release: 2.12, bolt: 2.155, partial: 0.32 },
  pac4: { tac: 1.5, empty: 1.9, release: 0.12, magout: 0.18, swap: 0.48, rise: 0.52, align: 0.84, insert: 0.9, fingers: 1.02, windup: 1.075, magin: 1.13, rebound: 1.19, swapBack: 1.3, regrip: 1.44, thumb: 1.53, slideRelease: 1.575, slide: 1.61, partial: 1 },
};

// ---------------------------------------------------------------------------
// grip anchors — measured from the kit's own PAC-9 / PAC-4 geometry with the game's
// ID()/FD() measurement regions.  Weapon space: +Y up, -Z muzzle.
// ---------------------------------------------------------------------------
const X_AXIS = new V3(1, 0, 0);
const rotX = (a) => new Quat().setFromAxisAngle(X_AXIS, a);
const rotY = (a) => new Quat().setFromAxisAngle(new V3(0, 1, 0), a);

// ID(): m = mn(gripDim.c, [hw, hl, hd], Uh(-rake)) — the pistol grip box
const PAC9_GRIP = { c: [0, -0.101, 0.0724], h: [0.015, 0.0614, 0.0286], rake: 0.2818, round: 0.0135 };
// ID(): y = the receiver/upper box behind the web (gi over the ano mesh)
const PAC9_RECEIVER = { c: [0, -0.0153, 0.0019], h: [0.0176, 0.0398, 0.0987], round: 3e-3 };
// ID(): b = the magwell box
const PAC9_MAGWELL = { c: [0, -0.0545, -0.0665], h: [0.0186, 0.0345, 0.0355], round: 3e-3 };
// ID(): r.fore[0] = the measured vertical-foregrip section, r.fore[1] = the handguard tube
const PAC9_FORE = { c: [0, -0.0588, -0.256], h: [0.015, 0.0386, 0.0165], round: 0.01 };
const PAC9_HANDGUARD = { c: [0, 0, -0.255], h: [PAC9_SPECS.handguardR, PAC9_SPECS.handguardR, 0.146], round: 0.008 };

// FD(): d = mn(gripDim.c, [hw, hl, hd], Yy(-rake)) — the pistol grip box
const PAC4_GRIP = { c: [0, -0.0815, 0.07], h: [0.015, 0.0605, 0.0281], rake: 0.314, round: 0.011 };
// FD(): v = the frame + slide block the web sits under
const PAC4_FRAME = { c: [0, -0.011, -0.0075], h: [0.0162, 0.0228, 0.1], round: 3e-3 };
// FD(): S = the frame web above the backstrap
const PAC4_TOP = { c: [0, -0.0185, 0.0859], h: [0.014, 0.0125, 0.00475], round: 4e-3 };

const boxes = (...list) => list.map((e) => box(e.c, e.h, e.rot || null, e.round));
const gripBoxes = (g, extra = []) => [box(g.c, g.h, rotX(-g.rake), g.round), ...boxes(...extra)];

export const GRIPS = {
  pac9: {
    right: {
      pose: 'rifle_grip',            // GRIP_POSES entry used for the finger fit
      tang: [0, -0.073, 0.0976],     // ID(): r.tang = (0, E.min[1] + 0.0275, back(...))
      shapes: gripBoxes(PAC9_GRIP, [PAC9_RECEIVER, PAC9_MAGWELL]),
    },
    left: {
      pose: 'foregrip',
      anchor: [0, -0.0282, -0.256],  // ID(): r.foreTop + (0, -foreDrop, 0)
      anchorQuat: rotY(-0.8).multiply(rotX(0.08)), // By(foreYaw) * Uh(foreTip)
      shapes: boxes(PAC9_FORE, PAC9_HANDGUARD),
    },
    mag: { pinch: [0, -0.09, 0], size: [0.012, 0.1, 0.03], tilt: 0 },
  },
  pac4: {
    right: {
      pose: 'pistol_grip',
      tang: [0, -0.0405, 0.0862],    // FD(): r.tang = (0, y.min[1] + 0.026, back(...))
      shapes: gripBoxes(PAC4_GRIP, [PAC4_FRAME, PAC4_TOP]),
    },
    left: {
      pose: 'pistol_support',
      tang: [0, -0.0405, 0.0862],    // ND(): the support hand takes the SAME part frame
      carriesFiringHand: true,       // ND(): colliders = grip + mS(firing-hand fingers)
      shapes: gripBoxes(PAC4_GRIP, [PAC4_FRAME, PAC4_TOP]),
    },
    mag: { pinch: [0, -0.06, 0], size: [0.012, 0.06, 0.028], tilt: 0.314 },
  },
};


// ---------------------------------------------------------------------------
// grip measurement  (source: gi / Bu / gS, used by ID() and FD())
// These three are the "mesh finishing" helpers from the same block: they read a mesh's vertices
// and turn them into a grip's rake / half-width / half-length / half-depth / tang point.  The
// numbers in GRIPS are exactly what they produce for the kit's PAC-9 / PAC-4 geometry;
// measurePac9Grip()/measurePac4Grip() recompute them so the constants stay verifiable.
// ---------------------------------------------------------------------------
const MEASURE_STEP = 0.01;
const TANG_PAC9 = 0.0275;   // MS in zD()
const TANG_PAC4 = 0.026;    // PS in ND()

// all vertices of a group, in the group's own space
export function meshVertices(root) {
  const out = [];
  root.updateMatrixWorld(true);
  const inv = new Mat4().copy(root.matrixWorld).invert();
  const m = new Mat4(), v = new V3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      out.push(v.x, v.y, v.z);
    }
  });
  return out;
}

// source: gi — vertex bounds inside an axis-aligned box
export function meshRegion(pts, min, max) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  let n = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2];
    if (x < min[0] || x > max[0] || y < min[1] || y > max[1] || z < min[2] || z > max[2]) continue;
    n++;
    if (x < lo[0]) lo[0] = x; if (x > hi[0]) hi[0] = x;
    if (y < lo[1]) lo[1] = y; if (y > hi[1]) hi[1] = y;
    if (z < lo[2]) lo[2] = z; if (z > hi[2]) hi[2] = z;
  }
  return { min: lo, max: hi, n };
}

// source: Bu — slab scan from the top of a box downwards
export function sliceScan(pts, min, max, step = MEASURE_STEP) {
  const out = [];
  for (let y = max[1]; y > min[1] + 1e-9; y -= step) {
    const r = meshRegion(pts, [min[0], Math.max(min[1], y - step), min[2]], [max[0], y, max[2]]);
    if (r.n) out.push({ y: y - step / 2, x0: r.min[0], x1: r.max[0], z0: r.min[2], z1: r.max[2], n: r.n });
  }
  return out;
}

// source: gS — least-squares front/back lines through the slices -> grip rake, width, depth.
// `depthRatio` is the source's 0.75 slab-depth filter; the kit's PAC-9 grip tapers enough that
// the filtered set is only the receiver-side slabs, so measurePac9Grip() passes 0 there.
export function fitGripShape(slices, depthRatio = 0.75) {
  const deepest = Math.max(...slices.map((l) => l.z1 - l.z0));
  const shaft = slices.filter((l) => l.z1 - l.z0 > depthRatio * deepest);
  const line = (key) => {
    let sy = 0, sv = 0, syy = 0, syv = 0;
    for (const m of shaft) { sy += m.y; sv += m[key]; syy += m.y * m.y; syv += m.y * m[key]; }
    const n = shaft.length;
    const slope = n > 1 ? (n * syv - sy * sv) / (n * syy - sy * sy) : 0;
    return [(sv - slope * sy) / n, slope];
  };
  const front = line('z0'), back = line('z1');
  const at = (l) => front[0] + front[1] * l;
  const ab = (l) => back[0] + back[1] * l;
  return {
    rake: Math.atan(-(front[1] + back[1]) / 2),
    hw: Math.max(...shaft.map((l) => Math.max(-l.x0, l.x1))),
    top: Math.max(...slices.map((l) => l.y)),
    bottom: Math.min(...slices.map((l) => l.y)),
    front: at, back: ab,
    centre: (l) => (at(l) + ab(l)) / 2,
    depth: (l) => ab(l) - at(l),
  };
}

// source: ID()'s grip part — carbine pistol grip + tang (weapon space, +Y up, -Z muzzle)
export function measurePac9Grip(root) {
  const pts = Array.isArray(root) ? root : meshVertices(root);
  const g = [0, -0.1, 0.073];                     // wn.grip
  const all = meshRegion(pts, [-0.02, g[1] - 0.065, g[2] - 0.045], [0.02, g[1] + 0.058, g[2] + 0.05]);
  // no slab-depth filter: the kit's grip tapers, so gS's 0.75 filter would keep only the
  // receiver-side slabs and report a forward rake
  const gs = fitGripShape(sliceScan(pts, [-0.02, g[1] - 0.06, g[2] - 0.045], [0.02, g[1] + 0.03, g[2] + 0.05]), 0);
  const rake = gs.rake;
  const top = all.max[1], bottom = gs.bottom - 5e-3, mid = (top + bottom) / 2;
  const grip = {
    rake,
    hw: gs.hw,
    hl: (top - bottom) / 2 / Math.cos(rake),
    hd: gs.depth(mid) / 2 * Math.cos(rake) + 8e-4,
    c: [0, mid, gs.centre(mid) - 8e-4],
  };
  const E = meshRegion(pts, [-9e-3, g[1] - 4e-3, g[2] - 0.115], [9e-3, g[1] + 6e-3, g[2] - 0.03]);
  const y = E.min[1] + TANG_PAC9;
  return { grip, tang: [0, y, gs.back(y)], top, bottom };
}

// source: ID()'s foregrip/handguard part
export function measurePac9Fore(root) {
  const pts = Array.isArray(root) ? root : meshVertices(root);
  const t = [0, 0, -0.255];                       // wn.handguard
  const R = PAC9_SPECS.handguardR;
  const min = [-0.03, -R - 0.085, t[2] - 0.03], max = [0.03, -R + 2e-3, t[2] + 0.03];
  const S = sliceScan(pts, min, max).slice(1);
  const z = Math.min(...S.map((l) => l.z0)), I = Math.max(...S.map((l) => l.z1));
  const L = Math.max(...S.map((l) => l.x1));
  const U = meshRegion(pts, min, max);
  return {
    top: [0, U.max[1], (z + I) / 2],
    dim: { hw: L, hd: (I - z) / 2, len: U.max[1] - U.min[1] },
    box: { c: [0, (U.max[1] + U.min[1]) / 2, (z + I) / 2], h: [L, (U.max[1] - U.min[1]) / 2, (I - z) / 2] },
  };
}

// source: FD()'s grip part — pistol grip + tang (PAC-4's G0 follows PAC4_SPECS)
export function measurePac4Grip(root) {
  const pts = Array.isArray(root) ? root : meshVertices(root);
  const e = 0.0335, t = 0.0925, i = -0.06, rake = 0.314, o = Math.tan(rake);  // G0.gripFront/Back, G0.rake
  const lat = meshRegion(pts, [-0.03, i - 0.02, e], [0.03, i + 0.01, t]);
  const hw = Math.min(-lat.min[0], lat.max[0]);
  const top = meshRegion(pts, [-0.02, i + 0.015, t - 4e-3], [0.02, i + 0.048, t + 3e-3]).min[1];
  const bottom = meshRegion(pts, [-0.03, i - 0.14, e], [0.03, i, t + 0.03]).min[1];
  const mid = (top + bottom) / 2;
  const grip = {
    rake,
    hw,
    hl: (top - bottom) / 2 / Math.cos(rake),
    hd: (t - e) / 2 * Math.cos(rake),
    c: [0, mid, (e + t) / 2 + (i - mid) * o],
  };
  const y = meshRegion(pts, [-9e-3, i - 8e-3, e - 0.064], [9e-3, i - 3e-3, e - 4e-3]);
  const yt = y.min[1] + TANG_PAC4;
  return { grip, tang: [0, yt, t + (i - yt) * o], top, bottom };
}

// ---------------------------------------------------------------------------
// spring integrator  (source: en, verbatim)
// ---------------------------------------------------------------------------
export function spring(s, target, dt, w = s.w, z = s.z) {
  const o = s.x - target, r = s.v;
  if (z >= 0.999) {
    const a = Math.exp(-w * dt), l = r + w * o;
    s.x = target + (o + l * dt) * a;
    s.v = (r - w * l * dt) * a;
  } else {
    const a = w * Math.sqrt(1 - z * z), l = Math.exp(-z * w * dt), c = Math.cos(a * dt), u = Math.sin(a * dt);
    const f = (r + z * w * o) / a;
    s.x = target + l * (o * c + f * u);
    s.v = l * (a * (f * c - o * u) - z * w * (o * c + f * u));
  }
  return s.x;
}

const mkSpring = ([w, z]) => ({ x: 0, v: 0, w, z });
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const ramp = (t, a, b) => smooth((t - a) / ((b - a) || 1e-6));
const mix = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// createViewModel
// ---------------------------------------------------------------------------
export function createViewModel(weapon = 'pac9', opts = {}) {
  let id, gun;
  if (typeof weapon === 'string') {
    id = weapon === 'pac4' ? 'pac4' : 'pac9';
    const make = id === 'pac4' ? createPAC4 : createPAC9;
    gun = make({ animate: false, ...(opts.weapon || {}) });
  } else {
    gun = weapon;
    id = gun.name === 'pac4' ? 'pac4' : 'pac9';
  }

  const motion = MOTION[id === 'pac4' ? 'pistol' : 'rifle'];
  const view = VIEWS[id];
  const spec = GRIPS[id];
  const reload = RELOAD_TIMES[id];

  const root = new Group();
  root.name = `viewmodel-${id}`;
  const body = new Group();
  body.name = 'viewmodel-motion';
  root.add(body);
  const pivotGroup = new Group();
  pivotGroup.name = 'viewmodel-pivot';
  body.add(pivotGroup);
  pivotGroup.position.fromArray(motion.pivot).negate();
  pivotGroup.add(gun);

  // hip / ADS pose (source: root.position = view.p - pivot ...; quaternion = view.r)
  const hipP = new V3().fromArray(view.hip.p);
  const hipQ = new Quat().setFromEuler(new Euler(view.hip.r[0], view.hip.r[1], view.hip.r[2], 'YXZ'));
  const adsP = new V3(0, -view.sightY, view.adsZ);
  const adsQ = new Quat();
  root.position.copy(hipP);
  root.quaternion.copy(hipQ);

  // ---- hands on their sockets ----
  const R = createHand('right', { ...opts.hand, pose: 'relaxed' });
  const L = createHand('left', { ...opts.hand, pose: 'relaxed' });
  pivotGroup.add(R.root, L.root);

  const rightSocket = handSocket('right', GRIP_POSES[spec.right.pose].frame, spec.right.tang, new Quat());
  const rightFit = gripPoint('grip', 'right', rightSocket.p, rightSocket.q, spec.right.shapes, GRIP_POSES[spec.right.pose].fit);
  rightFit.socket = rightSocket;
  R.root.position.copy(rightSocket.p);
  R.root.quaternion.copy(rightSocket.q);
  R.setPose(rightFit.pose);

  const leftAnchor = spec.left.anchor || spec.left.tang;
  const leftSocket = handSocket('left', GRIP_POSES[spec.left.pose].frame, leftAnchor, spec.left.anchorQuat || new Quat());
  const leftShapes = spec.left.carriesFiringHand ? spec.left.shapes.concat(fingerColliders(rightFit)) : spec.left.shapes;
  const leftFit = gripPoint(spec.left.pose, 'left', leftSocket.p, leftSocket.q, leftShapes, GRIP_POSES[spec.left.pose].fit);
  leftFit.socket = leftSocket;
  L.root.position.copy(leftSocket.p);
  L.root.quaternion.copy(leftSocket.q);
  L.setPose(leftFit.pose);
  R.root.name = 'hand-right';
  L.root.name = 'hand-left';

  // ---- magazine socket for the reload (source: zD/ND s.pinch + D's mag transform) ----
  const magGroup = (gun.userData.parts && gun.userData.parts.mag) || null;
  const boltPart = (gun.userData.parts && (gun.userData.parts.bolt || gun.userData.parts.slide)) || null;
  const magRestP = magGroup ? magGroup.position.clone() : new V3();
  const magRestQ = magGroup ? magGroup.quaternion.clone() : new Quat();
  const magRestInv = new Mat4().compose(magRestP, magRestQ, new V3(1, 1, 1)).invert();

  const pinchLocal = new V3(spec.mag.pinch[0], spec.mag.pinch[1], spec.mag.pinch[2]);
  const pinchWorldP = pinchLocal.clone().applyQuaternion(magRestQ).add(magRestP);
  const pinchQuat = magRestQ.clone().multiply(rotX(-spec.mag.tilt));
  const pinchSocket = handSocket('left', GRIP_POSES.mag_pinch.frame, pinchWorldP, pinchQuat);
  const pinchFit = gripPoint('pinch', 'left', pinchSocket.p, pinchSocket.q,
    [box(pinchWorldP.toArray(), spec.mag.size, pinchQuat, 3e-3)], GRIP_POSES.mag_pinch.fit);
  // hand transform expressed in the magazine's own frame (source: D's `le` matrix)
  const pinchLocalP = pinchFit.p.clone().applyMatrix4(magRestInv);
  const pinchLocalQ = magRestQ.clone().invert().multiply(pinchFit.q);

  // ---- animation state ----
  const spr = motion.recoil.spr;
  const kick = { kZ: mkSpring(spr.kZ), kP: mkSpring(spr.kP), kY: mkSpring(spr.kY), kR: mkSpring(spr.kR), kX: mkSpring(spr.kX), kU: mkSpring(spr.kU) };
  const leftPose = new Float32Array(leftFit.pose);
  const leftBuf = new Float32Array(20);
  const eulerTmp = new Euler();
  const qSpring = new Quat();
  const leftP = new V3(), leftQ = new Quat(), magM4 = new Mat4(), magTmp = new V3();
  const ONE = new V3(1, 1, 1);
  const rng = opts.rng || Math.random;
  let shots = 0, adsW = 0, adsTarget = 0, poseOverride = null;
  let reloadT = -1, reloadEmpty = false, boltT = 9, boltHold = 0;

  const fire = (n = 1) => {
    const r = motion.recoil;
    const first = shots === 0 ? r.first : shots === 1 ? 0.5 + 0.5 * r.first : 1;
    const k = (0.88 + rng() * 0.24) * (n || 1) * (first || 1);
    const rot = mix(1, r.adsRot, adsW), pos = mix(1, r.adsPos, adsW);
    kick.kZ.v += r.back * k * mix(1, r.adsBack, adsW);
    kick.kP.v += r.rise * k * rot;
    kick.kY.v += (rng() - 0.5) * r.yaw * k * rot;
    kick.kR.v += (rng() - 0.5) * r.roll * k * rot;
    kick.kU.v += r.up * k * pos * (0.7 + 0.6 * rng());
    kick.kX.v += (rng() - 0.5) * 2 * r.side * k * pos;
    boltT = 0;
    shots++;
  };

  const startReload = (empty = false) => { reloadT = 0; reloadEmpty = !!empty; boltT = 9; };

  // magazine travel during a reload (source: D.reload's ze/Ge offsets)
  const magPhase = (t) => {
    const T = reload;
    if (t < T.magout) return [0, 0, 0];
    if (id === 'pac4') {
      if (t < T.swap) { const u = ramp(t, T.magout, T.swap); return [-0.012 * u, 0, 0.2 * u]; }
      if (t < T.rise) return [-0.05 * ramp(t, T.swap, T.rise), 0, 0.2];
      if (t < T.insert) { const u = ramp(t, T.rise, T.insert); return [mix(-0.05, -0.004, u), 0, 0.2 * (1 - u)]; }
      if (t < T.magin) return [-0.026 * (1 - ramp(t, T.insert, T.magin)), 0, 0];
      return [0, 0, 0];
    }
    if (t < T.clear) { const u = ramp(t, T.magout, T.clear); return [-0.02 * u, 0.012 * u, 0.25 * u]; }
    if (t < T.rise) { const u = ramp(t, T.clear, T.rise); return [mix(-0.02, -0.13, u), mix(0.012, 0.04, u), mix(0.25, 0.75, u)]; }
    if (t < T.align) { const u = ramp(t, T.swap, T.align); return [mix(-0.13, -0.05, u), mix(0.04, 0.012, u), mix(0.75, 0.05, u)]; }
    if (t < T.insert) { const u = ramp(t, T.align, T.insert); return [-0.05 * (1 - u), 0.012 * (1 - u), 0.05 * (1 - u)]; }
    if (t < T.magin) return [-0.008 * (1 - ramp(t, T.insert, T.magin)), 0, 0];
    return [0, 0, 0];
  };

  // how much the left hand is on the magazine (0 = on the foregrip/support, 1 = on the mag)
  const leftWeight = (t) => {
    const gs = reload.magout, ge = reload.regrip;
    if (t < gs) return 0;
    if (t < gs + 0.14) return ramp(t, gs, gs + 0.14);
    if (t < ge) return 1;
    return 1 - ramp(t, ge, ge + 0.24);
  };

  const setMag = (offY, offZ, tilt) => {
    if (!magGroup) return;
    magGroup.position.copy(magRestP).add(magTmp.set(0, offY, offZ));
    magGroup.quaternion.copy(magRestQ).multiply(rotX(tilt));
    magGroup.updateMatrix();
  };

  const update = (dt, state = {}) => {
    dt = dt > 0 ? Math.min(dt, 0.05) : 0;

    if (state.shot) fire(typeof state.shot === 'number' ? state.shot : 1);
    if (state.recoil) { fire(0); kick.kZ.v += +state.recoil || 0; }
    if (state.reload === true) startReload(state.reloadEmpty);
    else if (state.reload === false) reloadT = -1;
    if (state.trigger !== undefined) R.setTrigger(state.trigger);
    if (state.ads !== undefined) adsTarget = state.ads ? 1 : 0;
    if (state.pose !== undefined) poseOverride = state.pose || null;

    // ---- recoil springs (source: en(a.kZ, 0, B); Euler(ve, we, Ae); pivot offset) ----
    for (const k of Object.values(kick)) spring(k, 0, dt);
    qSpring.setFromEuler(eulerTmp.set(kick.kP.x, kick.kY.x, kick.kR.x, 'YXZ'));
    body.quaternion.copy(qSpring);
    body.position.set(kick.kX.x, kick.kU.x, kick.kZ.x);

    // ---- ADS blend (source: ie/ae * q0) ----
    adsW += (adsTarget - adsW) * Math.min(1, dt * 12);
    root.position.lerpVectors(hipP, adsP, adsW);
    root.quaternion.copy(hipQ);
    if (adsW > 1e-4) root.quaternion.slerp(adsQ, adsW);

    // ---- bolt / slide cycle (source: D.parts) ----
    boltT += dt;
    const cycle = id === 'pac4' ? 0.09 : 0.072;
    let boltZ = boltT < cycle ? Math.sin((Math.PI * boltT) / cycle) : 0;
    if (boltHold > 0) boltZ = Math.max(boltZ, boltHold);
    if (boltPart) {
      if (id === 'pac4') {
        boltPart.position.z = PAC4_SPECS.slideTravel * boltZ;
        const barrel = gun.userData.parts && gun.userData.parts.barrel;
        if (barrel) {
          const tilt = Math.min(1, (PAC4_SPECS.slideTravel * boltZ) / 0.006);
          barrel.rotation.x = 0.022 * tilt;
          barrel.position.z = PAC4_SPECS.barrelPivot[2] + 0.0025 * tilt;
        }
      } else {
        boltPart.position.z = PAC9_SPECS.boltTravel * boltZ;
      }
    }

    // ---- reload timeline ----
    let offY = 0, offZ = 0, magTilt = 0, lw = 0;
    if (reloadT >= 0) {
      reloadT += dt;
      const T = reload;
      const m = magPhase(reloadT);
      offY = m[0]; offZ = m[1]; magTilt = m[2];
      lw = leftWeight(reloadT);
      const relT = id === 'pac4' ? T.slideRelease : T.tacRelease;
      const boltT2 = id === 'pac4' ? T.slide : T.tacBolt;
      boltHold = reloadT > relT ? (T.partial || 1) * (1 - ramp(reloadT, relT, boltT2)) : 0;
      if (reloadT > (reloadEmpty ? T.empty : T.tac)) { reloadT = -1; boltHold = 0; offY = offZ = magTilt = lw = 0; }
    }
    setMag(offY, offZ, magTilt);

    // ---- hands ----
    if (poseOverride !== null) {
      R.update(dt, { pose: poseOverride });
      L.update(dt, { pose: poseOverride });
    } else {
      R.update(dt, {});
      if (lw > 1e-4) {
        magM4.copy(magGroup ? magGroup.matrix : magM4.identity().compose(magRestP, magRestQ, ONE));
        leftP.copy(pinchLocalP).applyMatrix4(magM4);
        leftQ.copy(magGroup ? magGroup.quaternion : magRestQ).multiply(pinchLocalQ);
        L.root.position.lerpVectors(leftSocket.p, leftP, lw);
        L.root.quaternion.copy(leftSocket.q).slerp(leftQ, lw);
        for (let i = 0; i < 20; i++) leftBuf[i] = leftPose[i] + (pinchFit.pose[i] - leftPose[i]) * lw;
        L.update(dt, { pose: leftBuf });
      } else {
        L.root.position.copy(leftSocket.p);
        L.root.quaternion.copy(leftSocket.q);
        L.update(dt, { pose: leftPose });
      }
    }
    return root;
  };

  update(0.016, {});

  const setPose = (pose) => {
    poseOverride = pose || null;
    R.setPose(poseOverride || rightFit.pose);
    L.setPose(poseOverride || leftFit.pose);
    return root;
  };

  const grips = { right: rightFit, left: leftFit, pinch: pinchFit };

  root.userData = {
    id, weapon: gun, parts: gun.userData.parts, grips,
    hands: { R, L },
    groups: { R: R.root, L: L.root },
    update, setPose, shot: () => fire(1), reload: startReload,
    get reloading() { return reloadT >= 0; },
    dispose: () => { R.dispose(); L.dispose(); root.removeFromParent(); },
  };

  return {
    root,
    hands: { R, L },
    groups: { R: R.root, L: L.root },
    weapon: gun,
    grips,
    update,
    setPose,
    shot: () => fire(1),
    reload: startReload,
    get reloading() { return reloadT >= 0; },
    dispose: root.userData.dispose,
  };
}
