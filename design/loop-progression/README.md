# Loop progression — reel source material

Reconstructed 2026-08-21. Everything here is **regenerated from this repo's own
history**, not re-created by hand: the four build stages were checked out into
git worktrees, served, and screenshotted at 390×844 @dpr2 (1920×1080 for the big
screen), then measured with `scripts/material-stats.mjs` — the same gate the
project uses in CI.

The screenshots the loops actually produced were never committed; only the
concept renders were. These frames are a faithful replay, not the originals.

## The loops in this repo

| # | Loop | Where the record lives | Rounds | Shape |
|---|---|---|---|---|
| 1 | **Adversarial design critique** | `design/findings/round1-critiques.json` … `round5.json` (582 KB) | 5 | build → independent skeptic → fix → re-critique |
| 2 | **Automated material gate** | `scripts/check-material.mjs`, `material-stats.mjs` | every commit | screenshot → measure → fail the build |
| 3 | **UX/feel audit** | `HANDOFF-QWEN.md`, `QWEN-START.md` | 26 defects, prioritised | audit → rank → hand off → verify |
| 4 | **Definition-of-done gates** | `check-dod` / `check-motion` / `check-console` / `check-acceptance` / `check-commit-flow` | every commit | assert what a screenshot can't prove |

Loop 1 is the one with a visible progression, and it is the one these assets show.

## The four stages

| Stage | Commit | Date | What it is |
|---|---|---|---|
| **A** | `4f064e9` | 08-14 | Six screens built from a **prose spec only** — this session never saw the concept renders |
| **B** | `505e91c` | 08-14 | After critic pass 1 |
| **C** | `98884aa` | 08-15 | After rounds 2–5 — the material rebuild |
| **D** | `fa242c0` | 08-20 | Today, after loops 3 and 4 |

## Findings per round

| Round | Blocking | Major | Minor | Total | Fixed | Rejected |
|---|---|---|---|---|---|---|
| 1 | 42 | 33 | 19 | **94** | — | — |
| 2 | 10 | 34 | 30 | **74** | 62 | 0 |
| 3 | 4 | 19 | 19 | **42** | 70 | 15 |
| 4 | 1 | 16 | 13 | **30** | 51 | 9 |
| 5 | 2 | 8 | 13 | **23** | 42 | 8 |

Total findings fell 76%. Blocking findings: 42 → 10 → 4 → 1 → 2.

(`HANDOFF.md`, written mid-flight, quotes "74 → 42 → 30 → 18" — it was counting
from round 2 and closed round 5 early. The table above is recounted from the
JSON.)

## Material convergence — `midtone %`

The share of pixels between luminance 70 and 150: the single number that
separates "mid-tone machined brass" from "a dark panel." Measured on every
frame in `frames/`.

| Route | A blind | B critic 1 | C rounds 2–5 | D today | Concept art |
|---|---|---|---|---|---|
| board | 3.4% | 3.4% | 35.8% | 53.2% | **39.0%** |
| roll call | 4.4% | 4.4% | 44.9% | 48.0% | **42.1%** |
| team sheet | 3.9% | 3.9% | 39.1% | 38.2% | **37.5%** |
| key ceremony | 4.2% | 4.3% | 39.8% | (route removed) | **21.7%** |
| standings | 7.2% | 7.2% | 37.5% | 36.5% | (v1 render) |
| big screen | 16.5% | 16.8% | 21.6% | 21.7% | **20.2%** |

**A and B are identical on material.** The first critic pass fixed what it was
pointed at — structure, hardware, detail — and never noticed the build was three
stops too dark. It took a *measured* reference to catch that. That is the whole
argument for closing the loop with numbers instead of adjectives.

Note the board at stage D reads 53.2% against the concept art's 39.0% — later
UX loops added a full-bleed splash and larger plates and pushed it past the
target. The gate's band is wide (`midtone 17–64`), so it still passes. A loop
only holds the line it is told to measure.

## Files

```
frames/     23 individual frames — <stage>__<screen>.jpg, full-res, for editing
strips/     six labelled A→B→C→D→concept-art progression sheets, one per screen
strips/convergence-chart.jpg   findings per round, by severity
```

`D-head__key.jpg` is absent on purpose: `/key/:teamId` no longer exists. A later
loop folded the ceremony into the team sheet ("One press for a key", `941dddb`).
The loop deleted a screen.

## Lines worth stealing for the script

From `check-material.mjs`, on why the gate exists:

> A screenshot can look plausible in isolation and still be three stops too dark
> next to the reference; this is the gate that catches that without a human in
> the loop.

From the same file, on the screens nobody was measuring:

> Phase 7 additions: shipped without a v2 concept render, so nothing was gating
> them and they were free to drift dark.

From `HANDOFF-QWEN.md`, on a cheat the loop kept having to remove:

> Do not "fix" it by painting a flat near-white bar across a plate — that exact
> cheat has been removed from this codebase three times. Earn it with real
> bevels and monotonic falloff.

From `round3.json` — the builder **refusing** a critic finding because obeying
the concept art would have lied to the user about the scoring model:

> "On commit the reference turns the whole remaining track white." — REJECTED
> for the punctuality track. A pull adds ONE check-in worth 0.1; lighting five
> sockets would tell a leader the pull lands five.

That is the beat that makes the loop interesting: 32 findings were rejected with
reasons across rounds 3–5. The critic is not the boss.

## Regenerating

```sh
git worktree add <dir> <sha> && npx vite --port <p>   # per stage
node scripts/shot.mjs '<route>' out.png --viewport 390x844 --dpr 2 --base http://localhost:<p>/junkyard-camp/
node scripts/check-material.mjs                        # the gate itself
```

Hard-link `node_modules` into each worktree (`cp -al`) rather than symlinking —
a symlink resolves outside the vite root and React loads twice.
