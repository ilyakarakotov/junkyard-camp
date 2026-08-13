import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { teamTotals } from '../data/derive'
import { TEAM_HEX } from '../components/TeamCrest'
import { Barcode } from '../components/chrome'
import { ArcBolt, ContactPost, usePrefersReducedMotion } from '../fx/Arc'

const SCALE_MAX = 3000
const TICKS = [0, 500, 1000, 1500, 2000, 2500, 3000]

/** One vertical gauge column: scale, framed tube, emissive fill, name + score plates. */
function GaugeColumn({
  name,
  hex,
  points,
  lead,
}: {
  name: string
  hex: string
  points: number
  lead: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const frac = Math.min(1, points / SCALE_MAX)
  const fmt = new Intl.NumberFormat('en-US')
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameH, setFrameH] = useState(400)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFrameH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col items-center">
      <div className="flex min-h-0 w-full flex-1 items-stretch justify-center gap-1.5">
        {/* scale */}
        <div className="relative w-10 shrink-0">
          {TICKS.map((v) => {
            const y = 100 - (v / SCALE_MAX) * 100
            return (
              <div key={v} className="absolute right-0 flex translate-y-[-50%] items-center gap-1" style={{ top: `${y}%` }}>
                <span className="numeral text-[11px] leading-none" style={{ color: 'var(--color-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt.format(v)}
                </span>
                <span className="h-[2px] w-3" style={{ background: 'rgba(138,122,104,0.75)' }} />
              </div>
            )
          })}
          {/* minor ticks every 100 units */}
          {Array.from({ length: 31 }, (_, i) => (
            <span key={i} className="absolute right-0 h-px w-1.5" style={{ top: `${(i / 30) * 100}%`, background: 'rgba(138,122,104,0.45)' }} />
          ))}
        </div>

        {/* framed tube with head/foot castings */}
        <div
          ref={frameRef}
          className="relative h-full w-[68px] shrink-0 rounded-[6px] px-[7px] py-[10px]"
          style={{
            background: 'linear-gradient(135deg, #7d5f30 0%, #4a3418 30%, #33230d 70%, #221606 100%)',
            boxShadow: `inset 2px 2px 0 rgba(255,232,190,0.35), inset -2px -2px 0 rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.3)${lead ? `, 0 0 26px ${hex}33` : ''}`,
          }}
        >
          {/* head + foot castings */}
          {(['top', 'bottom'] as const).map((edge) => (
            <div
              key={edge}
              className="absolute inset-x-[-4px] h-[9px] rounded-[3px]"
              style={{
                [edge]: -2,
                background: 'linear-gradient(180deg, #b98d4a 0%, #7a5622 55%, #3a2810 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.5), 0 2px 3px rgba(0,0,0,0.6)',
              } as React.CSSProperties}
            />
          ))}
          {/* LEADING plate rides the top of the leader's tube frame */}
          {lead && (
            <div className="absolute -top-9 left-1/2 z-20 -translate-x-1/2" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.7))' }}>
              <div
                className="px-3 py-[3px]"
                style={{
                  background: 'linear-gradient(180deg, #d9b06a 0%, #b3823c 30%, #7a5622 78%, #4a3414 100%)',
                  borderRadius: 2,
                  boxShadow: 'inset 0 1.5px 0 rgba(255,232,190,0.75), inset 0 -2px 2px rgba(0,0,0,0.5)',
                }}
              >
                <span className="whitespace-nowrap font-display text-[13px] font-bold uppercase" style={{ letterSpacing: '0.26em', color: '#2b1a06' }}>
                  Leading
                </span>
              </div>
            </div>
          )}
          {/* frame screws */}
          {[8, -8].map((x) => (
            <span key={x} className="screw" style={{ [x > 0 ? 'left' : 'right']: 2, top: -3, transform: 'scale(0.8)' } as React.CSSProperties} />
          ))}
          {/* leader posts on the frame's top corners + arcs down the sides */}
          {lead && (
            <svg className="absolute -top-2 left-0 z-10 w-full" style={{ overflow: 'visible', height: frameH + 8 }} aria-hidden>
              <ArcBolt x1={4} y1={8} x2={4} y2={frameH - 6} seed={51} intensity={0.85} chaos={1.1} active={!reduced} weight={1.1} />
              <ArcBolt x1={64} y1={8} x2={64} y2={frameH - 6} seed={53} intensity={0.8} chaos={1.1} active={!reduced} weight={1.1} />
              {[
                [4, 8],
                [64, 8],
                [4, frameH - 6],
                [64, frameH - 6],
              ].map(([cx, cy]) => (
                <g key={`${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r={13} fill="var(--color-accent)" opacity={0.12} />
                  <ContactPost cx={cx} cy={cy} r={6} />
                </g>
              ))}
            </svg>
          )}
          {/* glass interior */}
          <div
            className="relative h-full w-full overflow-hidden rounded-[3px]"
            style={{
              background: 'linear-gradient(180deg, #0b0806 0%, #14100b 55%, #090604 100%)',
              boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.9), inset 0 -1px 0 rgba(255,236,205,0.05)',
            }}
          >
            {/* emissive liquid — spills onto the rails, strongest near the meniscus */}
            <div
              className="absolute inset-x-[3px] bottom-[3px] rounded-[2px]"
              style={{
                height: `calc(${frac * 100}% - 3px)`,
                background: `linear-gradient(90deg, ${hex}66 0%, ${hex} 30%, ${hex}ee 55%, ${hex}77 100%)`,
                boxShadow: `0 0 22px ${hex}${lead ? 'cc' : '88'}, 0 -6px 18px ${hex}55, inset 0 0 12px rgba(255,255,255,0.18)`,
              }}
            />
            {/* meniscus: near-white core wrapped in team-color bloom */}
            <div
              className="absolute inset-x-[2px] h-[2px] rounded-full"
              style={{
                bottom: `calc(${frac * 100}% - 1px)`,
                background: `linear-gradient(90deg, ${hex} 0%, #ffffff 30%, #ffffff 70%, ${hex} 100%)`,
                opacity: 0.95,
                boxShadow: `0 0 6px ${hex}, 0 0 16px ${hex}, 0 0 30px ${hex}66`,
              }}
            />
            {/* glass reflections */}
            <div className="absolute inset-y-2 left-[4px] w-[4px] rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.18), transparent)' }} />
          </div>
        </div>
      </div>

      {/* name + score plates */}
      <div className="z-10 mt-2.5 flex w-full max-w-[150px] flex-col items-stretch gap-1.5">
        <div
          className="flex h-9 items-center justify-center rounded-[3px]"
          style={{
            background: 'linear-gradient(180deg, #2c231b 0%, #241c16 60%, #1c1510 100%)',
            boxShadow: 'inset 1px 1px 0 rgba(255,236,205,0.14), inset -1px -1px 0 rgba(0,0,0,0.6), 0 3px 5px rgba(0,0,0,0.55)',
          }}
        >
          <span className="display-title text-[17px] font-bold leading-none" style={{ letterSpacing: '0.06em' }}>
            {name}
          </span>
        </div>
        <div
          className="flex h-11 items-center justify-center rounded-[3px]"
          style={{
            background: 'linear-gradient(180deg, #1b140f 0%, #120d08 100%)',
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.8), inset -1px -1px 0 rgba(255,236,205,0.05), 0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          <span
            className="numeral text-[27px] font-bold leading-none"
            style={{ color: hex, textShadow: `0 0 2px ${hex}99, 0 0 10px ${hex}55, 0 1px 1px rgba(0,0,0,0.7)` }}
          >
            {fmt.format(points)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function BigScreen() {
  const { teams, events, ready } = useStore()
  if (!ready) return null

  const totals = teamTotals(events, teams.map((t) => t.id))
  const byTeam = new Map(totals.map((t) => [t.teamId, t]))

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden px-10 pb-6 pt-5">
      {/* outer console frame */}
      <div className="pointer-events-none absolute inset-3 rounded-[6px]" style={{ boxShadow: 'inset 0 0 0 2px rgba(74,59,46,0.55), inset 0 0 0 3px rgba(0,0,0,0.5), inset 3px 3px 1px rgba(255,236,205,0.06)' }} aria-hidden />
      {/* corner brackets */}
      {(['left-4 top-4', 'right-4 top-4 rotate-90', 'right-4 bottom-4 rotate-180', 'left-4 bottom-4 -rotate-90'] as const).map((pos) => (
        <svg key={pos} className={`absolute ${pos} opacity-70`} width="26" height="26" aria-hidden>
          <path d="M2 12 L2 2 L12 2" fill="none" stroke="rgba(192,138,62,0.6)" strokeWidth="2.5" />
        </svg>
      ))}

      {/* header */}
      <header className="flex items-start justify-between pl-2 pr-3">
        <div>
          <h1 className="display-title text-[54px] font-bold leading-none" style={{ letterSpacing: '0.04em', textShadow: '0 2px 0 rgba(0,0,0,0.6), 0 -1px 0 rgba(255,230,180,0.1)' }}>
            Junkyard Redemption
          </h1>
          <div className="mt-1.5 font-display text-[16px] font-medium uppercase" style={{ letterSpacing: '0.42em', color: 'var(--color-text-dim)' }}>
            SOL Kids Camp
          </div>
        </div>
        <div className="mt-3 text-right">
          <span className="font-display text-[17px] font-medium uppercase" style={{ letterSpacing: '0.22em', color: 'var(--color-text)' }}>
            Day 3 · Evening Standings
          </span>
          <div className="mt-1 flex items-center justify-end gap-2">
            <span className="tech-label">Feed Online</span>
            <span className="flex items-end gap-[2px]" aria-hidden>
              {[3, 5, 7, 9, 11].map((h) => (
                <span key={h} className="w-[3px] rounded-[1px]" style={{ height: h, background: 'var(--color-accent)', boxShadow: '0 0 4px rgba(47,217,208,0.7)', opacity: 0.85 }} />
              ))}
            </span>
          </div>
        </div>
      </header>

      <div className="hairline mx-1 mb-1 mt-3" />

      {/* side rail labels in recessed service panels */}
      <div
        className="absolute left-4 top-[38%] rounded-[3px] px-2 py-1.5"
        style={{ background: 'rgba(0,0,0,0.35)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,236,205,0.05)' }}
      >
        <div className="tech-label leading-relaxed">
          MTRX
          <br />
          SOL-07
          <br />
          Group C
        </div>
      </div>
      <div
        className="absolute right-4 top-[40%] rounded-[3px] px-2 py-1.5 text-right"
        style={{ background: 'rgba(0,0,0,0.35)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,236,205,0.05)' }}
      >
        <div className="tech-label leading-relaxed">
          Standings
          <br />
          Update
          <br />
          18:00 SOL
        </div>
      </div>

      {/* gauge columns */}
      <main className="mx-6 mt-9 flex min-h-0 flex-1 items-stretch gap-5">
        {totals.map((t) => {
          const team = teams.find((x) => x.id === t.teamId)!
          return (
            <GaugeColumn
              key={t.teamId}
              name={team.name}
              hex={TEAM_HEX[team.id]}
              points={t.points}
              lead={byTeam.get(t.teamId)!.rank === 1}
            />
          )
        })}
      </main>

      {/* bottom manifold */}
      <footer className="relative mx-8 mt-4 flex h-7 items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full" style={{ background: 'linear-gradient(180deg, #4a3822 0%, #2c2014 60%, #1a1108 100%)', boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.2), 0 2px 3px rgba(0,0,0,0.6)' }} aria-hidden />
        <div className="relative flex items-center gap-3 rounded-[3px] px-3 py-1" style={{ background: '#1b140f', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)' }}>
          <span className="tech-label">7A-19-88</span>
          <Barcode width={60} height={10} />
        </div>
      </footer>
    </div>
  )
}
