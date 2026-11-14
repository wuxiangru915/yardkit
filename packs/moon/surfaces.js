// 月球主题包的 4 个新表面。每个都是 `void surf(vec2 uv)` 的函数体，
// 输出走 DSL 的 emit(albedo, alpha, height, ao, roughness, metalness)。
// 数值按「真空 + 强日照 + 无大气」调：高粗糙、低金属、极低饱和。

export const regolith = /* glsl */`
void surf(vec2 uv){
  float fine = fbm(uv, vec2(260.0), 3, 1.0);
  float mid  = fbm(uv, vec2(38.0), 4, 2.0);
  float big  = fbm(uv, vec2(4.0), 4, 3.0);

  // 碎石
  vec4 st = vor(uv * 140.0, vec2(140.0), 5.0);
  float stone = smoothstep(0.5, 0.24, st.x) * step(st.z, 0.55);

  // 小陨石坑：voronoi 环 + 坑底
  vec4 cr = vor(uv * 4.5, vec2(4.5), 6.0);
  float ring = smoothstep(0.09, 0.015, abs(cr.x - 0.38)) * step(cr.z, 0.62);
  float pit  = smoothstep(0.38, 0.0, cr.x) * step(cr.z, 0.62);

  // 车辙 / 脚印压痕
  float rut = smoothstep(0.035, 0.012, abs(abs(fract(uv.y) - 0.5) - 0.30));

  vec3 alb = L(0.52, 0.51, 0.49) * (0.82 + 0.30 * big + 0.12 * (mid - 0.5));
  alb = mix(alb, L(0.38, 0.37, 0.36), stone * 0.8);
  alb *= 1.0 - pit * 0.32 - ring * 0.18;
  alb += ring * 0.04;
  alb *= 0.94 + 0.12 * fine;

  float h = 0.5 + (fine - 0.5) * 0.10 + (mid - 0.5) * 0.06 - pit * 0.26 - ring * 0.10 - rut * 0.05 + stone * 0.08;
  emit(alb, 1.0, h, 1.0 - pit * 0.25 - ring * 0.08, 0.94 - stone * 0.06, 0.0);
}`;

export const moonrock = /* glsl */`
void surf(vec2 uv){
  vec4 v = vor(uv * 6.0, vec2(6.0), 1.0);
  float edge = smoothstep(0.0, 0.06, v.y - v.x);
  float fine = fbm(uv, vec2(180.0), 3, 2.0);
  float blot = fbm(uv, vec2(12.0), 4, 3.0);
  vec3 c = L(0.20, 0.20, 0.21) * (0.8 + 0.5 * fine);
  c = mix(c, L(0.33, 0.32, 0.31), smoothstep(0.5, 0.9, blot));
  c *= 1.0 - edge * 0.18;
  float h = 0.4 + (1.0 - edge) * 0.3 + (fine - 0.5) * 0.15;
  emit(c, 1.0, h, 0.7 + 0.3 * edge, 0.9, 0.02);
}`;

export const foil = /* glsl */`
void surf(vec2 uv){
  float w1 = fbm(uv, vec2(18.0), 4, 1.0);
  float w2 = fbm(uv, vec2(60.0), 3, 2.0);
  float crease = smoothstep(0.42, 0.5, abs(w1 - 0.5) * 2.0);
  vec3 c = mix(L(0.82, 0.60, 0.24), L(0.96, 0.80, 0.44), w2);
  c *= 0.72 + 0.55 * w1;
  float h = 0.5 + (w1 - 0.5) * 0.7 + (w2 - 0.5) * 0.2;
  float r = 0.16 + (w2 - 0.5) * 0.10 + crease * 0.12;
  emit(c, 1.0, h, 1.0, r, 1.0);
}`;

export const solar = /* glsl */`
void surf(vec2 uv){
  vec2 g = fract(uv * vec2(8.0, 10.0));
  vec2 e = min(g, 1.0 - g);
  float line = smoothstep(0.03, 0.0, min(e.x, e.y));
  float cell = smoothstep(0.07, 0.0, min(e.x, e.y));
  vec3 c = mix(L(0.03, 0.05, 0.10), L(0.07, 0.11, 0.22), fbm(uv, vec2(30.0), 2, 3.0));
  c = mix(c, L(0.55, 0.56, 0.58), line);
  c *= 0.92 + 0.16 * cell;
  emit(c, 1.0, 0.5 + line * 0.12, 0.9, mix(0.24, 0.55, line), mix(0.85, 0.15, line));
}`;

export const MOON_PARAMS = {
  regolith: { tile: 3.0, bump: 1.6, amount: 0.35, ao: 1 },
  moonrock: { tile: 1.4, bump: 2.2, amount: 0.3, ao: 1 },
  foil:     { tile: 0.45, bump: 1.4, amount: 0.4, ao: 1 },
  solar:    { tile: 0.6, bump: 0.8, amount: 0.2, ao: 1 },
};

// 把 kit 的「道具材质名」重映射到月球表面：地面/沙土→月壤，篷布→隔热金箔，
// 瓦楞/锈→光板金属，木/纸→灰塑料。其余（白漆、镀锌、玻璃）保持原样。
export const MOON_SURFACE_MAP = {
  concrete: 'regolith', concrete_dirty: 'regolith', concrete_painted: 'regolith',
  asphalt: 'regolith', sand: 'regolith', mud: 'regolith',
  tarp: 'foil',
  solar_panel: 'solar',
  corrugated: 'metal', corrugated_roof: 'metal', steel_rust: 'metal', steel_worn: 'metal',
  wood_pallet: 'plastic', wood_dark: 'plastic', cardboard: 'plastic',
};
