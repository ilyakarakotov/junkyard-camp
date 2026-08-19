import type { AuthUser } from './auth'
import { EVENTS_KEY } from './LocalStorageDataProvider'

/**
 * Test mode: a sandbox for the camp director to rehearse in.
 *
 * The problem it solves is that the real app is deliberately hard to play
 * with — only one day accepts writes, the log is append-only, and everything
 * you touch is a real score in front of real kids. Rehearsing on it either
 * fails (locked days) or leaves rows behind that have to be swept out of
 * Postgres by hand.
 *
 * So test mode swaps the whole data layer for a SandboxDataProvider writing
 * to its own localStorage key. Nothing reaches Supabase, nothing reaches the
 * real mirror, and every day unlocks. Turning it off restores the real log
 * exactly as it was — the sandbox is a different key, never a copy.
 *
 * This is NOT a privilege boundary, and must never be treated as one. The
 * flag is localStorage, so anyone can set it; what stops them mattering is
 * that setting it takes their writes OFF the network entirely. RLS is still
 * the only thing standing between a helper and a golden key on the real log.
 * The allowlist below only decides who is offered the door in the menu.
 */

const MODE_KEY = 'jr:test-mode'
const ROLE_KEY = 'jr:test-role'

/** Who sees the menu item. Usernames, as typed at sign-in. */
export const TEST_MODE_USERS: readonly string[] = ['ilya']

/** Reads `?flag=1` from either the hash query or the search string. */
function hasFlag(name: string): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(
    window.location.hash.split('?')[1] ?? window.location.search,
  )
  return params.get(name) === '1'
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null // private browsing with storage denied
  }
}

/**
 * True when the app is running against the sandbox. Read once per mount —
 * every toggle reloads, so the provider, the role and the day locks can never
 * disagree about which world they are in.
 */
export function isTestMode(): boolean {
  return read(MODE_KEY) === 'on'
}

export function setTestMode(on: boolean): void {
  try {
    localStorage.setItem(MODE_KEY, on ? 'on' : 'off')
  } catch {
    return
  }
  window.location.reload()
}

/**
 * The role the sandbox pretends you have, so the director can see the app as
 * a helper meets it — greyed key rail, no unlock — without a second account.
 * Ignored entirely outside test mode.
 */
export function testRole(): 'helper' | 'director' {
  return read(ROLE_KEY) === 'helper' ? 'helper' : 'director'
}

export function setTestRole(role: 'helper' | 'director'): void {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    return
  }
  window.location.reload()
}

/**
 * Who is offered test mode in the menu.
 *
 * Local-only mode needs the `?test=1` opt-in rather than being allowed
 * outright: the screenshot gates run local, never pass it, and so keep
 * seeing the six-item menu their material statistics were measured against.
 */
export function mayUseTestMode(user: AuthUser | null): boolean {
  if (!user) return false
  if (TEST_MODE_USERS.includes(user.username)) return true
  return user.username === 'local' && hasFlag('test')
}

/**
 * How many events the real log holds, read while the sandbox is in front of
 * you. The test screen shows it so the one question a rehearsal raises —
 * "am I about to wreck the camp's scores?" — has a number answering it on
 * screen rather than a promise in a comment.
 */
export function realLogSize(): number {
  try {
    const raw = read(EVENTS_KEY)
    return raw ? (JSON.parse(raw) as unknown[]).length : 0
  } catch {
    return 0
  }
}
