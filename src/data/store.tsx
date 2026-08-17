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
import { useAuth, type AuthUser } from './auth'
import { binaryEvent, checkInCount, liveEvents, reversalOf } from './derive'
import { BINARY_DECI, KEY_DECI, MAX_CHECK_INS } from './scoring'
import { DAYS, resolveActiveDay } from './seed'

interface StoreValue {
  teams: Team[]
  days: Day[]
  categories: Category[]
  events: ScoreEvent[]
  ready: boolean

  /** The day the rail is pointed at. Defaults by clock, then user-driven. */
  activeDay: Day
  setActiveDayId(id: string): void

  /** The signed-in staff account (a local director in local-only mode). */
  user: AuthUser | null
  /** Directors award golden keys and may unlock past days; helpers cannot. */
  isDirector: boolean

  /**
   * Backend sync readout for the unsynced chrome: is the network up, and how
   * many events are still waiting in the outbox. Null in local-only mode.
   */
  sync: { online: boolean; pending: number } | null

  /** Roll call: commit a whole column of teams in one gesture. */
  commitRollCall(
    dayId: string,
    categoryId: CategoryId,
    teamIds: TeamId[],
  ): Promise<CommitBatch>
  /** Team sheet: flip one binary on or off (off is a compensating event). */
  setBinary(dayId: string, teamId: TeamId, categoryId: CategoryId, on: boolean): Promise<void>
  /** Team detail: add one punctuality check-in (an ordinal tick). */
  addCheckIn(dayId: string, teamId: TeamId): Promise<void>
  /** Team detail: remove the most recent check-in (a compensating event). */
  removeCheckIn(dayId: string, teamId: TeamId): Promise<void>
  /** Ceremony: award one golden key. */
  awardKey(dayId: string, teamId: TeamId, note?: string): Promise<void>
  /** Undo a committed batch within its 60-second window. */
  undoBatch(batch: CommitBatch): Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

/** The only place a DataProvider is instantiated. Components use hooks below. */
export function StoreProvider({ children, provider }: { children: ReactNode; provider?: DataProvider }) {
  const dp = useMemo<DataProvider>(() => provider ?? createDefaultProvider(), [provider])
  const { user, isDirector } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [days, setDays] = useState<Day[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [ready, setReady] = useState(false)
  const [activeDayId, setActiveDayId] = useState<string>(() => resolveActiveDay(DAYS, new Date()).id)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void dp.getEvents().then((e) => alive && setEvents(e))
    }
    void Promise.all([dp.getTeams(), dp.getDays(), dp.getCategories(), dp.getEvents()]).then(
      ([t, d, c, e]) => {
        if (!alive) return
        setTeams(t)
        setDays(d)
        setCategories(c)
        setEvents(e)
        setActiveDayId((cur) => (d.some((x) => x.id === cur) ? cur : resolveActiveDay(d, new Date()).id))
        setReady(true)
      },
    )
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
      note: string | null,
    ): ScoreEvent => ({
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      dayId,
      teamId,
      categoryId,
      deltaDeci,
      note,
      // RLS requires actor_id = auth.uid() — you write as yourself, always.
      actorId: user?.id ?? 'leader-1',
      deviceId: getDeviceId(),
      reversesEventId: null,
      syncedAt: null,
    }),
    [user],
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
    async (dayId, categoryId, teamIds) => {
      const live = liveEvents(events)
      const batch: ScoreEvent[] = []

      for (const teamId of teamIds) {
        if (categoryId === 'punctuality') {
          // Ordinal ticks: each call adds one check-in, capped at seven —
          // anything past the ladder is a wasted row.
          if (checkInCount(events, dayId, teamId) >= MAX_CHECK_INS) continue
          batch.push(newEvent(dayId, teamId, 'punctuality', 1, null))
        } else {
          const already = live.some(
            (e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === categoryId,
          )
          if (already) continue
          batch.push(newEvent(dayId, teamId, categoryId, BINARY_DECI, null))
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
        await push([newEvent(dayId, teamId, categoryId, BINARY_DECI, null)])
      } else {
        const existing = binaryEvent(events, dayId, teamId, categoryId)
        if (!existing) return
        await push([reversalOf(existing, getDeviceId(), 'Correction')])
      }
    },
    [events, newEvent, push],
  )

  const addCheckIn = useCallback<StoreValue['addCheckIn']>(
    async (dayId, teamId) => {
      if (checkInCount(events, dayId, teamId) >= MAX_CHECK_INS) return
      await push([newEvent(dayId, teamId, 'punctuality', 1, null)])
    },
    [events, newEvent, push],
  )

  const removeCheckIn = useCallback<StoreValue['removeCheckIn']>(
    async (dayId, teamId) => {
      // The mirror is ordered, so the last live tick is the most recent one.
      const latest = liveEvents(events)
        .filter(
          (e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === 'punctuality',
        )
        .at(-1)
      if (!latest) return
      await push([reversalOf(latest, getDeviceId(), 'Correction')])
    },
    [events, push],
  )

  const awardKey = useCallback<StoreValue['awardKey']>(
    async (dayId, teamId, note) => {
      await push([newEvent(dayId, teamId, 'golden_key', KEY_DECI, note ?? null)])
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

  const activeDay = useMemo(
    () => days.find((d) => d.id === activeDayId) ?? days[0] ?? DAYS[1],
    [days, activeDayId],
  )

  const value = useMemo<StoreValue>(
    () => ({
      teams,
      days,
      categories,
      events,
      ready,
      activeDay,
      setActiveDayId,
      user,
      isDirector,
      sync,
      commitRollCall,
      setBinary,
      addCheckIn,
      removeCheckIn,
      awardKey,
      undoBatch,
    }),
    [
      teams,
      days,
      categories,
      events,
      ready,
      activeDay,
      user,
      isDirector,
      sync,
      commitRollCall,
      setBinary,
      addCheckIn,
      removeCheckIn,
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
