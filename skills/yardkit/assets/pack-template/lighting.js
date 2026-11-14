import * as THREE from 'three';

// 一个包只有一套「光」：写成函数，别散在 demo 里。
export function createPackLighting(scene, { sun = 2.4, hemi = 1.0, shadow = 2048, extent = 30 } = {}) {
  const key = new THREE.DirectionalLight(0xfff3e2, sun);
  key.position.set(-12, 15, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(shadow, shadow);
  Object.assign(key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 120 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const bounce = new THREE.HemisphereLight(0xcfe2f2, 0x6a6152, hemi);
  scene.add(bounce);

  return { sun: key, bounce, dispose() { scene.remove(key, key.target, bounce); } };
}
