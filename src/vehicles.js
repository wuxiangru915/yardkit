import * as THREE from 'three';
import {
  MeshBatcher,
  createRng,
  weatherTint,
  box,
  bevelBox,
  cylAxis,
  pipeBetween,
  beamBetween,
  pipeChain,
  parabolaPoints,
  signQuad,
  railing,
  beacon,
  createBlinkBatcher,
} from './geo.js';
import { defaultMaterials } from './materials.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function rangeBox(x0, y0, z0, x1, y1, z1, bevel = 0) {
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  const d = Math.abs(z1 - z0);
  const g = bevel > 0 ? bevelBox(w, h, d, bevel) : box(w, h, d);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

class QuadBuilder {
  constructor() {
    this.p = [];
    this.n = [];
    this.u = [];
    this.c = [];
  }
  v(pos, nrm, uvx, uvy, col) {
    this.p.push(pos.x, pos.y, pos.z);
    this.n.push(nrm.x, nrm.y, nrm.z);
    this.u.push(uvx, uvy);
    this.c.push(col[0], col[1], col[2]);
  }
  quad(pts, nrms, uvs, cols) {
    const e1 = pts[1].clone().sub(pts[0]);
    const e2 = pts[3].clone().sub(pts[0]);
    const idx = e1.cross(e2).dot(nrms[0]) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of idx) this.v(pts[i], nrms[i], uvs[i][0], uvs[i][1], cols[i]);
  }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

const hash2 = (a, b) => {
  let t = Math.imul(a + 31, 374761393) ^ Math.imul(b + 17, 668265263);
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967295;
};

// ============================================================================
// 1. Extraction Boat (RIB Patrol Craft)
// ============================================================================
export function createBoat({ materials = defaultMaterials, animate = true } = {}) {
  const batch = new MeshBatcher();
  const blink = createBlinkBatcher();

  const tubeMat = materials.get('plastic_grey', { vertexColors: true });
  const orangeMat = materials.get('paint_orange', { vertexColors: true });
  const darkPoly = materials.get('polymer_black');
  const galv = materials.get('steel_galv');
  const glass = materials.get('glass');

  const add = (mat, geo, tint) => batch.add(mat, geo, tint);

  const T_TUBE = [2, 2.02, 2.08];
  const T_RUB = [0.5, 0.5, 0.52];
  const T_ROPE = [1.9, 1.7, 1.2];

  // Perimeter inflatable collar
  const sidePts = [
    [-3.35, 0.5, 1.03],
    [-1.6, 0.5, 1.06],
    [0.5, 0.52, 1.05],
    [1.8, 0.58, 0.93],
    [2.75, 0.68, 0.6],
    [3.3, 0.78, 0.22],
  ];
  const collarPts = [
    ...sidePts.map((p) => V3(p[0], p[1], p[2])),
    V3(3.43, 0.8, 0),
    ...sidePts.slice().reverse().map((p) => V3(p[0], p[1], -p[2])),
  ];
  const collarCurve = new THREE.CatmullRomCurve3(collarPts, false, 'centripetal');
  const collarGeo = new THREE.TubeGeometry(collarCurve, 60, 0.27, 12, false);
  const cuv = collarGeo.attributes.uv;
  const collarLen = collarCurve.getLength();
  for (let i = 0; i < cuv.count; i++) {
    cuv.setXY(i, cuv.getX(i) * collarLen, cuv.getY(i) * 1.7);
  }
  add(tubeMat, collarGeo, T_TUBE);
  for (const s of [-1, 1]) add(tubeMat, cylAxis(0.07, 0.27, 0.42, 'x', -3.56, 0.5, s * 1.03, 12), T_TUBE);

  // Seam bands & safety grab rope
  const seamPos = [];
  for (let i = 0; i < 11; i++) {
    const t = 0.04 + (0.92 * i) / 10;
    const p = collarCurve.getPointAt(t);
    const tang = collarCurve.getTangentAt(t);
    const band = new THREE.TorusGeometry(0.276, 0.016, 5, 14);
    band.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), tang));
    band.translate(p.x, p.y, p.z);
    add(tubeMat, band, T_RUB);
    const outDir = V3(p.x, 0, p.z).sub(V3(Math.min(p.x, 2.2), 0, 0)).normalize();
    seamPos.push(p.clone().addScaledVector(outDir, 0.2).add(V3(0, 0.2, 0)));
  }
  for (let i = 0; i < seamPos.length - 1; i++) {
    add(tubeMat, pipeChain(parabolaPoints(seamPos[i], seamPos[i + 1], 0.1, 4), 0.012, 4), T_ROPE);
  }

  // Stepped V-hull mesh
  const hx = [-3.4, -2, -0.5, 1, 2, 2.8, 3.3];
  const hz = [0.9, 0.93, 0.93, 0.85, 0.62, 0.34, 0.08];
  const hy = [0.22, 0.22, 0.24, 0.3, 0.42, 0.56, 0.7];
  const hKeel = [-0.3, -0.32, -0.33, -0.3, -0.15, 0.15, 0.62];
  const hullVerts = [];
  const pushTri = (a, b, c) => {
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    const ctr = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const out = V3(0, ctr.y - 0.45, ctr.z);
    if (Math.abs(ctr.x) > 3.39) out.set(ctr.x, 0, 0);
    if (n.dot(out) < 0) hullVerts.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    else hullVerts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (const s of [-1, 1]) {
    for (let i = 0; i < hx.length - 1; i++) {
      const k0 = V3(hx[i], hKeel[i], 0);
      const k1 = V3(hx[i + 1], hKeel[i + 1], 0);
      const c0 = V3(hx[i], hy[i], s * hz[i]);
      const c1 = V3(hx[i + 1], hy[i + 1], s * hz[i + 1]);
      const u0 = V3(hx[i], 0.5 + Math.max(0, hy[i] - 0.22) * 0.6, s * (hz[i] + 0.1));
      const u1 = V3(hx[i + 1], 0.5 + Math.max(0, hy[i + 1] - 0.22) * 0.6, s * (hz[i + 1] + 0.1));
      pushTri(k0, k1, c1);
      pushTri(k0, c1, c0);
      pushTri(c0, c1, u1);
      pushTri(c0, u1, u0);
    }
    pushTri(V3(-3.4, hKeel[0], 0), V3(-3.4, hy[0], s * hz[0]), V3(-3.4, 0.78, s * (hz[0] + 0.1)));
    pushTri(V3(-3.4, hKeel[0], 0), V3(-3.4, 0.78, s * (hz[0] + 0.1)), V3(-3.4, 0.78, 0));
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullVerts, 3));
  hullGeo.computeVertexNormals();
  add(darkPoly, hullGeo);

  // Deck, bow locker, transom, bow cleat
  add(tubeMat, rangeBox(-3.38, 0.2, -0.86, 2.1, 0.26, 0.86), T_RUB);
  add(tubeMat, rangeBox(2, 0.26, -0.62, 2.85, 0.56, 0.62, 0.05), T_RUB);
  add(darkPoly, rangeBox(-3.46, 0.1, -0.92, -3.34, 0.8, 0.92, 0.02));
  add(galv, pipeBetween([3.2, 0.95, -0.12], [3.2, 0.95, 0.12], 0.02, 0.02, 5));
  add(galv, pipeBetween([3.2, 0.8, 0], [3.2, 0.95, 0], 0.018, 0.018, 5));

  // Center console & windshield
  add(orangeMat, rangeBox(0.3, 0.26, -0.4, 1, 1.12, 0.4, 0.05), [1, 0.9, 0.85]);
  add(darkPoly, beamBetween([0.28, 1.14, 0], [0.86, 1.3, 0], 0.76, 0.05));
  const shield = rangeBox(-0.012, 0, -0.42, 0.012, 0.5, 0.42);
  shield.rotateZ(0.42);
  shield.translate(0.95, 1.2, 0);
  add(glass, shield);
  for (const s of [-0.43, 0.43]) {
    add(galv, pipeBetween([0.95, 1.2, s], [0.95 - Math.sin(0.42) * 0.52, 1.2 + Math.cos(0.42) * 0.52, s], 0.016, 0.016, 5));
  }
  add(
    galv,
    pipeBetween(
      [0.95 - Math.sin(0.42) * 0.52, 1.2 + Math.cos(0.42) * 0.52, -0.43],
      [0.95 - Math.sin(0.42) * 0.52, 1.2 + Math.cos(0.42) * 0.52, 0.43],
      0.016, 0.016, 5
    )
  );

  // Helm wheel & throttle
  const wheel = new THREE.TorusGeometry(0.18, 0.017, 6, 18);
  wheel.rotateY(Math.PI / 2);
  wheel.rotateZ(-0.5);
  wheel.translate(0.2, 1.12, -0.12);
  add(darkPoly, wheel);
  add(galv, pipeBetween([0.2, 1.12, -0.12], [0.36, 1.03, -0.12], 0.02, 0.02, 5));
  for (const a of [0, 2.1, 4.2]) {
    add(
      galv,
      pipeBetween(
        [0.2, 1.12, -0.12],
        [0.2 + Math.sin(-0.5) * Math.cos(a) * -0.17, 1.12 + Math.cos(-0.5) * Math.cos(a) * 0.17, -0.12 + Math.sin(a) * 0.17],
        0.01, 0.01, 4
      )
    );
  }
  add(darkPoly, rangeBox(0.34, 1.16, 0.16, 0.5, 1.34, 0.3, 0.02));
  add(galv, pipeBetween([0.42, 1.34, 0.23], [0.36, 1.48, 0.23], 0.012, 0.012, 4));
  for (const z of [-0.46, 0.46]) {
    add(galv, pipeBetween([0.35, 0.3, z], [0.35, 1, z], 0.02, 0.02, 5));
    add(galv, pipeBetween([0.35, 1, z], [0.95, 1, z], 0.02, 0.02, 5));
  }

  // Jockey seats & stern bench
  for (const x of [-0.75, -1.75]) {
    add(orangeMat, rangeBox(x - 0.28, 0.26, -0.2, x + 0.28, 0.82, 0.2, 0.05), [1, 0.9, 0.85]);
    add(darkPoly, rangeBox(x - 0.3, 0.82, -0.22, x + 0.3, 0.93, 0.22, 0.04));
    add(darkPoly, rangeBox(x - 0.34, 0.93, -0.2, x - 0.26, 1.2, 0.2, 0.03));
    add(galv, pipeBetween([x + 0.3, 0.6, -0.22], [x + 0.3, 1.02, 0], 0.014, 0.014, 4));
    add(galv, pipeBetween([x + 0.3, 0.6, 0.22], [x + 0.3, 1.02, 0], 0.014, 0.014, 4));
  }
  add(orangeMat, rangeBox(-2.9, 0.26, -0.3, -2.45, 0.58, 0.3, 0.04), [1.1, 0.5, 0.4]);

  // Aft A-frame radar arch & antenna
  for (const s of [-1, 1]) {
    add(galv, pipeBetween([-2.95, 0.55, s * 0.9], [-2.75, 2, s * 0.55], 0.03, 0.03, 6));
    add(galv, pipeBetween([-2.3, 0.55, s * 0.9], [-2.75, 1.3, s * 0.7], 0.022, 0.022, 5));
  }
  add(galv, pipeBetween([-2.75, 2, -0.55], [-2.75, 2, 0.55], 0.03, 0.03, 6));
  add(galv, rangeBox(-2.88, 2, -0.2, -2.62, 2.04, 0.2));
  add(darkPoly, cylAxis(0.05, 0.06, 0.1, 'y', -2.75, 2.09, 0, 8));
  add(darkPoly, pipeBetween([-2.75, 2, 0.42], [-2.9, 3.7, 0.46], 0.011, 0.011, 5));
  add(darkPoly, cylAxis(0.16, 0.16, 0.07, 'y', -2.75, 2.1, -0.36, 10));

  // Twin outboards
  for (const z of [-0.36, 0.36]) {
    add(galv, rangeBox(-3.6, 0.42, z - 0.16, -3.44, 0.78, z + 0.16, 0.02));
    add(darkPoly, rangeBox(-4.1, 0.78, z - 0.23, -3.48, 1.4, z + 0.23, 0.09));
    add(tubeMat, rangeBox(-4.11, 1, z - 0.235, -3.47, 1.05, z + 0.235), [1.4, 1.4, 1.4]);
    add(darkPoly, rangeBox(-3.92, -0.05, z - 0.085, -3.62, 0.8, z + 0.085, 0.03));
    add(darkPoly, rangeBox(-4.02, -0.52, z - 0.04, -3.6, -0.05, z + 0.04, 0.015));
    add(darkPoly, cylAxis(0.07, 0.03, 0.42, 'x', -3.9, -0.3, z, 8));
  }

  // Fenders & lifebuoy
  for (const x of [-1.8, 0.4, 1.7]) {
    add(orangeMat, cylAxis(0.11, 0.11, 0.42, 'y', x, 0.42, 1.36, 10), [1.2, 0.8, 0.7]);
    add(tubeMat, pipeBetween([x, 0.63, 1.36], [x, 0.78, 1.12], 0.01, 0.01, 4), T_ROPE);
  }
  const buoy = new THREE.TorusGeometry(0.26, 0.07, 6, 16);
  buoy.rotateY(Math.PI / 2);
  buoy.translate(1.02, 0.72, 0);
  add(orangeMat, buoy, [1.3, 0.6, 0.45]);

  const hullGrp = batch.build({ cast: true, recv: true });
  blink.add(beacon(-2.75, 2.2, 0, 0.075), [1.2, 11, 3.2], 1.5, 0, 0.1);
  blink.add(beacon(-2.75, 2.2, 0, 0.074), [1.2, 11, 3.2], 1.5, 0.2, 0.08);
  const lampMesh = blink.build();
  if (lampMesh) {
    lampMesh.frustumCulled = false;
    hullGrp.add(lampMesh);
  }

  const root = new THREE.Group();
  root.name = 'boat';
  root.add(hullGrp);
  // Lift so keel clears y=0 if needed or keep waterline at y=0
  hullGrp.position.y = 0.55;

  const update = (dt = 0.016, t = 0) => {
    blink.uTime.value = t;
    if (animate) {
      hullGrp.position.y = 0.55 + Math.sin(t * 1.4) * 0.04;
      hullGrp.rotation.z = Math.sin(t * 1.1) * 0.015;
    }
  };
  return { root, hullGrp, update };
}

// ============================================================================
// 2. STS Container Gantry Crane ("YARDKIT 04")
// ============================================================================
export function createCrane({ materials = defaultMaterials, animate = true, centered = true } = {}) {
  const batch = new MeshBatcher();
  const blink = createBlinkBatcher();

  const x0 = 18.5, x1 = 28.5, zSpan = 5.4;
  const boomB = 21.2, boomT = 22.8, boomHalfZ = 1.8;
  const xBack = 12, xTip = 62, xSpreader = 41;
  const T_MAIN = [0.82, 0.95, 1.12];
  const T_DARK = [0.6, 0.72, 0.86];
  const T_RAIL = [1, 0.95, 0.85];
  const T_CAB = [0.95, 0.96, 0.97];

  const grey = materials.get('paint_grey', { vertexColors: true });
  const yellow = materials.get('paint_yellow', { vertexColors: true });
  const white = materials.get('paint_white', { vertexColors: true });
  const red = materials.get('paint_red', { vertexColors: true });
  const galv = materials.get('steel_galv');
  const dark = materials.get('steel_dark');
  const hazard = materials.get('hazard_stripes');
  const glass = materials.get('glass');

  const add = (mat, geo, tint) => batch.add(mat, geo, tint);

  // Wheel bogies
  function addBogie(x, z) {
    const dir = x < 23.5 ? 1 : -1;
    for (const dz of [-1.12, 1.12]) {
      const bz = z + dz;
      add(yellow, rangeBox(x - 0.3, 0.36, bz - 0.98, x + 0.3, 0.84, bz + 0.98, 0.04), T_RAIL);
      for (const wz of [-0.56, 0.56]) {
        add(dark, cylAxis(0.33, 0.33, 0.14, 'x', x, 0.33, bz + wz, 16));
        add(dark, cylAxis(0.37, 0.37, 0.025, 'x', x - 0.085, 0.33, bz + wz, 16));
        add(dark, cylAxis(0.37, 0.37, 0.025, 'x', x + 0.085, 0.33, bz + wz, 16));
        add(galv, cylAxis(0.11, 0.11, 0.7, 'x', x, 0.33, bz + wz, 8));
      }
      add(dark, cylAxis(0.16, 0.16, 0.5, 'z', x + dir * 0.5, 0.6, bz, 10));
      add(yellow, rangeBox(x + dir * 0.3, 0.42, bz - 0.56 - 0.16, x + dir * 0.62, 0.8, bz - 0.3, 0.03), T_RAIL);
    }
    add(dark, rangeBox(x - 0.2, 0.1, z - 0.22, x + 0.2, 0.9, z + 0.22, 0.03));
    add(grey, rangeBox(x - 0.34, 0.9, z - 1.8, x + 0.34, 1.42, z + 1.8, 0.05), T_MAIN);
    for (const dz of [-1.12, 0, 1.12]) {
      add(galv, cylAxis(0.14, 0.14, 0.8, 'x', x, dz ? 1.08 : 1.22, z + dz, 10));
    }
    add(grey, rangeBox(x - 0.54, 1.42, z - 0.54, x + 0.54, 1.6, z + 0.54, 0.03), T_DARK);
    for (const s of [-1, 1]) {
      const bz = z + s * 2.1;
      add(yellow, rangeBox(x - 0.16, 0.44, bz - 0.12, x + 0.16, 0.8, bz + 0.12, 0.02), T_RAIL);
      add(galv, cylAxis(0.08, 0.08, 0.34, 'z', x, 0.62, bz + s * 0.28, 8));
      add(dark, cylAxis(0.17, 0.15, 0.12, 'z', x, 0.62, bz + s * 0.5, 12));
      add(hazard, rangeBox(x - 0.28, 0.04, bz + s * 0.13, x + 0.28, 0.4, bz + s * 0.16));
    }
  }

  // 4 Portal columns + hazard bases
  const colY = [3.6, 7.6, 11.2, 12.5, 13.5, 17.2, 20.6, 23.8];
  for (const x of [x0, x1]) {
    for (const z of [-zSpan, zSpan]) {
      addBogie(x, z);
      add(hazard, rangeBox(x - 0.6, 1.6, z - 0.6, x + 0.6, 3.6, z + 0.6, 0.04));
      for (let i = 0; i < colY.length - 1; i++) {
        add(grey, rangeBox(x - 0.6, colY[i], z - 0.6, x + 0.6, colY[i + 1], z + 0.6, 0.05), T_MAIN);
        if (i === 0 || i === 1 || i === 5) {
          add(grey, rangeBox(x - 0.64, colY[i] - 0.05, z - 0.64, x + 0.64, colY[i] + 0.05, z + 0.64), T_DARK);
        }
      }
    }
  }

  // High-voltage electrical cabinets
  const hvDecal = materials.decal('hazard_voltage');
  for (const z of [-zSpan, zSpan]) {
    const cx = x0 - 0.6;
    add(white, rangeBox(cx - 0.035, 1.72, z - 0.36, cx, 3.48, z + 0.36, 0.012), [0.62, 0.66, 0.7]);
    add(dark, rangeBox(cx - 0.05, 1.66, z - 0.42, cx - 0.005, 1.72, z + 0.42));
    add(dark, rangeBox(cx - 0.05, 3.48, z - 0.42, cx - 0.005, 3.54, z + 0.42));
    add(dark, rangeBox(cx - 0.05, 1.66, z - 0.42, cx - 0.005, 3.54, z - 0.36));
    add(dark, rangeBox(cx - 0.05, 1.66, z + 0.36, cx - 0.005, 3.54, z + 0.42));
    add(galv, pipeBetween([cx - 0.08, 2.45, z + 0.26], [cx - 0.08, 2.75, z + 0.26], 0.014, 0.014, 5));
    for (const hy of [2, 3.2]) add(dark, rangeBox(cx - 0.06, hy - 0.07, z - 0.37, cx - 0.03, hy + 0.07, z - 0.33));
    add(galv, rangeBox(cx - 0.3, 1.5, z - 0.4, cx, 1.56, z + 0.4));
    add(galv, rangeBox(cx - 0.3, 1, z - 0.4, cx - 0.02, 1.05, z + 0.4));
    add(hvDecal.material, signQuad(0.3, 0.3, cx - 0.04, 3.1, z, -Math.PI / 2));
  }

  // Lower sill beams, festoon cable reel & power box
  for (const x of [x0, x1]) {
    add(grey, rangeBox(x - 0.45, 3.6, -zSpan + 0.6, x + 0.45, 4.6, zSpan - 0.6, 0.05), T_MAIN);
    for (const z of [-2.4, 0, 2.4]) add(grey, rangeBox(x - 0.48, 3.58, z - 0.03, x + 0.48, 4.62, z + 0.03), T_DARK);
  }
  add(yellow, cylAxis(1.15, 1.15, 0.06, 'x', x0 - 0.62, 5.85, -2.2, 24), T_RAIL);
  add(yellow, cylAxis(1.15, 1.15, 0.06, 'x', x0 - 1.02, 5.85, -2.2, 24), T_RAIL);
  add(dark, cylAxis(0.7, 0.7, 0.36, 'x', x0 - 0.82, 5.85, -2.2, 20));
  add(galv, cylAxis(0.12, 0.12, 0.9, 'x', x0 - 0.6, 5.85, -2.2, 8));
  add(grey, rangeBox(x0 - 0.5, 4.6, -2.5, x0 + 0.3, 5.9, -1.9, 0.03), T_DARK);
  add(dark, pipeBetween([x0 - 0.82, 4.75, -1.2], [x0 - 0.82, 0.02, -0.9], 0.035, 0.035, 6));
  add(galv, rangeBox(x0 - 1, 0, -1.15, x0 - 0.64, 0.5, -0.65, 0.02));
  add(white, rangeBox(x0 - 0.42, 4.6, 1, x0 + 0.42, 6.3, 3.6, 0.03), T_CAB);
  for (const z of [1.65, 2.3, 2.95]) add(dark, rangeBox(x0 - 0.44, 4.7, z - 0.01, x0 - 0.42, 6.2, z + 0.01));
  add(galv, rangeBox(x0 - 0.47, 5.6, 1.2, x0 - 0.42, 6.1, 1.55));

  // Upper portal frame & cross bracing
  for (const z of [-zSpan, zSpan]) {
    add(grey, rangeBox(x0 + 0.6, 12.5, z - 0.45, x1 - 0.6, 13.5, z + 0.45, 0.05), T_MAIN);
    for (const bx of [21, 23.5, 26]) add(grey, rangeBox(bx - 0.03, 12.48, z - 0.48, bx + 0.03, 13.52, z + 0.48), T_DARK);
    const sz = Math.sign(z);
    add(grey, beamBetween([x0 + 0.5, 9.6, z], [x0 + 3.4, 12.6, z], 0.4, 0.4, 0.03), T_MAIN);
    add(grey, beamBetween([x1 - 0.5, 9.6, z], [x1 - 3.4, 12.6, z], 0.4, 0.4, 0.03), T_MAIN);
    for (const x of [x0, x1]) add(grey, beamBetween([x, 9.6, z - sz * 0.5], [x, 12.6, z - sz * 3.4], 0.4, 0.4, 0.03), T_MAIN);
    add(grey, pipeBetween([x1 - 0.4, 13.7, z], [x0 + 0.4, 22.7, z], 0.2, 0.2, 10), T_MAIN);
    add(grey, pipeBetween([x0 + 0.4, 13.7, z], [x1 - 0.4, 22.7, z], 0.2, 0.2, 10), T_MAIN);
    add(grey, rangeBox(23.5 - 0.5, 17.7, z - 0.24, 23.5 + 0.5, 18.7, z + 0.24, 0.03), T_DARK);
    add(grey, rangeBox(x0 + 0.6, 22.95, z - 0.35, x1 - 0.6, 23.7, z + 0.35, 0.04), T_MAIN);
  }
  for (const x of [x0, x1]) {
    add(grey, rangeBox(x - 0.45, 12.5, -zSpan + 0.6, x + 0.45, 13.5, zSpan - 0.6, 0.05), T_MAIN);
    add(grey, rangeBox(x - 0.45, 22.8, -zSpan + 0.6, x + 0.45, 23.8, zSpan - 0.6, 0.05), T_MAIN);
    for (const s of [-1, 1]) {
      add(grey, beamBetween([x, 20.2, s * (zSpan - 0.5)], [x, 22.8, s * (boomHalfZ + 1.2)], 0.36, 0.36, 0.03), T_MAIN);
    }
  }
  add(galv, rangeBox(x0 + 0.9, 13.5, 4.05, x1 - 0.9, 13.55, 4.95));
  railing(batch, yellow, [[x0 + 0.9, 13.55, 4.08], [x1 - 0.9, 13.55, 4.08]], { tint: T_RAIL });
  add(galv, rangeBox(x0 + 0.45, 13.45, -4.6, x0 + 1.25, 13.5, 4.05));
  railing(batch, yellow, [[x0 + 1.22, 13.5, -4.6], [x0 + 1.22, 13.5, 4.05]], { tint: T_RAIL });

  // Twin main boom girders + catwalks
  const xHinge = x1 + 1.3;
  for (const s of [-1, 1]) {
    const gz = s * boomHalfZ;
    const bays = [xBack, 15.4, x0, 22, 25.2, x1, xHinge - 0.15, xHinge + 0.15, 34.6, 39.2, 43.8, 48.4, 53, 57.6, xTip];
    for (let i = 0; i < bays.length - 1; i++) {
      if (i === 6) continue;
      add(grey, rangeBox(bays[i], boomB, gz - 0.45, bays[i + 1], boomT, gz + 0.45, 0.05), T_MAIN);
      if (i > 0 && i !== 7) {
        add(grey, rangeBox(bays[i] - 0.035, boomB - 0.05, gz - 0.5, bays[i] + 0.035, boomT + 0.05, gz + 0.5), T_DARK);
      }
    }
    add(grey, rangeBox(xHinge - 0.7, boomT - 0.1, gz - 0.52, xHinge + 0.7, boomT + 0.55, gz - 0.4, 0.03), T_DARK);
    add(grey, rangeBox(xHinge - 0.7, boomT - 0.1, gz + 0.4, xHinge + 0.7, boomT + 0.55, gz + 0.52, 0.03), T_DARK);
    add(galv, cylAxis(0.16, 0.16, 1.2, 'z', xHinge, boomT + 0.22, gz, 12));
    add(dark, rangeBox(xBack + 0.3, boomT, gz - s * 0.32 - 0.05, xTip - 0.3, boomT + 0.09, gz - s * 0.32 + 0.05));

    const cwIn = gz + s * 0.45;
    const cwOut = gz + s * 1.35;
    add(galv, rangeBox(xBack + 0.2, 21.86, Math.min(cwIn, cwOut), xTip - 0.2, 21.9, Math.max(cwIn, cwOut)));
    for (let x = xBack + 0.6; x < xTip; x += 2.45) {
      add(grey, beamBetween([x, 21.84, cwIn], [x, 21.3, cwIn], 0.07, 0.07), T_DARK);
      add(grey, beamBetween([x, 21.82, cwOut], [x, 21.36, cwIn], 0.06, 0.08), T_DARK);
    }
    railing(batch, yellow, [[xBack + 0.2, 21.9, cwOut - s * 0.03], [xTip - 0.2, 21.9, cwOut - s * 0.03]], {
      post: 2.45,
      tint: T_RAIL,
    });
    add(yellow, rangeBox(xBack + 0.2, 21.9, cwOut - s * 0.03 - 0.008, xTip - 0.2, 22.02, cwOut - s * 0.03 + 0.008), T_RAIL);
    for (const sx of [44, 58]) add(grey, rangeBox(sx - 0.18, boomT, gz - 0.2, sx + 0.18, boomT + 1.5, gz + 0.2, 0.03), T_MAIN);
  }

  for (const sx of [44, 58]) add(grey, rangeBox(sx - 0.2, boomT + 1.2, -boomHalfZ - 0.3, sx + 0.2, boomT + 1.6, boomHalfZ + 0.3, 0.04), T_MAIN);
  for (const px of [xBack + 0.25, xTip - 0.25]) {
    add(grey, rangeBox(px - 0.25, boomB + 0.1, -boomHalfZ + 0.45, px + 0.25, boomT - 0.1, boomHalfZ - 0.45, 0.05), T_MAIN);
    const dir = px < 30 ? 1 : -1;
    for (const bz of [-0.8, 0.8]) add(dark, cylAxis(0.14, 0.14, 0.4, 'x', px + dir * 0.45, 22, bz, 10));
  }
  add(galv, rangeBox(xTip - 0.1, 21.86, -boomHalfZ - 1.35, xTip + 0.9, 21.9, boomHalfZ + 1.35));
  railing(
    batch,
    yellow,
    [
      [xTip - 0.1, 21.9, -boomHalfZ - 1.32],
      [xTip + 0.87, 21.9, -boomHalfZ - 1.32],
      [xTip + 0.87, 21.9, boomHalfZ + 1.32],
      [xTip - 0.1, 21.9, boomHalfZ + 1.32],
    ],
    { post: 1.4, tint: T_RAIL }
  );
  add(galv, pipeBetween([xTip + 0.6, 21.9, 0], [xTip + 0.6, 25.2, 0], 0.035, 0.035, 6));
  add(galv, pipeBetween([xTip + 0.6, 24.8, -0.45], [xTip + 0.6, 24.8, 0.45], 0.015, 0.015, 4));
  blink.add(beacon(xTip + 0.6, 25.32, 0, 0.13), [9, 0.5, 0.25], 2.6, 0.5, 0.45);
  add(dark, cylAxis(0.1, 0.12, 0.1, 'y', xTip + 0.6, 25.2, 0, 8));

  // A-frame apex + stays + apex maintenance deck
  const apexX = 27.6, apexY = 30, apexZ = 1.5;
  for (const s of [-1, 1]) {
    add(grey, beamBetween([x1, 23.8, s * zSpan], [apexX, apexY, s * apexZ], 0.55, 0.55, 0.04), T_MAIN);
    add(grey, beamBetween([x0, 23.8, s * zSpan], [apexX, apexY, s * apexZ], 0.5, 0.5, 0.04), T_MAIN);
    for (const [sx, r] of [[44, 0.1], [58, 0.1]]) {
      const p0 = V3(apexX + 0.3, apexY, s * apexZ);
      const p1 = V3(sx, boomT + 1.45, s * boomHalfZ);
      add(grey, pipeBetween(p0, p1, r, r, 8), T_MAIN);
      const mid = p0.clone().lerp(p1, 0.5);
      add(grey, rangeBox(mid.x - 0.3, mid.y - 0.16, mid.z - 0.14, mid.x + 0.3, mid.y + 0.16, mid.z + 0.14, 0.03), T_DARK);
    }
    add(dark, pipeBetween([apexX + 0.2, apexY + 0.35, s * 0.9], [50, boomT + 0.2, s * 1], 0.022, 0.022, 5));
    add(dark, cylAxis(0.5, 0.5, 0.18, 'z', apexX, apexY + 0.25, s * 0.9, 16));
  }
  add(grey, rangeBox(apexX - 0.45, apexY - 0.35, -apexZ - 0.5, apexX + 0.45, apexY + 0.3, apexZ + 0.5, 0.05), T_MAIN);
  {
    const fPt = (t, s) => V3(x1 + (apexX - x1) * t, 23.8 + (apexY - 23.8) * t, s * (zSpan + (apexZ - zSpan) * t));
    const rPt = (t, s) => V3(x0 + (apexX - x0) * t, 23.8 + (apexY - 23.8) * t, s * (zSpan + (apexZ - zSpan) * t));
    add(grey, beamBetween(fPt(0.5, -1), fPt(0.5, 1), 0.3, 0.3, 0.02), T_MAIN);
    add(grey, beamBetween(rPt(0.55, -1), rPt(0.55, 1), 0.3, 0.3, 0.02), T_MAIN);
    add(grey, pipeBetween(rPt(0.55, -1), fPt(0.5, -1), 0.09, 0.09, 6), T_MAIN);
    add(grey, pipeBetween(rPt(0.55, 1), fPt(0.5, 1), 0.09, 0.09, 6), T_MAIN);
    const l0 = fPt(0.02, 1), l1 = fPt(0.97, 1);
    for (const dz of [-0.22, 0.22]) {
      add(galv, pipeBetween([l0.x - 0.42, l0.y, l0.z + dz], [l1.x - 0.42, l1.y, l1.z + dz], 0.02, 0.02, 4));
    }
    for (let t = 0.03; t < 1; t += 0.045) {
      const p = l0.clone().lerp(l1, t);
      add(galv, pipeBetween([p.x - 0.42, p.y, p.z - 0.22], [p.x - 0.42, p.y, p.z + 0.22], 0.012, 0.012, 4));
    }
  }
  add(grey, rangeBox(xBack + 0.05, boomT, -3.6, xBack + 0.55, boomT + 0.4, 3.6, 0.04), T_MAIN);
  for (const s of [-1, 1]) {
    add(grey, rangeBox(xBack + 0.08, boomT + 0.4, s * 3.3 - 0.2, xBack + 0.52, boomT + 1, s * 3.3 + 0.2, 0.03), T_DARK);
    add(grey, pipeBetween([apexX - 0.3, apexY, s * apexZ], [xBack + 0.3, boomT + 0.8, s * 3.3], 0.1, 0.1, 8), T_MAIN);
    add(galv, cylAxis(0.12, 0.12, 0.6, 'z', xBack + 0.3, boomT + 0.8, s * 3.3, 10));
  }
  add(galv, rangeBox(apexX - 1, apexY + 0.3, -apexZ - 0.6, apexX + 1, apexY + 0.34, apexZ + 0.6));
  railing(
    batch,
    yellow,
    [
      [apexX - 0.98, apexY + 0.34, -apexZ - 0.58],
      [apexX + 0.98, apexY + 0.34, -apexZ - 0.58],
      [apexX + 0.98, apexY + 0.34, apexZ + 0.58],
      [apexX - 0.98, apexY + 0.34, apexZ + 0.58],
      [apexX - 0.98, apexY + 0.34, -apexZ - 0.58],
    ],
    { post: 1.2, tint: T_RAIL }
  );
  add(galv, pipeBetween([apexX, apexY + 0.34, 0], [apexX, apexY + 2, 0], 0.045, 0.045, 6));
  add(galv, pipeBetween([apexX, apexY + 2, 0], [apexX, apexY + 3.6, 0], 0.016, 0.016, 4));
  add(galv, pipeBetween([apexX - 0.5, apexY + 1.5, 0], [apexX + 0.5, apexY + 1.5, 0], 0.018, 0.018, 4));
  for (const dx of [-0.5, 0.5]) {
    add(dark, cylAxis(0.1, 0.12, 0.1, 'y', apexX + dx, apexY + 1.56, 0, 8));
    blink.add(beacon(apexX + dx, apexY + 1.72, 0, 0.15), [10, 0.5, 0.25], 2.6, 0, 0.45);
  }

  // Machinery house on boom
  const mhX0 = 20.4, mhX1 = 27.9, mhY0 = boomT, mhY1 = 26, mhZ = 2.9;
  add(white, rangeBox(mhX0, mhY0, -mhZ, mhX1, mhY1, mhZ, 0.06), T_CAB);
  add(grey, rangeBox(mhX0 - 0.15, mhY0 - 0.12, -mhZ - 0.15, mhX1 + 0.15, mhY0 + 0.1, mhZ + 0.15, 0.03), T_DARK);
  add(galv, rangeBox(mhX0 - 0.2, mhY1, -mhZ - 0.2, mhX1 + 0.2, mhY1 + 0.12, mhZ + 0.2, 0.03));
  for (let x = mhX0 + 1.3; x < mhX1; x += 1.3) {
    for (const s of [-1, 1]) add(white, rangeBox(x - 0.02, mhY0 + 0.1, s * mhZ - 0.015, x + 0.02, mhY1, s * mhZ + 0.015), [0.7, 0.72, 0.74]);
  }
  function addLouver(lx, ly, lz, w, h, ry) {
    const parts = [rangeBox(-w / 2, -h / 2, 0, w / 2, h / 2, 0.02)];
    const rows = Math.round(h / 0.12);
    for (let i = 0; i < rows; i++) {
      const slat = rangeBox(-w / 2 + 0.03, -0.012, 0, w / 2 - 0.03, 0.012, 0.11);
      slat.rotateX(0.7);
      slat.translate(0, -h / 2 + (i + 0.5) * (h / rows), 0.03);
      parts.push(slat);
    }
    for (const g of parts) { g.rotateY(ry); g.translate(lx, ly, lz); }
    add(dark, parts.shift());
    add(galv, parts);
  }
  for (const s of [-1, 1]) {
    for (const lx of [mhX0 + 1.4, mhX0 + 3.9, mhX0 + 6.1]) {
      addLouver(lx, 24.5, s * (mhZ + 0.005), 1.5, 1.3, s > 0 ? 0 : Math.PI);
    }
  }
  addLouver(mhX0 - 0.005, 23.75, -1.9, 1.4, 1.1, -Math.PI / 2);
  add(white, rangeBox(mhX0 - 0.03, mhY0 + 0.15, 0.8, mhX0, mhY0 + 2.15, 1.7, 0.01), [0.6, 0.64, 0.68]);
  add(galv, pipeBetween([mhX0 - 0.06, mhY0 + 1, 1.55], [mhX0 - 0.06, mhY0 + 1.3, 1.55], 0.014, 0.014, 5));
  add(galv, rangeBox(mhX0 - 0.9, mhY0 + 0.05, 0.3, mhX0, mhY0 + 0.1, 2.2));
  railing(batch, yellow, [[mhX0, mhY0 + 0.1, 0.32], [mhX0 - 0.88, mhY0 + 0.1, 0.32], [mhX0 - 0.88, mhY0 + 0.1, 2.18], [mhX0, mhY0 + 0.1, 2.18]], {
    post: 1,
    tint: T_RAIL,
  });
  const logoDecal = materials.decal('logo_a');
  add(logoDecal.material, signQuad(1.1 * Math.min(3, logoDecal.aspect || 1), 1.1, mhX0 - 0.012, 25.2, 0, -Math.PI / 2));
  railing(batch, yellow, [[mhX0, mhY1 + 0.12, -mhZ], [mhX1, mhY1 + 0.12, -mhZ], [mhX1, mhY1 + 0.12, mhZ], [mhX0, mhY1 + 0.12, mhZ], [mhX0, mhY1 + 0.12, -mhZ]], {
    post: 1.95,
    tint: T_RAIL,
  });
  for (const vx of [mhX0 + 1.9, mhX0 + 5.6]) {
    add(galv, cylAxis(0.28, 0.28, 0.5, 'y', vx, mhY1 + 0.37, -1.2, 10));
    add(galv, cylAxis(0.1, 0.5, 0.22, 'y', vx, mhY1 + 0.72, -1.2, 10));
  }
  add(dark, cylAxis(0.13, 0.13, 1.6, 'y', mhX0 + 3.7, mhY1 + 0.9, 1.9, 8));
  add(dark, cylAxis(0.2, 0.14, 0.2, 'y', mhX0 + 3.7, mhY1 + 1.75, 1.9, 8));
  add(white, rangeBox(mhX0 + 5.4, mhY1 + 0.12, 0.4, mhX0 + 6.7, mhY1 + 0.85, 1.8, 0.03), [0.7, 0.72, 0.75]);
  add(galv, pipeBetween([mhX0 + 0.3, mhY1 + 0.12, 2.5], [mhX0 + 0.3, mhY1 + 1.9, 2.5], 0.03, 0.03, 5));
  blink.add(beacon(mhX0 + 0.3, mhY1 + 2.02, 2.5, 0.13), [9, 0.5, 0.25], 2.6, 0.25, 0.45);

  // Switchback access staircase tower & caged ladder
  const kz0 = 6.15, kzM = 6.97, kz1 = 7.8;
  const fRng = [19.4, 20.6], hRng = [26.4, 27.6];
  function addFlight(ax, ay, bx, by, za, zb) {
    const dy = by - ay;
    const steps = Math.max(2, Math.round(dy / 0.21));
    for (const rz of [za + 0.03, zb - 0.03]) {
      add(galv, beamBetween([ax, ay - 0.12, rz], [bx, by - 0.12, rz], 0.05, 0.24));
      add(yellow, pipeBetween([ax, ay + 1, rz], [bx, by + 1, rz], 0.024, 0.024, 5), T_RAIL);
      add(yellow, pipeBetween([ax, ay + 0.5, rz], [bx, by + 0.5, rz], 0.018, 0.018, 4), T_RAIL);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const rx = ax + (bx - ax) * t, ry = ay + dy * t;
        add(yellow, pipeBetween([rx, ry - 0.05, rz], [rx, ry + 1, rz], 0.02, 0.02, 4), T_RAIL);
      }
    }
    for (let s = 1; s <= steps; s++) {
      const tx = (s - 0.5) / steps;
      const sx = ax + (bx - ax) * tx;
      const sy = ay + dy * (s / steps);
      add(galv, rangeBox(sx - 0.13, sy - 0.03, za + 0.06, sx + 0.13, sy, zb - 0.06));
    }
  }
  function addLanding(lx0, lx1, ly, dir) {
    add(galv, rangeBox(lx0, ly - 0.05, kz0, lx1, ly, kz1));
    add(galv, rangeBox(lx0, ly - 0.2, kz0, lx1, ly - 0.05, kz0 + 0.06));
    add(galv, rangeBox(lx0, ly - 0.2, kz1 - 0.06, lx1, ly - 0.05, kz1));
    const endX = dir > 0 ? lx1 - 0.03 : lx0 + 0.03;
    const innerX = dir > 0 ? lx0 : lx1;
    railing(batch, yellow, [[innerX, ly, kz1 - 0.03], [endX, ly, kz1 - 0.03], [endX, ly, kz0 + 0.03]], { post: 0.9, tint: T_RAIL });
  }
  const landY = [3.6, 6.9, 10.2, 13.5, 16.8, 20.1];
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) {
      addLanding(fRng[0], fRng[1], landY[i], -1);
      addFlight(fRng[1], landY[i], hRng[0], landY[i + 1], kz0, kzM);
    } else {
      addLanding(hRng[0], hRng[1], landY[i], 1);
      addFlight(hRng[0], landY[i], fRng[1], landY[i + 1], kzM, kz1);
    }
  }
  addLanding(hRng[0], hRng[1], landY[5], 1);
  addFlight(hRng[0], landY[5], 23.4, 21.9, kzM, kz1);
  add(galv, rangeBox(22.5, 21.85, boomHalfZ + 1.35, 23.4, 21.9, kz1));
  railing(batch, yellow, [[22.53, 21.9, boomHalfZ + 1.4], [22.53, 21.9, kz1 - 0.03], [23.37, 21.9, kz1 - 0.03]], { post: 1.3, tint: T_RAIL });
  railing(batch, yellow, [[23.37, 21.9, boomHalfZ + 1.4], [23.37, 21.9, kzM]], { post: 1.3, tint: T_RAIL });
  add(galv, rangeBox(hRng[0], 13.45, 4.95, hRng[1], 13.5, kz0));
  for (const px of [fRng[0], hRng[1]]) {
    for (const pz of [kz0 - 0.05, kz1 + 0.05]) add(grey, rangeBox(px - 0.07, 3.3, pz - 0.07, px + 0.07, 21.4, pz + 0.07), T_MAIN);
  }
  for (let i = 0; i < landY.length; i++) {
    const dy = landY[i] - 0.25;
    add(grey, rangeBox(fRng[0], dy - 0.06, kz1, hRng[1], dy + 0.06, kz1 + 0.1), T_DARK);
    for (const bx of [fRng[0], hRng[1]]) add(grey, rangeBox(bx - 0.05, dy - 0.06, 5.9, bx + 0.05, dy + 0.06, kz1 + 0.1), T_DARK);
    if (i < landY.length - 1) {
      const ny = landY[i + 1] - 0.25;
      add(grey, pipeBetween([fRng[0], dy, kz1 + 0.05], [hRng[1], ny, kz1 + 0.05], 0.03, 0.03, 5), T_MAIN);
      add(grey, pipeBetween([hRng[1], dy, kz1 + 0.05], [fRng[0], ny, kz1 + 0.05], 0.03, 0.03, 5), T_MAIN);
    }
  }
  {
    const lx = fRng[0] - 0.05, lz = 7.35;
    for (const dz of [-0.22, 0.22]) add(galv, pipeBetween([lx, 0.05, lz + dz], [lx, 4.75, lz + dz], 0.022, 0.022, 5));
    for (let y = 0.3; y < 4.7; y += 0.3) add(galv, pipeBetween([lx, y, lz - 0.22], [lx, y, lz + 0.22], 0.012, 0.012, 4));
    for (let y = 2.3; y <= 4.75; y += 0.6) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = (Math.PI * i) / 8;
        pts.push(V3(lx - Math.sin(a) * 0.7, y, lz - Math.cos(a) * 0.36));
      }
      add(galv, pipeChain(pts, 0.012, 4));
    }
    for (let i = 1; i < 8; i += 1.5) {
      const a = (Math.PI * i) / 8;
      add(galv, pipeBetween([lx - Math.sin(a) * 0.7, 2.3, lz - Math.cos(a) * 0.36], [lx - Math.sin(a) * 0.7, 4.75, lz - Math.cos(a) * 0.36], 0.01, 0.01, 4));
    }
  }

  // Boom festoon cable track & looping power cables
  add(dark, rangeBox(13, 21.02, -boomHalfZ - 0.95, xTip - 1.2, 21.12, -boomHalfZ - 0.85));
  for (let x = 13.5; x < xTip - 1.2; x += 3.3) add(dark, rangeBox(x - 0.03, 21.1, -boomHalfZ - 0.93, x + 0.03, 21.86, -boomHalfZ - 0.87));
  {
    const segLen = (xTip - 1.6 - 13.6) / 15;
    for (let i = 0; i < 15; i++) {
      const sx = 13.6 + i * segLen, sag = 1.1 + 0.25 * Math.sin(i * 2.1);
      add(dark, rangeBox(sx - 0.1, 20.9, -boomHalfZ - 0.98, sx + 0.1, 21.02, -boomHalfZ - 0.82));
      for (const dz of [-0.05, 0.05]) {
        const pts = [];
        for (let k = 0; k <= 7; k++) {
          const t = k / 7;
          pts.push(V3(sx + segLen * t, 20.92 - sag * (1 - (2 * t - 1) ** 2), -boomHalfZ - 0.9 + dz));
        }
        add(dark, pipeChain(pts, 0.03, 4));
      }
    }
  }

  // Downward work floodlights
  function addLightBank(px, py, pz, count, axis = 'z') {
    const span = count * 0.46;
    if (axis === 'z') add(dark, rangeBox(px - 0.03, py, pz - span / 2, px + 0.03, py + 0.06, pz + span / 2));
    else add(dark, rangeBox(px - span / 2, py, pz - 0.03, px + span / 2, py + 0.06, pz + 0.03));
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * 0.46;
      const lx = axis === 'z' ? px : px + off;
      const lz = axis === 'z' ? pz + off : pz;
      add(dark, rangeBox(lx - 0.17, py - 0.2, lz - 0.17, lx + 0.17, py, lz + 0.17, 0.02));
      blink.add(rangeBox(lx - 0.14, py - 0.215, lz - 0.14, lx + 0.14, py - 0.2, lz + 0.14), [1.3, 0.95, 0.55], 0);
    }
  }
  for (const fx of [33, 47.5, 59.5]) for (const s of [-1, 1]) addLightBank(fx, 21.3, s * (boomHalfZ + 1.3), 3, 'x');
  for (const s of [-1, 1]) {
    addLightBank(23.5, 12.28, s * (zSpan - 0.2), 4, 'x');
    addLightBank(15, 21.3, s * (boomHalfZ + 1.3), 2, 'x');
  }
  addLightBank(x1 + 0.1, 12.28, 0, 3, 'z');
  addLightBank(x0 - 0.1, 12.28, 0, 3, 'z');
  addLightBank(apexX + 0.6, apexY - 0.55, 0, 3, 'z');

  // Trolley & glazed operator cab
  add(yellow, rangeBox(xSpreader - 2.3, 21.35, -1.25, xSpreader + 2.3, 22.2, 1.25, 0.06), T_RAIL);
  add(yellow, rangeBox(xSpreader - 1.6, 20.7, -1.1, xSpreader + 1.6, 21.35, 1.1, 0.05), T_RAIL);
  for (const dx of [-1.8, 1.8]) {
    for (const s of [-1, 1]) {
      add(dark, cylAxis(0.24, 0.24, 0.16, 'z', xSpreader + dx, 22.42, s * 1.3, 12));
      add(yellow, rangeBox(xSpreader + dx - 0.35, 22.1, s * 1.3 - 0.14, xSpreader + dx + 0.35, 22.5, s * 1.3 + 0.14, 0.03), T_RAIL);
    }
  }
  add(dark, cylAxis(0.42, 0.42, 1.5, 'z', xSpreader - 0.9, 22.35, 0, 14));
  add(dark, cylAxis(0.42, 0.42, 1.5, 'z', xSpreader + 0.9, 22.35, 0, 14));

  const cabX0 = xSpreader + 0.25, cabX1 = xSpreader + 2.65;
  const cabZ0 = 2.35, cabZ1 = 4.4, cabY0 = 18.3, cabY1 = 20.7;
  for (const px of [cabX0 + 0.12, cabX1 - 0.3]) {
    add(yellow, rangeBox(px - 0.12, 20.88, -1, px + 0.12, 21.16, cabZ1, 0.03), T_RAIL);
    for (const pz of [cabZ0 + 0.1, cabZ1 - 0.1]) add(yellow, rangeBox(px - 0.06, cabY1, pz - 0.06, px + 0.06, 20.9, pz + 0.06), T_RAIL);
  }
  add(white, rangeBox(cabX0, cabY0, cabZ0, cabX1, cabY0 + 0.14, cabZ1, 0.03), T_CAB);
  add(white, rangeBox(cabX0 - 0.08, cabY1 - 0.02, cabZ0 - 0.08, cabX1 + 0.12, cabY1 + 0.12, cabZ1 + 0.08, 0.03), T_CAB);
  add(white, rangeBox(cabX0, cabY0 + 0.14, cabZ0, cabX0 + 0.08, cabY1, cabZ1), T_CAB);
  for (const pz of [cabZ0, cabZ1 - 0.06]) {
    add(white, rangeBox(cabX0, cabY0 + 0.14, pz, cabX1 - 0.5, cabY0 + 0.95, pz + 0.06), T_CAB);
    add(glass, rangeBox(cabX0 + 0.08, cabY0 + 0.95, pz + 0.02, cabX1 - 0.06, cabY1, pz + 0.04));
    add(glass, rangeBox(cabX1 - 0.5, cabY0 + 0.14, pz + 0.02, cabX1 - 0.06, cabY0 + 0.95, pz + 0.04));
  }
  for (const pz of [cabZ0, cabZ1 - 0.06, (cabZ0 + cabZ1) / 2 - 0.03]) {
    add(white, rangeBox(cabX1 - 0.06, cabY0 + 0.14, pz, cabX1, cabY1, pz + 0.06), T_CAB);
  }
  add(glass, rangeBox(cabX1 - 0.04, cabY0 + 0.14, cabZ0 + 0.06, cabX1 - 0.02, cabY1, cabZ1 - 0.06));
  add(glass, rangeBox(cabX1 - 0.9, cabY0 + 0.02, cabZ0 + 0.3, cabX1 - 0.1, cabY0 + 0.04, cabZ1 - 0.3));
  add(dark, rangeBox(cabX0 + 0.9, cabY0 + 0.14, 3.1, cabX0 + 1.45, cabY0 + 0.6, 3.65, 0.04));
  add(dark, rangeBox(cabX0 + 0.82, cabY0 + 0.6, 3.1, cabX0 + 0.96, cabY0 + 1.35, 3.65, 0.04));
  for (const cz of [2.75, 4]) {
    add(dark, rangeBox(cabX0 + 1.2, cabY0 + 0.14, cz - 0.16, cabX0 + 1.75, cabY0 + 0.85, cz + 0.16, 0.03));
    blink.add(rangeBox(cabX0 + 1.3, cabY0 + 0.855, cz - 0.1, cabX0 + 1.6, cabY0 + 0.865, cz + 0.1), [0.75, 0.5, 0.26], 0);
  }
  blink.add(rangeBox(cabX0 + 0.5, cabY1 - 0.045, 3, cabX0 + 1.5, cabY1 - 0.03, 3.2), [0.75, 0.5, 0.26], 0);
  addLightBank(cabX1 + 0.15, cabY0 + 0.1, 3.37, 2, 'z');
  add(galv, rangeBox(cabX0 - 0.9, cabY0 + 0.1, cabZ0, cabX0, cabY0 + 0.14, cabZ1));
  railing(batch, yellow, [[cabX0, cabY0 + 0.14, cabZ0 + 0.03], [cabX0 - 0.87, cabY0 + 0.14, cabZ0 + 0.03], [cabX0 - 0.87, cabY0 + 0.14, cabZ1 - 0.03], [cabX0, cabY0 + 0.14, cabZ1 - 0.03]], {
    post: 1,
    tint: T_RAIL,
  });

  // YARDKIT 04 stencil markings
  const stencil = materials.label('YARDKIT 04', { color: 'white', font: 'stencil' });
  const asp = Math.max(1, stencil.aspect || 6);
  const bh = Math.min(1.15, 8.6 / asp);
  for (const s of [-1, 1]) add(stencil.material, signQuad(bh * asp, bh, 36.9, 22, s * (boomHalfZ + 0.453), s > 0 ? 0 : Math.PI));
  const lh = Math.min(0.86, 9.4 / asp);
  add(stencil.material, signQuad(lh * asp, lh, x0 - 0.453, 13, 0, -Math.PI / 2));

  // Spreader + suspended red container sub-group
  const spBatch = new MeshBatcher();
  const sAdd = (mat, geo, tint) => spBatch.add(mat, geo, tint);
  const drop = 8.3;
  for (const cx of [-0.9, 0.9]) {
    for (const cz of [-0.8, 0.8]) sAdd(dark, pipeBetween([cx, 0, cz], [cx * 0.8, -drop, cz * 0.7], 0.022, 0.022, 5));
  }
  sAdd(yellow, rangeBox(-0.95, -drop - 0.55, -0.75, 0.95, -drop, 0.75, 0.05), T_RAIL);
  for (const sz of [-0.45, 0.45]) sAdd(dark, cylAxis(0.3, 0.3, 0.12, 'z', 0, -drop + 0.12, sz, 12));
  const spTop = -drop - 0.55, spBot = spTop - 0.34;
  for (const px of [-0.6, 0.6]) sAdd(yellow, rangeBox(px - 0.16, spBot, -6.02, px + 0.16, spTop, 6.02, 0.03), T_RAIL);
  for (const pz of [-5.92, 5.92]) sAdd(yellow, rangeBox(-1.22, spBot, pz - 0.14, 1.22, spTop, pz + 0.14, 0.03), T_RAIL);
  sAdd(yellow, rangeBox(-0.9, spBot - 0.02, -1.3, 0.9, spTop + 0.1, 1.3, 0.04), T_RAIL);
  for (const px of [-1.2, 1.2]) {
    for (const pz of [-6, 6]) {
      sAdd(dark, rangeBox(px - 0.1, spBot - 0.1, pz - 0.1, px + 0.1, spBot + 0.05, pz + 0.1));
      sAdd(yellow, beamBetween([px * 1.02, spBot, pz * 1.01], [px * 1.22, spBot - 0.55, pz * 1.04], 0.28, 0.03), T_RAIL);
    }
  }
  const cTop = spBot - 0.08, cBot = cTop - 2.59, cTint = [0.9, 0.82, 0.8];
  sAdd(red, rangeBox(-1.2, cBot, -6.08, 1.2, cTop, 6.08, 0.03), cTint);
  for (const px of [-1.22, 1.22]) {
    for (let pz = -5.7; pz <= 5.71; pz += 0.57) sAdd(red, rangeBox(px - 0.02, cBot + 0.16, pz - 0.1, px + 0.02, cTop - 0.12, pz + 0.1), cTint);
  }
  for (const pz of [-6.095, 6.095]) {
    for (const px of [-1.22, 1.22]) sAdd(red, rangeBox(px - 0.08, cBot, pz - 0.08, px + 0.08, cTop, pz + 0.08), [0.7, 0.62, 0.6]);
  }
  for (const px of [-0.8, -0.3, 0.3, 0.8]) sAdd(dark, pipeBetween([px, cBot + 0.08, 6.1], [px, cTop - 0.08, 6.1], 0.02, 0.02, 5));

  const structure = batch.build({ cast: true, recv: true });
  const spreader = spBatch.build({ cast: true, recv: true });
  spreader.position.set(xSpreader, 20.7, 0);
  spreader.name = 'crane-spreader';
  structure.add(spreader);

  const lamps = blink.build();
  if (lamps) {
    lamps.frustumCulled = false;
    structure.add(lamps);
  }

  // Center the 50m crane neatly around origin (x = -31 shifts mid-boom closer to center)
  if (centered) structure.position.set(-31, 0, 0);

  const root = new THREE.Group();
  root.name = 'crane';
  root.add(structure);

  const update = (_dt = 0.016, t = 0) => {
    blink.uTime.value = t;
    if (animate) {
      spreader.position.y = 20.7 + Math.sin(t * 0.45) * 1.8;
    }
  };
  return { root, spreader, update };
}

// ============================================================================
// 3. Distant Backdrop Gantry Crane
// ============================================================================
export function createDistantCrane({
  materials = defaultMaterials,
  scale = 1,
  boomUp = false,
  tint = [0.3, 0.36, 0.44],
} = {}) {
  const mat = materials.get('paint_grey', { vertexColors: true });
  const batch = new MeshBatcher();
  const geos = [];
  const rb = (x0, y0, z0, x1, y1, z1) => geos.push(rangeBox(x0, y0, z0, x1, y1, z1));

  for (const x of [-5, 5]) for (const z of [-5.4, 5.4]) rb(x - 0.6, 0, z - 0.6, x + 0.6, 24, z + 0.6);
  for (const z of [-5.4, 5.4]) {
    rb(-5, 12.5, z - 0.45, 5, 13.5, z + 0.45);
    rb(-5, 23, z - 0.4, 5, 23.8, z + 0.4);
    geos.push(beamBetween([-5, 13.5, z], [5, 23, z], 0.4, 0.4));
  }
  for (const x of [-5, 5]) {
    rb(x - 0.45, 12.5, -5.4, x + 0.45, 13.5, 5.4);
    rb(x - 0.45, 22.8, -5.4, x + 0.45, 23.8, 5.4);
    rb(x - 0.45, 3.6, -5.4, x + 0.45, 4.6, 5.4);
  }
  rb(-11.5, 21.2, -2.3, 6.3, 22.8, 2.3);
  rb(-10.9, 22.8, -2.9, -3.1, 26, 2.9);
  for (const s of [-1, 1]) {
    geos.push(beamBetween([5, 23.8, s * 5.4], [4.1, 30, s * 1.5], 0.6, 0.6));
    geos.push(beamBetween([-5, 23.8, s * 5.4], [4.1, 30, s * 1.5], 0.5, 0.5));
  }
  rb(3.6, 29.6, -2, 4.6, 30.4, 2);
  if (boomUp) {
    geos.push(beamBetween([6.6, 22, 0], [10.5, 52, 0], 4.6, 1.6));
    geos.push(beamBetween([4.1, 30, 0], [9.4, 44, 0], 0.3, 0.3));
  } else {
    rb(6.6, 21.2, -2.3, 38.5, 22.8, 2.3);
    geos.push(beamBetween([4.1, 30, 0], [20.5, 24.3, 0], 0.3, 0.3));
    geos.push(beamBetween([4.1, 30, 0], [34.5, 24.3, 0], 0.3, 0.3));
    rb(15, 18.3, 2.4, 19.5, 22.2, 4.4);
  }

  for (const g of geos) {
    if (scale !== 1) g.scale(scale, scale, scale);
    batch.add(mat, g, tint);
  }
  const root = batch.build({ cast: true, recv: true });
  root.name = 'distant_crane';
  if (!boomUp) root.position.x = -12;
  return { root };
}

// ============================================================================
// 4. Cargo Ship ("MV KITTIWAKE", 63m Bulk/Container Carrier)
// ============================================================================
export function createShip({ materials = defaultMaterials, animate = true, centered = true } = {}) {
  const batch = new MeshBatcher();
  const blink = createBlinkBatcher();

  const hullDark = materials.get('hull_paint', { vertexColors: true });
  const hullRed = materials.get('hull_red', { vertexColors: true });
  const white = materials.get('paint_white', { vertexColors: true });
  const dark = materials.get('steel_dark');
  const galv = materials.get('steel_galv');
  const rope = materials.get('rope');
  const rubber = materials.get('rubber');

  const add = (mat, geo, tint) => batch.add(mat, geo, tint);

  const shipX = 41, halfBeam = 8, bowZ = -9, shipLen = 63;
  const keelY = -4.4, deckBase = 13, waterY = -1.6;
  const stepFn = (e0, e1, t) => {
    const k = Math.min(1, Math.max(0, (t - e0) / (e1 - e0)));
    return k * k * (3 - 2 * k);
  };
  const sheer = (s) => 1.7 * Math.pow(Math.max(0, 1 - s / 20), 2) + 0.5 * Math.pow(Math.max(0, (s - (shipLen - 12)) / 12), 2);
  const deckAt = (s) => deckBase + sheer(s);
  const bulwarkH = (s) => 1.15 * (1 - stepFn(14.5, 18, s) + stepFn(shipLen - 10.5, shipLen - 8, s));
  const gunwaleAt = (s) => deckAt(s) + bulwarkH(s);
  const bowTop = gunwaleAt(0);

  function hullPos(s, y, side) {
    const rake = (bowTop - y) * 0.22;
    const bowMask = Math.max(0, 1 - s / 22);
    const z = bowZ - s - rake * bowMask;
    const hFrac = Math.min(1, Math.max(0, (y - waterY) / (deckBase - waterY)));
    const flare = 17 - 8.5 * Math.pow(hFrac, 1.3);
    const t = s / flare;
    const curve = t >= 1 ? 1 : Math.pow(Math.sin((t * Math.PI) / 2), 0.72);
    let w = 0.2 + (halfBeam - 0.2) * curve;
    const sternT = (s - (shipLen - 10)) / 10;
    if (sternT > 0) w *= 1 - 0.24 * sternT * sternT * (1 - 0.6 * hFrac);
    return V3(shipX + side * w, y, z);
  }

  function hullNrm(s, y, side) {
    const ds = hullPos(s + 0.05, y, side).sub(hullPos(Math.max(0, s - 0.05), y, side));
    const dy = hullPos(s, y + 0.05, side).sub(hullPos(s, y - 0.05, side));
    const n = ds.cross(dy).normalize();
    if (n.x * side + n.z * 0.25 < 0) n.negate();
    return n;
  }

  function hullPatch(s0, s1, y0, y1, side, out = 0.012, segS = 6, segY = 1) {
    const pos = [], uvs = [], nrm = [], idx = [];
    for (let iy = 0; iy <= segY; iy++) {
      for (let ix = 0; ix <= segS; ix++) {
        const s = s0 + ((s1 - s0) * ix) / segS;
        const y = y0 + ((y1 - y0) * iy) / segY;
        const n = hullNrm(s, y, side);
        const p = hullPos(s, y, side).addScaledVector(n, out);
        pos.push(p.x, p.y, p.z);
        nrm.push(n.x, n.y, n.z);
        uvs.push(side < 0 ? 1 - ix / segS : ix / segS, iy / segY);
      }
    }
    const stride = segS + 1;
    for (let iy = 0; iy < segY; iy++) {
      for (let ix = 0; ix < segS; ix++) {
        const a = iy * stride + ix, b = a + 1, c = a + stride + 1, d = a + stride;
        if (side > 0) idx.push(a, b, c, a, c, d);
        else idx.push(a, c, b, a, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    return g;
  }

  const sStops = [0, 0.35, 0.9, 1.8, 3, 4.5, 6, 8, 10, 12, 14.5, 17, 20];
  for (let s = 23; s < shipLen - 0.5; s += 3) sStops.push(s);
  sStops.push(shipLen);
  const fStops = [0, 0.17, 0.34, 0.5, 0.66, 0.83, 1];
  const yProfile = (s) => {
    const dk = deckAt(s);
    const arr = [keelY, -2.3, -0.4, 1];
    for (let i = 1; i < fStops.length; i++) arr.push(1 + (dk - 1) * fStops[i]);
    arr.push(gunwaleAt(s));
    return arr;
  };

  const qbRed = new QuadBuilder();
  const qbHull = new QuadBuilder();
  const plateCol = (pos, bandIdx, isTop, plateGain) => {
    const base = weatherTint(pos.x * 0.6, pos.y, pos.z * 0.6, [1, 1, 1], 0.8);
    const c = [base[0] * plateGain, base[1] * plateGain, base[2] * plateGain];
    if (bandIdx < 3) {
      if (pos.y < -0.2) { c[0] *= 0.55; c[1] *= 0.72; c[2] *= 0.55; }
      else if (isTop) { c[0] *= 1.12; c[2] *= 0.92; }
    } else if (pos.y < 1.1) {
      c[0] *= 1.7; c[1] *= 1.62; c[2] *= 1.45;
    }
    return c;
  };

  for (const side of [-1, 1]) {
    for (let i = 0; i < sStops.length - 1; i++) {
      const s0 = sStops[i], s1 = sStops[i + 1];
      const y0 = yProfile(s0), y1 = yProfile(s1);
      for (let j = 0; j < 10; j++) {
        if (j === 9 && bulwarkH(s0) < 0.02 && bulwarkH(s1) < 0.02) continue;
        const gain = (j < 3 ? 0.8 : 0.58) + 0.36 * hash2(i * 7 + (side > 0 ? 100 : 0), j);
        const pts = [hullPos(s0, y0[j], side), hullPos(s1, y1[j], side), hullPos(s1, y1[j + 1], side), hullPos(s0, y0[j + 1], side)];
        const nrms = [hullNrm(s0, y0[j], side), hullNrm(s1, y1[j], side), hullNrm(s1, y1[j + 1], side), hullNrm(s0, y0[j + 1], side)];
        const uvs = [[s0, y0[j]], [s1, y1[j]], [s1, y1[j + 1]], [s0, y0[j + 1]]];
        const cols = [plateCol(pts[0], j, false, gain), plateCol(pts[1], j, false, gain), plateCol(pts[2], j, true, gain), plateCol(pts[3], j, true, gain)];
        if (s0 > 1.5 && j >= 2 && j < 9) {
          const ctr = pts[0].clone().add(pts[1]).add(pts[2]).add(pts[3]).multiplyScalar(0.25);
          for (let k = 0; k < 4; k++) nrms[k].addScaledVector(ctr.clone().sub(pts[k]).normalize(), 0.075).normalize();
        }
        (j < 3 ? qbRed : qbHull).quad(pts, nrms, uvs, cols);
      }
    }
  }

  // Stem, transom & main deck plating
  {
    const yBow = yProfile(0), ySt = yProfile(shipLen);
    const nBow = V3(0, 0.2, 1).normalize(), nSt = V3(0, 0, -1), nUp = V3(0, 1, 0);
    for (let j = 0; j < 10; j++) {
      const col = j < 3 ? [0.8, 0.8, 0.8] : [0.9, 0.9, 0.9];
      (j < 3 ? qbRed : qbHull).quad(
        [hullPos(0, yBow[j], -1), hullPos(0, yBow[j], 1), hullPos(0, yBow[j + 1], 1), hullPos(0, yBow[j + 1], -1)],
        [nBow, nBow, nBow, nBow],
        [[0, yBow[j]], [0.4, yBow[j]], [0.4, yBow[j + 1]], [0, yBow[j + 1]]],
        [col, col, col, col]
      );
      (j < 3 ? qbRed : qbHull).quad(
        [hullPos(shipLen, ySt[j], -1), hullPos(shipLen, ySt[j], 1), hullPos(shipLen, ySt[j + 1], 1), hullPos(shipLen, ySt[j + 1], -1)],
        [nSt, nSt, nSt, nSt],
        [[0, ySt[j]], [14, ySt[j]], [14, ySt[j + 1]], [0, ySt[j + 1]]],
        [col, col, col, col]
      );
    }
    for (let i = 0; i < sStops.length - 1; i++) {
      const p0 = hullPos(sStops[i], deckAt(sStops[i]), -1);
      const p1 = hullPos(sStops[i], deckAt(sStops[i]), 1);
      const p2 = hullPos(sStops[i + 1], deckAt(sStops[i + 1]), 1);
      const p3 = hullPos(sStops[i + 1], deckAt(sStops[i + 1]), -1);
      const dCol = [0.75, 0.72, 0.7];
      qbRed.quad([p0, p1, p2, p3], [nUp, nUp, nUp, nUp], [[p0.x, p0.z], [p1.x, p1.z], [p2.x, p2.z], [p3.x, p3.z]], [dCol, dCol, dCol, dCol]);
    }
  }
  add(hullRed, qbRed.toGeometry());
  add(hullDark, qbHull.toGeometry());

  // Port hull ribs & strakes
  {
    const surf = (s, y) => hullPos(s, y, -1).addScaledVector(hullNrm(s, y, -1), 0.012);
    const ribTint = [1.05, 0.92, 0.8];
    for (let i = 2; i < sStops.length - 1; i++) {
      const y0 = yProfile(sStops[i]), y1 = yProfile(sStops[i + 1]);
      for (let j = 4; j <= 9; j++) add(hullDark, beamBetween(surf(sStops[i], y0[j]), surf(sStops[i + 1], y1[j]), 0.03, 0.045), ribTint);
      for (let j = 3; j < 9; j++) {
        if ((i + j) % 2 === 0) add(hullDark, beamBetween(surf(sStops[i], y0[j]), surf(sStops[i], y0[j + 1]), 0.035, 0.03), ribTint);
      }
    }
  }

  // Gunwales, rails, hawsepipes & anchors
  for (const side of [-1, 1]) {
    for (let i = 3; i < sStops.length - 1; i++) {
      const fPt = (s, y) => hullPos(s, y, side).addScaledVector(hullNrm(s, y, side), 0.07);
      add(hullDark, beamBetween(fPt(sStops[i], 9.6), fPt(sStops[i + 1], 9.6), 0.16, 0.3), [0.55, 0.55, 0.55]);
      if (bulwarkH(sStops[i]) > 0.6 && bulwarkH(sStops[i + 1]) > 0.6) {
        add(dark, pipeBetween(hullPos(sStops[i], gunwaleAt(sStops[i]), side), hullPos(sStops[i + 1], gunwaleAt(sStops[i + 1]), side), 0.07, 0.07, 6));
      }
    }
    for (let i = 0; i < 3; i++) {
      add(dark, pipeBetween(hullPos(sStops[i], gunwaleAt(sStops[i]), side), hullPos(sStops[i + 1], gunwaleAt(sStops[i + 1]), side), 0.07, 0.07, 6));
    }
    const rPts = [];
    for (let s = 18; s <= shipLen - 10.4; s += 3) rPts.push(hullPos(s, deckAt(s), side).add(V3(-side * 0.12, 0, 0)));
    railing(batch, dark, rPts, { h: 1.05, post: 1.5, r: 0.028 });

    const ax = 4.6, ay = deckAt(ax) - 2.3;
    const ap = hullPos(ax, ay, side), an = hullNrm(ax, ay, side);
    add(dark, pipeBetween(ap.clone().addScaledVector(an, -0.3), ap.clone().addScaledVector(an, 0.22), 0.5, 0.5, 12, true));
    const aPt = (s, y, o) => hullPos(s, y, side).addScaledVector(hullNrm(s, y, side), o);
    add(dark, beamBetween(aPt(ax, ay - 0.1, 0.34), aPt(ax, ay - 2.3, 0.3), 0.22, 0.22, 0.03));
    add(dark, beamBetween(aPt(ax - 0.95, ay - 2.45, 0.34), aPt(ax + 0.95, ay - 2.45, 0.34), 0.42, 0.42, 0.05));
    for (const d of [-0.8, 0.8]) add(dark, beamBetween(aPt(ax + d, ay - 2.4, 0.3), aPt(ax + d * 1.1, ay - 1.1, 0.34), 0.5, 0.12, 0.02));
  }

  // Nameboard KITTIWAKE & rust streaks / draft marks
  const shipLabel = materials.label('KITTIWAKE', { color: 'white', font: 'sans' });
  const lw = Math.min(12, 1.7 * Math.max(2, shipLabel.aspect || 6));
  add(shipLabel.material, hullPatch(7.6, 7.6 + lw, 10.25, 11.95, -1, 0.014, 10, 1));
  add(shipLabel.material, hullPatch(7.6, 7.6 + lw, 10.25, 11.95, 1, 0.014, 10, 1));

  const rustDecal = materials.decal('rust_run');
  add(rustDecal.material, hullPatch(3.8, 5.4, deckAt(4.6) - 9.5, deckAt(4.6) - 2.6, -1, 0.012, 2, 3));
  for (let s = 21.5; s < shipLen - 11; s += 5.5) {
    const p = hullPos(s, deckBase - 0.45, -1);
    add(dark, rangeBox(p.x - 0.04, p.y - 0.09, p.z - 0.3, p.x + 0.01, p.y + 0.09, p.z + 0.3));
    const rh = 2.6 + 3.2 * hash2(Math.round(s * 10), 5);
    add(rustDecal.material, hullPatch(s - 0.45, s + 0.45, deckBase - 0.5 - rh, deckBase - 0.5, -1, 0.012, 1, 1));
  }
  for (const s of [6.4, shipLen - 7]) {
    for (let k = 0; k < 9; k++) {
      const y = 1.6 + k * 0.62;
      add(white, hullPatch(s, s + (k % 2 ? 0.28 : 0.5), y, y + 0.13, -1, 0.01, 1, 1), [1.1, 1.1, 1.05]);
    }
  }
  add(white, hullPatch(33, 33.9, 3.2, 3.3, -1, 0.01, 1, 1), [1.1, 1.1, 1.05]);
  add(white, hullPatch(33.4, 33.5, 2.4, 4.1, -1, 0.01, 1, 1), [1.1, 1.1, 1.05]);

  // Forecastle windlasses, bollards & foremast
  const fcY = deckAt(7);
  for (const side of [-1, 1]) {
    add(dark, cylAxis(0.55, 0.55, 0.9, 'x', shipX + side * 1.5, fcY + 0.75, bowZ - 6.2, 12));
    add(dark, rangeBox(shipX + side * 0.5, fcY, bowZ - 6.9, shipX + side * 2.6, fcY + 0.5, bowZ - 5.5, 0.04));
    for (const dz of [0, 0.7]) add(dark, cylAxis(0.16, 0.16, 0.7, 'y', shipX + side * 4.2, fcY + 0.35, bowZ - 8.5 - dz, 8));
  }
  const fmZ = bowZ - 10.5, fmTop = fcY + 15;
  add(white, cylAxis(0.26, 0.42, 15, 'y', shipX, fcY + 7.5, fmZ, 10), [0.85, 0.8, 0.7]);
  add(white, rangeBox(shipX - 2.6, fcY + 10, fmZ - 0.12, shipX + 2.6, fcY + 10.24, fmZ + 0.12), [0.85, 0.8, 0.7]);
  add(dark, pipeBetween([shipX, fmTop, fmZ], [shipX, fmTop + 2.4, fmZ], 0.03, 0.03, 5));
  for (const s of [-1, 1]) {
    add(dark, pipeBetween([shipX + s * 2.5, fcY + 10.2, fmZ], [shipX + s * 5.6, fcY + 0.6, fmZ - 1.2], 0.022, 0.022, 4));
    add(dark, pipeBetween([shipX + s * 2.5, fcY + 10.2, fmZ], [shipX, fmTop, fmZ], 0.02, 0.02, 4));
  }
  add(dark, pipeBetween([shipX, fmTop, fmZ], [shipX, gunwaleAt(0) + 0.3, bowZ - 0.4], 0.022, 0.022, 4));
  add(dark, pipeBetween([shipX, gunwaleAt(0), bowZ - 0.3], [shipX, gunwaleAt(0) + 2.6, bowZ - 0.15], 0.03, 0.03, 5));

  // Forward deck crane
  const dcBase = V3(shipX, fcY + 2.2, fmZ - 0.5);
  const dcTip = V3(shipX + 1.2, fcY + 9.5, fmZ - 11.5);
  add(white, pipeBetween(dcBase, dcTip, 0.2, 0.2, 8, true), [0.85, 0.8, 0.7]);
  add(dark, pipeBetween(dcTip, [shipX, fmTop - 0.4, fmZ], 0.022, 0.022, 4));
  add(dark, pipeBetween(dcTip, [dcTip.x, deckBase + 4, dcTip.z], 0.018, 0.018, 4));
  add(dark, rangeBox(dcTip.x - 0.18, deckBase + 3.4, dcTip.z - 0.18, dcTip.x + 0.18, deckBase + 4, dcTip.z + 0.18, 0.04));
  blink.add(beacon(shipX, fmTop - 0.6, fmZ + 0.5, 0.14), [5, 4.6, 3.8], 0);

  // Deck cargo containers (3 bays x 6 across)
  const cCols = [
    [0.62, 0.17, 0.13], [0.17, 0.29, 0.5], [0.2, 0.42, 0.3], [0.78, 0.36, 0.12],
    [0.8, 0.62, 0.16], [0.82, 0.83, 0.8], [0.4, 0.43, 0.47], [0.16, 0.42, 0.45],
  ];
  [[-45.6, 12.19], [-32.7, 12.19], [-22.8, 6.06]].forEach(([cz, len], bay) => {
    add(hullRed, rangeBox(shipX - 7.7, deckBase, cz - len / 2 - 0.2, shipX + 7.7, deckBase + 0.42, cz + len / 2 + 0.2, 0.04), [0.6, 0.6, 0.62]);
    for (let c = 0; c < 6; c++) {
      const cx = shipX + (c - 2.5) * 2.52;
      const hCount = bay === 2 ? 2 : 2 + (hash2(c * 3 + bay, 9) > 0.4 ? 1 : 0);
      for (let t = 0; t < hCount; t++) {
        const y0 = deckBase + 0.44 + t * 2.61;
        const tint = cCols[Math.floor(hash2(c * 5 + t * 13 + bay * 29, 2) * cCols.length)];
        add(white, rangeBox(cx - 1.22, y0, cz - len / 2, cx + 1.22, y0 + 2.59, cz + len / 2, 0.035), tint);
        if (c === 0) {
          for (let rz = cz - len / 2 + 0.5; rz < cz + len / 2 - 0.3; rz += 0.58) {
            add(white, rangeBox(cx - 1.24, y0 + 0.15, rz - 0.1, cx - 1.21, y0 + 2.45, rz + 0.1), tint);
          }
        }
      }
    }
    for (const gz of [cz - len / 2 - 0.45, cz + len / 2 + 0.45]) {
      for (let c = 0; c <= 6; c++) add(dark, rangeBox(shipX + (c - 3) * 2.52 - 0.05, deckBase, gz - 0.05, shipX + (c - 3) * 2.52 + 0.05, deckBase + 5.6, gz + 0.05));
      for (const gy of [deckBase + 2.9, deckBase + 5.6]) add(dark, rangeBox(shipX - 7.6, gy - 0.05, gz - 0.12, shipX + 7.6, gy + 0.05, gz + 0.12));
    }
  });

  // Aft accommodation block, bridge wings, mast, funnel & lifeboat
  const supTint = [0.92, 0.93, 0.92], supF = -53, supB = -66.5;
  [[7.2, 13, 15.9, 0], [6.7, 15.9, 18.7, 0.5], [6.3, 18.7, 21.5, 1], [6.5, 21.5, 24.4, 1.5]].forEach(([hw, y0, y1, ins], lvl) => {
    add(white, rangeBox(shipX - hw, y0, supB + ins * 0.4, shipX + hw, y1, supF - ins, 0.08), supTint);
    add(white, rangeBox(shipX - hw - 0.7, y1 - 0.06, supB + ins * 0.4 - 0.3, shipX + hw + 0.7, y1 + 0.06, supF - ins + 1), [0.7, 0.72, 0.72]);
    const ry = y1 + 0.06;
    const rx0 = shipX - hw - 0.67, rx1 = shipX + hw + 0.67;
    const rzF = supF - ins + 0.97, rzB = supB + ins * 0.4 - 0.27;
    railing(batch, galv, [[rx0, ry, rzB], [rx0, ry, rzF], [rx1, ry, rzF], [rx1, ry, rzB]], { h: 1.05, post: 1.6, r: 0.026 });
    if (lvl < 3) {
      for (let z = supF - ins - 1.2, k = 0; z > supB + 1.5; z -= 1.45, k++) {
        const lit = hash2(k * 3 + lvl * 11, 4) > 0.8;
        for (const s of [-1, 1]) {
          const wg = rangeBox(shipX + s * (hw + 0.012) - 0.012, y0 + 1.25, z - 0.33, shipX + s * (hw + 0.012) + 0.012, y0 + 1.85, z + 0.33);
          if (lit && s < 0) blink.add(wg, [2.6, 1.75, 0.95], 0);
          else add(dark, wg);
        }
      }
      for (let x = shipX - hw + 1, k = 0; x < shipX + hw - 0.6; x += 1.5, k++) {
        const wg = rangeBox(x - 0.33, y0 + 1.25, supF - ins - 0.01, x + 0.33, y0 + 1.85, supF - ins + 0.014);
        if (hash2(k + lvl * 7, 8) > 0.84) blink.add(wg, [2.6, 1.75, 0.95], 0);
        else add(dark, wg);
      }
    }
  });

  // Bridge house windows & wings
  const brY = 21.5, brZ = supF - 1.5, brW = 6.5;
  add(dark, rangeBox(shipX - brW + 0.2, brY + 1.3, brZ - 0.01, shipX + brW - 0.2, brY + 2.25, brZ + 0.02));
  for (let x = shipX - brW + 0.75, k = 0; x < shipX + brW - 0.4; x += 1.05, k++) {
    if (hash2(k, 21) > 0.62) blink.add(rangeBox(x - 0.44, brY + 1.36, brZ + 0.02, x + 0.44, brY + 2.19, brZ + 0.03), [2.6, 1.75, 0.95], 0);
    add(white, rangeBox(x + 0.48, brY + 1.3, brZ, x + 0.57, brY + 2.25, brZ + 0.04), supTint);
  }
  for (const s of [-1, 1]) {
    add(dark, rangeBox(shipX + s * brW - 0.02, brY + 1.3, brZ - 5, shipX + s * brW + 0.02, brY + 2.25, brZ - 0.2));
    add(white, rangeBox(shipX + s * 6.4, brY - 0.12, brZ - 3.4, shipX + s * 8.3, brY + 0.02, brZ + 0.9, 0.03), supTint);
    add(white, rangeBox(shipX + s * 8.22, brY, brZ - 3.4, shipX + s * 8.3, brY + 1.1, brZ + 0.9), supTint);
    add(white, rangeBox(shipX + s * 6.5, brY, brZ + 0.82, shipX + s * 8.3, brY + 1.1, brZ + 0.9), supTint);
    add(dark, beamBetween([shipX + s * 6.6, brY - 2.6, brZ - 1.2], [shipX + s * 8.1, brY - 0.1, brZ - 1.2], 0.12, 0.12));
    blink.add(beacon(shipX + s * 8.25, brY + 1.35, brZ - 0.4, 0.13), s < 0 ? [0.3, 5, 1.6] : [6, 0.4, 0.3], 0);
  }
  blink.add(rangeBox(shipX - 2.2, 24.42, brZ + 0.6, shipX - 1.6, 24.52, brZ + 0.9), [2.6, 1.75, 0.95], 0);
  blink.add(rangeBox(shipX + 1.6, 24.42, brZ + 0.6, shipX + 2.2, 24.52, brZ + 0.9), [2.6, 1.75, 0.95], 0);

  // Main mast & Funnel
  const mPos = V3(shipX, 24.46, -57.5);
  add(white, cylAxis(0.16, 0.28, 8.5, 'y', mPos.x, mPos.y + 4.25, mPos.z, 8), supTint);
  add(white, rangeBox(mPos.x - 2.4, mPos.y + 5.2, mPos.z - 0.08, mPos.x + 2.4, mPos.y + 5.36, mPos.z + 0.08), supTint);
  add(white, rangeBox(mPos.x - 1.3, mPos.y + 7.3, mPos.z - 0.06, mPos.x + 1.3, mPos.y + 7.42, mPos.z + 0.06), supTint);
  add(white, rangeBox(mPos.x - 0.5, mPos.y + 3.2, mPos.z, mPos.x + 0.5, mPos.y + 3.3, mPos.z + 1.2), supTint);
  for (const dx of [-2.3, -1.2, 1.2, 2.3]) {
    add(dark, pipeBetween([mPos.x + dx, mPos.y + 5.36, mPos.z], [mPos.x + dx, mPos.y + 5.36 + (Math.abs(dx) > 2 ? 3.2 : 1.2), mPos.z], 0.012, 0.012, 4));
  }
  add(dark, pipeBetween([mPos.x, mPos.y + 8.5, mPos.z], [mPos.x, mPos.y + 10.8, mPos.z], 0.015, 0.015, 4));
  for (const s of [-1, 1]) add(dark, pipeBetween([mPos.x + s * 2.3, mPos.y + 5.3, mPos.z], [shipX + s * 6, 24.5, supB + 2], 0.014, 0.014, 4));
  blink.add(beacon(mPos.x, mPos.y + 8.7, mPos.z + 0.3, 0.14), [5, 4.6, 3.8], 0);
  blink.add(beacon(mPos.x, mPos.y + 7.6, mPos.z, 0.12), [8, 0.4, 0.25], 3.4, 0.6, 0.4);

  const funZ = -62.6;
  add(white, rangeBox(shipX - 1.7, 24.4, funZ - 2.3, shipX + 1.7, 29.3, funZ + 2.1, 0.25), [0.2, 0.34, 0.5]);
  add(white, rangeBox(shipX - 1.72, 27.2, funZ - 2.32, shipX + 1.72, 28.1, funZ + 2.12, 0.1), [0.9, 0.88, 0.8]);
  add(white, rangeBox(shipX - 1.75, 29.3, funZ - 2.35, shipX + 1.75, 30.3, funZ + 2.15, 0.2), [0.07, 0.07, 0.08]);
  for (const dz of [-0.9, 0.5]) add(dark, cylAxis(0.28, 0.28, 1.1, 'y', shipX, 30.7, funZ + dz, 10));
  const funnelMark = materials.decal('logo_b');
  add(funnelMark.material, signQuad(2.6, 2.6 / Math.max(1, funnelMark.aspect || 1), shipX - 1.705, 26.1, funZ - 0.1, -Math.PI / 2));

  // Port-side free-fall lifeboat + davits
  {
    const lbx = shipX - 7.9, lby = 17.5, lbz = -61, lbt = [1.25, 0.42, 0.1];
    const lbGeo = new THREE.CapsuleGeometry(1.15, 3.6, 4, 12);
    lbGeo.rotateX(Math.PI / 2);
    lbGeo.scale(0.95, 0.82, 1);
    lbGeo.translate(lbx, lby, lbz);
    add(white, lbGeo, lbt);
    add(white, rangeBox(lbx - 0.6, lby + 0.7, lbz - 1.2, lbx + 0.6, lby + 1.25, lbz + 0.9, 0.12), lbt);
    for (const dz of [-2.1, 2.1]) {
      add(dark, beamBetween([shipX - 6.9, 15.9, lbz + dz], [lbx - 0.2, lby + 2.3, lbz + dz], 0.16, 0.22));
      add(dark, pipeBetween([lbx - 0.2, lby + 2.2, lbz + dz], [lbx, lby + 0.9, lbz + dz * 0.8], 0.02, 0.02, 4));
    }
  }
  add(dark, pipeBetween([shipX, gunwaleAt(shipLen), bowZ - shipLen + 0.4], [shipX, gunwaleAt(shipLen) + 3.4, bowZ - shipLen - 0.3], 0.03, 0.03, 5));
  blink.add(beacon(shipX, gunwaleAt(shipLen) + 0.6, bowZ - shipLen - 0.1, 0.1), [4, 3.7, 3], 0);

  // Side accommodation gangway
  {
    const gTop = V3(32.55, 13, -51.5), gBot = V3(31.4, 1.25, -38.5);
    for (const dx of [-0.4, 0.4]) {
      add(galv, beamBetween([gTop.x + dx, gTop.y - 0.1, gTop.z], [gBot.x + dx, gBot.y - 0.1, gBot.z], 0.05, 0.3));
      add(galv, pipeBetween([gTop.x + dx, gTop.y + 1, gTop.z], [gBot.x + dx, gBot.y + 1, gBot.z], 0.025, 0.025, 5));
      add(galv, pipeBetween([gTop.x + dx, gTop.y + 0.5, gTop.z], [gBot.x + dx, gBot.y + 0.5, gBot.z], 0.02, 0.02, 4));
    }
    for (let i = 0; i <= 8; i++) {
      const p = gTop.clone().lerp(gBot, i / 8);
      for (const dx of [-0.4, 0.4]) add(galv, pipeBetween([p.x + dx, p.y - 0.1, p.z], [p.x + dx, p.y + 1, p.z], 0.02, 0.02, 4));
    }
    for (let i = 1; i < 44; i++) {
      const p = gTop.clone().lerp(gBot, i / 44);
      add(galv, rangeBox(p.x - 0.38, p.y - 0.02, p.z - 0.12, p.x + 0.38, p.y, p.z + 0.12));
    }
    add(galv, rangeBox(31, 1.15, -38.5, 32, 1.2, -37.3));
    add(galv, beamBetween([31.2, 1.2, -37.9], [29.2, 0.12, -37.9], 0.8, 0.06));
    railing(batch, galv, [[31, 1.2, -37.32], [32, 1.2, -37.32], [32, 1.2, -38.5]], { post: 1.1 });
    add(dark, pipeBetween([gTop.x, gTop.y + 3.2, gTop.z + 4], [gBot.x, gBot.y + 1.2, gBot.z + 0.3], 0.014, 0.014, 4));
    add(dark, beamBetween([33.2, 13.2, gTop.z + 4], [32.2, 16.4, gTop.z + 4], 0.14, 0.14));
  }

  // Mooring lines & rubber fenders along port hull
  const addMooring = (s, y, target, sag) => {
    const p = hullPos(s, y, -1);
    p.x -= 0.1;
    const pts = parabolaPoints(p, target, sag, 12);
    add(rope, pipeChain(pts, 0.042, 5));
    const q3 = pts[3], dir = pts[4].clone().sub(q3).normalize();
    const guard = cylAxis(0.42, 0.42, 0.012, 'y', 0, 0, 0, 12);
    guard.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir));
    guard.translate(q3.x, q3.y, q3.z);
    add(galv, guard);
    add(dark, rangeBox(p.x - 0.12, p.y - 0.28, p.z - 0.35, p.x + 0.12, p.y + 0.28, p.z + 0.35, 0.05));
  };
  addMooring(4.4, deckAt(4.4) + 0.55, V3(29.2, 0.5, -12), 1.3);
  addMooring(4.9, deckAt(4.9) + 0.55, V3(29.2, 0.36, -12.1), 1.7);
  addMooring(1.6, deckAt(1.6) + 0.6, V3(29.2, 0.5, -2), 1.6);
  addMooring(2.2, deckAt(2.2) + 0.6, V3(29.2, 0.36, -2.1), 2.2);
  addMooring(shipLen - 5, deckAt(shipLen - 5) + 0.6, V3(29.2, 0.5, -82), 1.6);
  addMooring(shipLen - 9, deckAt(shipLen - 9) + 0.6, V3(29.2, 0.45, -58), 1.2);
  for (const bz of [-82, -58]) {
    add(dark, cylAxis(0.2, 0.26, 0.55, 'y', 29.2, 0.27, bz, 10));
    add(dark, cylAxis(0.34, 0.3, 0.14, 'y', 29.2, 0.6, bz, 10));
  }
  for (const fz of [-17.6, -37, -54]) {
    add(rubber, cylAxis(1.25, 1.25, 2.2, 'z', 31.55, waterY + 0.35, fz, 14));
    add(rubber, cylAxis(0.45, 1.25, 0.5, 'z', 31.55, waterY + 0.35, fz + 1.35, 14));
    add(rubber, cylAxis(1.25, 0.45, 0.5, 'z', 31.55, waterY + 0.35, fz - 1.35, 14));
    add(rope, pipeBetween([31.55, waterY + 1.6, fz], [29.9, 0.1, fz + 0.6], 0.03, 0.03, 4));
  }

  const hullMeshGrp = batch.build({ cast: true, recv: true });
  // Rotating radar scanner on main mast
  const rBatch = new MeshBatcher();
  rBatch.add(white, rangeBox(-1.25, -0.07, -0.1, 1.25, 0.07, 0.1, 0.02), supTint);
  rBatch.add(white, cylAxis(0.1, 0.12, 0.25, 'y', 0, -0.18, 0, 8), supTint);
  const radar = rBatch.build({ cast: false });
  radar.position.set(mPos.x, mPos.y + 3.62, mPos.z + 0.8);
  radar.name = 'ship-radar';
  hullMeshGrp.add(radar);

  const lamps = blink.build();
  if (lamps) {
    lamps.frustumCulled = false;
    hullMeshGrp.add(lamps);
  }

  // Shift ship so midships sits at (0, keel cleared or waterline at y=0)
  if (centered) hullMeshGrp.position.set(-shipX, -keelY, 40.5);

  const root = new THREE.Group();
  root.name = 'ship';
  root.add(hullMeshGrp);

  const update = (dt = 0.016, t = 0) => {
    blink.uTime.value = t;
    if (animate) radar.rotation.y += dt * 1.4;
  };
  return { root, radar, update };
}

// ============================================================================
// 5. Harbor Seagulls Flock (GPU Vertex-Flapping Shader)
// ============================================================================
export function createSeagulls({ count = 12, height = 4.5, seed = 5521, animate = true } = {}) {
  const rng = createRng(seed);
  const pos = [], orbits = [], pars = [];
  const wingVerts = [
    [0.15, 0, 0, 0],
    [-0.13, 0, 0, 0],
    [-0.24, 0, 0.8, 1],
    [0.15, 0, 0, 0],
    [-0.24, 0, -0.8, 1],
    [-0.13, 0, 0, 0],
  ];

  for (let i = 0; i < count; i++) {
    const cx = (rng() - 0.5) * 6;
    const cy = height + rng() * 3.5;
    const cz = (rng() - 0.5) * 6;
    const radius = 5 + rng() * 7;
    const speed = (0.28 + rng() * 0.24) * (rng() > 0.5 ? 1 : -1);
    const phase = rng() * Math.PI * 2;
    const flapFreq = 5 + rng() * 3;
    for (const v of wingVerts) {
      pos.push(v[0], v[1], v[2]);
      orbits.push(cx, cy, cz, radius);
      pars.push(speed, phase, flapFreq, v[3]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aOrbit', new THREE.Float32BufferAttribute(orbits, 4));
  geo.setAttribute('aPar', new THREE.Float32BufferAttribute(pars, 4));
  geo.computeBoundingSphere();

  const uTime = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.24, 0.26, 0.29), side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader =
      `attribute vec4 aOrbit;\nattribute vec4 aPar;\nuniform float uTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
      float ga = aPar.y + uTime * aPar.x;
      float gdir = sign(aPar.x);
      vec3 gfw = vec3(-sin(ga), 0.0, cos(ga)) * gdir;
      vec3 grt = vec3(gfw.z, 0.0, -gfw.x);
      vec3 gl = position;
      float glide = smoothstep(-0.2, 0.5, sin(uTime * 0.31 + aPar.y * 3.0));
      float gflap = sin(uTime * aPar.z + aPar.y * 7.0) * mix(0.12, 0.55, glide) + 0.18;
      gl.y += aPar.w * gflap * abs(gl.z);
      gl.z *= mix(1.0, 0.86, aPar.w * abs(gflap));
      vec3 gc = aOrbit.xyz + vec3(cos(ga), 0.0, sin(ga)) * aOrbit.w + vec3(0.0, sin(ga * 0.7 + aPar.y) * 1.1 + sin(uTime * 0.23 + aPar.y) * 0.8, 0.0);
      vec3 transformed = gc + gfw * gl.x + grt * gl.z + vec3(0.0, gl.y - 0.3 * gdir * gl.z, 0.0);`
      );
  };
  mat.customProgramCacheKey = () => 'yardkit-gulls';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'seagulls';

  const root = new THREE.Group();
  root.name = 'seagulls';
  root.add(mesh);

  const update = (_dt = 0.016, t = 0) => {
    if (animate) uTime.value = t;
  };
  return { root, uTime, update };
}
