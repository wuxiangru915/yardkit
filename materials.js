// 材质入口：程序化 GLSL 表面（零贴图）+ 天空 / 后处理
export { createMaterial, bakeAverage, registerSurface, surfaceNames } from './src/materials/materials.js';
export { REGISTRY, NAMES } from './src/materials/registry.js';
export { SURFS, DSL } from './src/materials/glsl.js';
export { createSky, bakeEnvironment } from './src/materials/sky.js';
export { createPost } from './src/materials/post.js';
export { GLSL_NOISE } from './src/materials/noise.js';
export { defaultMaterials, createMaterialStore, MATERIAL_PRESETS } from './src/materials.js';
