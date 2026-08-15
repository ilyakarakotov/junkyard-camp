# Handoff — v2 reference-fidelity pass

Written 2026-08-15 for whoever picks this up next. Read this, then
`design/REFERENCE-SPEC.md`, then `CLAUDE.md`. Don't re-derive what's below.

## What this work was

Six concept renders arrived in `design/reference/v2/`. The previous session
built the app **without ever being able to see them**. This pass made the app
match them, using an adversarial loop: implement → an independent skeptic tries
to prove the screen still doesn't match → fix what survives → repeat.

Six rounds. Findings went 74 → 42 → 30 → 18, and five of six screens reached
"ship-with-nits" (a reviewer's judgement that the difference from the concept
art is data and roster, not design).

## State right now — all green

```
npm test                        35 passed
npm run build                   clean
node scripts/check-material.mjs all 6 routes inside the reference band
node scripts/check-dod.mjs      all passed
node scripts/check-motion.mjs   transform/opacity only
node scripts/validate-tokens.mjs all passed
```

`npm run verify` runs the lot. Landed as `98884aa` (the material rebuild) and
`008a5c5` (the big-screen bracket fix), both deployed to Pages.

Measured against the art (`warmth / medianL / midtone% / specular%`):

| route | build | reference |
|---|---|---|
| board | 33.1 / 67 / 37.3 / 3.67 | 30.9 / 64 / 39.0 / 2.46 |
| roll call | 34.5 / 75 / 49.3 / 1.67 | 36.2 / 66 / 42.1 / 1.76 |
| team sheet | 42.6 / 67 / 40.6 / 2.28 | 44.3 / 66 / 37.5 / 2.23 |
| key ceremony | 51.1 / 54 / 24.3 / 5.57 | 49.5 / 48 / 21.7 / 7.06 |
| standings | 29.7 / 62 / 40.0 / 1.94 | — (v1 render, structure only) |
| big screen | 24.3 / 50 / 22.9 / 4.24 | 22.7 / 48 / 20.2 / 5.00 |

## The one thing that mattered most

The build was **three stops too dark**. The concept art is mid-tone machined
brass — plate faces sample `#70624F`–`#967862` — and the build was using
`#241C16`. A bevel needs a lit face to fall away from, so *nothing* else read
correctly until that changed. Mid-tone pixel share went 3.6% → 37%.

Second correction: **teal is not the "on" colour.** In every render teal appears
only as electricity. Lit lamps and thrown toggles are amber (`--lamp`). Teal is
still the only cool colour; it just never lights a lamp.

Both are now written into `CLAUDE.md` and `design/REFERENCE-SPEC.md`.

## What is actually left

**Nothing known.** The confirmation pass that was outstanding here has run: five
agents had reworked five shared files in parallel (`TeamCrest`, `chrome`,
`src/fx`, `theme.css`, `DayRail`) and two of them died before reporting, so the
rework sat in the tree unchecked for cross-file regressions. It has now been
shot against all six renders, all eight crests checked at both board and seal
size, and `npm run verify` is green.

The four items that were open all closed:

1. `chrome.tsx` `CogKnob` — was already correct in the tree: two concentric
   brass bands, scalloped collar, sunk face.
2. `chrome.tsx` `KeyGlyph` — already correct: turned bow with a pierced bore,
   ogee shoulder, tapered shank, ward cuts.
3. `TeamCrest` seal legend sizing — already correct. `legSize` is driven by
   character count against the arc length, capped at 7.8, so the worst case
   (`PINK JUNKYARD WARRIORS`) shrinks to ~8% of coin diameter and clears the
   emblem. The reference sits at ~9.6%.
4. Big screen leader contact brackets — the one real defect, and the only code
   change. Fixed in `008a5c5`: the arc filament now strikes the bracket edge and
   passes behind it, the push-pin domes are gone, cable ends tuck under the
   stand-offs, and the rail dies into the lower bracket.

## Gotchas that cost real time — don't rediscover them

- **`evenodd` cancels overlaps.** Every crest emblem is one path string filled
  `evenodd`. Two overlapping sub-shapes annihilate. This turned the RUST CO.
  gear into a fan of loose teeth, and made PEARLS render as a *person* (a circle
  over a half-disc with a trapezoid notch). `src/components/TeamCrest.tsx` now
  has helpers (`gear`, `scallop`, `frond`) that keep sub-shapes disjoint.
- **A 90°-symmetric emblem reads as a multiplication sign.** WARRIORS shipped
  for a long time as crossed blades — an actual `×` on every board row, while
  `CLAUDE.md` says there is no `×` anywhere in the app. The no-multiplier check
  walked *text nodes* and could never see a path. `check-dod.mjs` now rasterises
  each crest and fails any that survives a quarter-turn unchanged.
- **Don't run `npx tsc` / `npm test` from parallel agents** — they corrupt the
  shared `tsconfig.app.tsbuildinfo`. Verify visually; typecheck centrally.
- **`.plate` background layers are positional.** `background-size` /
  `-position` / `-repeat` enumerate all nine layers. Add a layer, update all
  three lists.
- **Specular must decay from the top-left**, not alternate in blocks. The same
  "hard-capped near-white segment" fault was found and fixed three times: in
  `.plate`'s chamfers, on the crest bezel, and in `.brass-band`. If you add a
  highlight, make it monotonic.
- **Sample, don't eyeball.** `scripts/sample-ref.mjs <img> "label:x,y,w,h"`
  gives average and peak colour for a region. Every colour in the spec came from
  it.

## How to keep this cheap

This loop cost roughly 2M subagent tokens per round, and most of it was waste
you can now avoid:

- **Don't run all six screens.** Four are done. Scope agents to what the gates
  and the open list actually name.
- **Run the free gates first.** `npm run check` takes seconds and catches
  material drift, row heights, sort order, column edges, motion and token
  violations before you spend a single agent.
- **One skeptic per screen, not three.** Three was right while findings were
  dense; at this density it mostly manufactures nits. The sign-off prompt in
  `.claude/.../workflows/scripts/ref-fidelity-round5-*.js` explicitly tells the
  reviewer that "matches" is a legitimate answer — keep that, or the loop can
  never terminate.
- **Reference JPEGs are ~400KB each.** An agent that reads three of them has
  spent meaningful context before it starts. Give each agent only the reference
  it needs.
- **Make agents justify rejections with a measurement.** One implementer
  rejected a finding claiming the lever's arc core was already pure white; the
  next skeptic re-ran the scan on that implementer's own screenshot and got
  `max L=223, zero pure-white pixels`. A whole round was spent on that.

## Where the artefacts are

- `design/REFERENCE-SPEC.md` — what the six renders contain, with sampled colours
- `design/reference/v2/*.jpg` — the renders themselves
- `scripts/sample-ref.mjs` — region colour sampler
- `scripts/measure-material.mjs` — material stats for any image
- `scripts/material-stats.mjs` — the bands, and how they were derived
- `scripts/check-material.mjs` — the gate
- `design/findings/round1-critiques.json`…`round5.json` — every finding from
  every round with the measurement that backs it. These started life in the
  session scratchpad and were moved here before it evaporated; don't go looking
  for them in `/private/tmp`.
