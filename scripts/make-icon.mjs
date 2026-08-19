// Renders public/apple-touch-icon.png: the favicon's golden key at 180×180.
// iOS accepts raster only for home-screen icons, and masks the square itself,
// so the background runs full-bleed — no rounded corners of its own.
// Usage: node scripts/make-icon.mjs
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'
import { resolve } from 'node:path'

const out = resolve('public/apple-touch-icon.png')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>
    <linearGradient id="k" gradientUnits="userSpaceOnUse" x1="18" y1="8" x2="46" y2="56">
      <stop offset="0%" stop-color="#FFF4D0" />
      <stop offset="34%" stop-color="#FFC63D" />
      <stop offset="78%" stop-color="#D99B1E" />
      <stop offset="100%" stop-color="#8E5C0D" />
    </linearGradient>
  </defs>
  <rect width="180" height="180" fill="#16110D" />
  <rect x="7" y="7" width="166" height="166" rx="24" fill="none" stroke="#5A4526" stroke-width="5" />
  <!-- the 64-unit favicon key, scaled up and centred inside the ring -->
  <g transform="translate(12.8 12.8) scale(2.4125)" fill="url(#k)">
    <path
      d="M32 9a11 11 0 0 1 11 11c0 5.1-3.5 9.4-8.2 10.6v1.9h-5.6v-1.9A11 11 0 0 1 21 20 11 11 0 0 1 32 9Zm0 6.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z"
    />
    <rect x="29.2" y="32" width="5.6" height="21" rx="1.4" />
    <rect x="34.8" y="40" width="7.4" height="4.2" rx="1" />
    <rect x="34.8" y="46.4" width="5.2" height="4.2" rx="1" />
  </g>
</svg>`

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 })
await page.setContent(`<body style="margin:0">${svg}</body>`)
await page.screenshot({ path: out })
await browser.close()
console.log(out)
