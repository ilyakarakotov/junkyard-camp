/**
 * Pre-generated lightning paths. Geometry is computed once per (seed,
 * endpoints) and cycled at 8–12fps — never recomputed per frame.
 */

export interface ArcVariant {
  /** SVG path for the main stroke. */
  d: string
  /** Short offshoot branches, drawn thinner. */
  branches: string[]
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

const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

function toPath(pts: Pt[]): string {
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
}

/**
 * One jagged polyline between two points: midpoint-displacement jitter
 * perpendicular to the chord, fine and controlled rather than scribbly.
 */
function buildBolt(a: Pt, b: Pt, rand: () => number, chaos: number): { pts: Pt[]; path: string } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  // Perpendicular unit vector — jitter direction.
  const px = -dy / len
  const py = dx / len
  const segments = Math.max(8, Math.min(24, Math.round(len / 9)))
  const amp = Math.min(len * 0.09, 10) * chaos

  const pts: Pt[] = [a]
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const base = lerp(a, b, t)
    // Taper jitter toward both endpoints so the bolt lands on the posts.
    const taper = Math.sin(Math.PI * t)
    // Two scales of displacement: a slow wander plus fine high-frequency kinks.
    const wander = (rand() * 2 - 1) * amp * taper
    const kink = (rand() * 2 - 1) * amp * 0.35 * taper
    const off = wander + kink
    pts.push({ x: base.x + px * off, y: base.y + py * off })
  }
  pts.push(b)
  return { pts, path: toPath(pts) }
}

export function generateArcVariants(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  options?: { chaos?: number; branchChance?: number },
): ArcVariant[] {
  const chaos = options?.chaos ?? 1
  const branchChance = options?.branchChance ?? 0.7
  const variants: ArcVariant[] = []
  const count = 5
  for (let v = 0; v < count; v++) {
    const rand = mulberry32(seed * 7919 + v * 104729 + 13)
    const { pts, path } = buildBolt({ x: x1, y: y1 }, { x: x2, y: y2 }, rand, chaos)
    const branches: string[] = []
    // 0–3 fine offshoots per variant, splitting from a mid vertex.
    const branchCount = rand() < branchChance ? (rand() < 0.3 ? 3 : rand() < 0.55 ? 2 : 1) : 0
    for (let bi = 0; bi < branchCount; bi++) {
      const at = pts[2 + Math.floor(rand() * Math.max(1, pts.length - 4))]
      const angle = Math.atan2(y2 - y1, x2 - x1) + (rand() - 0.5) * 2.4
      const blen = 9 + rand() * Math.min(30, Math.hypot(x2 - x1, y2 - y1) * 0.26)
      const end: Pt = { x: at.x + Math.cos(angle) * blen, y: at.y + Math.sin(angle) * blen }
      const branch = buildBolt(at, end, rand, chaos * 0.85)
      branches.push(branch.path)
      // Occasionally the branch itself forks once — reads as real discharge.
      if (rand() < 0.3) {
        const fat = branch.pts[Math.max(1, Math.floor(branch.pts.length * 0.6))]
        const fang = angle + (rand() - 0.5) * 1.6
        const flen = blen * (0.35 + rand() * 0.3)
        branches.push(
          buildBolt(fat, { x: fat.x + Math.cos(fang) * flen, y: fat.y + Math.sin(fang) * flen }, rand, chaos * 0.7).path,
        )
      }
    }
    variants.push({ d: path, branches })
  }
  return variants
}
