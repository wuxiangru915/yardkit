// 治愈风天空：浅蓝到奶白的渐变 + 一层薄云 + 很淡的雾。
// 复用 kit 的 createSky（零贴图、只有一个球壳），只换色板：
//   zenith 浅蓝 → horizon 奶白，太阳是暖白而不是橙。
// 因为颜色也是环境光的来源（bakeEnvironment），地面/陶器的高光会自动跟着天空走。
import * as THREE from 'three';
import { createSky } from '../../src/materials/sky.js';

export const COZY_DAY = {
  zenith: 0x63a9d9,   // 天空蓝
  horizon: 0xe6f1f7,  // 靠近地平线的浅蓝白
  sun: 0xfff6e6,
  cloud: 0xfffbf4,
  fog: 0xe1edf4,
};

export const COZY_SUN_DIR = [-0.56, 0.64, 0.44];

export function createCozySky({
  palette = COZY_DAY,
  sunDir = COZY_SUN_DIR,
  fogDensity = 0.008,
} = {}) {
  const dir = new THREE.Vector3(sunDir[0], sunDir[1], sunDir[2]).normalize();
  const sky = createSky(dir, palette);

  return {
    mesh: sky.mesh,
    material: sky.material,
    palette,
    sunDir: dir,
    // 挂到场景上：天空球 + 一层很淡的雾（雾色=地平线色，远处才有一点点奶白）
    attach(scene) {
      scene.add(sky.mesh);
      scene.fog = new THREE.FogExp2(palette.fog, fogDensity);
      return scene;
    },
    dispose() {
      sky.mesh.geometry.dispose();
      sky.material.dispose();
    },
  };
}
