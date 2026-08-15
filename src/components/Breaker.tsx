import { useId } from 'react'
import type { CategoryId } from '../data/types'

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
  /**
   * `cell` is the board's vertical paddle. `toggle` is the team sheet's wide
   * horizontal capsule — a recessed seat, brass bezel ring, emissive amber
   * track and a domed brass knob. The toggle is amber for every category:
   * team colour on this screen belongs to the crest, not to five switches.
   */
  variant?: 'cell' | 'toggle'
}

const VB_W = 22
const VB_H = 29

export default function Breaker(props: BreakerProps) {
  return props.variant === 'toggle' ? <CapsuleToggle {...props} /> : <PaddleCell {...props} />
}

/* ---- The team sheet's capsule toggle ------------------------------------ */

const TOG_W = 64
const TOG_H = 34

/**
 * A physical toggle, built as four nested parts because that is what the
 * reference shows: an **outer seat** milled into the plate (inner shadow under
 * its top-left lip, one lit hairline along the bottom-right), a **raised brass
 * bezel** seated in it, the **track** inside that, and the **knob** standing
 * proud of both.
 *
 * ON, the track is the emitter. An emitter that does not measurably lift the
 * metal beside it is painted, not lit — so the light it throws is a separate
 * screen-blended layer that overruns the part on all sides with a tight
 * falloff. Sampled against the same point on an OFF row, the reference's plate
 * lifts +16 luma and +42 in R−B; that is what this is sized to.
 */
function CapsuleToggle({ on, title }: BreakerProps) {
  const knobD = TOG_H - 8
  return (
    <span
      role="img"
      aria-label={title ? `${title}: ${on ? 'on' : 'off'}` : undefined}
      className="relative block shrink-0"
      style={{ width: TOG_W, height: TOG_H }}
    >
      {/*
       * The light the track throws onto the plate around it, sized by
       * measurement rather than by eye. Scanned across the reference at the
       * capsule's mid-height, the plate 0–5px out from an ON toggle lifts +17
       * luma against the same point on an OFF row, and by 7–13px out the lift
       * is +2 — the spill is **gone within half a capsule height**. The build
       * was carrying it 22px and reading +23 at the lip, which washed the whole
       * right third of every ON row orange and flattened the rows into one
       * glowing band. Radius is set from that scan, not by eye.
       */}
      {on && (
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            inset: -12,
            borderRadius: 9999,
            background:
              'radial-gradient(ellipse closest-side, rgba(252,150,46,0.58) 0%, rgba(252,150,46,0.55) 46%, rgba(252,150,46,0.41) 60%, rgba(250,145,42,0.24) 71%, rgba(248,140,38,0.12) 81%, rgba(246,135,34,0.05) 89%, rgba(244,130,30,0.014) 95%, transparent 100%)',
          }}
        />
      )}

      {/* the seat: a groove cut into the plate, dark under its top-left lip */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          borderRadius: TOG_H / 2,
          background: 'linear-gradient(160deg, #1d140c 0%, #2b1e13 46%, #4a3524 100%)',
          boxShadow: on
            ? 'inset 2px 2px 4px rgba(0,0,0,0.85), inset -1px -1px 0 rgba(255,240,216,0.2), 0 1px 0 rgba(255,240,216,0.16)'
            : /* unpowered: no outer light band — a dead control emits nothing */
              'inset 2px 2px 4px rgba(0,0,0,0.85), inset -1px -1px 0 rgba(255,240,216,0.1)',
        }}
      />

      {/*
       * The brass bezel. ON, its lower lip is genuinely bright — the emitter
       * sitting inside it throws light down onto it, which is what the
       * reference shows. OFF, nothing is emitting, so the bezel is dim warm
       * brass in the plate's own value family: sampled off the reference, the
       * unpowered bezel peaks at L≈120 where the powered one reaches L≈197.
       */}
      <span
        aria-hidden
        className="absolute"
        style={{
          inset: 2,
          borderRadius: (TOG_H - 4) / 2,
          padding: 3,
          background: on
            ? 'linear-gradient(178deg, #4e3a18 0%, #8a6b2e 24%, #c9a45c 60%, #f2dda9 88%, #a7873f 100%)'
            : 'linear-gradient(178deg, #3b2c15 0%, #5e4926 26%, #7c6236 62%, #98783f 88%, #5c4626 100%)',
          boxShadow: on
            ? 'inset 0 2px 2px rgba(30,17,4,0.7), inset 0 -1px 0 rgba(255,248,224,0.75), 0 1px 1px rgba(0,0,0,0.5)'
            : 'inset 0 2px 2px rgba(20,11,3,0.8), inset 0 -1px 0 rgba(255,236,196,0.22), 0 1px 1px rgba(0,0,0,0.5)',
        }}
      >
        {/*
         * The track. ON it is the emitter — and an emitter sunk in a channel is
         * shaded by the channel: the reference's profile runs dark at the top
         * lip (the recess's own inner shadow), dips through a shadowed band,
         * then ramps to its peak at ~88% of the height before falling off at
         * the bottom edge. Brightest-at-the-top is a raised pill, not a filled
         * recess, so the ramp runs downward.
         *
         * OFF it is a dead channel: --off-track's family, sampled on the
         * reference at L≈40 against a plate at L≈68 — darker than the metal
         * around it, and carrying no highlight at all.
         */}
        <span
          className={`relative block h-full w-full ${on ? 'lamp-on' : ''}`}
          style={{
            borderRadius: (TOG_H - 10) / 2,
            ['--emit' as string]: 'var(--color-lamp)',
            background: on
              ? 'linear-gradient(180deg, #4a1400 0%, #7a2c02 6%, #b04c10 13%, #93400c 21%, #8e3f0e 34%, #a8500f 52%, #c2611a 68%, #e07726 82%, #f2892f 90%, #b8500e 100%)'
              : 'linear-gradient(180deg, #140d07 0%, #241810 34%, #33241a 70%, var(--color-off-track) 100%)',
            boxShadow: on
              ? 'inset 0 2px 3px rgba(58,13,0,0.8), inset 0 -1px 0 rgba(255,214,150,0.45), 0 0 6px 1px var(--color-lamp)'
              : 'inset 1px 2px 4px rgba(0,0,0,0.85), inset -1px -1px 0 rgba(255,240,216,0.08)',
          }}
        />
      </span>

      {/* legend struck into the track, on the half the knob leaves free */}
      <span
        aria-hidden
        className="font-display absolute font-semibold uppercase"
        style={{
          top: '50%',
          left: on ? 11 : undefined,
          right: on ? undefined : 9,
          transform: 'translateY(-50%)',
          fontSize: 15,
          lineHeight: 1,
          letterSpacing: '0.03em',
          color: on ? '#fff2cf' : '#8b6f52',
          textShadow: on ? '0 1px 1px rgba(120,40,0,0.85)' : '0 1px 0 rgba(0,0,0,0.7)',
        }}
      >
        {on ? 'ON' : 'OFF'}
      </span>

      {/*
       * The knob: a machined brass cylinder, not a ball. An outer collar, a
       * vertically-brushed face inside it, and a hard contact shadow down-right
       * from the one top-left key light. It overhangs the bezel, which is what
       * says it is a separate part standing on top rather than a dot inside.
       */}
      <span
        aria-hidden
        className="absolute"
        style={{
          top: (TOG_H - knobD) / 2,
          left: on ? TOG_W - knobD - 2 : 2,
          width: knobD,
          height: knobD,
          borderRadius: 9999,
          padding: 2,
          /*
           * The knob is machined brass in both states — a switched-off control
           * is not made of a different metal. Sampled off the reference the ON
           * knob means rgb(135,101,59) and the OFF knob rgb(85,64,48): warm
           * bronze, only a little above the plate. Pale neutral chrome reads
           * cool against brown and breaks the one-material rule.
           */
          background: on
            ? 'linear-gradient(158deg, #d0b476 0%, #9c7833 34%, #66491a 68%, #291b08 100%)'
            : 'linear-gradient(158deg, #8a7551 0%, #574529 34%, #362817 68%, #140e07 100%)',
          boxShadow: on
            ? '2px 3px 4px rgba(0,0,0,0.75), 0 0 0 1px rgba(28,16,6,0.75), inset 0 1px 0 rgba(255,246,214,0.6)'
            : '2px 3px 4px rgba(0,0,0,0.75), 0 0 0 1px rgba(20,11,3,0.8), inset 0 1px 0 rgba(255,238,200,0.35)',
        }}
      >
        {/*
         * The knob's face: a machined cylinder end, brushed vertically. The
         * brushing is a run of narrow low-contrast stops rather than one hard
         * light/dark split — a single 50% boundary reads as a two-tone disc.
         */}
        <span
          className="block h-full w-full"
          style={{
            borderRadius: 9999,
            background:
              'linear-gradient(90deg, rgba(255,248,222,0) 6%, rgba(255,248,222,0.1) 22%, rgba(255,248,222,0.2) 38%, rgba(255,248,222,0.26) 48%, rgba(255,248,222,0.14) 56%, rgba(48,32,10,0.1) 64%, rgba(48,32,10,0.22) 78%, rgba(48,32,10,0.3) 94%),' +
              (on
                ? 'radial-gradient(circle at 34% 24%, #bb9a56 0%, #8e6c30 40%, #64491c 72%, #2f2009 100%)'
                : 'radial-gradient(circle at 34% 24%, #7f6c4b 0%, #55432a 42%, #362817 74%, #181109 100%)'),
            boxShadow: on
              ? 'inset 0 1px 1px rgba(255,250,232,0.5), inset 0 -2px 3px rgba(34,19,4,0.55)'
              : 'inset 0 1px 1px rgba(255,240,206,0.3), inset 0 -2px 3px rgba(20,11,3,0.6)',
          }}
        />
      </span>
    </span>
  )
}

/* ---- Engraved category glyphs ------------------------------------------- */

/**
 * Brass line art, cut into the plate: a lit stroke over a dark offset copy, so
 * the glyph reads as raised metal under the same top-left key light as every
 * other part. Line art, never a filled shape and never an emoji.
 */
/** A ring of open gear teeth as stroke paths, so a gear reads as line art. */
function cogTeeth(cx: number, cy: number, rIn: number, rOut: number, n: number): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n
    const hi = (Math.PI / n) * 0.5
    const ho = (Math.PI / n) * 0.3
    const p = (r: number, off: number) =>
      `${(cx + Math.cos(a + off) * r).toFixed(2)} ${(cy + Math.sin(a + off) * r).toFixed(2)}`
    return `M${p(rIn, -hi)} L${p(rOut, -ho)} L${p(rOut, ho)} L${p(rIn, hi)}`
  }).join(' ')
}

/** A small stroked ring — a circuit node, a hub, a clock tick. */
const ring = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`

/**
 * A rounded bar from one point to another — a finger. Fingers are the whole
 * read of a handshake, and they have to be drawn as separate stroked masses
 * rather than grooves cut into one blob: at 42px a groove closes up and the
 * clasp goes back to being a fist.
 */
function capsule(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * w
  const ny = (dx / len) * w
  const f = (n: number) => n.toFixed(2)
  return (
    `M${f(x1 + nx)} ${f(y1 + ny)} L${f(x2 + nx)} ${f(y2 + ny)}` +
    ` A${w} ${w} 0 0 1 ${f(x2 - nx)} ${f(y2 - ny)} L${f(x1 - nx)} ${f(y1 - ny)}` +
    ` A${w} ${w} 0 0 1 ${f(x1 + nx)} ${f(y1 + ny)} Z`
  )
}

const GLYPH_PATHS: Record<string, string[]> = {
  // gear with a droplet running off it
  cleanliness: [
    ring(18.5, 18.5, 10),
    ring(18.5, 18.5, 4.2),
    cogTeeth(18.5, 18.5, 10, 14.2, 9),
    'M35.5 25.5 C40.4 32 42.5 34.8 42.5 37.2 A7 7 0 0 1 28.5 37.2 C28.5 34.8 30.6 32 35.5 25.5 Z',
  ],
  // clock face with a gear turning at its shoulder
  punctuality: [
    ring(19.5, 18.5, 13),
    'M19.5 10 V18.5 L26 22.5',
    'M19.5 6.6 V8.6 M19.5 28.4 V30.4 M11 18.5 H9 M28 18.5 H30',
    ring(34.5, 33.5, 5.6),
    ring(34.5, 33.5, 2.1),
    cogTeeth(34.5, 33.5, 5.6, 8.6, 8),
  ],
  // scroll with a cross struck into it and two ruled lines
  memory_verse: [
    'M13.5 11.5 H34.5 V36.5 H13.5 Z',
    'M13.5 11.5 A3.6 3.6 0 0 1 13.5 4.3 H34.5 A3.6 3.6 0 0 0 34.5 11.5',
    'M13.5 36.5 A3.6 3.6 0 0 0 13.5 43.7 H34.5 A3.6 3.6 0 0 1 34.5 36.5',
    'M24 15 V27.5',
    'M18.4 19.8 H29.6',
    'M18 32 H30',
  ],
  /*
   * The handshake's masses are filled (see GLYPH_FILLS); what is left as line
   * art is the detail cut INTO them — the thumb web at the top of the grip and
   * the seam where the two palms part. Those two cuts are what turn one blob
   * into two hands.
   */
  good_deed: [
    /*
     * The thumb web: the notch the near thumb makes over the top of the grip.
     * It has to READ as a crease in a continuous mass, so the clasp's own top
     * edge above it stays a smooth arc — cutting the notch into the silhouette
     * as well turned the pair into a letter M.
     */
    'M15.4 14.0 C16.6 18.2, 18.0 20.8, 21.0 20.6 C23.8 20.4, 26.2 17.8, 28.6 14.4',
    /* the seam where the far hand's palm passes under the near hand's */
    'M21.6 25.6 C25.0 25.2, 28.0 23.6, 30.4 21.0',
  ],
  /*
   * A brain in profile with a stem, circuit traces cut into it, and a soldered
   * node terminating each trace. The profile silhouette and the stem are the
   * whole read — a symmetrical lobed blob is a cauliflower.
   */
  lesson_knowledge: [
    /*
     * Profile silhouette: forehead front-left, occiput right, the temple
     * notched in above the brainstem, which drops out of the base at the back.
     * Asymmetry is the whole read — a ring of even lobes is a cauliflower.
     */
    'M18.4 9.6 C11.6 10.2 7 15.4 8.2 20.6 C5.2 23.4 6.4 27.8 10 29.2 C10.4 33 14 35.8 18 35.4 L26.6 35.4 C31.4 36.2 36 33.4 36.4 29 C41.4 27.4 43 21.8 40 18 C40.8 12.4 35.6 8 30 8.8 C26.8 6.6 21.6 7 18.4 9.6 Z',
    /*
     * Inside it, a circuit — traces and soldered nodes, the way the reference
     * fills the mass. Drawn as short right-angled runs rather than long curves:
     * a curve inside a lobed outline reads as a second worm, a right-angled
     * trace ending on a round pad reads as a board.
     */
    'M15 14.6 V19.4 H21.4 V16.2',
    'M25.4 12.8 V21.2 H31.6 V25',
    'M12.6 24.6 H19 V29.4',
    'M23 26 H28.6',
    ring(15, 13.4, 1.3),
    ring(21.4, 15, 1.3),
    ring(25.4, 11.6, 1.3),
    ring(32.8, 26.2, 1.3),
    ring(19, 30.6, 1.3),
    ring(29.8, 26, 1.3),
    /* the brainstem, dropping out of the base at the back */
    'M26.6 35.4 C27.6 39 29.2 41.4 31.6 42.8',
  ],
  /* The hero is entirely a filled silhouette — see GLYPH_FILLS. */
  behavior: [],
}

/**
 * Filled silhouettes, struck proud of the plate.
 *
 * Two of the reference's six glyphs are not line art at all: the handshake and
 * the caped figure are **solid embossed brass with a dark contour**. Drawn as
 * thin outline strokes they lose the shape — a stroked handshake reads as two
 * pipes meeting and a stroked hero reads as a crossing-sign pictogram. Weight
 * is part of the drawing, so these are filled and the rest stay engraved.
 */
const GLYPH_FILLS: Record<string, string[]> = {
  /*
   * The handshake, built the way the reference draws it: two sleeves rising
   * OUTWARD from the lower corners to cuffs at the top left and top right —
   * mirrored, at the same height — one clasp mass bridging between them on a
   * level axis, and two groups of fingers hanging below it. The previous pass
   * had one forearm entering low from the left and the other dropping in from
   * the upper right, which reads as a single bent limb: the diagonal, not the
   * detail, is what made it wrong.
   *
   * The clasp is listed FIRST so both cuffs are struck over its roots — a cuff
   * is in front of the wrist it covers, and drawing it that way is what lets
   * the hands run under the sleeves without a seam.
   */
  good_deed: [
    /* the clasp: both palms, bridging cuff to cuff, dipping in the middle */
    'M8.0 9.8 C15.0 9.0, 21.4 10.6, 26.8 13.0 C31.0 14.8, 35.4 13.8, 40.0 9.6' +
      ' L42.4 17.0 C41.6 23.4, 37.6 28.4, 32.0 30.8 C25.8 33.4, 18.4 31.6, 13.2 27.0' +
      ' C9.6 23.8, 7.4 18.6, 8.0 9.8 Z',
    /* left sleeve, cuff at the top, running down and out to the lower left */
    'M10.53 8.13 L16.67 11.07 L6.67 31.97 L0.53 29.03 Z',
    /* right sleeve, its mirror */
    'M37.47 8.13 L31.33 11.07 L41.33 31.97 L47.47 29.03 Z',
    /* the near hand's knuckles, three bumps stepping down to the right */
    capsule(19.4, 26.2, 13.6, 28.9, 1.6),
    capsule(22.8, 29.4, 17.0, 32.1, 1.6),
    capsule(26.0, 32.2, 20.9, 34.7, 1.5),
    /* the far hand's fingers, wrapping down over the near hand's back */
    capsule(34.8, 21.8, 28.2, 28.8, 1.5),
    capsule(36.4, 25.0, 30.2, 31.8, 1.5),
    capsule(36.8, 28.4, 31.4, 34.6, 1.4),
  ],
  behavior: [
    /* the cape first, so the figure is struck on top of it */
    'M26.8 17.2 C34.2 17.6 40.2 20.8 44.2 25.8 C40.8 24.8 37.6 25.2 35.2 27.0 C36.8 31.4 35.4 36.0 32.0 39.6 C31.8 35.8 30.4 32.4 28.0 29.8 C30.6 25.4 30.0 20.6 26.8 17.2 Z',
    ring(20, 9.6, 4.6),
    /* squared shoulders tapering to the waist */
    'M10.0 21.0 L15.4 16.6 L24.6 16.6 L30.0 21.0 L25.6 30.6 L14.4 30.6 Z',
    /* arms akimbo — elbows carried out so the triangle beside the torso stays open */
    'M10.6 19.6 L6.2 28.6 L14.6 32.4 L15.6 29.6 L9.8 27.2 L14.2 20.8 Z',
    'M29.4 19.6 L33.8 28.6 L25.4 32.4 L24.4 29.6 L30.2 27.2 L25.8 20.8 Z',
    /* legs planted apart */
    'M19.4 28.6 L14.2 28.6 L12.4 42.8 L16.2 42.8 Z',
    'M20.6 28.6 L25.8 28.6 L27.6 42.8 L23.8 42.8 Z',
  ],
}

export function CategoryGlyph({ id, size = 42 }: { id: CategoryId | string; size?: number }) {
  const uid = useId()
  const g = (n: string) => `${n}-${uid}`
  const paths = GLYPH_PATHS[id]
  const fills = GLYPH_FILLS[id]
  if (!paths && !fills) return <span style={{ width: size, height: size, display: 'block' }} />
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={g('brass')} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffeec4" />
          <stop offset="30%" stopColor="#dcb478" />
          <stop offset="66%" stopColor="#ab8a52" />
          <stop offset="100%" stopColor="#5e4726" />
        </linearGradient>
      </defs>
      {/* the cast shadow: a dark copy dropped down-right under the one key light */}
      <g
        fill="#2b1b0c"
        stroke="#2b1b0c"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.78"
        transform="translate(1.2 1.4)"
      >
        {fills?.map((d, i) => (
          <path key={`f${i}`} d={d} />
        ))}
        {!fills &&
          paths?.map((d, i) => (
            <path key={i} d={d} fill="none" />
          ))}
      </g>
      {/*
       * Filled parts carry a dark contour, the way a struck brass emblem does:
       * the cut edge around the raised face is what separates it from the plate
       * behind it at 42px.
       */}
      {fills && (
        <g fill={`url(#${g('brass')})`} stroke="#33200c" strokeWidth="1.5" strokeLinejoin="round">
          {fills.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
      {/*
       * On a filled glyph the line art is detail cut INTO the raised face —
       * finger grooves, cuff seams — so it is a dark groove with one lit lower
       * lip, not a brass stroke that would vanish into the brass beneath it.
       */}
      {fills ? (
        <>
          <g
            fill="none"
            stroke="rgba(255,236,196,0.5)"
            strokeWidth="1.5"
            strokeLinecap="round"
            transform="translate(0.5 0.9)"
          >
            {paths?.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g fill="none" stroke="#2e1d0b" strokeWidth="1.7" strokeLinecap="round" opacity="0.9">
            {paths?.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </>
      ) : (
        <g
          fill="none"
          stroke={`url(#${g('brass')})`}
          strokeWidth="2.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths?.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
    </svg>
  )
}

/* ---- The board's paddle cell -------------------------------------------- */

function PaddleCell({ on, color, size = 22, glyph, title }: BreakerProps) {
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
          <rect x={-2.5} y={paddleY - 3.5} width={VB_W + 5} height={paddleH + 7} rx={5} fill={color} opacity="0.075" />
          <rect x={0.5} y={paddleY - 1.5} width={VB_W - 1} height={paddleH + 3} rx={3.5} fill={color} opacity="0.13" />
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
