# 运行时画质：分档 / 动态分辨率 / 材质 tier

`src/quality.js` 把 Saltline 原项目的「启动自动选档 + 运行中动态分辨率」抽成了本库的可选模块。
纯逻辑、不 import three，可以在 Node 里用假的帧时间直接测试；对 three 的耦合只有
`renderer.setPixelRatio / setSize`、`post.setSize`、`sun.shadow.mapSize` 这几处。

## 原项目 Saltline 的分档（参考，不是本库默认）

来源：<https://realcodebear.github.io/saltline-fable-5.2/> 的运行时源码。

| 档位 | scale | MSAA | shadow | tex | 体积步数 | AO | bloom | motionBlur |
|---|---|---|---|---|---|---|---|---|
| low | 0.7 | 0 | 2048 | 512 | 12 | 关 | 开 | 关 |
| medium | 0.85 | 2 | 2048 | 1024 | 16 | 开 | 开 | 关 |
| high | 1.0 | 4 | 4096 | 1024 | 24 | 开 | 开 | 开 |
| ultra | 1.0 | 4 | 4096 | 2048 | 40 | 开 | 开 | 开 |

它的启动判定：手机 UA → low；GPU 字符串命中 `SwiftShader|llvmpipe|Software|Mali|Adreno|PowerVR`
或 Intel 非 Arc → medium；其余 high。动态分辨率：每 45 帧或 900ms 统计平均帧时间，
`>21.5ms` 降 scale 0.1–0.2（下限 0.6），`<17.4ms` 升 0.1（上限 1.0，有冷却），
scale=0.6 且 `>26ms` 连续两次 → 降一档；像素预算 1.0/1.5/2.3/3.7 MP。

**上面是原项目参数，不是本库（yardkit）的默认。** 本库只保留四个对本库资产真正有意义的维度：
像素、材质、阴影、后处理。tex / 体积步数 / motionBlur 在本库里不存在对应物。

## 本库的四档

| 档位 | scale | 后处理 | 阴影贴图 | 材质 tier | 像素预算 |
|---|---|---|---|---|---|
| low | 0.7 | low（无 MSAA、一级 bloom） | 1024 | flat | 1.0 MP |
| medium | 0.85 | low | 2048 | baked | 1.5 MP |
| high | 1.0 | high（4x MSAA、两级 bloom） | 2048 | live | 2.3 MP |
| ultra | 1.0 | high | 4096 | live | 3.7 MP |

每档实际省掉的东西：

- **像素**：有效像素比 = `min(devicePixelRatio, 2) × scale`，再按 `maxPixels` 钳制
  （超预算时 `pr = sqrt(budget / (w×h))`，所以大画布上有效比例可能比 scale 还低）。
- **材质**：`flat` 直接返回 `MeshStandardMaterial`（平均色，roughness 0.85 / metalness 0.05），
  不注册 uniforms、不 `onBeforeCompile`——30 个 GLSL 表面一个都不跑；`baked` 用
  `bakeSurfaces()` 烘好的贴图，两次采样代替整段 `surf()`；`live` 是原来的逐像素 GLSL。
- **阴影**：方向光 shadow map 从 4096 降到 1024/2048，换档时旧 map 会被 `dispose()`。
- **后处理**：low 不开 MSAA、bloom 只跑一级；high 是 4x MSAA + 两级 bloom。

## 三种用法

### 1. 手动固定档

```js
import { createAutoQuality } from 'yardkit/quality';

const q = createAutoQuality({ renderer, post, sun, tier: 'medium' });

// 每帧：传入上一帧耗时（ms）。q.scale 会随帧时间变化，q.tier 保持不变。
q.update(frameMs);
```

显式档位默认**不会自动降档**（只调动态分辨率）。要让它到底后继续降档，传 `allowTierDrop: true`。

### 2. 启动自动选档

```js
import { createAutoQuality, pickTier } from 'yardkit/quality';

const q = createAutoQuality({
  renderer, post, sun,
  tier: 'auto',                       // 等价于 pickTier()
  onTierChange: (to, from) => console.log(`quality: ${from} → ${to}`),
});

console.log(pickTier());              // 只想看判定结果时可以单独调
```

判定（启发式）：手机 UA、小屏触屏、软件渲染（SwiftShader / llvmpipe / Software）→ `low`；
Mali / Adreno / PowerVR、Intel 非 Arc → `medium`；其余 → `high`。

`'auto'` 档在 scale 到 0.6 仍持续超时后会**自动降一档**（low 不再降），
每次降档后至少隔 1.5 秒才会再降，避免连降到底；不会自动升档。

### 3. 只要动态分辨率

```js
import { createDynamicResolution } from 'yardkit/quality';

const dyn = createDynamicResolution({ targetMs: 16.7, minScale: 0.6, maxScale: 1.0 });

// 每帧
dyn.update(frameMs);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * dyn.scale);
renderer.setSize(w, h, false);
post.setSize(w, h);
```

参数：每 20 帧统计一次平均帧时间；`> target × 1.28` 降 0.15（下降快），
`< target × 1.04` 升 0.1 且要等 2 个窗口冷却（上升慢），中间是滞回带，不会来回抖。
`dyn.didHitFloor` 表示「已经到 minScale 还在超时」。单帧耗时超过 200ms 会被钳制，
避免切后台 / 编译 shader 把分辨率打到底。

## 弱机器完整示例（运行时版）

和 PERF.md 的「静态三行」不同，这里是从选档到应用的完整运行时流程：

```js
import * as THREE from 'three';
import { createMaterial } from 'yardkit';
import { createMaterialStore, createPost, bakeSurfaces } from 'yardkit/materials';
import { pickTier, tierConfig, createAutoQuality } from 'yardkit/quality';

const tier = pickTier();              // 或写死 'low'
const cfg = tierConfig(tier);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const sun = new THREE.DirectionalLight(0xffd8b0, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(cfg.shadow, cfg.shadow);   // 2048 / 1024 / 4096

// baked 档必须先烘焙；只烘真的重的材质，别 30 个全烘
if (cfg.material === 'baked') {
  bakeSurfaces(renderer, ['paint', 'hazard', 'concrete'].map((name) => ({ name, size: 256 })));
}

// 材质 tier 必须在建场景之前定下来（运行中降档不会重建材质）
const store = createMaterialStore({ createMaterial, tier: cfg.material });
const post = createPost(renderer, { quality: cfg.post });

const q = createAutoQuality({ renderer, post, sun, tier });   // tier: 'auto' 也行

let last = performance.now();
renderer.setAnimationLoop((t) => {
  const now = performance.now();
  q.update(Math.max(1, now - last));   // 动态分辨率 + 可能的自动降档
  last = now;
  post.render(scene, camera, t / 1000);
});
```

## 限制与注意事项

- **检测是启发式**。`WEBGL_debug_renderer_info` 可能被隐私设置屏蔽（那就拿到 `''` → 判 high），
  iOS Safari 的 renderer 字符串经常被统一成同一个值，判断不准；iPadOS 13+ 的 UA 是
  Macintosh，所以额外用 `maxTouchPoints` / 屏幕短边辅助判手机。
- **运行中降档只改 scale / shadow / post，不重建材质**。材质 tier 由
  `createMaterialStore({ tier })` 在创建时固定；要换材质档必须重建场景里的材质与网格。
  这也是为什么推荐「先定档，再建场景」。
- `createPost()` 目前把 MSAA 与 bloom 级数在**创建时**固定，没有运行时切换接口。
  `createAutoQuality` 会调用 `post.setQuality(level)`（如果你的 post 实现了它），
  否则只同步 RT 尺寸——后处理档位不会在运行中变化。
- 像素预算优先于 scale：超大画布上有效像素比可能低于 `scale`，这是有意的（防爆显存/带宽）。
- 只降不升：自动模式不会因为帧率变好而把 tier 升回去。
- `tier: 'baked'` 需要先 `bakeSurfaces(renderer, [...])`；没有烘焙贴图时只警告一次并回退 `live`。
- headless Chromium 用 SwiftShader 软件渲染，会被判成 `low`。它能验收功能，**不能当性能结论**。

## 验收命令

```bash
node test/check.mjs      # 纯逻辑测试（含分档/动态分辨率/材质 tier）
node test/render.mjs     # 6 个页面 headless 渲染，ready=true errors=0
npm run demo             # 然后打开：
#   http://127.0.0.1:8177/demos/scene.html?q=low
#   http://127.0.0.1:8177/demos/scene.html?q=high
#   http://127.0.0.1:8177/demos/scene.html?q=auto   （默认）
```
