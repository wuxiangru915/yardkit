import * as THREE from 'three';
import {
  bevelBox, tube, roundPoly2D, extrudeX, extrudeZ, latheSection, loftSections,
  prepCadGeo, mergeGeos, clamp,
} from './geo.js';
import { defaultMaterials } from './materials.js';

const HALF_PI = Math.PI / 2;

const roundRect2D = (x0, y0, x1, y1, r, s = 2) => roundPoly2D([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r, s);

const stadium2D = (cx, cy, len, h, s = 4) => {
  const pts = [], r = h / 2, hw = len / 2 - r;
  for (let i = 0; i <= s; i++) {
    const a = -HALF_PI + (i / s) * Math.PI;
    pts.push([cx + hw + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  for (let i = 0; i <= s; i++) {
    const a = HALF_PI + (i / s) * Math.PI;
    pts.push([cx - hw + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
};

const circle2D = (cx, cy, r, seg = 10) => {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
};

const roundedSlot2D = (hw, top, bot, rTop, rBot, seg = 3) => {
  const pts = [];
  const arc = (cx, cy, r, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * HALF_PI;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  arc(-hw + rBot, top + rBot, rBot, Math.PI);
  arc(hw - rBot, top + rBot, rBot, Math.PI * 1.5);
  arc(hw - rTop, bot - rTop, rTop, 0);
  arc(-hw + rTop, bot - rTop, rTop, HALF_PI);
  return pts;
};

const placeSec = (pts, z, { sx = 1, sy = 1, dx = 0, dy = 0, cy = 0, rake = 0 } = {}) =>
  pts.map((p) => [p[0] * sx + dx, (p[1] - cy) * sy + cy + dy, -z + rake * p[1]]);

const cadBox = (w, h, d, r, x, y, z, col, opts = {}, rot = null) => {
  const g = prepCadGeo(bevelBox(w, h, d, r), col, { keepN: true, ...opts });
  if (rot) {
    const e = new THREE.Euler(rot[0], rot[1], rot[2]);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
  }
  g.translate(x, y, -z);
  return g;
};

const pinX = (len, d, x, y, z, col, seg = 12, opts = {}) => {
  const bev = Math.min(len * 0.25, d * 0.25);
  const c = d / 2;
  const g = latheSection([[0, -c], [len - bev, -c], [len, -c + bev], [len, c - bev], [len - bev, c], [0, c]], seg, col, opts);
  g.rotateY(HALF_PI);
  g.translate(x, y, -z);
  return g;
};

const pinZ = (len, y0, y1, ox, oy, col, seg = 8, opts = {}) => {
  const bev = Math.min(len * 0.25, (y1 - y0) * 0.25);
  return latheSection([[0, y0], [len - bev, y0], [len, y0 + bev], [len, y1 - bev], [len - bev, y1], [0, y1]], seg, col, { ...opts, ox, oy });
};

const pinY = (len, d, x, y, z, col, seg = 8, opts = {}) => {
  const g = pinZ(len, -d / 2, d / 2, 0, 0, col, seg, opts);
  g.rotateX(HALF_PI);
  g.translate(x, y, -z);
  return g;
};

function flipWinding(geo) {
  const pos = geo.attributes.position.array;
  const nrm = geo.attributes.normal.array;
  const col = geo.attributes.color.array;
  const swap = (arr, a, b, stride) => {
    for (let k = 0; k < stride; k++) {
      const t = arr[a * stride + k];
      arr[a * stride + k] = arr[b * stride + k];
      arr[b * stride + k] = t;
    }
  };
  for (let i = 0; i < pos.length / 3; i += 3) {
    swap(pos, i + 1, i + 2, 3);
    swap(nrm, i + 1, i + 2, 3);
    swap(col, i + 1, i + 2, 3);
  }
}

function createHoloLens(windowPts, zPos) {
  const shape = new THREE.Shape();
  windowPts.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.translate(0, 0, -zPos);

  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of windowPts) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), (pos.getY(i) - y0) / (y1 - y0));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uBright: { value: 6.5 },
      uSun: { value: new THREE.Vector3(-0.55, 0.35, 0.75).normalize() },
      uSunCol: { value: new THREE.Color(1.0, 0.78, 0.56) },
      uZen: { value: new THREE.Color(0.16, 0.22, 0.28) },
      uHor: { value: new THREE.Color(0.75, 0.54, 0.34) },
      uTilt: { value: 0.1 },
    },
    vertexShader: `
      varying vec3 vView, vFwd, vRight, vUp, vWPos, vWN;
      varying vec2 vUv;
      uniform float uTilt;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = mv.xyz;
        vFwd = (modelViewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz;
        vRight = (modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz;
        vUp = (modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
        vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * normalize(vec3(0.0, -uTilt, 1.0)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vView, vFwd, vRight, vUp, vWPos, vWN;
      varying vec2 vUv;
      uniform float uBright;
      uniform vec3 uSun, uSunCol, uZen, uHor;
      void main() {
        vec3 d = normalize(vView), fw = normalize(vFwd);
        float k = max(dot(d, fw), 1e-3);
        vec2 a = vec2(dot(d, normalize(vRight)), dot(d, normalize(vUp))) / k;
        float r = length(a), px = max(fwidth(r), 1e-5);
        float dotR = max(0.0012, px * 0.9), ringW = max(0.0005, px * 0.6);
        float dotI = 1.0 - smoothstep(dotR - px, dotR + px, r);
        float ring = 1.0 - smoothstep(ringW - px * 0.5, ringW + px, abs(r - 0.0128));
        float tick = (1.0 - smoothstep(0.0, px * 1.2 + 0.0004, min(abs(a.x), abs(a.y)))) * step(0.0128, r) * (1.0 - smoothstep(0.0165, 0.0175, r));
        float ret = clamp(dotI + ring * 0.8 + tick * 0.8, 0.0, 1.0);
        vec3 retCol = vec3(1.0, 0.12, 0.05) * ret * uBright;

        vec3 wv = normalize(vWPos - cameraPosition);
        vec3 n = normalize(vWN);
        if (dot(n, wv) > 0.0) n = -n;
        vec3 rf = reflect(wv, n);
        float fres = pow(1.0 - abs(dot(wv, n)), 3.0);
        vec3 sky = mix(uHor, uZen, clamp(rf.y * 1.4 + 0.2, 0.0, 1.0));
        float sd = max(dot(rf, uSun), 0.0);
        sky += uSunCol * (pow(sd, 6.0) * 0.5 + pow(sd, 60.0) * 3.0);
        vec3 coat = mix(vec3(0.28, 0.55, 0.92), vec3(0.95, 0.58, 0.26), clamp(fres * 2.0 + vUv.y * 0.7, 0.0, 1.0));
        vec2 e = abs(vUv - 0.5) * 2.0;
        float edge = smoothstep(0.90, 1.0, max(e.x, e.y));
        vec3 col = (sky + vec3(0.04)) * coat * (0.14 + 0.55 * fres) * (1.0 - edge) + retCol;
        float alpha = clamp(0.22 + 0.35 * fres + 0.55 * edge + ret * 0.8, 0.0, 0.95);
        gl_FragColor = vec4(col, alpha);
      }`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  return mesh;
}

function makeWeaponMat(name, rgb, roughness, metalness) {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    roughness,
    metalness,
    vertexColors: true,
  });
  m.name = name;
  return m;
}

// ============================================================================
// PAC-9 "Longshore" Tactical Carbine
// ============================================================================

export const PAC9_SPECS = {
  name: 'PAC-9 Longshore',
  muzzle: [0, 0, -0.531],
  eject: [0.023, 0.004, -0.028],
  sightY: 0.069,
  lensF: 0.0285,
  window: [[-0.016, 0.057], [0.016, 0.057], [0.016, 0.0772], [0.0122, 0.081], [-0.0122, 0.081], [-0.016, 0.0772]],
  magPos: [0, -0.02, -0.0665],
  boltTravel: 0.062,
  handguardR: 0.021,
};

let _pac9Geos = null;

function buildPAC9Geos() {
  if (_pac9Geos) return _pac9Geos;

  const cAno = [1, 1, 1];
  const cLower = [1.12, 1.04, 0.98];
  const cGuard = [0.88, 0.94, 1.04];
  const cOptic = [0.82, 0.82, 0.86];
  const cLaser = [0.94, 0.92, 0.88];
  const cTube = [1.22, 1.18, 1.14];
  const cSteel = [1, 1, 1];
  const cPin = [2.2, 2.2, 2.3];
  const cHole = [0.3, 0.3, 0.31];
  const cPoly = [1, 1, 1];
  const cPad = [0.05, 0.05, 0.055];
  const cGlassRim = [0.04, 0.04, 0.045];

  const ano = [], gun = [], poly = [], plain = [], bolt = [], mag = [], round = [];
  const hwU = 0.0176, hwL = 0.0163, wall = 0.0012;

  // Upper receiver + ejection port + Picatinny top rail
  const upProf = roundPoly2D([[-0.1, -0.02], [0.1, -0.02], [0.1, 0.0245], [-0.1, 0.0245]], 8e-4, 1);
  const ejWin = stadium2D(0.032, 0.007, 0.112, 0.0075, 4);
  const leftSlot = roundRect2D(-0.012, -0.01, 0.06, 0.012, 0.003, 2);

  ano.push(extrudeX(upProf, 0, hwU - wall + 1e-4, 5e-4, cAno, { ao: 0.28, holes: [leftSlot] }));
  ano.push(extrudeX(upProf, -(hwU - wall + 1e-4), 0, 5e-4, cAno, { ao: 0.28, holes: [ejWin] }));
  ano.push(extrudeX(upProf, -hwU, -(hwU - wall), 45e-5, cAno, { holes: [ejWin, roundRect2D(-0.094, -0.015, -0.033, 0.017, 0.0022), roundRect2D(-0.0225, -0.0155, 0.093, -8e-4, 0.0022)] }));
  ano.push(extrudeX(upProf, hwU - wall, hwU, 45e-5, cAno, { holes: [leftSlot, roundRect2D(0.0675, -0.015, 0.094, 0.017, 0.0022), roundRect2D(-0.094, -0.0155, -0.04, -0.004, 0.0022)] }));

  // Sloped upper spine loft
  {
    const w = hwU + 4e-4;
    const spine = (y, x, e) => roundPoly2D([[-w, 0.0226], [w, 0.0226], [w, e], [x, y], [-x, y], [-w, e]], 7e-4, 1);
    ano.push(loftSections([
      placeSec(spine(0.0252, 0.015, 0.024), -0.1004),
      placeSec(spine(0.0335, 0.011, 0.0262), -0.0885),
      placeSec(spine(0.0335, 0.011, 0.0262), 0.0935),
      placeSec(spine(0.0276, 0.0142, 0.025), 0.1004),
    ], cAno));
  }

  // Dust cover / brass deflector / forward assist / charging latches
  gun.push(cadBox(0.0034, 0.036, 0.19, 4e-4, -0.0116, 0.006, 0, cHole, { ao: 0.75 }));
  gun.push(cadBox(0.0034, 0.012, 0.19, 4e-4, 0.0125, 0.022, 0, cHole, { ao: 0.75 }));
  gun.push(cadBox(0.0034, 0.008, 0.19, 4e-4, 0.0125, -0.014, 0, cHole, { ao: 0.75 }));
  gun.push(cadBox(0.02, 0.001, 0.196, 2e-4, 0, -0.0203, 0, cHole, { ao: 0.75 }));
  gun.push(latheSection([[0, 0.058], [0.0118, 0.058], [0.0118, 0.099], [0, 0.099]], 16, [0.8, 0.8, 0.82]));

  ano.push(extrudeX(roundPoly2D([[-0.04, -0.008], [-0.0165, -0.011], [-0.0145, 0.013], [-0.034, 0.016]], 0.002, 2), hwU - 0.001, hwU + 0.0052, 0.0022, cAno, { bs: 2 }));
  ano.push(latheSection([[0, -0.086], [0.0058, -0.086], [0.0066, -0.0845], [0.0066, -0.06], [0.004, -0.0565], [0, -0.0565]], 14, cAno, { ox: 0.0182, oy: 0.012 }));
  gun.push(latheSection([[0, -0.0945], [0.004, -0.0945], [0.0048, -0.0935], [0.0048, -0.0905], [0.0042, -0.09], [0.0042, -0.0885], [0.0048, -0.088], [0.0048, -0.086], [0, -0.086]], 12, cSteel, { ox: 0.0182, oy: 0.012 }));
  gun.push(cadBox(0.0016, 0.02, 0.07, 5e-4, hwU + 0.0042, -0.0212, 0.024, cSteel, {}, [0, 0, 0.3]));
  gun.push(cadBox(0.0012, 0.013, 0.056, 4e-4, hwU + 0.0056, -0.0208, 0.024, cSteel, {}, [0, 0, 0.3]));
  gun.push(pinZ(0.0015, -0.014, 0.062, hwU + 0.0012, -0.0116, cPin, 8));
  for (const pz of [-0.0115, 0.0245, 0.0595]) gun.push(pinZ(0.0023, pz - 0.0035, pz + 0.0035, hwU + 0.0012, -0.0116, cSteel, 8));
  gun.push(pinX(0.0016, 0.0016, hwU + 0.0068, -0.0285, 0.024, cPin, 8));
  for (const pz of [-0.06, -0.072]) gun.push(pinX(0.0019, 8e-4, -hwU + wall - 2e-4, 0.011, pz, cHole, 8));

  // Picatinny top rail teeth
  const railBase = [[-0.0078, 0.0333], [0.0078, 0.0333], [0.0106, 0.0402], [-0.0106, 0.0402]];
  ano.push(extrudeZ(railBase, -0.096, 0.1003, 4e-4, cAno, { ao: 0.42 }));
  ano.push(extrudeZ(railBase, 0.1008, 0.397, 4e-4, cGuard, { ao: 0.42 }));
  const toothProf = roundPoly2D([[-0.0102, 0.0398], [0.0102, 0.0398], [0.0106, 0.0408], [0.008, 0.0435], [-0.008, 0.0435], [-0.0106, 0.0408]], [0, 0, 3e-4, 5e-4, 5e-4, 3e-4], 1);
  const toothU = extrudeZ(toothProf, 0, 0.00478, 6e-4, cAno);
  const toothG = extrudeZ(toothProf, 0, 0.00478, 6e-4, cGuard);
  for (let i = 0; i < 49; i++) {
    const z = -0.0945 + i * 0.01001;
    ano.push((z < 0.1 ? toothU : toothG).clone().translate(0, 0, -z));
  }

  // Lower receiver, magwell & trigger guard
  const lowProf = roundPoly2D([[-0.1, -0.0203], [0.099, -0.0203], [0.101, -0.03], [0.098, -0.088], [0.036, -0.082], [0.031, -0.058], [-0.03, -0.058], [-0.04, -0.066], [-0.078, -0.055], [-0.1, -0.044]], [8e-4, 8e-4, 0.004, 0.003, 0.003, 0.004, 0.004, 0.004, 0.006, 0.003], 2);
  ano.push(extrudeX(lowProf, -(hwL - wall + 1e-4), hwL - wall + 1e-4, 5e-4, cLower, { ao: 0.28 }));
  for (const s of [-1, 1]) {
    const holes = [roundRect2D(0.0405, -0.077, 0.0945, -0.0265, 0.003), circle2D(-0.048, -0.036, 0.0074, 14)];
    const side = extrudeX(lowProf, hwL - wall, hwL, 45e-5, cLower, { holes });
    if (s < 0) { side.scale(-1, 1, 1); flipWinding(side); }
    ano.push(side);
  }
  ano.push(cadBox(0.0372, 0.0095, 0.0665, 0.0022, 0, -0.0838, 0.0668, cLower, {}, [-0.095, 0, 0]));
  ano.push(cadBox(0.0348, 0.05, 0.0044, 0.001, 0, -0.053, 0.099, cLower));
  for (let i = 0; i < 7; i++) ano.push(cadBox(0.024, 0.003, 0.0016, 6e-4, 0, -0.0345 - i * 0.006, 0.1012 - i * 3e-4, cLower));
  ano.push(cadBox(0.0348, 0.038, 0.0044, 0.001, 0, -0.048, 0.0345, cLower));
  for (const [pz, py] of [[0.087, -0.029], [-0.086, -0.031]]) {
    gun.push(pinX(0.0036, 0.0336, 0, py, pz, cPin, 12));
    gun.push(pinX(0.005, 0.0016, hwL + 0.0012, py, pz, cSteel, 14));
  }
  gun.push(pinX(0.0021, 0.0334, 0, -0.04, 0.012, cPin, 10));
  gun.push(pinX(0.0021, 0.0334, 0, -0.032, 0.032, cPin, 10));
  for (const s of [-1, 1]) {
    gun.push(pinX(0.0062, 0.003, s * (hwL + 2e-4), -0.036, -0.048, cSteel, 16));
    gun.push(cadBox(0.0036, 0.0058, 0.022, 0.0014, s * (hwL + 0.0026), -0.036, -0.037, cSteel, {}, [0.5, 0, 0]));
  }
  // Bolt catch & trigger guard + trigger
  gun.push(extrudeX(roundPoly2D([[0.0155, -0.019], [0.0285, -0.019], [0.029, -0.033], [0.025, -0.0415], [0.019, -0.0415], [0.015, -0.033]], 0.0015, 1), -hwL - 0.0032, -hwL + 2e-4, 9e-4, cSteel));
  ano.push(extrudeX(roundPoly2D([[0.004, -0.0325], [0.029, -0.0335], [0.029, -0.053], [0.004, -0.053], [0.004, -0.05], [0.0245, -0.05], [0.0245, -0.0365], [0.004, -0.036]], 8e-4, 1), hwL - 4e-4, hwL + 0.003, 0.001, cLower));
  ano.push(extrudeX(roundPoly2D([[0.033, -0.056], [0.033, -0.093], [0.024, -0.1005], [-0.031, -0.1005], [-0.041, -0.09], [-0.041, -0.06]], 0.003, 2), -0.007, 0.007, 0.0014, cLower, {
    bs: 2, holes: [roundPoly2D([[0.029, -0.059], [0.029, -0.0915], [0.0225, -0.0968], [-0.0295, -0.0968], [-0.0372, -0.0885], [-0.0372, -0.061]], 0.004, 3)],
  }));
  gun.push(extrudeX(roundPoly2D([[-0.006, -0.057], [0.004, -0.057], [0.003, -0.069], [0.0065, -0.079], [0.01, -0.086], [0.0065, -0.088], [0.001, -0.081], [-0.004, -0.07]], [0, 0, 0.004, 0.006, 8e-4, 8e-4, 0.006, 0.004], 2), -0.0031, 0.0031, 0.0011, cSteel, { bs: 2 }));

  // Pistol Grip
  const gripProf = roundPoly2D([[-0.038, -0.05], [-0.045, -0.074], [-0.049, -0.086], [-0.049, -0.1], [-0.054, -0.112], [-0.057, -0.13], [-0.064, -0.158], [-0.11, -0.152], [-0.102, -0.112], [-0.096, -0.082], [-0.095, -0.064], [-0.103, -0.046], [-0.08, -0.044]], [0.002, 0.006, 0.004, 0.004, 0.006, 0.008, 0.003, 0.004, 0.02, 0.02, 0.006, 0.003, 0.004], 2);
  poly.push(extrudeX(gripProf, -0.0142, 0.0142, 0.005, cPoly, { bs: 3 }));
  const gripText = roundPoly2D([[-0.0565, -0.085], [-0.061, -0.109], [-0.068, -0.149], [-0.101, -0.145], [-0.095, -0.112], [-0.09, -0.085]], 0.004, 2);
  for (const s of [-1, 1]) poly.push(extrudeX(gripText, s > 0 ? 0.0138 : -0.0146, s > 0 ? 0.0146 : -0.0138, 4e-4, cPoly));
  for (let i = 0; i < 7; i++) {
    const gy = -0.084 - i * 0.0098;
    poly.push(cadBox(0.015, 0.0034, 0.003, 0.0012, 0, gy, -0.0527 + (gy + 0.084) * 0.21, cPoly, {}, [-0.21, 0, 0]));
    const by = -0.078 - i * 0.01;
    poly.push(cadBox(0.016, 0.004, 0.0034, 0.0014, 0, by, -0.0962 + (by + 0.078) * 0.16, cPoly, {}, [-0.16, 0, 0]));
  }
  poly.push(cadBox(0.03, 0.0056, 0.049, 0.002, 0, -0.1568, -0.087, cPoly, {}, [0.13, 0, 0]));

  // Octagonal M-LOK Handguard & Vertical Foregrip
  const hgR = PAC9_SPECS.handguardR, stripHalf = 0.00885, stripT = 0.0028, hg0 = 0.101, hg1 = 0.398;
  const stripRect = roundPoly2D([[hg0, -stripHalf], [hg1, -stripHalf], [hg1, stripHalf], [hg0, stripHalf]], 0.001, 1);
  for (let f = 0; f < 8; f++) {
    const holes = [];
    if (f === 0 || f === 4 || f === 6) for (let k = 0; k < 7; k++) holes.push(stadium2D(0.13 + k * 0.04, 0, 0.032, 0.007, 4));
    else if (f !== 2) for (let k = 0; k < 10; k++) { const sx = 0.124 + k * 0.027; if (!(f === 3 && sx > 0.3)) holes.push(stadium2D(sx, 0, 0.013, 0.0052, 3)); }
    const face = extrudeX(stripRect, hgR - stripT, hgR, 8e-4, cGuard, { holes });
    face.rotateZ((f * Math.PI) / 4);
    ano.push(face);
    const a = (f + 0.5) * (Math.PI / 4);
    ano.push(pinZ(0.003, hg0, hg1, Math.cos(a) * 0.0197, Math.sin(a) * 0.0197, cGuard, 8));
  }
  ano.push(extrudeZ(roundPoly2D([[-0.0088, 0.02], [0.0088, 0.02], [0.0106, 0.029], [0.0082, 0.0336], [-0.0082, 0.0336], [-0.0106, 0.029]], 8e-4, 1), 0.1012, 0.3978, 0.001, cGuard));
  ano.push(latheSection([[0.016, 0.096], [0.0236, 0.096], [0.0243, 0.0967], [0.0243, 0.101], [0.0236, 0.1016], [0.0236, 0.1062], [0.0228, 0.1075], [0.016, 0.1075]], 16, cGuard));
  for (const s of [-1, 1]) ano.push(cadBox(0.005, 0.015, 0.03, 0.0014, s * 0.0222, -0.003, 0.119, cGuard));
  ano.push(latheSection([[0.018, 0.3985], [0.0222, 0.3985], [0.0226, 0.399], [0.0226, 0.4004], [0.022, 0.4012], [0.018, 0.4012], [0.018, 0.3985]], 8, cGuard));

  // Handstop + Vertical Foregrip
  poly.push(extrudeX(roundPoly2D([[0.35, -0.026], [0.392, -0.026], [0.388, -0.036], [0.372, -0.05], [0.362, -0.05], [0.354, -0.036]], 0.003, 2), -0.011, 0.011, 0.0032, cPoly, { bs: 2 }));
  poly.push(extrudeX(roundPoly2D([[0.2395, -0.0215], [0.2725, -0.0215], [0.2725, -0.03], [0.27, -0.092], [0.2665, -0.0965], [0.2455, -0.0975], [0.242, -0.093], [0.2395, -0.03]], 0.0025, 2), -0.014, 0.014, 0.0045, cPoly, { bs: 3 }));
  for (let i = 0; i < 6; i++) poly.push(cadBox(0.0288, 0.0024, 0.0312, 0.001, 0, -0.04 - i * 0.0085, 0.256 - i * 3e-4, cPoly));
  poly.push(cadBox(0.03, 0.005, 0.04, 0.0016, 0, -0.024, 0.256, cPoly));

  // Barrel, Gas Block & Flash Hider
  gun.push(latheSection([[0.0115, 0.095], [0.0115, 0.15], [0.0095, 0.153], [0.0095, 0.285], [0.009, 0.288], [0.009, 0.322], [0.0086, 0.326], [0.0086, 0.435], [0.0092, 0.437], [0.0092, 0.453], [0.0075, 0.455], [0.0075, 0.461]], 20, cSteel));
  gun.push(latheSection([[0.0092, 0.286], [0.0135, 0.286], [0.0142, 0.2875], [0.0142, 0.3165], [0.0135, 0.318], [0.0092, 0.318]], 16, cSteel));
  gun.push(cadBox(0.014, 0.009, 0.03, 0.002, 0, 0.0145, 0.302, cSteel));
  gun.push(pinZ(0.0026, 0.1, 0.3, 0, 0.0172, [6.5, 6.5, 6.8], 8));
  gun.push(latheSection([[0.0075, 0.459], [0.0104, 0.459], [0.0112, 0.4598], [0.0112, 0.4628], [0.0104, 0.4636], [0.0104, 0.4644], [0.011, 0.465], [0.0116, 0.4656], [0.0116, 0.477], [0.011, 0.478], [0.0052, 0.478]], 20, cSteel));
  gun.push(latheSection([[0.0052, 0.477], [0.0052, 0.517]], 12, cHole));
  for (const zf of [0.4865, 0.4965, 0.5065]) gun.push(latheSection([[0.0052, zf - 0.0019], [0.011, zf - 0.0019], [0.0116, zf - 0.0012], [0.0116, zf + 0.0012], [0.011, zf + 0.0019], [0.0052, zf + 0.0019]], 20, cSteel));
  gun.push(latheSection([[0.0052, 0.5145], [0.011, 0.5145], [0.0116, 0.5155], [0.0116, 0.527], [0.0102, 0.5305], [0.0062, 0.5305], [0.0048, 0.5285]], 20, cSteel));
  gun.push(latheSection([[0.0048, 0.5285], [0.0036, 0.526], [0.0036, 0.495]], 14, cHole));
  for (const s of [-1, 1]) gun.push(cadBox(0.0125, 0.0042, 0.042, 0.0012, 0, s * 0.0096, 0.496, cSteel));

  // Buffer tube, Castle nut, Endplate & Adjustable Stock
  ano.push(latheSection([[0, -0.292], [0.0138, -0.292], [0.0146, -0.291], [0.0146, -0.1]], 20, cTube));
  gun.push(latheSection([[0.0146, -0.122], [0.0183, -0.122], [0.019, -0.1212], [0.019, -0.112], [0.0183, -0.111], [0.0146, -0.111]], 12, cSteel, { crease: 20 }));
  poly.push(extrudeX(roundPoly2D([[-0.146, 0.024], [-0.3, 0.024], [-0.331, 0.014], [-0.334, -0.086], [-0.318, -0.101], [-0.29, -0.096], [-0.232, -0.04], [-0.146, -0.024]], [0.004, 0.02, 0.006, 0.006, 0.006, 0.02, 0.03, 0.006], 3), -hwL, hwL, 0.0042, cPoly, {
    bs: 3, holes: [roundPoly2D([[-0.262, -0.036], [-0.306, -0.036], [-0.306, -0.074], [-0.292, -0.074]], 0.005, 2), stadium2D(0.004, -0.3185, 0.022, 0.0055, 3).map((p) => [p[1], p[0]])],
  }));
  poly.push(loftSections([
    placeSec(roundedSlot2D(0.012, 0.0215, 0.033, 0.005, 0.001, 3), -0.158, { sy: 0.25, cy: 0.0215 }),
    placeSec(roundedSlot2D(0.0132, 0.0215, 0.0352, 0.0058, 0.001, 3), -0.166, { sy: 0.7, cy: 0.0215 }),
    placeSec(roundedSlot2D(0.0138, 0.0215, 0.0372, 0.0062, 0.001, 3), -0.184),
    placeSec(roundedSlot2D(0.0142, 0.0215, 0.038, 0.0064, 0.001, 3), -0.288),
    placeSec(roundedSlot2D(0.0138, 0.0215, 0.0372, 0.0062, 0.001, 3), -0.298, { sy: 0.7, cy: 0.0215 }),
    placeSec(roundedSlot2D(0.0128, 0.0215, 0.034, 0.005, 0.001, 3), -0.304, { sy: 0.25, cy: 0.0215 }),
  ], cPoly));
  plain.push(cadBox(0.0322, 0.12, 0.011, 0.0042, 0, -0.04, -0.3395, cPad));
  for (let i = 0; i < 9; i++) plain.push(cadBox(0.027, 0.004, 0.003, 0.001, 0, 0.004 - i * 0.011, -0.3455, cPad));

  // Holographic Red-Dot Sight Housing + Backup Irons
  const win = PAC9_SPECS.window, sy = PAC9_SPECS.sightY;
  ano.push(extrudeZ(roundPoly2D([[-0.015, 0.0436], [0.015, 0.0436], [0.015, 0.05], [0.0176, 0.053], [-0.0176, 0.053], [-0.015, 0.05]], 8e-4, 1), 0.001, 0.041, 0.001, cOptic));
  const hoodProf = roundPoly2D([[-0.0192, 0.0525], [0.0192, 0.0525], [0.0192, 0.0788], [0.0138, 0.0842], [-0.0138, 0.0842], [-0.0192, 0.0788]], [0.001, 0.001, 0.0022, 0.0022, 0.0022, 0.0022], 2);
  ano.push(extrudeZ(hoodProf, 0.008, 0.034, 0.0012, cOptic, { bs: 2, holes: [win] }));
  ano.push(cadBox(0.042, 0.0052, 0.03, 0.0012, 0, 0.0546, 0.021, cOptic));
  plain.push(extrudeZ(win.map((p) => [p[0] * 1.004, (p[1] - sy) * 1.004 + sy]), 0.0078, 0.0342, 0, cGlassRim, { holes: [win.map((p) => [p[0] * 0.982, (p[1] - sy) * 0.982 + sy])] }));
  // Front & Rear Flip-up Iron Sights
  for (const [iz, dir] of [[-0.03, 1], [0.372, -1]]) {
    gun.push(extrudeZ(roundPoly2D([[-0.0106, 0.0437], [0.0106, 0.0437], [0.0112, 0.0462], [0.009, 0.0508], [-0.009, 0.0508], [-0.0112, 0.0462]], 8e-4, 1), iz - 0.015, iz + 0.015, 8e-4, cSteel));
    gun.push(extrudeX(roundPoly2D([[iz - dir * 0.0165, 0.0506], [iz + dir * 0.0215, 0.0506], [iz + dir * 0.0215, 0.053], [iz + dir * 0.018, 0.0549], [iz - dir * 0.01, 0.0549], [iz - dir * 0.0165, 0.0532]], 8e-4, 1), -0.006, 0.006, 9e-4, cSteel));
  }

  // Tactical Laser Module + Pressure Switch Cable
  const lx = -0.0267, ly = 0.0267;
  ano.push(latheSection([[0, 0.308], [0.0095, 0.308], [0.0108, 0.3095], [0.0108, 0.322], [0.0118, 0.323], [0.0118, 0.378], [0.0128, 0.38], [0.0142, 0.382], [0.0142, 0.404], [0.0136, 0.406], [0.0142, 0.408], [0.0142, 0.412], [0.0128, 0.4135], [0.0118, 0.4135], [0.0112, 0.409]], 18, cLaser, { ox: lx, oy: ly }));
  plain.push(latheSection([[0.0112, 0.409], [0, 0.409]], 18, [0.1, 0.12, 0.14], { ox: lx, oy: ly }));
  plain.push(cadBox(0.0185, 0.0065, 0.07, 0.0025, 0, 0.0468, 0.214, cPad));
  plain.push(prepCadGeo(tube([[lx, ly, -0.308], [lx - 0.001, ly + 0.002, -0.296], [-0.0265, 0.0235, -0.284], [-0.0255, 0.0215, -0.272], [-0.0235, 0.027, -0.262], [-0.016, 0.04, -0.256], [-0.007, 0.0465, -0.252], [-0.002, 0.047, -0.247]], 0.0018, 6), cPad, { keepN: true }));

  // Reciprocating Bolt Carrier + Charging Handle
  bolt.push(latheSection([[0, -0.058], [0.0108, -0.058], [0.0114, -0.057], [0.0114, -0.01], [0.0106, -0.008], [0.0106, -0.002], [0.0114, 0], [0.0114, 0.046], [0.0098, 0.048], [0.0098, 0.056], [0.0058, 0.056], [0.0058, 0.06], [0, 0.06]], 16, [5.5, 5.5, 5.7], { oy: 0.001 }));
  bolt.push(cadBox(0.01, 0.0054, 0.014, 0.0015, -0.0142, 0.007, 0.078, cSteel));

  // Curved 30-Round Magazine + Brass Cartridge
  const magCurve = (y) => 1.5 * Math.pow(Math.max(0, y - 0.07), 2);
  const magSlope = (y) => 3 * Math.max(0, y - 0.07);
  const magProf = [], magLen = 0.212, segs = 12;
  for (let i = 0; i <= segs; i++) { const y = -0.004 + ((magLen + 0.004) * i) / segs; magProf.push([magCurve(y) + 0.0298, -y]); }
  for (let i = segs; i >= 0; i--) { const y = -0.004 + ((magLen + 0.004) * i) / segs; magProf.push([magCurve(y) - 0.0298, -y]); }
  mag.push(extrudeX(magProf, -0.0113, 0.0113, 0.0022, [1, 1, 1], { bs: 2, crease: 40 }));
  for (let i = 0; i < 8; i++) {
    const y = 0.082 + i * 0.0155;
    mag.push(cadBox(0.0244, 0.0056, 0.05, 0.0018, 0, -y, magCurve(y), [1, 1, 1], {}, [Math.atan(magSlope(y)), 0, 0]));
  }
  mag.push(cadBox(0.027, 0.009, 0.068, 0.003, 0, -magLen - 0.003, magCurve(magLen) + 0.001, [1, 1, 1], {}, [Math.atan(magSlope(magLen)), 0, 0]));

  const copper = [1.25, 0.72, 0.5];
  round.push(latheSection([[0, -0.02], [0.004, -0.02], [0.0047, -0.019], [0.0047, 0.01], [0.0034, 0.014], [0.0034, 0.018]], 12, [1, 1, 1], { ox: 0.002, oy: 0.0062 }));
  round.push(latheSection([[0.003, 0.018], [0.0029, 0.024], [0.0022, 0.03], [0.001, 0.0345], [0, 0.0352]], 12, copper, { ox: 0.002, oy: 0.0062 }));

  _pac9Geos = {
    ano: mergeGeos(ano),
    gun: mergeGeos(gun),
    poly: mergeGeos(poly),
    plain: mergeGeos(plain),
    bolt: mergeGeos(bolt),
    mag: mergeGeos(mag),
    round: mergeGeos(round),
  };
  return _pac9Geos;
}

export function createPAC9({ materials = defaultMaterials, animate = true } = {}) {
  const g = buildPAC9Geos();
  const mats = {
    ano: makeWeaponMat('pac9_anodised', [0.05, 0.055, 0.065], 0.38, 0.55),
    steel: makeWeaponMat('pac9_phosphate', [0.08, 0.082, 0.088], 0.46, 0.72),
    poly: makeWeaponMat('pac9_polymer', [0.07, 0.072, 0.078], 0.62, 0.05),
    tan: makeWeaponMat('pac9_polymer_tan', [0.28, 0.22, 0.14], 0.62, 0.05),
    plain: makeWeaponMat('pac9_matte', [0.4, 0.4, 0.42], 0.90, 0.02),
    brass: materials.get('brass', { vertexColors: true }),
  };

  const mk = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const root = new THREE.Group();
  root.name = 'pac9';
  root.add(mk(g.ano, mats.ano), mk(g.gun, mats.steel), mk(g.poly, mats.poly), mk(g.plain, mats.plain));

  const boltMesh = mk(g.bolt, mats.steel);
  root.add(boltMesh);

  const magGroup = new THREE.Group();
  magGroup.position.fromArray(PAC9_SPECS.magPos);
  magGroup.add(mk(g.mag, mats.tan), mk(g.round, mats.brass));
  root.add(magGroup);

  const lens = createHoloLens(
    PAC9_SPECS.window.map((p) => [p[0] * 1.01, (p[1] - PAC9_SPECS.sightY) * 1.01 + PAC9_SPECS.sightY]),
    PAC9_SPECS.lensF + 0.0025
  );
  root.add(lens);

  let tris = 0;
  root.traverse((o) => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });

  const update = (t = 0) => {
    if (!animate) return;
    // Periodic bolt cycle demo every 2.2s
    const cyc = (t % 2.2) / 2.2;
    const kick = cyc < 0.08 ? Math.sin((cyc / 0.08) * Math.PI) : 0;
    boltMesh.position.z = PAC9_SPECS.boltTravel * kick;
    root.position.z = 0.015 * kick;
    root.rotation.x = 0.03 * kick;
  };

  root.userData = {
    size: [0.06, 0.25, 0.88],
    tris: Math.round(tris),
    parts: { bolt: boltMesh, mag: magGroup, lens },
    update,
  };
  return root;
}

// ============================================================================
// PAC-4 "Bosun" Tactical Sidearm Pistol
// ============================================================================

export const PAC4_SPECS = {
  name: 'PAC-4 Bosun',
  slideTravel: 0.04,
  rake: 0.314,
  magPos: [0, -0.013, 0.0387],
  magLen: 0.1185,
  stopPivot: [0, -0.0165, -0.004],
  barrelPivot: [0, -0.01, 0],
};

let _pac4Geos = null;

function buildPAC4Geos() {
  if (_pac4Geos) return _pac4Geos;
  const hw = 0.0128, bot = -0.012, top = 0.011, sightTop = 0.0165, rail = 0.0074, flatY = 0.0046;
  const cSlide = [1, 1, 1], cPoly = [1, 1, 1], cSteel = [2.2, 2.2, 2.3], cHole = [0.3, 0.3, 0.31];
  const cPad = [0.06, 0.06, 0.065], cFrame = [1, 1, 1], cTrit = [1, 1, 1];

  const slideProf = (cut = 0, w = hw) => {
    const h = [
      [w - 8e-4, bot], [w, bot + 8e-4], [w, bot + 0.0022], [w - 55e-5, bot + 0.0027],
      [w - 55e-5, bot + 0.0041], [w, bot + 0.0046], [w - cut, bot + 0.0056],
      [w - cut, flatY - 0.001], [w, flatY], [rail + 7e-4, top - 8e-4], [rail, top],
    ];
    return h.concat(h.map((p) => [-p[0], p[1]]).reverse());
  };

  const slide = [], barrel = [], frame = [], steel = [], stop = [], plain = [], mag = [], round = [], dots = [];
  const T0 = slideProf(0), Tc = slideProf(65e-5);
  const serrate = (arr, z0, count, step = 0.0032, w = 0.0015) => {
    for (let i = 0; i < count; i++) {
      const z = z0 + i * step;
      arr.push(placeSec(T0, z - w / 2 - 35e-5, { rake: -0.245 }), placeSec(Tc, z - w / 2, { rake: -0.245 }), placeSec(Tc, z + w / 2, { rake: -0.245 }), placeSec(T0, z + w / 2 + 35e-5, { rake: -0.245 }));
    }
  };

  // Slide rear + serrations, mid ejection port cutout, front muzzle + serrations
  {
    const secs = [placeSec(T0, -0.082, { sx: 0.945, sy: 0.94, cy: -5e-4 }), placeSec(T0, -0.0811)];
    serrate(secs, -0.0735, 10);
    secs.push(placeSec(T0, -0.038), placeSec(T0, -0.0118));
    slide.push(loftSections(secs, cSlide, { crease: 38 }));
  }
  {
    const port = [...T0.slice(0, 6), ...T0.slice(11).filter((p) => p[0] < -0.005)];
    const polyPort = [...T0.slice(0, 6), [hw, -0.0011], [hw - 6e-4, -5e-4], [-0.0042, -5e-4], [-0.0042, top - 6e-4], [-0.0048, top], ...T0.slice(11).filter((p) => p[0] < -0.005)];
    slide.push(extrudeZ(polyPort, -0.012, 0.03, 4e-4, cSlide, { crease: 38 }));
    void port;
  }
  {
    const secs = [placeSec(T0, 0.0298), placeSec(T0, 0.056)];
    serrate(secs, 0.064, 6);
    secs.push(placeSec(T0, 0.088), placeSec(T0, 0.0975), placeSec(T0, 0.1018, { sx: 0.965, sy: 0.97, cy: 0.002 }), placeSec(T0, 0.104, { sx: 0.9, sy: 0.92, cy: 0.002 }));
    slide.push(loftSections(secs, cSlide, { crease: 38 }));
  }

  // Iron Sights & Tritium Dots
  const sightCol = [0.8, 0.8, 0.83];
  slide.push(extrudeZ(roundPoly2D([[-0.0092, top - 4e-4], [0.0092, top - 4e-4], [0.0092, sightTop - 0.0016], [0.0078, sightTop], [0.0019, sightTop], [0.0019, sightTop - 0.003], [-0.0019, sightTop - 0.003], [-0.0019, sightTop], [-0.0078, sightTop], [-0.0092, sightTop - 0.0016]], [0, 0, 6e-4, 6e-4, 0, 0, 0, 0, 6e-4, 6e-4], 1), -0.0755, -0.0655, 4e-4, sightCol));
  slide.push(extrudeX([[0.0885, top - 4e-4], [0.0975, top - 4e-4], [0.0935, sightTop], [0.0885, sightTop]], -0.0017, 0.0017, 3e-4, sightCol));
  slide.push(latheSection([[0.0082, 0.10405], [0.0067, 0.10405]], 16, [0.1, 0.1, 0.11]));
  slide.push(latheSection([[0.0036, 0.10405], [0.0029, 0.10405]], 10, [0.1, 0.1, 0.11], { oy: -0.0088 }));

  const makeDot = (r, x, y, z) => {
    const g = new THREE.CircleGeometry(r, 12);
    g.translate(x, y, z);
    return prepCadGeo(g, cTrit, { keepN: true });
  };
  for (const s of [-1, 1]) dots.push(makeDot(0.00105, s * 0.0052, sightTop - 0.0024, 0.0756));
  dots.push(makeDot(0.00115, 0, sightTop - 0.0019, -0.0884));

  // Barrel & Chamber Block
  barrel.push(latheSection([[0.0066, 0.026], [0.0066, 0.105], [0.0061, 0.1066], [0.0055, 0.1075], [0.0049, 0.1075], [0.0045, 0.1062]], 16, [3.2, 3.2, 3.3]));
  barrel.push(latheSection([[0.0045, 0.1062], [0.0045, 0.09], [0, 0.09]], 12, [0.25, 0.25, 0.25]));
  barrel.push(extrudeZ(roundPoly2D([[-0.0038, -4e-4], [0.009, -4e-4], [0.009, 0.0096], [0.008, 0.0106], [-0.003, 0.0106], [-0.0038, 0.0098]], 5e-4, 1), -0.0115, 0.0295, 5e-4, [3.6, 3.6, 3.8]));

  // Polymer Frame, Dust Cover, Picatinny Rail, Trigger Guard & Ergonomic Grip
  const frameProf = roundPoly2D([[0.098, -0.0126], [0.1, -0.015], [0.1, -0.027], [0.097, -0.03], [0.024, -0.03], [0.02, -0.033], [-0.026, -0.033], [-0.031, -0.04], [-0.084, -0.04], [-0.0875, -0.03], [-0.0885, -0.0126]], [6e-4, 0.0015, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.004, 8e-4], 2);
  frame.push(extrudeX(frameProf, -0.0127, 0.0127, 0.0016, cFrame, { bs: 2 }));
  {
    const frontSpine = [[-0.0262, -0.015], [-0.0275, -0.033], [-0.03, -0.037], [-0.0335, -0.06], [-0.0545, -0.125], [-0.056, -0.13]];
    const backSpine = [[-0.0895, -0.015], [-0.0915, -0.0222], [-0.0878, -0.03], [-0.085, -0.035], [-0.0885, -0.042], [-0.093, -0.062], [-0.101, -0.09], [-0.1085, -0.115]];
    const interp = (pts, y) => {
      let i = 0;
      while (i < pts.length - 2 && y < pts[i + 1][1]) i++;
      return pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * (y - pts[i][1])) / (pts[i + 1][1] - pts[i][1]);
    };
    const gripSecs = [];
    for (const [yf, yb, hwG, rF, rB] of [
      [-0.015, -0.015, 0.0124, 0.004, 0.004], [-0.0185, -0.0185, 0.013, 0.0055, 0.005],
      [-0.024, -0.024, 0.0137, 0.0068, 0.0062], [-0.031, -0.031, 0.0146, 0.0078, 0.008],
      [-0.04, -0.039, 0.015, 0.0082, 0.0096], [-0.06, -0.058, 0.015, 0.0084, 0.0102],
      [-0.08, -0.076, 0.015, 0.0084, 0.0104], [-0.1, -0.093, 0.015, 0.0084, 0.0104],
      [-0.118, -0.106, 0.015, 0.0082, 0.01], [-0.124, -0.1105, 0.0158, 0.008, 0.0096],
      [-0.13, -0.115, 0.0162, 0.0078, 0.0092], [-0.1308, -0.1158, 0.015, 0.007, 0.0084],
    ]) {
      const fx = interp(frontSpine, yf), bx = interp(backSpine, yb);
      const ring = roundedSlot2D(hwG, bx, fx, rF, rB, 4);
      gripSecs.push(ring.map((p) => [p[0], yb + ((yf - yb) * (p[1] - bx)) / (fx - bx), -p[1]]));
    }
    frame.push(loftSections(gripSecs, cFrame, { crease: 40 }));
  }
  frame.push(extrudeZ([[-0.0086, -0.0296], [0.0086, -0.0296], [0.01, -0.032], [-0.01, -0.032]], 0.038, 0.095, 4e-4, cFrame));
  {
    const railSlot = roundPoly2D([[-0.01, -0.0316], [0.01, -0.0316], [0.0106, -0.0326], [0.009, -0.0346], [-0.009, -0.0346], [-0.0106, -0.0326]], 4e-4, 1);
    for (let i = 0; i < 5; i++) { const z = 0.042 + i * 0.01001; frame.push(extrudeZ(railSlot, z, z + 0.00478, 6e-4, cFrame)); }
  }
  frame.push(extrudeX(roundPoly2D([[0.024, -0.029], [0.025, -0.056], [0.016, -0.0665], [-0.029, -0.0665], [-0.0345, -0.06], [-0.03, -0.032]], [0.001, 0.004, 0.004, 0.004, 0.003, 0.001], 2), -0.0075, 0.0075, 0.002, cFrame, {
    bs: 2, holes: [roundPoly2D([[0.0195, -0.0335], [0.02, -0.055], [0.014, -0.062], [-0.027, -0.062], [-0.03, -0.057], [-0.026, -0.0335]], 0.004, 3)],
  }));
  plain.push(cadBox(0.0222, 0.001, 0.0345, 2e-4, 0, -0.12585, -0.07526, cPad, {}, [-0.278, 0, 0]));

  // Trigger + Slide Stop + Steel Guide Rod + Pins
  steel.push(extrudeX(roundPoly2D([[-0.0065, -0.0325], [0.0012, -0.0325], [6e-4, -0.042], [0.003, -0.05], [0.0056, -0.0565], [0.0022, -0.0588], [-0.003, -0.052], [-0.0055, -0.043]], [0, 0, 0.004, 0.005, 8e-4, 8e-4, 0.005, 0.004], 2), -0.0033, 0.0033, 0.0011, [1.2, 1.2, 1.25], { bs: 2 }));
  steel.push(latheSection([[0.0028, 0.03], [0.0028, 0.1036], [0.0023, 0.1046], [0, 0.1046]], 10, [4, 4, 4.2], { oy: -0.0088 }));
  stop.push(extrudeX(roundPoly2D([[0.0045, 0.0024], [0.0045, -0.0024], [-0.019, -0.0022], [-0.029, -0.004], [-0.0335, -0.0016], [-0.0335, 0.003], [-0.0255, 0.004], [-0.019, 0.0022]], 8e-4, 1), -0.0149, -0.0128, 5e-4, [1.3, 1.3, 1.35]));

  // Magazine & 9mm Brass Round
  const magC = [1.8, 1.8, 1.9], magLen = PAC4_SPECS.magLen;
  mag.push(extrudeX(roundRect2D(-0.0155, -magLen, 0.0155, 0, 0.003, 2).map((p) => [-p[0], p[1]]), -0.01025, 0.01025, 0.0018, magC, { bs: 2 }));
  mag.push(cadBox(0.0262, 0.008, 0.04, 0.0026, 0, -magLen - 0.0036, 0.0025, [0.85, 0.85, 0.87]));
  mag.push(cadBox(0.015, 0.004, 0.019, 0.001, 0, -0.001, -0.004, [1.8, 1.0, 0.45]));

  round.push(latheSection([[0, -0.0105], [0.0046, -0.0105], [0.0049, -0.0098], [0.0049, 0.007], [0.0046, 0.0085]], 12, [1, 1, 1]));
  round.push(latheSection([[0.0045, 0.0085], [0.0043, 0.0125], [0.0034, 0.016], [0.0018, 0.0182], [0, 0.0188]], 12, [1.25, 0.72, 0.5]));
  for (const g of round) { g.rotateX(0.09); g.translate(0, 0.0046, -0.001); }

  _pac4Geos = {
    slide: mergeGeos(slide),
    barrel: mergeGeos(barrel),
    frame: mergeGeos(frame),
    steel: mergeGeos(steel),
    stop: mergeGeos(stop),
    plain: mergeGeos(plain),
    mag: mergeGeos(mag),
    round: mergeGeos(round),
    dots: mergeGeos(dots),
  };
  return _pac4Geos;
}

export function createPAC4({ materials = defaultMaterials, animate = true } = {}) {
  const g = buildPAC4Geos();
  const mats = {
    poly: makeWeaponMat('pac4_polymer', [0.075, 0.078, 0.085], 0.62, 0.05),
    slide: makeWeaponMat('pac4_nitride', [0.055, 0.058, 0.065], 0.34, 0.62),
    steel: makeWeaponMat('pac4_steel', [0.16, 0.165, 0.175], 0.44, 0.78),
    plain: makeWeaponMat('pac4_matte', [0.35, 0.35, 0.37], 0.88, 0.02),
    brass: materials.get('brass', { vertexColors: true }),
    dots: new THREE.MeshStandardMaterial({
      color: 0x3b6e3f,
      emissive: 0x22cc44,
      emissiveIntensity: 1.4,
      roughness: 0.35,
    }),
  };

  const mk = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const root = new THREE.Group();
  root.name = 'pac4';
  root.add(mk(g.frame, mats.poly), mk(g.steel, mats.steel), mk(g.plain, mats.plain));

  const barrelPivot = new THREE.Group();
  barrelPivot.position.fromArray(PAC4_SPECS.barrelPivot);
  const bGeo = g.barrel.clone();
  bGeo.translate(-PAC4_SPECS.barrelPivot[0], -PAC4_SPECS.barrelPivot[1], -PAC4_SPECS.barrelPivot[2]);
  barrelPivot.add(mk(bGeo, mats.steel));
  root.add(barrelPivot);

  const slideGroup = new THREE.Group();
  slideGroup.add(mk(g.slide, mats.slide), mk(g.dots, mats.dots));
  root.add(slideGroup);

  const stopMesh = mk(g.stop, mats.steel);
  stopMesh.position.fromArray(PAC4_SPECS.stopPivot);
  root.add(stopMesh);

  const magGroup = new THREE.Group();
  magGroup.position.fromArray(PAC4_SPECS.magPos);
  magGroup.rotation.x = -PAC4_SPECS.rake;
  magGroup.add(mk(g.mag, mats.steel), mk(g.round, mats.brass));
  root.add(magGroup);

  let tris = 0;
  root.traverse((o) => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });

  const update = (t = 0) => {
    if (!animate) return;
    const cyc = (t % 1.8) / 1.8;
    const kick = cyc < 0.09 ? Math.sin((cyc / 0.09) * Math.PI) : 0;
    const travel = PAC4_SPECS.slideTravel * kick;
    slideGroup.position.z = travel;
    const tilt = clamp(travel / 0.006, 0, 1);
    barrelPivot.rotation.x = 0.022 * tilt;
    barrelPivot.position.z = PAC4_SPECS.barrelPivot[2] + 0.0025 * tilt;
    root.rotation.x = 0.05 * kick;
  };

  root.userData = {
    size: [0.04, 0.16, 0.24],
    tris: Math.round(tris),
    parts: { slide: slideGroup, barrel: barrelPivot, stop: stopMesh, mag: magGroup },
    update,
  };
  return root;
}
