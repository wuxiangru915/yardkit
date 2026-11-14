// 治愈风打光：一盏暖白的高位太阳（软阴影）+ 很强的半球天光 + 一盏极弱的暖色补灯。
// 目标只有一个：对比度低、暗部不发黑。
//   对比月球包（太阳 4.6 / 反照 0.055 / 硬边），这里的比例是 2.4 : 1.2 : 0.3。
// 注意：shadow.radius 只有 PCFShadowMap（渲染器层）才生效，demo 里用的是它。
import * as THREE from 'three';

export function createCozyLighting(scene, {
  sunIntensity = 2.4, sunAzimuthDeg = -52, sunElevationDeg = 40, sunColor = 0xfff3e0,
  hemi = 1.2, skyColor = 0xdcecfa, groundColor = 0xd9c6ab,
  fill = 0.3, fillColor = 0xffe2c4,
  shadowSize = 2048, shadowExtent = 18, shadowRadius = 5,
} = {}) {
  const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
  const az = THREE.MathUtils.degToRad(sunAzimuthDeg);
  const el = THREE.MathUtils.degToRad(sunElevationDeg);
  sun.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, {
    left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: 160,
  });
  sun.shadow.radius = shadowRadius;   // 半影：几厘米到十几厘米，家具影子不再切边
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  // 半球光承担「暗部的大头」：天光偏冷、地面反弹偏暖，阴影里也不会死黑
  const sky = new THREE.HemisphereLight(skyColor, groundColor, hemi);
  sky.position.set(0, 12, 0);
  scene.add(sky);

  // 一点点补灯（从机位那一侧打过来），把背光面抬起来 —— 暗部不发黑的关键
  const rim = new THREE.DirectionalLight(fillColor, fill);
  rim.position.set(34, 12, 26);
  scene.add(rim);

  return {
    sun, sky, rim,
    dispose() {
      for (const l of [sun, sky, rim]) { l.parent?.remove(l); l.dispose?.(); }
    },
  };
}
