// Screenshot the Award screen with chips selected; optionally pull the lever.
// Usage: node scripts/award-shot.mjs shots/award.png [pull|fire]
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const out = resolve(process.argv[2] ?? 'shots/award.png')
const mode = process.argv[3] ?? 'rest'
mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
await page.goto('http://localhost:5173/junkyard-camp/#/award/turquoise', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)

for (const name of ['Jude', 'Ava', 'Silas']) {
  await page.getByText(name, { exact: true }).click()
}
await page.waitForTimeout(200)

if (mode === 'pull' || mode === 'fire' || mode === 'confirm') {
  const grip = page.locator('[role="slider"]').first()
  const box = await grip.boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + 24
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(cx, cy + (118 * 0.85 * i) / 6)
  await page.waitForTimeout(250)
  if (mode === 'fire' || mode === 'confirm') {
    await page.mouse.up()
    await page.waitForTimeout(120) // catch the discharge + token flight
  }
  if (mode === 'confirm') {
    await page.waitForURL(/confirm/, { timeout: 5000 })
    await page.waitForTimeout(400)
  }
}

await page.screenshot({ path: out })
await browser.close()
console.log(out)
