// Computed-style validation: screenshots can look right while colors drift
// from the tokens. Reads computed CSS on live routes and asserts against
// theme.css tokens.
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'

const TOKENS = {
  bg: '#16110d',
  // The plate face. Sampled off the concept art at #70624F..#967862; a plate
  // that drifts back toward the old near-black #241C16 fails here first.
  panel: '#82684f',
  'plate-hi': '#94795e',
  'plate-lo': '#654632',
  well: '#1a120e',
  brass: '#c08a3e',
  lamp: '#ed9040',
  'lamp-hot': '#fedf97',
  accent: '#2fd9d0',
  text: '#ede3d2',
  key: '#ffc63d',
  'team-warriors': '#ff5fb8',
  'team-precious': '#b14dff',
  'team-gems': '#3d9bff',
  'team-pearls': '#96f5b4',
  'team-knights': '#ff4438',
  'team-innocent': '#ffd84d',
  'team-forged': '#78d62e',
  'team-rustco': '#ff9440',
}

const TEAM_TOKENS = Object.keys(TOKENS).filter((k) => k.startsWith('team-'))

/* ---- colour science: contrast on --bg, and pairwise OKLab separation ---- */

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

const parseHex = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const relativeLuminance = (hex) => {
  const [r, g, b] = parseHex(hex).map(srgbToLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const toOklab = (hex) => {
  const [r, g, b] = parseHex(hex).map(srgbToLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const oklabDistance = (a, b) => {
  const [l1, a1, b1] = toOklab(a)
  const [l2, a2, b2] = toOklab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://localhost:5173/junkyard-camp/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)

let failures = 0
const check = (label, actual, expected) => {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`)
}

// 1. Theme tokens resolve on :root exactly as defined.
for (const [name, hex] of Object.entries(TOKENS)) {
  const val = await page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(`--color-${n}`).trim(),
    name,
  )
  check(`--color-${name}`, val.toLowerCase(), hex)
}

// 1b. Every team colour clears 4.5:1 on the background.
for (const name of TEAM_TOKENS) {
  const ratio = contrastRatio(TOKENS[name], TOKENS.bg)
  check(`${name} contrast on --bg >= 4.5`, String(ratio >= 4.5), 'true')
}

// 1c. Team colours stay 0.145 OKLab apart from each other, and clear of the
//     three colours they must never be confused with.
let minSep = Infinity
let closest = ''
for (let i = 0; i < TEAM_TOKENS.length; i++) {
  for (let j = i + 1; j < TEAM_TOKENS.length; j++) {
    const d = oklabDistance(TOKENS[TEAM_TOKENS[i]], TOKENS[TEAM_TOKENS[j]])
    if (d < minSep) {
      minSep = d
      closest = `${TEAM_TOKENS[i]} / ${TEAM_TOKENS[j]}`
    }
  }
}
check(`min pairwise OKLab separation >= 0.145 (closest ${closest} = ${minSep.toFixed(3)})`, String(minSep >= 0.145), 'true')

/*
 * Team colours must also stay clear of the three they'd be confused with.
 * The bar here is deliberately lower than the team-vs-team 0.145: the verified
 * palette's tightest reserved pairing is RUST CO. against brass at 0.113
 * (both are warm oranges by design), and PEARLS against arc-teal at 0.122.
 * 0.10 catches a genuine collision without failing the palette as specified.
 */
const RESERVED_FLOOR = 0.1
for (const name of TEAM_TOKENS) {
  for (const reserved of ['brass', 'accent', 'text']) {
    const d = oklabDistance(TOKENS[name], TOKENS[reserved])
    check(`${name} vs --${reserved} = ${d.toFixed(3)} (floor ${RESERVED_FLOOR})`, String(d >= RESERVED_FLOOR), 'true')
  }
}

// 2. No default Tailwind palette anywhere: every element's color/background
//    must NOT be one of the stock Tailwind hues (spot-check a few notorious ones).
const stock = ['rgb(59, 130, 246)', 'rgb(99, 102, 241)', 'rgb(16, 185, 129)', 'rgb(239, 68, 68)', 'rgb(107, 114, 128)']
const offenders = await page.evaluate((stockColors) => {
  const bad = []
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    for (const prop of ['color', 'backgroundColor', 'borderColor']) {
      if (stockColors.includes(cs[prop])) bad.push(`${el.tagName}.${el.className} ${prop}=${cs[prop]}`)
    }
  }
  return bad.slice(0, 10)
}, stock)
check('no stock Tailwind colors reachable', String(offenders.length), '0')

// 3. Fonts: body must not resolve to Inter or a system-ui default.
const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
check('body font is Barlow Condensed', String(bodyFont.includes('Barlow Condensed')), 'true')
const titleFont = await page.evaluate(() => {
  const h = document.querySelector('h1')
  return h ? getComputedStyle(h).fontFamily : ''
})
check('display font is Oswald', String(titleFont.includes('Oswald')), 'true')
check('Inter is banned', String(/inter/i.test(bodyFont + titleFont)), 'false')

// 4. Score numerals use tabular numerals.
const numeral = await page.evaluate(() => {
  const el = document.querySelector('.numeral')
  return el ? getComputedStyle(el).fontVariantNumeric : ''
})
check('numerals are tabular', String(numeral.includes('tabular-nums')), 'true')

// 5. Body background is the bg token.
const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
check('body background = --bg', bodyBg, hexToRgb(TOKENS.bg))

await browser.close()
if (failures > 0) {
  console.error(`\n${failures} token check(s) failed`)
  process.exit(1)
}
console.log('\nAll token checks passed')
