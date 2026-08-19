import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArcBolt, usePrefersReducedMotion } from '../fx/Arc'
import { GlassTube, Plate, Screw } from './chrome'

/**
 * The commit lever. It does not increment anything — it commits the whole
 * column: toggle the eight teams in roll call, pull once, everything lands
 * together.
 *
 * MATERIAL FIRST. At rest (reference 02) this is the warmest, brightest object
 * on the screen: a brass plate carrying two bright brass rails, a raised gauge
 * sub-plate outboard of each rail with a screw top and bottom and the tick
 * column engraved between them, a knurled brass grip at the top of the travel
 * and a glass tube across the mid-track with a thin teal filament idling inside
 * it. "No teams selected" is expressed by the pointer handler returning early —
 * it is NEVER expressed by desaturating the metal, which is what made the bottom
 * third of the screen read blue-grey.
 *
 * GEOMETRY IS THE POINT. The tube sits at the exact midpoint of the grip's
 * travel. Rest = grip above the tube with empty rail below it; fired = grip
 * below the tube with empty rail above, seated on the footing casting. The grip
 * visibly crosses the gap and closes the circuit.
 *
 *    REST                        FIRED
 *      ALL ····· 3 QUEUED          CLEAR ····· 3 COMMITTED  <- brass top margin
 *    |=▓▓▓▓▓▓▓=| <- grip at top  |=░░░░░░░=| <- rail empty above
 *    |·        | ticks dark      |·        | ticks ignited amber
 *    |-o=====o-| <- tube idling  |-o##### o-| <- tube erupts, branches to rails
 *    |·        |                 |·        |
 *    |=░░░░░░░=|                 |=▓▓▓▓▓▓▓=| <- grip seated on the footing
 *    [ PULL TO COMMIT ]          [ PULL TO COMMIT ]
 *
 * Interaction: drag tracks the finger 1:1 with no easing; >=60% travel arms it
 * (navigator.vibrate(20)); releasing while armed fires. Release below the
 * threshold springs back on cubic-bezier(0.34, 1.56, 0.64, 1) over 400ms.
 * On trigger the grip snaps to the base and STAYS SEATED through the commit
 * beat before returning. Only transform and opacity animate.
 */

const H = 236
/** Plain brass margin across the top of the housing, above the recess. */
const TOP_MARGIN = 30
const TRACK_TOP = 34
const TRACK_BOTTOM = 200
const TRACK_H = TRACK_BOTTOM - TRACK_TOP // 166
const GRIP_H = 26
const GRIP_TOP = TRACK_TOP + 4 // 38
const FOOT_TOP = 200
const FOOT_H = 30
const GRIP_FIRED_TOP = FOOT_TOP - GRIP_H - 8 // 166
const TRAVEL = GRIP_FIRED_TOP - GRIP_TOP // 128
/** Exact midpoint between the resting grip's underside and its seated top. */
const TUBE_Y = (GRIP_TOP + GRIP_H + GRIP_FIRED_TOP) / 2 // 115
/**
 * Rail centre, measured off `02-rollcall-rest.jpg`: the guide rails sit at
 * device x 200 and 880 of 1080, i.e. 72 CSS in from each screen edge — 59 in
 * the housing plate's own coordinates. The rails are well INBOARD of the tick
 * gauges, and the gap between the two is plain housing.
 */
const RAIL_CX = 59
/**
 * Rail width. In the reference the guides are chunky bright brass rods — the
 * brightest verticals in the housing — with a fine engraved dash column down
 * the centre. At 9px with a 3.5px dash strip they read as dotted lines.
 */
const RAIL_W = 12
/** The tick gauge column, engraved straight into the housing near its edge. */
const GAUGE_X = 5
const GAUGE_W = 27
/**
 * The glass. Measured off the reference: the bore runs device x 350..735 of
 * 1080 — 139 CSS — with a turned brass collar about 19 CSS at each end, so the
 * whole tube is 177 CSS and there is a real 34px gap of brass electrode rod
 * between each collar and its rail. The build used to run the glass rail to
 * rail (a 228px bore), which is why it read as a teal slab rather than a lamp.
 */
const TUBE_COLLAR = 38
const TUBE_INSET = 34
const TUBE_H = 28
const ARM_THRESHOLD = 0.6

/** How long the grip stays seated at the base before returning. */
const SEAT_HOLD_MS = 520
const RETURN_MS = 400

export interface LeverProps {
  label?: string
  /**
   * Caption while armed or seated. Defaults to `label`: reference 03 still
   * reads `PULL TO COMMIT` at full discharge, and a caption that swaps under
   * the finger reads as a web button rather than an engraved nameplate.
   */
  armedLabel?: string
  /** Drives the queued-count readout and the disabled state. */
  pendingCount?: number
  disabled?: boolean
  onFire: () => void
  onArmedChange?: (armed: boolean) => void
  /** True for the whole discharge beat, so the screen above can rim-light. */
  onDischarge?: (active: boolean) => void
  /**
   * Contents of the housing's top brass margin. Roll call fills it with the
   * select-all tab and the queued / undo readout; left empty it shows the
   * default channel label so the part still reads on the bench.
   */
  groove?: ReactNode
}

type Phase = 'idle' | 'drag' | 'seated' | 'return'

/**
 * The engraved tick column down a gauge sub-plate. Dark engravings at rest;
 * on discharge they ignite to `--color-lamp-hot` with the bloom the reference
 * shows — nearly half the ignited column reads as near-white amber there.
 */
function Ticks({ lit, flip = false }: { lit: boolean; flip?: boolean }) {
  const rows = 29
  /* Two stacked columns — dark engravings and ignited amber — cross-faded on
     OPACITY. Transitioning `background` or `filter` would repaint 29 elements a
     frame, which is exactly what the motion contract forbids. */
  const column = (on: boolean) => (
    <span
      aria-hidden
      className="absolute inset-0 flex flex-col justify-between"
      style={{
        alignItems: flip ? 'flex-end' : 'flex-start',
        filter: on
          ? 'drop-shadow(0 0 4px var(--color-lamp)) drop-shadow(0 0 9px rgba(237,144,64,0.55))'
          : undefined,
        opacity: on ? (lit ? 1 : 0) : 1,
        transition: 'opacity 150ms ease-out',
      }}
    >
      {Array.from({ length: rows }, (_, i) => {
        const major = i % 5 === 0
        return (
          <span
            key={i}
            style={{
              display: 'block',
              width: major ? 13 : 8,
              height: on ? (major ? 2.5 : 2) : major ? 2 : 1.5,
              borderRadius: 0.5,
              background: on ? (major ? '#fff6dd' : 'var(--color-lamp-hot)') : '#20160e',
              boxShadow: on
                ? '0 0 3px 0.5px rgba(254,223,151,0.9)'
                : '0 1px 0 rgba(255,240,206,0.42)',
            }}
          />
        )
      })}
    </span>
  )
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute block"
      style={{
        left: flip ? undefined : GAUGE_X + 11,
        right: flip ? GAUGE_X + 11 : undefined,
        top: TRACK_TOP + 4,
        width: 13,
        height: TRACK_H - 12,
      }}
    >
      {column(false)}
      {column(true)}
    </span>
  )
}

export default function Lever({
  label = 'PULL TO COMMIT',
  armedLabel,
  pendingCount,
  disabled,
  onFire,
  onArmedChange,
  onDischarge,
  groove,
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
  const [width, setWidth] = useState(354)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  /**
   * `dead` gates INTERACTION only. Nothing visual may read it: the reference's
   * resting state has nothing selected and is still full brass.
   */
  const dead = Boolean(disabled) || pendingCount === 0
  const armed = travel >= ARM_THRESHOLD
  const dragging = phase === 'drag'
  const seated = phase === 'seated'

  useEffect(() => {
    if (armed !== wasArmed.current) {
      if (armed) navigator.vibrate?.(20)
      onArmedChange?.(armed)
    }
    wasArmed.current = armed
  }, [armed, onArmedChange])

  useEffect(() => {
    onDischarge?.(seated)
  }, [seated, onDischarge])

  const fire = useCallback(() => {
    // Seat hard at the base and HOLD through the commit beat.
    setPhase('seated')
    setTravel(1)
    setFlash(true)
    navigator.vibrate?.(20)
    onFire()
    timers.current.push(setTimeout(() => setFlash(false), 170))
    timers.current.push(
      setTimeout(() => {
        setPhase('return')
        setTravel(0)
      }, SEAT_HOLD_MS),
    )
    timers.current.push(setTimeout(() => setPhase('idle'), SEAT_HOLD_MS + RETURN_MS))
  }, [onFire])

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
      if (travel >= ARM_THRESHOLD) fire()
      else {
        setPhase('idle')
        setTravel(0)
      }
    },
    [travel, fire],
  )

  /** Keyboard: the lever is a slider, so arrows and Enter both throw it. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (dead || phase === 'seated' || phase === 'return') return
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setTravel((t) => Math.min(1, t + 0.25))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setTravel((t) => Math.max(0, t - 0.25))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        fire()
      }
    },
    [dead, phase, fire],
  )

  // The tube's emission follows the pull, then goes full on discharge.
  const glow = seated ? 1 : phase === 'return' ? 0.3 : travel
  const storm = (seated || (armed && dragging)) && !reduced
  /** The blown-out core: full at seat, already present under an armed finger. */
  const core = seated ? 1 : armed && dragging && !reduced ? 0.72 : 0
  const litTicks = seated || armed

  const gripTransform = `translateY(${travel * TRAVEL}px)`
  const gripTransition = dragging
    ? 'none'
    : seated
      ? 'transform 110ms cubic-bezier(0.25, 0.8, 0.35, 1)'
      : `transform ${RETURN_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`

  const railL = RAIL_CX
  const railR = width - RAIL_CX
  const tubeL = railL + TUBE_INSET
  const tubeR = railR - TUBE_INSET
  const boreL = tubeL + TUBE_COLLAR / 2
  const boreR = tubeR - TUBE_COLLAR / 2
  /** The glass bore's own width — the idle filament is clipped to it. */
  const boreW = tubeR - tubeL - TUBE_COLLAR
  const postTopY = TRACK_TOP + 7 // 39 — exposed the moment the grip travels down
  const postBotY = TRACK_BOTTOM + 2 // 202 — the rail's end collar, landing on the yoke pad
  /** The travelling grip's boss: the arc's lower contact post, as in 03. */
  const bossY = GRIP_TOP + GRIP_H / 2 + travel * TRAVEL
  /**
   * The engraved nameplate. Reference 02 and 03 both read `PULL TO COMMIT`, and
   * they are the two states where nothing is queued — so the plain caption is
   * what the references show. While teams ARE queued the plate also engraves the
   * load, which is the one piece of state a leader needs before pulling.
   */
  const caption =
    (armed || seated ? (armedLabel ?? label) : label).toUpperCase() +
    (pendingCount ? ` · ${pendingCount} TEAM${pendingCount === 1 ? '' : 'S'}` : '')
  const queued =
    pendingCount === undefined || pendingCount === 0
      ? 'CH-01 · COMMIT'
      : `${pendingCount} TEAM${pendingCount === 1 ? '' : 'S'} QUEUED`

  /**
   * A rail: a slim machined bar with the reference's engraved dash column down
   * its centre, a hard contact shadow to its right, and a turned brass collar
   * at each end. Those two collars are the arc's visible contact posts.
   */
  const rail = (cx: number) => (
    <span key={cx} aria-hidden className="pointer-events-none">
      {/* contact shadow the bar throws onto the housing, one light, top left */}
      <span
        className="absolute"
        style={{
          left: cx - RAIL_W / 2 + 3,
          top: TRACK_TOP + 2,
          width: RAIL_W,
          height: TRACK_H,
          borderRadius: 9999,
          background: 'rgba(16,9,3,0.5)',
          filter: 'blur(2px)',
        }}
      />
      {/* the machined brass bar itself */}
      <span
        className="absolute"
        style={{
          left: cx - RAIL_W / 2,
          top: TRACK_TOP,
          width: RAIL_W,
          height: TRACK_H,
          borderRadius: 9999,
          background:
            'repeating-linear-gradient(180deg, rgba(46,29,10,0.42) 0 2.5px, transparent 2.5px 9px),' +
            'linear-gradient(90deg, #2f2009 0%, #8a6428 13%, #f7e6bb 32%, #cfa860 46%, #8e6b30 66%, #4a3416 85%, #201502 100%)',
          backgroundSize: '3px 100%, 100% 100%',
          backgroundPosition: 'center top, 0 0',
          backgroundRepeat: 'no-repeat, no-repeat',
          boxShadow:
            'inset 0 1px 0 rgba(255,244,220,0.6), inset 0 -1px 0 rgba(24,13,5,0.6), 0 2px 4px rgba(0,0,0,0.6)',
        }}
      />
      {/* discharge: the rail is one of the arc's two contact posts, so it glows */}
      <span
        className="absolute"
        style={{
          left: cx - RAIL_W / 2 - 1,
          top: TRACK_TOP - 1,
          width: RAIL_W + 2,
          height: TRACK_H + 2,
          borderRadius: 9999,
          boxShadow:
            '0 0 9px 1px rgba(47,217,208,0.85), 0 0 24px 6px rgba(47,217,208,0.4), inset 0 0 6px rgba(210,255,252,0.8)',
          opacity: storm ? 1 : 0,
          transition: 'opacity 150ms ease-out',
        }}
      />
      {/* the upper brass contact post: a turned collar capping the bar. Its
          twin at the foot is drawn with the footing so it lands ON the yoke. */}
      {[postTopY].map((cy) => (
        <span
          key={cy}
          className="absolute"
          style={{
            left: cx - 11,
            top: cy - 8,
            width: 22,
            height: 16,
            borderRadius: 4,
            background:
              'repeating-linear-gradient(90deg, rgba(34,20,6,0.3) 0 1px, transparent 1px 4px),' +
              'linear-gradient(180deg, #f9e6b4 0%, #a37e45 24%, #7a5a26 56%, #46310f 84%, #221607 100%)',
            boxShadow:
              'inset 1px 1px 0 rgba(255,246,220,0.8), inset -1px -1px 1px rgba(24,13,5,0.6), 0 2px 3px rgba(0,0,0,0.6)',
          }}
        />
      ))}
    </span>
  )

  /**
   * A raised gauge sub-plate, one outboard of each rail. In the reference this
   * is what carries the housing's screws and the engraved tick column, which is
   * what makes the gauge read as part of the mechanism rather than as marks
   * floating on the wall.
   */
  const gaugePlate = (flip: boolean) => (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        [flip ? 'right' : 'left']: GAUGE_X,
        top: TOP_MARGIN - 4,
        width: GAUGE_W,
        bottom: 6,
        borderRadius: 5,
        /* Sampled either side of the reference's tick column at y 1700: #3c2a1e
           / #39281e / #2a1b14 — L31–46, the SAME value as the housing interior.
           There is no bright raised panel there; the gauge is engraved straight
           into the recess, and rendering it as a lit sub-plate was adding a
           large bright area the reference does not have. */
        background:
          'linear-gradient(180deg, #4a3624 0%, #453221 22%, #402e1f 56%, #38281b 82%, #2c1f15 100%)',
        boxShadow:
          'inset 1px 1px 0 rgba(255,238,208,0.13), inset -1px -1px 0 rgba(22,12,4,0.5),' +
          '0 1px 0 rgba(255,240,210,0.08)',
      }}
    />
  )

  return (
    <div ref={rootRef} className="relative" style={{ height: H }}>
      <Plate chamfer={12} style={{ position: 'absolute', inset: 0 }}>
        {/* the housing interior is a RECESS the mechanism travels in. Its lower
            half falls a long way into shadow — measured on the reference, the
            housing goes #8f7451 just under the top margin to #412c1f at the
            footing, and that falloff is most of the screen's dark mass */}
        <span
          aria-hidden
          className="grain pointer-events-none absolute"
          style={{
            left: 4,
            right: 4,
            top: TOP_MARGIN,
            bottom: 4,
            borderRadius: 4,
            background:
              'linear-gradient(180deg, #2f2215 0%, #3e2d1c 13%, #4a3521 32%, #533c25 54%,' +
              '#4b3622 74%, #3c2b1a 90%, #322317 100%)',
            boxShadow:
              'inset 2px 3px 8px rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,238,208,0.1),' +
              '0 1px 0 rgba(255,244,220,0.16)',
          }}
        />
        {/* rust creeping out of the recess's lower corners and down the guides */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 4,
            right: 4,
            top: TOP_MARGIN,
            bottom: 4,
            borderRadius: 4,
            background:
              'radial-gradient(64% 34% at 6% 100%, rgba(122,60,26,0.5) 0%, transparent 70%),' +
              'radial-gradient(64% 34% at 94% 100%, rgba(122,60,26,0.44) 0%, transparent 70%),' +
              'radial-gradient(26% 46% at 14% 76%, rgba(122,60,26,0.3) 0%, transparent 72%),' +
              'radial-gradient(26% 46% at 86% 70%, rgba(122,60,26,0.26) 0%, transparent 72%),' +
              'linear-gradient(0deg, rgba(20,10,4,0.42) 0%, transparent 22%)',
          }}
        />
        {/*
          THE DISCHARGE BATHES ITS OWN HOUSING. The plate the tube is bolted to
          is the nearest surface to the emitter, so it has to be the brightest
          thing the light lands on — sampled in reference 03 the housing goes
          #36251b (L40) to #4c6859 (L97) at the upper interior and #423022 (L51)
          to #4c8a7d (L124) at the lower, i.e. the whole recess turns teal-green
          edge to edge. Lighting the row plates above while leaving the emitter's
          own plate brown is physically backwards, and it is what made the build
          read as a local bloom rather than a discharge.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 4,
            right: 4,
            top: TOP_MARGIN,
            bottom: 4,
            borderRadius: 4,
            background:
              `radial-gradient(86% 74% at 50% ${(((TUBE_Y - TOP_MARGIN) / (H - TOP_MARGIN - 4)) * 100).toFixed(1)}%,` +
              'rgba(168,246,234,0.3) 0%, rgba(120,224,210,0.25) 22%, rgba(88,200,186,0.18) 44%,' +
              'rgba(76,178,166,0.1) 66%, rgba(70,158,148,0.05) 84%, rgba(68,140,132,0.02) 100%)',
            opacity: storm ? (seated ? 1 : 0.55) : 0,
            transition: 'opacity 160ms ease-out',
          }}
        />
        {/* the key light along the housing's top chamfer */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 16,
            right: 28,
            top: 1.5,
            height: 2,
            borderRadius: 1,
            background:
              'linear-gradient(90deg, rgba(255,242,214,0.95) 0%, rgba(255,238,211,0.24) 32%,' +
              'rgba(255,238,211,0.7) 54%, rgba(255,238,211,0.12) 78%, transparent 100%)',
          }}
        />

        {/* ---- the housing's top brass margin: hardware tabs on metal ---- */}
        <div
          className="absolute flex items-center"
          style={{ left: 22, right: 22, top: 2, height: 24, gap: 8 }}
        >
          {groove ?? (
            <>
              <span className="flex-1" />
              <span className="engraved tech-label text-[8px]">{queued}</span>
            </>
          )}
        </div>
        {/* the engraved seam where the top margin meets the recess */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: 10,
            right: 10,
            top: TOP_MARGIN - 3,
            height: 2,
            background: 'linear-gradient(180deg, rgba(20,11,4,0.6) 0 1px, rgba(255,244,220,0.22) 1px 2px)',
          }}
        />

        {/* ---- gauge sub-plates: screws top and bottom, ticks between ---- */}
        {gaugePlate(false)}
        {gaugePlate(true)}
        {[
          { slot: 38, style: { left: GAUGE_X + GAUGE_W / 2 - 4.5, top: TOP_MARGIN + 5 } },
          { slot: -24, style: { right: GAUGE_X + GAUGE_W / 2 - 4.5, top: TOP_MARGIN + 5 } },
          { slot: 71, style: { left: GAUGE_X + GAUGE_W / 2 - 4.5, bottom: 13 } },
          { slot: 12, style: { right: GAUGE_X + GAUGE_W / 2 - 4.5, bottom: 13 } },
        ].map(({ slot, style }, i) => (
          <span key={i} aria-hidden className="absolute block" style={{ width: 9, height: 9, ...style }}>
            <Screw slot={slot} size={9} />
          </span>
        ))}
        <Ticks lit={litTicks} />
        <Ticks lit={litTicks} flip />

        {/* ---- two full-height brass rails ---- */}
        {[railL, railR].map(rail)}

        {/* ---- discharge bloom: stacked, and only ever an emitter's own light ---- */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: TUBE_Y,
            width: 320,
            height: 240,
            marginLeft: -160,
            marginTop: -120,
            zIndex: 2,
            background:
              'radial-gradient(closest-side, rgba(47,217,208,0.3) 0%, rgba(47,217,208,0.14) 34%, rgba(47,217,208,0.04) 62%, transparent 80%)',
            opacity: storm ? (seated ? 1 : 0.55) : 0,
            transform: `scale(${storm ? 1 : 0.7})`,
            transition: 'opacity 150ms ease-out, transform 220ms ease-out',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: railL - 30,
            width: railR - railL + 60,
            top: TUBE_Y - 62,
            height: 124,
            zIndex: 2,
            background:
              'radial-gradient(58% 46% at 50% 50%, rgba(226,255,253,0.5) 0%, rgba(47,217,208,0.28) 34%, rgba(47,217,208,0.08) 62%, transparent 84%)',
            opacity: storm ? (seated ? 1 : 0.5) : 0,
            transition: 'opacity 150ms ease-out',
          }}
        />

        {/*
          THE IDLE FILAMENT'S OWN SPILL. Glow has to be motivated, and the test
          of a motivated glow is that it measurably lifts the metal beside it.
          Scanned down the reference's resting housing at x=560 the plate goes
          #4b3f2f (L64, warm: R>G>B) at 11 CSS above the glass to #515850
          (L86, GREEN: G>R) right at its edge, and #2a2e28 below it — the tube
          is throwing light on its own plate before anything is pulled. The
          build's read #473421 above and #4a3623 below: warm, flat, identical
          to the housing 40px away, i.e. a lamp lighting nothing.

          It sits UNDER the tube (same zIndex, earlier sibling) so the dark bore
          still reads over it, and it rides `glow` up into the discharge.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute block"
          style={{
            left: boreL - 30,
            width: boreR - boreL + 60,
            top: TUBE_Y - 52,
            height: 104,
            zIndex: 2,
            /* The falloff has to still be carrying weight at 14–20 CSS out —
               that is the first metal the glass does not cover, and it is the
               only place the spill is visible at all. */
            background:
              'radial-gradient(58% 50% at 50% 50%, rgba(126,228,219,0.34) 0%,' +
              'rgba(120,222,213,0.3) 26%, rgba(104,208,200,0.2) 54%,' +
              'rgba(88,190,182,0.1) 74%, rgba(78,172,165,0.03) 90%, transparent 100%)',
            opacity: 0.5 + glow * 0.5,
            transition: seated ? 'opacity 110ms ease-out' : dragging ? 'none' : 'opacity 300ms ease-out',
          }}
        />

        {/* ---- the emitter: the shared glass tube across the mid-track ---- */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: tubeL, width: tubeR - tubeL, top: TUBE_Y - TUBE_H / 2, zIndex: 2 }}
        >
          <GlassTube height={TUBE_H} collarWidth={TUBE_COLLAR}>
            {/* GLASS, not a teal slab. A vertical scan down the reference's
                resting bore reads #4d4f42 / #3d4641 / #3a453f — a DESATURATED
                grey-green cylinder at L43–77 (R and B within ~15 of each other)
                with a wall specular near the top, and a single thin filament
                sample at L105. The teal belongs to the filament and its bloom,
                never to the bore. */}
            <span
              className="absolute inset-0 block"
              style={{
                background:
                  /* the cylinder's own shading */
                  'linear-gradient(180deg, rgba(78,86,76,0.5) 0%, rgba(120,132,116,0.6) 12%,' +
                  'rgba(72,80,72,0.4) 30%, rgba(52,60,54,0.34) 58%,' +
                  'rgba(64,72,64,0.4) 84%, rgba(48,56,50,0.44) 100%),' +
                  /* ...and the bore falls to near-black at BOTH ends, where the
                     electrodes are. In the reference the glass is only lit near
                     the filament; a bore lifted end to end reads as a painted
                     slab rather than as something you can see into. */
                  'linear-gradient(90deg, rgba(6,5,4,0.85) 0%, rgba(6,5,4,0.5) 12%,' +
                  'rgba(6,5,4,0.12) 30%, rgba(6,5,4,0) 50%, rgba(6,5,4,0.12) 70%,' +
                  'rgba(6,5,4,0.5) 88%, rgba(6,5,4,0.85) 100%)',
              }}
            />
            {/* the filament's own light inside the bore. At rest this is a hint
                — the reference's resting glass is DARK. It only fills the bore
                once the pull is under way. */}
            <span
              className="absolute inset-0 block"
              style={{
                background:
                  'linear-gradient(180deg, rgba(47,217,208,0.05) 0%, rgba(47,217,208,0.45) 40%,' +
                  'rgba(240,255,254,0.98) 50%, rgba(47,217,208,0.45) 60%, rgba(47,217,208,0.06) 100%)',
                opacity: 0.05 + glow * 0.95,
                transition: seated ? 'opacity 110ms ease-out' : dragging ? 'none' : 'opacity 300ms ease-out',
              }}
            />
            {/* the electrodes: brass rods entering the bore from each collar.
                The reference has them, and they are what the filament strikes
                between — without them the arc inside the lamp terminates on
                nothing, which is the same failure as an arc without posts. */}
            {[0, 1].map((i) => (
              <span
                key={i}
                className="absolute block"
                style={{
                  [i ? 'right' : 'left']: 0,
                  top: TUBE_H / 2 - 4.5,
                  width: 26,
                  height: 9,
                  borderRadius: i ? '4px 0 0 4px' : '0 4px 4px 0',
                  background:
                    'linear-gradient(180deg, #9c8259 0%, #c3a475 22%, #7d6540 58%, #3a2c19 88%, #1d160c 100%)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.7)',
                }}
              />
            ))}
            {/* the filament itself, drawn INSIDE the glass so the bore clips
                it: an arc that spikes out past its own tube reads as a stray
                scribble rather than as current running in a sealed lamp */}
            <svg className="absolute inset-0 h-full w-full" aria-hidden>
              <ArcBolt
                x1={26}
                y1={TUBE_H / 2}
                x2={boreW - 26}
                y2={TUBE_H / 2}
                seed={11}
                intensity={seated ? 1 : armed ? 0.95 : 0.46}
                chaos={seated ? 1.5 : armed ? 1.25 : 0.42}
                /* At rest the reference's filament is a HAIRLINE — one thin
                   teal squiggle whose brightest sample is L105 in a bore that
                   sits at L45. A weight of 1 draws an 18px bloom in a 28px
                   bore, which is what turned the resting tube into a bar. */
                weight={seated ? 1.4 : armed ? 1.15 : 0.32}
                strands={seated ? 3 : armed ? 2 : 1}
                active={!reduced}
              />
            </svg>
            {/* ignition flash */}
            <span
              className="absolute inset-0 block"
              style={{
                background: 'var(--color-accent-hot)',
                opacity: flash && !reduced ? 0.92 : 0,
                transition: 'opacity 140ms ease-out',
              }}
            />
          </GlassTube>
        </div>
        {/* the electrode rods: solid brass bar running from each rail sleeve in
            to the tube's end collar. The reference has them, and they are what
            makes the glass read as a lamp WIRED INTO the machine rather than a
            capsule floating between the guides. */}
        {[
          { l: railL, r: tubeL + 3 },
          { l: tubeR - 3, r: railR },
        ].map(({ l, r }) => (
          <span
            key={`rod-${l}`}
            aria-hidden
            className="pointer-events-none absolute block"
            style={{
              left: l,
              width: r - l,
              top: TUBE_Y - 5,
              height: 10,
              borderRadius: 2,
              zIndex: 2,
              background:
                'linear-gradient(180deg, #e7d0a0 0%, #b28c4c 26%, #7c5c2c 62%, #402c11 88%, #1e1206 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,248,222,0.8), 0 2px 4px rgba(0,0,0,0.6)',
            }}
          />
        ))}
        {/* the turned sleeve that clamps each electrode onto its rail — one of
            the arc's two visible brass contact posts at this height */}
        {[railL, railR].map((cx) => (
          <span
            key={`boss-${cx}`}
            aria-hidden
            className="pointer-events-none absolute block"
            style={{
              left: cx - 9,
              top: TUBE_Y - TUBE_H / 2 - 6,
              width: 18,
              height: TUBE_H + 12,
              borderRadius: 7,
              zIndex: 2,
              background:
                'linear-gradient(180deg, #241708 0%, #a3814a 7%, #fceecb 16%, #b58f4c 34%,' +
                '#856632 62%, #4d3716 86%, #1e1306 100%)',
              boxShadow:
                'inset 1px 1px 0 rgba(255,248,222,0.9), inset -1px -1px 1px rgba(24,13,5,0.6), 0 2px 5px rgba(0,0,0,0.65)',
            }}
          />
        ))}

        {/* A SMOOTH turned collar over each end of the glass. The shared
            GlassTube ribs its collars at a 4px pitch, which at this size reads
            as corrugation rather than as a machined ring; the reference's are
            plain turned brass with one bright band and a dark shoulder. */}
        {[tubeL, tubeR].map((cx, i) => (
          <span
            key={`collar-${cx}`}
            aria-hidden
            className="pointer-events-none absolute block"
            style={{
              left: cx - (i === 0 ? TUBE_COLLAR / 2 : TUBE_COLLAR / 2),
              top: TUBE_Y - TUBE_H / 2 - 4,
              width: TUBE_COLLAR,
              height: TUBE_H + 8,
              borderRadius: 4,
              zIndex: 2,
              background:
                'linear-gradient(180deg, #2a1c0a 0%, #a3814a 7%, #fdf1ce 15%, #b9944f 30%,' +
                '#8a6a36 54%, #543c19 80%, #241708 100%)',
              boxShadow:
                'inset 1px 0 0 rgba(255,246,220,0.5), inset -1px 0 0 rgba(24,13,5,0.5),' +
                '0 2px 4px rgba(0,0,0,0.6)',
            }}
          />
        ))}

        {/* the blown-out core, under the bolts so the strands read across it */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: TUBE_Y,
            width: 236,
            height: 150,
            marginLeft: -118,
            marginTop: -75,
            zIndex: 2,
            background:
              'radial-gradient(50% 32% at 50% 50%, #ffffff 0%, #ffffff 18%, rgba(244,255,254,0.8) 38%,' +
              'rgba(47,217,208,0.38) 62%, transparent 86%)',
            opacity: core,
            transform: `scale(${seated ? 1 : 0.62})`,
            transition: 'opacity 120ms ease-out, transform 200ms ease-out',
          }}
        />
        {/* ---- arcs: every bolt lands on a brass collar at both ends ---- */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden style={{ zIndex: 2 }}>
          {/* full discharge: branches jump from the tube to both rails */}
          {storm && (
            <>
              <ArcBolt x1={boreL + 26} y1={TUBE_Y} x2={railL} y2={postTopY} seed={23} intensity={seated ? 1 : 0.8} chaos={1.9} strands={2} weight={1.15} />
              <ArcBolt x1={boreR - 26} y1={TUBE_Y} x2={railR} y2={postTopY} seed={31} intensity={seated ? 1 : 0.8} chaos={1.9} strands={2} weight={1.15} />
              <ArcBolt x1={boreL + 26} y1={TUBE_Y} x2={railL} y2={bossY} seed={57} intensity={seated ? 0.95 : 0.7} chaos={1.8} strands={2} weight={1.05} />
              <ArcBolt x1={boreR - 26} y1={TUBE_Y} x2={railR} y2={bossY} seed={71} intensity={seated ? 0.95 : 0.7} chaos={1.8} strands={2} weight={1.05} />
              <ArcBolt x1={boreL} y1={TUBE_Y} x2={railL} y2={TUBE_Y - 44} seed={97} intensity={seated ? 0.8 : 0.5} chaos={2.1} strands={1} />
              <ArcBolt x1={boreR} y1={TUBE_Y} x2={railR} y2={TUBE_Y + 44} seed={13} intensity={seated ? 0.8 : 0.5} chaos={2.1} strands={1} />
              {[
                [railL, postTopY],
                [railR, postTopY],
              ].map(([cx, cy]) => (
                <g key={`${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r={13} fill="var(--color-accent)" opacity={0.2} />
                  <circle cx={cx} cy={cy} r={3.4} fill="#eafffd" opacity={0.85} />
                </g>
              ))}
            </>
          )}
        </svg>

        {/*
          The contact point itself: the arc's core, blown past white. It sits
          ON TOP of the bolts — in reference 03 the tube's centre is a hard white
          hole with the strands radiating out of it, not teal laid over white.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: TUBE_Y,
            width: 152,
            height: 52,
            marginLeft: -76,
            marginTop: -26,
            borderRadius: 9999,
            zIndex: 2,
            background:
              'radial-gradient(54% 44% at 50% 50%, #ffffff 0%, #ffffff 40%, rgba(255,255,255,0.72) 62%,' +
              'rgba(226,255,253,0.3) 80%, transparent 94%)',
            opacity: core,
            transition: 'opacity 110ms ease-out',
          }}
        />

        {/* the glass cylinder's own edges, drawn over the discharge: reference 03
            keeps the tube readable THROUGH the blowout, and a white hole with no
            tube around it is a flare rather than a lamp.
            It is CLIPPED TO THE BORE. It used to run 4px past each end and, as a
            later sibling than the collar overdraw, painted a pale line straight
            across each collar's brass face — the collar caps the glass, so
            nothing of the glass may cross it. And the ring is graded: a glass
            cylinder is bright along its top and dark along its underside, never
            one uniform outline all the way round. */}
        <span
          aria-hidden
          className="pointer-events-none absolute block"
          style={{
            left: boreL,
            width: boreR - boreL,
            top: TUBE_Y - TUBE_H / 2,
            height: TUBE_H,
            borderRadius: 9999,
            zIndex: 2,
            boxShadow: storm
              ? 'inset 0 2px 0 rgba(255,252,240,0.9), inset 0 1px 3px rgba(255,250,235,0.3),' +
                'inset 0 -1.5px 0 rgba(150,232,226,0.5), inset 0 -3px 4px rgba(26,15,7,0.3)'
              : 'inset 0 2px 0 rgba(255,252,240,0.85), inset 0 1px 3px rgba(255,250,235,0.28),' +
                'inset 0 -1.5px 0 rgba(58,36,20,0.7), inset 0 -3px 4px rgba(26,15,7,0.45)',
            opacity: storm ? 1 : 0.34,
            transition: 'opacity 150ms ease-out',
          }}
        />

        {/* ---- grip: knurled brass bar on two small round bosses ---- */}
        <div
          ref={gripRef}
          role="slider"
          tabIndex={dead ? -1 : 0}
          aria-label="Commit lever"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(travel * 100)}
          aria-disabled={dead}
          className={dead ? 'absolute inset-x-0' : 'absolute inset-x-0 cursor-grab active:cursor-grabbing'}
          style={{
            top: GRIP_TOP,
            height: GRIP_H,
            zIndex: 3,
            transform: gripTransform,
            transition: gripTransition,
            willChange: 'transform',
            /* Pointer capture does not stop the browser from scrolling: the
               first vertical move fires pointercancel and kills the pull
               unless the grip itself claims the gesture. */
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          {/* Knurled bar spanning the rails, its ends clamped by the bosses.
              The shared `.knurl` runs a 4px pitch, which at a 26px bar reads as
              a diamond-quilted pill rather than a machined cylinder: measured
              off the reference the mesh is ~1.35 CSS between crossings, roughly
              3.5x finer. Overridden here rather than in theme.css because this
              is the only part in the app at this diameter.
              The mesh is also multiplied by the bar's OWN cylindrical shading —
              a real knurl darkens as the cylinder turns away from the light, so
              the pattern fades into the lower third instead of tiling flat. */}
          <span
            aria-hidden
            className="knurl absolute block"
            style={{
              /* the knurl runs BETWEEN the collar blocks: in the reference the
                 knurled texture starts at CSS 95 and ends at 272 in plate
                 coordinates, inboard of both rails */
              left: RAIL_CX + 22,
              right: RAIL_CX + 22,
              top: 1,
              height: GRIP_H - 2,
              borderRadius: 9999,
              background:
                /* The cylinder's shading, over the mesh: the specular band sits
                   a third of the way down, not as a rim line on the top edge.
                   Scanned down the reference's grip (x=515) the face reads
                   L 122 · 143 · 105 · 57 · 47 by fifths; the build's read
                   148 · 192 · 141 · 89 · 55 — thirty stops hot across a bar
                   that is 178 CSS wide, which is the single largest pale area
                   in the housing. The shade below closes that, and the
                   specular's own alpha comes down with it so the peak stays a
                   highlight rather than becoming the bar's average. */
                'linear-gradient(180deg, rgba(28,16,6,0.44) 0%, rgba(28,16,6,0.24) 16%,' +
                'rgba(255,246,214,0.1) 32%, rgba(28,16,6,0.2) 46%,' +
                'rgba(28,16,6,0.42) 70%, rgba(24,13,5,0.7) 100%),' +
                /* the mesh itself */
                'repeating-linear-gradient(62deg, rgba(255,240,200,0.24) 0 0.6px,' +
                'rgba(46,30,12,0.38) 0.6px 1px, transparent 1px 1.6px),' +
                'repeating-linear-gradient(-62deg, rgba(255,240,200,0.2) 0 0.6px,' +
                'rgba(46,30,12,0.36) 0.6px 1px, transparent 1px 1.6px),' +
                'linear-gradient(180deg, #d9bc8c 0%, var(--color-knurl) 34%, #8a7048 74%, #5d4728 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,246,220,0.4), inset 0 -4px 5px rgba(24,13,5,0.42), 0 5px 8px rgba(0,0,0,0.55), 0 12px 18px rgba(0,0,0,0.3)',
            }}
          />
          {/* the key light running along the bar, a third of the way down its
              face — where a cylinder's specular actually lands */}
          <span
            aria-hidden
            className="pointer-events-none absolute block"
            style={{
              left: RAIL_CX + 32,
              right: RAIL_CX + 36,
              top: 5.5,
              height: 6,
              borderRadius: 3,
              /* the specular is a soft BAND on a turned cylinder, so it is
                 masked to nothing at both of its own edges — a hard 2px bar is
                 a painted line, and painted lines are what read as artwork */
              maskImage: 'linear-gradient(180deg, transparent 0%, #000 50%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 50%, transparent 100%)',
              background:
                'linear-gradient(90deg, rgba(255,248,224,0.62) 0%, rgba(255,244,214,0.2) 26%,' +
                'rgba(255,246,220,0.44) 48%, rgba(255,240,206,0.09) 74%, rgba(255,244,214,0.18) 100%)',
            }}
          />
          {/* the two turned collar blocks that ride the rails */}
          {[railL, railR].map((cx, i) => (
            <span
              key={cx}
              aria-hidden
              className="absolute block"
              style={{
                /* the reference's grip ends in a chunky collar BLOCK straddling
                   the rail (device x 180–280 of 1080), not a slim boss. It
                   overhangs INBOARD, toward the knurl it caps. */
                left: i === 0 ? cx - 9 : cx - 21,
                top: 1,
                width: 30,
                height: GRIP_H - 2,
                borderRadius: 11,
                background:
                  'linear-gradient(180deg, #fff1ca 0%, #c69f60 14%, #9b7439 44%,' +
                  '#74562a 70%, #3f2c12 90%, #221608 100%)',
                boxShadow:
                  'inset 1px 1px 0 rgba(255,246,220,0.75), inset -1px -1px 1px rgba(24,13,5,0.6), 0 3px 5px rgba(0,0,0,0.6)',
              }}
            >
              {/* the current arriving: the boss is one of the arc's two brass
                  contact posts, so it takes the light rather than painting it */}
              <span
                className="absolute rounded-full"
                style={{
                  inset: -1,
                  boxShadow:
                    '0 0 8px 1px rgba(140,255,249,0.9), 0 0 20px 5px rgba(47,217,208,0.5),' +
                    'inset 0 0 5px rgba(214,255,252,0.8)',
                  opacity: storm ? 1 : 0,
                  transition: 'opacity 140ms ease-out',
                }}
              />
              {/* the arc's landing point on the boss, blown white */}
              <span
                className="absolute block rounded-full"
                style={{
                  left: 4,
                  right: 4,
                  top: '50%',
                  height: 6,
                  marginTop: -3,
                  background: 'radial-gradient(circle at 40% 34%, #ffffff 0%, #d8fffb 55%, rgba(47,217,208,0) 100%)',
                  opacity: storm ? 1 : 0,
                  transition: 'opacity 140ms ease-out',
                }}
              />
            </span>
          ))}
        </div>

        {/* ---- footing: one stepped brass casting with a recessed nameplate ---- */}
        {/* the plinth the whole mechanism stands on */}
        <span
          aria-hidden
          className="absolute block"
          style={{
            left: GAUGE_X + GAUGE_W + 4,
            right: GAUGE_X + GAUGE_W + 4,
            top: FOOT_TOP + 4,
            height: FOOT_H - 4,
            borderRadius: 4,
            background:
              'linear-gradient(180deg, #f6e0ad 0%, #ac8a52 10%, #86673a 42%, #614824 76%, #33220e 100%)',
            boxShadow:
              'inset 1px 1px 0 rgba(255,248,224,0.85), inset -1px -2px 0 rgba(24,13,5,0.6), 0 3px 5px rgba(0,0,0,0.6)',
          }}
        />
        {/* raised yoke pads where the rails land — the casting steps up here */}
        {[railL, railR].map((cx) => (
          <span
            key={cx}
            aria-hidden
            className="absolute block"
            style={{
              left: cx - 24,
              top: FOOT_TOP,
              width: 48,
              height: FOOT_H,
              borderRadius: 5,
              background:
                'linear-gradient(180deg, #fdeec0 0%, #b8955a 12%, #8e7040 46%, #674b28 78%, #35240f 100%)',
              boxShadow:
                'inset 1px 1px 0 rgba(255,250,230,0.9), inset -1px -2px 0 rgba(24,13,5,0.6), 0 3px 6px rgba(0,0,0,0.6)',
            }}
          />
        ))}
        {/* the two little feet the casting stands on */}
        {[railL, railR].map((cx) => (
          <span
            key={`foot-${cx}`}
            aria-hidden
            className="absolute block"
            style={{
              left: cx - 9,
              top: FOOT_TOP + FOOT_H - 2,
              width: 18,
              height: 5,
              borderRadius: '0 0 4px 4px',
              background: 'linear-gradient(180deg, #a3814a 0%, #61461f 60%, #2a1c0a 100%)',
              boxShadow: '0 2px 3px rgba(0,0,0,0.6)',
            }}
          />
        ))}
        {/* the rails' lower end collars, landing ON the yoke pads. These are the
            arc's second pair of visible brass contact posts, so they are drawn
            after the footing and stay in the clear when the grip is seated. */}
        {[railL, railR].map((cx) => (
          <span
            key={`post-${cx}`}
            aria-hidden
            className="absolute block"
            style={{
              left: cx - 12,
              top: postBotY - 8,
              width: 24,
              height: 17,
              borderRadius: 4,
              background:
                'repeating-linear-gradient(90deg, rgba(34,20,6,0.3) 0 1px, transparent 1px 4px),' +
                'linear-gradient(180deg, #fbe9b8 0%, #ab8449 24%, #7a5a26 58%, #46310f 84%, #221607 100%)',
              boxShadow:
                'inset 1px 1px 0 rgba(255,246,220,0.85), inset -1px -1px 1px rgba(24,13,5,0.6), 0 2px 3px rgba(0,0,0,0.6)',
            }}
          />
        ))}
        {/* The nameplate is a RAISED plaque, not a trough. In the reference the
            footing is one continuous brass casting with a plaque struck proud of
            it — brighter than its surround, notched corners, a rivet at each end,
            and the letters engraved dark INTO the bright face. The build had the
            polarity inverted, which read as two feet with a slot between them. */}
        <span
          className="absolute flex items-center justify-center"
          style={{
            left: railL + 30,
            right: railL + 30,
            top: FOOT_TOP + 7,
            height: FOOT_H - 14,
            borderRadius: 2,
            clipPath:
              'polygon(3px 0, calc(100% - 3px) 0, 100% 3px, 100% calc(100% - 3px),' +
              'calc(100% - 3px) 100%, 3px 100%, 0 calc(100% - 3px), 0 3px)',
            background:
              'linear-gradient(180deg, #f5dfae 0%, #c2a468 14%, #9d8050 46%, #7f6339 78%, #5c4423 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,252,236,0.95), inset 0 -1px 0 rgba(60,38,14,0.45),' +
              '0 2px 3px rgba(24,13,4,0.6)',
          }}
        >
          <span
            aria-hidden
            className="rivet absolute"
            style={{ left: 4, top: '50%', marginTop: -2.5 }}
          />
          <span
            className="engraved font-display font-semibold uppercase"
            style={{ fontSize: 10.5, letterSpacing: '0.14em', lineHeight: 1 }}
          >
            {caption}
          </span>
          <span
            aria-hidden
            className="rivet absolute"
            style={{ right: 4, top: '50%', marginTop: -2.5 }}
          />
        </span>

        {/*
          The wall's own falloff toward the bezel, carried HERE rather than by
          the screen-level vignette. The screen vignette paints over everything
          below it, and at this height it multiplies by 0.867 — enough to cap the
          blown tube core at #dfdfde and make the biggest beat in the app read as
          a grey lamp. So roll call lifts the whole lever above that layer and
          the housing takes its share of the vignette from the inside, on a layer
          the emitter stack (zIndex 2) and the grip (zIndex 3) paint over.
          Alphas match what the screen vignette measured over this box: ~0.03 at
          the top centre, 0.34 at the bottom centre, 0.47 in the bottom corners.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(12,7,2,0.03) 0%, rgba(12,7,2,0.09) 34%,' +
              'rgba(12,7,2,0.2) 72%, rgba(12,7,2,0.34) 100%),' +
              'radial-gradient(112% 128% at 50% -6%, transparent 58%,' +
              'rgba(11,6,2,0.08) 82%, rgba(11,6,2,0.15) 100%)',
          }}
        />
      </Plate>
    </div>
  )
}
