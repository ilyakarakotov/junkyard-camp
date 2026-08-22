import { useState } from 'react'
import { useStore } from '../data/store'
import { BrassConfirm, CornerScrews, Plate } from './chrome'

/**
 * The sync panel — what a leader whose points are not moving can actually do
 * about it, on the one screen they already know how to reach.
 *
 * It exists because of a real failure at camp. A phone held two days of real
 * awards it could not deliver: the server was refusing one poisoned row, the
 * batch insert took every other award down with it, and every error was
 * swallowed by a bare `catch {}`. The leader had a working connection, saw
 * `▲ N UNSYNCED`, restarted the app repeatedly, and there was nothing — on
 * screen, in the console, anywhere — that said what was wrong or offered a way
 * out. Everything below is the answer to that: say what happened, in plain
 * words, and put the two recoveries within one thumb's reach.
 *
 * It renders nothing when there is nothing to say. A clean sync is not news.
 */
export default function SyncPanel() {
  const { sync, retrySync, repairSyncActor } = useStore()
  const [busy, setBusy] = useState<'retry' | 'repair' | null>(null)
  const [askRepair, setAskRepair] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // Local-only mode has no backend, and a clear outbox needs no panel.
  if (!sync || (sync.pending === 0 && !sync.lastError)) return null

  const stuck = sync.blocked > 0
  const lamp = stuck ? 'var(--color-rust)' : sync.online ? 'var(--color-lamp)' : 'var(--color-off-knob)'

  const run = async (which: 'retry' | 'repair') => {
    setBusy(which)
    setResult(null)
    try {
      if (which === 'retry') {
        await retrySync()
        setResult('Sent. Anything still listed below the server refused again.')
      } else {
        const n = await repairSyncActor()
        setResult(
          n === 0
            ? 'Nothing to re-submit.'
            : `${n} award${n === 1 ? '' : 's'} re-submitted as you.`,
        )
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Plate chamfer={8} screws={false} style={{ marginBottom: 8 }}>
        <CornerScrews inset={5} size={8} />
        {/* The same key light the menu's own plates carry, decaying left to
            right. One light direction on every screen; a panel that skips it
            reads as a different material bolted to the same wall. */}
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
        <div className="relative z-[1] flex flex-col px-4 py-3" style={{ gap: 8 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            {/* An energized contact is amber, never teal — and a refused one
                is rust. The lamp is the one thing read at arm's length. */}
            <span
              aria-hidden
              style={{
                width: 9,
                height: 9,
                borderRadius: 9999,
                background: lamp,
                boxShadow: `0 0 6px 1px ${lamp}, inset 0 1px 0 rgba(255,255,255,0.4)`,
              }}
            />
            <span
              className="font-display font-semibold uppercase"
              style={{ fontSize: 14, letterSpacing: '0.06em', color: 'var(--color-text)' }}
            >
              {stuck ? 'Sync blocked' : 'Waiting to sync'}
            </span>
            <span className="flex-1" />
            <span
              className="font-mono uppercase tabular-nums"
              style={{
                fontSize: 8,
                letterSpacing: '0.12em',
                color: 'color-mix(in oklab, var(--color-text) 72%, var(--color-plate-lo))',
              }}
            >
              {sync.pending} held{sync.blocked > 0 ? ` · ${sync.blocked} refused` : ''}
            </span>
          </div>

          <p
            className="font-body"
            style={{ fontSize: 13, lineHeight: 1.42, color: 'var(--color-text)', margin: 0 }}
          >
            {sync.lastError
              ? sync.lastError.plain
              : sync.online
                ? 'Points are queued on this device and have not reached the server yet.'
                : 'No connection. Points are safe on this device and will go up on their own.'}
          </p>

          {/* Nothing here can lose a point: every award stays in the outbox
              until the server confirms it, so the worst a press can do is
              fail again. Say so — it is the reason to press it. */}
          <p
            className="font-mono uppercase"
            style={{
              fontSize: 8,
              letterSpacing: '0.1em',
              /* Dim, but on a lit plate: --text-dim disappears into brass. */
              color: 'color-mix(in oklab, var(--color-text) 72%, var(--color-plate-lo))',
              margin: 0,
            }}
          >
            Nothing is lost — points stay on this phone until the server takes them
          </p>

          {result && (
            <p
              className="font-body"
              style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-lamp-hot)', margin: 0 }}
            >
              {result}
            </p>
          )}

          <div className="flex" style={{ gap: 8 }}>
            <button
              onClick={() => void run('retry')}
              disabled={busy !== null}
              className="brass-band font-display flex-1 uppercase"
              style={{
                minHeight: 44,
                borderRadius: 3,
                fontSize: 12,
                letterSpacing: '0.12em',
                color: 'var(--color-text)',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy === 'retry' || sync.syncing ? 'Syncing…' : 'Retry sync now'}
            </button>
            {sync.wrongActor > 0 && (
              <button
                onClick={() => setAskRepair(true)}
                disabled={busy !== null}
                className="brass-band font-display flex-1 uppercase"
                style={{
                  minHeight: 44,
                  borderRadius: 3,
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  color: 'var(--color-text)',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Re-submit as me
              </button>
            )}
          </div>
        </div>
      </Plate>

      {askRepair && (
        <BrassConfirm
          title="Re-submit as you?"
          body={`${sync.wrongActor} award${sync.wrongActor === 1 ? ' was' : 's were'} recorded on this phone under a different sign-in, which is why the server keeps refusing them. Re-submitting stamps them with your name and sends them again. The points are correct either way — only who the log credits changes.`}
          confirmLabel="Re-submit"
          onConfirm={() => {
            setAskRepair(false)
            void run('repair')
          }}
          onCancel={() => setAskRepair(false)}
        />
      )}
    </>
  )
}
