# 性能：为什么卡、预算怎么分、弱机器怎么配

面向「拿这个库做自己项目的人」。结论先行：

- 卡在**填充率**，不在三角数。一个全屏的 `surf()` 是几十万到几百万次逐像素求值。
- 真正有效的三个开关，按性价比排序：**降 pixelRatio** > **把重材质烘成贴图** > **降后处理 / 阴影**。
- 绝对毫秒数只能在**目标机器**上测。本页的实测数字来自**软件渲染**，只用来比相对大小。

测量工具：[`tools/bench.html`](../tools/bench.html)。

## 1. 为什么会卡

| 原因 | 本库里怎么降 |
|---|---|
| **填充率**：`surf()` 每个像素都跑一遍 GLSL（paint 一个像素 5000+ 次整数运算） | ① `renderer.setPixelRatio(min(dpr, 1.25))`；② `bakeSurfaces()` 烘成贴图；③ 远处/小物件用 `bakeAverage()` 的平均色纯色材质 |
| **DPR / 4K**：CSS 1280×720 在 DPR2 屏上是 4 倍像素，4K 屏 DPR2 是 14 倍 | 把 pixelRatio 当质量旋钮（×1.0 / 0.85 / 0.7 / 0.6），别直接吃 `devicePixelRatio` |
| **MSAA**：`antialias: true` 或多 pass 的 `samples: 4`，每个像素算 N 次 | 实时 GLSL 场景直接 `antialias: false`；后处理用 `createPost(renderer, { quality: 'low' })`（无 MSAA） |
| **阴影贴图**：每盏方向光多渲一整遍场景，4096² 是 2048² 的 4 倍填充 | 一盏主光就够；`sun.shadow.mapSize` 512–1024；远处道具 `castShadow = false` |
| **后处理多 pass**：high 档 5 个 pass（含两级 bloom）+ MSAA，全屏带宽 | `quality: 'low'`（3 pass，一级 bloom）；暗光场景干脆不挂 post，改用雾 + 曝光 |
| **draw call / 三角数**：每个道具一棵 mesh 会很碎 | `MeshBatcher`（`src/geo.js`）合批；远景用 `backdrop.js` 的 LOD；集装箱/货架这种重复件优先合批 |
| **首次 shader 编译**：`onBeforeCompile` 改过的 Standard 材质要现场编译链接，第一帧能到几百毫秒（本机实测 flat 材质首帧 1.1s，paint live 首帧 1.7s） | 加载页把用到的材质各渲一帧预热（`scene.add` 后渲一次离屏）；材质种类越少越好 |
| **材质种类**：每种材质一份 program，30 种 = 30 次编译 + 30 套 uniform | 同一种表面换 `tint` 复用，不要给每个道具新建材质 |

## 2. 实测（软件渲染，非 GPU）

**环境，别误读**：`SwiftShader / CPU 光栅（无 GPU）/ 1280×720 CSS / DPR 1 / Chromium headless / WebGL2`。
工作负载是一块**铺满画面的近距离平面**（1 draw call、2 三角，`slFade≈1` 全细节），**不含**阴影、MSAA、后处理、环境贴图。
所以这是「纯填充率」的下限对照，不是帧率承诺。跑不满目标帧数时按时间上限截断，`n` 见 bench 输出（本表 n=2–30）。

×1.0 = 1280×720，单位 ms：

| 材质 | live p50 / p95 | baked p50 / p95 | flat p50 / p95 | 等级 | 备注 |
|---|---|---|---|---|---|
| paint | 1029 / 1066 | 202 / 272 | 28 / 53 | **L** | 4 次迭代锈迹拖尾，live 最贵的常规表面 |
| hazard | 1315 / 1411 | 359 / 421 | 19 / 43 | **L** | 双色喷漆 + 磨损，全场最贵 |
| concrete | 464 / 523 | 167 / 302 | 22 / 66 | M | 噪声 + 分格线 |
| grass | 290 / 541 | 88 / 117 | 14 / 23 | M | p50 与 p95 差距大（软件光栅抖动） |
| glass | 240 / 265 | 124 / 166 | 20 / 41 | S | 表面最简单，烘焙收益也最小 |

等级定义：live p95 ≥ 800ms 为 L，300–800 为 M，< 300 为 S（**本环境下的相对分档**，换 GPU 分档会变）。

从这张表能拿到的**相对**结论（比绝对值可靠）：

- **烘焙 = 1.6–4.6 倍（p95）**：paint 3.9×、hazard 3.4×、grass 4.6×、concrete 1.7×、glass 1.6×。
  表面越复杂收益越大；glass 这种简单的表面不值得烘。
- **flat 比 baked 又便宜 4–10 倍（p95）**：贴图采样 + 屏幕空间凹凸本身就有成本（在软件光栅上格外贵）。
  所以「远处小物件用平均色」不是偷懒，是最大的单笔节省。
- **live 打不过 flat 一个数量级**：全屏 live 在弱机器上没有中间路线，要么烘要么退平均色。

分辨率缩放（p95，ms；同一块平面，只改 pixelRatio 乘数）：

| 材质 / 模式 | ×1.0 | ×0.85 | ×0.7 | ×0.6 |
|---|---|---|---|---|
| paint live | 1066 | 769 | 517 | 387 |
| hazard live | 1411 | 1258 | 886 | 662 |
| concrete live | 523 | 417 | 278 | 378 |
| grass live | 541 | 316 | 199 | 86 |
| glass live | 265 | 206 | 160 | 119 |
| paint baked | 272 | 194 | 112 | 146 |
| hazard baked | 421 | 332 | 258 | 200 |
| concrete baked | 302 | 308 | 189 | 153 |
| grass baked | 117 | 94 | 66 | 41 |
| glass baked | 166 | 103 | 96 | 62 |
| flat（5 材质均值） | 45 | 31 | 25 | 25 |

像素少了，时间大致线性下降；`flat` 在 ×0.7 以下已经压到测量噪声里。
注意 `concrete live ×0.6 (378) > ×0.7 (278)` 这种倒挂：n 小 + 软件光栅抖动，**看趋势别看单格**。

后处理开销（最重材质 live，×1.0，同一块平面）：

| 档位 | p50 / p95 | n | 相对 off |
|---|---|---|---|
| off | 1538 / 1578 | 3 | — |
| low | 1672 / 1899 | 2 | +9% |
| high | 1783 / 1972 | 2 | +16% |

软件光栅上后处理只占一成多，因为场景本身已经把一帧拖到 1.5 秒；**在 GPU 上这个比例会大得多**
（全屏 pass 和 MSAA 是实打实的带宽/填充成本）。别把这里的 +9% 当成真实比例。

## 3. 预算表（经验值，非实测）

帧预算：60fps = **16.7ms**，30fps = **33.3ms**。判据用 **p95**，不是平均：
p95 决定「玩家会不会觉得卡」，平均值只说明「大部分时候还行」。

一个像素的成本 × 像素数 = 填充率账单：

| 分辨率 | 像素 | DPR2 时（CSS 尺寸不变） |
|---|---|---|
| 1280×720 | 0.92 MP | 3.7 MP |
| 1920×1080 | 2.07 MP | 8.3 MP |
| 2560×1440 | 3.69 MP | 14.7 MP |
| 3840×2160 (4K) | 8.29 MP | 33.2 MP |

16.7ms 怎么分（**经验值**，主流独显、1080p、DPR1 场景；不是本 bench 的实测）：

| 项 | 预算 | 做法 |
|---|---|---|
| 场景几何 + draw call | 3.0 ms | ≤ 200 calls / ≤ 300k 三角；重复件合批 |
| 材质（填充率） | 5.0 ms | 只有近处大面用 live；中景 baked；远景 flat |
| 阴影 | 2.0 ms | 1 盏方向光 2048²；道具默认不投影 |
| 后处理 | 2.5 ms | high = 5 pass + MSAA；能不用就不用 |
| 余量（浏览器 / GC / 合成） | 4.0 ms | 别把 16.7 当 16.7 用完 |

四档建议（**经验值**；运行时自动分档的实现、真实的像素预算钳制逻辑见
[`docs/QUALITY.md`](QUALITY.md)，那里是权威版本，这里只是「该选哪档」的直觉）：

| 档位 | pixelRatio 乘数 | 材质模式 | 阴影贴图 | post | 适合 |
|---|---|---|---|---|---|
| low | 0.7 | flat | 1024 | low | 手机 / 老核显 / 4K 屏 |
| medium | 0.85 | baked（重材质） | 2048 | low | 主流核显、轻薄本 |
| high | 1.0 | live | 2048 | high | 独显 |
| ultra | 1.0 | live | 4096 | high | 独显 + 大显存，且窗口不超 1440p |

判据统一用 p95：**≤ 20ms 才推荐**（16.7ms 之外留 3ms 给浏览器和 GC）。
`tools/bench.html` 底部就按这一条打印可复制的配置。

## 4. 弱机器三行配置

```js
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));   // 1) 像素数
const post = createPost(renderer, { quality: 'low' });      // 2) 后处理档
bakeSurfaces(renderer, HEAVY.map((name) => ({ name, size: 256 })));  // 3) 材质
```

每行省的是什么：

1. **pixelRatio 封顶 1.25**：DPR2 屏上直接砍掉 60% 的像素，是最省的一刀，画质损失比降窗口尺寸小得多。
   实测里 pixelRatio 从 ×1.0 降到 ×0.7（像素砍一半）大概省一半时间。
2. **`quality: 'low'`**：不开 MSAA、bloom 只跑一级，3 个 pass 而不是 5 个，且都是半分辨率。
3. **`bakeSurfaces`**：把最重的表面烘成 256² 可平铺贴图，运行时两次采样代替整段 `surf()`。
   `HEAVY` 就是 bench 里 `bakeList` 那一列（本环境实测：paint / hazard / concrete 需要烘，glass / grass 看机器）。
   每个表面 2 张 256² RT（RGBA8 + RGBA16F，含 mipmap），30 个全烘约 20–30 MB，但**只烘真的在用且真的重的**。
   切主题时记得 `clearBakedSurfaces()`，否则老贴图会一直留在全局注册表里。

`HEAVY` 怎么写：先用 bench 量，把 p95 超预算的表面列进去，例如

```js
const HEAVY = ['paint', 'hazard', 'concrete'];
```

## 5. 怎么自己测

```bash
cd <yardkit 仓库根目录>
python3 -m http.server 8188 --bind 127.0.0.1   # 端口随意，别和别的页面冲突
# 浏览器打开 http://127.0.0.1:8188/tools/bench.html → 点「开始测量」
```

看三处：

1. **最上面那行环境**：`WEBGL_debug_renderer_info` 的 GPU 字符串、DPR、drawingBuffer、maxTextureSize。
   如果出现 `SwiftShader / llvmpipe / software`，说明是软件渲染，数字只做相对比较。
2. **矩阵表**：同一材质横行比 live / baked / flat —— 差值就是「烘焙能救多少」。
   竖着比 ×1.0 / ×0.85 / ×0.7 / ×0.6 —— 差值就是「降分辨率能救多少」。
   **看 p95 那一列**（绿色 ≤ 20ms，黄色 ≤ 33.3ms，红色更慢）。
3. **推荐配置**：页面底部按 p95 ≤ 20ms 逐档试，输出一段可直接粘的代码。

URL 参数（不加就是默认值）：

```
?mats=paint,hazard,concrete&scales=1,0.7&frames=60&warmup=20&maxdpr=2&auto=1
```

`frames` 是目标采样帧数；机器太慢时单次采样有 2.5 秒上限，跑不满就按实到的样本算（表里的 `n`）。
30 个表面全跑要很久，**抽样 5 个代表面**就够判断档位：`paint` / `hazard` 最重，
`concrete` / `grass` 中档，`glass` 最轻。

## 6. 三条免责

- **绝对毫秒数只在目标机器上有意义**。bench 的默认工作负载是「一块全屏平面」，
  它量的是填充率上限，不是你场景的帧率；真实场景还要加 draw call、阴影、后处理。
- **本文表格全部来自软件渲染（SwiftShader / CPU）**，没有独显或核显的实测数据。
  能信的只有**比例**：live → baked 约 1.6–4.6×，baked → flat 再约 4–10×（均为 p95、抽样），像素数近似线性。
  想要 GPU 数字，在自己机器上跑一次 bench，把 p95 连同环境行一起记录。
- **预算表和四档建议是经验值**（社区常见分配 + 本库的材质成本结构），不是实测。
  唯一有实测支撑的判断是「材质模式差一个数量级」这条。
