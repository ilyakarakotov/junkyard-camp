import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getSupabaseClient } from './remote'

/**
 * Auth for the camp: sign in once, stay signed in for the whole camp. Only
 * helpers and directors have accounts — team leaders never sign in.
 *
 * In local-only mode (no Supabase env, e.g. the screenshot gates and demos)
 * there is nothing to sign in to: the app runs as a local director so every
 * screen stays reachable.
 */

export interface AuthUser {
  /** The auth UUID — also the actor_id on every event this person writes. */
  id: string
  username: string
  displayName: string
  role: 'helper' | 'director'
}

interface AuthValue {
  /** 'loading' until the persisted session (if any) has been resolved. */
  status: 'loading' | 'ready'
  user: AuthUser | null
  isDirector: boolean
  /** True when a backend is configured and sign-in is therefore required. */
  backed: boolean
  /** Returns an error message, or null on success. */
  signIn(username: string, password: string): Promise<string | null>
  signOut(): Promise<void>
}

const LOCAL_USER: AuthUser = {
  id: 'leader-1',
  username: 'local',
  displayName: 'Local',
  role: 'director',
}

const AuthContext = createContext<AuthValue | null>(null)

/** usernames map to Supabase emails — nobody types an email (§5.4) */
const asEmail = (username: string) => `${username.trim().toLowerCase()}@junkyard.camp`

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [user, setUser] = useState<AuthUser | null>(supabase ? null : LOCAL_USER)
  const [status, setStatus] = useState<'loading' | 'ready'>(supabase ? 'loading' : 'ready')

  useEffect(() => {
    if (!supabase) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer: awaiting supabase calls inside this callback can deadlock.
      setTimeout(async () => {
        if (!session?.user) {
          setUser(null)
          setStatus('ready')
          return
        }
        const { data: profile } = await supabase
          .from('app_users')
          .select('username, display_name, role')
          .eq('id', session.user.id)
          .single()
        setUser(
          profile
            ? {
                id: session.user.id,
                username: profile.username as string,
                displayName: profile.display_name as string,
                role: profile.role as 'helper' | 'director',
              }
            : null,
        )
        setStatus('ready')
      }, 0)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      isDirector: user?.role === 'director',
      backed: supabase !== null,
      async signIn(username, password) {
        if (!supabase) return null
        const { error } = await supabase.auth.signInWithPassword({
          email: asEmail(username),
          password,
        })
        return error ? 'Wrong username or password' : null
      },
      async signOut() {
        await supabase?.auth.signOut()
      },
    }),
    [status, user, supabase],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}

/**
 * Every screen sits behind this. StoreProvider mounts inside it, so the data
 * layer's first fetch always runs with a session already in place — which the
 * authenticated-read RLS policies require.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div className="min-h-dvh" />
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />
  return children
}
