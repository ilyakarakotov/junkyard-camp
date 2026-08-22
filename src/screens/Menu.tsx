import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { useStore } from '../data/store'
import { mayUseTestMode } from '../data/testMode'
import { BackTab, BrassConfirm, CornerScrews, Plate, ScreenFrame } from '../components/chrome'

/**
 * The menu (§6.5): the app's one navigation hub, opened from the board's
 * header rocker. Shows who is signed in and what they may do. Sign out is
 * the only way out of a session, and it sits behind a confirm (§5.5).
 */
export default function Menu() {
  const navigate = useNavigate()
  const { user, isDirector, signOut } = useAuth()
  const { sync } = useStore()
  const [confirmOut, setConfirmOut] = useState(false)

  /*
   * The sync row carries its own state in the note. A leader who has been
   * told "check sync" needs the number before they tap, and a leader who has
   * not been told anything needs a reason to look — `3 held` is that reason.
   * Hidden entirely in local-only mode, where there is nothing to sync to.
   */
  const syncNote = !sync
    ? null
    : sync.blocked > 0
      ? `${sync.blocked} held · needs you`
      : sync.pending > 0
        ? `${sync.pending} waiting to send`
        : 'All sent'

  const items = [
    { to: '/', label: 'Board', note: 'Today at a glance' },
    { to: '/call/punctuality', label: 'Quick Roll Call', note: '8 teams · one pull' },
    { to: '/display', label: 'Dashboard', note: 'The projector' },
    { to: '/standings', label: 'Standings', note: 'The camp so far' },
    { to: '/exports', label: 'Exports & Analytics', note: 'Excel · charts' },
    { to: '/audit', label: 'Audit Log', note: 'Who gave what' },
    ...(syncNote ? [{ to: '/sync', label: 'Sync', note: syncNote }] : []),
    // The rehearsal room, for the camp director only. Everyone else never
    // learns the route exists, and /test turns them away if they guess it.
    ...(mayUseTestMode(user) ? [{ to: '/test', label: 'Test Mode', note: 'Sandbox · safe' }] : []),
  ]

  return (
    <ScreenFrame band={10} className="min-h-svh">
      {/*
       * RollCall's own comment says it best: the machine is bolted to a DARK
       * WALL, and if the gaps read brass the whole screen fuses into one flat
       * sheet. A six-item menu leaves most of the frame's interior as dead
       * space below the list, and without this the dead space was raw
       * `.steel` — mid-tone plate colour — which is what pushed the route's
       * midtone% and specular% outside the reference band (scripts/
       * check-material.mjs): a wall of flat brass has no bevel to specular off.
       */}
      <div
        className="relative"
        style={{
          minHeight: 'calc(100svh - 20px)',
          borderRadius: 3,
          background: 'radial-gradient(132% 80% at 28% 4%, #241a12 0%, #150e08 40%, #090503 100%)',
          boxShadow:
            'inset 0 3px 9px rgba(0,0,0,0.85), inset 0 -2px 6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,236,205,0.06)',
        }}
      >
        <div className="mx-auto flex w-full flex-col px-2 py-4" style={{ maxWidth: 340, minHeight: 'calc(100svh - 52px)' }}>
          <div className="mb-2 flex items-center gap-2">
            {/* one back control, one size, one place — see BackTab in chrome.tsx */}
            <BackTab label="Back to board" onClick={() => navigate('/')} style={{ marginLeft: -4 }} />
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

          {/*
           * Rows match the board's own ROW_H (80, on the same 8px gutter):
           * six items at 52px left most of the frame's interior as the dark
           * wall added above, and check-material.mjs measured that as a
           * washed-out screen (midtone% and medianL both over ceiling). The
           * fix is the same one Board.tsx documents for the opposite fault —
           * spend the extra height on real metal, not on a bigger gap.
           */}
          <div className="flex flex-col" style={{ gap: 8 }}>
            {items.map((item) => (
              <Plate
                key={item.to}
                as="button"
                chamfer={8}
                screws={false}
                onClick={() => navigate(item.to)}
                ariaLabel={item.label}
                style={{ height: 80 }}
              >
                <CornerScrews inset={5} size={8} />
                {/*
                 * The key light catching the plate's top chamfer. It decays
                 * left to right rather than running at even strength: a
                 * constant strip reads as painted-on trim, and that same
                 * hard-capped highlight has been cut from this codebase three
                 * times already. One light direction, monotonic falloff.
                 */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute z-[1]"
                  style={{
                    left: 9,
                    right: 9,
                    top: 1,
                    height: 2,
                    background:
                      'linear-gradient(90deg, transparent 0%,' +
                      ' color-mix(in oklab, var(--color-plate-spec) 88%, transparent) 8%,' +
                      ' color-mix(in oklab, var(--color-plate-spec) 52%, transparent) 44%,' +
                      ' color-mix(in oklab, var(--color-plate-spec) 22%, transparent) 88%,' +
                      ' transparent 100%)',
                  }}
                />
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
              onClick={() => setConfirmOut(true)}
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
      </div>

      {confirmOut && (
        <BrassConfirm
          title="Sign out?"
          body="This device stops scoring as you until someone signs back in."
          confirmLabel="Sign out"
          onConfirm={() => {
            setConfirmOut(false)
            void signOut().then(() => navigate('/signin', { replace: true }))
          }}
          onCancel={() => setConfirmOut(false)}
        />
      )}
    </ScreenFrame>
  )
}
