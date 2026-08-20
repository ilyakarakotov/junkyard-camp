// Screenshots every route and asserts the material statistics land inside the
// band measured off the concept art. A screenshot can look plausible in
// isolation and still be three stops too dark next to the reference; this is
// the gate that catches that without a human in the loop.
//
// Usage: node scripts/check-material.mjs [--verbose]
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'
import { failures, measure, THRESHOLDS } from './material-stats.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5173/junkyard-camp/'
const verbose = process.argv.includes('--verbose')

const ROUTES = [
  { route: '/', label: 'board', viewport: [390, 844], full: true },
  { route: '#/call/punctuality', label: 'roll call', viewport: [390, 844], full: true },
  { route: '#/team/rustco', label: 'team sheet', viewport: [390, 844], full: true },
  { route: '#/standings', label: 'standings', viewport: [390, 844], full: true },
  // Phase 7 additions (§6.5-6.7): shipped without a v2 concept render, so
  // nothing was gating them and they were free to drift dark.
  { route: '#/menu', label: 'menu', viewport: [390, 844], full: true },
  { route: '#/exports', label: 'exports', viewport: [390, 844], full: true },
  { route: '#/audit', label: 'audit log', viewport: [390, 844], full: true },
  { route: '#/display', label: 'big screen', viewport: [1920, 1080], full: false },
]

const browser = await chromium.launch({ executablePath: chromiumPath() })
let failed = 0

console.log(
  `bands: warmth ${THRESHOLDS.warmth.join('..')}  medianL ${THRESHOLDS.medianL.join('..')}  ` +
    `midtone% ${THRESHOLDS.midtone.join('..')}  specular% ${THRESHOLDS.specular.join('..')}\n`,
)

for (const spec of ROUTES) {
  const page = await browser.newPage({
    viewport: { width: spec.viewport[0], height: spec.viewport[1] },
    deviceScaleFactor: 2,
  })
  // Pin the camp calendar to Day 1 (mirrors seed.ts's day1 date) so the
  // day-scoped routes render a scored, seeded day whatever the real date is —
  // on Arrival they would otherwise show the unscored day and measure dark.
  await page.addInitScript(() => localStorage.setItem('jr:setting:today', '2026-08-20'))
  if (spec.set) {
    await page.addInitScript((pairs) => {
      for (const p of pairs) {
        const i = p.indexOf('=')
        localStorage.setItem(p.slice(0, i), p.slice(i + 1))
      }
    }, spec.set)
  }
  await page.goto(BASE + spec.route.replace(/^\//, ''), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  // Capture-time knob, not a threshold: the big screen is a 3840x2160 frame at
  // dpr 2 and encoding it takes a little over Playwright's default 30s on a
  // small container, which failed the run before a single statistic had been
  // measured. Nothing about what is asserted changes.
  const buf = await page.screenshot({ fullPage: spec.full, timeout: 120_000 })
  const stats = await measure(page, `data:image/png;base64,${buf.toString('base64')}`)
  const bad = failures(stats)
  if (bad.length) failed++
  console.log(
    `${bad.length ? 'FAIL' : 'PASS'} ${spec.label.padEnd(13)} ` +
      `warmth ${String(stats.warmth).padStart(5)}  medL ${String(stats.medianL).padStart(3)}  ` +
      `midtone ${String(stats.midtone).padStart(5)}%  spec ${String(stats.specular).padStart(5)}%` +
      (verbose ? `  mean ${stats.mean.join(',')}` : ''),
  )
  for (const b of bad) console.log(`       → ${b}`)
  await page.close()
}

await browser.close()
if (failed) {
  console.error(`\n${failed} route(s) outside the reference material band`)
  process.exit(1)
}
console.log('\nMaterial matches the reference band on every route')
