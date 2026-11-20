// 运行时画质分档 + 动态分辨率。
//
// 机制来自 Saltline（https://realcodebear.github.io/saltline-fable-5.2/）：
// 启动时按 UA / GPU 字符串选档，运行中按平均帧时间调分辨率，分辨率到底还慢就降档。
// 这里只保留四个有意义的维度（像素 scale / 后处理 / 阴影 / 材质 tier），
// 不照抄原项目的 tex / volSteps / motionBlur 等维度。
//
// 本文件不 import three：纯逻辑 + 对 renderer/post/sun 既有公开方法的调用，
// 所以可以在 Node 里用假的 frameMs 直接测。

export const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

export const QUALITY_TIERS = {
  low:    { name: 'low',    scale: 0.7,  post: 'low',  shadow: 1024, material: 'flat',  maxPixels: 1.0e6 },
  medium: { name: 'medium', scale: 0.85, post: 'low',  shadow: 2048, material: 'baked', maxPixels: 1.5e6 },
  high:   { name: 'high',   scale: 1.0,  post: 'high', shadow: 2048, material: 'live',  maxPixels: 2.3e6 },
  ultra:  { name: 'ultra',  scale: 1.0,  post: 'high', shadow: 4096, material: 'live',  maxPixels: 3.7e6 },
};

// 移动端 UA：iOS Safari 的 iPad 会伪装成 Macintosh，所以另外看触点数量。
const MOBILE_UA = /Android|iPhone|iPod|iPad|IEMobile|Opera Mini|Mobile|Silk|Kindle/i;
// 软件光栅化：比任何手机 GPU 都慢，直接最低档。
const SOFTWARE_GPU = /SwiftShader|llvmpipe|Software Rasterizer|Microsoft Basic Render/i;
// 移动 GPU：能跑，但别上全特效。
const WEAK_GPU = /Mali|Adreno|PowerVR/i;
const INTEL_GPU = /Intel/i;
const INTEL_ARC = /\bArc\b/i;

let rendererCache;

function readEnv() {
  if (typeof navigator === 'undefined') {
    return { ua: '', maxTouchPoints: 0, minScreen: Infinity };
  }
  const s = typeof screen !== 'undefined' ? screen : null;
  return {
    ua: navigator.userAgent || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    minScreen: s ? Math.min(s.width || Infinity, s.height || Infinity) : Infinity,
  };
}

/** 读 GPU 字符串（WEBGL_debug_renderer_info）；拿不到返回 ''。结果会缓存。 */
export function detectRenderer() {
  if (rendererCache !== undefined) return rendererCache;
  rendererCache = '';
  if (typeof document === 'undefined') return rendererCache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return rendererCache;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    rendererCache = String(
      ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || ''
    );
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    rendererCache = '';
  }
  return rendererCache;
}

/**
 * 启动选档。无参数时读当前环境；显式传的字段优先。
 * 手机 / 小屏触屏 / 软件渲染 → low；Mali·Adreno·PowerVR·Intel 非 Arc → medium；其余 high。
 * 这是启发式：拿到什么字符串就只能按字符串判，宁可猜高也不猜低（猜低了画面会很难看）。
 */
export function pickTier({ ua, renderer, maxTouchPoints, minScreen } = {}) {
  const env = readEnv();
  const userAgent = ua ?? env.ua;
  const gpu = renderer ?? detectRenderer();
  const touch = maxTouchPoints ?? env.maxTouchPoints;
  const screenMin = minScreen ?? env.minScreen;

  if (MOBILE_UA.test(userAgent)) return 'low';
  if (touch > 0 && screenMin <= 600) return 'low';
  if (SOFTWARE_GPU.test(gpu)) return 'low';
  if (WEAK_GPU.test(gpu)) return 'medium';
  if (INTEL_GPU.test(gpu) && !INTEL_ARC.test(gpu)) return 'medium';
  return 'high';
}

/** 档位配置；未知档位按 high 处理。附带动态分辨率的默认参数。 */
export function tierConfig(name = 'high') {
  const key = QUALITY_TIERS[name] ? name : 'high';
  return {
    ...QUALITY_TIERS.high,
    ...QUALITY_TIERS[key],
    targetMs: 16.7,
    minScale: 0.6,
    maxScale: QUALITY_TIERS[key].scale,
  };
}

/**
 * 动态分辨率：只动 scale，不碰别的。
 * 每 windowFrames 帧算一次平均；超过 target*1.28 降、低于 target*1.04 升。
 * 降得比升快（步长 1.5x + 升档冷却），中间留滞回带，避免在阈值附近抖。
 * scale 到底且仍然超时 → didHitFloor = true（由 createAutoQuality 决定降不降档）。
 */
export function createDynamicResolution(opts = {}) {
  let targetMs = opts.targetMs ?? 16.7;
  let minScale = opts.minScale ?? 0.6;
  let maxScale = opts.maxScale ?? 1.0;
  const step = opts.step ?? 0.1;
  const downStep = step * 1.5;
  const windowFrames = 20;
  const upCooldownWindows = 2;
  const DOWN_RATIO = 1.28;   // 16.7ms → 21.4ms
  const UP_RATIO = 1.04;     // 16.7ms → 17.4ms

  let scale = maxScale;
  let frames = 0;
  let sumMs = 0;
  let changes = 0;
  let didHitFloor = false;
  let upCool = 0;

  function evaluate() {
    if (!frames) return;
    const avg = sumMs / frames;
    frames = 0;
    sumMs = 0;

    if (avg > targetMs * DOWN_RATIO) {
      didHitFloor = false;
      upCool = upCooldownWindows;
      if (scale > minScale + 1e-6) {
        scale = Math.max(minScale, +(scale - downStep).toFixed(3));
        changes++;
      } else {
        didHitFloor = true;
      }
    } else if (avg < targetMs * UP_RATIO) {
      didHitFloor = false;
      if (upCool > 0) upCool--;
      else if (scale < maxScale - 1e-6) {
        scale = Math.min(maxScale, +(scale + step).toFixed(3));
        changes++;
      }
    } else {
      didHitFloor = false;
      if (upCool > 0) upCool--;
    }
  }

  function update(frameMs) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    // 单帧过长多半是切后台 / 编译 shader，不该拿它当性能证据。
    sumMs += Math.min(frameMs, 200);
    frames++;
    if (frames >= windowFrames) evaluate();
  }

  function reset() {
    scale = maxScale;
    frames = 0;
    sumMs = 0;
    changes = 0;
    didHitFloor = false;
    upCool = 0;
  }

  return {
    get scale() { return scale; },
    get didHitFloor() { return didHitFloor; },
    get changes() { return changes; },
    update,
    reset,
    /** 内部用：换档后清掉"到底了"标记，让新档重新积累证据。 */
    clearFloor() { didHitFloor = false; },
    /** 内部用：换档时更新上下限（scale 会被夹到新区间）。 */
    setLimits({ minScale: mn, maxScale: mx, targetMs: t } = {}) {
      if (mn !== undefined) minScale = mn;
      if (mx !== undefined) maxScale = mx;
      if (t !== undefined) targetMs = t;
      scale = Math.min(Math.max(scale, minScale), maxScale);
    },
  };
}

// createPost() 目前把 MSAA / bloom 级数在创建时就固定了，没有运行时切换接口。
// 有就调，没有就只同步尺寸（文档里写明了这个限制）。
function applyPostQuality(post, level) {
  if (!post) return;
  if (typeof post.setQuality === 'function') post.setQuality(level);
}

/**
 * 把 tier 真正应用到 renderer / post / sun 上，并驱动动态分辨率。
 *
 * tier: 'auto' 或具体档位名。'auto' 会按环境选档，并且允许慢了自动降档；
 *       显式指定档位时默认不降档（只调 scale/shadow），需要的话传 allowTierDrop: true。
 *
 * 注意：降档只改像素 / 阴影 / 后处理，材质 tier 是建场景时决定的，运行中不重建。
 */
export function createAutoQuality({
  renderer = null,
  post = null,
  sun = null,
  tier = 'auto',
  targetMs,
  allowTierDrop,
  onTierChange = null,
} = {}) {
  const isAuto = !(tier && QUALITY_TIERS[tier]);
  let current = isAuto ? pickTier() : tier;
  let cfg = tierConfig(current);
  const mayDropTier = allowTierDrop ?? isAuto;
  const dyn = createDynamicResolution({
    targetMs: targetMs ?? cfg.targetMs,
    minScale: cfg.minScale,
    maxScale: cfg.scale,
  });

  let appliedScale = -1;
  let tierCooldownMs = 0;
  let disposed = false;

  function applyShadow() {
    if (!sun || !sun.shadow || !sun.shadow.mapSize) return;
    const n = cfg.shadow;
    if (sun.shadow.mapSize.x === n && sun.shadow.mapSize.y === n) return;
    sun.shadow.mapSize.set(n, n);
    // three 只在 map 为空时重建阴影贴图，所以必须手动丢掉旧的。
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }

  function applySize() {
    if (!renderer || typeof renderer.setSize !== 'function') return;
    const el = renderer.domElement;
    const w = Math.max(2, Math.floor(el?.clientWidth || globalThis.innerWidth || 2));
    const h = Math.max(2, Math.floor(el?.clientHeight || globalThis.innerHeight || 2));
    const dpr = Math.min((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1, 2);
    let pr = dpr * dyn.scale;
    const budget = cfg.maxPixels;
    if (budget > 0 && w * h * pr * pr > budget) pr = Math.sqrt(budget / (w * h));
    pr = Math.max(0.25, pr);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);          // 不动 canvas 的 CSS 尺寸
    if (post && typeof post.setSize === 'function') post.setSize(w, h);
    appliedScale = dyn.scale;
  }

  function apply() {
    applyShadow();
    applyPostQuality(post, cfg.post);
    applySize();
  }

  function setTier(name) {
    if (!QUALITY_TIERS[name]) {
      console.warn(`[yardkit/quality] unknown tier "${name}"`);
      return current;
    }
    if (name === current) return current;
    const from = current;
    current = name;
    cfg = tierConfig(name);
    dyn.setLimits({ minScale: cfg.minScale, maxScale: cfg.scale, targetMs: targetMs ?? cfg.targetMs });
    dyn.clearFloor();
    tierCooldownMs = 1500;                  // 降档后至少隔 1.5s 才允许再降，避免连降到底
    apply();
    if (onTierChange) onTierChange(current, from);
    return current;
  }

  function update(frameMs) {
    if (disposed) return;
    dyn.update(frameMs);
    if (dyn.scale !== appliedScale) applySize();

    tierCooldownMs = Math.max(0, tierCooldownMs - Math.min(frameMs || 0, 200));
    if (!mayDropTier || tierCooldownMs > 0 || !dyn.didHitFloor) return;

    const idx = TIER_ORDER.indexOf(current);
    if (idx > 0) setTier(TIER_ORDER[idx - 1]);
    else dyn.clearFloor();                  // 已经最低档：停在 0.6，不再降
  }

  const onResize = () => applySize();
  if (renderer && typeof addEventListener === 'function') addEventListener('resize', onResize);

  apply();

  return {
    get tier() { return current; },
    get scale() { return dyn.scale; },
    get config() { return cfg; },
    update,
    setTier,
    dispose() {
      disposed = true;
      if (renderer && typeof removeEventListener === 'function') removeEventListener('resize', onResize);
    },
  };
}
