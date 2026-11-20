# Acceptance

Automated checks are gates, not an art review. A scene can pass every test and still be wrong for the brief.

## Required evidence

- fixed-camera screenshot from `scripts/shoot.mjs`;
- the five-line brief;
- reference image path, or "no reference; defaults chosen";
- theme files changed;
- commands run and their results;
- known deviations from the reference.

No screenshot means not accepted. No acceptance means not done.

## Art rubric

Score each item 1–5. Accept only if every item is at least 3 and none is a blocker.

1. **Readability** — the intended theme is clear within two seconds.
2. **Coherence** — surface, sky, fog, light, and post feel like one world.
3. **Composition** — foreground, midground, and background carry the eye; the camera is intentional.
4. **Craft** — no obvious floating props, z-fighting, tiled repetition, blown highlights, or black metal.
5. **Brief fit** — it matches the must/never lines and the reference, not just "a nice scene".

If the score is low, fix the lowest item first. Do not compensate with bloom.

## Technical gates

Run from `KIT`:

```bash
node test/check.mjs
node test/render.mjs
npm run typecheck
bash skills/yardkit/scripts/verify.sh
```

For a theme page, also confirm:

- no console errors other than a missing favicon;
- `window.__starter` (or the scene probe) reports `ready`;
- draw calls and triangle counts are plausible for the target device;
- screenshots are generated at the same viewport and camera as the approved shot.

## Screenshot protocol

- Use `?still=1` or an equivalent freeze flag.
- Use the same viewport for before/after: default 1600×900.
- Do not compare a moving frame to a still frame.
- Keep the camera fixed while changing materials or lighting.
- Label software-rendered shots as software-rendered; do not present them as GPU performance numbers.

## Hand-off note

Write a short note next to the screenshot:

```text
Theme:
Accepted:
Camera:
What changed:
Known gap:
Next candidate:
```

That note is more useful than a paragraph of self-praise.
