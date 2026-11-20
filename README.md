# yardkit

程序化 three.js 资产库：**零贴图、零模型文件**。表面是 GLSL 算出来的，模型是原语拼出来的。

```
30 个程序化表面 · 19 道具 + 14 设施 + 3 集装箱 · 关卡工具 · 天空 / 后处理 / 远景
```

库只提供**零件**，不提供成品主题。沙漠、夜城、地下基地、恐怖屋，都是使用者用四层配置自己拼的——见 [`docs/THEMES.md`](docs/THEMES.md)。

## 三条规则

1. **零贴图**：所有表面都是 `void surf(vec2 uv)` 的 GLSL 函数，走世界空间投影 + 屏幕空间凹凸。
   仓库里没有一个 `.png` / `.jpg` / 音频文件。
2. **零模型文件**：所有几何都从 box / cyl / tube / lathe 这些原语拼出来，随机数有 seed，同一 seed 结果一致。
3. **主题是一层配置，不是一份代码**：模型不动，换 `surfaceMap` + 天空色板 + 打光 + 后处理就是另一种风格。
   不用改 `src/`，也不用 fork。

## 目录

```
index.js            全量导出（231 项）
src/
  geo.js            原语 + PropBuilder / RigBuilder / MeshBatcher
  propKit.js        摆放 / 法线 / 坐标小工具
  propUtils.js      建模辅助（倒角板、皮带、扫掠、轮胎截面…）
  props.js          19 种道具          propspec.js   尺寸 / 材质 / 碰撞规格表
  fixtures.js       14 种设施
  containers.js     20/40/40HC 集装箱
  level.js          关卡工具箱：几何和碰撞盒用同一套坐标登记
  materials.js      43 个 PBR 预设 + MaterialStore（surfaceMap 在这里生效）
  materials/        程序化材质的实现：glsl / registry / bake / sky / post / noise
  backdrop.js       远景天际线 / 灯组        vehicles.js   船 / 龙门吊 / 海鸥
  hands.js weapons.js viewmodel.js enemies.js              第一人称（FPS 用）
demos/              演示页
docs/               API.md、THEMES.md、MATERIALS.md、PERF.md、QUALITY.md、TYPES.md、THREE-VERSIONS.md
skills/yardkit/     agent workflow + verification checklist
test/check.mjs      无依赖自检；test/render.mjs 无头截图验收
```

## 快速开始

`three` 是 peer dependency，用 importmap 指过去就行（浏览器原生 ESM，不需要打包器）：

```html
<script type="importmap">
{ "imports": { "three": "./node_modules/three/build/three.module.js" } }
</script>
<script type="module">
import * as THREE from 'three';
import { createMaterial, bakeAverage, NAMES } from './materials.js';
import { createMaterialStore } from './src/materials.js';
import { createProp } from './src/props.js';
import { createSky, bakeEnvironment } from './src/materials/sky.js';
import { createPost } from './src/materials/post.js';

const AVG = {};                                   // 每个表面烘一张平均色（远处退化成纯色，性能命门）
for (const n of NAMES) AVG[n] = bakeAverage(renderer, n);
const materials = createMaterialStore({ createMaterial, averages: AVG });

scene.add(createProp('barrel', { seed: 2, color: 'red', materials }));   // 自带 userData.size / colliders
</script>
```

完整可跑的最小例子见 `demos/scene.js`。用 Vite / 打包器时，直接从 `yardkit`、`yardkit/materials`、`yardkit/quality` 导入（类型见 [`docs/TYPES.md`](docs/TYPES.md)）。**金属必须有 `scene.environment`**，否则全黑。

## 演示页

```bash
python3 -m http.server 8177      # 任何静态服务器都行，file:// 打不开（ESM + importmap）
```

| 页面 | 看什么 |
|---|---|
| `demos/showcase.html` | **先看这个**：30 个表面 / 33 个模型 / 3 套自己拼的主题 / 后处理开关，一页全在 |
| `demos/scene.html` | 用关卡工具搭的一小片货场（入门模板） |
| `demos/backdrop.html` | 远景天际线 / 塔吊 / 海鸥（远景 LOD） |
| `demos/viewmodel.html?w=pac9\|pac4` | 第一人称持枪与扳机曲线 |

## 做一个主题

一个主题就四层，**不用碰 `src/`**：

| 层 | 写什么 | 量 |
|---|---|---|
| 表面 | `registerSurface(name, glsl, params)`，库里没有这个材质时才写 | 10–40 行 GLSL |
| 映射 | `surfaceMap`：道具材质名 → 你的表面名（一行换掉 40 多个道具的皮） | 一张表 |
| 天空 | `createSky(sunDir, palette)` 换 5 个色值 | 5 个数字 |
| 光 + 后处理 | 一盏主光 + 一盏半球光；`createPost()` 的曝光 / 光晕 / 暗角 / 颗粒 | 十几个数 |

调参优先级：**光 → 雾 → 后处理 → surfaceMap → 新表面**。前四样拿到 90% 的效果，
写新 shader 是最后手段。完整的写法、七条坑、以及"什么时候不该写 shader"，见 [`docs/THEMES.md`](docs/THEMES.md)。

可以照抄：
- `demos/showcase.js` 第三页 —— 三套 100 行以内的主题（黄昏 / 沙漠 / 深夜），只用上面第 2–4 层。

## 性能与弱机器

30 个表面全是逐像素 GLSL：**卡在填充率，不在三角数**。有效手段按性价比：降 pixelRatio → 把重材质烘成贴图 → 降后处理 / 阴影。

```js
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
const post = createPost(renderer, { quality: 'low' });
bakeSurfaces(renderer, ['paint', 'hazard', 'concrete'].map((name) => ({ name, size: 256 })));
```

- 为什么卡、预算怎么分（60/30fps 的 16.7 / 33.3ms）、四档建议： [`docs/PERF.md`](docs/PERF.md)
- 在自己的机器上测： `python3 -m http.server 8177` → 打开 `tools/bench.html`，看 live / baked / flat 的 p95 和页面底部生成的配置
- 运行时自动分档（启动选档 + 动态分辨率）： [`docs/QUALITY.md`](docs/QUALITY.md)

> 毫秒数只在**目标机器**上才有意义；仓库里记的那份是软件渲染（SwiftShader / CPU）测的，只用于比较相对成本。

## TypeScript 与 three 版本

- 类型入口：`yardkit` / `yardkit/geometry` / `yardkit/materials` / `yardkit/quality`，用法见 [`docs/TYPES.md`](docs/TYPES.md)。
- `three` peer 范围：`>=0.178.0 <0.181.0`；0.178.0 / 0.179.1 / 0.180.0 都跑过自检 + 无头截图，见 [`docs/THREE-VERSIONS.md`](docs/THREE-VERSIONS.md)。
- 自己验证：`npm run typecheck`；类型包需要 `@types/three`（与 three minor 对齐）。

## 验收

```bash
node test/check.mjs                    # 所有工厂实例化 / 尺寸 / 碰撞盒 / 无 NaN，10 秒，无依赖
node test/render.mjs                   # 每个 demo 无头截图 + 收集 console 错误（自动找 chromium）
npm run typecheck                      # 编译 test/types-smoke.ts（需要 @types/three）
md5sum src/*.js src/materials/*.js     # 改主题时用来确认内核没被动过
```

## 边界（这套库不做什么）

- **没有人形角色**：只有 Hound（四足机甲）和 Gull（飞行无人机）。
- **没有 2D / 像素**：这是纯 3D 的。
- **没有家具**：只有工业道具。沙发、桌子、书架要么拿 `PropBuilder` 自己拼，要么去建模。
- 程序化表面吃核显，全屏满屏时注意 `setPixelRatio(min(dpr, 1.5))` + `antialias: false` + `bakeAverage`。

## 许可

- **本仓库自己编写的代码**：MIT（见 `LICENSE`）。
- **派生自原作品的部分**：几何参数、命名约定、shader 思路与贴花设计来自
  [Saltline](https://realcodebear.github.io/saltline-fable-5.2/)——一个单文件浏览器 FPS。
  原作品未声明作者与许可，本仓库**不对这些衍生部分主张授权**；它们仅供学习、研究与开源参考，
  商业使用前请自行取得原作者许可，或替换相应部分。完整说明见 `NOTICE`。
- `three.js` 是 peer dependency（MIT），不打进仓库；本仓库不含任何第三方图片、字体或音频。
