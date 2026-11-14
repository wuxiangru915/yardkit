import * as THREE from 'three';
import {
  bevelBox, cyl, sphere, tube, lathe, pipeBetween, xform,
  RigBuilder, instantiateRig,
} from './geo.js';
import { defaultMaterials } from './materials.js';

const HALF_PI = Math.PI / 2;

// Color constants matching Saltline's enemy palette
const COL_SHELL = [1.15, 1.15, 1.15];
const COL_SHELL_TOP = [0.95, 0.96, 0.97];
const COL_ACCENT_ORANGE = [1.0, 0.34, 0.08];
const COL_DARK = [0.1, 0.11, 0.12];
const COL_RUBBER = [0.035, 0.035, 0.038];
const COL_STRIPE_YELLOW = [1.0, 0.7, 0.07];
const COL_GUN_LIGHT = [1.0, 1.0, 1.0];
const COL_STEEL_BRIGHT = [2.4, 2.5, 2.6];
const COL_GUNMETAL = [0.45, 0.46, 0.48];
const COL_MAG_SLOT = [5.5, 4.0, 1.6];

const rbox = (w, h, d, r = 0.008) => bevelBox(w, h, d, r);
const cylY = (rt, rb, h, seg = 12) => cyl(rt, rb, h, seg);
const cylX = (rt, rb, h, seg = 12) => xform(cyl(rt, rb, h, seg), { r: [0, 0, -HALF_PI] });
const cylZ = (rt, rb, h, seg = 12) => xform(cyl(rt, rb, h, seg), { r: [HALF_PI, 0, 0] });
const boltX = (x, y, z) => xform(cylX(0.0075, 0.0075, 0.006, 6), { p: [x, y, z] });
const boltY = (x, y, z) => xform(cylY(0.0075, 0.0075, 0.006, 6), { p: [x, y, z] });
const boltZ = (x, y, z) => xform(cylZ(0.0075, 0.0075, 0.006, 6), { p: [x, y, z] });

// --- Hound Quadrupedal Mech ---

export const HOUND_DIMS = {
  stand: 0.72,
  L1: 0.40,
  L2: 0.42,
  l0: 0.075,
  hipX: 0.165,
  hipY: -0.01,
  hipZ: 0.40,
  footX: 0.275,
  footZ: [0.37, 0.37, -0.42, -0.42],
  legs: ['FL', 'FR', 'RL', 'RR'],
  side: [1, -1, 1, -1],
  fore: [1, 1, -1, -1],
  footR: 0.046,
};

// 3D analytical IK for one Hound leg: computes abduction, hip pitch, knee pitch
export function solveLegIK(out, lx, ly, lz, side, l0, L1, L2) {
  const r2 = lx * lx + ly * ly;
  const c = Math.sqrt(Math.max(r2 - l0 * l0, 1e-6));
  out.abd = Math.atan2(ly, lx) - Math.atan2(-c, side * l0);
  if (out.abd > Math.PI) out.abd -= Math.PI * 2;
  else if (out.abd < -Math.PI) out.abd += Math.PI * 2;

  let d = Math.hypot(c, lz);
  const maxD = (L1 + L2) * 0.995;
  const minD = Math.abs(L1 - L2) + 0.03;
  out.reach = d / (L1 + L2);
  if (d > maxD) d = maxD;
  else if (d < minD) d = minD;

  const baseAngle = Math.atan2(lz, c);
  const cosHip = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const cosKnee = Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
  out.hip = Math.acos(cosHip) - baseAngle;
  out.knee = -(Math.PI - Math.acos(cosKnee));
  return out;
}

let _houndRigCache = null;

function buildHoundRigDef() {
  if (_houndRigCache) return _houndRigCache;
  const D = HOUND_DIMS;
  const rig = new RigBuilder();

  rig.bone('root', null, 0, 0, 0);
  rig.bone('body', 'root', 0, D.stand, 0);
  rig.bone('neck', 'body', 0, 0.06, 0.49);
  rig.bone('head', 'neck', 0, 0.13, 0.12);
  rig.bone('turret', 'body', 0, 0.152, -0.03);
  rig.bone('gun', 'turret', 0, 0.095, 0.02);
  rig.bone('antenna', 'body', -0.105, 0.15, -0.46);
  rig.bone('beacon', 'body', 0.105, 0.2, -0.455);

  for (let i = 0; i < 4; i++) {
    const leg = D.legs[i], s = D.side[i];
    rig.bone('abd' + leg, 'body', s * D.hipX, D.hipY, D.fore[i] * D.hipZ);
    rig.bone('thigh' + leg, 'abd' + leg, s * D.l0, 0, 0);
    rig.bone('shin' + leg, 'thigh' + leg, 0, -D.L1, 0);
  }

  const add = (slot, bone, g, col, shade) => rig.add(slot, bone, g, col, shade);

  // Chassis & dorsal armor plates
  add('metal', 'body', xform(rbox(0.27, 0.2, 0.98, 0.02), { p: [0, -0.01, 0] }), COL_GUNMETAL);
  add('shell', 'body', xform(rbox(0.35, 0.05, 0.3, 0.014), { p: [0, 0.125, 0.33] }), COL_SHELL);
  add('shell', 'body', xform(rbox(0.35, 0.05, 0.36, 0.014), { p: [0, 0.125, -0.012] }), COL_SHELL);
  add('shell', 'body', xform(rbox(0.1, 0.052, 0.36, 0.01), { p: [0, 0.126, -0.012] }), COL_SHELL_TOP);

  for (const sx of [-0.15, 0.15]) {
    for (const sz of [0.21, 0.45, -0.17, 0.145]) {
      add('metal', 'body', boltY(sx, 0.152, sz), COL_STEEL_BRIGHT);
    }
  }

  // Rear cooling louvres & radiator deck
  add('metal', 'body', xform(rbox(0.31, 0.03, 0.25, 0.006), { p: [0, 0.112, -0.335] }), COL_GUN_LIGHT);
  for (let i = 0; i < 10; i++) {
    add('metal', 'body', xform(rbox(0.007, 0.062, 0.225, 0.002), { p: [-0.126 + i * 0.028, 0.155, -0.335] }), COL_STEEL_BRIGHT);
  }
  add('metal', 'body', xform(rbox(0.3, 0.012, 0.02, 0.003), { p: [0, 0.186, -0.24] }), COL_GUNMETAL);
  add('metal', 'body', xform(rbox(0.3, 0.012, 0.02, 0.003), { p: [0, 0.186, -0.43] }), COL_GUNMETAL);

  // Side skirts, grab rails, louvers & coolant hoses
  for (const s of [1, -1]) {
    add('shell', 'body', xform(rbox(0.032, 0.15, 0.31, 0.012), { p: [s * 0.15, 0.022, -0.075] }), COL_SHELL);
    add('shell', 'body', xform(rbox(0.032, 0.15, 0.135, 0.012), { p: [s * 0.15, 0.022, 0.1625] }), COL_SHELL_TOP);
    add('metal', 'body', tube([[s * 0.168, 0.06, 0.125], [s * 0.182, 0.06, 0.135], [s * 0.182, 0.06, 0.19], [s * 0.168, 0.06, 0.2]], 0.005, 5), COL_STEEL_BRIGHT);
    add('shell', 'body', xform(rbox(0.034, 0.016, 0.135, 0.004), { p: [s * 0.151, -0.035, 0.1625] }), COL_STRIPE_YELLOW);
    add('shell', 'body', xform(rbox(0.034, 0.042, 0.46, 0.008), { p: [s * 0.151, -0.078, 0] }), COL_ACCENT_ORANGE);
    add('shell', 'body', xform(rbox(0.028, 0.1, 0.11, 0.008), { p: [s * 0.146, 0.01, 0.305] }), COL_DARK);
    for (let k = 0; k < 4; k++) {
      add('metal', 'body', xform(rbox(0.004, 0.012, 0.085, 0.001), { p: [s * 0.161, -0.02 + k * 0.022, 0.305] }), COL_GUNMETAL);
    }
    for (const sy of [-0.035, 0.08]) {
      for (const sz of [-0.21, 0.06, 0.115, 0.21]) {
        add('metal', 'body', boltX(s * 0.167, sy, sz), COL_STEEL_BRIGHT);
      }
    }
    add('metal', 'body', tube([[s * 0.135, 0.148, -0.19], [s * 0.135, 0.205, -0.16], [s * 0.135, 0.212, 0], [s * 0.135, 0.205, 0.43], [s * 0.135, 0.148, 0.465]], 0.0105, 6), COL_STEEL_BRIGHT);
    for (const sz of [0, 0.26]) add('metal', 'body', xform(cylY(0.008, 0.008, 0.06, 6), { p: [s * 0.135, 0.178, sz] }), COL_STEEL_BRIGHT);
    add('shell', 'body', tube([[s * 0.118, -0.105, -0.36], [s * 0.132, -0.118, -0.2], [s * 0.13, -0.112, 0.1], [s * 0.118, -0.1, 0.36]], 0.009, 5), COL_RUBBER);
    add('metal', 'body', xform(new THREE.TorusGeometry(0.02, 0.005, 5, 10), { p: [s * 0.17, 0.085, -0.335], r: [0, HALF_PI, 0] }), COL_STEEL_BRIGHT);
  }

  // Front bumper, hazard grille & dual headlights
  add('shell', 'body', xform(rbox(0.3, 0.15, 0.075, 0.018), { p: [0, -0.005, 0.505] }), COL_ACCENT_ORANGE);
  add('shell', 'body', xform(rbox(0.2, 0.07, 0.02, 0.006), { p: [0, 0.012, 0.545] }), COL_DARK);
  for (let i = 0; i < 6; i++) {
    add('shell', 'body', xform(rbox(0.05, 0.034, 0.014, 0.003), { p: [-0.125 + i * 0.05, -0.098, 0.538] }), i % 2 ? COL_DARK : COL_STRIPE_YELLOW);
  }
  for (const sx of [-0.115, 0.115]) {
    add('metal', 'body', xform(cylZ(0.021, 0.021, 0.014, 10), { p: [sx, 0.012, 0.547] }), COL_GUNMETAL);
    add('glow', 'body', xform(cylZ(0.015, 0.015, 0.004, 10), { p: [sx, 0.012, 0.556] }), [6.5, 4.6, 2.2], false);
  }

  // Belly battery pack & rear tail lights
  add('metal', 'body', xform(rbox(0.24, 0.095, 0.56, 0.02), { p: [0, -0.145, 0] }), COL_GUN_LIGHT);
  add('shell', 'body', xform(rbox(0.246, 0.03, 0.09, 0.006), { p: [0, -0.14, 0.12] }), COL_ACCENT_ORANGE);
  add('shell', 'body', xform(rbox(0.246, 0.03, 0.09, 0.006), { p: [0, -0.14, -0.12] }), COL_ACCENT_ORANGE);
  add('shell', 'body', xform(rbox(0.29, 0.15, 0.05, 0.014), { p: [0, 0, -0.495] }), COL_SHELL);
  add('shell', 'body', xform(rbox(0.17, 0.05, 0.012, 0.004), { p: [0, 0.03, -0.523] }), COL_DARK);
  add('glow', 'body', xform(rbox(0.13, 0.012, 0.004, 0.001), { p: [0, 0.03, -0.531] }), [5, 0.3, 0.1], false);
  add('metal', 'body', xform(cylZ(0.022, 0.022, 0.02, 10), { p: [0.085, -0.035, -0.525] }), COL_STEEL_BRIGHT);
  add('metal', 'body', xform(new THREE.TorusGeometry(0.024, 0.006, 5, 10), { p: [-0.07, -0.05, -0.528], r: [HALF_PI, 0, 0] }), COL_STEEL_BRIGHT);
  for (const sx of [-0.125, 0.125]) {
    for (const sy of [-0.055, 0.055]) add('metal', 'body', boltZ(sx, sy, -0.523), COL_STEEL_BRIGHT);
  }
  add('shell', 'body', tube([[0.09, 0.15, -0.2], [0.13, 0.2, -0.16], [0.12, 0.2, -0.08], [0.09, 0.165, -0.05]], 0.009, 5), COL_RUBBER);

  // Articulated Neck
  add('metal', 'neck', pipeBetween([0, -0.02, -0.02], [0, 0.11, 0.1], 0.045, 0.036, 10), COL_GUNMETAL);
  for (let i = 0; i < 3; i++) {
    const s = 0.2 + i * 0.28;
    add('shell', 'neck', pipeBetween([0, -0.02 + 0.13 * s - 0.008, -0.02 + 0.12 * s - 0.0075], [0, -0.02 + 0.13 * s + 0.008, -0.02 + 0.12 * s + 0.0075], 0.052, 0.052, 10), COL_RUBBER);
  }
  add('shell', 'neck', xform(rbox(0.13, 0.05, 0.1, 0.012), { p: [0, -0.01, -0.03] }), COL_SHELL);
  add('shell', 'neck', tube([[0.05, -0.02, -0.04], [0.07, 0.05, 0.02], [0.06, 0.11, 0.07], [0.045, 0.12, 0.1]], 0.007, 5), COL_RUBBER);

  // Sensor Head + Visor Lens + Dual Optics
  add('shell', 'head', rbox(0.19, 0.118, 0.25, 0.03), COL_SHELL);
  add('shell', 'head', xform(rbox(0.168, 0.074, 0.03, 0.012), { p: [0, -0.004, 0.118] }), COL_DARK);
  add('lens', 'head', xform(rbox(0.128, 0.024, 0.006, 0.002), { p: [0, 0.006, 0.1345] }), [1, 1, 1], false);
  for (const sx of [-0.056, 0.056]) {
    add('metal', 'head', xform(cylZ(0.015, 0.015, 0.012, 10), { p: [sx, -0.022, 0.132] }), COL_GUNMETAL);
    add('metal', 'head', xform(cylZ(0.009, 0.009, 0.004, 8), { p: [sx, -0.022, 0.139] }), [0.1, 0.12, 0.2]);
  }
  add('shell', 'head', xform(rbox(0.062, 0.008, 0.2, 0.003), { p: [0, 0.06, -0.005] }), COL_ACCENT_ORANGE);
  add('metal', 'head', xform(cylX(0.032, 0.032, 0.214, 12), { p: [0, 0, -0.055] }), COL_GUNMETAL);
  for (const s of [1, -1]) add('shell', 'head', xform(cylX(0.022, 0.022, 0.006, 10), { p: [s * 0.108, 0, -0.055] }), COL_ACCENT_ORANGE);
  add('metal', 'head', xform(cylY(0.036, 0.036, 0.026, 14), { p: [0, 0.072, -0.05] }), COL_GUNMETAL);
  add('metal', 'head', xform(cylY(0.037, 0.037, 0.006, 14), { p: [0, 0.074, -0.05] }), [0.2, 0.3, 0.5]);
  add('metal', 'head', xform(rbox(0.12, 0.03, 0.13, 0.008), { p: [0, -0.068, 0.02] }), COL_GUN_LIGHT);
  for (const sx of [-0.08, 0.08]) for (const sz of [-0.09, 0.07]) add('metal', 'head', boltY(sx, 0.061, sz), COL_STEEL_BRIGHT);

  // Dorsal Turret & Autocannon
  add('metal', 'turret', cylY(0.105, 0.118, 0.034, 18), COL_GUNMETAL);
  add('metal', 'turret', xform(rbox(0.18, 0.02, 0.16, 0.005), { p: [0, 0.026, 0] }), COL_GUN_LIGHT);
  for (const s of [1, -1]) {
    add('shell', 'turret', xform(rbox(0.028, 0.115, 0.15, 0.012), { p: [s * 0.078, 0.085, 0.005] }), COL_SHELL);
    add('metal', 'turret', xform(cylX(0.022, 0.022, 0.008, 10), { p: [s * 0.094, 0.095, 0.02] }), COL_STEEL_BRIGHT);
  }
  add('shell', 'gun', xform(rbox(0.108, 0.086, 0.21, 0.016), { p: [0, 0, -0.012] }), COL_SHELL);
  add('shell', 'gun', xform(rbox(0.11, 0.02, 0.212, 0.006), { p: [0, -0.022, -0.012] }), COL_ACCENT_ORANGE);
  add('metal', 'gun', xform(cylZ(0.035, 0.035, 0.11, 12), { p: [0, 0, 0.145] }), COL_GUNMETAL);
  for (let i = 0; i < 4; i++) add('metal', 'gun', xform(cylZ(0.039, 0.039, 0.008, 12), { p: [0, 0, 0.105 + i * 0.026] }), COL_GUN_LIGHT);
  add('metal', 'gun', xform(cylZ(0.022, 0.024, 0.3, 12), { p: [0, 0, 0.25] }), COL_GUN_LIGHT);
  add('metal', 'gun', xform(cylZ(0.036, 0.036, 0.06, 10), { p: [0, 0, 0.395] }), COL_GUNMETAL);
  add('metal', 'gun', xform(rbox(0.08, 0.012, 0.025, 0.003), { p: [0, 0, 0.395] }), [0.15, 0.15, 0.15]);
  add('metal', 'gun', xform(cylX(0.056, 0.056, 0.06, 14), { p: [0.084, -0.004, -0.045] }), COL_GUNMETAL);
  add('metal', 'gun', xform(cylX(0.02, 0.02, 0.066, 8), { p: [0.084, -0.004, -0.045] }), COL_MAG_SLOT);
  add('metal', 'gun', xform(rbox(0.036, 0.036, 0.095, 0.008), { p: [-0.03, 0.06, 0] }), COL_GUNMETAL);
  add('glow', 'gun', xform(cylZ(0.011, 0.011, 0.003, 8), { p: [-0.03, 0.06, 0.049] }), [1.6, 0.12, 0.05], false);
  add('shell', 'gun', tube([[0.05, -0.03, -0.11], [0.06, -0.07, -0.13], [0.04, -0.09, -0.1]], 0.008, 5), COL_RUBBER);

  // Beacon & Whip Antenna
  add('metal', 'body', xform(cylY(0.022, 0.026, 0.05, 10), { p: [0.105, 0.175, -0.455] }), COL_GUNMETAL);
  add('glow', 'beacon', xform(sphere(0.02, 10, 6, 1, 1.25, 1), { p: [0, 0.012, 0] }), [14, 5.5, 0.5], false);
  add('metal', 'antenna', xform(cylY(0.011, 0.014, 0.05, 8), { p: [0, 0.025, 0] }), COL_GUNMETAL);
  add('metal', 'antenna', xform(cylY(0.0028, 0.005, 0.62, 5), { p: [0, 0.36, 0] }), COL_GUNMETAL);
  add('shell', 'antenna', xform(sphere(0.009, 6, 4), { p: [0, 0.67, 0] }), COL_ACCENT_ORANGE);

  // Four Articulated Legs
  for (let i = 0; i < 4; i++) {
    const leg = D.legs[i], s = D.side[i];
    const abd = 'abd' + leg, thigh = 'thigh' + leg, shin = 'shin' + leg;
    add('metal', abd, xform(cylZ(0.06, 0.06, 0.17, 14), { p: [-s * 0.02, 0, 0] }), COL_GUNMETAL);
    add('shell', abd, xform(rbox(0.11, 0.05, 0.155, 0.014), { p: [0, 0.058, 0] }), COL_SHELL);
    add('metal', abd, xform(cylZ(0.03, 0.03, 0.18, 8), { p: [-s * 0.02, 0, 0] }), COL_STEEL_BRIGHT);

    add('shell', thigh, cylX(0.078, 0.078, 0.07, 18), COL_SHELL);
    add('shell', thigh, xform(cylX(0.081, 0.081, 0.016, 18), { p: [s * 0.012, 0, 0] }), COL_ACCENT_ORANGE);
    add('metal', thigh, cylX(0.048, 0.048, 0.082, 12), COL_GUNMETAL);
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566;
      add('metal', thigh, boltX(s * 0.039, Math.cos(a) * 0.062, Math.sin(a) * 0.062), COL_STEEL_BRIGHT);
    }
    add('shell', thigh, xform(rbox(0.062, D.L1 - 0.07, 0.1, 0.022), { p: [0, -D.L1 * 0.5 - 0.005, 0.004] }), COL_SHELL);
    add('metal', thigh, xform(rbox(0.044, D.L1 - 0.04, 0.06, 0.012), { p: [0, -D.L1 * 0.5, -0.035] }), COL_GUNMETAL);
    add('shell', thigh, xform(rbox(0.065, 0.045, 0.103, 0.01), { p: [0, -0.145, 0.004] }), COL_ACCENT_ORANGE);
    add('shell', thigh, xform(rbox(0.064, 0.012, 0.102, 0.004), { p: [0, -0.26, 0.004] }), COL_DARK);
    add('metal', thigh, pipeBetween([0, -0.06, -0.082], [0, -D.L1 * 0.62, -0.078], 0.021, 0.021, 10), COL_STEEL_BRIGHT);
    add('metal', thigh, pipeBetween([0, -D.L1 * 0.62, -0.078], [0, -D.L1 + 0.025, -0.058], 0.009, 0.009, 6), [9, 9, 9.6]);
    add('metal', thigh, xform(rbox(0.05, 0.03, 0.035, 0.006), { p: [0, -0.055, -0.07] }), COL_GUN_LIGHT);
    add('shell', thigh, tube([[s * 0.036, -0.02, 0.05], [s * 0.044, -0.13, 0.062], [s * 0.042, -0.28, 0.058], [s * 0.034, -D.L1 + 0.03, 0.035]], 0.0065, 5), COL_RUBBER);
    add('metal', thigh, xform(cylX(0.05, 0.05, 0.086, 14), { p: [0, -D.L1, 0] }), COL_GUNMETAL);
    add('shell', thigh, xform(cylX(0.036, 0.036, 0.092, 12), { p: [0, -D.L1, 0] }), COL_SHELL_TOP);

    add('metal', shin, xform(cylY(0.03, 0.021, D.L2 - 0.08, 10), { p: [0, -(D.L2 - 0.08) / 2 - 0.01, 0] }), COL_GUNMETAL);
    add('shell', shin, xform(rbox(0.052, 0.21, 0.04, 0.014), { p: [0, -0.14, 0.02] }), COL_SHELL);
    add('shell', shin, xform(rbox(0.054, 0.02, 0.042, 0.006), { p: [0, -0.215, 0.02] }), COL_ACCENT_ORANGE);
    add('metal', shin, xform(rbox(0.03, 0.06, 0.05, 0.008), { p: [0, -0.02, -0.03] }), COL_GUN_LIGHT);
    add('metal', shin, xform(cylY(0.024, 0.03, 0.03, 10), { p: [0, -D.L2 + 0.085, 0] }), COL_STEEL_BRIGHT);
    add('shell', shin, xform(sphere(D.footR + 0.002, 12, 8, 1, 0.86, 1.08), { p: [0, -D.L2 + D.footR * 0.86, 0.004] }), COL_RUBBER);
  }

  _houndRigCache = rig.build(['shell', 'metal', 'glow', 'lens']);
  return _houndRigCache;
}

export function createHound({ materials = defaultMaterials, animate = true } = {}) {
  const def = buildHoundRigDef();
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  const lensMat = materials.emissive(0xffaa33, 2.2);
  const rig = instantiateRig(def, {
    shell: materials.get('armor_white', { vertexColors: true }),
    metal: materials.get('gunmetal', { vertexColors: true }),
    glow: glowMat,
    lens: lensMat,
  }, { radius: 1.4, center: [0, 0.6, 0] });

  const ik = { abd: 0, hip: 0, knee: 0 };
  const setStandPose = (t = 0) => {
    const D = HOUND_DIMS;
    const bob = animate ? Math.sin(t * 3.4) * 0.015 : 0;
    rig.bones.body.position.y = D.stand + bob;
    if (animate) {
      rig.bones.turret.rotation.y = Math.sin(t * 0.9) * 0.45;
      rig.bones.head.rotation.y = Math.sin(t * 1.3 + 0.6) * 0.25;
      rig.bones.head.rotation.x = Math.sin(t * 1.7) * 0.08;
      rig.bones.antenna.rotation.z = Math.sin(t * 4.5) * 0.06;
    }
    for (let i = 0; i < 4; i++) {
      const leg = D.legs[i], s = D.side[i], f = D.fore[i];
      const phase = t * 4.2 + (i === 0 || i === 3 ? 0 : Math.PI);
      const stride = animate ? Math.sin(phase) * 0.14 : 0;
      const lift = animate ? Math.max(0, Math.cos(phase)) * 0.09 : 0;
      const lx = s * D.footX - s * D.hipX;
      const ly = -D.stand - bob + lift + D.footR * 0.6;
      const lz = D.footZ[i] - f * D.hipZ + stride;
      solveLegIK(ik, lx, ly, lz, s, D.l0, D.L1, D.L2 - D.footR * 0.6);
      rig.bones['abd' + leg].rotation.z = ik.abd;
      rig.bones['thigh' + leg].rotation.x = ik.hip;
      rig.bones['shin' + leg].rotation.x = ik.knee;
    }
  };
  setStandPose(0);

  rig.group.name = 'hound';
  rig.group.userData = {
    size: [0.7, 1.15, 1.3],
    tris: def.tris,
    bones: rig.bones,
    rig,
    update: setStandPose,
  };
  return rig.group;
}

// --- Gull Quadrotor Security Drone ---

const GULL_DIMS = {
  rotors: [[0.33, 0.035, 0.3], [-0.33, 0.035, 0.3], [0.33, 0.035, -0.3], [-0.33, 0.035, -0.3]],
  gimbal: [0, -0.095, 0.275],
  ball: [0, -0.072, 0],
  gun: [0, -0.085, -0.1],
  lamp: [0, -0.066, 0.025],
};

let _gullRigCache = null;

function buildGullRigDef() {
  if (_gullRigCache) return _gullRigCache;
  const D = GULL_DIMS;
  const rig = new RigBuilder();
  const extra = new RigBuilder();
  const addBone = (name, parent, x = 0, y = 0, z = 0) => {
    rig.bone(name, parent, x, y, z);
    extra.bone(name, parent, x, y, z);
  };

  addBone('root', null, 0, 0, 0);
  addBone('body', 'root', 0, 0, 0);
  for (let i = 0; i < 4; i++) addBone('rotor' + i, 'body', ...D.rotors[i]);
  addBone('gimbalYaw', 'body', ...D.gimbal);
  addBone('ball', 'gimbalYaw', ...D.ball);
  addBone('lamp', 'ball', ...D.lamp);
  addBone('gun', 'body', ...D.gun);
  addBone('strobeG', 'body', 0, 0, 0);
  addBone('strobeR', 'body', 0, 0, 0);
  addBone('strobeW', 'body', 0, 0, 0);

  const add = (slot, bone, g, col, shade) => rig.add(slot, bone, g, col, shade);

  // Fuselage
  add('shell', 'body', xform(sphere(1, 20, 12, 0.118, 0.074, 0.27), { p: [0, 0.02, 0] }), COL_SHELL);
  add('shell', 'body', xform(cylY(1, 0.9, 1, 20), { p: [0, 0.02, 0.165], r: [HALF_PI, 0, 0], s: [0.094, 0.05, 0.06] }), COL_ACCENT_ORANGE);
  add('shell', 'body', xform(cylY(1, 1, 1, 20), { p: [0, 0.02, -0.02], r: [HALF_PI, 0, 0], s: [0.121, 0.012, 0.0765] }), COL_DARK);
  add('shell', 'body', xform(rbox(0.118, 0.014, 0.2, 0.005), { p: [0, 0.089, -0.03] }), COL_SHELL_TOP);
  add('shell', 'body', xform(rbox(0.03, 0.006, 0.2, 0.002), { p: [0, 0.0975, -0.03] }), COL_ACCENT_ORANGE);
  for (const sx of [-0.05, 0.05]) for (const sz of [-0.12, 0.06]) add('metal', 'body', boltY(sx, 0.097, sz), COL_STEEL_BRIGHT);
  add('metal', 'body', xform(rbox(0.175, 0.06, 0.37, 0.016), { p: [0, -0.035, -0.005] }), COL_GUNMETAL);
  add('metal', 'body', xform(rbox(0.12, 0.075, 0.11, 0.014), { p: [0, 0.005, -0.265] }), COL_GUN_LIGHT);
  add('shell', 'body', xform(rbox(0.124, 0.02, 0.03, 0.005), { p: [0, 0.03, -0.3] }), COL_ACCENT_ORANGE);
  add('glow', 'body', xform(rbox(0.05, 0.006, 0.003, 0.001), { p: [0, 0, -0.321] }), [0.3, 1.6, 0.4], false);

  // Landing skids, side vents & rear antennas
  for (const s of [1, -1]) {
    for (let k = 0; k < 4; k++) add('metal', 'body', xform(rbox(0.004, 0.01, 0.06, 0.001), { p: [s * 0.0885, -0.045 + k * 0.016, -0.06] }), [0.2, 0.2, 0.2]);
    add('metal', 'body', tube([[s * 0.075, -0.055, 0.13], [s * 0.135, -0.175, 0.16], [s * 0.135, -0.192, 0.11], [s * 0.135, -0.192, -0.14], [s * 0.135, -0.175, -0.19], [s * 0.075, -0.055, -0.15]], 0.0085, 6, false, 0.5), COL_STEEL_BRIGHT);
    for (const sz of [0.07, -0.1]) add('shell', 'body', xform(cylZ(0.0135, 0.0135, 0.07, 8), { p: [s * 0.135, -0.192, sz] }), COL_RUBBER);
    add('metal', 'body', pipeBetween([s * 0.04, 0.07, -0.17], [s * 0.085, 0.37, -0.27], 0.004, 0.002, 5), COL_GUNMETAL);
    add('metal', 'body', xform(cylY(0.008, 0.01, 0.025, 6), { p: [s * 0.04, 0.078, -0.17] }), COL_STEEL_BRIGHT);
  }
  add('metal', 'body', xform(cylY(0.007, 0.007, 0.04, 6), { p: [0, 0.105, 0.1] }), COL_STEEL_BRIGHT);
  add('shell', 'body', xform(cylY(0.034, 0.036, 0.018, 14), { p: [0, 0.132, 0.1] }), COL_SHELL);
  add('metal', 'body', xform(rbox(0.07, 0.03, 0.09, 0.008), { p: [0, -0.075, 0.235] }), COL_GUN_LIGHT);

  // Shrouded Ducted Rotors (4x)
  const shroudGeo = lathe([
    [0.176, -0.036], [0.196, -0.032], [0.206, 0], [0.202, 0.03],
    [0.19, 0.04], [0.178, 0.032], [0.173, 0], [0.176, -0.036],
  ], 28);

  for (let i = 0; i < 4; i++) {
    const [rx, ry, rz] = D.rotors[i], sx = Math.sign(rx), sz = Math.sign(rz);
    add('metal', 'body', pipeBetween([sx * 0.07, 0, sz * 0.09], [rx, ry - 0.05, rz], 0.017, 0.015, 8), COL_GUNMETAL);
    add('shell', 'body', xform(rbox(0.07, 0.045, 0.07, 0.014), { p: [sx * 0.085, 0, sz * 0.1], r: [0, sx * sz * 0.74, 0] }), COL_SHELL);
    add('shell', 'body', tube([[sx * 0.09, 0.02, sz * 0.12], [sx * 0.18, 0.012, sz * 0.19], [rx - sx * 0.05, ry - 0.03, rz - sz * 0.04]], 0.005, 5), COL_RUBBER);
    add('metal', 'body', xform(cylY(0.04, 0.03, 0.075, 12), { p: [rx, ry - 0.05, rz] }), COL_GUNMETAL);
    add('metal', 'body', xform(cylY(0.042, 0.042, 0.012, 12), { p: [rx, ry - 0.02, rz] }), COL_STEEL_BRIGHT);
    add('shell', 'body', xform(shroudGeo.clone(), { p: [rx, ry, rz] }), COL_SHELL);
    add('shell', 'body', xform(new THREE.TorusGeometry(0.196, 0.0085, 6, 28), { p: [rx, ry + 0.036, rz], r: [HALF_PI, 0, 0] }), COL_ACCENT_ORANGE);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094 + 0.5 + i;
      add('metal', 'body', xform(rbox(0.145, 0.007, 0.016, 0.002), { p: [rx + Math.cos(a) * 0.105, ry - 0.022, rz - Math.sin(a) * 0.105], r: [0, a, 0] }), COL_GUNMETAL);
    }
    for (let k = -1; k <= 1; k++) {
      const a = Math.atan2(sz, sx) + k * 0.2;
      add('shell', 'body', xform(rbox(0.012, 0.05, 0.036, 0.003), { p: [rx + Math.cos(a) * 0.205, ry, rz + Math.sin(a) * 0.205], r: [0, -a, 0] }), k === 0 ? COL_DARK : COL_STRIPE_YELLOW);
    }
    add('metal', 'rotor' + i, xform(cylY(0.017, 0.02, 0.03, 8), { p: [0, -0.002, 0] }), COL_STEEL_BRIGHT);
    add('metal', 'rotor' + i, xform(rbox(0.158, 0.0035, 0.03, 0.001), { p: [0.088, 0.008, 0], r: [0.22, 0, 0] }), COL_GUNMETAL);
    add('metal', 'rotor' + i, xform(rbox(0.158, 0.0035, 0.03, 0.001), { p: [-0.088, 0.008, 0], r: [-0.22, 0, 0] }), COL_GUNMETAL);
    add('shell', 'rotor' + i, xform(rbox(0.02, 0.004, 0.031, 0.001), { p: [0.158, 0.008, 0], r: [0.22, 0, 0] }), COL_STRIPE_YELLOW);
    add('shell', 'rotor' + i, xform(rbox(0.02, 0.004, 0.031, 0.001), { p: [-0.158, 0.008, 0], r: [-0.22, 0, 0] }), COL_STRIPE_YELLOW);
    const disc = new THREE.RingGeometry(0.03, 0.168, 24, 1);
    disc.rotateX(-HALF_PI);
    extra.add('disc', 'body', xform(disc, { p: [rx, ry + 0.008, rz] }), [1, 1, 1], false);
  }

  // Navigation strobes
  add('glow', 'strobeR', xform(sphere(0.012, 8, 6), { p: [0.545, 0.035, 0.3] }), [10, 0.4, 0.2], false);
  add('glow', 'strobeR', xform(sphere(0.012, 8, 6), { p: [0.545, 0.035, -0.3] }), [10, 0.4, 0.2], false);
  add('glow', 'strobeG', xform(sphere(0.012, 8, 6), { p: [-0.545, 0.035, 0.3] }), [0.3, 9, 1], false);
  add('glow', 'strobeG', xform(sphere(0.012, 8, 6), { p: [-0.545, 0.035, -0.3] }), [0.3, 9, 1], false);
  add('glow', 'strobeW', xform(sphere(0.011, 8, 6), { p: [0, 0.05, -0.325] }), [9, 9, 9], false);

  // Gimbaled Sensor Ball + Spotlight Cone
  add('metal', 'gimbalYaw', xform(cylY(0.036, 0.036, 0.014, 12), { p: [0, -0.004, 0] }), COL_GUNMETAL);
  add('metal', 'gimbalYaw', xform(rbox(0.156, 0.01, 0.03, 0.003), { p: [0, -0.014, 0] }), COL_GUN_LIGHT);
  for (const s of [1, -1]) add('metal', 'gimbalYaw', xform(rbox(0.009, 0.075, 0.03, 0.003), { p: [s * 0.0735, -0.05, 0] }), COL_GUN_LIGHT);
  add('metal', 'ball', sphere(0.06, 18, 12), COL_GUNMETAL);
  add('metal', 'ball', cylX(0.013, 0.013, 0.142, 8), COL_STEEL_BRIGHT);
  add('metal', 'ball', xform(cylZ(0.031, 0.036, 0.03, 14), { p: [0, 0.004, 0.048] }), COL_GUN_LIGHT);
  add('lens', 'ball', xform(cylZ(0.025, 0.025, 0.004, 14), { p: [0, 0.004, 0.0645] }), [1, 1, 1], false);
  add('metal', 'ball', xform(cylZ(0.012, 0.012, 0.01, 8), { p: [0.03, 0.036, 0.04] }), [0.1, 0.12, 0.2]);
  add('metal', 'ball', xform(cylZ(0.019, 0.023, 0.045, 10), { p: [D.lamp[0], D.lamp[1], D.lamp[2] - 0.022] }), COL_GUNMETAL);
  add('glow', 'lamp', xform(cylZ(0.016, 0.016, 0.003, 10), { p: [0, 0, 0.001] }), [11, 9.8, 7.6], false);

  const cone = new THREE.ConeGeometry(1.05, 6.5, 20, 6, true);
  cone.translate(0, -6.5 / 2, 0);
  cone.rotateX(-HALF_PI);
  extra.add('cone', 'lamp', cone, [1, 1, 1], false);

  // Underbelly Twin-Barrel Gun Pod
  add('metal', 'gun', xform(rbox(0.05, 0.03, 0.05, 0.006), { p: [0, 0.012, 0] }), COL_GUN_LIGHT);
  add('metal', 'gun', xform(cylX(0.012, 0.012, 0.07, 8), { p: [0, -0.005, 0] }), COL_STEEL_BRIGHT);
  add('metal', 'gun', xform(rbox(0.052, 0.046, 0.13, 0.008), { p: [0, -0.032, 0] }), COL_GUN_LIGHT);
  add('shell', 'gun', xform(rbox(0.054, 0.012, 0.05, 0.003), { p: [0, -0.02, -0.03] }), COL_ACCENT_ORANGE);
  for (const sx of [-0.014, 0.014]) {
    add('metal', 'gun', xform(cylZ(0.0085, 0.0085, 0.2, 8), { p: [sx, -0.032, 0.16] }), COL_GUNMETAL);
    add('metal', 'gun', xform(cylZ(0.012, 0.012, 0.03, 8), { p: [sx, -0.032, 0.255] }), COL_GUN_LIGHT);
  }
  add('metal', 'gun', xform(rbox(0.045, 0.012, 0.012, 0.002), { p: [0, -0.032, 0.2] }), COL_STEEL_BRIGHT);
  add('metal', 'gun', xform(rbox(0.03, 0.05, 0.05, 0.006), { p: [0.04, -0.035, -0.02] }), COL_GUNMETAL);

  const built = rig.build(['shell', 'metal', 'glow', 'lens']);
  built.extra = extra.build(['disc', 'cone']);
  _gullRigCache = built;
  return built;
}

export function createGull({ materials = defaultMaterials, showCone = true, animate = true } = {}) {
  const def = buildGullRigDef();
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  const lensMat = materials.emissive(0xffaa33, 2.2);
  const discMat = new THREE.MeshBasicMaterial({ color: 0x0c0d0f, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1, 0.9, 0.74) }, uGain: { value: showCone ? 0.075 : 0 } },
    vertexShader: `varying vec3 vPos, vNrm; void main(){ vPos = position; vNrm = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uGain; varying vec3 vPos, vNrm; void main(){ float d = clamp(1.0 - length(vPos) / 6.8, 0.0, 1.0); float rim = pow(abs(vNrm.z), 1.4); gl_FragColor = vec4(uColor, uGain * d * d * (0.25 + 0.75 * rim)); }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const rig = instantiateRig(def, {
    shell: materials.get('armor_white', { vertexColors: true }),
    metal: materials.get('gunmetal', { vertexColors: true }),
    glow: glowMat,
    lens: lensMat,
    disc: discMat,
    cone: coneMat,
  }, { radius: 0.9, center: [0, 0, 0], extra: { def: def.extra, radius: 7 } });

  // Stencil ID decal on dorsal plate
  const lbl = materials.label('G-11', { color: 'black' });
  const decGeo = new THREE.PlaneGeometry(0.105, Math.min(0.045, 0.105 / (lbl.aspect || 3)));
  decGeo.rotateX(-HALF_PI);
  decGeo.rotateY(Math.PI);
  const decMesh = new THREE.Mesh(decGeo, lbl.material);
  decMesh.position.set(0, 0.0985, -0.085);
  rig.bones.body.add(decMesh);

  const update = (t = 0) => {
    if (!animate) return;
    rig.bones.body.position.y = Math.sin(t * 2.2) * 0.06;
    rig.bones.body.rotation.z = Math.sin(t * 1.4) * 0.05;
    rig.bones.body.rotation.x = Math.cos(t * 1.1) * 0.04;
    for (let i = 0; i < 4; i++) {
      rig.bones['rotor' + i].rotation.y = t * (i % 2 ? 32 : -32);
    }
    rig.bones.gimbalYaw.rotation.y = Math.sin(t * 0.85) * 0.55;
    rig.bones.ball.rotation.x = 0.25 + Math.sin(t * 1.25) * 0.14;
  };

  rig.group.name = 'gull';
  rig.group.userData = {
    size: [1.1, 0.5, 0.9],
    tris: def.tris,
    bones: rig.bones,
    rig,
    update,
  };
  return rig.group;
}
