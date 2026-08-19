/**
 * The camp day boundary, mirrored client-side so the client and the database
 * always agree on what "today" is. Camp runs until lights out and someone may
 * score at 23:50: the day rolls over at 03:00 camp-local, not midnight.
 *
 * This must match `camp_today()` in supabase/schema.sql. One timezone, one
 * rollover hour, both edited here and there when the camp changes.
 */
export const CAMP_TIMEZONE = 'America/Los_Angeles'
export const ROLLOVER_HOURS = 3

const dtf = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Gates-only date pin: under `vite --mode gates`, `jr:setting:today=YYYY-MM-DD`
 * overrides the calendar. The gates must see a scoring day with data whatever
 * the real date says — Arrival scores nothing and after camp nothing is
 * editable, so unpinned the whole suite only passes mid-camp. The key mirrors
 * SETTING_PREFIX in LocalStorageDataProvider (importing it here would cycle
 * through seed.ts); production and plain dev never read it.
 */
function pinnedToday(): string | null {
  if (import.meta.env.MODE !== 'gates') return null
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem('jr:setting:today')
}

/**
 * The camp date (YYYY-MM-DD) an instant belongs to: the camp-local wall clock
 * minus the rollover. Shifting the instant back 3h and taking its camp-local
 * date is the same arithmetic as the SQL function — `(wall − 3h)::date`.
 */
export function campToday(now: Date = new Date()): string {
  return pinnedToday() ?? dtf.format(new Date(now.getTime() - ROLLOVER_HOURS * 3_600_000))
}
