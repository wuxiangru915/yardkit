---
name: yardkit
description: Repo-only agent skill for yardkit, a procedural three.js asset library. Use when changing yardkit scenes, materials, props, levels, or themes; use docs/ for human-facing API and theme docs.
---

# yardkit · agent skill

> 这是给 AI coding agent 的仓库内 skill，不是人类 onboarding 文档。
> 人类入口：`README.md`、`docs/API.md`、`docs/THEMES.md`。
> Base: `${KIT:-/home/wxr/.project/yardkit}`

## 先读

- `docs/THEMES.md`：四层主题、调参优先级、七条坑
- `docs/API.md`：入口、材质、模型、关卡、天空/后处理/画质
- `docs/QUALITY.md`：画质分档 + 动态分辨率
- `docs/TYPES.md`：TypeScript 入口
- `docs/THREE-VERSIONS.md`：three 版本范围

## 三条硬规则

1. **每个表面先 `bakeAverage`**，把结果放进 `averages` 传给 `createMaterialStore`；否则远处会一直跑全精度 shader。
2. **金属必须有环境贴图**：`scene.environment = bakeEnvironment(renderer, sky.mesh)`，否则 metal / gunmetal / chainlink 会全黑。
3. **碰撞盒在 `userData.colliders`**（局部坐标，`y=0` 在地面）；用 `createLevel().place()` 或手动变换后登记。

## 四层主题

```js
registerSurface('my_sand', glslBody, { tile: 3, bump: 2, amount: 0.3 });
const materials = createMaterialStore({ createMaterial, averages: AVG, surfaceMap: { concrete: 'my_sand' } });
const sky = createSky(sunDir, palette);
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.fog = new THREE.FogExp2(palette.fog, 0.012);
const post = createPost(renderer, { quality: 'high' });
```

调参顺序：**光 → 雾 → 后处理 → surfaceMap → 新表面**。不要先写 shader。

## 容易踩的坑

- `assets/glsl/*.glsl` 是源，`src/materials/glsl.js` 是 `tools/build-glsl.mjs` 生成的；改完源要重跑构建。
- 走 GLSL 时 `MATERIAL_PRESETS` 的 roughness/metalness 不生效，只有 `tint` 会带过去。
- `mergeGeos` 只保留 position / normal / uv / color；自定义属性要单独 mesh。
- 雾色必须等于地平线色，否则地面尽头浮一条灰带。
- 一个场景尽量只用一套表面，混搭容易读成“废弃工业园”。

## 验收

```bash
cd "$KIT"
node test/check.mjs          # 期望 "N checks passed"，0 failed
node test/render.mjs         # 期望每个 demo "ready=true errors=0"
npm run typecheck
bash skills/yardkit/scripts/verify.sh
```

改 `src/` 前先拍基线：

```bash
md5sum src/*.js src/materials/*.js assets/glsl/*.glsl > /tmp/kit-src-baseline.txt
```
