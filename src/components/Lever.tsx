import { useCallback, useEffect, useRef, useState } from 'react'
import { ArcBolt, ContactPost, usePrefersReducedMotion } from '../fx/Arc'

/**
 * The award lever. Composed from layers (never a flat image):
 * housing → tracks (recessed, engraved ticks) → contact posts → glass
 * cylinder (emissive on pull) → brass grip (draggable) → arcs → light spill.
 *
 * Interaction: drag down 1:1 with the finger; ≥60% travel arms it
 * (navigator.vibrate(20)); releasing while armed fires. Release below the
 * threshold springs back with cubic-bezier(0.34, 1.56, 0.64, 1) over 400ms.
 * Only transform/opacity animate.
 */

const H = 296 // housing height
const TRAVEL = 118 // px of grip travel
const GRIP_TOP = 46
const TICKS = 11

export interface LeverProps {
  label: string
  armedLabel?: string
  disabled?: boolean
  onFire: () => void
  /** Fires when the 60% arm threshold is crossed either way. */
  onArmedChange?: (armed: boolean) => void
}

type Phase = 'idle' | 'drag' | 'fire'

export default function Lever({ label, armedLabel = 'RELEASE TO CONFIRM', disabled, onFire, onArmedChange }: LeverProps) {
  const reduced = usePrefersReducedMotion()
  const [travel, setTravel] = useState(0) // 0..1
  const [phase, setPhase] = useState<Phase>('idle')
  const [flash, setFlash] = useState(false)
  const wasArmed = useRef(false)
  const drag = useRef<{ pointerId: number; startY: number; startTravel: number } | null>(null)
  const gripRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const fireTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [width, setWidth] = useState(358)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const armed = travel >= 0.6

  useEffect(() => {
    if (armed !== wasArmed.current) {
      if (armed) navigator.vibrate?.(20)
      onArmedChange?.(armed)
    }
    wasArmed.current = armed
  }, [armed, onArmedChange])

  useEffect(() => () => fireTimers.current.forEach(clearTimeout), [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || phase === 'fire') return
      gripRef.current?.setPointerCapture(e.pointerId)
      drag.current = { pointerId: e.pointerId, startY: e.clientY, startTravel: travel }
      setPhase('drag')
    },
    [disabled, phase, travel],
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
      if (travel >= 0.6) {
        // FIRE: cylinder ignites 120ms; arcs erupt 80ms, decay 400ms.
        setPhase('fire')
        setFlash(true)
        navigator.vibrate?.(20)
        setTravel(0) // grip springs back during the discharge
        fireTimers.current.push(setTimeout(() => setFlash(false), 140))
        fireTimers.current.push(setTimeout(() => setPhase('idle'), 560))
        onFire()
      } else {
        setPhase('idle')
        setTravel(0)
      }
    },
    [travel, onFire],
  )

  const firing = phase === 'fire'
  const dragging = phase === 'drag'
  const glow = firing ? 1 : travel // cylinder emission follows the pull
  const litTicks = firing ? TICKS : Math.round(travel * TICKS)

  return (
    <div
      ref={rootRef}
      className="steel-raised bevel relative select-none overflow-hidden rounded-md"
      style={{ height: H, touchAction: 'none' }}
    >
      {/* machined inner border */}
      <div className="pointer-events-none absolute inset-2 rounded-sm" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,236,205,0.05)' }} />
      <span className="screw left-[7px] top-[7px]" style={{ ['--slot' as string]: '52deg' }} />
      <span className="screw right-[7px] top-[7px]" style={{ ['--slot' as string]: '-15deg' }} />
      <span className="screw bottom-[7px] left-[7px]" style={{ ['--slot' as string]: '8deg' }} />
      <span className="screw bottom-[7px] right-[7px]" style={{ ['--slot' as string]: '77deg' }} />
      <span className="tech-label absolute right-6 top-2 text-[8px] opacity-50">CH-01 / +1 Unit</span>

      {/* ---- tracks ---- */}
      {(['left', 'right'] as const).map((side) => (
        <div key={side} className="absolute" style={{ [side]: 18, top: 28, width: 26, height: 216 } as React.CSSProperties}>
          {/* recessed channel */}
          <div className="recess absolute inset-x-1.5 inset-y-0 rounded-full" />
          {/* engraved ticks along the outer edge, lit progressively */}
          <svg className="absolute" style={{ [side === 'left' ? 'right' : 'left']: -14, top: 8, width: 12, height: 200 } as React.CSSProperties} aria-hidden>
            {Array.from({ length: TICKS }, (_, i) => {
              const y = 4 + (i * 192) / (TICKS - 1)
              const lit = i < litTicks
              return (
                <line
                  key={i}
                  x1={side === 'left' ? 2 : 10}
                  x2={side === 'left' ? 10 : 2}
                  y1={y}
                  y2={y}
                  stroke={lit ? 'var(--color-accent)' : 'rgba(237,227,210,0.22)'}
                  strokeWidth={lit ? 2 : 1}
                  style={lit ? { filter: 'drop-shadow(0 0 3px rgba(47,217,208,0.8))' } : undefined}
                />
              )
            })}
          </svg>
        </div>
      ))}

      {/* ---- light spill behind cylinder ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: '10%',
          right: '10%',
          top: 90,
          height: 150,
          background: 'radial-gradient(50% 55% at 43% 46%, rgba(47,217,208,0.28) 0%, rgba(47,217,208,0.08) 50%, transparent 78%)',
          opacity: reduced ? (glow > 0.6 ? 0.8 : glow * 0.5) : glow * (firing ? 1 : 0.75),
          transition: firing ? 'opacity 400ms ease-out 80ms' : dragging ? 'none' : 'opacity 300ms ease-out',
        }}
      />

      {/* ---- glass cylinder (static; grip slides over it) ---- */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 118, width: '58%', height: 54 }}>
        {/* brass end collars */}
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            className="absolute top-0 h-full w-4"
            style={{
              [side]: -8,
              background: 'linear-gradient(180deg, #8a6428 0%, #d9b06a 18%, #7a5622 55%, #3a2810 100%)',
              borderRadius: 3,
              boxShadow: 'inset 1px 1px 0 rgba(255,220,160,0.4), 0 2px 3px rgba(0,0,0,0.6)',
            } as React.CSSProperties}
          />
        ))}
        {/* glass body */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[6px]"
          style={{
            background: 'linear-gradient(180deg, rgba(10,8,6,0.9) 0%, rgba(30,26,22,0.85) 45%, rgba(8,6,5,0.95) 100%)',
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,236,205,0.07)',
          }}
        >
          {/* emissive charge — brightness proportional to travel */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(47,217,208,0.18) 0%, rgba(47,217,208,0.85) 42%, rgba(200,255,252,0.95) 50%, rgba(47,217,208,0.85) 58%, rgba(47,217,208,0.2) 100%)',
              opacity: 0.06 + glow * 0.94,
              transition: firing ? 'opacity 120ms ease-out' : dragging ? 'none' : 'opacity 300ms ease-out',
            }}
          />
          {/* ignition flash */}
          <div className="absolute inset-0" style={{ background: 'var(--color-accent-hot)', opacity: flash && !reduced ? 0.75 : 0, transition: 'opacity 120ms ease-out' }} />
          {/* graduation marks on the glass */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <line key={i} x1={`${12 + i * 9.5}%`} x2={`${12 + i * 9.5}%`} y1={i % 2 ? 8 : 5} y2={14} stroke="rgba(237,227,210,0.3)" strokeWidth="1" />
            ))}
          </svg>
          {/* glass top reflection */}
          <div className="absolute inset-x-1 top-0.5 h-2 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)' }} />
        </div>
      </div>

      {/* ---- discharge arcs (posts at track tops + bottom rail) ---- */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        {/* idle arc across the bottom gap — always between its two posts */}
        <ArcBolt
          x1={38}
          y1={H - 52}
          x2={width - 38}
          y2={H - 52}
          seed={11}
          intensity={firing ? 1 : armed ? 0.9 : reduced ? 0.6 : 0.62}
          chaos={firing ? 1.4 : armed ? 1.2 : 1}
          active={!disabled && (!reduced || !firing)}
        />
        {/* corona at the bottom posts — brightest where current lands */}
        {!disabled &&
          [38, width - 38].map((cx) => (
            <g key={cx} opacity={firing ? 1 : armed ? 0.85 : 0.55}>
              <circle cx={cx} cy={H - 52} r={15} fill="var(--color-accent)" opacity={0.1} />
              <circle cx={cx} cy={H - 52} r={9} fill="var(--color-accent)" opacity={0.2} />
            </g>
          ))}
        {/* eruption along both tracks once armed, full discharge on fire */}
        {(firing || (armed && dragging)) && !reduced && (
          <>
            <ArcBolt x1={31} y1={40} x2={38} y2={H - 52} seed={23} intensity={firing ? 0.95 : 0.55 + travel * 0.3} chaos={1.6} />
            <ArcBolt x1={width - 31} y1={40} x2={width - 38} y2={H - 52} seed={31} intensity={firing ? 0.95 : 0.55 + travel * 0.3} chaos={1.6} />
          </>
        )}
        {/* track-top posts (arc endpoints during discharge) */}
        <ContactPost cx={31} cy={40} r={5} />
        <ContactPost cx={width - 31} cy={40} r={5} />
        {/* bottom contact posts */}
        <ContactPost cx={38} cy={H - 52} r={7} />
        <ContactPost cx={width - 38} cy={H - 52} r={7} />
      </svg>

      {/* ---- grip (draggable) ---- */}
      <div
        ref={gripRef}
        role="slider"
        aria-label="Award lever"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(travel * 100)}
        className="absolute inset-x-0 cursor-grab active:cursor-grabbing"
        style={{
          top: GRIP_TOP,
          height: 64,
          transform: `translateY(${travel * TRAVEL}px)`,
          transition: dragging ? 'none' : 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* brass yoke arms with pivot screws, reaching into the tracks */}
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            className="absolute top-2 h-[60px] w-[18px] rounded-[3px]"
            style={{
              [side]: 21,
              background: 'linear-gradient(90deg, #1e1408 0%, #6d5228 26%, #a67c3c 44%, #6d5228 68%, #2c2014 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,220,160,0.4), inset 0 -2px 3px rgba(0,0,0,0.55), 0 4px 6px rgba(0,0,0,0.55)',
            } as React.CSSProperties}
          >
            <span
              className="absolute left-1/2 top-[9px] h-[7px] w-[7px] -translate-x-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle at 32% 28%, #e8cf96 0%, #8a6d3e 45%, #33230d 100%)',
                boxShadow: '0 1px 1px rgba(0,0,0,0.7)',
              }}
            />
          </div>
        ))}
        {/* knurled brass bar */}
        <div
          className="absolute inset-x-10 top-0 h-12 rounded-full"
          style={{
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='48'%3E%3Cfilter id='k'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.22' numOctaves='2' seed='6' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.06 0 0 0 0 0.02 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='120' height='48' filter='url(%23k)'/%3E%3C/svg%3E\")," +
              'linear-gradient(115deg, transparent 26%, rgba(255,240,205,0.32) 33%, transparent 42%),' +
              'repeating-linear-gradient(65deg, transparent 0px, transparent 2px, rgba(0,0,0,0.42) 2px, rgba(0,0,0,0.42) 3px),' +
              'repeating-linear-gradient(-65deg, transparent 0px, transparent 2px, rgba(0,0,0,0.36) 2px, rgba(0,0,0,0.36) 3px),' +
              'linear-gradient(178deg, #34250b 0%, #8a6428 24%, #b58e50 36%, #7a5622 56%, #34250b 85%, #180f04 100%)',
            boxShadow:
              'inset 0 2px 2px rgba(255,232,190,0.5), inset 0 -3px 5px rgba(0,0,0,0.55), 0 5px 8px rgba(0,0,0,0.6), 0 12px 18px rgba(0,0,0,0.35)',
          }}
        >
          {/* end caps */}
          {(['left', 'right'] as const).map((side) => (
            <div
              key={side}
              className="absolute top-1/2 h-14 w-7 -translate-y-1/2 rounded-md"
              style={{
                [side]: -10,
                background: 'linear-gradient(180deg, #7a5a28 0%, #d9b06a 25%, #8a6428 60%, #32220e 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,220,160,0.45), inset 0 -2px 3px rgba(0,0,0,0.5), 0 3px 5px rgba(0,0,0,0.5)',
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* ---- caption: engraved, never glowing (glow is for emitters) ---- */}
      <div className="absolute inset-x-0 bottom-2.5 text-center">
        <span
          className="font-display text-[12px] font-medium uppercase"
          style={{
            letterSpacing: '0.32em',
            color: armed || firing ? 'var(--color-text)' : 'var(--color-text-dim)',
            textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,230,180,0.07)',
          }}
        >
          {'[ '}
          {armed || firing ? armedLabel : label}
          {' ]'}
        </span>
      </div>
    </div>
  )
}
