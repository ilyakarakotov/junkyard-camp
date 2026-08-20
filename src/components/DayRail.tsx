import { useId, type CSSProperties } from 'react'
import type { Day } from '../data/types'
import { textureOffset } from './chrome'

/**
 * The five days, in the two forms the concept art uses.
 *
 * `sockets` (board): a brass rail carrying five machined sockets. Each socket is
 * a bronze bezel with four notches cut at N/E/S/W and a recessed face seated
 * inside it. Past days show a bright brass bezel over a lit bronze face; the
 * current day is a teal pilot lamp whose light escapes through the notches and
 * blooms onto the rail; future days keep the same bezel and face, dimmed —
 * dark *metal in a collar*, never a hole punched through the rail.
 *
 * `tabs` (team sheet): five octagonal chamfered tabs, 32x24 on a 40px pitch.
 * Each is a shallow recess — dark top lip, lit lower lip — carrying a bright
 * cream numeral with a struck dark contour, exactly as `05-team-sheet.jpg` has
 * it. The selected tab is lit amber from beneath and spills onto the wall.
 *
 * Arrival carries no score, so in both forms it is visibly inert rather than
 * merely unselected — a leader must not open it expecting to award points. In
 * the rail it is a blanked socket (a plugged face with an engraved bar across
 * it); in the tab rail it is a plugged well with a mono legend, not a brass
 * plate with a display numeral.
 *
 * All measurements are sampled from the references, not estimated: socket outer
 * 23.7 CSS px on a 45.5px pitch, bar body 6px with a 1px specular top lip; tab
 * 32.5x21.7 on a 39px pitch, face luma 88 with a 208-luma numeral over it.
 */
export default function DayRail({
  days,
  activeId,
  onSelect,
  variant = 'tabs',
  className = '',
  readOnly = false,
  todayId,
  lockedIds,
  unlockedIds,
}: {
  days: Day[]
  activeId: string
  onSelect?: (id: string) => void
  variant?: 'tabs' | 'sockets'
  className?: string
  /**
   * Inside a detail screen the rail is a **readout, not a picker**. Once a
   * leader has clicked into a team, changing the date under them is a way to
   * award a point to the wrong day without noticing — so the rail still says
   * which day is being scored and nothing on it is reachable. Day selection
   * lives on the board, where it is the whole point of the screen.
   */
  readOnly?: boolean
  /**
   * The camp's actual today (03:00 rollover): its socket is the pilot lamp,
   * whether or not it is the one being viewed. Absent, the lamp follows the
   * selection as before.
   */
  todayId?: string
  /** Locked days show a padlock on the socket — view-only (§6.1). */
  lockedIds?: ReadonlySet<string>
  /** Director-unlocked days keep the padlock, turned amber. */
  unlockedIds?: ReadonlySet<string>
}) {
  return variant === 'sockets' ? (
    <SocketRail
      days={days}
      activeId={activeId}
      onSelect={readOnly ? undefined : onSelect}
      className={className}
      todayId={todayId}
      lockedIds={lockedIds}
      unlockedIds={unlockedIds}
    />
  ) : (
    <TabRail
      days={days}
      activeId={activeId}
      onSelect={readOnly ? undefined : onSelect}
      className={className}
    />
  )
}

/* -- sockets ------------------------------------------------------------- */

const SOCKET = 24 // outer bezel diameter; the reference measures 23.7 CSS px
const RING = 4 // bezel width; reference 4.3
const BAR = 7 // rail bar, of which 1px is the specular top lip

/**
 * A padlock seated on a socket's face: the day is view-only. Dark engraved
 * brass while locked; amber once a director has unlocked the day on this
 * device (the banner carries the same state).
 */
function Padlock({ unlocked }: { unlocked: boolean }) {
  const metal = unlocked ? 'var(--color-lamp)' : '#221407'
  const lip = unlocked ? 'var(--color-lamp-hot)' : 'rgba(255,232,190,0.4)'
  return (
    <svg
      width={11}
      height={12}
      viewBox="0 0 12 13"
      aria-hidden
      className="absolute"
      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
    >
      <path d="M3.5 6 V4.2 a2.5 2.5 0 0 1 5 0 V6" fill="none" stroke={metal} strokeWidth={1.7} />
      <rect x={2.4} y={5.6} width={7.2} height={5.6} rx={1.1} fill={metal} />
      <rect x={2.4} y={10.2} width={7.2} height={1} rx={0.5} fill={lip} />
    </svg>
  )
}

/**
 * Four notches cut through the bezel at the compass points. On an unlit socket
 * they are dark slots with a lit lower lip; on the pilot lamp they are the
 * windows the light escapes through, which is what ties the bloom to a body.
 */
function Notches({ lit }: { lit: boolean }) {
  const slot = lit
    ? {
        background: 'radial-gradient(circle, #b8fff5 0%, #5fe8db 45%, var(--color-accent) 80%, #12817c 100%)',
        boxShadow: '0 0 3px color-mix(in oklab, var(--color-accent) 60%, transparent)',
      }
    : {
        background: 'linear-gradient(180deg, #170e06 0%, #26190d 66%, #4a3722 100%)',
        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.85)',
      }
  const long = 6.4
  const deep = 2.8
  const edge = 1.1
  const mid = SOCKET / 2 - long / 2
  const boxes: CSSProperties[] = [
    { left: mid, top: edge, width: long, height: deep },
    { left: mid, bottom: edge, width: long, height: deep },
    { top: mid, left: edge, width: deep, height: long },
    { top: mid, right: edge, width: deep, height: long },
  ]
  return (
    <>
      {boxes.map((b, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute"
          style={{ ...b, borderRadius: 2, ...slot }}
        />
      ))}
    </>
  )
}

function SocketRail({
  days,
  activeId,
  onSelect,
  className,
  todayId,
  lockedIds,
  unlockedIds,
}: {
  days: Day[]
  activeId: string
  onSelect?: (id: string) => void
  className: string
  todayId?: string
  lockedIds?: ReadonlySet<string>
  unlockedIds?: ReadonlySet<string>
}) {
  const uid = useId()
  const activeIndex = days.findIndex((d) => d.id === activeId)
  return (
    <div className={`relative ${className}`} role="tablist" aria-label="Camp day">
      {/*
       * The rail itself. Sampled off 01-board.jpg: a 1px specular lip at the
       * top, a 4px #5A4637 body, and a dark under-edge dropping into a contact
       * shadow — a thin bar the sockets are three times the height of, not a
       * pale noodle they sit on.
       */}
      <div
        className="grain absolute left-0 right-0 top-1/2 -translate-y-1/2"
        style={{
          ...textureOffset(uid),
          height: BAR,
          borderRadius: BAR / 2,
          background:
            'linear-gradient(180deg, #c6b2a3 0%, #bda89b 14%, #8a6e58 22%, #5a4637 36%, #5e4a3a 64%, #6e5647 80%, #45301f 91%, #2e1d0e 100%)',
          boxShadow: 'inset 1px 0 0 rgba(255,244,214,0.22), 0 2px 3px rgba(0,0,0,0.55)',
        }}
        aria-hidden
      >
        {/* the rail terminates in a round brass lug, not a squared-off bar end */}
        {(['left', 'right'] as const).map((side) => (
          <span
            key={side}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              [side]: -3,
              width: 12,
              height: 12,
              borderRadius: 9999,
              background: 'radial-gradient(circle at 34% 30%, #e8c795 0%, #a8834a 44%, #6b5028 78%, #33240f 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,244,220,0.5), 0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            <span className="rivet absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
          </span>
        ))}
      </div>
      {/*
       * 44px hit targets on a 3px gutter put the sockets on the reference's
       * ~47px pitch without shrinking anything a thumb has to find.
       */}
      <div className="relative flex items-center justify-center gap-[3px] py-[7px]">
        {days.map((d, i) => {
          const selected = d.id === activeId
          // The pilot lamp marks the camp's actual today; without a todayId it
          // follows the selection, as the team-sheet tabs have always read.
          const lit = todayId !== undefined ? d.id === todayId : selected && d.scored
          const locked = lockedIds?.has(d.id) ?? false
          const unlocked = unlockedIds?.has(d.id) ?? false
          const past = i < activeIndex
          const bright = past || selected
          /* Read-only: the same socket, drawn as a readout with nothing to
             press. A span rather than a disabled button, so no user-agent
             pressed/hover state is reachable at all. */
          const Tag = (onSelect ? 'button' : 'span') as 'button'
          return (
            <Tag
              key={d.id}
              role="tab"
              aria-selected={selected}
              aria-label={`${d.name}${d.scored ? '' : ' (no scoring)'}${locked ? ' (locked — view only)' : ''}`}
              onClick={onSelect ? () => onSelect(d.id) : undefined}
              className="relative flex h-11 w-11 items-center justify-center"
            >
              {/*
               * The pilot lamp's spill, painted *under* the socket so the bezel
               * stays readable through it — the halo lights the rail, it does
               * not erase the metal that holds the lamp.
               */}
              {lit && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  style={{
                    width: 54,
                    height: 54,
                    marginLeft: -27,
                    marginTop: -27,
                    background:
                      'radial-gradient(circle, color-mix(in oklab, var(--color-accent) 62%, transparent) 0%, color-mix(in oklab, var(--color-accent) 34%, transparent) 26%, color-mix(in oklab, var(--color-accent) 14%, transparent) 44%, color-mix(in oklab, var(--color-accent) 4%, transparent) 64%, transparent 84%)',
                  }}
                />
              )}
              {/* the bezel: a machined bronze collar, lit top left */}
              <span
                className="relative block"
                style={{
                  width: SOCKET,
                  height: SOCKET,
                  borderRadius: 9999,
                  background: bright
                    ? 'linear-gradient(146deg, #e2c08d 0%, #c19c6f 14%, #a68352 40%, #8b6c42 64%, #6d5330 84%, #4f3b1e 100%)'
                    : 'linear-gradient(146deg, #96794f 0%, #78603c 26%, #5c4830 56%, #45341f 80%, #322412 100%)',
                  // A machined bezel reads by its two hairlines: a turned rim
                  // right on the outer circumference and a step down to the
                  // face. Without them the collar flattens into a brown ring.
                  boxShadow: bright
                    ? 'inset 0 0 0 1px rgba(255,238,205,0.34), inset 0 1px 0 rgba(255,244,214,0.6), inset 0 -1px 1px rgba(30,18,6,0.7), 0 1px 2px rgba(0,0,0,0.65)'
                    : 'inset 0 0 0 1px rgba(255,232,196,0.2), inset 0 1px 0 rgba(255,236,200,0.3), inset 0 -1px 1px rgba(24,14,4,0.7), 0 1px 2px rgba(0,0,0,0.6)',
                }}
              >
                {/*
                 * The face, seated one bezel-width down. It is dark metal in a
                 * collar: a recess, darkest at the top lip, with a warm rim of
                 * light along the bottom — never a bore.
                 */}
                <span
                  aria-hidden
                  className="absolute block"
                  style={{
                    inset: RING,
                    borderRadius: 9999,
                    background: lit
                      ? 'radial-gradient(circle at 50% 42%, #ffffff 0%, #ddfffa 9%, #7ef1e4 26%, var(--color-accent) 54%, #17a49d 82%, #0c6764 100%)'
                        : d.scored && past
                          ? 'radial-gradient(84% 76% at 50% 116%, rgba(255,216,160,0.18) 0%, transparent 60%), linear-gradient(180deg, #45301b 0%, #614528 26%, #6d4d2c 58%, #785633 88%, #856340 100%)'
                          : 'radial-gradient(84% 76% at 50% 116%, rgba(255,214,158,0.16) 0%, transparent 60%), linear-gradient(180deg, #2e2114 0%, #453020 28%, #5a4030 62%, #634832 88%, #6d5138 100%)',
                    // The lamp is a bulb seated in a collar: its core is inset
                    // and it throws only a hairline past the seam. The spill
                    // onto the rail is the halo behind, so the brass reads.
                    boxShadow: lit
                      ? 'inset 0 0 3px 1px rgba(255,255,255,0.5), 0 0 0 1px rgba(24,14,4,0.4), 0 0 2px color-mix(in oklab, var(--color-accent) 55%, transparent)'
                      : 'inset 0 2px 3px rgba(0,0,0,0.62), inset 0 -1px 0 rgba(255,222,178,0.22), 0 0 0 1px rgba(24,14,4,0.55), 0 1px 0 0 rgba(255,232,190,0.24)',
                  }}
                />
                <Notches lit={lit} />
                {/* a locked day is view-only: the padlock sits on the face, and
                    turns amber while a director's unlock holds on this device */}
                {locked && <Padlock unlocked={unlocked} />}
                {/*
                 * A non-scoring day is a blanked socket: the face is plugged and
                 * an engraved bar is cut across it. Nothing to award here.
                 */}
                {!d.scored && (
                  <span
                    aria-hidden
                    className="absolute"
                    style={{
                      left: RING + 1.5,
                      right: RING + 1.5,
                      top: '50%',
                      height: 2,
                      marginTop: -1,
                      borderRadius: 1,
                      background:
                        'linear-gradient(180deg, #22160a 0%, #22160a 55%, rgba(255,228,180,0.4) 100%)',
                    }}
                  />
                )}
              </span>
            </Tag>
          )
        })}
      </div>
    </div>
  )
}

/* -- tabs ---------------------------------------------------------------- */

const TAB_W = 32
const TAB_H = 24
const CHAMFER = 5
const OCT = `polygon(${CHAMFER}px 0, calc(100% - ${CHAMFER}px) 0, 100% ${CHAMFER}px, 100% calc(100% - ${CHAMFER}px), calc(100% - ${CHAMFER}px) 100%, ${CHAMFER}px 100%, 0 calc(100% - ${CHAMFER}px), 0 ${CHAMFER}px)`

/** Octagonal chamfered tabs — the team-sheet form. */
function TabRail({
  days,
  activeId,
  onSelect,
  className,
}: {
  days: Day[]
  activeId: string
  onSelect?: (id: string) => void
  className: string
}) {
  const uid = useId()
  /* Read-only: the tabs are a readout of which day is being scored. A span
     rather than a disabled button, so there is no pressed or hover state left
     to suggest the date can be changed from here. */
  const Tag = (onSelect ? 'button' : 'span') as 'button'
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} role="tablist" aria-label="Camp day">
      {days.map((d, i) => {
        const active = d.id === activeId
        const label = d.scored ? String(d.index) : 'ARR'
        return (
          <Tag
            key={d.id}
            role="tab"
            aria-selected={active}
            aria-label={`${d.name}${d.scored ? '' : ' (no scoring)'}`}
            onClick={onSelect ? () => onSelect(d.id) : undefined}
            className="relative block"
            // 32x24 on an 8px gutter: a 40px pitch, 192px of rail. The
            // reference measures 32.5x21.7 on a 39px pitch spanning 190px.
            style={{ width: TAB_W, height: TAB_H }}
          >
            {/*
             * The amber the lit tab throws onto the wall around it. Sampled off
             * the reference: rgb(148,79,46) immediately under the tab's lower
             * lip, decaying into the wall over ~6px.
             */}
            {active && (
              <span
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  left: -13,
                  right: -13,
                  top: -7,
                  bottom: -12,
                  background:
                    'radial-gradient(58% 66% at 50% 56%, color-mix(in oklab, var(--color-lamp) 94%, transparent) 0%, color-mix(in oklab, var(--color-lamp) 62%, transparent) 34%, color-mix(in oklab, var(--color-lamp) 28%, transparent) 56%, color-mix(in oklab, var(--color-lamp) 8%, transparent) 74%, transparent 92%)',
                }}
              />
            )}
            {/*
             * The chamfered rim. A tab is a shallow recess, so the rim is dark
             * along the top-left lip and catches the key light along the
             * bottom-right — one light direction, and the reason the face reads
             * dished rather than domed.
             */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                clipPath: OCT,
                background: active
                  ? 'linear-gradient(158deg, #210f06 0%, #431d0d 26%, #7c3c1a 58%, #c06730 82%, #f5a066 100%)'
                  : 'linear-gradient(158deg, #1a1006 0%, #2c1d0b 22%, #4e3a21 52%, #856a46 80%, #c1a179 100%)',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.75))',
              }}
            >
              <span
                className="grain absolute"
                style={{
                  ...textureOffset(`${uid}-${i}`),
                  inset: 1.5,
                  clipPath: OCT,
                  background: active
                    ? 'linear-gradient(180deg, #3a1a08 0%, #63300f 10%, #83452a 22%, #86482a 54%, #a35630 76%, #d16f31 90%, #f2a469 100%)'
                    : d.scored
                      ? 'linear-gradient(180deg, #35240f 0%, #543e23 9%, #674e2d 20%, #6f5532 42%, #725734 66%, #7a5f3c 86%, #866b4c 100%)'
                      : 'linear-gradient(180deg, #251a11 0%, #3d2b1a 26%, #4e3826 58%, #59422e 86%, #66513c 100%)',
                  // The lit tab is the emitter: a hot seam along the lower lip
                  // and a thin fired line following the chamfer all round.
                  boxShadow: active
                    ? 'inset 0 -1.5px 0 rgba(255,206,150,0.85), inset 0 0 0 1px rgba(255,168,96,0.3)'
                    : d.scored
                      ? undefined
                      : 'inset 0 2px 3px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,222,178,0.2)',
                }}
              />
            </span>
            {/*
             * The numeral. Bright cream with a struck dark contour, the way the
             * reference reads (face L88, numeral L208) — five lit numbers
             * punctuating the rail, not four muddy ones beside a lit tab.
             */}
            <span
              className={`pointer-events-none absolute inset-0 flex items-center justify-center leading-none ${
                d.scored ? 'numeral' : 'font-mono font-bold'
              }`}
              style={{
                color: active ? '#fff4e4' : d.scored ? '#f0dfc2' : '#d8c7ab',
                fontSize: d.scored ? 15 : 10,
                letterSpacing: d.scored ? '0.01em' : '0.04em',
                textShadow:
                  '0 1px 0 rgba(18,9,2,0.85), 1px 0 0 rgba(18,9,2,0.3), -1px 0 0 rgba(18,9,2,0.3), 0 2px 3px rgba(0,0,0,0.5)',
              }}
            >
              {label}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}
