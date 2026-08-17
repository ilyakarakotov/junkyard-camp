import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { DataProvider } from './DataProvider'
import type {
  Activity,
  Category,
  CategoryId,
  CommitBatch,
  Day,
  ScoreEvent,
  Team,
  TeamId,
} from './types'
import { getDeviceId } from './LocalStorageDataProvider'
import { createDefaultProvider } from './provider'
import { binaryEvent, checkedInActivityIds, liveEvents, reversalOf } from './derive'
import { BINARY_DECI, KEY_DECI } from './scoring'
import { DAYS, resolveActiveDay } from './seed'

const DIRECTOR_KEY = 'director-mode'

interface StoreValue {
  teams: Team[]
  days: Day[]
  categories: Category[]
  activities: Activity[]
  events: ScoreEvent[]
  ready: boolean

  /** The day the rail is pointed at. Defaults by clock, then user-driven. */
  activeDay: Day
  setActiveDayId(id: string): void

  /** Gates the golden key ceremony so it can't be fat-fingered. */
  directorMode: boolean
  setDirectorMode(on: boolean): Promise<void>

  /**
   * Backend sync readout for the board footer: is the network up, and how
   * many events are still waiting in the outbox. Null in local-only mode.
   */
  sync: { online: boolean; pending: number } | null

  /** Roll call: commit a whole column of teams in one gesture. */
  commitRollCall(
    dayId: string,
    categoryId: CategoryId,
    teamIds: TeamId[],
    activityId: string | null,
  ): Promise<CommitBatch>
  /** Team sheet: flip one binary on or off (off is a compensating event). */
  setBinary(dayId: string, teamId: TeamId, categoryId: CategoryId, on: boolean): Promise<void>
  /** Team sheet: add or remove a single punctuality check-in. */
  setCheckIn(dayId: string, teamId: TeamId, activityId: string, on: boolean): Promise<void>
  /** Ceremony: award one golden key. */
  awardKey(dayId: string, teamId: TeamId, note?: string): Promise<void>
  /** Undo a committed batch within its 60-second window. */
  undoBatch(batch: CommitBatch): Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

/** The only place a DataProvider is instantiated. Components use hooks below. */
export function StoreProvider({ children, provider }: { children: ReactNode; provider?: DataProvider }) {
  const dp = useMemo<DataProvider>(() => provider ?? createDefaultProvider(), [provider])
  const [teams, setTeams] = useState<Team[]>([])
  const [days, setDays] = useState<Day[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [ready, setReady] = useState(false)
  const [directorMode, setDirectorModeState] = useState(false)
  const [activeDayId, setActiveDayId] = useState<string>(() => resolveActiveDay(DAYS, new Date()).id)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void dp.getEvents().then((e) => alive && setEvents(e))
    }
    void Promise.all([
      dp.getTeams(),
      dp.getDays(),
      dp.getCategories(),
      dp.getActivities(),
      dp.getEvents(),
      dp.getSetting(DIRECTOR_KEY),
    ]).then(([t, d, c, a, e, director]) => {
      if (!alive) return
      setTeams(t)
      setDays(d)
      setCategories(c)
      setActivities(a)
      setEvents(e)
      setDirectorModeState(director === '1')
      setActiveDayId((cur) => (d.some((x) => x.id === cur) ? cur : resolveActiveDay(d, new Date()).id))
      setReady(true)
    })
    const unsub = dp.subscribe(refresh)
    return () => {
      alive = false
      unsub()
    }
  }, [dp])

  // Network state for the sync readout. The provider flushes its outbox on
  // `online` itself; this just mirrors the flag into UI state.
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Only a backend-aware provider (SupabaseDataProvider.getSyncState) gets a
  // sync readout; in local-only mode `sync` stays null and the board footer
  // keeps its decorative line.
  const syncAware = 'getSyncState' in dp
  const sync = useMemo(
    () =>
      syncAware
        ? { online, pending: events.filter((e) => e.syncedAt === null).length }
        : null,
    [syncAware, online, events],
  )

  const newEvent = useCallback(
    (
      dayId: string,
      teamId: TeamId,
      categoryId: CategoryId,
      deltaDeci: number,
      activityId: string | null,
      note: string | null,
    ): ScoreEvent => ({
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      dayId,
      teamId,
      categoryId,
      deltaDeci,
      activityId,
      note,
      actorId: 'leader-1', // Phase 0 has no auth; Phase 1 supplies the signed-in leader.
      deviceId: getDeviceId(),
      reversesEventId: null,
      syncedAt: null,
    }),
    [],
  )

  const push = useCallback(
    async (batch: ScoreEvent[]) => {
      if (batch.length === 0) return
      await dp.appendEvents(batch)
      setEvents(await dp.getEvents())
    },
    [dp],
  )

  const commitRollCall = useCallback<StoreValue['commitRollCall']>(
    async (dayId, categoryId, teamIds, activityId) => {
      const live = liveEvents(events)
      const batch: ScoreEvent[] = []

      for (const teamId of teamIds) {
        if (categoryId === 'punctuality') {
          // One check-in per activity per team — re-committing is a no-op.
          if (activityId && checkedInActivityIds(events, dayId, teamId).has(activityId)) continue
          batch.push(newEvent(dayId, teamId, 'punctuality', 1, activityId, null))
        } else {
          const already = live.some(
            (e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === categoryId,
          )
          if (already) continue
          batch.push(newEvent(dayId, teamId, categoryId, BINARY_DECI, null, null))
        }
      }

      await push(batch)
      return {
        eventIds: batch.map((e) => e.id),
        categoryId,
        dayId,
        teamIds,
        at: Date.now(),
      }
    },
    [events, newEvent, push],
  )

  const setBinary = useCallback<StoreValue['setBinary']>(
    async (dayId, teamId, categoryId, on) => {
      if (on) {
        const already = binaryEvent(events, dayId, teamId, categoryId)
        if (already) return
        await push([newEvent(dayId, teamId, categoryId, BINARY_DECI, null, null)])
      } else {
        const existing = binaryEvent(events, dayId, teamId, categoryId)
        if (!existing) return
        await push([reversalOf(existing, getDeviceId(), 'Correction')])
      }
    },
    [events, newEvent, push],
  )

  const setCheckIn = useCallback<StoreValue['setCheckIn']>(
    async (dayId, teamId, activityId, on) => {
      const existing = liveEvents(events).find(
        (e) =>
          e.dayId === dayId &&
          e.teamId === teamId &&
          e.categoryId === 'punctuality' &&
          e.activityId === activityId,
      )
      if (on) {
        if (existing) return
        await push([newEvent(dayId, teamId, 'punctuality', 1, activityId, null)])
      } else {
        if (!existing) return
        await push([reversalOf(existing, getDeviceId(), 'Correction')])
      }
    },
    [events, newEvent, push],
  )

  const awardKey = useCallback<StoreValue['awardKey']>(
    async (dayId, teamId, note) => {
      await push([newEvent(dayId, teamId, 'golden_key', KEY_DECI, null, note ?? null)])
    },
    [newEvent, push],
  )

  const undoBatch = useCallback<StoreValue['undoBatch']>(
    async (batch) => {
      const byId = new Map(events.map((e) => [e.id, e]))
      const reversals = batch.eventIds
        .map((id) => byId.get(id))
        .filter((e): e is ScoreEvent => Boolean(e))
        .map((e) => reversalOf(e, getDeviceId()))
      await push(reversals)
    },
    [events, push],
  )

  const setDirectorMode = useCallback(
    async (on: boolean) => {
      setDirectorModeState(on)
      await dp.setSetting(DIRECTOR_KEY, on ? '1' : '0')
    },
    [dp],
  )

  const activeDay = useMemo(
    () => days.find((d) => d.id === activeDayId) ?? days[0] ?? DAYS[1],
    [days, activeDayId],
  )

  const value = useMemo<StoreValue>(
    () => ({
      teams,
      days,
      categories,
      activities,
      events,
      ready,
      activeDay,
      setActiveDayId,
      directorMode,
      setDirectorMode,
      sync,
      commitRollCall,
      setBinary,
      setCheckIn,
      awardKey,
      undoBatch,
    }),
    [
      teams,
      days,
      categories,
      activities,
      events,
      ready,
      activeDay,
      directorMode,
      setDirectorMode,
      sync,
      commitRollCall,
      setBinary,
      setCheckIn,
      awardKey,
      undoBatch,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore must be used inside <StoreProvider>')
  return v
}

/** Convenience lookups so screens don't re-derive the same maps. */
export function useTeam(teamId: string | undefined): Team | undefined {
  const { teams } = useStore()
  return teams.find((t) => t.id === teamId)
}

export function useCategory(categoryId: string | undefined): Category | undefined {
  const { categories } = useStore()
  return categories.find((c) => c.id === categoryId)
}
