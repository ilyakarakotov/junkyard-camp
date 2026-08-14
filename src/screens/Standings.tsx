import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import TeamCrest from '../components/TeamCrest'
import { ScreenHeader, textureOffset } from '../components/chrome'
import { ArcBolt, ContactPost } from '../fx/Arc'
import { standings } from '../data/derive'
import { formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { Standing, Team } from '../data/types'

/**
 * Cumulative standings across every scored day.
 *
 * Base points and key points are shown **separately** — the gauge is stacked
 * so you can see *how* a team is winning, not just that it is. A team can lead
 * on keys while trailing on base, and that is the whole shape of this camp.
 *
 * Gauges scale to the current leader's total, so the leader's tube reads full
 * and everyone else reads relative to them. Arcs run on the leading row only.
 */

const GAUGE_H = 16

export default function Standings() {
  const { teams, days, events, directorMode, setDirectorMode, ready } = useStore()
  const rows = useMemo(() => standings(events, days, teams), [events, days, teams])
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const leader = rows[0]?.totalDeci ?? 0

  if (!ready) return <div className="min-h-dvh" />

  const scoredCount = days.filter((d) => d.scored).length

  return (
    <div className="min-h-dvh pb-8">
      <ScreenHeader title="Standings" back />

      <div className="flex items-center justify-between px-5 pb-3">
        <span className="tech-label text-[9px]">CUMULATIVE · {scoredCount} SCORING DAYS</span>
        <div className="flex items-center gap-4">
          <Link to="/display" className="tech-label text-[9px]" style={{ color: 'var(--color-accent)' }}>
            BIG SCREEN →
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-[6px] px-5">
        {rows.map((row) => {
          const team = byId.get(row.teamId)
          if (!team) return null
          return <StandingRow key={row.teamId} row={row} team={team} leader={leader} />
        })}
      </div>

      {/* director mode gates the key ceremony so it can't be fat-fingered */}
      <div className="mt-5 px-5">
        <button
          onClick={() => setDirectorMode(!directorMode)}
          className="steel-raised grain flex w-full items-center justify-between rounded px-4 py-3"
          style={{
            ...textureOffset('director'),
            boxShadow: 'inset 1px 1px 0 rgba(255,236,205,0.12), inset -1px -1px 0 rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45)',
          }}
        >
          <span className="text-left">
            <span className="font-display block text-[13px] font-semibold uppercase" style={{ letterSpacing: '0.08em' }}>
              Director mode
            </span>
            <span className="tech-label mt-[2px] block text-[8px]">Unlocks the golden key ceremony</span>
          </span>
          {/* a real toggle: paddle up and emitting, or down and dark */}
          <span
            className="relative shrink-0 rounded-full"
            style={{
              width: 46,
              height: 24,
              background: directorMode
                ? 'linear-gradient(180deg, #6b4a1d 0%, #3a2a12 100%)'
                : 'linear-gradient(180deg, #16110d 0%, #221a12 100%)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,236,205,0.08)',
            }}
          >
            <span
              className="absolute top-[3px] rounded-full"
              style={{
                left: 3,
                // translateX, not an animated `left` — only transform and
                // opacity may animate.
                transform: `translateX(${directorMode ? 22 : 0}px)`,
                width: 18,
                height: 18,
                background: directorMode
                  ? 'linear-gradient(180deg, #ffe9a8 0%, #ffc63d 45%, #a86b12 100%)'
                  : 'linear-gradient(180deg, #4a3b2e 0%, #241c16 100%)',
                boxShadow: directorMode
                  ? 'inset 0 1px 0 rgba(255,252,238,0.8), 0 0 8px rgba(255,198,61,0.6)'
                  : 'inset 0 1px 0 rgba(255,236,205,0.25), 0 1px 2px rgba(0,0,0,0.7)',
                transition: 'transform 180ms cubic-bezier(0.3, 0.9, 0.4, 1)',
              }}
            />
          </span>
        </button>
      </div>
    </div>
  )
}

function StandingRow({ row, team, leader }: { row: Standing; team: Team; leader: number }) {
  const color = `var(--color-team-${team.colorToken})`
  const isLeader = row.rank === 1
  // Gauges scale to the leader, so the leader's tube reads full.
  const pct = leader > 0 ? row.totalDeci / leader : 0
  const basePct = leader > 0 ? row.baseDeci / leader : 0
  const gaugeW = 350 - 20 // plate padding

  return (
    <Link
      to={`/team/${team.id}`}
      className="steel-raised grain relative block rounded px-3 py-[10px]"
      style={{
        ...textureOffset(`st-${team.id}`),
        boxShadow: isLeader
          ? `inset 0 0 0 1px rgba(192,138,62,0.5), inset 1px 1px 0 rgba(255,236,205,0.16), 0 2px 5px rgba(0,0,0,0.5)`
          : 'inset 1px 1px 0 rgba(255,236,205,0.12), inset -1px -1px 0 rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45)',
      }}
    >
      <div className="flex items-center gap-[10px]">
        <span
          className="numeral shrink-0 text-center tabular-nums"
          style={{ width: 16, fontSize: 15, color: isLeader ? 'var(--color-brass)' : 'var(--color-text-dim)' }}
        >
          {row.rank}
        </span>
        <TeamCrest teamId={team.id} size={28} glow={isLeader ? 0.8 : 0} />
        <span className="min-w-0 flex-1">
          <span
            className="font-display block truncate text-[15px] font-semibold uppercase leading-none"
            style={{ letterSpacing: '0.05em', color }}
          >
            {team.shortName}
          </span>
          {/* the breakout: base and keys, never merged into one opaque number */}
          <span className="mt-[3px] flex items-baseline gap-[6px]">
            <span className="numeral tabular-nums text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
              {formatDeci(row.baseDeci)}
            </span>
            <span className="tech-label text-[7px]">BASE</span>
            <span
              className="numeral tabular-nums text-[10px]"
              style={{ color: row.keys > 0 ? 'var(--color-key)' : 'var(--color-text-dim)', opacity: row.keys > 0 ? 1 : 0.5 }}
            >
              {row.keys > 0 ? `+${formatDeci(row.keysDeci)}` : '—'}
            </span>
            <span className="tech-label text-[7px]" style={{ opacity: row.keys > 0 ? 1 : 0.55 }}>
              {row.keys} KEY{row.keys === 1 ? '' : 'S'}
            </span>
          </span>
        </span>
        <span
          className="numeral shrink-0 text-right tabular-nums"
          style={{ width: 62, fontSize: 24, color: 'var(--color-text)' }}
        >
          {formatDeci(row.totalDeci)}
        </span>
      </div>

      {/* ---- gauge tube: base segment in team colour, keys in gold ---- */}
      <div className="relative mt-[9px]" style={{ height: GAUGE_H }}>
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(8,5,3,0.95) 0%, rgba(26,20,14,0.9) 50%, rgba(8,5,3,0.95) 100%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -1px 0 rgba(255,236,205,0.07)',
          }}
        >
          {/* base fill — an emissive gauge, so the glow is motivated */}
          <div
            className="absolute inset-y-[2px] left-[2px] rounded-full"
            style={{
              width: `calc(${Math.max(0, Math.min(1, basePct)) * 100}% - 4px)`,
              background: `linear-gradient(180deg, rgba(255,255,255,0.5) 0%, ${color} 32%, ${color} 62%, rgba(0,0,0,0.4) 100%)`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          {/* key fill — continues the same tube in gold */}
          {row.keysDeci > 0 && (
            <div
              className="absolute inset-y-[2px] rounded-full"
              style={{
                left: `calc(${Math.max(0, Math.min(1, basePct)) * 100}% - 2px)`,
                width: `calc(${Math.max(0, Math.min(1, pct - basePct)) * 100}%)`,
                background:
                  'linear-gradient(180deg, rgba(255,252,238,0.6) 0%, var(--color-key) 34%, var(--color-key) 62%, rgba(60,34,2,0.5) 100%)',
                boxShadow: '0 0 8px rgba(255,198,61,0.75)',
              }}
            />
          )}
          {/* glass over the fill: top highlight and a darkened lower curve */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 26%, transparent 46%, rgba(0,0,0,0.3) 88%, rgba(0,0,0,0.45) 100%)',
            }}
          />
          {/* engraved graduations on the glass */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <line
                key={i}
                x1={`${(i + 1) * 10}%`}
                x2={`${(i + 1) * 10}%`}
                y1="0"
                y2={i % 2 ? 4 : 6}
                stroke="rgba(237,227,210,0.22)"
                strokeWidth="1"
              />
            ))}
          </svg>
        </div>

        {/* leading row only: current jumps the gap between two brass posts */}
        {isLeader && (
          <svg
            className="pointer-events-none absolute"
            style={{ left: -6, top: -8, width: gaugeW + 12, height: GAUGE_H + 16, overflow: 'visible' }}
            aria-hidden
          >
            <ArcBolt
              x1={8}
              y1={GAUGE_H / 2 + 8}
              x2={gaugeW - 4}
              y2={GAUGE_H / 2 + 8}
              seed={5}
              intensity={0.42}
              chaos={0.7}
              weight={0.45}
            />
            <ContactPost cx={8} cy={GAUGE_H / 2 + 8} r={4} />
            <ContactPost cx={gaugeW - 4} cy={GAUGE_H / 2 + 8} r={4} />
          </svg>
        )}
      </div>
    </Link>
  )
}
