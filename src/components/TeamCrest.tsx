import { useId } from 'react'
import type { TeamId } from '../data/types'

export const teamColor = (id: TeamId) => `var(--color-team-${id})`

/** Team hexes mirror theme.css tokens (validated by scripts/validate-tokens.mjs). */
export const TEAM_HEX: Record<TeamId, string> = {
  warriors: '#ff5fb8',
  precious: '#b14dff',
  gems: '#3d9bff',
  pearls: '#96f5b4',
  knights: '#ff4438',
  innocent: '#ffd84d',
  forged: '#78d62e',
  rustco: '#ff9440',
}

function shade(hex: string, f: number): string {
  // f > 0 lightens toward white, f < 0 darkens toward black.
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => {
    const c = (n >> shift) & 0xff
    const v = f >= 0 ? c + (255 - c) * f : c * (1 + f)
    return Math.round(Math.min(255, Math.max(0, v)))
  }
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`
}

/** Ring of `n` gear teeth between two radii, centred on the 48×48 box. */
function cogTeeth(n: number, rInner: number, rOuter: number, halfIn: number, halfOut: number): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n
    const p = (r: number, off: number) =>
      `${(24 + Math.cos(a + off) * r).toFixed(1)} ${(24 + Math.sin(a + off) * r).toFixed(1)}`
    return `M${p(rInner, -halfIn)} L${p(rOuter, -halfOut)} L${p(rOuter, halfOut)} L${p(rInner, halfIn)} Z`
  }).join(' ')
}

/** Circle as a path, so emblems stay one flat `d` string under evenodd fill. */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.1} ${cy - r} Z`

/**
 * Bold geometric emblems, one per team, embossed into a colored enamel disc.
 * Paths live in a 48×48 box and are filled `evenodd`, so a shape drawn inside
 * another cuts a hole — that is how the interior facets and grooves are made.
 *
 * Each reads at 26px on the board row, which is the real constraint: anything
 * needing fine detail to be identifiable is the wrong emblem.
 */
const EMBLEMS: Record<TeamId, string> = {
  // Crossed blades over a central boss (the boss re-fills the crossing).
  warriors:
    'M12.8 9.2 L38.8 35.2 L35.2 38.8 L9.2 12.8 Z ' +
    'M38.8 12.8 L12.8 38.8 L9.2 35.2 L35.2 9.2 Z ' +
    'M24 18 L30 24 L24 30 L18 24 Z',
  // Tall kite-cut gem: crown facet cut out, core left proud.
  precious:
    'M24 5 L38 20 L24 43 L10 20 Z M24 11 L32.5 20 L24 34 L15.5 20 Z M24 16 L28.5 20.5 L24 27 L19.5 20.5 Z',
  // Round brilliant, wider and shallower than PRECIOUS so the two never blur.
  gems: 'M15 10 L33 10 L42 20 L24 42 L6 20 Z M19 15 L29 15 L34.5 20.5 L24 33 L13.5 20.5 Z M21.5 19 L26.5 19 L28.5 22 L24 27.5 L19.5 22 Z',
  // Pearl seated in an open shell.
  pearls:
    circle(24, 16, 7.5) +
    ' M6 28 A18 18 0 0 0 42 28 Z' +
    ' M22.6 29.5 L25.4 29.5 L26.2 41.2 L21.8 41.2 Z',
  // Flame with an inner flame cut out of it.
  knights:
    'M24 4 L30 14 L33.5 11.5 L36 25 A12 12 0 1 1 12 25 L14.5 11.5 L18 14 Z ' +
    'M24 17 L28 24 A4.6 4.6 0 1 1 20 24 Z',
  // Heart, cut with an inner heart.
  innocent:
    'M24 41 L9 25.5 A8.6 8.6 0 0 1 24 14.5 A8.6 8.6 0 0 1 39 25.5 Z ' +
    'M24 33.5 L15 24.6 A4.6 4.6 0 0 1 24 20.4 A4.6 4.6 0 0 1 33 24.6 Z',
  // Anvil: horn left, waisted body, splayed foot.
  forged:
    'M6 22 L15 17.5 L42 17.5 L42 25 L30.5 25 L30.5 31 L34.5 31 L37 41.5 L11 41.5 L13.5 31 L17.5 31 L17.5 25 L6 25 Z',
  // Cog with a bored centre.
  rustco: circle(24, 24, 15.5) + ' ' + cogTeeth(10, 14, 21, 0.2, 0.13) + ' ' + circle(24, 24, 6.2),
}

export interface TeamCrestProps {
  teamId: TeamId
  size?: number
  /** 0..1 emissive rim + emblem glow (leader / confirmation states). */
  glow?: number
}

export default function TeamCrest({ teamId, size = 64, glow = 0 }: TeamCrestProps) {
  const uid = useId()
  const hex = TEAM_HEX[teamId]
  const g = (name: string) => `${name}-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ display: 'block' }}>
      <defs>
        <linearGradient id={g('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2dca6" />
          <stop offset="26%" stopColor="#a97e3c" />
          <stop offset="58%" stopColor="#5c421c" />
          <stop offset="100%" stopColor="#241708" />
        </linearGradient>
        <linearGradient id={g('rimDark')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7d5c28" />
          <stop offset="50%" stopColor="#4e3818" />
          <stop offset="100%" stopColor="#1d1206" />
        </linearGradient>
        {/* cast-brass pitting on the bezel (~3.5 CSS px cells at render size) */}
        <filter id={g('pit')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="3" seed="5" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.06  0 0 0 0 0.055  0 0 0 0 0.02  0 0 0 0.72 0" />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
        {/* verdigris tarnish, pooling toward the unlit lower-right */}
        <filter id={g('verd')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" seed="29" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.18  0 0 0 0 0.22  0 0 0 0 0.13  0 0 0 0.45 0" />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
        <linearGradient id={g('verdMaskG')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="35%" stopColor="#000" />
          <stop offset="100%" stopColor="#fff" />
        </linearGradient>
        <mask id={g('verdMask')}>
          <circle cx="32" cy="32" r="29" fill={`url(#${g('verdMaskG')})`} />
        </mask>
        {/* enamel speckle (~2.4 CSS px cells), colored not just alpha */}
        <filter id={g('spk')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.52" numOctaves="3" seed="8" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0.42 0" />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
        <radialGradient id={g('enamel')} cx="0.42" cy="0.38" r="0.95">
          <stop offset="0%" stopColor={shade(hex, -0.18)} />
          <stop offset="55%" stopColor={shade(hex, -0.3)} />
          <stop offset="85%" stopColor={shade(hex, -0.54)} />
          <stop offset="100%" stopColor={shade(hex, -0.68)} />
        </radialGradient>
      </defs>

      {/* contact shadow under the whole medallion */}
      <ellipse cx="32" cy="35" rx="28.5" ry="27.5" fill="rgba(0,0,0,0.5)" />

      {/* outer dark retaining rim */}
      <circle cx="32" cy="32" r="29" fill={`url(#${g('rimDark')})`} />
      {/* main brass bezel */}
      <circle cx="32" cy="32" r="27" fill={`url(#${g('rim')})`} />
      {/* bezel pitting + verdigris tarnish toward the unlit side */}
      <circle cx="32" cy="32" r="27" filter={`url(#${g('pit')})`} opacity="0.9" />
      <circle cx="32" cy="32" r="27" filter={`url(#${g('verd')})`} mask={`url(#${g('verdMask')})`} opacity="0.85" />
      {/* bezel sheen: broken into worn segments, eaten by the pitting */}
      <path d="M 9 26 A 24 24 0 0 1 14.5 16.5" fill="none" stroke="rgba(255,236,200,0.5)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M 17 13.6 A 24 24 0 0 1 21 10.9" fill="none" stroke="rgba(255,236,200,0.35)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 23.5 9.7 A 24 24 0 0 1 26 9" fill="none" stroke="rgba(255,236,200,0.45)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 55 38 A 24 24 0 0 1 38 55" fill="none" stroke="rgba(20,12,4,0.5)" strokeWidth="2.6" strokeLinecap="round" />
      {/* inner groove between bezel and enamel */}
      <circle cx="32" cy="32" r="21.8" fill="#160f08" />
      {/* bezel screws at compass points */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        const cx = 32 + Math.cos(a) * 24.4
        const cy = 32 + Math.sin(a) * 24.4
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="1.7" fill="#3a2a12" />
            <circle cx={cx - 0.4} cy={cy - 0.5} r="0.9" fill="#d9b06a" opacity="0.8" />
          </g>
        )
      })}

      {/* seat shadow where the disc meets the bezel, offset down-right */}
      <circle cx="32.6" cy="32.8" r="20.3" fill="rgba(0,0,0,0.5)" />
      {/* matte enamel disc, recessed: inner shadow darkest at the top-left lip */}
      <circle cx="32" cy="32" r="20" fill={`url(#${g('enamel')})`} />
      {/* enamel micro-speckle */}
      <circle cx="32" cy="32" r="20" filter={`url(#${g('spk')})`} opacity="0.55" />
      {/* grime settled in the seat where the disc meets the bezel */}
      <circle cx="32" cy="32" r="19.2" fill="none" stroke="rgba(18,10,4,0.55)" strokeWidth="2.2" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="1.4" />
      <path d="M 14 24 A 19.4 19.4 0 0 1 25 13.4" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2.2" strokeLinecap="round" />
      {/* enamel is glossier than brass: broken specular arc, top-left */}
      <path d="M 20 26 A 13 13 0 0 1 26 19.5" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M 28.5 18.3 A 13 13 0 0 1 31 17.8" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1.6" strokeLinecap="round" />

      {glow > 0 && (
        <circle
          cx="32"
          cy="32"
          r="21"
          fill="none"
          stroke={hex}
          strokeWidth="1.4"
          opacity={0.9 * glow}
          style={{ filter: `drop-shadow(0 0 4px ${hex})` }}
        />
      )}

      {/*
       * Engraved glyph, cut INTO the enamel: dark top-left edge (shadowed
       * wall), light bottom-right edge (lit wall), darker recessed floor.
       */}
      <g transform="translate(11.5 11.5) scale(0.855)">
        <path d={EMBLEMS[teamId]} fill="rgba(0,0,0,0.55)" fillRule="evenodd" transform="translate(-0.7 -0.9)" />
        <path d={EMBLEMS[teamId]} fill={shade(hex, 0.22)} fillRule="evenodd" transform="translate(0.7 0.9)" opacity="0.55" />
        <path d={EMBLEMS[teamId]} fill={shade(hex, -0.52)} fillRule="evenodd" />
      </g>

      {/* tight specular on the bezel rim only, top-left */}
      <path d="M 13.5 20.5 A 22 22 0 0 1 21 12.8" fill="none" stroke="rgba(255,244,214,0.5)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
