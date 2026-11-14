// 治愈主题包：注册 5 个柔和新表面 + 重映射道具材质 + 天空 + 打光 + 低磨损预设。
// 用法：
//   const cozy = installCozyPack({ wear: 0.15 });
//   const materials = createMaterialStore({ createMaterial: cozy.createMaterial, averages, surfaceMap: cozy.surfaceMap });
//   cozy.sky = createCozySky(); cozy.sky.attach(scene);
//   const light = createCozyLighting(scene);
import { registerSurface, createMaterial } from '../../src/materials/materials.js';
import {
  plaster, painted_wood, ceramic, weave, foliage,
  COZY_PARAMS, COZY_SURFACE_MAP,
} from './surfaces.js';

export { COZY_PARAMS, COZY_SURFACE_MAP } from './surfaces.js';
export { createCozyLighting } from './lighting.js';
export { createCozySky, COZY_DAY, COZY_SUN_DIR } from './sky.js';
export {
  COZY_MODEL_NAMES, createCozyModel,
  createChair, createTable, createTeacup, createBookshelf,
  createPottedPlant, createRug, createLantern, createFence,
} from './models.js';

export const COZY_SURFACES = ['plaster', 'painted_wood', 'ceramic', 'weave', 'foliage'];

let installed = false;

export function installCozyPack({ wear = 0.15 } = {}) {
  if (!installed) {
    registerSurface('plaster', plaster, COZY_PARAMS.plaster);
    registerSurface('painted_wood', painted_wood, COZY_PARAMS.painted_wood);
    registerSurface('ceramic', ceramic, COZY_PARAMS.ceramic);
    registerSurface('weave', weave, COZY_PARAMS.weave);
    registerSurface('foliage', foliage, COZY_PARAMS.foliage);
    installed = true;
  }
  return {
    surfaces: COZY_SURFACES,
    surfaceMap: COZY_SURFACE_MAP,
    // 治愈风不该「脏」：uP.x（磨损/掉漆量）统一压到 wear，
    // 无论调用方传进来多少（道具会传自己的 wear）。
    createMaterial: (name, opts = {}) => {
      const asked = opts.amount;
      const amount = Math.min(asked === undefined ? wear : asked, wear);
      return createMaterial(name, { ...opts, amount });
    },
  };
}
