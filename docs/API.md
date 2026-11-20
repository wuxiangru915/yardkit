# API 速查

人类开发者入口。完整主题写法见 [`THEMES.md`](THEMES.md)，性能见 [`PERF.md`](PERF.md)，
画质分档见 [`QUALITY.md`](QUALITY.md)，类型见 [`TYPES.md`](TYPES.md)。

## 入口

| 入口 | 内容 |
|---|---|
| `yardkit` | 全量导出，231 项 |
| `yardkit/geometry` | 原语、道具、设施、载具、关卡、手部，220 项 |
| `yardkit/materials` | 材质、天空、后处理、烘焙，19 项 |
| `yardkit/quality` | 画质分档、动态分辨率 |
| `yardkit/src/*` | 深导入，保留旧用法 |

`three` 是 peer dependency，范围 `>=0.178.0 <0.181.0`。

## 最小场景

```js
import * as THREE from 'three';
import {
  bakeAverage, bakeEnvironment, createMaterial, createMaterialStore,
  createPost, createSky, createLevel, surfaceNames,
} from 'yardkit';

const AVG = {};
for (const name of surfaceNames()) AVG[name] = bakeAverage(renderer, name);

const materials = createMaterialStore({ createMaterial, averages: AVG });
const sky = createSky(sunDir, { zenith, horizon, sun, cloud });
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.fog = new THREE.FogExp2(horizon, 0.012);

const level = createLevel({ materials, seed: 1 });
level.slab('concrete', -8, 0, -8, 8, 0.2, 8);
level.col(-8, -0.2, -8, 8, 0.2, 8, 'concrete');
scene.add(level.build().root);

const post = createPost(renderer, { quality: 'high' });
```

`bakeAverage` 返回 `THREE.Color`，不是数字；`createMaterialStore` 的 `averages` 接收这些颜色。

## 材质

```js
import { createMaterial, bakeAverage, surfaceNames, registerSurface } from 'yardkit';
import { createMaterialStore, MATERIAL_PRESETS } from 'yardkit/materials';

registerSurface('my_surface', glslBody, { tile: 2, bump: 1.2, amount: 0.2, ao: 1 });
const avg = bakeAverage(renderer, 'my_surface');
const mat = createMaterial('my_surface', { tile: 2, avg, tint: 0xdddddd, amount: 0.1 });

const store = createMaterialStore({
  createMaterial,
  averages: { my_surface: avg },
  surfaceMap: { concrete: 'my_surface' },
});
store.get('wood_pallet', { vertexColors: true });
store.emissive(0xffd7a2, 1.8);
```

- `createMaterial(name, opts)`：`tile / bump / amount / ao / tint / avg / tier / cutout`
- `tier`: `live` | `baked` | `flat`；`baked` 需要先 `bakeSurfaces`
- `bakeSurfaces(renderer, [{ name, size }])`
- `createMaterialStore({ createMaterial, averages, surfaceMap, tier })`
- `MATERIAL_PRESETS`：43 个 PBR 预设；走 GLSL 时 roughness/metalness 不生效，只有 `tint` 会带过去

## 模型与几何

```js
import { PropBuilder, box, bevelBox, cyl, lathe } from 'yardkit/geometry';

const b = new PropBuilder(materials, 'thing', 7);
b.add('paint_white', bevelBox(1, 2, 0.1, 0.02), { p: [0, 1, 0], r: [0, 0.3, 0] }, 0.95);
b.push({ p: [0, 2, 0] });
b.add('steel_galv', cyl(0.05, 0.05, 0.4, 8), null, 1);
b.pop();
const group = b.finish({
  size: [1, 2, 0.1],
  colliders: [{ min: [-0.5, 0, -0.05], max: [0.5, 2, 0.05], surface: 'metal' }],
});
```

`finish` 写 `userData.size` 与 `userData.colliders`（局部坐标，`y=0` 在地面）。

| 工厂 | 内容 |
|---|---|
| `createProp(name, { seed, materials, color })` | 19 种工业道具 |
| `createFixture(name, …)` | 14 种设施 |
| `createContainer(type, …)` | `container20 / container40 / container40hc` |
| `createBoat` / `createCrane` / `createShip` / `createSeagulls` | 载具与远景 |
| `createPAC9` / `createPAC4` / `createHound` / `createGull` | 武器与敌人 |
| `createHandRig` / `createViewModel` | 第一人称手与持枪视图 |
| `createSkyline` / `createBackdrop` | 远景天际线 / 背景合成 |

## 关卡

```js
const level = createLevel({ materials, seed: 7 });
level.slab('concrete', -4, 0, -4, 4, 0.1, 4);
level.col(-4, -0.2, -4, 4, 0.1, 4, 'concrete');
level.place('barrel', 1, 1, 0, { seed: 1 });
level.stairs(0, 0, 0, 0, {});
level.stack(2, -2, [[20, 'red', {}]], 0);
const built = level.build(); // { root, colliders, stats }
```

常用方法：`box / slab / cyl / tube / rod / quad / decal / label / col / place / stairs / catwalk / stack / build / dispose`。

## 天空、后处理、画质

```js
import { createSky, bakeEnvironment, createPost, createAutoQuality } from 'yardkit';

const sky = createSky(sunDir, { zenith, horizon, sun, cloud });
scene.environment = bakeEnvironment(renderer, sky.mesh);

const post = createPost(renderer, { quality: 'high' });
post.uniforms.uExposure.value = 1.1;
post.uniforms.uBloom.value = 0.3;
post.render(scene, camera, time);
post.dispose();

const aq = createAutoQuality({ renderer, post, sun, tier: 'auto' });
aq.update(frameMs);
aq.dispose();
```

`createPost` 返回 `{ rtScene, uniforms, lastStats, setSize, render, dispose }`。

画质 API：`pickTier`、`tierConfig`、`createDynamicResolution`、`createAutoQuality`。

## TypeScript

```ts
import { createMaterial, createLevel, surfaceNames } from 'yardkit';
import { tierConfig } from 'yardkit/quality';
```

类型包需要 `@types/three`；本仓库用 `npm run typecheck` 编译 `test/types-smoke.ts`。

## 验证

```bash
node test/check.mjs     # 工厂 / 尺寸 / 碰撞盒 / 无 NaN
node test/render.mjs    # 5 个 demo 无头截图
npm run typecheck
```
