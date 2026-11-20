# three 版本矩阵

yardkit 不打包 three，`three` 是 peer dependency；版本范围写在 `package.json`：

```json
"peerDependencies": { "three": ">=0.178.0 <0.181.0" }
```

## 已验证

每个版本都跑了完整自检 + 无头截图验收（`test/check.mjs` 71 项，`test/render.mjs` 5 个页面）：

| three | `node test/check.mjs` | `node test/render.mjs` | 结果 |
|---|---|---|---|
| 0.180.0 | 71/71 | 5/5 ready，0 console error | ✅ 开发基线 |
| 0.179.1 | 71/71 | 5/5 ready，0 console error | ✅ |
| 0.178.0 | 71/71 | 5/5 ready，0 console error | ✅ peer 下限 |

> 验收环境是 WSL + headless Chromium + SwiftShader（软件光栅化）。它只能证明**功能**（API / shader 编译 / 无异常），
> 数字不能当 GPU 性能。真实性能见 [`PERF.md`](PERF.md)。

**范围外**：

- `0.177.x` 及更早：未逐版验证。库用到的 `Scene.environmentIntensity`、`WebGLRenderer.outputColorSpace`、
  `PMREMGenerator`、`WebGLRenderTarget({ samples })`、`DepthTexture` 等 API 在 0.178 前大多已存在，
  但本项目没有为它们跑过矩阵，所以不写进 peer 范围。
- `0.181+`：没有测试，先不声明兼容；升级时按下面的步骤跑一遍再改范围。

## 关键 API 依赖

如果 three 改了以下任一项，升级会先在这里断：

- `WebGLRenderer.outputColorSpace` + `THREE.SRGBColorSpace`（颜色空间）
- `Scene.environment` / `Scene.environmentIntensity`（金属反光；不设环境贴图金属会全黑）
- `PMREMGenerator.fromScene()`（把 `createSky()` 烘成环境贴图）
- `WebGLRenderTarget({ samples, depthTexture })` + `DepthTexture`（后处理链）
- `Material.onBeforeCompile` + `customProgramCacheKey`（程序化表面接到 `MeshStandardMaterial`）
- `MeshStandardMaterial` 的 `roughness` / `metalness` / `vertexColors`（材质店）

## 自己验证一个版本

```bash
# 1) 换版本（会改 package-lock；测完用 0.180.0 换回来）
npm install -D three@0.179.1
node -e "console.log(JSON.parse(require('fs').readFileSync('node_modules/three/package.json')).version)"

# 2) 无 WebGL 的构造检查：所有工厂 / 材质 / 示例模型
node test/check.mjs

# 3) 无头截图：5 个页面都 ready 且没有 console error
node test/render.mjs

# 4) 类型声明
npm run typecheck

# 5) 换回开发基线
npm install -D three@0.180.0
```

`test/check.mjs` 不依赖浏览器，适合 CI 的第一道闸；`test/render.mjs` 需要 Playwright 的 chromium，
会用 `CHROME_PATH` 或 `~/.cache/ms-playwright` 里的浏览器。

## TypeScript

`three` 本身不带 `.d.ts`，请安装与 three minor 对齐的类型包：

```bash
npm i -D @types/three
```

本仓库的 `npm run typecheck` 就是拿 `@types/three` 编 `test/types-smoke.ts`。
