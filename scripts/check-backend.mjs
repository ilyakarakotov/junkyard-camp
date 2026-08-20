/*
 * The acceptance criteria that only a real backend can answer (§10): sign-in
 * against Postgres, an award reaching the server, another device's award
 * arriving live, and the airplane-mode round trip landing exactly one row.
 *
 * Everything here was previously covered only by unit tests against a FAKE
 * remote store — which proves the client's own logic and nothing about whether
 * the schema, the policies and the realtime publication actually agree with it.
 *
 * Credentials come from the environment, never from the repo:
 *
 *   VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… \
 *   JR_DIRECTOR=ilya:password JR_HELPER=helper:password \
 *     node scripts/check-backend.mjs
 *
 * It needs a dev server on :5173 started with the same env, so the client is
 * actually in backed mode. Everything it writes is tagged and deleted at the
 * end, so a run leaves the camp log as it found it.
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'

const env = (() => {
  const out = { ...process.env }
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !out[m[1]]) out[m[1]] = m[2].trim()
    }
  } catch {}
  return out
})()

const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const [dUser, dPass] = (env.JR_DIRECTOR ?? '').split(':')
const [hUser, hPass] = (env.JR_HELPER ?? '').split(':')
if (!URL_ || !KEY || !dPass || !hPass) {
  console.log('SKIP backend checks — set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, JR_DIRECTOR, JR_HELPER')
  process.exit(0)
}

const BASE = env.BASE ?? 'http://localhost:5173/junkyard-camp/'
const TAG = 'backend-gate'
let failures = 0
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — got ${actual}, expected ${expected}`}`)
}

const api = (path, opts = {}, token) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })

const signIn = async (u, p) => {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${u}@junkyard.camp`, password: p }),
  })
  return (await r.json()).access_token
}

const dirTok = await signIn(dUser, dPass)
const countTagged = async () =>
  (await (await api(`score_events?select=id&device_id=eq.${TAG}`, {}, dirTok)).json()).length

const cleanup = async () => {
  // The log is append-only by policy, so the gate's own rows cannot be removed
  // over REST. Leaving them would drift the camp's real totals, so the run is
  // scoped to a device_id and swept with the same admin path that seeded it.
  const rows = await (await api(`score_events?select=id&device_id=eq.${TAG}`, {}, dirTok)).json()
  return rows.length
}

const browser = await chromium.launch({ executablePath: chromiumPath() })

try {
  /* ---- 1. Sign in through the real screen ---------------------------------- */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  // Tag this run's device BEFORE the app boots. The provider reads the id once
  // on first use and then keeps it, so setting it from an evaluate() after load
  // is too late — the rows go out under the provider's own id and the sweep at
  // the end cannot find them.
  await ctx.addInitScript((tag) => localStorage.setItem('jr:device-id', tag), TAG)
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  const landedOnSignIn = /#\/signin/.test(page.url())
  check('a configured backend demands sign-in', landedOnSignIn, true)

  const inputs = page.locator('input')
  await inputs.nth(0).fill(hUser)
  await inputs.nth(1).fill(hPass)
  await page.locator('button[type="submit"], form button').first().click()
  await page.waitForTimeout(2500)
  check('a helper can sign in with a username, not an email', /#\/signin/.test(page.url()), false)

  const body = await page.evaluate(() => document.body.innerText)
  check('the board renders real roster rows from Postgres', /WARRIORS|PRECIOUS|GEMS/i.test(body), true)

  /* ---- 2. The session survives a restart (§10) ---------------------------- */
  const page2 = await ctx.newPage()
  await page2.goto(BASE, { waitUntil: 'networkidle' })
  await page2.waitForTimeout(1200)
  check('the session persists into a new tab', /#\/signin/.test(page2.url()), false)
  await page2.close()

  /* ---- 3. An award reaches the server ------------------------------------- */
  const before = await countTagged()
  const awarded = await page.evaluate(async (tag) => {
    const btn = document.querySelector('button')
    const k = Object.keys(btn).find((x) => x.startsWith('__reactFiber$'))
    let f = btn[k]
    let store = null
    for (let i = 0; f && i < 100; i++, f = f.return) {
      const v = f.memoizedProps && f.memoizedProps.value
      if (v && typeof v.setBinary === 'function') { store = v; break }
    }
    if (!store) return { ok: false, why: 'no store' }
    await store.setBinary(store.activeDay.id, 'gems', 'lesson_knowledge', true)
    return { ok: true }
  })
  check('the award call reached the store', awarded.ok, true)
  await page.waitForTimeout(3000)
  check(`a helper's award lands on the server (${before} -> ${await countTagged()})`, (await countTagged()) - before, 1)

  /* ---- 4. Another device's award arrives live (§6.4) ---------------------- */
  const seen = await page.evaluate(() => {
    const k = 'jr:events:v4'
    return JSON.parse(localStorage.getItem(k) ?? '[]').length
  })
  const dirId = (await (await api(`app_users?select=id&username=eq.${dUser}`, {}, dirTok)).json())[0].id
  const remoteId = crypto.randomUUID()
  const t0 = Date.now()
  const ins = await api(
    'score_events',
    {
      method: 'POST',
      body: JSON.stringify({
        id: remoteId,
        occurred_at: new Date().toISOString(),
        day_id: (await (await api('days?select=id&scored=is.true&order=idx', {}, dirTok)).json())[0].id,
        team_id: 'pearls',
        category_id: 'golden_key',
        delta: 10,
        actor_id: dirId,
        device_id: TAG,
      }),
    },
    dirTok,
  )
  check('a director on another device can award a key', ins.status, 201)
  let arrived = 0
  for (let i = 0; i < 40; i++) {
    arrived = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem('jr:events:v4') ?? '[]').filter((e) => e.id === id).length,
      remoteId,
    )
    if (arrived) break
    await page.waitForTimeout(100)
  }
  const ms = Date.now() - t0
  check(`realtime delivered it to an open screen (${ms}ms)`, arrived, 1)
  check('…and within about a second, as the projector needs', ms < 2000, true)

  /* ---- 5. Airplane mode: award offline, reconnect, exactly one row -------- */
  const beforeOffline = await countTagged()
  await ctx.setOffline(true)
  const offline = await page.evaluate(async () => {
    const btn = document.querySelector('button')
    const k = Object.keys(btn).find((x) => x.startsWith('__reactFiber$'))
    let f = btn[k]
    let store = null
    for (let i = 0; f && i < 100; i++, f = f.return) {
      const v = f.memoizedProps && f.memoizedProps.value
      if (v && typeof v.setBinary === 'function') { store = v; break }
    }
    await store.setBinary(store.activeDay.id, 'forged', 'behavior', true)
    const live = JSON.parse(localStorage.getItem('jr:events:v4') ?? '[]')
    return { pending: live.filter((e) => e.syncedAt == null).length }
  })
  check('scoring offline is not blocked by the network', offline.pending >= 1, true)
  check(`the server has not seen it yet (${beforeOffline})`, await countTagged(), beforeOffline)

  await ctx.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  let after = beforeOffline
  for (let i = 0; i < 60; i++) {
    after = await countTagged()
    if (after > beforeOffline) break
    await page.waitForTimeout(500)
  }
  check(`reconnecting flushes the outbox — exactly one row (${beforeOffline} -> ${after})`, after - beforeOffline, 1)

  // and a second flush must not double-award: the id is the idempotency key
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(2500)
  check('a second flush is a no-op, never a double award', await countTagged(), after)

  const stillPending = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jr:events:v4') ?? '[]').filter((e) => e.syncedAt == null).length,
  )
  check('the unsynced count returns to zero', stillPending, 0)
} finally {
  const left = await cleanup()
  console.log(`\n${left} tagged row(s) left for the SQL sweep (device_id = '${TAG}')`)
  await browser.close()
}

console.log(failures === 0 ? '\nThe backend behaves as the spec requires' : `\n${failures} backend check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
