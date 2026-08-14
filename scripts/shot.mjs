// Playwright screenshot helper.
// Usage: npm run shot -- '/#/award/turquoise' shots/award.png [--viewport 390x844] [--dpr 3] [--base http://localhost:5173/junkyard-camp/]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const route = args[0] ?? '/'
const out = resolve(args[1] ?? 'shots/shot.png')
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : dflt
}
const [w, h] = flag('viewport', '390x844').split('x').map(Number)
const dpr = Number(flag('dpr', '3'))
const base = flag('base', 'http://localhost:5173/junkyard-camp/')

mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: dpr,
})
const url = base.replace(/\/$/, '') + '/' + route.replace(/^\//, '')
const scroll = Number(flag('scroll', '0'))
const full = args.includes('--full')

await page.goto(url, { waitUntil: 'networkidle' })
// Font swap causes measurement drift — wait for the real fonts.
await page.evaluate(() => document.fonts.ready)
if (scroll) {
  await page.evaluate((y) => window.scrollTo(0, y), scroll)
  await page.waitForTimeout(120)
}
await page.waitForTimeout(350) // let idle arc flicker reach a lit frame
await page.screenshot({ path: out, fullPage: full })
await browser.close()
console.log(out)
