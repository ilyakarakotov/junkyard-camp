# Start here

Read `HANDOFF-QWEN.md` in this repo, then `CLAUDE.md`. `CLAUDE.md` is the
design law and overrides the handoff wherever they disagree.

`HANDOFF-QWEN.md` is a prioritised list of 26 audited UX defects, each with
the file and line it was found at. Work them in the order given at the bottom
of that document.

**Start with section A, items 1–9** — native app feel: pinch and double-tap
zoom, the 14px sign-in inputs that trigger iOS focus-zoom, rubber-band bounce,
`touch-action` on the lever drag, long-press text selection, safe-area insets,
`svh` on the screens meant to be locked, the apple-touch-icon PNG, and the web
manifest. That is the owner's complaint that touches every screen, so it ships
first.

## Rules

- Do **not** lock the document with `position: fixed` on `body`. Section A
  lists which screens legitimately scroll and must keep scrolling.
- Verify every claim against the actual code before editing — line numbers
  drift.
- When section A is done, run `npm run verify`, and push to `main` **only if
  it is green**. A push deploys to the live site the camp director is testing
  on a phone today.
- Two routes (roll call, team sheet) already fail the material gate before you
  change anything. That is item 26 and is expected — do not treat it as your
  regression, and do not make it worse.
- Never touch `src/data/scoring.ts` or the append-only semantics of the event
  log.
- There is a test mode at `#/test` that gives you a throwaway sandbox with
  sample data. Use it rather than scoring the real log.
- Several vite dev servers are already running on ports 5173–5180. Check
  before starting another. Browser gates need a local-mode server, started
  with `npm run dev:gates`.

After section A, continue: item 22, then 20 and 21, then 10, 11 and 13, then
the rest.
