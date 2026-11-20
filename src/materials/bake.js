// 程序化表面 → 贴图烘焙。
//
// 背景：yardskit 的表面函数是逐像素实时求值的，paint 系列一个像素要跑
// 5000+ 次整数运算（paintDmg 里的 4 次迭代锈迹拖尾占了大头）。在核显上
// 这一步就吃掉 60% 帧时间。
//
// surf() 本身在 uv 0..1 上是周期性的（h3 会对格子取模），所以把它渲进一张
// 可平铺的 RT 里，运行时改成两次纹理采样，外观一致、开销降两个数量级。
import * as THREE from 'three';
import { DSL, SURFS } from './glsl.js';
import { REGISTRY } from './registry.js';

const BAKED = new Map();   // surface name -> { alb, meta, size }

export function getBakedSurface(name) {
  return BAKED.get(name);
}

export function setBakedSurface(name, entry) {
  if (entry) BAKED.set(name, entry);
  else BAKED.delete(name);
}

export function clearBakedSurfaces() {
  for (const e of BAKED.values()) {
    e.alb?.dispose();
    e.meta?.dispose();
  }
  BAKED.clear();
}

/**
 * 把一个或多个 surf 烘成贴图并注册，之后 createMaterial() 会自动走贴图分支。
 * entries: [{ name, size?, seed? }]
 * 返回 undefined；失败时保持程序化路径不变。
 */
export function bakeSurfaces(renderer, entries) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(quadGeo, null);
  quad.frustumCulled = false;
  scene.add(quad);

  const prevTarget = renderer.getRenderTarget();

  for (const entry of entries) {
    const name = entry.name;
    const def = REGISTRY[name];
    if (!def || !SURFS[name]) continue;
    if (BAKED.has(name)) continue;

    const size = entry.size ?? 256;
    const uniforms = {
      uP: { value: new THREE.Vector4(def.amount ?? 0.5, 0, 0, 0) },
      uSeed: { value: entry.seed ?? 0 },
      uTexel: { value: 1 / size },
      uMode: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec4 uP;
        uniform float uSeed;
        uniform float uTexel;
        uniform int uMode;
        varying vec2 vUv;
        vec3 slAlb; float slAlpha, slAO, slRough, slMetal, slH;
        ${DSL}
        ${SURFS[name]}
        void main() {
          surf(vUv);
          if (uMode == 0) gl_FragColor = vec4(slAlb, slAlpha);
          else            gl_FragColor = vec4(slH, slRough, slMetal, slAO);
        }`,
    });

    const makeRT = (type) => new THREE.WebGLRenderTarget(size, size, {
      type,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      generateMipmaps: true,
      anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()),
    });

    // albedo 用 8 位够了（线性存 0..1）；height/rough/metal 需要半浮点，
    // 否则 8 位量化会让 dFdx(height) 台阶化，凹凸会出条带。
    const alb = makeRT(THREE.UnsignedByteType);
    const meta = makeRT(THREE.HalfFloatType);

    quad.material = mat;
    uniforms.uMode.value = 0;
    renderer.setRenderTarget(alb);
    renderer.render(scene, camera);
    uniforms.uMode.value = 1;
    renderer.setRenderTarget(meta);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);

    quad.material = null;
    mat.dispose();
    BAKED.set(name, { alb: alb.texture, meta: meta.texture, size });
    alb.texture.userData.bakedRT = alb;
    meta.texture.userData.bakedRT = meta;
  }

  quadGeo.dispose();
}
