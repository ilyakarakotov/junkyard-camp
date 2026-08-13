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
import type { AwardEvent, Camper, Team, TeamId, Volunteer } from './types'
import { LocalStorageDataProvider, getDeviceId } from './LocalStorageDataProvider'
import { reversalOf } from './derive'

interface StoreValue {
  teams: Team[]
  campers: Camper[]
  volunteers: Volunteer[]
  events: AwardEvent[]
  ready: boolean
  award(teamId: TeamId, camperIds: string[], points: number, note?: string): Promise<AwardEvent>
  undo(original: AwardEvent): Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

/** The only place a DataProvider is instantiated. Components use hooks below. */
export function StoreProvider({ children, provider }: { children: ReactNode; provider?: DataProvider }) {
  const dp = useMemo<DataProvider>(() => provider ?? new LocalStorageDataProvider(), [provider])
  const [teams, setTeams] = useState<Team[]>([])
  const [campers, setCampers] = useState<Camper[]>([])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [events, setEvents] = useState<AwardEvent[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const refreshEvents = () => {
      void dp.getEvents().then((e) => alive && setEvents(e))
    }
    void Promise.all([dp.getTeams(), dp.getCampers(), dp.getVolunteers(), dp.getEvents()]).then(
      ([t, c, v, e]) => {
        if (!alive) return
        setTeams(t)
        setCampers(c)
        setVolunteers(v)
        setEvents(e)
        setReady(true)
      },
    )
    const unsub = dp.subscribe(refreshEvents)
    return () => {
      alive = false
      unsub()
    }
  }, [dp])

  const award = useCallback(
    async (teamId: TeamId, camperIds: string[], points: number, note?: string) => {
      const event: AwardEvent = {
        id: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
        volunteerId: 'v-1', // Phase 0 has no auth; Phase 1 supplies the signed-in volunteer.
        teamId,
        points,
        note: note ?? null,
        deviceId: getDeviceId(),
        reversesEventId: null,
        syncedAt: null,
        camperIds,
      }
      await dp.appendEvent(event)
      const fresh = await dp.getEvents()
      setEvents(fresh)
      return event
    },
    [dp],
  )

  const undo = useCallback(
    async (original: AwardEvent) => {
      await dp.appendEvent(reversalOf(original, getDeviceId()))
      setEvents(await dp.getEvents())
    },
    [dp],
  )

  const value = useMemo(
    () => ({ teams, campers, volunteers, events, ready, award, undo }),
    [teams, campers, volunteers, events, ready, award, undo],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore must be used inside <StoreProvider>')
  return v
}
