import { useId } from 'react'
import { MAX_CHECK_INS, formatDeci, isAtCliff, punctualityDeci } from '../data/scoring'

/**
 * Charge track — punctuality.
 *
 * **Six plain sockets plus a distinct seventh, never seven identical ones.**
 * Sockets one to six are worth 0.1 each; the seventh is worth 0.4 by itself.
 * If the track doesn't say that before you reach it, the cliff is invisible
 * until you've already fallen off it — so the seventh is a physically
 * different object: a larger ornate brass annulus around a dark well.
 *
 * It stays dark and unlit like the others until earned. It is the prize, not
 * a reward already given.
 *
 * Lit sockets are **amber**: teal on this app is electricity and nothing else,
 * so it never lights a lamp. `color` exists for the roll call, where a row's
 * already-earned check-ins read in the team's colour.
 */

export interface ChargeTrackProps {
  ticks: number
  /** Width in px. Everything scales from the viewBox. */
  width?: number
  /** Plays the one-shot white-hot surge (fires on reaching seven). */
  surging?: boolean
  /** Emitted colour of a lit socket. Amber unless a caller has a reason. */
  color?: string
  /**
   * Team-sheet form: the six lamps sit in a recessed capsule cut into the row
   * plate, with a leading dash, engraved gauge ticks and a caret over the
   * seventh. Off by default so the board and roll call keep their bare tracks.
   */
  capsule?: boolean
}

const VB_W = 60
const VB_H = 14
const CY = 7
const SMALL_R = 3
const BIG_R = 4.8
const BIG_CX = 53.5
const SMALL_CX = [4, 11.4, 18.8, 26.2, 33.6, 41]

/** The capsule form insets everything to leave room for the leading dash. */
const CAP_OFF = 6

/**
 * Socket centres as a percentage of the track's width, so a label row or an
 * interaction overlay can sit on the same centres. The seventh is deliberately
 * off the six's rhythm, so a plain 7-column grid underneath does NOT line up —
 * anything driving this track has to read its geometry from here.
 */
export const SOCKET_CENTER_PCT = [...SMALL_CX, BIG_CX].map((cx) => (cx / VB_W) * 100)

/** The same centres for the capsule form, whose viewBox is wider. */
export const CAPSULE_SOCKET_PCT = [...SMALL_CX, BIG_CX].map(
  (cx) => ((cx + CAP_OFF) / (VB_W + CAP_OFF)) * 100,
)

export default function ChargeTrack({
  ticks,
  width = 60,
  surging = false,
  color = 'var(--color-lamp)',
  capsule = false,
}: ChargeTrackProps) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  const off = capsule ? CAP_OFF : 0
  const vbW = VB_W + off
  /*
   * Capsule geometry, measured off the reference row: the channel is 27 CSS px
   * tall on a 162px-wide control, a lamp is 13 across — half the channel, so
   * the channel's own brass floor shows above and below every lamp — and the
   * seventh's collar is 42, overhanging the channel top and bottom. That
   * overhang is most of what makes it read as a different object rather than a
   * bigger dot. Scaled into units: a 17-unit box, an 11-unit channel, r 2.7 and
   * r 7.4. The bare forms on the board and the roll call are untouched.
   */
  const vbH = capsule ? 17 : VB_H
  const cy = capsule ? vbH / 2 : CY
  const height = (width * vbH) / vbW
  const full = ticks >= MAX_CHECK_INS
  const cliff = isAtCliff(ticks)
  const smallCx = SMALL_CX.map((cx) => cx + off)
  const bigCx = BIG_CX + off
  /*
   * Lamp and channel are both sized off the reference rather than by eye. Its
   * lamps are 23 image px across the bezel on a 167 CSS control (0.050 of the
   * width) sitting in a 24 CSS channel — the lamp fills about seven tenths of
   * the channel's height. The build had them at 0.037 of the width in a 27 CSS
   * channel, so each lamp took under half the channel and the row read as a
   * wide empty trough with small dots at one end. Ours carries six lamps where
   * the reference draws five, so the pitch stays and the lamps grow into it.
   */
  const smallR = capsule ? 2.85 : SMALL_R
  /* `bigR` is the collar's OUTER radius; the bare form's is BIG_R + 1.3. */
  const bigR = capsule ? 7.4 : BIG_R + 1.3
  // In the capsule form the seventh's dark well is smaller, so the brass reads
  // as a heavy annulus rather than a filled disc.
  const faceR = capsule ? bigR - 3.7 : BIG_R
  const chanH = capsule ? 4.9 : 5.5
  const chanTop = cy - chanH
  const chanBot = cy + chanH
  /* the channel runs from just right of the leading dash to the collar's edge */
  const chanX = 5
  const chanR = bigCx - bigR - 0.4

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${vbW} ${vbH}`}
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
        {/* lit socket: emissive, hot core toward the light */}
        <radialGradient id={g('litFill')} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="var(--color-lamp-hot)" />
          <stop offset="66%" stopColor={color} />
          <stop offset="100%" stopColor="#7a3a10" />
        </radialGradient>
        {/*
         * The capsule's lamps sit in bezelled wells and read at 13px, so their
         * fill has to be amber rather than mostly white: a white core that wide
         * washes to peach and the row loses the amber signal entirely. The bare
         * board and roll-call tracks keep `litFill` untouched.
         */}
        <radialGradient id={g('litCap')} cx="0.38" cy="0.3" r="0.82">
          <stop offset="0%" stopColor="#fff4de" />
          <stop offset="20%" stopColor="var(--color-lamp-hot)" />
          <stop offset="52%" stopColor={color} />
          <stop offset="82%" stopColor="#e2761f" />
          <stop offset="100%" stopColor="#b25409" />
        </radialGradient>
        {/* the seventh, earned: white-hot rather than merely lit */}
        <radialGradient id={g('hotFill')} cx="0.38" cy="0.32" r="0.85">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#ffebc2" />
          <stop offset="82%" stopColor={color} />
          <stop offset="100%" stopColor="#8a4412" />
        </radialGradient>
        {/* brass bezel for the seventh */}
        <linearGradient id={g('bezel')} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#f6e3b0" />
          <stop offset="30%" stopColor="#c08a3e" />
          <stop offset="68%" stopColor="#6d4a1e" />
          <stop offset="100%" stopColor="#241708" />
        </linearGradient>
        {/*
         * The capsule's interior: a genuine recess cut into the row plate.
         * It has to sit well below the plate face in value — contrast on this
         * screen comes from darkness cut INTO the metal, not from dimming it.
         */}
        {/*
         * Sampled between two lamps the reference's channel floor is #422f21
         * against a row plate of #7a563c — 43 luma down, not 63. The build's
         * floor sat at #2b1d12 and the channel read as a hole punched through
         * the plate rather than a trough milled into it, which also killed the
         * lamps' spill: emitted light has to land on metal to be seen at all.
         */}
        <linearGradient id={g('trough')} x1="0" y1="0" x2="0.1" y2="1">
          <stop offset="0%" stopColor="#251a10" />
          <stop offset="46%" stopColor="#3d2c1e" />
          <stop offset="100%" stopColor="#5b4330" />
        </linearGradient>
        {/* the seventh's collar: brass, not the small sockets' bezel gradient */}
        <linearGradient id={g('collar')} x1="0.1" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffeec4" />
          <stop offset="22%" stopColor="#dcae56" />
          <stop offset="58%" stopColor="#a97c31" />
          <stop offset="84%" stopColor="#6b4a1c" />
          <stop offset="100%" stopColor="#3a2610" />
        </linearGradient>
      </defs>

      {capsule && (
        <>
          {/* engraved gauge ticks on the plate above and below the capsule */}
          <g strokeWidth="0.5" strokeLinecap="butt">
            <g stroke="#2b1f16">
              {[16, 26, 36].map((x) => (
                <line key={`t${x}`} x1={x} y1={0.5} x2={x} y2={2.3} />
              ))}
              {[16, 26, 36].map((x) => (
                <line key={`b${x}`} x1={x} y1={vbH - 2.3} x2={x} y2={vbH - 0.5} />
              ))}
            </g>
            {/* the lit lower lip of each cut, so a tick reads engraved not printed */}
            <g stroke="rgba(255,240,216,0.24)" transform="translate(0.45 0)">
              {[16, 26, 36].map((x) => (
                <line key={`ts${x}`} x1={x} y1={0.5} x2={x} y2={2.3} />
              ))}
              {[16, 26, 36].map((x) => (
                <line key={`bs${x}`} x1={x} y1={vbH - 2.3} x2={x} y2={vbH - 0.5} />
              ))}
            </g>
          </g>
          {/* a caret on the plate, aimed at the seventh — the one worth four */}
          <path
            d={`M${chanR - 4.4} 2.3 L${chanR - 2.6} 0.4 L${chanR - 0.8} 2.3`}
            fill="none"
            stroke="#2b1f16"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
          <path
            d={`M${chanR - 4.4} 2.8 L${chanR - 2.6} 0.9 L${chanR - 0.8} 2.8`}
            fill="none"
            stroke="rgba(255,240,216,0.22)"
            strokeWidth="0.5"
            strokeLinecap="round"
          />
          {/* the leading en dash, outside the channel, struck into the plate */}
          <line x1={0.4} y1={cy} x2={3.9} y2={cy} stroke="#3a2a19" strokeWidth="1.1" strokeLinecap="round" />
          <line
            x1={0.4}
            y1={cy + 0.85}
            x2={3.9}
            y2={cy + 0.85}
            stroke="rgba(255,240,216,0.4)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          {/*
           * The channel: a milled trough running from the leading dash to the
           * seventh's collar. It has to be tall enough that the lamps sit INSIDE
           * it with brass floor showing above and below — lamps that break its
           * top and bottom edges leave the recess reading as a shadow behind the
           * first ball rather than as a channel the lamps are seated in.
           */}
          <rect
            x={chanX}
            y={chanTop}
            width={chanR - chanX}
            height={chanBot - chanTop}
            rx={(chanBot - chanTop) / 2}
            fill={`url(#${g('trough')})`}
          />
          {/* dark inner shadow under the top-left lip, following the left cap */}
          <path
            d={`M${chanX + 0.3} ${cy + 1.6} A${chanH} ${chanH} 0 0 1 ${chanX + chanH} ${cy - chanH + 0.3} L${chanR - 3} ${cy - chanH + 0.3}`}
            fill="none"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          {/* one lit hairline along the bottom-right lip */}
          <path
            d={`M${chanX + 3.4} ${cy + chanH - 0.35} L${chanR - 3} ${cy + chanH - 0.35}`}
            fill="none"
            stroke="rgba(240,214,178,0.34)"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
        </>
      )}

      {/* ---- the six ordinary sockets ---- */}
      {smallCx.map((cx, i) => {
        const lit = i < Math.min(ticks, 6)
        /*
         * Capsule form: a brass bezel ring around a dark well with a small
         * amber core at the bottom of it. A solid amber ball is a painted dot —
         * it is the bezel and the well that make it a socket that a lamp is
         * screwed into, and the core has to be small enough that its bloom has
         * somewhere to land.
         */
        const wellR = capsule ? smallR - 0.95 : smallR
        /* lit, the lamp fills its well — the bezel is the ring around it */
        const coreR = capsule ? wellR - 0.1 : smallR
        return (
          <g key={cx}>
            {/* spill onto the surrounding metal, only from an emitting socket */}
            {lit && (
              <>
                <circle cx={cx} cy={cy} r={coreR * 2.8} fill={color} opacity={full ? 0.12 : 0.08} />
                <circle cx={cx} cy={cy} r={coreR * 2.1} fill={color} opacity={full ? 0.18 : 0.13} />
                <circle cx={cx} cy={cy} r={coreR * 1.55} fill={color} opacity={full ? 0.26 : 0.19} />
              </>
            )}
            {/* the bezel: a brass ring seated in the channel, lit top-left */}
            <circle cx={cx} cy={cy + 0.3} r={smallR} fill="rgba(0,0,0,0.55)" />
            <circle cx={cx} cy={cy} r={smallR} fill={capsule ? `url(#${g('bezel')})` : '#100a05'} />
            <path
              d={`M${cx - smallR + 0.1} ${cy} A${smallR - 0.1} ${smallR - 0.1} 0 0 1 ${cx} ${cy - smallR + 0.1}`}
              fill="none"
              stroke="rgba(255,246,222,0.62)"
              strokeWidth="0.5"
              strokeLinecap="round"
            />
            <path
              d={`M${cx + smallR - 0.1} ${cy} A${smallR - 0.1} ${smallR - 0.1} 0 0 1 ${cx} ${cy + smallR - 0.1}`}
              fill="none"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth="0.5"
              strokeLinecap="round"
            />
            {/* the well the lamp sits in */}
            <circle cx={cx} cy={cy} r={wellR} fill={`url(#${g('well')})`} />
            <path
              d={`M${cx - wellR + 0.25} ${cy + 0.3} A${wellR - 0.25} ${wellR - 0.25} 0 0 1 ${cx - 0.3} ${cy - wellR + 0.25}`}
              fill="none"
              stroke="rgba(0,0,0,0.8)"
              strokeWidth="0.45"
            />
            {/* the lamp itself */}
            {lit && (
              <circle
                cx={cx}
                cy={cy}
                r={coreR}
                fill={`url(#${g(full ? 'hotFill' : capsule ? 'litCap' : 'litFill')})`}
              />
            )}
            {/* unlit wells keep a faint inner lip so they read as machined, not blank */}
            {!lit && (
              <path
                d={`M${cx + wellR - 0.3} ${cy} A${wellR - 0.3} ${wellR - 0.3} 0 0 1 ${cx} ${cy + wellR - 0.3}`}
                fill="none"
                stroke="rgba(255,236,205,0.16)"
                strokeWidth="0.45"
              />
            )}
          </g>
        )
      })}

      {/* ---- hairline gap: the track visibly changes character here ---- */}
      {!capsule && (
        <line x1="46.4" x2="46.4" y1="2.6" y2={VB_H - 2.6} stroke="rgba(192,138,62,0.4)" strokeWidth="0.5" />
      )}

      {/* ---- the seventh: a different object entirely ---- */}
      <g>
        {full && (
          <>
            <circle cx={bigCx} cy={cy} r={bigR * 1.6} fill={color} opacity="0.12" />
            <circle cx={bigCx} cy={cy} r={bigR * 1.28} fill={color} opacity="0.2" />
            <circle cx={bigCx} cy={cy} r={bigR * 1.08} fill="#fff0d2" opacity="0.2" />
          </>
        )}
        {/*
         * The cliff, drawn BEFORE the collar so the arc's bloom lands on the
         * plate and is then overlapped by the brass: at 6 of 7 the collar's own
         * rim burns, because the seventh check-in is worth 0.4 and nothing else
         * on this row says so. Two long arcs hugging the metal, not four short
         * dashes floating clear of it — a detached dash reads as a stray mark.
         */}
        {cliff && (
          <g className="pulse-rim">
            <circle cx={bigCx} cy={cy} r={bigR * 1.72} fill="var(--color-lamp)" opacity="0.1" />
            <circle cx={bigCx} cy={cy} r={bigR * 1.34} fill="var(--color-lamp)" opacity="0.16" />
            <g
              style={{ filter: 'drop-shadow(0 0 1.4px var(--color-lamp))' }}
              stroke="var(--color-lamp)"
              strokeWidth={capsule ? 1.3 : 0.9}
              strokeLinecap="round"
              fill="none"
            >
              {[0, 1].map((i) => {
                const r = bigR + (capsule ? 1 : 0.9)
                const a0 = i * Math.PI + 0.42
                const a1 = a0 + (116 * Math.PI) / 180
                const p = (a: number) =>
                  `${(bigCx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`
                return <path key={i} d={`M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`} />
              })}
            </g>
          </g>
        )}
        {/* heavy brass annulus, contact shadow thrown down-right only */}
        <circle cx={bigCx + 0.4} cy={cy + 0.7} r={bigR} fill="rgba(0,0,0,0.55)" />
        <circle cx={bigCx} cy={cy} r={bigR} fill={`url(#${g(capsule ? 'collar' : 'bezel')})`} />
        <path
          d={`M${bigCx + bigR} ${cy} A${bigR} ${bigR} 0 0 1 ${bigCx - 0.01} ${cy + bigR}`}
          fill="none"
          stroke="rgba(26,16,5,0.7)"
          strokeWidth="0.45"
        />
        {/* engraved ornaments around the ring — a machined collar, not a flat disc */}
        {capsule
          ? /*
             * Eight engraved rosette leaves around the collar: a dark cut with a
             * lit lower lip, so each ornament reads as struck into the brass
             * under the same top-left key light as everything else. Rivet dots
             * read as a flat disc with spots on it.
             */
            Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4 - Math.PI / 2
              const rm = (bigR + faceR) / 2
              const ox = bigCx + Math.cos(a) * rm
              const oy = cy + Math.sin(a) * rm
              /*
               * A closed petal, not a chevron over a stem: a triangle with a
               * line under it is an arrowhead, and eight arrowheads pointing
               * out of a ring read as a compass rose bolted to the row rather
               * than as a rosette struck into the collar.
               */
              const leaf = (dx: number, dy: number) => {
                const x = ox + dx
                const y = oy + dy
                return (
                  `M${x.toFixed(2)} ${(y - 0.72).toFixed(2)}` +
                  ` C${(x + 0.6).toFixed(2)} ${(y - 0.18).toFixed(2)}, ${(x + 0.44).toFixed(2)} ${(y + 0.56).toFixed(2)}, ${x.toFixed(2)} ${(y + 0.74).toFixed(2)}` +
                  ` C${(x - 0.44).toFixed(2)} ${(y + 0.56).toFixed(2)}, ${(x - 0.6).toFixed(2)} ${(y - 0.18).toFixed(2)}, ${x.toFixed(2)} ${(y - 0.72).toFixed(2)} Z`
                )
              }
              return (
                <g key={i} transform={`rotate(${(a * 180) / Math.PI + 90} ${ox} ${oy})`} fill="none">
                  <path d={leaf(0, 0)} stroke="rgba(26,15,4,0.78)" strokeWidth="0.36" strokeLinejoin="round" />
                  {/*
                   * The lit lower lip of the cut. It has to stay well under the
                   * brass it is struck into: at 0.24 the eight ornaments came
                   * out brighter than the collar and read as pale arrowheads
                   * stuck on a flat disc rather than as engraving.
                   */}
                  <path
                    d={leaf(0.2, 0.24)}
                    stroke="rgba(255,246,222,0.14)"
                    strokeWidth="0.28"
                    strokeLinejoin="round"
                  />
                </g>
              )
            })
          : Array.from({ length: 12 }, (_, i) => {
              const a = (i * 2 * Math.PI) / 12 + 0.2
              return (
                <line
                  key={i}
                  x1={bigCx + Math.cos(a) * (bigR - 0.7)}
                  y1={cy + Math.sin(a) * (bigR - 0.7)}
                  x2={bigCx + Math.cos(a) * (bigR - 0.05)}
                  y2={cy + Math.sin(a) * (bigR - 0.05)}
                  stroke="rgba(26,16,5,0.55)"
                  strokeWidth="0.4"
                />
              )
            })}
        {/* key-light specular on the annulus's upper-left */}
        <path
          d={`M${bigCx - bigR + 0.3} ${cy - 1.4} A${bigR - 0.3} ${bigR - 0.3} 0 0 1 ${bigCx - 1.8} ${cy - bigR + 0.3}`}
          fill="none"
          stroke="rgba(255,246,222,0.6)"
          strokeWidth="0.55"
          strokeLinecap="round"
        />
        {/* the collar's inner lip: a turned step down into the well */}
        {capsule && (
          <>
            <circle cx={bigCx} cy={cy} r={faceR + 1} fill="rgba(122,68,38,0.5)" />
            <circle cx={bigCx} cy={cy} r={faceR + 1} fill="none" stroke="rgba(26,15,4,0.6)" strokeWidth="0.4" />
            <path
              d={`M${bigCx + faceR + 0.7} ${cy} A${faceR + 0.7} ${faceR + 0.7} 0 0 1 ${bigCx} ${cy + faceR + 0.7}`}
              fill="none"
              stroke="rgba(255,246,222,0.28)"
              strokeWidth="0.45"
            />
          </>
        )}
        {/* socket face — a dark well at the centre of the ring */}
        <circle
          cx={bigCx}
          cy={cy}
          r={faceR}
          fill={full ? `url(#${g('hotFill')})` : `url(#${g(capsule ? 'trough' : 'well')})`}
        />
        {/* starburst engraved into the face — present whether earned or not */}
        {!capsule && (
          <g opacity={full ? 0.5 : 0.42}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4
              return (
                <line
                  key={i}
                  x1={bigCx + Math.cos(a) * 1.1}
                  y1={cy + Math.sin(a) * 1.1}
                  x2={bigCx + Math.cos(a) * (BIG_R - 0.7)}
                  y2={cy + Math.sin(a) * (BIG_R - 0.7)}
                  stroke={full ? 'rgba(80,32,0,0.7)' : 'rgba(237,227,210,0.3)'}
                  strokeWidth="0.5"
                  strokeLinecap="round"
                />
              )
            })}
          </g>
        )}
        {/* inner lip of the well, lit top-left */}
        {!full && (
          <path
            d={`M${bigCx - faceR + 0.4} ${cy - 0.7} A${faceR - 0.4} ${faceR - 0.4} 0 0 1 ${bigCx - 0.7} ${cy - faceR + 0.4}`}
            fill="none"
            stroke="rgba(0,0,0,0.75)"
            strokeWidth="0.6"
          />
        )}
        {/* the surge: one white-hot flash across the whole seventh socket */}
        {surging && <circle className="surge-flash" cx={bigCx} cy={cy} r={bigR} fill="#ffffff" />}
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
  size = 9,
}: {
  ticks: number
  className?: string
  size?: number
}) {
  const shown = Math.min(ticks, MAX_CHECK_INS)
  const value = punctualityDeci(ticks)
  const cliff = isAtCliff(ticks)

  return (
    <span
      className={`font-mono inline-flex items-baseline whitespace-nowrap ${className}`}
      style={{ fontSize: size, letterSpacing: '0.04em', lineHeight: 1 }}
    >
      <span className="tabular-nums" style={{ color: 'var(--color-text)' }}>
        {shown}
      </span>
      <span style={{ color: 'var(--color-lamp)', opacity: 0.85, padding: '0 0.25em' }}>/</span>
      <span className="tabular-nums" style={{ color: 'var(--color-text)' }}>
        {MAX_CHECK_INS}
      </span>
      <span style={{ color: 'var(--color-lamp)', padding: '0 0.35em' }}>·</span>
      <span className="tabular-nums" style={{ color: 'var(--color-lamp)' }}>
        {formatDeci(value)}
      </span>
      {cliff && (
        <span className="inline-flex items-center" style={{ paddingLeft: '0.4em' }}>
          {/*
           * The arrow is drawn, not typed: JetBrains Mono's subset does not
           * carry U+2192 here, and a preview that silently loses its arrow
           * reads as "0.6 1.0" — two numbers, no promise.
           */}
          <svg
            width={size * 1.1}
            height={size * 0.62}
            viewBox="0 0 11 6"
            aria-hidden
            style={{ display: 'block' }}
          >
            <path
              d="M0.6 3 H8.6 M6.2 0.8 L8.9 3 L6.2 5.2"
              fill="none"
              stroke="var(--color-lamp)"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="tabular-nums" style={{ color: 'var(--color-lamp)', paddingLeft: '0.25em' }}>
            1.0
          </span>
        </span>
      )}
    </span>
  )
}
