/*
 * The §10 acceptance criteria that only a running app can answer.
 *
 * The scoring half of that list is covered by unit tests (the ladder, integer
 * tenths, clamping, reversals, uncapped keys, the offline outbox, the workbook)
 * — those are cheaper and sharper as tests. What is left is everything about
 * what a leader can see and reach on a real screen: point values on every
 * control, the seventh socket being a different object, locked days being
 * visibly inert, and the role split actually holding in the UI.
 *
 * Usage: node scripts/check-acceptance.mjs   (dev server on :5173)
 *
 * The sign-in checks also spawn a throwaway second dev server with dummy
 * Supabase env, because in local mode (no backend) there is no sign-in
 * screen to test — `/#/signin` just redirects home. It picks its own free
 * port rather than a fixed one, since other agents' own dev servers are
 * routinely sitting on 5173-5175 in this repo.
 */
import { readFileSync } from 'node:fs'
import { execSync, spawn } from 'node:child_process'
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5173/junkyard-camp/'

let failures = 0
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — got ${actual}, expected ${expected}`}`)
}

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
// Pin the camp calendar to Day 1 (mirrors seed.ts's day1 date): the role and
// lock checks need exactly one open scoring day, which the real calendar
// does not provide on Arrival or after camp.
await page.addInitScript(() => localStorage.setItem('jr:setting:today', '2026-08-20'))

const goto = async (route) => {
  // A same-document hash change (`#/x` -> `#/x?y`) never remounts React, so a
  // mount-once demo seam like `?as=helper` (localUser() in src/data/auth.tsx)
  // would silently keep whatever role the page already had. Forcing a real
  // navigation every time is what makes goto() read the URL fresh.
  await page.goto('about:blank')
  await page.goto(BASE + route.replace(/^\//, ''), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}
const bodyText = () => page.evaluate(() => document.body.innerText)

/* ---- 1. Every control states its point value (§6.2) ---------------------- */

await goto('#/team/precious')
const sheet = await bodyText()
// innerText carries the CSS text-transform: uppercase these labels render
// with, so every regex against it has to be case-insensitive — it is
// checking what a leader sees on screen, not the casing of the JSX source.
check('team sheet: five binaries state 1.0 PT', (sheet.match(/1\.0 PT(?! EACH)/gi) ?? []).length, 5)
check('team sheet: punctuality states its ladder', /0\.1 EACH · ALL 7 = 1\.0/i.test(sheet), true)
check('team sheet: keys state value and no limit', /1\.0 PT EACH · NO LIMIT/i.test(sheet), true)

/*
 * The header shows the arithmetic rather than one opaque number, so keys are
 * never hidden inside a total (§6.2).
 */
check('team sheet: total shown as base + keys = today', /=/.test(sheet) && /KEYS?/i.test(sheet), true)

/* ---- 2. Punctuality: one target, one meaning, always behind a confirm --- */

/*
 * This used to be seven invisible strips laid over the charge track, five of
 * them disabled at any moment — so five taps in seven landed on nothing, and a
 * tap on the plate itself (which is where a thumb goes) landed on a plain div.
 * What is asserted now is the replacement: the whole plate is one add target,
 * every press opens a confirmation that names the jump in sockets AND in
 * points, and the most recent check-in can be taken back off the same way.
 *
 * `precious` sits on 6 of 7 on Day 1 (src/data/seed.ts), which is the case
 * worth proving: the seventh is worth 0.4, so the dialog has to say 0.6 -> 1.0
 * out loud rather than leave it to be read off the ladder.
 */
const punct = await page.evaluate(() => {
  const add = [...document.querySelectorAll('button[aria-label]')].find((b) =>
    /^Add a check-in|^Punctuality — all/.test(b.getAttribute('aria-label') ?? ''),
  )
  const minus = [...document.querySelectorAll('button[aria-label]')].find((b) =>
    /^Remove the most recent check-in/.test(b.getAttribute('aria-label') ?? ''),
  )
  const r = add?.getBoundingClientRect()
  const m = minus?.getBoundingClientRect()
  return {
    label: add?.getAttribute('aria-label') ?? null,
    w: r ? Math.round(r.width) : 0,
    h: r ? Math.round(r.height) : 0,
    minusW: m ? Math.round(m.width) : 0,
    minusH: m ? Math.round(m.height) : 0,
    stale: [...document.querySelectorAll('button[aria-label]')].filter((b) =>
      /^(Check-in \d|Final check-in)/.test(b.getAttribute('aria-label') ?? ''),
    ).length,
  }
})
check('punctuality: no invisible per-socket buttons remain', punct.stale, 0)
check('punctuality: the add target names its state', /^Add a check-in — 6 of 7$/.test(punct.label ?? ''), true)
check(`punctuality: the whole plate is the target (${punct.w}x${punct.h})`, punct.w >= 330 && punct.h >= 56, true)
check(`punctuality: the most recent check-in can be removed (${punct.minusW}x${punct.minusH})`, punct.minusW >= 32 && punct.minusH >= 44, true)

await page.locator('button[aria-label^="Add a check-in"]').click()
await page.waitForTimeout(200)
const ask = await bodyText()
check('punctuality: a tap asks before it writes', /add check-in\?/i.test(ask), true)
check('punctuality: the confirmation names the socket jump', /6 of 7 → all 7/i.test(ask), true)
check('punctuality: …and the 0.6 → 1.0 cliff behind it', /0\.6 → 1\.0/.test(ask), true)
// Cancel: an acceptance run must not leave an award in the seeded log.
await page.locator('button:has-text("Cancel")').click()
await page.waitForTimeout(200)

/* ---- 2b. The day rail is a readout inside a detail screen -------------- */

/*
 * Day selection belongs to the board. Once a leader has clicked into a team,
 * changing the date under them is a way to award a point to the wrong day
 * without noticing — so the rail still SAYS which day is being scored and
 * nothing on it is reachable.
 */
const railHere = await page.evaluate(() => ({
  tabs: document.querySelectorAll('[role="tablist"] [role="tab"]').length,
  pressable: document.querySelectorAll('[role="tablist"] button').length,
}))
check('team sheet: the day rail still shows five days', railHere.tabs, 5)
check('team sheet: …and none of them is a control', railHere.pressable, 0)

/* ---- 2c. One back control, one size, on every screen that has one ------ */

/*
 * It was a 46x44 tab here, a 44x44 chevron on standings, a 42x24 rocker on
 * roll call and a 9px text label on the menu. This is pressed between every
 * award, one-handed, by someone facing a room.
 */
const backSize = async (route) => {
  await goto(route)
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('button[aria-label]')].find((x) =>
      /^Back/.test(x.getAttribute('aria-label') ?? ''),
    )
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
}
for (const route of ['#/team/precious', '#/call/good_deed', '#/standings', '#/menu', '#/audit']) {
  const b = await backSize(route)
  check(
    `${route} back control is at least 64x56 (${b ? `${b.w}x${b.h}` : 'missing'})`,
    Boolean(b) && b.w >= 64 && b.h >= 56,
    true,
  )
}

/* ---- 2d. The key ceremony is gone from the live flow ------------------- */

/*
 * A key is one press on the team sheet's rail now, undoable for a minute.
 * Nothing routes to `/key/:teamId` any more and the screen no longer exists,
 * so this proves the board's key control lands on the team sheet instead of a
 * blank route.
 */
await goto('/')
await page.locator('button[aria-label*="Golden keys for"]').first().click()
await page.waitForTimeout(400)
const afterKeyTap = await page.evaluate(() => location.hash)
check(`board: the key count opens the team sheet (${afterKeyTap})`, /^#\/team\//.test(afterKeyTap), true)

/* ---- 3. Only today is editable; other days are visibly locked ---------- */

await goto('/')
const rail = await page.evaluate(() =>
  [...document.querySelectorAll('[role="tablist"] button')].map((b) => ({
    label: b.getAttribute('aria-label') ?? '',
    selected: b.getAttribute('aria-selected') === 'true',
  })),
)
check('day rail carries five days', rail.length, 5)

/*
 * Stated as the rule rather than as a count, because the count moves: before
 * camp the first scoring day stands in for today, during camp it is whichever
 * day matches, and after camp nothing is editable at all. What must hold
 * throughout is that exactly one scoring day is open and it is the one on
 * screen — Arrival never scores, so it is neither open nor padlocked.
 */
const scoringTabs = rail.filter((d) => !/no scoring/i.test(d.label))
const openTabs = scoringTabs.filter((d) => !/locked/i.test(d.label))
check('exactly one scoring day is open', openTabs.length, 1)
check('the open day is the one being viewed', openTabs[0]?.selected, true)
check(
  `every other scoring day is padlocked (${scoringTabs.length - 1})`,
  scoringTabs.filter((d) => /locked/i.test(d.label)).length,
  scoringTabs.length - 1,
)

// Open a locked day and confirm the controls are inert, not merely styled.
// activeDayId is React state owned by StoreProvider, which wraps every route
// under '/*' (App.tsx) — an in-SPA navigation carries it across, but a
// page.goto() reload remounts the provider and throws the selection away,
// landing back on today. So the team sheet is reached by clicking its
// board-row link, not by reloading the href it points to.
//
// Skipping the selected tab keeps this honest whatever the calendar says: the
// day on screen is the editable one, so the day picked here is inert by
// construction rather than by assuming which date happens to be today.
const lockedIdx = rail.findIndex((d) => /locked/i.test(d.label) && !d.selected)
await page.locator('[role="tablist"] button').nth(lockedIdx).click()
await page.waitForTimeout(400)
await page.locator('a[href*="#/team/"]').first().click()
await page.waitForTimeout(400)
const lockedSheet = await bodyText()
check('locked day announces itself on the team sheet', /locked — view only/i.test(lockedSheet), true)
const liveControls = await page.evaluate(
  () => [...document.querySelectorAll('button')].filter((b) => !b.disabled && /check-in/i.test(b.getAttribute('aria-label') ?? '')).length,
)
check('locked day: no check-in is reachable', liveControls, 0)

/* ---- 4. The role split holds in the UI (RLS covers the server) --------- */

await goto('#/team/precious')
const asDirector = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    /award a golden key/i.test(x.getAttribute('aria-label') ?? ''),
  )
  return { present: !!b, disabled: !!b?.disabled }
})
check('director: the key control is present', asDirector.present, true)
check('director: the key control is live', asDirector.disabled, false)

// `?as=helper` is read once on mount (localUser() in src/data/auth.tsx), so
// this only actually downgrades the role because goto() now forces a real
// navigation to get here — see the comment on goto() above.
await goto('#/team/precious?as=helper')
const asHelper = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    /award a golden key/i.test(x.getAttribute('aria-label') ?? ''),
  )
  return { present: !!b, disabled: !!b?.disabled, tagged: /director/i.test(document.body.innerText) }
})
// Visible-but-disabled, never hidden: a helper should understand the mechanic
// exists and is not theirs (§6.2).
check('helper: the key control is still visible', asHelper.present, true)
check('helper: the key control is disabled', asHelper.disabled, true)
check('helper: it is tagged DIRECTOR', asHelper.tagged, true)

await goto('#/menu?as=helper')
// innerText renders through CSS text-transform: uppercase, so the source's
// "Helper" (Menu.tsx) reads on screen as "HELPER".
check('helper: the menu says Helper', /helper/i.test(await bodyText()), true)

/*
 * ---- 4b. awardKey() refuses a helper on its own, not just via the button --
 *
 * `awardKey` now returns early `if (!isDirector)` (src/data/store.tsx), a
 * second guard behind the disabled control above — for exactly the case
 * where a broken render, a stale build, or devtools reaches it directly.
 * That is the one thing the checks above cannot prove, and there is no UI
 * path left to click that would prove it either: a helper's key control on
 * the rail is `disabled`, so Playwright cannot dispatch a click through it
 * at all. So this reaches the store the same way devtools tampering would:
 * through the
 * React fiber tree from any rendered node, calling awardKey() directly
 * rather than through a click that never lands on it.
 */
const EVENTS_KEY = 'jr:events:v3'
const liveKeyCount = (teamId) =>
  page.evaluate(
    ({ teamId, EVENTS_KEY }) => {
      const all = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]')
      const reversed = new Set(all.filter((e) => e.reversesEventId).map((e) => e.reversesEventId))
      return all.filter(
        (e) => e.teamId === teamId && e.categoryId === 'golden_key' && !e.reversesEventId && !reversed.has(e.id),
      ).length
    },
    { teamId, EVENTS_KEY },
  )
const callAwardKey = (teamId, note) =>
  page.evaluate(
    ({ teamId, note }) => {
      const btn = document.querySelector('button')
      if (!btn) return { called: false, reason: 'no element to walk fibers from' }
      const fiberKey = Object.keys(btn).find((k) => k.startsWith('__reactFiber$'))
      if (!fiberKey) return { called: false, reason: 'no react fiber key found' }
      let fiber = btn[fiberKey]
      let store = null
      let depth = 0
      while (fiber && depth < 100) {
        const v = fiber.memoizedProps && fiber.memoizedProps.value
        if (v && typeof v.awardKey === 'function') {
          store = v
          break
        }
        fiber = fiber.return
        depth++
      }
      if (!store) return { called: false, reason: 'store context not found walking fibers' }
      return store.awardKey(store.activeDay.id, teamId, note).then(() => ({ called: true }))
    },
    { teamId, note },
  )

const originalEventsRaw = await page.evaluate((k) => localStorage.getItem(k), EVENTS_KEY)
try {
  await goto('#/team/precious?as=helper')
  const beforeHelper = await liveKeyCount('precious')
  const helperCall = await callAwardKey('precious', 'acceptance guard probe')
  check('awardKey() guard probe actually reaches the store (helper)', helperCall.called, true)
  const afterHelper = await liveKeyCount('precious')
  check(
    `helper: awardKey() itself refuses, not just the button (${beforeHelper} -> ${afterHelper})`,
    afterHelper,
    beforeHelper,
  )

  // Control: without this, the check above would pass for the boring reason
  // that the call never lands at all rather than because the guard fired.
  await goto('#/team/precious')
  const beforeDirector = await liveKeyCount('precious')
  const directorCall = await callAwardKey('precious', 'acceptance guard probe')
  check('awardKey() guard probe actually reaches the store (director)', directorCall.called, true)
  const afterDirector = await liveKeyCount('precious')
  check(
    `director control: the same call appends exactly one event (${beforeDirector} -> ${afterDirector})`,
    afterDirector - beforeDirector,
    1,
  )
} finally {
  // Append-only log: restore the storage key rather than trying to delete
  // the row the director-control call just wrote.
  await page.evaluate(
    ({ k, v }) => (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v)),
    { k: EVENTS_KEY, v: originalEventsRaw },
  )
}

/* ---- 5. Lever rest and fired are unmistakably different ---------------- */

await goto('#/call/good_deed')
const grip = () =>
  page.evaluate(() => {
    const el = document.querySelector('[role="slider"][aria-label="Commit lever"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return Math.round(r.top)
  })
const restTop = await grip()
check('the lever is on the roll call', restTop !== null, true)
if (restTop !== null) {
  // Arm it: the pointer handler returns early with nothing queued
  // (Lever.tsx `dead`), so a row has to be selected first. Most of day1's
  // good_deed is already seeded (data/seed.ts) — only GEMS is still open —
  // so filter to whichever row is still enabled rather than assume row 0:
  // that row (WARRIORS) is already scored and disabled, and a click on a
  // disabled native <button> is a no-op, which is why nothing ever armed.
  await page.locator('button[aria-pressed]:not([disabled])').first().click()
  await page.waitForTimeout(200)
  const track = await page.evaluate(() => {
    const el = document.querySelector('[role="slider"][aria-label="Commit lever"]')
    return Math.round(el?.parentElement?.getBoundingClientRect().height ?? 0)
  })
  // Drive it with a real pointer gesture. The grip only answers pointer
  // events — the dispatched KeyboardEvent('End') this replaces is not a key
  // onKeyDown ever handles (only the arrows and Enter/Space are), and a
  // single ArrowDown is only 0.25 of 1.0 travel anyway, short of the 0.6 arm
  // threshold either way.
  const box = await page.locator('[role="slider"][aria-label="Commit lever"]').boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 150, { steps: 12 })
    await page.mouse.up()
  }
  // Sample promptly: the grip seats on fire and then springs back after
  // SEAT_HOLD_MS (520ms in Lever.tsx), so waiting past that would measure
  // the return animation rather than the seated state §6.3 is about.
  await page.waitForTimeout(250)
  const firedTop = await grip()
  const travel = Math.abs((firedTop ?? 0) - restTop)
  // Rest is the grip above the emitter, fired is below it — the fault this
  // replaces was a grip that stopped level with the cylinder, so "fired"
  // looked like "at rest with sparks added" (§6.3).
  check(`lever travel is a large fraction of the track (${travel}px of ${track}px)`, travel > track * 0.3, true)
}

/* ---- 6. Sign-in asks for a username, never an email ------------------- */

// Local mode has nothing to sign in to, so the route itself is the guard:
// SignIn redirects home rather than rendering a form nobody could ever
// submit (`backed` is false without Supabase env — src/data/auth.tsx). That
// is correct behaviour, not an empty form, so it earns its own assertion
// instead of the old zero-inputs reading as two failures.
await goto('#/signin')
const localSignin = await page.evaluate(() => location.hash)
check('sign-in redirects to the board in local mode (no backend)', localSignin, '#/')

// Prove the sign-in screen itself against a second instance with a backend
// configured, since the primary server never renders it. This also proves
// the app does not crash when Supabase is configured but unreachable — a
// real risk on camp wifi.
let signinStarted = false
let signin = { count: 0, types: [], text: '' }
let devServer = null
let devServerErr = ''
try {
  // Other agents routinely leave their own dev servers sitting on 5173-5175
  // in this repo — and a stray gates-mode server has been seen parked on
  // 5180, which a fetch here would mistake for our own instance (it answers
  // before the child's strictPort failure is noticed). Try a small spread
  // clear of both ranges and let --strictPort tell us plainly when one is
  // taken.
  for (const port of [5190, 5191, 5192, 5193, 5194]) {
    devServerErr = ''
    devServer = spawn(
      'npm',
      ['run', 'dev', '--', '--port', String(port), '--strictPort'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          VITE_SUPABASE_URL: 'https://example.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'dummy-anon-key',
        },
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )
    devServer.stderr?.on('data', (d) => {
      devServerErr += d.toString()
    })
    devServer.on('error', (err) => {
      devServerErr += String(err)
    })

    const signinBase = `http://localhost:${port}/junkyard-camp/`
    const deadline = Date.now() + 10_000
    let up = false
    while (Date.now() < deadline && devServer.exitCode === null) {
      try {
        const res = await fetch(signinBase)
        if (res.ok) {
          up = true
          break
        }
      } catch {
        // not answering yet
      }
      await new Promise((r) => setTimeout(r, 300))
    }

    if (up) {
      const signinPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
      // domcontentloaded rather than networkidle: a Supabase client pointed
      // at an unreachable project keeps retrying in the background, which
      // would otherwise hold the page from ever going network-idle.
      await signinPage.goto(signinBase + '#/signin', { waitUntil: 'domcontentloaded' })
      await signinPage.waitForSelector('input', { timeout: 10_000 }).catch(() => {})
      await signinPage.evaluate(() => document.fonts.ready)
      await signinPage.waitForTimeout(300)
      signin = await signinPage.evaluate(() => {
        const inputs = [...document.querySelectorAll('input')]
        return {
          count: inputs.length,
          types: inputs.map((i) => i.type),
          text: document.body.innerText,
        }
      })
      await signinPage.close()
      signinStarted = true
      break
    }
    // this port didn't pan out — clear it before trying the next
    if (devServer.pid) {
      try {
        process.kill(-devServer.pid, 'SIGTERM')
      } catch {
        devServer.kill()
      }
    }
    devServer = null
  }

  if (!signinStarted) {
    console.log(
      `SKIP sign-in form checks — no dummy-backed dev server came up on 5190-5194${
        devServerErr ? ` (${devServerErr.trim().slice(0, 200)})` : ''
      }`,
    )
  }
} finally {
  if (devServer?.pid) {
    try {
      process.kill(-devServer.pid, 'SIGTERM')
    } catch {
      devServer.kill()
    }
  }
}

if (signinStarted) {
  check('sign-in has two fields', signin.count, 2)
  check('sign-in takes a password', signin.types.includes('password'), true)
  // §5.4: usernames get @junkyard.camp appended by the app — nobody types an
  // email, so the word must not appear even as a placeholder or a label.
  check('sign-in never asks for an email', /email/i.test(signin.text), false)
  check('sign-in offers no sign-up or reset', /sign.?up|forgot|reset/i.test(signin.text), false)
}

/* ---- 7. Board shows today's points and overall, distinctly ------------- */

await goto('/')
const board = await bodyText()
check('board labels today and overall', /today/i.test(board) && /overall|camp/i.test(board), true)

/* ---- 8. No horizontal scroll or multiplier on the menu screens --------- */

for (const route of ['#/menu', '#/exports', '#/audit', '#/signin']) {
  await goto(route)
  const w = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }))
  check(`${route} no horizontal scroll (${w.doc} <= ${w.win})`, w.doc <= w.win, true)
  const mult = await page.evaluate(() => /[×✕✖]\s*\d/.test(document.body.innerText))
  check(`${route} no multiplier notation`, mult, false)
}

await browser.close()

/* ---- 9. The service-role key is nowhere in the repo or the bundle ------ */

const tracked = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n')
const leaks = tracked.filter((f) => {
  if (/^(users\.example\.json|scripts\/seed-users\.mjs|supabase\/|\.env\.example)/.test(f)) {
    // these legitimately name the variable; what matters is no literal key
  }
  let body = ''
  try {
    body = readFileSync(f, 'utf8')
  } catch {
    return false
  }
  // a real service-role JWT is a three-part token whose payload names the role
  return /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(body)
})
check(`no JWT literal in any tracked file${leaks.length ? ` (${leaks.join(', ')})` : ''}`, leaks.length, 0)

let bundleLeak = 0
try {
  const dist = execSync('ls dist/assets/*.js 2>/dev/null || true', { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  for (const f of dist) {
    const body = readFileSync(f, 'utf8')
    if (/service_role|SERVICE_ROLE/.test(body)) bundleLeak++
  }
  check(`no service-role reference in the client bundle (${dist.length} chunk(s) scanned)`, bundleLeak, 0)
} catch {
  console.log('SKIP bundle scan — no dist/, run npm run build first')
}

console.log(
  failures === 0
    ? '\nEvery acceptance criterion a running app can prove holds'
    : `\n${failures} acceptance check(s) failed`,
)
process.exit(failures === 0 ? 0 : 1)
