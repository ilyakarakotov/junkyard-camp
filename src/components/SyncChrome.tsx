import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'

/**
 * The persistent sync chrome (§5.6): `▲ N UNSYNCED` while the outbox is
 * non-empty, and nothing at all when it is clear. Never a spinner and never
 * in the way — pointer-events none, parked in the bezel corner.
 *
 * With one exception, and it is the reason this file changed. A queue that is
 * merely waiting for signal drains itself, so the badge stays exactly what it
 * was: a passive readout nobody has to act on. A queue the server is actually
 * refusing does not drain, ever, and will sit there through the whole camp
 * with the same three characters in the corner — so that case becomes a
 * hazard-striped button that says so and opens the sync screen. A leader
 * should not have to be told by someone else that their points never left
 * the phone.
 */
export default function SyncChrome() {
  const navigate = useNavigate()
  const { sync } = useStore()
  if (!sync || sync.pending === 0) return null

  const stuck = sync.blocked > 0
  const box = {
    top: 'calc(8px + env(safe-area-inset-top))',
    padding: '4px 8px',
    fontSize: 8.5,
    letterSpacing: '0.14em',
    borderRadius: 3,
    color: 'var(--color-lamp-hot)',
  } as const

  if (!stuck) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-2 z-50 font-mono uppercase"
        style={{
          ...box,
          /* fixed elements ignore #root's safe-area padding; clear the notch
             the same way TestModeChrome does. */
          background: 'linear-gradient(180deg, #241a10 0%, #1a1109 100%)',
          boxShadow:
            'inset 0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(254,223,151,0.2), 0 1px 3px rgba(0,0,0,0.55)',
        }}
      >
        ▲ {sync.pending} unsynced
      </div>
    )
  }

  return (
    <button
      aria-live="polite"
      aria-label={`${sync.blocked} awards held by the server — open sync`}
      onClick={() => navigate('/sync')}
      className="fixed right-2 z-50 flex items-center gap-1.5 overflow-hidden font-mono uppercase"
      style={{
        ...box,
        paddingLeft: 4,
        /* the same hazard material as BackdateBanner — one warning language */
        background: 'linear-gradient(180deg, #33200a 0%, #281607 55%, #1e1005 100%)',
        boxShadow:
          'inset 0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(254,223,151,0.3), 0 0 10px rgba(237,144,64,0.28)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          alignSelf: 'stretch',
          background: 'repeating-linear-gradient(135deg, var(--color-lamp) 0 3px, #2a1607 3px 6px)',
          boxShadow: 'inset -1px 0 0 rgba(20,10,3,0.8), 1px 0 0 rgba(254,223,151,0.22)',
          opacity: 0.9,
        }}
      />
      {sync.blocked} held ▸
    </button>
  )
}
