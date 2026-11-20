// 全量入口：几何 + 材质
export * from './geometry.js';
export { createMaterial, bakeAverage, registerSurface, surfaceNames, NAMES, REGISTRY } from './src/materials/materials.js';
export { createSky, bakeEnvironment } from './src/materials/sky.js';
export { createPost } from './src/materials/post.js';
export { GLSL_NOISE } from './src/materials/noise.js';
export * from './src/containers.js';
export * from './src/level.js';
export * from './src/backdrop.js';
export * from './src/hands.js';
export * from './src/viewmodel.js';
