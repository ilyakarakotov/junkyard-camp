import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { CornerScrews, Plate, ScreenFrame } from '../components/chrome'
import { dayScore, keyCount, standings } from '../data/derive'
import {
  buildAuditSheetRows,
  buildDayRows,
  buildEventsCsv,
  buildStandingsRows,
  downloadFile,
} from '../data/export'
import { formatDeci } from '../data/scoring'
import { useStore } from '../data/store'
import type { Day, ScoreEvent, Team } from '../data/types'

/**
 * Exports & Analytics (§6.6). The Excel workbook and the CSV are built
 * client-side — no server — and the dashboards are hand-rolled SVG on the
 * existing tokens; a charting library would fight the theme and cost more
 * than it saves.
 */
export default function Exports() {
  const navigate = useNavigate()
  const { teams, days, categories, events, activeDay, users, ready } = useStore()

  const scoredDays = useMemo(() => days.filter((d) => d.scored), [days])
  const rows = useMemo(() => standings(events, days, teams), [events, days, teams])

  if (!ready) return <div className="min-h-dvh" />

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    for (const day of days) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildDayRows(day, events, teams)), day.name)
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(buildStandingsRows(rows, teams)),
      'Standings',
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(buildAuditSheetRows(events, teams, categories, users)),
      'Audit',
    )
    XLSX.writeFile(wb, 'junkyard-redemption.xlsx')
  }

  const exportCsv = () =>
    downloadFile('junkyard-events.csv', buildEventsCsv(events), 'text/csv;charset=utf-8')

  return (
    <ScreenFrame band={10} className="min-h-dvh">
      <div className="mx-auto w-full px-2 py-4" style={{ maxWidth: 380 }}>
        <Header title="Exports" onBack={() => navigate('/menu')} />

        {/* ---- the files ---- */}
        <div className="flex" style={{ gap: 8 }}>
          <ExportButton label="Excel workbook" note="Day sheets · standings · audit" onClick={exportExcel} />
          <ExportButton label="CSV event log" note="Every row, raw" onClick={exportCsv} />
        </div>

        <SectionTitle text="Cumulative points by day" />
        <Panel>
          <CumulativeChart teams={teams} events={events} days={scoredDays} />
        </Panel>

        <SectionTitle text={`Category completion — ${activeDay.name}`} />
        <Panel>
          <Heatmap teams={teams} events={events} dayId={activeDay.id} />
        </Panel>

        <SectionTitle text="Perfect 7s by day" />
        <Panel>
          <PerfectSevens teams={teams} events={events} days={scoredDays} />
        </Panel>

        <SectionTitle text="Golden keys by team" />
        <Panel>
          <KeysChart teams={teams} events={events} />
        </Panel>
      </div>
    </ScreenFrame>
  )
}

/* ---- chrome ------------------------------------------------------------- */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-center">
      <button
        onClick={onBack}
        aria-label="Back to menu"
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--color-text-dim)' }}
      >
        ◂ Menu
      </button>
      <h1 className="display-title flex-1 text-center" style={{ fontSize: 24, letterSpacing: '0.06em' }}>
        {title}
      </h1>
      <span style={{ width: 44 }} />
    </div>
  )
}

function SectionTitle({ text }: { text: string }) {
  return (
    <div
      className="font-mono uppercase"
      style={{ margin: '18px 2px 6px', fontSize: 8.5, letterSpacing: '0.2em', color: 'var(--color-brass)' }}
    >
      {text}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Plate chamfer={8} screws={false} style={{ height: 'auto' }}>
      <CornerScrews inset={5} size={8} />
      <div className="relative z-[1]" style={{ padding: '12px 14px' }}>
        {children}
      </div>
    </Plate>
  )
}

function ExportButton({ label, note, onClick }: { label: string; note: string; onClick: () => void }) {
  return (
    <Plate as="button" chamfer={8} onClick={onClick} ariaLabel={label} style={{ height: 56, flex: 1 }}>
      <span className="relative z-[1] flex h-full flex-col items-center justify-center px-2">
        <span
          className="font-display font-semibold uppercase"
          style={{ fontSize: 15, letterSpacing: '0.06em', color: 'var(--color-text)', whiteSpace: 'nowrap' }}
        >
          {label}
        </span>
        <span className="font-mono uppercase" style={{ fontSize: 7, letterSpacing: '0.1em', color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
          {note}
        </span>
      </span>
    </Plate>
  )
}

/* ---- the dashboards ------------------------------------------------------ */

const teamColor = (t: Team) => `var(--color-team-${t.colorToken})`

/** Cumulative totals per scoring day, one line per team. */
function CumulativeChart({ teams, events, days }: { teams: Team[]; events: ScoreEvent[]; days: Day[] }) {
  const W = 320
  const H = 150
  const PAD = { l: 30, r: 8, t: 10, b: 18 }
  const series = teams.map((t) => {
    let acc = 0
    return days.map((d) => {
      acc += dayScore(events, d.id, t.id).totalDeci
      return acc
    })
  })
  const max = Math.max(60, ...series.flat()) // at least a perfect day's headroom
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, days.length - 1)
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Cumulative points by day, one line per team">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="rgba(192,138,62,0.22)" strokeWidth={0.5} />
          <text x={PAD.l - 4} y={y(max * f) + 2.5} textAnchor="end" fontSize={7} fill="var(--color-text-dim)" fontFamily="var(--font-mono)">
            {formatDeci(Math.round(max * f))}
          </text>
        </g>
      ))}
      {days.map((d, i) => (
        <text key={d.id} x={x(i)} y={H - 6} textAnchor="middle" fontSize={7} fill="var(--color-text-dim)" fontFamily="var(--font-mono)">
          {d.name.replace('Day ', 'D')}
        </text>
      ))}
      {series.map((pts, i) => (
        <polyline
          key={teams[i].id}
          points={pts.map((v, j) => `${x(j)},${y(v)}`).join(' ')}
          fill="none"
          stroke={teamColor(teams[i])}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

/** Teams × categories for one day: a lit cell is earned, team-coloured. */
function Heatmap({ teams, events, dayId }: { teams: Team[]; events: ScoreEvent[]; dayId: string }) {
  const cols = ['CLN', 'PNC', 'VRS', 'DEED', 'LSN', 'BHV', 'KEY']
  const W = 320
  const cellW = (W - 92) / cols.length
  const cellH = 17
  return (
    <svg viewBox={`0 0 ${W} ${18 + teams.length * cellH}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Category completion heatmap">
      {cols.map((c, j) => (
        <text key={c} x={88 + j * cellW + cellW / 2} y={10} textAnchor="middle" fontSize={6.5} fill="var(--color-text-dim)" fontFamily="var(--font-mono)">
          {c}
        </text>
      ))}
      {teams.map((t, i) => {
        const s = dayScore(events, dayId, t.id)
        const vals = [
          s.byCategory.cleanliness / 10,
          s.ticks / 7,
          s.byCategory.memory_verse / 10,
          s.byCategory.good_deed / 10,
          s.byCategory.lesson_knowledge / 10,
          s.byCategory.behavior / 10,
          Math.min(1, s.keys / 2),
        ]
        return (
          <g key={t.id}>
            <text x={0} y={18 + i * cellH + cellH / 2 + 2.5} fontSize={7} fill="var(--color-text)" fontFamily="var(--font-mono)">
              {t.shortName}
            </text>
            {vals.map((v, j) => (
              <rect
                key={j}
                x={88 + j * cellW + 1.5}
                y={18 + i * cellH + 2}
                width={cellW - 3}
                height={cellH - 4}
                rx={2}
                fill={v > 0 ? teamColor(t) : 'var(--color-well)'}
                opacity={v > 0 ? 0.35 + v * 0.65 : 1}
                stroke="rgba(255,238,205,0.14)"
                strokeWidth={0.5}
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/** How many teams hit a perfect 7 each scoring day. */
function PerfectSevens({ teams, events, days }: { teams: Team[]; events: ScoreEvent[]; days: Day[] }) {
  const W = 320
  const H = 110
  const counts = days.map(
    (d) => teams.filter((t) => dayScore(events, d.id, t.id).ticks >= 7).length,
  )
  const barW = (W - 40) / days.length - 14
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Perfect sevens by day">
      {counts.map((c, i) => {
        const h = (c / 8) * (H - 34)
        return (
          <g key={i}>
            <rect
              x={20 + i * ((W - 40) / days.length) + 7}
              y={H - 22 - h}
              width={barW}
              height={h}
              rx={2}
              fill="var(--color-lamp)"
              opacity={c > 0 ? 1 : 0.25}
            />
            <text x={20 + i * ((W - 40) / days.length) + 7 + barW / 2} y={H - 26 - h} textAnchor="middle" fontSize={9} fill="var(--color-text)" fontFamily="var(--font-mono)">
              {c}
            </text>
            <text x={20 + i * ((W - 40) / days.length) + 7 + barW / 2} y={H - 8} textAnchor="middle" fontSize={7} fill="var(--color-text-dim)" fontFamily="var(--font-mono)">
              {days[i].name.replace('Day ', 'D')}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Keys held per team, gold bars. */
function KeysChart({ teams, events }: { teams: Team[]; events: ScoreEvent[] }) {
  const W = 320
  const rowH = 17
  const counts = teams.map((t) => ({ t, keys: keyCount(events, t.id) }))
  const max = Math.max(1, ...counts.map((c) => c.keys))
  return (
    <svg viewBox={`0 0 ${W} ${teams.length * rowH + 4}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Golden keys by team">
      {counts.map(({ t, keys }, i) => (
        <g key={t.id}>
          <text x={0} y={i * rowH + 11.5} fontSize={7} fill="var(--color-text)" fontFamily="var(--font-mono)">
            {t.shortName}
          </text>
          <rect x={64} y={i * rowH + 3} width={W - 92} height={rowH - 6} rx={2} fill="var(--color-well)" stroke="rgba(255,238,205,0.12)" strokeWidth={0.5} />
          {keys > 0 && (
            <rect
              x={64}
              y={i * rowH + 3}
              width={((W - 92) * keys) / max}
              height={rowH - 6}
              rx={2}
              fill="var(--color-key)"
              style={{ filter: 'drop-shadow(0 0 3px rgba(255,198,61,0.55))' }}
            />
          )}
          <text x={W - 24} y={i * rowH + 11.5} textAnchor="end" fontSize={7.5} fill="var(--color-text)" fontFamily="var(--font-mono)">
            {keys}
          </text>
        </g>
      ))}
    </svg>
  )
}
