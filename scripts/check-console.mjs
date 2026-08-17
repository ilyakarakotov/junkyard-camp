/*
 * Every route must load clean. A React key warning or a thrown effect is
 * invisible in a screenshot and invisible in a material statistic, and this app
 * gets opened once on a phone in a field and left alone — nobody is watching a
 * console at camp.
 *
 * Usage: node scripts/check-console.mjs   (dev server on :5173)
 */
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5173/junkyard-camp/'
const ROUTES = [
  '/',
  '#/menu',
  '#/call/punctuality',
  '#/call/good_deed',
  '#/team/precious',
  '#/key/precious',
  '#/standings',
  '#/display',
  '#/exports',
  '#/audit',
  '#/lab',
]

// Vite's dev client chatters, and a violation is advice rather than a fault.
const IGNORE = /\[vite\]|Download the React DevTools|\[Violation\]/

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

let failures = 0
const problems = []
page.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return
  const text = m.text()
  if (IGNORE.test(text)) return
  problems.push(`${m.type()}: ${text.slice(0, 200)}`)
})
page.on('pageerror', (e) => problems.push(`uncaught: ${String(e).slice(0, 200)}`))

for (const route of ROUTES) {
  problems.length = 0
  // a full document load per route, so a route's own mount is what is measured
  await page.goto('about:blank')
  await page.goto(BASE + route.replace(/^\//, ''), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  const ok = problems.length === 0
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${route} loads clean${ok ? '' : ''}`)
  for (const p of problems) console.log(`     ${p}`)
}

await browser.close()
console.log(
  failures === 0 ? '\nEvery route loads with a clean console' : `\n${failures} route(s) log errors`,
)
process.exit(failures === 0 ? 0 : 1)
