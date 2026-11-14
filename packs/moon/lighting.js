// 月面打光：一盏很硬的白太阳 + 极弱的「地面反照」。
// 和地球场景最大的区别：没有半球天光（天空是黑的），所以阴影几乎全黑、边缘极锐。
import * as THREE from 'three';

export function createMoonLighting(scene, {
  sunIntensity = 4.6, sunAzimuthDeg = -38, sunElevationDeg = 22,
  bounce = 0.055, shadowSize = 2048, shadowExtent = 42,
} = {}) {
  const sun = new THREE.DirectionalLight(0xfff6e8, sunIntensity);
  const az = THREE.MathUtils.degToRad(sunAzimuthDeg);
  const el = THREE.MathUtils.degToRad(sunElevationDeg);
  sun.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, {
    left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: 220,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // 真空里没有天光；这里给一点点从地面反弹的灰光，纯粹为了能看清暗部
  const bounceLight = new THREE.HemisphereLight(0x5d6470, 0x2b2a27, bounce);
  scene.add(bounceLight);

  return {
    sun, bounceLight,
    dispose() {
      for (const l of [sun, bounceLight]) { l.parent?.remove(l); l.dispose?.(); }
    },
  };
}
