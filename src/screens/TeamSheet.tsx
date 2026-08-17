import { useMemo, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breaker, { CategoryGlyph } from '../components/Breaker'
import ChargeTrack, { CAPSULE_SOCKET_PCT, ChargeReadout } from '../components/ChargeTrack'
import DayRail from '../components/DayRail'
import { KeyHookRail } from '../components/KeyRail'
import TeamCrest from '../components/TeamCrest'
import { BrassFrame, KeyGlyph, Plate, Screw, textureOffset } from '../components/chrome'
import { dayScore } from '../data/derive'
import { BASE_CEILING_DECI, SCORED_CATEGORIES, formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { CategoryId } from '../data/types'

/**
 * One team, one day. Every control here writes an event — a binary toggled off
 * appends a compensating event rather than editing anything.
 *
 * The screen is one machine read top to bottom: the coin says who, the
 * equation says how much, the day rail says when, six identical plates say
 * what was earned, and the rail at the bottom holds the keys.
 *
 *    5.6 / 6.0   +   2 KEYS   =   7.6
 *
 * The coin deliberately overhangs the header frame's top edge. A seal that
 * breaks the frame it sits on reads as a struck object laid onto the panel;
 * one tucked politely inside reads as a picture of one.
 */

/* 16px page margin on a 390 viewport ⇒ every part spans x 16→374. */
const CONTENT = 358
/* Coin diameter, and where its top edge sits relative to the page. */
const SEAL = 148
const SEAL_TOP = 6
/* The header frame's top edge — the coin overhangs it by 19px. */
const FRAME_TOP = 25
/* One row height, shared by all six. */
const ROW_H = 68
/* Gutter between rows, and between every other stacked part. */
const GUT = 10
/* How far a hung key drops below the rail bar — the space it needs beneath. */
const KEY_DROP = 50

/**
 * The category row's face, sampled straight down a reference row plate.
 *
 * The shared `.plate` material is right in kind but wrong in profile for this
 * screen: it runs a wide bright-to-dark sweep, where the reference holds a flat
 * oxidised brass (#785638 → #5D3D29) for the top four fifths and then drops off
 * a cliff (#37231 5) in the last two millimetres. Flat-then-cliff is what makes
 * a plate read as thick metal seen edge-on; a smooth sweep reads as a gradient.
 *
 * Laid at 0.72 so the plate's own irregular brushing still reads through — a
 * flat wash plus a periodic stripe overlay reads as corrugation, not metal —
 * then the chamfers are re-struck on top.
 *
 * The chamfer highlight is one **monotonic decay away from the top-left
 * corner**, capped so it stays warm metal rather than blown-out white. Sampled
 * across the reference's top lip the peak is rgb(188,149,115) — L≈152 with
 * R−B≈73 — so the strike is rgb(255,220,170) at α0.5 over the plate's top
 * value, masked down to α0.05 by the right-hand end. Segmented near-white
 * blocks encode no light direction, which is the single loudest AI tell.
 */
const BRUSH_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='240'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.015 0.42' numOctaves='4' seed='61' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 0.93 0 0 0 0 0.8 0 0 0 0.15 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='1.7' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='600' height='240' filter='url(%23b)'/%3E%3C/svg%3E\")"

const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.02 0.5' numOctaves='4' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.06 0 0 0 0 0.03 0 0 0 0.26 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='1.5' offset='0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='600' height='240' filter='url(%23g)'/%3E%3C/svg%3E\")"

/**
 * Oxide speckle: high-frequency fractal noise thresholded into orange flecks,
 * with a vertical ramp baked into the SVG so it is faint along the top run and
 * heavy along the bottom. Rust collects where water sits, which on a wall panel
 * is the lower edge and the lower corners — a uniform wash reads as dirt.
 */
const RUST_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' seed='19' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.66 0 0 0 0 0.31 0 0 0 0 0.11 0 0 0 1.6 -0.72'/%3E%3C/filter%3E%3ClinearGradient id='v' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%23fff' stop-opacity='0.12'/%3E%3Cstop offset='50%25' stop-color='%23fff' stop-opacity='0.3'/%3E%3Cstop offset='100%25' stop-color='%23fff' stop-opacity='1'/%3E%3C/linearGradient%3E%3Cmask id='m'%3E%3Crect width='400' height='200' fill='url(%23v)'/%3E%3C/mask%3E%3C/defs%3E%3Cg mask='url(%23m)'%3E%3Crect width='400' height='200' filter='url(%23r)'/%3E%3C/g%3E%3C/svg%3E\")"

function PlateFace({ seed = 0 }: { seed?: number }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.72,
          background:
            'linear-gradient(180deg, rgb(109,75,45) 0%, rgb(110,74,44) 12%, rgb(111,74,44) 28%, rgb(105,69,41) 48%, rgb(97,62,36) 66%, rgb(94,59,35) 84%, rgb(90,55,30) 94%, rgb(50,30,15) 100%)',
        }}
      />
      {/*
       * Brushing: fine irregular anisotropy, one horizontal grain direction.
       * Two turbulence passes at different frequencies and a per-row offset, so
       * six stacked plates are not six copies of the same streak pattern.
       */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `${BRUSH_URI}, ${GRAIN_URI}`,
          backgroundSize: '600px 240px, 600px 240px',
          backgroundPosition: `${-seed * 83}px ${-seed * 37}px, ${-seed * 149 + 211}px ${-seed * 61 + 97}px`,
        }}
      />
      {/* oxide in the lower corners only — a crevice stain, not a texture wash */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          mixBlendMode: 'multiply',
          background:
            'radial-gradient(30% 60% at 1% 100%, rgba(150,92,54,0.55) 0%, transparent 72%), radial-gradient(26% 55% at 99% 100%, rgba(150,92,54,0.45) 0%, transparent 74%)',
        }}
      />
      {/* top chamfer: warm specular, brightest at the top-left, decaying right */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: 0,
          right: 0,
          top: 0,
          height: 4,
          background:
            'linear-gradient(180deg, rgba(255,232,196,0.86) 0 1px, rgba(255,224,178,0.42) 1px 2px, rgba(255,220,170,0.14) 2px 3px, transparent 3px)',
          maskImage:
            'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, #000 9%, rgba(0,0,0,0.6) 34%, rgba(0,0,0,0.3) 62%, rgba(0,0,0,0.1) 100%)',
          WebkitMaskImage:
            'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, #000 9%, rgba(0,0,0,0.6) 34%, rgba(0,0,0,0.3) 62%, rgba(0,0,0,0.1) 100%)',
        }}
      />
      {/* left chamfer: the same light source, so it decays downward */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background:
            'linear-gradient(90deg, rgba(255,220,170,0.44) 0 1px, rgba(255,220,170,0.2) 1px 2px, transparent 2px)',
          maskImage:
            'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.62) 38%, rgba(0,0,0,0.22) 74%, rgba(0,0,0,0.06) 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.62) 38%, rgba(0,0,0,0.22) 74%, rgba(0,0,0,0.06) 100%)',
        }}
      />
      {/* the shadowed edges: bottom and right fall away from the same light */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 0 1px, rgba(24,12,4,0.34) 1px 2px, rgba(24,12,4,0.7) 2px) bottom / 100% 3px no-repeat,' +
            'linear-gradient(90deg, transparent 0 1px, rgba(24,12,4,0.5) 1px) right / 2px 100% no-repeat',
        }}
      />
    </>
  )
}

export default function TeamSheet() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const {
    teams,
    days,
    categories,
    activeDay,
    setActiveDayId,
    events,
    setBinary,
    addCheckIn,
    removeCheckIn,
    directorMode,
    ready,
  } = useStore()

  const team = teams.find((t) => t.id === teamId)
  const score = useMemo(
    () => (team ? dayScore(events, activeDay.id, team.id) : undefined),
    [events, activeDay.id, team],
  )

  if (!ready || !team || !score) return <div className="min-h-dvh" />

  const label = (id: CategoryId) => categories.find((c) => c.id === id)?.label ?? id
  const locked = !activeDay.scored
  const keys = score.keys

  return (
    <div className="flex min-h-dvh flex-col" style={{ paddingBottom: 10 }}>
      {/* ---- header: brass double frame with the seal breaking its top edge ---- */}
      <div className="relative px-4" style={{ paddingTop: FRAME_TOP }}>
        {/*
         * The back control is hardware like everything else on this screen.
         * The reference has no back affordance at all — but a bare stroked
         * chevron floating on the wall was the one unhoused object on a screen
         * where every other control has a bevel, a chamfer and a contact
         * shadow, and it read as a browser chrome artefact rather than part of
         * the machine. So: a small chamfered brass tab with the chevron struck
         * into it as a groove with one lit lower lip. It sits in the wall strip
         * above the frame, clear of the corner screw.
         */}
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute flex items-start justify-start"
          style={{ left: 0, top: 0, width: 46, height: 44, padding: '2px 0 0 4px', zIndex: 4 }}
        >
          <svg width="34" height="21" viewBox="0 0 34 21" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="backtab" x1="0.1" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#e0c48d" />
                <stop offset="24%" stopColor="#b79753" />
                <stop offset="62%" stopColor="#8a6c34" />
                <stop offset="100%" stopColor="#4a3617" />
              </linearGradient>
            </defs>
            {/* contact shadow, thrown down-right by the one top-left key light */}
            <path
              d="M4 0 H34 V17 L30 21 H0 V4 Z"
              fill="rgba(0,0,0,0.55)"
              transform="translate(1.2 1.8)"
            />
            <path d="M4 0 H34 V17 L30 21 H0 V4 Z" fill="url(#backtab)" />
            {/* lit chamfer along the top-left, shadowed edge along the bottom-right */}
            <path
              d="M0.6 4.2 L4.2 0.6 H33.4"
              fill="none"
              stroke="rgba(255,246,222,0.62)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M33.4 17 L29.7 20.4 H0.7"
              fill="none"
              stroke="rgba(26,15,4,0.65)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            {/* the chevron, struck into the brass */}
            <path
              d="M15 5.4 L9.4 10.5 L15 15.6 M10 10.5 H25"
              fill="none"
              stroke="rgba(34,20,6,0.88)"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 6.5 L10.5 10.5 L15 14.5 M10.9 11.4 H24.6"
              fill="none"
              stroke="rgba(255,242,212,0.42)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="relative">
          {/*
           * Band width traced off the reference: its brass runs 26 image px
           * from the panel's outer edge to the opening, which is 9.4 CSS. The
           * build was at 8 and the frame read as two hairlines rather than one
           * heavy machined band.
           */}
          <BrassFrame band={10} radius={6} screws={false}>
            {/*
             * The framed field is a recess, not another plate: it must read
             * darker than the category rows below or the frame has nothing to
             * stand proud of.
             */}
            <div
              className="grain"
              style={{
                ...textureOffset(`hdr-${team.id}`),
                paddingTop: 122,
                paddingBottom: 22,
                /*
                 * The equation runs edge to edge inside the frame: base hard
                 * left, total hard right. The inner margin plus the widened
                 * band puts `5.6` at x≈46, which is where the reference starts
                 * it.
                 */
                paddingLeft: 20,
                paddingRight: 20,
                /*
                 * The frame's inner opening turns through a **large-radius
                 * fillet**, not a 45° mitre. Traced at 4x, the reference's
                 * opening runs its arc over 30 image px in x and 35 in y — a
                 * radius of about 12 CSS — and that fillet is what leaves a
                 * solid brass boss at each corner for the screw to sit in. The
                 * mitre left the corner brass no thicker than the run, which is
                 * why the screws had nowhere to go but the panel's outer edge.
                 */
                borderRadius: 12,
                background: 'linear-gradient(180deg, #634024 0%, #523622 58%, #342216 100%)',
                boxShadow:
                  'inset 0 3px 8px rgba(0,0,0,0.72), inset 0 -1px 0 rgba(84,71,64,0.4), inset -1px 0 0 rgba(84,71,64,0.28)',
              }}
            >
              <Equation baseDeci={score.baseDeci} keys={keys} totalDeci={score.totalDeci} />
            </div>
          </BrassFrame>

          {/* oxide gathering in the frame's lower corners — crevices only */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: 5,
              background:
                'radial-gradient(28% 46% at 2% 100%, rgba(138,82,48,0.5) 0%, transparent 70%), radial-gradient(24% 40% at 99% 96%, rgba(138,82,48,0.42) 0%, transparent 72%), radial-gradient(40% 18% at 70% 100%, rgba(122,68,38,0.3) 0%, transparent 76%)',
              mixBlendMode: 'multiply',
            }}
          />
          {/*
           * Rust speckle ON the brass band itself, weighted toward its lower
           * run — the reference's frame is visibly oxidised where water would
           * sit, and a multiply-darkened corner is a shadow, not a patina. The
           * two-layer mask with `exclude` confines the texture to the band, so
           * none of it lands on the recessed field inside.
           */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: 6,
              padding: 11,
              background: RUST_URI,
              backgroundSize: '400px 200px',
              opacity: 0.85,
              maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
              maskClip: 'content-box, border-box',
              maskComposite: 'exclude',
              WebkitMaskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
              WebkitMaskClip: 'content-box, border-box',
              WebkitMaskComposite: 'xor',
            }}
          />

          {/*
           * Screws sit ON the band — outside the frame so the interior cannot
           * clip them — and **inset far enough that brass rings each one on
           * every side**. At 2px the washer seat ran off the panel's outer edge
           * onto the wall and broke the silhouette at all four corners. On the
           * reference the screw's centre is 10.4 CSS in from the edge with a
           * 4.05 radius; ours is 10.5 with 5.5, sitting in the corner boss the
           * opening's fillet leaves behind.
           */}
          <Screw className="absolute left-[5px] top-[5px]" size={11} slot={38} />
          <Screw className="absolute right-[5px] top-[5px]" size={11} slot={-24} />
          <Screw className="absolute bottom-[5px] left-[5px]" size={11} slot={71} />
          <Screw className="absolute right-[5px] bottom-[5px]" size={11} slot={12} />
        </div>

        {/*
         * The coin's contact shadow. Without it the coin's rim and the frame's
         * pale brass band meet at the same luminance (both sampled at L≈172)
         * and the coin's edge disappears into the band exactly where the legend
         * arc crosses it. A struck coin lying on a panel occludes the key light
         * and darkens the metal it sits on; the ring is offset down-right to
         * agree with the one top-left source.
         */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: SEAL_TOP - 16,
            width: SEAL + 40,
            height: SEAL + 40,
            transform: 'translateX(-50%)',
            marginLeft: 2,
            zIndex: 1,
            background:
              'radial-gradient(circle closest-side, transparent 0 77%, rgba(10,5,1,0.7) 79.8%, rgba(10,5,1,0.44) 85%, rgba(10,5,1,0.2) 91%, rgba(10,5,1,0.06) 96%, transparent 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{ left: '50%', top: SEAL_TOP, transform: 'translateX(-50%)', zIndex: 2 }}
        >
          <TeamCrest teamId={team.id} size={SEAL} label={team.name} />
        </div>
      </div>

      {/* ---- the five days ---- */}
      <DayRail
        days={days}
        activeId={activeDay.id}
        onSelect={setActiveDayId}
        variant="tabs"
        className="mt-[8px]"
      />
      {locked && (
        <div
          className="tech-label mt-[6px] text-center text-[8px]"
          style={{ textShadow: '0 1px 0 rgba(255,236,205,0.10)' }}
        >
          ARRIVAL · NO SCORING
        </div>
      )}

      {/* ---- six identical plates; punctuality is one of them ---- */}
      <div className="flex flex-col px-4" style={{ marginTop: locked ? 12 : 14, gap: GUT }}>
        {SCORED_CATEGORIES.map((c, rowIndex) => {
          const isPunctuality = c === 'punctuality'
          const on = (score.byCategory[c] ?? 0) > 0
          return (
            <div
              key={c}
              className="relative"
              /* the readout hangs under the punctuality plate, so that gap widens */
              style={isPunctuality ? { marginBottom: 12 } : undefined}
            >
              <Plate
                as={isPunctuality ? 'div' : 'button'}
                chamfer={7}
                style={{ height: ROW_H }}
                dataPart={`category-${c}`}
                onClick={isPunctuality ? undefined : () => setBinary(activeDay.id, team.id, c, !on)}
                ariaPressed={isPunctuality ? undefined : on}
                ariaLabel={isPunctuality ? undefined : label(c)}
                disabled={locked}
              >
                <PlateFace seed={rowIndex + 1} />
                {/* two screws on the left edge only — the reference's row fastening */}
                <Screw className="absolute left-[4px] top-[13px] z-[3]" size={8} slot={41} />
                <Screw className="absolute bottom-[13px] left-[4px] z-[3]" size={8} slot={-32} />

                <div className="flex h-full items-center" style={{ paddingLeft: 14, paddingRight: 12 }}>
                  <CategoryGlyph id={c} size={42} />
                  <div className="engraved-v" style={{ height: 32, marginLeft: 6, marginRight: 13 }} />
                  <span
                    className="font-display on-metal font-semibold uppercase"
                    style={{ fontSize: 17, letterSpacing: '0.045em', color: 'var(--color-text)', lineHeight: 1 }}
                  >
                    {label(c)}
                  </span>
                  <span className="flex-1" />
                  {isPunctuality ? (
                    <PunctualityControl
                      ticks={score.ticks}
                      locked={locked}
                      onAdd={() => addCheckIn(activeDay.id, team.id)}
                      onRemove={() => removeCheckIn(activeDay.id, team.id)}
                    />
                  ) : (
                    <Breaker variant="toggle" on={on} color="var(--color-lamp)" title={label(c)} />
                  )}
                </div>
              </Plate>

              {/*
               * The readout labels the plate above it, so it has to hug that
               * plate and leave the larger share of the gutter beneath it.
               * Sat mid-gap it reads as a caption on the NEXT row.
               */}
              {isPunctuality && (
                <div className="absolute" style={{ right: 12, top: '100%', marginTop: -8, zIndex: 3 }}>
                  <ChargeReadout ticks={score.ticks} size={9} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/*
       * The rail closes the composition: it is the last object, and the keys
       * hang almost to the bottom edge. `marginTop:auto` inside the flex column
       * lets a taller viewport than the reference's 9:16 open up above the rail
       * rather than leaving a sixth of the screen as bare wall below it. The
       * clamp keeps that opening from becoming a hole on a very tall phone.
       */}
      <div
        className="px-4"
        style={{ marginTop: 'auto', paddingTop: 14, paddingBottom: KEY_DROP }}
      >
        <KeyHookRail
          keys={keys}
          width={CONTENT}
          disabled={locked || !directorMode}
          onAdd={() => navigate(`/key/${team.id}`)}
        />
      </div>
    </div>
  )
}

/* ---- the arithmetic, on one shared baseline ----------------------------- */

/**
 * `5.6 / 6.0 + 2 KEYS 🔑🔑 = 7.6`, all of it sharing one baseline so it reads
 * as a sum rather than as three labelled cells. The total is the largest thing
 * on the screen and stays cream — gold belongs to the keys, and colouring the
 * total gold would say the total *is* keys.
 */
function Equation({
  baseDeci,
  keys,
  totalDeci,
}: {
  baseDeci: number
  keys: number
  totalDeci: number
}) {
  const drawn = Math.min(keys, 3)
  return (
    /*
     * Justified, not centred: the base sits hard against the frame's inner
     * margin and the total hard against the far one, the way the reference's
     * does. Centring it leaves 50px of dead panel either side and the equation
     * stops reading as an equation spanning the panel.
     */
    <div className="flex items-baseline justify-between" style={{ gap: 4 }}>
      <span className="flex items-baseline" style={{ gap: 4 }}>
        <span className="numeral on-metal" style={{ fontSize: 29, color: 'var(--color-text)', lineHeight: 1 }}>
          {formatDeci(baseDeci)}
        </span>
        <span className="numeral" style={{ fontSize: 15, color: 'var(--color-text-dim)', lineHeight: 1 }}>
          / {formatDeci(BASE_CEILING_DECI)}
        </span>
      </span>
      <span className="flex items-baseline" style={{ gap: 4 }}>
        <span
          className="numeral on-metal"
          style={{ fontSize: 26, color: 'var(--color-text)', lineHeight: 1, padding: '0 4px' }}
        >
          +
        </span>
        <span className="numeral on-metal" style={{ fontSize: 29, color: 'var(--color-text)', lineHeight: 1 }}>
          {keys}
        </span>
        <span
          className="font-display on-metal font-semibold uppercase"
          style={{ fontSize: 15, letterSpacing: '0.06em', color: 'var(--color-text)', lineHeight: 1 }}
        >
          {keys === 1 ? 'Key' : 'Keys'}
        </span>
        {/* counted, never multiplied: three glyphs then a plain +N */}
        {drawn > 0 && (
          <span className="flex items-end" style={{ gap: 2, transform: 'translateY(5px)' }}>
            {Array.from({ length: drawn }, (_, i) => (
              <KeyGlyph key={i} size={12} lit />
            ))}
            {keys > 3 && (
              <span
                className="numeral"
                style={{ fontSize: 15, color: 'var(--color-key)', lineHeight: 1, paddingLeft: 2 }}
              >
                +{keys - 3}
              </span>
            )}
          </span>
        )}
        <span
          className="numeral on-metal"
          style={{ fontSize: 26, color: 'var(--color-text)', lineHeight: 1, padding: '0 4px' }}
        >
          =
        </span>
      </span>
      <span className="relative" style={{ lineHeight: 1 }}>
        <span className="numeral on-metal" style={{ fontSize: 44, color: 'var(--color-text)', lineHeight: 1 }}>
          {formatDeci(totalDeci)}
        </span>
        <span
          className="font-display on-metal absolute font-semibold uppercase"
          style={{
            right: 0,
            top: '100%',
            marginTop: 2,
            fontSize: 12,
            letterSpacing: '0.14em',
            color: 'var(--color-text)',
            lineHeight: 1,
          }}
        >
          Total
        </span>
      </span>
    </div>
  )
}

/* ---- punctuality: the charge track plus its seven hit targets ----------- */

/**
 * The track is drawn once by ChargeTrack; the interaction is seven invisible
 * buttons laid on the socket centres it publishes. The seventh socket sits off
 * the six's rhythm on purpose, so an evenly-spaced overlay would not line up
 * with the thing it toggles — hence reading the centres from the component.
 *
 * Check-ins are ordinal ticks: a filled socket drains the most recent tick,
 * and only the next empty socket adds one — there is no "which activity" any
 * more, only how far along the rail the team is.
 */
function PunctualityControl({
  ticks,
  locked,
  onAdd,
  onRemove,
}: {
  ticks: number
  locked: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  const width = 162
  /*
   * Socket pitch is ~18px, so a 22px-wide target overlapped its neighbour by
   * 4px and the last one painted won — tapping a socket's right edge recorded
   * the *next* socket. Targets are the pitch minus a 1px gap, and the full
   * row height vertically, which is where the reachable area comes from.
   */
  const pitch = ((CAPSULE_SOCKET_PCT[1] - CAPSULE_SOCKET_PCT[0]) / 100) * width
  const hit = Math.floor(pitch) - 1
  return (
    <span className="relative block shrink-0" style={{ width }}>
      <ChargeTrack ticks={ticks} width={width} capsule />
      <span className="absolute" style={{ left: 0, right: 0, top: -12, bottom: -12 }}>
        {CAPSULE_SOCKET_PCT.map((pct, i) => {
          const on = i < ticks
          const next = i === ticks
          const last = i === CAPSULE_SOCKET_PCT.length - 1
          /*
           * The seventh sits off the six's rhythm with a gap in front of it, so
           * it takes everything from the sixth's right edge to the end of the
           * control — a 44px target, and still no overlap with its neighbour.
           */
          const style: CSSProperties = last
            ? {
                left: (CAPSULE_SOCKET_PCT[5] / 100) * width + hit / 2,
                right: -6,
                top: 0,
                bottom: 0,
                background: 'transparent',
              }
            : {
                left: `${pct}%`,
                top: 0,
                bottom: 0,
                width: hit,
                transform: 'translateX(-50%)',
                background: 'transparent',
              }
          return (
            <button
              key={i}
              disabled={locked || (!on && !next)}
              aria-pressed={on}
              aria-label={
                last ? `Final check-in — worth 0.4` : `Check-in ${i + 1} of ${CAPSULE_SOCKET_PCT.length}`
              }
              onClick={() => (on ? onRemove() : onAdd())}
              className="absolute"
              style={style}
            />
          )
        })}
      </span>
    </span>
  )
}
