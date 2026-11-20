# Theme brief

Use this when the request is vague, or when the user has no art-direction vocabulary. The goal is to turn "make it feel like X" into a small, checkable target.

## Ask at most five questions

Ask choices, not essays. Do not ask for shader parameters.

1. **Mood**: warm / cool / neutral; calm / tense / cozy; natural / industrial / urban.
2. **Time**: daylight / golden hour / night / overcast.
3. **Density**: empty / medium / busy.
4. **Camera**: eye level / low / high / wide / close.
5. **Reference**: one to three images, or "closest to which starter?"

Optional must/never, only if the user already has strong opinions:

- must include:
- never include:

If the user cannot answer, pick defaults, state them in one line, and continue. Do not block on taste.

## Default choices when the user has no preference

Use these as a neutral starting point, not as a house style:

```text
warm-neutral, golden hour, medium density, eye level, no strong reference
```

Then show three blockouts and let the user pick. A choice between images is easier than a description.

## The five-line brief

Write this before look-dev:

```text
Theme:
One sentence:
Reference:
Light:
Camera:
Must include:
Never include:
```

Example:

```text
Theme: desert outpost
One sentence: A small fuel stop at the end of the day, alone in a wide sand plain.
Reference: /refs/desert-dusk.jpg
Light: low warm sun, long shadows, cool sky fill
Camera: low eye level, 45mm, wide but not fisheye
Must include: sand ground, containers, light mast, guard booth
Never include: greenery, neon, wet streets
```

## Turn choices into technical values

Only after the brief is accepted:

| Brief choice | Technical first move |
|---|---|
| warm / cool | key light color, sky horizon, post saturation |
| empty / busy | prop count, foreground occlusion, fog depth |
| low / high camera | camera pitch and target height |
| golden hour / night | sun elevation, sky palette, exposure |
| natural / industrial | surface family and two or three hero props |
| "like that image" | compare palette, silhouette, light direction before materials |

Do not encode the brief as a bag of unrelated constants. Keep it in `theme.js` under `brief`, then map each line to one layer:

```js
export const theme = {
  id: 'desert',
  brief: { mood: 'warm', time: 'golden hour', density: 'medium', camera: 'low', must: [], never: [] },
  palette: { ... },
  sky: { ... },
  lights: { ... },
  post: { ... },
  camera: { ... },
  surfaces: { ... },
  surfaceMap: { ... },
};
```

## What not to do

- Do not ask a non-technical user to choose `tile`, `bump`, `roughness`, or exposure.
- Do not ask ten questions. Five is enough for a first draft.
- Do not silently pick a completely different mood because the reference is "hard".
- Do not write a custom shader to compensate for a missing brief.
- Do not call the theme finished because the code runs.
