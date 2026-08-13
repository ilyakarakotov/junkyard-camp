import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { teamTotals } from '../data/derive'
import TeamCrest, { teamColor } from '../components/TeamCrest'
import { Barcode, Plate } from '../components/chrome'
import { ArcGap } from '../fx/Arc'

const brassText = 'linear-gradient(180deg, #d9b06a 0%, #b3823c 32%, #7a5622 78%, #4a3414 100%)'

export default function TeamSelect() {
  const { teams, events, ready } = useStore()
  const navigate = useNavigate()
  if (!ready) return null

  const totals = teamTotals(events, teams.map((t) => t.id))
  const byTeam = new Map(totals.map((t) => [t.teamId, t]))
  const fmt = new Intl.NumberFormat('en-US')

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-4 pb-3 pt-2">
      {/* header */}
      <header className="relative flex h-14 items-center justify-center">
        <button aria-label="Menu" className="plate-shadow absolute left-0 h-11 w-12">
          <span
            className="plate flex h-full w-full flex-col items-center justify-center gap-[4px] p-1.5"
            style={{
              clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
              boxShadow: 'inset 0 0 0 1px rgba(192,138,62,0.4), inset 1px 1px 0 rgba(255,236,205,0.2), inset -1px -1px 0 rgba(0,0,0,0.6)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-[3.5px] w-6" style={{ background: brassText, boxShadow: '0 1px 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,232,190,0.5)' }} />
            ))}
          </span>
        </button>
        <h1 className="display-title text-[30px] font-bold leading-none" style={{ letterSpacing: '0.05em', textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 -1px 0 rgba(255,230,180,0.1)' }}>
          Select Team
        </h1>
      </header>

      {/* drafted bracket rule: line with L-shaped corner returns */}
      <div className="relative mx-2 mb-4 mt-1 h-3" aria-hidden>
        <div className="absolute inset-x-3 top-0 h-[2px]" style={{ background: 'rgba(192,138,62,0.55)', boxShadow: '0 1px 0 rgba(0,0,0,0.5)' }} />
        <div className="absolute left-3 top-0 h-3 w-[2px] bg-[rgba(192,138,62,0.55)]" />
        <div className="absolute right-3 top-0 h-3 w-[2px] bg-[rgba(192,138,62,0.55)]" />
        <div className="absolute left-3 top-[10px] h-[2px] w-2 bg-[rgba(192,138,62,0.35)]" />
        <div className="absolute right-3 top-[10px] h-[2px] w-2 bg-[rgba(192,138,62,0.35)]" />
      </div>

      {/* 2×3 team grid */}
      <div className="relative grid flex-1 grid-cols-2 gap-3">
      {/* scene light: single key light falling off across the panel grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          mixBlendMode: 'multiply',
          background: 'radial-gradient(150% 115% at 18% 0%, #ffffff 0%, #f2ece3 38%, #d9cfc2 70%, #c4b8a9 100%)',
        }}
      />

        {teams.map((team, idx) => {
          const t = byTeam.get(team.id)!
          const leader = t.rank === 1
          const color = teamColor(team.id)
          return (
            <div key={team.id} className="relative">
              <Plate
                className="h-full"
                onClick={() => navigate(`/award/${team.id}`)}
                innerClassName="grid cursor-pointer grid-rows-[1fr_auto_auto_auto] justify-items-center px-2 pb-3.5 pt-3"
              >
                {/* side rails: horizontal micro-labels with tick strips */}
                {(['left', 'right'] as const).map((side) => (
                  <div key={side} className="absolute top-1/2 -translate-y-1/2" style={{ [side]: 5 } as React.CSSProperties}>
                    <div className="flex flex-col items-center gap-1">
                      <svg width="8" height="14" aria-hidden>
                        {[0, 1, 2, 3].map((i) => (
                          <line key={i} x1="0" x2={i % 2 ? 5 : 8} y1={1 + i * 4} y2={1 + i * 4} stroke="rgba(138,122,104,0.4)" strokeWidth="1" />
                        ))}
                      </svg>
                      <span className="tech-label text-[7.5px] leading-none opacity-30" style={{ textShadow: '0 1px 0 rgba(255,230,180,0.12)' }}>
                        {side === 'left' ? `TM-${String(idx + 1).padStart(2, '0')}` : `RK-${String(t.rank).padStart(2, '0')}`}
                      </span>
                      <svg width="8" height="14" aria-hidden>
                        {[0, 1, 2, 3].map((i) => (
                          <line key={i} x1="0" x2={i % 2 ? 8 : 5} y1={1 + i * 4} y2={1 + i * 4} stroke="rgba(138,122,104,0.4)" strokeWidth="1" />
                        ))}
                      </svg>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-center">
                  <TeamCrest teamId={team.id} size={86} glow={leader ? 0.45 : 0} />
                </div>
                <div className="display-title mt-1.5 text-[22px] font-bold leading-none" style={{ letterSpacing: '0.04em', textShadow: '0 1px 0 rgba(0,0,0,0.65), 0 -1px 0 rgba(255,230,180,0.08)' }}>
                  {team.name}
                </div>
                {/* machined divider with center diamond */}
                <div className="relative mt-2 w-4/5">
                  <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(192,138,62,0.5) 18%, rgba(192,138,62,0.5) 82%, transparent)' }} />
                  <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.6) 18%, rgba(0,0,0,0.6) 82%, transparent)' }} />
                  <div className="absolute -top-[2.5px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rotate-45" style={{ background: 'rgba(192,138,62,0.7)', boxShadow: '0 1px 1px rgba(0,0,0,0.6)' }} />
                </div>
                <div
                  className="numeral mt-2 text-[31px] font-bold leading-none"
                  style={{
                    color,
                    textShadow: `0 0 2px color-mix(in srgb, ${color} 60%, transparent), 0 0 9px color-mix(in srgb, ${color} 32%, transparent), 0 1px 1px rgba(0,0,0,0.6)`,
                  }}
                >
                  {fmt.format(t.points)}
                </div>
              </Plate>

              {/* leader hardware overlays the top rail; absolute so rows stay aligned */}
              {leader && (
                <>
                  {/* brass mounting rail across the card's top edge */}
                  <div
                    aria-hidden
                    className="absolute -top-[2px] left-[6px] right-[6px] z-10 h-[5px] rounded-[2px]"
                    style={{
                      background: 'linear-gradient(180deg, #d9b06a 0%, #96702f 55%, #46320f 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,232,190,0.6), 0 2px 3px rgba(0,0,0,0.6)',
                    }}
                  />
                  {/* the arc rides the rail, jumping post to post */}
                  <ArcGap width={200} height={26} seed={4} intensity={1} postR={5} className="absolute -top-[14px] left-1/2 z-30 -translate-x-1/2" />
                  <div className="absolute top-[7px] left-1/2 z-20 -translate-x-1/2" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.7))' }}>
                    <div
                      className="relative px-3.5 py-[4px]"
                      style={{
                        background: brassText,
                        borderRadius: 2,
                        boxShadow:
                          'inset 0 1.5px 0 rgba(255,232,190,0.75), inset 1px 0 0 rgba(255,232,190,0.3), inset 0 -2px 2px rgba(0,0,0,0.5), inset -1px 0 1px rgba(0,0,0,0.35)',
                      }}
                    >
                      {/* end rivets */}
                      {(['left', 'right'] as const).map((s) => (
                        <span
                          key={s}
                          className="absolute top-1/2 h-[4px] w-[4px] -translate-y-1/2 rounded-full"
                          style={{ [s]: 4, background: 'radial-gradient(circle at 35% 30%, #f2dca8, #6d4e20 70%, #2b1a06)' } as React.CSSProperties}
                        />
                      ))}
                      <span className="font-display text-[11px] font-bold uppercase" style={{ letterSpacing: '0.24em', color: '#2b1a06', textShadow: '0 1px 0 rgba(255,240,200,0.4), 0 -0.5px 0.5px rgba(0,0,0,0.5)' }}>
                        Leading
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* footer plate */}
      <Plate className="mt-3" innerClassName="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Barcode height={16} width={34} />
          <div>
            <div className="tech-label">SYS-TEAM-SEL</div>
            <div className="tech-label opacity-60">v2.7.11</div>
          </div>
        </div>
        {/* recessed indicator slot */}
        <div className="flex gap-1.5 rounded-[3px] px-2 py-1" style={{ background: 'rgba(0,0,0,0.45)', boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,236,205,0.06)' }} aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-[5px] rounded-[1px]" style={{ background: 'radial-gradient(circle at 40% 30%, #ffd98a, var(--color-team-sunburst))', boxShadow: '0 0 5px rgba(224,163,60,0.9)', opacity: 0.95 - i * 0.28 }} />
          ))}
        </div>
        <div className="text-right">
          <div className="tech-label">Arclight Industries</div>
          <div className="tech-label opacity-60">// Strength in Unity</div>
        </div>
        {/* stamped maker's mark */}
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="opacity-70">
          <circle cx="13" cy="13" r="11" fill="none" stroke="rgba(192,138,62,0.5)" strokeWidth="1.4" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return <rect key={i} x="12.2" y="0.6" width="1.6" height="3.4" fill="rgba(192,138,62,0.5)" transform={`rotate(${(a * 180) / Math.PI} 13 13)`} />
          })}
          <path d="M13 8 L17 15 L9 15 Z" fill="rgba(192,138,62,0.55)" />
        </svg>
      </Plate>
    </div>
  )
}
