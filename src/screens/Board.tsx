import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Breaker from '../components/Breaker'
import ChargeTrack from '../components/ChargeTrack'
import DayRail from '../components/DayRail'
import { KeyCount } from '../components/KeyRail'
import TeamCrest from '../components/TeamCrest'
import { BracketRule, textureOffset } from '../components/chrome'
import { dayRanks, dayScores } from '../data/derive'
import { BINARY_CATEGORIES, formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { CategoryId, Team } from '../data/types'

/**
 * The day at a glance.
 *
 * **Read-and-navigate only — nothing mutates from here.** The cells are 22px;
 * a mis-tap that silently scores a team while the kids are watching is
 * unacceptable. A column header opens Roll Call, a row opens the Team Sheet.
 *
 * Width budget at 390px (pre-solved, don't rediscover it):
 *   padding 20 · crest 26 · name 72 · 5 sockets 118 · punctuality 42
 *   · keys 22 · score 40 · gutters 30  =  350 of 370 available
 *
 * The consequence is that the cumulative total does NOT appear on this row —
 * it lives on Standings — and keys render as a glyph and a count.
 */

/*
 * Column widths sum to 306 inside a ~338px plate interior (390 − 40 padding
 * − 12 plate frame), leaving ~6.4px gutters that `justify-between`
 * distributes. Laid out this way on purpose: fixed widths plus auto gutters
 * cannot overflow, whereas fixed gutters silently squeeze the last column and
 * truncate the score to "7." — which is exactly what happened first time.
 */
const ROW_H = 56
const CREST = 26
const NAME_W = 66
const SOCKET = 20
const SOCKETS_W = 110
const PUNCT_W = 40
const KEYS_W = 20
const SCORE_W = 44
const SOCKET_GAP = (SOCKETS_W - SOCKET * 5) / 4

export default function Board() {
  const { teams, days, categories, activeDay, setActiveDayId, events, ready } = useStore()
  const navigate = useNavigate()

  const scores = useMemo(() => dayScores(events, activeDay.id, teams), [events, activeDay.id, teams])
  const ranks = useMemo(() => dayRanks(scores), [scores])
  const byTeam = useMemo(() => new Map(scores.map((s) => [s.teamId, s])), [scores])
  const glyph = (id: CategoryId) => categories.find((c) => c.id === id)?.glyph ?? ''

  if (!ready) return <div className="min-h-dvh" />

  const openCall = (categoryId: CategoryId) => {
    if (!activeDay.scored) return
    navigate(`/call/${categoryId}`)
  }

  return (
    <div className="min-h-dvh pb-6">
      <header className="px-5 pb-2 pt-4">
        <div className="flex items-baseline justify-between">
          <h1 className="display-title text-[21px] leading-none" style={{ letterSpacing: '0.1em' }}>
            Junkyard Redemption
          </h1>
          <span className="tech-label text-[8px]">SOL CAMP</span>
        </div>
        <BracketRule className="mx-0 mt-2" />
      </header>

      <DayRail days={days} activeId={activeDay.id} onSelect={setActiveDayId} />

      {/* day theme — the reason the day has a name */}
      <div className="px-5 pb-1 pt-2">
        <div className="flex items-baseline gap-2">
          <span className="display-title text-[13px]" style={{ letterSpacing: '0.12em' }}>
            {activeDay.name}
          </span>
          <span className="tech-label truncate text-[9px]">{activeDay.theme}</span>
        </div>
      </div>

      {!activeDay.scored && (
        <div className="mx-5 mb-2 mt-1">
          <div
            className="rounded px-3 py-2 text-center"
            style={{ background: 'rgba(138,82,48,0.12)', boxShadow: 'inset 0 0 0 1px rgba(192,138,62,0.28)' }}
          >
            <span className="tech-label text-[9px]" style={{ color: 'var(--color-text-dim)' }}>
              Arrival day · travel and settling in · no scoring
            </span>
          </div>
        </div>
      )}

      {/* ---- column headers: each opens roll call for that category ---- */}
      <div className="px-5 pb-[6px] pt-1">
        <div className="flex items-end justify-between" style={{ paddingLeft: 6, paddingRight: 6 }}>
          <div style={{ width: CREST }} />
          <div style={{ width: NAME_W }} className="tech-label text-[8px]">
            TEAM
          </div>
          <div style={{ width: SOCKETS_W, display: 'flex', gap: SOCKET_GAP }}>
            {BINARY_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => openCall(c)}
                disabled={!activeDay.scored}
                className="tech-label text-center text-[7px] leading-tight"
                style={{ width: SOCKET, letterSpacing: '0.02em' }}
              >
                {glyph(c)}
              </button>
            ))}
          </div>
          <button
            onClick={() => openCall('punctuality')}
            disabled={!activeDay.scored}
            className="tech-label text-center text-[7px]"
            style={{ width: PUNCT_W }}
          >
            {glyph('punctuality')}
          </button>
          <div style={{ width: KEYS_W }} className="tech-label text-center text-[7px]">
            KEY
          </div>
          <div style={{ width: SCORE_W }} className="tech-label text-right text-[7px]">
            TODAY
          </div>
        </div>
      </div>

      {/* ---- eight identical rows ---- */}
      <div className="px-5">
        <div className="plate-shadow">
          <div className="plate grain rust-creep p-[6px]" style={textureOffset('board')}>
            {teams.map((team, i) => (
              <BoardRow
                key={team.id}
                team={team}
                rank={ranks.get(team.id) ?? 0}
                score={byTeam.get(team.id)}
                last={i === teams.length - 1}
              />
            ))}
          </div>
        </div>
      </div>

      <nav className="mt-4 flex gap-2 px-5">
        <Link
          to="/standings"
          className="steel-raised bevel display-title flex h-11 flex-1 items-center justify-center rounded text-[12px]"
          style={{ letterSpacing: '0.16em' }}
        >
          Standings
        </Link>
        <Link
          to="/display"
          className="steel-raised bevel display-title flex h-11 flex-1 items-center justify-center rounded text-[12px]"
          style={{ letterSpacing: '0.16em' }}
        >
          Big Screen
        </Link>
      </nav>
    </div>
  )
}

function BoardRow({
  team,
  rank,
  score,
  last,
}: {
  team: Team
  rank: number
  score: ReturnType<typeof dayScores>[number] | undefined
  last: boolean
}) {
  const color = `var(--color-team-${team.colorToken})`
  const ticks = score?.ticks ?? 0
  const total = score?.totalDeci ?? 0

  return (
    <Link
      to={`/team/${team.id}`}
      className="relative flex items-center justify-between"
      style={{
        height: ROW_H,
        boxShadow: last ? undefined : 'inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 -2px 0 rgba(255,236,205,0.04)',
      }}
    >
      {/* crest with the rank numeral seated in its bezel */}
      <div className="relative shrink-0" style={{ width: CREST, height: CREST }}>
        <TeamCrest teamId={team.id} size={CREST} />
        <span
          className="numeral absolute -left-[3px] -top-[3px] flex items-center justify-center rounded-full"
          style={{
            width: 13,
            height: 13,
            fontSize: 9,
            lineHeight: 1,
            color: rank === 1 ? '#241708' : 'var(--color-text)',
            background:
              rank === 1
                ? 'linear-gradient(180deg, #e2c383 0%, #b3823c 60%, #7a5622 100%)'
                : 'linear-gradient(180deg, #2e241c 0%, #16110d 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,236,205,0.3), 0 1px 2px rgba(0,0,0,0.7)',
          }}
        >
          {rank}
        </span>
      </div>

      <span
        className="font-display shrink-0 truncate text-[13px] font-semibold uppercase"
        style={{ width: NAME_W, letterSpacing: '0.04em', color }}
      >
        {team.shortName}
      </span>

      <div className="flex shrink-0" style={{ width: SOCKETS_W, gap: SOCKET_GAP }}>
        {BINARY_CATEGORIES.map((c) => (
          <Breaker key={c} on={(score?.byCategory[c] ?? 0) > 0} color={color} size={SOCKET} />
        ))}
      </div>

      <div className="shrink-0" style={{ width: PUNCT_W }}>
        <ChargeTrack ticks={ticks} width={PUNCT_W} />
      </div>

      <div className="flex shrink-0 justify-center" style={{ width: KEYS_W }}>
        <KeyCount keys={score?.keys ?? 0} size={20} />
      </div>

      <span
        className="numeral shrink-0 text-right tabular-nums"
        style={{ width: SCORE_W, fontSize: 19, color: 'var(--color-text)', letterSpacing: '0.01em' }}
      >
        {formatDeci(total)}
      </span>
    </Link>
  )
}
