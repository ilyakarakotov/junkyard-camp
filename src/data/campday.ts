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

const localDtf = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * The same date, read off **the phone's own calendar** rather than the camp
 * timezone constant. The phone is at the camp, so this is the wall clock a
 * leader is actually looking at when they open the app.
 */
export function deviceToday(now: Date = new Date()): string {
  return pinnedToday() ?? localDtf.format(new Date(now.getTime() - ROLLOVER_HOURS * 3_600_000))
}

/**
 * Every date that can honestly be called "today at camp" for this instant.
 *
 * `CAMP_TIMEZONE` is a build-time constant that has to match the SQL function,
 * and it is only ever right for a camp actually held in that zone. Anywhere
 * east of it the camp date lags the phone's date by the offset: at UTC+3,
 * 2026-08-20 does not become "today" in America/Los_Angeles until 13:00 local
 * — after morning exercise, breakfast, morning line up and the lesson. Day 1
 * would sit padlocked on its own date through four of the seven punctuality
 * activities, which is exactly the "DAY 1 · LOCKED — VIEW ONLY" a leader
 * reported seeing on 2026-08-20.
 *
 * So both readings count. They differ for at most a few hours a day and only
 * ever by one day, and the caller resolves them against the fixed camp
 * calendar — a date that matches no camp day opens nothing either way.
 *
 * Ordered camp-first so the gates' `jr:setting:today` pin (and a camp actually
 * held in `CAMP_TIMEZONE`) still decides.
 */
export function campTodayCandidates(now: Date = new Date()): string[] {
  const camp = campToday(now)
  const device = deviceToday(now)
  return camp === device ? [camp] : [camp, device]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * A camp date (YYYY-MM-DD) as a leader reads it — "Thu 20 Aug".
 *
 * Two things this deliberately does not do.
 *
 * It does not hand the string to `new Date(iso)`: a bare date is parsed as
 * UTC, so anywhere west of Greenwich `new Date('2026-08-20')` formats as the
 * 19th. The backdating warning is built out of this, and a warning that names
 * the wrong day is worse than no warning at all.
 *
 * And it does not go through `Intl.DateTimeFormat`. It did, and the same call
 * produced "Thu 20 Aug" under Node and "Thu, 20 Aug" in Chromium — two
 * different ICU builds — so the unit test asserted a string the app never
 * actually rendered, and the extra comma was enough to push the board's
 * warning band into an ellipsis that ate the words "not today". The camp's
 * copy is English and its five dates are fixed, so a table is both exact and
 * the same everywhere.
 */
export function formatCampDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d || m < 1 || m > 12) return date
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${weekday} ${d} ${MONTHS[m - 1]}`
}
