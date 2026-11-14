// 月球主题包：注册 4 个新表面 + 重映射道具材质 + 天空 + 打光 + 磨损预设。
// 用法：
//   const moon = installMoonPack();
//   const materials = createMaterialStore({ createMaterial: moon.createMaterial, averages, surfaceMap: moon.surfaceMap });
//   const sky = createMoonSky(); scene.add(sky.group);
//   const light = createMoonLighting(scene);
import { registerSurface, createMaterial } from '../../src/materials/materials.js';
import { regolith, moonrock, foil, solar, MOON_PARAMS, MOON_SURFACE_MAP } from './surfaces.js';
export { createMoonSky, createMoonEnvironment } from './sky.js';
export { createMoonLighting } from './lighting.js';
export { MOON_SURFACE_MAP, MOON_PARAMS } from './surfaces.js';
// 包自带的 5 个新模型（气闸 / 月球车 / 太阳能阵列 / 居住舱 / 旗）
export {
  createAirlock, createRover, createSolarArray, createHabitat, createFlag,
  MOON_MODEL_NAMES, createMoonModel,
} from './models.js';

export const MOON_SURFACES = ['regolith', 'moonrock', 'foil', 'solar'];

let installed = false;

export function installMoonPack({ wear = 0.22 } = {}) {
  if (!installed) {
    registerSurface('regolith', regolith, MOON_PARAMS.regolith);
    registerSurface('moonrock', moonrock, MOON_PARAMS.moonrock);
    registerSurface('foil', foil, MOON_PARAMS.foil);
    registerSurface('solar', solar, MOON_PARAMS.solar);
    installed = true;
  }
  return {
    surfaces: MOON_SURFACES,
    surfaceMap: MOON_SURFACE_MAP,
    // 月面几乎不「脏」：把磨损量压到很低，颜色往白/灰推
    createMaterial: (name, opts = {}) => {
      // 漆面在月面上几乎没有「掉漆露锈」，单独压低
      const a = name === 'paint' ? Math.min(wear, 0.08) : wear;
      return createMaterial(name, { amount: a, ...opts });
    },
  };
}
