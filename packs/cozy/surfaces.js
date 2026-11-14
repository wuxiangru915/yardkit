// 治愈主题包的 5 个新表面。每个都是 `void surf(vec2 uv)` 的函数体，
// 输出走 DSL 的 emit(albedo, alpha, height, ao, roughness, metalness)。
//
// 和工业表面最大的区别（也是这个包的唯一技巧）：
//   albedo 全部贴在 0.8–1.0 之间、几乎中性 —— 也就是「白漆」。
//   颜色交给材质的 tint（store 里来的 preset 色），图案只负责极淡的明暗与凹凸。
//   于是同一个 shader 落在暖白/木色/陶土色上都成立，对比度自然就低了。

// 墙面：细腻颗粒 + 抹灰起伏 + 极淡的水渍（只在少数地方擦到，墙脚更潮）
export const plaster = /* glsl */`
void surf(vec2 uv){
  float grain = fbm(uv, vec2(320.0), 3, 1.0);
  float mid   = fbm(uv, vec2(26.0), 3, 2.0);
  float big   = fbm(uv, vec2(2.4), 3, 3.0);

  // 石灰膏上的小气孔：很稀、很浅
  vec4 pv = vor(uv * 170.0, vec2(170.0), 4.0);
  float pore = smoothstep(0.44, 0.16, pv.x) * step(pv.z, 0.3);
  // 水渍：垂直拉伸的低频 + 一条靠下的潮气
  float streak = fbm(vec2(uv.x * 8.0, uv.y * 1.3), vec2(8.0, 1.3), 3, 5.0);
  float wash   = smoothstep(0.60, 0.86, streak) * smoothstep(0.40, 0.80, fbm(uv, vec2(3.0), 3, 6.0));
  float foot   = smoothstep(0.30, 0.0, uv.y) * 0.55;
  float stain  = sat(wash * 0.75 + foot * 0.5);

  vec3 c = vec3(0.97, 0.955, 0.925);
  c *= 0.988 + 0.022 * (grain - 0.5) + 0.045 * (big - 0.5) + 0.02 * (mid - 0.5);
  c = mix(c, vec3(0.88, 0.865, 0.845), stain * 0.30);
  c *= 1.0 - pore * 0.05;

  float h = 0.5 + (grain - 0.5) * 0.07 + (mid - 0.5) * 0.16 - pore * 0.05 - stain * 0.03;
  float r = 0.94 + (grain - 0.5) * 0.05 - stain * 0.06;
  emit(c, 1.0, h, 1.0 - pore * 0.18 - stain * 0.12, r, 0.0);
}`;

// 刷漆木：漆面为主，木纹只在漆下隐隐透出；掉漆量很小（零星几块，大小 1–2cm）
export const painted_wood = /* glsl */`
void surf(vec2 uv){
  // 自带一层「mip」：一个像素盖住的 uv 太多时就把高频淡掉。
  // 内核那层淡出是按 0.008–0.045 uv 算的，对 tile≈1m 的材质刚好，
  // 但 tile≈0.1m 的织物/小零件会先进入摩尔纹区，所以表面自己再收一道。
  float aa  = max(fwidth(uv.x), fwidth(uv.y));
  float lod = 1.0 - smoothstep(0.0025, 0.0090, aa);

  float wob  = fbm(uv, vec2(2.0, 5.0), 3, 1.0) - 0.5;
  float ring = 0.5 + 0.5 * sin((uv.y * 18.0 + wob * 2.6) * TAU);
  float grain = smoothstep(0.30, 0.92, ring);
  float brush = fbm(uv, vec2(36.0, 10.0), 2, 4.0);                        // 宽而软的刷痕

  // 掉漆：只留一格，稀疏、比木纹大一点
  float wear = chipsF(uv, vec2(11.0, 7.0), 23.0, 0.022, 0.30) * 0.85 * lod;

  vec3 paint = vec3(0.975, 0.965, 0.940);
  paint *= 0.985 + 0.030 * (brush - 0.5) * lod + 0.030 * (fbm(uv, vec2(2.0), 3, 5.0) - 0.5);
  vec3 wood = mix(vec3(0.62, 0.53, 0.42), vec3(0.80, 0.70, 0.56), grain);   // 漆下的木色
  vec3 c = mix(paint, wood, wear);

  float h = 0.5 + (brush - 0.5) * 0.05 * lod + (grain - 0.5) * 0.015 * lod - wear * 0.05;
  float r = 0.60 + (brush - 0.5) * 0.06 * lod + wear * 0.30;               // 半哑光漆 → 掉漆处更糙
  emit(c, 1.0, h, 1.0 - wear * 0.20, r, 0.0);
}`;

// 陶瓷：几乎均匀 + 极淡的手作不匀 + 釉面高光
export const ceramic = /* glsl */`
void surf(vec2 uv){
  float mott = fbm(uv, vec2(5.0), 3, 1.0);
  float wav  = fbm(vec2(uv.x * 14.0, uv.y * 4.0), vec2(14.0, 4.0), 3, 2.0);   // 拉坯的横向轮纹
  float fine = fbm(uv, vec2(240.0), 2, 3.0);

  vec4 sp = vor(uv * 120.0, vec2(120.0), 4.0);
  float speck = smoothstep(0.30, 0.05, sp.x) * step(sp.z, 0.12);              // 极少量铁斑

  vec3 c = vec3(0.985, 0.975, 0.950);
  c *= 0.99 + 0.020 * (mott - 0.5) + 0.014 * (wav - 0.5) + 0.008 * (fine - 0.5);
  c = mix(c, vec3(0.80, 0.72, 0.62), speck * 0.45);

  float h = 0.5 + (wav - 0.5) * 0.10 + (mott - 0.5) * 0.04 + (fine - 0.5) * 0.01;
  float r = 0.18 + 0.06 * (wav - 0.5) + speck * 0.45;
  emit(c, 1.0, h, 1.0 - speck * 0.10, r, 0.0);
}`;

// 织物：细密经纬（比 kit 的 fabric 更细、更软、更浅），几乎没有图案
export const weave = /* glsl */`
void surf(vec2 uv){
  // tile 只有 8cm，经纬是毫米级 —— 必须自带 mip，否则远处会摩尔纹
  float aa  = max(fwidth(uv.x), fwidth(uv.y));
  float lod = 1.0 - smoothstep(0.0015, 0.0080, aa);

  float f = 78.0;
  vec2 p = uv * f;
  vec2 id = floor(p), q = fract(p);
  float top = mod(id.x + id.y, 2.0);
  float wx = sin(q.x * 3.14159), wy = sin(q.y * 3.14159);
  float hgt = top > 0.5 ? wx * (0.55 + 0.45 * wy) : wy * (0.55 + 0.45 * wx) * 0.9;

  float slub  = fbm(uv, vec2(30.0, 120.0), 3, 1.0);   // 纱线粗细不匀
  float soft  = fbm(uv, vec2(6.0), 3, 2.0);           // 大块的软塌起伏
  float fluff = fbm(uv, vec2(260.0), 2, 3.0);         // 绒毛

  vec3 c = vec3(0.97, 0.955, 0.930);
  c *= 0.990 + 0.090 * (hgt - 0.5) * lod + 0.040 * (slub - 0.5) * lod
             + 0.030 * (soft - 0.5) + 0.018 * (fluff - 0.5) * lod;

  float h = 0.45 + hgt * 0.45 * lod + (slub - 0.5) * 0.12 * lod + (soft - 0.5) * 0.18;
  emit(c, 1.0, h, 0.82 + 0.18 * hgt * lod, 0.96 - 0.04 * hgt, 0.0);
}`;

// 叶簇：vor 分簇 + 方向性拉伸的叶片剪影 + 叶脉；叶间压暗，叶面受光
export const foliage = /* glsl */`
void surf(vec2 uv){
  vec2 w = uv + (vec2(fbm(uv, vec2(4.0), 3, 1.0), fbm(uv, vec2(4.0), 3, 2.0)) - 0.5) * 0.22;
  vec4 cl = vor(w * 2.2, vec2(2.2), 3.0);
  float cluster = smoothstep(0.72, 0.12, cl.x);        // 簇心密、簇间疏

  float a = fbm(vec2(w.x * 10.0, w.y * 15.0), vec2(10.0, 15.0), 3, 4.0);
  float b = fbm(vec2(w.y * 14.0, w.x * 11.0), vec2(14.0, 11.0), 2, 5.0);
  float leaf = smoothstep(0.40, 0.62, a * 0.62 + b * 0.38 + (cluster - 0.5) * 0.18);

  // 叶脉：沿一个方向的高频线，被低频噪声推歪
  float vein = smoothstep(0.40, 0.50, abs(fract(w.y * 6.0 + fbm(w, vec2(4.0), 2, 6.0) * 1.6) - 0.5));

  vec3 c = mix(vec3(0.44, 0.48, 0.40), vec3(0.93, 0.96, 0.86), leaf);
  c *= 0.94 + 0.10 * (cluster - 0.5) + 0.05 * (b - 0.5);
  c = mix(c, c * 1.12, vein * leaf * 0.5);

  float h = 0.25 + leaf * 0.55 + (a - 0.5) * 0.12 + vein * 0.05 * leaf;
  emit(c, 1.0, h, 0.55 + 0.45 * leaf, 0.72 + 0.20 * leaf, 0.0);
}`;

export const COZY_PARAMS = {
  plaster:      { tile: 2.5, bump: 1.2, amount: 0.15, ao: 1 },
  painted_wood: { tile: 1.2, bump: 2.0, amount: 0.15, ao: 1 },
  ceramic:      { tile: 0.4, bump: 0.5, amount: 0.10, ao: 1 },
  weave:        { tile: 0.08, bump: 1.2, amount: 0.15, ao: 1 },
  foliage:      { tile: 0.6, bump: 3.0, amount: 0.20, ao: 1 },
};

// kit 的「道具材质名」→ 治愈表面。目标：换掉整套道具的皮肤，
// 且不留任何锈 / 瓦楞 / 警示条 / 镀锌拉丝。
export const COZY_SURFACE_MAP = {
  // 水泥、沥青、地坪漆、砖 → 抹灰墙
  concrete: 'plaster', concrete_dirty: 'plaster', concrete_painted: 'plaster',
  asphalt: 'plaster', floor_epoxy: 'plaster', brick: 'plaster',

  // 一切木头与一切漆面 → 刷漆木（漆色由 preset tint 带进来）
  wood_pallet: 'painted_wood', wood_dark: 'painted_wood',
  paint_white: 'painted_wood', paint_grey: 'painted_wood', paint_teal: 'painted_wood',
  paint_blue: 'painted_wood', paint_red: 'painted_wood', paint_orange: 'painted_wood',
  paint_yellow: 'painted_wood',

  // 锈铁 / 瓦楞 / 磨损钢 / 警示条 → 刷漆木（不留一格工业纹）
  steel_rust: 'painted_wood', corrugated: 'painted_wood', corrugated_roof: 'painted_wood',
  steel_worn: 'painted_wood', steel_dark: 'painted_wood', gunmetal: 'painted_wood',
  diamond_plate: 'painted_wood', hazard_stripes: 'painted_wood',

  // 五金 → 上釉的陶（暖、亮、有一点点反光）
  steel_galv: 'ceramic', steel_bare: 'ceramic', aluminium: 'ceramic',
  brass: 'ceramic',

  // 布、绳、纸箱、篷布 → 织物
  cardboard: 'weave', rope: 'weave', glove_fabric: 'weave', tarp: 'weave', fabric: 'weave',

  // 塑料 → 刷漆木（玩具木）；绿色漆面 → 叶簇（盆栽的叶子就靠这一条）
  plastic_grey: 'painted_wood', plastic_red: 'painted_wood', plastic_blue: 'painted_wood',
  polymer_black: 'painted_wood', polymer_tan: 'painted_wood',
  paint_green: 'foliage',
};
