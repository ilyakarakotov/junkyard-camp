import { useId, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DayRail from '../components/DayRail'
import TeamCrest from '../components/TeamCrest'
import { CogKnob, Plate, Well, textureOffset } from '../components/chrome'
import { dayScores } from '../data/derive'
import { BINARY_CATEGORIES, formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { CategoryId, Team } from '../data/types'

/**
 * The day at a glance.
 *
 * **Read-and-navigate only — nothing mutates from here.** The cells are 14px;
 * a mis-tap that silently scores a team while the kids are watching is
 * unacceptable. A category cell opens Roll Call, a row opens the Team Sheet.
 *
 * Geometry follows design/reference/v2/01-board.jpg, measured at 390px CSS.
 * Every row is its own plate with a wall gap, because the gap between plates —
 * the wall showing through — is what makes eight rows read as eight pieces of
 * hardware rather than one list.
 *
 * The rows are sized to *fill* the viewport rather than to copy the concept
 * render's 700px canvas literally. Dead wall below the footer is the single
 * biggest reason a screenshot measures darker than the reference: unlit wall is
 * L≈13, plate face is L≈85, so 100px of empty wall drags the median down by
 * more than any amount of material tuning can put back. Brighten the screen by
 * spending it on metal, never by adding unmotivated glow.
 *
 * Vertical budget at 390×844, and it adds to 844 exactly — no scroll, no wall
 * left over: 8 pad · 40 header · 2+58−4 day rail · 8×80 rows on 8px gutters ·
 * 8 gap · 32 footer · 4 pad. Every row top lands on a multiple of 8
 * (104, 192, 280 … 720) and every internal offset is a whole pixel — the
 * sockets and cells used to sit on half-pixel edges off a 17.5px pitch.
 */

const ROW_H = 80
/** 8px gutters, as REFERENCE-SPEC asks: the wall shows through between plates. */
const ROW_GAP = 8
const RANK_W = 32
/**
 * The reference chip measures 30×32 CSS — near square, not the tall slot we
 * had. A 32×52 chip puts 20px of dark floor above and below the numerals for
 * nothing, and dark floor is the one thing this screen has too much of.
 */
const RANK_H = 34
const CREST = 66
/**
 * The recessed channel carrying the name and the binary cells. Its left end
 * runs *under* the medallion — the coin overhangs the recess, which is what
 * makes the two read as separate pieces of hardware stacked in depth.
 */
const CH_L = 98
const CH_R = 60
const CH_TOP = 6
const CH_H = 36
/** The channel's right edge; the key capsule and the cells both end on it. */
const CH_RIGHT = 374 - CH_R
/**
 * The name's left edge and the first punctuality socket's left edge share one
 * column. That single alignment is most of why the reference row reads
 * machined rather than laid out.
 */
const COL2 = 120
const NAME_W = 90
const SCORE_W = 48
/** Six punctuality sockets, then a dash, then the seventh as a cog knob. */
const PUNCT_PITCH = 17
/** A socket is a brass collar with a dark bore; the lamp sits inside the bore. */
const SOCKET = 14
const BORE = 7
const DASH_X = 222
const DASH_W = 8
const COG = 22
const COG_X = 232
/** Tier two — sockets, dash, knob, keys — hangs off one shared centre line. */
const TIER2_MID = 59
/** The key capsule shares its right edge with the channel above it. */
const KEYS_W = 56
/** A narrow slot, as on the reference: the key bows overhang its top lip. */
const KEYS_H = 16
const KEYS_X = CH_RIGHT - KEYS_W
const KEY_SLOTS = 3
/**
 * Measured off the reference key rail: bow 10.5 CSS across, key 25.6 tall,
 * pitch 16.6, bow overhanging the top lip and the bit finishing on the bottom
 * one. A 22×46 viewBox at 13 CSS wide puts the drawn body at 25.4 tall.
 */
const KEY_W = 13
const KEY_H = 27
const KEY_PITCH = 16
const KEY_TOP = -8
/** Five binary cells, right-aligned 7px inside the channel's right edge. */
const CELL = 14
const CELL_GAP = 5
const CELLS_W = 5 * CELL + 4 * CELL_GAP
const SCREW = 6

/**
 * Warm oxide. Painted as an overlay rather than baked into the plate, because
 * rust is a *place* — a crevice, a lower edge, the end of a strip that has sat
 * against a damp wall — and a place needs a mask, not a texture wash.
 *
 * **Oxide is darker than the metal it eats.** Sampled on the reference footer,
 * a rust patch reads #856956 (L 114) against clean strip #8b725e (L 118): nine
 * L *down*, same hue, soft edged. The previous pigment was a saturated orange
 * that composited 32 L *up* — bright orange islands on a lit face, which is
 * the loudest AI tell a metal screen can carry. So the pigment is now a dark
 * red-brown laid at low alpha: at the ~0.32 peak it lands a plate face at
 * roughly −15 L and shifts it toward red, which is what a stain does.
 *
 * It stays masked rather than washed — placement layers say *where*, the noise
 * says *how much* — and it never touches a lit face, only lower lips, weather
 * ends, shadow sides and bolt seats.
 */
const OXIDE_PIGMENT =
  'linear-gradient(158deg, #6f3d1a 0%, #5a2e13 34%, #46220e 62%, #2f1608 100%)'
/** Mottling within the rust itself, so a patch is not one flat colour. */
const OXIDE_MOTTLE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='150'%3E%3Cfilter id='o2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.032 0.07' numOctaves='4' seed='37' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.19 0 0 0 0 0.08 0 0 0 0 0.03 0 0 0 1 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0 0.2 0.5 0.8'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='300' height='150' filter='url(%23o2)'/%3E%3C/svg%3E\")"
/**
 * Where the pigment survives. The ramp used to be `0 0 0 0.9 1` — a step, so
 * every patch had a hard cut edge and read as a decal. It now climbs, so a
 * stain fades out into clean metal the way a stain does.
 */
const OXIDE_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120'%3E%3Cfilter id='o'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.05 0.09' numOctaves='4' seed='19' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0 0.12 0.42 0.8'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='240' height='120' filter='url(%23o)'/%3E%3C/svg%3E\")"

/**
 * An oxide decal. `mask` decides where the rust is allowed to be — always a
 * crevice, a lower edge or a weather-facing end, never the whole face. It is
 * intersected with the noise, so placement and texture both have to agree.
 */
function Oxide({
  mask,
  opacity,
  offset = '0px 0px',
  radius,
}: {
  /** Placement layers. They union with each other, then intersect the noise. */
  mask: string[]
  opacity: number
  offset?: string
  radius?: number | string
}) {
  const rest = mask.map(() => 'auto')
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        zIndex: 0,
        borderRadius: radius ?? 'inherit',
        opacity,
        backgroundImage: `${OXIDE_MOTTLE}, ${OXIDE_PIGMENT}`,
        backgroundSize: '300px 150px, auto',
        backgroundPosition: `${offset}, 0 0`,
        maskImage: [OXIDE_NOISE, ...mask].join(', '),
        WebkitMaskImage: [OXIDE_NOISE, ...mask].join(', '),
        maskSize: ['240px 120px', ...rest].join(', '),
        WebkitMaskSize: ['240px 120px', ...rest].join(', '),
        maskPosition: [offset, ...mask.map(() => '0 0')].join(', '),
        WebkitMaskPosition: [offset, ...mask.map(() => '0 0')].join(', '),
        // The noise cuts into the union of the placement layers below it.
        maskComposite: ['intersect', ...mask.map(() => 'add')].join(', '),
        WebkitMaskComposite: ['source-in', ...mask.map(() => 'source-over')].join(', '),
      }}
    />
  )
}

/** A chamfered rectangle — the reference cuts every plate corner at 45°. */
const oct = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px),` +
  ` calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`

/**
 * A driven brass dome.
 *
 * Not `Screw`/`CornerScrews`: `.screw` paints its washer rings at a fixed
 * 4.5px whatever `--sw` is, so a 6px head still sits in a ~15px dark seat and
 * the fastener reads as a dark square. The reference's row fasteners measure
 * ~2 CSS of brass with a hairline seat — quiet marks that say "bolted", not
 * punctuation. Head and seat scale together here.
 */
function Rivet({ size = 4, style }: { size?: number; style: CSSProperties }) {
  return (
    <span
      aria-hidden
      className="absolute"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 34% 28%, #e6cb93 0%, #c39c60 42%, #8a6b3c 74%, #4a3418 100%)',
        boxShadow:
          '0 0 0 0.5px rgba(26,15,6,0.5), 0 1px 1px rgba(16,9,4,0.45),' +
          ' inset 0 0.5px 0 rgba(255,246,222,0.32)',
        ...style,
      }}
    />
  )
}

/**
 * `right: false` drops the two right-hand fasteners. The board row needs that:
 * on the reference the score window's frame is bolted through its own cut
 * corners, and those two screws *are* the plate's right-hand fasteners — there
 * is no second pair beside them. Drawing both put a 6px head and a 3px head
 * 5px apart in the corner of every row, which reads as a doubled fastener.
 */
function CornerRivets({
  inset = 5,
  size = 4,
  right = true,
}: {
  inset?: number
  size?: number
  right?: boolean
}) {
  return (
    <>
      <Rivet size={size} style={{ left: inset, top: inset }} />
      <Rivet size={size} style={{ left: inset, bottom: inset }} />
      {right && (
        <>
          <Rivet size={size} style={{ right: inset, top: inset }} />
          <Rivet size={size} style={{ right: inset, bottom: inset }} />
        </>
      )}
    </>
  )
}

/**
 * The lit lower-right lip of a recess, plus a hairline of the chamfer all
 * round. Not glow — this is the key light landing on a machined edge, which is
 * why the reference's wells read as cut into the plate rather than painted on.
 */
function Rim({ radius }: { radius: number | string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: radius,
        boxShadow:
          'inset 0 0 0 1px rgba(255,238,205,0.05), inset -1px -1px 0 rgba(255,238,205,0.12), inset 1px 1px 0 rgba(18,10,4,0.5)',
      }}
    />
  )
}

/**
 * A shallow machined recess whose floor is the plate's own metal, darkened.
 *
 * The rank chip is this, not a `Well`: on the reference the chip floor samples
 * #604939 — plate brown sunk one stop — while the dark window (L≈23) is
 * reserved for the score readout. A near-black chip reads as an LCD, and an
 * LCD stamped with a rank is a different, wronger object.
 */
function Recess({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return (
    <span
      className="absolute"
      style={{
        // Reference chip floor samples #7a6654 (L≈107) — plate brown catching
        // light down in the pocket, sunk one stop, not a dark window.
        background: 'linear-gradient(180deg,#6d5441 0%,#7d6350 34%,#6a5140 78%,#59422f 100%)',
        // The lit lower-right lip carried 0.14 alpha, which put a 10-19 L step
        // between the pocket floor and its own edge. On the reference that step
        // is the loudest thing about the chip: scanned straight down, the floor
        // holds L 53-70 and the bottom lip spikes to L 121-170 — a bright line
        // of key light on a machined edge, not a hint of one.
        boxShadow:
          'inset 2px 2px 4px rgba(16,9,4,0.7), inset 3px 3px 7px rgba(16,9,4,0.34),' +
          ' inset -1.5px -1.5px 0 rgba(255,241,214,0.42),' +
          // the raised lip the chip is sunk into, catching light all round
          ' 0 0 0 1px rgba(255,240,212,0.2), 0 1px 0 1px rgba(22,13,5,0.4)',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/**
 * A punctuality socket: a turned brass collar with a dark bore and, when the
 * check-in has landed, a small amber lamp down inside it.
 *
 * The collar is drawn as an **overlay** on top of the lamp, and the lamp's
 * spill is cut to 5px. Earlier the collar sat *under* an 8px lamp carrying the
 * shared 24px bloom, which swallowed the ring whole — every lit socket read as
 * a bare amber dome. The ring has to be the outermost thing on the part.
 */
const COLLAR_RING =
  'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 3.4px, #e0bd80 3.9px, #a87f3c 5.1px, #4a3318 6.6px, rgba(0,0,0,0) 6.9px)'
const COLLAR_MASK =
  'radial-gradient(circle at 50% 50%, transparent 0 3.5px, #000 3.9px, #000 6.5px, transparent 6.9px)'

function Socket({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="relative block"
      style={{
        width: SOCKET,
        height: SOCKET,
        borderRadius: '50%',
        background: '#150e09',
        boxShadow: '0 1px 1px rgba(18,10,4,0.6)',
      }}
    >
      {/* the bore: a drilled hole with its own inner shadow */}
      <span
        className="absolute"
        style={{
          left: (SOCKET - BORE) / 2,
          top: (SOCKET - BORE) / 2,
          width: BORE,
          height: BORE,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 42% 34%, #201710 0%, #0b0705 100%)',
          boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.9)',
        }}
      />
      {/* the emitter, seated in the bore. 5px reach: it lifts the collar it
          sits in and stops there, which is the whole falloff rule. */}
      {on && (
        <span
          className="absolute"
          style={{
            left: (SOCKET - BORE) / 2 + 0.5,
            top: (SOCKET - BORE) / 2 + 0.5,
            width: BORE - 1,
            height: BORE - 1,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 38% 32%, #fff0c8 0%, var(--color-lamp) 46%, #8f4a12 100%)',
            boxShadow:
              '0 0 2px 0 var(--color-lamp), 0 0 5px 1px color-mix(in oklab, var(--color-lamp) 30%, transparent)',
          }}
        />
      )}
      {/* collar, painted last so ignition can never swallow it */}
      <span className="pointer-events-none absolute inset-0" style={{ background: COLLAR_RING }} />
      {/* key light on the collar's upper left — one light direction, top left */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(158deg, rgba(255,248,224,0.58) 0%, rgba(255,248,224,0.11) 30%, transparent 46%)',
          maskImage: COLLAR_MASK,
          WebkitMaskImage: COLLAR_MASK,
        }}
      />
    </span>
  )
}

/**
 * One binary category, as a square socket in the channel.
 *
 * Earned is a **flat, hard-edged** square in the team colour with a bright
 * inner face of its own hue and a 1px rim — not a bulb. The spill is cut to
 * 4px so it lifts the dark channel it sits in and nothing else: the reference's
 * gap between two lit cells samples #361f1f against a #1b1310 channel, i.e.
 * about 16 L of lift, while the plate face outside the channel is the same
 * brass in all eight rows. A cell whose glow repaints the plate face has
 * stopped being an emitter and become a wash.
 *
 * The old amber `--color-lamp-hot` core also had to go: one amber lamp showing
 * through pink, purple, blue, green and yellow glass is five wrong colours.
 */
function BinaryCell({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      aria-hidden
      className="block"
      style={{
        width: CELL,
        height: CELL,
        borderRadius: 2,
        background: on
          ? `linear-gradient(158deg, color-mix(in oklab, ${color} 80%, #fff) 0%,` +
            ` ${color} 26%, ${color} 68%, color-mix(in oklab, ${color} 70%, #2a1206) 100%)`
          : // An unearned cell is a machined pocket, not a hole: sampled on the
            // reference it floors at #271A15 (L 30) with a warm rim, where ours
            // bottomed out at #0A0705 (L 7).
            'radial-gradient(circle at 40% 34%, #2c2018 0%, #1e1610 62%, #150f0a 100%)',
        boxShadow: on
          ? `inset 0 0 0 1px color-mix(in oklab, ${color} 72%, #fff6e6),` +
            ' inset -1px -1px 0 rgba(30,12,4,0.4),' +
            ` 0 0 2px 0 color-mix(in oklab, ${color} 55%, transparent),` +
            ` 0 0 4px 0 color-mix(in oklab, ${color} 24%, transparent)`
          : 'inset 0 0 0 1px rgba(122,92,60,0.5), inset 1px 1px 2px rgba(0,0,0,0.9),' +
            ' inset -1px -1px 0 rgba(120,96,80,0.4), 0 1px 0 rgba(255,244,220,0.1)',
      }}
    />
  )
}

/**
 * The seventh check-in. Missing it costs 0.4, not 0.1, so 6/7 and 7/7 must be
 * different objects in a **still frame** — the big screen at the evening
 * gathering is looked at, not watched, and `prefers-reduced-motion` must not
 * cost a leader the information either.
 *
 * So the difference is structural, not intensity: at 7/7 a continuous lamp ring
 * is seated in the knob's pocket; at 6/7 it is eight amber notches — armed,
 * contact not yet made — and only an added bloom pulses. Kill the animation and
 * the notched ring is still there at full opacity.
 *
 * **The face is a machined recess, drawn here rather than taken from CogKnob.**
 * `CogKnob` paints its inner face with a radial that is *lighter* than the ring
 * around it and then engraves the starburst into it dark — measured against the
 * reference that relationship is inverted. On `01-board.jpg` the knob is two
 * concentric brass bands lit from the top left around a clearly sunk dark face
 * (floor L≈40 against a ring peaking L≈150) with the starburst *lit* on it. So
 * the pocket floor, its top-left inner shadow, its bottom-right lit lip and the
 * raised brass starburst are all overlaid here, and CogKnob supplies only what
 * it draws correctly: the toothed edge, the outer band and its specular.
 *
 * That also retires `CogKnob`'s `glow`, which hung a 2px amber ring with a 5px
 * bloom on the knob's *outer* rim — a halo around a lump of brass with nothing
 * emitting inside it. The lamp now sits down in the pocket where a lamp goes,
 * and its spill lands on the floor and the band it is seated in.
 */
/** Polar point in CogKnob's own 64-unit box. Screen y grows downward, so the
 *  key light's corner — top left — is θ ≈ 225°. */
const kp = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return `${(32 + Math.cos(a) * r).toFixed(2)} ${(32 + Math.sin(a) * r).toFixed(2)}`
}
/** The pocket wall: shadow across the top-left half, lit lip on the other. */
const POCKET_SHADOW = `M${kp(21.4, 163)} A 21.4 21.4 0 0 1 ${kp(21.4, 313)}`
const POCKET_LIP = `M${kp(21.6, 343)} A 21.6 21.6 0 0 1 ${kp(21.6, 133)}`
/** Eight notches around the lamp ring: circumference 2π·19.6 ÷ 8 = 15.4. */
const NOTCH_DASH = '6.2 9.2'
/**
 * Half a dash, so the eight notches sit centred on the eight star points rather
 * than at whatever phase a circle happens to start at. Scattered notches read
 * as speckle; notches on the part's own axes read as contacts.
 */
const NOTCH_PHASE = 3.1
/**
 * The starburst is a **solid eight-point star**, not eight spokes. On the
 * reference it is a cast rosette with tapered points and a raised boss at the
 * centre — a spoke wheel is what a wireframe of it looks like, and at 22px the
 * difference is the difference between a machined part and a hairline drawing.
 */
const STAR = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 === 0 ? 14.4 : 5.6
  const a = ((i * 22.5 - 90) * Math.PI) / 180
  return `${(32 + Math.cos(a) * r).toFixed(2)},${(32 + Math.sin(a) * r).toFixed(2)}`
}).join(' ')

function SeventhKnob({ ticks }: { ticks: number }) {
  const armed = ticks === 6
  const banked = ticks >= 7
  const uid = useId()
  const pocket = `knob-pocket-${uid}`
  const star = `knob-star-${uid}`
  return (
    <span className="relative block" style={{ width: COG, height: COG }}>
      <CogKnob size={COG} />
      <svg
        aria-hidden
        viewBox="0 0 64 64"
        width={COG}
        height={COG}
        className="pointer-events-none absolute inset-0"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Light bounced up off the pocket's lower-right wall — so the floor
              is darkest where the key light cannot reach, at the top left. */}
          <radialGradient id={pocket} cx="0.64" cy="0.7" r="0.8">
            <stop offset="0%" stopColor="#5c4327" />
            <stop offset="44%" stopColor="#382513" />
            <stop offset="100%" stopColor="#160d05" />
          </radialGradient>
          {/* the star's own face, lit from the same top-left key */}
          <linearGradient id={star} x1="0.14" y1="0" x2="0.86" y2="1">
            <stop offset="0%" stopColor="#f2dcaa" />
            <stop offset="42%" stopColor="#cba767" />
            <stop offset="100%" stopColor="#7d5c2c" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="22.5" fill={`url(#${pocket})`} />
        <path d={POCKET_SHADOW} fill="none" stroke="rgba(12,6,2,0.85)" strokeWidth="3" strokeLinecap="round" />
        <path d={POCKET_LIP} fill="none" stroke="rgba(255,238,205,0.2)" strokeWidth="1.4" strokeLinecap="round" />
        {/* the star, raised out of the floor: its shadow cast down-right first,
            then the lit brass face over it, then the boss at its centre */}
        <polygon points={STAR} fill="rgba(9,5,2,0.7)" transform="translate(1.2 1.2)" />
        <polygon points={STAR} fill={`url(#${star})`} />
        <polygon
          points={STAR}
          fill="none"
          stroke="rgba(255,242,212,0.3)"
          strokeWidth="0.7"
          transform="translate(-0.4 -0.4)"
        />
        <circle cx="33" cy="33" r="4.2" fill="rgba(9,5,2,0.55)" />
        <circle cx="32" cy="32" r="4.2" fill={`url(#${star})`} />

        {/* banked: the seventh contact is closed, so the lamp ring seated in the
            pocket is continuous — never notches — and it lifts the floor and the
            brass band it sits against, and stops there. */}
        {banked && (
          <>
            <circle
              cx="32"
              cy="32"
              r="19.6"
              fill="none"
              stroke="var(--color-lamp)"
              strokeWidth="2.6"
              style={{ filter: 'drop-shadow(0 0 2px var(--color-lamp))' }}
            />
            <circle cx="32" cy="32" r="19.6" fill="none" stroke="var(--color-lamp-hot)" strokeWidth="0.9" />
          </>
        )}
        {armed && (
          <>
            <circle
              cx="32"
              cy="32"
              r="19.6"
              fill="none"
              stroke="var(--color-lamp)"
              strokeWidth="2.6"
              strokeDasharray={NOTCH_DASH}
              strokeDashoffset={NOTCH_PHASE}
            />
            <circle
              className="pulse-rim"
              cx="32"
              cy="32"
              r="19.6"
              fill="none"
              stroke="var(--color-lamp)"
              strokeWidth="2.6"
              strokeDasharray={NOTCH_DASH}
              strokeDashoffset={NOTCH_PHASE}
              style={{ filter: 'drop-shadow(0 0 2.5px var(--color-lamp))' }}
            />
          </>
        )}
      </svg>
    </span>
  )
}

/**
 * A key, drawn the size and weight the reference draws it.
 *
 * The shared `KeyGlyph` is a 20×46 wire outline — a 2.6px ring on a 46-unit
 * canvas — so at row scale it renders a lanky hairline key 3.3× as tall as it
 * is wide, and its bit hangs 40% of the key's height below the capsule lip.
 * Measured off the reference: the bow is 10.5 CSS across with a 2.4 CSS wall,
 * the whole key is 25.6 CSS tall (aspect 2.4, not 3.3), and it sits in the
 * slot with the bow overhanging the top lip and the bit finishing level with
 * the bottom one. The most important object in the app cannot be the
 * weakest-drawn thing in the row, so it is drawn here at that weight: solid
 * body, collared shaft, a bit with real teeth, and a finial above the bow.
 */
function BoardKey({ lit }: { lit: boolean }) {
  const body = lit ? 'url(#bk-hot)' : 'url(#bk-cold)'
  return (
    <svg
      width={KEY_W}
      height={KEY_H}
      viewBox="0 0 22 46"
      aria-hidden
      style={{
        display: 'block',
        // Tight falloff: the emitter lifts the capsule floor it hangs over and
        // stops. The wide 9px bloom it used to carry was washing the plate.
        filter: lit
          ? 'drop-shadow(0 0 1.4px var(--color-key))' +
            ' drop-shadow(0 0 4px color-mix(in oklab, var(--color-key) 42%, transparent))'
          : 'drop-shadow(0 1px 1px rgba(0,0,0,0.55))',
      }}
    >
      <defs>
        {/* lit from the top left, like everything else on the screen */}
        <linearGradient id="bk-hot" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="var(--color-key-hot)" />
          <stop offset="34%" stopColor="var(--color-key)" />
          <stop offset="72%" stopColor="#d99b1e" />
          <stop offset="100%" stopColor="#93610f" />
        </linearGradient>
        <linearGradient id="bk-cold" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#5d4830" />
          <stop offset="45%" stopColor="#362716" />
          <stop offset="100%" stopColor="#1c1207" />
        </linearGradient>
      </defs>
      <g fill={body}>
        {/* finial above the bow — the reference's keys are cast, not bent */}
        <rect x="9.4" y="0.6" width="3.2" height="6.4" rx="1.4" />
        {/* shaft. It starts *inside the bottom of the bow*, so the bow stays an
            open ring with one small nub across its foot, exactly as the
            reference draws it — running it the full length filled the ring in
            and turned the key into a lollipop. */}
        <rect x="9.1" y="17" width="3.8" height="26" rx="1.4" />
        {/* collar where the shaft leaves the bow */}
        <rect x="7.2" y="18.4" width="7.6" height="2.8" rx="1.2" />
        {/* the bit: two solid teeth, not two hairlines */}
        <rect x="12.4" y="31.6" width="7" height="4" rx="1" />
        <rect x="12.4" y="37.6" width="4.6" height="4" rx="1" />
      </g>
      {/* the bow, a thick open ring so it reads as hanging */}
      <circle cx="11" cy="12.4" r="7" fill="none" stroke={body} strokeWidth="4.4" />
      {/* specular along the top-left of the ring and the shaft */}
      <g fill="none" stroke={lit ? 'rgba(255,246,214,0.6)' : 'rgba(222,202,164,0.16)'}>
        <path d="M5.2 14.6 A7 7 0 0 1 12.6 5.6" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M10.1 23 L10.1 40" strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/**
 * The row's key slots: full keys, hanging, three of them.
 *
 * Empty capacity draws the **dark key silhouette** the reference draws — an
 * empty hook says "a fitting is missing", a dark key says "a point is
 * missing", and the second is the thing a leader needs to read across eight
 * rows. Above three: three keys and `+N` in tabular numerals. No `×`, ever.
 */
function BoardKeys({ keys }: { keys: number }) {
  const drawn = Math.min(keys, KEY_SLOTS)
  const overflow = keys - drawn
  const pitch = overflow > 0 ? KEY_PITCH - 4 : KEY_PITCH
  const x0 = overflow > 0 ? 2 : Math.round((KEYS_W - (KEY_W + (KEY_SLOTS - 1) * pitch)) / 2)
  return (
    <>
      {Array.from({ length: KEY_SLOTS }, (_, i) => (
        <span key={i}>
          {/* the spill: a lit key throws warm light down onto the capsule
              floor it hangs over. Motivated, and it stops at the lip. */}
          {i < drawn && (
            <span
              aria-hidden
              className="absolute"
              style={{
                left: x0 + i * pitch - 4,
                top: 1,
                width: KEY_W + 8,
                height: KEYS_H - 2,
                borderRadius: 9999,
                background:
                  'radial-gradient(58% 66% at 50% 58%,' +
                  ' color-mix(in oklab, var(--color-key) 30%, transparent) 0%, transparent 74%)',
              }}
            />
          )}
          <span className="absolute" style={{ left: x0 + i * pitch, top: KEY_TOP }}>
            <BoardKey lit={i < drawn} />
          </span>
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="numeral absolute tabular-nums"
          style={{
            right: 2,
            top: KEYS_H / 2 - 7,
            fontSize: 13,
            lineHeight: '14px',
            color: 'var(--color-key)',
          }}
        >
          +{overflow}
        </span>
      )}
    </>
  )
}

/** Forty fine bars — the reference's strip is 141×15 with bars, not blocks. */
const BAR_WIDTHS = [1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 1, 2, 1, 2, 1, 3]

function FooterBarcode({ width = 141, height = 14 }: { width?: number; height?: number }) {
  let x = 0
  const bars = BAR_WIDTHS.map((w, i) => {
    const el = <rect key={i} x={x} y={0} width={w * 0.9} height={20} fill="#2a1c0c" opacity={0.88} />
    x += w * 0.9 + 1.2
    return el
  })
  return (
    <svg width={width} height={height} viewBox={`0 0 ${x} 20`} aria-hidden preserveAspectRatio="none">
      {bars}
    </svg>
  )
}

export default function Board() {
  const { teams, days, categories, activeDay, setActiveDayId, events, ready } = useStore()
  const navigate = useNavigate()

  const scores = useMemo(() => dayScores(events, activeDay.id, teams), [events, activeDay.id, teams])
  const byTeam = useMemo(() => new Map(scores.map((s) => [s.teamId, s])), [scores])
  /*
   * The board is a standings board: rows run best-first, and the chip is the
   * row's *position*, 01..08, never a competition rank — a board with two 03s
   * and no 04 on it reads as a bug to the camp director, not as a tie. Ties are
   * marked with an engraved `=` in the chip instead. Roster order breaks equal
   * scores so two teams on 6.0 do not swap places on every render.
   */
  const ordered = useMemo(
    () =>
      [...teams].sort(
        (a, b) =>
          (byTeam.get(b.id)?.totalDeci ?? 0) - (byTeam.get(a.id)?.totalDeci ?? 0) || a.order - b.order,
      ),
    [teams, byTeam],
  )
  const label = (id: CategoryId) => categories.find((c) => c.id === id)?.label ?? id

  if (!ready) return <div className="min-h-dvh" />

  const openCall = (categoryId: CategoryId) => {
    if (!activeDay.scored) return
    navigate(`/call/${categoryId}`)
  }

  return (
    <div className="flex min-h-dvh flex-col px-2 pb-1 pt-2">
      {/* ---- header plate: the day and its theme, struck into brass ---- */}
      <div
        className="brass-band grain relative"
        style={{ ...textureOffset('board-header'), height: 40, borderRadius: 5 }}
      >
        {/*
         * The double frame, machined outside in: dark bevel, then a bright
         * gold engraved line, then a dark channel, then the sunk panel. Four
         * stacked chamfered clips, each one pixel proud of the next, so the
         * edge is stepped rather than printed — two hairlines on a flat face
         * was the whole reason it read as a decal.
         */}
        <div
          className="pointer-events-none absolute"
          style={{ inset: 2, clipPath: oct(12), background: 'linear-gradient(180deg,#22150a 0%,#3a2611 100%)' }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            inset: 3,
            clipPath: oct(11),
            // Literal peak highlight: there is no `--color-brass-spec` token,
            // and one undefined var invalidates the whole declaration — which
            // is how this band spent a pass rendering as bare dark backing.
            // Peak stop held at L 202, just under the specular threshold: the
            // band has to read as the brightest brass on the screen without
            // adding a strip of blown highlight the reference does not have.
            background:
              'linear-gradient(158deg, #e3c894 0%, var(--color-brass-hi) 24%,' +
              ' #b6935a 54%, var(--color-brass) 76%, var(--color-brass-lo) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            inset: 6,
            clipPath: oct(8),
            // Translucent, so the channel reads as shadow in a cut rather than
            // a black line ruled between two pieces of brass.
            background: 'linear-gradient(180deg,rgba(18,10,3,0.88) 0%,rgba(44,27,10,0.78) 100%)',
          }}
        />
        {/* Every inset step is matched by an equal step in the chamfer, so the
            four diagonals stay parallel — mismatched chamfers opened a dark
            wedge at each corner where the band should be a constant width. */}
        <div className="absolute inset-[7px]">
          <div
            className="brass-band grain relative flex h-full items-center justify-center"
            style={{
              ...textureOffset('board-header-panel'),
              // Octagonal: a 7px chamfer at each corner, as on the reference.
              clipPath: oct(7),
            }}
          >
            {/*
             * The panel is sunk below the frame that holds it. On the
             * reference the frame band samples #af8c60 (L 146) against an
             * inner face of #695039 (L 87) — 59 L down. Ours were the same
             * tone, and a frame the same tone as the plate it frames is not a
             * frame. Relative alpha, not a fixed colour, so the relationship
             * survives whatever `.brass-band` is tuned to.
             */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(28,17,7,0.30) 0%, rgba(32,20,9,0.38) 56%,' +
                  ' rgba(20,12,4,0.52) 100%)',
                boxShadow:
                  'inset 0 2px 3px rgba(14,8,3,0.55), inset 2px 0 3px rgba(14,8,3,0.4),' +
                  ' inset 0 -1px 0 rgba(255,238,205,0.16)',
              }}
            />
            <h1
              className="font-display relative z-[1] font-semibold uppercase leading-none"
              style={{
                fontSize: 22,
                letterSpacing: '0.02em',
                color: 'var(--color-text)',
                textShadow: '0 2px 0 rgba(20,10,4,0.7)',
              }}
            >
              {activeDay.name} — {activeDay.theme.split('—')[0].trim()}
            </h1>
            {!activeDay.scored && (
              <span
                className="absolute right-[12px] z-[1] font-mono uppercase"
                style={{ fontSize: 7, letterSpacing: '0.06em', color: 'var(--color-text-dim)' }}
              >
                Non-scoring
              </span>
            )}
            {/*
             * No oxide on the panel's lit face. On the reference the header's
             * inner face is clean bronze — patina lives on the outer band's
             * weather end and lower lip, which is where it is drawn below.
             */}
          </div>
        </div>
        <Oxide
          mask={[
            'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.25) 22%, transparent 34%)',
            'radial-gradient(20% 110% at 99% 60%, rgba(0,0,0,0.8) 0%, transparent 70%)',
          ]}
          opacity={0.34}
          offset="63px 41px"
          radius={5}
        />
        {/* fasteners painted last, so no engraved frame line runs across a head */}
        <CornerRivets inset={3} size={5} />
        {/* a rivet mid-height at each end, on the panel's chamfer */}
        <Rivet size={4} style={{ left: 14, top: 18, zIndex: 2 }} />
        <Rivet size={4} style={{ right: 14, top: 18, zIndex: 2 }} />
      </div>

      {/* ---- day rail: five sockets, the current day a lit pilot lamp ---- */}
      <DayRail
        days={days}
        activeId={activeDay.id}
        onSelect={setActiveDayId}
        variant="sockets"
        // The rail's own box is 58px tall around a 10px bar, so trimming 4px of
        // its padding costs nothing visually and puts the first row on the grid.
        className="mx-1 mb-[-4px] mt-[2px]"
      />

      {/* ---- eight rows, each its own plate ---- */}
      <div className="flex flex-col" style={{ gap: ROW_GAP }}>
        {ordered.map((team, i) => {
          const mine = byTeam.get(team.id)?.totalDeci ?? 0
          const above = i > 0 ? byTeam.get(ordered[i - 1].id)?.totalDeci : undefined
          const below = i < ordered.length - 1 ? byTeam.get(ordered[i + 1].id)?.totalDeci : undefined
          return (
            <BoardRow
              key={team.id}
              team={team}
              position={i + 1}
              tied={mine === above || mine === below}
              score={byTeam.get(team.id)}
              onOpenCall={openCall}
              categoryLabel={label}
              scored={activeDay.scored}
            />
          )
        })}
      </div>

      {/* ---- footer: an instrument strip, not a button bar ---- */}
      <Plate chamfer={6} screws={false} className="mt-2" style={{ height: 32 }}>
        <CornerRivets inset={5} size={SCREW} />
        {/* clear of the plate's left-hand corner fasteners */}
        <div className="absolute left-[16px] top-[3px]">
          <FooterBarcode />
        </div>
        <span
          className="absolute bottom-[4px] left-[16px] font-mono uppercase"
          style={{ fontSize: 6.5, letterSpacing: '0.05em', color: '#2a1c0c', opacity: 0.88 }}
        >
          Status: online / sync: 98% / ver: 2.2.1 / id: 987R 60H0
        </span>
        <nav className="absolute right-[22px] top-[5px] flex gap-3">
          {[
            { to: '/standings', text: 'Standings' },
            { to: '/display', text: 'Display' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="font-mono uppercase"
              style={{ fontSize: 7.5, letterSpacing: '0.06em', color: '#2a1c0c', textShadow: '0 1px 0 rgba(255,240,206,0.3)' }}
            >
              {l.text} ▸
            </Link>
          ))}
        </nav>
        {/*
         * The reference's one prominent patina: a soft stain over the strip's
         * far right end and along its lower lip. Sampled there it is 4 L
         * *below* the clean metal beside it (#856956 against #8b725e), so this
         * is a stain and not the orange mottle that used to sit here.
         */}
        <Oxide
          mask={[
            'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.95) 92%)',
            'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 18%, transparent 30%)',
          ]}
          opacity={0.32}
          offset="0px 33px"
          radius={0}
        />
      </Plate>
    </div>
  )
}

function BoardRow({
  team,
  position,
  tied,
  score,
  onOpenCall,
  categoryLabel,
  scored,
}: {
  team: Team
  position: number
  tied: boolean
  score: ReturnType<typeof dayScores>[number] | undefined
  onOpenCall: (id: CategoryId) => void
  categoryLabel: (id: CategoryId) => string
  scored: boolean
}) {
  const color = `var(--color-team-${team.colorToken})`
  const ticks = score?.ticks ?? 0
  const total = score?.totalDeci ?? 0
  const keys = score?.keys ?? 0
  const lit = Math.min(ticks, 6)

  return (
    <Plate chamfer={6} screws={false} style={{ height: ROW_H }} dataPart="board-row">
      <CornerRivets inset={5} size={SCREW} right={false} />
      {/*
       * The link is the whole row — rank, crest, name, punctuality, keys and the
       * score all live inside it, so assistive tech and the definition-of-done
       * checks read one coherent object. The category cells are *siblings* laid
       * over it, not descendants: a button inside a link is not something a
       * screen reader or a browser handles sanely.
       */}
      <Link
        to={`/team/${team.id}`}
        aria-label={`${team.name}, position ${position} of 8, ${formatDeci(total)} points, ${keys} golden key${keys === 1 ? '' : 's'}`}
        className="absolute inset-0 block"
      >
        {/* rank chip: a shallow recess in the plate's own metal, not a window */}
        <Recess
          style={{ left: 10, top: (ROW_H - RANK_H) / 2, width: RANK_W, height: RANK_H, borderRadius: 5 }}
        >
          <span
            className="numeral absolute inset-0 flex items-center justify-center tabular-nums"
            style={{
              fontSize: 26,
              color: 'var(--color-text)',
              lineHeight: 1,
              textShadow: '0 1px 1px rgba(16,9,4,0.7)',
            }}
          >
            {String(position).padStart(2, '0')}
          </span>
          {/* an engraved equals mark: this score is shared with a neighbour */}
          {tied && (
            <span
              aria-hidden
              className="absolute font-mono"
              style={{ right: 2, bottom: 0, fontSize: 7, lineHeight: '8px', color: 'rgba(28,17,8,0.85)' }}
            >
              =
            </span>
          )}
        </Recess>

        {/*
         * The recessed channel the name and the binary cells sit in.
         *
         * A recess still has a floor, and on the reference that floor is
         * visible: sampled straight down row 1's channel it runs #19110E at the
         * top lip to #221914 at the bottom, ~19 → 27 L, the bottom-up lift you
         * get from light bouncing off the plate face below the lip. On the
         * default `.well` stack — a 55%-black gradient over `--color-well`,
         * under a 6px inset shadow — ours ran #090605 → #17100C, 7 → 17 L: a
         * hole, not a machined pocket. Eight of them is a sixth of the screen,
         * which is where this route's missing midtone was going.
         *
         * So the floor is lifted here and the `.well` shadow left to cut it
         * back down at the top-left lip. The unlit binary cells keep their own
         * 0.9-alpha inner shadow, so they still read sunk into it.
         */}
        <Well
          radius={8}
          style={{
            position: 'absolute',
            left: CH_L,
            right: CH_R,
            top: CH_TOP,
            height: CH_H,
            background: 'linear-gradient(180deg,#211911 0%,#261d15 52%,#2c2118 100%)',
          }}
        >
          <Rim radius={8} />
          <span
            className="font-display absolute top-1/2 -translate-y-1/2 truncate font-semibold uppercase"
            style={{
              left: COL2 - CH_L,
              fontSize: 20,
              letterSpacing: '0.01em',
              color: 'var(--color-text)',
              maxWidth: NAME_W,
            }}
          >
            {team.shortName}
          </span>
        </Well>

        {/* the medallion overhangs the channel's left end and the plate's edges */}
        <div className="absolute" style={{ left: 45, top: (ROW_H - CREST) / 2, zIndex: 1 }}>
          <TeamCrest teamId={team.id} size={CREST} />
        </div>

        {/* punctuality: six sockets sitting on the plate face, unrecessed */}
        <div
          className="absolute flex items-center"
          style={{ left: COL2, top: TIER2_MID - SOCKET / 2, height: SOCKET }}
          aria-hidden
        >
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} style={{ marginRight: PUNCT_PITCH - SOCKET }}>
              <Socket on={i < lit} />
            </span>
          ))}
        </div>

        {/* the engraved dash separating the first six check-ins from the seventh */}
        <span
          aria-hidden
          className="absolute"
          style={{
            left: DASH_X,
            top: TIER2_MID - 2,
            width: DASH_W,
            height: 4,
            borderRadius: 2,
            // An engraved groove is *darker* than the metal it is cut into,
            // with one hairline of key light on its lower lip. Ours ran dark to
            // #9B8060 (L 133) over four pixels, i.e. a tan bar sitting ~55 L
            // above the plate face — a drawn dash, not a cut one. On the
            // reference the mark reads below the surrounding metal throughout.
            background: 'linear-gradient(180deg,#1c1207 0%,#241a0d 58%,#6f5a3e 100%)',
            boxShadow: '0 1px 0 rgba(255,240,206,0.14)',
          }}
        />

        {/* key slots: full keys, hanging, bows overhanging the capsule lip */}
        <Well
          radius={9999}
          style={{
            position: 'absolute',
            left: KEYS_X,
            top: TIER2_MID - KEYS_H / 2,
            width: KEYS_W,
            height: KEYS_H,
            overflow: 'visible',
            // Reference capsule floor samples #392a21 (L≈45): dark, but not the
            // score readout's window — a dark key silhouette has to read on it.
            background: 'linear-gradient(180deg,#3d2d22 0%,#33251c 46%,#281c14 100%)',
          }}
        >
          <Rim radius={9999} />
          <BoardKeys keys={keys} />
        </Well>

        {/*
         * Score readout: the one true dark window on the row, and on the
         * reference it is *framed* — a 2px lip with the corners cut at 45° and
         * a small screw driven into the frame's outer corners. A plain rounded
         * rectangle reads as a div; the cut corner and the rim are what make it
         * a window let into the plate.
         *
         * The lip is the **plate's own metal turned up**, not brass. Sampled
         * off the reference the left lip reads #6B5240 and the right #6D5746 —
         * r−b 43 and 39, i.e. the same hue and the same luminance as the plate
         * face beside it (#705645, r−b 43). Ours was `--color-brass-hi` →
         * `--color-brass-lo`: #BF9A5F / #B68743, L 158 and 142 at r−b 96 and
         * 115. That is ~60 L hotter and 2.5× the gold saturation of the metal
         * it is cut into, which is why the frame read as a printed gold line
         * around a div instead of a machined edge.
         *
         * **And it is 5px of lip, not 2, running out to the plate's own edge.**
         * Scanned across a reference row at mid-window the frame is 21 image px
         * of metal on the left (7.6 CSS) and 13 on the right (4.7 CSS), and its
         * outer boundary *is* the plate's right edge — no strip of plate face
         * survives outside it. Ours was a 2 CSS hairline standing 6 CSS in from
         * that edge, which reads as a keyline drawn around a window instead of
         * a collar machined into the plate. So: 5 on every side, right edge one
         * pixel off the plate's, and the lower stop lifted from #4E3A29 (L 61)
         * to #5F4834 (L 76), because the reference's frame runs L 98 / 96 / 90
         * / 76 top / left / right / bottom — a far flatter ramp than ours.
         */}
        <span
          aria-hidden
          className="absolute"
          style={{
            right: 1,
            top: 5,
            width: SCORE_W + 10,
            height: ROW_H - 10,
            clipPath: oct(6),
            background:
              'linear-gradient(158deg, #9a8570 0%, #8a7460 30%,' +
              ' #786250 66%, #5f4834 100%)',
          }}
        />
        <Well
          radius={0}
          style={{
            position: 'absolute',
            right: 7,
            top: 11,
            width: SCORE_W,
            height: ROW_H - 22,
            clipPath: oct(5),
            // Flat, not a ramp. Sampled straight down a reference window the
            // floor holds #1C1510 → #1D1610 → #1E1511, i.e. L 21 top to bottom:
            // a window this deep sees no key light, so it has no gradient of
            // its own. Ours ran L 21 → 15 and the readout sat in a pool.
            background: 'linear-gradient(180deg,#221911 0%,#1e1610 46%,#1b140f 100%)',
          }}
        >
          <Rim radius={0} />
          <span
            className="numeral absolute inset-0 flex items-center justify-center tabular-nums"
            style={{
              fontSize: 28,
              color: 'var(--color-text)',
              lineHeight: 1,
              // The reference's numerals cast down-right onto the window floor
              // — one light direction applies to type as much as to metal.
              textShadow: '1px 2px 0 rgba(10,5,2,0.8)',
            }}
          >
            {formatDeci(total)}
          </span>
        </Well>
        {/* driven through the frame's two cut corners, as on the reference —
            these are the plate's right-hand fasteners, not extra ones */}
        <Rivet size={5} style={{ right: 2, top: 9 }} />
        <Rivet size={5} style={{ right: 2, bottom: 9 }} />
      </Link>

      {/*
       * The five binary cells, laid over the channel. Navigation only — tapping
       * a cell opens roll call for that category, it never awards anything.
       */}
      <div
        className="absolute z-10 flex"
        style={{
          left: CH_RIGHT - 7 - CELLS_W,
          top: CH_TOP + (CH_H - CELL) / 2,
          gap: CELL_GAP,
          width: CELLS_W,
        }}
      >
        {BINARY_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => onOpenCall(c)}
            disabled={!scored}
            aria-label={`${categoryLabel(c)} — open roll call`}
            className="block"
          >
            <BinaryCell on={(score?.byCategory[c] ?? 0) > 0} color={color} />
          </button>
        ))}
      </div>

      {/* the seventh check-in: worth 0.4 more than the sixth, so 6/7 is armed */}
      <button
        onClick={() => onOpenCall('punctuality')}
        disabled={!scored}
        aria-label={`Punctuality ${Math.min(ticks, 7)} of 7 — open roll call`}
        className="absolute z-10 block"
        style={{ left: COG_X, top: TIER2_MID - COG / 2 }}
      >
        <SeventhKnob ticks={ticks} />
      </button>

      {/* oxide in the crevices: the lower lip and the two bottom corners */}
      <Oxide
        mask={[
          'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 5%, transparent 11%)',
          'radial-gradient(16% 26% at 6% 100%, rgba(0,0,0,0.85) 0%, transparent 72%)',
          'radial-gradient(14% 22% at 94% 100%, rgba(0,0,0,0.8) 0%, transparent 72%)',
        ]}
        opacity={0.28}
        offset={`${(team.order * 53) % 240}px ${(team.order * 37) % 150}px`}
        radius={0}
      />
    </Plate>
  )
}
