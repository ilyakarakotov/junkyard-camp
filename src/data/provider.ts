import type { DataProvider } from './DataProvider'
import { LocalStorageDataProvider } from './LocalStorageDataProvider'
import { SandboxDataProvider } from './SandboxDataProvider'
import { SupabaseDataProvider } from './SupabaseDataProvider'
import { isSupabaseConfigured } from './remote'
import { isTestMode } from './testMode'

/**
 * The one place the backend is chosen. With Supabase env baked into the
 * build, every screen talks to the shared backend through the synced
 * provider; without it the app runs exactly as Phase 0 did — local-only,
 * which is also what the screenshot gates exercise.
 */
export function createDefaultProvider(): DataProvider {
  // Test mode comes first and wins over everything: a rehearsal must not be
  // able to reach the network by accident, so the sandbox is chosen before
  // the backend is even considered.
  if (isTestMode()) return new SandboxDataProvider()
  return isSupabaseConfigured() ? new SupabaseDataProvider() : new LocalStorageDataProvider()
}
