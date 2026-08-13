import { useEffect, useMemo, useRef, useState } from 'react'
import { generateArcVariants } from './arcPaths'

/**
 * Electrical arc between two points inside an existing <svg>.
 * Two stacked layers: thick teal glow beneath, thin white-hot core on top —
 * plus even wider, fainter halo stroke standing in for blur (feGaussianBlur
 * is too expensive on mobile).
 *
 * Flicker runs at 8–12fps, stochastic: variant hopping + brightness jumps.
 * `prefers-reduced-motion` gets a single static frame.
 */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(REDUCED_MOTION_QUERY).matches,
  )
  useEffect(() => {
    const mq = matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export interface ArcBoltProps {
  x1: number
  y1: number
  x2: number
  y2: number
  seed?: number
  /** 0..1 — overall brightness scaling (idle arcs sit low). */
  intensity?: number
  /** Multiplies jitter amplitude. */
  chaos?: number
  /** Core/glow stroke width scale. */
  weight?: number
  /**
   * Simultaneous independent discharge paths between the same two posts.
   * 1 = a single bolt; 2–3 = the reference's full-storm look where current
   * splits into parallel strands. Each strand has its own geometry set.
   */
  strands?: number
  /** When false renders nothing (keeps hooks stable). */
  active?: boolean
}

export function ArcBolt({
  x1,
  y1,
  x2,
  y2,
  seed = 1,
  intensity = 1,
  chaos = 1,
  weight = 1,
  strands = 1,
  active = true,
}: ArcBoltProps) {
  const reduced = usePrefersReducedMotion()
  const n = Math.max(1, Math.min(3, Math.round(strands)))
  const strandSets = useMemo(
    () =>
      Array.from({ length: n }, (_, s) =>
        generateArcVariants(x1, y1, x2, y2, seed + s * 977, { chaos: s === 0 ? chaos : chaos * 1.15 }),
      ),
    [x1, y1, x2, y2, seed, chaos, n],
  )
  const [frame, setFrame] = useState({ v: [0, 2, 4], glow: 1 })
  const frameRef = useRef(frame)
  frameRef.current = frame

  useEffect(() => {
    if (reduced || !active) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      if (!alive) return
      const count = strandSets[0].length
      const v = [0, 1, 2].map(() => Math.floor(Math.random() * count))
      // Stochastic brightness: mostly bright, occasional partial dropout.
      const glow = Math.random() < 0.12 ? 0.55 : 0.82 + Math.random() * 0.18
      setFrame({ v, glow })
      timer = setTimeout(tick, 83 + Math.random() * 42) // 8–12fps
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [reduced, active, strandSets])

  if (!active) return null
  const a = (reduced ? 0.8 : frame.glow) * intensity

  return (
    <g style={{ opacity: a }}>
      {strandSets.map((variants, s) => {
        const { d, branches } = variants[frame.v[s] % variants.length]
        // Primary strand carries the current; secondaries are thinner echoes.
        const sw = s === 0 ? 1 : s === 1 ? 0.72 : 0.55
        const so = s === 0 ? 1 : s === 1 ? 0.8 : 0.62
        return (
          <g key={s}>
            {/* wide faint halo */}
            <path d={d} fill="none" stroke="var(--color-accent)" strokeOpacity={0.2 * so} strokeWidth={9 * weight * sw} strokeLinejoin="round" strokeLinecap="round" />
            {/* teal glow body */}
            <path d={d} fill="none" stroke="var(--color-accent)" strokeOpacity={0.6 * so} strokeWidth={3.4 * weight * sw} strokeLinejoin="round" strokeLinecap="round" />
            {branches.map((b, i) => (
              <path key={i} d={b} fill="none" stroke="var(--color-accent)" strokeOpacity={0.45 * so} strokeWidth={1.2 * weight * sw} strokeLinecap="round" />
            ))}
            {/* white-hot core */}
            <path d={d} fill="none" stroke="var(--color-accent-hot)" strokeOpacity={0.97 * so} strokeWidth={2.1 * weight * sw} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        )
      })}
    </g>
  )
}

/**
 * Brass contact post — the mandatory visible endpoint for every arc.
 * Drawn in SVG so it can sit in the same coordinate space as the bolt.
 * A small cylinder with a domed cap, key light from the top left.
 */
export function ContactPost({ cx, cy, r = 5 }: { cx: number; cy: number; r?: number }) {
  const id = useMemo(() => `post-${Math.round(cx)}-${Math.round(cy)}-${r}`, [cx, cy, r])
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-cap`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#f2d9a6" />
          <stop offset="35%" stopColor="#c08a3e" />
          <stop offset="75%" stopColor="#6d4a1e" />
          <stop offset="100%" stopColor="#2e1e0a" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8a6428" />
          <stop offset="30%" stopColor="#d9b06a" />
          <stop offset="60%" stopColor="#7a5622" />
          <stop offset="100%" stopColor="#3a2810" />
        </linearGradient>
      </defs>
      {/* base flange */}
      <ellipse cx={cx} cy={cy + r * 1.5} rx={r * 1.35} ry={r * 0.55} fill={`url(#${id}-body)`} stroke="#241708" strokeWidth="0.6" />
      {/* shaft */}
      <rect x={cx - r * 0.8} y={cy} width={r * 1.6} height={r * 1.5} fill={`url(#${id}-body)`} />
      {/* domed cap */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-cap)`} stroke="#241708" strokeWidth="0.6" />
      {/* specular glint, top-left */}
      <circle cx={cx - r * 0.3} cy={cy - r * 0.35} r={r * 0.22} fill="#fff3d8" opacity="0.85" />
    </g>
  )
}

/**
 * Self-contained arc gap: two brass posts with a bolt jumping between them
 * and a teal light-spill wash behind. Positioned absolutely by the parent.
 */
export function ArcGap({
  width,
  height = 28,
  seed = 1,
  intensity = 0.9,
  postR = 5,
  chaos = 1,
  strands = 1,
  className,
  active = true,
}: {
  width: number
  height?: number
  seed?: number
  intensity?: number
  postR?: number
  chaos?: number
  strands?: number
  className?: string
  active?: boolean
}) {
  const y = height * 0.42
  return (
    <div className={className} style={{ width, height }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* light spill onto surrounding metal — tight physical falloff */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: `-${height * 0.6}px -12px`,
            background:
              'radial-gradient(50% 60% at 50% 50%, rgba(47,217,208,0.16) 0%, rgba(47,217,208,0.05) 45%, transparent 75%)',
            opacity: active ? intensity : 0,
            pointerEvents: 'none',
          }}
        />
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
          <ArcBolt x1={postR + 2} y1={y} x2={width - postR - 2} y2={y} seed={seed} intensity={intensity} chaos={chaos} strands={strands} active={active} />
          {/* corona blooms at the contact points — brightest where current lands */}
          {active &&
            [postR + 2, width - postR - 2].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy={y} r={postR * 2.6} fill="var(--color-accent)" opacity={0.1 * intensity} />
                <circle cx={cx} cy={y} r={postR * 1.6} fill="var(--color-accent)" opacity={0.22 * intensity} />
                <circle cx={cx} cy={y - 1} r={postR * 0.55} fill="#eafffd" opacity={0.75 * intensity} />
              </g>
            ))}
          <ContactPost cx={postR + 2} cy={y} r={postR} />
          <ContactPost cx={width - postR - 2} cy={y} r={postR} />
        </svg>
      </div>
    </div>
  )
}
