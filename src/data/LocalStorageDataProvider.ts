import type { DataProvider } from './DataProvider'
import type { AwardEvent, Camper, Team, Volunteer } from './types'
import { CAMPERS, TEAMS, VOLUNTEERS, seedEvents } from './seed'

const EVENTS_KEY = 'jr:events:v1'
const DEVICE_KEY = 'jr:device-id'

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
 * Rosters are static seed data. A `storage` listener keeps other tabs (the
 * big screen) live without a backend.
 */
export class LocalStorageDataProvider implements DataProvider {
  private listeners = new Set<() => void>()
  private cache: AwardEvent[] | null = null

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

  async getCampers(): Promise<Camper[]> {
    return CAMPERS
  }

  async getVolunteers(): Promise<Volunteer[]> {
    return VOLUNTEERS
  }

  async getEvents(): Promise<AwardEvent[]> {
    return this.read()
  }

  async appendEvent(event: AwardEvent): Promise<void> {
    const events = this.read()
    if (events.some((e) => e.id === event.id)) return // idempotent retry
    this.write([...events, event])
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private read(): AwardEvent[] {
    if (this.cache) return this.cache
    try {
      this.cache = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]') as AwardEvent[]
    } catch {
      this.cache = []
    }
    return this.cache
  }

  private write(events: AwardEvent[]): void {
    this.cache = events
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}
