# Handoff — UX and feel pass

Written 2026-08-19. Camp Arrival is **today**; Day 1 scores tomorrow. The app
is functionally complete and live at
https://ilyakarakotov.github.io/junkyard-camp/ — this pass is about how it
*feels*, not what it does.

Read `CLAUDE.md` first. It is law. Where it and this document disagree,
`CLAUDE.md` wins. `design/BUILD-SPEC.md` §10 holds the acceptance criteria the
app already meets; don't regress them.

## How to work here

```sh
npm run dev            # backed by the real Supabase (needs .env — it exists)
npm run dev:gates      # local-only mode, which every gate below needs
npm run verify         # tests + build + every check. This must pass before you push.
```

Every browser gate expects a dev server on `:5173`, or `BASE=` pointing at
another port. Several dev servers may already be running — check before
starting another.

Rules of engagement:

- Work on `main`, commit in coherent slices, and **push only after
  `npm run verify` is green**. A push to `main` deploys to the live site,
  which the camp director is testing on a phone.
- Never widen a fix into a rewrite. Each item below is scoped.
- The material gate currently fails two routes **before you touch anything**:
  `roll call` (specular 0.55, floor 1.1) and `team sheet` (midtone 13.7, floor
  17; specular 1.02). That is pre-existing, and item 12 below. Do not "fix" it
  by painting a flat near-white bar across a plate — that exact cheat has been
  removed from this codebase three times. Specular% is the share of pixels with
  luminance > 205; earn it with real bevels and monotonic falloff. Read
  `scripts/material-stats.mjs` before you try.
- The one thing you must not break: `src/data/scoring.ts` and the append-only
  event log. Totals are derived, never stored. No floats. No deletes.

## Already done (do not redo)

Test mode shipped in `da42b14`. `/test`, director-only, swaps the data layer
for a sandbox log on a separate localStorage key. Use it — it is the fastest
way to get the app into a state worth looking at. Enter it, hit **Fill all
days**, and every screen has plausible data. In local mode it needs `?test=1`
on the URL (e.g. `#/test?test=1`); with the real backend it appears in the menu
for the director.

Do not make the gates depend on test mode, and do not add a menu item that
renders in local mode without the opt-in — the material gate's numbers were
measured against a six-item menu.

---

# The work, in priority order

Three audits produced this. Every line number was read, not guessed, but the
code moves — verify before you edit.

## A. Native feel — "it's scrollable and zoom-inable"

The owner's actual complaint. Highest priority because it is felt on every
screen, every tap.

**1. Pinch and double-tap zoom.** `index.html:5` sets no `maximum-scale` and no
`user-scalable`. In a Safari tab iOS ignores those, but this app declares
`apple-mobile-web-app-capable` and is used from the home screen, where iOS
honors them. Add `maximum-scale=1, user-scalable=no,
interactive-widget=resizes-content`, plus `html { touch-action: manipulation }`
in `src/theme.css` to kill double-tap zoom where `user-scalable` is ignored.

**2. Focus-zoom on sign-in, which never zooms back out.** `SignIn.tsx:83` and
`:98` set `fontSize: 14` on the two `<input>`s. iOS zooms the page for any
sub-16px input on focus and does not restore. This is very likely the "it
zoomed in and stayed there" the owner hit. Set 16px.

**3. Rubber-band bounce and pull-to-refresh.** `theme.css:100` puts
`overscroll-behavior: none` on `body` only. WebKit takes the viewport's
overscroll behavior from the **root** element. Add it to the `html` rule at
`theme.css:90` as well; keep it on `body`.

**4. The lever drag loses to native panning.** `Lever.tsx:906-925` uses
`setPointerCapture` but sets no `touch-action`. Pointer capture does not
suppress native scroll: the first vertical movement scrolls the document, the
browser fires `pointercancel`, and the pull dies. RollCall is ~815px tall at
390×844, so the lever always sits in a scrollable region. Add
`touchAction: 'none'` to the grip's style.

> **Superseded — the drag is gone.** `touchAction: 'none'` bought reliability
> but never enough of it, and leaders at camp kept losing awards to pulls that
> did not register. The whole housing is now one native `<button>` that commits
> on click. Nothing in the app is drag-committed any more, so the "let the one
> drag target claim its gesture" clause at the end of this section no longer
> applies — there is no drag target left to claim anything.

**5. Long-press selects text and pops the iOS callout.** No `user-select` or
`-webkit-touch-callout` anywhere in `src/`. Every team name and numeral is
selectable, so a long-press on a row gives a blue selection and a "Copy / Look
Up" sheet. In `theme.css @layer base`: `user-select: none` +
`-webkit-touch-callout: none` on `body`, with `input, textarea` excepted —
sign-in needs them.

**6. Safe-area insets are used in exactly one place.** `Standings.tsx:469` is
the only `env(safe-area-inset-*)` in the repo, while `viewport-fit=cover` plus
`black-translucent` puts content under the notch and home indicator.
`Board.tsx:329` renders its brass header under the clock; `SyncChrome.tsx:15`
parks the sync badge in the notch; RollCall's lever is the last element on the
page and sits in the home-indicator swipe zone — a **second** reason the drag
fails on a real phone. Put the insets on `#root` once in `theme.css`, and give
`SyncChrome` `top: calc(8px + env(safe-area-inset-top))`. (`TestModeChrome`
already does this — copy it.)

**7. Screens that should be locked wobble by exactly the toolbar height.**
`Menu.tsx:37/44`, `SignIn.tsx:49` and `AuditLog.tsx:60` do exact arithmetic
against `100dvh`, which grows when Safari's URL bar collapses. Use `100svh` for
Menu and SignIn, which are meant to fit.

**8. `AuditLog.tsx:175`** — nested scroller with no containment. Add
`overscrollBehavior: 'contain'`.

**Do not** "fix" this with `body { position: fixed; overflow: hidden }`. These
screens legitimately scroll and must keep scrolling: Standings (~1300px),
AuditLog, Exports, RollCall (~815px), Board (~790px), TeamSheet. These are
correctly locked already — leave them: BigScreen (`:206-208`), KeyCeremony
(`:437`). The correct treatment is: keep document scroll, kill the bounce, kill
the zoom, and let the one drag target claim its gesture.

**9. Home-screen icon and manifest.** `index.html:10` points
`apple-touch-icon` at an SVG; iOS accepts raster only, so the home-screen icon
is a screenshot of the page. Ship `public/apple-touch-icon.png` at 180×180.
There is also no web manifest at all, so Android's "Add to Home screen" makes a
browser shortcut instead of a standalone window — add
`public/manifest.webmanifest` with `display: "standalone"`, `start_url:
"/junkyard-camp/#/"`, `background_color`/`theme_color` `#16110D`.

## B. Golden keys — "adding keys is confusing"

The three that are almost certainly the whole complaint are 10, 11 and 12.

**10. There is no way to un-award a key. At all.** `store.tsx` has `setBinary`
(reverses on toggle-off), `removeCheckIn` and `undoBatch` — but `awardKey` has
no counterpart, and `StoreValue` declares no `removeKey`. A mis-tapped binary
is undone by tapping the same plate; a mis-tapped check-in by tapping the lit
socket. The one award worth 1.0, uncapped, that decides the camp is the only
one with no correction path. Add `removeKey(dayId, teamId)` mirroring
`removeCheckIn` — reverse the latest live `golden_key` event for that day and
team — and surface it as a long-press on the last lit key in `KeyHookRail`,
behind a confirm.

**11. Awarding a key makes it go *dark*.** `KeyCeremony.tsx:427` computes
`slots = live ? Math.max(existing,1) : existing + 1`, so the *offer* state
already draws the new key hanging lit. Committing only adds `.key-cool`, which
`theme.css:698-709` animates `opacity: 1 → 0`. Net: the screen looks the same
before and after except the gold key dims. Under `prefers-reduced-motion` it is
worse — `theme.css:715-722` snaps it to `opacity: 0` instantly and the plume is
suppressed, leaving 12px of nameplate text as the only confirmation. Invert it:
draw an **empty hook** in the offer state and ignite the new key on commit.
Award should read as a key appearing and lighting, not fading.

**12. No key affordance on the board.** `Board.tsx:620-750` renders rank,
crest, name, TODAY and OVERALL — no key glyph, no count, no way in. Keys are
folded silently into OVERALL. The only path to the ceremony in the entire app
is: board → team row → scroll to the bottom of the team sheet → an 85×29px
`+ KEY` tab. `Menu.tsx` doesn't mention keys either. `KeyCount` already exists
(`KeyRail.tsx:795`) — put it in each board row and make it a director-only tap
target routing to `/key/:teamId`.

**13. Double-tap awards two keys.** `KeyCeremony.tsx:411-415`: `onAward` is
async and `setPhase('awarded')` runs only after the await. The button is never
disabled in flight, and `store.tsx awardKey` has no idempotency guard (unlike
`setBinary`, which early-returns). Two taps, two keys, and per item 10 there is
no way back. Add a `busy` flag set synchronously before the await.

**14. No confirmation on an irreversible 1.0-point award.** One tap writes it.
Meanwhile *signing out* is gated behind `window.confirm` (`Menu.tsx:145`). The
app confirms the reversible thing and not the irreversible one. Add a
second-stage arm→commit, or a 60-second undo strip like RollCall's.

**15. "Turn to award" is a plain tap.** `KeyCeremony.tsx:1580-1624` fires
`onClick` immediately. There is no turning, dragging or holding, and the key
bow you'd instinctively grab is inside an `aria-hidden` svg with
`pointer-events: none`. The rest of the app trains the opposite expectation via
the Lever. Either make the label match the gesture or the gesture match the
label — a turn on the bow with spring-back per `CLAUDE.md` Motion.

**16. "KEY 02" is ambiguous and disagrees with the team sheet.**
`KeyCeremony.tsx:401` counts camp-wide (no `dayId`); `TeamSheet.tsx:197` counts
today only. Award on Day 1, open Day 2's sheet → "0 HELD", tap `+ KEY` → "KEY
02". The number also pre-increments before you press anything. Pick one scope
and label it — `KEY 02 OF THE CAMP`, and `2 HELD TODAY · 5 THIS CAMP` on the
sheet.

**17. The ceremony is clipped off-screen under ~750px tall.**
`KeyCeremony.tsx:436` is `min-h-dvh overflow-hidden` with every child
absolutely positioned at hard-coded Y (`ACTION_Y = 640`, `RAIL_TOP = 704`,
`H = 844`). Only width responds to resize. On an iPhone SE, or any browser with
visible URL chrome, the commit plate and the whole key rail are below the clip
with no scroll — the director sees the vault door and cannot award. Scale the
vertical stations by `viewportH / 844` alongside `dx`.

**18. The helper gate is invisible, and the rail doesn't dim on locked days.**
`TeamSheet.tsx:571` disables the tab, but the disabled styling is ~5% darker
brass — indistinguishable on a phone outdoors. The "Director" chip renders only
when `!isDirector`, so a *director* on a locked day gets a tab that looks live
and does nothing, with no reason given. Worse, `TeamSheet.tsx:437-438` applies
the locked dim to the category grid, which closes at `:520` — the key rail at
`:529` is a sibling and does not dim, so on a locked day the rail is the only
control that still looks alive. Move the rail inside the dim wrapper and always
render a reason on the tab: `DIRECTOR ONLY` or `DAY LOCKED`.

**19. Small ones.** A blocked helper reaching `/key/:teamId` is silently
redirected (`:404-407`); an unknown `teamId` returns a permanently blank div
(`:409`) with no way out. The `+ KEY` button's `aria-label` says "Award a
golden key" but it only navigates — a screen-reader user is told the key was
awarded. Its hit area is 85×29px, under the 44px minimum.
`KeyCeremony.tsx:412` hard-codes the note `'Golden key'` and never shows which
day it is writing to. And `Lab.tsx:36` renders `fired ${fired}×` — the one
literal `×` in the app's visible UI, which `CLAUDE.md` forbids.

## C. Electricity — "no electricity feel when points are given"

**20. The root cause: `ArcBolt` has no one-shot mode.** `fx/Arc.tsx:105-125` is
a self-restarting `setTimeout` loop that runs forever while `active !== false`.
No duration, no burst, no envelope, no `onComplete`. `intensity`/`chaos`/
`weight` are static per render. So nothing in the codebase can express "current
jumped **because** a point just landed" — every "discharge" is an always-on
flicker whose parameters got nudged. Add a burst envelope: fire, decay,
settle. Everything else here depends on it.

**21. The award-moment stages of the escalation ladder are the missing ones.**
`CLAUDE.md` specifies: idle flicker on roll call → full discharge on commit →
surge on the seventh check-in → leading row on standings → leading column on
the big screen. The two *ambient* stages work (`Standings.tsx:1074`,
`BigScreen.tsx:1032`). All three *award-moment* stages are missing, partial, or
inverted:

- **Commit** — `Lever.tsx:826-833` fires six arcs, but every one of them is
  inside the ~354×236 lever at the bottom of the screen. The eight rows that
  actually received points get a gradient wash and a rim light, no arc, no
  posts. `RollCall.tsx` imports only `usePrefersReducedMotion` from `fx/Arc`.
  The electricity is at the switch, not at the award. Also `Lever.tsx:291`
  turns the storm on while merely *armed and dragging*, pre-empting the
  commit's own punch.
- **Seventh check-in** — `RollCall.tsx:976-983` renders a plain white CSS disc.
  No arc. So the top of the ladder is visually *weaker* than the rung below it.
- **TeamSheet has no award feedback at all.** `TeamSheet.tsx:456` → `setBinary`
  → `Breaker` slides a paddle and swaps a gradient. No arc, no flash, no
  haptic. `TeamSheet.tsx` contains zero `useState`/`useEffect`, so it cannot
  know an award just happened. This is the flattest path in the app.

**22. Two finished one-shot mechanics are wired only to the component bench.**
Cheapest available win — do these first:

- `ChargeTrack.surging` (`ChargeTrack.tsx:26` → `:509`) — documented as "fires
  on reaching seven", passed only by `Lab.tsx:84`. `TeamSheet.tsx:710` omits
  it, so hitting the seventh check-in from the team sheet produces **nothing**.
  The cliff *anticipation* is implemented (`pulse-rim`, the `0.6 → 1.0`
  readout) — the app builds the tension and then delivers no payoff.
- `KeyRail.justAdded` (`KeyRail.tsx:23` → `:176`) — passed only by
  `Lab.tsx:112`. A key that lands is already cold when you get back.

**23. The key ceremony's gold storm runs before the award.**
`KeyCeremony.tsx` gates its six gold arcs on `active={!reduced || live}` and
`live` only nudges chaos 1.5→1.7 and weight 1.45→1.7. The plume and sparks are
`animation: infinite` gated on `hot`, not on `live`. The most important award
in the app is an ambient storm that gets ~15% hotter, not a strike.

**24. Haptics are nearly absent.** Three `navigator.vibrate` calls exist:
`Lever.tsx:215` (arming), `Lever.tsx:230` (fire), `KeyCeremony.tsx:414`. None
on a team-sheet binary, a check-in, the seventh-check-in surge, or undo. No
sound anywhere in `src/`. Note `navigator.vibrate` is a no-op on iOS Safari —
it must never be the *only* confirmation of anything.

Honour `prefers-reduced-motion` throughout: keep state changes and tube
ignition, drop arcs and token flight (`CLAUDE.md` Motion).

## D. Cleanup

**25. `Board.tsx:516`** uses `window.confirm()` for the day unlock. A native
alert reading "github.io says…" breaks the illusion harder than anything else
in this document. Replace with an in-app brass panel. (`Menu.tsx:145` and
`TestMode.tsx` also use `window.confirm` — same treatment, lower stakes.)

**26. The two pre-existing material-gate failures** described at the top.

---

## Suggested order

1. **A** in one pass — 1–8 are small, mechanical, and fix the complaint that
   touches every screen. 9 alongside.
2. **22** — two dead props, two lines each, immediate payoff.
3. **20**, then **21** — the arc burst envelope, then the three award moments
   that need it.
4. **10, 11, 13** — the key fixes that prevent an unrecoverable mistake.
5. **12, 14–19** — key discoverability and clarity.
6. **D**.

Ship 1–2 and push before starting 3; the camp director is testing on a phone
today and A alone will change how the whole app feels in their hand.
