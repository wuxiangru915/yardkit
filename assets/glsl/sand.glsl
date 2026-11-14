
void surf(vec2 uv){
  float macro = fbm(uv, vec2(1.2), 3, 1.0);   // 沙丘起伏
  float mid   = fbm(uv, vec2(9.0), 4, 2.0);
  float fine  = fbm(uv, vec2(240.0), 2, 3.0);

  // 风纹：低频扭曲的正弦脊，再叠一层更细的纹
  float warp = fbm(uv, vec2(5.0), 3, 4.0) - 0.5;
  float r1 = sin((uv.y * 58.0 + warp * 24.0 + fbm(uv, vec2(9.0), 2, 5.0) * 6.0) * TAU * 0.5);
  float ripple = smoothstep(-0.35, 0.85, r1);
  float r2 = sin((uv.x * 120.0 + warp * 30.0) * TAU * 0.5);
  float ripple2 = smoothstep(-0.2, 0.9, r2) * 0.5;

  // 砂粒：小的亮/暗颗粒，给"沙"的质感
  vec4 grain = vor(uv * 320.0, vec2(320.0), 6.0);
  float grit = smoothstep(0.35, 0.0, grain.x) * step(grain.z, 0.7);
  float glint = step(0.93, grain.w) * smoothstep(0.2, 0.0, grain.x);

  vec3 c = L(0.60, 0.50, 0.34);
  c = mix(c, L(0.76, 0.66, 0.47), ripple * 0.55);            // 脊亮
  c = mix(c, L(0.42, 0.35, 0.23), (1.0 - ripple) * 0.35);    // 谷暗
  c *= 0.86 + 0.28 * macro + 0.14 * (mid - 0.5);
  c = mix(c, L(0.34, 0.30, 0.22), grit * 0.45);
  c += L(0.95, 0.92, 0.82) * glint * 0.35;                   // 石英反光点
  c = mix(c, L(0.80, 0.78, 0.72), smoothstep(0.90, 0.94, fbm(uv, vec2(64.0), 3, 7.0)) * 0.7); // 贝壳屑

  float h = 0.5 + ripple * 0.16 + ripple2 * 0.06 + (fine - 0.5) * 0.05 - grit * 0.04;
  float ao = 1.0 - (1.0 - ripple) * 0.18 - grit * 0.12;
  float r = 0.88 - ripple * 0.06 + grit * 0.10;
  emit(c, 1.0, h, ao, r, 0.0);
}
