# 做一个你自己的主题

库只提供**零件**：30 个表面、33 个模型、关卡工具、天空、后处理。
它**不提供现成主题**——"沙漠""月球""恐怖""治愈"都该是使用者自己拼出来的，一个主题就是四行配置。

## 四层，按顺序调

| 层 | 你写什么 | 改动量 |
|---|---|---|
| 1. 表面 | 用 `registerSurface(name, glsl, params)` 注册自己的 `surf(uv)`；不需要新表面时就跳过 | 每个 10–40 行 GLSL |
| 2. 映射 | `createMaterialStore({ surfaceMap })`：库里的道具材质名 → 你的表面名 | 一张表 |
| 3. 天空 | `createSky(sunDir, palette)` 换 5 个颜色：zenith / horizon / sun / cloud / fog | 5 个色值 |
| 4. 打光 + 后处理 | 一盏主光 + 一盏半球光（+ 可选点光）；`createPost()` 的数字调曝光/光晕/暗角/颗粒 | 十几个数 |

**90% 的"风格"在第 2、3、4 层就能做出来**，第 1 层只在"这个材质库里没有"时才需要写。
`demos/showcase.js` 的第三页就是三套只用第 2–4 层拼出来的主题（黄昏 / 沙漠 / 深夜），不到 100 行。

## 最小例子

```js
// 省略了 renderer / scene 的创建
import * as THREE from 'three';
import { createMaterial, bakeAverage, surfaceNames, registerSurface } from '../materials.js';
import { createMaterialStore } from '../src/materials.js';
import { createSky, bakeEnvironment } from '../src/materials/sky.js';

// 1) 自己的表面（不写这一步也行）
registerSurface('my_sand', /* glsl */`
void surf(vec2 uv){
  float n = fbm(uv, vec2(60.0), 4, 1.0);
  emit(L(0.72, 0.62, 0.46) * (0.9 + 0.2 * n), 1.0, 0.9, 0.0, 1.0, 0.0);
}`, { tile: 3, bump: 2, amount: 0.4 });

// 2) 映射：一行换掉 40 多个道具的皮
const surfaceMap = { concrete: 'my_sand', asphalt: 'my_sand', paint_blue: 'rust' };

const AVG = {};
for (const n of surfaceNames()) AVG[n] = bakeAverage(renderer, n);

const materials = createMaterialStore({ createMaterial, averages: AVG, surfaceMap });

// 3) 天空（同时是环境反射的来源：金属离了它就会黑）
const sky = createSky(new THREE.Vector3(-0.4, 0.5, 0.7).normalize(), {
  zenith: 0x6d8fb0, horizon: 0xe0c9a4, sun: 0xfff0d0, cloud: 0xcfc3ae, fog: 0xd8c3a2,
});
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.fog = new THREE.FogExp2(0xd8c3a2, 0.012);

// 4) 光 + 后处理
```

完整可跑的版本：`demos/scene.js`（88 行）。

## 七条踩过的坑

1. **金属没有环境 = 一片黑。** 一定要 `scene.environment = bakeEnvironment(...)`，否则 `metal / gunmetal / chainlink` 全是剪影。
2. **磨损是主题参数，不是材质参数。** 沙漠/真空不该"脏"：把 `amount` 压到 0.1–0.2；老房子相反，抬到 0.35 以上。用一层 `createMaterial` 包装统一钳住。
3. **噪声尺度决定材质读成什么。** 噪声太细 → 混凝土；太粗 → 塑料布。改 `tile`（一块图案铺几米）比改 shader 有效得多。
4. **一个场景只用一套表面。** 混两种风格会读成"废弃工业园"，除非你就是想要这个。
5. **别调相机去遮丑。** 换皮之后同一机位重拍一张，能立刻看出是皮的问题还是形的问题。
6. **`mergeGeos` 只保留 position / normal / uv / color**，自定义属性要单独一个 mesh。
7. **雾色必须等于地平线色。** 否则地面尽头会浮起一条灰带，一眼假。

## 什么时候该写新表面

| 目标 | 该做什么 |
|---|---|
| 工业 / 港口 / 实验室 / 仓库 | 大概率不用写：`concrete / metal / rust / paint / corrugated` 够用 |
| 低多边形、纯色、扁平 | 不用写表面：直接用 `MeshLambertMaterial + flatShading`，比 GLSL 便宜 |
| 有机、布料、植物、真实家具 | 别写 GLSL，去建模（Blender → glTF），程序化表面救不了形 |
| 这个题材特有的表面（沙、墙纸、月壤） | 写 `registerSurface`，40 行以内 |


API 速查见 [`API.md`](API.md)。
