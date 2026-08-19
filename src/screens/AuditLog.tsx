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
      {/*
       * ScreenFrame's own `min-h-full` needs a percentage basis its parent
       * doesn't give it, so on a screen shorter than one viewport the frame
       * collapses to content height instead of stretching — the area below
       * then falls through to #root's near-black ground rather than staying
       * `.steel`. SignIn's screen already carries this same fixed-unit
       * `calc(100dvh…)` for the same reason; a capped audit log is short
       * enough to hit it too (check-material.mjs measured medianL 18).
       */}
      <div className="mx-auto w-full px-2 py-4" style={{ maxWidth: 380, minHeight: 'calc(100dvh - 20px)' }}>
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
          {/* Default (11px) heads: this is the single biggest plate on the
              screen, on par with a Standings row, not a row-scale 8px part. */}
          <CornerScrews inset={7} />
          {/*
           * Broken specular along the top chamfer, CLAUDE.md's own "2px
           * chamfered bevel lit from the top left" — using `--color-plate-spec`,
           * the token the design system defines for exactly this ("broken
           * specular along the top chamfer") but that sat unused everywhere.
           * `.plate`'s own built-in strip peaks around L172 over this face,
           * short of the reference's specular floor (check-material.mjs), so
           * every screen that clears the floor (Board, RollCall, Standings)
           * adds a brighter one on top.
           */}
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: 11,
              right: 11,
              top: 1,
              height: 11,
              background:
                'linear-gradient(90deg, transparent 0%,' +
                ' var(--color-plate-spec) 3%,' +
                ' var(--color-plate-spec) 34%,' +
                ' color-mix(in oklab, var(--color-plate-spec) 58%, transparent) 64%,' +
                ' color-mix(in oklab, var(--color-plate-spec) 20%, transparent) 88%,' +
                ' transparent 100%)',
            }}
          />
          {/* The same key light running down the left chamfer, decaying
              downward — Standings' row plate carries the identical pair. */}
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: 1,
              top: 5,
              width: 5,
              height: 100,
              background:
                'linear-gradient(180deg, transparent 0%,' +
                ' var(--color-plate-spec) 3%,' +
                ' var(--color-plate-spec) 26%,' +
                ' color-mix(in oklab, var(--color-plate-spec) 52%, transparent) 58%,' +
                ' color-mix(in oklab, var(--color-plate-spec) 18%, transparent) 84%,' +
                ' transparent 100%)',
            }}
          />
          {/*
           * The Well's own top/bottom margin was invisible: a block child's
           * vertical margin collapses straight through a parent with no
           * padding/border of its own (`.plate` has neither), so the well was
           * rendering flush with the plate's own top edge — painting directly
           * over the specular strip above, since both share the `.grain > *`
           * z-index and the well comes later in the DOM. Horizontal margins
           * never collapse, which is why the left/right gaps looked fine and
           * this went unnoticed. Padding on this wrapper can't collapse, so it
           * replaces the well's own margin. Top padding runs a bit deeper
           * than the other three sides so the well's own opaque background
           * clears the broken-specular strip above instead of clipping it.
           */}
          <div style={{ padding: 8, paddingTop: 14 }}>
            {/*
             * Capped and internally scrolling, not `height: auto`. A camp's
             * full log can run to hundreds of rows at 26px each —
             * check-material.mjs takes a full-page screenshot, and an
             * unbounded well here turned that into one five-thousand-pixel
             * dark rectangle (medianL 18, spec% 0.02): the log swallowed the
             * frame it was supposed to sit in. A fixed-height panel is also
             * just the right way to show a log that grows without bound.
             */}
            <ColumnLegend />
            <Well
              radius={4}
              style={{
                padding: '4px 0',
                maxHeight: 'calc(100dvh - 400px)',
                overflowY: 'auto',
                /* The document scroll must not hand off to this well's own
                   scroll and back — containment keeps the nested scroller
                   from chaining the rubber-band bounce. */
                overscrollBehavior: 'contain',
              }}
            >
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
          </div>
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

/**
 * Unselected chips were a flat near-black pill — legible, but with ~25 of them
 * across four filter rows they read as generic web-form controls rather than
 * the machined hardware every other control in the app is, and it was most of
 * why this route measured short of the reference's specular floor (0.4%
 * against a 1.1% floor — check-material.mjs). `.brass-band` is the same part
 * Standings' Nameplate already runs at this exact pill scale, so an unselected
 * chip is now a small brass tab with engraved text; the active chip keeps its
 * amber "energized" fill so the selected state stays unmistakable.
 */
function Chip({ text, active, onClick }: { text: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`font-mono uppercase ${active ? '' : 'brass-band engraved'}`}
      style={{
        padding: '3px 7px',
        fontSize: 7,
        letterSpacing: '0.08em',
        borderRadius: 3,
        whiteSpace: 'nowrap',
        color: active ? '#fff1d8' : undefined,
        background: active ? 'linear-gradient(180deg, #7a3d0c 0%, #a55a24 55%, #7c3f10 100%)' : undefined,
        boxShadow: active ? 'inset 0 -1px 0 rgba(255,206,150,0.7), 0 0 6px rgba(237,144,64,0.4)' : undefined,
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
        paddingLeft: COL.padX,
        paddingRight: COL.padX,
        gap: COL.gap,
        borderTop: first ? undefined : '1px solid rgba(28,16,6,0.55)',
        fontSize: 8.5,
        letterSpacing: '0.04em',
        // the original of a reversal stays on the page, struck through
        opacity: row.struck ? 0.48 : 1,
        textDecoration: row.struck ? 'line-through' : undefined,
      }}
    >
      <span style={{ color: 'var(--color-text-dim)', width: COL.time }}>{timeFmt.format(new Date(e.occurredAt))}</span>
      <span
        className="uppercase"
        style={{ color: 'var(--color-text)', width: COL.actor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {actor}
      </span>
      <span style={{ color: 'var(--color-text)', width: COL.team }}>{team}</span>
      <span style={{ color: 'var(--color-text-dim)', width: COL.cat }}>{cat}</span>
      {row.reversal && (
        <span style={{ color: 'var(--color-lamp)', fontSize: 7, letterSpacing: '0.1em' }}>UNDO</span>
      )}
      <span className="flex-1" />
      <span
        className="tabular-nums"
        style={{ color: row.valueDeci < 0 ? 'var(--color-lamp)' : 'var(--color-text)', width: COL.value, textAlign: 'right' }}
      >
        {value}
      </span>
      <span className="tabular-nums" style={{ color: 'var(--color-text-dim)', width: COL.total, textAlign: 'right' }}>
        {formatDeci(row.runningDeci)}
      </span>
    </div>
  )
}

/*
 * The column grid, shared by the legend and every row so the two cannot drift
 * apart — the design system asks for one shared column edge, and a legend that
 * disagrees with its own table is worse than no legend at all.
 */
const COL = { padX: 10, gap: 8, time: 34, actor: 64, team: 62, cat: 40, value: 34, total: 34 }

/**
 * The six columns §6.7 names, engraved into a brass legend strip above the
 * readout window. Equipment labels its readouts on brass, not on bare steel —
 * and this screen had no legend at all, so the running total was just a second
 * unexplained number to the right of the first.
 */
function ColumnLegend() {
  const cell = (w: number, text: string, right = false) => (
    <span
      className="engraved"
      style={{ width: w, textAlign: right ? 'right' : 'left', fontSize: 7, letterSpacing: '0.12em' }}
    >
      {text}
    </span>
  )
  return (
    <div
      className="brass-band relative flex items-center font-mono uppercase"
      style={{
        height: 18,
        paddingLeft: COL.padX,
        paddingRight: COL.padX,
        gap: COL.gap,
        borderRadius: 2,
        marginBottom: 4,
      }}
    >
      <span className="rivet absolute left-[3px] top-1/2 -translate-y-1/2" aria-hidden />
      <span className="rivet absolute right-[3px] top-1/2 -translate-y-1/2" aria-hidden />
      {cell(COL.time, 'Time')}
      {cell(COL.actor, 'Actor')}
      {cell(COL.team, 'Team')}
      {cell(COL.cat, 'Cat')}
      <span className="flex-1" />
      {cell(COL.value, 'Val', true)}
      {cell(COL.total, 'Tot', true)}
    </div>
  )
}
