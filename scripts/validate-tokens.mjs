// Computed-style validation: screenshots can look right while colors drift
// from the tokens. Reads computed CSS on live routes and asserts against
// theme.css tokens.
import { chromium } from 'playwright-core'

const TOKENS = {
  bg: '#16110d',
  accent: '#2fd9d0',
  text: '#ede3d2',
  'team-turquoise': '#2fd9d0',
  'team-crimson': '#d9433f',
  'team-sunburst': '#e0a33c',
  'team-lime': '#7fb93f',
  'team-violet': '#9b6dd1',
  'team-cobalt': '#3d7ed9',
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
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
