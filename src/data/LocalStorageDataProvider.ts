import type { DataProvider } from './DataProvider'
import type { AppUser, Category, Day, ScoreEvent, Team } from './types'
import { CATEGORIES, DAYS, TEAMS, seedEvents } from './seed'
import { EVENTS_KEY } from './epoch'

/**
 * Shared with SupabaseDataProvider — the mirror must live under one key, and
 * that key carries the data epoch so a new camp cannot inherit an old one's
 * scores off a phone (src/data/epoch.ts).
 */
export { EVENTS_KEY }
const DEVICE_KEY = 'jr:device-id'
export const SETTING_PREFIX = 'jr:setting:'

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

/**
 * Phase 0 storage: the append-only event log lives in one localStorage key.
 * Roster, days and categories are static seed data. A `storage`
 * listener keeps other tabs (the big screen) live without a backend.
 */
export class LocalStorageDataProvider implements DataProvider {
  private listeners = new Set<() => void>()
  private cache: ScoreEvent[] | null = null

  /**
   * @param key       which localStorage key holds the log. Test mode points a
   *                  subclass at its own key so the sandbox and the real
   *                  mirror are separate worlds, not a copy of one another.
   * @param seedEmpty seed mock events into a fresh key. The sandbox starts
   *                  empty instead — a rehearsal should begin at zero.
   */
  constructor(
    protected readonly key: string = EVENTS_KEY,
    seedEmpty = true,
  ) {
    if (localStorage.getItem(this.key) === null) {
      /*
       * Mock camp state exists for the screenshot gates and for developing
       * against a board that is not eight zeroes. It is never real data, so a
       * PRODUCTION build seeds nothing whatever the caller asks for: were the
       * Supabase env ever missing from a Pages build, the app would fall back
       * to this provider and every leader's phone would open on invented
       * scores that look exactly like real ones. `import.meta.env.DEV` is true
       * for `npm run dev` and `npm run dev:gates` and false for `vite build`.
       */
      this.write(seedEmpty && import.meta.env.DEV ? seedEvents(getDeviceId()) : [])
    }
    window.addEventListener('storage', (e) => {
      if (e.key === this.key) {
        this.cache = null
        this.notify()
      }
    })
  }

  async getTeams(): Promise<Team[]> {
    return TEAMS
  }

  async getDays(): Promise<Day[]> {
    return DAYS
  }

  async getCategories(): Promise<Category[]> {
    return CATEGORIES
  }

  async getEvents(): Promise<ScoreEvent[]> {
    return this.read()
  }

  /** Local mode has no staff directory — actors fall back to their ids. */
  async getUsers(): Promise<AppUser[]> {
    return []
  }

  async appendEvent(event: ScoreEvent): Promise<void> {
    return this.appendEvents([event])
  }

  async appendEvents(incoming: ScoreEvent[]): Promise<void> {
    const events = this.read()
    // Idempotent by event id — both against the log and within the batch.
    const known = new Set(events.map((e) => e.id))
    const fresh: ScoreEvent[] = []
    for (const e of incoming) {
      if (known.has(e.id)) continue
      known.add(e.id)
      fresh.push(e)
    }
    if (fresh.length === 0) return
    this.write([...events, ...fresh])
    this.notify()
  }

  async getSetting(key: string): Promise<string | null> {
    return localStorage.getItem(SETTING_PREFIX + key)
  }

  async setSetting(key: string, value: string): Promise<void> {
    localStorage.setItem(SETTING_PREFIX + key, value)
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  protected read(): ScoreEvent[] {
    if (this.cache) return this.cache
    try {
      this.cache = JSON.parse(localStorage.getItem(this.key) ?? '[]') as ScoreEvent[]
    } catch {
      this.cache = []
    }
    return this.cache
  }

  protected write(events: ScoreEvent[]): void {
    this.cache = events
    localStorage.setItem(this.key, JSON.stringify(events))
  }

  protected notify(): void {
    for (const l of this.listeners) l()
  }
}
