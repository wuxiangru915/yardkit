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

// —— 画质分档 / 动态分辨率（纯逻辑，不需要 WebGL） ——
const quality = await import('../src/quality.js');

function expect(label, fn) {
  try {
    fn();
    results.push({ label, meshes: 0, verts: 0, size: [1, 1, 1] });
  } catch (e) {
    fails.push({ label, error: e.message });
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
const eq = (actual, expected, what = '') => ok(actual === expected, `${what} expected ${expected}, got ${actual}`);

expect('quality:tier-phone', () => eq(quality.pickTier({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', renderer: '' }), 'low'));
expect('quality:tier-intel', () => eq(quality.pickTier({ renderer: 'ANGLE (Intel(R) UHD Graphics)' }), 'medium'));
expect('quality:tier-nvidia', () => eq(quality.pickTier({ renderer: 'ANGLE (NVIDIA GeForce RTX 4070)' }), 'high'));
expect('quality:tier-arc', () => eq(quality.pickTier({ renderer: 'ANGLE (Intel(R) Arc(TM) A770)' }), 'high'));
expect('quality:tier-swiftshader', () => eq(quality.pickTier({ renderer: 'SwiftShader' }), 'low'));
expect('quality:tier-weak-gpu', () => eq(quality.pickTier({ renderer: 'ANGLE (Qualcomm Adreno 730)' }), 'medium'));
expect('quality:config', () => {
  const low = quality.tierConfig('low'), high = quality.tierConfig('high');
  ok(low.scale < high.scale, 'low.scale < high.scale');
  ok(low.shadow < quality.tierConfig('ultra').shadow, 'low.shadow < ultra.shadow');
  eq(low.material, 'flat', 'low.material');
  eq(quality.detectRenderer(), '', 'detectRenderer in node');
});
expect('quality:dyn-down', () => {
  const dyn = quality.createDynamicResolution();
  for (let i = 0; i < 200; i++) dyn.update(40);
  eq(dyn.scale, 0.6, 'floor scale');
  eq(dyn.didHitFloor, true, 'didHitFloor');
});
expect('quality:dyn-up', () => {
  const dyn = quality.createDynamicResolution();
  for (let i = 0; i < 100; i++) dyn.update(40);
  ok(dyn.scale <= 0.7, `pre condition, scale=${dyn.scale}`);
  for (let i = 0; i < 200; i++) dyn.update(8);
  eq(dyn.scale, 1.0, 'recovered scale');
});
expect('quality:dyn-stable', () => {
  const dyn = quality.createDynamicResolution();
  for (let i = 0; i < 60; i++) dyn.update(i % 2 ? 8 : 40);   // 平均 24ms，先降到 0.6
  const base = dyn.changes;
  for (let i = 0; i < 200; i++) dyn.update(i % 2 ? 8 : 40);   // 继续抖动
  ok(dyn.changes - base <= 2, `oscillated ${dyn.changes - base} times at floor`);
});
expect('quality:dyn-down-faster', () => {
  const dyn = quality.createDynamicResolution();
  let down = 0;
  while (dyn.scale > 0.75 && down < 300) { dyn.update(40); down++; }
  const from = dyn.scale;
  ok(from <= 0.7, `pre condition, scale=${from}`);
  let up = 0;
  while (dyn.scale < 0.8 && up < 300) { dyn.update(8); up++; }
  ok(down < up, `down=${down} frames, up=${up} frames`);
});

expect('quality:material-flat', () => {
  const m = materials.createMaterial('concrete', { tier: 'flat' });
  ok(m.isMeshStandardMaterial, 'is MeshStandardMaterial');
  ok(!m.userData.uniforms, 'no uniforms');
  eq(m.onBeforeCompile, THREE.Material.prototype.onBeforeCompile, 'no onBeforeCompile override');
  eq(m.roughness, 0.85, 'roughness');
  eq(m.metalness, 0.05, 'metalness');
  eq(m.userData.tier, 'flat', 'tier label');
});
expect('quality:material-live', () => {
  const m = materials.createMaterial('concrete', { tier: 'live' });
  ok(!!m.userData.uniforms, 'has uniforms');
  eq(m.userData.tier, 'live', 'tier label');
});
expect('quality:material-baked-fallback', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const m = materials.createMaterial('concrete', { tier: 'baked' });
    ok(m.isMeshStandardMaterial && !!m.userData.uniforms, 'usable after fallback');
    eq(m.userData.tier, 'live', 'fell back to live');
  } finally { console.warn = warn; }
});
expect('quality:material-baked-texture', () => {
  materials.setBakedSurface('concrete', { alb: new THREE.Texture(), meta: new THREE.Texture() });
  try {
    const m = materials.createMaterial('concrete', { tier: 'baked' });
    eq(m.userData.uniforms.uBake.value, 1, 'uses baked textures');
    eq(m.userData.tier, 'baked', 'tier label');
  } finally { materials.clearBakedSurfaces(); }
});
expect('quality:material-store-tier', () => {
  const store = materials.createMaterialStore({ createMaterial: materials.createMaterial, tier: 'flat' });
  const m = store.get('concrete');
  ok(m.userData.tier === 'flat' && !m.userData.uniforms, 'store passes tier through');
});

expect('quality:auto-manual-fixed', () => {
  const aq = quality.createAutoQuality({ tier: 'high' });
  eq(aq.tier, 'high', 'tier');
  eq(aq.scale, 1.0, 'initial scale');
  for (let i = 0; i < 400; i++) aq.update(40);
  eq(aq.scale, 0.6, 'floor scale');
  eq(aq.tier, 'high', 'explicit tier never drops');
  aq.dispose();
});
expect('quality:auto-tier-drop', () => {
  const seen = [];
  const aq = quality.createAutoQuality({ tier: 'high', allowTierDrop: true, onTierChange: (to, from) => seen.push(`${from}->${to}`) });
  for (let i = 0; i < 400; i++) aq.update(40);
  eq(aq.tier, 'low', 'cascaded to low');
  ok(seen.length >= 2, `onTierChange fired ${seen.length} times`);
  aq.dispose();
});
expect('quality:auto-low-floor', () => {
  const aq = quality.createAutoQuality({ tier: 'low' });
  eq(aq.tier, 'low', 'tier');
  eq(aq.scale, 0.7, 'initial scale');
  for (let i = 0; i < 200; i++) aq.update(40);
  eq(aq.scale, 0.6, 'floor scale');
  eq(aq.tier, 'low', 'stays low');
  eq(aq.setTier('high'), 'high', 'setTier return');
  eq(aq.scale, 0.6, 'setTier keeps current scale, does not jump up');
  for (let i = 0; i < 200; i++) aq.update(8);
  eq(aq.scale, 1.0, 'climbs back with fast frames');
  aq.dispose();
});

console.log('materials:', materials.NAMES.length);
const rows = results.map((r) => `${r.label.padEnd(26)} meshes=${String(r.meshes).padStart(3)} verts=${String(r.verts).padStart(7)} size=${r.size.join('×')}`);
console.log(rows.join('\n'));
if (fails.length) {
  console.error('\nFAILED:');
  for (const f of fails) console.error(' -', f.label, '→', f.error);
  process.exit(1);
}
console.log(`\n${results.length} checks passed`);
