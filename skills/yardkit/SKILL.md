---
name: yardkit
description: Use with the yardkit procedural three.js library to build scenes, reskin props, add materials, levels or models, or improve weak-GPU rendering. Trigger on yardkit, procedural scene, zero-texture material, surfaceMap, theme, prop, level, bakeAverage, quality tier, or three.js asset work.
---

# yardkit

Procedural, zero-texture three.js asset library. Surfaces are GLSL; models are built from primitives.
There are no theme packs: themes are assembled from four layers.

Base: `${KIT:-/home/wxr/.project/yardkit}`

## Task router

| Task | Read / use |
|---|---|
| New theme or scene | `docs/THEMES.md`; `demos/showcase.js` third page as a 100-line reference |
| Reskin existing props | `docs/MATERIALS.md`; `surfaceMap` recipe below |
| Add a prop/model | `docs/API.md`; `PropBuilder` in `src/geo.js` |
| Performance / weak GPU | `docs/PERF.md`, `docs/QUALITY.md`, `tools/bench.html` |
| TypeScript | `docs/TYPES.md`, `types/` |
| three.js compatibility | `docs/THREE-VERSIONS.md` |
| Tests or screenshots fail | `node test/check.mjs`, `node test/render.mjs`, `npm run typecheck` |

## Non-negotiable rules

1. **Bake every surface before use.** Call `bakeAverage(renderer, name)` and pass the colors into `createMaterialStore({ averages })`. Missing averages means distant pixels keep running the full GLSL shader.
2. **Metal needs an environment map.** Set `scene.environment = bakeEnvironment(renderer, sky.mesh)`, or `metal`, `gunmetal`, and `chainlink` render black.
3. **Colliders are local-space.** Props expose `userData.colliders` with `y=0` at the ground; `createLevel().place()` transforms and registers them.
4. **Do not edit `src/` for a theme-only task.** Use `registerSurface`, `surfaceMap`, sky, lights, and post.
5. **Do not add runtime dependencies without asking.** No CSG, physics, or model-loader dependency just to make a shape.

## Minimal theme

```js
registerSurface('my_sand', glslBody, { tile: 3, bump: 2, amount: 0.3 });

const AVG = {};
for (const name of surfaceNames()) AVG[name] = bakeAverage(renderer, name);

const materials = createMaterialStore({
  createMaterial,
  averages: AVG,
  surfaceMap: { concrete: 'my_sand' },
});

const sky = createSky(sunDir, { zenith, horizon, sun, cloud });
scene.add(sky.mesh);
scene.environment = bakeEnvironment(renderer, sky.mesh);
scene.fog = new THREE.FogExp2(horizon, 0.012);

const post = createPost(renderer, { quality: 'high' });
```

Tuning order: **light → fog → post → surfaceMap → new surface**. Do not start with a shader.

## Recipes

### Reskin existing props without new geometry

```js
const materials = createMaterialStore({
  createMaterial,
  averages: AVG,
  surfaceMap: {
    concrete: 'my_stone',
    steel_rust: 'my_rust',
    wood_pallet: 'my_wood',
  },
});
const crate = createProp('crate_wood', { materials, seed: 3 });
```

`surfaceMap` keys are `MATERIAL_PRESETS` names. Keep one surface family per scene.

### Add a prop with `PropBuilder`

```js
const b = new PropBuilder(materials, 'my_prop', 7);
b.add('paint_white', bevelBox(1, 2, 0.12, 0.02), { p: [0, 1, 0] }, 0.95);
b.add('steel_galv', cyl(0.04, 0.04, 0.5, 8), { p: [0.4, 1.2, 0] });
const prop = b.finish({
  size: [1.2, 2, 0.2],
  colliders: [{ min: [-0.6, 0, -0.1], max: [0.6, 2, 0.1], surface: 'metal' }],
});
```

`finish` returns a `Group` with `userData.size` and `userData.colliders`.

### Weak GPU

```js
const post = createPost(renderer, { quality: 'low' });
bakeSurfaces(renderer, ['paint', 'hazard', 'concrete'].map((name) => ({ name, size: 256 })));
const aq = createAutoQuality({ renderer, post, sun, tier: 'auto' });
```

Priority: pixel ratio → baked surfaces → post quality → shadow size → lower tier.

## Symptom → fix

| Symptom | Cause | Fix |
|---|---|---|
| Metal is black | no environment map | `scene.environment = bakeEnvironment(...)` |
| Ground ends in a hard band | fog color ≠ horizon | use the same color for both |
| Distant surfaces are noisy or flat | missing `bakeAverage` / `avg` | bake every surface and pass `averages` |
| Props float or sink | collider/placement mismatch | local colliders with `y=0` at ground; use `place(..., y)` |
| Decal z-fights | coplanar quad | offset by ~0.005 and use `polygonOffset` |
| Shadow acne or peter-panning | shadow bias | tune `bias` / `normalBias`, keep `PCFSoftShadowMap` |
| Low FPS | fill rate, live surfaces, post | lower DPR, bake surfaces, use `quality: 'low'` |
| Baked material still live | baked after material creation | create materials after `bakeSurfaces`, or call `userData.setBaked` |

## Modeling quality

- **Silhouette first.** Check front/side/top/3/4 views before adding detail.
- **Bevel every hard edge.** Prefer `bevelBox` over raw `box`; give panels real thickness.
- **Use curves for curved things.** `lathe` for round forms, `loftSections` for hulls/blades, `ParametricGeometry` / `RoundedBoxGeometry` from `three/addons` for surfaces.
- **Do not use runtime CSG to fake detail.** Precompute with `three-bvh-csg` offline if a boolean is truly needed, or build frames/infills as separate parts.
- **Check the wireframe and triangle count.** More polygons do not fix a bad proportion.

## Verification

```bash
cd "$KIT"
node test/check.mjs          # expect "N checks passed", 0 failed
node test/render.mjs         # expect every demo "ready=true errors=0"
npm run typecheck
bash skills/yardkit/scripts/verify.sh
```

Before editing `src/`, capture a baseline:

```bash
md5sum src/*.js src/materials/*.js assets/glsl/*.glsl > /tmp/kit-src-baseline.txt
```

## Done means

- `test/check.mjs` passes.
- `test/render.mjs` has 0 console errors.
- `npm run typecheck` passes if types/API changed.
- A changed scene has a fresh screenshot.
- `src/` changes are intentional, not accidental theme work.
