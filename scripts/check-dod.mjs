// Definition-of-done assertions that a screenshot cannot prove.
// Usage: node scripts/check-dod.mjs
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://localhost:5173/junkyard-camp/'
const MOBILE = ['/', '#/call/punctuality', '#/call/good_deed', '#/team/precious', '#/standings']

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

let failures = 0
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — got ${actual}, expected ${expected}`}`)
}

const goto = async (route) => {
  await page.goto(BASE + route.replace(/^\//, ''), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)
}

// 1. No horizontal scroll at 390px on any mobile route.
for (const route of MOBILE) {
  await goto(route)
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }))
  check(`${route} no horizontal scroll (scrollWidth ${overflow.doc} <= ${overflow.win})`, overflow.doc <= overflow.win, true)
}

// 2. No multiplication sign anywhere in rendered text. Keys are counts.
for (const route of [...MOBILE, '#/display']) {
  await goto(route)
  const hits = await page.evaluate(() => {
    const bad = []
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walk.nextNode())) {
      if (/[×✕✖x]\s*\d/.test(n.nodeValue ?? '')) bad.push(n.nodeValue.trim().slice(0, 40))
    }
    return bad
  })
  check(`${route} no multiplier notation`, hits.length, 0)
  if (hits.length) console.log('   ', hits)
}

// 3. Board: eight rows, all exactly the same height.
await goto('/')
const rowHeights = await page.evaluate(() => {
  const plate = document.querySelector('.plate.grain')
  return [...(plate?.children ?? [])].map((c) => Math.round(c.getBoundingClientRect().height))
})
check(`board has 8 rows (${rowHeights.length})`, rowHeights.length, 8)
check(`board row heights identical (${[...new Set(rowHeights)].join(',')})`, new Set(rowHeights).size, 1)

// 4. Board: the score column is never clipped (no truncated "7.").
const scores = await page.evaluate(() =>
  [...document.querySelectorAll('.plate.grain a')].map((row) => {
    const el = row.lastElementChild
    return { text: el?.textContent?.trim(), clipped: el ? el.scrollWidth > el.clientWidth + 1 : false }
  }),
)
check('board scores well-formed N.N', scores.every((s) => /^\d+\.\d$/.test(s.text ?? '')), true)
check('board scores not clipped', scores.every((s) => !s.clipped), true)

// 5. Roll call: every row is at least 56px and the whole plate is the hit area.
await goto('#/call/good_deed')
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('button[aria-pressed]')].map((b) => {
    const r = b.getBoundingClientRect()
    return { h: Math.round(r.height), w: Math.round(r.width) }
  }),
)
check(`roll call has 8 rows (${rows.length})`, rows.length, 8)
check(`roll call rows >= 56px (min ${Math.min(...rows.map((r) => r.h))})`, rows.every((r) => r.h >= 56), true)
check(`roll call rows full-width (min ${Math.min(...rows.map((r) => r.w))}px)`, rows.every((r) => r.w >= 330), true)

// 6. prefers-reduced-motion drops arc flicker and keyframes but keeps state.
const reduced = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
})
const rpage = await reduced.newPage()
await rpage.goto(BASE + 'call/punctuality'.replace(/^\//, ''), { waitUntil: 'networkidle' })
await rpage.goto(BASE + '#/team/precious', { waitUntil: 'networkidle' })
await rpage.evaluate(() => document.fonts.ready)
await rpage.waitForTimeout(300)
const anim = await rpage.evaluate(() => {
  let running = 0
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    if (cs.animationName && cs.animationName !== 'none' && cs.animationPlayState === 'running') running++
  }
  return running
})
check(`reduced motion: no running keyframe animations (${anim})`, anim, 0)
// State still renders: the punctuality track is still present and readable.
const trackPresent = await rpage.evaluate(
  () => document.querySelectorAll('svg[aria-label^="Punctuality"]').length > 0,
)
check('reduced motion: punctuality state still rendered', trackPresent, true)
await reduced.close()

await browser.close()
if (failures > 0) {
  console.error(`\n${failures} definition-of-done check(s) failed`)
  process.exit(1)
}
console.log('\nAll definition-of-done checks passed')
