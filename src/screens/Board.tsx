import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DayRail from '../components/DayRail'
import { KeyCount } from '../components/KeyRail'
import TeamCrest from '../components/TeamCrest'
import { BrassConfirm, Plate, Well, textureOffset } from '../components/chrome'
import { dayScores, keyCount, standings } from '../data/derive'
import { formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { Team } from '../data/types'

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
 * The recessed channel carrying the full team name. Its left end runs *under*
 * the medallion — the coin overhangs the recess, which is what makes the two
 * read as separate pieces of hardware stacked in depth. Its right edge clears
 * the TODAY text block, which stands 71px in from the plate's right edge.
 */
const CH_L = 98
const CH_R = 128
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
  const {
    teams,
    days,
    activeDay,
    setActiveDayId,
    events,
    ready,
    isDirector,
    isEditableDay,
    editableDayId,
    unlockedDayIds,
    unlockDay,
    testMode,
  } = useStore()
  const navigate = useNavigate()
  const [confirmUnlock, setConfirmUnlock] = useState(false)

  const scores = useMemo(() => dayScores(events, activeDay.id, teams), [events, activeDay.id, teams])
  const todayByTeam = useMemo(() => new Map(scores.map((s) => [s.teamId, s])), [scores])
  /** Overall camp totals — the board's sort key (§6.1). */
  const overallByTeam = useMemo(() => {
    const rows = standings(events, days, teams)
    return new Map(rows.map((r) => [r.teamId, r.totalDeci]))
  }, [events, days, teams])
  const keysByTeam = useMemo(
    () => new Map(teams.map((t) => [t.id, keyCount(events, t.id)])),
    [events, teams],
  )
  /*
   * The board is a standings board: rows run best-first by OVERALL points, and
   * the chip is the row's *position*, 01..08, never a competition rank — a
   * board with two 03s and no 04 on it reads as a bug to the camp director,
   * not as a tie. Ties are marked with an engraved `=` in the chip instead.
   * Roster order breaks equal scores so two teams level on points do not swap
   * places on every render.
   */
  const ordered = useMemo(
    () =>
      [...teams].sort(
        (a, b) =>
          (overallByTeam.get(b.id) ?? 0) - (overallByTeam.get(a.id) ?? 0) || a.order - b.order,
      ),
    [teams, overallByTeam],
  )

  /*
   * Day locks: the pilot lamp marks the day that actually accepts scores, and
   * every other scoring day sits behind a padlock — amber while a director's
   * unlock holds on this device.
   *
   * This reads `editableDayId` from the store rather than matching dates here.
   * It used to do its own `isToday()` check, which disagrees with the store
   * before camp opens: with no day matching today's date the rail padlocked all
   * four scoring days while the store was happily accepting writes to Day 1 —
   * so setup and testing showed a board that could be scored but claimed it
   * could not be.
   */
  const todayId = editableDayId ?? undefined
  const lockedIds = useMemo(
    () =>
      // The sandbox opens the whole camp, so nothing carries a padlock there:
      // a rail showing four locks over days the store will happily accept
      // writes to is the same lie this comment block exists to describe.
      testMode
        ? new Set<string>()
        : new Set(days.filter((d) => d.scored && d.id !== todayId).map((d) => d.id)),
    [days, todayId, testMode],
  )
  const viewingLocked = activeDay.scored && !isEditableDay(activeDay.id)
  const viewingUnlocked =
    activeDay.scored && activeDay.id !== todayId && unlockedDayIds.has(activeDay.id)

  if (!ready) return <div className="min-h-dvh" />

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
            {/* the menu: a recessed rocker at the panel's left end, three
                engraved lines — the one navigation hub for the whole app */}
            <button
              onClick={() => navigate('/menu')}
              aria-label="Menu"
              className="absolute z-[2] flex flex-col items-center justify-center"
              style={{
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 26,
                height: 18,
                gap: 3,
                borderRadius: 3,
                background: 'linear-gradient(180deg, #191008 0%, #241a10 55%, #1b120a 100%)',
                boxShadow:
                  'inset 0 2px 3px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,232,190,0.18), 0 1px 0 rgba(255,238,205,0.14)',
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className="block"
                  style={{
                    width: 12,
                    height: 1.5,
                    borderRadius: 1,
                    background: 'linear-gradient(180deg, #120b05 0%, #d8c7a6 55%, #8f7a5c 100%)',
                  }}
                />
              ))}
            </button>
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

      {/* ---- day rail: five sockets, today's a lit pilot lamp, the rest
              padlocked — view-only until a director unlocks one ---- */}
      <DayRail
        days={days}
        activeId={activeDay.id}
        onSelect={setActiveDayId}
        variant="sockets"
        todayId={todayId}
        lockedIds={lockedIds}
        unlockedIds={unlockedDayIds}
        // The rail's own box is 58px tall around a 10px bar, so trimming 4px of
        // its padding costs nothing visually and puts the first row on the grid.
        className="mx-1 mb-[-4px] mt-[2px]"
      />

      {/* ---- the lock banner: locked days are read-only, and a director's
              unlock keeps the state visible while it holds ---- */}
      {viewingLocked && (
        <div
          className="mx-1 mt-1 flex items-center justify-between font-mono uppercase"
          style={{
            height: 24,
            paddingLeft: 12,
            paddingRight: 6,
            borderRadius: 4,
            fontSize: 8.5,
            letterSpacing: '0.14em',
            color: 'var(--color-text-dim)',
            background: 'linear-gradient(180deg, #241a10 0%, #1c130b 55%, #17100a 100%)',
            boxShadow:
              'inset 0 2px 3px rgba(0,0,0,0.75), inset 0 -1px 0 rgba(255,232,190,0.14)',
          }}
        >
          <span>{activeDay.name} · locked — view only</span>
          {isDirector && (
            <button
              onClick={() => setConfirmUnlock(true)}
              className="font-mono uppercase"
              style={{
                padding: '3px 10px',
                fontSize: 8.5,
                letterSpacing: '0.14em',
                borderRadius: 3,
                color: '#2a1c0c',
                background:
                  'linear-gradient(180deg, var(--color-brass-hi) 0%, var(--color-brass) 55%, var(--color-brass-lo) 100%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,244,214,0.6)',
              }}
            >
              Unlock
            </button>
          )}
        </div>
      )}
      {viewingUnlocked && (
        <div
          className="mx-1 mt-1 flex items-center font-mono uppercase"
          style={{
            height: 24,
            paddingLeft: 12,
            borderRadius: 4,
            fontSize: 8.5,
            letterSpacing: '0.14em',
            color: 'var(--color-lamp-hot)',
            background: 'linear-gradient(180deg, #2c1a08 0%, #241306 55%, #1c0f05 100%)',
            boxShadow:
              'inset 0 2px 3px rgba(0,0,0,0.75), inset 0 -1px 0 rgba(254,223,151,0.28), 0 0 8px rgba(237,144,64,0.18)',
          }}
        >
          {activeDay.name} · unlocked by director — editing enabled
        </div>
      )}

      {/* ---- eight rows, each its own plate ---- */}
      <div className="flex flex-col" style={{ gap: ROW_GAP }}>
        {ordered.map((team, i) => {
          const mine = overallByTeam.get(team.id) ?? 0
          const above = i > 0 ? overallByTeam.get(ordered[i - 1].id) : undefined
          const below = i < ordered.length - 1 ? overallByTeam.get(ordered[i + 1].id) : undefined
          return (
            <BoardRow
              key={team.id}
              team={team}
              position={i + 1}
              tied={mine === above || mine === below}
              today={todayByTeam.get(team.id)?.totalDeci ?? 0}
              overall={mine}
              keys={keysByTeam.get(team.id) ?? 0}
              isDirector={isDirector}
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
        <span
          className="absolute right-[16px] top-[8px] font-mono uppercase"
          style={{ fontSize: 7.5, letterSpacing: '0.06em', color: '#2a1c0c', opacity: 0.88 }}
        >
          JR-02
        </span>
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

      {confirmUnlock && (
        <BrassConfirm
          title={`Unlock ${activeDay.name}?`}
          body="This device may edit that day until you leave it. The log keeps who wrote what."
          confirmLabel="Unlock"
          onConfirm={() => {
            setConfirmUnlock(false)
            unlockDay(activeDay.id)
          }}
          onCancel={() => setConfirmUnlock(false)}
        />
      )}
    </div>
  )
}

/**
 * A board row: rank, crest, full name, and the two numbers that answer the
 * only two questions the board exists for — *how is the team doing TODAY* and
 * *how is the team doing OVERALL*. Read-and-navigate only; the whole plate is
 * one link to the team sheet. Per-category state lives on the team sheet.
 */
function BoardRow({
  team,
  position,
  tied,
  today,
  overall,
  keys,
  isDirector,
}: {
  team: Team
  position: number
  tied: boolean
  today: number
  overall: number
  keys: number
  isDirector: boolean
}) {
  const navigate = useNavigate()
  return (
    <Plate chamfer={6} screws={false} style={{ height: ROW_H }} dataPart="board-row">
      <CornerRivets inset={5} size={SCREW} right={false} />
      <Link
        to={`/team/${team.id}`}
        aria-label={`${team.name}, position ${position} of 8, ${formatDeci(today)} today, ${formatDeci(overall)} overall`}
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
          {/* an engraved equals mark: this total is shared with a neighbour */}
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
         * The recessed channel the full team name sits in: a mid-height band,
         * so lit plate face survives above and below it. Full-height channels
         * plus two dark readout windows pulled the route's median luminance
         * below the material band — the screen is brightened by spending area
         * on metal, never by unmotivated glow.
         */}
        <Well
          radius={8}
          style={{
            position: 'absolute',
            left: CH_L,
            right: CH_R,
            top: (ROW_H - 44) / 2,
            height: 44,
            background: 'linear-gradient(180deg,#211911 0%,#261d15 52%,#2c2118 100%)',
          }}
        >
          <Rim radius={8} />
          <span
            className="font-display absolute inset-0 flex items-center font-semibold uppercase"
            style={{
              paddingLeft: 24,
              paddingRight: 34,
              fontSize: 15,
              lineHeight: 1.08,
              letterSpacing: '0.025em',
              color: 'var(--color-text)',
              textShadow: '0 1px 1px rgba(16,9,4,0.55)',
            }}
          >
            {team.name}
          </span>
        </Well>

        {/* the key count is the row's one control: visible to everyone, but
            striking keys is the director's errand, so only they can tap it */}
        <button
          onClick={() => navigate(`/key/${team.id}`)}
          disabled={!isDirector}
          aria-label={`Open the golden key ceremony for ${team.name}`}
          className="absolute flex items-center justify-center"
          style={{
            right: CH_R + 4,
            top: (ROW_H - 44) / 2,
            height: 44,
            width: 34,
            background: 'transparent',
            borderRadius: 4,
            zIndex: 1,
          }}
        >
          <KeyCount keys={keys} size={22} />
        </button>

        {/* the medallion overhangs the channel's left end and the plate's edges */}
        <div className="absolute" style={{ left: 45, top: (ROW_H - CREST) / 2, zIndex: 1 }}>
          <TeamCrest teamId={team.id} size={CREST} />
        </div>

        {/*
         * TODAY is printed on the plate face — small, dim, no window. OVERALL
         * gets the one framed dark window per row, exactly the single score
         * readout the reference row carries. The size and material difference
         * is what keeps the two numbers unmistakable.
         */}
        <span className="absolute text-right" style={{ right: 71, top: 18, width: 52 }}>
          <span
            aria-hidden
            className="block font-mono uppercase"
            style={{ fontSize: 6, letterSpacing: '0.12em', color: 'rgba(58,42,26,0.9)' }}
          >
            Today
          </span>
          <span
            className="numeral block tabular-nums"
            style={{
              fontSize: 19,
              lineHeight: 1.15,
              color: 'var(--color-text-dim)',
              textShadow: '0 1px 0 rgba(255,240,206,0.16)',
            }}
          >
            {formatDeci(today)}
          </span>
        </span>
        <Readout label="Overall" value={overall} right={1} width={54} />
      </Link>

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

/**
 * The framed readout window: the plate's own metal turned up into a 5px lip
 * with cut corners, the dark window sunk inside it, and a two-part read — a
 * tiny engraved label over a right-aligned tabular numeral.
 */
function Readout({
  label,
  value,
  right,
  width,
}: {
  label: string
  value: number
  right: number
  width: number
}) {
  return (
    <>
      <span
        aria-hidden
        className="absolute"
        style={{
          right,
          top: 5,
          width: width + 10,
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
          right: right + 6,
          top: 11,
          width,
          height: ROW_H - 22,
          clipPath: oct(5),
          background: 'linear-gradient(180deg,#221911 0%,#1e1610 46%,#1b140f 100%)',
        }}
      >
        <Rim radius={0} />
        <span
          aria-hidden
          className="absolute font-mono uppercase"
          style={{
            top: 5,
            left: 0,
            right: 5,
            textAlign: 'right',
            fontSize: 6,
            letterSpacing: '0.12em',
            color: 'rgba(226,203,171,0.85)',
          }}
        >
          {label}
        </span>
        <span
          className="numeral absolute inset-x-0 bottom-[6px] text-right tabular-nums"
          style={{
            right: 5,
            fontSize: 26,
            color: 'var(--color-text)',
            lineHeight: 1,
            // The numerals cast down-right onto the window floor — one light
            // direction applies to type as much as to metal.
            textShadow: '1px 2px 0 rgba(10,5,2,0.8)',
          }}
        >
          {formatDeci(value)}
        </span>
      </Well>
    </>
  )
}
