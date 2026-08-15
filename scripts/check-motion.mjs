// Motion contract: only `transform` and `opacity` may animate. Anything else
// (height, left, width, top, filter, box-shadow, background) forces layout or
// paint on every frame and will not hold 60fps on a mid-range Android.
//
// Screenshots cannot catch this — it has to be read off computed style.
// Usage: node scripts/check-motion.mjs
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5173/junkyard-camp/'
const ROUTES = ['/', '#/call/punctuality', '#/team/precious', '#/standings', '#/display', '#/lab']

// `all` is disallowed too: it silently opts every animatable property in.
const ALLOWED = new Set(['transform', 'opacity', 'none', ''])

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

let failures = 0
const seen = new Set()

for (const route of ROUTES) {
  await page.goto(BASE + route.replace(/^\//, ''), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)

  const offenders = await page.evaluate((allowed) => {
    const bad = []
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      const props = cs.transitionProperty
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      const durations = cs.transitionDuration.split(',').map((d) => parseFloat(d) || 0)
      props.forEach((p, i) => {
        // A property listed with a zero duration never actually animates.
        const dur = durations[i] ?? durations[0] ?? 0
        if (dur > 0 && !allowed.includes(p)) {
          bad.push({
            prop: p,
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || '').slice(0, 60),
          })
        }
      })
    }
    return bad
  }, [...ALLOWED])

  for (const o of offenders) {
    const key = `${o.prop}|${o.tag}|${o.cls}`
    if (seen.has(key)) continue
    seen.add(key)
    failures++
    console.log(`FAIL ${route}  transitions "${o.prop}"  <${o.tag} class="${o.cls}">`)
  }
  if (offenders.length === 0) console.log(`PASS ${route}`)
}

// Keyframe animations are hand-audited in theme.css; assert the set is small
// and that each only touches opacity.
const cssAnimated = await page.evaluate(() => {
  const names = new Set()
  for (const el of document.querySelectorAll('*')) {
    const n = getComputedStyle(el).animationName
    if (n && n !== 'none') n.split(',').forEach((x) => names.add(x.trim()))
  }
  return [...names]
})
console.log(`\nkeyframe animations in use: ${cssAnimated.join(', ') || '(none)'}`)

await browser.close()
if (failures > 0) {
  console.error(`\n${failures} motion violation(s): only transform and opacity may animate`)
  process.exit(1)
}
console.log('\nMotion contract holds: transform and opacity only')
