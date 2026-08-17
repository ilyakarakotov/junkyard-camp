// End-to-end: does pulling the lever actually commit the column, and does
// undo actually walk it back? Exercises the real event log, not a mock.
// Usage: node scripts/check-commit-flow.mjs
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5173/junkyard-camp/'
const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

let failures = 0
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — got ${actual}, expected ${expected}`}`)
}
const liveCount = () =>
  page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('jr:events:v3') ?? '[]')
    const reversed = new Set(all.filter((e) => e.reversesEventId).map((e) => e.reversesEventId))
    return all.filter((e) => !e.reversesEventId && !reversed.has(e.id)).length
  })

// good_deed on Day 1 has exactly one team outstanding (GEMS) in the seed.
await page.goto(BASE + '#/call/good_deed', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)

const before = await liveCount()

const selectable = page.locator('button[aria-pressed]:not([disabled])')
const n = await selectable.count()
check(`exactly one team outstanding for GOOD DEED`, n, 1)
await selectable.first().click()
await page.waitForTimeout(150)
check('lever reports one pending team', await page.locator('text=/PULL TO COMMIT · 1 TEAM\\b/').count(), 1)

// Pull the lever the whole way and release.
const grip = page.locator('[role="slider"]').first()
await grip.scrollIntoViewIfNeeded()
const box = await grip.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
for (let i = 1; i <= 8; i++) await page.mouse.move(cx, cy + (176 * 0.95 * i) / 8)
await page.mouse.up()
await page.waitForTimeout(600)

const after = await liveCount()
check(`commit appended exactly one live event (${before} -> ${after})`, after - before, 1)
check('undo bar is offered', await page.locator('text=/committed ·/').count(), 1)

// Undo appends a compensating event and returns the live count to baseline.
await page.locator('text=Undo').first().click()
await page.waitForTimeout(400)
const undone = await liveCount()
check(`undo returns live count to baseline (${undone})`, undone, before)

const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('jr:events:v3') ?? '[]').length)
check(`log is append-only — nothing deleted (${raw} rows on disk)`, raw >= before + 2, true)

await browser.close()
if (failures > 0) {
  console.error(`\n${failures} commit-flow check(s) failed`)
  process.exit(1)
}
console.log('\nCommit flow verified end to end')
