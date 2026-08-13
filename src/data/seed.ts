import type { AwardEvent, Camper, Team, TeamId, Volunteer } from './types'

export const TEAMS: Team[] = [
  { id: 'turquoise', name: 'Turquoise', colorToken: 'turquoise' },
  { id: 'crimson', name: 'Crimson', colorToken: 'crimson' },
  { id: 'sunburst', name: 'Sunburst', colorToken: 'sunburst' },
  { id: 'lime', name: 'Lime', colorToken: 'lime' },
  { id: 'violet', name: 'Violet', colorToken: 'violet' },
  { id: 'cobalt', name: 'Cobalt', colorToken: 'cobalt' },
]

const ROSTER: Record<TeamId, string[]> = {
  turquoise: ['Maya', 'Eli', 'Jude', 'Ava', 'Levi', 'Noah', 'Ruth', 'Caleb', 'Mia', 'Silas', 'Nora', 'Asher'],
  crimson: ['Ivy', 'Owen', 'Ezra', 'Lila', 'Micah', 'June', 'Theo', 'Sadie', 'Reed', 'Wren', 'Jonah', 'Faye'],
  sunburst: ['Cora', 'Finn', 'Abel', 'Tess', 'Rhys', 'Elsa', 'Gideon', 'Pearl', 'Knox', 'Iris', 'Amos', 'Belle'],
  lime: ['Otis', 'Hazel', 'Boaz', 'Greta', 'Cyrus', 'Opal', 'Jack', 'Vera', 'Enoch', 'Sylvie', 'Hugo', 'Edie'],
  violet: ['Dana', 'Felix', 'Rosa', 'Ezel', 'Nina', 'Saul', 'Lena', 'Titus', 'Willa', 'Emil', 'Freya', 'Zeke'],
  cobalt: ['Anya', 'Bram', 'Cleo', 'Dov', 'Esme', 'Gil', 'Hana', 'Ira', 'Juno', 'Kai', 'Lior', 'Mira'],
}

const LAST_INITIALS = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'P', 'R']

export const CAMPERS: Camper[] = TEAMS.flatMap((team) =>
  ROSTER[team.id].map((firstName, i) => ({
    id: `${team.id}-${i + 1}`,
    firstName,
    lastInitial: LAST_INITIALS[(i * 5 + team.id.length) % LAST_INITIALS.length],
    teamId: team.id,
  })),
)

export const VOLUNTEERS: Volunteer[] = [
  { id: 'v-1', displayName: 'Sam P.', role: 'director', isActive: true },
  { id: 'v-2', displayName: 'Rachel K.', role: 'volunteer', isActive: true },
  { id: 'v-3', displayName: 'Dmitri L.', role: 'volunteer', isActive: true },
  { id: 'v-4', displayName: 'Grace W.', role: 'volunteer', isActive: true },
  { id: 'v-5', displayName: 'Marcus T.', role: 'volunteer', isActive: true },
  { id: 'v-6', displayName: 'Elena V.', role: 'volunteer', isActive: true },
  { id: 'v-7', displayName: 'Josh B.', role: 'volunteer', isActive: true },
  { id: 'v-8', displayName: 'Hannah S.', role: 'volunteer', isActive: true },
  { id: 'v-9', displayName: 'Peter N.', role: 'volunteer', isActive: true },
  { id: 'v-10', displayName: 'Talia R.', role: 'volunteer', isActive: true },
]

const NOTES = [
  'Clean Up Blitz',
  'Kindness',
  'Teamwork Win',
  'Scrap Sort Sprint',
  'Memory Verse',
  'Cabin Inspection',
  'Helping Hand',
  'Obstacle Relay',
]

/** Target totals mirror the reference art so screens read realistically. */
const TARGET_TOTALS: Record<TeamId, number> = {
  turquoise: 2430,
  crimson: 1895,
  sunburst: 1250,
  lime: 980,
  violet: 675,
  cobalt: 320,
}

/**
 * Deterministic mock history: repeated group awards until each team reaches
 * its target. Deterministic ids keep re-seeding idempotent.
 */
export function seedEvents(deviceId: string): AwardEvent[] {
  const events: AwardEvent[] = []
  const start = new Date('2026-08-10T09:00:00Z').getTime()
  let n = 0

  for (const team of TEAMS) {
    const campers = CAMPERS.filter((c) => c.teamId === team.id)
    let total = 0
    let i = 0
    while (total < TARGET_TOTALS[team.id]) {
      // Vary group size 1..6 and points 1..3, deterministically; the final
      // event shrinks to land exactly on the target total.
      const remaining = TARGET_TOTALS[team.id] - total
      let groupSize = ((i * 7 + team.name.length) % 6) + 1
      let points = (i % 3) + 1
      if (points * groupSize > remaining) {
        points = 1
        groupSize = Math.min(remaining, 6)
      }
      const group = Array.from({ length: groupSize }, (_, k) => campers[(i * 5 + k) % campers.length].id)
      events.push({
        id: `seed-${team.id}-${i}`,
        occurredAt: new Date(start + n * 7 * 60_000).toISOString(),
        volunteerId: VOLUNTEERS[(i + n) % VOLUNTEERS.length].id,
        teamId: team.id,
        points,
        note: NOTES[(i + team.name.length) % NOTES.length],
        deviceId,
        reversesEventId: null,
        syncedAt: null,
        camperIds: group,
      })
      total += points * groupSize
      i++
      n++
    }
  }

  // Interleave teams in time (deterministic shuffle by id hash), so the
  // activity feed shows a realistic mix instead of one team's run.
  const hash = (s: string) => {
    let h = 0
    for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0
    return h >>> 0
  }
  return events
    .map((e) => ({ e, key: hash(e.id) }))
    .sort((a, b) => a.key - b.key)
    .map(({ e }, idx) => ({ ...e, occurredAt: new Date(start + idx * 7 * 60_000).toISOString() }))
}
