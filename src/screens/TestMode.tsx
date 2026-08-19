import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { useStore } from '../data/store'
import {
  isTestMode,
  mayUseTestMode,
  realLogSize,
  setTestMode,
  setTestRole,
  testRole,
} from '../data/testMode'
import { BracketRule, CornerScrews, Lamp, Plate, ScreenFrame, ScreenHeader, Well } from '../components/chrome'

/**
 * The rehearsal room (`/test`). One switch throws the whole data layer over
 * to a sandbox log, and everything below the switch exists to get that
 * sandbox into an interesting state quickly — a full camp of scores, a team
 * with four keys, a helper's view of the key rail.
 *
 * The screen is deliberately plain hardware: a bare switch panel bolted to
 * the wall, not another scoring surface. It should never be mistaken for a
 * screen the camp uses.
 */

const LABEL: React.CSSProperties = {
  fontSize: 8.5,
  letterSpacing: '0.16em',
  color: 'var(--color-text-dim)',
}

/** A plain engraved push button. Not a Breaker — nothing here awards a point. */
function Push({
  label,
  onClick,
  tone = 'plain',
  disabled,
}: {
  label: string
  onClick: () => void
  tone?: 'plain' | 'hot'
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-display flex-1 uppercase"
      style={{
        minHeight: 44,
        padding: '10px 8px',
        fontSize: 12,
        letterSpacing: '0.12em',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.4 : 1,
        color: tone === 'hot' ? 'var(--color-lamp-hot)' : 'var(--color-text)',
        background:
          tone === 'hot'
            ? 'linear-gradient(180deg, #3a2410 0%, #241607 100%)'
            : 'linear-gradient(180deg, #2a2016 0%, #1d1610 100%)',
        boxShadow:
          'inset 0 2px 3px rgba(0,0,0,0.65), inset 0 -1px 0 rgba(255,232,190,0.16), 0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="font-mono mb-2 uppercase" style={LABEL}>
        {title}
      </div>
      <div className="flex flex-col" style={{ gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

export default function TestMode() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { days, teams, events, activeDay, sandbox, testMode } = useStore()
  const [busy, setBusy] = useState(false)
  const [teamIdx, setTeamIdx] = useState(0)

  // The route is reachable by typing it, so it guards itself rather than
  // trusting the menu not to have drawn the item.
  if (!mayUseTestMode(user)) return <Navigate to="/" replace />

  const on = isTestMode() && testMode
  const role = testRole()
  const team = teams[teamIdx]
  const actorId = user?.id ?? 'leader-1'

  const run = (work: () => Promise<void>) => {
    setBusy(true)
    void work().finally(() => setBusy(false))
  }

  return (
    <ScreenFrame band={10} className="min-h-dvh">
      <div className="mx-auto w-full px-3 pb-8" style={{ maxWidth: 360 }}>
        <ScreenHeader title="Test Mode" back />
        <BracketRule className="mb-4" />

        {/* ---- the master switch ------------------------------------- */}
        <Plate chamfer={8} screws={false} style={{ padding: 14 }}>
          <CornerScrews inset={6} size={9} />
          <div className="relative z-[1] flex items-center gap-3">
            <Lamp on={on} size={18} intensity={on ? 1 : 0} />
            <div className="flex-1">
              <div
                className="font-display uppercase"
                style={{ fontSize: 17, letterSpacing: '0.08em', color: 'var(--color-text)' }}
              >
                Sandbox {on ? 'engaged' : 'off'}
              </div>
              <div className="font-mono uppercase" style={{ ...LABEL, fontSize: 7.5 }}>
                {on ? 'nothing here reaches the camp' : 'you are on the real camp log'}
              </div>
            </div>
          </div>

          <div className="relative z-[1] mt-3 flex" style={{ gap: 8 }}>
            {on ? (
              <Push label="Leave test mode" tone="hot" onClick={() => setTestMode(false)} />
            ) : (
              <Push label="Enter test mode" tone="hot" onClick={() => setTestMode(true)} />
            )}
          </div>
        </Plate>

        {/*
         * What the switch actually does, in the two sentences that matter.
         * A sandbox nobody trusts gets used once and then avoided, so the
         * separation is stated on the screen and backed by a live count of
         * the real log sitting untouched behind it.
         */}
        <Well radius={3} style={{ marginTop: 10, padding: '10px 12px' }}>
          <p
            className="font-body"
            style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-text-dim)' }}
          >
            Test mode swaps the data layer for a separate log stored on this device.
            Awards you make here never reach Supabase and never appear on anyone
            else&rsquo;s screen. Every scoring day is unlocked, so you can score
            Day&nbsp;1 through Day&nbsp;4 freely.
          </p>
          <p className="font-mono mt-2 uppercase" style={{ ...LABEL, fontSize: 7.5 }}>
            real camp log · {realLogSize()} events · untouched
          </p>
        </Well>

        {!on && (
          <p className="font-mono mt-4 text-center uppercase" style={{ ...LABEL, fontSize: 7.5 }}>
            throw the switch to reveal the controls
          </p>
        )}

        {on && sandbox && (
          <>
            {/* ---- role ---------------------------------------------- */}
            <Section title="View the app as">
              <div className="flex" style={{ gap: 8 }}>
                <Push
                  label="Director"
                  tone={role === 'director' ? 'hot' : 'plain'}
                  onClick={() => role !== 'director' && setTestRole('director')}
                />
                <Push
                  label="Helper"
                  tone={role === 'helper' ? 'hot' : 'plain'}
                  onClick={() => role !== 'helper' && setTestRole('helper')}
                />
              </div>
              <p className="font-mono uppercase" style={{ ...LABEL, fontSize: 7.5 }}>
                helper hides golden keys and the day unlock
              </p>
            </Section>

            {/* ---- sample data --------------------------------------- */}
            <Section title="Sample scores">
              <div className="flex" style={{ gap: 8 }}>
                <Push
                  label="Fill all days"
                  disabled={busy}
                  onClick={() => run(() => sandbox.fillCamp(actorId))}
                />
                <Push
                  label={`Fill ${activeDay.name}`}
                  disabled={busy || !activeDay.scored}
                  onClick={() => run(() => sandbox.fillDay(activeDay.id, actorId))}
                />
              </div>
              <Push
                label="Clear the sandbox"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Erase every score in the sandbox?')) {
                    run(() => sandbox.reset())
                  }
                }}
              />
              <p className="font-mono uppercase" style={{ ...LABEL, fontSize: 7.5 }}>
                sandbox holds {events.length} events across{' '}
                {days.filter((d) => d.scored).length} scoring days
              </p>
            </Section>

            {/* ---- keys ---------------------------------------------- */}
            <Section title="Golden keys">
              <button
                onClick={() => setTeamIdx((i) => (i + 1) % teams.length)}
                className="font-display flex items-center justify-between uppercase"
                style={{
                  minHeight: 44,
                  padding: '10px 12px',
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  borderRadius: 4,
                  color: `var(--color-team-${team?.colorToken})`,
                  background: 'linear-gradient(180deg, #241a10 0%, #1a1109 100%)',
                  boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(255,232,190,0.14)',
                }}
              >
                <span>{team?.shortName}</span>
                <span className="font-mono" style={{ ...LABEL, fontSize: 7.5 }}>
                  tap to change ▸
                </span>
              </button>
              <div className="flex" style={{ gap: 8 }}>
                <Push
                  label="+ 1 key"
                  disabled={busy || !team}
                  onClick={() => team && run(() => sandbox.giveKeys(activeDay.id, team.id, 1, actorId))}
                />
                <Push
                  label="+ 4 keys"
                  disabled={busy || !team}
                  onClick={() => team && run(() => sandbox.giveKeys(activeDay.id, team.id, 4, actorId))}
                />
              </div>
              <p className="font-mono uppercase" style={{ ...LABEL, fontSize: 7.5 }}>
                four keys is where the rail starts counting instead of drawing
              </p>
            </Section>

            {/* ---- shortcuts ----------------------------------------- */}
            <Section title="Jump to">
              <div className="flex" style={{ gap: 8 }}>
                <Push label="Board" onClick={() => navigate('/')} />
                <Push label="Standings" onClick={() => navigate('/standings')} />
                <Push label="Big screen" onClick={() => navigate('/display')} />
              </div>
            </Section>
          </>
        )}
      </div>
    </ScreenFrame>
  )
}
