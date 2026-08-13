// Capture the lever mid-drag (and the fire frame sequence).
// Usage: node scripts/drag-shot.mjs '/#/lab' shots/lever-drag.png [fraction]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const route = process.argv[2] ?? '/#/lab'
const out = resolve(process.argv[3] ?? 'shots/lever-drag.png')
const fraction = Number(process.argv[4] ?? '0.8')
mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
await page.goto('http://localhost:5173/junkyard-camp/' + route.replace(/^\//, ''), { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)

const grip = page.locator('[role="slider"]').first()
const box = await grip.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + 24
await page.mouse.move(cx, cy)
await page.mouse.down()
// travel = 118px * fraction, in a few steps so pointermove fires
const target = cy + 118 * fraction
for (let i = 1; i <= 6; i++) await page.mouse.move(cx, cy + ((target - cy) * i) / 6)
await page.waitForTimeout(250)
await page.screenshot({ path: out })
await page.mouse.up()
await page.waitForTimeout(150)
await page.screenshot({ path: out.replace(/\.png$/, '-fire.png') })
await page.waitForTimeout(500)
await page.screenshot({ path: out.replace(/\.png$/, '-settle.png') })
await browser.close()
console.log(out)
