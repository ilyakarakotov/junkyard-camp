import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'

/**
 * The persistent sync chrome (§5.6): `▲ N UNSYNCED` while the outbox is
 * non-empty, and nothing at all when it is clear. Never a spinner and never
 * in the way — parked in the bezel corner.
 *
 * It is a BUTTON now rather than a label. The badge used to be the end of the
 * road: a leader saw it, had a working connection, restarted the app, and had
 * nowhere to go. Tapping it opens the menu, where SyncPanel says what the
 * server actually said and offers the two recoveries.
 */
export default function SyncChrome() {
  const { sync } = useStore()
  const navigate = useNavigate()
  if (!sync || sync.pending === 0) return null
  const stuck = sync.blocked > 0
  return (
    <button
      onClick={() => navigate('/menu')}
      aria-label={
        stuck
          ? `${sync.pending} awards not synced, ${sync.blocked} refused by the server — open sync`
          : `${sync.pending} awards not synced — open sync`
      }
      className="fixed right-2 z-50 font-mono uppercase"
      style={{
        /* fixed elements ignore #root's safe-area padding; clear the notch
           the same way TestModeChrome does. */
        top: 'calc(8px + env(safe-area-inset-top))',
        padding: '4px 8px',
        /* A tap target this small is a fingertip miss, so the hit area is
           padded out beyond the plate without moving the plate itself. */
        minHeight: 28,
        fontSize: 8.5,
        letterSpacing: '0.14em',
        borderRadius: 3,
        /* Refused is rust; merely queued is amber. A leader has to be able to
           tell "it is going up" from "it is stuck" without opening anything. */
        color: stuck ? '#ffd2b4' : 'var(--color-lamp-hot)',
        background: stuck
          ? 'linear-gradient(180deg, #38180d 0%, #24100a 100%)'
          : 'linear-gradient(180deg, #241a10 0%, #1a1109 100%)',
        boxShadow: stuck
          ? 'inset 0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,148,64,0.3), 0 1px 3px rgba(0,0,0,0.55)'
          : 'inset 0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(254,223,151,0.2), 0 1px 3px rgba(0,0,0,0.55)',
      }}
    >
      {stuck ? '\u25b2' : '\u25b2'} {sync.pending} unsynced{stuck ? ' \u00b7 tap' : ''}
    </button>
  )
}
