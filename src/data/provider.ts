import type { DataProvider } from './DataProvider'
import { LocalStorageDataProvider } from './LocalStorageDataProvider'
import { SupabaseDataProvider } from './SupabaseDataProvider'
import { isSupabaseConfigured } from './remote'

/**
 * The one place the backend is chosen. With Supabase env baked into the
 * build, every screen talks to the shared backend through the synced
 * provider; without it the app runs exactly as Phase 0 did — local-only,
 * which is also what the screenshot gates exercise.
 */
export function createDefaultProvider(): DataProvider {
  return isSupabaseConfigured() ? new SupabaseDataProvider() : new LocalStorageDataProvider()
}
