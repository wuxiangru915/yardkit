# Modeling quality

Materials cannot fix a bad silhouette. Check the model before tuning surfaces.

## Checklist

- **Silhouette first.** Inspect front / side / top / 3/4 views before adding detail.
- **Bevel every hard edge.** Prefer `bevelBox` over raw `box`; give panels real thickness.
- **Use curves for curved things.** `lathe` for round forms, `loftSections` for hulls and blades, `ParametricGeometry` / `RoundedBoxGeometry` from `three/addons` for surfaces.
- **Build connections.** A frame, bracket, weld bead, or recess reads better than two boxes touching.
- **Vary repetition.** Rotate, tint, and offset repeated props; a perfect row looks like a test scene.
- **Check scale.** Compare a 1.8m human reference against doors, crates, and vehicle parts.
- **Wireframe and triangle count.** More polygons do not fix a bad proportion.
- **No runtime CSG.** Precompute with `three-bvh-csg` offline if a boolean is truly needed, or build frames and infills as separate parts.

## PropBuilder

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

## Weak GPU

```js
const post = createPost(renderer, { quality: 'low' });
bakeSurfaces(renderer, ['paint', 'hazard', 'concrete'].map((name) => ({ name, size: 256 })));
const aq = createAutoQuality({ renderer, post, sun, tier: 'auto' });
```

Priority: pixel ratio → baked surfaces → post quality → shadow size → lower tier.

See `docs/API.md` for builders and `docs/QUALITY.md` for tiers.
