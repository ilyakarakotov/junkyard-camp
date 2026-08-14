import { useEffect, useMemo, useState } from 'react'
import TeamCrest from '../components/TeamCrest'
import { ArcBolt, ContactPost } from '../fx/Arc'
import { standings } from '../data/derive'
import { formatDeci, splitDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { Standing, Team } from '../data/types'

/**
 * The evening gathering display. 16:9, landscape, read from across a room.
 *
 * Each team is a column **built of glowing bricks, one brick per point**, with
 * a partial brick for the fraction — countable from the back of the room,
 * which a bare number is not. Keys hang from a brass rail above the columns
 * that hold them. Arcs run on the leading column only.
 *
 * Laid out at a fixed 1920x1080 and scaled to fit, so proportions are exact on
 * any projector rather than reflowing into something the design never saw.
 */

const W = 1920
const H = 1080
const COL_W = 176
const COL_GAP = 24
const BRICK_GAP = 6
/*
 * Vertical budget of the 1080 box: header to 300, stack 330..900, and 180px
 * of foot for crest + name + total. The foot has to be counted in explicitly —
 * left implicit, the totals fall off the bottom of the design box.
 */
const STACK_BOTTOM = 876
const STACK_TOP = 330
const BASE_H = 16
const STACK_H = STACK_BOTTOM - STACK_TOP

export default function BigScreen() {
  const { teams, days, events, activeDay, ready } = useStore()
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const rows = useMemo(() => standings(events, days, teams), [events, days, teams])
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const leaderTotal = rows[0]?.totalDeci ?? 0
  // One brick per point; the leader sets the scale so the tallest column fits.
  const maxBricks = Math.max(1, Math.ceil(leaderTotal / 10))
  const brickH = Math.min(46, (STACK_H - BRICK_GAP * (maxBricks - 1)) / maxBricks)

  if (!ready) return <div className="min-h-dvh" style={{ background: 'var(--color-bg)' }} />

  const totalW = rows.length * COL_W + (rows.length - 1) * COL_GAP
  const originX = (W - totalW) / 2

  return (
    /*
     * Fixed to the viewport rather than min-h-dvh: the 1080-tall child is
     * bigger than the screen, so under min-height it would stretch the
     * container to 1080 and push the foot labels below the fold. Pinned to the
     * viewport, the oversized child centres and the overflow clips evenly.
     */
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)' }}
    >
      <div
        style={{
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          position: 'relative',
          flexShrink: 0,
          background:
            'radial-gradient(120% 90% at 50% 22%, transparent 48%, rgba(0,0,0,0.6) 100%),' +
            'radial-gradient(90% 60% at 18% 0%, rgba(150,106,58,0.14) 0%, transparent 55%),' +
            'linear-gradient(180deg, #241a11 0%, #1c140d 55%, #16100a 100%)',
        }}
      >
        {/* ---- header ---- */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 54, textAlign: 'center' }}>
          <div
            className="display-title"
            style={{ fontSize: 62, letterSpacing: '0.14em', lineHeight: 1, color: 'var(--color-text)' }}
          >
            {activeDay.name}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: 'var(--font-body)',
              fontSize: 27,
              letterSpacing: '0.05em',
              color: 'var(--color-text-dim)',
            }}
          >
            {activeDay.theme}
          </div>
          <div
            style={{
              margin: '20px auto 0',
              width: 620,
              height: 1,
              background:
                'linear-gradient(90deg, transparent, rgba(192,138,62,0.55) 14%, rgba(192,138,62,0.55) 86%, transparent)',
            }}
          />
        </div>

        {/* ---- columns ---- */}
        {rows.map((row, i) => {
          const team = byId.get(row.teamId)
          if (!team) return null
          return (
            <Column
              key={row.teamId}
              row={row}
              team={team}
              x={originX + i * (COL_W + COL_GAP)}
              brickH={brickH}
            />
          )
        })}

        {/* ---- floor: the columns stand on something ---- */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: STACK_BOTTOM + BASE_H + 2,
            height: 5,
            background: 'linear-gradient(180deg, rgba(192,138,62,0.5) 0%, rgba(60,42,20,0.6) 40%, transparent 100%)',
          }}
        />
      </div>
    </div>
  )
}

function Column({ row, team, x, brickH }: { row: Standing; team: Team; x: number; brickH: number }) {
  const color = `var(--color-team-${team.colorToken})`
  const isLeader = row.rank === 1
  const base = splitDeci(row.baseDeci)

  /*
   * Base bricks first (whole ones plus a partial for the tenths), then one
   * gold brick per key — keys are always whole points, so they are always
   * full bricks. Splitting this way keeps the gold band exactly as tall as the
   * key count instead of eating into the base's fractional brick.
   */
  const bricks: { i: number; frac: number; gold: boolean }[] = []
  let idx = 0
  for (let i = 0; i < base.whole; i++) bricks.push({ i: idx++, frac: 1, gold: false })
  if (base.tenths > 0) bricks.push({ i: idx++, frac: base.tenths / 10, gold: false })
  for (let k = 0; k < row.keys; k++) bricks.push({ i: idx++, frac: 1, gold: true })

  return (
    <>
      {/* ---- key rail above the column, only if this team holds keys ---- */}
      {row.keys > 0 && <KeyHanger x={x} keys={row.keys} />}

      {/* ---- the stack: one brick per point, growing upward ---- */}
      {bricks.map(({ i, frac, gold }) => {
        const h = brickH * frac
        const bottom = H - STACK_BOTTOM + i * (brickH + BRICK_GAP)
        const fill = gold ? 'var(--color-key)' : color
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              bottom,
              width: COL_W,
              height: h,
              borderRadius: 3,
              background: `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, ${fill} 26%, ${fill} 62%, rgba(0,0,0,0.45) 100%)`,
              // Tight spill: the bricks must stay individually countable from
              // the back of the room, and a wide bloom merges them into a bar.
              boxShadow: `inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.55), 0 0 13px ${fill}`,
              opacity: frac < 1 ? 0.92 : 1,
            }}
          />
        )
      })}

      {/* base plate: the column stands on something, so bricks can be counted
          from a visible baseline instead of running under the label band */}
      <div
        style={{
          position: 'absolute',
          left: x - 8,
          top: STACK_BOTTOM + 2,
          width: COL_W + 16,
          height: BASE_H,
          borderRadius: 3,
          background:
            'repeating-linear-gradient(90deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 9px),' +
            'linear-gradient(180deg, #e2c383 0%, #b3823c 24%, #6b4a1d 70%, #2a1c0a 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,244,214,0.65), inset 0 -2px 3px rgba(0,0,0,0.6), 0 4px 7px rgba(0,0,0,0.6)',
        }}
      />

      {/* empty capacity above the stack, so a short column still reads as a column */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: STACK_TOP,
          width: COL_W,
          height: STACK_BOTTOM - STACK_TOP,
          borderRadius: 4,
          boxShadow: 'inset 0 0 0 1px rgba(237,227,210,0.07)',
          pointerEvents: 'none',
        }}
      />

      {/* ---- leading column only: current jumps between two brass posts ---- */}
      {isLeader && (
        <svg
          style={{
            position: 'absolute',
            left: x - 22,
            top: STACK_BOTTOM - bricks.length * (brickH + BRICK_GAP) - 40,
            width: COL_W + 44,
            height: 60,
            overflow: 'visible',
          }}
          aria-hidden
        >
          <ArcBolt x1={16} y1={30} x2={COL_W + 28} y2={30} seed={13} intensity={0.95} chaos={1.2} weight={1.5} strands={2} />
          <ContactPost cx={16} cy={30} r={10} />
          <ContactPost cx={COL_W + 28} cy={30} r={10} />
        </svg>
      )}

      {/* ---- foot: crest, name, total ---- */}
      <div style={{ position: 'absolute', left: x, top: STACK_BOTTOM + BASE_H + 12, width: COL_W, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TeamCrest teamId={team.id} size={42} glow={isLeader ? 1 : 0} />
        </div>
        <div
          className="font-display"
          style={{
            marginTop: 6,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color,
            whiteSpace: 'nowrap',
          }}
        >
          {team.shortName}
        </div>
        <div
          className="numeral"
          style={{ marginTop: 0, fontSize: 42, lineHeight: 1.05, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatDeci(row.totalDeci)}
        </div>
      </div>
    </>
  )
}

/** Keys hang from a brass rail above the column that holds them. */
function KeyHanger({ x, keys }: { x: number; keys: number }) {
  const drawn = Math.min(keys, 4)
  const overflow = keys - drawn
  const pitch = 44
  const railY = STACK_TOP - 96
  return (
    <svg
      style={{ position: 'absolute', left: x - 10, top: railY - 16, width: COL_W + 20, height: 112, overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`bs-rail-${x}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2c383" />
          <stop offset="26%" stopColor="#b3823c" />
          <stop offset="72%" stopColor="#6b4a1d" />
          <stop offset="100%" stopColor="#2a1c0a" />
        </linearGradient>
        <linearGradient id={`bs-key-${x}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#fffdf2" />
          <stop offset="26%" stopColor="var(--color-key-hot)" />
          <stop offset="62%" stopColor="var(--color-key)" />
          <stop offset="100%" stopColor="#8a5606" />
        </linearGradient>
      </defs>
      {/* the rail */}
      <rect x={0} y={9} width={COL_W + 20} height={11} rx={3.5} fill={`url(#bs-rail-${x})`} />
      <rect x={0} y={9} width={COL_W + 20} height={2.4} fill="rgba(255,244,214,0.7)" />
      <rect x={0} y={19} width={COL_W + 20} height={2} fill="rgba(0,0,0,0.45)" />
      {Array.from({ length: drawn }, (_, i) => {
        const kx = COL_W / 2 + 10 + (i - (drawn - 1) / 2) * pitch
        return (
          <g key={i} transform={`translate(${kx} 15) scale(2.3)`}>
            {/* gold spilling onto the rail and the metal behind it */}
            <circle cx="0" cy="9" r="15" fill="var(--color-key)" opacity="0.12" />
            <circle cx="0" cy="6" r="9" fill="var(--color-key)" opacity="0.16" />
            <path d="M0 0 L0 5.4" stroke="#c9a15a" strokeWidth="1.8" strokeLinecap="round" />
            <g fill={`url(#bs-key-${x})`} stroke="rgba(90,54,6,0.6)" strokeWidth="0.5">
              <circle cx="0" cy="9" r="4.2" />
              <rect x="-1.15" y="11.8" width="2.3" height="13.6" rx="0.6" />
              <rect x="0.95" y="18.8" width="3.3" height="2.1" rx="0.4" />
              <rect x="0.95" y="22.6" width="4.3" height="2.2" rx="0.4" />
            </g>
            <circle cx="0" cy="9" r="1.8" fill="#4a2f04" />
            <path d="M-3.3 7.6 A4.2 4.2 0 0 1 -1 5" fill="none" stroke="rgba(255,252,238,0.95)" strokeWidth="0.8" strokeLinecap="round" />
          </g>
        )
      })}
      {overflow > 0 && (
        <text
          x={COL_W / 2 + 10 + ((drawn - 1) / 2) * pitch + 26}
          y={38}
          className="numeral"
          fontFamily="var(--font-display)"
          fontSize="34"
          fontWeight="600"
          fill="var(--color-key)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          +{overflow}
        </text>
      )}
    </svg>
  )
}
