// Capture the lever through a full commit stroke.
// Usage: node scripts/stroke-shot.mjs '/#/lab' shots/lever
//
// Writes -rest, -pressed, -seated and -settled frames. The seated frame is the
// one that matters: the grip must be BELOW the emitter tube and sitting on the
// base contact block, with empty rail above it.
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const route = process.argv[2] ?? '/#/lab'
const stem = resolve(process.argv[3] ?? 'shots/lever')
mkdirSync(dirname(stem), { recursive: true })

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
await page.goto('http://localhost:5173/junkyard-camp/' + route.replace(/^\//, ''), { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(350)

const commit = page.locator('button[aria-label^="Commit"]:not([disabled])').first()
await commit.scrollIntoViewIfNeeded()
await page.waitForTimeout(200)

const shot = (name) => page.screenshot({ path: `${stem}-${name}.png` })

await shot('rest')

const box = await commit.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// Finger down: the grip dips and the tube charges. Held, so it can be sampled.
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.waitForTimeout(220)
await shot('pressed')

await page.mouse.up()
// Inside the seat hold (520ms): grip parked at the base, tube white-hot.
await page.waitForTimeout(220)
await shot('seated')

// After the return (520 + 400ms).
await page.waitForTimeout(900)
await shot('settled')

await browser.close()
console.log(`${stem}-{rest,pressed,seated,settled}.png`)
