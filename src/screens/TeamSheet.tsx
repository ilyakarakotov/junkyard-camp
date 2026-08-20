import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CategoryGlyph } from '../components/Breaker'
import ChargeTrack, { ChargeReadout } from '../components/ChargeTrack'
import CheckCell from '../components/CheckCell'
import DayRail from '../components/DayRail'
import { KeyHookRail } from '../components/KeyRail'
import TeamCrest from '../components/TeamCrest'
import { ArcStrike } from '../fx/Arc'
import {
  BackTab,
  BrassConfirm,
  BrassFrame,
  KeyGlyph,
  Plate,
  Screw,
  textureOffset,
} from '../components/chrome'
import { dayScore, keyCount, liveEvents } from '../data/derive'
import {
  BASE_CEILING_DECI,
  MAX_CHECK_INS,
  PUNCTUALITY_DECI,
  SCORED_CATEGORIES,
  formatDeci,
} from '../data/scoring'
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

/** "1st", "2nd", "3rd", "4th" — for naming the key about to be struck. */
function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

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
  const {
    teams,
    days,
    categories,
    activeDay,
    events,
    setBinary,
    addCheckIn,
    removeCheckIn,
    awardKey,
    removeKey,
    isEditableDay,
    editableDayId,
    unlockedDayIds,
    ready,
  } = useStore()

  const team = teams.find((t) => t.id === teamId)
  const score = useMemo(
    () => (team ? dayScore(events, activeDay.id, team.id) : undefined),
    [events, activeDay.id, team],
  )
  /* The category whose award is still discharging — cleared when the bolt
     settles, so the contact posts leave with it. */
  const [zap, setZap] = useState<{ cat: CategoryId; at: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  /* Punctuality is the only control on this screen that asks first: a check-in
     is worth a tenth, the seventh is worth four, and the plate is one big
     target that a pocket can find. */
  const [punctualityAsk, setPunctualityAsk] = useState<'add' | 'remove' | null>(null)
  /*
   * A key is worth as much as a whole day of every other category put together,
   * so the press asks first — same BrassConfirm as a check-in. What follows a
   * yes is unchanged: the key lands instantly, sparkles, and the UNDO chip
   * holds it reversible for a minute (the chip itself needs no confirmation).
   */
  const [confirmAward, setConfirmAward] = useState(false)
  /*
   * Set synchronously before the await: two taps on the hook must not award
   * two keys. The store's client UUIDs make a *retried* event idempotent, but
   * two taps are two distinct events, so the guard has to live here — and it
   * is a ref rather than state so it is already true for a second tap landing
   * in the same frame, before React has re-rendered anything.
   */
  const awarding = useRef(false)

  /*
   * The key's undo window. A key is now one press with no confirmation, which
   * is what the live flow needs — so the safety net moves to after the fact:
   * for 60 seconds the rail carries an UNDO chip that reverses the award with
   * no second dialog, because the chip *is* the second thought.
   *
   * Deliberately not persisted. It is a "that was the wrong team" affordance
   * for the moment right after the press; leaving the screen ends it, and the
   * director's confirmed removal (hold the newest key) is the path back after
   * that.
   */
  const [keyUndoUntil, setKeyUndoUntil] = useState<number | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (keyUndoUntil === null) return
    const t = setInterval(() => setClock(Date.now()), 500)
    return () => clearInterval(t)
  }, [keyUndoUntil])
  const undoLeft =
    keyUndoUntil === null ? 0 : Math.max(0, Math.ceil((keyUndoUntil - clock) / 1000))
  useEffect(() => {
    if (keyUndoUntil !== null && undoLeft === 0) setKeyUndoUntil(null)
  }, [keyUndoUntil, undoLeft])

  if (!ready || !team || !score) return <div className="min-h-dvh" />

  const label = (id: CategoryId) => categories.find((c) => c.id === id)?.label ?? id
  // Only today (or a director-unlocked day) is editable — the store refuses
  // the write anyway, so the controls must read inert before the tap.
  const locked = !isEditableDay(activeDay.id)
  const unlockedHere = activeDay.id !== editableDayId && unlockedDayIds.has(activeDay.id)
  const keys = score.keys

  /* A key struck within the last few seconds settles hot-to-cool on the rail
     and throws its sparkle; older keys hang cold. */
  const lastKeyAt = liveEvents(events).reduce(
    (m, e) =>
      e.categoryId === 'golden_key' && e.teamId === team.id && e.dayId === activeDay.id
        ? Math.max(m, Date.parse(e.occurredAt))
        : m,
    0,
  )
  const keyJustAdded = lastKeyAt > 0 && Date.now() - lastKeyAt < 10_000

  /* The seventh check-in surges. One-shot, driven off when the tick landed
     rather than off a flag, so it plays on the render that follows the award
     and never replays on an unrelated re-render. */
  const lastTickAt = liveEvents(events).reduce(
    (m, e) =>
      e.categoryId === 'punctuality' && e.teamId === team.id && e.dayId === activeDay.id
        ? Math.max(m, Date.parse(e.occurredAt))
        : m,
    0,
  )

  /*
   * One press awards the key. There is no ceremony screen any more: the live
   * flow at the evening gathering cannot afford a screen change and a gesture
   * per key — the director is standing in front of the camp with a phone. The
   * key appears on the rail immediately, shining, and an UNDO chip holds the
   * press reversible for a minute.
   *
   * Gating is unchanged: the rail is disabled off-day and for non-directors,
   * and `awardKey` refuses both again in the store regardless of this screen.
   */
  const onAwardKey = async (reason: string) => {
    if (awarding.current) return
    awarding.current = true
    // never the only confirmation — iOS ignores it
    navigator.vibrate?.([18, 60, 40])
    try {
      /*
       * The reason goes on the event itself, so the audit log and the exported
       * workbook can both answer "what was that key for?" months later. It is
       * appended to the automatic note rather than replacing it: the day is
       * worth keeping alongside it, and the note column is the only place
       * either survives.
       */
      await awardKey(activeDay.id, team.id, `Golden key · ${activeDay.name} · ${reason}`)
      setClock(Date.now())
      setKeyUndoUntil(Date.now() + 60_000)
    } finally {
      awarding.current = false
    }
  }

  /* The undo chip: no confirmation, because the chip is the confirmation. It
     still goes through removeKey, so the log gains a compensating event and
     nothing is ever edited away. */
  const onUndoKey = () => {
    setKeyUndoUntil(null)
    navigator.vibrate?.(20)
    void removeKey(activeDay.id, team.id)
  }

  /* ---- punctuality --------------------------------------------------- */
  const ticks = score.ticks
  const full = ticks >= MAX_CHECK_INS
  const nextTicks = Math.min(ticks + 1, MAX_CHECK_INS)
  const prevTicks = Math.max(ticks - 1, 0)
  const surging = full && lastTickAt > 0 && Date.now() - lastTickAt < 1500
  const ladder = (from: number, to: number) =>
    `${formatDeci(PUNCTUALITY_DECI[from])} → ${formatDeci(PUNCTUALITY_DECI[to])}`

  return (
    <div className="flex min-h-dvh flex-col" style={{ paddingBottom: 10 }}>
      {/* ---- header: brass double frame with the seal breaking its top edge ---- */}
      <div className="relative px-4" style={{ paddingTop: FRAME_TOP }}>
        {/*
         * The back control is hardware like everything else on this screen —
         * a chamfered brass tab with the chevron struck into it as a groove
         * with one lit lower lip, shared with every other screen (BackTab in
         * components/chrome.tsx). It sits hard in the top-left corner: its
         * 68x56 target reaches down over the header frame's blank left margin,
         * where there is nothing else to hit.
         */}
        <BackTab className="absolute" style={{ left: 0, top: 0, zIndex: 4 }} />

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

      {/*
       * Who answers for this team. The name is struck around the coin, so the
       * leader sits directly under the frame that holds it rather than on the
       * coin's own line — the legend arc has no room, and the equation inside
       * the frame belongs to the numbers alone. Same quiet register as the
       * board's leader tag: small, condensed, dim, a label under a name and
       * never a second title.
       */}
      <div
        className="font-body mt-[6px] px-4 text-center uppercase"
        style={{ fontSize: 11, lineHeight: '13px', letterSpacing: '0.08em', color: 'var(--color-text-dim)' }}
      >
        Leader · {team.leader}
      </div>

      {/* ---- the five days: a readout here, not a picker. Changing the date
              from inside a team is how a point lands on the wrong day without
              anyone noticing; day selection lives on the board. ---- */}
      <DayRail days={days} activeId={activeDay.id} readOnly variant="tabs" className="mt-[8px]" />
      {!activeDay.scored ? (
        <div
          className="tech-label mt-[6px] text-center text-[8px]"
          style={{ textShadow: '0 1px 0 rgba(255,236,205,0.10)' }}
        >
          ARRIVAL · NO SCORING
        </div>
      ) : locked ? (
        <div
          className="tech-label mt-[6px] text-center text-[8px]"
          style={{ textShadow: '0 1px 0 rgba(255,236,205,0.10)' }}
        >
          {activeDay.name.toUpperCase()} · LOCKED — VIEW ONLY
        </div>
      ) : unlockedHere ? (
        <div
          className="tech-label mt-[6px] text-center text-[8px]"
          style={{ color: 'var(--color-lamp-hot)', textShadow: '0 1px 0 rgba(255,236,205,0.10)' }}
        >
          {activeDay.name.toUpperCase()} · UNLOCKED — EDITING ENABLED
        </div>
      ) : null}

      {/* ---- six identical plates; punctuality is one of them ---- */}
      <div
        className="flex flex-col px-4"
        style={{
          marginTop: locked || !activeDay.scored ? 12 : 14,
          gap: GUT,
          // A locked day reads inert at a glance: everything recessed and
          // desaturated, no hover, no lit idle states.
          opacity: locked ? 0.62 : 1,
          filter: locked ? 'saturate(0.55)' : undefined,
        }}
      >
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
                onClick={
                  isPunctuality
                    ? undefined
                    : () => {
                        setBinary(activeDay.id, team.id, c, !on)
                        if (!on) {
                          setZap({ cat: c, at: Date.now() })
                          // never the only confirmation — iOS ignores it
                          navigator.vibrate?.(15)
                        }
                      }
                }
                ariaPressed={isPunctuality ? undefined : on}
                ariaLabel={isPunctuality ? undefined : label(c)}
                disabled={locked}
              >
                <PlateFace seed={rowIndex + 1} />
                {/* two screws on the left edge only — the reference's row fastening */}
                <Screw className="absolute left-[4px] top-[13px] z-[3]" size={8} slot={41} />
                <Screw className="absolute bottom-[13px] left-[4px] z-[3]" size={8} slot={-32} />

                {/*
                 * Punctuality: the WHOLE PLATE is the target, and it asks
                 * before it writes.
                 *
                 * It used to be seven invisible 17px strips laid over the
                 * track, five of them disabled at any moment — so five taps in
                 * seven landed on nothing, and a tap anywhere else on the row
                 * (which is where a thumb goes) landed on a plain div. That is
                 * the "clicking on punctuality doesn't do anything" a leader
                 * reported. One target, one meaning: every tap is +1 check-in,
                 * always behind a confirmation that names the jump.
                 */}
                {isPunctuality && (
                  <button
                    className="absolute inset-0 z-[2]"
                    style={{ background: 'transparent', borderRadius: 6 }}
                    disabled={locked || full}
                    aria-label={
                      full
                        ? `Punctuality — all ${MAX_CHECK_INS} check-ins recorded`
                        : `Add a check-in — ${ticks} of ${MAX_CHECK_INS}`
                    }
                    onClick={() => {
                      // never the only confirmation — iOS ignores it
                      navigator.vibrate?.(10)
                      setPunctualityAsk('add')
                    }}
                  />
                )}
                {/* Mistakes are fixable: the minus sits above the plate target
                    and takes the most recent check-in back off, through the
                    same confirm and the same compensating event. */}
                {isPunctuality && !locked && ticks > 0 && (
                  <button
                    className="absolute z-[4] flex items-center justify-center"
                    style={{ right: 8, top: 0, bottom: 0, width: 40, background: 'transparent' }}
                    aria-label={`Remove the most recent check-in — ${ticks} of ${MAX_CHECK_INS}`}
                    onClick={() => {
                      navigator.vibrate?.(10)
                      setPunctualityAsk('remove')
                    }}
                  >
                    <MinusStud />
                  </button>
                )}

                <div
                  className={`flex h-full items-center ${isPunctuality ? 'pointer-events-none' : ''}`}
                  style={{ paddingLeft: 14, paddingRight: 12 }}
                >
                  <CategoryGlyph id={c} size={42} />
                  <div className="engraved-v" style={{ height: 32, marginLeft: 6, marginRight: 13 }} />
                  <span className="flex flex-col justify-center">
                    <span
                      className="font-display on-metal font-semibold uppercase"
                      style={{ fontSize: 17, letterSpacing: '0.045em', color: 'var(--color-text)', lineHeight: 1 }}
                    >
                      {label(c)}
                    </span>
                    {/* every scoring control states its point value */}
                    <span
                      className="tech-label"
                      style={{ fontSize: 6.5, letterSpacing: '0.1em', marginTop: 3, whiteSpace: 'nowrap' }}
                    >
                      {isPunctuality ? '0.1 EACH · ALL 7 = 1.0' : '1.0 PT'}
                    </span>
                  </span>
                  <span className="flex-1" />
                  {isPunctuality ? (
                    <>
                      {/* the track is a gauge now, not a row of hit targets */}
                      <ChargeTrack ticks={ticks} width={128} capsule surging={surging} />
                      {/* room reserved for the minus stud, which is drawn on
                          top of the plate so it can sit above its target */}
                      <span className="block shrink-0" style={{ width: 40 }} />
                    </>
                  ) : (
                    /* points given, not a setting switched: the socket takes a
                        lit amber check when the point lands, and the award
                        itself strikes an arc across the socket's contacts */
                    <span className="relative block">
                      <CheckCell on={on} title={label(c)} size={34} />
                      {zap?.cat === c && (
                        <span
                          className="pointer-events-none absolute"
                          style={{ left: -8, right: -8, top: '50%', marginTop: -9, zIndex: 3 }}
                        >
                          <ArcStrike
                            key={zap.at}
                            width={50}
                            height={18}
                            seed={rowIndex + 11}
                            postR={2}
                            weight={0.7}
                            onBurstComplete={() => setZap(null)}
                          />
                        </span>
                      )}
                    </span>
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
        style={{
          marginTop: 'auto',
          paddingTop: 14,
          paddingBottom: KEY_DROP,
          // a locked day dims the rail with everything else — it must not be
          // the one control that still looks alive
          opacity: locked ? 0.62 : 1,
          filter: locked ? 'saturate(0.55)' : undefined,
        }}
      >
        {/* the key rail states its value like every other control — and the
            count is read by counting lit keys, never a multiplier. The day
            count and the camp count share one label so they cannot disagree
            silently with the ceremony. */}
        <div className="flex items-center justify-between px-1" style={{ marginBottom: 4 }}>
          <span className="tech-label" style={{ fontSize: 7, letterSpacing: '0.14em' }}>
            GOLDEN KEYS · 1.0 PT EACH · NO LIMIT
          </span>
          <span
            className="tech-label"
            style={{ fontSize: 7, letterSpacing: '0.14em', color: 'var(--color-key)' }}
          >
            {keys} HELD TODAY · {keyCount(events, team.id)} THIS CAMP
          </span>
        </div>
        {/*
         * The undo chip. It only exists in the minute after a press, it takes
         * no confirmation, and it dies with the screen — see keyUndoUntil.
         */}
        {undoLeft > 0 && (
          <div className="flex px-1" style={{ marginBottom: 5 }}>
            <button
              onClick={onUndoKey}
              aria-label={`Undo the golden key just awarded — ${undoLeft} seconds left`}
              className="font-mono uppercase"
              style={{
                fontSize: 8.5,
                letterSpacing: '0.16em',
                padding: '5px 12px',
                minHeight: 30,
                borderRadius: 3,
                color: 'var(--color-key-hot)',
                background: 'linear-gradient(180deg, #3a2a12 0%, #241806 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,232,190,0.28), inset 0 -1px 2px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              ◂ Undo key {Math.floor(undoLeft / 60)}:{String(undoLeft % 60).padStart(2, '0')}
            </button>
          </div>
        )}
        <div className="relative">
          {/* keys are points like any other: every staff member awards them */}
          <KeyHookRail
            keys={keys}
            width={CONTENT}
            disabled={locked}
            onAdd={() => setConfirmAward(true)}
            onRemoveKey={!locked && keys > 0 ? () => setConfirmRemove(true) : undefined}
            justAdded={keyJustAdded}
            tabNote={locked ? 'DAY LOCKED' : undefined}
          />
        </div>
      </div>

      {/*
       * The check-in confirmations name the jump in both currencies — sockets
       * and points — because the seventh is not worth what the first six are.
       * Missing it costs 0.4, so at 6/7 the dialog says 0.6 → 1.0 out loud
       * rather than leaving a leader to read it off the ladder.
       */}
      {punctualityAsk === 'add' && (
        <BrassConfirm
          title="Add check-in?"
          body={
            nextTicks === MAX_CHECK_INS
              ? `${team.shortName} · ${activeDay.name} — check-ins ${ticks} of ${MAX_CHECK_INS} → all ${MAX_CHECK_INS}. Punctuality ${ladder(ticks, nextTicks)}: the seventh is worth 0.4, not 0.1.`
              : `${team.shortName} · ${activeDay.name} — check-ins ${ticks} of ${MAX_CHECK_INS} → ${nextTicks} of ${MAX_CHECK_INS}. Punctuality ${ladder(ticks, nextTicks)}.`
          }
          confirmLabel="Add check-in"
          onConfirm={() => {
            setPunctualityAsk(null)
            navigator.vibrate?.(nextTicks === MAX_CHECK_INS ? [18, 50, 40] : 12)
            void addCheckIn(activeDay.id, team.id)
          }}
          onCancel={() => setPunctualityAsk(null)}
        />
      )}
      {punctualityAsk === 'remove' && (
        <BrassConfirm
          title="Remove check-in?"
          body={`${team.shortName} · ${activeDay.name} — check-ins ${ticks} of ${MAX_CHECK_INS} → ${prevTicks} of ${MAX_CHECK_INS}. Punctuality ${ladder(ticks, prevTicks)}. The check-in is reversed in the log; nothing is deleted.`}
          confirmLabel="Remove check-in"
          onConfirm={() => {
            setPunctualityAsk(null)
            void removeCheckIn(activeDay.id, team.id)
          }}
          onCancel={() => setPunctualityAsk(null)}
        />
      )}

      {confirmAward && (
        <BrassConfirm
          title="Award a golden key?"
          body={`${team.name} · ${activeDay.name} — +1.0 · ${ordinal(keys + 1)} key today. Say what it was for; you can undo it for a minute after.`}
          confirmLabel="Award key"
          /*
           * A key is worth as much as a whole day of every other category put
           * together, and it is the award that decides the camp. So it cannot
           * be handed out anonymously: the reason is required, it is stored on
           * the event, and it is what the audit log shows beside the award.
           */
          prompt={{ label: 'Reason', placeholder: 'Why did they earn it?', maxLength: 80 }}
          onConfirm={(reason) => {
            setConfirmAward(false)
            void onAwardKey(reason ?? '')
          }}
          onCancel={() => setConfirmAward(false)}
        />
      )}

      {confirmRemove && (
        <BrassConfirm
          title="Remove the last key?"
          body={`The most recent golden key on ${activeDay.name} is reversed in the log. Nothing is ever deleted.`}
          confirmLabel="Remove key"
          onConfirm={() => {
            setConfirmRemove(false)
            void removeKey(activeDay.id, team.id)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
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

/* ---- punctuality: the minus stud --------------------------------------- */

/**
 * A small brass stud with a minus struck into it, seated in a shallow recess.
 * It is the way back from a mis-tap: the plate adds, this takes the most
 * recent check-in off again, and both go through the same confirmation.
 *
 * Deliberately quiet hardware rather than a lit control — removing a point is
 * a correction, not an award, and nothing on this screen should light up for
 * taking something away.
 */
function MinusStud() {
  return (
    <span
      aria-hidden
      className="relative flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        borderRadius: 9999,
        background: 'linear-gradient(158deg, #9b8256 0%, #7d663c 34%, #5c4828 68%, #3d2d15 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,244,214,0.55), inset 0 -1px 1px rgba(24,14,4,0.7), 0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      <span
        style={{
          width: 13,
          height: 3,
          borderRadius: 1,
          background: 'rgba(30,18,6,0.88)',
          boxShadow: '0 1px 0 rgba(255,240,206,0.4)',
        }}
      />
    </span>
  )
}
