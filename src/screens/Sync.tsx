import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTab, CornerScrews, Lamp, Plate, ScreenFrame, Well } from '../components/chrome'
import { CAMP_TIMEZONE, formatCampDate } from '../data/campday'
import type { BlockedEvent } from '../data/DataProvider'
import { faultHeadline, faultRemedy } from '../data/syncFault'
import { useStore } from '../data/store'

/**
 * The sync screen: what the backend is actually doing, and one control that
 * makes it try again.
 *
 * This exists because a leader reported the app not syncing on a phone with
 * four bars, and there was nothing anywhere in the interface — or in the
 * code — that could tell her why. Every failure in the write path was caught
 * by a bare `catch { return }` commented "still offline", so a refused row, an
 * expired session and a dead zone were one indistinguishable silence with
 * `▲ N UNSYNCED` next to it. Her only move was to close the app and open it
 * again, which sent the same rejected batch at the same server.
 *
 * So: the readout says what happened in the server's own words, the button
 * retries everything including what has been held back, and the list names
 * every award that is stuck and what to do about it. What the screen never
 * offers is a way to throw an award away — there is no discard control here,
 * because a held award is still a point a team earned.
 */
export default function Sync() {
  const navigate = useNavigate()
  const { sync, forceSync, listBlockedEvents, teams, categories, days } = useStore()
  const [blocked, setBlocked] = useState<BlockedEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [ran, setRan] = useState(false)
  const [recovered, setRecovered] = useState(0)

  const reload = useCallback(() => {
    void listBlockedEvents().then(setBlocked)
  }, [listBlockedEvents])
  useEffect(reload, [reload, sync?.blocked, sync?.pending])

  const run = async () => {
    setBusy(true)
    setRan(false)
    const result = await forceSync()
    // The outcome is read off the state the attempt left behind, never
    // announced because the promise settled: "SYNCED" over a queue that did
    // not move is the same lie the old silent catch told.
    setRecovered(result.recovered)
    setBusy(false)
    setRan(true)
  }

  const pending = sync?.pending ?? 0
  const held = sync?.blocked ?? 0
  const fault = sync?.fault ?? null
  const clear = pending === 0 && !fault

  const teamName = (id: string) => teams.find((t) => t.id === id)?.shortName ?? id
  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id
  const dayName = (id: string) => days.find((d) => d.id === id)?.name ?? id

  return (
    <ScreenFrame band={10} className="min-h-svh">
      {/*
       * The dark wall behind the parts, exactly as Menu.tsx does it: a short
       * screen whose interior falls through to raw `.steel` reads as one flat
       * brass sheet with no bevel to specular off (scripts/check-material.mjs).
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
        <div
          className="mx-auto flex w-full flex-col px-2 py-4"
          style={{ maxWidth: 340, minHeight: 'calc(100svh - 52px)' }}
        >
          <div className="mb-2 flex items-center gap-2">
            {/* one back control, one size, one place — see BackTab in chrome.tsx */}
            <BackTab label="Back to menu" onClick={() => navigate('/menu')} style={{ marginLeft: -4 }} />
            <span className="flex-1" />
            <span className="tech-label" style={{ color: 'var(--color-text-dim)' }}>
              {sync ? (sync.online ? 'Link up' : 'Link down') : 'Local only'}
            </span>
          </div>

          <h1 className="display-title mb-4" style={{ fontSize: 26, letterSpacing: '0.06em' }}>
            Sync
          </h1>

          {sync === null ? (
            <Plate chamfer={8} screws={false} style={{ height: 'auto' }}>
              <CornerScrews inset={5} size={8} />
              <p className="relative z-[1] px-4 py-4 font-body" style={{ fontSize: 13, color: 'var(--color-text)' }}>
                This build has no backend configured, so scores stay on this
                device. Nothing is waiting to be sent, and nothing is lost.
              </p>
            </Plate>
          ) : (
            <>
              <Readout
                clear={clear}
                pending={pending}
                held={held}
                lastSyncAt={sync.lastSyncAt}
                online={sync.online}
              />

              {fault && <Fault headline={faultHeadline(fault)} remedy={faultRemedy(fault)} code={fault.code} message={fault.message} />}

              <ForceButton busy={busy || sync.syncing} onPress={() => void run()} />

              {ran && !busy && (
                <div role="status" className="mt-2">
                  <p
                    className="tech-label text-center"
                    style={{ color: clear ? 'var(--color-lamp-hot)' : 'var(--color-text-dim)' }}
                  >
                    {clear
                      ? 'Everything is on the server'
                      : `${pending} still waiting${held > 0 ? ` · ${held} held` : ''}`}
                  </p>
                  {recovered > 0 && (
                    /*
                     * Said out loud because it changed the record: these
                     * awards went through credited to whoever pressed the
                     * button, not to whoever originally made them. The note
                     * on each one says so too, in the audit log.
                     */
                    <p
                      className="font-body mt-1 text-center"
                      style={{ fontSize: 12, color: 'var(--color-lamp-hot)' }}
                    >
                      {recovered} {recovered === 1 ? 'award was' : 'awards were'} stuck on who
                      recorded {recovered === 1 ? 'it' : 'them'} — sent through under your name,
                      and marked as recovered in the audit log.
                    </p>
                  )}
                </div>
              )}

              {blocked.length > 0 && (
                <div className="mt-5">
                  <p className="tech-label mb-2" style={{ color: 'var(--color-text-dim)' }}>
                    Held on this device · {blocked.length}
                  </p>
                  <div className="flex flex-col" style={{ gap: 8 }}>
                    {blocked.map((b) => (
                      <HeldRow
                        key={b.event.id}
                        blocked={b}
                        team={teamName(b.event.teamId)}
                        category={catLabel(b.event.categoryId)}
                        day={dayName(b.event.dayId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/*
               * A caption under the control, not a footer pinned to the floor:
               * on a clear screen there is nothing between the two, and a lone
               * paragraph at the bottom of an empty wall reads as a screen
               * that failed to finish loading.
               */}
              <p
                className="font-body"
                style={{ marginTop: 14, fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-text-dim)' }}
              >
                {clear
                  ? "Every award made on this phone is on the server. The other leaders' screens and the big screen have all of them."
                  : 'Nothing here is ever deleted. An award the server will not take stays on this phone and keeps counting on this phone\u2019s board — it is only missing from the other screens until it goes through.'}
              </p>
            </>
          )}
        </div>
      </div>
    </ScreenFrame>
  )
}

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CAMP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** The state of the link, as four engraved rows in a recess. */
function Readout({
  clear,
  pending,
  held,
  lastSyncAt,
  online,
}: {
  clear: boolean
  pending: number
  held: number
  lastSyncAt: string | null
  online: boolean
}) {
  const stamp = lastSyncAt ? new Date(lastSyncAt) : null
  return (
    <Plate chamfer={8} screws={false} style={{ height: 'auto' }}>
      <CornerScrews inset={5} size={8} />
      {/* the key light catching the top chamfer, decaying left to right */}
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
      <div className="relative z-[1] px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          {/*
           * A lit lamp is amber, never teal (CLAUDE.md), and it is lit only
           * when the queue is genuinely empty. A lamp that burns on `online`
           * would be lit right now on the phone this screen was built for.
           */}
          <Lamp on={clear} size={12} intensity={clear ? 1 : 0.4} />
          <span
            className="font-display uppercase"
            style={{ fontSize: 15, letterSpacing: '0.08em', color: 'var(--color-text)' }}
          >
            {clear ? 'All sent' : held > 0 ? 'Held back' : 'Waiting to send'}
          </span>
        </div>
        <Well style={{ padding: '6px 8px' }}>
          <Row label="Unsent awards" value={String(pending)} />
          <Row label="Held by server" value={String(held)} dim={held === 0} />
          <Row
            label="Last reached server"
            value={stamp ? `${timeFmt.format(stamp)} · ${formatCampDate(stamp.toISOString().slice(0, 10))}` : 'not yet'}
            dim={!stamp}
          />
          <Row label="Phone link" value={online ? 'up' : 'down'} dim={!online} last />
        </Well>
      </div>
    </Plate>
  )
}

function Row({
  label,
  value,
  dim = false,
  last = false,
}: {
  label: string
  value: string
  dim?: boolean
  last?: boolean
}) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{
        height: 22,
        borderBottom: last ? undefined : '1px solid rgba(255,236,205,0.06)',
      }}
    >
      <span className="tech-label" style={{ color: 'var(--color-text-dim)' }}>
        {label}
      </span>
      <span
        className="font-mono tabular-nums"
        style={{
          fontSize: 11,
          letterSpacing: '0.04em',
          color: dim ? 'var(--color-text-dim)' : 'var(--color-text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * The fault panel. Struck caution striping and amber, matching BackdateBanner
 * — the app already has one warning material and a second one would only
 * teach leaders that warnings are decoration.
 */
function Fault({
  headline,
  remedy,
  code,
  message,
}: {
  headline: string
  remedy: string
  code: string | null
  message: string
}) {
  return (
    <div
      role="status"
      className="relative mt-2 overflow-hidden"
      style={{
        borderRadius: 4,
        background: 'linear-gradient(180deg, #33200a 0%, #281607 55%, #1e1005 100%)',
        boxShadow:
          'inset 0 2px 3px rgba(0,0,0,0.75), inset 0 -1px 0 rgba(254,223,151,0.3), 0 0 10px rgba(237,144,64,0.28)',
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full"
        style={{
          width: 10,
          background: 'repeating-linear-gradient(135deg, var(--color-lamp) 0 3px, #2a1607 3px 6px)',
          boxShadow: 'inset -1px 0 0 rgba(20,10,3,0.8), 1px 0 0 rgba(254,223,151,0.22)',
          opacity: 0.9,
        }}
      />
      <div style={{ paddingLeft: 20, paddingRight: 12, paddingTop: 9, paddingBottom: 10 }}>
        <p
          className="font-display uppercase"
          style={{ fontSize: 13, letterSpacing: '0.07em', color: 'var(--color-lamp-hot)' }}
        >
          {headline}
        </p>
        <p className="font-body" style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-text)' }}>
          {remedy}
        </p>
        <p
          className="font-mono"
          style={{
            marginTop: 6,
            fontSize: 9,
            lineHeight: 1.5,
            letterSpacing: '0.04em',
            color: 'var(--color-text-dim)',
            wordBreak: 'break-word',
          }}
        >
          {code ? `${code} · ` : ''}
          {message}
        </p>
      </div>
    </div>
  )
}

/**
 * The one control on the screen, in the app's affirmative material: a solid
 * brass slab with the lettering engraved dark into it, the same treatment
 * BrassConfirm gives the button that commits. A plate would have read as a
 * fourth readout — this has to read as the thing you press.
 */
function ForceButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return (
    <button
      onClick={busy ? undefined : onPress}
      disabled={busy}
      aria-label="Force sync now"
      className="font-display relative w-full overflow-hidden uppercase"
      style={{
        height: 62,
        marginTop: 10,
        borderRadius: 4,
        color: '#2a1c0c',
        background:
          'linear-gradient(180deg, var(--color-brass-hi) 0%, var(--color-brass) 55%, var(--color-brass-lo) 100%)',
        boxShadow: '0 3px 7px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,244,214,0.7)',
        /* Unpowered brass rather than a hidden button: the control is there,
           it is simply already doing the thing. */
        opacity: busy ? 0.45 : 1,
        filter: busy ? 'saturate(0.5)' : undefined,
      }}
    >
      {/* knurled grip bands at each end, so the slab reads as hardware */}
      {[6, undefined].map((left, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute"
          style={{
            top: 8,
            bottom: 8,
            width: 9,
            left,
            right: left === undefined ? 6 : undefined,
            borderRadius: 2,
            background:
              'repeating-linear-gradient(90deg, color-mix(in oklab, var(--color-knurl) 70%, #3a2a12) 0 2px, rgba(255,244,214,0.42) 2px 3px)',
            boxShadow: 'inset 0 1px 2px rgba(42,28,12,0.55)',
            opacity: 0.55,
          }}
        />
      ))}
      <span className="relative flex h-full flex-col items-center justify-center">
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.11em' }}>
          {busy ? 'Sending' : 'Force sync now'}
        </span>
        <span
          className="font-mono"
          style={{
            marginTop: 3,
            fontSize: 8,
            letterSpacing: '0.1em',
            color: 'rgba(42,28,12,0.72)',
          }}
        >
          {busy ? 'Working' : 'Retries everything, held awards included'}
        </span>
      </span>
    </button>
  )
}

/** One held award: what it was, and why it has not gone. */
function HeldRow({
  blocked,
  team,
  category,
  day,
}: {
  blocked: BlockedEvent
  team: string
  category: string
  day: string
}) {
  const { event, fault, attempts } = blocked
  return (
    <Plate chamfer={6} screws={false} style={{ height: 'auto' }}>
      <div className="relative z-[1] px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="font-display uppercase"
            style={{ fontSize: 13, letterSpacing: '0.05em', color: 'var(--color-text)' }}
          >
            {team} · {category}
          </span>
          <span className="tech-label" style={{ color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
            {day}
          </span>
        </div>
        <p className="font-body" style={{ marginTop: 2, fontSize: 12, color: 'var(--color-lamp-hot)' }}>
          {faultHeadline(fault)}
        </p>
        <p
          className="font-mono"
          style={{
            marginTop: 3,
            fontSize: 8.5,
            letterSpacing: '0.05em',
            color: 'var(--color-text-dim)',
          }}
        >
          {timeFmt.format(new Date(event.occurredAt))} · {attempts} {attempts === 1 ? 'try' : 'tries'}
          {fault.code ? ` · ${fault.code}` : ''}
        </p>
      </div>
    </Plate>
  )
}
