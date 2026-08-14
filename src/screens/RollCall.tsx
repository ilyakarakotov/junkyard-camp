import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Lever from '../components/Lever'
import ChargeTrack from '../components/ChargeTrack'
import TeamCrest from '../components/TeamCrest'
import { ScreenHeader, textureOffset } from '../components/chrome'
import { checkInCount, checkedInActivityIds, hasBinary } from '../data/derive'
import { MAX_CHECK_INS } from '../data/scoring'
import { useStore } from '../data/store'
import { nearestActivity } from '../data/seed'
import type { CommitBatch, TeamId } from '../data/types'

/**
 * Roll call — the workhorse, opened ten times a day.
 *
 * Toggle the eight teams, pull the lever once, everything commits together.
 * Every row is a 56px plate and the **whole plate is the hit area**; this has
 * to be a five-second interaction with a phone in one hand.
 *
 * Committed rows ignite in a 40ms stagger, and any row that lands its seventh
 * check-in fires the surge — that is the 0.6 -> 1.0 jump made visible.
 */

const ROW_H = 56
const UNDO_MS = 60_000
const STAGGER_MS = 40

export default function RollCall() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const { teams, categories, activities, activeDay, events, commitRollCall, undoBatch, ready } = useStore()

  const category = categories.find((c) => c.id === categoryId)
  const isPunctuality = category?.kind === 'track'

  const dayActivities = useMemo(
    () => activities.filter((a) => a.dayId === activeDay.id && a.scoresPunctuality),
    [activities, activeDay.id],
  )

  // Auto-select the activity nearest the clock. Opening at 9:47 should already
  // have "Morning line up · 9:45" chosen.
  const [activityId, setActivityId] = useState<string | null>(null)
  useEffect(() => {
    if (!isPunctuality || dayActivities.length === 0) return
    setActivityId((cur) => cur ?? nearestActivity(dayActivities, new Date())?.id ?? null)
  }, [isPunctuality, dayActivities])

  const fullyLogged = useMemo(() => {
    const done = new Set<string>()
    if (!isPunctuality) return done
    for (const a of dayActivities) {
      if (teams.every((t) => checkedInActivityIds(events, activeDay.id, t.id).has(a.id))) done.add(a.id)
    }
    return done
  }, [isPunctuality, dayActivities, teams, events, activeDay.id])

  const [selected, setSelected] = useState<Set<TeamId>>(new Set())
  const [batch, setBatch] = useState<CommitBatch | null>(null)
  const [ignited, setIgnited] = useState<Set<TeamId>>(new Set())
  const [surged, setSurged] = useState<Set<TeamId>>(new Set())
  const [undoLeft, setUndoLeft] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // 60-second undo window, counted down so the leader can see it draining.
  useEffect(() => {
    if (!batch) return
    setUndoLeft(Math.ceil(UNDO_MS / 1000))
    const iv = setInterval(() => {
      const left = Math.ceil((batch.at + UNDO_MS - Date.now()) / 1000)
      if (left <= 0) {
        setBatch(null)
        setUndoLeft(0)
      } else setUndoLeft(left)
    }, 500)
    return () => clearInterval(iv)
  }, [batch])

  /** Already logged today — re-committing is a no-op, so the row reads as done. */
  const doneFor = useCallback(
    (teamId: TeamId): boolean => {
      if (!category) return false
      if (isPunctuality) {
        return activityId ? checkedInActivityIds(events, activeDay.id, teamId).has(activityId) : false
      }
      return hasBinary(events, activeDay.id, teamId, category.id)
    },
    [category, isPunctuality, activityId, events, activeDay.id],
  )

  const toggle = (teamId: TeamId) => {
    if (doneFor(teamId)) return
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  const selectAll = () => {
    const next = new Set<TeamId>()
    for (const t of teams) if (!doneFor(t.id)) next.add(t.id)
    setSelected(next.size === selected.size ? new Set() : next)
  }

  const onFire = async () => {
    if (!category || selected.size === 0) return
    const ids = teams.filter((t) => selected.has(t.id)).map((t) => t.id)

    // Which rows will land their seventh check-in on this commit.
    const willSurge = new Set<TeamId>()
    if (isPunctuality) {
      for (const id of ids) {
        if (checkInCount(events, activeDay.id, id) + 1 === MAX_CHECK_INS) willSurge.add(id)
      }
    }

    const committed = await commitRollCall(activeDay.id, category.id, ids, activityId)
    setSelected(new Set())
    setBatch(committed)

    // Rows ignite in a 40ms stagger rather than all at once.
    ids.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => {
          setIgnited((s) => new Set(s).add(id))
          if (willSurge.has(id)) setSurged((s) => new Set(s).add(id))
        }, i * STAGGER_MS),
      )
    })
    timers.current.push(
      setTimeout(
        () => {
          setIgnited(new Set())
          setSurged(new Set())
        },
        ids.length * STAGGER_MS + 900,
      ),
    )
  }

  const onUndo = async () => {
    if (!batch) return
    await undoBatch(batch)
    setBatch(null)
  }

  if (!ready || !category) return <div className="min-h-dvh" />

  const activity = dayActivities.find((a) => a.id === activityId)
  const selectableCount = teams.filter((t) => !doneFor(t.id)).length

  return (
    <div className="flex min-h-dvh flex-col pb-4">
      <ScreenHeader title={category.label} back />

      {/*
       * All seven activities visible at once — time only, because the label
       * lives in the sub-header below. A horizontally scrolling strip hid the
       * evening check-ins entirely, which are the ones that decide the 0.6 to
       * 1.0 jump.
       */}
      {isPunctuality && (
        <div className="px-5 pb-2">
          <div className="recess grid grid-cols-7 gap-[3px] rounded p-[3px]">
            {dayActivities.map((a) => {
              const active = a.id === activityId
              const complete = fullyLogged.has(a.id)
              return (
                <button
                  key={a.id}
                  onClick={() => setActivityId(a.id)}
                  className="relative rounded-[2px] py-[7px]"
                  style={{
                    background: active
                      ? 'linear-gradient(180deg, #4a3a26 0%, #2f2519 55%, #221a10 100%)'
                      : 'linear-gradient(180deg, #241c15 0%, #1a130c 100%)',
                    boxShadow: active
                      ? 'inset 0 1px 0 rgba(255,236,205,0.28), 0 1px 2px rgba(0,0,0,0.5)'
                      : 'inset 0 1px 0 rgba(255,236,205,0.05)',
                  }}
                >
                  <span
                    className="numeral block text-center text-[11px] leading-none"
                    style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-dim)' }}
                  >
                    {a.time.replace(/^0/, '')}
                  </span>
                  {/* a filled pip means every team is already logged for it */}
                  <span
                    aria-hidden
                    className="mx-auto mt-[4px] block rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      background: complete ? 'var(--color-accent)' : 'rgba(237,227,210,0.2)',
                      boxShadow: complete ? '0 0 4px var(--color-accent)' : 'inset 0 1px 1px rgba(0,0,0,0.8)',
                    }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-5 pb-1">
        <span className="tech-label text-[9px]">
          {activity ? `${activity.label} · ${activity.time}` : activeDay.name}
        </span>
        {selectableCount > 0 && (
          <button className="tech-label text-[9px] underline-offset-2" onClick={selectAll} style={{ color: 'var(--color-accent)' }}>
            {selected.size === selectableCount ? 'CLEAR' : 'ALL'}
          </button>
        )}
      </div>

      {/* nothing left to do here — say so rather than showing eight dead rows */}
      {selectableCount === 0 && (
        <div className="mx-5 mb-2 rounded px-3 py-2 text-center" style={{ background: 'rgba(47,217,208,0.07)', boxShadow: 'inset 0 0 0 1px rgba(47,217,208,0.25)' }}>
          <span className="tech-label text-[9px]" style={{ color: 'var(--color-text)' }}>
            All eight teams logged{isPunctuality ? ' for this activity' : ''}
            {isPunctuality ? ' · pick another time above' : ''}
          </span>
        </div>
      )}

      {/* ---- eight full-width rows, whole plate is the hit area ---- */}
      <div className="flex flex-col gap-[6px] px-5">
        {teams.map((team) => {
          const done = doneFor(team.id)
          const on = selected.has(team.id)
          const lit = ignited.has(team.id)
          const color = `var(--color-team-${team.colorToken})`
          const ticks = checkInCount(events, activeDay.id, team.id)
          return (
            <button
              key={team.id}
              onClick={() => toggle(team.id)}
              disabled={done}
              aria-pressed={on}
              className="steel-raised grain relative flex w-full items-center gap-3 rounded px-3 text-left"
              style={{
                height: ROW_H,
                ...textureOffset(team.id),
                boxShadow: on
                  ? `inset 0 0 0 1.5px ${color}, inset 1px 1px 0 rgba(255,236,205,0.16), 0 2px 4px rgba(0,0,0,0.5)`
                  : 'inset 1px 1px 0 rgba(255,236,205,0.12), inset -1px -1px 0 rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45)',
                opacity: done ? 0.72 : 1,
              }}
            >
              {/* selection wash — the plate itself lights, not a checkbox */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded"
                style={{
                  background: `linear-gradient(90deg, ${color} 0%, transparent 72%)`,
                  opacity: lit ? 0.4 : on ? 0.16 : 0,
                  transition: 'opacity 220ms ease-out',
                }}
              />
              <TeamCrest teamId={team.id} size={34} glow={on || lit ? 1 : 0} />
              <span className="relative flex-1">
                <span
                  className="font-display block text-[16px] font-semibold uppercase leading-none"
                  style={{ letterSpacing: '0.05em', color: on || lit ? 'var(--color-text)' : 'var(--color-text-dim)' }}
                >
                  {team.shortName}
                </span>
                <span className="tech-label mt-[3px] block text-[8px]">
                  {done ? 'LOGGED' : isPunctuality ? `${ticks} / ${MAX_CHECK_INS} CHECK-INS` : team.name}
                </span>
              </span>

              {isPunctuality && (
                <span className="relative shrink-0">
                  <ChargeTrack ticks={lit ? ticks + 1 : ticks} width={72} surging={surged.has(team.id)} />
                </span>
              )}

              {/*
               * Indicator lamp. The dark glass is always present and the
               * filament fades in over it — transitioning background and
               * box-shadow instead would repaint every frame, and the motion
               * contract is transform and opacity only.
               */}
              <span aria-hidden className="relative shrink-0" style={{ width: 13, height: 13 }}>
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #2b2118 0%, #140d07 100%)',
                    boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.9), inset 0 -1px 0 rgba(255,236,205,0.12)',
                  }}
                />
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: color,
                    boxShadow: `0 0 6px ${color}, 0 0 12px ${color}, inset 0 1px 0 rgba(255,255,255,0.6)`,
                    opacity: on || lit ? 1 : done ? 0.55 : 0,
                    transition: 'opacity 200ms ease-out',
                  }}
                />
              </span>
            </button>
          )
        })}
      </div>

      {/* ---- commit ---- */}
      <div className="mt-4 px-5">
        <Lever pendingCount={selected.size} onFire={onFire} />
      </div>

      {/* ---- 60-second undo ---- */}
      {batch && (
        <div className="mt-3 px-5">
          <div
            className="flex items-center justify-between rounded px-3 py-2"
            style={{ background: 'rgba(47,217,208,0.08)', boxShadow: 'inset 0 0 0 1px rgba(47,217,208,0.3)' }}
          >
            <span className="tech-label text-[9px]" style={{ color: 'var(--color-text)' }}>
              {batch.eventIds.length} committed · {undoLeft}s
            </span>
            <button
              onClick={onUndo}
              className="font-display text-[12px] font-semibold uppercase"
              style={{ letterSpacing: '0.16em', color: 'var(--color-accent)' }}
            >
              Undo
            </button>
          </div>
        </div>
      )}

      <button
        className="tech-label mt-4 self-center px-5 text-[9px]"
        onClick={() => navigate('/')}
        style={{ color: 'var(--color-text-dim)' }}
      >
        BACK TO BOARD
      </button>
    </div>
  )
}
