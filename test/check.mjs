// 无 WebGL 的快速自检：所有工厂都能实例化，包围盒/顶点色没有 NaN。
// 用法：node test/check.mjs
import * as THREE from 'three';

const results = [];
const fails = [];

function check(label, fn) {
  try {
    const o = fn();
    const root = o && o.root ? o.root : o;
    if (!root || !root.isObject3D) throw new Error('not an Object3D');
    const bb = new THREE.Box3().setFromObject(root);
    const size = bb.getSize(new THREE.Vector3());
    if (![size.x, size.y, size.z].every(Number.isFinite) || size.length() < 1e-3) {
      throw new Error('degenerate bbox ' + size.toArray().join(','));
    }
    let meshes = 0, verts = 0, nan = 0;
    root.traverse((c) => {
      if (!c.isMesh) return;
      meshes++;
      const pos = c.geometry.attributes.position;
      verts += pos ? pos.count : 0;
      for (const name of ['position', 'normal', 'color']) {
        const a = c.geometry.attributes[name];
        if (!a) continue;
        for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) nan++;
      }
    });
    if (nan) throw new Error(`${nan} non-finite vertex values`);
    results.push({ label, meshes, verts, size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)] });
  } catch (e) {
    fails.push({ label, error: e.message });
  }
}

const geometry = await import('../geometry.js');
const materials = await import('../materials.js');

for (const n of geometry.PROP_NAMES) check('prop:' + n, () => geometry.createProp(n, { seed: 5 }));
for (const n of geometry.FIXTURE_NAMES) check('fixture:' + n, () => geometry.createFixture(n, { seed: 5 }));
for (const [n, f] of [
  ['boat', geometry.createBoat], ['crane', geometry.createCrane], ['distantCrane', geometry.createDistantCrane],
  ['ship', geometry.createShip], ['seagulls', geometry.createSeagulls],
  ['pac9', geometry.createPAC9], ['pac4', geometry.createPAC4],
  ['hound', geometry.createHound], ['gull', geometry.createGull],
]) check('hero:' + n, () => f({ animate: false }));

// 新增模块（存在才测）
for (const [mod, names] of [
  ['./containers.js', 'createContainer'],
  ['./backdrop.js', 'createSkyline'],
  ['./backdrop.js', 'createLamps'],
  ['./backdrop.js', 'createBackdrop'],
  ['./hands.js', 'createHandRig'],
  ['./viewmodel.js', 'createViewModel'],
  ['./level.js', 'createLevel'],
]) {
  try {
    const m = await import('../src/' + mod.slice(2));
    if (typeof m[names] !== 'function') continue;
    if (names === 'createContainer') for (const t of m.CONTAINER_TYPES) check(`${t}`, () => m.createContainer(t, { seed: 2 }));
    else if (names === 'createLevel') {
      const t = m.createLevel({ seed: 7 });
      t.slab('concrete', -4, 0, -4, 4, 0.1, 4, {});
      t.col(-4, -0.2, -4, 4, 0.1, 4, 'concrete');
      t.stairs(0, 0, 0, 0.1, {});
      t.place('barrel', 1.2, 1.2, 0, { seed: 1 });
      t.stack(2, -2, [[20, 'red', {}]], 0);
      const built = t.build();
      if (!built.colliders.length || !(built.stats.tris > 0)) throw new Error('level build empty');
      check('level:built', () => built.root);
    } else if (names === 'createViewModel') {
      check('viewmodel:pac9', () => m.createViewModel('pac9'));
      check('viewmodel:pac4', () => m.createViewModel('pac4'));
    } else check(names, () => m[names]({}));
  } catch { /* 模块还没抽出来 */ }
}

// 主题包：注册表面 + 覆盖映射
try {
  const moon = await import('../packs/moon/index.js');
  const pack = moon.installMoonPack();
  for (const s of moon.MOON_SURFACES) {
    const mat = pack.createMaterial(s, {});
    if (!mat || !mat.isMaterial) throw new Error('pack surface failed: ' + s);
  }
  if (Object.keys(pack.surfaceMap).length < 8) throw new Error('surfaceMap too small');
  results.push({ label: 'pack:moon', meshes: 0, verts: 0, size: [moon.MOON_SURFACES.length, Object.keys(pack.surfaceMap).length, 0] });
} catch (e) {
  fails.push({ label: 'pack:moon', error: e.message });
}

// 月球包：5 个新模型（存在才测）
try {
  const mm = await import('../packs/moon/models.js');
  if (mm.MOON_MODEL_NAMES) {
    for (const n of mm.MOON_MODEL_NAMES) check('moon:' + n, () => mm.createMoonModel(n, { seed: 3 }));
  }
} catch { /* pack 还没就绪 */ }

// 治愈包：表面 + 模型（存在才测）
try {
  const cozy = await import('../packs/cozy/index.js');
  const pack = cozy.installCozyPack();
  for (const s of pack.surfaces) {
    const mat = pack.createMaterial(s, {});
    if (!mat || !mat.isMaterial) throw new Error('cozy surface failed: ' + s);
  }
  const cm = await import('../packs/cozy/models.js');
  if (cm.COZY_MODEL_NAMES) {
    for (const n of cm.COZY_MODEL_NAMES) check('cozy:' + n, () => cm.createCozyModel(n, { seed: 2 }));
  }
  results.push({ label: 'pack:cozy', meshes: 0, verts: 0, size: [pack.surfaces.length, Object.keys(pack.surfaceMap).length, 0] });
} catch { /* pack 还没就绪 */ }

for (const k of geometry.DECAL_KINDS) check('decal:' + k, () => {
  const d = geometry.createDecal(k, { scale: 0.5 });
  return { isObject3D: true, root: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), d.material) };
});
console.log('materials:', materials.NAMES.length, '| decals:', geometry.DECAL_KINDS.length);
const rows = results.map((r) => `${r.label.padEnd(26)} meshes=${String(r.meshes).padStart(3)} verts=${String(r.verts).padStart(7)} size=${r.size.join('×')}`);
console.log(rows.join('\n'));
if (fails.length) {
  console.error('\nFAILED:');
  for (const f of fails) console.error(' -', f.label, '→', f.error);
  process.exit(1);
}
console.log(`\n${results.length} checks passed`);
