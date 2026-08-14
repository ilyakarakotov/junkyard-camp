import { useId } from 'react'

/**
 * Breaker switch — the five binary categories.
 *
 * Thrown up = the paddle emits in the team colour and spills light onto the
 * housing around it. Thrown down = dark engraved metal with the category
 * glyph cut into the paddle face.
 *
 * The unearned state is **visible engraved metal, never an empty hole**: you
 * must be able to read what a team is missing as easily as what they earned,
 * which is the whole reason this is a switch and not a lit dot.
 *
 * Bloom is faked with stacked low-opacity rects rather than feGaussianBlur —
 * these render eight-to-a-row on a mid-range Android and a blur filter per
 * cell is not affordable.
 */

export interface BreakerProps {
  on: boolean
  /** Team colour: a CSS colour or `var(--color-team-*)`. */
  color: string
  /** Width in px. Height follows at 29/22. */
  size?: number
  /** Engraved abbreviation on the paddle face (board columns are unlabelled). */
  glyph?: string
  title?: string
}

const VB_W = 22
const VB_H = 29

export default function Breaker({ on, color, size = 22, glyph, title }: BreakerProps) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  const height = (size * VB_H) / VB_W

  // Paddle travel: up when earned, down when not.
  const paddleY = on ? 5.4 : 15.2
  const paddleH = 8.4

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={title ? `${title}: ${on ? 'earned' : 'not earned'}` : undefined}
    >
      <defs>
        {/* housing: brown steel, key light top-left */}
        <linearGradient id={g('house')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a2c1e" />
          <stop offset="45%" stopColor="#241c16" />
          <stop offset="100%" stopColor="#160f09" />
        </linearGradient>
        {/* slot floor: true recess, darkest under the top-left lip */}
        <linearGradient id={g('slot')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#080503" />
          <stop offset="40%" stopColor="#130d07" />
          <stop offset="100%" stopColor="#1c140c" />
        </linearGradient>
        {/* unearned paddle: machined metal, lit along its top edge */}
        <linearGradient id={g('dark')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d5a45" />
          <stop offset="18%" stopColor="#463629" />
          <stop offset="60%" stopColor="#2b2118" />
          <stop offset="100%" stopColor="#181009" />
        </linearGradient>
        {/* earned paddle: emissive, hottest just below the lit top edge */}
        <linearGradient id={g('lit')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff8ec" />
          <stop offset="22%" stopColor={color} />
          <stop offset="70%" stopColor={color} />
          <stop offset="100%" stopColor="#20160d" />
        </linearGradient>
      </defs>

      {/* light thrown onto the surrounding metal — tight falloff, only when emitting */}
      {on && (
        <g opacity="0.9">
          <rect x={-5} y={paddleY - 6} width={VB_W + 10} height={paddleH + 12} rx={7} fill={color} opacity="0.1" />
          <rect x={-2} y={paddleY - 3} width={VB_W + 4} height={paddleH + 6} rx={5} fill={color} opacity="0.16" />
        </g>
      )}

      {/* housing plate */}
      <rect x="0.6" y="0.6" width={VB_W - 1.2} height={VB_H - 1.2} rx="2.6" fill={`url(#${g('house')})`} />
      {/* chamfer: lit top-left, shadowed bottom-right */}
      <path
        d={`M1.2 ${VB_H - 3.4} L1.2 3.2 A2 2 0 0 1 3.2 1.2 L${VB_W - 3.2} 1.2`}
        fill="none"
        stroke="rgba(255,236,205,0.22)"
        strokeWidth="0.8"
      />
      <path
        d={`M${VB_W - 1.2} 3.4 L${VB_W - 1.2} ${VB_H - 3.2} A2 2 0 0 1 ${VB_W - 3.2} ${VB_H - 1.2} L3.2 ${VB_H - 1.2}`}
        fill="none"
        stroke="rgba(0,0,0,0.65)"
        strokeWidth="0.8"
      />

      {/* slot recess — always visible, so an unearned category still reads as a thing */}
      <rect x="4.2" y="3.6" width={VB_W - 8.4} height={VB_H - 7.2} rx="1.8" fill={`url(#${g('slot')})`} />
      <rect
        x="4.2"
        y="3.6"
        width={VB_W - 8.4}
        height={VB_H - 7.2}
        rx="1.8"
        fill="none"
        stroke="rgba(0,0,0,0.8)"
        strokeWidth="0.7"
      />
      {/* engraved travel ticks either side of the slot */}
      {[6.2, 22.2].map((y) => (
        <g key={y}>
          <line x1="2.4" x2="3.6" y1={y} y2={y} stroke="rgba(237,227,210,0.2)" strokeWidth="0.7" />
          <line x1={VB_W - 3.6} x2={VB_W - 2.4} y1={y} y2={y} stroke="rgba(237,227,210,0.2)" strokeWidth="0.7" />
        </g>
      ))}

      {/* paddle */}
      <g style={{ transition: 'transform 180ms cubic-bezier(0.3, 0.9, 0.4, 1)' }}>
        {/* seat shadow under the paddle, offset with the key light */}
        <rect x="5.6" y={paddleY + 1} width={VB_W - 11.2} height={paddleH} rx="1.4" fill="rgba(0,0,0,0.6)" />
        <rect
          x="5.2"
          y={paddleY}
          width={VB_W - 10.4}
          height={paddleH}
          rx="1.4"
          fill={on ? `url(#${g('lit')})` : `url(#${g('dark')})`}
          stroke={on ? 'rgba(0,0,0,0.5)' : '#0d0804'}
          strokeWidth="0.6"
        />
        {/* crisp specular on the paddle's top edge */}
        <line
          x1="6.2"
          x2={VB_W - 6.2}
          y1={paddleY + 0.7}
          y2={paddleY + 0.7}
          stroke={on ? 'rgba(255,255,255,0.9)' : 'rgba(255,236,205,0.34)'}
          strokeWidth="0.7"
        />
        {/*
         * Engraved glyph on the unearned face. Suppressed below ~30px: on the
         * board row the column header already carries the name, and three
         * illegible letters there read as dirt rather than as an engraving.
         */}
        {!on && glyph && size >= 30 && (
          <text
            x={VB_W / 2}
            y={paddleY + paddleH / 2 + 1.7}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="4.4"
            fill="rgba(237,227,210,0.34)"
            style={{ letterSpacing: '0.02em' }}
          >
            {glyph}
          </text>
        )}
        {/* knurl on the earned paddle so it still reads as a machined object */}
        {on && (
          <g opacity="0.4">
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                x1="7"
                x2={VB_W - 7}
                y1={paddleY + 3.4 + i * 1.7}
                y2={paddleY + 3.4 + i * 1.7}
                stroke="rgba(0,0,0,0.55)"
                strokeWidth="0.5"
              />
            ))}
          </g>
        )}
      </g>
    </svg>
  )
}
