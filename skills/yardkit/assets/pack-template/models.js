// 包的新模型：PropBuilder + 图元。米制、Y 朝上、原点在地面中心。
import { PropBuilder, bevelBox, cyl } from '../../src/geo.js';
import { defaultMaterials } from '../../src/materials.js';

export function createStool(opts = {}) {
  const mats = opts.materials || defaultMaterials;
  const b = new PropBuilder(mats, 'pack_stool', opts.seed ?? 1);
  b.add('wood_pallet', bevelBox(0.34, 0.05, 0.34, 0.012), { p: [0, 0.42, 0] });
  for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) {
    b.add('wood_dark', cyl(0.017, 0.014, 0.42, 8), { p: [x, 0.21, z], r: [0.04, 0, 0.03] });
  }
  return b.finish({
    size: [0.34, 0.47, 0.34],
    colliders: [{ min: [-0.17, 0, -0.17], max: [0.17, 0.47, 0.17], surface: 'wood' }],
  });
}

export const PACK_MODEL_NAMES = ['stool'];

export function createPackModel(name, opts = {}) {
  if (name === 'stool') return createStool(opts);
  throw new Error('unknown pack model: ' + name);
}
