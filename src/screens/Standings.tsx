import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { recentActivity, teamTotals } from '../data/derive'
import TeamCrest, { TEAM_HEX, teamColor } from '../components/TeamCrest'
import { Plate, ScreenHeader } from '../components/chrome'
import { ArcBolt, ContactPost, usePrefersReducedMotion } from '../fx/Arc'

const SCALE_MAX = 3000

/** Horizontal gauge tube: recessed channel, emissive team-color fill, brass caps. */
function GaugeTube({ hex, frac, lead }: { hex: string; frac: number; lead: boolean }) {
  const reduced = usePrefersReducedMotion()
  const pct = Math.min(100, Math.max(3, frac * 100))
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(150)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="relative h-[22px] w-full">
      {/* brass end caps */}
      {(['left', 'right'] as const).map((side) => (
        <div
          key={side}
          className="absolute top-[-2px] bottom-[-2px] w-[7px] rounded-[2px]"
          style={{
            [side]: -3,
            background: 'linear-gradient(180deg, #b98d4a 0%, #8a6428 40%, #4a3414 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.5), 0 1px 2px rgba(0,0,0,0.6)',
            zIndex: 2,
          } as React.CSSProperties}
        />
      ))}
      {/* glass channel */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[4px]"
        style={{
          background: 'linear-gradient(180deg, #0d0a07 0%, #1a140e 60%, #0b0806 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -1px 0 rgba(255,236,205,0.06)',
        }}
      >
        {/* emissive fill */}
        <div
          className="absolute inset-y-[2px] left-[2px] rounded-[3px]"
          style={{
            width: `calc(${pct}% - 4px)`,
            background: `linear-gradient(180deg, ${hex}55 0%, ${hex} 38%, ${hex}dd 62%, ${hex}44 100%)`,
            boxShadow: `0 0 10px ${hex}66, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        />
        {/* meniscus — the bright leading edge */}
        <div
          className="absolute inset-y-[1px] w-[3px] rounded-full"
          style={{ left: `calc(${pct}% - 4px)`, background: '#ffffff', opacity: 0.85, boxShadow: `0 0 7px ${hex}, 0 0 14px ${hex}` }}
        />
        {/* glass top reflection */}
        <div className="absolute inset-x-2 top-[1.5px] h-[3px] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)' }} />
      </div>
      {/* leader: arc rides the tube between two posts */}
      {lead && (
        <svg className="absolute -top-3 left-0 h-8 w-full" style={{ overflow: 'visible', zIndex: 3 }} aria-hidden>
          <ArcBolt x1={4} y1={14} x2={w - 4} y2={14} seed={17} intensity={0.8} chaos={0.9} active={!reduced} weight={0.8} />
          <ContactPost cx={4} cy={14} r={3.5} />
          <ContactPost cx={w - 4} cy={14} r={3.5} />
        </svg>
      )}
    </div>
  )
}

export default function Standings() {
  const { teams, campers, events, ready } = useStore()
  if (!ready) return null

  const totals = teamTotals(events, teams.map((t) => t.id))
  const fmt = new Intl.NumberFormat('en-US')
  const activity = recentActivity(events, 3)
  const camperById = new Map(campers.map((c) => [c.id, c]))

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-4 pb-3 pt-1">
      <ScreenHeader title="Standings" back />
      <div className="hairline mx-1 mb-3" />

      {/* ranked rows — identical heights, shared numeral column edge */}
      <div className="flex flex-col gap-2">
        {totals.map((t) => {
          const team = teams.find((x) => x.id === t.teamId)!
          const hex = TEAM_HEX[team.id]
          const lead = t.rank === 1
          return (
            <div key={t.teamId} className="relative">
              <Plate innerClassName="flex h-[72px] items-center gap-2.5 px-3">
                <span className="numeral w-7 text-[17px] font-semibold" style={{ color: 'var(--color-text-dim)', textShadow: '0 1px 0 rgba(0,0,0,0.7)' }}>
                  {String(t.rank).padStart(2, '0')}
                </span>
                <TeamCrest teamId={team.id} size={40} glow={lead ? 0.5 : 0} />
                <div className="w-[86px]">
                  <div className="display-title text-[16.5px] font-bold leading-tight" style={{ letterSpacing: '0.04em' }}>
                    {team.name}
                  </div>
                  {/* scores share one right column edge, tabular */}
                  <div
                    className="numeral pr-1 text-right text-[17px] font-bold leading-tight"
                    style={{ color: teamColor(team.id), textShadow: `0 0 2px ${hex}88, 0 0 8px ${hex}44` }}
                  >
                    {fmt.format(t.points)}
                  </div>
                </div>
                <div className="min-w-0 flex-1 pl-1 pr-0.5">
                  <GaugeTube hex={hex} frac={t.points / SCALE_MAX} lead={lead} />
                </div>
              </Plate>
              {lead && (
                <div className="absolute -top-2 left-10 z-10" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.7))' }}>
                  <div
                    className="px-2 py-px"
                    style={{
                      background: 'linear-gradient(180deg, #d9b06a 0%, #b3823c 30%, #7a5622 78%, #4a3414 100%)',
                      borderRadius: 2,
                      boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.7), inset 0 -1px 1px rgba(0,0,0,0.5)',
                    }}
                  >
                    <span className="font-display text-[8.5px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: '#2b1a06' }}>
                      Leading
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* recent activity */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <span className="tech-label">Recent Activity</span>
          <div className="hairline flex-1" />
          <span className="tech-label opacity-60">Feed Online</span>
        </div>
        <Plate innerClassName="divide-y divide-[rgba(192,138,62,0.14)] px-3 py-1">
          {activity.map(({ event, reversed }) => {
            const team = teams.find((x) => x.id === event.teamId)!
            const hex = TEAM_HEX[team.id]
            const names = event.camperIds
              .map((id) => camperById.get(id)?.firstName)
              .filter(Boolean)
              .slice(0, 3)
            return (
              <div key={event.id} className="flex h-[42px] items-center gap-2.5" style={{ opacity: reversed ? 0.45 : 1 }}>
                <span className="h-2 w-2 rounded-full" style={{ background: hex, boxShadow: `0 0 5px ${hex}aa` }} />
                <span className="display-title text-[13px] font-semibold" style={{ letterSpacing: '0.06em' }}>
                  {team.name}
                </span>
                <span className="numeral text-[13px] font-bold" style={{ color: teamColor(team.id), textDecoration: reversed ? 'line-through' : 'none' }}>
                  +{event.points * event.camperIds.length}
                </span>
                <span className="min-w-0 flex-1 truncate text-right font-body text-[12px]" style={{ color: 'var(--color-text-dim)' }}>
                  {reversed ? 'Reversed' : (event.note ?? names.join(', '))}
                </span>
              </div>
            )
          })}
        </Plate>
      </div>

      {/* bottom service strip */}
      <div className="mt-auto flex items-center justify-between px-2 pt-4">
        <span className="tech-label">SYS-STANDINGS // 7A-19-88</span>
        <span className="tech-label opacity-60">Scale 0–3,000</span>
      </div>
    </div>
  )
}
