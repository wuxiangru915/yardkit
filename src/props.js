import * as THREE from 'three';
import {
  box, bevelBox, cyl, tube, lathe, plane, PropBuilder, clamp, smoothstep, noise3,
} from './geo.js';
import {
  flatUVPlane, segBox, deformGeo, recomputeSmoothNormals, invertGeo, dropBoxGroup, extrude2DPoly, strapRibbon, tireProfileGeo, resolveColor,
} from './propUtils.js';
import {
  HALF_PI, AXIS_ROT, tubeSpan, ensureCCW, scaledSphere, scaledTorus, boxSpan,
} from './propKit.js';
import { defaultMaterials } from './materials.js';

const SANDBAG_MAT = ['glove_fabric', { color: 9207134 }];

  function crushedBox(n, e, t, i) {
    let s = dropBoxGroup(segBox(n, e, t, Math.min(e * 0.46, 0.075), 3, 3, 3), 3), o = i() * 9, r = i.range(-0.05, 0.05), a = i.range(0.4, 1);
    return deformGeo(s, (l) => {
      let c = l.x / (n / 2), u = l.z / (t / 2), f = l.y / (e / 2), h = 1 - 0.22 * Math.pow(Math.abs(c), 2.5);
      l.z *= h * (f < 0 ? 1.05 : 1), l.y = (l.y + e / 2) * (1 - 0.3 * Math.pow(Math.abs(c), 3)) - e / 2, f > 0 && (l.y += 0.016 * Math.cos(HALF_PI * c) * Math.cos(HALF_PI * u)), l.y -= a * 0.018 * Math.abs(c) * Math.abs(c) * (f > -0.9 ? 1 : 0) + r * l.x * 0.3;
      let p = noise3(l.x * 9 + o, l.y * 9, l.z * 9 + o) - 0.5;
      l.x += p * 0.014, l.z += p * 0.016, f > -0.9 && (l.y += p * 0.014);
    }), recomputeSmoothNormals(s);
  }

  function ringStrip(n, e, t, i = 0) {
    let s = [], o = 2 * n / e;
    for (let r = 0; r < e; r++) {
      let a = -n + r * o + 3e-3, l = -n + (r + 1) * o - 3e-3, c = [a, (a + l) / 2, l], u = [], f = [], h = [], p = [], d = (y) => Math.sqrt(Math.max(0, n * n - y * y)), m = t() * 2, x = t() * 2;
      for (let y of c) u.push(y, -d(y), 0, y, d(y), 0), f.push(0, 0, 1, 0, 0, 1), h.push(-d(y) + m, y + x, d(y) + m, y + x);
      p.push(0, 2, 3, 0, 3, 1, 2, 4, 5, 2, 5, 3);
      let v = new THREE.BufferGeometry();
      v.setAttribute("position", new THREE.BufferAttribute(new Float32Array(u), 3)), v.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(f), 3)), v.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(h), 2)), v.setIndex(p), s.push(v);
    }
    return s;
  }

  function tireCourse(builder, e, t, i, s, o, r, a, l, c) {
    let u = tireProfileGeo(t, i, r, a);
    builder.push({ p: [e, t, o > 0 ? s - i / 2 : -(s - i / 2)], r: [o > 0 ? HALF_PI : -HALF_PI, 0, 0] }), builder.push({ r: [0, c() * 6, 0] });
    let f = c() * 20;
    builder.add("tire", u, null, (p, d, m) => {
      let x = Math.hypot(p, m);
      return x < r + 0.01 ? 0.45 : 0.78 + 0.22 * noise3(Math.atan2(m, p) * 3 + f, x * 30);
    });
    let h = i * 0.8;
    builder.add("paint_yellow", lathe([[r + 6e-3, h + 0.012], [r - 0.012, h + 0.016], [r - 0.03, h - 0.02], [r * 0.62, h - 0.05], [r * 0.5, h - 0.02], [r * 0.42, h - 0.012], [0, h - 0.012]], 14), null, (p, d, m) => Math.hypot(p, m) > r * 0.7 ? [0.55, 0.5, 0.42] : [0.8, 0.78, 0.7]), builder.add("steel_dark", lathe([[0, i * 0.2], [r + 4e-3, i * 0.2]], 10), null, 0.4), builder.add("steel_dark", cyl(r * 0.2, r * 0.24, 0.035, 8), { p: [0, h, 0] }, 0.7);
    for (let p = 0; p < 6; p++) {
      let d = p * Math.PI / 3;
      builder.add("steel_galv", cyl(0.011, 0.012, 0.016, 6), { p: [Math.cos(d) * r * 0.33, h - 6e-3, Math.sin(d) * r * 0.33] }, c.range(0.5, 0.8));
    }
    builder.pop(), builder.pop();
  }

  function tapedCarton(builder, e, t, i, s, { crush: o = 0, damp: r = 0.3, open: a = false, tape: l = true, label: c = "", arrow: u = false, tint: f = 1 } = {}) {
    let h = builder.rng, p = builder, d = h() * 40;
    builder.push(s);
    let m = (M) => {
      if (!o) return;
      let _ = clamp(M.y / t, 0, 1), T = _ * _;
      M.y -= o * t * 0.32 * T * (0.55 + 0.45 * Math.cos(Math.PI * M.x / e * 0.9 + 0.5)) * (0.8 + 0.2 * Math.cos(Math.PI * M.z / i)), M.z *= 1 + 0.1 * o * Math.sin(Math.PI * _), M.x += 0.12 * o * t * _ + 0.02 * o * Math.sin(Math.PI * _) * Math.sign(M.x);
    }, x = segBox(e, t, i, 7e-3, 4, 5, 4, "bottom");
    a && dropBoxGroup(x, 2), o && (deformGeo(x, m), recomputeSmoothNormals(x));
    let v = r * t, y = (M, _, T) => {
      let w = noise3(M * 6 + d, _ * 3, T * 6 + d), S = smoothstep(v - 0.03, v + 0.04, _ + 0.08 * (w - 0.5)), R = (0.86 + 0.14 * noise3(M * 13, _ * 13 + d, T * 13)) * f;
      return [R * (0.5 + 0.5 * S), R * (0.47 + 0.53 * S), R * (0.42 + 0.58 * S)];
    };
    {
      let M = x.attributes.position, _ = new Float32Array(M.count * 3);
      for (let T = 0; T < M.count; T++) {
        let w = y(M.getX(T), M.getY(T), M.getZ(T));
        _[T * 3] = w[0], _[T * 3 + 1] = w[1], _[T * 3 + 2] = w[2];
      }
      x.setAttribute("color", new THREE.BufferAttribute(_, 3));
    }
    builder.add("cardboard", x);
    let b = 25e-4;
    if (a) {
      let M = Math.min(0.16, t * 0.6);
      builder.add("cardboard", flatUVPlane(e - 0.012, i - 0.012), { p: [0, t - M, 0], r: [-HALF_PI, 0, 0] }, 0.45 * f);
      for (let [T, w, S] of [[0, e, i / 2], [Math.PI, e, i / 2], [HALF_PI, i, e / 2], [-HALF_PI, i, e / 2]]) builder.add("cardboard", invertGeo(flatUVPlane(w - 0.012, M)), { p: [Math.sin(T) * (S - 6e-3), t - M / 2, Math.cos(T) * (S - 6e-3)], r: [0, T, 0] }, 0.55 * f);
      let _ = (T, w, S) => {
        let R = Math.sin(S), z = Math.cos(S);
        return [T, w, R, z];
      };
      for (let T of [1, -1]) {
        let w = h.range(0.3, 1.9), S = i / 2 - 0.01;
        builder.add("cardboard", strapRibbon([[0, t, T * i / 2], [0, t + Math.sin(w) * S * 0.5, T * (i / 2 + Math.cos(w) * S * 0.5)], [0, t + Math.sin(w) * S, T * (i / 2 + Math.cos(w) * S + 0.01)]], [e / 2 - 4e-3, 0, 0]), null, 0.9 * f);
      }
      for (let T of [1, -1]) {
        let w = h.range(0.9, 2.3), S = i / 2 - 0.02;
        builder.add("cardboard", strapRibbon([[T * e / 2, t, 0], [T * (e / 2 + Math.cos(w) * S), t + Math.sin(w) * S, 0]], [0, 0, i / 2 - 4e-3]), null, 0.82 * f);
      }
    } else if (l) {
      let _ = [];
      _.push([-e / 2 - b, t - 0.075, 0]);
      for (let w = 0; w <= 8; w++) _.push([(-0.5 + w / 8) * (e + 2 * b), t + b, 0]);
      _.push([e / 2 + b, t - 0.075, 0]);
      let T = new THREE.Vector3();
      for (let w of _) T.set(w[0], w[1], w[2]), m(T), w[0] = T.x, w[1] = T.y + (o ? 4e-3 : 0), w[2] = T.z;
      builder.add("polymer_tan", strapRibbon(_, [0, 0, 0.025], false), null, 0.9);
    }
    let g = i / 2 + b, E = Math.min(0.055, t * 0.2);
    if (c && !o && (builder.label(c, { color: "black", font: "sans", distress: 0.3 }, e * 0.6, E, { p: [-e * 0.1, t * 0.62, g] }), builder.add("paint_white", flatUVPlane(0.11, 0.075), { p: [e * 0.26, t * 0.3, g - 1e-3] }, 0.9, { cast: false }), builder.decal(p.mats.decal("numbers_0_9"), 0.095, { p: [e * 0.26, t * 0.3, g + 6e-4] })), u && !o) for (let M of [1, -1]) builder.decal(p.mats.decal("arrow"), Math.min(0.09, t * 0.3), { p: [M * (e / 2 + b), t * 0.55, M * i * 0.2], r: [0, M * HALF_PI, HALF_PI] });
    builder.pop();
  }

  function barrelProfile(n) {
    let t = [[0, 0.016], [0.262, 0.016], [0.262, 0.016], [0.268, 2e-3], [0.288, 0], [0.295, 8e-3], [0.295, 0.022], [0.284, 0.034]];
    for (let i of [0.305, 0.595]) t.push([0.283, i - 0.03], [0.291, i - 0.018], [0.297, i], [0.291, i + 0.018], [0.283, i + 0.03]);
    return t.push([0.284, 0.866], [0.295, 0.878], [0.295, 0.892], [0.288, 0.9], [0.268, 0.898]), n ? t.push([0.268, 0.898], [0.272, 0.888], [0.272, 0.03], [0.272, 0.03], [0, 0.03]) : t.push([0.262, 0.884], [0.262, 0.884], [0, 0.884]), t;
  }

  function buildPalletBody(builder, e, { broken: t = false, stamp: i = true, bevel: s = false } = {}) {
    let o = s ? (u, f, h) => bevelBox(u, f, h, 4e-3) : (u, f, h) => box(u, f, h), r = () => {
      let u = e.range(0.62, 1), f = e.range(0.9, 1);
      return [u, u * (0.93 + 0.07 * f), u * (0.82 + 0.18 * f)];
    }, a = (u = 3e-3) => e.range(-u, u);
    for (let [u, f] of [[-0.45, 0.1], [0, 0.145], [0.45, 0.1]]) builder.add("wood_pallet", o(1.2, 0.022, f), { p: [a(), 0.011, u + a()], r: [0, a(6e-3), 0] }, r());
    let l = (u, f, h = 0.012) => [[-u / 2 + h, -f / 2], [u / 2 - h, -f / 2], [u / 2, -f / 2 + h], [u / 2, f / 2 - h], [u / 2 - h, f / 2], [-u / 2 + h, f / 2], [-u / 2, f / 2 - h], [-u / 2, -f / 2 + h]];
    for (let u of [-0.5275, 0, 0.5275]) for (let f of [-0.45, 0, 0.45]) builder.add("wood_pallet", extrude2DPoly(l(0.145, f === 0 ? 0.145 : 0.1), 0.078, { caps: false, soft: 0 }), { p: [u + a(), 0.061, f + a()], r: [-HALF_PI, a(0.03), 0] }, r().map((h) => h * 0.8));
    for (let u of [-0.5275, 0, 0.5275]) builder.add("wood_pallet", o(0.145, 0.022, 1), { p: [u + a(), 0.111, a()], r: [0, a(6e-3), 0] }, r());
    if ([[-0.4275, 0.145], [-0.215, 0.1], [0, 0.145], [0.215, 0.1], [0.4275, 0.145]].forEach(([u, f], h) => {
      t && h === 3 || builder.add("wood_pallet", o(1.2, 0.022, f), { p: [a(), 0.133, u + a(6e-3)], r: [a(4e-3), a(8e-3), 0] }, r());
    }), i) {
      let u = builder.mats.label("EUR", { color: "black", font: "sans", distress: 0.6 });
      builder.decal(u, 0.085, { p: [-0.5275, 0.062, 0.5015] }), builder.decal(u, 0.085, { p: [0.5275, 0.062, -0.5015], r: [0, Math.PI, 0] });
    }
  }

  function buildBarrel(mats, e, t) {
    let i = new PropBuilder(mats, "barrel", t), s = i.rng, o = 22, [r, a] = resolveColor(e.color, "blue");
    e.lying && i.push({ p: [-0.45, 0.297, 0], r: [0, 0, -HALF_PI] });
    let l = lathe(barrelProfile(!!e.open), o), c = [];
    for (let d = 0; d < 2 + t % 2; d++) c.push([s() * Math.PI * 2, s.range(0.12, 0.78), s.range(0.07, 0.13), s.range(6e-3, 0.014)]);
    deformGeo(l, (d) => {
      let m = Math.hypot(d.x, d.z);
      if (m < 0.27) return;
      let x = Math.atan2(d.z, d.x);
      for (let v of c) {
        let y = Math.abs(x - v[0]) % (Math.PI * 2);
        y > Math.PI && (y = Math.PI * 2 - y);
        let b = Math.hypot(y * 0.285, d.y - v[1]);
        if (b < v[2]) {
          let g = 1 - v[3] * (0.5 + 0.5 * Math.cos(Math.PI * b / v[2])) / m;
          d.x *= g, d.z *= g;
        }
      }
    }), l.computeVertexNormals();
    let u = l.attributes.normal, f = l.attributes.position.count / (o + 1);
    for (let d = 0; d < f; d++) {
      let m = d * (o + 1), x = m + o, v = u.getX(m) + u.getX(x), y = u.getY(m) + u.getY(x), b = u.getZ(m) + u.getZ(x), g = Math.hypot(v, y, b) || 1;
      u.setXYZ(m, v / g, y / g, b / g), u.setXYZ(x, v / g, y / g, b / g);
    }
    let h = t * 2.37, p = e.color === "rust";
    return i.add(r, l, null, (d, m, x) => {
      let v = Math.hypot(d, x), y = Math.atan2(x, d);
      if (v < 0.27) {
        let w = m > 0.5 ? 0.62 + 0.3 * noise3(d * 9 + h, x * 9) : 0.6;
        return [w, w, w];
      }
      let b = Math.pow(noise3(y * 2.6 + h, 3.1), 2.2), g = m > 0.6 ? (0.88 - m) / 0.28 : m > 0.31 ? (0.6 - m) / 0.29 : (0.31 - m) / 0.31, E = 1 - 0.55 * b * (1 - 0.6 * clamp(g, 0, 1)), _ = (v > 0.289 ? 1 : 0) * (0.35 + 0.65 * noise3(y * 7 + h, m * 20)), T = [E * (1 - 0.25 * _), E * (1 - 0.42 * _), E * (1 - 0.55 * _)];
      return typeof a != "number" && (T[0] *= a[0], T[1] *= a[1], T[2] *= a[2]), T;
    }), e.open || (i.add("steel_galv", cyl(0.036, 0.038, 0.016, 8), { p: [0.17, 0.891, 0.02] }, 0.8), i.add("steel_galv", cyl(0.017, 0.018, 0.014, 8), { p: [-0.16, 0.89, -0.08] }, 0.8)), !p && t % 3 !== 2 && i.cdecal(mats.decal("hazard_flammable"), 0.2855, 0.15, { p: [0, 0.455, 0], r: [0, 0.9 + t, 0] }), t % 2 === 0 && i.cdecal(mats.label("UN 1202", { color: p || e.color === "white" || e.color === "yellow" ? "black" : "white", font: "stencil", distress: 0.5 }), 0.2855, 0.2, { p: [0, 0.74, 0], r: [0, 2.6 + t, 0] }), i.finish(e.lying ? { size: [0.9, 0.6, 0.6] } : {});
  }

  function buildPallet(mats, e, t) {
    let i = new PropBuilder(mats, "pallet", t);
    return buildPalletBody(i, i.rng, { broken: !!e.broken, bevel: true }), i.finish();
  }

  function buildPalletStack(mats, e) {
    let t = new PropBuilder(mats, "pallet_stack", e.seed || 0), i = t.rng, s = clamp(e.count | 0 || 8, 1, 12);
    for (let o = 0; o < s; o++) {
      let r = o === s - 1;
      t.push({ p: [o ? i.range(-0.028, 0.028) : 0, o * 0.144, o ? i.range(-0.022, 0.022) : 0], r: [0, i.range(-0.035, 0.035) + (i() < 0.3 ? Math.PI : 0) + (r ? i.range(-0.06, 0.06) : 0), 0] }), buildPalletBody(t, i, { broken: !r && i() < 0.2, stamp: o % 3 === 0, bevel: r }), t.pop();
    }
    return t.finish({ size: [1.2, s * 0.144, 1] });
  }

  function buildCrateBody(builder, e, t, i, { detail: s = true, label: o = "FRAGILE", code: r = "B4-117", skids: a = true } = {}) {
    let l = builder.rng, c = builder, u = 0.022, f = 0.07, h = a ? 0.07 : 0, p = t - h, d = h + p / 2, m = (R = 1) => {
      let z = l.range(0.7, 1) * R;
      return [z, z * l.range(0.92, 1), z * l.range(0.82, 0.95)];
    }, x = s ? (R, z, I) => bevelBox(R, z, I, 4e-3) : (R, z, I) => box(R, z, I);
    if (a) for (let R of [-(e / 2 - 0.13), 0, e / 2 - 0.13]) builder.add("wood_pallet", bevelBox(0.09, h, i - 0.02, 6e-3), { p: [R, h / 2, 0] }, m(0.6));
    builder.add("wood_dark", box(e - 2 * u - 0.012, p - u - 0.012, i - 2 * u - 0.012), { p: [0, h + (p - u - 0.012) / 2 + 2e-3, 0] }, 0.25);
    let v = Math.max(3, Math.round(p / 0.125)), y = p / v;
    for (let R = 0; R < v; R++) {
      let z = h + y * (R + 0.5);
      for (let [I, L, U] of [["pz", e, i / 2 - u], ["nz", e, i / 2 - u], ["px", i, e / 2 - u], ["nx", i, e / 2 - u]]) {
        let k = U - l.range(0, 4e-3), C = I === "pz" ? [0, z, k] : I === "nz" ? [0, z, -k] : I === "px" ? [k, z, 0] : [-k, z, 0];
        builder.add("wood_pallet", flatUVPlane(L - 0.03, y - 5e-3, l() * 3, l() * 3), { p: C, r: AXIS_ROT[I] }, m());
      }
    }
    let b = Math.max(3, Math.round(i / 0.13)), g = (i - 0.02) / b;
    for (let R = 0; R < b; R++) builder.add("wood_pallet", flatUVPlane(e - 0.03, g - 5e-3, l() * 3, l() * 3), { p: [0, t - u - l.range(0, 3e-3), -i / 2 + 0.01 + g * (R + 0.5)], r: [-HALF_PI, 0, 0] }, m());
    let E = Math.atan2(p - 2 * f, e - 2 * f), M = Math.hypot(e - 2 * f, p - 2 * f);
    for (let R of [1, -1]) {
      let z = R * (i / 2 - u / 2);
      builder.add("wood_pallet", x(e, f, u), { p: [0, h + f / 2, z] }, m(0.85)), builder.add("wood_pallet", x(e, f, u), { p: [0, t - f / 2, z] }, m(0.85));
      for (let U of [1, -1]) builder.add("wood_pallet", x(f, p - 2 * f, u), { p: [U * (e / 2 - f / 2), d, z] }, m(0.85));
      s && builder.add("wood_pallet", bevelBox(M, f * 0.85, u * 0.8, 4e-3), { p: [0, d, R * (i / 2 - u * 0.6)], r: [0, 0, R * E] }, m(0.8));
      let I = R * (e / 2 - u / 2), L = i - 2 * u;
      for (let U of [1, -1]) builder.add("wood_pallet", x(u, p, f), { p: [I, d, U * (L / 2 - f / 2)] }, m(0.85));
      builder.add("wood_pallet", x(u, f, L - 2 * f), { p: [I, h + f / 2, 0] }, m(0.85)), builder.add("wood_pallet", x(u, f, L - 2 * f), { p: [I, t - f / 2, 0] }, m(0.85)), builder.add("wood_pallet", x(e, u, f), { p: [0, t - u / 2, R * (i / 2 - f / 2)] }, m(0.85)), builder.add("wood_pallet", x(f, u, i - 2 * f), { p: [R * (e / 2 - f / 2), t - u / 2, 0] }, m(0.85));
    }
    s && builder.add("wood_pallet", bevelBox(f, u, i - 2 * f, 4e-3), { p: [0, t - u / 2, 0] }, m(0.85));
    let _ = 0.085, T = () => {
      let R = l.range(0.55, 0.9);
      return [R, R * 0.9, R * 0.8];
    };
    for (let R of [1, -1]) for (let z of [1, -1]) for (let I of s ? [1, 0] : [1]) {
      let L = I ? t - _ / 2 : h + _ / 2, U = T();
      builder.add("steel_galv", box(_, _, 3e-3), { p: [R * (e / 2 - _ / 2), L, z * (i / 2 + 15e-4)] }, U), builder.add("steel_galv", box(3e-3, _, _), { p: [R * (e / 2 + 15e-4), L, z * (i / 2 - _ / 2)] }, U), I && builder.add("steel_galv", box(_, 3e-3, _), { p: [R * (e / 2 - _ / 2), t + 15e-4, z * (i / 2 - _ / 2)] }, U);
    }
    let w = i / 2 - u + 3e-3, S = Math.min(0.11, p * 0.15);
    o && (builder.label(o, { color: "black", font: "stencil", distress: 0.25 }, e * 0.4, S, { p: [-e * 0.2, t - f - S * 0.95, w] }), builder.label(o, { color: "black", font: "stencil", distress: 0.25 }, e * 0.4, S, { p: [e * 0.2, t - f - S * 0.95, -w], r: [0, Math.PI, 0] }), builder.decal(c.mats.decal("arrow"), Math.min(0.14, p * 0.2), { p: [e * 0.27, h + f + p * 0.16, w], r: [0, 0, HALF_PI] })), r && builder.label(r, { color: "black", font: "stencil", distress: 0.3 }, i * 0.5, S * 0.9, { p: [e / 2 - u + 3e-3, d + p * 0.12, 0], r: AXIS_ROT.px }), s && builder.decal(c.mats.decal("logo_b"), Math.min(0.2, p * 0.25), { p: [-(e / 2 - u + 3e-3), d - p * 0.05, 0], r: AXIS_ROT.nx });
  }

  function buildCrateWood(mats, e) {
    let t = new PropBuilder(mats, "crate_wood", e.seed || 0);
    return buildCrateBody(t, 1.1, 1, 0.9, { label: e.label === void 0 ? ["FRAGILE", "THIS SIDE UP", "KEEP DRY", "MACHINE PARTS"][t.seed % 4] : e.label, code: e.code || "B4-" + [117, 204, 318][t.seed % 3] }), t.finish();
  }

  function buildCrateStack(mats, e) {
    let t = new PropBuilder(mats, "crate_stack", e.seed || 0), i = t.rng;
    buildCrateBody(t, 1.2, 0.95, 1, { label: "HEAVY", code: "SLT 04" + t.seed % 2 });
    let s = { x: i.range(-0.1, 0.02), z: i.range(-0.05, 0.05), th: (i() < 0.5 ? -1 : 1) * i.range(0.1, 0.16), L: 0.86, W: 0.72 };
    t.push({ p: [s.x, 0.95, s.z], r: [0, s.th, 0] }), buildCrateBody(t, s.L, 0.6, s.W, { detail: false, skids: false, label: "FRAGILE", code: "B4-204" }), t.pop();
    let o = { x: s.x + i.range(-0.05, 0.05), z: s.z + i.range(-0.04, 0.04), th: i.range(-0.12, 0.12) };
    t.push({ p: [o.x, 1.55, o.z], r: [0, o.th, 0] }), buildCrateBody(t, 0.55, 0.35, 0.45, { detail: false, skids: false, label: "", code: "" }), t.pop();
    let r = (a, l, c, u, f) => {
      let h = (a - l.x - f * u * Math.sin(c)) / Math.cos(c);
      return l.z - h * Math.sin(c) + f * u * Math.cos(c);
    };
    for (let a of [-0.2, 0.17]) {
      let c = [], u = (f) => [[a, 0.09, f * 0.506], [a, 0.956, f * 0.506], [a, 1.556, r(a, s, s.th, s.W / 2, f) + f * 6e-3], [a, 1.906, r(a, o, o.th, 0.225, f) + f * 6e-3]];
      c.push(...u(1), ...u(-1).reverse()), t.add("paint_orange", strapRibbon(c, [0.02, 0, 0]), null, [1, 0.8, 0.5]), t.add("steel_worn", bevelBox(0.06, 0.09, 0.025, 6e-3), { p: [a, 0.62, 0.5 + 0.016] }, 0.8), t.add("steel_dark", tubeSpan([a - 0.035, 0.66, 0.53], [a + 0.035, 0.66, 0.53], 8e-3, 6, true), null, 0.8);
    }
    return t.finish();
  }

  function buildIbcTote(mats, e) {
    let t = new PropBuilder(mats, "ibc_tote", e.seed || 0), i = t.rng, s = () => i.range(0.75, 1);
    for (let y of [-0.44, 0, 0.44]) t.add("steel_galv", box(1.2, 0.028, 0.1), { p: [0, 0.014, y] }, s());
    for (let y of [-0.54, 0, 0.54]) for (let b of [-0.44, 0, 0.44]) t.add("steel_galv", bevelBox(0.12, 0.074, 0.1, 8e-3), { p: [y, 0.065, b] }, s() * 0.85);
    for (let y of [-0.48, 0.48]) t.add("steel_galv", bevelBox(1.2, 0.03, 0.04, 6e-3), { p: [0, 0.115, y] }, s());
    for (let y of [-0.58, 0.58]) t.add("steel_galv", bevelBox(0.04, 0.03, 0.92, 6e-3), { p: [y, 0.115, 0] }, s());
    t.add("steel_galv", box(1.12, 0.012, 0.92), { p: [0, 0.124, 0] }, 0.6);
    let o = 1.1, r = 0.95, a = 0.9, l = 0.13 + r / 2, c = segBox(o, r, a, 0.07, 8, 6, 8);
    deformGeo(c, (y) => {
      let b = y.x / (o / 2), g = y.y / (r / 2), E = y.z / (a / 2), M = Math.cos(HALF_PI * g) * Math.cos(HALF_PI * E), _ = Math.cos(HALF_PI * b) * Math.cos(HALF_PI * E), T = Math.cos(HALF_PI * b) * Math.cos(HALF_PI * g);
      Math.abs(b) > 0.9 && (y.x += Math.sign(b) * (0.016 * M + 4e-3 * Math.abs(Math.sin(y.y * Math.PI / 0.22)) * M)), Math.abs(E) > 0.9 && (y.z += Math.sign(E) * (0.016 * T + 4e-3 * Math.abs(Math.sin(y.y * Math.PI / 0.22)) * T)), g > 0.9 && (y.y += 0.012 * _ - 0.01 * Math.max(0, 1 - Math.hypot(y.x, y.z) / 0.3));
    }), recomputeSmoothNormals(c);
    let u = 0.13 + r * i.range(0.45, 0.8), f = t.seed * 1.3, h = t.mat("plastic_grey", { color: 14278096 });
    t.add(h, c, { p: [0, l, 0] }, (y, b, g) => {
      let E = smoothstep(u - 0.03, u + 0.03, b + 0.02 * noise3(y * 3 + f, g * 3)), M = 0.9 + 0.1 * noise3(y * 6, b * 6 + f, g * 6);
      return [M * (0.52 + 0.48 * E), M * (0.6 + 0.4 * E), M * (0.66 + 0.34 * E)];
    }), t.add(h, cyl(0.12, 0.125, 0.03, 14), { p: [0, 0.13 + r + 5e-3, 0] }, 0.9), t.add("plastic_red", lathe([[0.105, 0], [0.105, 0.042], [0.105, 0.042], [0.09, 0.05], [0, 0.05]], 14), { p: [0, 0.13 + r + 0.015, 0] }, 0.9);
    for (let y = 0; y < 8; y++) {
      let b = y * Math.PI / 4;
      t.add("plastic_red", box(0.012, 0.04, 0.02), { p: [Math.cos(b) * 0.108, 0.13 + r + 0.036, Math.sin(b) * 0.108], r: [0, -b, 0] }, 0.8);
    }
    let p = 0.575, d = 0.475, m = 0.13, x = 1.1, v = 0.011;
    for (let y of [0.2, 0.42, 0.64, 0.86, x]) {
      let b = y === x ? 0.014 : v;
      for (let g of [1, -1]) t.add("steel_galv", tubeSpan([-p, y, g * d], [p, y, g * d], b, 5), null, s()), t.add("steel_galv", tubeSpan([g * p, y, -d], [g * p, y, d], b, 5), null, s());
    }
    for (let y of [1, -1]) {
      for (let b = -0.46; b <= 0.461; b += 0.184) t.add("steel_galv", tubeSpan([b, m, y * (d - 0.012)], [b, x, y * (d - 0.012)], v, 5), null, s());
      for (let b = -0.36; b <= 0.361; b += 0.18) t.add("steel_galv", tubeSpan([y * (p - 0.012), m, b], [y * (p - 0.012), x, b], v, 5), null, s());
      t.add("steel_galv", tubeSpan([y * 0.28, x + 0.01, -d], [y * 0.28, x + 0.01, d], 0.013, 5), null, s());
    }
    return t.add("aluminium", bevelBox(0.42, 0.3, 4e-3, 15e-4), { p: [-0.1, 0.72, d + 0.014] }, 0.85), t.label("IBC 1000 L", { color: "black", font: "sans", distress: 0.2 }, 0.36, 0.06, { p: [-0.1, 0.8, d + 0.0175] }), t.decal(mats.decal(["hazard_flammable", "hazard_general"][t.seed % 2]), 0.15, { p: [-0.19, 0.67, d + 0.0175] }), t.decal(mats.decal("numbers_0_9"), 0.2, { p: [0, 0.66, d + 0.0175] }), t.decal(mats.decal("leak_stain"), 0.3, { p: [p + 4e-3, 0.3, 0.02], r: AXIS_ROT.px }), t.add("polymer_black", tubeSpan([0.52, 0.2, 0], [0.575, 0.2, 0], 0.05, 10, true), null, 1), t.add("plastic_red", tubeSpan([0.575, 0.2, 0], [0.598, 0.2, 0], 0.045, 10, true), null, 0.9), t.add("plastic_red", bevelBox(0.02, 0.022, 0.13, 5e-3), { p: [0.55, 0.262, 0.02], r: [0, 0.4, 0] }, 0.9), t.add("polymer_black", cyl(0.012, 0.012, 0.03, 6), { p: [0.55, 0.245, 0] }), t.finish();
  }

  function buildCableReel(mats, e) {
    let t = new PropBuilder(mats, "cable_reel", e.seed || 0), i = t.rng, s = 0.65, o = s, r = 0.4, a = 0.045, l = (y = 1) => {
      let b = i.range(0.7, 1) * y;
      return [b, b * i.range(0.93, 1), b * i.range(0.85, 0.97)];
    }, c = i.range(-0.5, 0.5);
    t.push({ p: [0, o, 0], r: [0, 0, c] });
    for (let y of [1, -1]) {
      for (let b of ringStrip(s - 4e-3, 9, i)) t.add("wood_dark", b, { p: [0, 0, y * (r + i.range(0, 3e-3))], r: [0, y > 0 ? 0 : Math.PI, 0] }, l());
      for (let b of ringStrip(s - 4e-3, 9, i)) t.add("wood_dark", b, { p: [0, 0, y * (r - a)], r: [0, y > 0 ? Math.PI : 0, HALF_PI] }, l(0.8));
      t.add("wood_dark", cyl(s, s, a, 24, true), { p: [0, 0, y * (r - a / 2)], r: [HALF_PI, 0, 0] }, l(0.75)), t.add("steel_dark", cyl(0.105, 0.105, 8e-3, 12), { p: [0, 0, y * (r + 6e-3)], r: [HALF_PI, 0, 0] }, 0.9), t.add("polymer_black", cyl(0.04, 0.04, 4e-3, 10), { p: [0, 0, y * (r + 0.0105)], r: [HALF_PI, 0, 0] }, 0.3);
      for (let b = 0; b < 6; b++) {
        let g = b * Math.PI / 3 + 0.3;
        t.add("steel_galv", cyl(0.017, 0.017, 0.014, 6), { p: [Math.cos(g) * 0.3, Math.sin(g) * 0.3, y * (r + 6e-3)], r: [HALF_PI, 0, 0] }, i.range(0.5, 0.9));
      }
      t.label(y > 0 ? "NYY-J 4x95 mm2  500 m" : "YARDKIT TERMINAL", { color: "white", font: "stencil", distress: 0.45 }, 0.7, 0.085, { p: [0, 0.4, y * (r + 6e-3)], r: [0, y > 0 ? 0 : Math.PI, 0] }), y > 0 && t.decal(mats.decal("arrow"), 0.2, { p: [0.36, -0.2, r + 6e-3], r: [0, 0, -1.2] });
    }
    let u = 16, f = r - a, h = 2 * f / u, p = 0.47, d = [];
    for (let y = 0; y <= u; y++) d.push([p - 0.017, -f + y * h]), y < u && d.push([p, -f + (y + 0.5) * h]);
    let m = t.seed * 0.7;
    t.add("rubber", lathe(d, 20), { r: [HALF_PI, 0, 0] }, (y, b, g) => 0.7 + 0.5 * noise3(Math.atan2(b, y) * 2 + m, g * 30)), t.pop();
    let x = 0.2, v = [];
    for (let y = 1.9; y >= -0.25; y -= 0.36) v.push([Math.cos(y) * (p + 0.012), o + Math.sin(y) * (p + 0.012), x + (1.9 - y) * 0.02]);
    v.push([0.53, 0.3, x + 0.05], [0.56, 0.08, x + 0.06], [0.5, 0.024, x + 0.02], [0.3, 0.022, x - 0.1], [0.05, 0.022, x - 0.02], [-0.2, 0.022, x + 0.06], [-0.38, 0.022, x - 0.05]), t.add("rubber", tube(v, 0.02, 6, false, 0.5), null, 0.9), t.add("brass", tubeSpan([-0.38, 0.022, x - 0.05], [-0.41, 0.022, x - 0.07], 0.014, 6, true), null, 0.9);
    for (let y of [r - a / 2, -(r - a / 2)]) t.add("wood_pallet", extrude2DPoly([[0.14, 0], [0.37, 0], [0.37, 0.1]], 0.1, { soft: 0 }), { p: [0, 0, y] }, l(0.8)), t.add("wood_pallet", extrude2DPoly([[-0.37, 0], [-0.14, 0], [-0.37, 0.1]], 0.1, { soft: 0 }), { p: [0, 0, y] }, l(0.8));
    return t.finish();
  }

  function buildTireStack(mats, e) {
    let t = new PropBuilder(mats, "tire_stack", e.seed || 0), i = t.rng, s = clamp(e.count | 0 || 4, 1, 5);
    for (let o = 0; o < s; o++) {
      let r = tireProfileGeo(0.39, 0.25, 0.215, s > 4 ? 16 : 20), a = { p: [o ? i.range(-0.022, 0.022) : 0, o * 0.25 - (o ? 4e-3 : 0), o ? i.range(-0.022, 0.022) : 0], r: [0, i() * 6, 0] }, l = i.range(0.75, 1), c = o * 3.1;
      t.add("tire", r, a, (u, f, h) => {
        let p = Math.hypot(u - a.p[0], h - a.p[2]);
        return l * (p < 0.23 ? 0.5 : 0.8 + 0.2 * noise3(Math.atan2(h, u) * 3 + c, p * 30));
      });
    }
    return t.finish({ size: [0.8, s * 0.25, 0.8] });
  }

  function buildJerryCan(mats, e, t) {
    let i = new PropBuilder(mats, "jerry_can", t), [s, o] = resolveColor(e.color, "olive"), r = segBox(0.336, 0.36, 0.156, 0.022, 3, 3, 3, "bottom"), a = (v, y) => y > 0.3 && v > 0.04 ? y - (v - 0.04) * 0.5 : y;
    deformGeo(r, (v) => {
      v.y = a(v.x, v.y), Math.abs(v.z) > 0.07 && Math.abs(v.x) < 0.14 && v.y > 0.04 && v.y < 0.3 && (v.z *= 1.02);
    }), r.computeVertexNormals(), i.add(s, r, null, o), i.add(s, extrude2DPoly([[-0.172, 0], [0.172, 0], [0.172, 0.297], [0.045, 0.364], [-0.172, 0.364]], 7e-3, { soft: 0 }), null, typeof o == "number" ? 0.8 : o.map((v) => v * 0.8));
    let l = 0.24, c = 0.2, u = -0.025, f = 0.165, h = Math.hypot(l, c) - 0.02, p = Math.atan2(c, l);
    for (let v of [1, -1]) {
      let y = v * 0.079;
      for (let b of [1, -1]) i.add(s, bevelBox(l, 0.016, 7e-3, 3e-3), { p: [u, f + b * c / 2, y] }, o);
      for (let b of [1, -1]) i.add(s, bevelBox(0.016, c, 7e-3, 3e-3), { p: [u + b * l / 2, f, y] }, o);
      for (let b of [1, -1]) i.add(s, bevelBox(h, 0.018, 8e-3, 3e-3), { p: [u, f, y], r: [0, 0, b * p] }, o);
    }
    for (let v of [-0.042, 0, 0.042]) i.add(s, tube([[-0.135, 0.35, v], [-0.125, 0.42, v], [-0.09, 0.44, v], [-0.02, 0.44, v], [0.01, 0.42, v], [0.02, 0.35, v]], 0.0105, 5, false, 0.5), null, o);
    let d = [0.1, 0.33, 0], m = [0.42, 0.9, 0], x = (v) => [d[0] + m[0] * v, d[1] + m[1] * v, 0];
    return i.add(s, tubeSpan(x(-0.02), x(0.07), 0.03, 8, true), null, o), i.add("steel_dark", tubeSpan(x(0.07), x(0.1), 0.036, 8, true), null, 0.9), i.add("steel_galv", bevelBox(0.07, 8e-3, 0.02, 2e-3), { p: x(0.108), r: [0, 0, -0.44] }, 0.8), i.decal(mats.decal("hazard_flammable"), 0.055, { p: [0.125, 0.25, 0.0795] }), i.decal(mats.decal("hazard_flammable"), 0.055, { p: [-0.125, 0.25, -0.0795], r: [0, Math.PI, 0] }), i.finish();
  }

  function buildTrafficCone(mats, e, t) {
    let i = new PropBuilder(mats, "traffic_cone", t), s = i.rng, o = t * 4.1;
    e.lying && (i.push({ p: [-0.34, 0.18, 0], r: [0, s() * 6, 0] }), i.push({ r: [0, 0, -HALF_PI + 0.16] }));
    let r = (f) => 0.128 + (0.031 - 0.128) * (f - 0.05) / (0.685 - 0.05);
    i.add("rubber", bevelBox(0.36, 0.03, 0.36, 8e-3, "bottom"), null, 0.9);
    let a = (f, h, p) => {
      let d = noise3(Math.atan2(p, f) * 3 + o, h * 14);
      return d > 0.68 ? 0.45 : 0.85 + 0.15 * d;
    }, l = (f, h, p = [], d = []) => lathe([...p, [r(f), f], [r(h), h], ...d], 16), c = i.mat("plastic_red", { color: 12734234 }), u = i.mat("plastic_grey", { color: 13224386 });
    return i.add(c, l(0.05, 0.36, [[0.165, 0.03], [0.15, 0.04], [0.136, 0.05]]), null, a), i.add(u, l(0.36, 0.5), null, (f, h, p) => 0.85 * a(f, h, p)), i.add(c, l(0.5, 0.56), null, a), i.add(u, l(0.56, 0.61), null, (f, h, p) => 0.85 * a(f, h, p)), i.add(c, l(0.61, 0.685, [], [[0.028, 0.696], [0.018, 0.7], [0.018, 0.7], [0, 0.7]]), null, a), e.lying && (i.pop(), i.pop()), i.finish(e.lying ? { size: [0.72, 0.36, 0.36] } : {});
  }

  function buildGasCylinders(mats, e) {
    let t = new PropBuilder(mats, "gas_cylinders", e.seed || 0), i = t.rng, s = 12, o = () => i.range(0.6, 0.9);
    t.add("diamond_plate", bevelBox(0.9, 0.016, 0.5, 4e-3, "bottom"), null, 0.8);
    for (let u of [-0.43, 0.43]) t.add("steel_dark", bevelBox(0.04, 1.14, 0.04, 5e-3), { p: [u, 0.585, -0.225] }, o()), t.add("steel_dark", bevelBox(0.036, 0.036, 0.43, 5e-3), { p: [u, 1.06, -0.01] }, o()), t.add("steel_dark", bevelBox(0.036, 0.036, 0.43, 5e-3), { p: [u, 0.3, -0.01] }, o()), t.add("steel_dark", bevelBox(0.036, 0.32, 0.036, 5e-3), { p: [u, 0.16, 0.19] }, o()), t.add("steel_galv", scaledTorus(0.016, 4e-3, 4, 8), { p: [u - Math.sign(u) * 0, 1.06, 0.215], r: [0, HALF_PI, 0] }, 0.8);
    for (let u of [0.45, 1.06]) t.add("steel_dark", bevelBox(0.9, 0.04, 0.036, 5e-3), { p: [0, u, -0.225] }, o());
    t.add("paint_yellow", bevelBox(0.3, 0.2, 4e-3, 1e-3), { p: [0, 0.76, -0.245] }, 0.9), t.decal(mats.decal("hazard_flammable"), 0.15, { p: [0, 0.76, -0.2475], r: [0, Math.PI, 0] });
    let r = [["paint_red", 1], ["paint_white", 1], ["paint_blue", 1], ["paint_yellow", 1], ["paint_grey", 0.5]], a = [["paint_grey", 0.75], ["paint_grey", 0.55], ["paint_red", [0.55, 0.4, 0.4]], ["paint_blue", 0.8]];
    for (let u = 0; u < 3; u++) {
      let f = (u - 1) * 0.272, h = 1 - i.range(0, 0.05), p = 0.115, d = r[(t.seed + u * 2) % r.length], m = a[(t.seed + u) % a.length], x = u * 5.3 + t.seed, v = i() * 6;
      t.push({ p: [f, 0.016, 0.015 + i.range(-0.01, 0.01)], r: [0, v, 0], s: [1, h, 1] }), t.add(m[0], lathe([[0, 0.012], [0.095, 0.012], [0.095, 0.012], [0.1, 0], [0.111, 0], [p, 8e-3], [p, 0.4], [p, 0.8], [p, 1.22]], s), null, (y, b, g) => {
        let E = noise3(Math.atan2(g, y) * 3 + x, b * 5), M = E > 0.7 ? 0.55 : 1, _ = typeof m[1] == "number" ? [m[1], m[1], m[1]] : m[1];
        return [_[0] * M, _[1] * M * (E > 0.7 ? 0.85 : 1), _[2] * M * (E > 0.7 ? 0.7 : 1)];
      }), t.add(d[0], lathe([[p, 1.22], [0.111, 1.285], [0.098, 1.34], [0.075, 1.385], [0.052, 1.41], [0.04, 1.42]], s), null, d[1]), t.add("steel_dark", lathe([[0.04, 1.42], [0.057, 1.42], [0.057, 1.42], [0.057, 1.448], [0.057, 1.448], [0.05, 1.452], [0.053, 1.53], [0.046, 1.565], [0.026, 1.585], [0, 1.588]], s), null, 0.8);
      for (let y of [0, Math.PI]) t.add("polymer_black", cyl(0.016, 0.016, 4e-3, 6), { p: [Math.cos(y) * 0.052, 1.5, Math.sin(y) * 0.052], r: [0, -y, HALF_PI] }, 0.2);
      u !== 1 && t.cdecal(mats.decal(u ? "hazard_general" : "hazard_flammable"), p + 15e-4, 0.1, { p: [0, 1.08, 0], r: [0, i.range(-0.5, 0.5) - v, 0] }), t.cdecal(mats.label(["ACETYLENE", "OXYGEN", "ARGON", "PROPANE"][(t.seed + u) % 4], { color: "white", font: "stencil", distress: 0.4 }), p + 15e-4, 0.2, { p: [0, 0.86, 0], r: [0, i.range(-0.4, 0.4) - v, 0] }), t.pop();
    }
    let l = 19, c = (u) => {
      let f = 0.215;
      for (let h = -1; h <= 1; h++) {
        let p = u - h * 0.272;
        Math.abs(p) < 0.115 && (f = Math.max(f, 0.015 + Math.sqrt(0.123 * 0.123 - p * p) + 0));
      }
      return Math.max(f, 0.1);
    };
    for (let u = 0; u < l; u++) {
      let f = u / (l - 1), h = -0.425 + 0.85 * f, p = Math.max(c(h), c(h - 0.03), c(h + 0.03)) + 4e-3, d = 1.05 - 0.035 * Math.sin(Math.PI * (f * 3 % 1)) - 0.01;
      t.add("steel_galv", scaledTorus(0.017, 45e-4, 3, 6), { p: [h, d, p], r: [u % 2 ? HALF_PI : 0.15, 0, 0], s: [1.35, 1, 1] }, i.range(0.6, 0.95));
    }
    return t.finish();
  }

  function buildPipeStack(mats, e) {
    let t = new PropBuilder(mats, "pipe_stack", e.seed || 0), i = t.rng, s = 0.1365, o = 0.012, r = 0.08, a = 14, l = (f = 1) => {
      let h = i.range(0.6, 0.95) * f;
      return [h, h * 0.95, h * 0.86];
    };
    for (let f of [-2.2, 0, 2.2]) {
      t.add("wood_dark", bevelBox(0.11, r, 1.2, 8e-3), { p: [f + i.range(-0.1, 0.1), r / 2, 0], r: [0, i.range(-0.03, 0.03), 0] }, l());
      for (let h of [1, -1]) t.add("wood_pallet", extrude2DPoly(h > 0 ? [[0, 0], [0.158, 0], [0.158, 0.1]] : [[-0.158, 0], [0, 0], [-0.158, 0.1]], 0.1, { soft: 0 }), { p: [f, r, h * 0.44], r: [0, -HALF_PI, 0] }, l(0.9));
    }
    let c = [4, 3, 2], u = 2 * s * Math.sin(Math.PI / 3);
    c.forEach((f, h) => {
      for (let p = 0; p < f; p++) {
        let d = (p - (f - 1) / 2) * 2 * s, m = r + s + h * u, x = i.range(5.78, 5.92), v = i.range(-3, 3 - x) * 0.999 + 0, y = Math.max(-3, Math.min(3 - x, v)) + x / 2, b = i() < 0.7 ? "steel_rust" : "steel_dark", g = i() * 50, E = i.range(0.75, 1), M = new THREE.CylinderGeometry(s, s, x, a, 4, true);
        {
          let w = M.attributes.uv, S = M.attributes.position;
          for (let R = 0; R < w.count; R++) w.setXY(R, w.getX(R) * 2 * Math.PI * s, S.getY(R));
        }
        let _ = { p: [y, m, d], r: [i() * 6, 0, HALF_PI] };
        t.add(b, M, _, (w, S, R) => E * (0.75 + 0.35 * noise3(w * 1.3 + g, R * 9, S * 9)));
        let T = invertGeo(cyl(s - o, s - o, x - 2e-3, a, true));
        t.add("steel_rust", T, _, (w) => 0.16 + 0.5 * smoothstep(x / 2 + Math.abs(y) - 0.9, x / 2 + Math.abs(y) + 0.2, Math.abs(w - y) + Math.abs(y)));
        for (let w of [1, -1]) t.add(b, lathe(w > 0 ? [[s, 0], [s - o, 0]] : [[s - o, 0], [s, 0]], a), { p: [y + w * x / 2, m, d], r: [0, 0, -HALF_PI] }, E * 1.1);
      }
    });
    for (let f of [-1.35, 1.5]) {
      let p = 2 * s, d = r + s + 2 * u + s + 4e-3, m = [], x = [[-(1.5 * p + s + 4e-3), r + s], [-(0.5 * p + s * 0.5 + 4e-3), r + s + 2 * u + s * 0.87], [-0.5 * p, d], [0.5 * p, d], [0.5 * p + s * 0.5 + 4e-3, r + s + 2 * u + s * 0.87], [1.5 * p + s + 4e-3, r + s], [1.5 * p, r - 4e-3], [-1.5 * p, r - 4e-3], [-(1.5 * p + s + 4e-3), r + s]];
      for (let v of x) m.push([f, v[1], v[0]]);
      t.add("steel_dark", strapRibbon(m, [0.016, 0, 0]), null, 0.7), t.add("steel_galv", bevelBox(0.04, 0.012, 0.05, 3e-3), { p: [f, d + 5e-3, 0.03] }, 0.8);
    }
    return t.cdecal(mats.label("API 5L X52  273.1 x 12.5  HEAT 40719", { color: "white", font: "stencil", distress: 0.5 }), s + 2e-3, 0.2, { p: [0.9, r + s + 2 * u, s], r: [-HALF_PI + 0.9, 0, HALF_PI] }, 1.6), t.finish();
  }

  function buildTarpCargo(mats, e) {
    let t = new PropBuilder(mats, "tarp_cargo", e.seed || 0), i = t.rng, s = t.seed * 1.7, o = 0.144, r = [[-1.06, -0.12, -0.58, 0.58, i.range(0.98, 1.12)], [-0.06, 1.06, -0.58, 0.12, i.range(1.32, 1.42)], [0.02, 0.62, 0.16, 0.58, i.range(0.72, 0.86)], [0.66, 1.06, 0.18, 0.56, i.range(0.5, 0.62)]];
    for (let N of [-0.6, 0.6]) t.push({ p: [N, 0, 0], r: [0, 0, 0] }), buildPalletBody(t, i, { stamp: false }), t.pop();
    for (let N of r) {
      let Z = N[1] - N[0], Q = N[3] - N[2], W = N[4] - o, J = (N[0] + N[1]) / 2, G = (N[2] + N[3]) / 2, te = i.range(0.7, 0.95);
      t.add("wood_pallet", bevelBox(Z, W, Q, 6e-3), { p: [J, o + W / 2, G] }, [te, te * 0.95, te * 0.88]), t.add("wood_pallet", box(Z + 0.012, 0.07, Q + 0.012), { p: [J, o + 0.04, G] }, te * 0.75);
    }
    let a = 1.9, l = 22, c = 14, u = -1.125, f = 1.125, h = -0.645, p = 0.645, d = 5, m = (N, Z) => {
      let Q = 0.3;
      for (let W of r) {
        let J = Math.max(W[0] - N, 0, N - W[1]), G = Math.max(W[2] - Z, 0, Z - W[3]), te = Math.hypot(J, G);
        Q = Math.max(Q, W[4] - 0.95 * te - 0.9 * te * te);
      }
      return Q + 0.016 + 0.022 * noise3(N * 5 + s, Z * 5) + 8e-3 * Math.sin(N * 23 + Z * 7 + s) + 6e-3 * Math.sin(Z * 31 - N * 5);
    }, x = [], v = [], y = [], b = (N, Z) => Z * (l + 1) + N;
    for (let N = 0; N <= c; N++) for (let Z = 0; Z <= l; Z++) {
      let Q = u + (f - u) * Z / l, W = h + (p - h) * N / c;
      x.push(Q, m(Q, W), W), v.push(Q * a, W * a);
    }
    for (let N = 0; N < c; N++) for (let Z = 0; Z < l; Z++) {
      let Q = b(Z, N), W = b(Z + 1, N), J = b(Z + 1, N + 1), G = b(Z, N + 1);
      y.push(Q, G, W, W, G, J);
    }
    let g = [];
    for (let N = 0; N < l; N++) g.push([N, 0, 0, -1]);
    for (let N = 0; N < c; N++) g.push([l, N, 1, 0]);
    for (let N = l; N > 0; N--) g.push([N, c, 0, 1]);
    for (let N = c; N > 0; N--) g.push([0, N, -1, 0]);
    let E = g.length, M = (l + 1) * (c + 1), _ = /* @__PURE__ */ new Map(), T = i() * E;
    g.forEach((N, Z) => {
      _.set(N[0] + "," + N[1], Z);
      let Q = (N[0] === 0 || N[0] === l) && (N[1] === 0 || N[1] === c), W = N[2], J = N[3];
      Q && (W = N[0] === 0 ? -0.707 : 0.707, J = N[1] === 0 ? -0.707 : 0.707);
      let G = b(N[0], N[1]), te = x[G * 3], oe = x[G * 3 + 1], ee = x[G * 3 + 2], le = Math.abs(Z - T);
      le = Math.min(le, E - le);
      let xe = 0.17 + 0.07 * Math.sin(Z * 0.55 + s) + 0.07 * noise3(Z * 0.31 + s, 2.2) + 0.3 * Math.exp(-le * le / 14), j = i() * 6;
      for (let O = 1; O <= d; O++) {
        let q = O / d, ue = oe + (xe - oe) * (0.25 * q + 0.75 * q * q) - (O === 1 ? 0.02 : 0), de = (N[0] === 5 || N[0] === 16) && N[2] === 0 ? 0.035 * Math.sin(Math.PI * q) : 0, $ = q * (0.04 * Math.sin(Z * 1.7 + j * 0.2) + 0.028 * Math.sin(Z * 0.83 + 1.3 + s)) + 0.02 * q * noise3(Z * 0.8, O * 0.9 + s) - de, se = (O === 1 ? 0.028 : 0.04 + 0.03 * q) + $ + (Q ? 0.012 * q : 0), fe = clamp(te + W * se, -1.2, 1.2), me = clamp(ee + J * se, -0.7, 0.7), ge = oe - ue;
        x.push(fe, ue, me), v.push((te + W * (se + ge)) * a, (ee + J * (se + ge)) * a);
      }
    });
    let w = (N, Z) => Z === 0 ? b(g[N][0], g[N][1]) : M + N * d + (Z - 1);
    for (let N = 0; N < E; N++) for (let Z = 0; Z < d; Z++) {
      let Q = (N + 1) % E, W = w(N, Z), J = w(Q, Z), G = w(Q, Z + 1), te = w(N, Z + 1);
      y.push(W, J, te, J, G, te);
    }
    let S = new THREE.BufferGeometry();
    S.setAttribute("position", new THREE.BufferAttribute(new Float32Array(x), 3)), S.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(v), 2)), S.setIndex(y), S.computeVertexNormals();
    let R = S.attributes.normal, z = S.attributes.position, I = (N, Z) => [z.getX(N) + R.getX(N) * Z, z.getY(N) + R.getY(N) * Z, z.getZ(N) + R.getZ(N) * Z], L = [];
    for (let N of [5, 16]) {
      let Z = [], Q = _.get(N + ",0"), W = _.get(N + "," + c);
      Z.push([z.getX(w(Q, d)), 0.11, -0.52]);
      for (let J = d; J >= 1; J--) Z.push(I(w(Q, J), 7e-3));
      for (let J = 0; J <= c; J++) Z.push(I(b(N, J), 7e-3));
      for (let J = 1; J <= d; J++) Z.push(I(w(W, J), 7e-3));
      Z.push([z.getX(w(W, d)), 0.11, 0.52]), L.push(Z);
    }
    let U = 6, k = [], C = _.get("0," + U), A = _.get(l + "," + U);
    k.push([-1.1, 0.1, z.getZ(w(C, d))]);
    for (let N = d; N >= 1; N -= 2) k.push(I(w(C, N), 0.012));
    for (let N = 0; N <= l; N += 2) k.push(I(b(N, U), 0.012));
    for (let N = 1; N <= d; N += 2) k.push(I(w(A, N), 0.012));
    k.push([1.1, 0.1, z.getZ(w(A, d))]), t.add(t.mat("tarp", { doubleSide: true }), S, null, (N, Z, Q) => {
      let W = noise3(N * 2.3 + s, Z * 2.3, Q * 2.3), J = noise3(N * 11, Z * 11, Q * 11 + s);
      return (0.72 + 0.28 * W) * (0.9 + 0.1 * J) * (0.8 + 0.2 * smoothstep(0.15, 0.6, Z));
    });
    for (let N of L) {
      t.add("paint_orange", strapRibbon(N, [0.024, 0, 0]), null, [1, 0.82, 0.5]);
      let Z = N[N.length - 4];
      t.add("steel_worn", bevelBox(0.065, 0.1, 0.03, 6e-3), { p: [Z[0], Z[1], Z[2] + 0.014], r: [0.25, 0, 0] }, 0.8), t.add("steel_dark", bevelBox(0.02, 0.09, 0.012, 3e-3), { p: [Z[0] + 0.03, Z[1] + 0.06, Z[2] + 0.04], r: [0.9, 0, 0] }, 0.8);
    }
    t.add("rope", tube(k, 9e-3, 4, false, 0.5), null, 0.85);
    let F = [2.4, 1.5, 1.4], H = Math.max(...r.map((N) => N[4])) + 0.04;
    return t.finish({ size: F, colliders: [{ min: [-1.2, 0, -0.7], max: [1.2, H, 0.7], surface: "dirt" }] });
  }

  function buildSandbags(mats, e) {
    let t = new PropBuilder(mats, "sandbags", e.seed || 0), i = t.rng, s = 0.18, o = clamp(e.courses | 0 || 5, 1, 7), r = t.mat(SANDBAG_MAT[0], SANDBAG_MAT[1]), a = (l, c, u, f) => {
      let h = s * i.range(1.02, 1.12), p = i() < 0.3 ? i.range(0.55, 0.75) : i.range(0.82, 1), d = i() * 30, m = { p: [u[0] + i.range(-0.012, 0.012), u[1] + h / 2 - 4e-3, u[2] + i.range(-0.012, 0.012)], r: [i.range(-0.03, 0.03), f + i.range(-0.06, 0.06), 0] };
      t.add(r, crushedBox(l, h, c, i), m, (x, v, y) => {
        let b = noise3(x * 7 + d, v * 7, y * 7);
        return [p * (0.85 + 0.15 * b), p * (0.84 + 0.15 * b), p * (0.8 + 0.16 * b)];
      });
      for (let x of [1, -1]) t.add(r, strapRibbon([[x * (l / 2 - 4e-3), i.range(-8e-3, 8e-3), -c * 0.27], [x * (l / 2 - 2e-3), i.range(-8e-3, 8e-3), c * 0.27]], [x * 9e-3, 1e-3, 0]), m, p * 0.9);
    };
    for (let l = 0; l < o; l++) {
      let c = l * s, u = l === o - 1;
      if (l % 2 === 0) for (let f = 0; f < 3; f++) for (let h of [1, -1]) u && f === 2 && h === 1 && o > 2 || a(0.655, 0.3, [(f - 1) * 0.655, c, h * 0.148], 0);
      else for (let f = 0; f < 5; f++) u && f === 0 && o > 2 || a(0.585, 0.385, [(f - 2) * 0.392, c, 0], HALF_PI);
    }
    return t.finish({ size: [2, o * s, 0.6], surface: "dirt" });
  }

  function buildCardboardBoxes(mats, e) {
    let t = new PropBuilder(mats, "cardboard_boxes", e.seed || 0), i = t.rng, s = () => i.range(-0.015, 0.015), o = () => i.range(0.82, 1);
    return tapedCarton(t, 0.5, 0.38, 0.44, { p: [-0.23 + s(), 0, -0.16 + s()], r: [0, i.range(-0.05, 0.05), 0] }, { damp: 0.45, label: "FRAGILE", arrow: true, tint: o() }), tapedCarton(t, 0.42, 0.33, 0.4, { p: [0.26 + s(), 0, -0.17 + s()], r: [0, i.range(-0.08, 0.08), 0] }, { damp: 0.5, label: "KEEP DRY", tint: o() }), tapedCarton(t, 0.46, 0.28, 0.4, { p: [-0.24 + s(), 0.38, -0.15 + s()], r: [0, i.range(-0.2, 0.2), 0] }, { crush: 1, damp: 0.75, tint: o() * 0.92 }), tapedCarton(t, 0.33, 0.26, 0.32, { p: [0.27 + s(), 0.33, -0.18 + s()], r: [0, i.range(-0.3, 0.3), 0] }, { open: true, damp: 0.1, label: "", arrow: true, tint: o() }), tapedCarton(t, 0.3, 0.16, 0.24, { p: [-0.26 + s(), 0.565, -0.16 + s()], r: [0.03, i.range(-0.5, 0.5), -0.09] }, { damp: 0.2, label: "HX-2291", tint: o() }), tapedCarton(t, 0.36, 0.26, 0.3, { p: [0.06 + s(), 0.105, 0.2], r: [0.62, i.range(-0.25, 0.25), 0] }, { damp: 0.9, crush: 0.25, tint: o() * 0.85 }), t.finish();
  }

  function buildForklift(mats, e) {
    let t = new PropBuilder(mats, "forklift", e.seed || 0), i = t.rng, s = clamp(+e.forksUp || 0, 0, 1), o = s * 1.5, r = o / 2, [a, l] = resolveColor(e.color, "yellow"), c = (Q = 1) => typeof l == "number" ? l * Q : l.map((W) => W * Q), u = "steel_dark", f = () => i.range(0.68, 0.95), h = e.number || ["04", "07", "12", "22"][t.seed % 4], p = 0.33, d = 0.23, m = 0.22, x = 0.47, v = 0.27, y = 0.18, b = -1.1, g = 0.46;
    for (let Q of [1, -1]) tireCourse(t, m, p, d, x, Q, 0.195, 24, 0, i), tireCourse(t, b, v, y, g, Q, 0.155, 20, 0, i);
    t.add(u, tubeSpan([m, p, -0.4], [m, p, 0.4], 0.07, 8), null, 0.5), t.add(u, bevelBox(0.12, 0.1, 0.78, 0.01), { p: [b, v, 0] }, 0.5), t.add(u, bevelBox(1.95, 0.34, 0.68, 0.02), { p: [-0.425, 0.37, 0] }, 0.55);
    for (let Q of [1, -1]) {
      t.add(a, bevelBox(0.6, 0.3, 0.17, 0.02), { p: [-0.47, 0.4, Q * 0.42] }, c(0.92)), t.add("diamond_plate", bevelBox(0.3, 0.012, 0.16, 3e-3), { p: [-0.32, 0.556, Q * 0.42] }, 0.7), t.add(u, cyl(0.03, 0.03, 0.02, 8), { p: [-0.62, 0.56, Q * 0.42] }, 0.6);
      let W = [], J = p + 0.035, G = p + 0.06;
      for (let te = 0; te <= 7; te++) {
        let oe = 0.12 + (Math.PI - 0.5) * te / 7;
        W.push([m + Math.cos(oe) * G, p + Math.sin(oe) * G]);
      }
      for (let te = 7; te >= 0; te--) {
        let oe = 0.12 + (Math.PI - 0.5) * te / 7;
        W.push([m + Math.cos(oe) * J, p + Math.sin(oe) * J]);
      }
      t.add(a, extrude2DPoly(W, 0.27, { soft: 0.7 }), { p: [0, 0, Q * 0.475] }, c(0.95));
    }
    t.add("diamond_plate", box(0.66, 0.016, 0.68), { p: [0.2, 0.548, 0] }, 0.6);
    for (let Q of [-0.12, 0.1]) t.add("rubber", bevelBox(0.1, 0.02, 0.07, 6e-3), { p: [0.33, 0.6, Q], r: [0, 0, 0.5] }, 0.8);
    let E = segBox(0.62, 0.63, 1.12, 0.12, 3, 3, 3);
    deformGeo(E, (Q) => {
      if (Q.y > 0.1) {
        let W = (Q.y - 0.1) / 0.215;
        Q.x += 0.03 * W * (Q.x < 0 ? 1 : 0);
      }
    }), t.add(a, recomputeSmoothNormals(E), { p: [-1.39, 0.915, 0] }, c(0.97)), t.add(a, bevelBox(0.56, 0.37, 0.64, 0.05), { p: [-1.4, 0.43, 0] }, c(0.85)), t.add("hazard_stripes", bevelBox(0.014, 0.085, 0.84, 4e-3), { p: [-1.702, 0.77, 0] }, 0.95), t.label(h, { color: "black", font: "stencil", distress: 0.35 }, 0.4, 0.2, { p: [-1.703, 0.96, 0], r: [0, -HALF_PI, 0] });
    for (let Q of [1, -1]) t.add(mats.emissive(16722450, 0.16), bevelBox(0.012, 0.05, 0.11, 4e-3), { p: [-1.69, 1.1, Q * 0.37] }, 1, { raw: true }), t.add(u, bevelBox(0.016, 0.066, 0.126, 4e-3), { p: [-1.684, 1.1, Q * 0.37] }, 0.4), t.label("YARDKIT", { color: "black", font: "sans", distress: 0.3 }, 0.42, 0.085, { p: [-1.39, 0.99, Q * 0.5625], r: [0, Q > 0 ? 0 : Math.PI, 0] }), t.add(u, bevelBox(0.06, 0.05, 0.02, 4e-3), { p: [-1.67, 0.44, Q * 0.05] }, 0.5);
    t.add("steel_worn", cyl(0.02, 0.02, 0.13, 8), { p: [-1.68, 0.44, 0] }, 0.7), t.add(a, bevelBox(0.98, 0.46, 0.94, 0.04), { p: [-0.59, 0.79, 0] }, c());
    for (let Q of [1, -1]) {
      t.label(h, { color: "black", font: "stencil", distress: 0.35 }, 0.3, 0.19, { p: [-0.84, 0.8, Q * 0.4715], r: [0, Q > 0 ? 0 : Math.PI, 0] }), t.add(u, box(0.34, 0.2, 4e-3), { p: [-0.36, 0.8, Q * 0.47] }, 0.2);
      for (let W = 0; W < 5; W++) t.add(a, box(0.34, 0.03, 6e-3), { p: [-0.36, 0.72 + W * 0.04, Q * 0.474], r: [Q * 0.5, 0, 0] }, c(0.85));
    }
    t.add(u, bevelBox(0.4, 0.05, 0.4, 0.01), { p: [-0.54, 1.045, 0] }, 0.5);
    let M = segBox(0.46, 0.1, 0.46, 0.04, 3, 3, 3);
    deformGeo(M, (Q) => {
      Q.y > 0 && (Q.y -= 0.018 * Math.cos(Q.x * 5) * Math.cos(Q.z * 5));
    }), t.add("rubber", recomputeSmoothNormals(M), { p: [-0.53, 1.115, 0] }, 1);
    let _ = segBox(0.1, 0.5, 0.44, 0.04, 3, 4, 3);
    deformGeo(_, (Q) => {
      Q.x > 0 && (Q.x -= 0.02 * Math.cos(Q.z * 5.5));
    }), t.add("rubber", recomputeSmoothNormals(_), { p: [-0.8, 1.39, 0], r: [0, 0, 0.16] }, 1);
    for (let Q of [1, -1]) t.add(u, boxSpan([-0.78, 1.08, Q * 0.24], [-0.82, 1.3, Q * 0.24], 0.03, 0.012, 4e-3), null, 0.5);
    t.add(a, extrude2DPoly([[0.2, 0.55], [0.54, 0.55], [0.54, 1], [0.46, 1.12], [0.3, 1.14], [0.21, 1.02]], 0.7, { soft: 0.5 }), null, c());
    let T = Math.atan2(0.12, 0.09);
    t.push({ p: [0.253, 1.082, 0], r: [0, 0, T] }), t.add(u, bevelBox(0.012, 0.13, 0.44, 4e-3), { p: [-6e-3, 0, 0] }, 0.45), t.add(mats.emissive(9429168, 0.3), plane(0.09, 0.05), { p: [-0.0135, 0.01, 0.1], r: [0, -HALF_PI, 0] }, 1, { raw: true, cast: false }), t.decal(mats.decal("csc_plate"), 0.09, { p: [-0.0135, 0, -0.12], r: [0, -HALF_PI, 0] }), t.add("plastic_red", cyl(0.016, 0.016, 0.02, 8), { p: [-0.02, 0, 0.19], r: [0, 0, HALF_PI] }, 0.9), t.add("steel_bare", cyl(9e-3, 9e-3, 0.02, 6), { p: [-0.018, -0.03, -0.01], r: [0, 0, HALF_PI] }, 0.9), t.pop();
    let w = [0.3, 1.1, 0.04], S = [0.1, 1.31, 0.04];
    t.add(u, tubeSpan(w, S, 0.024, 8), null, 0.5), t.push({ p: S, r: [0, 0, Math.atan2(S[1] - w[1], S[0] - w[0])] }), t.add("rubber", scaledTorus(0.165, 0.014, 6, 18), { r: [0, HALF_PI, 0] }, 1);
    for (let Q = 0; Q < 3; Q++) {
      let W = Q * Math.PI * 2 / 3 + 0.5;
      t.add(u, tubeSpan([-0.01, 0, 0], [0, Math.cos(W) * 0.16, Math.sin(W) * 0.16], 9e-3, 5), null, 0.5);
    }
    t.add(u, cyl(0.035, 0.04, 0.03, 10), { p: [-5e-3, 0, 0], r: [0, 0, HALF_PI] }, 0.5), t.add("rubber", cyl(0.016, 0.014, 0.045, 8), { p: [0.03, 0.16, 0.02], r: [0, 0, HALF_PI] }, 1), t.pop();
    for (let Q = 0; Q < 3; Q++) {
      let W = -0.2 - Q * 0.055, J = [0.33, 1.12, W], G = [0.25 - Q * 0.012, 1.3 - Q * 0.01, W - 0.01];
      t.add("steel_bare", tubeSpan(J, G, 7e-3, 5), null, 0.8), t.add("rubber", scaledSphere(0.02, 7, 5), { p: G }, 1);
    }
    {
      let Q = [0.3, 1.1, 0.27], W = [0.2, 1.24, 0.29];
      t.add("steel_bare", tubeSpan(Q, W, 8e-3, 5), null, 0.8), t.add("plastic_red", cyl(0.016, 0.016, 0.07, 7), { p: W, r: [0, 0, 0.6] }, 0.9);
    }
    let R = 2.045, z = [];
    for (let Q of [1, -1]) {
      let W = [0.47, 1.08, Q * 0.4], J = [0.27, R, Q * 0.46], G = [-1, 1, Q * 0.44], te = [-0.95, R, Q * 0.46];
      t.add(u, boxSpan(W, J, 0.06, 0.05, 0.01), null, f()), t.add(u, boxSpan(G, te, 0.06, 0.05, 0.01), null, f()), t.add(u, boxSpan([0.3, R, Q * 0.46], [-0.98, R, Q * 0.46], 0.05, 0.06, 0.01), null, f()), t.add(u, bevelBox(0.09, 0.012, 0.08, 3e-3), { p: [0.47, 1.085, Q * 0.4] }, 0.5), t.add(u, bevelBox(0.09, 0.012, 0.08, 3e-3), { p: [-1, 1.024, Q * 0.44] }, 0.5);
      let oe = 0.36, ee = 1.66;
      t.add(u, segBox(0.085, 0.1, 0.13, 0.02, 3, 3, 3), { p: [oe + 0.045, ee, Q * 0.47] }, 0.45), t.add(mats.emissive(16773330, 0.7), bevelBox(6e-3, 0.075, 0.105, 2e-3), { p: [oe + 0.089, ee, Q * 0.47] }, 1, { raw: true }), t.add(u, tubeSpan([0.385, 1.5, Q * 0.42], [0.42, 1.52, Q * 0.57], 8e-3, 5), null, 0.5), t.add(u, bevelBox(0.022, 0.17, 0.1, 6e-3), { p: [0.42, 1.52, Q * 0.573], r: [0, Q * 0.25, 0] }, 0.5), t.add("steel_bare", box(2e-3, 0.15, 0.084), { p: [0.408, 1.52, Q * 0.57], r: [0, Q * 0.25, 0] }, 1), z.push({ min: [-1.03, 1, Q > 0 ? 0.41 : -0.5], max: [-0.92, R, Q > 0 ? 0.5 : -0.41], surface: "metal" }, { min: [0.24, 1.08, Q > 0 ? 0.37 : -0.5], max: [0.5, R, Q > 0 ? 0.5 : -0.37], surface: "metal" });
    }
    for (let Q of [0.28, -0.96]) t.add(u, bevelBox(0.05, 0.06, 0.92, 0.01), { p: [Q, R, 0] }, f());
    for (let Q = 0; Q < 8; Q++) t.add(u, bevelBox(0.03, 0.028, 0.9, 6e-3), { p: [-0.83 + Q * 0.139, R + 0.012, 0] }, f());
    t.add(u, tube([[0.44, 1.2, 0.44], [0.47, 1.25, 0.49], [0.41, 1.55, 0.5], [0.36, 1.6, 0.455]], 0.011, 5, false, 0.5), null, 0.5), t.add(u, cyl(0.045, 0.05, 0.03, 10), { p: [-0.86, R + 0.045, 0.3] }, 0.5), t.add(mats.emissive(16747026, 0.9), lathe([[0.04, 0], [0.04, 0.06], [0.03, 0.082], [0, 0.09]], 10), { p: [-0.86, R + 0.06, 0.3] }, 1, { raw: true });
    let I = -1.4, L = 1.23 + 0.05 + 0.155;
    for (let Q of [-0.2, 0.2]) t.add(u, bevelBox(0.3, 0.07, 0.04, 8e-3), { p: [I, 1.262, Q] }, 0.5), t.add(u, cyl(0.159, 0.159, 0.035, 16, true), { p: [I, L, Q], r: [HALF_PI, 0, 0] }, 0.35);
    t.add("steel_galv", lathe([[0, -0.37], [0.08, -0.36], [0.132, -0.33], [0.155, -0.27], [0.155, 0.27], [0.132, 0.33], [0.08, 0.36], [0, 0.37]], 16), { p: [I, L, 0], r: [HALF_PI, 0, 0] }, (Q, W, J) => 0.8 + 0.2 * noise3(Q * 8, W * 8, J * 8)), t.add("steel_galv", cyl(0.09, 0.09, 0.07, 12, true), { p: [I, L, 0.39], r: [HALF_PI, 0, 0] }, 0.7), t.add("steel_galv", cyl(0.02, 0.02, 0.05, 8), { p: [I, L, 0.39], r: [HALF_PI, 0, 0] }, 0.9), t.add("rubber", tube([[I, L, 0.41], [I + 0.05, L - 0.02, 0.46], [I + 0.2, L - 0.15, 0.44], [-1.07, 1.1, 0.38], [-1, 0.98, 0.36]], 0.012, 5, false, 0.5), null, 1), t.push({ p: [I, L, 0], r: [0, 0, 0.7] }), t.cdecal(mats.decal("hazard_flammable"), 0.157, 0.12, { p: [0, 0, -0.05], r: [-HALF_PI, 0, 0] }), t.cdecal(mats.label("LPG", { color: "red", font: "stencil", distress: 0.3 }), 0.157, 0.16, { p: [0, 0, 0.14], r: [-HALF_PI, 0, 0] }), t.pop();
    let U = 0.6, k = 0.73, C = 0.375, A = 0.08, F = 2.02;
    for (let Q of [1, -1]) {
      let W = Q * C, J = [[U, W], [k, W], [k, W - Q * 0.065], [k - 0.014, W - Q * 0.065], [k - 0.014, W - Q * 0.014], [U + 0.014, W - Q * 0.014], [U + 0.014, W - Q * 0.065], [U, W - Q * 0.065]];
      t.add(u, extrude2DPoly(ensureCCW(J.map((q) => [q[0], -q[1]])), F - A, { soft: 0 }), { p: [0, (A + F) / 2, 0], r: [-HALF_PI, 0, 0] }, f()), t.add(u, bevelBox(0.085, 1.86, 0.036, 6e-3), { p: [0.665, 0.13 + r + 0.93, Q * 0.335] }, f() * 1.25), t.decal(mats.decal("hazard_general"), 0.1, { p: [0.665, 1.3, Q * (C + 2e-3)], r: [0, Q > 0 ? 0 : Math.PI, 0] });
      let G = [0.36, 0.66, Q * 0.3], te = [0.6, 0.86, Q * 0.33], oe = [0.5, 0.777, Q * 0.317];
      t.add(u, tubeSpan(G, oe, 0.034, 8, true), null, 0.55), t.add("steel_bare", tubeSpan(oe, te, 0.018, 6), null, 1);
      let ee = Q * 0.13, le = 1.9 + r, xe = 0.055, j = [[0.725, 0.5 + o, ee], [0.725, le, ee]];
      for (let q = 0.5; q < Math.PI; q += 0.55) j.push([0.67 + Math.cos(q) * xe, le + Math.sin(q) * xe, ee]);
      j.push([0.615, le, ee], [0.615, 1, ee]);
      let O = 0;
      for (let q = 0; q < j.length - 1; q++) {
        let ue = j[q], de = j[q + 1], $ = Math.hypot(de[0] - ue[0], de[1] - ue[1]), se = Math.max(1, Math.round($ / 0.058));
        for (let fe = 0; fe < se; fe++, O++) {
          let me = fe / se, ge = (fe + 0.86) / se, ce = (P) => [ue[0] + (de[0] - ue[0]) * P, ue[1] + (de[1] - ue[1]) * P, ee];
          t.add("steel_worn", boxSpan(ce(me), ce(ge), 0.011, O % 2 ? 0.034 : 0.022, 0, true), null, O % 2 ? 0.55 : 0.75);
        }
      }
      t.add(u, cyl(xe - 6e-3, xe - 6e-3, 0.04, 12), { p: [0.67, le, ee], r: [HALF_PI, 0, 0] }, 0.7);
    }
    t.add(u, bevelBox(0.04, 0.09, 0.78, 8e-3), { p: [U - 0.012, 1.96, 0] }, f()), t.add(u, bevelBox(0.04, 0.12, 0.78, 8e-3), { p: [U - 0.012, 0.42, 0] }, f()), t.add(u, bevelBox(0.07, 0.09, 0.66, 8e-3), { p: [0.665, 1.99 + r, 0] }, f()), t.add(u, cyl(0.048, 0.048, 1.15, 10), { p: [0.645, 0.72, 0] }, 0.6), t.add(u, cyl(0.055, 0.055, 0.05, 10), { p: [0.645, 1.3, 0] }, 0.5), t.add("steel_bare", cyl(0.027, 0.027, 0.64 + r, 8, true), { p: [0.645, 1.31 + (0.64 + r) / 2, 0] }, 1), t.label("MAX 2500 kg", { color: "yellow", font: "stencil", distress: 0.3 }, 0.5, 0.05, { p: [U - 0.033, 0.42, 0], r: [0, -HALF_PI, 0] });
    for (let Q of [0.21, 0.245]) t.add("rubber", tube([[0.6, 1.25, Q], [0.59, 1.65 + r * 0.6, Q], [0.655, 1.86 + r, Q + 5e-3], [0.735, 1.6 + r * 1.2, Q], [0.74, 0.56 + o, Q]], 0.011, 5, false, 0.5), null, 1);
    t.push({ p: [0, o, 0] });
    let H = 0.06;
    for (let Q of [H + 0.12, H + 0.5]) t.add(u, bevelBox(0.04, 0.1, 1.02, 8e-3), { p: [0.755, Q, 0] }, f());
    t.add("hazard_stripes", box(3e-3, 0.06, 0.4), { p: [0.7765, H + 0.5, 0] }, 0.9);
    for (let Q of [1, -1]) t.add(u, bevelBox(0.03, 0.5, 0.06, 6e-3), { p: [0.745, H + 0.31, Q * 0.3] }, f()), t.add(u, bevelBox(0.11, 0.36, 0.022, 5e-3), { p: [0.685, H + 0.31, Q * 0.305] }, f()), t.add(u, bevelBox(0.03, 0.78, 0.04, 6e-3), { p: [0.755, H + 0.94, Q * 0.5] }, f()), t.add("steel_worn", cyl(0.04, 0.04, 0.03, 10), { p: [0.67, H + 0.2, Q * 0.325], r: [HALF_PI, 0, 0] }, 0.7);
    t.add(u, bevelBox(0.03, 0.04, 1.04, 6e-3), { p: [0.755, H + 1.33, 0] }, f()), t.add(u, bevelBox(0.02, 0.03, 1, 4e-3), { p: [0.755, H + 0.94, 0] }, f());
    for (let Q = -2; Q <= 2; Q++) t.add(u, bevelBox(0.02, 0.76, 0.02, 4e-3), { p: [0.755, H + 0.94, Q * 0.165] }, f());
    let N = 0.035;
    for (let Q of [1, -1]) {
      let W = extrude2DPoly([[0.777, N], [1.45, N], [1.7, N + 6e-3], [1.7, N + 0.016], [0.87, N + 0.046], [0.826, N + 0.075], [0.822, N + 0.62], [0.777, N + 0.62]], 0.1, { soft: 0.45 });
      t.add("steel_worn", W, { p: [0, 0, Q * 0.26] }, (J, G, te) => {
        let oe = clamp((J - 0.8) / 0.9, 0, 1), ee = noise3(J * 14, te * 30 + Q);
        return (0.5 + 0.5 * oe) * (0.8 + 0.2 * ee);
      }), t.add(u, bevelBox(0.075, 0.05, 0.112, 6e-3), { p: [0.772, H + 0.575, Q * 0.26] }, 0.55), t.add(u, bevelBox(0.03, 0.04, 0.112, 6e-3), { p: [0.79, H + 0.07, Q * 0.26] }, 0.55);
    }
    t.pop();
    let Z = Math.max(2.2, 0.06 + o + 1.36, 2.04 + r);
    return t.finish({ size: [3.4, Z, 1.25], colliders: [{ min: [-1.7, 0, -0.6], max: [0.58, 1.24, 0.6], surface: "metal" }, { min: [-1.56, 1.24, -0.4], max: [-1.22, 1.6, 0.4], surface: "metal" }, { min: [-0.88, 1.24, -0.24], max: [-0.7, 1.66, 0.24], surface: "rubber" }, { min: [0.56, 0, -0.42], max: [0.78, 2.04 + r, 0.42], surface: "metal" }, { min: [0.72, o, -0.53], max: [0.8, o + 1.42, 0.53], surface: "metal" }, { min: [0.8, o, -0.33], max: [1.7, o + 0.1, 0.33], surface: "metal" }, { min: [-1.02, 2, -0.5], max: [0.32, 2.1, 0.5], surface: "metal" }, ...z] });
  }

  function buildGenerator(mats, e) {
    let t = new PropBuilder(mats, "generator", e.seed || 0), i = t.rng, [s, o] = resolveColor(e.color, "yellow"), r = (g = 1) => typeof o == "number" ? o * g : o.map((E) => E * g), a = "steel_dark", l = 0.46, c = 1.03, u = 0.3, f = 1.16, h = (u + f) / 2;
    for (let g of [1, -1]) {
      t.add(a, bevelBox(2.2, 0.14, 0.1, 0.012), { p: [0, 0.07, g * 0.4] }, 0.6);
      for (let E of [-0.45, 0.45]) t.add(a, box(0.22, 0.075, 4e-3), { p: [E, 0.075, g * 0.451] }, 0.12);
    }
    for (let g of [-0.85, 0, 0.85]) t.add(a, box(0.1, 0.1, 0.72), { p: [g, 0.07, 0] }, 0.55);
    t.add(a, bevelBox(2.1, 0.17, 0.94, 0.012), { p: [0, 0.215, 0] }, 0.8), t.add(s, bevelBox(2.06, f - u, l * 2, 0.025), { p: [0, h, 0] }, r()), t.add(s, bevelBox(2.13, 0.045, 0.99, 0.014), { p: [0, f + 0.02, 0] }, r(0.9));
    for (let g of [-0.52, 0.52]) t.add(s, box(0.04, 0.012, 0.95), { p: [g, f + 0.046, 0] }, r(0.85));
    for (let g of [1, -1]) {
      let E = g > 0 ? 0 : Math.PI;
      [-0.66, 0, 0.66].forEach((M, _) => {
        t.add(s, bevelBox(0.62, 0.72, 0.012, 6e-3), { p: [M, h + 0.01, g * (l + 4e-3)] }, r(i.range(0.9, 1))), t.add(a, box(0.03, 0.11, 0.016), { p: [M + 0.27, h, g * (l + 0.012)] }, 0.6), t.add("steel_galv", box(0.012, 0.03, 6e-3), { p: [M + 0.27, h + 0.03, g * (l + 0.022)] }, 0.8);
        for (let T of [-0.25, 0.25]) t.add("steel_galv", cyl(9e-3, 9e-3, 0.06, 5, true), { p: [M - 0.305, h + T, g * (l + 0.012)] }, 0.7);
        if (_ > 0) {
          let T = _ === 2 ? 8 : 5, w = 0.42, S = _ === 2 ? h + 0.14 : h - 0.16;
          t.add(a, box(w, T * 0.05, 4e-3), { p: [M - 0.03, S, g * (l + 0.0105)] }, 0.12);
          for (let R = 0; R < T; R++) t.add(s, box(w, 0.04, 5e-3), { p: [M - 0.03, S + (R - (T - 1) / 2) * 0.05, g * (l + 0.018)], r: [g * 0.6, 0, 0] }, r(0.82));
          _ === 2 && t.decal(mats.decal("rust_run"), 0.3, { p: [M - 0.03, S - 0.36, g * (l + 0.011)], r: [0, E, 0] });
        }
      }), t.label(e.label || "GEN-0" + (1 + t.seed % 2), { color: "black", font: "stencil", distress: 0.35 }, 0.5, 0.13, { p: [-0.66 * g, h + 0.17, g * (l + 0.0108)], r: [0, E, 0] }), t.decal(mats.decal("hazard_voltage"), 0.15, { p: [-0.66 * g - g * 0.18, h - 0.17, g * (l + 0.0108)], r: [0, E, 0] });
    }
    t.add(a, box(4e-3, 0.66, 0.74), { p: [c + 1e-3, h, 0] }, 0.1);
    for (let g = 0; g < 11; g++) t.add(s, box(6e-3, 0.046, 0.74), { p: [c + 0.012, h - 0.3 + g * 0.06, 0], r: [0, 0, -0.6] }, r(0.8));
    for (let g of [1, -1]) t.add(s, box(0.03, 0.72, 0.03), { p: [c + 0.012, h, g * 0.385] }, r(0.9)), t.add(s, box(0.03, 0.03, 0.8), { p: [c + 0.012, h + g * 0.345, 0] }, r(0.9));
    let p = -c - 4e-3, d = 0.14;
    t.add(a, bevelBox(0.01, 0.44, 0.52, 4e-3), { p: [p, 0.87, d] }, 0.45), t.add(s, bevelBox(0.075, 0.014, 0.56, 4e-3), { p: [p - 0.03, 1.1, d], r: [0, 0, 0.12] }, r(0.9));
    for (let g of [1, -1]) t.add(s, box(0.06, 0.44, 0.012), { p: [p - 0.025, 0.87, d + g * 0.268] }, r(0.9));
    let m = p - 55e-4, x = [0, -HALF_PI, 0];
    t.add(mats.emissive(8840104, 0.32), plane(0.13, 0.07), { p: [m - 1e-3, 0.99, d - 0.12], r: x }, 1, { raw: true, cast: false }), t.add(a, bevelBox(8e-3, 0.09, 0.15, 3e-3), { p: [m + 3e-3, 0.99, d - 0.12] }, 0.3), t.add("steel_galv", cyl(0.02, 0.02, 0.012, 10), { p: [m - 4e-3, 1, d + 0.19], r: [0, 0, HALF_PI] }, 0.7), t.add(mats.emissive(4063082, 3.2), cyl(0.013, 0.013, 0.014, 10), { p: [m - 9e-3, 1, d + 0.19], r: [0, 0, HALF_PI] }, 1, { raw: true }), t.add(s, cyl(0.042, 0.042, 6e-3, 12), { p: [m - 3e-3, 0.8, d + 0.17], r: [0, 0, HALF_PI] }, 1), t.add("plastic_red", lathe([[0, 0], [0.018, 0], [0.018, 0.018], [0.03, 0.02], [0.03, 0.034], [0.02, 0.042], [0, 0.044]], 10), { p: [m - 4e-3, 0.8, d + 0.17], r: [0, 0, HALF_PI] }, 0.95);
    for (let g = 0; g < 3; g++) {
      let E = d - 0.2 + g * 0.105;
      t.add("aluminium", cyl(0.04, 0.042, 0.012, 10), { p: [m - 4e-3, 0.86, E], r: [0, 0, HALF_PI] }, 0.8), t.add("aluminium", cyl(0.034, 0.034, 2e-3, 10), { p: [m - 0.0105, 0.86, E], r: [0, 0, HALF_PI] }, 1), t.add(a, box(2e-3, 0.028, 4e-3), { p: [m - 0.0125, 0.868, E + 5e-3], r: [i.range(-1, 1), 0, 0] }, 0.3);
    }
    for (let g = 0; g < 5; g++) t.add(g === 0 ? "plastic_red" : a, box(0.014, 0.04, 0.022), { p: [m - 6e-3, 0.74, d - 0.2 + g * 0.03], r: [0, 0, i() < 0.5 ? 0.25 : -0.25] }, 0.8);
    t.decal(mats.decal("hazard_voltage"), 0.13, { p: [-c - 2e-3, 0.95, -0.28], r: x }), t.label("DANGER", { color: "red", font: "stencil", distress: 0.3 }, 0.22, 0.05, { p: [-c - 2e-3, 0.82, -0.28], r: x });
    let v = [["plastic_red", 0.02], ["plastic_blue", 0.2], ["plastic_blue", -0.25]];
    for (let [g, E] of v) t.add(a, bevelBox(0.02, 0.12, 0.1, 6e-3), { p: [-c - 8e-3, 0.5, E] }, 0.4), t.add(g, tubeSpan([-c - 0.01, 0.5, E], [-c - 0.06, 0.47, E], 0.036, 10, true), null, 0.9);
    t.add("plastic_blue", tubeSpan([-c - 0.06, 0.47, 0.2], [-c - 0.068, 0.39, 0.2], 0.03, 8, true, 0.02), null, 0.85), t.add("rubber", tube([[-c - 0.066, 0.4, 0.2], [-c - 0.064, 0.25, 0.21], [-c - 0.05, 0.06, 0.26], [-c + 0.05, 0.016, 0.4], [-c + 0.3, 0.016, 0.478], [-0.35, 0.016, 0.486]], 0.014, 5, false, 0.5), null, 1);
    let y = f + 0.0425;
    t.add(a, bevelBox(0.2, 0.012, 0.14, 4e-3), { p: [0, y + 4e-3, 0] }, 0.6), t.add("steel_galv", scaledTorus(0.045, 0.014, 5, 10), { p: [0, y + 0.058, 0] }, 0.7);
    let b = [0.72, y, 0.24];
    return t.add("steel_rust", cyl(0.062, 0.066, 0.025, 12), { p: [b[0], y + 0.012, b[2]] }, 0.6), t.add("steel_rust", cyl(0.04, 0.04, 0.17, 12, true), { p: [b[0], y + 0.085, b[2]] }, (g, E) => 0.45 + 0.55 * clamp((y + 0.17 - E) / 0.17, 0, 1)), t.add("steel_rust", cyl(0.034, 0.034, 2e-3, 10), { p: [b[0], y + 0.15, b[2]] }, 0.08), t.add("steel_rust", cyl(0.046, 0.046, 5e-3, 12), { p: [b[0] - 0.012, y + 0.186, b[2]], r: [0, 0, 0.5] }, 0.6), t.decal(mats.decal("scorch"), 0.3, { p: [b[0], y + 1e-3, b[2]], r: [-HALF_PI, 0, 0] }), t.add(a, tubeSpan([-0.72, 0.25, 0.46], [-0.72, 0.32, 0.5], 0.03, 8, true), null, 0.6), t.add("plastic_red", tubeSpan([-0.72, 0.32, 0.5], [-0.72, 0.338, 0.51], 0.037, 10, true), null, 0.9), t.decal(mats.decal("hazard_flammable"), 0.11, { p: [-0.52, 0.215, 0.4712] }), t.label("DIESEL", { color: "white", font: "stencil", distress: 0.4 }, 0.2, 0.05, { p: [-0.34, 0.215, 0.4712] }), t.finish({ colliders: [{ min: [-1.1, 0, -0.5], max: [1.1, 1.21, 0.5], surface: "metal" }] });
  }

  function buildDumpster(mats, e) {
    let t = new PropBuilder(mats, "dumpster", e.seed || 0), i = t.rng, [s, o] = resolveColor(e.color, "green"), r = (_ = 1) => typeof o == "number" ? o * _ : o.map((T) => T * _), a = 0.89, l = 0.2, c = 1.12, u = 0.3, f = 0.5, h = -0.44, p = -0.5, d = 0.022, m = [[-f, c], [-u, l], [-h, l], [-p, c], [-p - d, c], [-h - d * 0.8, l + d], [-u + d * 0.8, l + d], [-f + d, c]], x = t.seed * 2.3;
    t.add(s, extrude2DPoly(m, a * 2, { soft: 0 }), { r: [0, HALF_PI, 0] }, (_, T, w) => {
      let S = Math.abs(w) < 0.4 && T > l + 0.01 && T < c - 0.01 && Math.abs(_) < a - 0.01;
      return r(0.9 + 0.1 * noise3(_ * 3 + x, T * 3));
    });
    for (let _ of [1, -1]) {
      t.add(s, extrude2DPoly([[-f, c], [-u, l], [-h, l], [-p, c]], d, { soft: 0 }), { p: [_ * (a - d / 2), 0, 0], r: [0, HALF_PI, 0] }, r(0.95)), t.add(s, bevelBox(0.05, 0.045, f - p + 0.04, 8e-3), { p: [_ * a, c, 0] }, r(0.9));
      for (let T of [-0.22, 0.14]) t.add(s, bevelBox(0.03, 0.84, 0.05, 6e-3), { p: [_ * (a + 0.012), 0.66, T] }, r(0.9));
      t.add(s, bevelBox(0.035, 0.1, 0.84, 8e-3), { p: [_ * (a + 0.014), 0.93, 0] }, r(0.85)), t.add("steel_worn", tubeSpan([_ * (a + 0.01), 0.93, 0.3], [_ * (a + 0.065), 0.93, 0.3], 0.03, 10, true), null, 0.7), t.add("steel_worn", cyl(0.042, 0.042, 8e-3, 10), { p: [_ * (a + 0.064), 0.93, 0.3], r: [0, 0, HALF_PI] }, 0.6);
    }
    t.add(s, bevelBox(a * 2 + 0.04, 0.045, 0.05, 8e-3), { p: [0, c, f] }, r(0.9)), t.add(s, bevelBox(a * 2 + 0.04, 0.045, 0.05, 8e-3), { p: [0, c, p] }, r(0.9));
    let v = Math.atan2(f - u, c - l), y = Math.atan2(p - h, c - l);
    for (let _ of [-0.6, -0.2, 0.2, 0.6]) t.add(s, boxSpan([_, l + 0.03, u + 0.022], [_, c - 0.04, f + 0.012], 0.055, 0.03, 6e-3), null, r(0.9)), t.add(s, boxSpan([_, l + 0.03, h - 0.016], [_, c - 0.04, p - 0.012], 0.055, 0.03, 6e-3), null, r(0.9));
    t.add(s, boxSpan([-a, l + 0.5, u + 0.022 + 0.5 * (f - u) / (c - l)], [a, l + 0.5, u + 0.022 + 0.5 * (f - u) / (c - l)], 0.03, 0.06, 6e-3), { r: [0, 0, 0] }, r(0.88));
    let b = (_) => u + (_ - l) * (f - u) / (c - l) + 3e-3;
    t.label(e.label || "B4 WASTE " + (11 + t.seed % 2), { color: "white", font: "stencil", distress: 0.5 }, 0.36, 0.09, { p: [-0.4, 0.93, b(0.93)], r: [-v, 0, 0] }), t.decal(mats.decal("grime_streak"), 0.36, { p: [0.4, 0.82, b(0.82)], r: [-v, 0, 0] }), t.decal(mats.decal("rust_run"), 0.3, { p: [0, 0.5, b(0.5)], r: [-v, 0, 0] }), t.decal(mats.decal("logo_c"), 0.26, { p: [0.4, 0.42, b(0.42)], r: [-v, 0, 0] }), t.decal(mats.decal("leak_stain"), 0.34, { p: [-0.4, 0.45, b(0.45)], r: [-v, 0, 0] });
    let g = c + 0.045, E = p - 0.02;
    t.add("steel_galv", tubeSpan([-a - 0.02, g, E], [a + 0.02, g, E], 0.013, 6, true), null, 0.7);
    let M = (_, T) => {
      t.push({ p: [_, g, E], r: [T, 0, 0] });
      let w = 1.07, S = segBox(0.885, 0.04, w, 0.016, 3, 3, 4);
      deformGeo(S, (z) => {
        z.y > 0 && (z.y += 0.018 * Math.cos(z.z / w * Math.PI) * Math.cos(z.x / 0.885 * Math.PI));
      }), S.computeVertexNormals();
      let R = i.range(0.75, 0.95);
      t.add("plastic_grey", S, { p: [0, 5e-3, w / 2] }, R);
      for (let z of [-0.26, 0.26]) t.add("plastic_grey", bevelBox(0.07, 0.016, w - 0.16, 6e-3), { p: [z, 0.036, w / 2] }, R * 0.9);
      t.add("plastic_grey", bevelBox(0.3, 0.035, 0.05, 0.01), { p: [0, 0.02, w + 0.01] }, R * 0.8);
      for (let z of [-0.3, 0.3]) t.add("plastic_grey", bevelBox(0.08, 0.03, 0.09, 8e-3), { p: [z, 5e-3, 0.03] }, R * 0.8);
      t.pop();
    };
    M(-0.45, 0), M(0.45, HALF_PI + 0.07 + i.range(0, 0.05));
    for (let [_, T, w, S] of [[0.45, 0.93, 0.05, 1], [0.66, 0.9, -0.24, 0.8], [0.22, 0.86, -0.2, 0.85]]) {
      let R = segBox(0.46 * S, 0.4 * S, 0.42 * S, 0.17 * S, 3, 3, 3), z = i() * 20;
      deformGeo(R, (I) => {
        let L = noise3(I.x * 9 + z, I.y * 9, I.z * 9) - 0.5;
        I.x += L * 0.06, I.z += L * 0.06, I.y += L * 0.04;
      }), t.add("polymer_black", recomputeSmoothNormals(R), { p: [_, T, w], r: [i() * 0.5, i() * 6, 0] }, 0.8);
    }
    t.add("cardboard", strapRibbon([[0.2, 0.9, 0.2], [0.24, 1.14, 0.26], [0.3, 1.2, 0.33]], [0.16, 0, -0.05]), null, 0.7);
    for (let _ of [-0.7, 0.7]) for (let T of [-0.3, 0.17]) {
      t.push({ p: [_, 0, T], r: [0, i() * 6, 0] }), t.add("steel_galv", bevelBox(0.13, 0.012, 0.11, 3e-3), { p: [0, 0.194, 0] }, 0.7);
      for (let w of [1, -1]) t.add("steel_galv", boxSpan([0, 0.19, w * 0.034], [0.035, 0.08, w * 0.034], 0.05, 6e-3, 0, true), null, 0.65);
      t.add("rubber", cyl(0.08, 0.08, 0.045, 14), { p: [0.035, 0.08, 0], r: [HALF_PI, 0, 0] }, 0.9), t.add("steel_galv", cyl(0.035, 0.035, 0.05, 8), { p: [0.035, 0.08, 0], r: [HALF_PI, 0, 0] }, 0.6), t.pop();
    }
    return t.finish({ colliders: [{ min: [-0.95, 0.05, -0.56], max: [0.95, 1.2, 0.55], surface: "metal" }] });
  }

  function buildToolboxCart(mats, e) {
    let t = new PropBuilder(mats, "toolbox_cart", e.seed || 0), i = t.rng, [s, o] = resolveColor(e.color, "red"), r = (y = 1) => typeof o == "number" ? o * y : o.map((b) => b * y), a = 0.04, l = 0.74, c = 0.125, u = 0.785, f = 0.23;
    t.add(s, bevelBox(l, u - c, f * 2, 0.012), { p: [a, (c + u) / 2, 0] }, r()), t.add("steel_dark", bevelBox(l + 0.01, 0.02, f * 2 + 0.01, 6e-3), { p: [a, c + 4e-3, 0] }, 0.5);
    let h = [0.075, 0.075, 0.1, 0.13, 0.19], p = 1 + t.seed % 3, d = u - 0.03;
    h.forEach((y, b) => {
      let g = b === p ? 0.05 : i() < 0.3 ? 4e-3 : 0, E = d - y / 2;
      if (t.add(s, bevelBox(l - 0.05, y - 0.01, 0.014, 4e-3), { p: [a, E, f + 5e-3 + g] }, r(i.range(0.9, 1))), t.add("aluminium", bevelBox(l - 0.09, 0.016, 0.016, 4e-3), { p: [a, E + y / 2 - 0.02, f + 0.019 + g] }, 0.85), g > 0.01) {
        t.add("steel_dark", box(l - 0.07, y - 0.02, g), { p: [a, E, f + g / 2] }, 0.4), t.add("polymer_black", box(l - 0.08, 4e-3, g), { p: [a, E + y / 2 - 0.012, f + g / 2] }, 0.3);
        for (let M = 0; M < 4; M++) t.add("steel_bare", tubeSpan([a - 0.25 + M * 0.15, E + y / 2 - 0.016, f + 8e-3], [a - 0.23 + M * 0.15, E + y / 2 - 0.014, f + g - 0.012], 7e-3, 5, true), null, 0.8);
      }
      d -= y;
    }), t.add("steel_bare", cyl(0.011, 0.011, 8e-3, 8), { p: [a + l / 2 - 0.06, u - 0.016, f + 4e-3], r: [HALF_PI, 0, 0] }, 0.8), t.add("rubber", box(l - 0.04, 6e-3, f * 2 - 0.04), { p: [a, u + 3e-3, 0] }, 0.9), t.add(s, bevelBox(l, 0.03, 0.014, 4e-3), { p: [a, u + 0.013, -f + 7e-3] }, r(0.95));
    for (let y of [1, -1]) t.add(s, bevelBox(0.014, 0.03, f * 2, 4e-3), { p: [a + y * (l / 2 - 7e-3), u + 0.013, 0] }, r(0.95));
    t.add("aluminium", tube([[a - l / 2, 0.56, -0.17], [-0.41, 0.6, -0.17], [-0.435, 0.73, -0.17], [-0.435, 0.73, 0.17], [-0.41, 0.6, 0.17], [a - l / 2, 0.56, 0.17]], 0.012, 6, false, 0.2), null, 0.85);
    for (let y of [1, -1]) for (let b of [1, -1]) {
      t.push({ p: [a + y * (l / 2 - 0.07), 0, b * (f - 0.06)], r: [0, y > 0 ? i() * 6 : 0, 0] }), t.add("steel_galv", bevelBox(0.08, 8e-3, 0.07, 2e-3), { p: [0, 0.119, 0] }, 0.7);
      for (let g of [1, -1]) t.add("steel_galv", boxSpan([0, 0.117, g * 0.022], [0.02, 0.05, g * 0.022], 0.035, 4e-3, 0, true), null, 0.65);
      t.add("rubber", cyl(0.05, 0.05, 0.03, 12), { p: [0.02, 0.05, 0], r: [HALF_PI, 0, 0] }, 0.9), t.add("steel_galv", cyl(0.02, 0.02, 0.034, 6), { p: [0.02, 0.05, 0], r: [HALF_PI, 0, 0] }, 0.6), t.pop();
    }
    t.label(e.label || "MAINT " + (1 + t.seed % 2), { color: "white", font: "stencil", distress: 0.4 }, 0.3, 0.07, { p: [a + l / 2 + 2e-3, 0.6, 0], r: [0, HALF_PI, 0] }), t.decal(mats.decal("logo_d"), 0.2, { p: [a + l / 2 + 2e-3, 0.42, 0], r: [0, HALF_PI, 0] }), t.decal(mats.decal("grime_streak"), 0.3, { p: [a, 0.45, -f - 2e-3], r: [0, Math.PI, 0] });
    let m = u + 6e-3;
    t.push({ p: [a - 0.18, m, 0.08], r: [0, 0.5, 0] }), t.add("steel_bare", bevelBox(0.2, 6e-3, 0.02, 2e-3), { p: [0, 4e-3, 0] }, 0.9), t.add("steel_bare", scaledTorus(0.016, 6e-3, 4, 10), { p: [0.11, 5e-3, 0], r: [HALF_PI, 0, 0] }, 0.9), t.add("steel_bare", scaledTorus(0.017, 6e-3, 4, 7, Math.PI * 1.4), { p: [-0.112, 5e-3, 0], r: [HALF_PI, 0, 2.2] }, 0.9), t.pop(), t.push({ p: [a + 0.02, m, -0.1], r: [0, -0.3, 0] }), t.add("wood_pallet", tubeSpan([-0.14, 0.014, 0], [0.12, 0.016, 0], 0.012, 6, true, 0.01), null, 0.9), t.add("steel_dark", bevelBox(0.032, 0.03, 0.1, 6e-3), { p: [0.125, 0.017, 5e-3] }, 0.8), t.pop(), t.push({ p: [a + 0.2, m, 0.1], r: [0, 0.12, 0] }), t.add("polymer_black", bevelBox(0.22, 0.014, 0.05, 4e-3), { p: [0, 7e-3, 0] }, 0.6);
    for (let y = 0; y < 6; y++) t.add("steel_bare", cyl(8e-3 + y * 14e-4, 8e-3 + y * 14e-4, 0.03, 8), { p: [-0.085 + y * 0.034, 0.029, 0] }, 0.9);
    t.pop(), t.add("plastic_blue", cyl(0.032, 0.032, 0.13, 12), { p: [a + 0.28, m + 0.065, -0.12] }, 0.9), t.add("steel_bare", lathe([[0.032, 0], [0.028, 0.012], [0.014, 0.018], [0.014, 0.018], [0.014, 0.03], [0, 0.03]], 10), { p: [a + 0.28, m + 0.13, -0.12] }, 0.9), t.add("plastic_red", cyl(0.012, 0.012, 0.014, 8), { p: [a + 0.28, m + 0.165, -0.12] }, 0.95), t.add("paint_yellow", tubeSpan([a - 0.3, m + 0.012, -0.13], [a - 0.2, m + 0.012, -0.16], 0.014, 7, true), null, 0.9), t.add("steel_bare", tubeSpan([a - 0.2, m + 0.012, -0.16], [a - 0.08, m + 0.01, -0.196], 4e-3, 5, true), null, 0.9);
    let x = segBox(0.2, 0.02, 0.15, 9e-3, 4, 3, 4), v = i() * 9;
    return deformGeo(x, (y) => {
      y.y += 0.012 * noise3(y.x * 30 + v, y.z * 30) * (y.y > 0 ? 1 : 0), y.x += 0.012 * (noise3(y.z * 20, v) - 0.5);
    }), t.add(t.mat("glove_fabric", { color: 8203044 }), recomputeSmoothNormals(x), { p: [a - 0.26, m + 0.01, 0.12], r: [0, 0.8, 0] }, 0.9), t.finish();
  }


// ---------------------------------------------------------------------------
// 导出：每个道具一个 createX(opts) + 统一注册表
export const PROP_NAMES = ['barrel', 'pallet', 'pallet_stack', 'crate_wood', 'crate_stack', 'ibc_tote', 'cable_reel', 'tire_stack', 'jerry_can', 'traffic_cone', 'gas_cylinders', 'pipe_stack', 'tarp_cargo', 'sandbags', 'cardboard_boxes', 'forklift', 'generator', 'dumpster', 'toolbox_cart'];

export function createBarrel(opts = {}) {
  return buildBarrel(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createPallet(opts = {}) {
  return buildPallet(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createPalletStack(opts = {}) {
  return buildPalletStack(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createCrateWood(opts = {}) {
  return buildCrateWood(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createCrateStack(opts = {}) {
  return buildCrateStack(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createIbcTote(opts = {}) {
  return buildIbcTote(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createCableReel(opts = {}) {
  return buildCableReel(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createTireStack(opts = {}) {
  return buildTireStack(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createJerryCan(opts = {}) {
  return buildJerryCan(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createTrafficCone(opts = {}) {
  return buildTrafficCone(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createGasCylinders(opts = {}) {
  return buildGasCylinders(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createPipeStack(opts = {}) {
  return buildPipeStack(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createTarpCargo(opts = {}) {
  return buildTarpCargo(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createSandbags(opts = {}) {
  return buildSandbags(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createCardboardBoxes(opts = {}) {
  return buildCardboardBoxes(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createForklift(opts = {}) {
  return buildForklift(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createGenerator(opts = {}) {
  return buildGenerator(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createDumpster(opts = {}) {
  return buildDumpster(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

export function createToolboxCart(opts = {}) {
  return buildToolboxCart(opts.materials || defaultMaterials, opts, opts.seed || 0);
}

const PROP_FACTORIES = new Map([
  ['barrel', createBarrel],
  ['pallet', createPallet],
  ['pallet_stack', createPalletStack],
  ['crate_wood', createCrateWood],
  ['crate_stack', createCrateStack],
  ['ibc_tote', createIbcTote],
  ['cable_reel', createCableReel],
  ['tire_stack', createTireStack],
  ['jerry_can', createJerryCan],
  ['traffic_cone', createTrafficCone],
  ['gas_cylinders', createGasCylinders],
  ['pipe_stack', createPipeStack],
  ['tarp_cargo', createTarpCargo],
  ['sandbags', createSandbags],
  ['cardboard_boxes', createCardboardBoxes],
  ['forklift', createForklift],
  ['generator', createGenerator],
  ['dumpster', createDumpster],
  ['toolbox_cart', createToolboxCart],
]);

export function createProp(name, opts = {}) {
  const f = PROP_FACTORIES.get(name);
  if (!f) throw new Error(`[yardkit] unknown prop ${name}`);
  return f(opts);
}
