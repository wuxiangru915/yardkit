import * as THREE from 'three';
import {
  box, cyl, lathe, plane, mergeGeos, clamp, smoothstep, createRng,
} from './geo.js';
import {
  mixRgb, noise2, roundedCornerPlate, sweepProfile, PartBuilder,
} from './propUtils.js';
import {
  placeGeo, placeMatrix, scaledPlane, sphereSlice,
} from './propKit.js';
import { defaultMaterials } from './materials.js';

const SIGN_DECALS = ['hazard_general', 'no_entry', 'hazard_voltage', 'berth4', 'arrow', 'hazard_flammable'];
const SIGN_TEXTS = ['AUTHORISED PERSONNEL ONLY', 'NO PEDESTRIANS', 'HI-VIS AND HELMET', 'AUTOMATED VEHICLES', 'KEEP CLEAR'];
const LAMP_WARM = new THREE.Color(16752680), LAMP_AMBER = new THREE.Color(16721940), LAMP_RED = new THREE.Color(16767392);
import { PROP_SPECS, propSize, labelFor, decalFor, finalizeProp } from './propspec.js';

  function warningPanel(builder, e, t, i, s, o, r, a, l) {
    builder.push(placeMatrix(s, o, r, [0, a, 0])), builder.push(placeMatrix(0, 0, 0, [0, 0, l])), builder.box(t, 0.1, 0.34, 0.46, 0.09, 0, 0, { r: 0.014 }), builder.add(i, placeGeo(plane(0.4, 0.28), 0.1415, 0, 0, [0, Math.PI / 2, 0]), null, true), builder.box(t, 0.012, 0.018, 0.47, 0.146, 0.156, 0, { r: 0 }), builder.box(t, 0.012, 0.018, 0.47, 0.146, -0.156, 0, { r: 0 }), builder.box(t, 0.012, 0.33, 0.018, 0.146, 0, 0.222, { r: 0 }), builder.box(t, 0.012, 0.33, 0.018, 0.146, 0, -0.222, { r: 0 }), builder.box(t, 0.09, 8e-3, 0.48, 0.17, 0.175, 0, { r: 0, rot: [0, 0, -0.12] });
    for (let c = -3; c <= 3; c++) builder.add(t, placeGeo(box(0.045, 0.3, 8e-3), 0.02, 0, c * 0.062));
    builder.pop(), builder.box(e, 0.03, 0.05, 0.56, 0.02, -0.02, 0, { r: 4e-3 });
    for (let c of [-1, 1]) builder.box(e, 0.1, 0.05, 0.012, 0.05, -0.02, c * 0.275, { r: 0, rot: [0, 0, l * 0.5] });
    builder.pop();
  }

  function shelfFrame(builder, e, t, i, s) {
    for (let o = -2; o <= 2; o++) builder.add(e, placeGeo(box(0.14 + (o === 0 ? 0.02 : 0), 0.022, 1), t + o * 0.2525, i + 0.133, s));
    for (let o of [-1, 0, 1]) builder.add(e, placeGeo(box(1.15, 0.022, 0.1), t, i + 0.111, s + o * 0.45));
    for (let o of [-1, 0, 1]) for (let r of [-1, 0, 1]) builder.add(e, placeGeo(box(0.14, 0.078, 0.1), t + r * 0.505, i + 0.061, s + o * 0.45));
    for (let o of [-1, 0, 1]) builder.add(e, placeGeo(box(1.15, 0.022, 0.1), t, i + 0.011, s + o * 0.45));
  }

  function shelfLoad(builder, e, t, i, s, o, r) {
    shelfFrame(builder, e.wood, i, s, o);
    let a = s + 0.144;
    if (t === "cartons") {
      let l = 2 + Math.floor(r() * 2), c = 0.36;
      for (let u = 0; u < l; u++) for (let f of [-1, 1]) for (let h of [-1, 1]) u === l - 1 && r() < 0.25 || (builder.box(e.card, 0.53, c - 6e-3, 0.46, i + f * 0.272 + (r() - 0.5) * 0.02, a + c * (u + 0.5), o + h * 0.237 + (r() - 0.5) * 0.02, { r: 8e-3, rot: [0, (r() - 0.5) * 0.05, 0] }), builder.add(e.tape, placeGeo(box(0.535, 2e-3, 0.05), i + f * 0.272, a + c * (u + 1) - 4e-3, o + h * 0.237)));
      for (let u of [-0.3, 0.3]) builder.add(e.poly, placeGeo(box(0.016, l * c + 4e-3, 2e-3), i + u, a + l * c / 2, o + 0.475)), builder.add(e.poly, placeGeo(box(0.016, l * c + 4e-3, 2e-3), i + u, a + l * c / 2, o - 0.475));
    } else if (t === "wrapped") {
      let l = 0.9 + r() * 0.25;
      builder.box(e.card, 1.08, l, 0.92, i, a + l / 2, o, { r: 0.012 }), builder.box(e.wrap, 1.1, l + 0.012, 0.94, i, a + l / 2 + 2e-3, o, { r: 0.03 });
      for (let c of [-1, 1]) for (let u of [-1, 1]) builder.box(e.card, 0.05, l * 0.96, 0.05, i + c * 0.535, a + l / 2, o + u * 0.455, { r: 4e-3 });
      builder.decal(labelFor(builder, "LOT " + (1e3 + Math.floor(r() * 8999)), { color: "black", font: "sans", distress: 0.1 }), 0.06, i + 0.2, a + l * 0.7, o + 0.474, null, 0.3);
    } else if (t === "drums") {
      for (let l of [-1, 1]) for (let c of [-1, 1]) {
        let u = i + l * 0.285, f = o + c * 0.24, h = r() < 0.3 ? e.drum2 : e.drum;
        builder.cyl(h, 0.225, 0.225, 0.86, u, a + 0.43, f, { seg: 14, open: true });
        for (let p of [0.29, 0.58]) builder.cyl(h, 0.233, 0.233, 0.022, u, a + p, f, { seg: 14, open: true });
        builder.cyl(h, 0.232, 0.232, 0.02, u, a + 0.85, f, { seg: 14, open: true }), builder.cyl(h, 0.232, 0.232, 0.02, u, a + 0.01, f, { seg: 14, open: true }), builder.add(e.dark, placeGeo(roundedCornerPlate(0.44, 0.44, 4), u, a + 0.845, f, [-Math.PI / 2, 0, 0])), builder.cyl(e.dark, 0.03, 0.03, 0.02, u + 0.13, a + 0.855, f, { seg: 6 });
      }
      builder.add(e.poly, placeGeo(box(1.04, 0.03, 2e-3), i, a + 0.6, o + 0.468)), builder.add(e.poly, placeGeo(box(1.04, 0.03, 2e-3), i, a + 0.6, o - 0.468));
    } else if (t === "pallets") {
      let l = 2 + Math.floor(r() * 4);
      for (let c = 0; c < l; c++) shelfFrame(builder, e.wood, i + (r() - 0.5) * 0.04, a + c * 0.146, o + (r() - 0.5) * 0.04);
    }
  }

  function buildJerseyBarrier(mats, e = {}) {
    let t = new PartBuilder(mats), i = e.seed | 0, s = createRng(i + 11), o = i * 3.7, r = t.M("concrete", { vertexColors: true }), a = [[-0.3, 0], [0.3, 0], [0.3, 0.076], [0.127, 0.33], [0.1, 0.57], [0.077, 0.79], [0.06, 0.81], [-0.06, 0.81], [-0.077, 0.79], [-0.1, 0.57], [-0.127, 0.33], [-0.3, 0.076]], l = [-1.5, -1.47];
    for (let h = -1.25; h <= 1.26; h += 0.25) l.push(h);
    l.push(1.47, 1.5);
    let c = [];
    for (let h = 0; h < 7; h++) c.push([(s() * 2 - 1) * 1.5, s() * 0.8, 0.08 + s() * 0.14, s() < 0.5 ? 1 : -1]);
    let u = sweepProfile(a, l, (h, p, d) => {
      let m = Math.abs(d) > 1.49 ? 1 : 0;
      return [d, p - m * 0.022 * (p / 0.81), h * (1 - m * 0.09)];
    }, { closed: true, caps: true });
    t.add(r, u, (h, p, d) => {
      let m = 0.86 + 0.2 * noise2(h * 1.3 + o, p * 3 + d * 2) + 0.08 * noise2(h * 7, p * 9 + o), x = [m, m * 0.99, m * 0.97];
      x = mixRgb(x, [m * 0.5, m * 0.48, m * 0.44], smoothstep(0.3, 0, p) * 0.8);
      let v = smoothstep(0.55, 0.8, noise2(h * 4.5 + o, 3.3)) * smoothstep(0.25, 0.8, p);
      x = mixRgb(x, [m * 0.62, m * 0.6, m * 0.56], v * 0.6);
      let y = smoothstep(0.6, 0.85, noise2(h * 2.1 + o * 2, d * 3)) * smoothstep(0.2, 0.33, p) * smoothstep(0.62, 0.4, p);
      x = mixRgb(x, [0.22, 0.22, 0.22], y * 0.65);
      for (let b of c) if (Math.sign(d || 1) === b[3]) {
        let g = Math.hypot(h - b[0], p - b[1]) / b[2];
        g < 1 && (x = mixRgb(x, [1.12, 1.1, 1.05], (1 - g) * 0.7));
      }
      return Math.abs(h) > 1.4 && (x = mixRgb(x, [1.08, 1.06, 1.02], 0.4 * noise2(p * 9, d * 9 + o))), x;
    });
    let f = [0.05, 0.05, 0.05];
    for (let h of [-1, 1]) for (let p of [-0.85, 0.85]) t.add(r, placeGeo(plane(0.3, 0.058), p, 0.03, h * 0.3008, [0, h > 0 ? 0 : Math.PI, 0]), f), t.box(r, 0.34, 0.012, 0.012, p, 0.064, h * 0.3, { r: 3e-3, col: [0.7, 0.7, 0.68] });
    for (let h of [-0.9, 0.9]) t.tube(t.M("steel_rust"), [[h - 0.05, 0.8, 0], [h - 0.04, 0.85, 0], [h + 0.04, 0.85, 0], [h + 0.05, 0.8, 0]], 8e-3, { seg: 5 });
    if (e.stripe) {
      let h = t.M("hazard_stripes");
      t.add(h, placeGeo(scaledPlane(2.9, 0.118), 0, 0.8125, 0, [-Math.PI / 2, 0, 0]));
      for (let p of [-1, 1]) t.add(h, placeGeo(scaledPlane(2.9, 0.2), 0, 0.68, p * 0.0905, [p > 0 ? -0.108 : 0.108, p > 0 ? 0 : Math.PI, 0]));
    }
    return finalizeProp(t.toGroup(), "jersey_barrier", propSize("jersey_barrier"), [{ min: [-1.5, 0, -0.3], max: [1.5, 0.33, 0.3], surface: "concrete" }, { min: [-1.5, 0.33, -0.13], max: [1.5, 0.81, 0.13], surface: "concrete" }]);
  }

  function buildLightMast(mats, e = {}) {
    let t = new PartBuilder(mats), i = t.M("steel_galv"), s = t.M("concrete", { vertexColors: true }), o = t.M("steel_dark"), r = mats.emissive(16769981, e.on === false ? 0.02 : 8);
    t.box(s, 0.8, 0.32, 0.8, 0, 0.16, 0, { r: 0.03, col: (v, y, b) => {
      let g = 0.62 + 0.36 * smoothstep(0, 0.3, y) + 0.1 * noise2(v * 5, b * 5);
      return [g, g, g * 0.97];
    } }), t.box(i, 0.5, 0.03, 0.5, 0, 0.335, 0, { r: 6e-3 });
    for (let v = 0; v < 8; v++) {
      let y = (v + 0.5) * Math.PI / 4, b = Math.cos(y) * 0.215, g = Math.sin(y) * 0.215;
      t.cyl(i, 0.014, 0.014, 0.1, b, 0.38, g, { seg: 6 }), t.cyl(i, 0.027, 0.027, 0.024, b, 0.362, g, { seg: 6, flat: true });
    }
    let a = 0.35, l = 13.3, c = 0.168, u = 0.07, f = (v) => c + (u - c) * (v - a) / (l - a), h = [[a, 4.75, 0], [4.6, 9.15, 7e-3], [9, l, 0.014]];
    for (let [v, y, b] of h) t.cyl(i, f(y) + b, f(v) + b, y - v, 0, (v + y) / 2, 0, { seg: 8, flat: true, open: true, rot: [0, Math.PI / 8, 0] });
    for (let v = 0; v < 4; v++) {
      let y = v * Math.PI / 2;
      t.box(i, 0.012, 0.2, 0.12, Math.cos(y) * 0.2, 0.45, -Math.sin(y) * 0.2, { r: 0, rot: [0, y + Math.PI / 2, 0] });
    }
    t.cyl(i, 0.2, 0.2, 0.02, 0, 0.36, 0, { seg: 8, rot: [0, Math.PI / 8, 0] }), t.cyl(i, 0.09, 0.09, 0.03, 0, l, 0, { seg: 8, rot: [0, Math.PI / 8, 0] });
    let p = f(1.05) * 0.924;
    t.box(i, 0.13, 0.52, 0.012, 0, 1.05, p + 5e-3, { r: 4e-3 }), t.box(o, 0.03, 0.045, 0.012, 0.04, 1.05, p + 0.013, { r: 3e-3 }), t.decal(decalFor(mats, "hazard_voltage"), 0.09, -0.01, 1.2, p + 0.0125, null), t.tube(o, [[-0.3, 0.3, 0.28], [-0.3, 0.52, 0.28], [-0.24, 0.72, 0.2], [-0.1, 0.8, 0.1]], 0.024, { seg: 6 }), t.cyl(o, 0.034, 0.034, 0.03, -0.3, 0.335, 0.28, { seg: 8 }), t.bar(i, [0.1, 3, -0.13], [0.42, 3, -0.13], 0.012), t.bar(i, [0.1, 3, 0.13], [0.42, 3, 0.13], 0.012), t.bar(i, [0.42, 3, -0.16], [0.42, 3, 0.16], 0.012, { caps: true }), t.bar(i, [0.42, 3, -0.13], [0.42, 3.09, -0.13], 0.012, { caps: true }), t.bar(i, [0.42, 3, 0.13], [0.42, 3.09, 0.13], 0.012, { caps: true }), t.cyl(i, f(3) + 0.012, f(3) + 0.012, 0.05, 0, 3, 0, { seg: 8, rot: [0, Math.PI / 8, 0] });
    let d = 0;
    for (let v = 3.45; v < 12.9; v += 0.38, d++) {
      let y = d % 2 ? 1 : -1;
      t.bar(i, [0, v, y * f(v) * 0.8], [0, v, y * (f(v) + 0.15)], 9e-3, { seg: 5, caps: true });
    }
    let m = l + 0.12;
    t.box(i, 0.1, 0.1, 1.9, 0, m, 0, { r: 0.012 }), t.box(i, 0.5, 0.07, 0.07, 0, m + 0.085, 0.55, { r: 0.01 }), t.box(i, 0.5, 0.07, 0.07, 0, m + 0.085, -0.55, { r: 0.01 }), t.beam(i, [0, l - 0.5, 0.08], [0, m - 0.03, 0.7], 0.04, 0.04), t.beam(i, [0, l - 0.5, -0.08], [0, m - 0.03, -0.7], 0.04, 0.04);
    for (let v of [-0.55, 0.55]) warningPanel(t, i, o, r, 0.22, m - 0.14, v, 0, -0.62), warningPanel(t, i, o, r, -0.22, m - 0.14, v, Math.PI, -0.62);
    t.box(o, 0.16, 0.2, 0.12, 0, l - 0.25, -0.14, { r: 0.01 }), t.bar(i, [0, m, 0], [0, 14, 0], 0.012, { r2: 3e-3, seg: 5, caps: true });
    let x = t.toGroup();
    x.userData.lamps = [];
    for (let v of [-0.55, 0.55]) for (let y of [-1, 1]) x.userData.lamps.push({ pos: [y * 0.34, m - 0.22, v], dir: [y * 0.81, -0.58, 0], color: 16769981 });
    return finalizeProp(x, "light_mast", propSize("light_mast"), [{ min: [-0.4, 0, -0.4], max: [0.4, 0.32, 0.4], surface: "concrete" }, { min: [-0.17, 0.32, -0.17], max: [0.17, 14, 0.17], surface: "metal" }]);
  }

  function buildFencePanel(mats, e = {}) {
    let t = new PartBuilder(mats), i = createRng((e.seed | 0) + 5), s = t.M("steel_galv"), o = t.M("concrete", { vertexColors: true }), r = t.M("chainlink", { doubleSide: true }), a = e.posts || "both", l = e.lean === 1 ? 1 : -1, c = a === "both" ? [-1.5, 1.5] : a === "left" ? [-1.5] : a === "right" ? [1.5] : [];
    for (let p of c) {
      t.box(o, 0.32, 0.09, 0.32, p, 0.035, 0, { r: 0.02, col: (d, m) => {
        let x = 0.6 + 0.4 * smoothstep(0, 0.08, m);
        return [x, x, x];
      } }), t.cyl(s, 0.03, 0.03, 2.02, p, 1.05, 0, { seg: 8, open: true }), t.cyl(s, 0.05, 0.05, 0.012, p, 0.086, 0, { seg: 8 }), t.bar(s, [p, 2.02, 0], [p, 2.4 - 0.02, l * 0.36], 0.019, { seg: 6, caps: true }), t.cyl(s, 0.034, 0.034, 0.05, p, 2.03, 0, { seg: 8 });
      for (let d of [0.2, 1.05, 1.9]) t.cyl(s, 0.034, 0.034, 0.03, p, d, 0, { seg: 8, open: true });
    }
    t.bar(s, [-1.5, 2, 0.036], [1.5, 2, 0.036], 0.021, { seg: 7 });
    for (let p of [0.09, 1.02]) t.bar(s, [-1.5, p, 0.012], [1.5, p, 0.012], 35e-4, { seg: 4 });
    t.box(s, 8e-3, 1.9, 0.02, -1.462, 1.03, 0.012, { r: 0 }), t.box(s, 8e-3, 1.9, 0.02, 1.462, 1.03, 0.012, { r: 0 });
    let u = new THREE.PlaneGeometry(2.92, 1.93, 6, 3), f = u.attributes.position, h = u.attributes.uv;
    for (let p = 0; p < f.count; p++) {
      let d = f.getX(p), m = f.getY(p);
      h.setXY(p, d + 1.5, m + 1), f.setZ(p, 0.012 + 0.02 * (noise2(d * 1.3 + (e.seed | 0), m * 1.5) - 0.5) * (1 - Math.abs(d) / 1.46));
    }
    u.computeVertexNormals(), t.add(r, placeGeo(u, 0, 1.025, 0));
    for (let p = 0; p < 3; p++) {
      let d = 0.3 + p * 0.33, m = 2.02 + d * 0.36, x = l * d * 0.36;
      t.bar(s, [-1.5, m, x], [1.5, m, x], 32e-4, { seg: 4 });
      for (let v = -1.42 + p % 2 * 0.09; v < 1.45; v += 0.18) t.add(s, placeGeo(box(4e-3, 0.032, 4e-3), v, m, x, [i() * 3, 0, 0.8 + i()]));
    }
    for (let p = 0; p < 5; p++) t.add(s, placeGeo(box(0.012, 0.012, 0.03), -1.2 + p * 0.6, 2, 0.02));
    return finalizeProp(t.toGroup(), "fence_panel", propSize("fence_panel"), [{ min: [-1.5, 0, -0.04], max: [1.5, 2.4, 0.04], surface: "metal" }]);
  }

  function buildGuardBooth(mats, e = {}) {
    let t = new PartBuilder(mats), i = e.seed | 0, s = i * 1.3, o = 2.6, r = 2.2, a = o / 2, l = r / 2, c = t.M("paint_" + (["white", "grey", "teal"].includes(e.color) ? e.color : "white"), { vertexColors: true }), u = t.M("steel_dark"), f = t.M("steel_galv"), h = t.M("glass", { doubleSide: true }), p = t.M("wood_dark"), d = t.M("polymer_black"), m = (z, I, L) => {
      let U = (0.9 + 0.14 * noise2(z * 2 + s, I * 2 + L)) * (0.6 + 0.4 * smoothstep(0.1, 0.7, I)) * (1 - 0.25 * smoothstep(2.25, 2.45, I));
      return [U, U * 0.985, U * 0.96];
    };
    t.defCol.set(c, m);
    let x = 0.12, v = 1, y = 2.08, b = 2.42;
    t.box(u, o, 0.12, r, 0, 0.06, 0, { r: 0.015 });
    for (let z of [-0.7, 0.7]) t.box(u, o + 0.06, 0.06, 0.1, 0, 0.03, z, { r: 0.01 });
    for (let z of [-1, 1]) for (let I of [-1, 1]) t.box(c, 0.09, b - x, 0.09, z * (a - 0.045), (b + x) / 2, I * (l - 0.045), { r: 0.012 });
    let g = 0.3, E = 1.12, M = (z, I) => {
      let L = I > 0 ? [[-a + 0.09, g - 0.04]] : [[-a + 0.09, a - 0.09]];
      for (let [U, k] of L) {
        t.box(c, k - U, v - x, 0.05, (U + k) / 2, (v + x) / 2, z, { r: 6e-3 }), t.box(c, k - U, 0.05, 0.075, (U + k) / 2, v + 0.01, z + I * 5e-3, { r: 8e-3 }), t.box(h, k - U, y - v - 0.03, 8e-3, (U + k) / 2, (v + y) / 2 + 0.01, z, { r: 0 });
        let C = k - U > 1.6 ? 2 : 1;
        for (let A = 1; A <= C; A++) t.box(c, 0.04, y - v, 0.05, U + (k - U) * A / (C + 1), (v + y) / 2, z, { r: 6e-3 });
        for (let A = 1; A < 3; A++) t.box(c, 6e-3, v - x - 0.04, 0.056, U + (k - U) * A / 3, (v + x) / 2, z, { r: 0 });
      }
      t.box(c, o - 0.18, b - y, 0.05, 0, (b + y) / 2, z, { r: 6e-3 });
    };
    M(l - 0.03, 1), M(-l + 0.03, -1);
    for (let z of [-1, 1]) {
      let I = z * (a - 0.03);
      t.box(c, 0.05, v - x, r - 0.18, I, (v + x) / 2, 0, { r: 6e-3 }), t.box(c, 0.075, 0.05, r - 0.18, I + z * 5e-3, v + 0.01, 0, { r: 8e-3 }), t.box(h, 8e-3, y - v - 0.03, r - 0.18, I, (v + y) / 2 + 0.01, 0, { r: 0 }), t.box(c, 0.05, y - v, 0.04, I, (v + y) / 2, 0, { r: 6e-3 }), t.box(c, 0.05, b - y, r - 0.18, I, (b + y) / 2, 0, { r: 6e-3 });
    }
    let _ = l - 0.03;
    t.box(c, 0.05, y - x, 0.07, g - 0.015, (y + x) / 2, _, { r: 6e-3 }), t.box(c, 0.05, y - x, 0.07, E + 0.015, (y + x) / 2, _, { r: 6e-3 }), t.box(c, a - 0.09 - E - 0.04, y - x, 0.05, (a - 0.09 + E + 0.04) / 2, (y + x) / 2, _, { r: 6e-3 });
    let T = E - g - 0.02, w = (g + E) / 2;
    t.box(c, T, v - x - 0.01, 0.04, w, (v + x) / 2, _ + 5e-3, { r: 6e-3 }), t.box(c, T, 0.07, 0.04, w, y - 0.04, _ + 5e-3, { r: 6e-3 });
    for (let z of [-1, 1]) t.box(c, 0.07, y - v, 0.04, w + z * (T / 2 - 0.035), (v + y) / 2, _ + 5e-3, { r: 6e-3 });
    t.box(h, T - 0.12, y - v - 0.08, 8e-3, w, (v + y) / 2 - 0.02, _ + 5e-3, { r: 0 }), t.box(f, T - 0.06, 0.22, 4e-3, w, x + 0.14, _ + 0.027, { r: 0 }), t.box(f, 0.03, 0.14, 0.02, g + 0.09, 1.05, _ + 0.035, { r: 4e-3 }), t.bar(f, [g + 0.09, 1, _ + 0.06], [g + 0.2, 1, _ + 0.06], 9e-3, { caps: true });
    for (let z of [0.4, 1.75]) t.cyl(f, 0.012, 0.012, 0.1, E + 2e-3, z, _ + 0.03, { seg: 6 });
    t.box(u, 0.9, 0.03, 0.3, w, 0.105, l + 0.15, { r: 6e-3 }), t.box(c, o + 0.36, 0.1, r + 0.4, 0, b + 0.05, 0, { r: 0.02, col: (z, I, L) => {
      let U = 0.72 + 0.2 * noise2(z * 1.5, L * 1.5 + s);
      return [U, U, U * 0.97];
    } }), t.box(u, o + 0.3, 0.03, r + 0.34, 0, b + 0.112, 0, { r: 0.01 });
    for (let z of [-1, 1]) t.box(f, o + 0.36, 0.06, 0.08, 0, b - 5e-3, z * (l + 0.2 + 0.03), { r: 0.012 });
    t.tube(f, [[-a - 0.16, b - 0.03, l + 0.23], [-a - 0.1, b - 0.2, l + 0.1], [-a - 0.03, b - 0.4, l + 0.03], [-a - 0.03, 0.2, l + 0.03], [-a - 0.1, 0.06, l + 0.1]], 0.03, { seg: 6, tension: 0.2 });
    let S = -a - 0.17;
    t.box(c, 0.3, 0.52, 0.78, S, 0.62, -0.25, { r: 0.02 }), t.add(c, placeGeo(roundedCornerPlate(0.44, 0.44, 6), S - 0.151, 0.62, -0.14, [0, -Math.PI / 2, 0]), [0.06, 0.06, 0.06]);
    for (let z = -3; z <= 3; z++) t.add(u, placeGeo(box(6e-3, 8e-3, Math.sqrt(0.22 * 0.22 - (z * 0.06) ** 2) * 2), S - 0.154, 0.62 + z * 0.06, -0.14));
    t.cyl(u, 0.05, 0.05, 0.012, S - 0.156, 0.62, -0.14, { seg: 8, rot: [0, 0, Math.PI / 2] });
    for (let z of [-0.55, 0.05]) t.beam(u, [-a, 0.32, z], [S - 0.1, 0.34, z], 0.03, 0.03, { r: 0 });
    t.tube(t.M("rubber"), [[S + 0.05, 0.86, 0.14], [S + 0.06, 1, 0.2], [-a - 0.02, 1.25, 0.24], [-a - 0.02, 2.2, 0.24]], 0.014, { seg: 5 }), t.add(t.M("floor_epoxy"), placeGeo(scaledPlane(o - 0.1, r - 0.1), 0, 0.122, 0, [-Math.PI / 2, 0, 0])), t.box(p, 0.6, 0.04, r - 0.3, -a + 0.4, 0.76, 0, { r: 8e-3 });
    for (let z of [-0.85, 0.85]) t.box(u, 0.5, 0.64, 0.03, -a + 0.4, 0.44, z, { r: 5e-3 });
    t.box(d, 0.05, 0.32, 0.5, -a + 0.3, 1.02, -0.3, { r: 0.01, rot: [0, 0.25, 0] }), t.add(mats.emissive(9418984, 1.6), placeGeo(plane(0.45, 0.27), -a + 0.3 + 0.027, 1.02, -0.3 - 7e-3, [0, Math.PI / 2 + 0.25, 0]), null, true), t.box(d, 0.05, 0.1, 0.06, -a + 0.28, 0.83, -0.3, { r: 8e-3 }), t.box(d, 0.18, 0.015, 0.22, -a + 0.28, 0.787, -0.3, { r: 4e-3 }), t.box(d, 0.14, 0.02, 0.42, -a + 0.52, 0.79, -0.25, { r: 4e-3 }), t.box(d, 0.46, 0.07, 0.46, -a + 1, 0.5, -0.2, { r: 0.02, rot: [0, 0.3, 0] }), t.box(d, 0.07, 0.55, 0.42, -a + 1.22, 0.86, -0.13, { r: 0.02, rot: [0, 0.3, -0.12] }), t.cyl(u, 0.025, 0.025, 0.36, -a + 1, 0.3, -0.2, { seg: 6 });
    for (let z = 0; z < 5; z++) {
      let I = z * Math.PI * 0.4;
      t.beam(u, [-a + 1, 0.16, -0.2], [-a + 1 + Math.cos(I) * 0.26, 0.14, -0.2 + Math.sin(I) * 0.26], 0.03, 0.025, { r: 0 });
    }
    t.box(u, 0.2, 0.07, 0.1, w, y + 0.19, l + 0.03, { r: 0.012 }), t.add(mats.emissive(16767398, e.on === false ? 0.02 : 5), placeGeo(plane(0.17, 0.05), w, y + 0.152, l + 0.035, [Math.PI / 2, 0, 0]), null, true), t.decal(labelFor(mats, "GATE CONTROL", { color: "black", font: "stencil", distress: 0.2 }), 0.1, -0.45, (b + y) / 2, l - 3e-3, null, 0.9), t.decal(decalFor(mats, "berth4"), 0.34, a - 3e-3, 0.56, 0.3, [0, Math.PI / 2, 0]), t.decal(decalFor(mats, "no_entry"), 0.2, w, 0.72, _ + 0.0265, null), t.decal(decalFor(mats, "grime_streak"), 0.7, -0.6, 0.55, l - 3e-3, null, 0.3), t.decal(decalFor(mats, "rust_run"), 0.6, -a + 3e-3 - 0, 0.6, 0.55, [0, -Math.PI / 2, 0], 0.25);
    let R = t.toGroup();
    return R.userData.lamps = [{ pos: [w, y + 0.14, l + 0.04], dir: [0, -1, 0.2], color: 16767398 }], finalizeProp(R, "guard_booth", propSize("guard_booth"), [{ min: [-a, 0, -l], max: [a, 2.54, l], surface: "metal" }]);
  }

  function buildGateArm(mats, e = {}) {
    let t = new PartBuilder(mats), i = clamp(e.open || 0, 0, 1), s = t.M("paint_orange", { vertexColors: true }), o = t.M("paint_white"), r = t.M("paint_red"), a = t.M("steel_dark"), l = t.M("steel_galv"), c = t.M("paint_yellow"), u = -2.5 + 0.19, f = 0.92;
    t.box(t.M("concrete"), 0.5, 0.06, 0.46, u, 0.03, 0, { r: 0.015 }), t.box(s, 0.36, 1, 0.3, u, 0.56, 0, { r: 0.02, col: (y, b) => {
      let g = 0.6 + 0.4 * smoothstep(0.05, 0.5, b);
      return [g, g, g];
    } }), t.box(a, 0.4, 0.04, 0.34, u, 1.075, 0, { r: 0.012 }), t.box(s, 0.3, 0.6, 0.012, u, 0.5, 0.151, { r: 4e-3, col: [0.9, 0.9, 0.9] }), t.cyl(l, 0.012, 0.012, 0.016, u + 0.1, 0.5, 0.16, { seg: 6, rot: [Math.PI / 2, 0, 0] }), t.decal(decalFor(mats, "hazard_general"), 0.14, u, 0.9, 0.153, null), t.decal(decalFor(mats, "caution_stripes"), 0.08, u, 0.12, 0.153, null, 0.34), t.cyl(a, 0.03, 0.03, 0.05, u, 1.12, 0, { seg: 8 }), t.add(mats.emissive(16734750, 2.2), placeGeo(cyl(0.026, 0.026, 0.045, 8), u, 1.165, 0), null, true), t.push(placeMatrix(u, f, 0, [0, 0, i * 1.48])), t.cyl(a, 0.075, 0.075, 0.36, 0, 0, 0, { seg: 10, rot: [Math.PI / 2, 0, 0] });
    for (let y of [-1, 1]) t.box(a, 0.62, 0.11, 0.012, 0.05, 0, y * 0.175, { r: 4e-3 });
    t.box(a, 0.3, 0.16, 0.3, -0.33, -0.02, 0, { r: 0.02 });
    let h = 4.62, p = 0.12, d = 9, m = h / d;
    for (let y = 0; y < d; y++) t.box(y % 2 ? o : r, m + 1e-3, 0.1 - y * 3e-3, 0.05, p + m * (y + 0.5), 0, 0, { r: 8e-3 });
    t.box(a, 0.03, 0.11, 0.06, p + h + 0.012, 0, 0, { r: 8e-3 }), t.add(mats.emissive(16722450, 1.5), placeGeo(box(0.05, 0.03, 0.054), p + h - 0.5, 0.058, 0), null, true), t.pop();
    let x = 2.5 - 0.1;
    t.box(t.M("concrete"), 0.3, 0.05, 0.3, x, 0.025, 0, { r: 0.012 }), t.cyl(c, 0.04, 0.04, 0.8, x, 0.45, 0, { seg: 8 }), t.box(c, 0.14, 0.02, 0.16, x, 0.855, 0, { r: 5e-3 });
    for (let y of [-1, 1]) t.box(c, 0.14, 0.14, 0.014, x, 0.93, y * 0.073, { r: 4e-3 });
    t.cyl(l, 0.07, 0.07, 0.01, x, 0.055, 0, { seg: 8 });
    let v = [{ min: [u - 0.2, 0, -0.17], max: [u + 0.2, 1.1, 0.17], surface: "metal" }, { min: [x - 0.07, 0, -0.08], max: [x + 0.07, 1, 0.08], surface: "metal" }];
    return i < 0.5 && v.push({ min: [u, f - 0.07, -0.04], max: [x, f + 0.07, 0.04], surface: "metal" }), finalizeProp(t.toGroup(), "gate_arm", propSize("gate_arm"), v);
  }

  function buildBollardMooring(mats, e = {}) {
    let t = new PartBuilder(mats), i = (e.seed | 0) * 2.1, s = t.M("steel_dark", { vertexColors: true }), o = t.M("steel_rust"), r = (a, l, c) => {
      let u = smoothstep(0.3, 0.4, l) * smoothstep(0.47, 0.4, l), f = 0.75 + 0.4 * noise2(a * 6 + i, c * 6 + l * 4) + u * 0.9;
      return [f, f * 0.97, f * 0.93];
    };
    t.defCol.set(s, r), t.cyl(s, 0.34, 0.35, 0.045, 0, 0.0225, 0, { seg: 20 }), t.cyl(o, 0.37, 0.37, 6e-3, 0, 3e-3, 0, { seg: 20 });
    for (let a = 0; a < 6; a++) {
      let l = a * Math.PI / 3 + 0.3;
      t.cyl(o, 0.026, 0.026, 0.03, Math.cos(l) * 0.285, 0.058, Math.sin(l) * 0.285, { seg: 6, flat: true }), t.cyl(o, 0.013, 0.013, 0.022, Math.cos(l) * 0.285, 0.08, Math.sin(l) * 0.285, { seg: 6 });
    }
    t.add(s, lathe([[0.25, 0.045], [0.21, 0.08], [0.165, 0.16], [0.145, 0.27], [0.15, 0.36], [0.17, 0.43], [0.19, 0.5], [0.17, 0.57], [0.1, 0.6], [0, 0.602]], 18)), t.cyl(s, 0.105, 0.115, 0.5, 0, 0.485, 0, { seg: 14, open: true, rot: [0, 0, Math.PI / 2] });
    for (let a of [-1, 1]) {
      let l = sphereSlice(0.108, 14, 8);
      l.scale(0.55, 1, 1), t.add(s, placeGeo(l, a * 0.25, 0.485, 0)), t.cyl(s, 0.125, 0.125, 0.03, a * 0.235, 0.485, 0, { seg: 14, rot: [0, 0, Math.PI / 2] });
    }
    return finalizeProp(t.toGroup(), "bollard_mooring", propSize("bollard_mooring"), [{ min: [-0.3, 0, -0.22], max: [0.3, 0.6, 0.22], surface: "metal" }]);
  }

  function buildBollardPost(mats, e = {}) {
    let t = new PartBuilder(mats), i = (e.seed | 0) * 1.7, s = t.M("paint_yellow", { vertexColors: true }), o = t.M("steel_galv"), r = 0.083, a = (u) => u > 0.6 && u < 0.69 || u > 0.78 && u < 0.87, l = [0.012, 0.3, 0.6, 0.6001, 0.69, 0.6901, 0.78, 0.7801, 0.87, 0.8701, 0.955];
    for (let u = 0; u < l.length - 1; u++) {
      let f = l[u], h = l[u + 1];
      if (h - f < 1e-3) continue;
      let p = a((f + h) / 2);
      t.cyl(s, r, r, h - f, 0, (f + h) / 2, 0, { seg: 14, open: true, col: (d, m, x) => {
        if (p) return [0.05, 0.05, 0.05];
        let v = (0.55 + 0.45 * smoothstep(0, 0.35, m)) * (0.9 + 0.2 * noise2(d * 30 + i, m * 6 + x * 30));
        return [v, v * 0.97, v * 0.9];
      } });
    }
    let c = sphereSlice(r, 14, 5, Math.PI * 2, 0, Math.PI / 2);
    c.scale(1, 0.55, 1), t.add(s, placeGeo(c, 0, 0.955, 0), [0.95, 0.93, 0.88]), t.cyl(o, 0.085, 0.085, 0.012, 0, 6e-3, 0, { seg: 4, rot: [0, Math.PI / 4, 0] }), t.box(o, 0.17, 0.012, 0.17, 0, 6e-3, 0, { r: 4e-3 });
    for (let u of [-1, 1]) for (let f of [-1, 1]) t.cyl(o, 0.011, 0.011, 0.012, u * 0.066, 0.017, f * 0.066, { seg: 6 });
    return t.cyl(s, r + 6e-3, r + 6e-3, 0.02, 0, 0.022, 0, { seg: 14, open: true, col: [0.5, 0.48, 0.42] }), finalizeProp(t.toGroup(), "bollard_post", propSize("bollard_post"), [{ min: [-0.085, 0, -0.085], max: [0.085, 1, 0.085], surface: "metal" }]);
  }

  function buildSignPost(mats, e = {}) {
    let t = new PartBuilder(mats), i = e.seed | 0, s = t.M("steel_galv"), o = t.M("aluminium"), r = t.M("paint_white"), a = t.M("paint_yellow"), l = SIGN_DECALS.includes(e.sign) ? e.sign : SIGN_DECALS[i % SIGN_DECALS.length];
    t.box(t.M("concrete"), 0.3, 0.07, 0.3, 0, 0.03, 0, { r: 0.015 }), t.box(s, 0.05, 2.38, 0.05, 0, 1.2, 0, { r: 6e-3 }), t.box(s, 0.058, 0.012, 0.058, 0, 2.395, 0, { r: 4e-3 }), t.box(s, 0.13, 0.012, 0.13, 0, 0.07, 0, { r: 3e-3 });
    let c = (i % 5 - 2) * 6e-3;
    t.push(placeMatrix(0, 0, 0, [0, 0, c])), t.box(o, 0.6, 0.6, 4e-3, 0, 2.02, 0.031, { r: 15e-4 }), t.box(l.startsWith("hazard") ? a : r, 0.58, 0.58, 2e-3, 0, 2.02, 0.034, { r: 8e-4 }), t.decal(decalFor(mats, l), 0.5, 0, 2.02, 0.0362, null, 0.5), t.box(o, 0.6, 0.22, 4e-3, 0, 1.56, 0.031, { r: 15e-4 }), t.box(r, 0.58, 0.2, 2e-3, 0, 1.56, 0.034, { r: 8e-4 }), t.decal(labelFor(mats, e.text || SIGN_TEXTS[i % SIGN_TEXTS.length], { color: "black", font: "sans", distress: 0.15 }), 0.07, 0, 1.56, 0.0362, null, 0.52);
    for (let u of [1.85, 2.2, 1.56]) t.box(s, 0.5, 0.03, 0.012, 0, u, 0.024, { r: 0 }), t.box(s, 0.09, 0.04, 0.07, 0, u, -2e-3, { r: 4e-3 });
    for (let [u, f] of [[-0.26, 2.28], [0.26, 2.28], [-0.26, 1.76], [0.26, 1.76]]) t.cyl(s, 8e-3, 8e-3, 4e-3, u, f, 0.0365, { seg: 6, rot: [Math.PI / 2, 0, 0] });
    return t.pop(), finalizeProp(t.toGroup(), "sign_post", propSize("sign_post"), [{ min: [-0.03, 0, -0.03], max: [0.03, 2.4, 0.03], surface: "metal" }, { min: [-0.3, 1.44, 0.02], max: [0.3, 2.33, 0.04], surface: "metal", bulletOnly: true }]);
  }

  function buildFloodlightStand(mats, e = {}) {
    let t = new PartBuilder(mats), i = e.seed | 0, s = createRng(i + 3), o = t.M("paint_yellow"), r = t.M("steel_dark"), a = t.M("aluminium"), l = t.M("rubber"), c = mats.emissive(16773596, e.on === false ? 0.02 : 10);
    t.cyl(a, 0.021, 0.021, 1.1, 0, 0.75, 0, { seg: 8, open: true }), t.cyl(a, 0.016, 0.016, 0.9, 0, 1.6, 0, { seg: 8, open: true }), t.cyl(r, 0.03, 0.03, 0.06, 0, 1.3, 0, { seg: 8 }), t.bar(r, [0.03, 1.3, 0], [0.085, 1.3, 0], 8e-3, { caps: true }), t.box(r, 0.02, 0.03, 0.05, 0.09, 1.3, 0, { r: 5e-3 }), t.cyl(r, 0.032, 0.032, 0.07, 0, 0.82, 0, { seg: 8 }), t.cyl(r, 0.03, 0.03, 0.05, 0, 0.36, 0, { seg: 8 });
    for (let d = 0; d < 3; d++) {
      let m = d * Math.PI * 2 / 3 + 0.5, x = Math.cos(m), v = Math.sin(m);
      t.bar(a, [x * 0.035, 0.82, v * 0.035], [x * 0.5, 0.025, v * 0.5], 0.013, { seg: 6 }), t.bar(a, [x * 0.03, 0.36, v * 0.03], [x * 0.3, 0.37, v * 0.3], 8e-3, { seg: 5 }), t.add(l, placeGeo(sphereSlice(0.028, 8, 5), x * 0.5, 0.02, v * 0.5));
    }
    t.box(r, 0.05, 0.04, 0.72, 0, 2.03, 0, { r: 8e-3 });
    for (let d of [-1, 1]) {
      t.push(placeMatrix(0.03, 2.03, d * 0.2, [0, d * -0.12, 0])), t.push(placeMatrix(0, 0, 0, [0, 0, -0.22])), t.box(o, 0.075, 0.24, 0.32, 0.06, 0.02, 0, { r: 0.012 }), t.add(c, placeGeo(plane(0.28, 0.2), 0.0985, 0.02, 0, [0, Math.PI / 2, 0]), null, true), t.box(r, 0.012, 0.25, 0.012, 0.1, 0.02, 0.157, { r: 0 }), t.box(r, 0.012, 0.25, 0.012, 0.1, 0.02, -0.157, { r: 0 }), t.box(r, 0.012, 0.012, 0.33, 0.1, 0.143, 0, { r: 0 }), t.box(r, 0.012, 0.012, 0.33, 0.1, -0.103, 0, { r: 0 });
      for (let m = -3; m <= 3; m++) t.add(r, placeGeo(box(0.035, 0.2, 6e-3), 8e-3, 0.02, m * 0.043));
      t.tube(o, [[0.05, 0.14, -0.1], [0.05, 0.2, -0.06], [0.05, 0.2, 0.06], [0.05, 0.14, 0.1]], 8e-3, { seg: 5 }), t.pop(), t.pop();
    }
    let u = s() * Math.PI * 2, f = Math.cos(u), h = Math.sin(u);
    t.tube(l, [[0, 2, 0.03], [-0.03, 1.7, 0.04], [0.035, 1.25, 0.02], [-0.03, 0.9, 0.03], [0.05, 0.5, 0.06], [0.12, 0.08, 0.1], [0.25, 0.012, 0.16], [0.3 + f * 0.3, 0.012, 0.2 + h * 0.3], [0.2 + f * 0.75 - h * 0.2, 0.012, 0.1 + h * 0.75 + f * 0.2], [f * 1.2, 0.012, h * 1.2]], 0.011, { seg: 5 }), t.box(o, 0.09, 0.05, 0.06, f * 1.24, 0.026, h * 1.24, { r: 0.01, rot: [0, -u, 0] });
    let p = t.toGroup();
    return p.userData.lamps = [{ pos: [0.14, 2.03, 0], dir: [0.976, -0.218, 0], color: 16773596 }], finalizeProp(p, "floodlight_stand", propSize("floodlight_stand"), [{ min: [-0.12, 0, -0.12], max: [0.12, 2.2, 0.12], surface: "metal" }]);
  }

  function buildStairsMetal(mats, e = {}) {
    let t = new PartBuilder(mats), i = t.M("diamond_plate"), s = t.M("steel_dark"), o = t.M("paint_yellow"), r = t.M("steel_galv"), a = 12, l = 0.2, c = 0.2, u = -1.5, f = 0.5, h = u + a * c, p = [];
    for (let x = 0; x < a; x++) {
      let v = (x + 1) * l, y = u + x * c;
      t.box(i, 0.25, 0.03, 0.9, y + 0.125, v - 0.015, 0, { r: 5e-3 }), t.box(o, 0.035, 0.034, 0.9, y + 0.016, v - 0.015, 0, { r: 6e-3 });
      for (let b of [-1, 1]) t.box(s, 0.2, 0.05, 0.01, y + 0.13, v - 0.05, b * 0.452, { r: 0 });
      p.push({ min: [y, 0, -f], max: [y + c, v, f], surface: "metal" });
    }
    for (let x of [-1, 1]) {
      t.beam(s, [u + 0.07, 0.13, x * 0.465], [h + 0.04, 2.5, x * 0.465], 0.24, 0.014, { r: 4e-3 }), t.box(r, 0.3, 0.012, 0.12, u + 0.06, 6e-3, x * 0.465, { r: 0 });
      for (let v of [-0.08, 0.1]) t.cyl(r, 0.012, 0.012, 0.02, u + 0.06 + v, 0.02, x * 0.5, { seg: 6 });
    }
    let d = (a + 1) * l;
    t.box(i, 0.64, 0.035, 0.96, h + 0.3, d - 0.0175, 0, { r: 5e-3 }), t.box(o, 0.035, 0.038, 0.96, h + 0.016, d - 0.0175, 0, { r: 6e-3 });
    for (let x of [-1, 1]) t.box(s, 0.66, 0.16, 0.06, h + 0.3, d - 0.115, x * 0.47, { r: 8e-3 });
    t.box(s, 0.06, 0.16, 0.96, 1.47, d - 0.115, 0, { r: 8e-3 }), t.box(s, 0.06, 0.12, 0.9, h + 0.02, d - 0.1, 0, { r: 8e-3 });
    for (let x of [-1, 1]) t.box(s, 0.08, d - 0.19, 0.08, 1.44, (d - 0.19) / 2, x * 0.45, { r: 8e-3 }), t.box(r, 0.18, 0.012, 0.18, 1.44, 6e-3, x * 0.45, { r: 0 }), t.beam(s, [1.44, 1.5, x * 0.45], [h + 0.1, d - 0.2, x * 0.45], 0.05, 0.05, { r: 6e-3 });
    t.beam(s, [1.44, 0.15, -0.42], [1.44, 2.2, 0.42], 0.045, 8e-3, { r: 0 }), t.beam(s, [1.44, 0.15, 0.42], [1.44, 2.2, -0.42], 0.045, 8e-3, { r: 0 }), t.box(s, 0.06, 0.06, 0.82, 1.44, 1.2, 0, { r: 6e-3 }), p.push({ min: [h, d - 0.2, -f], max: [1.5, d, f], surface: "metal" });
    for (let x of [-1, 1]) p.push({ min: [1.4, 0, x * 0.45 - 0.04], max: [1.48, d - 0.2, x * 0.45 + 0.04], surface: "metal" });
    let m = (x) => (x - u) / c * l + l;
    for (let x of [-1, 1]) {
      let v = x * 0.485, y = [[u + 0.1, m(u + 0.1)], [u + 0.9, m(u + 0.9) - 0.1], [u + 1.7, m(u + 1.7) - 0.1], [h + 0.03, d], [1.47, d]];
      for (let [b, g] of y) t.bar(o, [b, g - 0.12, v], [b, g + 1, v], 0.019, { seg: 7 }), t.box(s, 0.07, 0.1, 0.012, b, g - 0.1, v - x * 0.012, { r: 0 });
      for (let b of [1, 0.52]) {
        let g = b === 1 ? 0.021 : 0.016;
        t.bar(o, [y[0][0], y[0][1] + b, v], [y[3][0], y[3][1] + b, v], g, { seg: 7 }), t.bar(o, [y[3][0], y[3][1] + b, v], [y[4][0], y[4][1] + b, v], g, { seg: 7 }), t.add(o, placeGeo(sphereSlice(g * 1.05, 7, 5), y[3][0], y[3][1] + b, v)), t.add(o, placeGeo(sphereSlice(g * 1.05, 7, 5), y[0][0], y[0][1] + b, v)), t.add(o, placeGeo(sphereSlice(g * 1.05, 7, 5), y[4][0], y[4][1] + b, v));
      }
      t.box(s, 0.6, 0.1, 8e-3, h + 0.3, d + 0.05, x * 0.476, { r: 0 }), p.push({ min: [h, d, v - 0.03], max: [1.5, d + 1.02, v + 0.03], surface: "metal" });
    }
    return finalizeProp(t.toGroup(), "stairs_metal", propSize("stairs_metal"), p);
  }

  function buildCatwalk(mats, e = {}) {
    let t = new PartBuilder(mats), i = t.M("steel_dark"), s = t.M("paint_yellow"), o = t.M("steel_galv"), r = e.rails || "both", a = r === "both" ? [-1, 1] : r === "left" ? [-1] : r === "right" ? [1] : [], l = 0.05;
    for (let u = -0.51; u <= 0.511; u += 0.034) t.add(o, placeGeo(box(2.98, 0.03, 4e-3), 0, l - 0.015, u));
    for (let u = -1.45; u <= 1.451; u += 0.1) t.add(o, placeGeo(box(6e-3, 6e-3, 1.04), u, l - 4e-3, 0));
    for (let u of [-1, 1]) t.add(o, placeGeo(box(2.99, 0.032, 5e-3), 0, l - 0.016, u * 0.525)), t.add(o, placeGeo(box(5e-3, 0.032, 1.05), u * 1.493, l - 0.016, 0));
    for (let u of [-1, 1]) t.box(i, 3, 0.18, 0.06, 0, l - 0.09, u * 0.565, { r: 8e-3 });
    for (let u of [-1.45, -0.5, 0.5, 1.45]) t.box(i, 0.05, 0.1, 1.08, u, l - 0.085, 0, { r: 6e-3 });
    let c = [{ min: [-1.5, l - 0.08, -0.6], max: [1.5, l, 0.6], surface: "metal" }];
    for (let u of a) {
      let f = u * 0.565;
      t.box(i, 3, 0.1, 8e-3, 0, l + 0.05, u * 0.535, { r: 0 });
      for (let h of [-1.42, 0, 1.42]) t.box(s, 0.045, 1.07, 0.045, h, l + 0.52, f, { r: 6e-3 }), t.box(i, 0.09, 0.012, 0.09, h, l + 6e-3, f, { r: 0 });
      t.bar(s, [-1.5, l + 1.05, f], [1.5, l + 1.05, f], 0.021, { seg: 7, caps: true }), t.bar(s, [-1.5, l + 0.55, f], [1.5, l + 0.55, f], 0.016, { seg: 6, caps: true }), c.push({ min: [-1.5, l, f - 0.035], max: [1.5, l + 1.05, f + 0.035], surface: "metal" });
    }
    return finalizeProp(t.toGroup(), "catwalk", propSize("catwalk"), c);
  }

  function buildShelfRack(mats, e = {}) {
    let t = new PartBuilder(mats), i = e.seed | 0, s = createRng(i + 21), o = t.M("paint_blue", { vertexColors: true }), r = t.M("paint_orange"), a = t.M("steel_galv"), l = { wood: t.M("wood_pallet"), card: t.M("cardboard"), tape: t.M("polymer_tan"), poly: t.M("polymer_black"), wrap: t.M("glass_dirty"), drum: t.M("plastic_blue"), drum2: t.M("paint_red"), dark: t.M("steel_dark") }, c = 4.2, u = 1.305, f = 0.5, h = [0.04, 0.04, 0.05];
    for (let m of [-1, 1]) {
      for (let v of [-1, 1]) {
        t.box(o, 0.09, c, 0.07, m * u, c / 2, v * f, { r: 8e-3, col: (y, b) => {
          let g = 0.7 + 0.3 * smoothstep(0, 0.5, b);
          return [g, g, g];
        } }), t.box(a, 0.14, 0.01, 0.12, m * u, 5e-3, v * f, { r: 0 });
        for (let y of [-0.05, 0.05]) t.cyl(a, 0.01, 0.01, 0.02, m * u + y, 0.016, v * f, { seg: 6 });
        for (let y = 0.12; y < c - 0.05; y += 0.1) for (let b of [-0.022, 0.022]) t.add(o, placeGeo(plane(0.014, 0.034), m * u + b, y, v * (f + 0.0356), [0, v > 0 ? 0 : Math.PI, 0]), h);
      }
      let x = [0.2, 1.1, 2, 2.9, 3.8];
      for (let v = 0; v < x.length; v++) t.box(o, 0.03, 0.03, 2 * f - 0.07, m * u, x[v], 0, { r: 0 }), v < x.length - 1 && t.beam(o, [m * u, x[v], v % 2 ? f - 0.04 : -f + 0.04], [m * u, x[v + 1], v % 2 ? -f + 0.04 : f - 0.04], 0.03, 0.03, { r: 0 });
      t.box(t.M("paint_yellow"), 0.14, 0.4, 0.02, m * u, 0.2, f + 0.06, { r: 6e-3 });
    }
    let p = [1.45, 2.86];
    for (let m of p) {
      for (let x of [-1, 1]) {
        t.box(r, 2 * u - 0.09, 0.12, 0.05, 0, m, x * (f + 0.01), { r: 8e-3 });
        for (let v of [-1, 1]) t.box(r, 0.012, 0.2, 0.065, v * (u - 0.051), m - 0.02, x * (f + 5e-3), { r: 0 });
      }
      for (let x of [-0.85, 0, 0.85]) t.add(a, placeGeo(box(0.04, 0.025, 2 * f), x, m + 0.045, 0));
      for (let x = -0.45; x <= 0.451; x += 0.1) t.add(a, placeGeo(box(2 * u - 0.1, 5e-3, 5e-3), 0, m + 0.062, x));
      for (let x = -1.2; x <= 1.201; x += 0.2) t.add(a, placeGeo(box(5e-3, 5e-3, 2 * f + 0.04), x, m + 0.066, 0));
    }
    t.decal(labelFor(mats, "BAY " + String.fromCharCode(65 + i % 6) + "-" + (10 + i % 40), { color: "black", font: "sans", distress: 0.1 }), 0.07, 0, p[0], f + 0.0365, null, 0.34), t.decal(labelFor(mats, "MAX 2000 KG / LEVEL", { color: "black", font: "sans", distress: 0.1 }), 0.045, 0.6, p[1], f + 0.0365, null, 0.5);
    let d = ["cartons", "wrapped", "drums", "cartons", "wrapped", "pallets", "none"];
    return [0, p[0] + 0.068, p[1] + 0.068].forEach((m, x) => {
      for (let v of [-1, 1]) {
        let y = d[Math.floor(s() * d.length)];
        x === 2 && y === "drums" && (y = "wrapped"), y !== "none" && shelfLoad(t, l, y, v * 0.615 + (s() - 0.5) * 0.03, m, (s() - 0.5) * 0.05, s);
      }
    }), finalizeProp(t.toGroup(), "shelf_rack", propSize("shelf_rack"), [{ min: [-1.35, 0, -0.55], max: [1.35, 4.2, 0.55], surface: "metal" }]);
  }

  function buildReeferUnit(mats, e = {}) {
    let t = new PartBuilder(mats), i = e.seed | 0, s = i * 2.3, o = t.M("paint_white", { vertexColors: true }), r = t.M("steel_dark"), a = t.M("steel_galv"), l = t.M("paint_grey"), c = t.M("brass"), u = t.M("rubber"), f = t.M("aluminium"), h = (x, v, y) => {
      let b = (0.86 + 0.18 * noise2(y * 2 + s, v * 2)) * (0.62 + 0.38 * smoothstep(0, 0.6, v));
      return [b, b * 0.985, b * 0.955];
    };
    t.defCol.set(o, h);
    let p = [0.05, 0.05, 0.055];
    e.flip || t.push(placeMatrix(0, 0, 0, [0, Math.PI, 0]));
    let d = 0.13;
    t.box(o, 0.38, 2.3, 2.3, -0.06, 1.15, 0, { r: 0.012 });
    for (let x of [-1, 1]) t.box(o, 0.12, 2.3, 0.09, 0.19, 1.15, x * 1.105, { r: 0.012 });
    t.box(o, 0.12, 0.09, 2.12, 0.19, 2.255, 0, { r: 0.012 }), t.box(o, 0.12, 0.1, 2.12, 0.19, 0.05, 0, { r: 0.012 }), t.box(o, 0.1, 0.06, 2.12, 0.18, 1.42, 0, { r: 0.01 }), t.box(o, 0.1, 0.06, 2.12, 0.18, 0.9, 0, { r: 0.01 });
    for (let x of [0.3, 0.9, 1.5, 2.1]) for (let v of [-1, 1]) t.cyl(a, 0.014, 0.014, 0.012, 0.255, x, v * 1.105, { seg: 6, rot: [0, 0, Math.PI / 2] });
    for (let x of [-0.8, -0.3, 0.3, 0.8]) for (let v of [0.05, 2.255]) t.cyl(a, 0.014, 0.014, 0.012, 0.255, v, x, { seg: 6, rot: [0, 0, Math.PI / 2] });
    for (let x of [-1, 1]) {
      let v = x * 0.53, y = 1.83;
      t.add(o, placeGeo(roundedCornerPlate(0.66, 0.66, 6), d + 4e-3, y, v, [0, Math.PI / 2, 0]), p), t.cyl(o, 0.335, 0.345, 0.1, d + 0.05, y, v, { seg: 20, open: true, rot: [0, 0, Math.PI / 2] }), t.cyl(o, 0.36, 0.36, 0.014, d + 6e-3, y, v, { seg: 20, open: true, rot: [0, 0, Math.PI / 2] });
      for (let b = 0; b < 3; b++) t.add(r, placeGeo(box(0.012, 0.6, 0.12), d + 0.04, y, v, [b * Math.PI / 3 + x * 0.4, 0.5, 0]));
      t.cyl(r, 0.07, 0.07, 0.06, d + 0.05, y, v, { seg: 10, rot: [0, 0, Math.PI / 2] });
      for (let b = 0; b < 8; b++) {
        let g = b * Math.PI / 4;
        t.add(a, placeGeo(box(5e-3, 0.66, 5e-3), d + 0.098, y, v, [g, 0, 0]));
      }
      for (let b of [0.12, 0.22, 0.32]) t.cyl(a, b, b, 6e-3, d + 0.1, y, v, { seg: 20, open: true, rot: [0, 0, Math.PI / 2] });
    }
    t.decal(labelFor(mats, "KELVAR  MARINE  REFRIGERATION", { color: "black", font: "sans", distress: 0.2 }), 0.05, 0.2505, 2.255, 0, [0, Math.PI / 2, 0], 1.2);
    for (let x of [-1, 1]) {
      t.add(o, placeGeo(plane(0.98, 0.44), d + 4e-3, 1.16, x * 0.53, [0, Math.PI / 2, 0]), p);
      for (let v = 0; v < 9; v++) t.box(o, 0.06, 6e-3, 0.98, d + 0.035, 0.965 + v * 0.049, x * 0.53, { r: 0, rot: [0, 0, -0.75] });
      t.box(o, 0.05, 0.46, 0.03, d + 0.03, 1.16, x * 0.53, { r: 5e-3 });
    }
    t.add(o, placeGeo(plane(1, 0.76), d + 4e-3, 0.49, -0.53, [0, Math.PI / 2, 0]), p), t.cyl(r, 0.15, 0.15, 0.46, d + 0.1, 0.36, -0.58, { seg: 14, open: true, rot: [Math.PI / 2, 0, 0] });
    for (let x of [-1, 1]) {
      let v = sphereSlice(0.15, 14, 6);
      v.scale(1, 1, 0.45), t.add(r, placeGeo(v, d + 0.1, 0.36, -0.58 + x * 0.23));
    }
    t.box(r, 0.26, 0.03, 0.5, d + 0.1, 0.19, -0.58, { r: 6e-3 }), t.cyl(f, 0.07, 0.07, 0.4, d + 0.07, 0.5, -0.17, { seg: 10 }), t.tube(c, [[d + 0.1, 0.5, -0.5], [d + 0.1, 0.68, -0.5], [d + 0.08, 0.78, -0.4], [d + 0.08, 0.8, -0.2], [d + 0.07, 0.72, -0.17]], 0.012, { seg: 6 }), t.tube(c, [[d + 0.12, 0.42, -0.36], [d + 0.14, 0.6, -0.33], [d + 0.1, 0.84, -0.34], [d + 0.06, 0.88, -0.6], [d + 0.03, 0.88, -0.9]], 9e-3, { seg: 6 }), t.tube(c, [[d + 0.1, 0.36, -0.82], [d + 0.1, 0.36, -0.93], [d + 0.06, 0.6, -0.96], [d + 0.04, 0.86, -0.96]], 0.012, { seg: 6 }), t.box(t.M("paint_red"), 0.04, 0.05, 0.05, d + 0.12, 0.6, -0.33, { r: 8e-3 });
    let m = 0.55;
    t.box(l, 0.11, 0.56, 0.74, d + 0.055, 0.5, m, { r: 0.012 }), t.box(l, 0.012, 0.5, 0.68, d + 0.114, 0.5, m, { r: 4e-3 }), t.add(r, placeGeo(plane(0.26, 0.11), d + 0.1215, 0.66, m - 0.1, [0, Math.PI / 2, 0])), t.add(mats.emissive(16757850, 2.4), placeGeo(plane(0.15, 0.05), d + 0.122, 0.665, m - 0.06, [0, Math.PI / 2, 0]), null, true), t.add(mats.emissive(5832570, 3), placeGeo(plane(0.014, 0.014), d + 0.122, 0.66, m - 0.2, [0, Math.PI / 2, 0]), null, true);
    for (let x = 0; x < 4; x++) for (let v = 0; v < 2; v++) t.box(r, 8e-3, 0.03, 0.03, d + 0.122, 0.5 - v * 0.045, m - 0.04 - x * 0.045, { r: 3e-3 });
    return t.box(t.M("paint_red"), 0.03, 0.09, 0.03, d + 0.13, 0.42, m + 0.22, { r: 6e-3 }), t.cyl(a, 0.012, 0.012, 0.1, d + 0.124, 0.5, m + 0.325, { seg: 6 }), t.decal(decalFor(mats, "hazard_voltage"), 0.11, d + 0.1215, 0.64, m + 0.2, [0, Math.PI / 2, 0]), t.tube(u, [[d + 0.06, 0.78, m + 0.2], [d + 0.06, 0.95, m + 0.25], [d + 0.05, 1.4, m + 0.5], [d + 0.05, 1.5, m - 0]], 0.012, { seg: 5 }), t.tube(u, [[d + 0.06, 0.78, m - 0.2], [d + 0.06, 0.92, m - 0.3], [d + 0.05, 0.93, -0.1]], 0.01, { seg: 5 }), t.cyl(a, 0.022, 0.022, 0.04, d + 0.06, 0.2, m + 0.2, { seg: 8 }), t.tube(u, [[d + 0.06, 0.2, m + 0.2], [d + 0.08, 0.12, m + 0.1], [d + 0.1, 0.16, m - 0.15], [d + 0.1, 0.2, m - 0.3], [d + 0.1, 0.13, m - 0.36], [d + 0.09, 0.12, m - 0.1], [d + 0.09, 0.14, m + 0.05]], 0.016, { seg: 6 }), t.box(t.M("paint_blue"), 0.07, 0.07, 0.12, d + 0.09, 0.14, m + 0.1, { r: 0.015 }), t.decal(decalFor(mats, "grime_streak"), 0.8, 0.2512, 0.5, -1.105, [0, Math.PI / 2, 0], 0.08), e.flip || t.pop(), finalizeProp(t.toGroup(), "reefer_unit", propSize("reefer_unit"), [{ min: [-0.25, 0, -1.15], max: [0.25, 2.3, 1.15], surface: "metal" }]);
  }

  function buildRelayNode(mats, e = {}) {
    let t = e.seed | 0, i = t * 1.9, s = e.id || e.label || "ABC"[t % 3], o = new PartBuilder(mats), r = new PartBuilder(mats), a = new PartBuilder(mats), l = new PartBuilder(mats), c = o.M("paint_grey", { vertexColors: true }), u = o.M("steel_dark"), f = o.M("steel_galv"), h = o.M("aluminium"), p = o.M("rubber"), d = o.M("concrete", { vertexColors: true }), m = (ce, P, D) => {
      let B = (0.88 + 0.2 * noise2(ce * 3 + i, P * 3 + D * 2)) * (0.6 + 0.4 * smoothstep(0.16, 0.7, P));
      return [B, B, B * 0.98];
    };
    o.defCol.set(c, m), r.defCol.set(c, (ce, P, D) => {
      let B = 0.9 + 0.14 * noise2(ce * 4 + i, P * 3);
      return [B, B, B];
    });
    let x = [0.035, 0.035, 0.04], v = { em: true };
    o.box(d, 1.36, 0.16, 0.96, 0, 0.08, 0, { r: 0.025, col: (ce, P, D) => {
      let B = 0.6 + 0.38 * smoothstep(0, 0.15, P) + 0.1 * noise2(ce * 5, D * 5);
      return [B, B, B * 0.97];
    } }), o.decal(decalFor(mats, "caution_stripes"), 0.1, 0, 0.085, 0.4815, null, 1.2);
    for (let ce of [-1, 1]) for (let P of [-1, 1]) o.cyl(f, 0.016, 0.016, 0.03, ce * 0.44, 0.185, P * 0.36, { seg: 6 }), o.box(f, 0.1, 0.012, 0.1, ce * 0.44, 0.166, P * 0.36, { r: 0 });
    let y = -0.5, b = 0.5, g = 0.18, E = 1.62, M = -0.3, _ = 0.3, T = 0.025, w = (g + E) / 2, S = E - g;
    o.box(c, 1, S, T, 0, w, M + T / 2, { r: 6e-3 });
    for (let ce of [-1, 1]) o.box(c, T, S, 0.6, ce * (0.5 - T / 2), w, 0, { r: 6e-3 });
    o.box(c, 1, T, 0.6, 0, g + T / 2, 0, { r: 6e-3 }), o.box(c, 1, T, 0.6, 0, E - T / 2, 0, { r: 6e-3 }), o.box(c, T, S, 0.58, 0, w, 0, { r: 4e-3 }), o.box(c, 1, 0.12, T, 0, E - 0.06, _ - T / 2, { r: 6e-3 }), o.box(c, 1, 0.07, T, 0, g + 0.035, _ - T / 2, { r: 6e-3 }), o.box(u, 1.04, 0.04, 0.64, 0, g - 0.01, 0, { r: 8e-3 }), o.box(c, 1.12, 0.05, 0.74, 0, E + 0.025, 0.01, { r: 0.012 });
    for (let ce of [-1, 1]) o.tube(f, [[ce * 0.4 - 0.04, E + 0.05, 0.2], [ce * 0.4 - 0.03, E + 0.1, 0.2], [ce * 0.4 + 0.03, E + 0.1, 0.2], [ce * 0.4 + 0.04, E + 0.05, 0.2]], 8e-3, { seg: 5 });
    let R = (ce, P, D) => [0.16, 0.16, 0.17];
    o.add(c, placeGeo(plane(0.45, S - 0.06), -0.25, w, M + T + 2e-3), R), o.add(c, placeGeo(plane(0.55, S - 0.06), y + T + 2e-3, w, 0, [0, Math.PI / 2, 0]), R), o.add(c, placeGeo(plane(0.55, S - 0.06), -T / 2 - 2e-3, w, 0, [0, -Math.PI / 2, 0]), R);
    for (let ce = 0; ce < 5; ce++) {
      let P = 0.42 + ce * 0.22;
      o.box(u, 0.42, 0.17, 0.4, -0.25, P, -0.05, { r: 8e-3 }), o.box(h, 0.4, 0.02, 0.012, -0.25, P + 0.06, 0.152, { r: 0 });
      for (let D = 0; D < 4; D++) a.add(v, placeGeo(plane(0.012, 0.012), -0.41 + D * 0.035, P - 0.04, 0.1512));
      for (let D = 0; D < 3; D++) o.add(u, placeGeo(roundedCornerPlate(0.03, 0.022, 2), -0.2 + D * 0.06, P - 0.03, 0.1512), x);
    }
    let z = [p, p, p];
    for (let ce = 0; ce < 4; ce++) o.tube(z[ce % 3], [[-0.2 + ce % 3 * 0.06, 0.39 + ce * 0.22, 0.15], [-0.14 + ce % 3 * 0.05, 0.36 + ce * 0.22, 0.24], [-0.07, 0.55 + ce * 0.22, 0.22], [-0.2 + (ce + 1) % 3 * 0.06, 0.61 + ce * 0.22, 0.15]], 7e-3, { seg: 5 });
    let I = 0.474, L = 1.3, U = 0.9, k = (ce, P, D) => {
      let B = P + I / 2, X = 0;
      ce.box(c, I, L, 0.024, B, U, X, { r: 6e-3 }), ce.box(c, I - 0.07, L - 0.07, 6e-3, B, U, X + 0.013, { r: 3e-3 });
      for (let he of [U + 0.36, U - 0.4]) {
        ce.add(c, placeGeo(plane(I - 0.14, 0.3), B, he, X + 0.0165), x);
        for (let V = 0; V < 7; V++) ce.box(c, I - 0.13, 0.034, 5e-3, B, he - 0.125 + V * 0.042, X + 0.027, { r: 0, rot: [0.75, 0, 0] });
        ce.box(c, 0.02, 0.31, 0.02, B - (I - 0.13) / 2, he, X + 0.022, { r: 3e-3 }), ce.box(c, 0.02, 0.31, 0.02, B + (I - 0.13) / 2, he, X + 0.022, { r: 3e-3 });
      }
      let re = D ? P + 0.07 : P + I - 0.07;
      ce.box(u, 0.045, 0.2, 0.02, re, U - 0.02, X + 0.026, { r: 6e-3 }), ce.box(f, 0.028, 0.13, 0.018, re, U + 0, X + 0.042, { r: 6e-3 }), ce.cyl(f, 0.012, 0.012, 0.012, re, U - 0.09, X + 0.04, { seg: 8, rot: [Math.PI / 2, 0, 0] });
      let Y = D ? P + I : P;
      for (let he of [U - 0.5, U, U + 0.5]) ce.cyl(f, 0.011, 0.011, 0.09, Y, he, X + 0.016, { seg: 6 });
    };
    o.push(placeMatrix(0, 0, _ - 4e-3)), k(o, 0.013, true), o.decal(labelFor(mats, "RELAY " + s, { color: "yellow", font: "stencil", distress: 0.15 }), 0.12, 0.013 + I / 2, U + 0.02, 0.018, null, I - 0.1), o.decal(labelFor(mats, "HARBORMASTER UPLINK", { color: "white", font: "sans", distress: 0.15 }), 0.034, 0.013 + I / 2, U - 0.1, 0.018, null, I - 0.1), o.decal(decalFor(mats, "hazard_voltage"), 0.13, 0.013 + I / 2 + 0.1, U + 0.14, 0.018, null), o.pop();
    let C = [-0.487, 0, _ - 4e-3];
    k(r, 0, false), r.decal(decalFor(mats, "hazard_general"), 0.13, I / 2, U + 0.1, 0.018, null), r.box(c, I - 0.1, 0.03, 0.014, I / 2, U + 0.55, -0.018, { r: 3e-3 }), r.box(c, I - 0.1, 0.03, 0.014, I / 2, U - 0.55, -0.018, { r: 3e-3 }), r.box(c, 0.03, 1.1, 0.014, 0.07, U, -0.018, { r: 3e-3 }), r.box(c, 0.03, 1.1, 0.014, I - 0.07, U, -0.018, { r: 3e-3 }), r.box(u, 0.24, 0.3, 0.02, I / 2, U - 0.05, -0.02, { r: 4e-3 }), r.add(labelFor(mats, "WIRING DIAGRAM  SLT-R4", { color: "white", font: "sans", distress: 0.1 }).material, placeGeo(plane(0.2, 0.03), I / 2, U + 0.03, -0.0305, [0, Math.PI, 0]), null, true);
    for (let ce of [U + 0.36, U - 0.4]) r.add(c, placeGeo(plane(I - 0.14, 0.3), I / 2, ce, -0.0125, [0, Math.PI, 0]), x);
    r.decal(labelFor(mats, "ISOLATE BEFORE SERVICE", { color: "white", font: "sans", distress: 0.15 }), 0.03, I / 2, U - 0.03, 0.018, null, I - 0.1);
    for (let ce of [-1, 1]) {
      o.box(h, 0.012, 0.98, 0.5, ce * 0.506, 1.06, 0, { r: 3e-3 });
      for (let P = -6; P <= 6; P++) o.add(h, placeGeo(box(0.06, 0.94, 7e-3), ce * 0.54, 1.06, P * 0.038));
      o.box(c, 0.075, 0.03, 0.52, ce * 0.54, 1.56, 0, { r: 6e-3 });
    }
    for (let ce = 0; ce < 3; ce++) {
      let P = -0.17 + ce * 0.17, D = 0.44 - ce * 0.02, B = 0.86 + ce * 0.07;
      o.tube(p, [[0.5, D, P], [0.6, D, P], [0.72 + ce * 0.04, D - 0.06, P], [B - 0.02, 0.16, P + 0.02], [B, -0.03, P + 0.02]], 0.04, { seg: 8, tension: 0.4 }), o.cyl(f, 0.055, 0.055, 0.05, 0.515, D, P, { seg: 8, flat: true, rot: [0, 0, Math.PI / 2] }), o.cyl(f, 0.06, 0.066, 0.03, B, 0.015, P + 0.02, { seg: 8 });
    }
    o.tube(p, [[-0.3, 0.35, M], [-0.3, 0.33, M - 0.1], [-0.34, 0.2, M - 0.2], [-0.5, 0.165, M - 0.3], [-0.9, 0.02, M - 0.36], [-1.5, 0.018, M - 0.2]], 0.022, { seg: 6 }), o.box(u, 0.3, 0.22, 0.1, 0.2, 0.75, M - 0.05, { r: 0.012 }), o.tube(p, [[0.2, 0.86, M - 0.06], [0.2, 1.2, M - 0.04], [-0.1, 1.55, M - 0.03], [-0.3, 1.66, -0.16]], 0.012, { seg: 5 });
    let A = -0.3, F = -0.14, H = E + 0.05, N = 2.5, Z = [0, 1, 2].map((ce) => [A + Math.cos(ce * 2.094 + 0.52) * 0.085, F + Math.sin(ce * 2.094 + 0.52) * 0.085]);
    o.box(f, 0.24, 0.012, 0.24, A, H + 6e-3, F, { r: 0 });
    for (let ce = 0; ce < 3; ce++) {
      let P = Z[ce], D = Z[(ce + 1) % 3];
      o.bar(f, [P[0], H, P[1]], [P[0], N, P[1]], 0.011, { seg: 6 });
      let B = 5, X = (N - H) / B;
      for (let re = 0; re < B; re++) o.bar(f, [P[0], H + re * X, P[1]], [D[0], H + (re + 1) * X, D[1]], 5e-3, { seg: 4 }), o.bar(f, [P[0], H + (re + 1) * X, P[1]], [D[0], H + (re + 1) * X, D[1]], 5e-3, { seg: 4 });
    }
    o.cyl(f, 0.11, 0.11, 0.014, A, N + 7e-3, F, { seg: 10 }), o.cyl(u, 0.05, 0.06, 0.1, A, N + 0.06, F, { seg: 10 });
    let Q = (ce, P, D) => {
      o.cyl(u, 0.016, 0.02, 0.07, ce, E + 0.085, P, { seg: 8 }), o.cyl(f, 0.011, 0.011, 0.06, ce, E + 0.15, P, { seg: 6 }), o.bar(u, [ce, E + 0.17, P], [ce + 0.02, D, P - 0.015], 5e-3, { r2: 18e-4, seg: 5, caps: true });
    };
    Q(0.4, -0.24, 3.15), Q(0.26, -0.24, 2.72), o.cyl(u, 0.03, 0.03, 0.26, 0.42, E + 0.18, 0.18, { seg: 8 }), o.add(u, placeGeo(sphereSlice(0.03, 8, 4, Math.PI * 2, 0, Math.PI / 2), 0.42, E + 0.31, 0.18));
    let W = lathe([[0, 0], [0.06, 6e-3], [0.12, 0.024], [0.18, 0.054], [0.215, 0.078], [0.222, 0.078], [0.185, 0.05], [0.12, 0.016], [0.06, -3e-3], [0, -0.01]], 18);
    W.computeVertexNormals(), l.add(h, placeGeo(W, 0, 0.3, 0.02, [Math.PI / 2 - 0.12, 0, 0])), l.cyl(h, 0.022, 0.03, 0.2, 0, 0.1, 0, { seg: 8 }), l.box(h, 0.07, 0.1, 0.06, 0, 0.26, -0.02, { r: 0.01 });
    for (let ce of [0.5, 2.6, 4.7]) l.bar(h, [Math.cos(ce) * 0.2, 0.3 + Math.sin(ce) * 0.2, 0.09], [0, 0.325, 0.25], 45e-4, { seg: 4 });
    l.cyl(h, 0.022, 0.016, 0.05, 0, 0.325, 0.25, { seg: 8, rot: [Math.PI / 2, 0, 0] });
    let J = [A, N + 0.11, F];
    o.box(u, 0.9, 0.07, 0.03, 0, E - 0.06, _ + 0.012, { r: 8e-3 }), a.add(v, placeGeo(plane(0.84, 0.036), 0, E - 0.06, _ + 0.0275));
    for (let ce = 1; ce < 6; ce++) o.add(u, placeGeo(box(8e-3, 0.05, 6e-3), -0.42 + ce * 0.14, E - 0.06, _ + 0.028));
    o.box(u, 0.6, 0.06, 0.03, 0, E - 0.06, M - 0.012, { r: 8e-3 }), a.add(v, placeGeo(plane(0.54, 0.03), 0, E - 0.06, M - 0.0275, [0, Math.PI, 0]));
    for (let ce of [-1, 1]) o.box(u, 0.03, 1.2, 0.03, ce * 0.5, 0.86, _, { r: 8e-3, rot: [0, Math.PI / 4, 0] }), a.add(v, placeGeo(plane(0.014, 1.14), ce * 0.5, 0.86, _ + 0.0215, [0, ce * Math.PI / 4, 0]).translate(ce * 0.0152, 0, 0)), a.add(v, placeGeo(plane(0.014, 0.9), ce * 0.5715, 1.06, 0.262, [0, ce * Math.PI / 2, 0]));
    for (let ce of [-1, 1]) o.box(u, 0.03, 0.06, 0.46, ce * 0.587, E - 0.01, 0, { r: 8e-3 }), a.add(v, placeGeo(plane(0.4, 0.032), ce * 0.6025, E - 0.01, 0, [0, ce * Math.PI / 2, 0]));
    o.cyl(u, 0.028, 0.028, 0.02, A + 0.2, E + 0.06, F, { seg: 8 }), o.bar(f, [A + 0.2, E + 0.06, F], [A + 0.2, 2.64, F], 9e-3, { seg: 6 }), a.add(v, placeGeo(cyl(0.045, 0.045, 0.1, 10), A + 0.2, 2.69, F)), o.cyl(u, 0.05, 0.05, 0.014, A + 0.2, 2.747, F, { seg: 10 }), o.cyl(u, 0.05, 0.05, 0.014, A + 0.2, 2.633, F, { seg: 10 }), o.decal(decalFor(mats, "rust_run"), 0.5, 0.5135, 0.3, 0.2, [0, Math.PI / 2, 0], 0.14), o.decal(decalFor(mats, "grime_streak"), 0.6, -0.2, 1.2, M - 1e-3, [0, Math.PI, 0], 0.2);
    let G = o.toGroup(), te = new THREE.Group();
    te.userData.noMerge = true, te.name = "relay_dynamic", G.add(te);
    let oe = mats.emissive(16752680, 4);
    oe = oe.clone();
    let ee = new THREE.Mesh(mergeGeos(a.buckets.get(v).geos), oe);
    ee.userData.noMerge = true, te.add(ee);
    let le = r.toGroup().children.slice();
    for (let ce of le) ce.position.set(C[0], C[1], C[2]), ce.userData.noMerge = true, te.add(ce);
    let xe = l.toGroup().children.slice();
    for (let ce of xe) ce.position.set(J[0], J[1], J[2]), ce.userData.noMerge = true, te.add(ce);
    let j = new THREE.Color(), O = (ce, P) => {
      if (oe.userData && typeof oe.userData.setEmissive == "function") {
        oe.userData.setEmissive(ce, P);
        return;
      }
      oe.emissive && oe.emissive.isColor && oe.isMeshStandardMaterial ? (oe.emissive.copy(ce), oe.emissiveIntensity = P) : oe.uniforms && oe.uniforms.color && oe.uniforms.color.value && oe.uniforms.color.value.isColor ? (oe.uniforms.color.value.copy(ce).multiplyScalar(P), oe.uniforms.intensity && (oe.uniforms.intensity.value = 1)) : oe.color && oe.color.isColor && oe.color.copy(ce).multiplyScalar(P);
    }, q = "live", ue = t % 7 * 0.9, de = 0, $ = 0.7, se = 0, fe = 0, me = 0, ge = G.userData;
    if (ge.state = q, ge.beacon = [A + 0.2, 2.68, F], ge.interact = [0, 1, 0.75], ge.emissiveMaterial = oe, ge.level = 0, ge.setState = (ce) => {
      ce !== "live" && ce !== "cutting" && ce !== "cut" || ce !== q && (q = ce, ge.state = ce, ce === "cut" && (de = 0, me = 1.32, fe = 2.5), ce === "live" && (me = 0));
    }, ge.update = (ce) => {
      ce = Math.min(ce || 0, 0.1), ue += ce;
      let P = 0, D = LAMP_WARM, B = 0.7;
      if (q === "live") P = 5.5 + 3 * Math.sin(ue * 2.2);
      else if (q === "cutting") {
        let X = Math.sin(ue * 2 * Math.PI * 5.5) > 0;
        P = X ? 9 : 0.5, D = X ? LAMP_RED : LAMP_WARM, B = 2.6 + Math.sin(ue * 9) * 1.5;
      } else if (de += ce, D = LAMP_AMBER, B = 0, de < 0.3) P = 9;
      else if (de < 2.6) {
        let X = 1 - (de - 0.3) / 2.3;
        P = 7 * X * X * (Math.sin(de * 37) * Math.sin(de * 13.3) > -0.2 ? 1 : 0.08);
      } else P = 0;
      if (ge.level = P, O(j.copy(D), P), $ += (B - $) * Math.min(1, ce * (q === "cut" ? 1.6 : 3)), Math.abs($) > 1e-3) for (let X of xe) X.rotateY($ * ce);
      if (Math.abs(me - se) > 1e-4 || Math.abs(fe) > 1e-3) {
        fe += (-(se - me) * 30 - fe * 3.2) * ce;
        let X = se + fe * ce;
        X < 0 && (X = 0, fe = Math.abs(fe) * 0.3), X > 1.9 && (X = 1.9, fe = -Math.abs(fe) * 0.4);
        let re = X - se;
        se = X;
        for (let Y of le) Y.rotateY(-re);
      }
    }, e.state === "cut") {
      ge.setState("cut");
      for (let ce = 0; ce < 80; ce++) ge.update(0.05);
    } else e.state === "cutting" && ge.setState("cutting"), ge.update(0), q === "live" && O(j.copy(LAMP_WARM), 6);
    return finalizeProp(G, "relay_node", PROP_SPECS.relay_node.slice(0, 3), [{ min: [-0.68, 0, -0.48], max: [0.68, 0.16, 0.48], surface: "concrete" }, { min: [-0.57, 0.16, -0.32], max: [0.57, 1.67, 0.33], surface: "metal" }, { min: [-0.42, 1.67, -0.26], max: [-0.18, 2.5, -0.02], surface: "metal", bulletOnly: true }]);
  }


// ---------------------------------------------------------------------------
// 导出：世界固定设施（带碰撞盒）
export const FIXTURE_NAMES = ['jersey_barrier', 'light_mast', 'fence_panel', 'guard_booth', 'gate_arm', 'bollard_mooring', 'bollard_post', 'sign_post', 'floodlight_stand', 'stairs_metal', 'catwalk', 'shelf_rack', 'reefer_unit', 'relay_node'];

export function createJerseyBarrier(opts = {}) {
  return buildJerseyBarrier(opts.materials || defaultMaterials, opts);
}

export function createLightMast(opts = {}) {
  return buildLightMast(opts.materials || defaultMaterials, opts);
}

export function createFencePanel(opts = {}) {
  return buildFencePanel(opts.materials || defaultMaterials, opts);
}

export function createGuardBooth(opts = {}) {
  return buildGuardBooth(opts.materials || defaultMaterials, opts);
}

export function createGateArm(opts = {}) {
  return buildGateArm(opts.materials || defaultMaterials, opts);
}

export function createBollardMooring(opts = {}) {
  return buildBollardMooring(opts.materials || defaultMaterials, opts);
}

export function createBollardPost(opts = {}) {
  return buildBollardPost(opts.materials || defaultMaterials, opts);
}

export function createSignPost(opts = {}) {
  return buildSignPost(opts.materials || defaultMaterials, opts);
}

export function createFloodlightStand(opts = {}) {
  return buildFloodlightStand(opts.materials || defaultMaterials, opts);
}

export function createStairsMetal(opts = {}) {
  return buildStairsMetal(opts.materials || defaultMaterials, opts);
}

export function createCatwalk(opts = {}) {
  return buildCatwalk(opts.materials || defaultMaterials, opts);
}

export function createShelfRack(opts = {}) {
  return buildShelfRack(opts.materials || defaultMaterials, opts);
}

export function createReeferUnit(opts = {}) {
  return buildReeferUnit(opts.materials || defaultMaterials, opts);
}

export function createRelayNode(opts = {}) {
  return buildRelayNode(opts.materials || defaultMaterials, opts);
}

const FIXTURE_FACTORIES = new Map([
  ['jersey_barrier', createJerseyBarrier],
  ['light_mast', createLightMast],
  ['fence_panel', createFencePanel],
  ['guard_booth', createGuardBooth],
  ['gate_arm', createGateArm],
  ['bollard_mooring', createBollardMooring],
  ['bollard_post', createBollardPost],
  ['sign_post', createSignPost],
  ['floodlight_stand', createFloodlightStand],
  ['stairs_metal', createStairsMetal],
  ['catwalk', createCatwalk],
  ['shelf_rack', createShelfRack],
  ['reefer_unit', createReeferUnit],
  ['relay_node', createRelayNode],
]);

export function createFixture(name, opts = {}) {
  const f = FIXTURE_FACTORIES.get(name);
  if (!f) throw new Error(`[yardkit] unknown fixture "${name}"`);
  return f(opts);
}
