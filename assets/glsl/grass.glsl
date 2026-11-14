
void surf(vec2 uv){
  // 四层：大块色斑 → 草丛 → 叶片 → 枯黄
  float macro  = fbm(uv, vec2(1.6), 3, 1.0);
  float mid    = fbm(uv, vec2(7.0), 4, 2.0);
  float fine   = fbm(uv, vec2(90.0), 3, 3.0);

  // 叶片：两个方向的高频拉伸噪声，尺度要"真的像草"
  float blades = fbm(vec2(uv.x * 140.0, uv.y * 30.0), vec2(140.0, 30.0), 3, 4.0);
  float blades2= fbm(vec2(uv.y * 180.0, uv.x * 36.0), vec2(180.0, 36.0), 2, 5.0);
  float clump  = smoothstep(0.34, 0.72, macro * 0.7 + mid * 0.3);

  vec3 dark = L(0.10, 0.17, 0.07);
  vec3 lite = L(0.30, 0.46, 0.13);
  vec3 dry  = L(0.47, 0.42, 0.20);

  vec3 c = mix(dark, lite, sat(mid * 0.55 + blades * 0.55));
  c = mix(c, dry, smoothstep(0.62, 0.90, fine) * 0.32);
  c *= 0.78 + 0.34 * clump;                                  // 草丛明暗（大尺度节奏）
  c += lite * smoothstep(0.62, 0.86, blades + blades2 * 0.5) * 0.20;  // 叶尖受光

  float soil = smoothstep(0.74, 0.90, fbm(uv, vec2(5.0), 3, 7.0));
  c = mix(c, L(0.19, 0.13, 0.09), soil);

  float ao = 1.0 - soil * 0.35 - (1.0 - clump) * 0.28;        // 草丛底部的暗
  float h  = 0.5 + (blades - 0.5) * 0.45 + (fine - 0.5) * 0.12 - soil * 0.25;
  float r  = 0.86 + (1.0 - blades) * 0.12;
  emit(c, 1.0, h, ao, r, 0.0);
}
