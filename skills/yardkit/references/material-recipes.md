# Material recipes

Stock first. The library has more surfaces than it has automatic routing.

## Natural surfaces need explicit routing

`sand`, `mud`, and `grass` are registered GLSL surfaces, but they are not automatic `MATERIAL_PRESETS`. A level material name does not activate them by itself.

```js
const surfaceMap = {
  sand: 'sand',
  mud: 'mud',
  grass: 'grass',
  asphalt: 'sand',          // reuse sand for a dry yard
  concrete_dirty: 'mud',    // tracked-in dirt
};

const materials = createMaterialStore({
  createMaterial,
  averages: AVG,
  surfaceMap,
});
```

Or create the material directly when you need per-surface parameters:

```js
const mud = createMaterial('mud', {
  tint: 0xffffff,
  avg: AVG.mud,
  tile: 2.5,
  bump: 0.8,
  amount: 0.55,
});
```

Use a white/near-white tint when the shader already supplies the color. The fallback preset color (`0x808488`) darkens natural albedo.

## Tuning before writing GLSL

| Knob | Effect | Watch for |
|---|---|---|
| `tile` | physical scale of the pattern | too small = noisy; too large = visible repetition |
| `bump` | height contrast | too high = plastic/needle noise at distance |
| `amount` | overall normal/detail strength | 0 = flat; high values amplify aliasing |
| `tint` | color multiplier | gray tint kills natural albedo |
| light angle | specular response | low sun can turn wet mud white |
| roughness floor | sheen | avoid grazing-angle white patches |

`mud` is intentionally wet and low-roughness in places. In a low-sun exterior, clamp its roughness or place it out of grazing light; adding more mud will not fix a white sheen.

## Per-surface params in a theme

Keep values in the theme, not in scattered calls:

```js
const params = {
  sand: { tile: 4.0, bump: 1.1, tint: 0xe0c08a },
  mud:  { tile: 2.5, bump: 0.8, tint: 0xb08a66 },
};

const materials = createMaterialStore({
  averages: AVG,
  surfaceMap,
  createMaterial: (name, opts) => createMaterial(name, { ...opts, ...params[name] }),
});
```

## Reskin existing props

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

`surfaceMap` keys are the material names your scene actually uses; most library props use `MATERIAL_PRESETS` names. A key may also be a natural surface name such as `sand`. Keep one surface family per scene unless the palette is deliberately mixed.

## Custom shader gate

Write a new surface only when all of these are true:

- the stock surface does not read at the target scale;
- parameter changes cannot fix the silhouette or color;
- the new shader is small enough to explain in one paragraph;
- you have a before/after screenshot under the same camera and light.

Register it, add it to `surfaceMap` deliberately, bake its average, and record the reason in `theme.whyCustom`.
