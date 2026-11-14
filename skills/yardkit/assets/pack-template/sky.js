import * as THREE from 'three';

// 最省事的天空：纯色 + 雾（要渐变/星星就抄 packs/moon/sky.js）。
export function createPackSky(scene, { color = 0x8fb7d4, fog = 0.01 } = {}) {
  scene.background = new THREE.Color(color);
  scene.fog = new THREE.FogExp2(color, fog);
  return {
    set(next = {}) {
      if (next.color != null) { scene.background.set(next.color); scene.fog.color.set(next.color); }
      if (next.fog != null) scene.fog.density = next.fog;
    },
  };
}
