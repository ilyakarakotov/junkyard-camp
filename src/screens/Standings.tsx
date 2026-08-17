import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TeamCrest from '../components/TeamCrest'
import { KeyGlyph, Lamp, Plate, Well } from '../components/chrome'
import { ArcBolt, usePrefersReducedMotion } from '../fx/Arc'
import { recentActivity, standings } from '../data/derive'
import { formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { Category, ScoreEvent, Standing, Team } from '../data/types'

/**
 * Cumulative standings across every scored day.
 *
 * One machined plate per team, all the same height. Inside a row the plate is
 * split by an engraved hairline: [rank ring · medallion · name] on the left,
 * [score · glass meter] on the right. The meter is the same object as the
 * lever's tube — a straight dark glass barrel between two turned brass collars
 * — filled with light to the team's share of the leader.
 *
 * Base points and key points stay **separate** so you can see *how* a team is
 * winning. Arcs run on the leading row only: its tube carries no fill at all,
 * just current jumping electrode to electrode, because the leader is by
 * definition 100% of the leader total and nothing is lost.
 */

const TUBE_H = 20
const COLLAR_W = 14
/** Electrode width; it tucks 2px under its collar so it reads as one assembly. */
const ELECTRODE_W = 8
/** x of an electrode's inner face — where the light column starts and a bolt roots. */
const TRACK_X = COLLAR_W - 2 + ELECTRODE_W
const ROW_H = 112
/** Upper zone carries rank/crest/name and the score; lower zone the readout and meter. */
const ZONE_TOP = 60
const ZONE_BOT = 36
/** Right-hand compartment: the score above, the meter below. */
const RIGHT_W = 116
const CREST = 56
const RANK = 42
/** Content inset — clears the corner screws on all four sides. */
const PAD = '8px 14px'

/* ---- Tabular numerals --------------------------------------------------- */

/**
 * Oswald ships no `tnum` table, so `font-variant-numeric: tabular-nums` is
 * inert on it and the digit stems wander down a column. Hand-set each glyph in
 * a fixed cell instead: digits share one advance, the decimal point and the
 * sign get their own narrower cells, and the integer part is padded to the
 * column's widest so every decimal point in the column sits on one x.
 *
 * The real string is kept for assistive tech; the cells are decoration.
 */
const CELL: Record<string, number> = { '.': 0.3, '+': 0.56, '−': 0.56, '-': 0.56, '/': 0.42 }
const DIGIT_CELL = 0.6

function Digits({
  value,
  intWidth,
  className = '',
  style,
}: {
  value: string
  /** Pad the integer part to this many digit cells so decimals line up. */
  intWidth?: number
  className?: string
  style?: CSSProperties
}) {
  const dot = value.indexOf('.')
  const head = dot === -1 ? value : value.slice(0, dot)
  const intDigits = head.replace(/[^0-9]/g, '').length
  const pad = intWidth ? Math.max(0, intWidth - intDigits) : 0
  return (
    <span className={`numeral ${className}`} style={{ ...style, whiteSpace: 'nowrap' }}>
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      <span aria-hidden style={{ display: 'inline-flex' }}>
        {/*
          The pad cell carries a hidden `0`. An *empty* inline-block takes its
          baseline from its bottom margin edge, so an inline-flex row whose
          first item was empty sat ~2px high against an unpadded one and the
          three-character scores broke the column's shared baseline. Real
          glyph content gives the cell a real baseline; `visibility: hidden`
          keeps it out of the paint and out of the accessible name.
        */}
        {Array.from({ length: pad }, (_, i) => (
          <span
            key={`p${i}`}
            style={{
              display: 'inline-block',
              width: `${DIGIT_CELL}em`,
              visibility: 'hidden',
            }}
          >
            0
          </span>
        ))}
        {[...value].map((ch, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: `${CELL[ch] ?? DIGIT_CELL}em`,
              textAlign: 'center',
            }}
          >
            {ch}
          </span>
        ))}
      </span>
    </span>
  )
}

/* ---- Small shared parts ------------------------------------------------- */

/**
 * A small engraved brass nameplate with a rivet at each end — the reference's
 * `LEADING` tag, and the same part re-used for the big-screen link and the back
 * control's housing. Smaller than `BrassPlate`'s screwed variant, which needs
 * 11px heads it has no room for at this size.
 */
function Nameplate({
  children,
  size = 9,
  tracking = '0.2em',
  minWidth,
  className,
}: {
  children: ReactNode
  size?: number
  tracking?: string
  /** Force the plate to a share of the hardware it labels, as in the reference. */
  minWidth?: number
  className?: string
}) {
  return (
    <span
      className={`brass-band relative inline-flex items-center justify-center ${className ?? ''}`}
      style={{ borderRadius: 2, height: size + 8, padding: `0 ${size + 4}px`, minWidth }}
    >
      <span className="rivet absolute left-[3px] top-1/2 -translate-y-1/2" aria-hidden />
      <span className="rivet absolute right-[3px] top-1/2 -translate-y-1/2" aria-hidden />
      <span
        className="engraved font-display font-semibold uppercase leading-none"
        style={{ fontSize: size, letterSpacing: tracking }}
      >
        {children}
      </span>
    </span>
  )
}

/**
 * One `feTurbulence` tile as a data URI.
 *
 * `bf` is the base frequency — give it two values to stretch the field into
 * streaks (low in x, high in y ⇒ horizontal brushing). `a` is the peak alpha
 * and `gamma` the skew: above 1 it leaves most of the field clear and puts the
 * energy into sparse events, which is what grain looks like and what a flat
 * alpha does not.
 */
function noise(
  w: number,
  h: number,
  seed: number,
  bf: string,
  rgb: [number, number, number],
  a: number,
  gamma: number,
  oct = 2,
) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${bf}'` +
    ` numOctaves='${oct}' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} 0 0 0 ${a} 0'/>` +
    `<feComponentTransfer><feFuncA type='gamma' amplitude='1' exponent='${gamma}' offset='0'/>` +
    `</feComponentTransfer></filter><rect width='${w}' height='${h}' filter='url(%23n)'/></svg>`
  return `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}")`
}

/**
 * The plate face is a *surface*, and on a mid-tone brass face that has to be
 * argued for in amplitude, not just in the presence of a noise layer.
 *
 * Measured against the reference: its plate faces carry mean |dL/dx| 2.6–3.2,
 * |dL/dy| 2.7–3.3 — 11–13% of their own value. The shared `.plate` brushing
 * runs at base frequency `0.02 0.3`, i.e. a 3.3px period, and `.grain::after`
 * intersects its mask with a macro blotch field that zeroes most of the plate,
 * so a row face measured 0.53 / 0.87 — half a percent, a mathematically smooth
 * gradient with a screw on it.
 *
 * This is the tight band that was missing: a light and a dark brushing pass at
 * a ~1 CSS px period (so it survives at DPR 2), plus isotropic pitting. The
 * brushing is anisotropic — |dL/dy| runs above |dL/dx| — because the metal is
 * drawn horizontally, which is also what the material rules ask for.
 */
function RowGrain() {
  return (
    <>
      {/*
        Form shadow. A plate lit from the top left has its lower half rolling
        away from the light; the reference plates fall a long way into shadow at
        the bottom before the oxide even starts. Unmasked and unblotched — this
        is the shape of the light, not weathering.

        The ramp runs to 52% of the plate's height, not 38%: with the shorter
        one the top five eighths of every face sat at a single value, which is
        what drove the screen to medianL 75 — an evenly lit plate has no light
        direction and no form. The answering key pool in the top-left corner
        keeps the total swing honest rather than just subtracting light.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 0,
          borderRadius: 'inherit',
          background:
            'radial-gradient(120% 150% at 4% -14%, rgba(255,238,206,0.17) 0%,' +
            ' rgba(255,238,206,0.06) 26%, transparent 48%),' +
            'linear-gradient(0deg, rgba(12,6,2,0.62) 0%, rgba(12,6,2,0.44) 9%,' +
            ' rgba(12,6,2,0.3) 19%, rgba(12,6,2,0.17) 31%, rgba(12,6,2,0.07) 42%,' +
            ' transparent 52%),' +
            'linear-gradient(270deg, rgba(12,6,2,0.40) 0%, rgba(12,6,2,0.26) 11%,' +
            ' rgba(12,6,2,0.15) 23%, rgba(12,6,2,0.06) 35%, transparent 48%)',
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 0,
          borderRadius: 'inherit',
          backgroundImage: [
            noise(400, 140, 12, '0.014 0.95', [1, 0.95, 0.84], 0.22, 1.55),
            noise(400, 140, 31, '0.02 1.05', [0.07, 0.045, 0.02], 0.62, 1.3),
            noise(200, 200, 7, '0.62', [0.92, 0.86, 0.72], 0.42, 1.5, 1),
            noise(200, 200, 19, '0.62', [0.05, 0.032, 0.015], 1, 1.2, 1),
            noise(240, 240, 23, '0.055', [0.11, 0.07, 0.035], 0.5, 1.35, 3),
          ].join(','),
          backgroundSize: '400px 140px, 400px 140px, 200px 200px, 200px 200px, 240px 240px',
          backgroundPosition: '0 0, 71px 37px, 0 0, 113px 61px, 29px 53px',
          /* the drawn grain shows loudest where the key light rakes it */
          maskImage:
            'linear-gradient(135deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.78) 52%, rgba(0,0,0,0.6) 100%)',
          WebkitMaskImage:
            'linear-gradient(135deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.78) 52%, rgba(0,0,0,0.6) 100%)',
          opacity: 0.85,
        }}
      />
    </>
  )
}

/**
 * Where oxide is allowed to sit on a row plate — the lower edge and the two
 * lower corners — intersected with a high-contrast turbulence field so the
 * stain has **holes** in it. Bare metal showing through in patches is what
 * separates corrosion from an airbrushed ramp.
 */
const PATINA_MASK =
  'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.78) 11%, rgba(0,0,0,0.24) 24%, transparent 36%),' +
  'radial-gradient(40% 44% at 8% 100%, rgba(0,0,0,0.95), transparent 100%),' +
  'radial-gradient(36% 40% at 92% 100%, rgba(0,0,0,0.9), transparent 100%),' +
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='90'%3E%3Cfilter id='h'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.055 0.1' numOctaves='4' seed='61' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.4 -1.05'/%3E%3C/filter%3E%3Crect width='200' height='90' filter='url(%23h)'/%3E%3C/svg%3E\")"

/**
 * Oxide staining pinned to a plate's lower edge, its lower corners and its two
 * bottom screw seats. `.rust-creep` already stains the plate body; on a row
 * this short its masks have almost no area to work in, so the crevice patina
 * gets drawn explicitly. Normal-composited (not `overlay`) so it survives.
 */
function RowPatina() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: 'inherit',
        backgroundImage:
          /*
            Only the small seat blooms are smooth gradients; the broad stain is
            carried by the turbulence layers below. Two wide radial ramps along
            the bottom edge read as an airbrushed orange stripe, which is the
            opposite of corrosion.
          */
          'radial-gradient(circle 15px at 14px 97%, hsl(22 80% 35% / 0.62), transparent 72%),' +
          'radial-gradient(circle 15px at calc(100% - 14px) 97%, hsl(17 74% 31% / 0.6), transparent 72%),' +
          'radial-gradient(30% 22% at 9% 100%, hsl(20 78% 32% / 0.3), transparent 78%),' +
          'radial-gradient(24% 20% at 90% 100%, hsl(15 70% 28% / 0.26), transparent 80%),' +
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120'%3E%3Cfilter id='ro'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.06 0.11' numOctaves='4' seed='41' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.24 0 0 0 0 0.09 0 0 0 0.72 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='1.7' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='240' height='120' filter='url(%23ro)'/%3E%3C/svg%3E\")," +
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='rp'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.34' numOctaves='3' seed='19' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.09 0 0 0 0 0.05 0 0 0 0 0.02 0 0 0 0.72 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='1.9' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23rp)'/%3E%3C/svg%3E\")",
        backgroundSize: 'auto, auto, auto, auto, 240px 120px, 160px 160px',
        backgroundPosition: '0 0, 0 0, 0 0, 0 0, 11px 7px, 37px 23px',
        opacity: 0.88,
        /*
          Where the oxide is allowed to sit, intersected with a holey field so
          it eats the edge in patches. A single smooth radial ramp measured
          0.93 / 1.16 local variation against 4.55 / 7.52 on the reference's
          corroded band — a ramp is a gradient, not corrosion.
        */
        maskImage: PATINA_MASK,
        WebkitMaskImage: PATINA_MASK,
        maskComposite: 'add, add, add, intersect',
        WebkitMaskComposite: 'source-over, source-over, source-over, source-in',
      }}
    />
  )
}

/**
 * Frame and field. Every reference row plate is two pieces of metal, not one:
 * an outer band that stands proud, and the field stepped down inside it. The
 * build had a single flat face, which is why a row read as one smooth tan slab
 * with a screw at each corner — two depth layers where the material rules ask
 * for three or four.
 *
 * The step is stated with **light, not paint**: no fill is laid over the field,
 * because a plate face has to stay inside the spec's `#6A5240`–`#98795E` band
 * and this screen is already 63% plate by area. The band's top-left run catches
 * the key light, its bottom-right run falls away, the field's near wall
 * (top-left) carries the shadow and its far wall (bottom-right) takes the
 * hairline. One light direction throughout.
 */
function FrameStep() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        inset: 5,
        borderRadius: 3,
        boxShadow:
          'inset 1.5px 1.5px 3px rgba(10,5,1,0.5),' +
          ' inset -1px -1px 0 rgba(255,238,205,0.15),' +
          ' 0 -1px 0 rgba(255,242,216,0.34), -1px 0 0 rgba(255,242,216,0.24),' +
          ' 1px 1px 0 rgba(14,7,2,0.5)',
      }}
    />
  )
}

/**
 * The surface layers a plate on this screen carries, in order. Named so the
 * DIRECTOR MODE plate cannot drift back to bare `.plate` — a smooth gradient
 * sitting directly beneath eight machined rows reads as plastic — and so the
 * frame step lands on every plate rather than on the rows alone.
 */
function PlateSurface() {
  return (
    <>
      <RowGrain />
      <RowPatina />
      <FrameStep />
    </>
  )
}

/**
 * The wall behind the hardware is a surface too. Without grain on it the
 * margins measure as a mathematically smooth fill and the whole screen reads
 * airbrushed. Sits at z-index 0 with all hardware above it, so it textures the
 * wall and never washes over an emitter.
 */
function WallTexture() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='w1'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='2' seed='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.62 0 0 0 0 0.49 0 0 0 0 0.35 0 0 0 0.62 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='1.5' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23w1)'/%3E%3C/svg%3E\")," +
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='w2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='2' seed='29' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.02 0 0 0 0 0.013 0 0 0 0 0.007 0 0 0 0.78 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='1.3' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23w2)'/%3E%3C/svg%3E\")," +
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='w3'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.02 0.035' numOctaves='4' seed='53' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.34 0 0 0 0 0.17 0 0 0 0 0.07 0 0 0 0.42 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='1.6' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='320' height='320' filter='url(%23w3)'/%3E%3C/svg%3E\")",
          backgroundSize: '200px 200px, 200px 200px, 320px 320px',
          backgroundPosition: '0 0, 71px 137px, 23px 41px',
          opacity: 0.62,
        }}
      />
      {/* warm vignette toward the screen edges — the room falls off, not a haze */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 0,
          background:
            'radial-gradient(128% 74% at 50% 26%, transparent 34%, rgba(9,5,2,0.34) 74%, rgba(6,3,1,0.62) 100%)',
        }}
      />
    </>
  )
}

/* ---- Flicker ------------------------------------------------------------ */

/**
 * The same 8–12fps stochastic flicker `ArcBolt` runs internally, exposed so the
 * light an arc throws onto the brass around it pulses with the bolt instead of
 * sitting there as a painted wash. JS-driven opacity, not a keyframe, so
 * `prefers-reduced-motion` can hold one static frame.
 */
function useArcFlicker(active: boolean): number {
  const reduced = usePrefersReducedMotion()
  const [v, setV] = useState(0.9)
  useEffect(() => {
    if (!active || reduced) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      if (!alive) return
      setV(Math.random() < 0.14 ? 0.5 : 0.8 + Math.random() * 0.2)
      timer = setTimeout(tick, 83 + Math.random() * 42)
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [active, reduced])
  if (!active) return 0
  return reduced ? 0.8 : v
}

export default function Standings() {
  const { teams, days, events, categories, directorMode, setDirectorMode, ready } = useStore()
  const rows = useMemo(() => standings(events, days, teams), [events, days, teams])
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const feed = useMemo(() => recentActivity(events, 3), [events])
  const leader = rows[0]?.totalDeci ?? 0

  if (!ready) return <div className="min-h-dvh" />

  const scoredCount = days.filter((d) => d.scored).length
  /* Widest integer part in the score column — every decimal point lands on it. */
  const intWidth = rows.reduce(
    (w, r) => Math.max(w, formatDeci(r.totalDeci).split('.')[0].length),
    1,
  )
  const baseIntWidth = rows.reduce(
    (w, r) => Math.max(w, formatDeci(r.baseDeci).split('.')[0].length),
    1,
  )

  return (
    <div
      className="relative min-h-dvh"
      style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}
    >
      <WallTexture />
      <div className="relative" style={{ zIndex: 1 }}>
        <TitleBlock />

        <div className="mx-3 flex h-11 items-center justify-between">
          <span className="tech-label text-[10px]">CUMULATIVE · {scoredCount} SCORING DAYS</span>
          {/* 44px of hit area; the plate itself stays 17px tall */}
          <Link
            to="/display"
            aria-label="Big screen"
            className="flex h-11 items-center px-1"
            style={{ marginRight: -4 }}
          >
            <Nameplate size={9} tracking="0.22em">
              Big screen
            </Nameplate>
          </Link>
        </div>

        <div className="mx-3 flex flex-col gap-2">
          {rows.map((row) => {
            const team = byId.get(row.teamId)
            if (!team) return null
            return (
              <StandingRow
                key={row.teamId}
                row={row}
                team={team}
                leader={leader}
                intWidth={intWidth}
                baseIntWidth={baseIntWidth}
              />
            )
          })}
        </div>

        <ActivityFeed feed={feed} byId={byId} categories={categories} />

        {/* director mode gates the key ceremony so it can't be fat-fingered */}
        <div className="mx-3 mt-4">
          <DirectorSwitch on={directorMode} onToggle={() => void setDirectorMode(!directorMode)} />
        </div>
      </div>
    </div>
  )
}

/* ---- Title block -------------------------------------------------------- */

/**
 * `STANDINGS` inside a bracketed box: hairline top and bottom, an L bracket at
 * each corner, a mono stamp inside the top-left bracket. The band has to have
 * hardware in it — a bare title on the wall reads as haze. The back control is
 * seated in its own screwed brass tab for the same reason: nothing on this
 * screen floats on the wall unmounted.
 */
function TitleBlock() {
  const navigate = useNavigate()
  const bracket = 'rgba(192,138,62,0.55)'
  const corners: CSSProperties[] = [
    { left: 0, top: 0 },
    { right: 0, top: 0 },
    { left: 0, bottom: 0 },
    { right: 0, bottom: 0 },
  ]
  return (
    <header className="relative mx-3 mt-2" style={{ height: 72 }}>
      <div className="hairline absolute left-0 right-0 top-0" aria-hidden />
      <div className="hairline absolute bottom-0 left-0 right-0" aria-hidden />
      {/* the small centred ‖ mark on the lower rule */}
      <div
        aria-hidden
        className="absolute left-1/2 flex gap-[2px]"
        style={{ bottom: -2, transform: 'translateX(-50%)' }}
      >
        <span style={{ width: 1, height: 5, background: bracket }} />
        <span style={{ width: 1, height: 5, background: bracket }} />
      </div>
      {corners.map((pos, i) => (
        <div key={i} className="absolute" style={{ ...pos, width: 14, height: 14 }} aria-hidden>
          <span
            className="absolute"
            style={{
              [i < 2 ? 'top' : 'bottom']: 0,
              left: 0,
              width: 14,
              height: 1,
              background: bracket,
            }}
          />
          <span
            className="absolute"
            style={{
              [i % 2 === 0 ? 'left' : 'right']: 0,
              [i < 2 ? 'top' : 'bottom']: 0,
              width: 1,
              height: 14,
              background: bracket,
            }}
          />
        </div>
      ))}
      {/*
        The panel stamp. Deliberately a pair: the plate number cut inside the
        top-left bracket, and three engraved index ticks answering it inside the
        top-right one, so it reads as machining and not as a leftover string.
        Floored at 9px — below that a mono label on the wall colour is texture
        rather than text.
      */}
      <span
        className="tech-label absolute text-[9px] leading-none"
        style={{ left: 18, top: 3, letterSpacing: '0.24em', color: 'var(--color-brass)' }}
      >
        STD·05
      </span>
      <span
        className="tech-label absolute text-[9px] leading-none"
        style={{ right: 18, top: 3, letterSpacing: '0.24em', color: 'var(--color-brass)' }}
      >
        TOTAL
      </span>
      <div aria-hidden className="absolute flex gap-[3px]" style={{ right: 18, top: 17 }}>
        {[4, 6, 4].map((h, i) => (
          <span
            key={i}
            style={{
              width: 1,
              height: h,
              background: 'rgba(28,16,6,0.7)',
              boxShadow: '1px 0 0 rgba(255,240,216,0.16)',
            }}
          />
        ))}
      </div>
      <h1
        className="display-title on-metal absolute inset-0 flex items-center justify-center text-[34px] leading-none"
        style={{ letterSpacing: '0.14em' }}
      >
        Standings
      </h1>
      <button
        aria-label="Back"
        onClick={() => navigate(-1)}
        className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center"
      >
        {/* the arrow is engraved into a small brass tab, not stroked on the wall */}
        <span
          className="brass-band relative flex items-center justify-center"
          style={{ width: 34, height: 30, borderRadius: 3 }}
        >
          <span className="rivet absolute left-[3px] top-[3px]" aria-hidden />
          <span className="rivet absolute right-[3px] top-[3px]" aria-hidden />
          <span className="rivet absolute bottom-[3px] left-[3px]" aria-hidden />
          <span className="rivet absolute bottom-[3px] right-[3px]" aria-hidden />
          <svg width="20" height="15" viewBox="0 0 26 20" aria-hidden>
            {/* light catching the lower lip of the cut, then the cut itself */}
            <path
              d="M10 1 L2 10 L10 19 M2.5 10 H24"
              transform="translate(0,1)"
              fill="none"
              stroke="rgba(255,240,206,0.42)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 1 L2 10 L10 19 M2.5 10 H24"
              fill="none"
              stroke="#3a2812"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </header>
  )
}

/* ---- The rank ring ------------------------------------------------------ */

/**
 * The rank mark is **cut into the plate**, not punched through it: a double
 * hairline circular groove with the plate face — and its patina — running
 * straight on through the middle, and the numeral struck proud of it in brass.
 *
 * The round-two build had a near-black well here (interior L≈2–14 against a
 * plate face of L≈103), which read as a hole rather than as machining and was
 * darker and cooler than every other recess on the screen. In the reference the
 * groove's interior measures the *same value as the plate around it*
 * (L 27–34 vs a face of 27); only the groove walls and the raised numeral carry
 * any modelling.
 *
 * Groove walls follow the one light direction: the top-left wall is the near
 * wall and sits in its own shadow, the bottom-right wall faces the key light
 * and catches it, and the raised lip just outside the top-left takes a hairline
 * specular.
 */
/**
 * A circular groove cut into the plate, shaded continuously.
 *
 * Four per-side border colours give a circle four quadrant arcs meeting at hard
 * 45° miters, so the channel visibly breaks into segments instead of turning
 * through the light — the single most obvious tell on the rank chip at 2×. A
 * conic gradient masked to a ring turns once, from the lit lower-right wall
 * round to the shadowed upper-left one, with no seam.
 */
function grooveRing(r: number, w: number, k: number): CSSProperties {
  const ring =
    `radial-gradient(circle at 50% 50%, transparent 0 ${r - w}px,` +
    ` #000 ${r - w}px ${r}px, transparent ${r}px)`
  return {
    position: 'absolute',
    inset: RANK / 2 - r,
    borderRadius: 99,
    background:
      /* 135° is the shadowed near wall; 315° the wall facing the key light */
      `conic-gradient(from 135deg,` +
      ` rgba(16,8,2,${0.9 * k}) 0deg, rgba(16,8,2,${0.72 * k}) 46deg,` +
      ` rgba(16,8,2,${0.2 * k}) 108deg, rgba(255,238,205,${0.16 * k}) 150deg,` +
      ` rgba(255,238,205,${0.44 * k}) 194deg, rgba(255,238,205,${0.2 * k}) 250deg,` +
      ` rgba(16,8,2,${0.4 * k}) 300deg, rgba(16,8,2,${0.9 * k}) 360deg)`,
    maskImage: ring,
    WebkitMaskImage: ring,
  }
}

function RankRing({ rank, leader }: { rank: number; leader: boolean }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: RANK, height: RANK }}
    >
      {/*
        The seat. Sampled off the reference at 1520px: the interior of the rank
        circle reads #261e14 / #1e170e against a plate face of #382c1f–#3d3b24
        beside it — roughly 0.62 of the face, a shallow machined pocket, not the
        near-black hole an earlier pass had and not the flush plate that
        replaced it. Darkest under the top-left lip, per the one light direction.
      */}
      <span
        aria-hidden
        className="absolute"
        style={{
          inset: 2,
          borderRadius: 99,
          background:
            'radial-gradient(circle at 68% 74%, rgba(24,13,4,0.30) 0%,' +
            ' rgba(20,10,3,0.44) 52%, rgba(16,8,2,0.56) 100%)',
          boxShadow:
            'inset 2px 2px 4px rgba(12,6,1,0.62), inset -1px -1px 2px rgba(255,238,205,0.13)',
        }}
      />
      <span aria-hidden style={grooveRing(21, 3.5, 1)} />
      <span aria-hidden style={grooveRing(16, 1, 0.55)} />
      {/* the lip standing proud on the lit side of the channel */}
      <span
        aria-hidden
        className="absolute"
        style={{
          inset: 0,
          borderRadius: 99,
          boxShadow: '-1px -1px 0 rgba(255,238,205,0.16)',
        }}
      />
      {/*
        Struck brass: the gradient runs bright at the top-left face of each
        stroke into shadow at its bottom right, and the whole numeral casts one
        soft shadow down-right onto the plate it stands on.
      */}
      <span
        className="relative"
        style={{ filter: 'drop-shadow(0.5px 1px 1px rgba(10,5,1,0.9))' }}
      >
        <Digits
          value={String(rank)}
          className="leading-none"
          style={{
            /*
              The reference's rank numeral fills its chip: cap height measures
              ~0.68 of the circle's diameter (24.5 CSS in a 36 CSS ring). At 21
              this sat at 0.36 and the chip read as an empty washer with a small
              stamp in it. 26 puts the cap at ~19 of the 42 ring — 0.45 — while
              still clearing the inner groove at r16.
            */
            fontSize: 26,
            backgroundImage: leader
              ? 'linear-gradient(165deg,#FFF6DD 0%,#F3D69E 30%,#C69B57 70%,#7E5B23 100%)'
              : 'linear-gradient(165deg,#FFEDC9 0%,#E2C18B 32%,#A98543 72%,#6E4F21 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
          }}
        />
      </span>
    </span>
  )
}

/* ---- The meter tube ----------------------------------------------------- */

/**
 * The standings meter: the lever's glass tube, laid on its side.
 *
 * Three things the round-two build got wrong and this fixes:
 *
 * 1. **The barrel is straight and full width**, with the collars painted on top
 *    of it, so the glass visibly continues *behind* both collars. A pill bore
 *    inset to the collars leaves a wedge of bare plate at the top and bottom of
 *    every tube and the collars stop reading as its ends.
 * 2. **Each end holds a brass electrode**, and the leader's bolt roots on those
 *    electrode faces. An arc has to terminate on visible metal.
 * 3. **The light inside spills out onto the plate.** The spill box is pinned to
 *    the lit column's own extent and thrown by `box-shadow`, so the falloff is
 *    physical and it dies within ~14px. A tube that does not measurably lift
 *    the plate beside it is painted, not lit.
 */
function MeterTube({
  color,
  basePct,
  pct,
  hasKeys,
  isLeader,
}: {
  color: string
  basePct: number
  pct: number
  hasKeys: boolean
  isLeader: boolean
}) {
  const boreRef = useRef<HTMLDivElement | null>(null)
  const [boreW, setBoreW] = useState(0)
  useLayoutEffect(() => {
    const el = boreRef.current
    if (!el) return
    const measure = () => setBoreW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const flicker = useArcFlicker(isLeader)

  /* The spill's colour is the colour of whatever is lit at the far end. */
  const emit = isLeader ? 'rgba(47,217,208,' : null
  const spillNear = emit
    ? `${emit}0.62)`
    : `color-mix(in oklab, ${color} 58%, transparent)`
  const spillFar = emit ? `${emit}0.3)` : `color-mix(in oklab, ${color} 26%, transparent)`
  /* The light column runs electrode face to electrode face, never edge to edge. */
  const track = (p: number) => `calc((100% - ${TRACK_X * 2}px) * ${p})`
  const spillWidth = isLeader ? track(1) : track(Math.max(0, pct))

  const collar = (side: 'left' | 'right') => (
    <div
      key={side}
      aria-hidden
      className="absolute"
      style={{
        [side]: 0,
        top: -4,
        width: COLLAR_W,
        height: TUBE_H + 8,
        borderRadius: 3,
        background:
          'repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 4px),' +
          'linear-gradient(180deg,#8a6428 0%,#d9b06a 18%,#7a5622 55%,#2c1d0a 100%)',
        boxShadow:
          'inset 1px 1px 0 rgba(255,220,160,0.4), inset -1px -1px 1px rgba(0,0,0,0.5), 0 3px 4px rgba(0,0,0,0.6)',
      }}
    >
      {/*
        Teal discharge light landing on the brass — confined to the collar's
        **inner face and rim**, the few px actually facing the electrode. A wash
        over the whole collar box turned the body sage-green (R−B fell from +55
        at the outer edge to −14 at the inner), so the leader's two contact
        posts stopped reading as brass at all; the reference keeps the collar
        body warm bronze and lets only the face touching the arc go teal.
      */}
      {isLeader && (
        <span
          className="absolute inset-0"
          style={{
            borderRadius: 3,
            background:
              `linear-gradient(${side === 'left' ? '270deg' : '90deg'},` +
              ' rgba(47,217,208,0.85) 0%, rgba(47,217,208,0.34) 24%,' +
              ' rgba(47,217,208,0.07) 48%, transparent 68%)',
            boxShadow:
              side === 'left'
                ? 'inset -1px 0 0 rgba(186,255,250,0.6)'
                : 'inset 1px 0 0 rgba(186,255,250,0.6)',
            mixBlendMode: 'screen',
            opacity: flicker * 0.95,
          }}
        />
      )}
    </div>
  )

  return (
    <div className="relative" style={{ height: TUBE_H }}>
      {/*
        Light thrown out of the glass onto the plate. Drawn before the bore and
        therefore under it, and sized to the lit column so the glow cannot
        outrun its emitter. `box-shadow` gives the falloff for free.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: TRACK_X,
          width: spillWidth,
          top: 3,
          height: TUBE_H - 6,
          borderRadius: 3,
          boxShadow: `0 0 9px 1px ${spillNear}, 0 0 22px 5px ${spillFar}`,
          opacity: isLeader ? 0.55 + flicker * 0.45 : 1,
        }}
      />
      {/* the straight glass barrel, running the full width behind both collars */}
      <div
        ref={boreRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: 4,
          background:
            'linear-gradient(180deg, rgba(10,8,6,0.94) 0%, rgba(30,26,22,0.86) 45%, rgba(8,6,5,0.96) 100%)',
          boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,236,205,0.07)',
        }}
      >
        {!isLeader && (
          <>
            {/* bloom of the lit column into the dark interior above and below */}
            <div
              aria-hidden
              className="absolute inset-y-0"
              style={{
                left: TRACK_X,
                width: track(pct),
                background: `radial-gradient(100% 64% at 50% 50%, color-mix(in oklab, ${color} 46%, transparent) 0%, transparent 82%)`,
              }}
            />
            {/* base points */}
            <div
              className="absolute"
              style={{
                top: 4,
                bottom: 4,
                left: TRACK_X,
                width: track(basePct),
                background: `linear-gradient(180deg, color-mix(in oklab, ${color} 62%, #2a1206) 0%, color-mix(in oklab, ${color} 52%, #ffffff) 38%, ${color} 72%, color-mix(in oklab, ${color} 55%, #150a02) 100%)`,
              }}
            />
            {hasKeys && (
              <>
                {/*
                  The key continuation is separated from the base fill by a dark
                  notch, not by a colour change: INNOCENT's #FFD84D and the key
                  gold #FFC63D are ~0.02 apart in hue, so a colour boundary
                  alone is invisible on that row.
                */}
                <div
                  className="absolute"
                  style={{
                    top: 4,
                    bottom: 4,
                    left: `calc(${TRACK_X}px + ${track(basePct)})`,
                    width: track(Math.max(0, pct - basePct)),
                    background:
                      'linear-gradient(180deg, #b7822010 0%, #d9a02a 4%, var(--color-key-hot) 38%, var(--color-key) 72%, #6a4104 100%)',
                  }}
                />
                <div
                  aria-hidden
                  className="absolute"
                  style={{
                    top: 2,
                    bottom: 2,
                    left: `calc(${TRACK_X - 1}px + ${track(basePct)})`,
                    width: 3,
                    background:
                      'linear-gradient(90deg, rgba(4,3,2,0.9) 0 2px, rgba(255,244,208,0.5) 2px 3px)',
                  }}
                />
              </>
            )}
            {/*
              Meniscus: the bright leading edge of the light, tinted by the team
              colour it terminates. Only on rows with no keys — a one-key
              segment is only ~5px wide at this scale, and stacking a bright bar
              on top of it turned every tube's end into what read as a gold key
              cap. Where there are keys, the gold segment's own hot band is the
              leading edge and the dark notch behind it carries the distinction.
            */}
            {pct > 0.02 && !hasKeys && (
              <div
                aria-hidden
                className="absolute"
                style={{
                  top: 4,
                  bottom: 4,
                  left: `calc(${TRACK_X - 2}px + ${track(pct)})`,
                  width: 2,
                  background: `color-mix(in oklab, ${color} 55%, #ffffff)`,
                  boxShadow: `0 0 6px color-mix(in oklab, ${color} 70%, transparent)`,
                }}
              />
            )}
          </>
        )}
        {/* leader: the discharge lights the whole bore from inside */}
        {isLeader && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(110% 120% at 50% 50%, rgba(47,217,208,0.42) 0%, rgba(47,217,208,0.12) 50%, transparent 82%)',
              opacity: 0.6 + flicker * 0.4,
            }}
          />
        )}
        {/* brass electrodes: the metal the current actually roots on */}
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            aria-hidden
            className="absolute"
            style={{
              [side]: COLLAR_W - 2,
              top: 3,
              bottom: 3,
              width: ELECTRODE_W,
              borderRadius: 1,
              background:
                'linear-gradient(180deg,#c69a52 0%,#f0d49a 22%,#8a6428 62%,#33220c 100%)',
              boxShadow:
                side === 'left'
                  ? 'inset -1px 0 0 rgba(255,244,214,0.7), 2px 0 4px rgba(0,0,0,0.55)'
                  : 'inset 1px 0 0 rgba(255,244,214,0.55), -2px 0 4px rgba(0,0,0,0.55)',
              ...(isLeader
                ? {
                    filter: `brightness(${1 + flicker * 0.5}) saturate(0.7)`,
                  }
                : null),
            }}
          />
        ))}
        {/* glass: top sheen, curved shadow along the bottom */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: isLeader
              ? 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 40%, rgba(0,0,0,0.22) 92%, rgba(0,0,0,0.36) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 26%, transparent 46%, rgba(0,0,0,0.34) 88%, rgba(0,0,0,0.52) 100%)',
          }}
        />
        {/* two specular rails down the length, so it reads as a cylinder */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 2,
            right: 2,
            top: 3,
            height: 2,
            borderRadius: 9999,
            background:
              'linear-gradient(90deg, transparent, rgba(255,244,220,0.3) 18%, rgba(255,244,220,0.12) 72%, transparent)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 2,
            right: 2,
            bottom: 3,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(255,236,205,0.14) 30%, transparent)',
          }}
        />
        {/* graduations engraved on the glass, over lit and dark alike */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 1px, rgba(255,244,220,0.1) 1px 2px, transparent 2px 12.5%)',
          }}
        />
        {/*
          Leader only: current jumps electrode to electrode. The endpoints sit
          on the electrode faces, so the bolt terminates on visible brass at
          both ends rather than fading out in mid-glass.
        */}
        {isLeader && boreW > 0 && (
          <svg
            className="pointer-events-none absolute inset-0"
            width={boreW}
            height={TUBE_H}
            aria-hidden
          >
            <ArcBolt
              x1={TRACK_X - 1}
              y1={TUBE_H / 2}
              x2={boreW - TRACK_X + 1}
              y2={TUBE_H / 2}
              seed={5}
              intensity={1}
              chaos={0.3}
              weight={0.5}
              strands={3}
            />
          </svg>
        )}
      </div>
      {(['left', 'right'] as const).map(collar)}
    </div>
  )
}

/* ---- One team's plate --------------------------------------------------- */

function StandingRow({
  row,
  team,
  leader,
  intWidth,
  baseIntWidth,
}: {
  row: Standing
  team: Team
  leader: number
  intWidth: number
  baseIntWidth: number
}) {
  const color = `var(--color-team-${team.colorToken})`
  const isLeader = row.rank === 1
  // Meters scale to the leader, so the leader's tube reads full.
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const basePct = leader > 0 ? clamp(row.baseDeci / leader) : 0
  const pct = leader > 0 ? clamp(row.totalDeci / leader) : 0
  const keyGlyphs = Math.min(row.keys, 3)
  const flicker = useArcFlicker(isLeader)

  return (
    <Link to={`/team/${team.id}`} className="block">
      <Plate chamfer={10} screws screwInset={8} style={{ height: ROW_H }}>
        {/* zIndex 0 keeps both surface layers under the screw heads */}
        <PlateSurface />
        {/*
          Broken specular along the top chamfer, decaying away from the plate's
          top-left corner, plus the short answering catch down the left edge.
          One light direction, top left, stated on the metal itself.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 11,
            right: 11,
            top: 1,
            height: 1,
            background:
              'linear-gradient(90deg, rgba(255,238,211,0.9) 0%, rgba(255,238,211,0.62) 16%, rgba(255,238,211,0.3) 44%, rgba(255,238,211,0.08) 74%, transparent 96%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 1,
            top: 11,
            width: 1,
            height: 34,
            background:
              'linear-gradient(180deg, rgba(255,238,211,0.62) 0%, rgba(255,238,211,0.16) 60%, transparent 100%)',
          }}
        />
        <div className="flex h-full items-stretch gap-2" style={{ padding: PAD }}>
          {/* ---- left compartment: rank, medallion, name, breakout ---- */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-[6px]" style={{ height: ZONE_TOP }}>
              <RankRing rank={row.rank} leader={isLeader} />
              <TeamCrest teamId={team.id} size={CREST} glow={isLeader ? 0.9 : 0.34} />
              {/* names are always cream — team colour is licensed to the crest,
                  a lit cell and a filled meter segment, and nothing else */}
              <span
                className="font-display on-metal min-w-0 flex-1 truncate text-[20px] font-semibold uppercase leading-none"
                style={{ letterSpacing: '0.01em', color: 'var(--color-text)' }}
              >
                {team.shortName}
              </span>
            </div>

            {/*
              The breakout, in its own recessed readout window: base and keys,
              never merged into one opaque number, and the two always added —
              there is no multiplier here or anywhere. Keys are *counted*: lit
              glyphs up to three, then `+N` in tabular numerals.

              Every numeral in the window sits in fixed glyph cells, so all
              eight base figures share a decimal x, all eight dividers share an
              x, and all eight key contributions share a right edge.
            */}
            {/* items-start: the readout's top lip and the tube's top share one y */}
            <div className="flex items-start" style={{ height: ZONE_BOT }}>
              <Well radius={2} className="flex w-full items-center gap-[6px] px-2" style={{ height: 26 }}>
                <Digits
                  value={formatDeci(row.baseDeci)}
                  intWidth={baseIntWidth}
                  className="text-right leading-none"
                  style={{ color: 'var(--color-text)', fontSize: 13 }}
                />
                <span className="tech-label text-[9px] leading-none">BASE</span>
                <span className="engraved-v self-stretch" aria-hidden />
                <span className="flex items-center gap-[1px]" aria-hidden>
                  {row.keys > 0 ? (
                    Array.from({ length: keyGlyphs }, (_, i) => <KeyGlyph key={i} size={12} lit />)
                  ) : (
                    <span style={{ opacity: 0.4 }}>
                      <KeyGlyph size={12} lit={false} />
                    </span>
                  )}
                </span>
                {row.keys > 3 && (
                  <Digits
                    value={`+${row.keys - 3}`}
                    className="leading-none"
                    style={{ color: 'var(--color-key)', fontSize: 11 }}
                  />
                )}
                <Digits
                  value={`+${formatDeci(row.keysDeci)}`}
                  className="ml-auto text-right leading-none"
                  style={{
                    color: row.keys > 0 ? 'var(--color-key)' : 'var(--color-text-dim)',
                    fontSize: 13,
                  }}
                />
              </Well>
            </div>
          </div>

          <span className="engraved-v shrink-0 self-stretch" aria-hidden />

          {/* ---- right compartment: score over the meter ---- */}
          <div className="flex shrink-0 flex-col" style={{ width: RIGHT_W }}>
            {/*
              The total is a readout, so it sits in a readout window — the same
              recess the breakout on the left already uses, and the same part
              the board's score column uses. It was the one numeral on the row
              standing on bare metal: cream 30px on a plate face at L≈105 is
              four stops of separation where the reference gives its score
              fourteen, and it left the brightest third of the plate uncut.

              The window is the full width of the right compartment, so its
              left edge, the tube's left edge and every other row's window all
              share one x — the score column's shared edge is now a physical
              one you can see rather than a text alignment you have to trust.
            */}
            {/* 6px of clearance so the tube's collars, which stand 4px proud
                of the bore, do not touch the window's lower lip */}
            <div className="flex items-end" style={{ height: ZONE_TOP, paddingBottom: 6 }}>
              <Well
                radius={2}
                className="flex w-full items-center justify-end px-2"
                style={{ height: 40 }}
              >
                <Digits
                  value={formatDeci(row.totalDeci)}
                  intWidth={intWidth}
                  style={{ fontSize: 30, lineHeight: 1, color: 'var(--color-text)' }}
                />
              </Well>
            </div>

            <div className="relative" style={{ height: ZONE_BOT }}>
              <MeterTube
                color={color}
                basePct={basePct}
                pct={pct}
                hasKeys={row.keysDeci > 0}
                isLeader={isLeader}
              />
              {/*
                The nameplate space is reserved on every row so all eight plates
                stay exactly the same height. Floored at the screen's 9px
                technical-label minimum, and held to ~0.72 of the tube's width —
                in the reference the LEADING plate is the most prominent label
                on the row, not a chip a third of the tube wide.
              */}
              <div
                className="absolute left-1/2 flex justify-center"
                style={{ top: TUBE_H + 2, height: 17, transform: 'translateX(-50%)' }}
              >
                {isLeader && (
                  <Nameplate size={9} minWidth={Math.round(RIGHT_W * 0.72)}>
                    Leading
                  </Nameplate>
                )}
              </div>
            </div>
          </div>
        </div>

        {/*
          Teal discharge light landing on the plate around the leader's tube.
          Pinned over the tube's footprint with a wide, weak falloff so the
          brass under the arc shifts green-grey the way brass under a discharge
          must, and flickering on the same clock as the bolt.
        */}
        {isLeader && (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              right: 8,
              bottom: 2,
              width: RIGHT_W + 24,
              height: ZONE_BOT + 26,
              background:
                'radial-gradient(58% 46% at 50% 34%, rgba(47,217,208,0.3) 0%, rgba(47,217,208,0.1) 52%, transparent 78%)',
              opacity: 0.55 + flicker * 0.45,
            }}
          />
        )}

        {/* engraved vent ticks cut into the field above the rank ring */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: 24, top: 9 }}>
          {[0, 3].map((t) => (
            <span
              key={t}
              className="absolute"
              style={{
                top: t,
                width: 14,
                height: 1,
                background: 'rgba(28,16,6,0.5)',
                boxShadow: '0 1px 0 rgba(255,240,216,0.16)',
              }}
            />
          ))}
        </div>
        {/*
          The four index ticks the reference cuts into the top right of every
          row plate — the answering mark to the vent ticks at the left, and the
          same pair the title block already carries. Engraved: a dark cut with
          the light catching its right-hand wall.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute flex gap-[3px]"
          style={{ right: 24, top: 9 }}
        >
          {[5, 5, 5, 5].map((h, i) => (
            <span
              key={i}
              style={{
                width: 1,
                height: h,
                background: 'rgba(28,16,6,0.55)',
                boxShadow: '1px 0 0 rgba(255,240,216,0.16)',
              }}
            />
          ))}
        </div>
      </Plate>
    </Link>
  )
}

/* ---- Recent activity ---------------------------------------------------- */

/**
 * A view over the append-only log, nothing more. A lamp dot in the team colour
 * is the emitter; the delta shares a column edge with the ones above it; a
 * reversed event stays on the list at half strength because the log never
 * deletes anything.
 *
 * The rows are 32px on a 32px pitch — the divider is a border *inside* the row
 * rather than an extra element added to it, so the block stays on the 8px grid
 * and the text lands on integer baselines instead of half-pixel ones.
 */
function ActivityFeed({
  feed,
  byId,
  categories,
}: {
  feed: { event: ScoreEvent; reversed: boolean }[]
  byId: Map<string, Team>
  categories: Category[]
}) {
  if (feed.length === 0) return null
  return (
    <section className="mt-5">
      <div className="mx-6 relative" aria-hidden>
        <div className="hairline" />
        <div
          className="absolute left-1/2 top-[-3px] flex gap-[2px]"
          style={{ transform: 'translateX(-50%)' }}
        >
          <span style={{ width: 1, height: 6, background: 'rgba(192,138,62,0.55)' }} />
          <span style={{ width: 1, height: 6, background: 'rgba(192,138,62,0.55)' }} />
        </div>
      </div>
      <div className="mx-6 mt-3 flex items-center gap-3">
        <span className="hairline flex-1" aria-hidden />
        <span
          className="tech-label text-[9px] leading-none"
          style={{ color: 'var(--color-brass)', letterSpacing: '0.3em' }}
        >
          RECENT ACTIVITY
        </span>
        <span className="hairline flex-1" aria-hidden />
      </div>
      {/*
        No overflow clip: the well's edge was cutting a hard vertical line
        through each lamp's bloom, which is the one thing a glow must never do.
        The lamps are seated far enough in that the falloff dies on its own.
      */}
      <Well radius={3} className="mx-3 mt-3">
        {feed.map(({ event, reversed }, i) => {
          const team = byId.get(event.teamId)
          const category = categories.find((c) => c.id === event.categoryId)
          const reason = category?.label ?? 'Adjustment'
          return (
            <div
              key={event.id}
              className="grid items-center"
              style={{
                height: 32,
                boxSizing: 'border-box',
                borderTop: i > 0 ? '1px solid rgba(28,16,6,0.55)' : undefined,
                paddingLeft: 18,
                paddingRight: 12,
                gap: 8,
                gridTemplateColumns: '12px 1fr 48px 2px 1fr',
                opacity: reversed ? 0.45 : 1,
              }}
            >
              <Lamp
                on
                size={9}
                color={team ? `var(--color-team-${team.colorToken})` : 'var(--color-lamp)'}
                className="justify-self-center"
              />
              <span
                className="font-display truncate text-[13px] font-semibold uppercase leading-none"
                style={{ letterSpacing: '0.06em', color: 'var(--color-text)' }}
              >
                {team?.shortName ?? '—'}
              </span>
              <Digits
                value={`${event.deltaDeci > 0 ? '+' : '−'}${formatDeci(Math.abs(event.deltaDeci))}`}
                className="text-right leading-none"
                style={{ color: 'var(--color-text)', fontSize: 13 }}
              />
              <span className="engraved-v self-stretch" aria-hidden />
              <span
                className="font-body truncate text-[12px] leading-none"
                style={{ color: 'var(--color-text-dim)' }}
              >
                {reason}
              </span>
            </div>
          )
        })}
      </Well>
    </section>
  )
}

/* ---- Director mode ------------------------------------------------------ */

/**
 * A two-position industrial switch, not a platform pill: recessed track with
 * true inner shadow, a knurled lever that slides, engraved OFF / ON ticks.
 * Energized reads **amber** — gold on this screen belongs to the keys alone.
 */
function DirectorSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Plate
      as="button"
      chamfer={8}
      screws
      screwInset={7}
      onClick={onToggle}
      ariaPressed={on}
      ariaLabel="Director mode"
    >
      {/*
        The same brushing, pitting, oxide and form shadow the eight rows above
        carry. Without it this plate measured |dL/dx| 0.63 against 2.38 on a row
        face and sat 13 L brighter than them — a featureless tan ramp bolted to
        the bottom of a machined screen.
      */}
      <PlateSurface />
      {/* the panel's own stamp, matching the title block's — this strip is a
          named part of the machine, not a settings row someone forgot */}
      <span
        aria-hidden
        className="tech-label absolute text-[9px] leading-none"
        style={{ right: 22, top: 7, letterSpacing: '0.24em', color: 'var(--color-brass)' }}
      >
        SEC·01
      </span>
      <span
        className="relative flex w-full items-center justify-between"
        style={{ padding: '18px 22px 14px', zIndex: 1 }}
      >
        <span className="flex items-center gap-3 text-left">
          {/* the pilot lamp, seated in its own recess: lit means the ceremony
              is unlocked, and its spill onto the plate says so across the room */}
          <span
            className="well flex shrink-0 items-center justify-center"
            style={{ width: 18, height: 18, borderRadius: 99 }}
          >
            <Lamp on={on} size={10} intensity={0.9} />
          </span>
          <span className="block">
            <span
              className="font-display on-metal block text-[14px] font-semibold uppercase leading-none"
              style={{ letterSpacing: '0.08em' }}
            >
              Director mode
            </span>
            <span className="tech-label mt-[3px] block text-[9px] leading-none">
              Unlocks the golden key ceremony
            </span>
          </span>
        </span>
        <span
          className="relative shrink-0 rounded-[3px]"
          style={{
            width: 62,
            height: 28,
            background: on
              ? 'linear-gradient(180deg, #7a3d0c 0%, #ed9040 55%, #6d3406 100%)'
              : 'linear-gradient(180deg, #120c06 0%, #1d1409 55%, #130d06 100%)',
            boxShadow: on
              ? 'inset 0 2px 5px rgba(0,0,0,0.55), 0 0 10px rgba(237,144,64,0.5)'
              : 'inset 0 2px 5px rgba(0,0,0,0.9), inset 0 -1px 0 rgba(255,236,205,0.08)',
          }}
        >
          {/*
            One legend, engraved on the exposed half of the track — the knob
            covers the other half, so a label there would simply be hidden. The
            lit track carries dark type; the dead track carries dim cream.
          */}
          <span
            className="tech-label absolute top-1/2 text-[9px] leading-none"
            style={{
              [on ? 'left' : 'right']: 6,
              transform: 'translateY(-50%)',
              letterSpacing: '0.1em',
              color: on ? 'rgba(48,20,2,0.85)' : undefined,
              textShadow: on ? '0 1px 0 rgba(255,222,160,0.35)' : undefined,
              opacity: on ? 1 : 0.8,
            }}
          >
            {on ? 'ON' : 'OFF'}
          </span>
          <span
            className="absolute top-[3px] rounded-[2px]"
            style={{
              left: 3,
              transform: `translateX(${on ? 30 : 0}px)`,
              width: 26,
              height: 22,
              background:
                'repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 4px),' +
                (on
                  ? 'linear-gradient(180deg, #fedf97 0%, #ed9040 34%, #8a4a12 100%)'
                  : 'linear-gradient(180deg, #6d5a45 0%, #3a2d1e 40%, #1a120a 100%)'),
              boxShadow: on
                ? 'inset 0 1px 0 rgba(255,252,238,0.85), inset 0 -2px 3px rgba(90,44,4,0.6), 0 2px 4px rgba(0,0,0,0.7)'
                : 'inset 0 1px 0 rgba(255,236,205,0.3), inset 0 -2px 3px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.7)',
              transition: 'transform 180ms cubic-bezier(0.3, 0.9, 0.4, 1)',
            }}
          />
        </span>
      </span>
    </Plate>
  )
}
