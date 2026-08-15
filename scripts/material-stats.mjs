// Shared material statistics + the thresholds derived from the concept art.
//
// Measured on design/reference/v2/*.jpg (see scripts/measure-material.mjs):
//
//   image                 warmth  medL  midtone%  spec%
//   01-board               30.9     64      39.0   2.46
//   02-rollcall-rest       36.2     66      42.1   1.76
//   03-rollcall-commit     26.6     83      51.7   4.40
//   04-golden-key          49.5     48      21.7   7.06
//   05-team-sheet          44.3     66      37.5   2.23
//   06-big-screen          22.7     48      20.2   5.00
//
// The floors below sit just under the reference minima. The ceilings exist so
// a screen cannot pass by flooding itself with light instead of building
// material — a washed-out screen fails as surely as a black one.

export const THRESHOLDS = {
  warmth: [18, 70],
  medianL: [42, 100],
  midtone: [17, 64],
  specular: [1.1, 12],
}

/** Runs in the page. Decodes an image and reduces it to material statistics. */
async function pageMeasure(uri) {
  const im = new Image()
  im.src = uri
  await im.decode()
  const scale = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight))
  const w = Math.max(1, Math.round(im.naturalWidth * scale))
  const h = Math.max(1, Math.round(im.naturalHeight * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.drawImage(im, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const n = d.length / 4
  let r = 0,
    g = 0,
    b = 0,
    mid = 0,
    spec = 0
  const hist = new Array(256).fill(0)
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
    const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    hist[Math.min(255, Math.round(l))]++
    if (l >= 70 && l <= 150) mid++
    if (l > 205) spec++
  }
  let acc = 0
  let median = 0
  for (let i = 0; i < 256; i++) {
    acc += hist[i]
    if (acc >= n / 2) {
      median = i
      break
    }
  }
  return {
    size: [im.naturalWidth, im.naturalHeight],
    meanR: r / n,
    meanG: g / n,
    meanB: b / n,
    medianL: median,
    midtone: (mid / n) * 100,
    specular: (spec / n) * 100,
  }
}

/** Measure one image, given as a data: URI, in an already-open page. */
export async function measure(page, dataUri) {
  const s = await page.evaluate(pageMeasure, dataUri)
  return {
    size: s.size,
    warmth: +(s.meanR - s.meanB).toFixed(1),
    ordering: s.meanR > s.meanG && s.meanG > s.meanB,
    medianL: s.medianL,
    midtone: +s.midtone.toFixed(1),
    specular: +s.specular.toFixed(2),
    mean: [s.meanR, s.meanG, s.meanB].map((x) => Math.round(x)),
  }
}

/** Which statistics fall outside the reference-derived band. */
export function failures(stats) {
  const out = []
  for (const [key, [lo, hi]] of Object.entries(THRESHOLDS)) {
    const v = stats[key]
    if (v < lo || v > hi) out.push(`${key} ${v} outside ${lo}..${hi}`)
  }
  // Warm metal runs R > G > B. Equal or inverted channels are the blue-grey
  // failure the design system explicitly forbids.
  if (!stats.ordering) out.push('channel ordering is not R > G > B (reads cool)')
  return out
}
