// Definition-of-done assertions that a screenshot cannot prove.
// Usage: node scripts/check-dod.mjs
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5173/junkyard-camp/'
const MOBILE = ['/', '#/call/punctuality', '#/call/good_deed', '#/team/precious', '#/standings']

const browser = await chromium.launch({ executablePath: chromiumPath() })
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

/*
 * 2b. …and no crest DRAWS one either. The scan above walks text nodes, so it
 * is blind to an SVG path, and the WARRIORS emblem shipped for a while as
 * crossed blades over a diamond boss — four-fold symmetric, square-ended, and
 * unmistakably a × at every size it rendered at.
 *
 * A mark that survives a 90-degree rotation unchanged reads as an operator
 * rather than as an object, so that is what this measures: rasterise each
 * crest, compare it against a quarter-turn of itself, and fail anything that
 * matches too closely.
 */
await goto('#/standings')
const symmetric = await page.evaluate(async () => {
  const out = []
  const svgs = [...document.querySelectorAll('svg')].filter((s) => s.viewBox?.baseVal?.width === 64)
  for (const svg of svgs.slice(0, 8)) {
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))))
    const im = new Image()
    im.src = src
    try {
      await im.decode()
    } catch {
      continue
    }
    const N = 64
    const draw = (turn) => {
      const c = document.createElement('canvas')
      c.width = c.height = N
      const x = c.getContext('2d')
      x.translate(N / 2, N / 2)
      x.rotate((turn * Math.PI) / 2)
      x.drawImage(im, -N / 2, -N / 2, N, N)
      return x.getImageData(0, 0, N, N).data
    }
    const a = draw(0)
    const b = draw(1)
    // Compare only near the centre, where an emblem lives — the bezel and its
    // ring are rotationally symmetric by design and would mask the emblem.
    let diff = 0
    let n = 0
    for (let y = 18; y < 46; y++) {
      for (let x = 18; x < 46; x++) {
        const i = (y * N + x) * 4
        diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
        n += 3
      }
    }
    out.push(Math.round((diff / n) * 10) / 10)
  }
  return out
})
const flat = symmetric.filter((d) => d < 6)
check(
  `crest emblems are not 90-degree symmetric (min delta ${symmetric.length ? Math.min(...symmetric) : 'n/a'})`,
  flat.length,
  0,
)

/*
 * 3-4. Board rows. Found by the link each row carries to its team sheet rather
 * than by class name, so restyling the board cannot silently disable these.
 */
await goto('/')
const board = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('a[href*="#/team/"]')]
  return rows.map((row) => {
    const r = row.getBoundingClientRect()
    // The score is the last text in the row shaped like a one-decimal number.
    const walk = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
    let scoreNode = null
    let n
    while ((n = walk.nextNode())) if (/^\s*\d+\.\d\s*$/.test(n.nodeValue ?? '')) scoreNode = n
    const scoreEl = scoreNode?.parentElement ?? null
    const sr = scoreEl?.getBoundingClientRect()
    return {
      height: Math.round(r.height),
      score: scoreNode?.nodeValue?.trim() ?? null,
      right: sr ? Math.round(sr.right) : null,
      clipped: scoreEl ? scoreEl.scrollWidth > scoreEl.clientWidth + 1 : false,
    }
  })
})
check(`board has 8 rows (${board.length})`, board.length, 8)
check(
  `board row heights identical (${[...new Set(board.map((b) => b.height))].join(',')})`,
  new Set(board.map((b) => b.height)).size,
  1,
)
check('board scores well-formed N.N', board.every((b) => /^\d+\.\d$/.test(b.score ?? '')), true)
check('board scores not clipped', board.every((b) => !b.clipped), true)

/*
 * The scores share one column edge. CLAUDE.md asks for right-aligned numerals
 * on a shared edge and that rigour is most of why the board reads expensive;
 * 1px of tolerance covers subpixel text metrics.
 */
const rights = board.map((b) => b.right).filter((r) => r !== null)
const edgeSpread = rights.length ? Math.max(...rights) - Math.min(...rights) : 999
check(`board scores share a column edge (spread ${edgeSpread}px)`, edgeSpread <= 1, true)

/*
 * The board is a standings board: rows run best-first. This was wrong for a
 * while — rows sat in roster order while the rank numerals came from the sorted
 * derivation, so the board read 1,2,3,6,5,7,3,8 down the page.
 */
const order = board.map((b) => Number(b.score))
check(
  `board rows sorted by score descending (${order.join(' ')})`,
  order.every((v, i) => i === 0 || order[i - 1] >= v),
  true,
)

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
/*
 * State still renders. Asserted on the rendered readout rather than on a
 * particular element, because reduced motion must not cost a leader the
 * information — the "n / 7" count has to be on screen either way.
 */
const trackPresent = await rpage.evaluate(() => /\d\s*\/\s*7/.test(document.body.innerText))
check('reduced motion: punctuality count still rendered', trackPresent, true)
await reduced.close()

/*
 * 7. Team names on the board are cream, never tinted. The team colour carries
 * the crest glyph, a lit cell and a meter segment; spending it on the name too
 * flattens the hierarchy and costs those three their signal.
 */
await goto('/')
const SHORT_NAMES = [
  'Pink Junkyard Warriors',
  'Precious Pieces',
  'Hidden Gems',
  "God's Pearls",
  'Fire Knights',
  'Innocent',
  'Forged',
  'Rust Revival Co.',
]
const tinted = await page.evaluate((names) => {
  const cream = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
  const toRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const target = toRgb(cream)
  const bad = []
  for (const el of document.querySelectorAll('a[href*="#/team/"] *')) {
    const text = el.textContent?.trim() ?? ''
    if (!names.includes(text) || el.children.length) continue
    const m = getComputedStyle(el).color.match(/\d+/g)
    if (!m) continue
    const d = Math.max(...[0, 1, 2].map((i) => Math.abs(Number(m[i]) - target[i])))
    if (d > 28) bad.push(`${text}=${getComputedStyle(el).color}`)
  }
  return bad
}, SHORT_NAMES)
check(`board team names are cream${tinted.length ? ` (${tinted.join(', ')})` : ''}`, tinted.length, 0)

await browser.close()
if (failures > 0) {
  console.error(`\n${failures} definition-of-done check(s) failed`)
  process.exit(1)
}
console.log('\nAll definition-of-done checks passed')
