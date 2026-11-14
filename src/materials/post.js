import * as THREE from 'three';

// 一条最小可用的电影化后处理链：
//   HDR 场景 → 亮部提取 → 两级模糊(bloom) → 合成(ACES + 调色 + 暗角 + 颗粒)
// 顺序不能改：先在线性空间做所有光学，最后一步才转 sRGB。
const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tSrc;
  uniform float uThreshold, uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float w = smoothstep(uThreshold, uThreshold + uKnee, l);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  uniform sampler2D tSrc;
  uniform vec2 uDir;      // 每次传 (1/w, 0) 或 (0, 1/h)
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
    s += texture2D(tSrc, vUv + uDir * 1.3846).rgb * 0.316216;
    s += texture2D(tSrc, vUv - uDir * 1.3846).rgb * 0.316216;
    s += texture2D(tSrc, vUv + uDir * 3.2308).rgb * 0.070270;
    s += texture2D(tSrc, vUv - uDir * 3.2308).rgb * 0.070270;
    gl_FragColor = vec4(s, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  uniform sampler2D tScene, tBloomA, tBloomB;
  uniform float uExposure, uBloom, uVignette, uGrain, uTime, uSat, uAspect, uDamage;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    // Narkowicz 的 ACES 拟合：便宜，且高光滚降到白而不是烧成一片
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  void main() {
    vec3 col = texture2D(tScene, vUv).rgb;

    // bloom：两级叠加，窄光晕给灯泡、宽光晕给"空气里有点雾"
    vec3 bloom = texture2D(tBloomA, vUv).rgb * 0.65 + texture2D(tBloomB, vUv).rgb * 0.85;
    col += bloom * uBloom;

    // 曝光 → 色调映射
    col *= uExposure;
    col = aces(col);

    // 分离色调：暗部偏青、亮部偏暖。这是"电影感"最廉价的一步
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 shadowTint = vec3(0.90, 0.99, 1.08);
    vec3 highTint   = vec3(1.07, 1.00, 0.93);
    col *= mix(shadowTint, highTint, smoothstep(0.05, 0.6, l));

    // 轻微 S 曲线 + 抬黑（让暗部有空气而不是死黑）
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
    col = col * 0.985 + vec3(0.008, 0.011, 0.014);

    // 饱和度（受击时掉色）
    l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSat * (1.0 - 0.6 * uDamage));

    // 暗角 + 受击红边
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r2 = dot(p, p) / 0.25;
    float vig = smoothstep(0.25, 1.15, r2);
    col *= 1.0 - uVignette * vig * vig;
    col = mix(col, vec3(0.55, 0.02, 0.01) * (0.3 + l), clamp(uDamage * vig * 0.9, 0.0, 1.0));

    // sRGB（手动，因为最后是一个裸 ShaderMaterial 直接上屏）
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));

    // 胶片颗粒 + dither（不加 dither，天空渐变一定出色带）
    vec2 seed = vUv * 1024.0 + fract(uTime * vec2(7.31, 3.17)) * 311.7;
    float g = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    col += g * uGrain * mix(1.0, 0.35, smoothstep(0.2, 0.9, l));
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(41.7, 289.3))) * 43758.5453) - 0.5) / 255.0;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createPost(renderer, { quality = 'high' } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const dpr = renderer.getPixelRatio();
  const W = Math.max(2, Math.floor(size.x * dpr));
  const H = Math.max(2, Math.floor(size.y * dpr));
  const samples = quality === 'low' ? 0 : 4;

  const depthTexture = new THREE.DepthTexture(W, H);
  depthTexture.type = THREE.UnsignedIntType;

  const rtScene = new THREE.WebGLRenderTarget(W, H, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    depthTexture,
    samples,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter
  });

  const mk = (w, h, type = THREE.HalfFloatType) => new THREE.WebGLRenderTarget(w, h, {
    type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
  });

  const rtBright = mk(W >> 1, H >> 1);
  const rtBlurA = mk(W >> 1, H >> 1);
  const rtBlurB = mk(W >> 2, H >> 2);
  const rtTmp = mk(W >> 1, H >> 1);   // 中间目标：绝不能读写同一个 RT（会形成反馈回路）

  const quadGeo = new THREE.BufferGeometry();
  quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  quadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(quadGeo, null);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);

  const mkMat = (frag, uniforms) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false, toneMapped: false
  });

  const brightMat = mkMat(BRIGHT_FRAG, {
    tSrc: { value: null }, uThreshold: { value: 1.05 }, uKnee: { value: 1.2 }
  });
  const blurMat = mkMat(BLUR_FRAG, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
  const compositeMat = mkMat(COMPOSITE_FRAG, {
    tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
    uExposure: { value: 1.18 }, uBloom: { value: 0.30 }, uVignette: { value: 0.42 },
    uGrain: { value: 0.028 }, uTime: { value: 0 }, uSat: { value: 1.1 },
    uAspect: { value: W / H }, uDamage: { value: 0 }
  });

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  }

  function blur(src, dst, w, h) {
    blurMat.uniforms.tSrc.value = src.texture;
    blurMat.uniforms.uDir.value.set(1 / w, 0);
    pass(blurMat, rtTmp);
    blurMat.uniforms.tSrc.value = rtTmp.texture;
    blurMat.uniforms.uDir.value.set(0, 1 / h);
    pass(blurMat, dst);
  }

  let lastStats = { calls: 0, tris: 0 };

  return {
    rtScene,
    uniforms: compositeMat.uniforms,
    get lastStats() { return lastStats; },
    setSize(w, h) {
      const d = renderer.getPixelRatio();
      const W2 = Math.max(2, Math.floor(w * d)), H2 = Math.max(2, Math.floor(h * d));
      rtScene.setSize(W2, H2);
      rtBright.setSize(W2 >> 1, H2 >> 1);
      rtBlurA.setSize(W2 >> 1, H2 >> 1);
      rtBlurB.setSize(W2 >> 2, H2 >> 2);
      rtTmp.setSize(W2 >> 1, H2 >> 1);
      compositeMat.uniforms.uAspect.value = W2 / H2;
    },
    render(sceneRef, cameraRef, time) {
      // 1) 场景 → HDR
      const auto = renderer.info.autoReset;
      renderer.info.autoReset = false;
      renderer.info.reset();
      renderer.setRenderTarget(rtScene);
      renderer.render(sceneRef, cameraRef);
      lastStats = {
        calls: renderer.info.render.calls,
        tris: renderer.info.render.triangles
      };
      renderer.info.reset();
      renderer.info.autoReset = auto;

      // 2) 亮部提取（半分辨率，省一半带宽）
      brightMat.uniforms.tSrc.value = rtScene.texture;
      pass(brightMat, rtBright);

      // 3) 两级模糊
      blur(rtBright, rtBlurA, W >> 1, H >> 1);
      blur(rtBlurA, rtBlurB, W >> 2, H >> 2);

      // 4) 合成上屏
      compositeMat.uniforms.tScene.value = rtScene.texture;
      compositeMat.uniforms.tBloomA.value = rtBlurA.texture;
      compositeMat.uniforms.tBloomB.value = rtBlurB.texture;
      compositeMat.uniforms.uTime.value = time;
      pass(compositeMat, null);
    }
  };
}
