// 从 Saltline 的关卡工具箱工厂 `uw(n)`（`/tmp/sl.pretty.js` L21842 起，120 行）抽出。
//
// 原函数返回：
//   { G, THREE, staticRoot, dynRoot, metalRects, updaters, placed, explosives,
//     rng, rnd, M, MI, add, box, slab, cyl, tube, rod, ibeam, quad, decal,
//     label, col, place, stairs, catwalk, stack, isMetal }
// 它把 `n`（游戏 ctx：mats / physics / props / rng）里的短名全部收进闭包。这里把 ctx
// 换成 `createLevel(opts)`：mats 来自 opts.materials，physics 变成 colliders 数组
// （可选转发给 opts.physics.addBox），props 走 ./props.js + ./fixtures.js。
//
// 核心语义（与游戏一致）：几何和碰撞盒用同一套世界坐标登记。`box/slab/cyl/...`
// 只摆几何，`col(...)` 单独登记 `{min,max,surface,...}`；关卡里把两者包成 wall()
// 之类的小函数就是「摆几何 + 同时登记碰撞盒/导航」。place() 会把道具
// userData.colliders 经矩阵变换后登记（旋转道具按原逻辑切条 + 收缩 7%）。
//
// 与游戏方法签名的对应关系（保持逐字一致，方便 pump-station.js 这类关卡搬迁）：
//   createLevel({ materials, seed = 1337, physics, rng, container })
//     physics: 可选，带 addBox(min, max, opts) 的物理后端，碰撞盒会同步转发
//     rng:     可选，带 fork() 的随机源（默认 createRng(seed)）
//     container: 可选，覆盖 stack() 用的集装箱工厂（默认 ./containers.js 的 createContainer）
//   place(name, x, z, yaw = 0, opts = {}, y = 0, flags = {})
//     flags: { dynamic, noCol, inert, colOpts }
//   col(x0, y0, z0, x1, y1, z1, surface = 'concrete', opts = {})
//     col(minArr, maxArr, surface = 'concrete', opts = {})
//   label(text, size, x, y, z, face = 'z+', opts = {})
//   decal(kind, size, x, y, z, face = 'z+', rot = 0)
//   stairs(x, z, yaw = 0, y = 0, opts = {})
//   catwalk(x, z, yaw = 0, y = 0, opts = {}, rails = [true, true])
//   stack(x, z, rows, yaw = 0, wobble = 1)

import * as THREE from 'three';
import {
  box as boxGeo, bevelBox as bevelBoxGeo, cyl as cylGeo, tube as tubeGeo,
  plane as planeGeo, mergeGeos, createRng,
} from './geo.js';
import { createProp, PROP_NAMES } from './props.js';
import { createFixture, FIXTURE_NAMES } from './fixtures.js';
import { createContainer } from './containers.js';
import { defaultMaterials } from './materials.js';

const PI = Math.PI;

// 原 `lP`：这两种道具不产生碰撞盒（避免踩脚/推挤卡住）。
const NO_COLLIDER_PROPS = new Set(['traffic_cone', 'jerry_can']);

const PROP_SET = new Set(PROP_NAMES);
const FIXTURE_SET = new Set(FIXTURE_NAMES);

// 原 `z` / `I` / `L`：集装箱 key → 规格名 / 高 / 长。
const CONTAINER_KEYS = { 20: 'container20', 40: 'container40', hc: 'container40hc' };
const CONTAINER_H = { container20: 2.59, container40: 2.59, container40hc: 2.9 };
const CONTAINER_L = { container20: 6.06, container40: 12.19, container40hc: 12.19 };

const BOX3 = new THREE.Box3();

function trianglesOf(geo) {
  if (!geo || !geo.attributes || !geo.attributes.position) return 0;
  return Math.round((geo.index ? geo.index.count : geo.attributes.position.count) / 3);
}

function disposeGeometries(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    if (node.userData && node.userData.sharedGeometry) return;
    node.geometry.dispose();
  });
}

export function createLevel(opts = {}) {
  const materials = opts.materials || defaultMaterials;
  const physics = opts.physics || null;

  const staticRoot = new THREE.Group();
  staticRoot.name = 'level-static';
  const dynRoot = new THREE.Group();
  dynRoot.name = 'level-dynamic';

  const metalRects = [];   // [x0, z0, x1, z1]，供 isMetal() 判断地面材质
  const updaters = [];
  const placed = [];
  const explosives = [];
  const colliders = [];

  const seed = opts.seed ?? 1337;
  const rngSource = opts.rng || createRng(seed);
  const rng = typeof rngSource.fork === 'function' ? rngSource.fork() : rngSource;
  const rnd = (a, b) => a + (b - a) * rng();

  let mergedRoot = null;

  // --- 材质 ---------------------------------------------------------------
  const M = (name, o) => materials.get(name, o);
  const MI = (name, o) => materials.get(name, { interior: true, ...(o || {}) });
  const resolveMaterial = (m) => (typeof m === 'string' ? M(m) : m);

  // --- 几何入库（原 `h` / `ns`） ------------------------------------------
  function add(geo, mat, o = {}) {
    const mesh = new THREE.Mesh(geo, resolveMaterial(mat));
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.recv !== false;
    if (o.p) mesh.position.set(o.p[0], o.p[1], o.p[2]);
    if (o.r) mesh.rotation.set(o.r[0] || 0, o.r[1] || 0, o.r[2] || 0);
    (o.parent || staticRoot).add(mesh);
    return mesh;
  }

  // 原 `p`：以中心点摆一个盒子（可选倒角）。
  function box(mat, w, h, d, x, y, z, o = {}) {
    const geo = o.bevel ? bevelBoxGeo(w, h, d, o.bevel) : boxGeo(w, h, d);
    return add(geo, mat, { ...o, p: [x, y, z] });
  }

  // 原 `d`：用两个角点摆盒子。
  function slab(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    return box(
      mat,
      Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
      o,
    );
  }

  // 原 `m`：圆柱，可选 rTop / seg / open / axis（'x' | 'z'）/ r。
  function cyl(mat, r, h, x, y, z, o = {}) {
    const geo = cylGeo(o.rTop ?? r, r, h, o.seg || 12, !!o.open);
    const rot = o.axis === 'x' ? [0, 0, PI / 2]
      : o.axis === 'z' ? [PI / 2, 0, 0]
        : (o.r || [0, 0, 0]);
    return add(geo, mat, { ...o, p: [x, y, z], r: rot });
  }

  // 原 `x`：Catmull-Rom 管道，points 为世界坐标。
  function tube(mat, points, r = 0.03, o = {}) {
    return add(tubeGeo(points, r, o.radial || 6, false, o.tension ?? 0.5), mat, o);
  }

  // 原 `v`：两点之间的圆杆（栏杆、扶手）。
  function rod(mat, a, b, r = 0.015, o = {}) {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const mesh = add(cylGeo(r, r, len, o.seg || 6), mat, o);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
    return mesh;
  }

  // 原 `y`：工字钢。axis 是腹板长度方向，depthAxis 默认取另一个水平/竖直轴。
  function ibeam(mat, axis, span, x, y, z, o = {}) {
    const depth = o.depth ?? 0.4;
    const width = o.width ?? 0.2;
    const tf = o.tf ?? 0.02;
    const tw = o.tw ?? 0.012;
    const depthAxis = o.depthAxis || (axis === 'y' ? 'z' : 'y');
    const third = ['x', 'y', 'z'].find((a) => a !== axis && a !== depthAxis);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    if (o.r) group.rotation.set(o.r[0] || 0, o.r[1] || 0, o.r[2] || 0);
    const at = (along, dep, other) => {
      const v = { x: 0, y: 0, z: 0 };
      v[axis] = along;
      v[depthAxis] = dep;
      v[third] = other;
      return [v.x, v.y, v.z];
    };
    const along = (dep) => {
      const v = { x: 0, y: 0, z: 0 };
      v[depthAxis] = dep;
      return [v.x, v.y, v.z];
    };
    const m = resolveMaterial(mat);
    for (const s of [-1, 1]) {
      add(boxGeo(...at(span, tf, width)), m, { parent: group, p: along(s * (depth / 2 - tf / 2)) });
    }
    add(boxGeo(...at(span, depth - 2 * tf, tw)), m, { parent: group });
    staticRoot.add(group);
    return group;
  }

  // 原 `b`：单面 quad（贴花 / 文字牌）。face: 'z+' | 'z-' | 'x+' | 'x-' | 'y+'。
  function quad(mat, w, h, x, y, z, face = 'z+', rot = 0) {
    const mesh = new THREE.Mesh(planeGeo(w, h), resolveMaterial(mat));
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    if (face === 'z-') mesh.rotation.y = PI;
    else if (face === 'x+') mesh.rotation.y = PI / 2;
    else if (face === 'x-') mesh.rotation.y = -PI / 2;
    else if (face === 'y+') {
      mesh.rotation.x = -PI / 2;
      mesh.rotation.z = rot;
    }
    staticRoot.add(mesh);
    return mesh;
  }

  // 原 `g`：decal(kind, size, x, y, z, face, rot)
  function decal(kind, size, x, y, z, face, rot) {
    try {
      const info = materials.decal(kind);
      if (!info || !info.material) return null;
      return quad(info.material, size, size / (info.aspect || 1), x, y, z, face, rot);
    } catch {
      return null;
    }
  }

  // 原 `E`：label(text, size, x, y, z, face, opts)
  function label(text, size, x, y, z, face, o) {
    try {
      const info = materials.label(text, o || {});
      if (!info || !info.material) return null;
      return quad(info.material, size * (info.aspect || 4), size, x, y, z, face);
    } catch {
      return null;
    }
  }

  // --- 碰撞盒登记（原 `M`，原本调 physics.addBox） ------------------------
  function pushCollider(min, max, surface, extra) {
    const record = {
      min: [min[0], min[1], min[2]],
      max: [max[0], max[1], max[2]],
      surface: surface || 'concrete',
      ...(extra || {}),
    };
    colliders.push(record);
    if (physics && typeof physics.addBox === 'function') {
      physics.addBox(record.min.slice(), record.max.slice(), { surface: record.surface, ...(extra || {}) });
    }
    return record;
  }

  function col(a, b, c, d, e, f, surface, o) {
    if (Array.isArray(a)) {
      return pushCollider(a, b, c || 'concrete', d);
    }
    return pushCollider([a, b, c], [d, e, f], surface || 'concrete', o);
  }

  // 原 `T`：把道具 userData.colliders 转到世界空间。斜放时沿长轴切条并
  // 内缩 7%，避免旋转道具的 AABB 顶到墙里；极薄的碎块直接丢弃。
  function registerPropColliders(object, yaw, flags = {}) {
    const local = object.userData.colliders || [];
    const diagonal = Math.abs(Math.sin(2 * yaw)) > 0.2;
    for (const c of local) {
      let parts = [c];
      if (diagonal) {
        const w = c.max[0] - c.min[0];
        const d = c.max[2] - c.min[2];
        const axis = w >= d ? 0 : 2;
        const long = Math.max(w, d);
        const short = Math.max(0.25, Math.min(w, d));
        const count = Math.min(10, Math.max(1, Math.round(long / short)));
        if (count > 1) {
          parts = [];
          for (let i = 0; i < count; i++) {
            const mn = c.min.slice();
            const mx = c.max.slice();
            mn[axis] = c.min[axis] + long * i / count;
            mx[axis] = c.min[axis] + long * (i + 1) / count;
            parts.push({ min: mn, max: mx, surface: c.surface });
          }
        }
      }
      for (const p of parts) {
        BOX3.min.set(p.min[0], p.min[1], p.min[2]);
        BOX3.max.set(p.max[0], p.max[1], p.max[2]);
        BOX3.applyMatrix4(object.matrixWorld);
        if (BOX3.max.y - BOX3.min.y < 0.2 && BOX3.max.y < 0.3) continue;
        if (diagonal) {
          const sx = (BOX3.max.x - BOX3.min.x) * 0.07;
          const sz = (BOX3.max.z - BOX3.min.z) * 0.07;
          BOX3.min.x += sx;
          BOX3.max.x -= sx;
          BOX3.min.z += sz;
          BOX3.max.z -= sz;
        }
        pushCollider(
          [BOX3.min.x, BOX3.min.y, BOX3.min.z],
          [BOX3.max.x, BOX3.max.y, BOX3.max.z],
          p.surface || c.surface || 'metal',
          flags.colOpts,
        );
      }
    }
  }

  // --- 道具摆放（原 `w`） ------------------------------------------------
  function buildProp(name, o) {
    if (PROP_SET.has(name)) return createProp(name, o);
    if (FIXTURE_SET.has(name)) return createFixture(name, o);
    throw new Error(`[yardkit/level] place(): unknown prop/fixture "${name}"`);
  }

  function place(name, x, z, yaw = 0, o = {}, y = 0, flags = {}) {
    // 红色立桶 / 气瓶是「可炸物」，游戏里交给爆炸系统而不是普通道具。
    const explosive = !flags.inert && (
      (name === 'barrel' && o.color === 'red' && !o.lying && !o.open) || name === 'gas_cylinders'
    );
    if (explosive) {
      explosives.push({ name, x, y, z, yaw, opts: { ...o } });
      placed.push({ name, x, y, z, yaw });
      return new THREE.Group();
    }

    const object = buildProp(name, { ...o, materials });
    object.position.set(x, y, z);
    object.rotation.y = yaw;
    (flags.dynamic ? dynRoot : staticRoot).add(object);
    object.updateMatrixWorld(true);
    if (!flags.noCol && !NO_COLLIDER_PROPS.has(name)) registerPropColliders(object, yaw, flags);
    if (typeof object.userData.update === 'function') {
      updaters.push((dt) => object.userData.update(dt));
    }
    placed.push({ name, x, y, z, yaw });
    return object;
  }

  // 原 `S`：整段金属楼梯；同时在 metalRects 里登记脚下金属地面。
  function stairs(x, z, yaw = 0, y = 0, o = {}) {
    const object = place('stairs_metal', x, z, yaw, o, y);
    const alongX = Math.abs(Math.cos(yaw)) > 0.5;
    metalRects.push(alongX ? [x - 1.5, z - 0.5, x + 1.5, z + 0.5] : [x - 0.5, z - 1.5, x + 0.5, z + 1.5]);
    return object;
  }

  // 原 `R`：走道，rails 决定扶手在哪一侧。
  function catwalk(x, z, yaw = 0, y = 0, o = {}, rails = [true, true]) {
    const side = rails[0] && rails[1] ? 'both' : rails[0] ? 'left' : rails[1] ? 'right' : 'none';
    const object = place('catwalk', x, z, yaw, { ...o, rails: side }, y);
    const alongX = Math.abs(Math.cos(yaw)) > 0.5;
    const halfX = alongX ? 1.5 : 0.6;
    const halfZ = alongX ? 0.6 : 1.5;
    metalRects.push([x - halfX, z - halfZ, x + halfX, z + halfZ]);
    return object;
  }

  // 原 `U`：集装箱堆。rows = [[key, color, { dx, dz, flip, wear, doors, reefer }], ...]
  // 箱子来自 ./containers.js 的 createContainer（游戏里走 props 注册表）；
  // 需要换实现时传 `createLevel({ container: (name, opts) => group })`。
  function stack(x, z, rows, yaw = 0, wobble = 1) {
    const container = opts.container || createContainer;
    let baseY = 0;
    const objs = [];
    for (let i = 0; i < rows.length; i++) {
      const [key, color, o = {}] = rows[i];
      const name = CONTAINER_KEYS[key];
      if (!name) throw new Error(`[yardkit/level] stack(): unknown container key "${key}"`);
      const dx = (o.dx || 0) + (i ? rnd(-0.05, 0.05) * wobble : 0);
      const dz = (o.dz || 0) + (i ? rnd(-0.04, 0.04) * wobble : 0);
      const rowYaw = yaw + rnd(-1, 1) * 0.022 * wobble * (i ? 0.6 : 1) + (o.flip ? PI : 0);
      const cx = x + dx;
      const cz = z + dz;
      const propOpts = {
        color,
        seed: Math.floor(rnd(1, 99999)),
        wear: o.wear ?? rnd(0.2, 0.85),
        doors: o.doors || 0,
      };
      const object = container(name, { ...propOpts, materials });
      object.position.set(cx, baseY, cz);
      object.rotation.y = rowYaw;
      staticRoot.add(object);
      object.updateMatrixWorld(true);
      registerPropColliders(object, rowYaw, {});
      placed.push({ name, x: cx, y: baseY, z: cz, yaw: rowYaw });
      const length = CONTAINER_L[name];
      const alongX = Math.abs(Math.cos(yaw)) > 0.5;
      const halfX = (alongX ? length : 2.44) / 2;
      const halfZ = (alongX ? 2.44 : length) / 2;
      metalRects.push([cx - halfX, cz - halfZ, cx + halfX, cz + halfZ]);
      if (o.reefer) {
        const off = -(length / 2 + 0.2);
        place('reefer_unit', cx + off * Math.cos(rowYaw), cz - off * Math.sin(rowYaw), rowYaw, { seed: i + 3 }, baseY + 0.14);
      }
      objs.push(object);
      baseY += CONTAINER_H[name];
    }
    return { top: baseY, objs };
  }

  // 原 `k`：某点脚下是不是金属地面（金属楼梯 / 走道 / 集装箱顶）。
  function isMetal(x, z) {
    for (const r of metalRects) {
      if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return true;
    }
    return false;
  }

  // --- 合并（原 `ig` + 关卡文件里的 tris 统计） --------------------------
  function build() {
    if (mergedRoot) {
      disposeGeometries(mergedRoot);
      mergedRoot.removeFromParent();
      mergedRoot = null;
    }
    staticRoot.updateMatrixWorld(true);

    const buckets = new Map();
    const passthrough = [];
    staticRoot.traverse((node) => {
      if (!node.isMesh) return;
      let p = node;
      let keep = false;
      while (p) {
        if (p.userData && p.userData.noMerge) { keep = true; break; }
        p = p.parent;
      }
      if (keep || node.isSkinnedMesh || node.isInstancedMesh || Array.isArray(node.material)) {
        passthrough.push(node);
        return;
      }
      const key = `${node.material.uuid}|${node.castShadow ? 'c' : 'n'}${node.receiveShadow ? 'r' : 'n'}|${node.layers.mask}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          mat: node.material,
          cast: node.castShadow,
          recv: node.receiveShadow,
          layers: node.layers.mask,
          geos: [],
        };
        buckets.set(key, bucket);
      }
      const geo = node.geometry.clone();
      geo.applyMatrix4(node.matrixWorld);
      bucket.geos.push(geo);
    });

    mergedRoot = new THREE.Group();
    mergedRoot.name = 'level-merged';
    let tris = 0;
    for (const bucket of buckets.values()) {
      const geo = mergeGeos(bucket.geos);
      for (const g of bucket.geos) g.dispose();
      const mesh = new THREE.Mesh(geo, bucket.mat);
      mesh.castShadow = bucket.cast;
      mesh.receiveShadow = bucket.recv;
      mesh.layers.mask = bucket.layers;
      mergedRoot.add(mesh);
      tris += trianglesOf(geo);
    }
    for (const node of passthrough) {
      const clone = node.clone(false);
      clone.userData = { ...node.userData, sharedGeometry: true };
      node.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
      mergedRoot.add(clone);
      tris += trianglesOf(clone.geometry);
    }

    return {
      root: mergedRoot,
      colliders,
      stats: { tris, drawCalls: mergedRoot.children.length },
    };
  }

  function dispose() {
    if (mergedRoot) {
      disposeGeometries(mergedRoot);
      mergedRoot.removeFromParent();
      mergedRoot = null;
    }
    disposeGeometries(staticRoot);
    disposeGeometries(dynRoot);
    updaters.length = 0;
  }

  return {
    // 场景图
    root: staticRoot,
    staticRoot,
    dynRoot,
    // 材质
    materials,
    M,
    MI,
    // 几何
    add,
    box,
    slab,
    cyl,
    tube,
    rod,
    ibeam,
    quad,
    decal,
    label,
    // 碰撞 / 导航
    col,
    colliders,
    metalRects,
    isMetal,
    // 道具 / 构件
    place,
    stairs,
    catwalk,
    stack,
    // 状态
    placed,
    explosives,
    updaters,
    rng,
    rnd,
    seed,
    // 收尾
    build,
    dispose,
  };
}
