# TypeScript

库的入口都有类型声明：

| 导入 | 类型文件 |
|---|---|
| `yardkit` | `types/index.d.ts` |
| `yardkit/geometry` | `types/geometry.d.ts` |
| `yardkit/materials` | `types/materials.d.ts` |
| `yardkit/quality` | `types/quality.d.ts` |

`three` 是 peer dependency，本身不带类型；使用方需要：

```bash
npm i three@^0.180.0
npm i -D @types/three
```

## 最小写法

```ts
import * as THREE from 'three';
import {
  createMaterial, createMaterialStore, bakeAverage, surfaceNames,
  createLevel, createSky, bakeEnvironment, createPost,
} from 'yardkit';

const store = createMaterialStore({
  createMaterial,
  averages: Object.fromEntries(surfaceNames().map((n) => [n, bakeAverage(renderer, n)])),
});
const level = createLevel({ materials: store });
level.slab('concrete', -4, 0, -4, 4, 0.1, 4);
const built = level.build();
scene.add(built.root);
```

## 类型覆盖范围

- ✅ 材质 / 天空 / 后处理 / 画质分档 / 关卡 / 原语 / PropBuilder / 载具
- ✅ `userData.size`、`userData.colliders` 的返回形状
- ⚠️ `createProp(name)` 的 `name` 是 `string`，不是 19 个道具字面量的联合类型；运行时未知名字会抛错
- ⚠️ `hands.js` / `weapons.js` 的底层骨骼数据是 `Record<string, unknown>` 级别的宽类型，够用但不精确
- ⚠️ 深导入 `yardkit/src/*` 仍是 JS，没有逐文件 `.d.ts`；优先用上面的四个入口

## 校验

```bash
npm run typecheck       # 编译 test/types-smoke.ts（不产出文件）
```

`tsconfig.json` 把 `yardkit` 的四个入口映射到 `types/`，所以即使仓库没 `npm link` 自己也能检查。
