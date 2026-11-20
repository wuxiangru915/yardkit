// 类型冒烟测试：只编译，不运行。验证公开 API 的签名和返回类型。
import * as THREE from 'three';
import {
  createMaterial,
  createMaterialStore,
  createPost,
  createSky,
  createLevel,
  createProp,
  createBoat,
  createAutoQuality,
  createDynamicResolution,
  pickTier,
  PropBuilder,
  box,
  surfaceNames,
} from 'yardkit';
import { createMaterialStore as createMaterialStoreFromMaterials } from 'yardkit/materials';
import { tierConfig } from 'yardkit/quality';

const mat: THREE.MeshStandardMaterial = createMaterial('concrete', { tier: 'flat', tile: 3 });
const store = createMaterialStore({ createMaterial });
const store2 = createMaterialStoreFromMaterials({ createMaterial });
const emissive: THREE.MeshBasicMaterial = store.emissive(0xff0000, 1.2);
const label = store.label('HELLO', { color: 'white' });
const sky = createSky(new THREE.Vector3(0, 1, 0), {
  zenith: 0x000000, horizon: 0xffffff, sun: 0xffff00, cloud: 0x888888,
});
const level = createLevel({ materials: store });
level.slab('concrete', -1, 0, -1, 1, 0.2, 1);
level.col(-1, 0, -1, 1, 0.2, 1, 'concrete');
const prop = createProp('crate_wood', { seed: 3 });
level.place('barrel', 0, 0, 0, { seed: 1 });
const built = level.build();
const boat = createBoat({ materials: store, animate: false });
boat.update(0.016, 0);

const builder = new PropBuilder(store, 'test', 2);
builder.add('steel_galv', box(1, 1, 1), { p: [0, 1, 0] }, 0.9);
const finished = builder.finish({ size: [1, 1, 1] });

const cfg = tierConfig('high');
const tier = pickTier({ ua: 'x', renderer: 'NVIDIA' });
const dyn = createDynamicResolution({ targetMs: cfg.targetMs });
dyn.update(16.7);
const aq = createAutoQuality({ tier: 'high' });
aq.update(16.7);
aq.dispose();

// 这些引用只是让 noUnusedLocals 下也不报错
void mat; void store2; void emissive; void label; void sky; void prop;
void built; void finished; void tier; void dyn; void surfaceNames;
