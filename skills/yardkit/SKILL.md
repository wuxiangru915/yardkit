---
name: yardkit
description: Build scenes and theme packs with yardkit, the zero-texture procedural three.js asset library at /home/wxr/.project/yardkit. Use when the user asks for a new style/theme (moon, cozy, industrial, night, snow, desert…), wants to add new surfaces/shaders, models, lighting or sky presets to the kit, needs a demo scene built from kit geometry, or asks to re-skin existing props without remodelling. Also use when the task mentions yardkit, 主题包, 换风格, 月球基地, 治愈包, or 用工具箱做一个场景.
---

# yardkit workflow

The kit is a **procedural, zero-texture** three.js library: primitives → `PropBuilder` → batched meshes with
`userData.size` + `userData.colliders`. Styles are *layers*, not forks: one kernel, many theme packs.

Base path: `/home/wxr/.project/yardkit` (override with `$KIT` if moved).
Read first when unfamiliar: `README.md`, `docs/PACKS.md`, `docs/LESSONS-MOON.md`.

## Step 0 — decide the silhouette class (do this before writing code)

| The target theme is… | What works | Cost |
|---|---|---|
| industrial / sci-fi / hard-surface (moon base, port, mine, lab) | re-skin existing props + a few new models | ~1 day |
| low-poly / flat-shaded cozy (A Short Hike, Unpacking) | re-skin + flat colours, no detail | ~1 day |
| realistic cozy, organic (leaves, cloth, cat, hands) | needs real modelling (Blender → glTF) | weeks |

Say this out loud to the user before starting. Re-skinning changes **new/old, warm/cold, wet/dry** — it does not change
"this is a shipping container or a habitat module". If the silhouettes differ, plan models, not shaders.

## Step 1 — plan (one short doc, then code)

Write `docs/PLAN-<topic>.md`: goal, variables, file ownership, acceptance checks, cost estimate.
A theme pack is **five parts** — say which ones you will write:

1. `surfaces.js` — new GLSL `void surf(vec2 uv)` bodies
2. `surfaceMap` — kit material name → pack surface (this is what re-skins 40+ props)
3. `sky.js` — background, fog, environment
4. `lighting.js` — one function `create<Name>Lighting(scene)`
5. `models.js` — new `PropBuilder` models (optional but usually needed)

## Step 2 — kernel hooks (never edit `src/` to add a style)

```js
import { registerSurface } from '../src/materials/materials.js';
registerSurface(name, glslBody, { tile, bump, amount, ao });   // runtime, idempotent by name

createMaterialStore({ createMaterial, averages, surfaceMap });  // surfaceMap overrides name → shader
```

- `createMaterial(name, opts)` accepts `{ tile, bump, amount, tint, avg }`; `amount` is wear/grime.
- Pack's `install<Name>Pack({ wear })` must return `{ surfaces, surfaceMap, createMaterial }` and wrap
  `createMaterial` so every surface gets the pack's wear (see `packs/moon/index.js`, `packs/cozy/index.js`).
- Bake averages with `bakeAverage(renderer, name)` after `install…Pack()` so new surfaces are included.

## Step 3 — models

Use `PropBuilder` (`src/geo.js`): `new PropBuilder(mats, name, seed)`, `.add(mat, geo, xf, col)`, `push/pop`,
then `.finish({ size, colliders })`. Primitives: `box bevelBox cyl tube lathe rangeBox roundPoly2D
extrudeProfile extrudeX extrudeZ latheSection loftSections mergeGeos`. Helpers: `propKit.placeGeo/scaledPlane/
boxSpan/tubeSpan`, `propUtils.roundedCornerPlate/strapRibbon/deformGeo`.

Rules: metres, Y-up, origin at ground centre, `size` = `[w, h, d]`, colliders in **local** coords, all randomness
from `createRng(seed)`, zero textures, Chinese names/comments, exports `create<Thing>` + `<PACK>_MODEL_NAMES` +
`create<Pack>Model(name, opts)`.

## Step 4 — verify (all three, every time)

```bash
cd "$KIT"
node test/check.mjs            # expect "N checks passed", 0 failed
node test/render.mjs           # every demo "ready=true errors=0"
md5sum -c /tmp/kit-src-baseline.txt   # kernel must be untouched
```

Headless screenshot recipe: `references/verification.md`. Kernel baseline: `md5sum src/*.js src/materials/*.js
assets/glsl/*.glsl > /tmp/kit-src-baseline.txt` *before* touching anything.

## Step 5 — parallel agents (when the user asks for more than one pack)

One agent per pack, disjoint file ownership, no shared files:

| Owner | May write | Must not touch |
|---|---|---|
| agent A | `packs/<a>/**`, `demos/<a>-*` | `src/`, other packs, `test/`, docs |
| agent B | `packs/<b>/**`, `demos/<b>-*` | same |
| you | `test/`, `docs/`, `README.md`, `shots/` | agent files |

Brief each agent with: goal + why, the five parts, API paths, the three acceptance commands, *exact* chromium and
playwright paths from `references/verification.md`, and "report real numbers, not claims". Afterwards verify
yourself: md5 kernel, read the screenshots, run the suite.

## Step 6 — deliver

- Demo page `demos/<name>.html` + `.js` with HUD line; register it in `test/render.mjs` targets.
- Screenshot into `shots/`, composite comparisons with PIL (see `references/verification.md`).
- Update `README.md` demo table + pack table; write `docs/EXPERIMENT-<topic>.md` (question, variables, result,
  failures, cost) and add measured cost to `docs/PACKS.md`.
- State the honest limits (what still looks wrong) — the user values that more than polish.

## Pitfalls (all cost us real time)

1. **Metal without an environment renders black.** Ship a tiny env (`createMoonEnvironment` style: canvas gradient →
   `PMREMGenerator.fromScene`) or map metals to non-metal surfaces.
2. **Wear is a theme parameter.** Wrap `createMaterial` and clamp `amount`; a moon base has dust, not rust.
3. **Noise scale decides the material.** Craters too small read as concrete; leaf clusters too small read as noise.
4. **One pack per scene.** Mixing packs reads as "abandoned industrial park".
5. **Don't tune the camera to hide a bad pack** — fix the pack, re-shoot the same camera.
6. **`mergeGeos` keeps only position/normal/uv/color** — custom attributes need their own mesh.
7. **Never let an agent edit `src/` or `test/` to make numbers pass.** If a check count changes because a module
   appeared, that is correct — report it, don't "fix" it.

## Templates

`assets/pack-template/` — copy to `packs/<name>/`, fill in, then:
`node test/check.mjs` should auto-pick it up only after you add it to `test/check.mjs` (your file, not the agent's).
