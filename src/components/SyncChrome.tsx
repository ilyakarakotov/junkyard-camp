import { useStore } from '../data/store'

/**
 * The persistent sync chrome (§5.6): `▲ N UNSYNCED` while the outbox is
 * non-empty, and nothing at all when it is clear. Never a spinner and never
 * in the way — pointer-events none, parked in the bezel corner.
 */
export default function SyncChrome() {
  const { sync } = useStore()
  if (!sync || sync.pending === 0) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-2 top-2 z-50 font-mono uppercase"
      style={{
        padding: '4px 8px',
        fontSize: 8.5,
        letterSpacing: '0.14em',
        borderRadius: 3,
        color: 'var(--color-lamp-hot)',
        background: 'linear-gradient(180deg, #241a10 0%, #1a1109 100%)',
        boxShadow:
          'inset 0 1px 2px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(254,223,151,0.2), 0 1px 3px rgba(0,0,0,0.55)',
      }}
    >
      ▲ {sync.pending} unsynced
    </div>
  )
}
