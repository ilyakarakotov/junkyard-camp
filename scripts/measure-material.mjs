// Report material statistics for any image — reference art or a screenshot.
// Use it to re-derive the bands in scripts/material-stats.mjs, or to compare a
// screen against its reference side by side.
//
// Usage: node scripts/measure-material.mjs <image> [<image> ...] [--json]
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'
import { measure } from './material-stats.mjs'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const files = args.filter((a) => !a.startsWith('--'))

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage()

const results = []
for (const f of files) {
  const p = resolve(f)
  const mime = extname(p).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
  results.push({ file: f, ...(await measure(page, `data:${mime};base64,${readFileSync(p).toString('base64')}`)) })
}
await browser.close()

if (asJson) {
  console.log(JSON.stringify(results, null, 2))
} else {
  console.log('file                              warmth  order  medL  midtone%  spec%   mean rgb')
  for (const r of results) {
    console.log(
      `${r.file.slice(-33).padEnd(33)} ${String(r.warmth).padStart(6)}  ${String(r.ordering).padEnd(5)}  ` +
        `${String(r.medianL).padStart(4)}  ${String(r.midtone).padStart(7)}  ${String(r.specular).padStart(6)}   ${r.mean.join(',')}`,
    )
  }
}
