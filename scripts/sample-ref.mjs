// Sample average colors from rectangular regions of a reference image.
// Eyeballing a JPEG's palette is how a "warm brass" spec turns into mud —
// this reads the actual pixels through a canvas in Chromium.
//
// Usage: node scripts/sample-ref.mjs <image> "<label>:x,y,w,h" ["<label>:..." ...]
//        coordinates are in the image's own pixel space.
import { chromium } from 'playwright-core'
import { chromiumPath } from './chromium.mjs'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const [imgArg, ...regionArgs] = process.argv.slice(2)
const img = resolve(imgArg)
const mime = extname(img).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
const dataUri = `data:${mime};base64,${readFileSync(img).toString('base64')}`

const regions = regionArgs.map((a) => {
  const [label, nums] = a.split(':')
  const [x, y, w, h] = nums.split(',').map(Number)
  return { label, x, y, w, h }
})

const browser = await chromium.launch({ executablePath: chromiumPath() })
const page = await browser.newPage()
const out = await page.evaluate(
  async ({ dataUri, regions }) => {
    const im = new Image()
    im.src = dataUri
    await im.decode()
    const c = document.createElement('canvas')
    c.width = im.naturalWidth
    c.height = im.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(im, 0, 0)
    const hex = (n) => n.toString(16).padStart(2, '0')
    return {
      size: [im.naturalWidth, im.naturalHeight],
      rows: regions.map(({ label, x, y, w, h }) => {
        const d = ctx.getImageData(x, y, w, h).data
        let r = 0,
          g = 0,
          b = 0
        // Track the brightest pixel too: specular highlights are the whole
        // point of a metal spec and an average erases them.
        let peak = [0, 0, 0],
          peakL = -1
        const n = d.length / 4
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]
          g += d[i + 1]
          b += d[i + 2]
          const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
          if (l > peakL) {
            peakL = l
            peak = [d[i], d[i + 1], d[i + 2]]
          }
        }
        r = Math.round(r / n)
        g = Math.round(g / n)
        b = Math.round(b / n)
        return {
          label,
          avg: `#${hex(r)}${hex(g)}${hex(b)}`,
          peak: `#${hex(peak[0])}${hex(peak[1])}${hex(peak[2])}`,
        }
      }),
    }
  },
  { dataUri, regions },
)
await browser.close()
console.log(`${imgArg}  ${out.size[0]}x${out.size[1]}`)
for (const r of out.rows) console.log(`  ${r.label.padEnd(22)} avg ${r.avg}   peak ${r.peak}`)
