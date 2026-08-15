/**
 * Pre-generated lightning geometry. Everything here is computed once per
 * (seed, endpoints, chaos, weight) and cycled at 8–12fps — never recomputed
 * per frame, and never re-randomised.
 *
 * The references (`03-rollcall-commit.jpg`, `06-big-screen.jpg`,
 * `04-golden-key.jpg`) draw a bolt as a **filament**, not a polyline: it is
 * fullest where the current is strongest and narrows toward each contact, and
 * its offshoots taper to an actual point instead of stopping dead at full
 * width under a round cap. So the emitted geometry is a *filled outline* whose
 * half-width follows a profile, plus the bare centreline for the soft bloom
 * strokes that stand in for a Gaussian blur.
 *
 * Two consequences worth stating, because both were review findings:
 *
 * - **Wander is fractal, not per-vertex.** Midpoint displacement halves the
 *   deviation at every subdivision, so adjacent vertices differ by the finest
 *   octave only (~9% of the amplitude). The old generator drew one independent
 *   ±amp sample per vertex with amp ≈ the segment length, which is a sawtooth —
 *   "chaotic scribble" in CLAUDE.md's words. Fractal noise gives a big slow
 *   drift with fine kinks riding on it, which is what the reference bolts do.
 * - **Branches leave forward.** A branch angle is measured off the local
 *   tangent and clamped to ±55°, so an offshoot can never double back across
 *   the trunk. The trunk itself is displaced perpendicular to a chord walked
 *   monotonically in t, so it cannot self-intersect either.
 */

export interface ArcVariant {
  /** Trunk centreline polyline. The wide soft bloom strokes ride on this. */
  spine: string
  /**
   * Branch centrelines, progressively trimmed back from the free tip:
   * `[90%, 60%, 30%]`. Stroked widest-and-shortest first, they give the
   * branch glow a stepped taper. A single stroke cannot do this — its round
   * cap sits at full width exactly where the filament has narrowed to a
   * point, which puts a floating blob back on the end of every offshoot.
   */
  branchGlow: [string, string, string]
  /** Filled tapering outline, trunk + branches, at the coloured-body width. */
  body: string
  /** Filled tapering outline, trunk + branches, at the white-hot core width. */
  core: string
}

/** Deterministic PRNG so variants are stable across renders. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Pt {
  x: number
  y: number
}

/** One conductor: a centreline plus the half-width profile along it. */
interface Filament {
  pts: Pt[]
  /** Relative half-width at each vertex, 0..1. Multiplied by a layer width. */
  w: number[]
}

/**
 * Fractal (1/f) perpendicular offsets along a chord, endpoints pinned at 0.
 * `rough` < 1 is what makes the result read as current rather than noise: the
 * midpoint takes the full amplitude, its children half of that, and so on.
 */
function fractalOffsets(levels: number, rand: () => number, amp: number, rough = 0.62): number[] {
  const n = 1 << levels
  const o = new Array<number>(n + 1).fill(0)
  let step = n
  let a = amp
  while (step > 1) {
    const half = step >> 1
    for (let i = half; i < n; i += step) {
      o[i] = (o[i - half] + o[i + half]) / 2 + (rand() * 2 - 1) * a
    }
    a *= rough
    step = half
  }
  return o
}

/** Subdivision depth: aim for ~5px segments, but stay in a sane band. */
function levelsFor(len: number): number {
  return Math.max(3, Math.min(6, Math.round(Math.log2(Math.max(2, len / 5)))))
}

/**
 * A jagged conductor between two points. `profile` maps t∈[0,1] to a relative
 * half-width; that is the whole taper story.
 */
function buildFilament(
  a: Pt,
  b: Pt,
  rand: () => number,
  amp: number,
  profile: (t: number) => number,
): Filament {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const levels = levelsFor(len)
  const n = 1 << levels
  const off = fractalOffsets(levels, rand, amp)

  const pts: Pt[] = []
  const w: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push({ x: a.x + dx * t + px * off[i], y: a.y + dy * t + py * off[i] })
    w.push(profile(t))
  }
  return { pts, w }
}

/** Unit normal at each vertex, averaged from the neighbouring segments. */
function normals(pts: Pt[]): { nx: number[]; ny: number[] } {
  const n = pts.length
  const nx: number[] = []
  const ny: number[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[Math.max(0, i - 1)]
    const q = pts[Math.min(n - 1, i + 1)]
    const dx = q.x - p.x
    const dy = q.y - p.y
    const l = Math.hypot(dx, dy) || 1
    nx.push(-dy / l)
    ny.push(dx / l)
  }
  return { nx, ny }
}

const f = (v: number) => (Math.round(v * 10) / 10).toString()

/**
 * The filament's silhouette at a given peak half-width: walk one side out,
 * the other side back. Where the profile reaches 0 the two sides meet and the
 * subpath closes to a point — that is the tapered tip.
 *
 * The outline can self-overlap on a very tight kink; with the default nonzero
 * fill rule that still paints solid, so no hole ever appears.
 */
function outline(fil: Filament, halfWidth: number): string {
  const { pts, w } = fil
  const { nx, ny } = normals(pts)
  const n = pts.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const h = w[i] * halfWidth
    d += `${i === 0 ? 'M' : 'L'}${f(pts[i].x + nx[i] * h)} ${f(pts[i].y + ny[i] * h)}`
  }
  for (let i = n - 1; i >= 0; i--) {
    const h = w[i] * halfWidth
    d += `L${f(pts[i].x - nx[i] * h)} ${f(pts[i].y - ny[i] * h)}`
  }
  return d + 'Z'
}

function polyline(pts: Pt[], keep = 1): string {
  const n = Math.max(2, Math.round((pts.length - 1) * keep) + 1)
  let d = ''
  for (let i = 0; i < n; i++) d += `${i === 0 ? 'M' : 'L'}${f(pts[i].x)} ${f(pts[i].y)}`
  return d
}

/**
 * Trunk profile. Fullest at mid-span, ~62% at each contact — a visible taper
 * that still lands on the brass with enough width to read as attached. It
 * never reaches 0: several screens chain two or three bolts end to end to make
 * one longer conductor, and a zero-width joint would bead the run.
 */
const trunkProfile = (t: number) => 0.62 + 0.38 * Math.pow(Math.sin(Math.PI * t), 0.7)

/** Branch profile: full at the fork, a true point at the free end. */
const branchProfile = (base: number) => (t: number) => base * Math.pow(1 - t, 0.8)

export function generateArcVariants(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  options?: { chaos?: number; branchChance?: number; weight?: number },
): ArcVariant[] {
  const chaos = options?.chaos ?? 1
  const weight = options?.weight ?? 1
  const branchChance = options?.branchChance ?? 0.82

  // Peak half-widths. Both scale with weight but carry a floor, so the
  // hairline callers (the big screen's key crackle at weight 0.28) keep a
  // filament rather than dissolving into antialiasing.
  //
  // Gauge: in `03-rollcall-commit.jpg` (2.77x CSS) a tube→rail bolt's bright
  // band is ~6 image px — about 2.2 CSS px — under a glow several times that.
  // The old constant 5.4px stroke was more than twice too fat.
  //
  // Ratio: at 8x, `06-big-screen.jpg`'s leader bolt is a white filament taking
  // a little over half the bright band, with teal reading as a fringe around
  // it plus the spill. A core at a third of the body — a 2px stroke inside a
  // 5.4px one — turns the bolt into a cyan neon tube instead.
  // The floors only bite below weight ~0.4 — the big screen's key crackle and
  // the lever's resting filament — where a proportional width would fall under
  // a device pixel and antialias itself away to nothing.
  const bodyHW = Math.max(0.95 * weight + 0.22, 0.62)
  const coreHW = Math.max(0.6 * weight + 0.12, 0.32)

  const a: Pt = { x: x1, y: y1 }
  const b: Pt = { x: x2, y: y2 }
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  // Peak lateral excursion. Measured off `04-golden-key.jpg` at 2.5x, a
  // post→escutcheon filament bows about 12% of its chord; the big screen's
  // full-height bolt is looser. 8.5% × the caller's chaos lands in that band
  // for both without re-tuning any caller.
  // …and short arcs are damped further. The key ceremony fans three bolts
  // across a ~47 CSS gap at chaos 1.7; at the undamped ratio each one swings
  // ±8 while the fan only spreads ±14, so the three tangle into the knot the
  // review called a scribble. `04-golden-key.jpg` draws them as clean rays
  // bowing about a tenth of their span.
  const amp = Math.min(len * 0.085, 18) * chaos * Math.min(1, 0.35 + len / 120)

  const variants: ArcVariant[] = []
  for (let v = 0; v < 5; v++) {
    const rand = mulberry32(seed * 7919 + v * 104729 + 13)
    const trunk = buildFilament(a, b, rand, amp, trunkProfile)
    const fils: Filament[] = [trunk]
    const branchPts: Pt[][] = []

    // Offshoots, each forking forward off a mid-span vertex. The references
    // are generous with these — a discharge bolt in 03 throws half a dozen
    // across two strands — but they only read as "fine controlled branching"
    // rather than scribble because each one is a hair that tapers out.
    const maxBranches = len < 26 ? 1 : len < 55 ? 2 : 3
    let branchCount = 0
    if (rand() < branchChance) {
      const r = rand()
      branchCount = Math.min(maxBranches, r < 0.3 ? 3 : r < 0.62 ? 2 : 1)
    }
    for (let bi = 0; bi < branchCount; bi++) {
      const n = trunk.pts.length
      const i = Math.max(1, Math.min(n - 2, Math.round((0.22 + rand() * 0.56) * (n - 1))))
      const at = trunk.pts[i]
      const p = trunk.pts[i - 1]
      const q = trunk.pts[i + 1]
      const tangent = Math.atan2(q.y - p.y, q.x - p.x)
      // ±20°..±55° off the local tangent: always forward, never back across
      // the trunk, which is where the old generator's X-crossings came from.
      const sign = rand() < 0.5 ? -1 : 1
      const angle = tangent + sign * (0.35 + rand() * 0.6)
      const blen = Math.max(6, Math.min(46, len * (0.14 + rand() * 0.18)))
      const end: Pt = { x: at.x + Math.cos(angle) * blen, y: at.y + Math.sin(angle) * blen }
      // Offshoots are hair-thin next to the trunk — in the references they are
      // a teal filament with barely any white in them at all.
      const baseW = trunk.w[i] * 0.45
      const branch = buildFilament(at, end, rand, blen * 0.13 * chaos, branchProfile(baseW))
      fils.push(branch)
      branchPts.push(branch.pts)

      // A long branch forks once more. Real discharge does; it also gives the
      // eye a second tapering tip, which is the tell the reference has.
      if (blen > 18 && rand() < 0.45) {
        const m = Math.round(branch.pts.length * (0.35 + rand() * 0.3))
        const at2 = branch.pts[m]
        const fang = angle + (rand() < 0.5 ? -1 : 1) * (0.3 + rand() * 0.5)
        const flen = blen * (0.3 + rand() * 0.3)
        const fork = buildFilament(
          at2,
          { x: at2.x + Math.cos(fang) * flen, y: at2.y + Math.sin(fang) * flen },
          rand,
          flen * 0.13 * chaos,
          branchProfile(branch.w[m]),
        )
        fils.push(fork)
        branchPts.push(fork.pts)
      }
    }

    variants.push({
      spine: polyline(trunk.pts),
      branchGlow: [0.9, 0.6, 0.3].map((k) => branchPts.map((p) => polyline(p, k)).join(' ')) as [
        string,
        string,
        string,
      ],
      body: fils.map((fl) => outline(fl, bodyHW)).join(' '),
      core: fils.map((fl) => outline(fl, coreHW)).join(' '),
    })
  }
  return variants
}
