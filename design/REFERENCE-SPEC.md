# v2 reference spec — derived from `design/reference/v2/*.jpg`

Six concept renders are the taste target. This file is what they actually
contain, written down, because the images are the authority and prose drifts.
Colors here were **sampled from the JPEGs** with `scripts/sample-ref.mjs`, not
estimated by eye. Re-sample rather than nudging a value because a screenshot
"felt dark".

`CLAUDE.md` still owns the roster, the scoring model, the data model and the
forbidden list. Where this file and CLAUDE.md disagree about **material**, this
file wins; where they disagree about **rules or numbers**, CLAUDE.md wins.

## The one correction the references force

The concept art is **mid-tone machined brass and bronze hardware**, not dark
brown panels. Sampled plate faces land at `#70624F`–`#967862`; the build was
using `#241C16`. Everything else — bevels, screws, recesses, glow falloff — only
reads once the plates are bright enough for a bevel to have somewhere to fall.

Second correction: **teal is not the "on" color.** In every reference, teal
appears *only* as electricity — the lever tube, the big-screen leader arcs.
Energized contacts, lit lamps, toggles and punctuality sockets are **amber**.
Teal stays the arc color and the only cool color, exactly as CLAUDE.md says; it
just never lights a lamp.

## Material palette

```
--wall            #221A14   the wall behind everything (was #16110D — too dark)
--wall-deep       #150F0A   vignette floor at the screen edges

--plate-hi        #94795E   plate face, top edge (key light lands here)
--plate           #82684F   plate face, middle
--plate-lo        #654632   plate face, bottom edge (falls into shadow)
--plate-spec      #FFEED3   broken specular along the top chamfer

--brass-hi        #E8C795   brass frame, lit face
--brass           #9D8050   brass frame, body
--brass-lo        #5A4526   brass frame, shadowed face
--brass-spec      #FBE1B7   brass peak highlight

--well            #1A120E   recess interior (socket, score readout, LCD window)
--well-rim        #544740   the lit lower-right lip of a recess

--lamp            #ED9040   energized contact / toggle track
--lamp-hot        #FEDF97   lamp core
--lamp-dim        #C17530   a lit punctuality socket at rest
--off-track       #614A39   toggle track, unpowered
--off-knob        #543E2E   toggle knob, unpowered

--knurl           #A98D64   knurled brass grip
--knurl-spec      #FFEEC2

--arc             #2FD9D0   teal arc body      (unchanged)
--arc-hot         #FFFFFF   arc core           (unchanged)
--key             #FFC63D   golden key         (unchanged)
--key-hot         #FFF4D0
--text            #F2E7D3   cream
```

Team colors are unchanged and remain machine-verified. In the references the
team color appears in exactly three places: the crest glyph, a lit binary cell,
and a filled big-screen meter segment. It is never used for a team's **name** —
names are always cream. (The build had them tinted; that flattens the hierarchy
and loses the cell/segment signal.)

## Hardware vocabulary

Every screen is assembled from the same six parts. Build them once, share them.

1. **Plate** — a mid-brass brushed panel. Vertical gradient `--plate-hi` →
   `--plate` → `--plate-lo`, horizontal anisotropic brushing, chamfered corners
   (8–10px), 2px bevel lit from the **top left**, soft contact shadow beneath.
2. **Screw** — a brass slotted head in a dark washer seat, ~11px, one at each
   plate corner, inset ~9px. Slot angles vary per screw. On the references they
   are clearly visible, not micro rivets.
3. **Brass frame** — a heavy double band: outer bevel, engraved inner line, lit
   top-left, `--brass-lo` bottom-right. Used for header panels and rails.
4. **Recess** — a well cut into a plate. True inner shadow darkest at the
   top-left lip, one hairline of `--well-rim` along the bottom-right.
5. **Lamp** — a socket that emits. Unlit: a `--well` disc with a rim. Lit:
   `--lamp-hot` core, `--lamp` body, and a glow that **spills onto the
   surrounding plate** with tight falloff.
6. **Medallion** — the team crest. Two concentric brushed brass rings, four
   bezel screws at the diagonals, a dark team-tinted interior, and the glyph in
   **bright, luminous team color** (not engraved dark — the references glow).
   A larger `seal` variant adds the team name as circular text inside the ring.

One light direction on every screen: **top left**. Rust patina in crevices and
along lower edges only.

## Screen 01 — Board (`/`)

Reference: `01-board.jpg` (1080×1935 ≈ 390×700 CSS at DPR ~2.77).

Top to bottom:

- **Header plate.** Full-width brass plate, chamfered corners, double brass
  frame, screw at each corner, ~92px tall. Centered: `DAY 2 — KINGDOM` in heavy
  condensed cream, ~34px. Em dash, not a hyphen.
- **Day rail.** A horizontal brass rail spanning the width with a small rivet at
  each end, carrying **five circular sockets** evenly spaced. Past days read as
  filled brass discs; the current day is a **teal-lit lamp** whose bloom spills
  onto the rail; future days are dark unlit sockets. This is the one place teal
  lights a socket rather than an arc — it is a *pilot lamp*, and its glow is
  motivated by the rail it sits in.
- **Eight team rows**, each its **own separate plate** (they do not share one
  panel — the gap between plates is where the wall shows through), identical
  height, 8px gutters, four corner screws each. Left to right inside a row:
  1. **Rank chip** — a recessed square well with a light border, `01`..`08` in
     cream tabular numerals. Sequential and correct; the build had duplicates.
  2. **Medallion**, ~76px, glyph glowing in team color.
  3. **Team shortName** in cream heavy condensed, ~30px, left-aligned.
  4. **Binary row** — six square sockets, ~34px, 6px gaps. Earned: a filled
     glowing square in the team color with a bright inner face. Unearned: a dark
     recessed square with a thin warm rim. They share a baseline with the name.
  5. **Punctuality row**, directly beneath the binary row — seven circular
     sockets, then a `–` dash, then a **cog knob** (a brass rosette with a
     starburst face). At 6/7 the seventh socket is rimmed amber and pulsing.
  6. **Key rail** — a recessed capsule at the row's right, holding lit golden
     keys and dark key silhouettes for the empty slots. Above three keys: three
     keys and `+N` in tabular numerals. No `×` anywhere.
  7. **Score readout** — a recessed dark panel, right-aligned, `6.0` in cream
     tabular numerals, ~40px. All eight share a column edge.
- **Footer strip.** A brass plate with a decorative barcode and a mono line:
  `STATUS: ONLINE / SYNC: 98% / VER: 2.2.1 / ID: …`.

Arcs: idle flicker only, and only on the day rail's lit socket.

## Screen 02/03 — Roll call (`/call/:categoryId`)

References: `02-rollcall-rest.jpg` (rest), `03-rollcall-commit.jpg` (discharge).

- The whole screen sits inside an **outer bronze bezel** with a screw at each
  corner — the screen is one machine, not a scroll of cards.
- **Header.** A brass plate holding a **recessed dark LCD window**: the category
  name in large cream (`PUNCTUALITY`), and beneath it the auto-selected activity
  in mono (`MORNING LINE UP · 9:45`). The window is a true recess with a thin
  brass frame; the plate around it carries four screws.
- **Eight rows**, each its own plate with four corner screws: medallion (~56px),
  team name in cream, the seven punctuality sockets, a vertical hairline, then a
  **large knurled cog knob** at the right — that knob is the selection control.
- At rest a row's sockets show earned check-ins in team color and the rest dark.
- **Selected** (03): the row's sockets go **white-hot** with a warm bloom, and
  the cog knob's face flips to a **numeric readout** of the value the pull will
  land (`1.0`). Already-earned sockets keep their team color; the ones this pull
  will add are the white-hot ones.
- **The lever.** A tall plate housing at the bottom:
  - A **knurled brass grip bar** spanning the width, at the **top** of the
    travel, mounted on two vertical rails via brass collars.
  - Two **vertical brass rails**, full height, with **engraved tick gauges**
    down the outer side of each. At rest the ticks are dark engravings.
  - A **glass tube** across the mid-track with brass end collars. At rest a thin
    teal arc idles inside it.
  - A brass plate at the bottom reading `PULL TO COMMIT` — the build engraves
    `PRESS TO COMMIT` instead, the one deliberate departure from the art: the
    housing commits on a tap, and the plate is the only instruction the screen
    gives. It is flanked by two tiny
    diamond marks.
  - **On commit** (03): the grip travels to the bottom; the tube erupts —
    blown-out white core, heavy teal bloom, and **branches jumping from the tube
    to both vertical rails**, which are the arc's two brass contact posts. The
    rails glow teal, the **tick gauges ignite amber**, and teal light spills up
    onto the row plates above.
- Drag tracks the finger 1:1. Spring back `cubic-bezier(0.34,1.56,0.64,1)` 400ms.

## Screen 04 — Golden key ceremony (`/key/:teamId`)

Reference: `04-golden-key.jpg`. **No teal at all.** Gold-white arcs, warm gold
light. This is the one deliberate exception and the reason it lands.

- The screen is a **dark brushed vault door** — cooler and darker than the brass
  rows (`#2A241F`-ish), with large screws and a horizontal seam near the top.
- **Team seal** at the top, overlapping the seam: a thick gold ring with the
  team name as circular text inside it, the crest in the middle, gold bloom.
- **Center: an escutcheon** — a brass keyhole plate with an arched top and
  bottom and a screw at each end, containing a **blown-out keyhole** (circle
  plus tapered slot) that throws **god-rays** outward across the door.
- **Two vertical brass handle posts**, one either side of the escutcheon, each
  with a screw at both ends. **Gold-white arcs jump from each post to the
  escutcheon** — the posts are the endpoints, exactly as the arc rule requires.
- **Title block:** `GOLDEN KEY` enormous cream condensed; the full team name
  beneath, slightly smaller; `KEY 02` in letterspaced mono beneath that.
- **Bottom: the key rail** — a brass bar with rivets, keys hanging from it by
  their bows. Previously awarded keys hang dull and cold; the new one is
  **gold-hot with sparks and rising smoke**, cooling to match over ~2s.

## Screen 05 — Team sheet (`/team/:teamId`)

Reference: `05-team-sheet.jpg`.

- **Header panel.** A heavy brass **double frame** (outer bevel + engraved inner
  line) with a screw at each corner, over a brushed interior. Rust patina along
  the frame's lower corners. The **team seal overhangs the panel's top edge** —
  a large coin, radial brushed gold, team name as circular text, crest inside.
- **The equation**, one line, baseline-shared:
  `5.6` huge cream · `/ 6.0` small dim · `+` · `2` large + `KEYS` small · two
  small gold key glyphs · `=` · `7.6` largest, with `TOTAL` beneath it in small
  caps. Tabular numerals throughout.
- **Day rail:** five **octagonal chamfered brass tabs** numbered `1`–`5`. The
  selected day is inset and lit amber with the glow spilling under it; the
  others are flat brass with dark numerals. (Arrival is index 0 and non-scoring
  — keep it present and visibly non-scoring; label it `0` or `ARR`.)
- **Six category rows**, each a **long chamfered brass plate** with two screws
  on its left edge:
  - an **engraved brass line-art glyph** (~44px) — gear+droplet, clock+gear,
    scroll+cross, handshake, brain-circuit, caped figure;
  - a vertical hairline divider;
  - the label in cream heavy condensed, ~30px;
  - at the right, a **physical toggle**: a recessed capsule track. `ON` = amber
    glowing track, `ON` in dark type on the track, brass knob pushed right, glow
    spilling onto the plate. `OFF` = `--off-track` capsule, `OFF` in dim type,
    brass knob at left.
- **The punctuality row is one of the six**, inline, not a separate block above.
  Instead of a toggle it carries a **charge track**: a recessed capsule with a
  leading `–`, six small amber lamps, and then the **seventh socket as a larger
  ornate cog ring** with an amber rim that pulses at 6/7. Tiny engraved gauge
  ticks above and below the track, with a caret marking the seventh. Beneath the
  track, right-aligned: `6 / 7 · 0.6` in mono amber. At 6/7 preview `0.6 → 1.0`.
- **Key rail** at the bottom: a brass bar with hooks. Awarded keys **hang from
  the hooks, lit and glowing**; empty hooks stay dark. The bar's right end is a
  chamfered tab reading `+ KEY`. A screw at each far end.

## Screen 06 — Big screen (`/display`)

Reference: `06-big-screen.jpg` (1920×1071, 16:9).

- Framed by a bezel with corner screws, on the same wall.
- **Top left:** a brass plate, chamfered bottom-right, `JUNKYARD REDEMPTION`
  huge cream over `SOL KIDS CAMP` small. **Top right:** the mirror of it,
  `DAY 2 · KINGDOM` over the day's theme.
- **Between them:** horizontal brass **key rails** with golden keys **hanging**
  from them, gold lightning crackling off the keys, positioned above the teams
  that hold them.
- **Eight columns**, laid out 4 · leader · 3 with the leader centered:
  - a **medallion** at the top;
  - a small **brass nameplate** with two screws, team name in tiny caps (wraps
    to two lines);
  - the score in large cream tabular numerals;
  - a **vertical segmented meter**: a recessed dark channel of discrete
    horizontal slots. Filled slots glow team color, bottom-up; the topmost slot
    may be a **half-width partial** for the fractional tenth. Empty slots are
    dark recesses with a faint rim.
  - the column body is a tall brushed plate with chamfered top corners;
  - a **brass footing plate** with two screws and a bright specular streak.
- **The leader column** is elevated above the others and carries **two brass
  contact-post brackets on each side** (a rectangular brass bracket with two
  screws, top and bottom, per side). **Teal arcs run the full height between the
  top and bottom bracket on both sides**, with dark cables looping from the
  lower brackets. The meter channel edges glow teal. Leader only — no arcs on
  any other column.

## Definition of done

A screenshot of each route, placed beside its reference, differs only in data
and in the roster (the concept art uses placeholder team names — ours come from
CLAUDE.md). Specifically:

- No screenshot reads blue-grey or flat dark brown. Plate faces sample in the
  `#6A5240`–`#98795E` band.
- Every glow traces to an emitter. Every arc terminates on two visible brass posts.
- One light direction, top left, on every screen.
- Screws, bevels, recesses and specular highlights are present on every plate.
- Row heights identical within a list; scores share a column edge; 8px grid.
- `npm test`, `npm run build`, `node scripts/validate-tokens.mjs`,
  `node scripts/check-motion.mjs` and `node scripts/check-dod.mjs` all pass.
