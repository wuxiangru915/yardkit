// 几何入口：模型 / 道具 / 设施 / 工具层（不含 GLSL 材质）
export * from './src/geo.js';
export * from './src/propUtils.js';
export * from './src/materials.js';
export * from './src/propspec.js';
export * from './src/props.js';
export * from './src/fixtures.js';
export * from './src/vehicles.js';
export * from './src/weapons.js';
export * from './src/enemies.js';
export {
  HALF_PI, AXIS_ROT, hash3, ensureCCW, memoClone, placeGeo, placeMatrix,
  scaledPlane, scaledSphere, scaledTorus, sphereSlice, boxSpan, tubeSpan,
} from './src/propKit.js';
export * from './src/containers.js';
export * from './src/level.js';
export * from './src/backdrop.js';
export * from './src/hands.js';
export * from './src/viewmodel.js';
