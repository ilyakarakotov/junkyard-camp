/**
 * The data epoch: one number that means "everything scored before this is not
 * camp data".
 *
 * The app was tested for a fortnight on the same phones the camp will use, so
 * on the morning camp opens every one of those devices holds a mirror full of
 * rehearsal scores — and a leader who opens the app and sees WARRIORS on 14.3
 * before a single point has been awarded has no way to tell that from a real
 * standing. Reaching every device is the whole problem: there is no server
 * command that can clear a phone's localStorage.
 *
 * So the epoch travels in the bundle. Two mechanisms, both cheap:
 *
 *   1. **The log's storage key carries the epoch.** `jr:events:v4` is simply
 *      not the key `jr:events:v3` was written to, so a phone that loads the
 *      new build starts from an empty mirror whatever it held before. Nothing
 *      has to run for this to work — not even the boot hook below.
 *   2. **`EPOCH_AT` is the cutoff instant.** Remote rows older than it are
 *      ignored, so the shared Postgres log cannot re-seed a cleared device
 *      with last week's rehearsal either. If `supabase/reset-camp.sql` has
 *      been run the shared log is empty anyway and this is belt and braces;
 *      if it has not, the client still converges to zero.
 *
 * TO WIPE EVERY DEVICE AGAIN: bump `DATA_EPOCH`, set `EPOCH_AT` to the moment
 * of the deploy, ship it. That is the entire procedure.
 */

/** Bump to make every device — phones included — start from zero. */
export const DATA_EPOCH = 4

/**
 * Nothing that happened before this instant is camp data. Set to the moment
 * the epoch-4 build was cut; the camp's first real award comes after it.
 */
export const EPOCH_AT = '2026-08-20T07:30:00.000Z'
const EPOCH_MS = Date.parse(EPOCH_AT)

/** The real log's mirror. Shared by the local and Supabase providers. */
export const EVENTS_KEY = `jr:events:v${DATA_EPOCH}`
/** Test mode's own log — a different world, never a copy of the real one. */
export const SANDBOX_EVENTS_KEY = `jr:sandbox-events:v${DATA_EPOCH}`
/** Which epoch this device has already been swept for. */
const EPOCH_KEY = 'jr:epoch'

/** True for an event that belongs to this camp rather than to the rehearsal. */
export function inEpoch(event: { occurredAt: string }): boolean {
  const t = Date.parse(event.occurredAt)
  // An unparseable timestamp is kept: dropping a real award over a formatting
  // surprise is far worse than carrying one stale row.
  return Number.isNaN(t) || t >= EPOCH_MS
}

const isStaleLogKey = (key: string) =>
  (key.startsWith('jr:events:') && key !== EVENTS_KEY) ||
  (key.startsWith('jr:sandbox-events:') && key !== SANDBOX_EVENTS_KEY)

/**
 * The one-time sweep, run before anything reads storage (src/main.tsx).
 *
 * Deliberately narrow: it removes every previous epoch's log, the durable
 * outbox that could still push those rows at the server, and the test-mode
 * flag — a phone left in the sandbox on the last day of rehearsal must not
 * open on the first morning of camp still in it. It leaves `jr:setting:*` and
 * `jr:device-id` alone; those are device configuration, not scores.
 */
export function applyDataEpoch(): void {
  let store: Storage
  try {
    store = localStorage
    if (store.getItem(EPOCH_KEY) === String(DATA_EPOCH)) return
  } catch {
    return // private browsing with storage denied — nothing persisted to sweep
  }
  try {
    const stale = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key && isStaleLogKey(key)) stale.push(key)
    }
    for (const key of stale) store.removeItem(key)
    // Test mode is per-device state a rehearsal leaves behind, so it goes too.
    store.removeItem('jr:test-mode')
    store.removeItem('jr:test-role')
    store.setItem(EPOCH_KEY, String(DATA_EPOCH))
  } catch {
    // A full or denied quota is not worth failing boot over.
  }
  // The outbox is durable by design, so a rehearsal award queued on a phone
  // that never came back online would otherwise reach Postgres days later.
  // Queued before any provider opens the database, so the delete is processed
  // first — IndexedDB serialises requests per database.
  try {
    indexedDB.deleteDatabase('jr-outbox')
  } catch {
    // no IndexedDB (private browsing): flushOnce drops pre-epoch rows anyway
  }
}
