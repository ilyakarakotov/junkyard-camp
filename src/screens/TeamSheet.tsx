import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breaker from '../components/Breaker'
import ChargeTrack, { ChargeReadout, SOCKET_CENTER_PCT } from '../components/ChargeTrack'
import DayRail from '../components/DayRail'
import KeyRail from '../components/KeyRail'
import TeamCrest from '../components/TeamCrest'
import { ScreenHeader, textureOffset } from '../components/chrome'
import { checkedInActivityIds, dayScore } from '../data/derive'
import { BASE_CEILING_DECI, BINARY_CATEGORIES, formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { CategoryId } from '../data/types'

/**
 * One team, one day. Where corrections get made — every control here writes a
 * compensating event rather than editing anything.
 *
 * The header shows **keys inside the total, as visible arithmetic**. A bare
 * score out of 6 would bury the only thing that actually separates the teams:
 *
 *    5.6 / 6.0   +   2 KEYS   =   7.6
 *    base            breakout     TOTAL
 */

export default function TeamSheet() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const {
    teams,
    days,
    categories,
    activities,
    activeDay,
    setActiveDayId,
    events,
    setBinary,
    setCheckIn,
    directorMode,
    ready,
  } = useStore()

  const team = teams.find((t) => t.id === teamId)
  const score = useMemo(
    () => (team ? dayScore(events, activeDay.id, team.id) : undefined),
    [events, activeDay.id, team],
  )
  const dayActivities = useMemo(
    () => activities.filter((a) => a.dayId === activeDay.id && a.scoresPunctuality),
    [activities, activeDay.id],
  )
  const checkedIn = useMemo(
    () => (team ? checkedInActivityIds(events, activeDay.id, team.id) : new Set<string>()),
    [events, activeDay.id, team],
  )

  if (!ready || !team || !score) return <div className="min-h-dvh" />

  const color = `var(--color-team-${team.colorToken})`
  const label = (id: CategoryId) => categories.find((c) => c.id === id)?.label ?? id
  const glyph = (id: CategoryId) => categories.find((c) => c.id === id)?.glyph ?? ''
  const locked = !activeDay.scored

  return (
    <div className="min-h-dvh pb-8">
      <ScreenHeader title={team.shortName} back />

      <div className="flex items-center gap-3 px-5 pb-3">
        <TeamCrest teamId={team.id} size={44} glow={0.5} />
        <div>
          <div className="font-display text-[15px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color }}>
            {team.name}
          </div>
          <div className="tech-label text-[8px]">
            {activeDay.name} · {activeDay.theme}
          </div>
        </div>
      </div>

      <DayRail days={days} activeId={activeDay.id} onSelect={setActiveDayId} />

      {/* ---- the arithmetic: base + keys = total ---- */}
      <div className="px-5 pt-3">
        <div className="plate-shadow">
          <div className="plate grain rust-creep p-[10px]" style={textureOffset(`hdr-${team.id}`)}>
            <div className="flex items-stretch">
              <div className="flex-1 text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="numeral tabular-nums" style={{ fontSize: 30, color: 'var(--color-text)' }}>
                    {formatDeci(score.baseDeci)}
                  </span>
                  <span className="numeral tabular-nums" style={{ fontSize: 14, color: 'var(--color-text-dim)' }}>
                    / {formatDeci(BASE_CEILING_DECI)}
                  </span>
                </div>
                <div className="tech-label mt-1 text-[8px]">BASE SCORE</div>
              </div>

              <Operator symbol="+" />

              <div className="flex-1 text-center">
                <div className="flex h-[42px] items-center justify-center">
                  {score.keys > 0 ? (
                    <KeyRail keys={score.keys} capacity={score.keys} width={Math.min(96, 30 + score.keys * 22)} />
                  ) : (
                    <span className="numeral tabular-nums" style={{ fontSize: 26, color: 'var(--color-text-dim)', opacity: 0.5 }}>
                      0
                    </span>
                  )}
                </div>
                <div className="tech-label mt-1 text-[8px]">
                  {score.keys} KEY{score.keys === 1 ? '' : 'S'}
                </div>
              </div>

              <Operator symbol="=" />

              <div className="flex-1 text-center">
                <span className="numeral tabular-nums" style={{ fontSize: 30, color: score.keys > 0 ? 'var(--color-key)' : 'var(--color-text)' }}>
                  {formatDeci(score.totalDeci)}
                </span>
                <div className="tech-label mt-1 text-[8px]">TOTAL</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {locked && (
        <div className="mx-5 mt-3 rounded px-3 py-2 text-center" style={{ background: 'rgba(138,82,48,0.12)', boxShadow: 'inset 0 0 0 1px rgba(192,138,62,0.28)' }}>
          <span className="tech-label text-[9px]">Arrival day does not score</span>
        </div>
      )}

      {/* ---- six categories ---- */}
      <div className="mt-3 flex flex-col gap-[6px] px-5">
        {/* punctuality first, because it is the one that moves */}
        <div
          className="steel-raised grain rounded px-3 py-3"
          style={{ ...textureOffset('punct'), boxShadow: 'inset 1px 1px 0 rgba(255,236,205,0.12), inset -1px -1px 0 rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45)' }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[13px] font-semibold uppercase" style={{ letterSpacing: '0.07em' }}>
              {label('punctuality')}
            </span>
            <ChargeReadout ticks={score.ticks} size={14} />
          </div>
          {/*
           * The track and its labels share one box, and each chip is centred on
           * its socket's actual centre. The seventh socket sits off the six's
           * rhythm by design, so an evenly-spaced row underneath would not line
           * up with the thing it labels.
           */}
          <div className="relative mt-2">
            <ChargeTrack ticks={score.ticks} width={318} />
            <div className="relative mt-3" style={{ height: 32 }}>
              {dayActivities.map((a, i) => {
                const on = checkedIn.has(a.id)
                const pct = SOCKET_CENTER_PCT[i] ?? 0
                return (
                  <button
                    key={a.id}
                    disabled={locked}
                    onClick={() => setCheckIn(activeDay.id, team.id, a.id, !on)}
                    className="absolute rounded-[2px]"
                    style={{
                      left: `${pct}%`,
                      transform: 'translateX(-50%)',
                      width: 42,
                      height: 32,
                      background: on
                        ? 'linear-gradient(180deg, #3d3226 0%, #241c14 100%)'
                        : 'linear-gradient(180deg, #1e1710 0%, #150f0a 100%)',
                      boxShadow: on
                        ? 'inset 1px 1px 0 rgba(255,236,205,0.26), inset -1px -1px 0 rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.5)'
                        : 'inset 1px 1px 2px rgba(0,0,0,0.75), inset -1px -1px 0 rgba(255,236,205,0.07)',
                    }}
                  >
                    <span
                      className="numeral block text-[10px] leading-none"
                      style={{ color: on ? 'var(--color-accent)' : 'var(--color-text-dim)' }}
                    >
                      {a.time.replace(/^0/, '')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* the five binaries */}
        {BINARY_CATEGORIES.map((c) => {
          const on = (score.byCategory[c] ?? 0) > 0
          return (
            <button
              key={c}
              disabled={locked}
              onClick={() => setBinary(activeDay.id, team.id, c, !on)}
              aria-pressed={on}
              className="steel-raised grain flex w-full items-center gap-3 rounded px-3 text-left"
              style={{
                height: 56,
                ...textureOffset(c),
                boxShadow: 'inset 1px 1px 0 rgba(255,236,205,0.12), inset -1px -1px 0 rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45)',
              }}
            >
              <Breaker on={on} color={color} size={30} glyph={glyph(c)} />
              <span className="flex-1">
                <span
                  className="font-display block text-[14px] font-semibold uppercase leading-none"
                  style={{ letterSpacing: '0.05em', color: on ? 'var(--color-text)' : 'var(--color-text-dim)' }}
                >
                  {label(c)}
                </span>
                <span className="tech-label mt-[3px] block text-[8px]">{on ? 'EARNED' : 'NOT EARNED'}</span>
              </span>
              <span
                className="numeral tabular-nums"
                style={{ fontSize: 17, color: on ? color : 'var(--color-text-dim)', opacity: on ? 1 : 0.5 }}
              >
                {formatDeci(on ? 10 : 0)}
              </span>
            </button>
          )
        })}
      </div>

      {/* ---- keys ---- */}
      <div className="mt-4 px-5">
        <div className="tech-label mb-2 text-[9px]">GOLDEN KEYS · {activeDay.name}</div>
        <div
          className="steel-raised grain rounded px-3 py-3"
          style={{ ...textureOffset('keys'), boxShadow: 'inset 1px 1px 0 rgba(255,236,205,0.12), inset -1px -1px 0 rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <KeyRail keys={score.keys} capacity={4} width={190} />
            <button
              disabled={locked || !directorMode}
              onClick={() => navigate(`/key/${team.id}`)}
              className="font-display shrink-0 rounded px-3 py-2 text-[12px] font-semibold uppercase"
              style={{
                letterSpacing: '0.14em',
                color: directorMode && !locked ? '#241708' : 'var(--color-text-dim)',
                background:
                  directorMode && !locked
                    ? 'linear-gradient(180deg, #e2c383 0%, #b3823c 55%, #7a5622 100%)'
                    : 'linear-gradient(180deg, #2b2118 0%, #170f09 100%)',
                boxShadow:
                  directorMode && !locked
                    ? 'inset 0 1px 0 rgba(255,244,214,0.6), 0 2px 4px rgba(0,0,0,0.6)'
                    : 'inset 0 1px 0 rgba(255,236,205,0.08), inset 0 -1px 2px rgba(0,0,0,0.6)',
              }}
            >
              + Key
            </button>
          </div>
          {!directorMode && (
            <div className="tech-label mt-2 text-[8px]">Director mode required · enable on Standings</div>
          )}
        </div>
      </div>
    </div>
  )
}

/** The + and = between the three header cells, engraved rather than drawn. */
function Operator({ symbol }: { symbol: string }) {
  return (
    <div className="flex w-6 shrink-0 items-center justify-center">
      <span
        className="font-display text-[17px]"
        style={{ color: 'var(--color-text-dim)', textShadow: '0 1px 0 rgba(0,0,0,0.8), 0 -1px 0 rgba(255,230,180,0.08)' }}
      >
        {symbol}
      </span>
    </div>
  )
}
