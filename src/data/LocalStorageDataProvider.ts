import type { DataProvider } from './DataProvider'
import type { Activity, Category, Day, ScoreEvent, Team } from './types'
import { ACTIVITIES, CATEGORIES, DAYS, TEAMS, seedEvents } from './seed'

const EVENTS_KEY = 'jr:events:v2'
const DEVICE_KEY = 'jr:device-id'
const SETTING_PREFIX = 'jr:setting:'

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
 * Roster, days, categories and activities are static seed data. A `storage`
 * listener keeps other tabs (the big screen) live without a backend.
 */
export class LocalStorageDataProvider implements DataProvider {
  private listeners = new Set<() => void>()
  private cache: ScoreEvent[] | null = null

  constructor() {
    if (localStorage.getItem(EVENTS_KEY) === null) {
      this.write(seedEvents(getDeviceId()))
    }
    window.addEventListener('storage', (e) => {
      if (e.key === EVENTS_KEY) {
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

  async getActivities(): Promise<Activity[]> {
    return ACTIVITIES
  }

  async getEvents(): Promise<ScoreEvent[]> {
    return this.read()
  }

  async appendEvent(event: ScoreEvent): Promise<void> {
    return this.appendEvents([event])
  }

  async appendEvents(incoming: ScoreEvent[]): Promise<void> {
    const events = this.read()
    const known = new Set(events.map((e) => e.id))
    const fresh = incoming.filter((e) => !known.has(e.id)) // idempotent retry
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

  private read(): ScoreEvent[] {
    if (this.cache) return this.cache
    try {
      this.cache = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]') as ScoreEvent[]
    } catch {
      this.cache = []
    }
    return this.cache
  }

  private write(events: ScoreEvent[]): void {
    this.cache = events
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}
