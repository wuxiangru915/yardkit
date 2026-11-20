# Look-dev and correction

Use this during visual iteration. The goal is to change the smallest layer that can fix the visible gap.

## Loop

1. Freeze the camera: `?still=1`, fixed viewport, fixed seed, no animation.
2. Screenshot the current state with `scripts/shoot.mjs`.
3. Compare it to the accepted brief and reference. List five differences.
4. Pick the top two. Fix them in **one layer only**.
5. Screenshot again. Keep the better version; revert the worse one.
6. Record the delta in one line: what changed, what improved, what got worse.

After three loops with no clear improvement, stop and ask the user to choose one axis. Do not keep changing random knobs.

## Feedback translator

Do not accept "it looks bad" as a material instruction. Put it in a layer first.

| User says | Likely layer | First move |
|---|---|---|
| "Too industrial" | composition + props + palette | replace two context props; warm the key; remove one hard-edged object |
| "Too empty" | composition | add foreground occluder, midground object, or a light pool |
| "Too busy" | composition + post | remove props before adding fog or blur |
| "Too dark" | light + exposure | raise exposure or fill; do not brighten every material |
| "Washed out" | exposure + post | lower exposure; check bloom and sun intensity |
| "Too gray" | palette + key/fill | change key color and sky horizon; keep geometry |
| "Sand is flat" | material scale + composition | tune `tile` / `bump`; add midground dunes; only then consider a new shader |
| "Sand repeats" | material scale + LOD | raise `tile`, lower contrast, bake average, check distance fade |
| "Mud is white" | light + material placement | raise roughness floor, move it out of grazing sun, or use a matte variant |
| "Looks like the same kit" | composition + props + sky | change two hero props and the sky before touching surfaces |
| "Camera feels wrong" | camera | change height, distance, and target; do not change materials |
| "Not the mood" | sky + fog + exposure | fix atmosphere before adding more models |

## One-axis rule

Change only one of these per pass:

```text
composition / camera / key light / fog / exposure+post / surfaceMap / surface params / custom shader / props
```

If two changes are necessary, make them in the same layer and screenshot both. Otherwise you will not know which one worked.

## Approved baseline

When the user approves a screenshot:

- copy it to `shots/<theme>-approved.png`;
- keep the corresponding `theme.js` values;
- make subsequent changes as a delta from that state;
- if a later pass is worse, restore the approved state before trying another axis.

Do not restart from a blank scene because one pass failed. Keep the composition that was already accepted.

## Stock before custom

Try in this order:

1. existing surface, existing parameters;
2. existing surface, different `tile` / `bump` / `amount` / `tint`;
3. existing surface in a different place or light;
4. a thin custom surface layered on top;
5. a new shader.

If you reach step 5, write down what stock surfaces failed and what the new shader fixes. That note becomes `whyCustom` in the theme.

## Quick diagnosis

- **Flat**: no foreground, no midground, no shadow, one light direction.
- **Plastic**: too much specular, no roughness variation, no grime at contact points.
- **Dirty but unreadable**: too much high-frequency detail; lower bump or increase tile.
- **Wrong scale**: a surface reads as a texture, not a material; compare a 0.5m, 2m, and 10m view.
- **Floating**: missing contact shadow, collider, or ground-height mismatch.
- **Mud white**: grazing specular; material roughness or placement, not more mud.
