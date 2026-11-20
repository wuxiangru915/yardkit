---
name: yardkit
description: Use with the yardkit procedural three.js library to build scenes, reskin props, add materials, levels or models, or improve weak-GPU rendering. Trigger on yardkit, procedural scene, zero-texture material, surfaceMap, theme, prop, level, bakeAverage, quality tier, or three.js asset work.
---

# yardkit

Procedural, zero-texture three.js asset library. Surfaces are GLSL; models are built from primitives.

Base: `${KIT:-/home/wxr/.project/yardkit}`

The library has good parts, not finished themes. A theme is a **recipe**, not a shader pile: surface choices + scale + palette + light + camera + a screenshot you can defend.

The user owns preference; you own vocabulary. Never make a non-technical user learn shader terms to ask for a warmer or emptier scene.

Skip the art loop for pure API, type, or test tasks; use the task router instead.

## Hardcode policy

Pin these:

- the theme contract, plus a project-level validator when the project has one;
- the stock-material routing (`sand`, `mud`, `grass` are registered shaders, not automatic presets);
- the screenshot protocol and one golden image for each reference theme you keep;
- verification commands.

Do not pin these into `src/` or into the only allowed theme:

- one palette, prop list, camera, or post recipe;
- a custom shader when a stock surface works;
- a single theme as the product. Keep reference themes for regression; users copy and override them.

## Workflow

### 1. Get a target before writing code

If the request is only a mood word ("desert", "cozy", "cyberpunk"), do not invent silently.

- Ask at most five **choice** questions from `references/theme-brief.md`.
- Never ask a non-technical user for `tile`, `bump`, `roughness`, or exposure values.
- If they cannot answer, choose defaults, say what you chose, and show options.
- Restate the result as a five-line brief. Get a yes before look-dev.

Use or ask for one to three reference images. They beat adjectives.

### 2. Blockout three compositions

Build three cheap gray-blockout variants before materials:

- wide / empty;
- medium with foreground occlusion;
- low or high camera angle.

Use simple neutral materials and the real prop silhouettes. Screenshot all three. The user picks one. Do not spend look-dev time on the wrong composition.

### 3. Look-dev in the right order

Tune in this order:

1. key light and sun angle
2. fog and horizon
3. exposure / bloom / vignette
4. `surfaceMap` (which stock surface goes where)
5. surface `tile` / `bump` / `amount` / `tint`
6. a new shader, only if the stock surface cannot do the job

Stock first. Natural surfaces are registered but need explicit routing. A route activates the shader; it does not automatically give it a natural tint:

```js
surfaceMap: {
  sand: 'sand',
  mud: 'mud',
  grass: 'grass',
}
```

`level.slab('sand', ...)` does not activate the sand shader by itself, and the store's fallback tint is gray. Set a white/warm tint in the theme or create the material directly. See `references/material-recipes.md`.

### 4. Shoot, compare, correct

Every iteration:

```bash
node skills/yardkit/scripts/shoot.mjs \
  'http://127.0.0.1:8176/theme/index.html?still=1' \
  /tmp/theme-current.png 20000
```

Start a static server from the scene root first: `bash demos/serve.sh 8176`. Increase the wait for heavy software-rendered scenes and confirm the probe reports `ready`.

Read the image. Compare it with the brief and reference. List five differences, then fix the top two in **one layer only**. Screenshot again. Keep the better one; revert the worse one.

Do not rewrite composition, materials, lighting, and post in the same pass.

### 5. Accept or hand back

Use `references/acceptance.md`. Automated checks are gates, not an art review.

Stop after three loops without visible improvement and ask the user to choose one axis. A shorter, better loop is more useful than endless random edits.

## Non-negotiable rules

1. **Screenshot or it is not done.** Passing tests and a clean console are not visual acceptance.
2. **Stock first.** Try existing surfaces and parameters before writing GLSL. If you write a custom surface, record why the stock one failed.
3. **One axis per iteration.** Composition, light, material, palette, props, and post are separate changes.
4. **Bake every surface.** Call `bakeAverage(renderer, name)` and pass the colors into `createMaterialStore({ averages })`. Missing averages means distant pixels keep running full GLSL.
5. **Metal needs an environment map.** Set `scene.environment = bakeEnvironment(renderer, sky.mesh)`, or metal and chainlink render black.
6. **Colliders are local-space.** Props expose `userData.colliders` with `y=0` at the ground; `createLevel().place()` transforms them.
7. **Do not edit `src/` for a theme-only task.** Keep the theme in project data and scene assembly. Custom surfaces go through `registerSurface`.
8. **No runtime dependencies without asking.** No CSG, physics, or model-loader dependency just to make a shape.
9. **Translate vague feedback into a layer.** "Too industrial" is usually composition + props + palette, not a shader problem.

## Theme contract

Keep the theme outside `src/`: `theme.js` for data, `scene.js` for assembly, `surfaces.js` only if stock surfaces are insufficient, plus a golden shot. Pin the contract, not one palette.

See `references/theme-contract.md` for the shape and the store wiring.

## Task router

| Task | Read / use |
|---|---|
| New theme or scene | this workflow; `references/theme-brief.md`; `references/theme-contract.md`; `docs/THEMES.md` |
| Reskin existing props | `references/material-recipes.md`; `docs/MATERIALS.md`; `surfaceMap` |
| Add a prop/model | `references/modeling.md`; `docs/API.md`; `PropBuilder` in `src/geo.js` |
| Performance / weak GPU | `docs/PERF.md`, `docs/QUALITY.md`, `tools/bench.html` |
| TypeScript | `docs/TYPES.md`, `types/` |
| three.js compatibility | `docs/THREE-VERSIONS.md` |
| Tests or screenshots fail | `node test/check.mjs`, `node test/render.mjs`, `npm run typecheck` |
| Visual correction | `references/look-dev.md`; `references/acceptance.md` |

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

## Symptoms

Classify the layer before changing code: composition, light, atmosphere, material scale, palette, props, or post. See `references/look-dev.md` for the table and the one-axis loop.

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

## Deliverable

- a screenshot at a fixed camera (`?still=1`, same viewport);
- the five-line brief and any reference image path;
- theme files changed, including `whyCustom` if applicable;
- commands run and their results;
- known deviations from the reference.

No screenshot, no acceptance. No acceptance, not done.
