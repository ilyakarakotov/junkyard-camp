import { useNavigate } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { CornerScrews, Plate, ScreenFrame } from '../components/chrome'

/**
 * The menu (§6.5): the app's one navigation hub, opened from the board's
 * header rocker. Shows who is signed in and what they may do. Sign out is
 * the only way out of a session, and it sits behind a confirm (§5.5).
 */
export default function Menu() {
  const navigate = useNavigate()
  const { user, isDirector, signOut } = useAuth()

  const items = [
    { to: '/', label: 'Board', note: 'Today at a glance' },
    { to: '/call/punctuality', label: 'Quick Roll Call', note: '8 teams · one pull' },
    { to: '/display', label: 'Dashboard', note: 'The projector' },
    { to: '/standings', label: 'Standings', note: 'The camp so far' },
  ]

  return (
    <ScreenFrame band={10} className="min-h-dvh">
      <div className="mx-auto flex w-full flex-col px-2 py-4" style={{ maxWidth: 340, minHeight: 'calc(100dvh - 52px)' }}>
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Back to board"
            className="font-mono uppercase"
            style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--color-text-dim)' }}
          >
            ◂ Board
          </button>
          <span className="flex-1" />
          <span
            className="font-mono uppercase"
            style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--color-text-dim)' }}
          >
            {user?.displayName} · {isDirector ? 'Director' : 'Helper'}
          </span>
        </div>

        <h1
          className="display-title mb-4"
          style={{ fontSize: 26, letterSpacing: '0.06em' }}
        >
          Menu
        </h1>

        <div className="flex flex-col" style={{ gap: 8 }}>
          {items.map((item) => (
            <Plate
              key={item.to}
              as="button"
              chamfer={8}
              screws={false}
              onClick={() => navigate(item.to)}
              ariaLabel={item.label}
              style={{ height: 52 }}
            >
              <CornerScrews inset={5} size={8} />
              <span className="relative z-[1] flex h-full items-center justify-between px-4">
                <span
                  className="font-display font-semibold uppercase"
                  style={{
                    fontSize: 16,
                    letterSpacing: '0.06em',
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: 7.5,
                    letterSpacing: '0.1em',
                    color: 'var(--color-text-dim)',
                    whiteSpace: 'nowrap',
                    paddingTop: 4,
                  }}
                >
                  {item.note} ▸
                </span>
              </span>
            </Plate>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button
            onClick={() => {
              if (window.confirm('Sign out of this device?')) {
                void signOut().then(() => navigate('/signin', { replace: true }))
              }
            }}
            className="font-display w-full uppercase"
            style={{
              padding: '11px 0',
              fontSize: 14,
              letterSpacing: '0.14em',
              borderRadius: 4,
              color: 'var(--color-text-dim)',
              background: 'linear-gradient(180deg, #241a10 0%, #1c130b 100%)',
              boxShadow:
                'inset 0 2px 3px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(255,232,190,0.14)',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </ScreenFrame>
  )
}
