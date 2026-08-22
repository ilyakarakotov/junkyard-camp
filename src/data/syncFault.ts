/**
 * Why a write did not reach the server — classified once, in a form the sync
 * screen can read out to a leader standing in a field.
 *
 * Before this, `SupabaseDataProvider` caught every failure with a bare
 * `catch { return } // still offline`. That is true of a dead zone and false
 * of everything else: an expired session, a row RLS refuses, a day the server
 * calls closed and an award minted before sign-in all failed exactly the same
 * silent way, and the only thing on screen was `▲ N UNSYNCED` next to a phone
 * with four bars. A leader has no way to tell "wait for signal" from "this
 * will never go, ask someone" — so the app has to.
 *
 * No Supabase import here on purpose: this is the vocabulary the provider,
 * the store and the screen share, and `remote.ts` stays the only file that
 * knows what a PostgrestError is.
 */

export type SyncFaultKind =
  /** The server was not reached at all. Retrying later is the whole fix. */
  | 'network'
  /** Reached, but the session was not accepted. supabase-js refreshes the
      token in the background, so this clears itself more often than not. */
  | 'auth'
  /** Reached and understood, and refused: row-level security said no. */
  | 'refused'
  /** The row itself is not writable — a column the server cannot parse. */
  | 'malformed'
  /** The row points at something the server does not have. */
  | 'missing-reference'
  | 'unknown'

export interface SyncFault {
  kind: SyncFaultKind
  /** SQLSTATE or PostgREST code, when the server gave one. */
  code: string | null
  /** The server's own words — what to quote when asking for help. */
  message: string
  /** ISO instant of the attempt that produced this. */
  at: string
}

/** Thrown by `RemoteEventStore`; carries the classified fault. */
export class RemoteError extends Error {
  constructor(readonly fault: SyncFault) {
    super(fault.message)
    this.name = 'RemoteError'
  }
}

/** The duck-typed shape of a supabase-js `PostgrestError`. */
export interface ServerErrorish {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

const NETWORK_TEXT =
  /failed to fetch|networkerror|network request failed|load failed|aborted|timed out|timeout|err_internet|err_network|err_connection/i

/**
 * Classify what the server (or the lack of one) said.
 *
 * supabase-js does not throw on a dead network — it returns an error object
 * with an empty `code` and a fetch message, which is why "no code plus a
 * fetch-shaped message" is the network case rather than the default. The
 * default is `unknown`, and `unknown` is treated as the row's fault: a
 * failure we cannot name must not be allowed to look like weather and stall
 * the queue forever.
 */
export function classifyServerError(e: ServerErrorish | null | undefined, at: string): SyncFault {
  const message = (e?.message ?? '').trim() || 'The server gave no reason.'
  const code = (e?.code ?? '').trim() || null
  const detail = `${message} ${e?.details ?? ''} ${e?.hint ?? ''}`
  const fault = (kind: SyncFaultKind): SyncFault => ({ kind, code, message, at })

  // SQLSTATE class 08 is connection failure; PostgREST passes it straight out.
  if (code?.startsWith('08')) return fault('network')
  if (!code && NETWORK_TEXT.test(detail)) return fault('network')

  switch (code) {
    // PostgREST auth: expired JWT, no role, anon where a session is required.
    case 'PGRST301':
    case 'PGRST302':
    case '401':
      return fault('auth')
    // insufficient_privilege — the row-level security policy refused the row.
    case '42501':
      return fault('refused')
    // invalid_text_representation (a non-UUID actor), string too long,
    // not-null and CHECK violations: the row can never be written as it is.
    case '22P02':
    case '22001':
    case '23502':
    case '23514':
      return fault('malformed')
    // foreign_key_violation — a correction whose original never arrived.
    case '23503':
      return fault('missing-reference')
    default:
      break
  }

  // PostgREST reports a bad or expired signature as JWSError, not JWT.
  if (/jwt|jws|token|not authorized|unauthorized/i.test(detail)) return fault('auth')
  if (/row-level security|violates row-level/i.test(detail)) return fault('refused')
  return fault('unknown')
}

/** A thrown value from anywhere in the write path, classified. */
export function faultOf(err: unknown, at: string = new Date().toISOString()): SyncFault {
  if (err instanceof RemoteError) return err.fault
  if (err instanceof Error) {
    return classifyServerError({ message: err.message, details: String(err.stack ?? '') }, at)
  }
  return classifyServerError({ message: String(err) }, at)
}

/**
 * Whether waiting is the right response.
 *
 * Transient faults are about the link, not the row, so every queued award
 * shares them — there is nothing to single out and nothing to hold back. Only
 * a fault the row owns earns a quarantine.
 */
export function isTransient(fault: SyncFault): boolean {
  return fault.kind === 'network' || fault.kind === 'auth'
}

/**
 * Whether re-sending the award under the signed-in account could plausibly
 * get it through.
 *
 * Everything the server owns an opinion about — RLS refusing the writer, an
 * actor it cannot parse, an actor it has never heard of — turns on `actor_id`,
 * and `unknown` is included deliberately: the point of the force button is
 * that a bug nobody has classified yet still has one thing left to try.
 * Transient faults are excluded because there is nothing wrong with the row.
 */
export function isRepairable(fault: SyncFault): boolean {
  return !isTransient(fault)
}

/** One line, in the app's voice: what happened. */
export function faultHeadline(fault: SyncFault): string {
  switch (fault.kind) {
    case 'network':
      return 'The server could not be reached'
    case 'auth':
      return 'The session was not accepted'
    case 'refused':
      return 'The server refused the award'
    case 'malformed':
      return 'The award cannot be written as recorded'
    case 'missing-reference':
      return 'The award points at something the server does not have'
    case 'unknown':
      return 'The server refused the award for an unrecognised reason'
  }
}

/** Two or three lines: what it means and what to do about it. */
export function faultRemedy(fault: SyncFault): string {
  switch (fault.kind) {
    case 'network':
      return 'The phone has a connection but this app could not get through — captive-wifi sign-in pages and blocked domains both look like this. Try mobile data, then force sync.'
    case 'auth':
      return 'Sign out and sign back in from the menu. Nothing queued is lost by signing out.'
    case 'refused':
      return 'Usually it was recorded under a different account than the one signed in now. Force sync re-sends it as you, which clears that; if it holds after that, the day itself is closed and a director has to open it.'
    case 'malformed':
      return 'It was recorded before anyone signed in on this device, so the server has no one to credit it to. Force sync re-sends it as you.'
    case 'missing-reference':
      return 'It is a correction whose original award never reached the server, or it credits someone the server has never heard of. Force sync sends the pair in order and re-sends it as you.'
    case 'unknown':
      return 'Nothing here recognises this one. Force sync will try it again anyway, and then try it re-sent as you. The award is still held on this device either way — nothing has been thrown away.'
  }
}
