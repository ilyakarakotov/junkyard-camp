import { useId } from 'react'
import { MAX_CHECK_INS, formatDeci, isAtCliff, punctualityDeci } from '../data/scoring'

/**
 * Charge track — punctuality.
 *
 * **Six plain sockets plus a distinct seventh, never seven identical ones.**
 * Sockets one to six are worth 0.1 each; the seventh is worth 0.4 by itself.
 * If the track doesn't say that before you reach it, the cliff is invisible
 * until you've already fallen off it — so the seventh is a physically
 * different object: larger, heavy brass bezel, starburst engraved in the face.
 *
 * It stays dark and unlit like the others until earned. It is the prize, not
 * a reward already given.
 */

export interface ChargeTrackProps {
  ticks: number
  /** Width in px. Everything scales from the viewBox. */
  width?: number
  /** Plays the one-shot white-hot surge (fires on reaching seven). */
  surging?: boolean
}

const VB_W = 60
const VB_H = 14
const CY = 7
const SMALL_R = 3
const BIG_R = 4.8
const BIG_CX = 53.5
const SMALL_CX = [4, 11.4, 18.8, 26.2, 33.6, 41]

export default function ChargeTrack({ ticks, width = 60, surging = false }: ChargeTrackProps) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  const height = (width * VB_H) / VB_W
  const full = ticks >= MAX_CHECK_INS
  const cliff = isAtCliff(ticks)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={`Punctuality ${Math.min(ticks, MAX_CHECK_INS)} of ${MAX_CHECK_INS}`}
    >
      <defs>
        {/* unlit socket: a real well — darkest under the top-left lip */}
        <radialGradient id={g('well')} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#050302" />
          <stop offset="60%" stopColor="#100b06" />
          <stop offset="100%" stopColor="#1d1509" />
        </radialGradient>
        {/* lit socket: emissive teal, hot core toward the light */}
        <radialGradient id={g('litFill')} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#c9fffb" />
          <stop offset="65%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="#0e6b66" />
        </radialGradient>
        {/* the seventh, earned: white-hot rather than merely teal */}
        <radialGradient id={g('hotFill')} cx="0.38" cy="0.32" r="0.85">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e6fffd" />
          <stop offset="80%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="#12857f" />
        </radialGradient>
        {/* brass bezel for the seventh */}
        <linearGradient id={g('bezel')} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#f6e3b0" />
          <stop offset="30%" stopColor="#c08a3e" />
          <stop offset="68%" stopColor="#6d4a1e" />
          <stop offset="100%" stopColor="#241708" />
        </linearGradient>
      </defs>

      {/* ---- the six ordinary sockets ---- */}
      {SMALL_CX.map((cx, i) => {
        const lit = i < Math.min(ticks, 6)
        return (
          <g key={cx}>
            {/* spill onto the surrounding metal, only from an emitting socket */}
            {lit && (
              <>
                <circle cx={cx} cy={CY} r={SMALL_R * 2.6} fill="var(--color-accent)" opacity={full ? 0.2 : 0.13} />
                <circle cx={cx} cy={CY} r={SMALL_R * 1.7} fill="var(--color-accent)" opacity={full ? 0.34 : 0.24} />
              </>
            )}
            {/* rim: brass ring catching the key light top-left */}
            <circle cx={cx} cy={CY} r={SMALL_R + 0.7} fill="#100a05" />
            <path
              d={`M${cx - SMALL_R - 0.5} ${CY} A${SMALL_R + 0.5} ${SMALL_R + 0.5} 0 0 1 ${cx} ${CY - SMALL_R - 0.5}`}
              fill="none"
              stroke="rgba(255,236,205,0.3)"
              strokeWidth="0.55"
            />
            <path
              d={`M${cx + SMALL_R + 0.5} ${CY} A${SMALL_R + 0.5} ${SMALL_R + 0.5} 0 0 1 ${cx} ${CY + SMALL_R + 0.5}`}
              fill="none"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth="0.55"
            />
            <circle
              cx={cx}
              cy={CY}
              r={SMALL_R}
              fill={lit ? `url(#${g(full ? 'hotFill' : 'litFill')})` : `url(#${g('well')})`}
            />
            {/* unlit wells keep a faint inner lip so they read as machined, not blank */}
            {!lit && (
              <path
                d={`M${cx - SMALL_R + 0.4} ${CY - 0.6} A${SMALL_R - 0.4} ${SMALL_R - 0.4} 0 0 1 ${cx - 0.4} ${CY - SMALL_R + 0.4}`}
                fill="none"
                stroke="rgba(255,236,205,0.14)"
                strokeWidth="0.5"
              />
            )}
          </g>
        )
      })}

      {/* ---- hairline gap: the track visibly changes character here ---- */}
      <line x1="46.4" x2="46.4" y1="2.6" y2={VB_H - 2.6} stroke="rgba(192,138,62,0.4)" strokeWidth="0.5" />

      {/* ---- the seventh: a different object entirely ---- */}
      <g>
        {full && (
          <>
            <circle cx={BIG_CX} cy={CY} r={BIG_R * 2.9} fill="var(--color-accent)" opacity="0.2" />
            <circle cx={BIG_CX} cy={CY} r={BIG_R * 1.9} fill="var(--color-accent)" opacity="0.3" />
            <circle cx={BIG_CX} cy={CY} r={BIG_R * 1.25} fill="#eafffd" opacity="0.28" />
          </>
        )}
        {/* heavy brass bezel */}
        <circle cx={BIG_CX} cy={CY + 0.35} r={BIG_R + 1.4} fill="rgba(0,0,0,0.6)" />
        <circle cx={BIG_CX} cy={CY} r={BIG_R + 1.3} fill={`url(#${g('bezel')})`} />
        <circle cx={BIG_CX} cy={CY} r={BIG_R + 1.3} fill="none" stroke="#1a1005" strokeWidth="0.4" />
        {/* bezel knurl ticks — reads as a machined collar, not a flat ring */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6
          return (
            <line
              key={i}
              x1={BIG_CX + Math.cos(a) * (BIG_R + 0.6)}
              y1={CY + Math.sin(a) * (BIG_R + 0.6)}
              x2={BIG_CX + Math.cos(a) * (BIG_R + 1.25)}
              y2={CY + Math.sin(a) * (BIG_R + 1.25)}
              stroke="rgba(26,16,5,0.55)"
              strokeWidth="0.4"
            />
          )
        })}
        {/* the cliff: at 6 of 7 the rim pulses, because the next one is worth 0.4 */}
        {cliff && (
          <circle
            className="pulse-rim"
            cx={BIG_CX}
            cy={CY}
            r={BIG_R + 1.9}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="0.8"
          />
        )}
        {/* socket face */}
        <circle cx={BIG_CX} cy={CY} r={BIG_R} fill={full ? `url(#${g('hotFill')})` : `url(#${g('well')})`} />
        {/* starburst engraved into the face — present whether earned or not */}
        <g opacity={full ? 0.5 : 0.42}>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return (
              <line
                key={i}
                x1={BIG_CX + Math.cos(a) * 1.1}
                y1={CY + Math.sin(a) * 1.1}
                x2={BIG_CX + Math.cos(a) * (BIG_R - 0.7)}
                y2={CY + Math.sin(a) * (BIG_R - 0.7)}
                stroke={full ? 'rgba(12,60,58,0.75)' : 'rgba(237,227,210,0.3)'}
                strokeWidth="0.5"
                strokeLinecap="round"
              />
            )
          })}
          <circle
            cx={BIG_CX}
            cy={CY}
            r="1"
            fill="none"
            stroke={full ? 'rgba(12,60,58,0.8)' : 'rgba(237,227,210,0.34)'}
            strokeWidth="0.5"
          />
        </g>
        {/* inner lip of the well, lit top-left */}
        {!full && (
          <path
            d={`M${BIG_CX - BIG_R + 0.5} ${CY - 0.8} A${BIG_R - 0.5} ${BIG_R - 0.5} 0 0 1 ${BIG_CX - 0.8} ${CY - BIG_R + 0.5}`}
            fill="none"
            stroke="rgba(255,236,205,0.18)"
            strokeWidth="0.55"
          />
        )}
        {/* the surge: one white-hot flash across the whole seventh socket */}
        {surging && (
          <circle className="surge-flash" cx={BIG_CX} cy={CY} r={BIG_R + 1.3} fill="#ffffff" />
        )}
      </g>
    </svg>
  )
}

/**
 * The numeric companion. At the cliff it previews the jump rather than the
 * increment, because 6/7 -> 7/7 is worth 0.4 and nothing else on this screen
 * says so.
 */
export function ChargeReadout({
  ticks,
  className = '',
  size = 13,
}: {
  ticks: number
  className?: string
  size?: number
}) {
  const shown = Math.min(ticks, MAX_CHECK_INS)
  const value = punctualityDeci(ticks)
  const cliff = isAtCliff(ticks)

  return (
    <span className={`inline-flex items-baseline gap-[5px] ${className}`} style={{ fontSize: size }}>
      <span className="numeral tabular-nums" style={{ color: 'var(--color-text)' }}>
        {shown}
      </span>
      <span className="tech-label" style={{ fontSize: size * 0.62, opacity: 0.7 }}>
        / {MAX_CHECK_INS}
      </span>
      <span className="numeral tabular-nums" style={{ color: 'var(--color-text-dim)', marginLeft: 2 }}>
        {formatDeci(value)}
      </span>
      {cliff && (
        <span
          className="numeral tabular-nums"
          style={{ color: 'var(--color-accent)', fontSize: size * 0.92 }}
        >
          →&nbsp;1.0
        </span>
      )}
    </span>
  )
}
