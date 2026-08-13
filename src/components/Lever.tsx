import { useCallback, useEffect, useRef, useState } from 'react'
import { ArcBolt, ContactPost, usePrefersReducedMotion } from '../fx/Arc'

/**
 * The award lever. Composed from layers (never a flat image):
 * housing → tracks (recessed, engraved ticks) → contact posts → glass
 * cylinder (emissive on pull) → knurled roller in cast-bronze yokes
 * (draggable) → arcs → light spill.
 *
 * Interaction: drag down 1:1 with the finger; ≥60% travel arms it
 * (navigator.vibrate(20)); releasing while armed fires. Release below the
 * threshold springs back with cubic-bezier(0.34, 1.56, 0.64, 1) over 400ms.
 * Only transform/opacity animate.
 */

const H = 296 // housing height
const TRAVEL = 118 // px of grip travel
const GRIP_TOP = 42
const HANDLE_H = 54
const TICKS = 11
const TRACK_TOP = 30
const TRACK_H = 214

export interface LeverProps {
  label: string
  armedLabel?: string
  disabled?: boolean
  onFire: () => void
  /** Fires when the 60% arm threshold is crossed either way. */
  onArmedChange?: (armed: boolean) => void
}

type Phase = 'idle' | 'drag' | 'fire'

/**
 * Tall stacked brass post: flange → base drum → neck → domed cap.
 * The arc anchors on the dome, `capY` above the base line.
 */
function LeverPost({ cx, baseY, id }: { cx: number; baseY: number; id: string }) {
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
      {/* contact shadow on the deck */}
      <ellipse cx={cx + 2} cy={baseY + 1} rx={16} ry={5} fill="rgba(0,0,0,0.55)" />
      {/* base flange */}
      <ellipse cx={cx} cy={baseY - 2} rx={14} ry={5} fill={`url(#${id}-drum)`} stroke="#170e04" strokeWidth="0.7" />
      {/* base drum */}
      <rect x={cx - 10} y={baseY - 15} width={20} height={13} fill={`url(#${id}-drum)`} />
      <ellipse cx={cx} cy={baseY - 15} rx={10} ry={3.6} fill={`url(#${id}-drum)`} stroke="#170e04" strokeWidth="0.6" />
      {/* neck */}
      <rect x={cx - 6} y={baseY - 29} width={12} height={15} fill={`url(#${id}-drum)`} />
      {/* domed cap — the arc lands here */}
      <circle cx={cx} cy={baseY - 30} r={7} fill={`url(#${id}-dome)`} stroke="#170e04" strokeWidth="0.6" />
      <circle cx={cx - 2.2} cy={baseY - 32.4} r={1.6} fill="#fff3d8" opacity="0.85" />
    </g>
  )
}

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
  const storm = (firing || (armed && dragging)) && !reduced

  // Shared geometry (all px from measured width).
  const handleL = Math.round(width * 0.19) // knurled roller left edge
  const yokeL = handleL - 9 // yoke strap centerline over the dome cap
  const yokeR = width - handleL + 9
  const postX = 46
  const postCapY = H - 68 // dome center of the bottom posts
  const trackCx = 33 // track slot centerline
  const trackTopY = 36
  const collarY = 154 // cylinder collar height (arc contact)
  const collarL = Math.round(width * 0.24)
  const collarR = Math.round(width * 0.76)

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
        <div key={side} className="absolute" style={{ [side]: 20, top: TRACK_TOP, width: 26, height: TRACK_H } as React.CSSProperties}>
          {/* recessed channel */}
          <div className="recess absolute inset-x-1.5 inset-y-0 rounded-full" />
          {/* teal charge wash inside the slot as the pull deepens */}
          <div
            className="absolute inset-x-1.5 inset-y-0 rounded-full"
            style={{
              background: 'linear-gradient(180deg, rgba(47,217,208,0.05) 0%, rgba(47,217,208,0.3) 70%, rgba(47,217,208,0.45) 100%)',
              opacity: reduced ? (glow > 0.6 ? 0.7 : 0) : glow,
              transition: dragging ? 'none' : 'opacity 300ms ease-out',
            }}
          />
          {/* engraved ticks along the inner edge, lit progressively */}
          <svg className="absolute" style={{ [side === 'left' ? 'right' : 'left']: -14, top: 8, width: 12, height: TRACK_H - 16 } as React.CSSProperties} aria-hidden>
            {Array.from({ length: TICKS }, (_, i) => {
              const y = 4 + (i * (TRACK_H - 24)) / (TICKS - 1)
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
            {/* arm-threshold marker: small triangle at 60% travel */}
            <path
              d={
                side === 'left'
                  ? `M2 ${4 + (TRACK_H - 24) * 0.6 - 4} L9 ${4 + (TRACK_H - 24) * 0.6} L2 ${4 + (TRACK_H - 24) * 0.6 + 4} Z`
                  : `M10 ${4 + (TRACK_H - 24) * 0.6 - 4} L3 ${4 + (TRACK_H - 24) * 0.6} L10 ${4 + (TRACK_H - 24) * 0.6 + 4} Z`
              }
              fill={armed || firing ? 'var(--color-accent)' : 'rgba(192,138,62,0.55)'}
              style={armed || firing ? { filter: 'drop-shadow(0 0 3px rgba(47,217,208,0.8))' } : undefined}
            />
          </svg>
        </div>
      ))}

      {/* ---- light spill behind cylinder ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: '8%',
          right: '8%',
          top: 84,
          height: 164,
          background: 'radial-gradient(52% 55% at 45% 46%, rgba(47,217,208,0.3) 0%, rgba(47,217,208,0.09) 50%, transparent 78%)',
          opacity: reduced ? (glow > 0.6 ? 0.8 : glow * 0.5) : glow * (firing ? 1 : 0.75),
          transition: firing ? 'opacity 400ms ease-out 80ms' : dragging ? 'none' : 'opacity 300ms ease-out',
        }}
      />

      {/* ---- glass cylinder (static; grip slides over it) ---- */}
      <div className="absolute" style={{ left: '24%', right: '24%', top: 128, height: 52 }}>
        {/* ribbed brass end collars */}
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            className="absolute -top-[3px] h-[58px] w-[15px]"
            style={{
              [side]: -12,
              background:
                'repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 4px),' +
                'linear-gradient(180deg, #8a6428 0%, #d9b06a 18%, #7a5622 55%, #2c1d0a 100%)',
              borderRadius: 3,
              boxShadow: 'inset 1px 1px 0 rgba(255,220,160,0.4), inset -1px -1px 1px rgba(0,0,0,0.5), 0 3px 4px rgba(0,0,0,0.6)',
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
        {/* bottom gap — always between its two posts; splits into strands as the storm builds */}
        <ArcBolt
          x1={postX}
          y1={postCapY}
          x2={width - postX}
          y2={postCapY}
          seed={11}
          intensity={firing ? 1 : armed ? 0.92 : reduced ? 0.65 : 0.72}
          chaos={firing ? 1.5 : armed ? 1.25 : 1}
          weight={firing ? 1.2 : 1.05}
          strands={firing ? 3 : armed ? 2 : 1}
          active={!disabled && (!reduced || !firing)}
        />
        {/* corona at the bottom posts — brightest where current lands */}
        {!disabled &&
          [postX, width - postX].map((cx) => (
            <g key={cx} opacity={firing ? 1 : armed ? 0.9 : 0.55}>
              <circle cx={cx} cy={postCapY} r={16} fill="var(--color-accent)" opacity={0.1} />
              <circle cx={cx} cy={postCapY} r={9} fill="var(--color-accent)" opacity={0.22} />
              {(armed || firing) && <circle cx={cx} cy={postCapY - 1} r={3.4} fill="#eafffd" opacity={0.7} />}
            </g>
          ))}
        {/* full storm: climbers up both tracks, diagonals crossing the cylinder, collar licks */}
        {storm && (
          <>
            {/* climbers: bottom post → track-top post */}
            <ArcBolt x1={postX} y1={postCapY} x2={trackCx} y2={trackTopY} seed={23} intensity={firing ? 0.95 : 0.6 + travel * 0.3} chaos={1.7} strands={2} />
            <ArcBolt x1={width - postX} y1={postCapY} x2={width - trackCx} y2={trackTopY} seed={31} intensity={firing ? 0.95 : 0.6 + travel * 0.3} chaos={1.7} strands={2} />
            {/* long diagonals: track-top post → opposite bottom post, crossing over the cylinder */}
            <ArcBolt x1={trackCx} y1={trackTopY} x2={width - postX} y2={postCapY} seed={57} intensity={firing ? 0.7 : 0.5} chaos={1.5} weight={0.85} />
            <ArcBolt x1={width - trackCx} y1={trackTopY} x2={postX} y2={postCapY} seed={63} intensity={firing ? 0.7 : 0.5} chaos={1.5} weight={0.85} />
            {/* short licks: cylinder collar → nearest bottom post */}
            <ArcBolt x1={collarL} y1={collarY} x2={postX} y2={postCapY} seed={71} intensity={firing ? 0.85 : 0.65} chaos={1.8} weight={0.8} />
            <ArcBolt x1={collarR} y1={collarY} x2={width - postX} y2={postCapY} seed={73} intensity={firing ? 0.85 : 0.65} chaos={1.8} weight={0.8} />
            {/* coronas at the track-top posts while current climbs */}
            {[trackCx, width - trackCx].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy={trackTopY} r={12} fill="var(--color-accent)" opacity={0.14} />
                <circle cx={cx} cy={trackTopY - 1} r={3} fill="#eafffd" opacity={0.65} />
              </g>
            ))}
          </>
        )}
        {/* track-top posts (arc endpoints during discharge) */}
        <ContactPost cx={trackCx} cy={trackTopY} r={5} />
        <ContactPost cx={width - trackCx} cy={trackTopY} r={5} />
        {/* bottom contact posts — tall stacked brass */}
        <LeverPost cx={postX} baseY={H - 38} id="lv-pl" />
        <LeverPost cx={width - postX} baseY={H - 38} id="lv-pr" />
      </svg>

      {/* ---- grip (draggable): knurled roller held by cast-bronze yokes ---- */}
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
          height: 88,
          transform: `translateY(${travel * TRAVEL}px)`,
          transition: dragging ? 'none' : 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* knurled brass roller */}
        <div
          className="absolute top-0 rounded-full"
          style={{
            left: handleL,
            right: handleL,
            height: HANDLE_H,
            background:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='54'%3E%3Cfilter id='k'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.22' numOctaves='2' seed='6' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.06 0 0 0 0 0.02 0 0 0 0.45 0'/%3E%3C/filter%3E%3Crect width='120' height='54' filter='url(%23k)'/%3E%3C/svg%3E\")," +
              // cylinder end falloff: darker toward both ends of the roller
              'linear-gradient(90deg, rgba(0,0,0,0.45) 0%, transparent 9%, transparent 91%, rgba(0,0,0,0.45) 100%),' +
              // embossed diamond knurl: dark cut + adjacent lit ridge, both directions
              'repeating-linear-gradient(62deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 2px, rgba(255,238,196,0.16) 2px, rgba(255,238,196,0.16) 3px, transparent 3px, transparent 4.5px),' +
              'repeating-linear-gradient(-62deg, rgba(0,0,0,0.44) 0px, rgba(0,0,0,0.44) 1px, transparent 1px, transparent 2px, rgba(255,238,196,0.13) 2px, rgba(255,238,196,0.13) 3px, transparent 3px, transparent 4.5px),' +
              // roller shading: key light lands on the upper third
              'linear-gradient(178deg, #1c1206 0%, #6d5228 13%, #c89a58 27%, #e8c584 34%, #a87f42 50%, #5d4319 72%, #241708 90%, #120a03 100%)',
            boxShadow:
              'inset 0 2px 2px rgba(255,232,190,0.5), inset 0 -4px 6px rgba(0,0,0,0.6), 0 6px 9px rgba(0,0,0,0.6), 0 14px 20px rgba(0,0,0,0.35)',
          }}
        >
          {/* smooth collar rings between the knurl and the dome caps */}
          {(['left', 'right'] as const).map((side) => (
            <div
              key={side}
              className="absolute top-[2px] h-[calc(100%-4px)] w-[9px]"
              style={{
                [side]: 1,
                borderRadius: side === 'left' ? '9999px 2px 2px 9999px' : '2px 9999px 9999px 2px',
                background: 'linear-gradient(178deg, #241708 0%, #8a6b32 16%, #e2c084 34%, #96733a 55%, #3c2a10 82%, #170e04 100%)',
                boxShadow: side === 'left' ? 'inset -1.5px 0 1px rgba(0,0,0,0.55), inset 1px 0 0 rgba(255,232,190,0.3)' : 'inset 1.5px 0 1px rgba(0,0,0,0.55), inset -1px 0 0 rgba(255,232,190,0.3)',
              } as React.CSSProperties}
            />
          ))}
        </div>
        {/* domed end caps beyond the collars */}
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            className="absolute rounded-full"
            style={{
              [side]: handleL - 21,
              top: 4,
              width: 26,
              height: HANDLE_H - 8,
              background: 'radial-gradient(circle at 35% 28%, #f6e3b0 0%, #c08a3e 38%, #6d4a1e 72%, #1d1206 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.5), inset 0 -3px 4px rgba(0,0,0,0.55), 0 4px 6px rgba(0,0,0,0.55)',
            } as React.CSSProperties}
          />
        ))}
        {/* cast-bronze yokes clamp the caps and hang down to pivot feet */}
        <svg className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
          <defs>
            <linearGradient id="lv-yoke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#170e04" />
              <stop offset="30%" stopColor="#6d5228" />
              <stop offset="48%" stopColor="#b08648" />
              <stop offset="72%" stopColor="#5d431c" />
              <stop offset="100%" stopColor="#241505" />
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
            return (
              <g key={s}>
                {/* occlusion where the boss sits over the dome cap */}
                <circle cx={cx + 2} cy={axisY + 3} r={14} fill="rgba(0,0,0,0.4)" />
                {/* strap: leans slightly outboard on its way down to the foot */}
                <g transform={`rotate(${s * 6} ${cx} ${axisY})`}>
                  <rect x={cx - 8} y={axisY - 4} width={16} height={56} rx={7.5} fill="url(#lv-yoke)" stroke="#120a03" strokeWidth="0.8" />
                  {/* cast edge highlight along the lit side */}
                  <rect x={cx - 5.5} y={axisY} width={2} height={46} rx={1} fill="rgba(255,232,190,0.24)" />
                </g>
                {/* foot bolt at the strap's lower end */}
                <circle cx={cx + s * 5} cy={axisY + 47} r={4.6} fill="url(#lv-bolt)" stroke="#120a03" strokeWidth="0.7" />
                {/* top boss with pivot screw, clamping the dome cap */}
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
