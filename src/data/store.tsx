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
  AppUser,
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
import { SandboxDataProvider, type SandboxOps } from './SandboxDataProvider'
import { isTestMode } from './testMode'
import { useAuth, type AuthUser } from './auth'
import { binaryEvent, checkInCount, liveEvents, reversalOf } from './derive'
import { BINARY_DECI, KEY_DECI, MAX_CHECK_INS } from './scoring'
import { DAYS, resolveActiveDay, resolveEditableDayId } from './seed'

interface StoreValue {
  teams: Team[]
  days: Day[]
  categories: Category[]
  events: ScoreEvent[]
  ready: boolean

  /** The day the rail is pointed at. Defaults by clock, then user-driven. */
  activeDay: Day
  setActiveDayId(id: string): void

  /** The staff directory (audit log names); empty in local-only mode. */
  users: AppUser[]

  /** The signed-in staff account (a local director in local-only mode). */
  user: AuthUser | null
  /** Directors award golden keys and may unlock past days; helpers cannot. */
  isDirector: boolean

  /**
   * Only today is editable; every other day is view-only. The store refuses
   * writes to locked days — an event the server would reject (RLS permits
   * today only, or any day for directors) must never sit in the outbox.
   */
  isEditableDay(dayId: string): boolean
  /**
   * The one day that is editable without a director's unlock — the camp's
   * today, or the first scoring day before camp starts. Screens must label
   * locks from this rather than re-deriving "today" from the date: the board's
   * rail used its own strict date match and so padlocked every day during
   * setup, including the day it would in fact accept scores for.
   */
  editableDayId: string | null
  /** Days a director has unlocked on this device (the banner turns amber). */
  unlockedDayIds: ReadonlySet<string>
  /** Directors only: unlock a past day to fix a mistake (behind a confirm). */
  unlockDay(dayId: string): void

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
  /** Reverse the most recent live golden key for a day — a mis-tap path for
      the one award that has no cap and no second thought. */
  removeKey(dayId: string, teamId: TeamId): Promise<void>
  /** Undo a committed batch within its 60-second window. */
  undoBatch(batch: CommitBatch): Promise<void>

  /**
   * True when the whole data layer is the test-mode sandbox: a separate
   * localStorage log that never reaches the network, every scoring day
   * unlocked. See src/data/testMode.ts for why it exists and why it is not a
   * privilege boundary.
   */
  testMode: boolean
  /** Sandbox controls for the test screen. Null outside test mode. */
  sandbox: SandboxOps | null
}

const StoreContext = createContext<StoreValue | null>(null)

/** The only place a DataProvider is instantiated. Components use hooks below. */
export function StoreProvider({ children, provider }: { children: ReactNode; provider?: DataProvider }) {
  const dp = useMemo<DataProvider>(() => provider ?? createDefaultProvider(), [provider])
  const testMode = isTestMode()
  const { user, isDirector } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [days, setDays] = useState<Day[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [ready, setReady] = useState(false)
  const [activeDayId, setActiveDayId] = useState<string>(() => resolveActiveDay(DAYS, new Date()).id)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void dp.getEvents().then((e) => alive && setEvents(e))
    }
    void Promise.all([dp.getTeams(), dp.getDays(), dp.getCategories(), dp.getEvents(), dp.getUsers()]).then(
      ([t, d, c, e, u]) => {
        if (!alive) return
        setTeams(t)
        setDays(d)
        setCategories(c)
        setEvents(e)
        setUsers(u)
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
  // sync readout; in local-only mode `sync` stays null and the unsynced
  // chrome hides itself.
  const syncAware = 'getSyncState' in dp
  const sync = useMemo(
    () =>
      syncAware
        ? { online, pending: events.filter((e) => e.syncedAt === null).length }
        : null,
    [syncAware, online, events],
  )

  // Day locks. Per-device by design: a director unlocks the device in hand to
  // fix a mistake, and the RLS policy already permits director inserts into
  // any day — the lock is UI state, never a data change.
  //
  // The camp's "today", resolved by resolveEditableDayId (src/data/seed.ts) so
  // the rail, the banner and the write guards all read one answer. Before camp
  // — and on Arrival, which scores nothing — the next scoring day stands in;
  // after camp nothing is editable without a director's unlock.
  const editableDayId = useMemo(() => resolveEditableDayId(days), [days])
  const [unlockedDayIds, setUnlockedDayIds] = useState<ReadonlySet<string>>(new Set())
  const isEditableDay = useCallback(
    (dayId: string) => {
      // The sandbox has no calendar to protect: every scoring day is open, so
      // a rehearsal can walk the whole camp without unlocking four days one
      // at a time. Arrival still refuses, because Arrival not scoring is a
      // rule of the camp rather than a lock.
      if (testMode) return days.find((d) => d.id === dayId)?.scored ?? false
      if (dayId === editableDayId) return true
      return isDirector && unlockedDayIds.has(dayId)
    },
    [testMode, days, editableDayId, isDirector, unlockedDayIds],
  )
  const unlockDay = useCallback(
    (dayId: string) => {
      if (!isDirector) return
      setUnlockedDayIds((s) => new Set(s).add(dayId))
    },
    [isDirector],
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
      if (!isEditableDay(dayId)) {
        return { eventIds: [], categoryId, dayId, teamIds, at: Date.now() }
      }
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
    [events, newEvent, push, isEditableDay],
  )

  const setBinary = useCallback<StoreValue['setBinary']>(
    async (dayId, teamId, categoryId, on) => {
      if (!isEditableDay(dayId)) return
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
    [events, newEvent, push, isEditableDay],
  )

  const addCheckIn = useCallback<StoreValue['addCheckIn']>(
    async (dayId, teamId) => {
      if (!isEditableDay(dayId)) return
      if (checkInCount(events, dayId, teamId) >= MAX_CHECK_INS) return
      await push([newEvent(dayId, teamId, 'punctuality', 1, null)])
    },
    [events, newEvent, push, isEditableDay],
  )

  const removeCheckIn = useCallback<StoreValue['removeCheckIn']>(
    async (dayId, teamId) => {
      if (!isEditableDay(dayId)) return
      // The mirror is ordered, so the last live tick is the most recent one.
      const latest = liveEvents(events)
        .filter(
          (e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === 'punctuality',
        )
        .at(-1)
      if (!latest) return
      await push([reversalOf(latest, getDeviceId(), 'Correction')])
    },
    [events, push, isEditableDay],
  )

  const awardKey = useCallback<StoreValue['awardKey']>(
    async (dayId, teamId, note) => {
      if (!isEditableDay(dayId)) return
      // Keys are the director's alone. RLS is the real boundary and the UI
      // disables the control, but this is the one award a helper must never
      // reach, so it does not rely on a screen being drawn correctly —
      // `unlockDay` guards itself here for the same reason.
      if (!isDirector) return
      await push([newEvent(dayId, teamId, 'golden_key', KEY_DECI, note ?? null)])
    },
    [newEvent, push, isEditableDay, isDirector],
  )

  const removeKey = useCallback<StoreValue['removeKey']>(
    async (dayId, teamId) => {
      if (!isEditableDay(dayId)) return
      if (!isDirector) return
      // The mirror is ordered, so the last live key is the most recent one.
      const latest = liveEvents(events)
        .filter((e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === 'golden_key')
        .at(-1)
      if (!latest) return
      await push([reversalOf(latest, getDeviceId(), 'Correction')])
    },
    [events, push, isEditableDay, isDirector],
  )

  const undoBatch = useCallback<StoreValue['undoBatch']>(
    async (batch) => {
      if (!isEditableDay(batch.dayId)) return
      const byId = new Map(events.map((e) => [e.id, e]))
      const reversals = batch.eventIds
        .map((id) => byId.get(id))
        .filter((e): e is ScoreEvent => Boolean(e))
        .map((e) => reversalOf(e, getDeviceId()))
      await push(reversals)
    },
    [events, push, isEditableDay],
  )

  const activeDay = useMemo(
    () => days.find((d) => d.id === activeDayId) ?? days[0] ?? DAYS[1],
    [days, activeDayId],
  )

  // Sandbox controls. Every one of them rewrites the log wholesale, which no
  // real provider may ever do — so they exist only on the sandbox class and
  // are exposed as null everywhere else, and each refreshes the store's copy
  // of the log itself because a bulk write is not an append.
  const sandbox = useMemo<SandboxOps | null>(() => {
    if (!(dp instanceof SandboxDataProvider)) return null
    const after = async (work: Promise<void>) => {
      await work
      setEvents(await dp.getEvents())
    }
    return {
      reset: () => after(dp.reset()),
      fillCamp: (actorId) => after(dp.fillCamp(actorId)),
      fillDay: (dayId, actorId) => after(dp.fillDay(dayId, actorId)),
      giveKeys: (dayId, teamId, count, actorId) =>
        after(dp.giveKeys(dayId, teamId, count, actorId)),
    }
  }, [dp])

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
      users,
      isDirector,
      isEditableDay,
      editableDayId,
      unlockedDayIds,
      unlockDay,
      sync,
      commitRollCall,
      setBinary,
      addCheckIn,
      removeCheckIn,
      awardKey,
      removeKey,
      undoBatch,
      testMode,
      sandbox,
    }),
    [
      teams,
      days,
      categories,
      events,
      ready,
      activeDay,
      user,
      users,
      isDirector,
      isEditableDay,
      editableDayId,
      unlockedDayIds,
      unlockDay,
      sync,
      commitRollCall,
      setBinary,
      addCheckIn,
      removeCheckIn,
      awardKey,
      removeKey,
      undoBatch,
      testMode,
      sandbox,
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
