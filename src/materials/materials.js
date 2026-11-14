import * as THREE from 'three';
import { DSL, SURFS } from './glsl.js';
import { REGISTRY } from './registry.js';

/* ============================================================================
   Saltline 程序化材质库 —— 30 个 GLSL 表面函数，零贴图。
   每个 surf(uv) 输出：albedo / alpha / height / AO / roughness / metalness，
   这里把它接到 MeshStandardMaterial 上（世界空间投影 + 屏幕空间凹凸）。

   用法：
     const mat = createMaterial('concrete', { tile: 3, bump: 2.5 });
   ========================================================================== */

const VERT_PARS = /* glsl */`
varying vec3 vSaltW;
varying vec3 vSaltN;
`;

const FRAG_PARS = /* glsl */`
varying vec3 vSaltW;
varying vec3 vSaltN;
uniform vec4 uP;
uniform float uSeed;
uniform float uTexel;
uniform float uSaltTile;
uniform float uSaltBump;
uniform float uSaltAO;
uniform float uSaltCut;
uniform vec3 uSaltAvg;
vec3 slAlb = vec3(0.5);
float slAlpha = 1.0, slAO = 1.0, slRough = 0.8, slMetal = 0.0, slH = 0.5;
float slFade = 1.0;   // 1 = 全细节，0 = 平均色（远处）
${DSL}
`;

export function createMaterial(name, opts = {}) {
  const def = REGISTRY[name];
  if (!def) throw new Error(`[yardkit/materials] unknown material "${name}"`);
  const surf = SURFS[name];
  if (!surf) throw new Error(`[yardkit/materials] missing shader for "${name}"`);

  const {
    tile = def.tile,
    bump = def.bump,
    amount = def.amount,
    ao = def.ao ?? 1,
    tint = def.tint ?? 0xffffff,
    seed = 0,
    cutout = def.cutout ?? false,
    side = THREE.FrontSide
  } = opts;

  const mat = new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 1,
    metalness: 1,
    side,
    transparent: false
  });

  const uniforms = {
    uP: { value: new THREE.Vector4(amount, 0, 0, 0) },
    uSeed: { value: seed },
    uTexel: { value: 1 / 1024 },
    uSaltTile: { value: tile },
    uSaltBump: { value: bump * 0.0022 },
    uSaltAO: { value: ao },
    uSaltCut: { value: cutout ? 1 : 0 },
    uSaltAvg: { value: new THREE.Color(opts.avg ?? 0x4a4a48) }
  };
  mat.userData.uniforms = uniforms;

  // paint 系列：slAlb 是底材（锈/钢），slAlpha 是漆膜覆盖率，漆色来自材质 color
  const ALBEDO = name === 'paint'
    ? 'diffuseColor.rgb = slAlb + diffuseColor.rgb * slAlpha;'
    : 'diffuseColor.rgb = slAlb * diffuseColor.rgb;';

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSaltW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSaltN = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS + surf)

      // —— 采样：按主法线轴做三向投影里最省的一档（一个 surf 调用），uv 归一化到 0..1 —— //
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(normalize(vSaltN));
          vec2 suv;
          if (an.y > an.x && an.y > an.z)      suv = vSaltW.xz;
          else if (an.x > an.z)                 suv = vSaltW.zy;
          else                                  suv = vSaltW.xy;
          suv = fract(suv / max(uSaltTile, 0.001));
          surf(suv);
          // 一个像素覆盖多少 uv：远处把高频细节淡成平均值（相当于 mipmap）
          float px = max(fwidth(suv.x), fwidth(suv.y));
          float fade = 1.0 - smoothstep(0.008, 0.045, px);   // 约 125 px/图 开始淡出
          slFade = fade;
          slAlb = mix(uSaltAvg, slAlb, fade);
          slH = mix(0.5, slH, fade);
          ${ALBEDO}
          diffuseColor.rgb *= mix(1.0, slAO, uSaltAO);
          diffuseColor.a *= slAlpha;
          if (uSaltCut > 0.5 && slAlpha < 0.5) discard;
        }`)

      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(slRough, 0.03, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = clamp(slMetal, 0.0, 1.0);`)

      // —— 凹凸：用屏幕空间高度梯度推法线（Mikkelsen），一次采样就够 —— //
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 dpdx = dFdx(-vViewPosition);
          vec3 dpdy = dFdy(-vViewPosition);
          float dhdx = dFdx(slH);
          float dhdy = dFdy(slH);
          vec3 r1 = cross(dpdy, normal);
          vec3 r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
          normal = normalize(abs(det) * normal - uSaltBump * grad * 8.0 * slFade * slFade);
        }`);
  };

  mat.customProgramCacheKey = () => `yardkit/materials:${name}:${tile}:${bump}:${cutout}`;
  return mat;
}

// —— 平均色烘焙 —— //
// 远处一个像素覆盖半张贴图时，高频噪声必须退化成"这个材质的平均色"，
// 否则地面会变成一张噪点毯子。这里把 surf 渲进 16×16 再取平均，得到真实均值。
export function bakeAverage(renderer, name) {
  const size = 16;
  const rt = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: { uP: { value: new THREE.Vector4(REGISTRY[name].amount, 0, 0, 0) }, uSeed: { value: 0 }, uTexel: { value: 1 / 1024 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision highp float;
      uniform vec4 uP; uniform float uSeed; uniform float uTexel;
      vec3 slAlb; float slAlpha, slAO, slRough, slMetal, slH;
      ${DSL}
      ${SURFS[name]}
      void main(){ surf(gl_FragCoord.xy / ${size}.0); gl_FragColor = vec4(slAlb, 1.0); }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scn = new THREE.Scene(); scn.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer.setRenderTarget(rt);
  renderer.render(scn, cam);
  const buf = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
  renderer.setRenderTarget(null);
  rt.dispose(); mat.dispose(); quad.geometry.dispose();
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < size * size; i++) { r += buf[i * 4]; g += buf[i * 4 + 1]; b += buf[i * 4 + 2]; }
  const n = size * size * 255;
  return new THREE.Color(r / n, g / n, b / n);
}

// —— 主题包扩展点 ——
// 一个「主题包」（packs/xxx）可以在运行时注册自己的 surf 函数，不用改内核的 registry.js / assets。
// glsl 是 `void surf(vec2 uv){ ... }` 的函数体，参数是 { tile, bump, amount, ao, tint, cutout }。
export function registerSurface(name, glsl, params = {}) {
  if (typeof glsl !== 'string' || !glsl.includes('void surf')) {
    throw new Error(`[yardkit/materials] registerSurface("${name}") expects a surf(vec2 uv) body`);
  }
  SURFS[name] = glsl;
  REGISTRY[name] = { tile: 2, bump: 1, amount: 0.5, ao: 1, ...params };
  return name;
}

export function surfaceNames() {
  return Object.keys(SURFS);
}

export { REGISTRY, NAMES } from './registry.js';
