# Theme contract

Keep the theme outside `src/`. Pin the contract, not one set of visual values.

```text
themes/desert/
  theme.js       recipe data (surfaces, map, palette, sky, lights, camera)
  scene.js       assembly using createLevel / createSky / createPost
  surfaces.js    only if stock surfaces are insufficient
  shots/golden.png
  README.md      brief, references, why, known deviations
```

## Shape

`theme.js` can be data plus a small builder, not pure JSON.

```js
export const theme = {
  id: 'desert',
  brief: { mood, time, density, camera, must, never },
  surfaces: {
    sand: { tile: 4.0, bump: 1.1, tint: 0xe0c08a },
    mud:  { tile: 2.5, bump: 0.8, tint: 0xb08a66 },
  },
  surfaceMap: { sand: 'sand', asphalt: 'sand', concrete_dirty: 'sand', mud: 'mud' },
  palette: { zenith, horizon, fog, key, fill },
  sky: { sunDir, palette },
  lights: { key, hemi, fill },
  post: { exposure, bloom, vignette, grain, sat },
  camera: { target, yaw, pitch, dist, fov },
  whyCustom: {},
};
```

Pass surface parameters when creating the store:

```js
const params = theme.surfaces;
const materials = createMaterialStore({
  averages: AVG,
  surfaceMap: theme.surfaceMap,
  createMaterial: (name, opts) => createMaterial(name, {
    ...opts,
    ...params[name],       // theme tint/tile wins over the store fallback
  }),
});
```

## What is pinned

- the fields above and their validation;
- surface routing and the stock-material rules;
- the screenshot protocol and golden image;
- the acceptance checklist.

## What is not pinned

- one palette, prop list, camera, or post recipe;
- one theme as the only allowed product;
- a custom shader when a stock surface works.

Reference themes exist to seed a copy and to catch regressions. Users copy and override them.

## Project-level validation

Check these before accepting a theme:

- every material name used by the scene resolves to a preset or an explicit `surfaceMap` entry;
- every surface used by the scene has a `bakeAverage` entry and is registered;
- every custom surface has a `whyCustom` note and a stock comparison;
- the theme has `brief`, `palette`, `sky`, `lights`, `post`, and `camera` values;
- the fixed-camera screenshot exists and matches the accepted camera;
- no theme constants were copied into `src/`.

If validation is missing, add a small project-level function. Do not add a theme preset to the core library just to make one scene pass.
