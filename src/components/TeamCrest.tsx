import { useId } from 'react'
import type { TeamId } from '../data/types'

export const teamColor = (id: TeamId) => `var(--color-team-${id})`

/** Team hexes mirror theme.css tokens (validated by scripts/validate-tokens.mjs). */
export const TEAM_HEX: Record<TeamId, string> = {
  turquoise: '#2fd9d0',
  crimson: '#d9433f',
  sunburst: '#e0a33c',
  lime: '#7fb93f',
  violet: '#9b6dd1',
  cobalt: '#3d7ed9',
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

/**
 * Bold geometric emblems, one per team, embossed into a colored enamel disc.
 * Paths live in a 48×48 box.
 */
const EMBLEMS: Record<TeamId, string> = {
  turquoise:
    'M24 7 L29 18 L26.5 18 L26.5 30 L21.5 30 L21.5 18 L19 18 Z M13 14 L18.5 22 L15.5 30 L11 22 Z M35 14 L29.5 22 L32.5 30 L37 22 Z M18 33 L30 33 L24 41 Z',
  crimson: 'M10 12 L20 12 L24 22 L28 12 L38 12 L27 36 L21 36 Z M20.5 40 L27.5 40 L24 33 Z',
  sunburst:
    'M24 16.5 A7.5 7.5 0 1 1 23.9 16.5 Z ' +
    Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6
      const x = (r: number) => 24 + Math.cos(a) * r
      const y = (r: number) => 24 + Math.sin(a) * r
      const b = a + 0.16
      const c = a - 0.16
      return `M${(24 + Math.cos(c) * 9).toFixed(1)} ${(24 + Math.sin(c) * 9).toFixed(1)} L${x(19).toFixed(1)} ${y(19).toFixed(1)} L${(24 + Math.cos(b) * 9).toFixed(1)} ${(24 + Math.sin(b) * 9).toFixed(1)} Z`
    }).join(' '),
  lime: 'M24 8 L40 38 L8 38 Z M24 17 L33.5 34.5 L14.5 34.5 Z M24 24 L29 33 L19 33 Z',
  violet: 'M24 6 L37 22 L24 38 L11 22 Z M24 13 L31.5 22 L24 31 L16.5 22 Z M24 34 L30 41 L24 47 L18 41 Z',
  cobalt: 'M24 8 L37 21 L30.5 21 L24 14.5 L17.5 21 L11 21 Z M24 20 L37 33 L30.5 33 L24 26.5 L17.5 33 L11 33 Z M24 32 L31 39 L24 46 L17 39 Z',
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
