import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerScrews, Plate, ScreenFrame, Well } from '../components/chrome'
import { CAMP_TIMEZONE } from '../data/campday'
import { buildAuditRows } from '../data/export'
import { formatDeci } from '../data/scoring'
import { useStore } from '../data/store'

/**
 * The audit log (§6.7): who gave what to whom, and when — full
 * accountability. Reverse-chronological, reversals shown inline with the
 * original struck through rather than removed. This screen is the reason
 * the log is append-only: there is no edit or delete path anywhere.
 */
export default function AuditLog() {
  const navigate = useNavigate()
  const { teams, days, categories, events, users, ready } = useStore()

  const [dayId, setDayId] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [actorId, setActorId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const rows = useMemo(() => buildAuditRows(events), [events])

  const actorName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.displayName]))
    return (id: string) => map.get(id) ?? (id.startsWith('leader') ? 'Leader' : id.slice(0, 6))
  }, [users])

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!dayId || r.event.dayId === dayId) &&
          (!teamId || r.event.teamId === teamId) &&
          (!actorId || r.event.actorId === actorId) &&
          (!categoryId || r.event.categoryId === categoryId),
      ),
    [rows, dayId, teamId, actorId, categoryId],
  )

  const teamName = (id: string) => teams.find((t) => t.id === id)?.shortName ?? id
  const catGlyph = (id: string) => categories.find((c) => c.id === id)?.glyph ?? id
  const actorIds = useMemo(() => [...new Set(events.map((e) => e.actorId))], [events])

  if (!ready) return <div className="min-h-dvh" />

  return (
    <ScreenFrame band={10} className="min-h-dvh">
      <div className="mx-auto w-full px-2 py-4" style={{ maxWidth: 380 }}>
        <div className="mb-3 flex items-center">
          <button
            onClick={() => navigate('/menu')}
            aria-label="Back to menu"
            className="font-mono uppercase"
            style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--color-text-dim)' }}
          >
            ◂ Menu
          </button>
          <h1 className="display-title flex-1 text-center" style={{ fontSize: 24, letterSpacing: '0.06em' }}>
            Audit Log
          </h1>
          <span style={{ width: 44 }} />
        </div>

        <FilterRow
          label="Day"
          options={days.map((d) => ({ id: d.id, text: d.name.replace('Day ', 'D') }))}
          value={dayId}
          onChange={setDayId}
        />
        <FilterRow
          label="Team"
          options={teams.map((t) => ({ id: t.id, text: t.shortName }))}
          value={teamId}
          onChange={setTeamId}
        />
        <FilterRow
          label="Actor"
          options={actorIds.map((a) => ({ id: a, text: actorName(a) }))}
          value={actorId}
          onChange={setActorId}
        />
        <FilterRow
          label="Category"
          options={categories.map((c) => ({ id: c.id, text: c.glyph }))}
          value={categoryId}
          onChange={setCategoryId}
        />

        <Plate chamfer={8} screws={false} style={{ height: 'auto', marginTop: 10 }}>
          <CornerScrews inset={5} size={8} />
          <Well radius={4} style={{ margin: 8, padding: '4px 0' }}>
            {filtered.length === 0 && (
              <div
                className="py-6 text-center font-mono uppercase"
                style={{ fontSize: 8.5, letterSpacing: '0.16em', color: 'var(--color-text-dim)' }}
              >
                No events match
              </div>
            )}
            {filtered.slice(0, 200).map((r, i) => (
              <AuditLine
                key={r.event.id}
                row={r}
                first={i === 0}
                actor={actorName(r.event.actorId)}
                team={teamName(r.event.teamId)}
                cat={catGlyph(r.event.categoryId)}
              />
            ))}
            {filtered.length > 200 && (
              <div
                className="py-2 text-center font-mono uppercase"
                style={{ fontSize: 7.5, letterSpacing: '0.14em', color: 'var(--color-text-dim)' }}
              >
                Showing 200 of {filtered.length}
              </div>
            )}
          </Well>
        </Plate>
      </div>
    </ScreenFrame>
  )
}

/* ---- filters -------------------------------------------------------------- */

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; text: string }[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <div className="mb-1 flex items-center" style={{ gap: 5 }}>
      <span
        className="font-mono uppercase"
        style={{ width: 44, fontSize: 7, letterSpacing: '0.12em', color: 'var(--color-brass)' }}
      >
        {label}
      </span>
      <div className="flex flex-1 flex-wrap" style={{ gap: 4 }}>
        <Chip text="ALL" active={value === null} onClick={() => onChange(null)} />
        {options.map((o) => (
          <Chip key={o.id} text={o.text} active={value === o.id} onClick={() => onChange(o.id)} />
        ))}
      </div>
    </div>
  )
}

function Chip({ text, active, onClick }: { text: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="font-mono uppercase"
      style={{
        padding: '3px 7px',
        fontSize: 7,
        letterSpacing: '0.08em',
        borderRadius: 3,
        whiteSpace: 'nowrap',
        color: active ? '#fff1d8' : 'var(--color-text-dim)',
        background: active
          ? 'linear-gradient(180deg, #7a3d0c 0%, #a55a24 55%, #7c3f10 100%)'
          : 'linear-gradient(180deg, #2c2114 0%, #221809 100%)',
        boxShadow: active
          ? 'inset 0 -1px 0 rgba(255,206,150,0.7), 0 0 6px rgba(237,144,64,0.4)'
          : 'inset 0 1px 2px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,232,190,0.1)',
      }}
    >
      {text}
    </button>
  )
}

/* ---- the log line ---------------------------------------------------------- */

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CAMP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function AuditLine({
  row,
  first,
  actor,
  team,
  cat,
}: {
  row: ReturnType<typeof buildAuditRows>[number]
  first: boolean
  actor: string
  team: string
  cat: string
}) {
  const e = row.event
  const value = `${row.valueDeci >= 0 ? '+' : '−'}${formatDeci(Math.abs(row.valueDeci))}`
  return (
    <div
      className="flex items-center font-mono"
      style={{
        height: 26,
        paddingLeft: 10,
        paddingRight: 10,
        gap: 8,
        borderTop: first ? undefined : '1px solid rgba(28,16,6,0.55)',
        fontSize: 8.5,
        letterSpacing: '0.04em',
        // the original of a reversal stays on the page, struck through
        opacity: row.struck ? 0.48 : 1,
        textDecoration: row.struck ? 'line-through' : undefined,
      }}
    >
      <span style={{ color: 'var(--color-text-dim)', width: 34 }}>{timeFmt.format(new Date(e.occurredAt))}</span>
      <span
        className="uppercase"
        style={{ color: 'var(--color-text)', width: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {actor}
      </span>
      <span style={{ color: 'var(--color-text)', width: 62 }}>{team}</span>
      <span style={{ color: 'var(--color-text-dim)', width: 40 }}>{cat}</span>
      {row.reversal && (
        <span style={{ color: 'var(--color-lamp)', fontSize: 7, letterSpacing: '0.1em' }}>UNDO</span>
      )}
      <span className="flex-1" />
      <span
        className="tabular-nums"
        style={{ color: row.valueDeci < 0 ? 'var(--color-lamp)' : 'var(--color-text)', width: 34, textAlign: 'right' }}
      >
        {value}
      </span>
      <span className="tabular-nums" style={{ color: 'var(--color-text-dim)', width: 34, textAlign: 'right' }}>
        {formatDeci(row.runningDeci)}
      </span>
    </div>
  )
}
