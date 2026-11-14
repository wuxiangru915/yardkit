// 包的新表面：每个是 `void surf(vec2 uv)` 的函数体。
// 可用：fbm(vec2, vec2 freq, int oct, float gain)、vor(uv, freq, seed)、sat/L/emit/OV。
// emit(albedo, alpha, height, ao, roughness, metalness)
// 约定：albedo 尽量靠近中性（0.8–1.0），颜色交给材质 tint —— 同一个 shader 才能落在多种颜色上。
export const plaster = /* glsl */`
void surf(vec2 uv){
  float grain = fbm(uv, vec2(240.0), 3, 1.0);
  float big   = fbm(uv, vec2(3.0), 3, 2.0);
  vec3 c = vec3(0.93, 0.91, 0.87) * (0.97 + 0.05 * (big - 0.5) + 0.02 * (grain - 0.5));
  float h = 0.5 + (grain - 0.5) * 0.06 + (big - 0.5) * 0.15;
  emit(c, 1.0, h, 1.0, 0.9, 0.0);
}`;

export const SURFACES = ['plaster'];

export const PARAMS = {
  plaster: { tile: 2.0, bump: 1.2, amount: 0.2, ao: 1.0 },
};

// 道具材质名 → 本包表面。这一张表就是「换 40 个模型的皮肤」的全部秘密。
export const SURFACE_MAP = {
  concrete: 'plaster',
  concrete_dirty: 'plaster',
  concrete_painted: 'plaster',
  paint_white: 'plaster',
  paint_grey: 'plaster',
  asphalt: 'plaster',
};
