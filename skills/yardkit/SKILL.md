---
name: yardkit
description: Use the yardkit procedural three.js asset library at /home/wxr/.project/yardkit to build scenes, and to help users make their own theme on top of it. Use when the task involves yardkit assets/props/levels/surfaces, needs a procedural (zero-texture) three.js scene, needs a new surface shader or a re-skin of existing props, or mentions yardkit, 换皮, 主题, 材质, 道具, 关卡.
---

# yardkit

零贴图、零模型文件的程序化 three.js 资产库：表面是 GLSL 算的，模型是原语拼的。
**库里没有"主题包"**——主题（沙漠、夜城、地下基地…）是使用者用四层配置自己拼的，见 `docs/THEMES.md`。

Base: `${KIT:-/home/wxr/.project/yardkit}`。先读 `docs/THEMES.md`（怎么做一个主题）和 `docs/MATERIALS.md`（30 个表面的 tile/bump 参数）。

## 库里有什么

| 层 | 入口 | 内容 |
|---|---|---|
| 材质 | `materials.js` | 30 个程序化表面 + `createMaterial` / `bakeAverage` / `registerSurface` / `surfaceNames` |
| 材质仓库 | `src/materials.js` | `createMaterialStore({ createMaterial, averages, surfaceMap })` → `.get(name)`、43 个 PBR 预设 |
| 渲染 | `src/materials/{sky,post}.js` | `createSky` + `bakeEnvironment`；`createPost`（bloom / 暗角 / 颗粒 / 曝光 / 饱和 / 受伤红边） |
| 造型 | `src/geo.js` | 原语 + `PropBuilder` / `RigBuilder` / `MeshBatcher` |
| 模型 | `src/{props,fixtures,containers}.js` | 19 道具 + 14 设施 + 3 集装箱，`createProp` / `createFixture` / `createContainer` |
| 关卡 | `src/level.js` | `createLevel({ materials, seed })`：`.box/.slab/.col/.place/.stairs/.catwalk/.stack/.label/.decal/.build()` |
| 远景 | `src/{backdrop,vehicles}.js` | 天际线 / 灯组 / 船 / 龙门吊 / 海鸥（远景 LOD 用） |
| 第一人称 | `src/{hands,weapons,viewmodel,enemies}.js` | 骨骼手 / PAC-9 / PAC-4 / 持枪视图模型 / 两种机甲敌人 |

`index.js` 全量导出（231 项）；按需 import 具体文件更省（浏览器没有 tree-shaking）。

## 三条硬规则

1. **每块表面都要 `bakeAverage`**，存进 `averages` 传给 store，否则远处会一直跑全精度 shader（核显直接掉帧）。
2. **金属必须有环境贴图**：`scene.environment = bakeEnvironment(renderer, sky.mesh)`，否则 metal / gunmetal 全黑。
3. **几何的碰撞盒用 `userData.colliders`（局部坐标，y=0 在地面）**：`createLevel().place()` 会自己变换后登记，手摆道具时也要这么做。

## 做一个主题（四层）

```js
// 1) 只在库里没有这个材质时才写表面
registerSurface('my_sand', `void surf(vec2 uv){ ... }`, { tile: 3, bump: 2, amount: 0.4 });

// 2) 映射：库里的道具材质名 → 你的表面名（一行换掉 40 多个道具的皮）
const materials = createMaterialStore({ createMaterial, averages: AVG, surfaceMap: { concrete: 'my_sand' } });

// 3) 天空色板
const sky = createSky(sunDir, { zenith, horizon, sun, cloud, fog });
scene.add(sky.mesh); scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.fog = new THREE.FogExp2(palette.fog, 0.012);

// 4) 一盏主光 + 一盏半球光 + createPost() 的数字
```

调参优先级：**光 → 雾 → 后处理 → surfaceMap → 新表面**。前四样就能拿到 90% 的效果，
写新 shader 是最后手段（也是唯一容易失控的一步）。理由和踩坑见 `docs/THEMES.md`。

## 验收（改完必须跑）

```bash
cd "$KIT"
node test/check.mjs                 # 期望 "N checks passed"，0 failed
node test/render.mjs                # 每个 demo "ready=true errors=0"（自动找 chromium，可用 CHROME_PATH 覆盖）
bash skills/yardkit/scripts/verify.sh
```

改 `src/` 之前先拍基线：`md5sum src/*.js src/materials/*.js assets/glsl/*.glsl > /tmp/kit-src-baseline.txt`。
只写演示 / 主题（`demos/`）时不要动 `src/`。

## 坑

1. 表面改了要重新 `bakeAverage`，否则远处还是旧的平均色。
2. `assets/glsl/*.glsl` 是源，`src/materials/glsl.js` 是 `tools/build-glsl.mjs` 生成的——改完要重跑构建。
3. `MATERIAL_PRESETS` 的 roughness/metalness 在走 GLSL 时**不生效**，只有 `tint` 会被带过去。
4. `mergeGeos` 只保留 position / normal / uv / color。
5. 雾色 ≠ 地平线色时，地面尽头会浮一条灰带。
6. 一个场景只用一套表面，混搭会读成"废弃工业园"。
