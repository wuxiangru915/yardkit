// 新主题包的入口：注册表面 + 提供 surfaceMap + 统一的磨损预设。
// 用法：
//   const pack = installPack();
//   const materials = createMaterialStore({ createMaterial: pack.createMaterial, averages, surfaceMap: pack.surfaceMap });
import { registerSurface, createMaterial } from '../../src/materials/materials.js';
import { plaster, SURFACES, PARAMS, SURFACE_MAP } from './surfaces.js';
export { createPackSky } from './sky.js';
export { createPackLighting } from './lighting.js';
export { createStool, PACK_MODEL_NAMES, createPackModel } from './models.js';

let installed = false;

export function installPack({ wear = 0.2 } = {}) {
  if (!installed) {
    registerSurface('plaster', plaster, PARAMS.plaster);
    installed = true;
  }
  return {
    surfaces: SURFACES,
    surfaceMap: SURFACE_MAP,
    createMaterial: (name, opts = {}) => createMaterial(name, { amount: wear, ...opts }),
  };
}
