import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';

// 天空既是"背景"，也是唯一的光源颜色来源：
// 画完之后用 PMREMGenerator 把它烘成环境贴图，于是铁皮上的反光和天上的颜色天然一致。
export function createSky(sunDir, palette) {
  const uniforms = {
    uSunDir: { value: sunDir.clone() },
    uZenith: { value: new THREE.Color(palette.zenith) },
    uHorizon: { value: new THREE.Color(palette.horizon) },
    uSunColor: { value: new THREE.Color(palette.sun) },
    uCloud: { value: new THREE.Color(palette.cloud) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uSunDir, uZenith, uHorizon, uSunColor, uCloud;
      ${GLSL_NOISE}

      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        float mu = max(dot(d, uSunDir), 0.0);
        float toSun = pow(max(dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz)), 0.0), 3.0);

        // 地平线：朝太阳一侧是暖的，背光一侧是冷的
        vec3 hz = mix(uHorizon, uHorizon * 0.55 + vec3(0.06, 0.09, 0.14), 1.0 - toSun);
        vec3 col = mix(hz, uZenith, smoothstep(0.0, 0.55, h));
        // 太阳光晕：三层幂次叠出渐变，别用单个 pow
        col += uSunColor * (pow(mu, 6.0) * 0.20 + pow(mu, 60.0) * 0.7 + pow(mu, 900.0) * 6.0);

        // 云：一层 fbm，向太阳方向"逆光提亮"，云底更暗
        vec2 cuv = d.xz / (h + 0.10);
        float d1 = fbm3(vec3(cuv * 0.55, 3.0));
        float d2 = fbm3(vec3(cuv * 2.1, 8.4));
        float dens = d1 * 0.75 + d2 * 0.25;
        float deck = smoothstep(0.012, 0.10, h) * smoothstep(0.40, 0.56, dens);
        // 云底暗、云缘被太阳烧穿
        vec3 cc = mix(uCloud * 0.42, uCloud * 0.95, smoothstep(0.45, 0.8, dens));
        cc = mix(cc, uSunColor * 2.2, pow(toSun, 3.0) * smoothstep(0.4, 0.7, dens) * 0.85);
        cc += uSunColor * smoothstep(0.62, 0.92, dens) * pow(toSun, 2.0) * 0.5;  // 逆光云缘
        col = mix(col, cc, deck * 0.9);

        // 太阳本体（环境捕捉时去掉，避免 PMREM 出现 firefly）
        col += uSunColor * smoothstep(0.99965, 0.99992, mu) * 60.0;

        // 地平线以下：海雾/地面反照
        col = mix(col, hz * 0.35, smoothstep(0.0, -0.12, d.y));
        gl_FragColor = vec4(col, 1.0);
      }`
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  return { mesh, material };
}

// 把天空烘成环境贴图。这一行是"塑料感 → 真实感"最便宜的开关。
export function bakeEnvironment(renderer, skyMesh) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const tmp = new THREE.Scene();
  const clone = new THREE.Mesh(skyMesh.geometry, skyMesh.material);
  clone.frustumCulled = false;
  tmp.add(clone);
  const rt = pmrem.fromScene(tmp, 0, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
}
