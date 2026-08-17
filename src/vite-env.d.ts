/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — Project Settings → API. Absent = local-only mode. */
  readonly VITE_SUPABASE_URL?: string
  /** anon public key; safe to ship in the client, access is gated by RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
