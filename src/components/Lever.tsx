import { useCallback, useEffect, useRef, useState } from 'react'
import { ArcBolt, ContactPost, usePrefersReducedMotion } from '../fx/Arc'

/**
 * The commit lever. It is no longer "+1 increment" — it commits the whole
 * column: toggle the eight teams in roll call, pull once, everything lands
 * together.
 *
 * GEOMETRY IS THE POINT. The discharge emitter sits at the exact midpoint of
 * the track. The grip starts at the top and travels the full length, past the
 * tube, to a brass contact block at the base. Rest = grip above the tube with
 * empty rail below it; fired = grip below the tube with empty rail above it.
 * The grip visibly crosses the gap and closes the circuit — the two states
 * have to be unmistakable from across the room, not a 55% nudge.
 *
 *    REST                        FIRED
 *    | ▓▓▓▓▓▓▓ | <- grip at top  | ░░░░░░░ | <- ticks lit behind it
 *    | ·  ·  · |                 | ═══════ |
 *    |-o=====o-| <- tube dark    |-o=====o-| <- tube white-hot, arcs erupting
 *    | ·  ·  · |                 | ≈≈≈≈≈≈≈ |
 *    | ·  ·  · |                 | ▓▓▓▓▓▓▓ | <- grip seated at base
 *
 * Interaction: drag tracks the finger 1:1 with no easing; >=60% travel arms it
 * (navigator.vibrate(20)); releasing while armed fires. Release below the
 * threshold springs back on cubic-bezier(0.34, 1.56, 0.64, 1) over 400ms.
 * On trigger the grip snaps to the base and STAYS SEATED through the commit
 * beat before returning — a grip that rebounds instantly never looks like it
 * did anything. Only transform and opacity animate.
 */

const H = 312
const TRACK_TOP = 30
const TRACK_H = 236
const TRACK_BOTTOM = TRACK_TOP + TRACK_H // 266
const TUBE_Y = TRACK_TOP + TRACK_H / 2 // 148 — the exact midpoint
const HANDLE_H = 52
const GRIP_TOP = TRACK_TOP + 4 // 34
const GRIP_FIRED_TOP = TRACK_BOTTOM - 4 - HANDLE_H // 210
const TRAVEL = GRIP_FIRED_TOP - GRIP_TOP // 176
const BASE_BLOCK_Y = 262
const TICKS = 13
const TRACK_CX = 33 // rail centreline; the tube's contact posts land here
const ARM_THRESHOLD = 0.6

/** How long the grip stays seated at the base before returning. */
const SEAT_HOLD_MS = 520
const RETURN_MS = 400

export interface LeverProps {
  label?: string
  armedLabel?: string
  /** Appended to the label as "· 5 TEAMS". Also drives the disabled state. */
  pendingCount?: number
  disabled?: boolean
  onFire: () => void
  onArmedChange?: (armed: boolean) => void
}

type Phase = 'idle' | 'drag' | 'seated' | 'return'

/** Tall stacked brass post: flange -> drum -> neck -> domed cap. */
function LeverPost({ cx, baseY, id, scale = 1 }: { cx: number; baseY: number; id: string; scale?: number }) {
  const s = scale
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-drum`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a1c0a" />
          <stop offset="22%" stopColor="#9a7434" />
          <stop offset="42%" stopColor="#d9b06a" />
          <stop offset="65%" stopColor="#7a5622" />
          <stop offset="100%" stopColor="#241708" />
        </linearGradient>
        <radialGradient id={`${id}-dome`} cx="0.34" cy="0.28" r="0.95">
          <stop offset="0%" stopColor="#f6e3b0" />
          <stop offset="38%" stopColor="#c08a3e" />
          <stop offset="74%" stopColor="#6d4a1e" />
          <stop offset="100%" stopColor="#241708" />
        </radialGradient>
      </defs>
      <ellipse cx={cx + 2} cy={baseY + 1} rx={16 * s} ry={5 * s} fill="rgba(0,0,0,0.55)" />
      <ellipse cx={cx} cy={baseY - 2} rx={14 * s} ry={5 * s} fill={`url(#${id}-drum)`} stroke="#170e04" strokeWidth="0.7" />
      <rect x={cx - 10 * s} y={baseY - 15 * s} width={20 * s} height={13 * s} fill={`url(#${id}-drum)`} />
      <ellipse cx={cx} cy={baseY - 15 * s} rx={10 * s} ry={3.6 * s} fill={`url(#${id}-drum)`} stroke="#170e04" strokeWidth="0.6" />
      <rect x={cx - 6 * s} y={baseY - 29 * s} width={12 * s} height={15 * s} fill={`url(#${id}-drum)`} />
      <circle cx={cx} cy={baseY - 30 * s} r={7 * s} fill={`url(#${id}-dome)`} stroke="#170e04" strokeWidth="0.6" />
      <circle cx={cx - 2.2 * s} cy={baseY - 32.4 * s} r={1.6 * s} fill="#fff3d8" opacity="0.85" />
    </g>
  )
}

export default function Lever({
  label = 'PULL TO COMMIT',
  armedLabel = 'RELEASE TO COMMIT',
  pendingCount,
  disabled,
  onFire,
  onArmedChange,
}: LeverProps) {
  const reduced = usePrefersReducedMotion()
  const [travel, setTravel] = useState(0) // 0..1
  const [phase, setPhase] = useState<Phase>('idle')
  const [flash, setFlash] = useState(false)
  const wasArmed = useRef(false)
  const drag = useRef<{ pointerId: number; startY: number; startTravel: number } | null>(null)
  const gripRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [width, setWidth] = useState(358)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const dead = Boolean(disabled) || pendingCount === 0
  const armed = travel >= ARM_THRESHOLD

  useEffect(() => {
    if (armed !== wasArmed.current) {
      if (armed) navigator.vibrate?.(20)
      onArmedChange?.(armed)
    }
    wasArmed.current = armed
  }, [armed, onArmedChange])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (dead || phase === 'seated' || phase === 'return') return
      gripRef.current?.setPointerCapture(e.pointerId)
      drag.current = { pointerId: e.pointerId, startY: e.clientY, startTravel: travel }
      setPhase('drag')
    },
    [dead, phase, travel],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current || e.pointerId !== drag.current.pointerId) return
    const dy = e.clientY - drag.current.startY
    setTravel(Math.min(1, Math.max(0, drag.current.startTravel + dy / TRAVEL)))
  }, [])

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current || e.pointerId !== drag.current.pointerId) return
      drag.current = null
      if (travel >= ARM_THRESHOLD) {
        // Seat hard at the base and HOLD through the commit beat.
        setPhase('seated')
        setTravel(1)
        setFlash(true)
        navigator.vibrate?.(20)
        onFire()
        timers.current.push(setTimeout(() => setFlash(false), 150))
        timers.current.push(
          setTimeout(() => {
            setPhase('return')
            setTravel(0)
          }, SEAT_HOLD_MS),
        )
        timers.current.push(setTimeout(() => setPhase('idle'), SEAT_HOLD_MS + RETURN_MS))
      } else {
        setPhase('idle')
        setTravel(0)
      }
    },
    [travel, onFire],
  )

  const dragging = phase === 'drag'
  const seated = phase === 'seated'
  // The tube's emission follows the pull, then goes full on discharge.
  const glow = seated ? 1 : phase === 'return' ? 0.35 : travel
  const storm = (seated || (armed && dragging)) && !reduced

  const gripTransform = `translateY(${travel * TRAVEL}px)`
  const gripTransition = dragging
    ? 'none'
    : seated
      ? 'transform 110ms cubic-bezier(0.25, 0.8, 0.35, 1)'
      : `transform ${RETURN_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`

  const postX = 46
  const basePostY = BASE_BLOCK_Y - 4
  const tubeL = TRACK_CX
  const tubeR = width - TRACK_CX
  const handleL = Math.round(width * 0.19)
  const yokeL = handleL - 9
  const yokeR = width - handleL + 9

  // Ticks the grip has travelled past light up behind it.
  const gripCentre = GRIP_TOP + travel * TRAVEL + HANDLE_H / 2
  const captionText = armed || seated ? armedLabel : label
  const suffix = pendingCount === undefined ? '' : ` · ${pendingCount} TEAM${pendingCount === 1 ? '' : 'S'}`

  return (
    <div
      ref={rootRef}
      className="steel-raised bevel relative select-none overflow-hidden rounded-md"
      style={{ height: H, touchAction: 'none', opacity: dead ? 0.55 : 1, filter: dead ? 'saturate(0.35)' : undefined }}
    >
      <div
        className="pointer-events-none absolute inset-2 rounded-sm"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,236,205,0.05)' }}
      />
      <span className="screw left-[7px] top-[7px]" style={{ ['--slot' as string]: '52deg' }} />
      <span className="screw right-[7px] top-[7px]" style={{ ['--slot' as string]: '-15deg' }} />
      <span className="screw bottom-[7px] left-[7px]" style={{ ['--slot' as string]: '8deg' }} />
      <span className="screw bottom-[7px] right-[7px]" style={{ ['--slot' as string]: '77deg' }} />
      <span className="tech-label absolute right-6 top-2 text-[8px] opacity-50">CH-01 / COMMIT</span>

      {/* ---- rails: full-length machined channels ---- */}
      {(['left', 'right'] as const).map((side) => (
        <div
          key={side}
          className="absolute"
          style={{ [side]: 20, top: TRACK_TOP, width: 26, height: TRACK_H } as React.CSSProperties}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, #3d2d16 0%, #6b5227 14%, #1a1206 30%, #120c05 70%, #4a3719 88%, #241a0b 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.16), 0 1px 0 rgba(255,232,190,0.06)',
            }}
          />
          <div
            className="recess absolute inset-x-1 inset-y-[3px] rounded-full"
            style={{ background: 'linear-gradient(180deg, #120c06 0%, #1d1409 45%, #130d06 100%)' }}
          />
          {/*
           * Charge wash fills the rail ABOVE the grip as it descends — the
           * emptied rail behind the grip is what reads as travel.
           *
           * Kept low and bottom-weighted on purpose: the current is at the
           * carriage, so the light is strongest just above it and falls off
           * upward. A flat opaque fill reads as a plastic strip and drowns the
           * lit ticks beside it.
           */}
          <div
            className="absolute inset-x-[5px] rounded-full"
            style={{
              top: 4,
              height: `calc(${Math.max(0, travel) * 100}% - 8px)`,
              background:
                'linear-gradient(180deg, rgba(47,217,208,0.05) 0%, rgba(47,217,208,0.16) 45%, rgba(47,217,208,0.5) 92%, rgba(180,255,250,0.7) 100%)',
              boxShadow: 'inset 0 0 5px rgba(47,217,208,0.3)',
              opacity: dead ? 0 : reduced ? (travel > 0.6 ? 0.6 : 0) : 0.85,
              transition: dragging ? 'none' : `height ${RETURN_MS}ms ease-out, opacity 300ms ease-out`,
            }}
          />
        </div>
      ))}

      {/* engraved ticks down the inner edge of each rail, lit as the grip passes */}
      {(['left', 'right'] as const).map((side) => (
        <svg
          key={side}
          className="pointer-events-none absolute"
          style={
            { [side]: 46, top: TRACK_TOP + 6, width: 12, height: TRACK_H - 12 } as React.CSSProperties
          }
          aria-hidden
        >
          {Array.from({ length: TICKS }, (_, i) => {
            const y = 3 + (i * (TRACK_H - 18)) / (TICKS - 1)
            const lit = !dead && TRACK_TOP + 6 + y < gripCentre
            return (
              <line
                key={i}
                x1={side === 'left' ? 1 : 11}
                x2={side === 'left' ? 9 : 3}
                y1={y}
                y2={y}
                stroke={lit ? 'var(--color-accent)' : 'rgba(237,227,210,0.2)'}
                strokeWidth={lit ? 2 : 1}
                style={lit ? { filter: 'drop-shadow(0 0 3px rgba(47,217,208,0.75))' } : undefined}
              />
            )
          })}
        </svg>
      ))}

      {/* ---- light spill around the emitter ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: '4%',
          right: '4%',
          top: TUBE_Y - 74,
          height: 148,
          background:
            'radial-gradient(50% 52% at 50% 50%, rgba(47,217,208,0.32) 0%, rgba(47,217,208,0.09) 52%, transparent 78%)',
          opacity: dead ? 0 : reduced ? (glow > 0.6 ? 0.8 : glow * 0.5) : glow,
          transition: dragging ? 'none' : 'opacity 300ms ease-out',
        }}
      />

      {/* ---- discharge emitter: horizontal glass tube at the track midpoint ---- */}
      <div
        className="absolute"
        style={{ left: tubeL, width: tubeR - tubeL, top: TUBE_Y - 13, height: 26 }}
      >
        {/* ribbed brass end collars where the tube meets the rails */}
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            className="absolute -top-[4px] h-[34px] w-[14px]"
            style={
              {
                [side]: -7,
                background:
                  'repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 4px),' +
                  'linear-gradient(180deg, #8a6428 0%, #d9b06a 18%, #7a5622 55%, #2c1d0a 100%)',
                borderRadius: 3,
                boxShadow:
                  'inset 1px 1px 0 rgba(255,220,160,0.4), inset -1px -1px 1px rgba(0,0,0,0.5), 0 3px 4px rgba(0,0,0,0.6)',
              } as React.CSSProperties
            }
          />
        ))}
        <div
          className="absolute inset-0 overflow-hidden rounded-[5px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,8,6,0.92) 0%, rgba(30,26,22,0.85) 45%, rgba(8,6,5,0.95) 100%)',
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,236,205,0.07)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(47,217,208,0.18) 0%, rgba(47,217,208,0.85) 40%, rgba(210,255,252,0.97) 50%, rgba(47,217,208,0.85) 60%, rgba(47,217,208,0.2) 100%)',
              opacity: dead ? 0.03 : 0.06 + glow * 0.94,
              transition: seated ? 'opacity 110ms ease-out' : dragging ? 'none' : 'opacity 300ms ease-out',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'var(--color-accent-hot)',
              opacity: flash && !reduced ? 0.8 : 0,
              transition: 'opacity 130ms ease-out',
            }}
          />
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <line
                key={i}
                x1={`${12 + i * 9.5}%`}
                x2={`${12 + i * 9.5}%`}
                y1={i % 2 ? 6 : 4}
                y2={11}
                stroke="rgba(237,227,210,0.3)"
                strokeWidth="1"
              />
            ))}
          </svg>
          <div
            className="absolute inset-x-1 top-0.5 h-1.5 rounded-full"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)' }}
          />
        </div>
      </div>

      {/* ---- brass contact block at the base: what the grip seats against ---- */}
      <div
        className="absolute"
        style={{
          left: TRACK_CX - 6,
          width: width - (TRACK_CX - 6) * 2,
          top: BASE_BLOCK_Y,
          height: 16,
          borderRadius: 3,
          background:
            'repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 7px),' +
            'linear-gradient(180deg, #e0be7c 0%, #b3823c 22%, #6b4a1d 68%, #2a1c0a 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,244,214,0.6), inset 0 -2px 3px rgba(0,0,0,0.6), 0 3px 5px rgba(0,0,0,0.6)',
        }}
      >
        {/* seated contact glow — only while the circuit is actually closed */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: 3,
            background: 'linear-gradient(180deg, rgba(210,255,252,0.85), rgba(47,217,208,0.35))',
            opacity: seated && !reduced ? 0.75 : 0,
            transition: 'opacity 140ms ease-out',
          }}
        />
      </div>

      {/* ---- arcs ---- */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        {/* the emitter gap: always between the tube's two brass posts */}
        <ArcBolt
          x1={tubeL}
          y1={TUBE_Y}
          x2={tubeR}
          y2={TUBE_Y}
          seed={11}
          intensity={seated ? 1 : armed ? 0.88 : reduced ? 0.4 : 0.46}
          chaos={seated ? 1.5 : armed ? 1.25 : 0.9}
          weight={seated ? 1.25 : armed ? 1 : 0.8}
          strands={seated ? 3 : armed ? 2 : 1}
          active={!dead && (!reduced || !seated)}
        />
        {!dead &&
          [tubeL, tubeR].map((cx) => (
            <g key={cx} opacity={seated ? 1 : armed ? 0.9 : 0.5}>
              <circle cx={cx} cy={TUBE_Y} r={15} fill="var(--color-accent)" opacity={0.1} />
              <circle cx={cx} cy={TUBE_Y} r={8} fill="var(--color-accent)" opacity={0.22} />
              {(armed || seated) && <circle cx={cx} cy={TUBE_Y - 1} r={3.2} fill="#eafffd" opacity={0.7} />}
            </g>
          ))}

        {/* full discharge: current runs from the emitter down to the base block */}
        {storm && (
          <>
            <ArcBolt x1={tubeL} y1={TUBE_Y} x2={postX} y2={basePostY} seed={23} intensity={seated ? 0.95 : 0.6} chaos={1.7} strands={2} />
            <ArcBolt x1={tubeR} y1={TUBE_Y} x2={width - postX} y2={basePostY} seed={31} intensity={seated ? 0.95 : 0.6} chaos={1.7} strands={2} />
            <ArcBolt x1={postX} y1={basePostY} x2={width - postX} y2={basePostY} seed={57} intensity={seated ? 0.85 : 0.45} chaos={1.4} weight={0.9} />
            {[postX, width - postX].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy={basePostY} r={12} fill="var(--color-accent)" opacity={0.14} />
                <circle cx={cx} cy={basePostY - 1} r={3} fill="#eafffd" opacity={0.65} />
              </g>
            ))}
          </>
        )}

        {/* the emitter's two brass contact posts, on the rail centrelines */}
        <ContactPost cx={tubeL} cy={TUBE_Y} r={6} />
        <ContactPost cx={tubeR} cy={TUBE_Y} r={6} />
        {/* base posts flanking the contact block */}
        <LeverPost cx={postX} baseY={BASE_BLOCK_Y + 14} id="lv-pl" scale={0.72} />
        <LeverPost cx={width - postX} baseY={BASE_BLOCK_Y + 14} id="lv-pr" scale={0.72} />
      </svg>

      {/* ---- grip: knurled roller in cast-bronze yokes, riding the rails ---- */}
      <div
        ref={gripRef}
        role="slider"
        aria-label="Commit lever"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(travel * 100)}
        aria-disabled={dead}
        className={dead ? 'absolute inset-x-0' : 'absolute inset-x-0 cursor-grab active:cursor-grabbing'}
        style={{
          top: GRIP_TOP,
          height: HANDLE_H,
          transform: gripTransform,
          transition: gripTransition,
          willChange: 'transform',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute top-0 rounded-full"
          style={{
            left: handleL,
            right: handleL,
            height: HANDLE_H,
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='54'%3E%3Cfilter id='k'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.22' numOctaves='2' seed='6' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.06 0 0 0 0 0.02 0 0 0 0.45 0'/%3E%3C/filter%3E%3Crect width='120' height='54' filter='url(%23k)'/%3E%3C/svg%3E\")," +
              'linear-gradient(90deg, rgba(0,0,0,0.45) 0%, transparent 9%, transparent 91%, rgba(0,0,0,0.45) 100%),' +
              'repeating-linear-gradient(62deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 2px, rgba(255,238,196,0.16) 2px, rgba(255,238,196,0.16) 3px, transparent 3px, transparent 4.5px),' +
              'repeating-linear-gradient(-62deg, rgba(0,0,0,0.44) 0px, rgba(0,0,0,0.44) 1px, transparent 1px, transparent 2px, rgba(255,238,196,0.13) 2px, rgba(255,238,196,0.13) 3px, transparent 3px, transparent 4.5px),' +
              'linear-gradient(178deg, #1c1206 0%, #6d5228 13%, #c89a58 27%, #e8c584 34%, #a87f42 50%, #5d4319 72%, #241708 90%, #120a03 100%)',
            boxShadow:
              'inset 0 2px 2px rgba(255,232,190,0.5), inset 0 -4px 6px rgba(0,0,0,0.6), 0 6px 9px rgba(0,0,0,0.6), 0 14px 20px rgba(0,0,0,0.35)',
          }}
        >
          {(['left', 'right'] as const).map((side) => (
            <div
              key={side}
              className="absolute top-[2px] h-[calc(100%-4px)] w-[9px]"
              style={
                {
                  [side]: 1,
                  borderRadius: side === 'left' ? '9999px 2px 2px 9999px' : '2px 9999px 9999px 2px',
                  background: 'linear-gradient(178deg, #241708 0%, #8a6b32 16%, #e2c084 34%, #96733a 55%, #3c2a10 82%, #170e04 100%)',
                  boxShadow:
                    side === 'left'
                      ? 'inset -1.5px 0 1px rgba(0,0,0,0.55), inset 1px 0 0 rgba(255,232,190,0.3)'
                      : 'inset 1.5px 0 1px rgba(0,0,0,0.55), inset -1px 0 0 rgba(255,232,190,0.3)',
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            className="absolute rounded-full"
            style={
              {
                [side]: handleL - 21,
                top: 3,
                width: 26,
                height: HANDLE_H - 6,
                background: 'radial-gradient(circle at 35% 28%, #f6e3b0 0%, #c08a3e 38%, #6d4a1e 72%, #1d1206 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.5), inset 0 -3px 4px rgba(0,0,0,0.55), 0 4px 6px rgba(0,0,0,0.55)',
              } as React.CSSProperties
            }
          />
        ))}
        {/* cast-bronze yokes reaching into the rails, ending in riding carriages */}
        <svg className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
          <defs>
            <linearGradient id="lv-arm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a1c0a" />
              <stop offset="22%" stopColor="#8a6a32" />
              <stop offset="40%" stopColor="#c49a54" />
              <stop offset="66%" stopColor="#6d5228" />
              <stop offset="100%" stopColor="#1a1005" />
            </linearGradient>
            <linearGradient id="lv-carriage" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3a2a12" />
              <stop offset="24%" stopColor="#b58d4c" />
              <stop offset="46%" stopColor="#e6c689" />
              <stop offset="72%" stopColor="#7a5a26" />
              <stop offset="100%" stopColor="#1d1206" />
            </linearGradient>
            <radialGradient id="lv-boss" cx="0.32" cy="0.28" r="0.95">
              <stop offset="0%" stopColor="#ecd39c" />
              <stop offset="45%" stopColor="#a67c3c" />
              <stop offset="78%" stopColor="#4a3414" />
              <stop offset="100%" stopColor="#1d1206" />
            </radialGradient>
            <radialGradient id="lv-bolt" cx="0.32" cy="0.28" r="0.95">
              <stop offset="0%" stopColor="#f2dca6" />
              <stop offset="55%" stopColor="#8a6d3e" />
              <stop offset="100%" stopColor="#33230d" />
            </radialGradient>
          </defs>
          {([-1, 1] as const).map((s) => {
            const cx = s === -1 ? yokeL : yokeR
            const axisY = HANDLE_H / 2
            const carX = s === -1 ? TRACK_CX : width - TRACK_CX
            const carY = axisY
            const armLen = Math.hypot(carX - cx, carY - axisY)
            const armDeg = (Math.atan2(carY - axisY, carX - cx) * 180) / Math.PI
            return (
              <g key={s}>
                <circle cx={cx + 2} cy={axisY + 3} r={14} fill="rgba(0,0,0,0.4)" />
                <g transform={`rotate(${armDeg} ${cx} ${axisY})`}>
                  <rect x={cx} y={axisY - 8} width={armLen} height={16} rx={8} fill="url(#lv-arm)" stroke="#120a03" strokeWidth="0.8" />
                  <rect x={cx + 4} y={axisY - 5.5} width={Math.max(0, armLen - 8)} height={2} rx={1} fill="rgba(255,232,190,0.26)" />
                </g>
                <ellipse cx={carX + 1.5} cy={carY + 3} rx={9} ry={16} fill="rgba(0,0,0,0.65)" />
                <rect x={carX - 6.5} y={carY - 13} width={13} height={26} rx={4.5} fill="url(#lv-carriage)" stroke="#0b0602" strokeWidth="1" />
                <rect x={carX - 4.6} y={carY - 10} width={2} height={20} rx={1} fill="rgba(255,240,205,0.5)" />
                <rect x={carX + 2.9} y={carY - 10} width={1.5} height={20} rx={0.8} fill="rgba(0,0,0,0.5)" />
                <rect x={carX - 6.5} y={carY - 2} width={13} height={4} fill="rgba(255,236,200,0.14)" />
                <circle cx={carX} cy={carY} r={4.2} fill="url(#lv-bolt)" stroke="#0b0602" strokeWidth="0.8" />
                <circle cx={carX - 1.2} cy={carY - 1.3} r={1.2} fill="#fff3d8" opacity="0.7" />
                <circle cx={cx} cy={axisY} r={12.5} fill="url(#lv-boss)" stroke="#120a03" strokeWidth="0.9" />
                <circle cx={cx} cy={axisY} r={12.5} fill="none" stroke="rgba(255,232,190,0.28)" strokeWidth="0.8" strokeDasharray="8 30" strokeDashoffset={s === -1 ? 24 : 4} />
                <circle cx={cx} cy={axisY} r={4.6} fill="url(#lv-bolt)" stroke="#170e04" strokeWidth="0.7" />
                <line
                  x1={cx - 3.2}
                  y1={axisY}
                  x2={cx + 3.2}
                  y2={axisY}
                  stroke="#1d1206"
                  strokeWidth="1.3"
                  transform={`rotate(${s === -1 ? 28 : -54} ${cx} ${axisY})`}
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* ---- caption: engraved, never glowing (glow belongs to emitters) ---- */}
      <div className="absolute inset-x-0 bottom-2.5 text-center">
        <span
          className="font-display text-[12px] font-medium uppercase"
          style={{
            letterSpacing: '0.26em',
            color: dead ? 'var(--color-text-dim)' : armed || seated ? 'var(--color-text)' : 'var(--color-text-dim)',
            textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,230,180,0.07)',
          }}
        >
          {'[ '}
          {dead ? 'SELECT TEAMS' : captionText + suffix}
          {' ]'}
        </span>
      </div>
    </div>
  )
}
