
void surf(vec2 uv){
  float macro = fbm(uv, vec2(1.4), 3, 1.0);
  float mid   = fbm(uv, vec2(12.0), 4, 2.0);
  float fine  = fbm(uv, vec2(170.0), 3, 3.0);

  // 干裂：大块 + 细裂两层
  vec4 cr = vor(uv * 6.0 + fbm(uv, vec2(4.0), 3, 9.0) * 0.4, vec2(6.0), 9.0);
  float crack = smoothstep(0.030, 0.008, cr.y - cr.x) * smoothstep(0.30, 0.65, fbm(uv, vec2(5.0), 3, 10.0));
  vec4 cr2 = vor(uv * 18.0, vec2(18.0), 13.0);
  float crack2 = smoothstep(0.012, 0.003, cr2.y - cr2.x) * 0.6;

  // 湿泥：低频，湿处更深更亮（低粗糙度）
  float wet = smoothstep(0.42, 0.68, macro * 0.7 + mid * 0.3);

  vec3 c = L(0.36, 0.28, 0.20);
  c = mix(c, L(0.20, 0.155, 0.12), wet * 0.8);
  c *= 0.80 + 0.36 * (mid - 0.5) + 0.12 * (fine - 0.5);
  c = mix(c, L(0.07, 0.055, 0.04), (crack + crack2) * 0.9);

  vec4 st = vor(uv * 90.0, vec2(90.0), 12.0);
  float stone = smoothstep(0.35, 0.15, st.x) * step(st.z, 0.45);
  c = mix(c, L(0.48, 0.45, 0.39), stone * 0.75);

  float h = 0.5 + (fine - 0.5) * 0.10 - (crack + crack2) * 0.28 + stone * 0.16;
  float ao = 1.0 - (crack + crack2) * 0.55 - stone * 0.12;
  float r = mix(0.95, 0.62, wet) + (crack + crack2) * 0.1 + stone * 0.05;
  emit(c, 1.0, h, ao, r, 0.0);
}
