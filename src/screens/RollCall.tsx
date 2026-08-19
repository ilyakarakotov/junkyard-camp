import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Lever from '../components/Lever'
import TeamCrest from '../components/TeamCrest'
import { CornerScrews, Plate, ScreenFrame, Well } from '../components/chrome'
import { ArcStrike, usePrefersReducedMotion } from '../fx/Arc'
import { checkInCount, hasBinary } from '../data/derive'
import { BINARY_DECI, MAX_CHECK_INS, formatDeci, punctualityDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { CommitBatch, TeamId } from '../data/types'

/**
 * Roll call — the workhorse, opened ten times a day.
 *
 * The whole screen is ONE MACHINE bolted inside a bronze bezel, and the machine
 * is bolted to a DARK WALL: the header plate, the eight row plates and the lever
 * housing are separate brass parts, and the near-black ground between them is
 * what separates them. If the gaps read brass the whole screen goes flat.
 *
 * A row is one line — medallion, cream name, seven sockets, engraved hairline,
 * cog knob — because the sockets already say "4 of 7"; a subtitle repeating it
 * costs a line and buys nothing.
 *
 * Toggle the eight teams with their cog knobs, pull the lever once, everything
 * commits together. Every row is a 56px plate and the **whole plate is the hit
 * area**; this has to be a five-second interaction with a phone in one hand.
 *
 * Committed rows ignite in a 40ms stagger, and any row that lands its seventh
 * check-in fires the surge — that is the 0.6 -> 1.0 jump made visible.
 *
 * Height budget for a 390x844 viewport, so the machine never scrolls:
 *   bezel 6·2 + wall 7·2 + header 60 + 8 + (8·56 + 7·8) + 8 + lever 236 = 842.
 */

const ROW_H = 56
const ROW_GAP = 8
const HEADER_H = 60
const UNDO_MS = 60_000
const STAGGER_MS = 40
/**
 * Socket geometry. Measured off `02-rollcall-rest.jpg`: an outer diameter of
 * 16.4 CSS on a 41px row, i.e. the track is the row's dominant band rather than
 * a thin dotted strip. The reference only carries five sockets, so at seven the
 * pitch has to tighten — the diameter is the part that has to survive.
 */
const SOCKET = 16
const SOCKET_GAP = 3
const TRACK_W = MAX_CHECK_INS * SOCKET + (MAX_CHECK_INS - 1) * SOCKET_GAP
const KNOB = 36
const CREST = 44
/** Corner screws sized so their washer rings clear the crest and the knob. */
const SCREW = 8
const SCREW_INSET = 6

/**
 * A socket is a LAMP SUNK IN BRASS, and the reference is explicit about the
 * section. Cut horizontally through one at y=429 of `02-rollcall-rest.jpg`:
 *
 *   plate #846550 · engraving #2c1300 (L24) · brass grommet #82634 → #b79396
 *   (L105→L158) · bore lip #6e3b76 (L81) · EMITTER CORE #e683ff (L175) ·
 *   bore lip · brass grommet · engraving
 *
 * Three things fall out of that and all three are load-bearing:
 *
 *   1. the grommet is BRASS on every row whatever the team colour — the ring
 *      is hardware, the light inside it is the team;
 *   2. the emitter sits three steps DOWN inside the bore, so the part reads as
 *      a lamp in a hole rather than a bead glued to the face;
 *   3. peak luminance is the emitter's own CENTRE (L175), not a specular
 *      crescent on an upper edge. A glossy top-left crescent is what makes a
 *      disc read as plastic: an emitter is brightest where it emits.
 *
 * Proportions are the reference's: a 16px socket is 1px of engraving, 2.4px of
 * grommet and a 9.2px emitter (the reference's is 9.4 on a 16 CSS socket).
 *
 * The grommet is a TORUS, and a torus takes the key light TWICE. Vertical cut
 * through the reference's grommet (x=690 of `02-rollcall-rest.jpg`):
 *
 *   engraving L40/27 · TOP BRASS L158 → L127 · bore lip L68 · emitter · bore
 *   lip L79 · BOTTOM BRASS L118 → L208 · engraving L62/42
 *
 * Both lips of the ring are hot: the upper one is the key landing on the raised
 * outer edge, the lower one is the bounce off the bore's far wall. The same cut
 * through the build read L64–L100 across the WHOLE top — no upper rim at all,
 * only the lower bounce — and a ring that is dark where the light lands is
 * exactly what makes the emitter inside it read as a bead glued on top. The
 * gradient below runs bright · mid · bright down the ring, off vertical by 12°
 * so the top-LEFT quadrant still beats the top right.
 */
function Socket({
  on,
  hot = false,
  color,
  square = false,
}: {
  on: boolean
  hot?: boolean
  color: string
  square?: boolean
}) {
  const radius = square ? 4 : 9999
  return (
    <span
      aria-hidden
      className="absolute inset-0 block"
      style={{
        borderRadius: radius,
        /* the dark ring engraved into the plate: the shadow the top-left lip
           throws, so it is heaviest at the top and thins toward the bottom */
        background: 'linear-gradient(155deg, #160d04 0%, #1c1207 62%, #2a1b0d 100%)',
        boxShadow: '0 1px 0 rgba(255,244,220,0.18), 0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      {/* the brass grommet. ONE key light, top left: it lands on the ring's
          raised upper edge AND bounces off the bore's far (lower) wall, which
          is why the reference is hot at both lips and mid-brass between them. */}
      <span
        className="absolute block"
        style={{
          inset: 1,
          borderRadius: radius,
          background:
            /* the top-left bias, so the ring is not left-right symmetric */
            'radial-gradient(120% 120% at 20% 14%, rgba(255,248,224,0.34) 0%, transparent 56%),' +
            'linear-gradient(168deg, #f4dfb2 0%, #d0ad72 6%, #a8874e 15%, #8b6d3e 34%,' +
            '#7f6338 52%, #96773f 72%, #c5a464 88%, #f8e6bd 100%)',
          boxShadow:
            'inset 0 0.5px 0 rgba(255,248,226,0.5), inset 0 -0.5px 0 rgba(255,246,222,0.4),' +
            ' inset 0 1px 1.5px rgba(18,10,3,0.35)',
        }}
      >
        {/* the bore, and the emitter sunk inside it */}
        <span
          className="absolute block"
          style={{
            inset: 2.4,
            borderRadius: radius,
            background: hot
              ? 'radial-gradient(circle at 50% 47%, #ffffff 0%, #fffaf0 42%, #ffe6bb 74%, var(--color-lamp) 100%)'
              : on
                /* the reference's lit emitter keeps its chroma at the core
                   (#e885ff, still unmistakably purple); mixing 58% white into
                   it turned the build's into lavender (#bf9add) */
                ? `radial-gradient(circle at 50% 47%, color-mix(in oklab, ${color} 62%, #ffffff) 0%,` +
                  ` color-mix(in oklab, ${color} 78%, #ffffff) 30%, ${color} 66%,` +
                  ` color-mix(in oklab, ${color} 66%, #150c06) 88%,` +
                  ` color-mix(in oklab, ${color} 44%, #120804) 100%)`
                : 'radial-gradient(circle at 44% 36%, #1d140d 0%, #120b06 62%, #080402 100%)',
            /* the bore lip reads over the emitter's edge, and the spill lands
               on the brass that surrounds it — a few px of tight falloff */
            boxShadow: hot
              ? 'inset 0 0 1.5px 0.5px rgba(255,255,255,0.9),' +
                ' 0 0 5px 1px rgba(255,246,226,0.9), 0 0 13px 3px rgba(237,144,64,0.5)'
              : on
                ? `inset 0 0 1.5px 0.5px color-mix(in oklab, ${color} 40%, #0d0603),` +
                  ` 0 0 2px 0 color-mix(in oklab, ${color} 52%, transparent),` +
                  ` 0 0 6px 1.5px color-mix(in oklab, ${color} 20%, transparent)`
                : 'inset 0.5px 1.5px 2.5px rgba(0,0,0,0.95), inset -0.5px -1px 1px rgba(84,71,64,0.4)',
          }}
        />
      </span>
    </span>
  )
}

/**
 * The row's selection control: a brass cog knob, built to the reference's own
 * three-layer section rather than a flat dashed disc.
 *
 *   1. a toothed brass annulus, every tooth lit by ONE radial key from the top
 *      left, so the light decays around the ring instead of alternating;
 *   2. a dark inner recess with a `--well-rim` bounce along its lower-right lip;
 *   3. inside the recess, either a RAISED BRIGHT brass eight-point star or —
 *      when this pull will land a value — that value in cream.
 *
 * Ring-scanned off the reference (centre 929,807, r=42 in `02-rollcall-rest`):
 * the tooth annulus means L125 top-left and L71 BOTTOM-RIGHT — brass on the
 * shadow side too, with samples like #776245 — and the dark inner dish is 61%
 * of the knob diameter. The build was seating the teeth on a near-black disc,
 * so the valleys bottomed out at #0e0906 at BOTH diagonals and the part read as
 * a tan disc wearing a black gear. The seat is brass-dark now, and the well is
 * open enough for the annulus to read as a ring.
 */
function RowKnob({ size = KNOB, readout, glow = false }: { size?: number; readout?: string; glow?: boolean }) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  const teeth = 20
  const rIn = 25.5
  const rOut = 31
  const path = Array.from({ length: teeth }, (_, i) => {
    const a0 = (i * 2 * Math.PI) / teeth
    const half = Math.PI / teeth / 2
    const p = (r: number, a: number) =>
      `${(32 + Math.cos(a) * r).toFixed(2)} ${(32 + Math.sin(a) * r).toFixed(2)}`
    return `M${p(rIn, a0 - half * 1.6)} L${p(rOut, a0 - half * 0.85)} L${p(rOut, a0 + half * 0.85)} L${p(rIn, a0 + half * 1.6)} Z`
  }).join(' ')
  const wellR = readout === undefined ? 19 : 21.5
  const star = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 - Math.PI / 8
    /* Measured off the reference knob (centre 929,807): the dish is 61px across
       and the star spans 31 — HALF the dish, not four fifths. The oversized
       star is what turned the dish into a white asterisk on black. */
    const rl = 10.4
    const rs = 4.1
    const p = (r: number, ang: number) =>
      `${(32 + Math.cos(ang) * r).toFixed(2)} ${(32 + Math.sin(ang) * r).toFixed(2)}`
    return `${i === 0 ? 'M' : 'L'}${p(rl, a)} L${p(rs, a + Math.PI / 8)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ display: 'block' }}>
      <defs>
        {/* ONE key light, top left, for every brass surface on the part */}
        <radialGradient id={g('key')} cx="0.3" cy="0.26" r="0.95">
          <stop offset="0%" stopColor="#fff0d2" />
          <stop offset="22%" stopColor="#e8c795" />
          <stop offset="46%" stopColor="#c8a469" />
          <stop offset="74%" stopColor="#a08149" />
          <stop offset="100%" stopColor="#755e37" />
        </radialGradient>
        {/* The recess. Cut across the reference's dish (y=438) it reads
            #3e2b22 · #4f3a28 · #57453a · #563b35 — L40 rising to L72, a shallow
            MID-BROWN pan, not a punched hole. The build's was L17–L23, which is
            why eight of them read as dark eyes down the right edge. Still a
            true inner shadow: darkest at the top-left lip, lit lower-right. */}
        <radialGradient id={g('well')} cx="0.33" cy="0.29" r="1.05">
          <stop offset="0%" stopColor="#3a2a20" />
          <stop offset="46%" stopColor="#4b3a2d" />
          <stop offset="82%" stopColor="#5b4738" />
          <stop offset="100%" stopColor="#6e5647" />
        </radialGradient>
        {/* the star is EMBOSSED brass in that pan, so it is lit by the same key
            light and lands near L126 — the reference's, against an L55 dish */}
        <linearGradient id={g('star')} x1="0.16" y1="0.1" x2="0.84" y2="0.9">
          <stop offset="0%" stopColor="#e6c894" />
          <stop offset="38%" stopColor="#b9975f" />
          <stop offset="72%" stopColor="#8b6d3f" />
          <stop offset="100%" stopColor="#634c28" />
        </linearGradient>
      </defs>
      {/* the seat the knob turns in. It is BRASS in shadow, not black: the
          valleys between teeth show this disc, and a near-black one is what
          made the gear read as a sawtooth halo cut out of the plate. */}
      <circle cx="32" cy="32" r="31.8" fill="#5a4526" />
      <circle cx="32.8" cy="33.4" r="30.6" fill="rgba(20,11,4,0.42)" />
      {/* 1. toothed brass annulus */}
      <path d={path} fill={`url(#${g('key')})`} />
      <circle cx="32" cy="32" r={rIn + 0.6} fill={`url(#${g('key')})`} />
      <circle cx="32" cy="32" r={rIn + 0.6} fill="none" stroke="rgba(24,14,5,0.4)" strokeWidth="1" />
      {/* the machined step between the teeth and the well */}
      <circle cx="32" cy="32" r={wellR + 3.2} fill="none" stroke="rgba(24,14,5,0.36)" strokeWidth="1.6" />
      <circle cx="32" cy="32" r={wellR + 2.3} fill="none" stroke="rgba(255,244,214,0.28)" strokeWidth="1" />
      {/* peak highlight on the upper-left rim, contact shadow lower-right */}
      <path
        d="M 8.5 27 A 23.5 23.5 0 0 1 25 8.9"
        fill="none"
        stroke="#fbe1b7"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 55.5 39 A 23.5 23.5 0 0 1 40 55.4"
        fill="none"
        stroke="rgba(20,11,4,0.5)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* 2. the inner recess */}
      <circle cx="32" cy="32" r={wellR} fill={`url(#${g('well')})`} />
      <circle cx="32" cy="32" r={wellR} fill="none" stroke="rgba(20,11,4,0.8)" strokeWidth="1.2" />
      {/* the inner shadow the pan casts, heaviest under its top-left lip */}
      <path
        d={`M ${32 - wellR * 0.74} ${32 + wellR * 0.68} A ${wellR} ${wellR} 0 0 1 ${32 + wellR * 0.68} ${32 - wellR * 0.74}`}
        fill="none"
        stroke="rgba(16,9,3,0.55)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d={`M ${32 - wellR * 0.72} ${32 + wellR * 0.72} A ${wellR} ${wellR} 0 0 0 ${32 + wellR * 0.72} ${32 + wellR * 0.72}`}
        fill="none"
        stroke="var(--color-well-rim)"
        strokeWidth="1.2"
        opacity="0.9"
      />
      {readout === undefined ? (
        /* 3a. a brass star EMBOSSED in the pan: a contact shadow under its
           lower-right side, a lit edge along its upper-left, and no core
           brighter than the brass ring around it */
        <g>
          <path d={`${star} Z`} fill="rgba(16,9,3,0.6)" transform="translate(0.8,1)" />
          <path d={`${star} Z`} fill={`url(#${g('star')})`} />
          <path
            d={`${star} Z`}
            fill="none"
            stroke="rgba(255,240,206,0.3)"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        /* 3b. the value this pull will land, cream in the recess */
        <text
          x="32"
          y="32.6"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Oswald, sans-serif"
          fontWeight="600"
          fontSize="25"
          fill="#f7ecd6"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {readout}
        </text>
      )}
      {glow && (
        <circle
          cx="32"
          cy="32"
          r="29.5"
          fill="none"
          stroke="var(--color-lamp)"
          strokeWidth="2"
          opacity="0.85"
          style={{ filter: 'drop-shadow(0 0 5px var(--color-lamp))' }}
        />
      )}
    </svg>
  )
}

/**
 * Broken specular along a plate's top chamfer. Measured off the reference: the
 * chamfer is a single near-white line (peak `#fde0b9`, L 143) sitting on a face
 * that is nearly flat at L 83 — not a soft wide ramp. Alpha descends left to
 * right, because there is exactly one key light and it is at the top left.
 */
function TopSpecular({ left = 10, right = 22 }: { left?: number; right?: number }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left,
          right,
          top: 1.5,
          height: 2,
          borderRadius: 1,
          background:
            'linear-gradient(90deg, rgba(255,242,214,0.95) 0%, rgba(255,238,205,0.52) 17%,' +
            'rgba(255,240,210,0.8) 31%, rgba(255,236,200,0.2) 48%, rgba(255,238,205,0.5) 63%,' +
            'rgba(255,232,190,0.1) 80%, rgba(255,238,205,0.28) 94%, transparent 100%)',
        }}
      />
      {/* the same key light running down the left chamfer, decaying downward */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: 1.5,
          top: 6,
          bottom: 8,
          width: 2,
          borderRadius: 1,
          background:
            'linear-gradient(180deg, rgba(255,242,214,0.8) 0%, rgba(255,238,205,0.34) 34%,' +
            'rgba(255,238,205,0.16) 66%, transparent 100%)',
        }}
      />
    </>
  )
}

/**
 * Grades a plate face to the reference's own luminance profile. Re-measured
 * ACROSS a reference row plate in the clear (y 300, x 540→780 of 1080, away
 * from the name, the sockets and the knob): the face runs L 106 / 113 / 120 /
 * 122 / 115, with a 2px chamfer at L 143 above it and 3px of shadowed edge at
 * L 45 below. The earlier profile ("flat at L 82–84") was sampled through the
 * team name and graded the whole stack ~24 L too dark — below the
 * `#6A5240`–`#98795E` band the definition of done requires. This keeps the
 * chamfer, the shadowed bottom edge and the single top-left key, and puts the
 * face itself back inside the band.
 */
function PlateGrade({ radius = 2, keyLight = 0 }: { radius?: number; keyLight?: number }) {
  /**
   * How far this plate has fallen out of the key light, on the curve the
   * reference's own stack takes. Measured face value down `02-rollcall-rest`
   * at x=470, row 1 to row 8: L 95 · 94 · 89 · 82 · 79 · 68 · 75 · 69 — a 26 L
   * drop, and it is NOT linear: rows 1–3 stay within 6 L of each other and the
   * floor falls away underneath them. The build's own stack ran 96 · 93 · 91 ·
   * 87 · 84 · 80 · 78 · 86 — an 18 L drop spread evenly, which reads as eight
   * identical plates rather than as eight plates under one lamp.
   */
  const fall = Math.pow(1 - keyLight, 1.3)
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: radius,
        background:
          /* ONE key light for the WHOLE MACHINE, not one per plate. Scanned
             down the reference's stack at x 700 the row faces run L124 · 120 ·
             114 · 112 · 110 · 105 · 101 · 88 — a 35 L falloff from the top of
             the screen to the bottom. The build graded every row identically,
             which is exactly the tell that a stack was generated rather than
             lit. `keyLight` is 1 on the top row and 0 on the bottom one. */
          `linear-gradient(180deg, rgba(255,238,210,${(0.13 * keyLight).toFixed(3)}) 0%,` +
          `rgba(255,236,206,${(0.1 * keyLight).toFixed(3)}) 74%,` +
          `rgba(255,234,202,${(0.05 * keyLight).toFixed(3)}) 100%),` +
          /* ...and the plates the key light has fallen off fall INTO shadow, so
             the stack keeps its mean rather than simply getting brighter */
          `linear-gradient(180deg, rgba(30,16,6,${(0.22 * fall).toFixed(3)}) 0%,` +
          `rgba(30,16,6,${(0.2 * fall).toFixed(3)}) 100%),` +
          /* Cut the shared plate gradient back to the reference's own face
             value. Re-cut vertically through a reference row plate in the clear
             (x=470, rows 3–4) the face is FLAT at L 87–95 from the chamfer all
             the way to its lower lip; the same cut through the build ran L 106
             at the top down to L 83 at the bottom — a mean of L 97, eight to
             ten stops hot, and that excess is most of the screen's medianL 80
             against the reference's 66. #705540 (L 89) is still inside the
             #6A5240–#98795E band the definition of done requires. */
          /* The shade is #2C1608 rather than a neutral black: multiplying warm
             brass by a grey lowers R−B along with L, and the screen's warmth
             stat is measured against the reference's 36.2. */
          'linear-gradient(180deg, rgba(44,22,8,0.30) 0%, rgba(44,22,8,0.29) 6%, rgba(44,22,8,0.27) 14%,' +
          'rgba(44,22,8,0.23) 30%, rgba(44,22,8,0.22) 50%, rgba(44,22,8,0.12) 66%,' +
          'rgba(44,22,8,0.04) 78%, rgba(44,22,8,0) 92%, rgba(20,11,4,0.42) 96%,' +
          'rgba(12,7,2,0.8) 100%),' +
          /* and a warm bounce along its lower lip — the reference's plate ends
             on a LIT edge (L 111 at x=470, y=608) before the gap, not on a fade */
          'linear-gradient(180deg, transparent 66%, rgba(226,178,124,0.07) 74%,' +
          'rgba(226,178,124,0.17) 82%, rgba(228,182,130,0.22) 88%,' +
          'rgba(232,188,138,0.3) 93%, rgba(228,182,130,0.12) 96%, transparent 98%),' +
          /* ONE key light, top left: the face itself falls away from it, so the
             far end of a 364px plate cannot sit at the same value as the end
             the light lands on */
          'linear-gradient(112deg, transparent 0%, transparent 38%, rgba(22,12,5,0.04) 70%,' +
          'rgba(22,12,5,0.09) 100%),' +
          'radial-gradient(120% 62% at 86% 118%, rgba(104,50,22,0.28) 0%, transparent 62%)',
      }}
    />
  )
}

/** Engraved brass rocker — the hardware form of a nav control. */
function Rocker({
  d,
  label,
  onClick,
  w,
  h,
}: {
  d: string
  label: string
  onClick: () => void
  w: number
  h: number
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="brass-band relative block shrink-0"
      style={{ width: w, height: h, borderRadius: 3 }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
        <path d={d} fill="none" stroke="#3a2812" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={d}
          fill="none"
          stroke="rgba(255,240,206,0.42)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(0,1)"
        />
      </svg>
    </button>
  )
}

export default function RollCall() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const { teams, categories, activeDay, events, commitRollCall, undoBatch, isEditableDay, ready } = useStore()

  const category = categories.find((c) => c.id === categoryId)
  const isPunctuality = category?.kind === 'track'
  // Only today (or a director-unlocked day) accepts writes; the rest is a
  // view-only machine — rows inert, lever dead.
  const locked = !isEditableDay(activeDay.id)

  const [selected, setSelected] = useState<Set<TeamId>>(new Set())
  const [batch, setBatch] = useState<CommitBatch | null>(null)
  const [ignited, setIgnited] = useState<Set<TeamId>>(new Set())
  /**
   * Socket index each committed row's pull LANDED on, captured BEFORE the event
   * is appended. The ignition flash has to be driven off this rather than off
   * `ticks + 1`: the store increments the moment the batch commits, so adding
   * one on top rendered six lit sockets for a team that had just reached five —
   * the leader watching the discharge read 0.6 where the state was 0.5.
   */
  const [landed, setLanded] = useState<Map<TeamId, number>>(new Map())
  const [surged, setSurged] = useState<Set<TeamId>>(new Set())
  const [undoLeft, setUndoLeft] = useState(0)
  const [discharging, setDischarging] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // 60-second undo window, counted down so the leader can see it draining.
  useEffect(() => {
    if (!batch) return
    setUndoLeft(Math.ceil(UNDO_MS / 1000))
    const iv = setInterval(() => {
      const left = Math.ceil((batch.at + UNDO_MS - Date.now()) / 1000)
      if (left <= 0) {
        setBatch(null)
        setUndoLeft(0)
      } else setUndoLeft(left)
    }, 500)
    return () => clearInterval(iv)
  }, [batch])

  /** Already maxed out today — the row reads as done and can't be selected. */
  const doneFor = useCallback(
    (teamId: TeamId): boolean => {
      if (!category) return false
      if (isPunctuality) {
        return checkInCount(events, activeDay.id, teamId) >= MAX_CHECK_INS
      }
      return hasBinary(events, activeDay.id, teamId, category.id)
    },
    [category, isPunctuality, events, activeDay.id],
  )

  const toggle = (teamId: TeamId) => {
    if (doneFor(teamId)) return
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  const selectAll = () => {
    const next = new Set<TeamId>()
    for (const t of teams) if (!doneFor(t.id)) next.add(t.id)
    setSelected(next.size === selected.size ? new Set() : next)
  }

  const onFire = async () => {
    if (!category || selected.size === 0) return
    const ids = teams.filter((t) => selected.has(t.id)).map((t) => t.id)

    // Which rows will land their seventh check-in on this commit, and which
    // socket each row's pull fills — both read BEFORE the events are appended.
    const willSurge = new Set<TeamId>()
    const landing = new Map<TeamId, number>()
    if (isPunctuality) {
      for (const id of ids) {
        const before = checkInCount(events, activeDay.id, id)
        landing.set(id, Math.min(before, MAX_CHECK_INS - 1))
        if (before + 1 === MAX_CHECK_INS) willSurge.add(id)
      }
    }
    setLanded(landing)

    const committed = await commitRollCall(activeDay.id, category.id, ids)
    setSelected(new Set())
    setBatch(committed)

    // Rows ignite in a 40ms stagger rather than all at once.
    ids.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => {
          setIgnited((s) => new Set(s).add(id))
          if (willSurge.has(id)) setSurged((s) => new Set(s).add(id))
        }, i * STAGGER_MS),
      )
    })
    timers.current.push(
      setTimeout(
        () => {
          setIgnited(new Set())
          setSurged(new Set())
          setLanded(new Map())
        },
        ids.length * STAGGER_MS + 900,
      ),
    )
  }

  const onUndo = async () => {
    if (!batch) return
    await undoBatch(batch)
    setBatch(null)
  }

  if (!ready || !category) return <div className="min-h-dvh" />

  const selectableCount = teams.filter((t) => !doneFor(t.id)).length

  /* The lever housing's top brass margin: select-all at the left, the queued or
     just-committed readout engraved into the brass at the right. Two small
     hardware tabs on metal, not a black debug letterbox — reference 02/03 keeps
     that margin plain brass between the corner screws and the grip's travel. */
  const groove = (
    <>
      {selectableCount > 0 && !batch ? (
        <button
          onClick={selectAll}
          className="brass-band flex shrink-0 items-center justify-center"
          style={{ height: 24, minWidth: 44, borderRadius: 3, padding: '0 10px' }}
        >
          <span
            className="engraved font-display font-semibold uppercase"
            style={{ fontSize: 10, letterSpacing: '0.16em', lineHeight: 1 }}
          >
            {selected.size === selectableCount ? 'CLEAR' : 'ALL'}
          </span>
        </button>
      ) : (
        <span className="engraved tech-label shrink-0 text-[8px]">CH-01</span>
      )}

      <span aria-hidden className="flex-1" />

      {batch ? (
        <>
          {/* `.tech-label` sets the caps, so the source stays sentence case —
              the end-to-end commit check reads textContent, not the rendering */}
          <span className="engraved tech-label text-[8px]">
            {batch.eventIds.length} committed · {undoLeft}s
          </span>
          <button
            onClick={onUndo}
            className="brass-band flex shrink-0 items-center justify-center"
            style={{ height: 24, minWidth: 44, borderRadius: 3, padding: '0 10px' }}
          >
            <span
              className="engraved font-display font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: '0.16em', lineHeight: 1 }}
            >
              Undo
            </span>
          </button>
        </>
      ) : (
        <span className="engraved tech-label text-[8px]">
          {selected.size === 0
            ? `${selectableCount} OPEN`
            : `${selected.size} TEAM${selected.size === 1 ? '' : 'S'} QUEUED`}
        </span>
      )}
    </>
  )

  return (
    <ScreenFrame band={6} className="min-h-dvh">
      {/* the wall the machine is bolted to: the gaps between plates must read
          near-black, or every part fuses into one sheet of brass */}
      <div
        className="relative flex flex-col"
        style={{
          padding: 7,
          gap: 8,
          borderRadius: 3,
          /* Sampled in the reference's gutters between row plates the wall is
             #0b0200–#120601, L 2–8. The build's was L 13–18, and a ground that
             close to the plates is what let eight separate castings fuse into
             one sheet of brass. */
          background:
            'radial-gradient(132% 80% at 28% 4%, #241a12 0%, #150e08 40%, #090503 100%)',
          boxShadow:
            'inset 0 3px 9px rgba(0,0,0,0.85), inset 0 -2px 6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,236,205,0.06)',
        }}
      >
        {/* ---- header: a brass plate holding a recessed LCD window ---- */}
        <Plate chamfer={12} style={{ height: HEADER_H }}>
          <PlateGrade keyLight={1} />
          <TopSpecular left={16} right={30} />
          <CornerScrews inset={7} size={10} />

          {/* back: a brass rocker in the plate's left margin, clear of the
              screws' washer rings and mirroring the steppers' mass */}
          <span className="absolute flex items-center" style={{ left: 24, top: '50%', marginTop: -12 }}>
            <Rocker
              w={42}
              h={24}
              label="Back to board"
              onClick={() => navigate('/')}
              d="M20 7 L14 12 L20 17 M15 12 H29"
            />
          </span>

          {/* the LCD window: a true recess inside a MODELLED brass band — lit
              along the top-left, --brass-lo along the bottom-right, interior at
              the reference's own #3f2e25 rather than near-black */}
          <span
            className="absolute"
            style={{ left: 72, right: 72, top: 9, height: HEADER_H - 18 }}
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                borderRadius: 4,
                background:
                  'linear-gradient(152deg, #f0d6a4 0%, #cfa96a 18%, #a3854f 42%,' +
                  '#7e6238 66%, #574023 86%, #402d16 100%)',
                boxShadow:
                  'inset 1px 1px 0 rgba(255,246,220,0.85), inset -1px -1px 0 rgba(28,16,7,0.75),' +
                  '0 1px 0 rgba(255,244,220,0.24), 0 2px 3px rgba(0,0,0,0.45)',
              }}
            />
            {/* rust gathering along the band's lower lip */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                borderRadius: 4,
                background:
                  'radial-gradient(80% 40% at 12% 104%, rgba(122,62,28,0.4) 0%, transparent 70%),' +
                  'radial-gradient(60% 40% at 92% 100%, rgba(122,62,28,0.3) 0%, transparent 70%)',
              }}
            />
            <Well
              radius={2}
              className="flex flex-col items-center justify-center overflow-hidden"
              style={{
                position: 'absolute',
                inset: 4,
                background:
                  'linear-gradient(158deg, #34251d 0%, #3d2c23 42%, #46352a 100%)',
                boxShadow:
                  'inset 2px 3px 7px rgba(0,0,0,0.85), inset -1px -1px 0 rgba(120,102,84,0.5)',
              }}
            >
              <span
                className="display-title block text-center"
                style={{
                  fontSize: 23,
                  lineHeight: 1,
                  letterSpacing: '0.05em',
                  textShadow: '0 1px 2px rgba(14,8,3,0.9), 0 0 14px rgba(255,238,208,0.24)',
                }}
              >
                {category.label}
              </span>
              <span
                className="tech-label mt-[3px] block text-center"
                style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#e0cbab', opacity: 0.95 }}
              >
                {activeDay.name}
              </span>
              {selectableCount === 0 && (
                <span className="sr-only">All eight teams are already logged for today</span>
              )}
            </Well>
          </span>
        </Plate>

        {/* ---- the category picker: six engraved chips on a brass rail, the
                active one lit amber. Picking a category switches the route and
                drops any half-made selection with it. ---- */}
        <div
          className="relative mx-1 mt-[6px] flex items-stretch justify-between"
          role="tablist"
          aria-label="Category"
          style={{
            height: 34,
            padding: '4px 8px',
            borderRadius: 5,
            background:
              'linear-gradient(180deg, #c6b2a3 0%, #a78d74 14%, #6e5647 32%, #5a4637 55%, #4e3c2c 80%, #332416 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,244,214,0.35), inset 0 -1px 0 rgba(20,12,4,0.6), 0 2px 3px rgba(0,0,0,0.5)',
            gap: 6,
          }}
        >
          {categories
            .filter((cat) => cat.id !== 'golden_key')
            .map((cat) => {
              const active = cat.id === category.id
              return (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={active}
                  aria-label={cat.label}
                  onClick={() => {
                    if (active) return
                    setSelected(new Set())
                    navigate(`/call/${cat.id}`)
                  }}
                  className="relative flex flex-1 items-center justify-center font-mono uppercase"
                  style={{
                    borderRadius: 3,
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    color: active ? '#fff1d8' : 'rgba(34,22,9,0.88)',
                    background: active
                      ? 'linear-gradient(180deg, #7a3d0c 0%, #b5662a 46%, #8a4a16 100%)'
                      : 'linear-gradient(180deg, #8a7050 0%, #75593c 55%, #5e4630 100%)',
                    boxShadow: active
                      ? 'inset 0 -1.5px 0 rgba(255,206,150,0.8), inset 0 0 0 1px rgba(255,168,96,0.35), 0 0 9px rgba(237,144,64,0.55)'
                      : 'inset 0 1px 0 rgba(255,238,205,0.28), inset 0 -1px 2px rgba(20,12,4,0.55)',
                    textShadow: active ? '0 1px 0 rgba(60,28,6,0.8)' : '0 1px 0 rgba(255,236,205,0.2)',
                  }}
                >
                  {cat.glyph}
                </button>
              )
            })}
        </div>

        {/* ---- eight rows, whole plate is the hit area ---- */}
        <div
          className="relative flex flex-col"
          style={{
            gap: ROW_GAP,
            // a locked day is a view-only machine: recessed and desaturated
            opacity: locked ? 0.62 : 1,
            filter: locked ? 'saturate(0.55)' : undefined,
          }}
        >
          {teams.map((team, rowIndex) => {
            const done = doneFor(team.id)
            const on = selected.has(team.id)
            const lit = ignited.has(team.id)
            const color = `var(--color-team-${team.colorToken})`
            const ticks = checkInCount(events, activeDay.id, team.id)
            /* `ticks` is already the post-commit count — the store appends
               before the ignition stagger runs — so the lit count is never
               allowed to exceed it. The pull's own socket is the one recorded
               in `landed`, and it flashes white in place. */
            const shown = ticks
            const landedAt = lit ? landed.get(team.id) : undefined
            /* The cliff. Missing the seventh check-in costs 0.4, not 0.1, and a
               row that is ALREADY LOGGED for this activity is precisely the one
               whose seventh is still at risk — so the rim shows on done rows
               too. Gating it on `!done` is what hid it from both teams at 6/7. */
            const atCliff = isPunctuality && ticks === MAX_CHECK_INS - 1
            // At the cliff the whole track is what jumps to 1.0, so the whole
            // track goes white-hot; otherwise only the socket this pull adds.
            const wholeTrackHot = on && ticks + 1 === MAX_CHECK_INS
            const readout = on
              ? isPunctuality
                ? formatDeci(punctualityDeci(ticks + 1))
                : formatDeci(BINARY_DECI)
              : undefined
            /* Teal light from the lever below, landing on the plate it can
               actually reach: strong on row 8, a warm hint by row 1. */
            const spillT = rowIndex / (teams.length - 1)
            return (
              <Plate
                key={team.id}
                as="button"
                chamfer={6}
                ariaPressed={on}
                disabled={done || locked}
                onClick={() => toggle(team.id)}
                ariaLabel={
                  isPunctuality
                    ? `${team.name}, ${ticks} of ${MAX_CHECK_INS} check-ins${
                        atCliff ? ', seventh check-in raises 0.6 to 1.0' : ''
                      }${done ? ', already logged' : ''}`
                    : `${team.name}${done ? ', already awarded' : ''}`
                }
                style={{ height: ROW_H, opacity: done ? 0.86 : 1, position: 'relative', zIndex: 1 }}
              >
                <PlateGrade keyLight={1 - rowIndex / (teams.length - 1)} />
                <TopSpecular />
                <CornerScrews inset={SCREW_INSET} size={SCREW} />
                {/* engraved groove just inside the plate edge */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{
                    inset: 5,
                    borderRadius: 2,
                    boxShadow:
                      'inset 0 1px 0 rgba(255,244,220,0.14), 0 1px 0 rgba(28,16,6,0.5)',
                  }}
                />
                {/* discharge: the emitter below rim-lights the plate's lower
                    edge. Motivated light with a real falloff — row 8 catches it,
                    row 1 barely does. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    borderRadius: 2,
                    background:
                      `linear-gradient(0deg, rgba(${Math.round(255 - 22 * spillT)},${Math.round(
                        236 + 10 * spillT,
                      )},${Math.round(202 + 20 * spillT)},0.55) 0%,` +
                      `rgba(${Math.round(255 - 14 * spillT)},${Math.round(238 + 6 * spillT)},${Math.round(
                        206 + 14 * spillT,
                      )},0.22) 25%, rgba(255,240,212,0.1) 60%, rgba(255,240,212,0.03) 100%)`,
                    boxShadow: `inset 0 -2px 7px rgba(170,252,246,${(0.06 + 0.3 * spillT).toFixed(2)})`,
                    opacity: discharging && !reduced ? 0.04 + 0.22 * spillT : 0,
                    transition: 'opacity 170ms ease-out',
                  }}
                />
                {/* selection: a single amber rim on the plate. Team colour stays
                    in the crest and the earned sockets, nowhere else. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{
                    inset: 2,
                    borderRadius: 2,
                    boxShadow: 'inset 0 0 0 1px var(--color-lamp)',
                    opacity: on ? 0.55 : 0,
                    transition: 'opacity 180ms ease-out',
                  }}
                />
                {/* the row's contents ride ABOVE the material overlays — a grade
                    laid over the cream name is how it stopped reading as cream */}
                <span
                  className="relative flex h-full items-center"
                  style={{ paddingLeft: 20, paddingRight: 20, gap: 6 }}
                >
                  <TeamCrest teamId={team.id} size={CREST} glow={on || lit ? 1 : 0.6} />

                  <span
                    className="font-display min-w-0 flex-1 truncate text-[18px] font-bold uppercase leading-none"
                    style={{
                      letterSpacing: '0em',
                      color: '#fdf6e6',
                      textShadow:
                        '0 1px 0 rgba(20,11,4,0.8), 0 2px 5px rgba(20,11,4,0.5), 0 0 9px rgba(255,240,212,0.2)',
                    }}
                  >
                    {team.shortName}
                  </span>

                  {/* the count itself: seven sockets, earned ones in team colour */}
                  {isPunctuality ? (
                    <span
                      className="relative flex shrink-0 items-center"
                      style={{ gap: SOCKET_GAP, width: TRACK_W }}
                    >
                      {Array.from({ length: MAX_CHECK_INS }, (_, i) => {
                        const earned = i < shown
                        const hot =
                          (on && (wholeTrackHot || i === ticks)) || i === landedAt
                        const cliffRim = atCliff && !hot && i === MAX_CHECK_INS - 1
                        return (
                          <span
                            key={i}
                            className="relative block"
                            style={{ width: SOCKET, height: SOCKET }}
                          >
                            <Socket on={earned} hot={hot} color={color} />
                            {cliffRim && (
                              <span
                                aria-hidden
                                className="pulse-rim absolute rounded-full"
                                style={{
                                  inset: -2.5,
                                  opacity: 0.95,
                                  boxShadow:
                                    'inset 0 0 0 2px var(--color-lamp), 0 0 6px 1px rgba(237,144,64,0.75)',
                                }}
                              />
                            )}
                            {surged.has(team.id) && (
                              <span
                                aria-hidden
                                className="surge-flash absolute block rounded-full"
                                /* the flash belongs in the bore — a white disc
                                   over the whole socket erases the grommet */
                                style={{ inset: 3.4, background: '#fff8e6' }}
                              />
                            )}
                          </span>
                        )
                      })}
                      {/* the seventh check-in is a discharge, not a flash:
                          current jumps the gap that splits the six from the
                          prize. Mounted keyed to the commit so it strikes
                          once and the ignition timer unmounts it. */}
                      {surged.has(team.id) && batch && (
                        <span
                          className="pointer-events-none absolute"
                          style={{ right: -5, top: '50%', marginTop: -9, zIndex: 3 }}
                        >
                          <ArcStrike
                            key={`surge-${batch.at}`}
                            width={SOCKET * 2 + SOCKET_GAP + 10}
                            height={18}
                            seed={rowIndex + 41}
                            postR={2}
                            weight={0.7}
                          />
                        </span>
                      )}
                      {/* the cliff readout: missing the seventh costs 0.4, so
                          the row previews the jump instead of hiding it inside
                          the ladder. Absolute, so every row keeps one baseline. */}
                      {atCliff && !on && !lit && (
                        <span
                          aria-hidden
                          className="tech-label absolute text-center"
                          style={{
                            left: 0,
                            right: 0,
                            top: '100%',
                            marginTop: 2,
                            fontSize: 7.5,
                            letterSpacing: '0.1em',
                            color: 'var(--color-lamp)',
                            textShadow: '0 0 5px rgba(237,144,64,0.55)',
                          }}
                        >
                          0.6 → 1.0
                        </span>
                      )}
                    </span>
                  ) : (
                    /* a binary category: one cell, lit in the team colour */
                    <span className="relative block shrink-0" style={{ width: 24, height: 24 }}>
                      <Socket on={done || lit} hot={on} color={color} square />
                    </span>
                  )}

                  <span className="engraved-v shrink-0" aria-hidden style={{ height: 30 }} />

                  {/* the selection control: a big knurled cog whose face flips
                      to the value this pull will land */}
                  <span className="relative shrink-0" aria-hidden>
                    <RowKnob size={KNOB} readout={readout} glow={on} />
                    {/* the award lands ON the row: current jumps the knob's
                        collars when this row's point commits — the lever's
                        own storm is the switch, this is the award */}
                    {ignited.has(team.id) && batch && (
                      <span
                        className="pointer-events-none absolute"
                        style={{ left: -6, right: -6, top: '50%', marginTop: -10, zIndex: 3 }}
                      >
                        <ArcStrike key={batch.at} width={KNOB + 12} height={20} seed={rowIndex + 5} />
                      </span>
                    )}
                  </span>
                </span>
              </Plate>
            )
          })}

          {/*
            Discharge light from the lever. It sits BEHIND the row plates (each
            plate carries zIndex 1) so what it lights is the WALL showing through
            every gutter and down both margins — it must never wash the brass
            faces teal, which is how round two first turned the whole stack
            blue-green. The alphas are matched to the reference pair: the gap
            between rows 1/2 goes L 20 -> 43 and stays warm (R > G > B), while the
            gap below row 8 goes L 14 -> 90 and turns genuinely teal.
          */}
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: 0,
              right: 0,
              top: -4,
              bottom: -14,
              zIndex: 0,
              background:
                'linear-gradient(0deg, rgba(176,255,249,0.48) 0%, rgba(150,246,238,0.43) 8%,' +
                'rgba(152,240,228,0.39) 20%, rgba(176,238,220,0.34) 38%,' +
                'rgba(206,238,214,0.28) 58%, rgba(232,238,210,0.23) 78%,' +
                'rgba(250,238,208,0.17) 100%)',
              opacity: discharging && !reduced ? 1 : 0,
              transition: 'opacity 160ms ease-out',
            }}
          />
        </div>

        {/*
          ---- commit ----
          The lever sits ABOVE the screen vignette (zIndex 2, matching the row
          plates' own layer). It has to: the vignette is a wall falloff painted
          over everything, and at the tube's height it multiplies by 0.867 —
          which is exactly why the blown core measured #dfdfde L223 instead of
          #ffffff, with zero pure-white pixels anywhere in the frame. An emitter
          cannot be dimmed by the room it is lighting. The falloff the lever
          would have taken from the vignette is carried inside Lever itself, on
          a layer the discharge paints over.
        */}
        <div className="relative" style={{ zIndex: 2 }}>
          <Lever
            pendingCount={selected.size}
            disabled={locked}
            onFire={onFire}
            onDischarge={setDischarging}
            groove={groove}
          />
        </div>

        {/* the warm vignette: the wall's own falloff toward the bezel */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: 3,
            background:
              'radial-gradient(120% 76% at 46% 32%, transparent 46%, rgba(14,8,3,0.22) 80%, rgba(11,6,2,0.5) 100%)',
          }}
        />
      </div>
    </ScreenFrame>
  )
}
