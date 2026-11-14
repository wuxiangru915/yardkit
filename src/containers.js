// 从 Saltline 的 `Pk`（集装箱建模，约 L20078）+ `A_`（对外工厂，约 L20238）抽取。
// 数据结构表 rh / T_ / yg / __ / pv / E0 / kk / w_ / E_ / n1 / S_ / Xo / bg / Mg 一并搬过来。
// 标识符映射按 PORTING.md：On→PartBuilder dv→partsToGroup ct→placeGeo Ar→roundedCornerPlate
// D0→plane ot→box Fa→sweepProfile oh→scaledPlane Co→placeMatrix sh→corrugationSteps
// Jn→noise2 H0→smoothstep Qr→mixRgb Ti→labelFor Vn→decalFor $i→finalizeProp Yi→PROP_SPECS Fl→createRng
import * as THREE from 'three';
import {
  box, plane, createRng, clamp, smoothstep, mergeGeos,
} from './geo.js';
import { mixRgb, noise2, roundedCornerPlate, sweepProfile, corrugationSteps, PartBuilder } from './propUtils.js';
import { placeGeo, placeMatrix, scaledPlane } from './propKit.js';
import { PROP_SPECS, labelFor, decalFor, finalizeProp } from './propspec.js';
import { defaultMaterials } from './materials.js';

export const CONTAINER_TYPES = ['container20', 'container40', 'container40hc'];

// 对应源里的 rh / T_（ISO 箱型铭牌数据）/ 贴花与颜色候选表
export const CONTAINER_HEIGHT = 2.438;
export const CONTAINER_META = {
  container20: { type: '22G1', gross: '30,480', tare: '2,230', net: '28,250', cu: '33.2', def: 'red' },
  container40: { type: '42G1', gross: '32,500', tare: '3,750', net: '28,750', cu: '67.7', def: 'blue' },
  container40hc: { type: '45G1', gross: '32,500', tare: '3,940', net: '28,560', cu: '76.3', def: 'green' },
};
const yg = ['SLTU 482915 7', 'HBMU 307144 2', 'NRDU 665201 9', 'OKTU 119873 4', 'VSLU 850362 1', 'TQLU 274590 6'];
const __ = ['logo_a', 'logo_b', 'logo_c', 'logo_d'];
export const CONTAINER_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'white', 'grey', 'teal'];
const pv = CONTAINER_COLORS;
const E0 = { body: true };
const kk = 6;
const w_ = new Map();
// 压型尺寸：角柱/门框/侧板
const E_ = 0.178, n1 = 0.118, S_ = 0.162;
const Xo = { P: 0.278, d: 0.036, fo: 0.072, sl: 0.068 };
const bg = { P: 0.209, d: 0.02, fo: 0.09, sl: 0.03 };
const Mg = { P: 0.25, d: 0.042, fo: 0.07, sl: 0.06 };

// 等价于源里的 c.parts()（PartBuilder 只暴露 toGroup）：把每个桶的 geo 合并成一条
// { mat, geo, cast }，便于按颜色重映射后复用缓存。
export function collectParts(builder) {
  const parts = [];
  for (const b of builder.buckets.values()) parts.push({ mat: b.mat, geo: mergeGeos(b.geos), cast: b.cast });
  return parts;
}

// 等价于源里的 dv(parts, matRemap)：按桶拼 Group（PartBuilder.toGroup 每次都重新 merge，
// 这里要复用缓存的 parts，所以单独写一份）。
export function partsToGroup(parts, matRemap = null) {
  const g = new THREE.Group();
  for (const p of parts) {
    const mesh = new THREE.Mesh(p.geo, (matRemap && matRemap.get(p.mat)) || p.mat);
    mesh.castShadow = p.cast;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

// Pk(n, e, t, i, s)：n=ctx{mats} e=型号 t=seed 0..5 i=开门程度 s=磨损
function buildContainerParts(ctx, e, t, i, s) {
  const mats = ctx.mats;
  // 源里是 new On(ctx) 且 On 内部走 ctx.mats；PartBuilder 直接接材质库。
  let o = PROP_SPECS[e][0], r = PROP_SPECS[e][1], a = CONTAINER_META[e], l = createRng(1e3 + t * 77 + e.length * 13), c = new PartBuilder(mats), u = c.M('steel_galv'), f = c.M('wood_pallet'), h = CONTAINER_HEIGHT / 2, p = o / 2, d = h - 0.012, m = -p + 0.085, x = p - 0.135, v = 0.167, y = r - 0.06, b = [], g = Math.round((1 + l() * 2.4) * (0.4 + s)), E = [[-p * 0.75, -p * 0.05], [p - 2.2, p]];
  for (let ee = 0; ee < g; ee++) {
    let le = l() < 0.5 ? 1 : -1, xe = 0, j = 0;
    do
      xe = (l() * 2 - 1) * (p - 0.9), j++;
    while (j < 8 && E.some((O) => xe > O[0] - 0.4 && xe < O[1] + 0.4 && l() < 0.9));
    b.push({ side: le, x: le * xe, y: 0.45 + l() * 1.3, r: 0.22 + l() * 0.3, depth: 0.025 + l() * 0.04 });
  }
  let M = [], _ = Math.round(o / 2.2 * (0.5 + s) * (0.6 + l()));
  for (let ee = 0; ee < _ * 2; ee++) M.push({ side: ee % 2 ? 1 : -1, x: (l() * 2 - 1) * (p - 0.3), w: 0.05 + l() * 0.12, k: 0.4 + l() * 0.6 });
  let T = [0.5, 0.44, 0.38], w = [0.62, 0.38, 0.24], S = t * 9.7, R = (ee, le, xe) => {
    let j = 1 + (noise2(ee * 0.9 + S, le * 1.7 + xe * 0.4) - 0.5) * 0.16 * (0.5 + s);
    j *= 0.94 + 0.06 * noise2(ee * 6.1 + xe * 3.3, le * 5 + S);
    let O = [j, j, j], q = smoothstep(0.62, 0.02, le) * (0.45 + 0.5 * s) * (0.75 + 0.5 * noise2(ee * 2.3 + xe, S));
    return O = mixRgb(O, [T[0] * j, T[1] * j, T[2] * j], Math.min(1, q)), O;
  };
  c.defCol.set(E0, R);
  let z = (ee, le, xe) => {
    let j = 0;
    for (let O of b) if (O.side === xe) {
      let q = Math.hypot(ee - O.x, (le - O.y) * 0.9) / O.r;
      if (q < 1) {
        let ue = 1 - q * q;
        j += O.depth * ue * ue;
      }
    }
    return j;
  }, I = [0.035, 0.035, 0.04];
  for (let ee of [-1, 1]) for (let le of [0, 1]) for (let xe of [-1, 1]) {
    let j = ee * (p - E_ / 2), O = le ? r - n1 / 2 : n1 / 2, q = xe * (h - S_ / 2);
    c.box(E0, E_, n1, S_, j, O, q, { r: 0.012 }), c.add(E0, placeGeo(roundedCornerPlate(0.078, 0.052, 3), j, O, xe * (h + 12e-4), [0, xe > 0 ? 0 : Math.PI, 0]), I), c.add(E0, placeGeo(roundedCornerPlate(0.064, 0.05, 3), ee * (p + 12e-4), O, q, [0, ee * Math.PI / 2, 0]), I), le && c.add(E0, placeGeo(roundedCornerPlate(0.124, 0.064, 3), j, r + 12e-4, q, [-Math.PI / 2, 0, 0]), I);
  }
  for (let ee of [-1, 1]) c.box(E0, 0.085, r - 2 * n1 + 0.01, 0.15, -p + 0.0465, r / 2, ee * (h - 0.079), { r: 0.014 }), c.box(E0, 0.14, r - 2 * n1 + 0.01, 0.056, p - 0.074, r / 2, ee * (h - 0.032), { r: 0.012 }), c.box(E0, o - 0.2, 0.062, 0.062, -0.02, r - 0.031, ee * (h - 0.035), { r: 8e-3 }), c.box(E0, o - 0.2, 0.158, 0.05, -0.02, 0.012 + 0.079, ee * (h - 0.029), { r: 8e-3 });
  if (c.box(E0, 0.062, 0.062, CONTAINER_HEIGHT - 0.2, -p + 0.035, r - 0.031, 0, { r: 8e-3 }), c.box(E0, 0.05, 0.158, CONTAINER_HEIGHT - 0.2, -p + 0.029, 0.091, 0, { r: 8e-3 }), c.box(E0, 0.13, 0.12, CONTAINER_HEIGHT - 0.12, p - 0.072, r - 0.06, 0, { r: 0.01 }), c.box(E0, 0.13, 0.158, CONTAINER_HEIGHT - 0.12, p - 0.072, 0.091, 0, { r: 0.01 }), c.box(E0, 0.03, 0.012, CONTAINER_HEIGHT - 0.4, p - 0.012, r - 0.125, 0, { r: 3e-3, rot: [0, 0, -0.5] }), e === 'container20') for (let ee of [-1, 1]) for (let le of [-1.025, 1.025]) {
    c.add(E0, placeGeo(plane(0.36, 0.112), le, 0.075, ee * (h - 35e-4), [0, ee > 0 ? 0 : Math.PI, 0]), I), c.box(E0, 0.46, 0.018, 0.012, le, 0.142, ee * (h - 2e-3), { r: 3e-3 });
    for (let xe of [-1, 1]) c.box(E0, 0.018, 0.13, 0.01, le + xe * 0.19, 0.078, ee * (h - 3e-3), { r: 3e-3 });
  }
  let L = [v, 0.44, 1.25, r - 0.5, y], U = corrugationSteps(m, x, Xo.P, Xo.d, Xo.fo, Xo.sl, m + 0.02);
  for (let ee of [-1, 1]) {
    let le = sweepProfile(U, L, (O, q, ue) => [O, ue, ee * (d + q - z(O, ue, ee))], { center: [0, r / 2, 0] });
    le.computeVertexNormals();
    let xe = le.attributes.position, j = new Float32Array(xe.count * 3);
    for (let O = 0; O < xe.count; O++) {
      let q = xe.getX(O), ue = xe.getY(O), de = xe.getZ(O), $ = R(q, ue, de), se = d - Math.abs(de), fe = smoothstep(8e-3, 0.034, se);
      $ = [$[0] * (1 - 0.17 * fe), $[1] * (1 - 0.18 * fe), $[2] * (1 - 0.18 * fe)];
      let me = smoothstep(r - 0.75, y, ue);
      if (me > 0) {
        for (let ce of M) if (ce.side === ee) {
          let P = Math.abs(q - ce.x) / ce.w;
          P < 1 && ($ = mixRgb($, [$[0] * w[0], $[1] * w[1], $[2] * w[2]], me * me * ce.k * (1 - P * P) * (0.45 + 0.55 * s)));
        }
      }
      let ge = z(q, ue, ee);
      ge > 4e-3 && ($ = mixRgb($, [$[0] * 0.66, $[1] * 0.46, $[2] * 0.36], Math.min(0.8, ge * 22))), j[O * 3] = $[0], j[O * 3 + 1] = $[1], j[O * 3 + 2] = $[2];
    }
    le.setAttribute('color', new THREE.BufferAttribute(j, 3)), c.buckets.get(E0).geos.push(le);
  }
  for (let ee of [-1, 1]) for (let le of o > 7 ? [-1, 1] : [1]) {
    let xe = ee * le * (p - 0.62), j = r - 0.165, O = ee * (d - 4e-3);
    c.box(E0, 0.24, 0.1, 0.03, xe, j, O, { r: 8e-3 });
    for (let q = -1; q <= 1; q++) c.add(E0, placeGeo(plane(0.18, 0.012), xe, j + q * 0.026, ee * (d + 0.0116), [0, ee > 0 ? 0 : Math.PI, 0]), I);
  }
  {
    let ee = corrugationSteps(-h + 0.155, h - 0.155, Mg.P, Mg.d, Mg.fo, Mg.sl, -h + 0.155 + 0.03), le = sweepProfile(ee, [v, 1.25, y], (j, O, q) => [-(p - 0.014 + O), q, j], { center: [0, r / 2, 0] }), xe = -(p - 0.014);
    c.add(E0, le, (j, O, q) => {
      let ue = R(j, O, q), de = smoothstep(8e-3, 0.038, j - xe);
      return [ue[0] * (1 - 0.17 * de), ue[1] * (1 - 0.18 * de), ue[2] * (1 - 0.18 * de)];
    });
  }
  {
    let ee = corrugationSteps(-p + 0.07, p - 0.13, bg.P, bg.d, bg.fo, bg.sl, -p + 0.1), le = r - 8e-3, xe = sweepProfile(ee, o > 7 ? [-(h - 0.066), h - 0.066] : [-(h - 0.066), 0, h - 0.066], (j, O, q) => [j, le + O + (Math.abs(q) < 0.01 ? 6e-3 : 0), q], { center: [0, r / 2, 0] });
    c.add(E0, xe, (j, O, q) => {
      let ue = 0.78 + 0.3 * noise2(j * 0.8 + S, q * 1.1), de = smoothstep(4e-3, 0.018, le - O);
      return [ue * (1 - 0.25 * de), ue * (1 - 0.3 * de) * 0.97, ue * (1 - 0.32 * de) * 0.94];
    });
  }
  let k = i > 0.03, C = 0.172;
  if (k) {
    let ee = (j, O, q) => {
      let de = (0.16 + 0.62 * smoothstep(-p, p, j) * smoothstep(-p, p, j)) * (0.8 + 0.2 * smoothstep(0.2, 1.4, O));
      return [de, de, de];
    }, le = corrugationSteps(m, x, Xo.P, Xo.d, Xo.fo, Xo.sl, m + 0.02);
    for (let j of [-1, 1]) c.add(E0, sweepProfile(le, [C, y - 0.02], (O, q, ue) => [O, ue, j * (d + q - 4e-3)], { center: [0, r / 2, 0], inward: true }), ee);
    c.add(E0, placeGeo(plane(x - m, 2 * d), (m + x) / 2, y - 0.03, 0, [Math.PI / 2, 0, 0]), ee), c.add(E0, placeGeo(plane(2 * d, y - C), m + 0.03, (C + y) / 2, 0, [0, Math.PI / 2, 0]), ee);
    let xe = scaledPlane(x - m + 0.1, 2 * d - 0.02);
    c.add(f, placeGeo(xe, (m + x) / 2 + 0.05, C, 0, [-Math.PI / 2, 0, 0]), (j) => {
      let O = 0.3 + 0.6 * smoothstep(-p, p, j) ** 2;
      return [O, O * 0.97, O * 0.93];
    }), c.box(u, 0.05, 6e-3, 2 * d - 0.1, p - 0.11, C + 1e-3, 0, { r: 2e-3 });
  }
  let A = 0.175, F = r - 0.124, H = F - A, N = h - 0.058 - 4e-3, Z = p - 0.066, Q = (ee, le, xe) => R(ee, le, xe), W = [];
  for (let ee of [1, -1]) {
    let le = i * (ee > 0 ? 1 : 0.88) * THREE.MathUtils.degToRad(ee > 0 ? 112 : 100), xe = ee * (h - 0.058);
    c.push(placeMatrix(Z, 0, xe, [0, -ee * le, 0]));
    let j = (re) => -ee * re, O = (A + F) / 2;
    c.box(E0, 0.034, H, N - 6e-3, 0, O, j(N / 2), { r: 8e-3, col: Q });
    let q = e === 'container40hc' ? 7 : 6, ue = A + 0.085, de = F - 0.085, $ = (de - ue) / q, se = 0.019, fe = 0.031, me = [];
    for (let re = 0; re < q; re++) {
      let Y = ue + re * $;
      me.push([Y, se], [Y + 0.022, se], [Y + 0.05, fe], [Y + $ - 0.05, fe], [Y + $ - 0.022, se]);
    }
    me.push([de, se]), c.add(E0, sweepProfile(me, [0.075, N - 0.085], (re, Y, he) => [Y, re, j(he)], { center: [-1, O, j(N / 2)] }), (re, Y, he) => R(re, Y, he));
    let ge = (re) => ue + (re + 0.5) * $, ce = [0.05, 0.05, 0.05];
    c.box(E0, 0.022, H + 0.012, 0.018, 4e-3, O, j(N + 1e-3), { r: 0, col: ce }), c.box(E0, 0.022, 0.016, N, 4e-3, F + 4e-3, j(N / 2), { r: 0, col: ce }), c.box(E0, 0.022, 0.016, N, 4e-3, A - 4e-3, j(N / 2), { r: 0, col: ce });
    let P = e === 'container40hc' ? 5 : 4;
    for (let re = 0; re < P; re++) {
      let Y = A + 0.16 + re * (H - 0.32) / (P - 1);
      c.box(E0, 0.012, 0.062, 0.15, 0.021, Y, j(0.085), { r: 0 }), c.cyl(u, 0.013, 0.013, 0.086, 0.026, Y, j(-2e-3), { seg: 6, open: true });
    }
    for (let re of [0.31, 0.83]) {
      c.cyl(u, 0.0155, 0.0155, H + 0.2, 0.052, O, j(re), { seg: 7, open: true });
      for (let ne of [-1, 1]) c.add(u, placeGeo(box(0.03, 0.045, 0.085), 0.052 - 4e-3, O + ne * (H / 2 + 0.065), j(re))), c.box(E0, 0.03, 0.05, 0.075, 0.052 - 0.012, O + ne * (H / 2 - 0.035), j(re), { r: 0 });
      for (let ne of [A + H * 0.3, A + H * 0.72]) c.box(E0, 0.026, 0.04, 0.07, 0.052 - 0.012, ne, j(re), { r: 0 });
      let he = 1.02 + (re > 0.5 ? 0 : 0.13), V = re > 0.5 ? -1 : 1;
      c.box(u, 0.02, 0.05, 0.05, 0.052 + 8e-3, he, j(re), { r: 0 }), c.box(u, 0.011, 0.032, 0.36, 0.052 + 0.016, he, j(re + V * 0.19), { r: 4e-3 }), c.box(E0, 0.03, 0.07, 0.05, 0.052 - 8e-3, he, j(re + V * 0.33), { r: 0 }), c.box(u, 0.012, 0.085, 0.012, 0.052 + 0.012, he + 5e-3, j(re + V * 0.33), { r: 0 });
    }
    let D = 0.031 + 25e-4, B = [0, Math.PI / 2, 0], X = (re, Y, he, V, ne) => {
      let ye = Y * re.aspect;
      ne && ye > ne && (Y *= ne / ye, ye = ne), c.add(re.material, placeGeo(plane(ye, Y), D, he, j(V), B), null, true);
    };
    if (ee < 0) {
      X(labelFor(mats, yg[t % yg.length], { color: 'white', font: 'stencil', distress: 0.3 }), 0.115, ge(q - 1), N / 2, N - 0.24), X(labelFor(mats, a.type, { color: 'white', font: 'stencil', distress: 0.3 }), 0.1, ge(q - 2), N / 2 + 0.2, 0.4);
      let re = { color: 'white', font: 'sans', distress: 0.2 };
      X(labelFor(mats, 'MAX GROSS ' + a.gross + ' KG', re), 0.052, ge(q - 3) + 0.062, N / 2 - 0.01, 0.44), X(labelFor(mats, 'TARE ' + a.tare + ' KG   NET ' + a.net + ' KG', re), 0.045, ge(q - 3), N / 2 - 0.01, 0.44), X(labelFor(mats, 'CU.CAP. ' + a.cu + ' CU.M', re), 0.045, ge(q - 3) - 0.062, N / 2 - 0.01, 0.44);
    } else X(decalFor(mats, __[t % 4]), 0.2, ge(q - 1), N / 2, N - 0.36), X(decalFor(mats, 'csc_plate'), 0.17, ge(1), N / 2 + 0.05, 0.36), e === 'container40hc' && X(decalFor(mats, 'caution_stripes'), 0.1, F - 0.04, N / 2, N - 0.1);
    if (c.pop(), k) for (let re = 0; re < 3; re++) {
      let Y = N * re / 3, he = N * (re + 1) / 3, V = [Z + Math.sin(le) * Y, xe - ee * Math.cos(le) * Y], ne = [Z + Math.sin(le) * he, xe - ee * Math.cos(le) * he];
      W.push({ min: [Math.min(V[0], ne[0]) - 0.03, A, Math.min(V[1], ne[1]) - 0.03], max: [Math.max(V[0], ne[0]) + 0.03, F, Math.max(V[1], ne[1]) + 0.03], surface: 'metal' });
    }
  }
  for (let ee of [1, -1]) for (let le of [0.31, 0.83]) for (let xe of [-1, 1]) {
    let j = ee * (h - 0.058) - ee * le;
    c.add(E0, placeGeo(box(0.035, 0.05, 0.11), p - 0.03, xe > 0 ? r - 0.07 : 0.115, j));
  }
  let J = (ee, le, xe, j, O, q) => {
    let ue = O * ee.aspect;
    q && ue > q && (O *= q / ue, ue = q);
    let de = xe - ue / 2, $ = xe + ue / 2, se = le > 0 ? de : -$, fe = le > 0 ? $ : -de, me = corrugationSteps(Math.max(m, se), Math.min(x, fe), Xo.P, Xo.d, Xo.fo, Xo.sl, m + 0.02), ge = j - O / 2, ce = j + O / 2, P = sweepProfile(me, [ge, ce], (X, re, Y) => [X, Y, le * (d + re + 3e-3 - z(X, Y, le))], { center: [0, r / 2, 0] }), D = P.attributes.position, B = P.attributes.uv;
    for (let X = 0; X < D.count; X++) {
      let re = (D.getX(X) - se) / (fe - se);
      B.setXY(X, le > 0 ? re : 1 - re, (D.getY(X) - ge) / O);
    }
    return c.add(ee.material, P, null, true), ue;
  }, G = labelFor(mats, yg[t % yg.length], { color: 'white', font: 'stencil', distress: 0.3 }), te = labelFor(mats, a.type, { color: 'white', font: 'stencil', distress: 0.3 }), oe = decalFor(mats, __[t % 4]);
  for (let ee of [-1, 1]) {
    let le = Math.min(r * 0.4, 1.05), xe = Math.min(le * oe.aspect, e === 'container20' ? 2.2 : 3.4);
    J(oe, ee, e === 'container20' ? -0.75 : -p * 0.42, r * 0.52, xe / oe.aspect, xe);
    let j = Math.min(0.14 * G.aspect, 1.9);
    J(G, ee, p - 0.3 - j / 2, r - 0.32, 0.14, 1.9);
    let O = Math.min(0.11 * te.aspect, 0.6);
    J(te, ee, p - 0.3 - O / 2, r - 0.52, 0.11, 0.6);
    let q = Math.round((1 + l() * 2) * (0.4 + s) * (o > 7 ? 1.6 : 1));
    for (let ue = 0; ue < q; ue++) {
      let de = decalFor(mats, l() < 0.6 ? 'rust_run' : 'grime_streak'), $ = 0.5 + l() * 0.7, se = Math.min(0.5, Math.max(0.16, $ * de.aspect));
      J({ material: de.material, aspect: se / $ }, ee, (l() * 2 - 1) * (p - 0.6), y - $ / 2 - 5e-3, $);
    }
  }
  return k ? W.push({ min: [-p, 0, -h], max: [p, C, h], surface: 'wood' }, { min: [-p, r - 0.09, -h], max: [p, r, h], surface: 'metal' }, { min: [-p, 0, -h], max: [p, r, -h + 0.07], surface: 'metal' }, { min: [-p, 0, h - 0.07], max: [p, r, h], surface: 'metal' }, { min: [-p, 0, -h], max: [-p + 0.07, r, h], surface: 'metal' }) : W.push({ min: [-p, 0, -h], max: [p, r, h], surface: 'metal' }), { parts: collectParts(c), colliders: W };
}

// A_(n, e, t)：对外工厂（材质重映射、颜色选择、按 seed/doors/wear 缓存、finalize）
export function createContainer(type, opts = {}) {
  if (!CONTAINER_META[type]) throw new RangeError(`unknown container type: ${type}`);
  const mats = opts.materials || defaultMaterials;
  const ctx = { mats };
  const meta = CONTAINER_META[type];
  const seed = opts.seed === void 0 ? 0 : Math.abs(Math.floor(opts.seed)), s = seed % kk, doors = Math.round(clamp(opts.doors || 0, 0, 1) * 10) / 10, wear = Math.round(clamp(opts.wear === void 0 ? 0.5 : opts.wear, 0, 1) * 2) / 2, key = type + '|' + s + '|' + doors + '|' + wear;
  let cache = w_.get(mats);
  cache || (cache = new Map(), w_.set(mats, cache)), cache.has(key) || cache.set(key, buildContainerParts(ctx, type, s, doors, wear));
  const u = cache.get(key);
  let color = opts.color;
  pv.includes(color) || (color = opts.seed === void 0 ? meta.def : pv[(seed * 7 + 3) % pv.length]);
  const group = partsToGroup(u.parts, new Map([[E0, mats.get('paint_' + color, { vertexColors: true })]]));
  const spec = PROP_SPECS[type];
  group.userData.color = color;
  group.userData.doors = doors;
  return finalizeProp(group, type, [spec[0], spec[1], spec[2]], u.colliders.map((c) => ({ min: c.min.slice(), max: c.max.slice(), surface: c.surface })));
}
