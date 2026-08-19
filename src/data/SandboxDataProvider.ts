import { LocalStorageDataProvider, getDeviceId } from './LocalStorageDataProvider'
import { CATEGORIES, DAYS, TEAMS } from './seed'
import { BINARY_DECI, KEY_DECI, MAX_CHECK_INS } from './scoring'
import type { CategoryId, ScoreEvent, TeamId } from './types'

/**
 * The store for test mode. Same log, same rules, its own key — so a rehearsal
 * can never leak into the camp's real scores, and turning test mode off puts
 * the real log back untouched rather than restoring a copy of it.
 *
 * Nothing here talks to the network. That is the whole safety story: a
 * sandboxed director can award anything to anyone on any day, and Postgres
 * never hears about it.
 */
export const SANDBOX_EVENTS_KEY = 'jr:sandbox-events:v1'

/** What the test screen may do to the sandbox, surfaced through the store. */
export interface SandboxOps {
  /** Empty the sandbox log. */
  reset(): Promise<void>
  /** Fill every scoring day with plausible random scores. */
  fillCamp(actorId: string): Promise<void>
  /** Fill one day, leaving the rest alone. */
  fillDay(dayId: string, actorId: string): Promise<void>
  /** Award `count` golden keys to one team, for testing the key rail's +N. */
  giveKeys(dayId: string, teamId: TeamId, count: number, actorId: string): Promise<void>
}

const BINARIES = CATEGORIES.filter((c) => c.kind === 'binary').map((c) => c.id)

/** Weighted so most teams land in the 4.5–6.0 band the real camp converges on. */
function randomTicks(): number {
  const r = Math.random()
  if (r < 0.45) return MAX_CHECK_INS // the 1.0 payoff
  if (r < 0.7) return 6 // parked at the cliff, which is the interesting case
  return Math.floor(Math.random() * 6)
}

export class SandboxDataProvider extends LocalStorageDataProvider implements SandboxOps {
  constructor() {
    super(SANDBOX_EVENTS_KEY, false)
  }

  async reset(): Promise<void> {
    this.write([])
    this.notify()
  }

  async fillCamp(actorId: string): Promise<void> {
    const events: ScoreEvent[] = []
    for (const day of DAYS.filter((d) => d.scored)) {
      events.push(...this.dayEvents(day.id, actorId))
    }
    this.write(events)
    this.notify()
  }

  async fillDay(dayId: string, actorId: string): Promise<void> {
    const kept = this.read().filter((e) => e.dayId !== dayId)
    this.write([...kept, ...this.dayEvents(dayId, actorId)])
    this.notify()
  }

  async giveKeys(dayId: string, teamId: TeamId, count: number, actorId: string): Promise<void> {
    const events: ScoreEvent[] = []
    for (let i = 0; i < count; i++) {
      events.push(this.event(dayId, teamId, 'golden_key', KEY_DECI, actorId))
    }
    await this.appendEvents(events)
  }

  private dayEvents(dayId: string, actorId: string): ScoreEvent[] {
    const events: ScoreEvent[] = []
    for (const team of TEAMS) {
      for (const categoryId of BINARIES) {
        if (Math.random() < 0.72) {
          events.push(this.event(dayId, team.id, categoryId, BINARY_DECI, actorId))
        }
      }
      // Punctuality is ordinal: one +1 row per check-in, never a stored total.
      for (let i = 0; i < randomTicks(); i++) {
        events.push(this.event(dayId, team.id, 'punctuality', 1, actorId))
      }
      // Keys are rare and decide the camp, so a filled day should have a few
      // but not one for everybody.
      if (Math.random() < 0.22) {
        events.push(this.event(dayId, team.id, 'golden_key', KEY_DECI, actorId))
      }
    }
    return events
  }

  private event(
    dayId: string,
    teamId: TeamId,
    categoryId: CategoryId,
    deltaDeci: number,
    actorId: string,
  ): ScoreEvent {
    return {
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      dayId,
      teamId,
      categoryId,
      deltaDeci,
      note: 'sandbox',
      actorId,
      deviceId: getDeviceId(),
      reversesEventId: null,
      syncedAt: null,
    }
  }
}
