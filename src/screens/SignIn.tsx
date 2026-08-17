import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { CornerScrews, KeyGlyph, Plate, ScreenFrame, Well } from '../components/chrome'

/**
 * Sign in (§6.0). Username + password only — the app appends the
 * @junkyard.camp domain itself, nobody types an email. No sign-up, no
 * password reset: accounts are seeded by scripts/seed-users.mjs.
 *
 * The session persists for the whole camp, so this screen is seen once per
 * person per camp; anyone already signed in is sent straight to the board.
 */
export default function SignIn() {
  const { user, status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'ready' && user) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const err = await signIn(username, password)
    setBusy(false)
    if (err) setError(err)
    else navigate(from, { replace: true })
  }

  const labelStyle = {
    fontSize: 8.5,
    letterSpacing: '0.22em',
    color: 'var(--color-text)',
    opacity: 0.85,
  } as const

  return (
    <ScreenFrame band={10} className="min-h-dvh">
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 'calc(100dvh - 20px)' }}
      >
        <div className="w-full" style={{ maxWidth: 320 }}>
        <Plate chamfer={12} screws={false} className="w-full" style={{ height: 'auto' }}>
          <CornerScrews inset={7} size={10} />
          <form onSubmit={(e) => void onSubmit(e)} className="relative flex flex-col items-center px-6 py-7">
            <span style={{ height: 60 }}>
              <KeyGlyph size={26} lit />
            </span>
            <h1
              className="display-title mt-3 text-center"
              style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: '0.06em' }}
            >
              Junkyard
              <br />
              Redemption
            </h1>
            <span className="tech-label mt-1" style={labelStyle}>
              SOL KIDS CAMP · STAFF SIGN IN
            </span>

            <span className="tech-label mt-6 block w-full" style={labelStyle}>
              USERNAME
            </span>
            <Well radius={3} className="mt-1 w-full">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                className="w-full bg-transparent font-mono outline-none"
                style={{ padding: '10px 12px', fontSize: 14, color: 'var(--color-text)' }}
              />
            </Well>

            <span className="tech-label mt-4 block w-full" style={labelStyle}>
              PASSWORD
            </span>
            <Well radius={3} className="mt-1 w-full">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full bg-transparent font-mono outline-none"
                style={{ padding: '10px 12px', fontSize: 14, color: 'var(--color-text)' }}
              />
            </Well>

            <button
              type="submit"
              disabled={busy}
              className="font-display mt-6 w-full uppercase"
              style={{
                padding: '11px 0',
                fontSize: 15,
                letterSpacing: '0.14em',
                borderRadius: 4,
                color: '#2a1c0c',
                background:
                  'linear-gradient(180deg, var(--color-brass-hi) 0%, var(--color-brass) 55%, var(--color-brass-lo) 100%)',
                boxShadow:
                  '0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,244,214,0.7)',
                opacity: busy ? 0.55 : 1,
              }}
            >
              {busy ? 'Checking…' : 'Sign in'}
            </button>

            <span
              className="mt-3 block text-center font-mono uppercase"
              role="alert"
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                minHeight: 12,
                color: 'var(--color-lamp)',
              }}
            >
              {error ?? ''}
            </span>
          </form>
        </Plate>
        </div>
      </div>
    </ScreenFrame>
  )
}
