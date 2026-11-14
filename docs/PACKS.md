# 主题包手册（怎么写一个新的风格包）

一个**主题包**只做一件事：把「同一套工具」变成另一种风格。
它不碰内核（`src/`），只提供下面六样东西中的若干样。

```
packs/<名字>/
  surfaces.js   新的 GLSL 表面（surf(uv) 函数体）
  models.js     新的模型工厂（用 PropBuilder 拼）
  lighting.js   打光预设
  sky.js        天空 / 雾 / 环境
  index.js      install<Name>Pack() —— 注册表面 + 提供 surfaceMap + 材质参数
demos/<名字>.html + .js   一个能看的演示页
```

## 内核提供的 4 个挂钩

| 挂钩 | 位置 | 作用 |
|---|---|---|
| `registerSurface(name, glsl, params)` | `src/materials/materials.js` | 运行时注册新表面，**不用改** `registry.js` / `assets/glsl` |
| `surfaceNames()` | 同上 | 列出当前所有表面（含包注册的） |
| `createMaterialStore({ createMaterial, averages, surfaceMap })` | `src/materials.js` | `surfaceMap` 覆盖「道具材质名 → 表面名」的映射 |
| `PropBuilder.finish({ size, colliders, surface })` | `src/geo.js` | 模型收尾时写尺寸和碰撞盒 |

## 最小示例

```js
// packs/xxx/surfaces.js
export const plaster = /* glsl */`
void surf(vec2 uv){
  float n = fbm(uv, vec2(40.0), 3, 1.0);
  vec3 c = L(0.86, 0.83, 0.78) * (0.94 + 0.12 * n);
  emit(c, 1.0, 0.5 + (n - 0.5) * 0.1, 1.0, 0.92, 0.0);
}`;

export const PARAMS = { plaster: { tile: 2.5, bump: 1.2, amount: 0.3 } };
export const SURFACE_MAP = { concrete: 'plaster', paint_white: 'plaster' };
```

```js
// packs/xxx/index.js
import { registerSurface, createMaterial } from '../../src/materials/materials.js';
import { plaster, PARAMS, SURFACE_MAP } from './surfaces.js';

export function installXxxPack({ wear = 0.15 } = {}) {
  registerSurface('plaster', plaster, PARAMS.plaster);
  return {
    surfaces: ['plaster'],
    surfaceMap: SURFACE_MAP,
    createMaterial: (name, opts = {}) => createMaterial(name, { amount: wear, ...opts }),
  };
}
```

```js
// demos/xxx.js
const pack = installXxxPack();
const materials = createMaterialStore({ createMaterial: pack.createMaterial, averages, surfaceMap: pack.surfaceMap });
const t = createLevel({ materials });       // 之后的道具/设施自动用新皮肤
```

## 新包检查清单

- [ ] 表面：每个都能在 three r180 编译；`amount`（磨损）默认压到 0.2 以下
- [ ] 映射：`surfaceMap` 不留旧风格的表面（锈、瓦楞、警示条）
- [ ] 模型：`finish({ size, colliders })` 都写了；原点在地面中心、Y 轴朝上
- [ ] 确定性：所有随机都来自 `createRng(seed)`，同一个 seed 出同一结果
- [ ] 灯光：写成一个函数（`createXxxLighting(scene)`），别写死在 demo 里
- [ ] 天空：黑/灰/蓝都行，但要给金属留一点环境（见下）
- [ ] 演示页：0 console 错误，有 HUD 说明
- [ ] 一个场景只用**一个**包（混用会读出"废弃工业区"这种怪风格）

## 三个一定会踩的坑

1. **金属没有环境就全黑**。`metalness=1` 的材质在真空/纯色天空下会失去亮度。
   包里要么给 `scene.environment`（一张极简渐变图就够），要么把该材质映射到非金属表面。
2. **磨损是主题参数，不是模型属性**。同一批集装箱，`amount` 0.5 是锈，0.08 是月尘。
   用包里的 `createMaterial` 包一层统一压。
3. **剪影比材质更难改**。换表面能改"旧/新、干/湿、冷/暖"，但改不了"这是集装箱还是舱段"。
   要彻底换题材，必须做新模型——这是包的主要成本。

## 实测成本（2026-11，两个包都做完之后）

| 部分 | 月球包 | 治愈包 |
|---|---|---|
| 新表面（GLSL） | 4 个 · 86 行 | 5 个 · 166 行 |
| 材质重映射 | 15 条 | 38 条 |
| 天空 | 106 行（黑 + 星 + 地球） | 42 行（渐变 + 雾） |
| 灯光 | 32 行（硬光） | 43 行（软光） |
| 安装函数 | 40 行 | 46 行 |
| **新模型** | **5 个 · 367 行** | **8 个 · 291 行** |
| 复用原有模型 | 40+ 个（0 行改动） | 2 个（0 行改动） |
| 内核改动 | **25 行（一次性）** | **0 行** |

时间（两个代理并行）：各约 26 分钟，其中模型占一半以上。
所有调试里最花时间的三件事：**月壤/叶簇的 shader 长什么样**、**软光和硬光的光比**、**模型摆在哪不穿模**。

### 判断

1. **"工具箱 + 主题包"这条路成立**：第二个包证明内核可以完全不动。
2. **但省下来的不是"做游戏的时间"，而是"做引擎的时间"**：引擎只占一次 25 行；剩下全是内容。
3. **真正贵的永远是模型和美术方向**，不是代码。5 个模型 367 行，8 个小模型 291 行 —— 一个中等场景 30+ 个模型就是几千行。
4. **因此不建议继续"扩工具箱"**：工具箱已经够用了。下一步应该做**一款小游戏**（一个房间、一个动作、五分钟），
   而不是继续做"能装下所有风格的框架"。等第二款游戏真的要复用，再抽第二次也不迟。
5. **也不要急着开源**：现在没有一个外部用户，先把游戏做出来。开源是给"别人要用"的工具，不是给自己壮胆的仪式。

> 一句话：**工具箱到此为止，接下来用它做东西。**
