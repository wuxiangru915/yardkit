# yardkit API 速查

路径基准：`/home/wxr/.project/yardkit`。详细说明见 kit 的 `README.md`。

## 入口

| 文件 | 内容 |
|---|---|
| `index.js` | 全量导出（234） |
| `geometry.js` | 几何/道具/设施/关卡/贴花/手部/背板（225） |
| `materials.js` | 材质系统（13）：`createMaterialStore`、`createMaterial`、`defaultMaterials` |
| `src/materials/materials.js` | `registerSurface`、`surfaceNames`、`bakeAverage`、`createMaterial` |

## 材质

```js
import { createMaterial, bakeAverage, surfaceNames } from '../materials.js';
import { registerSurface } from '../src/materials/materials.js';

registerSurface('my_surface', glslBody, { tile: 2, bump: 1.2, amount: 0.2, ao: 1 });
const avg = bakeAverage(renderer, 'my_surface');          // 需要 renderer，之后传给 avg:
const mat = createMaterial('my_surface', { tile: 2, avg, tint: 0xdddddd, amount: 0.1 });

const materials = createMaterialStore({ createMaterial, averages: AVG, surfaceMap });
materials.get('wood_pallet', { vertexColors: true });
materials.emissive(0xffd7a2, 1.8);
```

`createMaterial(name, { tile, bump, amount, tint, avg })`。`amount` = 磨损/脏污；`surfaceMap` 把道具材质名
（`concrete`、`steel_rust`、`tarp`…）重映射到包里注册的表面名。

## 模型

```js
import { PropBuilder, bevelBox, box, cyl, tube, lathe } from '../src/geo.js';
const b = new PropBuilder(materials, 'thing', seed);
b.add('paint_white', bevelBox(1, 2, 0.1, 0.02), { p: [0, 1, 0], r: [0, 0.3, 0] }, 0.95); // 0.95 = 顶点色明度
b.push({ p: [0, 2, 0] }); b.add(...); b.pop();
const group = b.finish({ size: [1, 2, 0.1], colliders: [{ min: [-0.5, 0, -0.05], max: [0.5, 2, 0.05], surface: 'metal' }] });
```

`finish` 写 `group.userData.size`（`[w,h,d]`）与 `group.userData.colliders`（**局部坐标**，`y=0` 在地面）。

## 场景组件

| 函数 | 说明 |
|---|---|
| `createLevel({ materials, seed })` | `.box/.slab/.quad/.col/.stairs/.catwalk/.build()` → `{ root, colliders, stats }` |
| `createProp(name, { seed, materials, color })` | 19 种：`barrel pallet pallet_stack crate_wood crate_stack ibc_tote cable_reel tire_stack jerry_can traffic_cone gas_cylinders pipe_stack tarp_cargo sandbags cardboard_boxes forklift generator dumpster toolbox_cart` |
| `createFixture(name, …)` | 14 种：`jersey_barrier light_mast fence_panel guard_booth gate_arm bollard_mooring bollard_post sign_post floodlight_stand stairs_metal catwalk shelf_rack reefer_unit relay_node` |
| `createContainer(type, …)` | `container20 / container40 / container40hc`，`{ color, wear, materials }` |
| `createDecal(kind, …)` | 19 种标识/污渍（工业向，主题包慎用） |
| `createHand('right', { material })` | 第一人称手；`.root` 挂 `camera`；`.update(dt, {})` |
| `createSkyline({ materials, seed })` / `createLamps(...)` | 远景天际线 / 灯组 |
| `createSky(sunDir, palette)` + `bakeEnvironment(renderer, mesh)` | 渐变天空 + 环境贴图 |
| `createPost(renderer, { quality })` | 后处理：`uniforms.uBloom/uVignette/uGrain/uSat/uExposure/uTime`、`render(scene, camera, time)`、`setSize` |

## 已有主题包

| 包 | 入口 | 提供 |
|---|---|---|
| `packs/moon` | `installMoonPack({ wear })` | `regolith moonrock foil solar`；`createMoonSky/createMoonEnvironment/createMoonLighting`；5 个模型 + `createMoonModel` |
| `packs/cozy` | `installCozyPack({ wear })` | `plaster painted_wood ceramic weave foliage`；`createCozySky/createCozyLighting`；8 个模型 + `createCozyModel` |

## 文档

`README.md`（总览）、`docs/PACKS.md`（写包清单）、`docs/LESSONS-MOON.md`（12 条经验）、
`docs/EXPERIMENT-MOON.md`（对照实验）、`docs/AB-LIGHTING.md`（打光 A/B）。
